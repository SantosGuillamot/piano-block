/**
 * The PURE layout layer — the per-event musical geometry that turns a song's
 * notes into positioned plain data in staff-space (sp) units. This module has NO
 * DOM, NO sp→px scaling, and NO font logic: it only computes numbers and
 * plain-data records the thin emit layer (`svg.js`) later turns into SVG.
 *
 * This part covers pitch→staff position with ledger lines, duration decoding
 * (notehead / stem / flag / dots), best-effort beaming, chord stacking, and
 * stateless accidental resolution. It is extended with union-grid alignment +
 * compressive spacing and with section diff + system wrapping + the full
 * `buildLayoutModel` entry point, so it is structured as a set of small,
 * individually-exported pure functions the later parts can build on.
 *
 * Staff-step model: one staff-step = one line-or-space = 0.5 sp in
 * Y. `sFromBottom` numbers positions from the bottom staff line (0) up to the top
 * line (8): lines sit at even values (0/2/4/6/8), spaces at odd (1/3/5/7). Y
 * increases downward (SVG default), so higher pitch ⇒ smaller Y. The bottom line
 * is the Y origin here (`bottomLineY = 0`); the emit layer offsets each system.
 */

import { normalizeStep } from "../song/normalizeStep.js";
import {
	ABOVE_STAFF_PAD,
	ACCIDENTAL_COL_STEP,
	ACCIDENTAL_GAP,
	ACCIDENTAL_LEAD_EXTRA,
	ADV_K,
	BARLINE_POST_PAD,
	BARLINE_THICK,
	BARLINE_THIN,
	BASE_DUR,
	BEAM_COUNT,
	DOT_GAP,
	DOT_MUL,
	DOT_OFFSET,
	DYNAMIC_ADVANCE_EM,
	DYNAMIC_SIZE,
	DYNAMICS_LANE_RESERVE,
	EMPTY_MEASURE_WIDTH,
	HAIRPIN_APERTURE,
	HAIRPIN_DYNAMIC_GAP,
	HAIRPIN_HINGE_GAP,
	HAIRPIN_LANE_DY,
	INTER_SYSTEM_GAP,
	INTRA_STAFF_GAP,
	KEYSIG_TIMESIG_GAP,
	LEDGER_WIDTH,
	MAX_STRETCH,
	MEASURE_NUMBER_SIZE,
	MID_GAP,
	MIN_ADV,
	NOTE_CLAMP_INSET,
	NOTE_GAP_STAFF,
	NOTE_SIZE,
	NOTEHEAD_RX,
	OTTAVA_SIZE,
	STAFF_HEIGHT_SP,
	STAFF_MARGIN_X,
	STEM_LENGTH,
	SYSTEM_BOTTOM_MARGIN,
	SYSTEM_TOP_MARGIN,
	TEMPO_SIZE,
	TEXT_LANE_GAP,
	TIE_NOTE_CLEARANCE,
} from "./constants.js";
import { ACCIDENTAL_GLYPHS } from "./glyphs.js";

// ── Pitch → staff position ──────────────────────────────────────────────────────

/**
 * Diatonic step index on the canonical letter: C=0 D=1 E=2 F=3 G=4 A=5 B=6.
 * Keyed by the canonical UPPERCASE English letter `normalizeStep` returns.
 */
const STEP_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Per-clef reference pitch and its `sFromBottom`. Each entry pins
 * one known pitch on the staff; every other pitch is placed relative to it on the
 * unified diatonic scale, so the same Y formula serves all four clefs.
 */
const CLEF_REF = {
	treble: { step: "G", octave: 4, sFromBottom: 2 },
	bass: { step: "F", octave: 3, sFromBottom: 6 },
	alto: { step: "C", octave: 4, sFromBottom: 4 },
	tenor: { step: "C", octave: 4, sFromBottom: 6 },
};

/** The default clef when a pitch is placed without an explicit clef. */
const DEFAULT_CLEF = "treble";

/**
 * The diatonic step index (0..6) for a step token, normalized through the shared
 * `normalizeStep` helper so English and Spanish solfège (case-insensitive) map to
 * the same letter. Returns `null` for an unrecognised token.
 *
 * @param {string} step The note-name token (English letter or Spanish solfège).
 * @return {?number} The diatonic step index 0..6, or `null` if unrecognised.
 */
export function stepIndex(step) {
	const letter = normalizeStep(step);
	return letter === null ? null : STEP_INDEX[letter];
}

/**
 * The diatonic index on the unified scale: `octave * 7 + stepIndex`.
 * Middle C = C4 = 28. Placement uses ONLY step + octave, never `alter`.
 *
 * @param {{ step: string, octave: number }} pitch The pitch to index.
 * @return {?number} The diatonic index, or `null` if the step is unrecognised.
 */
export function diatonicIndex(pitch) {
	const idx = stepIndex(pitch.step);
	if (idx === null) {
		return null;
	}
	return pitch.octave * 7 + idx;
}

/**
 * The staff position of a pitch as `sFromBottom`:
 * `ref.sFromBottom + diatonicIndex(p) − diatonicIndex(ref.pitch)`. Verified:
 * treble E4→0, G4→2, F5→8, C4→−2, C6→12; bass C4→+10. Placement ignores `alter`.
 *
 * @param {{ step: string, octave: number }} pitch The pitch to place.
 * @param {string} [clef] The active clef (treble | bass | alto | tenor).
 * @return {?number} `sFromBottom`, or `null` if the step is unrecognised.
 */
export function pitchToStaffStep(pitch, clef = DEFAULT_CLEF) {
	const ref = CLEF_REF[clef] ?? CLEF_REF[DEFAULT_CLEF];
	const di = diatonicIndex(pitch);
	if (di === null) {
		return null;
	}
	const refDi = ref.octave * 7 + STEP_INDEX[ref.step];
	return ref.sFromBottom + di - refDi;
}

/**
 * Convert an `sFromBottom` staff-step to a Y in sp, measured from the bottom
 * staff line. One staff-step = 0.5 sp, Y grows downward, so a
 * higher position (larger `sFromBottom`) yields a smaller Y. With
 * `bottomLineY = 0`, the top line (`sFromBottom = 8`) sits at Y = −4 sp.
 *
 * @param {number} sFromBottom The staff-step position.
 * @param {number} [bottomLineY] Y of the bottom staff line in sp (default 0).
 * @return {number} The Y of that position, in sp.
 */
export function staffStepToY(sFromBottom, bottomLineY = 0) {
	return bottomLineY - sFromBottom * 0.5;
}

/**
 * The ledger-line specs for a notehead at `sFromBottom`. A ledger
 * sits at every LINE position (even `sFromBottom`) between the staff and a note
 * outside `0..8`, inclusive of the note's own line when it lands on one. None for
 * `0 ≤ sFromBottom ≤ 8`. Above: even positions 10..(largest even ≤ sFromBottom);
 * below: even positions −2..(smallest even ≥ sFromBottom). The same routine
 * serves both staves.
 *
 * @param {number} sFromBottom The notehead's staff position.
 * @param {number} [bottomLineY] Y of the bottom staff line in sp (default 0).
 * @return {{ sFromBottom: number, y: number, width: number }[]} Ledger specs,
 *   ordered nearest-the-staff first.
 */
export function ledgerLinesFor(sFromBottom, bottomLineY = 0) {
	const ledgers = [];
	if (sFromBottom > 8) {
		// Above the staff: lines at 10, 12, … up to the highest even ≤ the note.
		const top = sFromBottom - (sFromBottom % 2); // largest even ≤ sFromBottom
		for (let s = 10; s <= top; s += 2) {
			ledgers.push({
				sFromBottom: s,
				y: staffStepToY(s, bottomLineY),
				width: LEDGER_WIDTH,
			});
		}
	} else if (sFromBottom < 0) {
		// Below the staff: lines at −2, −4, … down to the lowest even ≥ the note.
		const bottom = sFromBottom + (Math.abs(sFromBottom) % 2); // smallest even ≥ note
		for (let s = -2; s >= bottom; s -= 2) {
			ledgers.push({
				sFromBottom: s,
				y: staffStepToY(s, bottomLineY),
				width: LEDGER_WIDTH,
			});
		}
	}
	return ledgers;
}

// ── Durations → noteheads / stems / flags / dots ────────────────────────────────

/** The middle line of the staff in `sFromBottom` terms. */
const MIDDLE_LINE = 4;

/**
 * Decode a duration string into its drawing primitives:
 *
 * - `whole` → open notehead, NO stem, no flags;
 * - `half` → open notehead, stem, no flags;
 * - `quarter` and shorter → filled notehead, stem;
 * - `eighth`/`sixteenth`/`thirty-second` → `flagCount` 1/2/3 (drawn only when the
 *   note is NOT beamed — a note is either flagged or beamed, never both).
 *
 * @param {string} duration The note value.
 * @return {{ notehead: "open"|"filled", hasStem: boolean, flagCount: number,
 *   beamCount: number }} The decoded primitives. `beamCount` is the
 *   `BEAM_COUNT` (0 for non-beamable values), shared by flags and beams.
 */
export function decodeDuration(duration) {
	const beamCount = BEAM_COUNT[duration] ?? 0;
	if (duration === "whole") {
		return { notehead: "open", hasStem: false, flagCount: 0, beamCount: 0 };
	}
	const notehead = duration === "half" ? "open" : "filled";
	return { notehead, hasStem: true, flagCount: beamCount, beamCount };
}

/**
 * Whether an event is a beamable note: a `note` (not a rest) whose duration is an
 * eighth or shorter. Rests and quarter-or-longer notes are never beamed.
 *
 * @param {{ type?: string, duration?: string }} event The event to test.
 * @return {boolean} `true` when the event can join a beam.
 */
export function isBeamable(event) {
	return (
		!!event && event.type === "note" && (BEAM_COUNT[event.duration] ?? 0) > 0
	);
}

/**
 * The number of beams/flags for a duration (eighth 1, sixteenth 2,
 * thirty-second 3; 0 otherwise) — the `beamCount`.
 *
 * @param {string} duration The note value.
 * @return {number} The beam/flag count.
 */
export function beamCountFor(duration) {
	return BEAM_COUNT[duration] ?? 0;
}

/**
 * The stem direction for a single notehead: `sFromBottom < 4` → up, `≥ 4` → down
 * (a note ON the middle line stems down).
 *
 * @param {number} sFromBottom The notehead position.
 * @return {"up"|"down"} The stem direction.
 */
export function stemDirectionForStep(sFromBottom) {
	return sFromBottom < MIDDLE_LINE ? "up" : "down";
}

/**
 * The stem direction for a set of chord positions: chosen by the note FARTHEST
 * from the middle line (`max |sFromBottom − 4|`); ties resolve to DOWN.
 * A single note is the one-element case of this rule.
 *
 * @param {number[]} positions The chord's `sFromBottom` values.
 * @return {"up"|"down"} The shared stem direction.
 */
export function stemDirectionForChord(positions) {
	if (positions.length === 0) {
		return "down";
	}
	// The largest distance from the middle line over the whole chord.
	const maxDist = Math.max(...positions.map((s) => Math.abs(s - MIDDLE_LINE)));
	// Is that extreme reached strictly below the middle? strictly above?
	const farthestBelow = positions.some((s) => MIDDLE_LINE - s === maxDist);
	const farthestAbove = positions.some((s) => s - MIDDLE_LINE === maxDist);
	// Up only when the single extreme is below the middle and nothing matches it
	// above; ties (equal distance above and below, or a note ON the middle line
	// where maxDist may be 0) defer to DOWN per the tie rule.
	return farthestBelow && !farthestAbove ? "up" : "down";
}

/**
 * The augmentation-dot positions for a notehead. Dots sit to the
 * RIGHT of the notehead, centred on a SPACE: a note in a space (odd `sFromBottom`)
 * keeps the notehead Y; a note on a line (even `sFromBottom`) nudges its dot up
 * into the adjacent space (the Y of `sFromBottom + 1`). A second dot is further
 * right. One dot per chord notehead.
 *
 * @param {number} sFromBottom The notehead position.
 * @param {number} dots The dot count (0..2).
 * @param {number} [bottomLineY] Y of the bottom staff line in sp (default 0).
 * @return {{ dx: number, y: number }[]} Dot specs, dx relative to the notehead
 *   centre, ordered left-to-right.
 */
export function dotPositions(sFromBottom, dots, bottomLineY = 0) {
	if (!dots || dots <= 0) {
		return [];
	}
	// On a line (even) → nudge into the space above; in a space (odd) → as-is.
	const dotStep = sFromBottom % 2 === 0 ? sFromBottom + 1 : sFromBottom;
	const y = staffStepToY(dotStep, bottomLineY);
	const specs = [];
	for (let i = 0; i < dots; i++) {
		specs.push({ dx: NOTEHEAD_RX + DOT_OFFSET + i * DOT_GAP, y });
	}
	return specs;
}

// ── Chord stacking + the seconds rule ───────────────────────────────────────────

/**
 * Lay out a chord's noteheads on a shared stem. Each notehead sits
 * at its staff-position Y; the seconds rule displaces a note that is a diatonic second
 * (`Δ sFromBottom = 1`) from a neighbour to the OPPOSITE side of the stem so the
 * two do not overlap. In a cluster (e.g. C-D-E) the outer notes stay on the normal
 * side and the middle one flips.
 *
 * "Normal side" = the side the stem attaches: stem-up attaches RIGHT of the
 * notehead, stem-down LEFT, so noteheads default to that side and a displaced
 * back-note goes to the other side (~1 notehead width away).
 *
 * @param {number[]} positions The chord's `sFromBottom` values (any order).
 * @param {"up"|"down"} direction The shared stem direction.
 * @param {number} [bottomLineY] Y of the bottom staff line in sp (default 0).
 * @return {{ sFromBottom: number, y: number, side: "left"|"right",
 *   displaced: boolean }[]} One record per notehead, sorted low→high
 *   (ascending `sFromBottom`).
 */
export function stackChord(positions, direction, bottomLineY = 0) {
	const normalSide = direction === "up" ? "right" : "left";
	const otherSide = normalSide === "right" ? "left" : "right";
	// Sort low→high so the seconds rule can walk neighbours deterministically.
	const sorted = [...positions].sort((a, b) => a - b);
	const heads = sorted.map((sFromBottom) => ({
		sFromBottom,
		y: staffStepToY(sFromBottom, bottomLineY),
		side: normalSide,
		displaced: false,
	}));
	// Walk upward; whenever the previous notehead is a diatonic second below and
	// is still on the normal side, displace THIS (the higher) note to the other
	// side. This keeps the outer notes of a tight cluster on the normal side.
	for (let i = 1; i < heads.length; i++) {
		if (
			heads[i].sFromBottom - heads[i - 1].sFromBottom === 1 &&
			!heads[i - 1].displaced
		) {
			heads[i].side = otherSide;
			heads[i].displaced = true;
		}
	}
	return heads;
}

// ── Best-effort beaming ─────────────────────────────────────────────────────────

/**
 * The duration of an event in quarter-beats: `BASE_DUR[duration] × DOT_MUL[dots]`
 * — the same arithmetic the horizontal spacing reuses. Unknown
 * durations yield 0 so a malformed event never advances `pos` (kept NaN-safe).
 *
 * @param {{ duration?: string, dots?: number }} event The event.
 * @return {number} The duration in quarter-beats.
 */
export function eventDuration(event) {
	const base = BASE_DUR[event?.duration] ?? 0;
	const mul = DOT_MUL[event?.dots ?? 0] ?? 1;
	return base * mul;
}

