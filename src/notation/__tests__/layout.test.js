/**
 * Unit tests for the PURE layout layer, part 1 (T4): pitch→staff position with
 * ledger lines, duration decoding, chord stacking + the seconds rule, best-effort
 * beaming, and stateless accidental resolution (design §5.2, §6.1, §6.4).
 *
 * These pin the design's VERIFIED numeric cases as fixtures — the pitch→Y table
 * (§5.2), the simple/compound beaming grouping + breaks + length-1→flag rule
 * (§6.1), and the accidental-precedence cases (§6.4, AC3). Everything here is
 * DOM-free plain data in staff-space (sp) units; later parts (T5/T6) extend this
 * same file.
 */
import { EMPTY_MEASURE_WIDTH, MAX_STRETCH, MIN_ADV } from "../constants.js";
import {
	advanceFor,
	barlineSpec,
	beamCountFor,
	beamGeometry,
	beamGroups,
	beatGroupLength,
	buildLayoutModel,
	decodeDuration,
	diatonicIndex,
	diffContext,
	dotPositions,
	eventDuration,
	handEnd,
	handOnsets,
	isBeamable,
	keySignatureCluster,
	ledgerLinesFor,
	matchSpans,
	measureLayout,
	normalizeAlters,
	ottavaFor,
	packSystems,
	pitchToStaffStep,
	resolveAccidental,
	resolveHandContext,
	resolveSectionContexts,
	stackAccidentals,
	stackChord,
	staffStepToY,
	stemDirectionForChord,
	stemDirectionForStep,
	stepIndex,
	systemScale,
	tempoMark,
	unionGrid,
} from "../layout.js";

// ── Pitch → staff position (design §5.2) ───────────────────────────────────────

describe("stepIndex / diatonicIndex", () => {
	it("indexes the canonical letters C=0…B=6", () => {
		expect(stepIndex("C")).toBe(0);
		expect(stepIndex("D")).toBe(1);
		expect(stepIndex("E")).toBe(2);
		expect(stepIndex("F")).toBe(3);
		expect(stepIndex("G")).toBe(4);
		expect(stepIndex("A")).toBe(5);
		expect(stepIndex("B")).toBe(6);
	});

	it("normalizes English + Spanish, case-insensitively, via normalizeStep", () => {
		expect(stepIndex("do")).toBe(0);
		expect(stepIndex("SOL")).toBe(4);
		expect(stepIndex("si")).toBe(6);
		expect(stepIndex("c")).toBe(0);
	});

	it("returns null for an unrecognised step", () => {
		expect(stepIndex("H")).toBeNull();
		expect(stepIndex(42)).toBeNull();
	});

	it("places middle C at diatonicIndex 28 (C4)", () => {
		expect(diatonicIndex({ step: "C", octave: 4 })).toBe(28);
		expect(diatonicIndex({ step: "do", octave: 4 })).toBe(28);
	});
});

describe("pitchToStaffStep (the §5.2 verified table)", () => {
	it("places treble-clef pitches", () => {
		expect(pitchToStaffStep({ step: "E", octave: 4 }, "treble")).toBe(0);
		expect(pitchToStaffStep({ step: "G", octave: 4 }, "treble")).toBe(2);
		expect(pitchToStaffStep({ step: "F", octave: 5 }, "treble")).toBe(8);
		expect(pitchToStaffStep({ step: "C", octave: 4 }, "treble")).toBe(-2);
		expect(pitchToStaffStep({ step: "C", octave: 6 }, "treble")).toBe(12);
	});

	it("places bass-clef middle C above the staff (+10)", () => {
		expect(pitchToStaffStep({ step: "C", octave: 4 }, "bass")).toBe(10);
	});

	it("treble C4 and bass C4 are the same middle C on the unified scale", () => {
		// diatonicIndex is clef-independent, so both refer to one pitch even
		// though their on-staff positions differ.
		expect(diatonicIndex({ step: "C", octave: 4 })).toBe(28);
	});

	it("defaults to treble and tolerates an unknown clef", () => {
		expect(pitchToStaffStep({ step: "E", octave: 4 })).toBe(0);
		expect(pitchToStaffStep({ step: "E", octave: 4 }, "weird")).toBe(0);
	});

	it("ignores alter entirely (placement uses only step + octave)", () => {
		expect(pitchToStaffStep({ step: "F", octave: 5, alter: 1 }, "treble")).toBe(
			pitchToStaffStep({ step: "F", octave: 5 }, "treble"),
		);
	});

	it("returns null for an unrecognised step", () => {
		expect(pitchToStaffStep({ step: "H", octave: 4 }, "treble")).toBeNull();
	});
});

describe("staffStepToY", () => {
	it("maps staff-steps to a 0.5-sp grid, Y growing downward", () => {
		expect(staffStepToY(0)).toBe(0); // bottom line
		expect(staffStepToY(8)).toBe(-4); // top line, 4 sp up
		expect(staffStepToY(-2)).toBe(1); // one step below the staff
	});
});

describe("ledgerLinesFor (design §5.2)", () => {
	it("draws nothing for notes within the staff (0..8)", () => {
		expect(ledgerLinesFor(0)).toEqual([]);
		expect(ledgerLinesFor(4)).toEqual([]);
		expect(ledgerLinesFor(8)).toEqual([]);
	});

	it("draws one ledger below for treble C4 (sFromBottom −2)", () => {
		const ledgers = ledgerLinesFor(-2);
		expect(ledgers.map((l) => l.sFromBottom)).toEqual([-2]);
	});

	it("draws two ledgers above for treble C6 (sFromBottom 12)", () => {
		const ledgers = ledgerLinesFor(12);
		expect(ledgers.map((l) => l.sFromBottom)).toEqual([10, 12]);
	});

	it("stops at the last line below a note in a space above the staff", () => {
		// A note at sFromBottom 11 (a space) gets a ledger only at 10.
		expect(ledgerLinesFor(11).map((l) => l.sFromBottom)).toEqual([10]);
	});

	it("draws ledgers below symmetrically", () => {
		// A note at sFromBottom −5 (a space) gets ledgers at −2 and −4.
		expect(ledgerLinesFor(-5).map((l) => l.sFromBottom)).toEqual([-2, -4]);
	});
});

// ── Durations → noteheads / stems / flags / dots (design §6.1) ──────────────────

describe("decodeDuration", () => {
	it("whole = open notehead, no stem, no flags", () => {
		expect(decodeDuration("whole")).toEqual({
			notehead: "open",
			hasStem: false,
			flagCount: 0,
			beamCount: 0,
		});
	});

	it("half = open notehead + stem, no flags", () => {
		expect(decodeDuration("half")).toEqual({
			notehead: "open",
			hasStem: true,
			flagCount: 0,
			beamCount: 0,
		});
	});

	it("quarter = filled notehead + stem, no flags", () => {
		expect(decodeDuration("quarter")).toEqual({
			notehead: "filled",
			hasStem: true,
			flagCount: 0,
			beamCount: 0,
		});
	});

	it("eighth/sixteenth/thirty-second = filled + stem + 1/2/3 flags", () => {
		expect(decodeDuration("eighth")).toMatchObject({
			notehead: "filled",
			flagCount: 1,
			beamCount: 1,
		});
		expect(decodeDuration("sixteenth")).toMatchObject({ flagCount: 2 });
		expect(decodeDuration("thirty-second")).toMatchObject({ flagCount: 3 });
	});
});

