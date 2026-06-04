/**
 * The thin SVG EMIT layer (design §2.3, §2.4, §6.8, §7): it walks the positioned
 * layout model `buildLayoutModel` produced (`layout.js`, T6) and turns it into an
 * `<svg role="img">` DOM tree. It is deliberately layout-math-FREE — every X/Y,
 * width, span control point, beam Y, etc. is already computed in staff-space (sp)
 * units by the layout layer; this module only:
 *
 * - builds DOM via `createElementNS` (never `innerHTML`), so author free text
 *   (`chordSymbol`, the accessible-name `<title>`) is inert (the §6.8 text-safety
 *   guarantee);
 * - applies the single sp→px scale (`SP_PX`, T2) through the root `viewBox` so the
 *   layout numbers map to pixels without any arithmetic here beyond the scale;
 * - offsets each system by its model Y and applies the per-system downscale
 *   transform the model carries;
 * - draws hand-drawn primitives (staff lines, stems, beams, ties/slurs, ledgers,
 *   barlines, noteheads, dots) and font glyphs (clefs, rests, accidentals, flags,
 *   brace, time-sig digits, tempo note) so the skeleton never depends on the font
 *   (the §2.4 font-failure fallback); and
 * - stamps a stable id / `data-*` (the event index, hand, kind) on each per-event
 *   element so a later store can target it (the §2.3 interactivity hook) — no
 *   behaviour now.
 *
 * The ONE place a presentation detail is decided here (never geometry) is mapping a
 * symbolic value to a glyph NAME — a rest's `duration`→rest glyph, a flag's
 * direction+count→flag glyph, a time-signature digit→`timeSig*` glyph. The glyph
 * NAME → codepoint / hand-drawn spec indirection still lives in `glyphs.js`.
 */

import {
	BARLINE_THIN,
	BEAM_GAP,
	BEAM_THICKNESS,
	CHORD_SYMBOL_SIZE,
	DOT_RADIUS,
	DYNAMIC_SIZE,
	LEDGER_WIDTH,
	MEASURE_NUMBER_SIZE,
	NOTEHEAD_RX,
	OTTAVA_SIZE,
	SECONDARY_BEAM_INSET,
	SP_PX,
	STAFF_LINE_COUNT,
	STEM_LENGTH,
	STEM_THICKNESS,
	TEMPO_SIZE,
} from "./constants.js";
import { glyphFor, MUSIC_FONT_FAMILY } from "./glyphs.js";

/** The SVG namespace every element is created in. */
const SVG_NS = "http://www.w3.org/2000/svg";

/** The fixed notation color (spec req 15 — fixed, NOT theme-adaptive). */
const INK = "#1a1a1a";

/** Glyph point size, in sp, for the staff-anchored font glyphs (clefs/rests/etc.). */
const GLYPH_FONT_SIZE_SP = 4;

/**
 * A rest `duration` → its rest glyph NAME (a presentation lookup, not geometry).
 * Dotted rests reuse the base glyph and draw the augmentation dot(s) separately.
 */
const REST_GLYPH = {
	whole: "restWhole",
	half: "restHalf",
	quarter: "restQuarter",
	eighth: "restEighth",
	sixteenth: "restSixteenth",
	"thirty-second": "restThirtySecond",
};

/** A flag `beamCount` + stem direction → its flag glyph NAME (presentation lookup). */
const FLAG_GLYPH = {
	up: { 1: "flagEighthUp", 2: "flag16Up", 3: "flag32Up" },
	down: { 1: "flagEighthDown", 2: "flag16Down", 3: "flag32Down" },
};

/** A single time-signature digit (0–9) → its `timeSig*` glyph NAME. */
function timeSigDigitGlyph(digit) {
	return `timeSig${digit}`;
}

// ── Tiny DOM helpers (no layout math — pure element construction) ────────────────

/** Create an SVG element with the given attributes set as strings. */
function el(name, attrs = {}) {
	const node = document.createElementNS(SVG_NS, name);
	for (const [key, value] of Object.entries(attrs)) {
		if (value !== undefined && value !== null) {
			node.setAttribute(key, String(value));
		}
	}
	return node;
}

/**
 * Set an element's text via `textContent` ONLY (never `innerHTML`) — the §6.8
 * text-safety rule that keeps author free text inert.
 */
function setText(node, text) {
	node.textContent = text;
	return node;
}