/**
 * The grouping unit length, in quarter-beats, derived from the time signature FOR
 * GROUPING ONLY. Compound (`beatType ∈ {8,16}` AND `beats % 3 == 0`, e.g. 6/8,
 * 9/8, 12/8) groups in dotted beats (three `beatType` units). Simple metres group
 * by the HALF-BAR, so a chained run joins under one beam (4/4 → fours, 2/2 →
 * 4+4); small simple metres whose half-bar is under a half-note (2/4, 3/4, 2/8)
 * group by the WHOLE BAR instead, since a half-bar there would re-introduce pairs.
 * The unit is floored at one notated beat (binds only in 1/1), and an absent time
 * signature defaults to 4/4 grouping.
 *
 * @param {{ beats?: number, beatType?: number }} [timeSignature] The active time
 *   signature; defaults to 4/4-like grouping when absent.
 * @return {number} The grouping unit in quarter-beats (always > 0).
 */
export function beatGroupLength(timeSignature) {
	const beats = timeSignature?.beats;
	const beatType = timeSignature?.beatType;
	const beat = beatType ? 4 / beatType : 1; // one notated beat (quarter-beats)
	const isCompound =
		(beatType === 8 || beatType === 16) &&
		typeof beats === "number" &&
		beats % 3 === 0;
	if (isCompound) return beat * 3; // dotted beat — UNCHANGED
	// SIMPLE: group by the HALF-BAR so a chained run joins under one beam
	// (4/4 -> 4, 2/2 -> 4+4). For small simple metres whose half-bar is under a
	// half-note (2 quarter-beats) — 2/4, 3/4, 2/8 — the half-bar would re-introduce
	// pairs, so group by the WHOLE BAR. Absent ts defaults to 4/4 (beats -> 4).
	const b = typeof beats === "number" ? beats : 4; // NaN guard (absent ts)
	const barLength = b * beat;
	const halfBar = barLength / 2;
	const unit = halfBar >= 2 ? halfBar : barLength;
	// Never finer than one beat; this floor binds only in 1/1 (whole-note beat).
	return Math.max(unit, beat);
}

/**
 * Best-effort beaming of one hand's events in one measure. Walks
 * events tracking a running `pos` in quarter-beats (`eventDuration`), accumulating
 * consecutive beamable notes and breaking at a rest, a non-beamable note, the
 * measure end, or a crossing into a new grouping unit (`floor(pos / beatLen)`
 * changes — `beatLen` is the metric group's span, which may be wider than one
 * notated beat). The time signature is consulted ONLY for that grouping unit; `pos`
 * is purely a grouping aid — it never clamps or crashes on overflow.
 *
 * A group of length 1 is returned as a single FLAGGED note (`isBeam: false`), not
 * a one-note beam. Groups of two or more are beams (`isBeam: true`). The result
 * lists ONLY beamable runs and singletons — non-beamable events are skipped (they
 * carry their own primitives elsewhere), but they still BREAK an open run.
 *
 * @param {{ type?: string, duration?: string, dots?: number }[]} events One
 *   hand's events for one measure.
 * @param {{ beats?: number, beatType?: number }} [timeSignature] For grouping
 *   only.
 * @return {{ indices: number[], isBeam: boolean, beamCounts: number[] }[]} One
 *   record per beam group / flagged singleton, in event order. `indices` are the
 *   positions of the member events within `events`; `beamCounts` is the per-member
 *   `beamCount`.
 */
export function beamGroups(events, timeSignature) {
	const beatLen = beatGroupLength(timeSignature);
	const groups = [];
	let current = null;
	let pos = 0;

	/** Close the open run, emitting it as a beam or a flagged singleton. */
	const flush = () => {
		if (current && current.indices.length > 0) {
			groups.push({
				indices: current.indices,
				isBeam: current.indices.length > 1,
				beamCounts: current.beamCounts,
			});
		}
		current = null;
	};

	for (let i = 0; i < (events?.length ?? 0); i++) {
		const event = events[i];
		const dur = eventDuration(event);
		const startBeat = beatLen > 0 ? Math.floor(pos / beatLen) : 0;
		const endBeat = beatLen > 0 ? Math.floor((pos + dur) / beatLen) : 0;

		if (!isBeamable(event)) {
			// A rest or a non-beamable note breaks any open run.
			flush();
			pos += dur;
			continue;
		}

		// A beamable note that starts in a new grouping unit opens a new group; a
		// note straddling a boundary still starts a fresh group (never split).
		if (current && startBeat !== current.startBeat) {
			flush();
		}
		if (!current) {
			current = { indices: [], beamCounts: [], startBeat };
		}
		current.indices.push(i);
		current.beamCounts.push(beamCountFor(event.duration));

		// If this note crosses into the next grouping unit, the next note must start
		// a new group; record the crossing so the boundary check above fires.
		if (endBeat !== startBeat) {
			// Keep the note in THIS group but mark the run so the following note
			// breaks: advancing the group's notion of its grouping unit to the end
			// unit is wrong (it would let the next note join); instead flush now so
			// the next beamable note opens fresh. We flush AFTER appending so a single
			// straddling note becomes its own (flagged) group if nothing follows.
			flush();
		}

		pos += dur;
	}
	flush();
	return groups;
}

/**
 * Beam geometry for one group of beamed notes. One stem direction
 * per group, chosen by the group's most-extreme notehead (the extreme rule); the
 * beam is a FLAT horizontal line whose Y is the most-extreme stem end so no stem
 * is too short, and all stems run to that common Y. Secondary beams (16th/32nd)
 * run between adjacent notes via `min(beamCount(left), beamCount(right))`, with a
 * stub toward the beat for an isolated shorter note.
 *
 * Coordinates are in sp; each member carries an `x` (the emit/spacing layer
 * supplies the per-column X; for a group of length 1 this is a degenerate beam and
 * the caller should flag it instead — `beamGroups` already does so).
 *
 * @param {{ x: number, topStep: number, bottomStep: number, beamCount: number }[]}
 *   members Per-note geometry: `x` (sp), the chord's extreme positions
 *   (`topStep` highest, `bottomStep` lowest), and the note's `beamCount`.
 * @param {number} [bottomLineY] Y of the bottom staff line in sp (default 0).
 * @return {{ direction: "up"|"down", beamY: number, stems:
 *   { x: number, y1: number, y2: number }[], beams:
 *   { level: number, x1: number, x2: number }[] }} The flat-beam geometry: the
 *   shared direction, the common beam Y, each stem's span, and the primary +
 *   secondary beam segments.
 */
export function beamGeometry(members, bottomLineY = 0) {
	// The group's stem direction comes from the single most-extreme notehead
	// across all members (the extreme rule).
	const allSteps = [];
	for (const m of members) {
		allSteps.push(m.topStep, m.bottomStep);
	}
	const direction = stemDirectionForChord(allSteps);

	// The notehead each stem attaches to depends on direction: stem-up starts at
	// the LOWEST notehead and rises; stem-down starts at the HIGHEST and falls.
	const headStepFor = (m) => (direction === "up" ? m.bottomStep : m.topStep);
	const headYFor = (m) => staffStepToY(headStepFor(m), bottomLineY);

	// Flat beam: place the beam Y at the most-extreme stem END so every stem
	// reaches it without being too short. Stem-up ends are ABOVE (smaller Y);
	// stem-down ends are BELOW (larger Y).
	let beamY;
	if (direction === "up") {
		beamY = Math.min(...members.map((m) => headYFor(m) - STEM_LENGTH));
	} else {
		beamY = Math.max(...members.map((m) => headYFor(m) + STEM_LENGTH));
	}

	const stems = members.map((m) => ({
		x: m.x,
		y1: headYFor(m),
		y2: beamY,
	}));

	// Primary beam across the full group; secondary beams between adjacent notes.
	const beams = [];
	if (members.length >= 2) {
		beams.push({
			level: 1,
			x1: members[0].x,
			x2: members[members.length - 1].x,
		});
		for (let i = 0; i < members.length - 1; i++) {
			const shared = Math.min(members[i].beamCount, members[i + 1].beamCount);
			for (let level = 2; level <= shared; level++) {
				beams.push({ level, x1: members[i].x, x2: members[i + 1].x });
			}
		}
		// Stubs for an isolated shorter note (its beamCount exceeds both neighbours'
		// shared beams). Stub points toward the beat (toward the previous note when
		// possible, else the next).
		for (let i = 0; i < members.length; i++) {
			const leftShared =
				i > 0 ? Math.min(members[i - 1].beamCount, members[i].beamCount) : 0;
			const rightShared =
				i < members.length - 1
					? Math.min(members[i].beamCount, members[i + 1].beamCount)
					: 0;
			const neighbourShared = Math.max(leftShared, rightShared);
			for (
				let level = neighbourShared + 1;
				level <= members[i].beamCount;
				level++
			) {
				const stubLen = NOTEHEAD_RX * 1.5;
				const towardPrev = i > 0;
				const x1 = towardPrev ? members[i].x - stubLen : members[i].x;
				const x2 = towardPrev ? members[i].x : members[i].x + stubLen;
				beams.push({ level, x1, x2, stub: true });
			}
		}
	}

	return { direction, beamY, stems, beams };
}

// ── Accidentals — stateless, data-faithful ──────────────────────────────────────

/**
 * Build the per-letter default-alteration map for a hand from its `alters`,
 * keying every entry through `normalizeStep`. Unrecognised keys are
 * skipped (the validator would have rejected them, but this stays defensive so a
 * bad key never indexes `undefined`).
 *
 * @param {Record<string, number>} [alters] The hand's `alters` map (note name →
 *   alteration), or absent.
 * @return {Record<string, number>} A canonical letter → alteration map.
 */
export function normalizeAlters(alters) {
	const out = {};
	if (!alters) {
		return out;
	}
	for (const [key, value] of Object.entries(alters)) {
		const letter = normalizeStep(key);
		if (letter !== null) {
			out[letter] = value;
		}
	}
	return out;
}

/**
 * Resolve a single pitch's accidental, statelessly and data-faithfully.
 * Computes `effectiveAlter = pitch.alter ?? normAlters[letter] ?? 0`, and
 * the GLYPH by these stateless rules:
 *
 * - `pitch.alter` present and ≠ 0 → draw that accidental (even if redundant — a
 *   legitimate courtesy/cautionary accidental);
 * - `pitch.alter` present and == 0 → draw a NATURAL only if the key-sig default
 *   for that letter ≠ 0 (otherwise nothing — no pointless naturals);
 * - `pitch.alter` ABSENT → no glyph (its default lives in the key signature).
 *
 * No measure-local accidental tracking (stateless): each note expresses its own
 * intent. The glyph name is `ACCIDENTAL_GLYPHS[alter + 2]`, drawn LEFT of the
 * notehead at the SAME Y (`alter` never moves Y).
 *
 * @param {{ step: string, alter?: number }} pitch The pitch to resolve.
 * @param {Record<string, number>} [normAlters] The hand's normalized `alters`
 *   (canonical letter → default alteration), from `normalizeAlters`.
 * @return {{ effectiveAlter: number, glyph: ?string, glyphAlter: ?number }} The
 *   pitch's effective alteration (for pitch reasoning), the accidental glyph name
 *   to draw (or `null` for none), and the alteration that glyph represents.
 */
export function resolveAccidental(pitch, normAlters = {}) {
	const letter = normalizeStep(pitch.step);
	const keyDefault = (letter !== null ? normAlters[letter] : undefined) ?? 0;
	const hasExplicit = typeof pitch.alter === "number";
	const effectiveAlter = hasExplicit ? pitch.alter : keyDefault;

	let glyphAlter = null;
	if (hasExplicit) {
		if (pitch.alter !== 0) {
			// Explicit non-zero override always shows.
			glyphAlter = pitch.alter;
		} else if (keyDefault !== 0) {
			// Explicit natural cancels a key-sig default (draw a natural).
			glyphAlter = 0;
		}
		// Explicit 0 with no key-sig default → nothing.
	}
	// No explicit alter → no glyph (the default lives in the key signature).

	const glyph = glyphAlter === null ? null : ACCIDENTAL_GLYPHS[glyphAlter + 2];
	return { effectiveAlter, glyph, glyphAlter };
}

/**
 * Best-effort accidental column-stacking for a chord. Accidentals
 * default to one column ~`ACCIDENTAL_GAP` sp left of the noteheads; when two fall
 * within ~1.5 sp (3 staff-steps) vertically, the lower of the pair is pushed into
 * a further-left column (`+ACCIDENTAL_COL_STEP` per column), processed top-down.
 * Full optimal stacking is out of scope.
 *
 * @param {{ sFromBottom: number, glyph: string }[]} accidentals The chord's
 *   accidentals (those with a glyph), any order.
 * @param {number} [bottomLineY] Y of the bottom staff line in sp (default 0).
 * @return {{ sFromBottom: number, glyph: string, y: number, dx: number,
 *   column: number }[]} One record per accidental, sorted high→low (descending
 *   `sFromBottom`), with `dx` = the leftward offset from the notehead column (a
 *   negative-going magnitude expressed positive) and `column` the column index.
 */
export function stackAccidentals(accidentals, bottomLineY = 0) {
	// Process top-down (highest pitch / smallest Y first).
	const sorted = [...accidentals].sort((a, b) => b.sFromBottom - a.sFromBottom);
	const placed = [];
	for (const acc of sorted) {
		// Find the nearest column that has no accidental within ~1.5 sp (3 steps).
		let column = 0;
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const clash = placed.some(
				(p) =>
					p.column === column && Math.abs(p.sFromBottom - acc.sFromBottom) <= 3,
			);
			if (!clash) {
				break;
			}
			column += 1;
		}
		placed.push({
			sFromBottom: acc.sFromBottom,
			glyph: acc.glyph,
			y: staffStepToY(acc.sFromBottom, bottomLineY),
			dx: ACCIDENTAL_GAP + column * ACCIDENTAL_COL_STEP,
			column,
		});
	}
	return placed;
}

// ── Union-grid alignment + compressive spacing + intrinsic widths ────────────────
//
// Onsets, the shared grid, the per-column advances, and the intrinsic measure
// width all come PURELY from event durations — `timeSignature` is NEVER consulted
// for any X or width. That single rule makes events that don't sum to the time
// signature, and one-hand / empty-hand measures (which still draw both staves),
// fall out structurally: the layout simply does not know or care what the bar
// "should" total, and the staff geometry is driven by measure dimensions, not by
// events. Everything is kept NaN-safe (`sqrt(max(Δ, 0))`, an empty-grid
// short-circuit, and `measureEnd = max(handEnds, 0)`).

/**
 * One hand's event onsets within a measure: the running sum from 0
 * of each event's `eventDuration`. Each event contributes one onset (its start),
 * so the i-th onset is the total duration of events 0..i−1. Rests are full grid
 * citizens — a rest advances the running onset just like a note. An absent or
 * empty hand yields `[]`.
 *
 * @param {{ duration?: string, dots?: number }[]} [events] One hand's events for
 *   one measure.
 * @return {number[]} The onset of each event, in quarter-beats, in event order.
 */
export function handOnsets(events) {
	const onsets = [];
	let pos = 0;
	for (let i = 0; i < (events?.length ?? 0); i++) {
		onsets.push(pos);
		pos += eventDuration(events[i]);
	}
	return onsets;
}