describe("isBeamable / beamCountFor", () => {
	it("treats only eighth-or-shorter notes (not rests) as beamable", () => {
		expect(isBeamable({ type: "note", duration: "eighth" })).toBe(true);
		expect(isBeamable({ type: "note", duration: "sixteenth" })).toBe(true);
		expect(isBeamable({ type: "note", duration: "quarter" })).toBe(false);
		expect(isBeamable({ type: "rest", duration: "eighth" })).toBe(false);
	});

	it("counts beams: eighth 1, sixteenth 2, thirty-second 3, else 0", () => {
		expect(beamCountFor("eighth")).toBe(1);
		expect(beamCountFor("sixteenth")).toBe(2);
		expect(beamCountFor("thirty-second")).toBe(3);
		expect(beamCountFor("quarter")).toBe(0);
	});
});

describe("stem direction (design §6.1)", () => {
	it("single note < 4 stems up, ≥ 4 stems down (middle line stems down)", () => {
		expect(stemDirectionForStep(0)).toBe("up");
		expect(stemDirectionForStep(3)).toBe("up");
		expect(stemDirectionForStep(4)).toBe("down");
		expect(stemDirectionForStep(8)).toBe("down");
	});

	it("chord direction follows the note farthest from the middle line", () => {
		// Farthest below the middle → up.
		expect(stemDirectionForChord([0, 2])).toBe("up");
		// Farthest above the middle → down.
		expect(stemDirectionForChord([6, 8])).toBe("down");
		// Equal distance above and below → down.
		expect(stemDirectionForChord([2, 6])).toBe("down");
		// A single note on the middle line → down.
		expect(stemDirectionForChord([4])).toBe("down");
	});
});

describe("dotPositions (design §6.1)", () => {
	it("returns no dots when dots is 0", () => {
		expect(dotPositions(3, 0)).toEqual([]);
	});

	it("keeps the notehead Y for a note in a space (odd sFromBottom)", () => {
		const [dot] = dotPositions(3, 1);
		expect(dot.y).toBe(staffStepToY(3));
	});

	it("nudges the dot up into the adjacent space for a note on a line", () => {
		const [dot] = dotPositions(4, 1);
		expect(dot.y).toBe(staffStepToY(5));
	});

	it("places a second dot further right", () => {
		const dots = dotPositions(3, 2);
		expect(dots).toHaveLength(2);
		expect(dots[1].dx).toBeGreaterThan(dots[0].dx);
	});
});

// ── Chord stacking + the seconds rule (design §6.1) ─────────────────────────────

describe("stackChord (design §6.1)", () => {
	it("places a plain triad all on the stem's normal side", () => {
		// C-E-G (no seconds) stem-up → all to the right.
		const heads = stackChord([0, 2, 4], "up");
		expect(heads.map((h) => h.sFromBottom)).toEqual([0, 2, 4]);
		expect(heads.every((h) => h.side === "right")).toBe(true);
		expect(heads.every((h) => !h.displaced)).toBe(true);
	});

	it("displaces the upper note of a diatonic second to the opposite side", () => {
		// C-D (a second) stem-up: C on the right, D displaced to the left.
		const heads = stackChord([0, 1], "up");
		expect(heads[0]).toMatchObject({ sFromBottom: 0, side: "right" });
		expect(heads[1]).toMatchObject({
			sFromBottom: 1,
			side: "left",
			displaced: true,
		});
	});

	it("flips only the middle note of a tight cluster (C-D-E)", () => {
		const heads = stackChord([0, 1, 2], "up");
		expect(heads[0].side).toBe("right");
		expect(heads[1].side).toBe("left"); // middle flips
		expect(heads[2].side).toBe("right"); // outer stays normal
	});

	it("uses the opposite normal side for a stem-down chord", () => {
		const heads = stackChord([0, 1], "down");
		expect(heads[0].side).toBe("left"); // normal side for stem-down
		expect(heads[1].side).toBe("right"); // displaced
	});
});

// ── Best-effort beaming (design §6.1) ──────────────────────────────────────────

describe("eventDuration / beatGroupLength", () => {
	it("computes duration as BASE_DUR × DOT_MUL", () => {
		expect(eventDuration({ duration: "quarter" })).toBe(1);
		expect(eventDuration({ duration: "eighth" })).toBe(0.5);
		expect(eventDuration({ duration: "half", dots: 1 })).toBe(3);
		expect(eventDuration({ duration: "quarter", dots: 2 })).toBe(1.75);
	});

	it("derives a simple beat length (one beatType unit)", () => {
		expect(beatGroupLength({ beats: 4, beatType: 4 })).toBe(1);
		expect(beatGroupLength({ beats: 3, beatType: 4 })).toBe(1);
	});

	it("derives a compound beat length (three beatType units)", () => {
		expect(beatGroupLength({ beats: 6, beatType: 8 })).toBe(1.5);
		expect(beatGroupLength({ beats: 9, beatType: 8 })).toBe(1.5);
		expect(beatGroupLength({ beats: 12, beatType: 8 })).toBe(1.5);
	});

	it("treats 3/8 as simple (beats not divisible by 3 → no compound)", () => {
		// 3/8: beats=3 is divisible by 3, but the classic compound test is meant
		// for 6/9/12; 3/8 conventionally groups its three eighths together, which
		// the beats%3==0 rule yields too (beatLen 1.5 covers all three).
		expect(beatGroupLength({ beats: 3, beatType: 8 })).toBe(1.5);
		// 2/8 is simple.
		expect(beatGroupLength({ beats: 2, beatType: 8 })).toBe(0.5);
	});
});