/** A `<line>` between two sp points, stroked at `width` sp in the ink color. */
function line(x1, y1, x2, y2, width) {
	return el("line", {
		x1,
		y1,
		x2,
		y2,
		stroke: INK,
		"stroke-width": width,
	});
}

/** A filled `<rect>` (used for beams and barline strokes), in the ink color. */
function rect(x, y, width, height) {
	return el("rect", { x, y, width, height, fill: INK });
}

/**
 * A staff-anchored music-font glyph as `<text>` (clef/rest/accidental/flag/brace/
 * time-sig/tempo). The codepoint comes ONLY from `glyphs.js`; the renamed font
 * family is applied so the subsetted Bravura (T9) is used. A glyph with no font
 * codepoint (a hand-drawn-only glyph) yields `null` — its `spec` is drawn instead.
 *
 * @param {string} name The symbolic glyph name (a key of the glyph map).
 * @param {number} x The glyph anchor X, in sp.
 * @param {number} y The glyph baseline Y, in sp.
 * @param {{ size?: number, anchor?: string }} [options] `size` font size (sp,
 *   default a staff-height glyph), `anchor` the text-anchor (default `middle`).
 * @return {?SVGTextElement} The `<text>` node, or `null` when the glyph has no font
 *   codepoint.
 */
function fontGlyph(
	name,
	x,
	y,
	{
		size = GLYPH_FONT_SIZE_SP,
		anchor = "middle",
		baseline = "alphabetic",
	} = {},
) {
	const record = glyphFor(name);
	if (!record?.codepoint) {
		return null;
	}
	const node = el("text", {
		x,
		y,
		fill: INK,
		"font-family": MUSIC_FONT_FAMILY,
		"font-size": size,
		"text-anchor": anchor,
		"dominant-baseline": baseline,
	});
	return setText(node, record.codepoint);
}

/**
 * Draw a glyph by NAME at (x, y) preferring its hand-drawn `spec` when present
 * (the §2.4 skeleton — noteheads / dots / whole+half rests render font-free) and
 * otherwise its font codepoint. Returns the element, or `null` for an unknown glyph.
 *
 * @param {string} name The symbolic glyph name.
 * @param {number} x The anchor X, in sp.
 * @param {number} y The anchor Y, in sp.
 * @param {{ size?: number, anchor?: string, filled?: boolean }} [options] Forwarded
 *   to the font/spec drawers; `filled` overrides a notehead spec's fill.
 * @return {?SVGElement} The drawn element, or `null` when the glyph is unknown.
 */
function drawGlyph(name, x, y, options = {}) {
	const record = glyphFor(name);
	if (!record) {
		return null;
	}
	if (record.spec) {
		return drawSpec(record.spec, x, y, options);
	}
	return fontGlyph(name, x, y, options);
}

/**
 * Turn a hand-drawn glyph `spec` (from `glyphs.js`) into an SVG primitive at
 * (x, y) sp. Specs are inert plain data; this is the only place they become DOM.
 * Supports the spec kinds the glyph map declares: `ellipse` (noteheads), `circle`
 * (dot), `rect` (whole/half rests, hung-from / sitting-on a staff line).
 *
 * @param {object} spec The glyph spec.
 * @param {number} x The center X, in sp.
 * @param {number} y The reference Y (notehead center / rest staff line), in sp.
 * @param {{ filled?: boolean }} [options] `filled` overrides the spec fill.
 * @return {?SVGElement} The primitive element, or `null` for an unknown spec.
 */
function drawSpec(spec, x, y, { filled } = {}) {
	const isFilled = filled === undefined ? spec.filled : filled;
	switch (spec.kind) {
		case "ellipse":
			return el("ellipse", {
				cx: x,
				cy: y,
				rx: spec.rx,
				ry: spec.ry,
				fill: isFilled ? INK : "none",
				stroke: INK,
				"stroke-width": isFilled ? 0 : STEM_THICKNESS,
			});
		case "circle":
			return el("circle", { cx: x, cy: y, r: spec.r, fill: INK });
		case "rect": {
			// A whole rest hangs FROM the reference line (its block sits below it); a
			// half rest sits ON it (block above). The layout layer supplies the line Y.
			const top = spec.hangs ? y : y - spec.height;
			return rect(x - spec.width / 2, top, spec.width, spec.height);
		}
		default:
			return null;
	}
}

