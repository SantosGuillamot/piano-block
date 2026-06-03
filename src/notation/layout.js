/**
 * The PURE layout layer — the per-event musical geometry that turns a song's
 * notes into positioned plain data in staff-space (sp) units (design §5.2, §6.1,
 * §6.4). This module has NO DOM, NO sp→px scaling, and NO font logic: it only
 * computes numbers and plain-data records the thin emit layer (`svg.js`, T7)
 * later turns into SVG.
 *
 * This is part 1 of the layer (T4): pitch→staff position with ledger lines,
 * duration decoding (notehead / stem / flag / dots), best-effort beaming, chord
 * stacking, and stateless accidental resolution. It is extended in T5 (union-grid
 * alignment + compressive spacing) and T6 (section diff + system wrapping + the
 * full `buildLayoutModel` entry point), so it is structured as a set of small,
 * individually-exported pure functions the later parts can build on.
 *
 * Staff-step model (design §5.1): one staff-step = one line-or-space = 0.5 sp in
 * Y. `sFromBottom` numbers positions from the bottom staff line (0) up to the top
 * line (8): lines sit at even values (0/2/4/6/8), spaces at odd (1/3/5/7). Y
 * increases downward (SVG default), so higher pitch ⇒ smaller Y. The bottom line
 * is the Y origin here (`bottomLineY = 0`); the emit layer offsets each system.
 */

import { normalizeStep } from "../song/normalizeStep.js";
import {
	ACCIDENTAL_COL_STEP,
	ACCIDENTAL_GAP,
	ADV_K,
	BASE_DUR,
	BEAM_COUNT,
	DOT_GAP,
	DOT_MUL,
	DOT_OFFSET,
	EMPTY_MEASURE_WIDTH,
	LEDGER_WIDTH,
	MIN_ADV,
	NOTEHEAD_RX,
	STEM_LENGTH,
} from "./constants.js";
import { ACCIDENTAL_GLYPHS } from "./glyphs.js";

// ── Pitch → staff position (design §5.2) ───────────────────────────────────────

/**
 * Diatonic step index on the canonical letter: C=0 D=1 E=2 F=3 G=4 A=5 B=6
 * (design §5.2). Keyed by the canonical UPPERCASE English letter `normalizeStep`
 * returns.
 */
const STEP_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/**
 * Per-clef reference pitch and its `sFromBottom` (design §5.2). Each entry pins
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
 * the same letter (design §5.2/§6.5). Returns `null` for an unrecognised token.
 *
 * @param {string} step The note-name token (English letter or Spanish solfège).
 * @return {?number} The diatonic step index 0..6, or `null` if unrecognised.
 */
export function stepIndex(step) {
	const letter = normalizeStep(step);
	return letter === null ? null : STEP_INDEX[letter];
}

/**
 * The diatonic index on the unified scale: `octave * 7 + stepIndex` (design
 * §5.2). Middle C = C4 = 28. Placement uses ONLY step + octave, never `alter`.
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
 * The staff position of a pitch as `sFromBottom` (design §5.2):
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
 * staff line (design §5.1/§5.2). One staff-step = 0.5 sp, Y grows downward, so a
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
 * The ledger-line specs for a notehead at `sFromBottom` (design §5.2). A ledger
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

// ── Durations → noteheads / stems / flags / dots (design §6.1) ──────────────────

/** The middle line of the staff in `sFromBottom` terms (design §6.1). */
const MIDDLE_LINE = 4;

/**
 * Decode a duration string into its drawing primitives (design §6.1):
 *
 * - `whole` → open notehead, NO stem, no flags;
 * - `half` → open notehead, stem, no flags;
 * - `quarter` and shorter → filled notehead, stem;
 * - `eighth`/`sixteenth`/`thirty-second` → `flagCount` 1/2/3 (drawn only when the
 *   note is NOT beamed — a note is either flagged or beamed, never both).
 *
 * @param {string} duration The note value.
 * @return {{ notehead: "open"|"filled", hasStem: boolean, flagCount: number,
 *   beamCount: number }} The decoded primitives. `beamCount` is the §6.1
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
 * eighth or shorter (design §6.1). Rests and quarter-or-longer notes are never
 * beamed.
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
 * thirty-second 3; 0 otherwise) — the §6.1 `beamCount`.
 *
 * @param {string} duration The note value.
 * @return {number} The beam/flag count.
 */
export function beamCountFor(duration) {
	return BEAM_COUNT[duration] ?? 0;
}

/**
 * The stem direction for a single notehead: `sFromBottom < 4` → up, `≥ 4` → down
 * (a note ON the middle line stems down) (design §6.1).
 *
 * @param {number} sFromBottom The notehead position.
 * @return {"up"|"down"} The stem direction.
 */
export function stemDirectionForStep(sFromBottom) {
	return sFromBottom < MIDDLE_LINE ? "up" : "down";
}

