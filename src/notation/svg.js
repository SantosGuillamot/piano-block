/**
 * The thin SVG EMIT layer: it walks the positioned layout model `buildLayoutModel`
 * produced (`layout.js`) and turns it into an `<svg role="img">` DOM tree. It is
 * deliberately layout-math-FREE — every X/Y, width, span control point, beam Y, etc.
 * is already computed in staff-space (sp) units by the layout layer; this module only:
 *
 * - builds DOM via `createElementNS` (never `innerHTML`), so author free text
 *   (a note's text, the accessible-name `<title>`) is inert (the text-safety
 *   guarantee);
 * - applies the single sp→px scale (`SP_PX`) through the root `viewBox` so the
 *   layout numbers map to pixels without any arithmetic here beyond the scale;
 * - offsets each system by its model Y and applies the per-system downscale
 *   transform the model carries;
 * - draws hand-drawn primitives (staff lines, stems, beams, ties/slurs, ledgers,
 *   barlines, noteheads, dots) and font glyphs (clefs, rests, accidentals, flags,
 *   brace, time-sig digits, tempo note) so the skeleton never depends on the font
 *   (the font-failure fallback); and
 * - stamps a stable id / `data-*` (the event index, hand, kind) on each per-event
 *   element so a later store can target it (the interactivity hook) — no
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
	DOT_RADIUS,
	DYNAMIC_SIZE,
	LEDGER_WIDTH,
	NOTE_SIZE,
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

/** The fixed notation color (fixed, NOT theme-adaptive). */
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
 * Set an element's text via `textContent` ONLY (never `innerHTML`) — the
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
 * family is applied so the subsetted Bravura is used. A glyph with no font
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
	{ size = GLYPH_FONT_SIZE_SP, anchor = "middle" } = {},
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
		"dominant-baseline": "alphabetic",
	});
	return setText(node, record.codepoint);
}

/**
 * Draw a glyph by NAME at (x, y) preferring its hand-drawn `spec` when present
 * (the skeleton — noteheads / dots / whole+half rests render font-free) and
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
 * Render a layout model into an `<svg role="img">` element. The caller (the frontend
 * `view.js`) computes the accessible name from the song `metadata` and passes it in;
 * this layer stamps it onto the first-child `<title>` via `textContent` (the single
 * name source — no `aria-label`).
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
		// Never exceed the block's content box: if the intrinsic px width is wider than
		// the container (a padded wrapper, or the narrow-screen sp step-down), shrink to
		// fit — the viewBox keeps the staff inset, so it can't bleed past the box.
		// `display:block` drops the inline-text descender gap below the SVG.
		style: "display:block;max-width:100%;height:auto",
	});

	// FIRST child: the single accessible name, set via textContent (inert author
	// text). Exactly one name source — no aria-label.
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
 * resize-driven rebuild is one DOM swap.
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
 * whole system to shrink). All inner coordinates are the system-local sp values the
 * model already computed.
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
	// inset content area, not the full box, so the staff never bleeds out.
	const staffStartX = system.staffStartX ?? 0;
	const staffEndX = system.staffEndX ?? system.width;
	g.appendChild(staffLines(band.rightStaffTopY, staffStartX, staffEndX));
	g.appendChild(staffLines(band.leftStaffTopY, staffStartX, staffEndX));

	g.appendChild(renderReserve(system.reserve, band));

	for (const measure of system.measures ?? []) {
		g.appendChild(renderMeasure(measure, band));
	}

	for (const span of system.spans ?? []) {
		const isHairpin = span.kind === "crescendo" || span.kind === "decrescendo";
		g.appendChild(isHairpin ? renderHairpin(span) : renderSpan(span));
	}

	g.appendChild(renderSystemTexts(system.texts));

	return g;
}

/**
 * The five staff lines of one staff, as a `<g>` of `<line>`s spanning `[startX, endX]`.
 * The top line is at `topY`; each subsequent line is one sp below (the staff spans 4
 * sp). Drawn as raw primitives — never font-dependent.
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
	// field's real width — the emit layer adds no spacing math of its own.

	// Brace spanning the whole grand staff: the brace glyph's ink
	// rises ~1 em from its alphabetic baseline with its bottom AT the baseline, so sizing
	// it to the grand-staff height and anchoring it at the LH staff bottom makes it run
	// from the top of the upper staff to the bottom of the lower staff.
	const braceHeight = band.leftStaffBottomY - band.rightStaffTopY;
	const brace = fontGlyph(
		"brace",
		reserve.brace?.x ?? 0,
		band.leftStaffBottomY,
		{ size: braceHeight },
	);
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
	// Anchor each clef's baseline on its SMuFL reference staff line: the
	// G clef on the G line (2nd from the bottom), the F clef on the F line (2nd from the
	// top), and the C clef on the line it centers (middle for alto, 4th for tenor). The
	// staff's top line is `staffTopY`; each line below is +1 sp.
	const refFromTop = CLEF_REF_LINE_FROM_TOP[clef.clef] ?? 3;
	const node = fontGlyph(clef.glyph, x, staffTopY + refFromTop, {
		anchor: "start",
	});
	if (node) {
		node.setAttribute("data-clef", clef.clef);
		parent.appendChild(node);
	}
}

/**
 * Each clef's reference staff line, as a distance in sp BELOW the staff's top line.
 * Lines from the top: top 0, 1, middle 2, 3, bottom 4 — so the treble (G) clef sits on
 * line 3, the bass (F) clef on line 1, the alto (C) clef on the middle line 2, and the
 * tenor (C) clef on line 1.
 */