// ── Public entry point ──────────────────────────────────────────────────────────

/**
 * Render a layout model into an `<svg role="img">` element (design §2.3, §7). The
 * caller (the frontend `view.js`, T8) computes the accessible name from the song
 * `metadata` and passes it in; this layer stamps it onto the first-child `<title>`
 * via `textContent` (the single name source — no `aria-label`, design §7).
 *
 * The root carries a `viewBox` in sp units and an explicit pixel width/height
 * (`× SP_PX`) so the sp coordinate system maps to pixels with no per-element
 * arithmetic. Width is the model width; height grows with the systems.
 *
 * @param {{ systems: object[], width: number, height: number }} model The layout
 *   model from `buildLayoutModel` (sp units).
 * @param {{ accessibleName?: string }} [options] `accessibleName` the single
 *   labeled-graphic name (already computed + i18n-wrapped by the caller).
 * @return {SVGSVGElement} The rendered `<svg role="img">`.
 */
export function renderSvg(model, { accessibleName = "" } = {}) {
	const widthSp = Math.max(model?.width ?? 0, 0);
	const heightSp = Math.max(model?.height ?? 0, 0);

	const svg = el("svg", {
		xmlns: SVG_NS,
		role: "img",
		viewBox: `0 0 ${widthSp} ${heightSp}`,
		width: widthSp * SP_PX,
		height: heightSp * SP_PX,
		preserveAspectRatio: "xMinYMin meet",
	});

	// FIRST child: the single accessible name, set via textContent (inert author
	// text). Exactly one name source — no aria-label (design §7).
	const title = setText(el("title"), accessibleName);
	svg.appendChild(title);

	for (const system of model?.systems ?? []) {
		svg.appendChild(renderSystem(system));
	}

	return svg;
}

/**
 * `renderInto` convenience: replace `container`'s contents with the rendered SVG.
 * Clears via `replaceChildren` (no `innerHTML`) then appends the fresh tree, so a
 * resize-driven rebuild is one DOM swap (design §2.3 / §3 flow).
 *
 * @param {Element} container The host element to render into.
 * @param {object} model The layout model.
 * @param {{ accessibleName?: string }} [options] Forwarded to `renderSvg`.
 * @return {SVGSVGElement} The rendered `<svg>` (also now the container's child).
 */
export function renderInto(container, model, options = {}) {
	const svg = renderSvg(model, options);
	container.replaceChildren(svg);
	return svg;
}

// ── System / band assembly ───────────────────────────────────────────────────────

/**
 * Render one system into a `<g>` translated to the system's model Y and uniformly
 * scaled by its `downscaleFactor` (1 unless an over-wide single measure forced the
 * whole system to shrink — design §6.3). All inner coordinates are the system-local
 * sp values the model already computed.
 */
function renderSystem(system) {
	const band = system.band;
	const factor = system.downscaleFactor ?? 1;
	const g = el("g", {
		transform: `translate(0 ${system.y ?? 0}) scale(${factor})`,
		"data-system": system.index,
	});

	// Staff lines for both grand-staff staves, then the leading reserve, the
	// measures, the resolved spans, and finally the system texts. The lines span the
	// inset content area, not the full box, so the staff never bleeds out (review F9).
	const staffStartX = system.staffStartX ?? 0;
	const staffEndX = system.staffEndX ?? system.width;
	g.appendChild(staffLines(band.rightStaffTopY, staffStartX, staffEndX));
	g.appendChild(staffLines(band.leftStaffTopY, staffStartX, staffEndX));

	g.appendChild(renderReserve(system.reserve, band));

	for (const measure of system.measures ?? []) {
		g.appendChild(renderMeasure(measure, band));
	}

	for (const span of system.spans ?? []) {
		g.appendChild(renderSpan(span));
	}

	g.appendChild(renderSystemTexts(system.texts));

	return g;
}

/**
 * The five staff lines of one staff, as a `<g>` of `<line>`s spanning `[startX, endX]`.
 * The top line is at `topY`; each subsequent line is one sp below (the staff spans 4
 * sp). Drawn as raw primitives — never font-dependent (design §2.4).
 */
function staffLines(topY, startX, endX) {
	const g = el("g", { "data-staff-lines": "" });
	for (let i = 0; i < STAFF_LINE_COUNT; i++) {
		const y = topY + i;
		g.appendChild(line(startX, y, endX, y, BARLINE_THIN));
	}
	return g;
}