/**
 * The end (total duration) of one hand's events in a measure: the
 * running sum of every event's `eventDuration`. An absent or empty hand yields 0.
 *
 * @param {{ duration?: string, dots?: number }[]} [events] One hand's events.
 * @return {number} The hand's end onset, in quarter-beats (≥ 0).
 */
export function handEnd(events) {
	let pos = 0;
	for (let i = 0; i < (events?.length ?? 0); i++) {
		pos += eventDuration(events[i]);
	}
	return pos;
}

/**
 * The union grid for a measure: the sorted, de-duplicated union of
 * both hands' onsets. Each unique onset `t` maps to one X (computed by
 * `measureLayout`), so an event at `t` in EITHER hand draws at the same X →
 * automatic vertical alignment. Equal onsets collapse to one column; an off-beat
 * onset present in only one hand gets its own column between the shared ones; an
 * empty measure yields `[]`.
 *
 * @param {number[]} rightOnsets The right hand's onsets (`handOnsets`).
 * @param {number[]} leftOnsets The left hand's onsets (`handOnsets`).
 * @return {number[]} The sorted unique onset grid.
 */
export function unionGrid(rightOnsets, leftOnsets) {
	const set = new Set();
	for (const t of rightOnsets ?? []) {
		set.add(t);
	}
	for (const t of leftOnsets ?? []) {
		set.add(t);
	}
	return [...set].sort((a, b) => a - b);
}

/**
 * The compressive horizontal advance for a gap between adjacent onsets:
 * `advance(Δ) = MIN_ADV + ADV_K · sqrt(max(Δ, 0))`. Real engraving spacing
 * is logarithmic (~1.5:1 per duration-doubling), not strictly proportional, so a
 * whole note advances ~2.5× a 32nd rather than 32×. `sqrt(max(Δ, 0))` keeps it
 * NaN-safe for a negative or zero gap (clamping to the `MIN_ADV` floor).
 *
 * `extra` raises the minimum for THIS column when accidentals / dots / flags are
 * present so their glyphs clear (it is added on top of the compressive term).
 *
 * @param {number} delta The gap to the next onset, in quarter-beats.
 * @param {{ extra?: number }} [options] `extra` additional clearance (sp) for
 *   glyphs at this column.
 * @return {number} The advance, in sp (always finite, always ≥ `MIN_ADV`).
 */
export function advanceFor(delta, { extra = 0 } = {}) {
	return MIN_ADV + ADV_K * Math.sqrt(Math.max(delta, 0)) + Math.max(extra, 0);
}

/**
 * Lay out one measure's two hands onto the shared union grid with content-driven
 * compressive spacing, yielding the per-column X positions and the measure's
 * intrinsic width — all purely from event durations. NEVER consults
 * `timeSignature`: a `timeSignature` passed in `options` is ignored for every X
 * and width (it is accepted only so callers may pass a uniform options object).
 *
 * Per column `i` (grid onset `t_i`), the advance to the next column is
 * `advanceFor(Δ_i, { extra })` where `Δ_i = grid[i+1] − t_i` and the LAST column
 * uses `Δ = measureEnd − t_last` with `measureEnd = max(handEnds, 0)`. The first
 * column starts at `leadingPad`; `contentWidth = Σ advances` (or
 * `EMPTY_MEASURE_WIDTH` for an empty grid); `width = leadingPad + contentWidth +
 * trailingPad`. Both hands' onsets are always reported (`hands.right`/`hands.left`)
 * so the emit layer can draw BOTH staves even for a one-hand or empty measure.
 *
 * @param {{ duration?: string, dots?: number }[]} [rightEvents] The RH events.
 * @param {{ duration?: string, dots?: number }[]} [leftEvents] The LH events.
 * @param {{ leadingPad?: number, trailingPad?: number,
 *   columnExtra?: Record<number, number> }} [options] `leadingPad` (clef/keysig/
 *   timesig reserve, only on measures that print them), `trailingPad` (barline
 *   width + repeat dots / final thick bar), and `columnExtra` (per-column-index
 *   extra clearance for accidentals/dots/flags). A `timeSignature` here is ignored.
 * @return {{ grid: number[], columns: { onset: number, x: number,
 *   advance: number }[], measureEnd: number, contentWidth: number, width: number,
 *   hands: { right: { onsets: number[] }, left: { onsets: number[] } } }} The
 *   measure layout as plain data, in sp.
 */
export function measureLayout(rightEvents, leftEvents, options = {}) {
	const { leadingPad = 0, trailingPad = 0, columnExtra = {} } = options;

	const rightOnsets = handOnsets(rightEvents);
	const leftOnsets = handOnsets(leftEvents);
	const grid = unionGrid(rightOnsets, leftOnsets);

	// The measure's end is the longer hand's total duration — never the time
	// signature. `max(handEnds, 0)` keeps it ≥ 0 for an empty measure.
	const measureEnd = Math.max(handEnd(rightEvents), handEnd(leftEvents), 0);

	const hands = {
		right: { onsets: rightOnsets },
		left: { onsets: leftOnsets },
	};

	// Empty grid → the floor width, no columns, no NaN (the empty-grid short-circuit).
	if (grid.length === 0) {
		return {
			grid,
			columns: [],
			measureEnd,
			contentWidth: EMPTY_MEASURE_WIDTH,
			width: leadingPad + EMPTY_MEASURE_WIDTH + trailingPad,
			hands,
		};
	}

	// Walk the grid left→right, placing each column at the running X and computing
	// the advance to the next onset (the last column gaps to `measureEnd`).
	const columns = [];
	let x = leadingPad;
	let contentWidth = 0;
	for (let i = 0; i < grid.length; i++) {
		const onset = grid[i];
		const next = i + 1 < grid.length ? grid[i + 1] : measureEnd;
		const advance = advanceFor(next - onset, { extra: columnExtra[i] ?? 0 });
		columns.push({ onset, x, advance });
		x += advance;
		contentWidth += advance;
	}

	return {
		grid,
		columns,
		measureEnd,
		contentWidth,
		width: leadingPad + contentWidth + trailingPad,
		hands,
	};
}

// ── Section context resolution + diff ────────────────────────────────────────────
//
// A single pre-pass resolves each section's EFFECTIVE musical context from the
// inheritance model — every field inherits from `defaults` independently, `alters`
// replaces wholesale, `octaveShift` defaults to 0 — then each section is diffed
// against the previous so the renderer redraws ONLY what changed (the first section
// draws everything). The diff drives mid-song changes; the per-system restatement
// separately redraws the current clef + alters on every system.

/** The two hands, in render order, keyed as they appear in the song format. */
const HANDS = ["rightHand", "leftHand"];

/** The default clef per hand when neither the section nor `defaults` sets one. */
const DEFAULT_HAND_CLEF = { rightHand: "treble", leftHand: "bass" };

/**
 * Resolve one hand's effective `handConfig` for a section against the song-wide
 * `defaults`. Each field inherits independently: `clef` falls back
 * to the default hand clef, `alters` REPLACES wholesale (a present section `alters`
 * — even `{}` — wins; only an absent one inherits), and `octaveShift` defaults to 0.
 *
 * @param {string} hand The hand key (`rightHand` | `leftHand`).
 * @param {object} [sectionCfg] The section's handConfig for this hand.
 * @param {object} [defaultsCfg] The `defaults` handConfig for this hand.
 * @return {{ clef: string, alters: Record<string, number>, octaveShift: number }}
 *   The resolved per-hand context.
 */
export function resolveHandContext(hand, sectionCfg, defaultsCfg) {
	const sec = sectionCfg ?? {};
	const def = defaultsCfg ?? {};
	const clef = sec.clef ?? def.clef ?? DEFAULT_HAND_CLEF[hand];
	// `alters` replaces wholesale: a present section value wins even when empty.
	const alters = sec.alters ?? def.alters ?? {};
	const octaveShift = sec.octaveShift ?? def.octaveShift ?? 0;
	return { clef, alters, octaveShift };
}

/**
 * Resolve every section's effective context via the inheritance model:
 * `tempo` and `timeSignature` inherit from `defaults` as whole objects; each
 * hand's `clef`/`alters`/`octaveShift` resolves through `resolveHandContext`. The
 * result is one effective-context record per section, in order.
 *
 * @param {{ defaults?: object, sections?: object[] }} song The parsed song.
 * @return {{ tempo: ?object, timeSignature: ?object,
 *   rightHand: object, leftHand: object }[]} One resolved context per section.
 */
export function resolveSectionContexts(song) {
	const defaults = song?.defaults ?? {};
	const sections = Array.isArray(song?.sections) ? song.sections : [];
	return sections.map((section) => ({
		tempo: section?.tempo ?? defaults.tempo ?? null,
		timeSignature: section?.timeSignature ?? defaults.timeSignature ?? null,
		rightHand: resolveHandContext(
			"rightHand",
			section?.rightHand,
			defaults.rightHand,
		),
		leftHand: resolveHandContext(
			"leftHand",
			section?.leftHand,
			defaults.leftHand,
		),
	}));
}

/** Shallow structural equality for the small plain context sub-objects. */
function shallowEqual(a, b) {
	if (a === b) {
		return true;
	}
	if (!a || !b || typeof a !== "object" || typeof b !== "object") {
		return false;
	}
	const ka = Object.keys(a);
	const kb = Object.keys(b);
	if (ka.length !== kb.length) {
		return false;
	}
	return ka.every((k) => a[k] === b[k]);
}

/**
 * Diff one resolved section context against the previous one,
 * marking ONLY what changed so the renderer redraws just those symbols. With no
 * previous context (the first section) EVERYTHING is marked changed — the first
 * section draws its full context.
 *
 * @param {object} curr The current section's resolved context.
 * @param {?object} [prev] The previous section's resolved context, or `null`.
 * @return {{ tempo: boolean, timeSignature: boolean,
 *   rightHand: { clef: boolean, alters: boolean, octaveShift: boolean },
 *   leftHand: { clef: boolean, alters: boolean, octaveShift: boolean } }} The
 *   per-field change flags.
 */
export function diffContext(curr, prev = null) {
	const diffHand = (hand) => {
		const c = curr[hand];
		const p = prev ? prev[hand] : null;
		return {
			clef: !p || c.clef !== p.clef,
			alters: !p || !shallowEqual(c.alters, p.alters),
			octaveShift: !p || c.octaveShift !== p.octaveShift,
		};
	};
	return {
		tempo: !prev || !shallowEqual(curr.tempo, prev.tempo),
		timeSignature:
			!prev || !shallowEqual(curr.timeSignature, prev.timeSignature),
		rightHand: diffHand("rightHand"),
		leftHand: diffHand("leftHand"),
	};
}

// ── `alters` as a key-signature-like cluster ────────────────────────────────────
//
// The hand's `alters` map renders as a key-signature cluster: one glyph per altered
// note name at that letter's standard key-sig register for the active clef (a fixed
// per-clef 7-register table). Standard sharp/flat sets draw in conventional order
// (sharps F C G D A E B, flats B E A D G C F); anything outside those orders is
// appended in note-name order. The renderer does NOT detect a circle-of-fifths key —
// `alters` is an arbitrary map, so odd/partial/double sets just draw faithfully.

/**
 * Fixed per-clef key-signature registers as `sFromBottom` for each canonical letter.
 * These are the conventional engraved positions: the treble row is
 * the standard treble key-sig placement, and the others place each letter on the
 * register that keeps the cluster on/near that clef's staff.
 */
const KEY_SIG_REGISTER = {
	treble: { A: 3, B: 4, C: 5, D: 6, E: 7, F: 8, G: 9 },
	bass: { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 },
	alto: { A: 2, B: 3, C: 4, D: 5, E: 6, F: 7, G: 8 },
	tenor: { A: 4, B: 5, C: 6, D: 7, E: 8, F: 2, G: 3 },
};

/** Conventional accidental order for sharps and flats. */
const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"];

/**
 * The conventional draw order for one altered letter: sharps (and
 * double-sharps) rank by the sharp sequence, flats (and double-flats) by the flat
 * sequence; a letter outside the relevant order ranks last and falls back to
 * note-name (alphabetical) order. Sharps are grouped before flats.
 */
function alterRank(letter, alter) {
	if (alter > 0) {
		const i = SHARP_ORDER.indexOf(letter);
		return [0, i < 0 ? SHARP_ORDER.length : i, letter];
	}
	const i = FLAT_ORDER.indexOf(letter);
	return [1, i < 0 ? FLAT_ORDER.length : i, letter];
}

/**
 * Build the key-signature-like cluster for a hand's `alters`. Each
 * altered note name becomes one accidental glyph at its standard key-sig register
 * for the active clef, ordered conventionally (sharps then flats, each in its
 * canonical sequence; unknowns appended in note-name order). Zero-alteration
 * entries draw nothing (a key sig has no naturals). Doubles draw the double glyph.
 *
 * The cluster is laid out left→right; each glyph advances by `step` sp. The caller
 * positions the whole cluster (its `width` is the total advance) in the leading
 * reserve or inline at a section change.
 *
 * @param {Record<string, number>} alters The hand's RAW `alters` map.
 * @param {string} clef The active clef for this hand.
 * @param {{ step?: number, bottomLineY?: number }} [options] `step` per-glyph
 *   advance (sp), `bottomLineY` the staff's bottom-line Y (sp).
 * @return {{ glyphs: { letter: string, glyph: string, alter: number,
 *   sFromBottom: number, x: number, y: number }[], width: number }} The cluster.
 */
export function keySignatureCluster(alters, clef, options = {}) {
	const { step = ACCIDENTAL_COL_STEP, bottomLineY = 0 } = options;
	const register = KEY_SIG_REGISTER[clef] ?? KEY_SIG_REGISTER.treble;

	// Normalize keys to canonical letters and drop zero/unrecognised entries.
	const entries = [];
	for (const [key, value] of Object.entries(alters ?? {})) {
		const letter = normalizeStep(key);
		if (letter === null || !value) {
			continue;
		}
		entries.push({ letter, alter: value });
	}

	// Conventional order: sharps before flats, each in its canonical sequence.
	entries.sort((a, b) => {
		const ra = alterRank(a.letter, a.alter);
		const rb = alterRank(b.letter, b.alter);
		if (ra[0] !== rb[0]) {
			return ra[0] - rb[0];
		}
		if (ra[1] !== rb[1]) {
			return ra[1] - rb[1];
		}
		return ra[2] < rb[2] ? -1 : ra[2] > rb[2] ? 1 : 0;
	});

	const glyphs = entries.map((e, i) => {
		const sFromBottom = register[e.letter];
		return {
			letter: e.letter,
			glyph: ACCIDENTAL_GLYPHS[e.alter + 2],
			alter: e.alter,
			sFromBottom,
			x: i * step,
			y: staffStepToY(sFromBottom, bottomLineY),
		};
	});

	return { glyphs, width: glyphs.length * step };
}

// ── octaveShift → ottava bracket ─────────────────────────────────────────────────

/** Ottava labels keyed by `octaveShift`. */
const OTTAVA_LABELS = { 1: "8va", 2: "15ma", "-1": "8vb", "-2": "15mb" };

/**
 * The ottava marking for an `octaveShift`: the bracket LABEL and
 * whether it sits above (positive shift) or below (negative). `octaveShift` is a
 * bracket, NOT a vertical move — notes are still placed by their written octave —
 * so this only describes the dashed bracket + label that spans the affected hand's
 * section notes. Returns `null` for no shift (0 or absent).
 *
 * @param {number} octaveShift The resolved per-hand octave shift (−2..2).
 * @return {{ label: string, placement: "above"|"below" } | null} The ottava, or
 *   `null` when there is no shift.
 */