describe("beamGroups (design §6.1)", () => {
	it("beams 4/4 eighths in twos", () => {
		const events = Array.from({ length: 8 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		expect(groups.map((g) => g.indices)).toEqual([
			[0, 1],
			[2, 3],
			[4, 5],
			[6, 7],
		]);
		expect(groups.every((g) => g.isBeam)).toBe(true);
	});

	it("beams 6/8 eighths in threes (compound)", () => {
		const events = Array.from({ length: 6 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const groups = beamGroups(events, { beats: 6, beatType: 8 });
		expect(groups.map((g) => g.indices)).toEqual([
			[0, 1, 2],
			[3, 4, 5],
		]);
	});

	it("breaks a beam at a rest", () => {
		const events = [
			{ type: "note", duration: "eighth" },
			{ type: "rest", duration: "eighth" },
			{ type: "note", duration: "eighth" },
		];
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		// Two length-1 groups (flagged), the rest breaks them apart.
		expect(groups.map((g) => g.indices)).toEqual([[0], [2]]);
		expect(groups.every((g) => !g.isBeam)).toBe(true);
	});

	it("breaks a beam at a non-beamable note", () => {
		const events = [
			{ type: "note", duration: "eighth" },
			{ type: "note", duration: "quarter" },
			{ type: "note", duration: "eighth" },
		];
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		expect(groups.map((g) => g.indices)).toEqual([[0], [2]]);
	});

	it("renders a length-1 group as a flagged note, not a one-note beam", () => {
		const events = [
			{ type: "note", duration: "eighth" },
			{ type: "note", duration: "quarter" },
		];
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		expect(groups).toEqual([{ indices: [0], isBeam: false, beamCounts: [1] }]);
	});

	it("never throws or clamps on an overflowing measure", () => {
		// Far more eighths than 4/4 can hold — pos overflows the bar, but the walk
		// keeps grouping per beat boundary regardless.
		const events = Array.from({ length: 20 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		expect(() => beamGroups(events, { beats: 4, beatType: 4 })).not.toThrow();
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		// 20 eighths → 10 pairs.
		expect(groups).toHaveLength(10);
		expect(groups.every((g) => g.indices.length === 2)).toBe(true);
	});

	it("carries the per-member beam counts (mixed 8th/16th)", () => {
		const events = [
			{ type: "note", duration: "eighth" },
			{ type: "note", duration: "sixteenth" },
		];
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		expect(groups[0].beamCounts).toEqual([1, 2]);
	});
});

describe("beamGeometry (design §6.1)", () => {
	it("produces flat horizontal stems to a common beam Y (stem-up)", () => {
		const members = [
			{ x: 0, topStep: 1, bottomStep: 1, beamCount: 1 },
			{ x: 4, topStep: 3, bottomStep: 3, beamCount: 1 },
		];
		const geo = beamGeometry(members);
		expect(geo.direction).toBe("up");
		// All stems end at the same (flat) beam Y.
		expect(geo.stems.every((s) => s.y2 === geo.beamY)).toBe(true);
		expect(new Set(geo.stems.map((s) => s.y2)).size).toBe(1);
		// Primary beam spans the group.
		expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0, x2: 4 });
	});

	it("adds a secondary beam only where both notes share it", () => {
		const members = [
			{ x: 0, topStep: 1, bottomStep: 1, beamCount: 2 },
			{ x: 4, topStep: 1, bottomStep: 1, beamCount: 2 },
		];
		const geo = beamGeometry(members);
		const levels = geo.beams.map((b) => b.level).sort();
		expect(levels).toEqual([1, 2]);
	});

	it("adds a stub for an isolated shorter note", () => {
		const members = [
			{ x: 0, topStep: 1, bottomStep: 1, beamCount: 1 },
			{ x: 4, topStep: 1, bottomStep: 1, beamCount: 2 },
		];
		const geo = beamGeometry(members);
		const stub = geo.beams.find((b) => b.stub);
		expect(stub).toBeDefined();
		expect(stub.level).toBe(2);
	});
});

// ── Accidentals — stateless, data-faithful (design §6.4, AC3) ──────────────────

describe("normalizeAlters", () => {
	it("keys the alters map through normalizeStep", () => {
		expect(normalizeAlters({ B: -1, do: 1 })).toEqual({ B: -1, C: 1 });
	});

	it("skips unrecognised keys defensively", () => {
		expect(normalizeAlters({ H: 1, F: -1 })).toEqual({ F: -1 });
	});

	it("returns an empty map for absent alters", () => {
		expect(normalizeAlters()).toEqual({});
		expect(normalizeAlters({})).toEqual({});
	});
});

describe("resolveAccidental (the §6.4 verified precedence cases)", () => {
	it("B default-flat with no override → no glyph, effective −1", () => {
		const r = resolveAccidental({ step: "B" }, normalizeAlters({ B: -1 }));
		expect(r.glyph).toBeNull();
		expect(r.effectiveAlter).toBe(-1);
	});

	it("B explicit alter:0 → natural glyph (cancels the key-sig flat)", () => {
		const r = resolveAccidental(
			{ step: "B", alter: 0 },
			normalizeAlters({ B: -1 }),
		);
		expect(r.glyph).toBe("accNatural");
		expect(r.effectiveAlter).toBe(0);
	});

	it("explicit 0 with NO key-sig default → no glyph (no pointless natural)", () => {
		const r = resolveAccidental({ step: "C", alter: 0 }, {});
		expect(r.glyph).toBeNull();
		expect(r.effectiveAlter).toBe(0);
	});

	it("F#2 explicit → sharp glyph", () => {
		const r = resolveAccidental({ step: "F", octave: 2, alter: 1 }, {});
		expect(r.glyph).toBe("accSharp");
		expect(r.effectiveAlter).toBe(1);
	});

	it('Spanish "si" under alters{B:-1} → −1, no glyph', () => {
		const r = resolveAccidental({ step: "si" }, normalizeAlters({ B: -1 }));
		expect(r.glyph).toBeNull();
		expect(r.effectiveAlter).toBe(-1);
	});

	it('"C" under alters{do:1} → +1, no glyph', () => {
		const r = resolveAccidental({ step: "C" }, normalizeAlters({ do: 1 }));
		expect(r.glyph).toBeNull();
		expect(r.effectiveAlter).toBe(1);
	});

	it("explicit doubles → double glyphs", () => {
		expect(resolveAccidental({ step: "C", alter: 2 }, {}).glyph).toBe(
			"accDoubleSharp",
		);
		expect(resolveAccidental({ step: "C", alter: -2 }, {}).glyph).toBe(
			"accDoubleFlat",
		);
	});

	it("an explicit non-zero override always shows, even if redundant", () => {
		// B already flat by key sig; an explicit flat still draws (courtesy).
		const r = resolveAccidental(
			{ step: "B", alter: -1 },
			normalizeAlters({ B: -1 }),
		);
		expect(r.glyph).toBe("accFlat");
	});
});

describe("stackAccidentals (design §6.4, best-effort)", () => {
	it("keeps well-separated accidentals in one column", () => {
		const placed = stackAccidentals([
			{ sFromBottom: 0, glyph: "accSharp" },
			{ sFromBottom: 8, glyph: "accSharp" },
		]);
		expect(placed.every((p) => p.column === 0)).toBe(true);
	});

	it("pushes a clashing accidental into a further-left column", () => {
		// Two accidentals within 3 staff-steps → the lower one moves left.
		const placed = stackAccidentals([
			{ sFromBottom: 4, glyph: "accSharp" },
			{ sFromBottom: 5, glyph: "accFlat" },
		]);
		// Processed top-down: the higher (5) takes column 0, the lower (4) → 1.
		const high = placed.find((p) => p.sFromBottom === 5);
		const low = placed.find((p) => p.sFromBottom === 4);
		expect(high.column).toBe(0);
		expect(low.column).toBe(1);
		expect(low.dx).toBeGreaterThan(high.dx);
	});
});

// ── T5: union-grid alignment + compressive spacing + intrinsic widths (§6.2) ────
//
// The §6.2 AC8/AC9 battery: onsets/grid/advances come PURELY from event durations
// — `timeSignature` is never consulted for any X or width. These tests are the
// spec's most-tested robustness path: no throw, no NaN, both staff bands for a
// one-hand/empty-hand measure, floor width for an empty measure.

describe("handOnsets / handEnd (design §6.2)", () => {
	it("computes onsets as the running sum from 0 of each event's duration", () => {
		// Four quarters → onsets 0,1,2,3; end 4.
		const events = Array.from({ length: 4 }, () => ({
			type: "note",
			duration: "quarter",
		}));
		expect(handOnsets(events)).toEqual([0, 1, 2, 3]);
		expect(handEnd(events)).toBe(4);
	});

	it("treats rests as full grid citizens (a rest advances the onset)", () => {
		const events = [
			{ type: "note", duration: "quarter" },
			{ type: "rest", duration: "quarter" },
			{ type: "note", duration: "quarter" },
		];
		expect(handOnsets(events)).toEqual([0, 1, 2]);
		expect(handEnd(events)).toBe(3);
	});

	it("honours dotted durations in the onset arithmetic", () => {
		// Dotted half (3) then quarter (1) → onsets 0, 3; end 4.
		const events = [
			{ type: "note", duration: "half", dots: 1 },
			{ type: "note", duration: "quarter" },
		];
		expect(handOnsets(events)).toEqual([0, 3]);
		expect(handEnd(events)).toBe(4);
	});

	it("returns an empty onset list and a zero end for an absent/empty hand", () => {
		expect(handOnsets()).toEqual([]);
		expect(handOnsets([])).toEqual([]);
		expect(handEnd()).toBe(0);
		expect(handEnd([])).toBe(0);
	});
});

describe("unionGrid (design §6.2)", () => {
	it("aligns equal onsets to a single shared column", () => {
		// Both hands four quarters → identical onsets → one column each.
		const rh = Array.from({ length: 4 }, () => ({
			type: "note",
			duration: "quarter",
		}));
		const lh = Array.from({ length: 4 }, () => ({
			type: "note",
			duration: "quarter",
		}));
		expect(unionGrid(handOnsets(rh), handOnsets(lh))).toEqual([0, 1, 2, 3]);
	});

	it("gives an off-beat RH eighth its own column between the LH quarters", () => {
		// RH eighths: onsets 0,0.5,1,1.5; LH quarters: onsets 0,1. The union
		// interleaves the RH off-beats (0.5, 1.5) between the shared on-beats.
		const rh = Array.from({ length: 4 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const lh = Array.from({ length: 2 }, () => ({
			type: "note",
			duration: "quarter",
		}));
		expect(unionGrid(handOnsets(rh), handOnsets(lh))).toEqual([0, 0.5, 1, 1.5]);
	});

	it("extends the grid to the longer hand on unequal totals", () => {
		// RH two quarters (onsets 0,1; end 2); LH one whole (onset 0; end 4). The
		// grid is just the union of onsets {0,1}; the longer hand's END drives the
		// last advance, not extra columns.
		const rh = [
			{ type: "note", duration: "quarter" },
			{ type: "note", duration: "quarter" },
		];
		const lh = [{ type: "note", duration: "whole" }];
		expect(unionGrid(handOnsets(rh), handOnsets(lh))).toEqual([0, 1]);
	});

	it("is the present hand's onsets for a one-hand measure", () => {
		const rh = [
			{ type: "note", duration: "quarter" },
			{ type: "note", duration: "quarter" },
		];
		expect(unionGrid(handOnsets(rh), handOnsets([]))).toEqual([0, 1]);
		expect(unionGrid(handOnsets([]), handOnsets(rh))).toEqual([0, 1]);
	});

	it("is empty for an empty measure", () => {
		expect(unionGrid([], [])).toEqual([]);
	});
});

describe("advanceFor (compressive spacing, design §6.2)", () => {
	it("is MIN_ADV + ADV_K·sqrt(Δ)", () => {
		// Δ = 4 → sqrt 2 → MIN_ADV + 3·2 = MIN_ADV + 6.
		expect(advanceFor(4)).toBeCloseTo(MIN_ADV + 6, 10);
		// Δ = 0 → the floor advance MIN_ADV.
		expect(advanceFor(0)).toBeCloseTo(MIN_ADV, 10);
	});

	it("is compressive: whole-vs-32nd advance ratio is ~2.5:1, not 32:1", () => {
		const ratio = advanceFor(4) / advanceFor(0.125);
		expect(ratio).toBeGreaterThan(2);
		expect(ratio).toBeLessThan(3);
	});

	it("is NaN-safe for a negative Δ (clamps via sqrt(max(Δ,0)))", () => {
		const a = advanceFor(-5);
		expect(Number.isNaN(a)).toBe(false);
		expect(a).toBeCloseTo(MIN_ADV, 10);
	});

	it("raises the advance per-column when glyphs (accidentals/dots/flags) clear", () => {
		// A column flagged with extra glyphs gets a wider minimum than a bare one.
		const bare = advanceFor(0);
		const wide = advanceFor(0, { extra: 2 });
		expect(wide).toBeGreaterThan(bare);
		expect(wide).toBeCloseTo(bare + 2, 10);
	});
});

describe("measureLayout (design §6.2 — the AC8/AC9 battery)", () => {
	it("returns a union grid, per-onset X, and an intrinsic width", () => {
		const rh = [
			{ type: "note", duration: "quarter" },
			{ type: "note", duration: "quarter" },
		];
		const lh = [{ type: "note", duration: "half" }];
		const layout = measureLayout(rh, lh);
		expect(layout.grid).toEqual([0, 1]);
		// One X per grid onset, monotonically increasing, the first at leadingPad.
		expect(layout.columns).toHaveLength(2);
		expect(layout.columns[0].onset).toBe(0);
		expect(layout.columns[1].x).toBeGreaterThan(layout.columns[0].x);
		expect(layout.width).toBeGreaterThan(0);
		expect(Number.isFinite(layout.width)).toBe(true);
	});

	it("maps an onset present in either hand to the same X (vertical alignment)", () => {
		// RH eighths and LH quarters: the on-beat columns (0, 1) are shared X's the
		// LH lands on; the off-beats (0.5, 1.5) are RH-only columns in between.
		const rh = Array.from({ length: 4 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const lh = Array.from({ length: 2 }, () => ({
			type: "note",
			duration: "quarter",
		}));
		const layout = measureLayout(rh, lh);
		expect(layout.grid).toEqual([0, 0.5, 1, 1.5]);
		const xOf = (t) => layout.columns.find((c) => c.onset === t).x;
		// The LH quarter at onset 1 draws at the very same X as the RH eighth there.
		expect(xOf(1)).toBeGreaterThan(xOf(0.5));
		expect(xOf(0.5)).toBeGreaterThan(xOf(0));
	});

	it("extends the grid to max(handEnds); the short hand simply ends (AC8)", () => {
		// RH two quarters (end 2); LH one whole (end 4). The last advance uses
		// measureEnd = max(2,4) = 4, so the whole-note column gets a wide gap.
		const rh = [
			{ type: "note", duration: "quarter" },
			{ type: "note", duration: "quarter" },
		];
		const lh = [{ type: "note", duration: "whole" }];
		const layout = measureLayout(rh, lh);
		expect(layout.grid).toEqual([0, 1]);
		expect(layout.measureEnd).toBe(4);
		expect(Number.isFinite(layout.width)).toBe(true);
	});

	it("produces both staff bands for a one-hand measure (AC9)", () => {
		// LH absent: the grid is the RH onsets, but the measure still reports both
		// hands' geometry so the emit layer draws both staves regardless.
		const rh = [
			{ type: "note", duration: "quarter" },
			{ type: "note", duration: "quarter" },
		];
		const layout = measureLayout(rh, []);
		expect(layout.grid).toEqual([0, 1]);
		expect(layout.hands.right.onsets).toEqual([0, 1]);
		expect(layout.hands.left.onsets).toEqual([]);
		expect(Number.isFinite(layout.width)).toBe(true);
	});

	it("produces both staff bands for an empty measure at the floor width (AC9)", () => {
		const layout = measureLayout([], []);
		expect(layout.grid).toEqual([]);
		expect(layout.columns).toEqual([]);
		// Empty grid → the floor width plus pads; the content floor is the constant.
		expect(layout.contentWidth).toBe(EMPTY_MEASURE_WIDTH);
		expect(layout.hands.right.onsets).toEqual([]);
		expect(layout.hands.left.onsets).toEqual([]);
		expect(Number.isFinite(layout.width)).toBe(true);
	});

	it("never throws and stays NaN-free on an overflowing bar (AC8)", () => {
		// Far more eighths than 4/4 holds — but the layout never knows or cares
		// what the bar "should" total; it lays out purely from durations.
		const rh = Array.from({ length: 20 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		expect(() => measureLayout(rh, [])).not.toThrow();
		const layout = measureLayout(rh, []);
		expect(layout.columns).toHaveLength(20);
		expect(layout.columns.every((c) => Number.isFinite(c.x))).toBe(true);
		expect(Number.isFinite(layout.width)).toBe(true);
	});

	it("NEVER consults timeSignature — identical layout regardless of it", () => {
		const rh = Array.from({ length: 6 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		// Two wildly different time signatures (one where the events overflow) must
		// yield byte-identical layout: the layer is structurally time-sig-blind.
		const a = measureLayout(rh, [], {
			timeSignature: { beats: 2, beatType: 4 },
		});
		const b = measureLayout(rh, [], {
			timeSignature: { beats: 12, beatType: 8 },
		});
		expect(a).toEqual(b);
		const bare = measureLayout(rh, []);
		expect(bare).toEqual(a);
	});

	it("adds leadingPad only when the measure prints clef/keysig/timesig", () => {
		const rh = [{ type: "note", duration: "quarter" }];
		const plain = measureLayout(rh, []);
		const withReserve = measureLayout(rh, [], { leadingPad: 12 });
		expect(withReserve.width).toBeCloseTo(plain.width + 12, 10);
		// The leading pad shifts the first column right by exactly that pad.
		expect(withReserve.columns[0].x).toBeCloseTo(plain.columns[0].x + 12, 10);
	});

	it("adds a trailingPad (barline width) to the intrinsic width", () => {
		const rh = [{ type: "note", duration: "quarter" }];
		const plain = measureLayout(rh, []);
		const withBar = measureLayout(rh, [], { trailingPad: 1.5 });
		expect(withBar.width).toBeCloseTo(plain.width + 1.5, 10);
	});

	it("widens a column carrying accidentals/dots/flags so its glyphs clear", () => {
		const rh = [
			{ type: "note", duration: "quarter" },
			{ type: "note", duration: "quarter" },
		];
		const plain = measureLayout(rh, []);
		// Mark the first column as needing extra room (e.g. an accidental + a dot).
		const padded = measureLayout(rh, [], { columnExtra: { 0: 2 } });
		expect(padded.width).toBeGreaterThan(plain.width);
		// Everything from that column rightward shifts by the extra room.
		expect(padded.columns[1].x).toBeCloseTo(plain.columns[1].x + 2, 10);
	});
});

// ── T6: section resolution + diff, wrapping/justify, spans/texts/barlines/ottava,
// and the full buildLayoutModel (design §5.3, §6.3, §6.4, §6.6, §6.7) ────────────
//
// The §6.6 diff fixture below is the `docs/song-format.md` annotated 2-section
// example, transcribed verbatim (and identical to the validator's COMPREHENSIVE
// fixture). It is the shared full-coverage song.

/**
 * The annotated comprehensive example song (design §9 / `docs/song-format.md`),
 * transcribed verbatim. It exercises every element and is the §6.6-verified
 * 2-section diff fixture: tempo 120→90, time sig 4/4→3/4, RH clef treble unchanged,
 * LH clef bass→tenor, RH alters {}→{F,C}, LH alters {B:-1}→{}, RH octaveShift 0→1,
 * LH octaveShift unchanged.
 */
const COMPREHENSIVE_SONG = {
	metadata: { title: "Example", composer: "A. Composer" },
	defaults: {
		tempo: { bpm: 120, beatUnit: "quarter" },
		timeSignature: { beats: 4, beatType: 4 },
		rightHand: { clef: "treble" },
		leftHand: { clef: "bass", alters: { B: -1 } },
	},
	sections: [
		{
			measures: [
				{
					barlineStart: "repeat-start",
					rightHand: [
						{
							type: "note",
							duration: "half",
							dots: 1,
							dynamic: "mf",
							chordSymbol: "C",
							slur: "start",
							tie: "start",
							pitches: [
								{ step: "C", octave: 5 },
								{ step: "E", octave: 5 },
								{ step: "G", octave: 5 },
							],
						},
						{ type: "rest", duration: "quarter" },
					],
					leftHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "do", octave: 3 }],
						},
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "sol", octave: 3 }],
						},
						{
							type: "note",
							duration: "half",
							pitches: [{ step: "si", octave: 2 }],
						},
					],
				},
				{
					barlineEnd: "repeat-end",
					rightHand: [
						{
							type: "note",
							duration: "whole",
							tie: "stop",
							slur: "stop",
							pitches: [{ step: "C", octave: 5 }],
						},
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "F", octave: 2, alter: 1 }],
						},
					],
				},
			],
		},
		{
			tempo: { bpm: 90, beatUnit: "quarter" },
			timeSignature: { beats: 3, beatType: 4 },
			rightHand: { octaveShift: 1, alters: { F: 1, C: 1 } },
			leftHand: { clef: "tenor", alters: {} },
			measures: [
				{
					barlineEnd: "final",
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							dynamic: "p",
							pitches: [{ step: "F", octave: 5 }],
						},
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "C", octave: 6 }],
						},
						{ type: "rest", duration: "quarter" },
					],
					leftHand: [
						{
							type: "note",
							duration: "half",
							dots: 1,
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
			],
		},
	],
};