/**
 * The leading reserve: the grand-staff brace, both clefs, both key-signature
 * clusters, and (when present) the time signature. The model supplies every glyph
 * name + position; this only places them. The brace spans both staves at the left.
 */
function renderReserve(reserve, band) {
	const g = el("g", { "data-reserve": "" });
	if (!reserve) {
		return g;
	}

	// Every field's X comes from the layout model, which advances each by the previous
	// field's real width (review F1) — the emit layer adds no spacing math of its own.

	// Brace spanning from the RH staff top to the LH staff bottom, centered on the band
	// via a centered baseline so the glyph straddles both staves rather than riding high
	// off its alphabetic baseline (review F2).
	const braceY = (band.rightStaffTopY + band.leftStaffBottomY) / 2;
	const braceHeight = band.leftStaffBottomY - band.rightStaffTopY;
	const brace = fontGlyph("brace", reserve.brace?.x ?? 0, braceY, {
		size: braceHeight,
		baseline: "central",
	});
	if (brace) {
		g.appendChild(brace);
	}

	// Clefs: the RH clef on the RH staff, the LH clef on the LH staff, both at the
	// model's clef X (the two clefs share one horizontal slot, stacked vertically).
	appendClef(
		g,
		reserve.clefs?.right,
		reserve.clefs?.right?.x,
		band.rightStaffTopY,
	);
	appendClef(
		g,
		reserve.clefs?.left,
		reserve.clefs?.left?.x,
		band.leftStaffTopY,
	);

	// Key-signature clusters (their glyph Ys are already in band coordinates).
	const keySigX = reserve.keySig?.x ?? 0;
	appendKeySig(g, reserve.keySig?.right, keySigX);
	appendKeySig(g, reserve.keySig?.left, keySigX);

	// Time signature (only when this system prints one), at the model's reserved X.
	if (reserve.timeSignature) {
		const tsX = reserve.timeSignatureX ?? keySigX;
		appendTimeSignature(g, reserve.timeSignature, tsX, band.rightStaffTopY);
		appendTimeSignature(g, reserve.timeSignature, tsX, band.leftStaffTopY);
	}

	return g;
}

/** Place one clef glyph on a staff (the clef name + its staff top Y). */
function appendClef(parent, clef, x, staffTopY) {
	if (!clef?.glyph) {
		return;
	}
	// Anchor the clef baseline near the staff bottom line (font glyph encodes its
	// own reference); the staff spans 4 sp below the top.
	const node = fontGlyph(clef.glyph, x, staffTopY + 3, { anchor: "start" });
	if (node) {
		node.setAttribute("data-clef", clef.clef);
		parent.appendChild(node);
	}
}

/** Place one hand's key-signature cluster (its glyphs carry band-coordinate Ys). */
function appendKeySig(parent, cluster, baseX) {
	if (!cluster?.glyphs?.length) {
		return;
	}
	const g = el("g", { "data-keysig": "" });
	for (const glyph of cluster.glyphs) {
		const node = fontGlyph(glyph.glyph, baseX + glyph.x, glyph.y);
		if (node) {
			g.appendChild(node);
		}
	}
	parent.appendChild(g);
}

/**
 * Stack the time signature's `beats` over `beatType` as two rows of digit glyphs on
 * a staff. Each number is composed from per-digit `timeSig*` glyphs (design §6.7);
 * the upper row sits in the staff's top half, the lower in the bottom half.
 */
function appendTimeSignature(parent, timeSignature, x, staffTopY) {
	const beats = String(timeSignature.beats ?? "");
	const beatType = String(timeSignature.beatType ?? "");
	const g = el("g", { "data-timesig": "" });
	// Upper digits centered on the 2nd-from-top line, lower on the 2nd-from-bottom.
	appendDigits(g, beats, x, staffTopY + 1);
	appendDigits(g, beatType, x, staffTopY + 3);
	parent.appendChild(g);
}

/** Append a run of time-signature digit glyphs left→right, centered around `x`. */
function appendDigits(parent, digits, x, y) {
	const startX = x - ((digits.length - 1) * 1.2) / 2;
	[...digits].forEach((digit, i) => {
		const node = fontGlyph(timeSigDigitGlyph(digit), startX + i * 1.2, y);
		if (node) {
			parent.appendChild(node);
		}
	});
}