export function ottavaFor(octaveShift) {
	if (!octaveShift) {
		return null;
	}
	const label = OTTAVA_LABELS[String(octaveShift)];
	if (!label) {
		return null;
	}
	return { label, placement: octaveShift > 0 ? "above" : "below" };
}

// ── Ties + slurs — stack-based, dangling-safe ────────────────────────────────────
//
// Per hand, a `tie:start` / `slur:start` opens a pending span closed by the next
// matching `stop`. The matching is robust to malformed data: a dangling start (incl.
// end-of-hand), a dangling stop, or a second start before a stop is best-effort or
// skipped — it NEVER throws. The result is a flat list of {startRef, stopRef} pairs
// (each an opaque event locator the caller resolves to laid-out positions, so a span
// across barlines/systems is drawn between its actual positions, clipped by the emit
// layer to system edges).

/**
 * Match one marker kind (`tie` or `slur`) across one hand's flattened event stream
 * into start/stop pairs. The stream is a flat list of event locators
 * in playing order across the whole hand (every measure), each carrying its `tie` /
 * `slur` marker. Stack-based with a single pending start (monophonic-per-hand): a
 * new start while one is pending CLOSES nothing and replaces the pending start
 * (the earlier one dangles and is dropped); a stop with no pending start is dropped.
 * Both behaviours are silent — never a throw.
 *
 * @param {{ marker?: "start"|"stop" }[]} stream The hand's event locators in order,
 *   each with the relevant marker (`tie` or `slur`) projected onto `marker`.
 * @return {{ startIndex: number, stopIndex: number }[]} The matched index pairs
 *   (indices into `stream`), in start order. Dangling markers are omitted.
 */
export function matchSpans(stream) {
	const pairs = [];
	let pendingStart = null;
	for (let i = 0; i < (stream?.length ?? 0); i++) {
		const marker = stream[i]?.marker;
		if (marker === "start") {
			// A second start before a stop drops the earlier (dangling) start.
			pendingStart = i;
		} else if (marker === "stop") {
			if (pendingStart !== null) {
				pairs.push({ startIndex: pendingStart, stopIndex: i });
				pendingStart = null;
			}
			// A stop with no pending start is a dangling stop → dropped.
		}
	}
	// A leftover pendingStart is a dangling start → dropped (no throw).
	return pairs;
}

/**
 * Project a hand's flat event stream onto one marker kind for `matchSpans`:
 * keeps every event's identity (its index) and pulls the chosen
 * marker (`tie` or `slur`) onto `marker`. Events without that marker carry
 * `marker: undefined` and simply pass through the matcher untouched.
 *
 * @param {{ tie?: string, slur?: string }[]} events The hand's flat event stream.
 * @param {"tie"|"slur"} kind Which marker to project.
 * @return {{ marker?: string }[]} The projected stream, same length/order.
 */
export function projectMarker(events, kind) {
	return (events ?? []).map((e) => ({ marker: e?.[kind] }));
}

// ── Tempo text ────────────────────────────────────────────────────────────────────

/** Note-value → its SMuFL metronome note glyph name. */
const TEMPO_NOTE_GLYPH = {
	whole: "metNoteWhole",
	half: "metNoteHalf",
	quarter: "metNoteQuarter",
	eighth: "metNoteEighth",
	sixteenth: "metNoteSixteenth",
	"thirty-second": "metNote32nd",
};

/**
 * The tempo marking for a section: "[beatUnit note-glyph] = [bpm]"
 * (e.g. ♩ = 120). A missing `beatUnit` defaults to the quarter glyph — the glyph +
 * " = " + the bpm number is the recognizable metronome mark, so the glyph is never
 * omitted. Returns `null` when there is no tempo (so nothing is drawn).
 *
 * @param {{ bpm?: number, beatUnit?: string }} [tempo] The resolved section tempo.
 * @return {{ glyph: string, bpm: number } | null} The tempo mark's note glyph name
 *   and bpm, or `null` when absent.
 */
export function tempoMark(tempo) {
	if (!tempo || typeof tempo.bpm !== "number") {
		return null;
	}
	const glyph = TEMPO_NOTE_GLYPH[tempo.beatUnit] ?? TEMPO_NOTE_GLYPH.quarter;
	return { glyph, bpm: tempo.bpm };
}

// ── Barlines ──────────────────────────────────────────────────────────────────────
//
// A barline spans both staves of the grand staff (the emit layer draws each stroke
// from the top of the RH staff to the bottom of the LH staff). This returns the
// stroke + dot specs at a given X; the shared placement rule (always draw the
// right barline; draw a left one only for `repeat-start`; the score's first measure
// has no left barline) is applied by `buildLayoutModel`, not here.

/** Gap between the two thin strokes of a double bar / the strokes of a repeat. */
const DOUBLE_BAR_GAP = 0.5;
/** Gap between a barline stroke and its repeat dots. */
const REPEAT_DOT_GAP = 0.6;

/**
 * The stroke + dot specs for one barline of a given type at X `x`,
 * laid out left→right from `x`:
 *
 * - `regular` → one thin stroke;
 * - `double` → two thin strokes ~`DOUBLE_BAR_GAP` apart;
 * - `final` → thin then thick;
 * - `repeat-start` → thick + thin, then two dots to the right;
 * - `repeat-end` → two dots to the left, then thin + thick.
 *
 * Strokes carry their `thickness`; dots carry an `sFromBottom` register (2nd/3rd
 * spaces — `dotSteps`) the emit layer turns into one dot per staff. `width` is the
 * total horizontal extent so the caller can reserve trailing/leading room.
 *
 * @param {string} type One of regular | double | final | repeat-start |
 *   repeat-end (anything else → regular).
 * @param {number} [x] The left X of the barline group, in sp.
 * @return {{ strokes: { x: number, thickness: number }[],
 *   dots: { x: number, dotSteps: number[] }[], width: number }} The barline spec.
 */
export function barlineSpec(type, x = 0) {
	const strokes = [];
	const dots = [];
	// Repeat dots straddle the middle: the 2nd space (sFromBottom 3) and 3rd space
	// (sFromBottom 5) of each staff (the emit layer mirrors them onto both staves).
	const dotSteps = [3, 5];
	let cursor = x;

	const thin = () => {
		strokes.push({ x: cursor, thickness: BARLINE_THIN });
		cursor += BARLINE_THIN;
	};
	const thick = () => {
		strokes.push({ x: cursor, thickness: BARLINE_THICK });
		cursor += BARLINE_THICK;
	};
	const gap = (g) => {
		cursor += g;
	};

	switch (type) {
		case "double":
			thin();
			gap(DOUBLE_BAR_GAP);
			thin();
			break;
		case "final":
			thin();
			gap(DOUBLE_BAR_GAP);
			thick();
			break;
		case "repeat-start":
			thick();
			gap(BARLINE_THIN);
			thin();
			gap(REPEAT_DOT_GAP);
			dots.push({ x: cursor, dotSteps });
			cursor += REPEAT_DOT_GAP;
			break;
		case "repeat-end":
			dots.push({ x: cursor, dotSteps });
			cursor += REPEAT_DOT_GAP;
			gap(REPEAT_DOT_GAP);
			thin();
			gap(BARLINE_THIN);
			thick();
			break;
		default:
			thin();
			break;
	}

	return { strokes, dots, width: cursor - x };
}

/**
 * The trailing horizontal room a measure must reserve for its right barline:
 * the barline group's own width plus `BARLINE_POST_PAD` of whitespace after it,
 * so the NEXT measure's first note clears the line.
 *
 * @param {string} [barlineEnd] The measure's `barlineEnd` type (default regular).
 * @return {number} The trailing pad, in sp.
 */
export function barlineTrailingPad(barlineEnd) {
	return barlineSpec(barlineEnd ?? "regular").width + BARLINE_POST_PAD;
}

// ── Leading reserve + system wrapping / justify ──────────────────────────────────
//
// Each system restates a leading reserve (the brace, both clefs, and each hand's
// `alters` cluster, plus the time signature on system 1 / on a change) before its
// first measure. Measures are then greedily packed into width-fitted stacked
// systems, justified by scaling the internal grid ADVANCES only — never the reserve,
// glyphs, stems, or noteheads — with an over-wide single measure downscaling its
// whole system so nothing overflows.

/** Approximate widths of the leading-reserve glyphs, in sp. */
const BRACE_WIDTH = 1.5;
/** The clef's horizontal slot, including trailing space before the alters. */
const CLEF_WIDTH = 3.8;
const TIME_SIG_WIDTH = 2.5;
/** Pad after the reserve before the first notehead. */
const RESERVE_PAD = 1;

/**
 * The per-system leading reserve in sp: brace + one clef column (the two
 * clefs are vertically stacked, so they share ONE horizontal slot) + the wider hand's
 * `alters` cluster (its glyph count × the cluster step) + a gap before the time
 * signature when alters print, plus the time signature itself when `withTimeSig`.
 * Computed from the glyphs ACTUALLY printed, so it varies with the number of alters.
 * The field-advance arithmetic here is mirrored exactly by the positioned reserve model
 * in `buildLayoutModel`, so the measures begin precisely past the time signature. This
 * reserve is subtracted from the content budget and is NEVER scaled by justify.
 *
 * @param {{ clef: string, alters: object }} rightCtx The RH resolved context.
 * @param {{ clef: string, alters: object }} leftCtx The LH resolved context.
 * @param {boolean} withTimeSig Whether a time signature prints on this system.
 * @return {number} The leading reserve, in sp.
 */
export function leadingReserveFor(rightCtx, leftCtx, withTimeSig) {
	const altersWidth = (ctx) => keySignatureCluster(ctx.alters, ctx.clef).width;
	const maxAlters = Math.max(altersWidth(rightCtx), altersWidth(leftCtx));
	let reserve = BRACE_WIDTH + CLEF_WIDTH + maxAlters;
	if (maxAlters > 0) {
		reserve += KEYSIG_TIMESIG_GAP;
	}
	if (withTimeSig) {
		reserve += TIME_SIG_WIDTH;
	}
	return reserve + RESERVE_PAD;
}

/**
 * Greedily pack measures into width-fitted stacked systems. Fill a
 * system until the next measure's content width would exceed the available content
 * width (`availSp`), then break; ALWAYS keep ≥ 1 measure per system (so a measure
 * wider than the container still goes, alone, on its own system — preventing an
 * infinite loop). `availSp` is recomputed per candidate system from its own leading
 * reserve, since the reserve varies with the leading measure's context + whether a
 * time signature prints there.
 *
 * @param {{ contentWidth: number, reserve: number }[]} measures Per-measure packing
 *   inputs: the intrinsic content width (grid advances + trailing barline) and the
 *   leading reserve to use IF this measure starts a system.
 * @param {number} budgetSp The full container width, in sp.
 * @return {{ start: number, count: number }[]} The packed systems as index ranges
 *   into `measures`.
 */
export function packSystems(measures, budgetSp) {
	const systems = [];
	let i = 0;
	const n = measures.length;
	while (i < n) {
		const reserve = measures[i].reserve;
		const availSp = Math.max(budgetSp - reserve, 0);
		// Always take at least the first measure (even if it overflows alone).
		let used = measures[i].contentWidth;
		let count = 1;
		while (i + count < n) {
			const next = measures[i + count].contentWidth;
			if (used + next > availSp) {
				break;
			}
			used += next;
			count += 1;
		}
		systems.push({ start: i, count });
		i += count;
	}
	return systems;
}

/**
 * The justify / downscale factor for one packed system. Normally the
 * internal grid advances are stretched to fill the width — `scale =
 * clamp(availSp/contentSp, 1, MAX_STRETCH)` — but NOT the last system of the whole
 * score (the conventional ragged last line) and NOT an over-wide system (scale < 1
 * is left ragged-right, never compressed by the advance stretch). A single measure
 * wider than the container instead downscales the WHOLE system uniformly
 * (`downscaleFactor = min(1, availSp/contentSp)`, applied to glyphs too) so nothing
 * overflows.
 *
 * @param {number} contentSp The system's total content width (sum of measure
 *   content widths), in sp.
 * @param {number} availSp The system's available content width (budget − reserve).
 * @param {{ isLast?: boolean }} [options] `isLast` whether this is the score's last
 *   system (not justified).
 * @return {{ advanceScale: number, downscaleFactor: number }} `advanceScale` to
 *   apply to grid advances only; `downscaleFactor` to apply as a transform on the
 *   whole system group (1 unless the content overflows the available width).
 */
export function systemScale(contentSp, availSp, { isLast = false } = {}) {
	// Over-wide: the content cannot fit even unstretched → downscale the whole
	// system (glyphs included) so it fits; no advance stretch.
	if (contentSp > availSp && availSp > 0) {
		return { advanceScale: 1, downscaleFactor: availSp / contentSp };
	}
	// The last system stays ragged-right (no justify); fits as-is.
	if (isLast || contentSp <= 0) {
		return { advanceScale: 1, downscaleFactor: 1 };
	}
	// Justify by stretching whitespace (advances) only, capped at MAX_STRETCH.
	const raw = availSp / contentSp;
	const advanceScale = Math.min(Math.max(raw, 1), MAX_STRETCH);
	return { advanceScale, downscaleFactor: 1 };
}

// ── Full model assembly — buildLayoutModel ───────────────────────────────────────
//
// The single pure entry point. It walks the resolved sections, lays out each
// measure's two hands onto the union grid, packs measures into systems,
// and assembles the positioned-primitive model: systems → grand-staff bands
// → (staff lines, clefs, key sig, time sig, barlines, brace) + per-event primitives
// + spans (ties/slurs) + texts (dynamics, notes, tempo, measure numbers,
// ottava). Everything is in sp units — NO DOM, NO sp→px. Resize re-runs only the
// packing/justify because the per-measure intrinsic widths and pitch Ys are
// sp-relative invariants.

/**
 * Lay out one hand's events within a measure into positioned primitives at the
 * given per-onset column X map. Reuses the per-event geometry: chord
 * stacking, stems, beams (or flags), dots, accidentals, and ledger lines. All X are
 * relative to the measure's left edge; Y are relative to this staff's bottom line.
 *
 * @param {object[]} [events] The hand's events for this measure.
 * @param {Map<number, number>} columnX Onset → relative X within the measure.
 * @param {number[]} onsets This hand's per-event onsets (`handOnsets`).
 * @param {{ clef: string, alters: object }} ctx The hand's resolved context.
 * @param {object} [timeSignature] For beam grouping ONLY (never for positions).
 * @return {{ notes: object[], rests: object[], texts: object[] }} The hand's
 *   positioned primitives.
 */