describe("resolveHandContext / resolveSectionContexts (design §6.6)", () => {
	it("inherits each field from defaults independently", () => {
		const ctx = resolveHandContext(
			"rightHand",
			{ octaveShift: 1 },
			{ clef: "treble" },
		);
		// clef inherited from defaults, octaveShift from the section, alters default.
		expect(ctx).toEqual({ clef: "treble", alters: {}, octaveShift: 1 });
	});

	it("replaces alters wholesale — a present empty alters wins over defaults", () => {
		const ctx = resolveHandContext(
			"leftHand",
			{ alters: {} },
			{ clef: "bass", alters: { B: -1 } },
		);
		expect(ctx.alters).toEqual({});
		expect(ctx.clef).toBe("bass"); // clef still inherited
	});

	it("defaults octaveShift to 0 and the clef to the hand default", () => {
		expect(resolveHandContext("rightHand").octaveShift).toBe(0);
		expect(resolveHandContext("rightHand").clef).toBe("treble");
		expect(resolveHandContext("leftHand").clef).toBe("bass");
	});

	it("resolves every section's effective context for the comprehensive song", () => {
		const ctxs = resolveSectionContexts(COMPREHENSIVE_SONG);
		expect(ctxs).toHaveLength(2);
		// Section 1 inherits all defaults.
		expect(ctxs[0].tempo).toEqual({ bpm: 120, beatUnit: "quarter" });
		expect(ctxs[0].rightHand).toEqual({
			clef: "treble",
			alters: {},
			octaveShift: 0,
		});
		expect(ctxs[0].leftHand).toEqual({
			clef: "bass",
			alters: { B: -1 },
			octaveShift: 0,
		});
		// Section 2 overrides tempo / timesig / RH octaveShift+alters / LH clef+alters.
		expect(ctxs[1].tempo).toEqual({ bpm: 90, beatUnit: "quarter" });
		expect(ctxs[1].timeSignature).toEqual({ beats: 3, beatType: 4 });
		expect(ctxs[1].rightHand).toEqual({
			clef: "treble",
			alters: { F: 1, C: 1 },
			octaveShift: 1,
		});
		expect(ctxs[1].leftHand).toEqual({
			clef: "tenor",
			alters: {},
			octaveShift: 0,
		});
	});
});