// ── Measure assembly ─────────────────────────────────────────────────────────────

/**
 * Render one measure: both hands' per-event primitives (translated to the hand's
 * staff bottom line), the barlines spanning the grand staff, and any inline
 * mid-system section-change cautionary glyphs. The measure's own X is the group's
 * translate so every inner X stays measure-relative as the model produced it.
 */
function renderMeasure(measure, band) {
	const g = el("g", {
		transform: `translate(${measure.x} 0)`,
		"data-measure": measure.number,
	});

	// Each hand's primitives are placed relative to that staff's BOTTOM line (the sp
	// Y origin the layout layer used). A nested <g> carries that staff offset.
	g.appendChild(renderHand(measure.right, "rightHand", band.rightStaffBottomY));
	g.appendChild(renderHand(measure.left, "leftHand", band.leftStaffBottomY));

	// Barlines span from the RH staff top to the LH staff bottom. The model gives
	// each stroke an absolute (system-local) X — but this measure group is already
	// translated by measure.x, so subtract it back to keep strokes measure-relative.
	for (const barline of measure.barlines ?? []) {
		g.appendChild(renderBarline(barline, band, measure.x));
	}

	if (measure.inline) {
		g.appendChild(renderInlineChange(measure.inline, band, measure.x));
	}

	return g;
}

/**
 * Render one hand's primitives within a measure into a `<g>` translated to the
 * hand's staff bottom-line Y (the sp origin the layout layer measured Ys from).
 * Draws beams, then notes (noteheads + stems + flags + accidentals + ledgers +
 * dots), then rests, then per-event texts (dynamics / chord symbols).
 */
function renderHand(hand, handKey, staffBottomY) {
	const g = el("g", {
		transform: `translate(0 ${staffBottomY})`,
		"data-hand": handKey,
	});
	if (!hand) {
		return g;
	}

	for (const beam of hand.beams ?? []) {
		g.appendChild(renderBeam(beam));
	}
	for (const note of hand.notes ?? []) {
		g.appendChild(renderNote(note, handKey));
	}
	for (const rest of hand.rests ?? []) {
		g.appendChild(renderRest(rest, handKey));
	}
	for (const text of hand.texts ?? []) {
		g.appendChild(renderHandText(text));
	}

	return g;
}

/**
 * Render one note event: its noteheads (each on the correct side of the stem), the
 * stem, a flag (when not beamed), accidentals, ledger lines, and augmentation dots.
 * The whole group is stamped with the event index + hand so a later store can target
 * it (the §2.3 interactivity hook). All Ys are notehead Ys in the staff frame.
 */
function renderNote(note, handKey) {
	const g = el("g", {
		"data-kind": "note",
		"data-hand": handKey,
		"data-event-index": note.eventIndex,
		id: `${handKey}-note-${note.eventIndex}`,
	});

	// Ledger lines first (under the noteheads), centered on the note X.
	for (const ledger of note.ledgers ?? []) {
		const half = (ledger.width ?? LEDGER_WIDTH) / 2;
		g.appendChild(
			line(note.x - half, ledger.y, note.x + half, ledger.y, BARLINE_THIN),
		);
	}

	// Stem: from the stem-side notehead to the beam/flag end. For a beamed note the
	// beam already drew the stem, so skip it here; otherwise draw to a default end.
	if (note.hasStem && !note.beamed) {
		g.appendChild(renderStem(note));
	}

	// Noteheads: each at its Y; a displaced head sits ~one notehead width to its
	// side. `side` is which side of the stem the head attaches to.
	for (const head of note.heads ?? []) {
		const dx = head.side === "left" ? -NOTEHEAD_RX : NOTEHEAD_RX;
		const cx = note.x + (head.displaced ? dx * 2 : 0);
		const node = drawGlyph(
			note.notehead === "open" ? "noteheadOpen" : "noteheadFilled",
			cx,
			head.y,
			{ filled: note.notehead !== "open" },
		);
		if (node) {
			node.setAttribute("data-notehead", "");
			g.appendChild(node);
		}
	}

	// Flag (un-beamed flagged notes only): a font glyph at the stem's free end.
	if (!note.beamed && note.flagCount > 0) {
		appendFlag(g, note);
	}

	// Accidentals: each a font glyph to the LEFT of the note (its dx is a positive
	// leftward magnitude).
	for (const acc of note.accidentals ?? []) {
		const node = fontGlyph(acc.glyph, note.x - acc.dx, acc.y);
		if (node) {
			node.setAttribute("data-accidental", "");
			g.appendChild(node);
		}
	}

	// Augmentation dots: small filled circles to the right of each notehead.
	for (const dotSpec of note.dotSpecs ?? []) {
		const node = drawGlyph("dot", note.x + dotSpec.dx, dotSpec.y);
		if (node) {
			node.setAttribute("data-dot", "");
			g.appendChild(node);
		}
	}

	return g;
}