function layoutHand(events, columnX, onsets, ctx, timeSignature) {
	const list = events ?? [];
	const normAlters = normalizeAlters(ctx.alters);
	const groups = beamGroups(list, timeSignature);
	// Map each event index to its beam group (so a grouped note draws no flag).
	const groupOf = new Map();
	for (const g of groups) {
		for (const idx of g.indices) {
			groupOf.set(idx, g);
		}
	}

	const notes = [];
	const rests = [];
	const texts = [];

	list.forEach((event, idx) => {
		const x = columnX.get(onsets[idx]) ?? 0;
		const dotCount = event?.dots ?? 0;

		if (event?.type === "rest") {
			rests.push({
				eventIndex: idx,
				x,
				duration: event.duration,
				dots: dotCount,
			});
			collectEventTexts(event, x, texts);
			return;
		}

		const pitches = Array.isArray(event?.pitches) ? event.pitches : [];
		const positions = pitches
			.map((p) => pitchToStaffStep(p, ctx.clef))
			.filter((s) => s !== null);
		if (positions.length === 0) {
			collectEventTexts(event, x, texts);
			return;
		}

		const decoded = decodeDuration(event.duration);
		const direction = stemDirectionForChord(positions);
		const heads = stackChord(positions, direction);

		// Accidentals: resolve per pitch, then column-stack the ones that draw.
		const accInputs = [];
		pitches.forEach((p, pi) => {
			const sFromBottom = positions[pi];
			if (sFromBottom === undefined) {
				return;
			}
			const { glyph } = resolveAccidental(p, normAlters);
			if (glyph) {
				accInputs.push({ sFromBottom, glyph });
			}
		});
		const accidentals = stackAccidentals(accInputs);

		// Ledger lines: the union over all chord noteheads (dedup by sFromBottom).
		const ledgerSet = new Map();
		for (const s of positions) {
			for (const l of ledgerLinesFor(s)) {
				ledgerSet.set(l.sFromBottom, l);
			}
		}
		const ledgers = [...ledgerSet.values()];

		// Dots: one per notehead (use the chord's positions).
		const dotSpecs = [];
		if (dotCount > 0) {
			for (const s of positions) {
				for (const d of dotPositions(s, dotCount)) {
					dotSpecs.push({ sFromBottom: s, dx: d.dx, y: d.y });
				}
			}
		}

		const group = groupOf.get(idx);
		const beamed = !!group && group.isBeam;

		notes.push({
			eventIndex: idx,
			x,
			duration: event.duration,
			dots: dotCount,
			notehead: decoded.notehead,
			hasStem: decoded.hasStem,
			direction,
			heads,
			// A note is either flagged or beamed, never both.
			flagCount: beamed ? 0 : decoded.flagCount,
			beamCount: decoded.beamCount,
			beamed,
			accidentals,
			ledgers,
			dotSpecs,
			topStep: Math.max(...positions),
			bottomStep: Math.min(...positions),
		});

		collectEventTexts(event, x, texts);
	});

	// Beam geometry per multi-note group (single-note groups draw a flag instead).
	const beams = [];
	for (const g of groups) {
		if (!g.isBeam) {
			continue;
		}
		const members = g.indices
			.map((idx) => {
				const note = notes.find((n) => n.eventIndex === idx);
				return note
					? {
							x: note.x,
							topStep: note.topStep,
							bottomStep: note.bottomStep,
							beamCount: note.beamCount,
						}
					: null;
			})
			.filter(Boolean);
		if (members.length >= 2) {
			beams.push({ indices: g.indices, ...beamGeometry(members) });
		}
	}

	return { notes, rests, beams, texts };
}

/**
 * Collect an event's per-event text primitives — a dynamic plus every author `note`
 * — at the event's column X. This is the locked contract the band model and the emit
 * layer route on; it computes NO Y and does NOT bucket by placement (that is done
 * later from this flat list).
 *
 * The dynamic (when present) pushes one `{ kind: "dynamic", x, text }`. Then each
 * element of `event.annotations` whose `text` is a NON-EMPTY string pushes exactly one
 * `{ kind: "annotation", x, text, placement }`, in array order — array order IS the
 * stacking order the later layers consume. Elements with an empty or absent `text`
 * push nothing; an absent or empty `notes` pushes no note primitives at all. The
 * routine is identical for a `note` and a `rest` event (the caller invokes it on
 * both), so a rest's `notes` are collected the same way at the rest's column X.
 *
 * @param {{ dynamic?: string, notes?: { text?: string, placement?: string }[] }}
 *   event The event. `dynamic` is the optional dynamic marking; `notes` is the
 *   optional array of author annotations, each `{ text, placement }`.
 * @param {number} x The event's relative column X (shared by every primitive pushed
 *   for this event), in sp.
 * @param {{ kind: string, x: number, text: string, placement?: string }[]} out The
 *   list this routine pushes primitives onto (mutated in place).
 */
export function collectEventTexts(event, x, out) {
	if (event?.dynamic) {
		out.push({ kind: "dynamic", x, text: event.dynamic });
	}
	for (const el of event?.annotations ?? []) {
		if (typeof el?.text === "string" && el.text.length > 0) {
			out.push({
				kind: "annotation",
				x,
				text: el.text,
				placement: el.placement,
			});
		}
	}
}

/**
 * Resolve a measure's standalone (measure-level) `notes` into positioned
 * primitives, computing each note's horizontal X by interpolating its `beat`
 * onset over the measure's SCALED relative column grid (the same `columnX` frame
 * the per-event notes carry), with an over-content clamp. It computes NO Y — the
 * band model places notes vertically later — and carries a RAW-`beat` group key
 * so later stacking groups by the raw beat, never the resolved X.
 *
 * Every X this produces is MEASURE-RELATIVE: the same frame as `ctx.columnX`
 * (which starts at `ctx.leadInset`, the content-left edge) and `ctx.scaledContent`
 * (the relative right edge, `= measureRightX − measure.x`). The caller therefore
 * emits the primitives under the measure's own `translate(measure.x 0)` group with
 * no `measure.x` subtraction.
 *
 * X resolution, all terms measure-relative:
 * - A note with no `beat` is treated as `beat: 0`, mapping to `ctx.leadInset`.
 * - For a `beat` value, `beatToX` finds the bracketing onsets `[t_i, t_next]` with
 *   `t_i ≤ beat < t_next` and lerps between their relative X positions, where the
 *   last column's far edge is `t_next = ctx.measureEnd` at X = `ctx.scaledContent`.
 *   A `beat` coinciding with an event column lands exactly at that column's X.
 * - Over-content clamp: `x = min(beatToX(min(beat, measureEnd)), scaledContent −
 *   NOTE_CLAMP_INSET)`, so a `beat` past the content (e.g. 99) is reined in to one
 *   `NOTE_CLAMP_INSET` inside the trailing barline.
 *
 * The group key is the RAW `beat` (pre-interpolation), stored as a precomputed
 * `group` string `` `${staff}|${placement}|${beat ?? "noBeat"}` ``. Two records
 * sharing `(staff, placement, raw beat ?? "noBeat")` share a `group`; a `beat: 2`
 * and a `beat: 2.0001` note (same staff/placement) get DIFFERENT groups, and two
 * distinct over-content beats that clamp to the same resolved X (e.g. `50` and
 * `99`) likewise stay distinct — grouping never reads the resolved X.
 *
 * Elements whose `text` is empty or absent push nothing.
 *
 * @param {{ text?: string, placement?: string, staff?: string, beat?: number }[]}
 *   [measureNotes] The measure's standalone notes. `text` is the annotation text;
 *   `placement` is `"above"`/`"below"`; `staff` is `"rightHand"`/`"leftHand"`;
 *   `beat` is the optional onset (quarter-beats) that anchors the X.
 * @param {{ columnX: Map<number, number>, gridOnsets: number[], measureEnd: number,
 *   leadInset: number, scaledContent: number }} ctx The measure's scaled relative
 *   geometry. `columnX` maps each onset to its scaled relative X; `gridOnsets` is
 *   the ascending onset list (the `columnX` keys in column order); `measureEnd` is
 *   the measure's content end in quarter-beats; `leadInset` is the content-left X;
 *   `scaledContent` is the relative right edge.
 * @return {{ kind: "annotation", x: number, text: string, placement?: string,
 *   staff?: string, group: string }[]} One record per non-empty-text note, in
 *   array order (= stacking order within a group).
 */
export function collectStandaloneAnnotations(measureNotes, ctx) {
	const { columnX, gridOnsets, measureEnd, leadInset, scaledContent } = ctx;

	// Interpolate a (measure-relative) X for a beat over the scaled column grid.
	const beatToX = (beat) => {
		if (gridOnsets.length === 0) {
			return leadInset;
		}
		// Before/at the first onset: hug the first column (normally onset 0 = leadInset).
		if (beat <= gridOnsets[0]) {
			return columnX.get(gridOnsets[0]) ?? leadInset;
		}
		// Find the bracketing segment [t_i, t_next). The last column's far edge is
		// `measureEnd` at X = `scaledContent`.
		for (let i = 0; i < gridOnsets.length; i++) {
			const ti = gridOnsets[i];
			const tNext = i + 1 < gridOnsets.length ? gridOnsets[i + 1] : measureEnd;
			const xi = columnX.get(ti) ?? leadInset;
			const nextX =
				i + 1 < gridOnsets.length ? columnX.get(tNext) : scaledContent;
			if (beat < tNext) {
				const span = tNext - ti || 1;
				return xi + (nextX - xi) * ((beat - ti) / span);
			}
		}
		// At/after the last onset's far edge: the relative right edge.
		return scaledContent;
	};

	const out = [];
	for (const el of measureNotes ?? []) {
		if (typeof el?.text !== "string" || el.text.length === 0) {
			continue;
		}
		const hasBeat = typeof el.beat === "number";
		const beat = hasBeat ? el.beat : 0;
		// Over-content clamp (both sides measure-relative): rein an over-content beat
		// to one NOTE_CLAMP_INSET inside the trailing barline.
		const x = Math.min(
			beatToX(Math.min(beat, measureEnd)),
			scaledContent - NOTE_CLAMP_INSET,
		);
		out.push({
			kind: "annotation",
			x,
			text: el.text,
			placement: el.placement,
			staff: el.staff,
			// Group by the RAW beat (absent ⇒ "noBeat"), never the resolved X.
			group: `${el.staff}|${el.placement}|${hasBeat ? el.beat : "noBeat"}`,
		});
	}
	return out;
}

/**
 * Build the FULL positioned-primitive layout model for a song — the single pure
 * entry point. Pure, DOM-free, sp-only: it returns
 * `{ systems }`, where each system carries its Y band layout, leading reserve
 * (brace + clefs + key sig + optional time sig), per-measure barlines, both hands'
 * per-event primitives + beams, the resolved spans (ties/slurs), and the texts
 * (tempo, measure number, dynamics, notes, ottava). Resize need only re-run
 * the packing/justify — the intrinsic widths and pitch Ys are sp-relative invariants.
 *
 * @param {{ defaults?: object, sections?: object[] }} song The parsed, conformant
 *   song (the validator is the gate upstream; this stays defensive but assumes
 *   conformant shape).
 * @param {number} availableWidthInSp The live container width, in staff spaces.
 * @return {{ systems: object[], width: number }} The layout model in sp units.
 */