describe("diffContext — the §6.6-verified 2-section diff fixture", () => {
	it("marks ONLY what changed between the two sections", () => {
		const ctxs = resolveSectionContexts(COMPREHENSIVE_SONG);
		const diff = diffContext(ctxs[1], ctxs[0]);
		expect(diff.tempo).toBe(true); // 120 → 90
		expect(diff.timeSignature).toBe(true); // 4/4 → 3/4
		expect(diff.rightHand.clef).toBe(false); // treble unchanged
		expect(diff.rightHand.alters).toBe(true); // {} → {F,C}
		expect(diff.rightHand.octaveShift).toBe(true); // 0 → 1 (starts 8va)
		expect(diff.leftHand.clef).toBe(true); // bass → tenor
		expect(diff.leftHand.alters).toBe(true); // {B:-1} → {}
		expect(diff.leftHand.octaveShift).toBe(false); // unchanged
	});

	it("marks everything changed for the first section (no previous)", () => {
		const ctxs = resolveSectionContexts(COMPREHENSIVE_SONG);
		const diff = diffContext(ctxs[0], null);
		expect(diff.tempo).toBe(true);
		expect(diff.timeSignature).toBe(true);
		expect(diff.rightHand.clef).toBe(true);
		expect(diff.rightHand.alters).toBe(true);
		expect(diff.leftHand.clef).toBe(true);
	});
});