/**
 * The stem for an un-beamed note: a thin line from the stem-side notehead to a
 * default stem end (one stem length beyond the extreme notehead). The notehead's
 * extreme Ys and direction come from the model.
 */
function renderStem(note) {
	// Stem attaches at the lowest notehead for stem-up (rising) / highest for
	// stem-down (falling). The model's head Ys are in the staff frame already.
	const ys = (note.heads ?? []).map((h) => h.y);
	const startY = note.direction === "up" ? Math.max(...ys) : Math.min(...ys);
	// The stem free end: the shared STEM_LENGTH constant beyond the start notehead
	// (the same constant the layout layer's beamed stems use — one source of truth;
	// this is not a recomputed layout decision, just where the line ends).
	const endY =
		note.direction === "up" ? startY - STEM_LENGTH : startY + STEM_LENGTH;
	// Stem-up attaches at the notehead's right edge, stem-down at its left edge.
	const stemX = note.x + (note.direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX);
	const node = line(stemX, startY, stemX, endY, STEM_THICKNESS);
	node.setAttribute("data-stem", "");
	return node;
}

/** Append the flag glyph at the free end of an un-beamed note's stem. */
function appendFlag(parent, note) {
	const glyphName = FLAG_GLYPH[note.direction]?.[note.flagCount];
	if (!glyphName) {
		return;
	}
	const ys = (note.heads ?? []).map((h) => h.y);
	const startY = note.direction === "up" ? Math.max(...ys) : Math.min(...ys);
	const endY =
		note.direction === "up" ? startY - STEM_LENGTH : startY + STEM_LENGTH;
	const stemX = note.x + (note.direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX);
	const node = fontGlyph(glyphName, stemX, endY, { anchor: "start" });
	if (node) {
		node.setAttribute("data-flag", "");
		parent.appendChild(node);
	}
}

/**
 * Render one beam group: the shared flat beam (primary + secondary segments) and
 * each member's stem reaching the common beam Y. All geometry is from the model.
 */
function renderBeam(beam) {
	const g = el("g", { "data-beam": "" });

	// Stems to the common beam Y.
	for (const stem of beam.stems ?? []) {
		g.appendChild(line(stem.x, stem.y1, stem.x, stem.y2, STEM_THICKNESS));
	}

	// Beam segments: the primary at the beam Y, each secondary inset toward the
	// noteheads by one BEAM_GAP per level (stem-up beams stack downward in Y, etc.).
	const beamY = beam.beamY;
	for (const segment of beam.beams ?? []) {
		const offset =
			(segment.level - 1) * BEAM_GAP * (beam.direction === "up" ? 1 : -1);
		const inset = segment.level > 1 ? SECONDARY_BEAM_INSET : 0;
		const top =
			beam.direction === "up" ? beamY + offset + inset : beamY + offset - inset;
		g.appendChild(
			rect(segment.x1, top, Math.abs(segment.x2 - segment.x1), BEAM_THICKNESS),
		);
	}

	return g;
}

/**
 * Render one rest: its glyph (a font rest, or a hand-drawn rectangle for whole/half
 * — the §2.4 skeleton), centered on the rest's column X at the staff middle, plus
 * augmentation dots. Stamped with the event index for the interactivity hook.
 */