/**
 * The stem direction for a set of chord positions: chosen by the note FARTHEST
 * from the middle line (`max |sFromBottom − 4|`); ties resolve to DOWN (design
 * §6.1). A single note is the one-element case of this rule.
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
	// where maxDist may be 0) defer to DOWN per the §6.1 tie rule.
	return farthestBelow && !farthestAbove ? "up" : "down";
}

/**
 * The augmentation-dot positions for a notehead (design §6.1). Dots sit to the
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

// ── Chord stacking + the seconds rule (design §6.1) ─────────────────────────────

/**
 * Lay out a chord's noteheads on a shared stem (design §6.1). Each notehead sits
 * at its §5.2 Y; the seconds rule displaces a note that is a diatonic second
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

// ── Best-effort beaming (design §6.1) ──────────────────────────────────────────

/**
 * The duration of an event in quarter-beats: `BASE_DUR[duration] × DOT_MUL[dots]`
 * (design §6.1/§6.2) — the same arithmetic the horizontal spacing reuses. Unknown
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
 * The grouping beat length, in quarter-beats, derived from the time signature FOR
 * GROUPING ONLY (design §6.1). Compound (`beatType ∈ {8,16}` AND `beats % 3 == 0`,
 * e.g. 6/8, 9/8, 12/8) groups in dotted beats (three `beatType` units); simple
 * (everything else) is one `beatType` unit per beat (4/4 eighths beam in 2s).
 *
 * @param {{ beats?: number, beatType?: number }} [timeSignature] The active time
 *   signature; defaults to 4/4-like grouping when absent.
 * @return {number} The beat length in quarter-beats (always > 0).
 */
export function beatGroupLength(timeSignature) {
	const beats = timeSignature?.beats;
	const beatType = timeSignature?.beatType;
	// One `beatType` unit in quarter-beats (a quarter = 1): 4 / beatType.
	const unit = beatType ? 4 / beatType : 1;
	const isCompound =
		(beatType === 8 || beatType === 16) &&
		typeof beats === "number" &&
		beats % 3 === 0;
	return isCompound ? unit * 3 : unit;
}

/**
 * Best-effort beaming of one hand's events in one measure (design §6.1). Walks
 * events tracking a running `pos` in quarter-beats (`eventDuration`), accumulating
 * consecutive beamable notes and breaking at a rest, a non-beamable note, the
 * measure end, or a beat-boundary crossing (`floor(pos / beatLen)` changes). The
 * time signature is consulted ONLY for the beat length (grouping); `pos` is purely
 * a grouping aid — it never clamps or crashes on overflow.
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

		// A beamable note that starts past a beat boundary opens a new group; a
		// note straddling a boundary still starts a fresh group (never split).
		if (current && startBeat !== current.startBeat) {
			flush();
		}
		if (!current) {
			current = { indices: [], beamCounts: [], startBeat };
		}
		current.indices.push(i);
		current.beamCounts.push(beamCountFor(event.duration));

		// If this note crosses into the next beat, the next note must start a new
		// group; record the crossing so the boundary check above fires.
		if (endBeat !== startBeat) {
			// Keep the note in THIS group but mark the run so the following note
			// breaks: advance the group's notion of its beat to the end beat is
			// wrong (it would let the next note join); instead flush now so the
			// next beamable note opens fresh. We flush AFTER appending so a single
			// straddling note becomes its own (flagged) group if nothing follows.
			flush();
		}

		pos += dur;
	}
	flush();
	return groups;
}

/**
 * Beam geometry for one group of beamed notes (design §6.1). One stem direction
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

// ── Accidentals — stateless, data-faithful (design §6.4) ───────────────────────

/**
 * Build the per-letter default-alteration map for a hand from its `alters`,
 * keying every entry through `normalizeStep` (design §6.4). Unrecognised keys are
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
 * Resolve a single pitch's accidental, statelessly and data-faithfully (design
 * §6.4). Computes `effectiveAlter = pitch.alter ?? normAlters[letter] ?? 0`, and
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
			// Explicit non-zero override always shows (AC3).
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
 * Best-effort accidental column-stacking for a chord (design §6.4). Accidentals
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

// ── Union-grid alignment + compressive spacing + intrinsic widths (§6.2) ─────────
//
// This is the most adversarially-tested requirement (AC5, robust under AC8/AC9).
// Onsets, the shared grid, the per-column advances, and the intrinsic measure
// width all come PURELY from event durations — `timeSignature` is NEVER consulted
// for any X or width. That single rule makes AC8 (events don't sum to the time
// signature) and AC9 (one-hand / empty-hand measures still draw both staves) fall
// out structurally: the layout simply does not know or care what the bar "should"
// total, and the staff geometry is driven by measure dimensions, not by events.
// Everything is kept NaN-safe (`sqrt(max(Δ, 0))`, an empty-grid short-circuit, and
// `measureEnd = max(handEnds, 0)`).

/**
 * One hand's event onsets within a measure (design §6.2): the running sum from 0
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
 * The end (total duration) of one hand's events in a measure (design §6.2): the
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
 * The union grid for a measure (design §6.2): the sorted, de-duplicated union of
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
 * The compressive horizontal advance for a gap between adjacent onsets (design
 * §6.2): `advance(Δ) = MIN_ADV + ADV_K · sqrt(max(Δ, 0))`. Real engraving spacing
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
 * intrinsic width — all purely from event durations (design §6.2). NEVER consults
 * `timeSignature`: a `timeSignature` passed in `options` is ignored for every X
 * and width (it is accepted only so callers may pass a uniform options object).
 *
 * Per column `i` (grid onset `t_i`), the advance to the next column is
 * `advanceFor(Δ_i, { extra })` where `Δ_i = grid[i+1] − t_i` and the LAST column
 * uses `Δ = measureEnd − t_last` with `measureEnd = max(handEnds, 0)`. The first
 * column starts at `leadingPad`; `contentWidth = Σ advances` (or
 * `EMPTY_MEASURE_WIDTH` for an empty grid); `width = leadingPad + contentWidth +
 * trailingPad`. Both hands' onsets are always reported (`hands.right`/`hands.left`)
 * so the emit layer can draw BOTH staves even for a one-hand or empty measure (AC9).
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