export function buildLayoutModel(song, availableWidthInSp) {
	const budgetSp = Math.max(availableWidthInSp ?? 0, 0);
	const contexts = resolveSectionContexts(song);
	const sections = Array.isArray(song?.sections) ? song.sections : [];

	// ── Flatten every measure into a sequential list, tagging each with its
	// resolved context, the section diff (only the first measure of a section
	// carries the inline changes), and a sequential 1..N measure number. ──────────
	const flat = [];
	let measureNumber = 0;
	contexts.forEach((ctx, si) => {
		const prevCtx = si > 0 ? contexts[si - 1] : null;
		const diff = diffContext(ctx, prevCtx);
		const measures = Array.isArray(sections[si]?.measures)
			? sections[si].measures
			: [];
		measures.forEach((measure, mi) => {
			measureNumber += 1;
			flat.push({
				measure,
				ctx,
				sectionIndex: si,
				isSectionStart: mi === 0,
				diff: mi === 0 ? diff : null,
				number: measureNumber,
				isFirstOfScore: flat.length === 0,
			});
		});
	});

	// ── Per-measure intrinsic layout (content width + the grid), purely from
	// event durations (never the time signature). The leading reserve for a
	// measure that COULD start a system depends on its context + whether a time
	// signature prints there (system 1, or a section change). ─────────────────────
	const packing = flat.map((m, idx) => {
		const trailingPad = barlineTrailingPad(m.measure?.barlineEnd);
		const ml = measureLayout(m.measure?.rightHand, m.measure?.leftHand, {
			trailingPad,
		});
		// Two independent leading insets, both folded into the intrinsic width:
		// - sectionReserve: a mid-system section change's cautionary glyphs (clef/key/
		//   time), so the section's notes start after them;
		// - noteAccidentalLead: room for the opening note's accidental, when it has one,
		//   so the note can otherwise hug the measure's left edge.
		const sectionReserve =
			!m.isFirstOfScore && m.diff ? inlineReserveWidth(m) : 0;
		const noteAccidentalLead = firstColumnHasAccidental(m)
			? ACCIDENTAL_LEAD_EXTRA
			: 0;
		// A time signature prints at the very first system and wherever it changes.
		const withTimeSig = idx === 0 || (m.diff ? m.diff.timeSignature : false);
		const reserve = leadingReserveFor(
			m.ctx.rightHand,
			m.ctx.leftHand,
			withTimeSig,
		);
		m.sectionReserve = sectionReserve;
		m.noteAccidentalLead = noteAccidentalLead;
		m.layout = ml;
		// The full intrinsic width: the grid + trailing bar room (in ml.width) plus both
		// leading insets, which the system walk turns into real left-edge space.
		m.contentWidth = ml.width + sectionReserve + noteAccidentalLead;
		return { contentWidth: m.contentWidth, reserve };
	});

	// Pack against the budget MINUS the two staff margins, so the reserve +
	// measures always fit inside the inset staff lines.
	const systemRanges = packSystems(packing, budgetSp - 2 * STAFF_MARGIN_X);

	// ── Assemble each system. ─────────────────────────────────────────────────────
	const systems = [];
	let yCursor = 0;
	// Ties/slurs are matched across the WHOLE hand (across systems) and resolved to
	// laid-out positions after every measure has an absolute X. Each entry remembers
	// where a marker's note landed so a matched pair can be drawn between its actual
	// positions, clipped to system edges by the emit layer.
	const placedEvents = { rightHand: [], leftHand: [] };

	systemRanges.forEach((range, sysIdx) => {
		const isLastSystem = sysIdx === systemRanges.length - 1;
		const members = flat.slice(range.start, range.start + range.count);

		// The leading reserve uses the FIRST measure's context (the one restated at
		// the system head) and whether a time signature prints on this system.
		const head = members[0];
		const systemHasTimeSig =
			range.start === 0 || (head.diff ? head.diff.timeSignature : false);
		const reserve = leadingReserveFor(
			head.ctx.rightHand,
			head.ctx.leftHand,
			systemHasTimeSig,
		);
		// The content budget excludes the left/right staff margins and the
		// leading reserve. Measures live in [STAFF_MARGIN_X + reserve, budgetSp − STAFF_MARGIN_X].
		const availSp = Math.max(budgetSp - 2 * STAFF_MARGIN_X - reserve, 0);

		const contentSp = members.reduce((sum, m) => sum + m.contentWidth, 0);
		const { advanceScale, downscaleFactor } = systemScale(contentSp, availSp, {
			isLast: isLastSystem,
		});

		// ── Vertical band layout for this system (computed from content). ───────────
		// Four annotation bands flank the two staves — above/below each hand. Their
		// reserved stack heights FLEX three system anchors: the above-RH lane (and so
		// the top margin), the inter-staff gap (below-RH + above-LH stacks), and the
		// bottom margin (below-LH stack). Each flex collapses to today's base value when
		// its bands are empty, so a note-free system keeps its original geometry.
		//
		// One stack step (baseline-to-baseline) reuses the text-lane gap; the descent is
		// the depth a note glyph drops below its own baseline, kept inside the reserve.
		const STACK_STEP = NOTE_SIZE + TEXT_LANE_GAP;
		const DESCENT = 0.22 * NOTE_SIZE;
		// System-wide MAX same-anchor note count per band, plus per-hand below-staff
		// dynamics occupants. The below-staff dynamics region holds TWO independent
		// occupants a below note must clear: a point dynamic glyph (`dynamic`) and/or a
		// gradual-dynamic hairpin lane (a crescendo/decrescendo span). Either one present
		// for a hand means that hand's below band must dodge the region.
		const occ = bandOccupancy(members);
		const rhHasDynamics = systemHandHasDynamics(members, "rightHand");
		const lhHasDynamics = systemHandHasDynamics(members, "leftHand");
		const rhHasHairpin = systemHandHasHairpin(members, "rightHand");
		const lhHasHairpin = systemHandHasHairpin(members, "leftHand");
		// A below band hugs the staff at the dynamics reserve when its hand prints a
		// point dynamic OR carries a hairpin lane (dodging the whole below-staff dynamics
		// region — the dynamics row AND the hairpin lane), otherwise at the plain staff
		// gap. The reserve (DYNAMICS_LANE_RESERVE) exceeds the hairpin lane's lower edge
		// (HAIRPIN_LANE_DY + HAIRPIN_APERTURE / 2), so one reserve clears both occupants.
		const baseOffsetBelow = (hasBelowStaffDynamics) =>
			hasBelowStaffDynamics ? DYNAMICS_LANE_RESERVE : NOTE_GAP_STAFF;
		const belowRHBase = baseOffsetBelow(rhHasDynamics || rhHasHairpin);
		const belowLHBase = baseOffsetBelow(lhHasDynamics || lhHasHairpin);
		// Reserved outward depth of each band's stack, measured from the staff edge.
		// Zero (never negative) when the band has no notes.
		const stackDepth = (n, base) =>
			n > 0 ? base + (n - 1) * STACK_STEP + DESCENT : 0;
		const belowRHStack = stackDepth(occ.belowRH, belowRHBase);
		const belowLHStack = stackDepth(occ.belowLH, belowLHBase);
		// The above-LH stack grows up into the inter-staff gap; it never dodges dynamics.
		const aboveLHStack = stackDepth(occ.aboveLH, NOTE_GAP_STAFF);

		// The top margin flexes to only the text lanes actually present above the staff
		// (the above-RH note stack, an above-staff ottava, the tempo) stacked over the
		// ledger zone, so the staff and tempo drop close to the staff when there is
		// nothing above it. Each present lane's baseline Y comes back in system
		// coordinates; the above-RH lane reserves the full stack height.
		const top = topMarginLayout(members, ledgerTopExtent(members), occ.aboveRH);
		const topMargin = top.topMargin;
		const rhBottomY = topMargin + STAFF_HEIGHT_SP;

		// The inter-staff gap flexes to fit the below-RH and above-LH stacks (with a
		// mid-gap between them only when both are present), collapsing to the base gap
		// when neither is present.
		const bothInterStaff = occ.belowRH > 0 && occ.aboveLH > 0;
		const effectiveInterStaffGap = Math.max(
			INTRA_STAFF_GAP,
			belowRHStack + aboveLHStack + (bothInterStaff ? MID_GAP : 0),
		);
		const lhTopY = rhBottomY + effectiveInterStaffGap;
		const lhBottomY = lhTopY + STAFF_HEIGHT_SP;

		// The bottom margin flexes to the below-LH stack (over its ledgers), never below
		// today's base margin (also over its ledgers).
		const ledgerBottom = ledgerBottomExtent(members);
		const bottomMargin = Math.max(
			SYSTEM_BOTTOM_MARGIN + ledgerBottom,
			belowLHStack + ledgerBottom,
		);
		const systemHeight = lhBottomY + bottomMargin;

		const band = {
			topMargin,
			bottomMargin,
			rightStaffTopY: topMargin,
			rightStaffBottomY: rhBottomY,
			leftStaffTopY: lhTopY,
			leftStaffBottomY: lhBottomY,
			height: systemHeight,
			// Flexible text-lane baselines above the staff (system coordinates; a lane is
			// null when that element is absent from the system).
			tempoLaneY: top.tempoLaneY,
			ottavaAboveLaneY: top.ottavaAboveLaneY,
			annotationAboveRHLaneY: top.annotationAboveRHLaneY,
			// The four placement bands. Each carries the note #0 baseline (`baseY`,
			// hugging its staff at the band's base offset), the per-note `step`, and the
			// `direction` notes stack — "up" (toward smaller Y) for above-* bands,
			// "down" (toward larger Y) for below-* bands. Emit places note #k at
			// `baseY + (direction === "up" ? −1 : 1) * k * step`.
			bands: {
				aboveRH: {
					baseY: top.annotationAboveRHLaneY,
					step: STACK_STEP,
					direction: "up",
				},
				belowRH: {
					baseY: rhBottomY + belowRHBase,
					step: STACK_STEP,
					direction: "down",
				},
				aboveLH: {
					baseY: lhTopY - NOTE_GAP_STAFF,
					step: STACK_STEP,
					direction: "up",
				},
				belowLH: {
					baseY: lhBottomY + belowLHBase,
					step: STACK_STEP,
					direction: "down",
				},
			},
		};

		// ── Leading reserve content: brace + clefs + key sigs (+ time sig). ─────────
		// Each field is positioned from the previous field's REAL width — not a fixed
		// offset — so the clef, the key-signature cluster, and the time signature get
		// reserved, non-overlapping space whatever the alter count. The whole
		// head is inset by the left staff margin. These advances mirror
		// `leadingReserveFor`, so the measures (which start at STAFF_MARGIN_X + reserve)
		// begin exactly past the time signature.
		const headCtx = head.ctx;
		const rightCluster = keySignatureCluster(
			headCtx.rightHand.alters,
			headCtx.rightHand.clef,
			{ bottomLineY: rhBottomY },
		);
		const leftCluster = keySignatureCluster(
			headCtx.leftHand.alters,
			headCtx.leftHand.clef,
			{ bottomLineY: lhBottomY },
		);
		const maxClusterWidth = Math.max(rightCluster.width, leftCluster.width);
		const braceX = STAFF_MARGIN_X;
		const clefX = braceX + BRACE_WIDTH;
		const keySigX = clefX + CLEF_WIDTH;
		const timeSigX =
			keySigX +
			maxClusterWidth +
			(maxClusterWidth > 0 ? KEYSIG_TIMESIG_GAP : 0);
		const reserveModel = {
			width: reserve,
			brace: { x: braceX },
			clefs: {
				right: {
					glyph: clefGlyph(headCtx.rightHand.clef),
					clef: headCtx.rightHand.clef,
					x: clefX,
				},
				left: {
					glyph: clefGlyph(headCtx.leftHand.clef),
					clef: headCtx.leftHand.clef,
					x: clefX,
				},
			},
			keySig: { right: rightCluster, left: leftCluster, x: keySigX },
			timeSignature: systemHasTimeSig ? headCtx.timeSignature : null,
			timeSignatureX: timeSigX,
		};

		// ── Walk the measures, placing each at its absolute X. ──────────────────────
		// The first measure starts past the left margin AND the leading reserve.
		const measureModels = [];
		let x = STAFF_MARGIN_X + reserve;
		members.forEach((m, localIdx) => {
			const ml = m.layout;
			const ts = m.ctx.timeSignature;

			// The leading inset before the first column: a mid-system section change's
			// cautionary glyphs (at a system head the leading reserve restates
			// them, so none there) plus room for the opening note's accidental.
			const leadInset =
				(localIdx > 0 ? (m.sectionReserve ?? 0) : 0) +
				(m.noteAccidentalLead ?? 0);

			// The scaled grid width (advances stretched by justify) and the measure's
			// scaled content (the fixed leading inset, unscaled, plus the grid).
			const scaledGrid =
				(ml.contentWidth || EMPTY_MEASURE_WIDTH) * advanceScale;
			const scaledContent = leadInset + scaledGrid;

			// Columns sit left-to-right from the leading inset, so every measure's opening
			// note (a whole note included) starts near the left barline.
			const columnX = new Map();
			let cx = leadInset;
			ml.columns.forEach((col) => {
				columnX.set(col.onset, cx);
				cx += col.advance * advanceScale;
			});

			const right = layoutHand(
				m.measure?.rightHand,
				columnX,
				ml.hands.right.onsets,
				m.ctx.rightHand,
				ts,
			);
			const left = layoutHand(
				m.measure?.leftHand,
				columnX,
				ml.hands.left.onsets,
				m.ctx.leftHand,
				ts,
			);

			// The bar sits at the measure's content end (the last note already has its
			// natural advance of whitespace before it), and the next measure starts a full
			// BARLINE_POST_PAD past the bar so its first note clears the line.
			// This trailing room is already counted in the packing width
			// (`ml.width`), so honoring it here just turns reserved budget into real space.
			const endType = m.measure?.barlineEnd ?? "regular";
			const trailingPad = barlineTrailingPad(endType);

			// Right barline (always) at the content end; a left barline only for
			// repeat-start, and never on the score's very first measure.
			const measureRightX = x + scaledContent;
			const barlines = [];
			const startType = m.measure?.barlineStart;
			if (startType === "repeat-start" && !m.isFirstOfScore) {
				barlines.push({
					side: "start",
					type: startType,
					...barlineSpec(startType, x),
				});
			}
			barlines.push({
				side: "end",
				type: endType,
				...barlineSpec(endType, measureRightX),
			});

			// Inline section-change cautionary symbols at a mid-system section start.
			const inline =
				m.isSectionStart && localIdx > 0 && m.diff
					? inlineSectionChange(m, x)
					: null;

			// Measure-level standalone notes, X resolved by beat→column interpolation in
			// the same measure-relative frame as `columnX` (see collectStandaloneAnnotations).
			const standaloneAnnotations = collectStandaloneAnnotations(
				m.measure?.annotations,
				{
					columnX,
					gridOnsets: ml.columns.map((col) => col.onset),
					measureEnd: ml.measureEnd,
					leadInset,
					scaledContent,
				},
			);

			// Record tie/slur markers + the laid-out note X for span resolution.
			recordSpanMarkers(m.measure?.rightHand, right, {
				measureX: x,
				hand: "rightHand",
				placedEvents,
				staffBottomY: band.rightStaffBottomY,
				systemIndex: sysIdx,
			});
			recordSpanMarkers(m.measure?.leftHand, left, {
				measureX: x,
				hand: "leftHand",
				placedEvents,
				staffBottomY: band.leftStaffBottomY,
				systemIndex: sysIdx,
			});

			measureModels.push({
				number: m.number,
				x,
				width: scaledContent,
				isSectionStart: m.isSectionStart,
				right,
				left,
				barlines,
				inline,
				standaloneAnnotations,
			});

			// Advance past the full trailing room so the next measure clears the bar.
			x += scaledContent + trailingPad;
		});

		// ── System-level texts: tempo + measure number + ottava. ────────────────────
		const texts = buildSystemTexts(members, measureModels, band);

		systems.push({
			index: sysIdx,
			y: yCursor,
			height: systemHeight,
			width: budgetSp,
			// The staff lines span the inset content area, not the full box.
			staffStartX: STAFF_MARGIN_X,
			staffEndX: budgetSp - STAFF_MARGIN_X,
			advanceScale,
			downscaleFactor,
			band,
			reserve: reserveModel,
			measures: measureModels,
			texts,
			// Filled by the span-resolution pass below (after all measures are placed).
			spans: [],
		});

		yCursor += systemHeight * downscaleFactor + INTER_SYSTEM_GAP;
	});

	// ── Resolve ties/slurs into drawn spans between actual laid-out positions. ──────
	const spans = resolveAllSpans(placedEvents);
	for (const sp of spans) {
		const sys = systems[sp.systemIndex];
		if (sys) {
			// A cross-system span is filed under its start system only; clip it to that
			// system's staff end so it draws its start-system portion (a no-op for a
			// within-system span — see `clipSpanToStartSystem`).
			clipSpanToStartSystem(sp, sys.staffEndX);
			sys.spans.push(sp);
		}
	}

	return {
		systems,
		width: budgetSp,
		height: Math.max(yCursor - INTER_SYSTEM_GAP, 0),
	};
}

// ── buildLayoutModel helpers ────────────────────────────────────────────────────

/** The symbolic clef glyph name for a clef (alto + tenor share the C-clef). */
function clefGlyph(clef) {
	if (clef === "bass") {
		return "fClef";
	}
	if (clef === "alto" || clef === "tenor") {
		return "cClef";
	}
	return "gClef";
}

/**
 * The highest notehead position (largest `sFromBottom`) above the RH staff top
 * across a system's measures, converted to an extra top margin in sp. Drives the
 * per-system top margin so tall ledger stacks do not collide with the system above.
 * The RH staff top is `sFromBottom = 8`.
 */
function ledgerTopExtent(members) {
	let maxAbove = 8;
	for (const m of members) {
		for (const s of measureMaxRightSteps(m.measure)) {
			if (s > maxAbove) {
				maxAbove = s;
			}
		}
	}
	// Each staff-step above the top line is 0.5 sp; clamp to a non-negative extent.
	return Math.max(0, (maxAbove - 8) * 0.5);
}

/**
 * The lowest notehead position (smallest `sFromBottom`) below the LH staff bottom
 * across a system's measures, converted to an extra bottom margin in sp. The LH
 * staff bottom is `sFromBottom = 0` (in its own staff frame).
 */
function ledgerBottomExtent(members) {
	let minBelow = 0;
	for (const m of members) {
		for (const s of measureMinLeftSteps(m.measure)) {
			if (s < minBelow) {
				minBelow = s;
			}
		}
	}
	return Math.max(0, -minBelow * 0.5);
}

/** The RH chord notehead positions in a measure (for the top-extent scan). */
function measureMaxRightSteps(measure) {
	return handStepsFor(measure?.rightHand, "treble");
}

/** The LH chord notehead positions in a measure (for the bottom-extent scan). */
function measureMinLeftSteps(measure) {
	return handStepsFor(measure?.leftHand, "bass");
}

/** Every laid-out `sFromBottom` for a hand's notes (rests/unknowns skipped). */
function handStepsFor(events, clef) {
	const out = [];
	for (const e of events ?? []) {
		if (e?.type !== "note") {
			continue;
		}
		for (const p of e.pitches ?? []) {
			const s = pitchToStaffStep(p, clef);
			if (s !== null) {
				out.push(s);
			}
		}
	}
	return out;
}

/**
 * Whether either hand's FIRST event (the measure's opening onset) draws an accidental,
 * so the measure must reserve a little extra leading room for it. A leading
 * rest has no accidental; only an explicit `alter` or a key-sig default that resolves to
 * a glyph counts.
 *
 * @param {object} member The flattened measure entry (carries `measure` + `ctx`).
 * @return {boolean} True when the opening note of either hand shows an accidental.
 */
function firstColumnHasAccidental(member) {
	const handOpens = (events, ctx) => {
		const first = (events ?? [])[0];
		if (first?.type !== "note") {
			return false;
		}
		const normAlters = normalizeAlters(ctx.alters);
		return (first.pitches ?? []).some(
			(p) => resolveAccidental(p, normAlters).glyph !== null,
		);
	};
	return (
		handOpens(member.measure?.rightHand, member.ctx.rightHand) ||
		handOpens(member.measure?.leftHand, member.ctx.leftHand)
	);
}