function renderRest(rest, handKey) {
	const g = el("g", {
		"data-kind": "rest",
		"data-hand": handKey,
		"data-event-index": rest.eventIndex,
		id: `${handKey}-rest-${rest.eventIndex}`,
	});

	const glyphName = REST_GLYPH[rest.duration] ?? "restQuarter";
	// Rests center on the staff middle line. Whole/half hand-drawn rects reference a
	// staff line (the staff middle here), the font rests sit centered there too.
	const midY = -2; // staff middle: 2 sp above the bottom line (4 staff-steps × 0.5)
	const node = drawGlyph(glyphName, rest.x, midY);
	if (node) {
		g.appendChild(node);
	}

	// Augmentation dots: a small circle just right of the rest, one per dot.
	for (let i = 0; i < (rest.dots ?? 0); i++) {
		g.appendChild(
			el("circle", {
				cx: rest.x + NOTEHEAD_RX + 0.5 + i * 0.5,
				cy: midY - 0.5,
				r: DOT_RADIUS,
				fill: INK,
			}),
		);
	}

	return g;
}

// ── Barlines, spans, texts ────────────────────────────────────────────────────────

/**
 * Render one barline group spanning both staves: each stroke a thin/thick `<rect>`
 * from the RH staff top to the LH staff bottom, plus any repeat dots mirrored onto
 * both staves at their `dotSteps` registers. Stroke X's are absolute (system-local);
 * since the measure group is translated by `measureX`, we subtract it back.
 */
function renderBarline(barline, band, measureX) {
	const g = el("g", {
		"data-barline": barline.type,
		"data-side": barline.side,
	});
	const top = band.rightStaffTopY;
	const bottom = band.leftStaffBottomY;

	for (const stroke of barline.strokes ?? []) {
		g.appendChild(
			rect(stroke.x - measureX, top, stroke.thickness, bottom - top),
		);
	}

	// Repeat dots: the model gives an X + the `dotSteps` registers (sFromBottom in
	// each staff frame); mirror them onto both staves' bottom-line origins.
	for (const dotGroup of barline.dots ?? []) {
		const x = dotGroup.x - measureX;
		for (const step of dotGroup.dotSteps ?? []) {
			g.appendChild(
				el("circle", {
					cx: x,
					cy: band.rightStaffBottomY - step * 0.5,
					r: DOT_RADIUS,
					fill: INK,
				}),
			);
			g.appendChild(
				el("circle", {
					cx: x,
					cy: band.leftStaffBottomY - step * 0.5,
					r: DOT_RADIUS,
					fill: INK,
				}),
			);
		}
	}

	return g;
}

/**
 * Render mid-system inline cautionary section-change glyphs (design §6.6): a per-hand
 * clef, per-hand key-sig cluster, and a time signature, all at the boundary measure's
 * left edge. The model gives an absolute X; subtract the measure translate back.
 */
function renderInlineChange(inline, band, measureX) {
	const g = el("g", { "data-inline-change": "" });
	// Each field's absolute X comes from the model (width-aware, review F1); the measure
	// group is already translated by measureX, so subtract it back to stay measure-local.
	const fallbackX = inline.x ?? 0;
	const clefRightX = (inline.clefs?.right?.x ?? fallbackX) - measureX;
	const clefLeftX = (inline.clefs?.left?.x ?? fallbackX) - measureX;
	appendClef(g, inline.clefs?.right, clefRightX, band.rightStaffTopY);
	appendClef(g, inline.clefs?.left, clefLeftX, band.leftStaffTopY);

	// Key-sig clusters here carry default (bottom-line-relative) Ys, so re-anchor
	// each cluster onto its staff's bottom line.
	const keySigX = (inline.keySig?.x ?? fallbackX) - measureX;
	appendInlineKeySig(g, inline.keySig?.right, keySigX, band.rightStaffBottomY);
	appendInlineKeySig(g, inline.keySig?.left, keySigX, band.leftStaffBottomY);

	if (inline.timeSignature) {
		const tsX = (inline.timeSignatureX ?? fallbackX) - measureX;
		appendTimeSignature(g, inline.timeSignature, tsX, band.rightStaffTopY);
		appendTimeSignature(g, inline.timeSignature, tsX, band.leftStaffTopY);
	}

	return g;
}

/**
 * Place an inline key-sig cluster onto a staff bottom line. The cluster's glyph Ys
 * were computed bottom-line-relative (no `bottomLineY` passed at build time), so we
 * translate the whole cluster down to the staff's bottom line.
 */
function appendInlineKeySig(parent, cluster, baseX, staffBottomY) {
	if (!cluster?.glyphs?.length) {
		return;
	}
	const g = el("g", {
		"data-keysig": "",
		transform: `translate(0 ${staffBottomY})`,
	});
	for (const glyph of cluster.glyphs) {
		const node = fontGlyph(glyph.glyph, baseX + glyph.x, glyph.y);
		if (node) {
			g.appendChild(node);
		}
	}
	parent.appendChild(g);
}