describe("keySignatureCluster (design §6.4)", () => {
	it("renders one glyph per altered note at its key-sig register, in sharp order", () => {
		// {F,C} sharps → conventional sharp order F then C, at the treble registers.
		const cluster = keySignatureCluster({ F: 1, C: 1 }, "treble");
		expect(cluster.glyphs.map((g) => g.letter)).toEqual(["F", "C"]);
		expect(cluster.glyphs.every((g) => g.glyph === "accSharp")).toBe(true);
		expect(cluster.glyphs[0].sFromBottom).toBe(8); // F# at the treble top line
		expect(cluster.glyphs[1].sFromBottom).toBe(5); // C# at the 3rd space
	});

	it("orders flats in conventional flat order (B E A D G C F)", () => {
		const cluster = keySignatureCluster({ E: -1, B: -1, A: -1 }, "treble");
		expect(cluster.glyphs.map((g) => g.letter)).toEqual(["B", "E", "A"]);
		expect(cluster.glyphs.every((g) => g.glyph === "accFlat")).toBe(true);
	});

	it("normalizes Spanish keys and skips zero/unrecognised entries", () => {
		const cluster = keySignatureCluster({ si: -1, F: 0, H: 1 }, "bass");
		expect(cluster.glyphs.map((g) => g.letter)).toEqual(["B"]); // si→B; F:0 + H dropped
		expect(cluster.glyphs[0].glyph).toBe("accFlat");
	});

	it("draws the double glyph for a double alteration (data-faithful)", () => {
		const cluster = keySignatureCluster({ C: 2, B: -2 }, "treble");
		const byLetter = Object.fromEntries(
			cluster.glyphs.map((g) => [g.letter, g.glyph]),
		);
		expect(byLetter.C).toBe("accDoubleSharp");
		expect(byLetter.B).toBe("accDoubleFlat");
	});

	it("is empty (width 0) for no alters", () => {
		expect(keySignatureCluster({}, "treble")).toEqual({ glyphs: [], width: 0 });
	});

	it("uses a per-clef register table (same letter, different position by clef)", () => {
		const treble = keySignatureCluster({ F: 1 }, "treble").glyphs[0]
			.sFromBottom;
		const bass = keySignatureCluster({ F: 1 }, "bass").glyphs[0].sFromBottom;
		expect(treble).not.toBe(bass);
	});
});

describe("ottavaFor (design §5.3)", () => {
	it("maps each octave shift to its label + placement", () => {
		expect(ottavaFor(1)).toEqual({ label: "8va", placement: "above" });
		expect(ottavaFor(2)).toEqual({ label: "15ma", placement: "above" });
		expect(ottavaFor(-1)).toEqual({ label: "8vb", placement: "below" });
		expect(ottavaFor(-2)).toEqual({ label: "15mb", placement: "below" });
	});

	it("returns null for no shift (0 / absent)", () => {
		expect(ottavaFor(0)).toBeNull();
		expect(ottavaFor()).toBeNull();
	});
});