/**
 * The horizontal room a mid-system section change consumes (clef + key sig + time
 * signature, only for the fields that changed) plus a trailing pad, in sp. Mirrors the
 * field advances of `inlineSectionChange` so the section's first note, inset by this
 * width, lands clear of the cautionary glyphs. Returns 0 when nothing visible
 * changes (e.g. a tempo-only change, which is drawn as a system text, not inline).
 *
 * @param {object} member The flattened measure entry (carries `ctx` + `diff`).
 * @return {number} The inline reserve width, in sp.
 */
function inlineReserveWidth(member) {
	const { ctx, diff } = member;
	let width = 0;
	if (diff.rightHand.clef || diff.leftHand.clef) {
		width += CLEF_WIDTH;
	}
	let maxClusterWidth = 0;
	if (diff.rightHand.alters) {
		maxClusterWidth = Math.max(
			maxClusterWidth,
			keySignatureCluster(ctx.rightHand.alters, ctx.rightHand.clef).width,
		);
	}
	if (diff.leftHand.alters) {
		maxClusterWidth = Math.max(
			maxClusterWidth,
			keySignatureCluster(ctx.leftHand.alters, ctx.leftHand.clef).width,
		);
	}
	if (maxClusterWidth > 0) {
		width += maxClusterWidth + KEYSIG_TIMESIG_GAP;
	}
	if (diff.timeSignature) {
		width += TIME_SIG_WIDTH;
	}
	return width > 0 ? width + RESERVE_PAD : 0;
}

/**
 * Each present field is positioned from the previous field's REAL width (clef →
 * key sig → time sig), so a multi-accidental change does not collide with the new
 * time signature — mirroring the system-head reserve.
 *
 * @param {object} member The flattened measure entry (carries `ctx` + `diff`).
 * @param {number} x The boundary measure's absolute left X, in sp.
 * @return {{ x: number, clefs: object, keySig: object, timeSignature: ?object,
 *   timeSignatureX: number }} The inline changes (empty sub-objects where nothing
 *   changed) with each field's absolute X.
 */
function inlineSectionChange(member, x) {
	const { ctx, diff } = member;
	let cursor = x;
	const clefs = {};
	if (diff.rightHand.clef) {
		clefs.right = {
			glyph: clefGlyph(ctx.rightHand.clef),
			clef: ctx.rightHand.clef,
			x: cursor,
		};
	}
	if (diff.leftHand.clef) {
		clefs.left = {
			glyph: clefGlyph(ctx.leftHand.clef),
			clef: ctx.leftHand.clef,
			x: cursor,
		};
	}
	if (clefs.right || clefs.left) {
		cursor += CLEF_WIDTH;
	}

	const keySig = { x: cursor };
	let maxClusterWidth = 0;
	if (diff.rightHand.alters) {
		keySig.right = keySignatureCluster(
			ctx.rightHand.alters,
			ctx.rightHand.clef,
		);
		maxClusterWidth = Math.max(maxClusterWidth, keySig.right.width);
	}
	if (diff.leftHand.alters) {
		keySig.left = keySignatureCluster(ctx.leftHand.alters, ctx.leftHand.clef);
		maxClusterWidth = Math.max(maxClusterWidth, keySig.left.width);
	}
	if (maxClusterWidth > 0) {
		cursor += maxClusterWidth + KEYSIG_TIMESIG_GAP;
	}

	return {
		x,
		clefs,
		keySig,
		timeSignature: diff.timeSignature ? ctx.timeSignature : null,
		timeSignatureX: cursor,
	};
}

/**
 * Record one measure's span markers + the laid-out geometry of each marked
 * note, into the per-hand cross-measure streams. Each entry keeps the
 * event's marker projections and the absolute anchor (X + a notehead Y + stem
 * direction + the current system index) so a matched pair can later be drawn between
 * its actual positions, even across barlines/systems.
 *
 * One entry is pushed per event, unconditionally — including rests/unplaceable notes
 * (`anchor: null`) and unmarked events (the per-kind marker is then `undefined`) — so
 * a hand's stream index never desyncs from its event index.
 *
 * Four marker projections are carried per entry, one per span kind: `tie`, `slur`,
 * `crescendo`, and `decrescendo`. The notehead-anchored arcs (tie/slur) read only the
 * notehead `anchor`; the flat below-staff hairpins (crescendo/decrescendo) cannot
 * reconstruct their lane from the pitch-dependent `anchor.y`, so each entry also
 * carries `laneY`, the precomputed per-hand below-staff lane center. Each entry also
 * carries the event's point `dynamic` (if any) so a hairpin beginning on that note can
 * clear the dynamic glyph rather than draw across it.
 *
 * @param {object[]} [events] The hand's events for this measure.
 * @param {{ notes: object[] }} laidOut The hand's laid-out primitives (`layoutHand`).
 * @param {{ measureX: number, hand: string, placedEvents: object,
 *   staffBottomY: number, systemIndex: number }} options The recording context.
 * @param {number} options.measureX The measure's absolute X (sp).
 * @param {string} options.hand The hand key (`"rightHand"` | `"leftHand"`).
 * @param {object} options.placedEvents The accumulating per-hand anchor streams,
 *   keyed by hand.
 * @param {number} options.staffBottomY This hand's staff bottom-line Y (sp); the
 *   below-staff lane Y is derived from it.
 * @param {number} options.systemIndex The current system index.
 */
export function recordSpanMarkers(events, laidOut, options) {
	const { measureX, hand, placedEvents, staffBottomY, systemIndex } = options;
	// The flat hairpin lane sits a fixed offset below this hand's staff bottom; it is
	// pitch-independent, so it is computed once per call and carried on every entry.
	const laneY = staffBottomY + HAIRPIN_LANE_DY;
	const list = events ?? [];
	list.forEach((event, idx) => {
		const note = laidOut.notes.find((n) => n.eventIndex === idx);
		// Anchor the span at the note's stem-side notehead Y (best-effort for chords:
		// the extreme notehead). Missing geometry (a rest, an unplaceable note) still
		// records the markers so matching never desyncs — it just has no anchor.
		let anchor = null;
		if (note) {
			const anchorStep =
				note.direction === "up" ? note.bottomStep : note.topStep;
			anchor = {
				x: measureX + note.x,
				y: staffBottomY + staffStepToY(anchorStep),
				direction: note.direction,
			};
		}
		placedEvents[hand].push({
			tie: event?.tie,
			slur: event?.slur,
			crescendo: event?.crescendo,
			decrescendo: event?.decrescendo,
			// The point dynamic on this event (if any); a hairpin starting here clears it.
			dynamic: event?.dynamic,
			anchor,
			systemIndex,
			laneY,
		});
	});
}

/**
 * Resolve every hand's span markers into drawn span specs between the actual
 * laid-out positions. Four kinds share one matcher: the notehead-anchored arcs
 * (`tie`/`slur`) and the flat below-staff wedges (`crescendo`/`decrescendo`). Each
 * kind gets its own fully independent per-hand stack via `matchSpans` on the hand's
 * cross-measure stream; a dangling start/stop or double-start is dropped (never
 * throws). After the shared rest-anchor guard, each pair is dispatched by kind:
 * tie/slur build a Bézier arc spec (`buildSpanSpec`), crescendo/decrescendo build a
 * flat-lane wedge record (`buildHairpinSpec`). Every resolved span carries the
 * system it belongs to (the start's system) and a `crossSystem` flag the
 * post-resolution clip reads.
 *
 * @param {{ rightHand: object[], leftHand: object[] }} placedEvents The per-hand
 *   placed-anchor streams.
 * @return {object[]} The resolved span specs (Bézier arcs and/or wedge records).
 */
function resolveAllSpans(placedEvents) {
	const spans = [];
	for (const hand of HANDS) {
		const stream = placedEvents[hand];
		const handSpans = [];
		for (const kind of ["tie", "slur", "crescendo", "decrescendo"]) {
			const projected = stream.map((e) => ({ marker: e[kind] }));
			const pairs = matchSpans(projected);
			for (const pair of pairs) {
				const start = stream[pair.startIndex];
				const stop = stream[pair.stopIndex];
				// Both anchors must have landed to draw between real positions; a
				// missing anchor (rest/unplaceable) is skipped, never thrown on.
				if (!start.anchor || !stop.anchor) {
					continue;
				}
				// Notehead-anchored arcs vs. flat below-staff wedges diverge only here:
				// the wedge ignores the notehead Y and stem side and rides a flat lane.
				if (kind === "crescendo" || kind === "decrescendo") {
					handSpans.push(buildHairpinSpec(kind, start, stop, hand));
				} else {
					handSpans.push(buildSpanSpec(kind, start, stop, hand));
				}
			}
		}
		// Insert the messa-di-voce gap before the hand's wedges leave this scope.
		insetHingeGap(handSpans);
		spans.push(...handSpans);
	}
	return spans;
}

/**
 * The Bézier geometry for one resolved span. A tie arcs clear of the
 * noteheads — its endpoints sit a notehead's clearance ABOVE or BELOW the heads (on
 * the side opposite the stem), never through their centers — bulging
 * further in that same direction. A slur is a longer arc OVER the phrase (above the
 * stems). The same quadratic-Bézier primitive serves both; only the reach, side, and
 * bulge differ.
 *
 * @param {"tie"|"slur"} kind The span kind.
 * @param {{ anchor: object }} start The start anchor.
 * @param {{ anchor: object }} stop The stop anchor.
 * @param {string} hand The hand key.
 * @return {object} The span spec (endpoints + control point + the start system).
 */
function buildSpanSpec(kind, start, stop, hand) {
	const a = start.anchor;
	const b = stop.anchor;
	// Both ties AND slurs anchor at the note's horizontal CENTER, not its
	// edges, and sit on the side OPPOSITE the start note's stem — stem up → below the
	// heads (sign +1, downward), stem down → above (sign −1, upward). The endpoints are
	// offset clear of the noteheads and the control bulges further so the whole arc
	// stays off the heads; a slur (a phrase) bulges more than a tie (two notes).
	const sign = a.direction === "up" ? 1 : -1;
	const bulge = kind === "slur" ? 2.1 : 1.3;
	const x1 = a.x;
	const x2 = b.x;
	const y1 = a.y + sign * TIE_NOTE_CLEARANCE;
	const y2 = b.y + sign * TIE_NOTE_CLEARANCE;
	const cy = (y1 + y2) / 2 + sign * bulge;
	return {
		kind,
		hand,
		systemIndex: start.systemIndex,
		x1,
		y1,
		x2,
		y2,
		cx: (x1 + x2) / 2,
		cy,
		// True when the pair spans two systems: the emit layer clips to system edges.
		crossSystem: start.systemIndex !== stop.systemIndex,
	};
}

/**
 * The flat-lane geometry for one resolved gradual-dynamic span — a hairpin wedge
 * (`<` for a crescendo, `>` for a decrescendo). Unlike the tie/slur arc, a wedge is
 * a horizontal lane element: it rides a FLAT below-staff lane Y (the carried,
 * pitch-independent `start.laneY`), constant across the whole span, so it ignores
 * both the notehead Y (`anchor.y`) and the stem side (`anchor.direction`). The
 * open-mouth height is the fixed constant `HAIRPIN_APERTURE` — never derived from
 * the span width — so a degenerate near-zero-width span (`x1 ≈ x2`) stays finite
 * (the builder never divides by `x2 - x1`). The opening-vs-closing shape itself is
 * produced at emit time from `kind`; this record only carries the lane geometry.
 *
 * When the start note also carries a point dynamic, the wedge would otherwise begin
 * across the dynamic glyph (both share the below-staff dynamics line). The start X is
 * therefore shifted right to clear the dynamic — past an estimate of the glyph's
 * half-width plus `HAIRPIN_DYNAMIC_GAP` — so the two read as one line, the dynamic
 * then the hairpin (standard engraving). The shift is clamped to the end X for a
 * within-system span so the wedge never runs backwards; a cross-system span keeps the
 * shifted start and lets the later staff-end clip trim the right edge.
 *
 * @param {"crescendo"|"decrescendo"} kind The wedge direction.
 * @param {{ anchor: { x: number }, laneY: number, systemIndex: number,
 *   dynamic?: string }} start The start anchor; `anchor.x` is the start note's
 *   horizontal center, `laneY` this hand's flat below-staff lane center, and
 *   `dynamic` the point dynamic on the start note (if any).
 * @param {{ anchor: { x: number }, systemIndex: number }} stop The stop anchor;
 *   `anchor.x` is the end note's horizontal center.
 * @param {string} hand The hand key (`"rightHand"` | `"leftHand"`).
 * @return {{ kind: string, hand: string, systemIndex: number, x1: number,
 *   x2: number, yCenter: number, aperture: number, crossSystem: boolean }} The
 *   wedge record: endpoints `x1`/`x2` (start cleared past any dynamic), the flat lane
 *   `yCenter`, the constant `aperture`, the start system, and whether the pair
 *   crosses systems.
 */
export function buildHairpinSpec(kind, start, stop, hand) {
	const crossSystem = start.systemIndex !== stop.systemIndex;
	let x1 = start.anchor.x;
	if (start.dynamic) {
		// Clear the center-anchored dynamic glyph: shift past its half-width + a gap.
		const halfWidth =
			(start.dynamic.length * DYNAMIC_ADVANCE_EM * DYNAMIC_SIZE) / 2;
		x1 = start.anchor.x + halfWidth + HAIRPIN_DYNAMIC_GAP;
		// Within a system, never let the cleared start run past the end (degenerate-safe);
		// cross-system keeps the shift — the staff-end clip sets the right edge later.
		if (!crossSystem) {
			x1 = Math.min(x1, stop.anchor.x);
		}
	}
	return {
		kind,
		hand,
		systemIndex: start.systemIndex,
		// The note horizontal centers, the same `measureX + note.x` value tie/slur use
		// (the start cleared past any point dynamic on its note).
		x1,
		x2: stop.anchor.x,
		// The flat per-hand below-staff lane Y, constant across the span (carried from
		// recording so it survives even though the notehead Y cannot reconstruct it).
		yCenter: start.laneY,
		// A fixed constant, never width-derived → degenerate-safe (no division).
		aperture: HAIRPIN_APERTURE,
		// True when the pair spans two systems: the layout clip trims to system edges.
		crossSystem,
	};
}

/**
 * Insert the light messa-di-voce gap between a crescendo and a decrescendo that meet
 * on a shared hinge note. The hinge is a single note carrying both `crescendo: "stop"`
 * and `decrescendo: "start"`, so the crescendo's open tip (`x2`) and the decrescendo's
 * open mouth (`x1`) land on the same note X. Without a gap the two `<`/`>` mouths touch;
 * this insets each by half of `HAIRPIN_HINGE_GAP` so a small space shows.
 *
 * Operates in place on one hand's resolved spans (a hand's note X values are unique, so
 * a coincident crescendo-`x2` / decrescendo-`x1` is necessarily that hand's hinge). Each
 * inset is clamped so neither wedge is pushed backwards past its other end.
 *
 * @param {object[]} handSpans One hand's resolved span records (arcs and/or wedges).
 */
function insetHingeGap(handSpans) {
	const half = HAIRPIN_HINGE_GAP / 2;
	for (const cres of handSpans) {
		if (cres.kind !== "crescendo") {
			continue;
		}
		for (const dec of handSpans) {
			if (dec.kind !== "decrescendo" || Math.abs(cres.x2 - dec.x1) > 1e-6) {
				continue;
			}
			cres.x2 = Math.max(cres.x1, cres.x2 - half);
			dec.x1 = Math.min(dec.x2, dec.x1 + half);
		}
	}
}