const CLEF_REF_LINE_FROM_TOP = { treble: 3, bass: 1, alto: 2, tenor: 1 };

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
 * a staff. Each number is composed from per-digit `timeSig*` glyphs; the upper row
 * sits in the staff's top half, the lower in the bottom half.
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
 * Build a per-hand resolver that maps a per-event note's `placement` and its stack
 * index `k` (its position among same-placement notes at the same event/anchor) to
 * the note baseline Y in this hand's LOCAL frame.
 *
 * A per-event note routes to one of the four placement bands by `(handKey,
 * placement)`: a right hand's above/below note to the `aboveRH`/`belowRH` band, a
 * left hand's to `aboveLH`/`belowLH`. Each band carries a system-coordinate `baseY`
 * (note #0 baseline), a per-note `step`, and a stack `direction` ("up" toward
 * smaller Y for above bands, "down" toward larger Y for below bands); note #k's
 * baseline is `baseY + (direction === "up" ? −1 : 1) * k * step`. Per-event notes
 * live inside `<g data-hand transform="translate(0 staffBottomY)">`, so that system
 * Y is converted to the hand's local frame as `bandY − staffBottomY`.
 *
 * @param {{ aboveRH: object, belowRH: object, aboveLH: object, belowLH: object }}
 *   [bands] The system's four placement bands, each `{ baseY, step, direction }` in
 *   system coordinates.
 * @param {string} handKey The hand the notes belong to (`rightHand` | `leftHand`).
 * @param {number} staffBottomY This hand's staff bottom-line Y (the local-frame
 *   origin), in sp.
 * @return {(placement: string, k: number) => number} A resolver from a note's
 *   `placement` + stack index `k` to its local-frame baseline Y, in sp.
 */