/**
 * Render one resolved span (a tie or a slur) as a quadratic-Bézier `<path>` between
 * its endpoints with the model's control point. All four points + the control are
 * absolute (system-local) sp; the path stroke is the ink color, unfilled.
 */
function renderSpan(span) {
	const d = `M ${span.x1} ${span.y1} Q ${span.cx} ${span.cy} ${span.x2} ${span.y2}`;
	return el("path", {
		d,
		fill: "none",
		stroke: INK,
		"stroke-width": STEM_THICKNESS,
		"data-span": span.kind,
		"data-hand": span.hand,
	});
}

/**
 * Render one hand's per-event text (a dynamic below the staff, a chord symbol above
 * it). Y is relative to the hand's staff bottom line (the enclosing `<g>` already
 * carries that translate), so positive Y is below the staff and negative is above.
 */
function renderHandText(text) {
	if (text.kind === "dynamic") {
		// Dynamics: bold-italic, below the hand's staff (positive Y is downward).
		const node = el("text", {
			x: text.x,
			y: 2,
			fill: INK,
			"font-size": DYNAMIC_SIZE,
			"font-style": "italic",
			"font-weight": "bold",
			"text-anchor": "middle",
			"data-text": "dynamic",
		});
		return setText(node, text.text);
	}
	// Chord symbol: author free text, above the RH staff.
	const node = el("text", {
		x: text.x,
		y: -5,
		fill: INK,
		"font-size": CHORD_SYMBOL_SIZE,
		"text-anchor": "middle",
		"data-text": "chord-symbol",
	});
	return setText(node, text.text);
}

/**
 * Render the system-level texts: the tempo marks (a metronome note glyph + " = bpm"
 * digits/text), the measure number, and the ottava brackets. Tempo + measure number
 * + ottava labels are plain font text (design §2.4); the tempo note is a font glyph.
 */
function renderSystemTexts(texts) {
	const g = el("g", { "data-system-texts": "" });
	if (!texts) {
		return g;
	}

	for (const tempo of texts.tempos ?? []) {
		g.appendChild(renderTempo(tempo));
	}

	if (texts.measureNumber) {
		const mn = texts.measureNumber;
		const node = el("text", {
			x: mn.x,
			y: mn.y,
			fill: INK,
			"font-size": MEASURE_NUMBER_SIZE,
			"text-anchor": "start",
			"data-text": "measure-number",
		});
		g.appendChild(setText(node, mn.text));
	}

	for (const ottava of texts.ottavas ?? []) {
		g.appendChild(renderOttava(ottava));
	}

	return g;
}

/** Render one tempo mark: the metronome note glyph, then " = " and the bpm. */
function renderTempo(tempo) {
	const g = el("g", { "data-text": "tempo" });
	const note = fontGlyph(tempo.glyph, tempo.x, tempo.y, {
		size: TEMPO_SIZE,
		anchor: "start",
	});
	if (note) {
		g.appendChild(note);
	}
	const label = el("text", {
		x: tempo.x + TEMPO_SIZE,
		y: tempo.y,
		fill: INK,
		"font-size": TEMPO_SIZE,
		"text-anchor": "start",
	});
	g.appendChild(setText(label, ` = ${tempo.bpm}`));
	return g;
}

/**
 * Render one ottava bracket: the label text ("8va"/"8vb"/"15ma"/"15mb") and a
 * dashed line spanning the run, above or below the staff per the model placement.
 */
function renderOttava(ottava) {
	const g = el("g", { "data-text": "ottava", "data-hand": ottava.hand });
	const label = el("text", {
		x: ottava.x1,
		y: ottava.y,
		fill: INK,
		"font-size": OTTAVA_SIZE,
		"font-style": "italic",
		"text-anchor": "start",
	});
	g.appendChild(setText(label, ottava.label));
	// A dashed bracket line spanning the run, just past the label.
	g.appendChild(
		el("line", {
			x1: ottava.x1 + OTTAVA_SIZE * 1.5,
			y1: ottava.y,
			x2: ottava.x2,
			y2: ottava.y,
			stroke: INK,
			"stroke-width": STEM_THICKNESS,
			"stroke-dasharray": "0.6 0.4",
		}),
	);
	return g;
}