/**
 * Clip a resolved span to its start system's staff end, in place, so a cross-system
 * span draws only its start-system portion. v1 files the whole span under its start
 * system and drops the continuation, so a span whose end note landed on a later
 * system has an `x2` that is a FOREIGN-frame X (a system-local coordinate from a
 * different system) — meaningless in the start system's frame and a garbage stroke if
 * drawn. The right edge is therefore set to the start system's own `staffEndX`; the
 * foreign `x2` is never consulted.
 *
 * The clip is a STRICT no-op for a within-system span (`crossSystem === false`): it
 * returns the record untouched, so within-system tie/slur and hairpin output is
 * provably unchanged. It is degenerate-safe (never strokes backwards): the right edge
 * is `max(x1, staffEndX)`, so a start already at/past the staff end collapses to a
 * finite zero-width span rather than reversing. It adjusts HORIZONTAL coordinates only
 * — it never touches any Y:
 *
 * - A hairpin wedge rides a FLAT lane Y (`yCenter`) constant across the whole span,
 *   so clamping `x2` alone yields a fully correct start-system clip (the clipped
 *   wedge stays on the lane it started on).
 * - A tie/slur arc gets `x2` clamped and its Bézier control X recomputed to the new
 *   midpoint (`cx = (x1 + x2) / 2`, the same rule `buildSpanSpec` uses) so the arc
 *   terminates at the new right edge rather than aiming at a foreign X. Its `y2`/`cy`
 *   derive from the end note's notehead Y on the foreign end system and are
 *   deliberately LEFT unchanged: the clipped arc terminates at a foreign vertical
 *   position, an accepted v1 best-effort (draw the start-system portion, drop the
 *   continuation). No start-system-local vertical re-projection is attempted.
 *
 * @param {object} span The resolved span record (mutated in place when clipped). A
 *   wedge carries `{ x1, x2, crossSystem, ... }`; a tie/slur arc additionally carries
 *   `{ cx, y2, cy, ... }`.
 * @param {number} staffEndX The start system's staff-end X (`budgetSp - STAFF_MARGIN_X`).
 * @return {object} The same span record — untouched when within-system, else clipped.
 */
export function clipSpanToStartSystem(span, staffEndX) {
	if (!span.crossSystem) {
		return span;
	}
	// The end note lives on a later system, so `span.x2` is a coordinate in THAT
	// system's frame — meaningless in the start system's frame and not to be consulted.
	// The start-system right edge is the start system's own staff end. Clamp up from x1
	// so a start already at/past the staff end collapses to a finite zero-width span
	// (never a backwards stroke) rather than reversing.
	const rightX = Math.max(span.x1, staffEndX);
	span.x2 = rightX;
	// A tie/slur arc carries a Bézier control X (a wedge does not); re-center it on the
	// clipped span so the arc lands on the new right edge, not the old foreign midpoint.
	if (typeof span.cx === "number") {
		span.cx = (span.x1 + span.x2) / 2;
	}
	return span;
}

/**
 * Whether a system carries any text that needs a dedicated lane above the staff — a
 * tempo mark (score start or a tempo change) or an above-staff ottava (a positive
 * `octaveShift` in either hand). Drives the deeper top margin.
 *
 * @param {object[]} members The system's flattened measure entries.
 * @return {boolean} True when a tempo or above-staff ottava prints on this system.
 */
function systemHasTempo(members) {
	return members.some(
		(m) =>
			(m.isFirstOfScore || (m.diff ? m.diff.tempo : false)) &&
			!!tempoMark(m.ctx.tempo),
	);
}

/** Whether any measure in this system carries an above-staff (positive) octave shift. */
function systemHasOttavaAbove(members) {
	return members.some(
		(m) => m.ctx.rightHand.octaveShift > 0 || m.ctx.leftHand.octaveShift > 0,
	);
}

/** Whether a `notes` element carries drawable text (a non-empty string). */
function noteHasText(n) {
	return typeof n?.text === "string" && n.text.length > 0;
}

/** The hand key (`rightHand`/`leftHand`) each staff name maps to, for bucketing. */
const STAFF_TO_HAND = { rightHand: "rightHand", leftHand: "leftHand" };

/**
 * The four placement-band occupancy for a system: for each band keyed by
 * `(hand, placement)`, the system-wide MAXIMUM number of same-placement notes that
 * stack at any single anchor. Both per-event notes and the measure-level standalone
 * notes feed the count; a band's presence is simply `n > 0`.
 *
 * Anchors group notes that share a stacking column:
 * - A per-event note's anchor is `(event, placement)` — every drawable note in one
 *   event's `notes` array with the same placement stacks at that event's column.
 * - A standalone note's anchor is `(staff, placement, raw beat ?? "noBeat")` — the
 *   same key `collectStandaloneAnnotations` groups by, so two notes at the same raw beat,
 *   staff, and placement stack together (and a `beat: 2` vs `beat: 2.0001` do not).
 *
 * @param {object[]} members The system's flattened measure entries (carry `measure`).
 * @return {{ aboveRH: number, belowRH: number, aboveLH: number, belowLH: number }}
 *   The per-band system-wide max stack counts (0 when the band is empty).
 */
function bandOccupancy(members) {
	const max = { aboveRH: 0, belowRH: 0, aboveLH: 0, belowLH: 0 };
	const bandKey = (hand, placement) => {
		const side = placement === "below" ? "below" : "above";
		const handPart = hand === "leftHand" ? "LH" : "RH";
		return `${side}${handPart}`;
	};
	const bump = (key, count) => {
		if (count > max[key]) {
			max[key] = count;
		}
	};

	for (const m of members) {
		// Per-event notes: one anchor per (event, placement), counting drawable notes.
		for (const hand of HANDS) {
			for (const e of m.measure?.[hand] ?? []) {
				let above = 0;
				let below = 0;
				for (const n of e?.annotations ?? []) {
					if (!noteHasText(n)) {
						continue;
					}
					if (n.placement === "below") {
						below += 1;
					} else {
						above += 1;
					}
				}
				if (above > 0) {
					bump(bandKey(hand, "above"), above);
				}
				if (below > 0) {
					bump(bandKey(hand, "below"), below);
				}
			}
		}
		// Standalone notes: one anchor per (staff, placement, raw beat ?? "noBeat").
		const counts = new Map();
		for (const n of m.measure?.annotations ?? []) {
			if (!noteHasText(n)) {
				continue;
			}
			const hand = STAFF_TO_HAND[n.staff];
			if (!hand) {
				continue;
			}
			const side = n.placement === "below" ? "below" : "above";
			const hasBeat = typeof n.beat === "number";
			const groupKey = `${hand}|${side}|${hasBeat ? n.beat : "noBeat"}`;
			counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1);
		}
		for (const [groupKey, count] of counts) {
			const [hand, side] = groupKey.split("|");
			bump(bandKey(hand, side), count);
		}
	}
	return max;
}

/**
 * Whether any event in this system's measures for the given hand carries a dynamic
 * marking. Drives the per-hand below-band base offset: a below note dodges the
 * dynamics row only when its own hand prints dynamics.
 *
 * @param {object[]} members The system's flattened measure entries.
 * @param {string} hand The hand key (`rightHand` | `leftHand`).
 * @return {boolean} True when any event of this hand in the system carries a dynamic.
 */
function systemHandHasDynamics(members, hand) {
	return members.some((m) =>
		(m.measure?.[hand] ?? []).some((e) => !!e?.dynamic),
	);
}

/**
 * Whether any event in this system's measures for the given hand carries a gradual-
 * dynamic (crescendo/decrescendo) marker — i.e. the hand has a hairpin lane occupant.
 * The hairpin lane lives in the same below-staff dynamics region as point dynamics, so
 * this drives the per-hand below-band dodge alongside `systemHandHasDynamics`: a below
 * note dodges the region when its hand has either a point dynamic or a hairpin.
 *
 * Any single crescendo/decrescendo marker (`start` OR `stop`) in the hand's stream is
 * enough — the lane is present wherever a wedge is drawn or carried, and the dodge is a
 * per-system reservation (a dangling start/stop is still drawn best-effort and so still
 * occupies the lane within this system).
 *
 * @param {object[]} members The system's flattened measure entries.
 * @param {string} hand The hand key (`rightHand` | `leftHand`).
 * @return {boolean} True when any event of this hand in the system carries a hairpin marker.
 */
function systemHandHasHairpin(members, hand) {
	return members.some((m) =>
		(m.measure?.[hand] ?? []).some((e) => !!e?.crescendo || !!e?.decrescendo),
	);
}

/**
 * The flexible top-margin layout for a system. Only the lanes actually
 * present are stacked above the high-note/ledger zone — the above-RH note lane
 * nearest the staff, then an above-staff ottava, then the tempo at the very top — so
 * when there is nothing above the staff the margin (and the tempo) drop close to it.
 * The above-RH lane reserves height for the WHOLE stack (every same-anchor note),
 * not just one line, so a deep above-RH stack lifts the lanes (and the margin) above
 * it. Returns the staff's top margin plus each present lane's baseline Y in
 * system-local coordinates (null when that lane is absent).
 *
 * @param {object[]} members The system's flattened measure entries.
 * @param {number} ledgerTop The high-note/ledger extent above the staff top, in sp.
 * @param {number} aboveRHCount The system-wide MAX above-RH same-anchor note count,
 *   so the lane reserves `(n − 1)` extra stack steps above its baseline (0 ⇒ no lane).
 * @return {{ topMargin: number, annotationAboveRHLaneY: ?number, ottavaAboveLaneY: ?number,
 *   tempoLaneY: ?number }} The top margin and lane baselines.
 */
function topMarginLayout(members, ledgerTop, aboveRHCount) {
	// One above-RH stack step (baseline-to-baseline), so the lane reserves the full
	// stack rather than a single line.
	const stackStep = NOTE_SIZE + TEXT_LANE_GAP;
	// The innermost reserved zone above the staff top holds whatever already lives
	// there: the high notes/ledgers AND the system's measure number (drawn just above
	// the top line at the left). The stacked text lanes clear both so the tempo never
	// drops onto the measure number when little else is above the staff. Measure 1 is
	// never numbered, so a system that starts there reserves no number room.
	const showsMeasureNumber = members[0]?.number !== 1;
	const innerZone = Math.max(
		ledgerTop,
		showsMeasureNumber ? MEASURE_NUMBER_SIZE + 1 : 0,
	);
	// Distances ABOVE the staff top line (positive = up); each present lane stacks out.
	let d = innerZone + ABOVE_STAFF_PAD;
	let topExtent = innerZone;
	let annotationAboveRHD = null;
	let ottavaD = null;
	let tempoD = null;
	if (aboveRHCount > 0) {
		annotationAboveRHD = d;
		// The lane's baseline is note #0; the stack grows UP, so the topmost note's
		// glyph reaches `(n − 1)` steps higher plus its own ascent.
		topExtent = d + (aboveRHCount - 1) * stackStep + NOTE_SIZE;
		d = topExtent + TEXT_LANE_GAP;
	}
	if (systemHasOttavaAbove(members)) {
		ottavaD = d;
		topExtent = d + OTTAVA_SIZE;
		d = topExtent + TEXT_LANE_GAP;
	}
	if (systemHasTempo(members)) {
		tempoD = d;
		topExtent = d + TEMPO_SIZE;
		d = topExtent + TEXT_LANE_GAP;
	}
	const topMargin = Math.max(SYSTEM_TOP_MARGIN, topExtent + ABOVE_STAFF_PAD);
	const at = (dist) => (dist === null ? null : topMargin - dist);
	return {
		topMargin,
		annotationAboveRHLaneY: at(annotationAboveRHD),
		ottavaAboveLaneY: at(ottavaD),
		tempoLaneY: at(tempoD),
	};
}

/**
 * Build a system's text primitives: the tempo marks + the measure number, plus the
 * ottava brackets.
 *
 * - **Tempo** prints above the first measure of the section at the song start and at
 *   any tempo change — so it is emitted at every measure in this system that is a
 *   section start whose diff marks `tempo` changed (and always at the score start).
 * - **Measure number** sits above-left of the system's first measure (sequential
 *   1..N across the whole song, never reset by section boundaries).
 * - **Ottava** is restated per wrapped system: for each hand, one bracket per
 *   contiguous run of this system's measures sharing a non-zero `octaveShift`,
 *   spanning that run's notes (the bracket is a marking, not a vertical move).
 *
 * @param {object[]} members The system's flattened measure entries.
 * @param {object[]} measureModels The system's positioned measure models.
 * @param {object} band The system's band Y layout.
 * @return {{ tempos: object[], measureNumber: object, ottavas: object[] }} The texts.
 */
function buildSystemTexts(members, measureModels, band) {
	const head = members[0];

	// Tempo: at the score start and at any in-system tempo change (a section start
	// whose diff marks tempo changed). Each prints above its measure's left edge.
	const tempos = [];
	members.forEach((m, i) => {
		const isScoreStart = m.isFirstOfScore;
		const isTempoChange = m.diff ? m.diff.tempo : false;
		if ((isScoreStart || isTempoChange) && m.ctx.tempo) {
			const mark = tempoMark(m.ctx.tempo);
			if (mark) {
				tempos.push({
					...mark,
					// The tempo prints at its measure's left edge (the score-start one
					// over the first measure, just past the leading reserve).
					x: measureModels[i].x,
					// Topmost lane, above the note zone.
					y: band.tempoLaneY,
				});
			}
		}
	});

	// Measure 1 is conventionally left un-numbered (its number is obvious), so a system
	// that opens the piece shows no number; every later system labels its first measure.
	const measureNumber =
		head.number === 1
			? null
			: {
					text: String(head.number),
					// Above-left of the first measure, never left of the staff margin.
					x: Math.max(measureModels[0].x - 1, STAFF_MARGIN_X),
					y: band.rightStaffTopY - 1,
				};

	// Ottava: per hand, one bracket per contiguous run sharing a non-zero shift.
	const ottavas = [];
	for (const hand of HANDS) {
		let run = null;
		const flush = () => {
			if (!run) {
				return;
			}
			const ott = ottavaFor(run.shift);
			if (ott && run.xs.length > 0) {
				const staffBottomY =
					hand === "rightHand" ? band.rightStaffBottomY : band.leftStaffBottomY;
				ottavas.push({
					hand,
					label: ott.label,
					placement: ott.placement,
					x1: Math.min(...run.xs) - NOTEHEAD_RX,
					x2: Math.max(...run.xs) + NOTEHEAD_RX,
					// Above: its own lane below the tempo and above the notes.
					// Below: in the bottom margin, clear of low ledgers.
					y:
						ott.placement === "above"
							? band.ottavaAboveLaneY
							: staffBottomY + 2,
				});
			}
			run = null;
		};
		members.forEach((m, i) => {
			const shift = m.ctx[hand].octaveShift;
			if (!shift) {
				flush();
				return;
			}
			if (!run || run.shift !== shift) {
				flush();
				run = { shift, xs: [] };
			}
			const laid =
				hand === "rightHand" ? measureModels[i].right : measureModels[i].left;
			for (const n of laid.notes) {
				run.xs.push(measureModels[i].x + n.x);
			}
		});
		flush();
	}

	return { tempos, measureNumber, ottavas };
}