function noteBandResolver(bands, handKey, staffBottomY) {
	const isLeft = handKey === "leftHand";
	return (placement, k) => {
		const key =
			placement === "below"
				? isLeft
					? "belowLH"
					: "belowRH"
				: isLeft
					? "aboveLH"
					: "aboveRH";
		const band = bands?.[key];
		if (!band || band.baseY == null) {
			// No band anchor (a note-free system never reserved one): fall back to just
			// above the staff so the note still draws.
			return -5;
		}
		const sign = band.direction === "up" ? -1 : 1;
		const bandY = band.baseY + sign * k * band.step;
		return bandY - staffBottomY;
	};
}

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
	// Y origin the layout layer used). A nested <g> carries that staff offset. The
	// four placement bands (`band.bands`) carry system-coordinate anchors; per-event
	// notes route to the band keyed by `(handKey, text.placement)`, and each hand
	// converts the chosen band's system Y to its local frame (`bandY −
	// staffBottomY`) so the emit adds no layout math of its own.
	g.appendChild(
		renderHand(
			measure.right,
			"rightHand",
			band.rightStaffBottomY,
			noteBandResolver(band.bands, "rightHand", band.rightStaffBottomY),
		),
	);
	g.appendChild(
		renderHand(
			measure.left,
			"leftHand",
			band.leftStaffBottomY,
			noteBandResolver(band.bands, "leftHand", band.leftStaffBottomY),
		),
	);

	// Barlines span from the RH staff top to the LH staff bottom. The model gives
	// each stroke an absolute (system-local) X — but this measure group is already
	// translated by measure.x, so subtract it back to keep strokes measure-relative.
	for (const barline of measure.barlines ?? []) {
		g.appendChild(renderBarline(barline, band, measure.x));
	}

	// Measure-level standalone notes: direct children of THIS measure group (no hand
	// group). Each routes to a band by `(staff, placement)` and stacks within its
	// stored `(staff, placement, raw beat)` group; the group key is the layout
	// record's precomputed `group`, never re-derived from `measure.annotations` or the
	// resolved X. The Y is the band's RAW system-coordinate anchor — this group has
	// NO Y translate, so the `bandY − staffBottomY` conversion is NOT applied here.
	const standaloneStackCount = new Map();
	for (const standalone of measure.standaloneAnnotations ?? []) {
		const k = standaloneStackCount.get(standalone.group) ?? 0;
		standaloneStackCount.set(standalone.group, k + 1);
		g.appendChild(renderStandaloneAnnotation(standalone, band.bands, k));
	}

	if (measure.inline) {
		g.appendChild(renderInlineChange(measure.inline, band, measure.x));
	}

	return g;
}

/**
 * Map a standalone note's `(staff, placement)` to one of the four placement bands,
 * mirroring the per-event router: a right-hand above/below note routes to
 * `aboveRH`/`belowRH`, a left-hand note to `aboveLH`/`belowLH`.
 *
 * @param {string} staff The note's staff (`rightHand` | `leftHand`).
 * @param {string} placement The note's placement (`above` | `below`).
 * @return {string} The band key (`aboveRH` | `belowRH` | `aboveLH` | `belowLH`).
 */
function bandKeyFor(staff, placement) {
	const isLeft = staff === "leftHand";
	if (placement === "below") {
		return isLeft ? "belowLH" : "belowRH";
	}
	return isLeft ? "aboveLH" : "aboveRH";
}

/**
 * Render one measure-level standalone note as a `<text data-text="annotation">` carrying
 * `data-staff` (its observability discriminator — standalone notes are NOT inside a
 * `<g data-hand>`, so the staff cannot be read from an enclosing group) and
 * `data-placement`. The node is a direct child of the `<g data-measure>` group; that
 * group carries `translate(measure.x 0)` (an X-only translate, no Y), so:
 *
 * - X is the note's already-measure-relative `x`, used AS-IS (the measure translate
 *   supplies `measure.x`; nothing is subtracted here);
 * - Y is the note's band anchor in SYSTEM coordinates — note #`k` of its stacking
 *   group sits at `baseY + (direction === "up" ? −1 : 1) * k * step` (the same band
 *   anchors the per-event router reads), WITHOUT the `bandY − staffBottomY`
 *   local-frame conversion the per-event hand groups need, because this group has no
 *   Y translate.
 *
 * A missing band anchor (a note-free system that reserved none) falls back to just
 * above the RH staff so the note still draws.
 *
 * @param {{ x: number, text: string, staff: string, placement: string }} note The
 *   standalone note's positioned record. `x` is measure-relative; `text` is the
 *   annotation text; `staff` is `rightHand`/`leftHand`; `placement` is
 *   `above`/`below`.
 * @param {{ aboveRH: object, belowRH: object, aboveLH: object, belowLH: object }}
 *   [bands] The system's four placement bands, each `{ baseY, step, direction }` in
 *   system coordinates.
 * @param {number} k The note's stack index within its `(staff, placement, raw beat)`
 *   group (0 for the first), supplied by the caller from the stored `group` key.
 * @return {SVGTextElement} The `<text>` node.
 */