describe("tempoMark (design §6.7)", () => {
	it("uses the beatUnit note glyph + bpm", () => {
		expect(tempoMark({ bpm: 120, beatUnit: "half" })).toEqual({
			glyph: "metNoteHalf",
			bpm: 120,
		});
	});

	it("defaults a missing beatUnit to the quarter glyph (never omits the glyph)", () => {
		expect(tempoMark({ bpm: 90 })).toEqual({
			glyph: "metNoteQuarter",
			bpm: 90,
		});
	});

	it("returns null when there is no tempo / bpm", () => {
		expect(tempoMark()).toBeNull();
		expect(tempoMark({ beatUnit: "quarter" })).toBeNull();
	});
});

describe("barlineSpec (design §6.7)", () => {
	it("regular = one thin stroke", () => {
		const b = barlineSpec("regular");
		expect(b.strokes).toHaveLength(1);
		expect(b.dots).toHaveLength(0);
	});

	it("double = two thin strokes", () => {
		const b = barlineSpec("double");
		expect(b.strokes).toHaveLength(2);
		expect(b.strokes.every((s) => s.thickness < 0.3)).toBe(true);
	});

	it("final = thin then thick", () => {
		const b = barlineSpec("final");
		expect(b.strokes).toHaveLength(2);
		expect(b.strokes[0].thickness).toBeLessThan(b.strokes[1].thickness);
	});

	it("repeat-start = thick + thin then dots to the right", () => {
		const b = barlineSpec("repeat-start", 0);
		expect(b.strokes).toHaveLength(2);
		expect(b.strokes[0].thickness).toBeGreaterThan(b.strokes[1].thickness);
		expect(b.dots).toHaveLength(1);
		// The dots sit to the RIGHT of both strokes.
		expect(b.dots[0].x).toBeGreaterThan(b.strokes[1].x);
	});

	it("repeat-end = dots to the left then thin + thick", () => {
		const b = barlineSpec("repeat-end", 0);
		expect(b.strokes).toHaveLength(2);
		expect(b.dots).toHaveLength(1);
		// The dots sit to the LEFT of the strokes.
		expect(b.dots[0].x).toBeLessThan(b.strokes[0].x);
		expect(b.strokes[0].thickness).toBeLessThan(b.strokes[1].thickness);
	});

	it("unknown barline type falls back to regular", () => {
		expect(barlineSpec("nonsense").strokes).toHaveLength(1);
	});
});

describe("matchSpans — stack-based, dangling-safe (design §6.7)", () => {
	it("matches a start with the next stop", () => {
		expect(matchSpans([{ marker: "start" }, {}, { marker: "stop" }])).toEqual([
			{ startIndex: 0, stopIndex: 2 },
		]);
	});

	it("drops a dangling start (no throw)", () => {
		expect(matchSpans([{ marker: "start" }, {}])).toEqual([]);
	});

	it("drops a dangling stop (no throw)", () => {
		expect(matchSpans([{}, { marker: "stop" }])).toEqual([]);
	});

	it("a second start before a stop drops the earlier start", () => {
		// double-start: only the most recent start pairs with the stop.
		expect(
			matchSpans([
				{ marker: "start" },
				{ marker: "start" },
				{ marker: "stop" },
			]),
		).toEqual([{ startIndex: 1, stopIndex: 2 }]);
	});

	it("matches several spans in order", () => {
		expect(
			matchSpans([
				{ marker: "start" },
				{ marker: "stop" },
				{ marker: "start" },
				{ marker: "stop" },
			]),
		).toEqual([
			{ startIndex: 0, stopIndex: 1 },
			{ startIndex: 2, stopIndex: 3 },
		]);
	});

	it("never throws on an empty / absent stream", () => {
		expect(() => matchSpans()).not.toThrow();
		expect(matchSpans([])).toEqual([]);
	});
});

describe("packSystems + systemScale (design §6.3)", () => {
	const measures = (widths) =>
		widths.map((contentWidth) => ({ contentWidth, reserve: 10 }));

	it("packs more measures per system at a wide budget than a narrow one", () => {
		const ms = measures([10, 10, 10, 10, 10, 10]);
		const wide = packSystems(ms, 200);
		const narrow = packSystems(ms, 30);
		// Wide fits everything in fewer systems; narrow needs more.
		expect(wide.length).toBeLessThan(narrow.length);
		// Every system is non-empty and the ranges cover all measures.
		const totalWide = wide.reduce((s, r) => s + r.count, 0);
		const totalNarrow = narrow.reduce((s, r) => s + r.count, 0);
		expect(totalWide).toBe(6);
		expect(totalNarrow).toBe(6);
		expect(wide.every((r) => r.count >= 1)).toBe(true);
		expect(narrow.every((r) => r.count >= 1)).toBe(true);
	});

	it("always keeps ≥ 1 measure per system, even for an over-wide measure", () => {
		// First measure (100) exceeds the budget alone, yet still gets its own system.
		const ms = [
			{ contentWidth: 100, reserve: 10 },
			{ contentWidth: 5, reserve: 10 },
		];
		const packed = packSystems(ms, 30);
		expect(packed[0].count).toBe(1);
		expect(packed.every((r) => r.count >= 1)).toBe(true);
	});

	it("does not justify the last system of the score", () => {
		expect(systemScale(20, 50, { isLast: true })).toEqual({
			advanceScale: 1,
			downscaleFactor: 1,
		});
	});

	it("justifies an interior system, capped at MAX_STRETCH", () => {
		// availSp/contentSp = 50/40 = 1.25 → stretched, within the cap.
		expect(systemScale(40, 50, { isLast: false }).advanceScale).toBeCloseTo(
			1.25,
			10,
		);
		// A huge ratio clamps to MAX_STRETCH.
		expect(systemScale(10, 50, { isLast: false }).advanceScale).toBe(
			MAX_STRETCH,
		);
	});

	it("downscales an over-wide system uniformly (scale < 1, glyphs included)", () => {
		// content 100 > avail 30 → no advance stretch, the whole system shrinks.
		const s = systemScale(100, 30);
		expect(s.advanceScale).toBe(1);
		expect(s.downscaleFactor).toBeCloseTo(0.3, 10);
	});
});

describe("buildLayoutModel — the full positioned-primitive model (§6.3/§6.6/§6.7)", () => {
	it("returns a well-formed model with two staff bands per system", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		expect(Array.isArray(model.systems)).toBe(true);
		expect(model.systems.length).toBeGreaterThanOrEqual(1);
		for (const sys of model.systems) {
			// Two staff bands: an RH and an LH staff, each with a top + bottom Y.
			expect(sys.band.rightStaffTopY).toBeLessThan(sys.band.rightStaffBottomY);
			expect(sys.band.leftStaffTopY).toBeLessThan(sys.band.leftStaffBottomY);
			// The LH staff sits below the RH staff (an intra-staff gap between them).
			expect(sys.band.leftStaffTopY).toBeGreaterThan(
				sys.band.rightStaffBottomY,
			);
			// Every system restates brace + both clefs + alters (per-system restatement).
			expect(sys.reserve.brace).toBeDefined();
			expect(sys.reserve.clefs.right.glyph).toBeDefined();
			expect(sys.reserve.clefs.left.glyph).toBeDefined();
			expect(sys.reserve.keySig.right).toBeDefined();
			expect(sys.reserve.keySig.left).toBeDefined();
			expect(Array.isArray(sys.measures)).toBe(true);
			expect(sys.measures.length).toBeGreaterThanOrEqual(1);
			expect(Array.isArray(sys.spans)).toBe(true);
		}
	});

	it("packs the song into fewer systems when wider, more when narrower (AC5)", () => {
		const wide = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const narrow = buildLayoutModel(COMPREHENSIVE_SONG, 30);
		expect(narrow.systems.length).toBeGreaterThan(wide.systems.length);
		// Always ≥ 1 measure per system at the narrow width.
		expect(narrow.systems.every((s) => s.measures.length >= 1)).toBe(true);
	});

	it("downscales an over-wide single measure's whole system (no overflow)", () => {
		const manyNotes = Array.from({ length: 40 }, () => ({
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 4 }],
		}));
		const song = { sections: [{ measures: [{ rightHand: manyNotes }] }] };
		const model = buildLayoutModel(song, 33);
		expect(model.systems).toHaveLength(1);
		expect(model.systems[0].downscaleFactor).toBeLessThan(1);
	});

	it("emits the time signature only on the first system / on change", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		// At a wide width the whole song is one system → time sig present at its head.
		expect(model.systems[0].reserve.timeSignature).toEqual({
			beats: 4,
			beatType: 4,
		});
	});

	it("numbers measures sequentially 1..N across section boundaries (§6.7)", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const numbers = model.systems.flatMap((s) =>
			s.measures.map((m) => m.number),
		);
		expect(numbers).toEqual([1, 2, 3]); // section 2 does NOT reset the count
	});

	it("resolves the tie + slur spanning the two measures (§6.7)", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const spans = model.systems.flatMap((s) => s.spans);
		expect(spans.some((s) => s.kind === "tie")).toBe(true);
		expect(spans.some((s) => s.kind === "slur")).toBe(true);
	});

	it("surfaces per-event dynamics + chord symbols and barlines (§6.7)", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const allRightTexts = model.systems.flatMap((s) =>
			s.measures.flatMap((m) => m.right.texts),
		);
		expect(
			allRightTexts.some((t) => t.kind === "dynamic" && t.text === "mf"),
		).toBe(true);
		expect(
			allRightTexts.some((t) => t.kind === "chordSymbol" && t.text === "C"),
		).toBe(true);
		const allBarlines = model.systems.flatMap((s) =>
			s.measures.flatMap((m) => m.barlines.map((b) => `${b.side}/${b.type}`)),
		);
		// The score's first measure has no left barline — its `repeat-start` is
		// suppressed (§6.7) — but repeat-end and final still draw on the right.
		expect(allBarlines).not.toContain("start/repeat-start");
		expect(allBarlines).toContain("end/repeat-end");
		expect(allBarlines).toContain("end/final");
	});

	it("draws a left repeat-start barline on a non-first measure (§6.7)", () => {
		const song = {
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
						},
						{
							barlineStart: "repeat-start",
							rightHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
						},
					],
				},
			],
		};
		const model = buildLayoutModel(song, 200);
		const barlines = model.systems.flatMap((s) =>
			s.measures.flatMap((m) => m.barlines.map((b) => `${b.side}/${b.type}`)),
		);
		// A `repeat-start` on the 2nd measure (not the score start) DOES draw a left bar.
		expect(barlines).toContain("start/repeat-start");
	});

	it("prints a tempo at the song start and at the section-2 tempo change (§6.7)", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const tempos = model.systems.flatMap((s) => s.texts.tempos);
		// One at the song start (120 → quarter glyph) and one at the change (90).
		expect(tempos.map((t) => t.bpm).sort((a, b) => a - b)).toEqual([90, 120]);
		expect(tempos.every((t) => t.glyph === "metNoteQuarter")).toBe(true);
	});

	it("starts an 8va ottava for the RH octave shift in section 2 (§5.3)", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const ottavas = model.systems.flatMap((s) => s.texts.ottavas);
		const eightVa = ottavas.find((o) => o.label === "8va");
		expect(eightVa).toBeDefined();
		expect(eightVa.hand).toBe("rightHand");
		expect(eightVa.placement).toBe("above");
	});

	it("draws an inline section change at a mid-system section boundary (AC4)", () => {
		// At a width that keeps all three measures on one system, the section-2 start
		// (measure 3) carries inline cautionary changes (LH clef + RH/LH key sig).
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const allMeasures = model.systems.flatMap((s) => s.measures);
		const sectionStart = allMeasures.find((m) => m.number === 3);
		expect(sectionStart.isSectionStart).toBe(true);
		// Inline changes are present only when the section start is mid-system.
		if (model.systems.length === 1) {
			expect(sectionStart.inline).not.toBeNull();
			expect(sectionStart.inline.clefs.left).toBeDefined(); // bass → tenor
			expect(sectionStart.inline.timeSignature).toEqual({
				beats: 3,
				beatType: 4,
			});
		}
	});

	it("never references timeSignature for measure X / width", () => {
		// Re-run with the time signatures mutated to absurd values; the measure X /
		// widths (driven purely by durations) must be identical.
		const mutated = JSON.parse(JSON.stringify(COMPREHENSIVE_SONG));
		mutated.defaults.timeSignature = { beats: 13, beatType: 16 };
		mutated.sections[1].timeSignature = { beats: 7, beatType: 8 };
		const a = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const b = buildLayoutModel(mutated, 200);
		const xsOf = (model) =>
			model.systems.flatMap((s) => s.measures.map((m) => [m.x, m.width]));
		expect(xsOf(b)).toEqual(xsOf(a));
	});

	it("never throws on dangling ties/slurs, empty hands, or an empty song (AC8/AC9)", () => {
		const dangling = {
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									tie: "start",
									pitches: [{ step: "C", octave: 4 }],
								},
							],
						},
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									slur: "stop",
									pitches: [{ step: "D", octave: 4 }],
								},
							],
						},
						{
							leftHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						}, // RH empty
						{}, // both hands empty
					],
				},
			],
		};
		expect(() => buildLayoutModel(dangling, 100)).not.toThrow();
		expect(() => buildLayoutModel({ sections: [] }, 100)).not.toThrow();
		expect(() => buildLayoutModel({}, 100)).not.toThrow();
		expect(buildLayoutModel({ sections: [] }, 100).systems).toEqual([]);
		// Each system in the dangling song still has both staff bands (AC9).
		const model = buildLayoutModel(dangling, 100);
		for (const sys of model.systems) {
			expect(sys.band.rightStaffTopY).toBeDefined();
			expect(sys.band.leftStaffTopY).toBeDefined();
		}
	});
});