function renderStandaloneAnnotation(note, bands, k) {
	const band = bands?.[bandKeyFor(note.staff, note.placement)];
	let y;
	if (!band || band.baseY == null) {
		// No band anchor: fall back to just above the staff so the note still draws.
		y = -5;
	} else {
		const sign = band.direction === "up" ? -1 : 1;
		y = band.baseY + sign * k * band.step;
	}
	const node = el("text", {
		x: note.x,
		y,
		fill: INK,
		"font-size": NOTE_SIZE,
		"text-anchor": "middle",
		"data-text": "annotation",
		"data-staff": note.staff,
		"data-placement": note.placement,
	});
	return setText(node, note.text);
}

/**
 * Render one hand's primitives within a measure into a `<g>` translated to the
 * hand's staff bottom-line Y (the sp origin the layout layer measured Ys from).
 * Draws beams, then notes (noteheads + stems + flags + accidentals + ledgers +
 * dots), then rests, then per-event texts (dynamics / author notes).
 *
 * For each per-event author note the hand resolves its band-routed local-frame Y
 * via `resolveNoteY`: a note's stack index `k` is its position among same-placement
 * notes sharing its event/anchor — i.e. its column X and `placement` (the
 * `collectEventTexts` array order is preserved here, so the running per-`(x,
 * placement)` counter yields k in that order).
 *
 * @param {{ beams?: object[], notes?: object[], rests?: object[],
 *   texts?: object[] }} [hand] The hand's positioned primitives.
 * @param {string} handKey The hand key (`rightHand` | `leftHand`).
 * @param {number} staffBottomY This hand's staff bottom-line Y, in sp.
 * @param {(placement: string, k: number) => number} resolveNoteY The band resolver
 *   from `noteBandResolver`: a per-event note's `placement` + stack index `k` to its
 *   local-frame baseline Y.
 * @return {SVGGElement} The hand's `<g data-hand>` group.
 */
function renderHand(hand, handKey, staffBottomY, resolveNoteY) {
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
	// Per-event notes stack within their `(event, placement)` group; the group is
	// keyed by the note's column X + placement (events have distinct columns), and the
	// running count is the note's stack index k in `collectEventTexts` array order.
	const noteStackCount = new Map();
	for (const text of hand.texts ?? []) {
		let y;
		if (text.kind === "annotation") {
			const stackKey = `${text.x}|${text.placement}`;
			const k = noteStackCount.get(stackKey) ?? 0;
			noteStackCount.set(stackKey, k + 1);
			y = resolveNoteY(text.placement, k);
		}
		g.appendChild(renderHandText(text, y));
	}

	return g;
}

/**
 * Render one note event: its noteheads (each on the correct side of the stem), the
 * stem, a flag (when not beamed), accidentals, ledger lines, and augmentation dots.
 * The whole group is stamped with the event index + hand so a later store can target
 * it (the interactivity hook). All Ys are notehead Ys in the staff frame.
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
 * — the skeleton), centered on the rest's column X at the staff middle, plus
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
 * Render mid-system inline cautionary section-change glyphs: a per-hand clef, per-hand
 * key-sig cluster, and a time signature, all at the boundary measure's left edge. The
 * model gives an absolute X; subtract the measure translate back.
 */
function renderInlineChange(inline, band, measureX) {
	const g = el("g", { "data-inline-change": "" });
	// Each field's absolute X comes from the model (width-aware); the measure
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
 * Render one resolved hairpin wedge (a gradual-dynamic span) as a `<g>` holding
 * exactly two straight `<line>`s — a crescendo `<` (vertex at the left, opening to
 * the right) or a decrescendo `>` (open mouth at the left, converging to a vertex at
 * the right). The two lines share only their vertex; they are emitted as separate
 * `<line>`s (not one `<polyline>`/`<path>`) so no spurious stroke joins the two free
 * mouth ends. Every coordinate is the flat-lane wedge geometry the layout layer
 * already resolved (sp units): `x1`/`x2` the start/end note centers, `yCenter` the
 * constant below-staff lane Y, and `aperture` the fixed open-mouth height. Each line
 * is stroked at `STEM_THICKNESS` (the same width the tie/slur `renderSpan` path uses).
 *
 * @param {{ kind: "crescendo"|"decrescendo", hand: string, x1: number, x2: number,
 *   yCenter: number, aperture: number }} span The resolved wedge record. `kind`
 *   selects the opening vs. closing shape; `hand` (`"rightHand"`/`"leftHand"`) is
 *   stamped on the group; `x1`/`x2` are the horizontal endpoints; `yCenter` the lane
 *   center Y; `aperture` the full mouth height (the lines diverge to ±`aperture/2`).
 * @return {SVGGElement} A `<g data-span data-hand>` containing the two wedge lines.
 */
function renderHairpin(span) {
	const g = el("g", {
		"data-span": span.kind,
		"data-hand": span.hand,
	});
	const half = span.aperture / 2;
	if (span.kind === "crescendo") {
		// `<`: the vertex sits at the left (x1, yCenter); the mouth fans open to ±half
		// about yCenter at the right (x2).
		g.appendChild(
			line(span.x1, span.yCenter, span.x2, span.yCenter - half, STEM_THICKNESS),
		);
		g.appendChild(
			line(span.x1, span.yCenter, span.x2, span.yCenter + half, STEM_THICKNESS),
		);
	} else {
		// `>`: the mouth opens to ±half about yCenter at the left (x1) and converges to
		// the vertex at the right (x2, yCenter).
		g.appendChild(
			line(span.x1, span.yCenter - half, span.x2, span.yCenter, STEM_THICKNESS),
		);
		g.appendChild(
			line(span.x1, span.yCenter + half, span.x2, span.yCenter, STEM_THICKNESS),
		);
	}
	return g;
}

/**
 * Render one hand's per-event text (a dynamic below the staff, an author note routed
 * to one of the four placement bands). Y is relative to the hand's staff bottom line
 * (the enclosing `<g data-hand>` already carries that translate), so positive Y is
 * below the staff and negative is above.
 *
 * A per-event note carries `data-placement` (its observability discriminator); its
 * staff is observable from the enclosing `<g data-hand>`, so it carries NO
 * `data-staff`. `annotationY` is the band-routed local-frame baseline Y the caller
 * resolved for this note (above the RH top line for above-RH, in the inter-staff gap
 * for below-RH / above-LH, below the LH bottom line for below-LH); without it, the
 * note falls back to just above the staff.
 *
 * @param {{ kind: string, x: number, text: string, placement?: string }} text The
 *   per-event text. `placement` is `"above"`/`"below"` for a note.
 * @param {number} [annotationY] A note's resolved local-frame baseline Y, in sp.
 * @return {SVGTextElement} The `<text>` node.
 */
function renderHandText(text, annotationY) {
	if (text.kind === "dynamic") {
		// Dynamics: bold-italic, set clearly BELOW the hand's staff bottom line (positive
		// Y is downward) so the glyphs sit under the staff, not across it.
		const node = el("text", {
			x: text.x,
			y: 3.5,
			fill: INK,
			"font-size": DYNAMIC_SIZE,
			"font-style": "italic",
			"font-weight": "bold",
			"text-anchor": "middle",
			"data-text": "dynamic",
		});
		return setText(node, text.text);
	}
	// Note: author free text at its band-routed baseline (or just above the top line
	// when no band Y is supplied). The placement is observable on the node; the staff
	// is observable from the enclosing data-hand (no data-staff here).
	const node = el("text", {
		x: text.x,
		y: annotationY ?? -5,
		fill: INK,
		"font-size": NOTE_SIZE,
		"text-anchor": "middle",
		"data-text": "annotation",
		"data-placement": text.placement,
	});
	return setText(node, text.text);
}

/**
 * Render the system-level texts: the tempo marks (a metronome note glyph + " = bpm"
 * digits/text) and the ottava brackets. Tempo and ottava labels are plain font text;
 * the tempo note is a font glyph.
 */
function renderSystemTexts(texts) {
	const g = el("g", { "data-system-texts": "" });
	if (!texts) {
		return g;
	}

	for (const tempo of texts.tempos ?? []) {
		g.appendChild(renderTempo(tempo));
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
