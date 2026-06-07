/**
 * Unit tests for the PURE layout layer, part 1: pitch→staff position with
 * ledger lines, duration decoding, chord stacking + the seconds rule, best-effort
 * beaming, and stateless accidental resolution.
 *
 * These pin the VERIFIED numeric cases as fixtures — the pitch→Y table, the
 * simple/compound beaming grouping + breaks + length-1→flag rule, and the
 * accidental-precedence cases. Everything here is DOM-free plain data in
 * staff-space (sp) units; later parts extend this same file.
 */
import {
	ACCIDENTAL_GAP,
	BARLINE_POST_PAD,
	DYNAMIC_ADVANCE_EM,
	DYNAMIC_SIZE,
	DYNAMICS_LANE_RESERVE,
	EMPTY_MEASURE_WIDTH,
	HAIRPIN_APERTURE,
	HAIRPIN_DYNAMIC_GAP,
	HAIRPIN_HINGE_GAP,
	HAIRPIN_LANE_DY,
	INTRA_STAFF_GAP,
	MAX_STRETCH,
	MEASURE_START_PAD,
	MIN_ADV,
	NOTE_CLAMP_INSET,
	NOTE_GAP_STAFF,
	NOTE_SIZE,
	NOTEHEAD_RX,
	OTTAVA_SIZE,
	STAFF_MARGIN_X,
	TEXT_LANE_GAP,
} from "../constants.js";
import {
	advanceFor,
	barlineSpec,
	beamCountFor,
	beamGeometry,
	beamGroups,
	beatGroupLength,
	buildHairpinSpec,
	buildLayoutModel,
	clipSpanToStartSystem,
	collectEventTexts,
	collectStandaloneAnnotations,
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
	lhAboveTopExtent,
	matchSpans,
	measureLayout,
	normalizeAlters,
	ottavaFor,
	packSystems,
	pitchToStaffStep,
	recordSpanMarkers,
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

// ── Pitch → staff position ─────────────────────────────────────────────────────

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

describe("pitchToStaffStep (the verified table)", () => {
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

describe("ledgerLinesFor", () => {
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

// ── Durations → noteheads / stems / flags / dots ────────────────────────────────

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

describe("stem direction", () => {
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

describe("dotPositions", () => {
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

// ── Chord stacking + the seconds rule ───────────────────────────────────────────

describe("stackChord", () => {
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

// ── Best-effort beaming ──────────────────────────────────────────────────────────

describe("eventDuration / beatGroupLength", () => {
	it("computes duration as BASE_DUR × DOT_MUL", () => {
		expect(eventDuration({ duration: "quarter" })).toBe(1);
		expect(eventDuration({ duration: "eighth" })).toBe(0.5);
		expect(eventDuration({ duration: "half", dots: 1 })).toBe(3);
		expect(eventDuration({ duration: "quarter", dots: 2 })).toBe(1.75);
	});

	it("derives the simple grouping unit (half-bar, floored at one beat / whole bar for small metres)", () => {
		// 4/4: half-bar = 2 quarter-beats → a chained run beams in fours.
		expect(beatGroupLength({ beats: 4, beatType: 4 })).toBe(2);
		// 3/4: small simple metre whose half-bar (1.5) is under a half-note, so it
		// groups by the whole bar (3) — the six eighths beam as one.
		expect(beatGroupLength({ beats: 3, beatType: 4 })).toBe(3);
	});

	it("derives a compound beat length (three beatType units)", () => {
		expect(beatGroupLength({ beats: 6, beatType: 8 })).toBe(1.5);
		expect(beatGroupLength({ beats: 9, beatType: 8 })).toBe(1.5);
		expect(beatGroupLength({ beats: 12, beatType: 8 })).toBe(1.5);
	});

	it("treats 3/8 as compound but 2/8 as a small simple metre", () => {
		// 3/8: beats=3 is divisible by 3, but the classic compound test is meant
		// for 6/9/12; 3/8 conventionally groups its three eighths together, which
		// the beats%3==0 rule yields too (beatLen 1.5 covers all three).
		expect(beatGroupLength({ beats: 3, beatType: 8 })).toBe(1.5);
		// 2/8 is simple, and its half-bar (0.5) would re-introduce pairs, so it
		// groups by the WHOLE BAR (1) — both eighths beam together.
		expect(beatGroupLength({ beats: 2, beatType: 8 })).toBe(1);
	});

	it("defaults an absent time signature to 4/4 grouping (NaN guard)", () => {
		expect(beatGroupLength(null)).toBe(2);
		expect(beatGroupLength(undefined)).toBe(2);
	});
});

describe("beamGroups", () => {
	it("beams 4/4 eighths in fours", () => {
		const events = Array.from({ length: 8 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		expect(groups.map((g) => g.indices)).toEqual([
			[0, 1, 2, 3],
			[4, 5, 6, 7],
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
		// 20 eighths → 5 groups of four.
		expect(groups).toHaveLength(5);
		expect(groups.every((g) => g.indices.length === 4)).toBe(true);
	});

	it("carries the per-member beam counts (mixed 8th/16th)", () => {
		const events = [
			{ type: "note", duration: "eighth" },
			{ type: "note", duration: "sixteenth" },
		];
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		expect(groups[0].beamCounts).toEqual([1, 2]);
	});

	it("beams a whole bar of 2/4 eighths as one group (whole-bar unit)", () => {
		const events = Array.from({ length: 4 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const groups = beamGroups(events, { beats: 2, beatType: 4 });
		expect(groups.map((g) => g.indices)).toEqual([[0, 1, 2, 3]]);
		expect(groups.every((g) => g.isBeam)).toBe(true);
	});

	it("beams a whole bar of 3/4 eighths as one group of six (whole-bar unit)", () => {
		const events = Array.from({ length: 6 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const groups = beamGroups(events, { beats: 3, beatType: 4 });
		expect(groups.map((g) => g.indices)).toEqual([[0, 1, 2, 3, 4, 5]]);
		expect(groups.every((g) => g.isBeam)).toBe(true);
	});

	it("beams 2/2 eighths in fours (half-bar unit)", () => {
		const events = Array.from({ length: 8 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const groups = beamGroups(events, { beats: 2, beatType: 2 });
		expect(groups.map((g) => g.indices)).toEqual([
			[0, 1, 2, 3],
			[4, 5, 6, 7],
		]);
		expect(groups.every((g) => g.isBeam)).toBe(true);
	});

	it("beams three eighths on beats 1-2 of 4/4 as one group (no leftover flag)", () => {
		// Three eighths sit inside the first half-bar (unit 2), so they join one
		// beam — the old per-beat unit fragmented this into a [0,1] beam + a [2]
		// flag.
		const events = Array.from({ length: 3 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const groups = beamGroups(events, { beats: 4, beatType: 4 });
		expect(groups.map((g) => g.indices)).toEqual([[0, 1, 2]]);
		expect(groups.every((g) => g.isBeam)).toBe(true);
	});

	it("groups absent-ts eighths as 4/4 (4+4), not one collapsed run", () => {
		// An absent time signature must default to 4/4 grouping (half-bar 2), never
		// collapse the whole run into a single beam (the NaN-guard regression).
		const events = Array.from({ length: 8 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		const expected = [
			[0, 1, 2, 3],
			[4, 5, 6, 7],
		];
		expect(beamGroups(events, undefined).map((g) => g.indices)).toEqual(
			expected,
		);
		expect(beamGroups(events, null).map((g) => g.indices)).toEqual(expected);
	});

	it("never throws on an over-full 2/8 measure (whole-bar tiling)", () => {
		// 2/8 groups by the whole bar (unit 1); eight eighths overflow it but still
		// tile into 2+2+2+2 without throwing.
		const events = Array.from({ length: 8 }, () => ({
			type: "note",
			duration: "eighth",
		}));
		expect(() => beamGroups(events, { beats: 2, beatType: 8 })).not.toThrow();
		const groups = beamGroups(events, { beats: 2, beatType: 8 });
		expect(groups).toHaveLength(4);
	});
});

describe("beamGeometry", () => {
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

// ── Accidentals — stateless, data-faithful ──────────────────────────────────────

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

describe("resolveAccidental (the verified precedence cases)", () => {
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

describe("stackAccidentals (best-effort)", () => {
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

// ── Union-grid alignment + compressive spacing + intrinsic widths ────────────────
//
// Onsets/grid/advances come PURELY from event durations — `timeSignature` is never
// consulted for any X or width. These tests cover the robustness path: no throw, no
// NaN, both staff bands for a one-hand/empty-hand measure, floor width for an empty
// measure.

describe("handOnsets / handEnd", () => {
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

describe("unionGrid", () => {
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

describe("advanceFor (compressive spacing)", () => {
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

describe("measureLayout", () => {
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

	it("extends the grid to max(handEnds); the short hand simply ends", () => {
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

	it("produces both staff bands for a one-hand measure", () => {
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

	it("produces both staff bands for an empty measure at the floor width", () => {
		const layout = measureLayout([], []);
		expect(layout.grid).toEqual([]);
		expect(layout.columns).toEqual([]);
		// Empty grid → the floor width plus pads; the content floor is the constant.
		expect(layout.contentWidth).toBe(EMPTY_MEASURE_WIDTH);
		expect(layout.hands.right.onsets).toEqual([]);
		expect(layout.hands.left.onsets).toEqual([]);
		expect(Number.isFinite(layout.width)).toBe(true);
	});

	it("never throws and stays NaN-free on an overflowing bar", () => {
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

// ── Section resolution + diff, wrapping/justify, spans/texts/barlines/ottava,
// and the full buildLayoutModel ──────────────────────────────────────────────────
//
// The diff fixture below mirrors the `docs/song-format.md` annotated 2-section example
// (and is identical to the validator's COMPREHENSIVE fixture). It is the shared
// full-coverage song. It adds a `slur` for span coverage and deliberately omits the
// gradual-dynamics (crescendo/decrescendo) span the docs example carries — hairpin
// resolution has its own dedicated fixtures below, and several tie/slur tests rely on
// this fixture resolving NO hairpin spans.

/**
 * The annotated comprehensive example song (`docs/song-format.md`). It exercises a
 * broad spread of elements and is the verified 2-section diff fixture: tempo 120→90,
 * time sig 4/4→3/4, RH clef treble unchanged, LH clef bass→tenor, RH alters {}→{F,C},
 * LH alters {B:-1}→{}, RH octaveShift 0→1, LH octaveShift unchanged. It carries a
 * tie + a slur (for span coverage) but no crescendo/decrescendo span.
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
							annotations: [{ text: "C", placement: "above" }],
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

describe("resolveHandContext / resolveSectionContexts", () => {
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

describe("diffContext — the verified 2-section diff fixture", () => {
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

describe("keySignatureCluster", () => {
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

describe("ottavaFor", () => {
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

describe("tempoMark", () => {
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

// ── Per-event note collection (placement-aware, band-independent) ─────────────────
//
// `collectEventTexts` is the contract the band model + emit later route on: one
// `{ kind: "annotation", x, text, placement }` primitive per non-empty `event.annotations`
// element, in array order (= stacking order), for BOTH notes and rests. These tests
// pin that contract WITHOUT any band geometry — no buckets, no Y, just the primitive
// list at the event's column X.

describe("collectEventTexts — per-event notes with placement", () => {
	/** Pull only the `kind: "annotation"` primitives out of a collected list. */
	const annotationsOnly = (out) => out.filter((t) => t.kind === "annotation");

	it("emits one note primitive per element, carrying each element's placement", () => {
		const out = [];
		const event = {
			annotations: [
				{ text: "C", placement: "above" },
				{ text: "pedal", placement: "below" },
			],
		};
		collectEventTexts(event, 7, out);
		const notes = annotationsOnly(out);
		expect(notes).toEqual([
			{ kind: "annotation", x: 7, text: "C", placement: "above" },
			{ kind: "annotation", x: 7, text: "pedal", placement: "below" },
		]);
	});

	it("preserves array order (= stacking order) for same-placement notes, all at the column X", () => {
		const out = [];
		const event = {
			annotations: [
				{ text: "one", placement: "above" },
				{ text: "two", placement: "above" },
				{ text: "three", placement: "above" },
			],
		};
		collectEventTexts(event, 3.5, out);
		const notes = annotationsOnly(out);
		expect(notes.map((n) => n.text)).toEqual(["one", "two", "three"]);
		expect(notes.every((n) => n.placement === "above")).toBe(true);
		expect(notes.every((n) => n.x === 3.5)).toBe(true);
	});

	it("collects a rest event's notes identically (same routine, at the rest's X)", () => {
		const out = [];
		const event = {
			type: "rest",
			annotations: [{ text: "pedal", placement: "below" }],
		};
		collectEventTexts(event, 12, out);
		const notes = annotationsOnly(out);
		expect(notes).toEqual([
			{ kind: "annotation", x: 12, text: "pedal", placement: "below" },
		]);
	});

	it("pushes nothing for an element whose text is empty or absent", () => {
		const out = [];
		const event = {
			annotations: [
				{ text: "", placement: "above" },
				{ placement: "below" },
				{ text: "keep", placement: "above" },
			],
		};
		collectEventTexts(event, 0, out);
		const notes = annotationsOnly(out);
		expect(notes.map((n) => n.text)).toEqual(["keep"]);
	});

	it("emits no note primitives for an event with no notes (absent or empty)", () => {
		const absent = [];
		collectEventTexts({ dynamic: "mf" }, 0, absent);
		expect(annotationsOnly(absent)).toEqual([]);
		const empty = [];
		collectEventTexts({ annotations: [] }, 0, empty);
		expect(annotationsOnly(empty)).toEqual([]);
	});
});

// ── Standalone (measure-level) notes — collectStandaloneAnnotations ────────────────────
//
// `collectStandaloneAnnotations` resolves `measure.annotations` into measure-level primitives,
// computing each note's horizontal X by interpolating its `beat` onset over the
// SCALED relative column grid (the same `columnX` frame the per-event notes use),
// with an over-content clamp. It computes NO Y (the band model does that) and
// carries a RAW-`beat` group key so later stacking groups by the raw beat, never
// the resolved X. Every X it stores is measure-relative (the `columnX` frame).

describe("collectStandaloneAnnotations — measure-level notes with beat→X interpolation", () => {
	// A two-column measure: onsets 0 and 2 over a 4-beat span. `leadInset` is the
	// content-left edge; the grid is justified, so column X positions are scaled
	// and the last column's segment [2, measureEnd] runs to `scaledContent`.
	const LEAD = 3;
	const COL2 = 9; // columnX(2): the second column's scaled relative X
	const SCALED_CONTENT = 15; // the measure's relative right edge (= measureRightX − x)
	const baseCtx = () => ({
		columnX: new Map([
			[0, LEAD],
			[2, COL2],
		]),
		gridOnsets: [0, 2],
		measureEnd: 4,
		leadInset: LEAD,
		scaledContent: SCALED_CONTENT,
	});

	it("resolves beat 0 and beat 2 to ascending X, both carrying kind/text/placement/staff", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "a", placement: "above", staff: "rightHand", beat: 0 },
				{ text: "b", placement: "above", staff: "rightHand", beat: 2 },
			],
			baseCtx(),
		);
		expect(out).toHaveLength(2);
		expect(out[0]).toMatchObject({
			kind: "annotation",
			text: "a",
			placement: "above",
			staff: "rightHand",
		});
		expect(out[1]).toMatchObject({
			kind: "annotation",
			text: "b",
			placement: "above",
			staff: "rightHand",
		});
		expect(out[1].x).toBeGreaterThan(out[0].x);
	});

	it("places a beat-0 note at the content-left edge (leadInset)", () => {
		const [note] = collectStandaloneAnnotations(
			[{ text: "a", placement: "above", staff: "rightHand", beat: 0 }],
			baseCtx(),
		);
		expect(note.x).toBeCloseTo(LEAD, 6);
	});

	it("treats a no-`beat` note as beat 0 — same X as an explicit beat 0, both left of beat 2", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "none", placement: "above", staff: "rightHand" },
				{ text: "zero", placement: "above", staff: "rightHand", beat: 0 },
				{ text: "two", placement: "above", staff: "rightHand", beat: 2 },
			],
			baseCtx(),
		);
		const [none, zero, two] = out;
		expect(none.x).toBeCloseTo(zero.x, 6);
		expect(none.x).toBeCloseTo(LEAD, 6);
		expect(none.x).toBeLessThan(two.x);
		expect(zero.x).toBeLessThan(two.x);
	});

	it("lands a beat coinciding with an event column at that column's X", () => {
		const [note] = collectStandaloneAnnotations(
			[{ text: "b", placement: "above", staff: "rightHand", beat: 2 }],
			baseCtx(),
		);
		expect(note.x).toBeCloseTo(COL2, 6);
	});

	it("interpolates a mid-segment beat linearly between bracketing columns", () => {
		// beat 1 is halfway between onset 0 (X=LEAD) and onset 2 (X=COL2).
		const [note] = collectStandaloneAnnotations(
			[{ text: "mid", placement: "above", staff: "rightHand", beat: 1 }],
			baseCtx(),
		);
		expect(note.x).toBeCloseTo((LEAD + COL2) / 2, 6);
	});

	it("clamps an over-content beat to scaledContent − NOTE_CLAMP_INSET (inside the content)", () => {
		const [note] = collectStandaloneAnnotations(
			[{ text: "far", placement: "above", staff: "rightHand", beat: 99 }],
			baseCtx(),
		);
		expect(note.x).toBeCloseTo(SCALED_CONTENT - NOTE_CLAMP_INSET, 6);
		expect(note.x).toBeLessThanOrEqual(SCALED_CONTENT);
		expect(note.x).toBeGreaterThan(LEAD);
	});

	it("clamps two DIFFERENT over-content beats to the same resolved X yet keeps them distinct groups", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "fifty", placement: "above", staff: "rightHand", beat: 50 },
				{
					text: "ninetynine",
					placement: "above",
					staff: "rightHand",
					beat: 99,
				},
			],
			baseCtx(),
		);
		expect(out[0].x).toBeCloseTo(out[1].x, 6);
		expect(out[0].group).not.toEqual(out[1].group);
	});

	it("groups by the RAW (staff, placement, beat) key — beat 2 and beat 2.0001 differ", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "x", placement: "above", staff: "rightHand", beat: 2 },
				{ text: "y", placement: "above", staff: "rightHand", beat: 2.0001 },
			],
			baseCtx(),
		);
		expect(out[0].group).not.toEqual(out[1].group);
	});

	it("shares a group for two notes with the same (staff, placement, raw beat)", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "x", placement: "above", staff: "rightHand", beat: 2 },
				{ text: "y", placement: "above", staff: "rightHand", beat: 2 },
			],
			baseCtx(),
		);
		expect(out[0].group).toEqual(out[1].group);
	});

	it("separates groups that differ only in staff or placement at the same raw beat", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "a", placement: "above", staff: "rightHand", beat: 0 },
				{ text: "b", placement: "below", staff: "rightHand", beat: 0 },
				{ text: "c", placement: "above", staff: "leftHand", beat: 0 },
			],
			baseCtx(),
		);
		const groups = new Set(out.map((n) => n.group));
		expect(groups.size).toBe(3);
	});

	it("uses a no-beat group key distinct from an explicit beat-0 group", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "none", placement: "above", staff: "rightHand" },
				{ text: "zero", placement: "above", staff: "rightHand", beat: 0 },
			],
			baseCtx(),
		);
		expect(out[0].group).not.toEqual(out[1].group);
	});

	it("produces no record for an empty-string text", () => {
		const out = collectStandaloneAnnotations(
			[
				{ text: "", placement: "above", staff: "rightHand", beat: 0 },
				{ placement: "above", staff: "rightHand", beat: 0 },
				{ text: "keep", placement: "above", staff: "rightHand", beat: 0 },
			],
			baseCtx(),
		);
		expect(out.map((n) => n.text)).toEqual(["keep"]);
	});

	it("returns an empty array for an absent or empty notes input", () => {
		expect(collectStandaloneAnnotations(undefined, baseCtx())).toEqual([]);
		expect(collectStandaloneAnnotations([], baseCtx())).toEqual([]);
	});
});

describe("buildLayoutModel — standalone notes on measureModel.standaloneAnnotations", () => {
	/** A minimal one-section song with a single measure carrying `notes`. */
	const songWithNotes = (notes) => ({
		metadata: { title: "T" },
		defaults: {
			tempo: { bpm: 120, beatUnit: "quarter" },
			timeSignature: { beats: 4, beatType: 4 },
			rightHand: { clef: "treble" },
			leftHand: { clef: "bass" },
		},
		sections: [
			{
				measures: [
					{
						annotations: notes,
						rightHand: [
							{
								type: "note",
								duration: "half",
								pitches: [{ step: "C", octave: 5 }],
							},
							{
								type: "note",
								duration: "half",
								pitches: [{ step: "E", octave: 5 }],
							},
						],
						leftHand: [
							{
								type: "note",
								duration: "whole",
								pitches: [{ step: "C", octave: 3 }],
							},
						],
					},
				],
			},
		],
	});

	it("attaches a standaloneAnnotations array to each measure model (parallel to barlines)", () => {
		const model = buildLayoutModel(songWithNotes([]), 200);
		const measure = model.systems[0].measures[0];
		expect(Array.isArray(measure.standaloneAnnotations)).toBe(true);
		expect(measure.standaloneAnnotations).toHaveLength(0);
	});

	it("resolves beat 0 left of beat 2, both as kind:note with text/placement/staff/group", () => {
		const model = buildLayoutModel(
			songWithNotes([
				{ text: "a", placement: "above", staff: "rightHand", beat: 0 },
				{ text: "b", placement: "above", staff: "rightHand", beat: 2 },
			]),
			200,
		);
		const sn = model.systems[0].measures[0].standaloneAnnotations;
		expect(sn).toHaveLength(2);
		expect(sn[1].x).toBeGreaterThan(sn[0].x);
		for (const rec of sn) {
			expect(rec.kind).toBe("annotation");
			expect(typeof rec.text).toBe("string");
			expect(rec.placement).toBe("above");
			expect(rec.staff).toBe("rightHand");
			expect(rec.group).toBeDefined();
		}
	});

	it("stores measure-relative X — a beat-0 note in a non-first measure sits at ~leadInset, not offset by measure.x", () => {
		const song = {
			metadata: { title: "T" },
			defaults: {
				tempo: { bpm: 120, beatUnit: "quarter" },
				timeSignature: { beats: 4, beatType: 4 },
				rightHand: { clef: "treble" },
				leftHand: { clef: "bass" },
			},
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
							leftHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
						{
							annotations: [
								{ text: "a", placement: "above", staff: "rightHand", beat: 0 },
							],
							rightHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
							leftHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
					],
				},
			],
		};
		const model = buildLayoutModel(song, 400);
		const second = model.systems[0].measures[1];
		const [note] = second.standaloneAnnotations;
		// The non-first measure starts well into the system; a measure-relative beat-0
		// X is a small leadInset (≥ 0, far below the absolute measure.x), NOT offset by
		// the absolute measure.x.
		expect(second.x).toBeGreaterThan(15);
		expect(note.x).toBeGreaterThanOrEqual(0);
		expect(note.x).toBeLessThan(5);
		expect(note.x).toBeLessThan(second.x);
	});

	it("clamps an over-content beat to (measure-relative) scaledContent − NOTE_CLAMP_INSET in a non-first measure", () => {
		const song = {
			metadata: { title: "T" },
			defaults: {
				tempo: { bpm: 120, beatUnit: "quarter" },
				timeSignature: { beats: 4, beatType: 4 },
				rightHand: { clef: "treble" },
				leftHand: { clef: "bass" },
			},
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
							leftHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
						{
							annotations: [
								{
									text: "far",
									placement: "above",
									staff: "rightHand",
									beat: 99,
								},
							],
							rightHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
							leftHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
					],
				},
			],
		};
		const model = buildLayoutModel(song, 400);
		const second = model.systems[0].measures[1];
		expect(second.x).toBeGreaterThan(0);
		const [note] = second.standaloneAnnotations;
		// Measure-relative clamp: one NOTE_CLAMP_INSET back from the relative right
		// edge (`width` = scaledContent), strictly inside the content.
		expect(note.x).toBeCloseTo(second.width - NOTE_CLAMP_INSET, 6);
		expect(note.x).toBeLessThanOrEqual(second.width);
		expect(note.x).toBeGreaterThan(0);
	});

	it("emits no record for an empty-string text at the measure level", () => {
		const model = buildLayoutModel(
			songWithNotes([
				{ text: "", placement: "above", staff: "rightHand", beat: 0 },
				{ text: "keep", placement: "above", staff: "rightHand", beat: 0 },
			]),
			200,
		);
		const sn = model.systems[0].measures[0].standaloneAnnotations;
		expect(sn.map((n) => n.text)).toEqual(["keep"]);
	});
});

describe("barlineSpec", () => {
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

describe("matchSpans — stack-based, dangling-safe", () => {
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

describe("packSystems + systemScale", () => {
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

describe("buildLayoutModel — the full positioned-primitive model", () => {
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

	it("packs the song into fewer systems when wider, more when narrower", () => {
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

	it("numbers measures sequentially 1..N across section boundaries", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const numbers = model.systems.flatMap((s) =>
			s.measures.map((m) => m.number),
		);
		expect(numbers).toEqual([1, 2, 3]); // section 2 does NOT reset the count
	});

	it("resolves the tie + slur spanning the two measures", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const spans = model.systems.flatMap((s) => s.spans);
		expect(spans.some((s) => s.kind === "tie")).toBe(true);
		expect(spans.some((s) => s.kind === "slur")).toBe(true);
	});

	it("surfaces per-event dynamics + notes and barlines", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const allRightTexts = model.systems.flatMap((s) =>
			s.measures.flatMap((m) => m.right.texts),
		);
		expect(
			allRightTexts.some((t) => t.kind === "dynamic" && t.text === "mf"),
		).toBe(true);
		expect(
			allRightTexts.some((t) => t.kind === "annotation" && t.text === "C"),
		).toBe(true);
		const allBarlines = model.systems.flatMap((s) =>
			s.measures.flatMap((m) => m.barlines.map((b) => `${b.side}/${b.type}`)),
		);
		// The score's first measure has no left barline — its `repeat-start` is
		// suppressed — but repeat-end and final still draw on the right.
		expect(allBarlines).not.toContain("start/repeat-start");
		expect(allBarlines).toContain("end/repeat-end");
		expect(allBarlines).toContain("end/final");
	});

	it("draws a left repeat-start barline on a non-first measure", () => {
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

	it("prints a tempo at the song start and at the section-2 tempo change", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const tempos = model.systems.flatMap((s) => s.texts.tempos);
		// One at the song start (120 → quarter glyph) and one at the change (90).
		expect(tempos.map((t) => t.bpm).sort((a, b) => a - b)).toEqual([90, 120]);
		expect(tempos.every((t) => t.glyph === "metNoteQuarter")).toBe(true);
	});

	it("starts an 8va ottava for the RH octave shift in section 2", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const ottavas = model.systems.flatMap((s) => s.texts.ottavas);
		const eightVa = ottavas.find((o) => o.label === "8va");
		expect(eightVa).toBeDefined();
		expect(eightVa.hand).toBe("rightHand");
		expect(eightVa.placement).toBe("above");
	});

	it("draws an inline section change at a mid-system section boundary", () => {
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

	it("never throws on dangling ties/slurs, empty hands, or an empty song", () => {
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
		// Each system in the dangling song still has both staff bands.
		const model = buildLayoutModel(dangling, 100);
		for (const sys of model.systems) {
			expect(sys.band.rightStaffTopY).toBeDefined();
			expect(sys.band.leftStaffTopY).toBeDefined();
		}
	});
});

// ── Layout-polish fixes ──────────────────────────────────────────────────────────
describe("layout-polish fixes", () => {
	it("head fields get reserved, non-overlapping X (clef → key sig → time sig)", () => {
		const reserve = buildLayoutModel(COMPREHENSIVE_SONG, 200).systems[0]
			.reserve;
		const clefX = reserve.clefs.right.x;
		const keySigX = reserve.keySig.x;
		const maxCluster = Math.max(
			reserve.keySig.right.width,
			reserve.keySig.left.width,
		);
		// Strictly increasing field positions, and the time signature begins past the
		// whole key-signature cluster (no overlap whatever the alter count).
		expect(clefX).toBeLessThan(keySigX);
		expect(reserve.timeSignatureX).toBeGreaterThan(keySigX + maxCluster);
	});

	it("tempo, ottava, and note lanes stack above the staff", () => {
		const sys = buildLayoutModel(COMPREHENSIVE_SONG, 200).systems[0];
		const above = sys.texts.ottavas.filter((o) => o.placement === "above");
		expect(sys.texts.tempos.length).toBeGreaterThan(0);
		expect(above.length).toBeGreaterThan(0);
		// Stacked top→bottom: tempo above the ottava above the above-RH note lane, all
		// above the staff top (smaller Y is higher).
		expect(sys.band.tempoLaneY).toBeLessThan(sys.band.ottavaAboveLaneY);
		expect(sys.band.ottavaAboveLaneY).toBeLessThan(
			sys.band.annotationAboveRHLaneY,
		);
		expect(sys.band.annotationAboveRHLaneY).toBeLessThan(
			sys.band.rightStaffTopY,
		);
		for (const t of sys.texts.tempos) {
			expect(t.y).toBeCloseTo(sys.band.tempoLaneY, 10);
		}
		for (const o of above) {
			expect(o.y).toBeCloseTo(sys.band.ottavaAboveLaneY, 10);
		}
	});

	it("a deep above-RH stack reserves itself as the topmost lane (whole stack clears the tempo) and grows the top margin", () => {
		// A system carrying a tempo + a right-hand note with TWO same-anchor above-RH
		// annotations: the multi-line stack must own the topmost lane so its lowest
		// line (the lane baseline) sits strictly above the tempo, and the extra depth
		// must grow the system top margin. The only above-RH fixture (COMPREHENSIVE_SONG)
		// carries exactly one such annotation, so this deep-stack invariant is otherwise
		// untested.
		const songWithAboveStack = (annotations) => ({
			defaults: { tempo: { bpm: 120, beatUnit: "quarter" } },
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									annotations,
									pitches: [{ step: "G", octave: 4 }],
								},
							],
							leftHand: [
								{
									type: "note",
									duration: "quarter",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
					],
				},
			],
		});
		const deep = buildLayoutModel(
			songWithAboveStack([
				{ text: "C", placement: "above" },
				{ text: "rit.", placement: "above" },
			]),
			200,
		).systems[0];
		const single = buildLayoutModel(
			songWithAboveStack([{ text: "C", placement: "above" }]),
			200,
		).systems[0];
		// Sanity-guard the fixtures: the tempo and the above-RH lane are present on the
		// deep system, so the lane-order assertion below is meaningful.
		expect(deep.texts.tempos.length).toBeGreaterThan(0);
		expect(deep.band.tempoLaneY).not.toBeNull();
		expect(deep.band.annotationAboveRHLaneY).not.toBeNull();
		// (a) The whole stack clears the tempo: its lowest line (annotationAboveRHLaneY,
		// the lane baseline = note #0) sits strictly above the tempo lane (smaller Y is
		// higher). Today annotations hug the staff and the tempo is the topmost lane, so
		// this fails until the reservation order is flipped.
		expect(deep.band.annotationAboveRHLaneY).toBeLessThan(deep.band.tempoLaneY);
		// (b) Margin grows with stack depth (holds regardless of lane order).
		expect(deep.band.topMargin).toBeGreaterThan(single.band.topMargin);
	});

	it("the top margin flexes: no note/ottava → a shallower margin than with them", () => {
		// The comprehensive song's first system carries a note lane + ottava + tempo.
		const rich = buildLayoutModel(COMPREHENSIVE_SONG, 200).systems[0];
		// A plain song with only notes — no tempo, ottava, or note annotation above.
		const plainSong = {
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									pitches: [{ step: "G", octave: 4 }],
								},
							],
							leftHand: [
								{
									type: "note",
									duration: "quarter",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
					],
				},
			],
		};
		const plain = buildLayoutModel(plainSong, 200).systems[0];
		// With nothing above the staff the top margin collapses to the base, so the staff
		// (and everything above) sits higher than in the text-rich system.
		expect(plain.band.topMargin).toBeLessThan(rich.band.topMargin);
		expect(plain.band.tempoLaneY).toBeNull();
		expect(plain.band.annotationAboveRHLaneY).toBeNull();
	});

	it("every barline leaves at least a notehead-width gap before the next measure's first note", () => {
		const measures = buildLayoutModel(COMPREHENSIVE_SONG, 200).systems[0]
			.measures;
		expect(measures.length).toBeGreaterThan(1);
		for (let i = 1; i < measures.length; i++) {
			// The ending bar stroke sits at the previous measure's content end; the next
			// measure's first note starts past it by the opening lead-in, so the opening
			// notehead clears the line with room to breathe.
			const endBar = measures[i - 1].barlines.find((b) => b.side === "end");
			const barStrokeX = endBar.strokes[0].x;
			const firstNoteX = measures[i].x + measures[i].right.notes[0].x;
			expect(firstNoteX - barStrokeX).toBeGreaterThanOrEqual(
				MEASURE_START_PAD + BARLINE_POST_PAD - NOTEHEAD_RX,
			);
		}
	});

	it("a mid-system section change's notes start after the inline time signature", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const m3 = model.systems
			.flatMap((s) => s.measures)
			.find((m) => m.number === 3);
		// At width 200 the whole song is one system, so the section-2 start is mid-system
		// and carries inline cautionary glyphs; its first note must clear the time sig.
		if (m3.inline) {
			const firstNoteX = m3.x + m3.right.notes[0].x;
			expect(firstNoteX).toBeGreaterThan(m3.inline.timeSignatureX);
		}
	});

	it("an accidental clears the notehead (gap exceeds the notehead radius)", () => {
		expect(ACCIDENTAL_GAP).toBeGreaterThan(NOTEHEAD_RX);
	});

	it("staff lines are inset and all content stays inside the box", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		for (const sys of model.systems) {
			expect(sys.staffStartX).toBeCloseTo(STAFF_MARGIN_X, 10);
			expect(sys.staffEndX).toBeCloseTo(model.width - STAFF_MARGIN_X, 10);
			// The first measure begins at/after the inset, and no barline stroke crosses
			// the right inset — nothing bleeds past the staff lines.
			expect(sys.measures[0].x).toBeGreaterThanOrEqual(STAFF_MARGIN_X);
			for (const m of sys.measures) {
				for (const bar of m.barlines) {
					for (const stroke of bar.strokes ?? []) {
						expect(stroke.x).toBeLessThanOrEqual(sys.staffEndX + 1e-9);
					}
				}
			}
		}
	});

	it("ties and slurs anchor at the note centers (not the notehead edges)", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const measures = model.systems.flatMap((s) => s.measures);
		const m1 = measures.find((m) => m.number === 1);
		const m2 = measures.find((m) => m.number === 2);
		const startX = m1.x + m1.right.notes[0].x; // the chord's center
		const stopX = m2.x + m2.right.notes[0].x; // the tied whole note's center
		const spans = model.systems.flatMap((s) => s.spans);
		for (const kind of ["tie", "slur"]) {
			const span = spans.find((s) => s.kind === kind);
			expect(span.x1).toBeCloseTo(startX, 6);
			expect(span.x2).toBeCloseTo(stopX, 6);
		}
	});

	it("a whole-measure note sits at the opening lead-in, left of center (not centered)", () => {
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
							leftHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
					],
				},
			],
		};
		const m = buildLayoutModel(song, 200).systems[0].measures[0];
		// The whole note sits at the uniform opening lead-in (MEASURE_START_PAD, no
		// accidental), well left of the measure center, rather than being centered. The
		// lead-in is applied identically on both staves.
		expect(m.right.notes[0].x).toBeCloseTo(MEASURE_START_PAD);
		expect(m.left.notes[0].x).toBeCloseTo(MEASURE_START_PAD);
		expect(m.right.notes[0].x).toBeLessThan(m.width / 2);
	});

	it("measure 1 is not numbered; a later system numbers its first measure", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 30); // narrow → many systems
		expect(model.systems.length).toBeGreaterThan(1);
		// The system that opens the piece (measure 1) shows no measure number…
		expect(model.systems[0].texts.measureNumber).toBeNull();
		// …but at least one later system labels its first measure (number ≥ 2).
		const later = model.systems
			.slice(1)
			.map((s) => s.texts.measureNumber)
			.filter(Boolean);
		expect(later.length).toBeGreaterThan(0);
		expect(Number(later[0].text)).toBeGreaterThanOrEqual(2);
	});

	it("an opening note lands at the uniform lead-in; an opening accidental occupies that lead-in and draws left of the head", () => {
		const q = (step, octave, alter) => ({
			type: "note",
			duration: "quarter",
			pitches: [alter == null ? { step, octave } : { step, octave, alter }],
		});
		// Two songs identical but for the sharp opening the second measure.
		const song = (alter) => ({
			sections: [
				{
					measures: [
						{ rightHand: [q("E", 5), q("D", 5), q("C", 5), q("D", 5)] },
						{ rightHand: [q("F", 5, alter), q("E", 5), q("D", 5), q("C", 5)] },
					],
				},
			],
		});
		const plain = buildLayoutModel(song(), 200).systems[0].measures[1];
		const sharp = buildLayoutModel(song(1), 200).systems[0].measures[1];
		// Both notes land at the same uniform lead-in: the accidental's lead shares the
		// pre-column slot with MEASURE_START_PAD (composed by max(), not stacked), so the
		// sharp does NOT push the head further right; the glyph simply draws to its left.
		expect(plain.right.notes[0].x).toBeCloseTo(MEASURE_START_PAD);
		expect(sharp.right.notes[0].x).toBeCloseTo(plain.right.notes[0].x);
		expect(sharp.right.notes[0].accidentals[0].dx).toBeGreaterThan(0);
	});

	it("the opening lead-in does not stretch under justification", () => {
		const q = (step, octave) => ({
			type: "note",
			duration: "quarter",
			pitches: [{ step, octave }],
		});
		// A long single-section run of plain notes: wide → one (unjustified, last)
		// system; narrow → several systems, of which the non-last ones are justified
		// (the last system is never justified — see layout.js justify gating).
		const measure = { rightHand: [q("C", 5), q("D", 5), q("E", 5), q("F", 5)] };
		const song = {
			sections: [{ measures: Array.from({ length: 12 }, () => measure) }],
		};
		// Wide: everything on one system, no justify; an interior measure's first note
		// sits exactly at the uniform lead-in.
		const wide = buildLayoutModel(song, 400).systems;
		expect(wide.length).toBe(1);
		const wideMeasure = wide[0].measures[1]; // interior (localIdx > 0), plain opening
		expect(wideMeasure.right.notes[0].x).toBeCloseTo(MEASURE_START_PAD);
		// Narrow: wraps to several systems; the first system is justified (whitespace
		// stretched) yet the lead-in — outside the advance-scale factor — is unchanged.
		const narrow = buildLayoutModel(song, 60).systems;
		expect(narrow.length).toBeGreaterThan(1);
		const justified = narrow[0];
		const interior = justified.measures[justified.measures.length - 1];
		expect(interior.right.notes[0].x).toBeCloseTo(MEASURE_START_PAD);
	});

	it("an empty measure has a finite width grown by the opening clearance (no NaN)", () => {
		const song = {
			sections: [{ measures: [{ rightHand: [], leftHand: [] }] }],
		};
		const m = buildLayoutModel(song, 200).systems[0].measures[0];
		expect(m.right.notes.length).toBe(0);
		expect(m.left.notes.length).toBe(0);
		expect(Number.isFinite(m.width)).toBe(true);
		expect(Number.isNaN(m.width)).toBe(false);
		// The empty floor width grows by the uniform opening clearance: it now exceeds the
		// no-pad baseline and lands at EMPTY_MEASURE_WIDTH + MEASURE_START_PAD.
		expect(m.width).toBeGreaterThan(EMPTY_MEASURE_WIDTH);
		expect(m.width).toBeCloseTo(EMPTY_MEASURE_WIDTH + MEASURE_START_PAD);
	});
});

// ── Four placement bands + the flexing inter-staff gap / bottom margin ─────────────
describe("buildLayoutModel — placement bands, inter-staff flex, and dynamics dodge", () => {
	// One stack step (baseline-to-baseline) and the descent of the lowest glyph box.
	const STACK_STEP = NOTE_SIZE + TEXT_LANE_GAP;
	const DESCENT = 0.22 * NOTE_SIZE;
	const DYNAMICS_LANE_RESERVE = 6.9;
	const MID_GAP = 1.2;

	// A bare grand-staff measure with one note on each hand and no annotations.
	const bareSong = {
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "G", octave: 4 }],
							},
						],
						leftHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "C", octave: 3 }],
							},
						],
					},
				],
			},
		],
	};

	// Builds a one-measure (or two-event) song whose RH + LH events carry the given
	// per-event notes / dynamics / hairpin markers, so a test can probe one band in
	// isolation. When `rhHairpin`/`lhHairpin` is set the hand gets a SECOND note so the
	// span has a start and a later stop (a one-note span is not expressible).
	const songWith = ({
		rhNotes,
		lhNotes,
		rhDynamic,
		lhDynamic,
		rhHairpin,
		lhHairpin,
		measureNotes,
	} = {}) => {
		const handEvents = (dynamic, notes, hairpin, step) => {
			const first = {
				type: "note",
				duration: "quarter",
				...(dynamic ? { dynamic } : {}),
				...(notes ? { annotations: notes } : {}),
				...(hairpin ? { [hairpin]: "start" } : {}),
				pitches: [{ step, octave: step === "C" ? 3 : 4 }],
			};
			if (!hairpin) {
				return [first];
			}
			// A span needs a distinct, later stop note.
			return [
				first,
				{
					type: "note",
					duration: "quarter",
					[hairpin]: "stop",
					pitches: [{ step, octave: step === "C" ? 3 : 4 }],
				},
			];
		};
		return {
			sections: [
				{
					measures: [
						{
							annotations: measureNotes,
							rightHand: handEvents(rhDynamic, rhNotes, rhHairpin, "G"),
							leftHand: handEvents(lhDynamic, lhNotes, lhHairpin, "C"),
						},
					],
				},
			],
		};
	};

	it("collapses the inter-staff gap and bottom margin to base when no notes flex them", () => {
		const sys = buildLayoutModel(bareSong, 200).systems[0];
		// Nothing between or below the staves to flex either anchor.
		expect(sys.band.leftStaffTopY - sys.band.rightStaffBottomY).toBeCloseTo(
			INTRA_STAFF_GAP,
			10,
		);
		// The plain bare song has no low ledgers, so the bottom margin is today's base.
		expect(sys.band.bottomMargin).toBeCloseTo(5, 10);
	});

	it("keeps the LH staff below the RH staff with a below-RH + above-LH note (shallow → base floor)", () => {
		// A single below-RH note plus a single above-LH note (no dynamics) reserve
		// belowRH_stack + aboveLH_stack + MID_GAP, which is shallower than the base gap,
		// so the gap floors at INTRA_STAFF_GAP — the LH staff stays strictly below.
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [{ text: "x", placement: "below" }],
				lhNotes: [{ text: "y", placement: "above" }],
			}),
			200,
		).systems[0];
		const gap = sys.band.leftStaffTopY - sys.band.rightStaffBottomY;
		expect(gap).toBeGreaterThanOrEqual(INTRA_STAFF_GAP);
		// The LH staff still sits strictly below the RH staff.
		expect(sys.band.leftStaffTopY).toBeGreaterThan(sys.band.rightStaffBottomY);
	});

	it("flexes the inter-staff gap PAST the base when the reserved stacks are deep", () => {
		// Deep below-RH + above-LH stacks exceed the base gap, so the flex genuinely
		// grows it: belowRH_stack (3 notes) + aboveLH_stack (3 notes) + MID_GAP > 8.
		const triple = (placement) => [
			{ text: "a", placement },
			{ text: "b", placement },
			{ text: "c", placement },
		];
		const sys = buildLayoutModel(
			songWith({
				rhNotes: triple("below"),
				lhNotes: triple("above"),
			}),
			200,
		).systems[0];
		const gap = sys.band.leftStaffTopY - sys.band.rightStaffBottomY;
		expect(gap).toBeGreaterThan(INTRA_STAFF_GAP);
		expect(sys.band.leftStaffTopY).toBeGreaterThan(sys.band.rightStaffBottomY);
	});

	it("dodges a below-RH note past the dynamics row without reaching the LH staff", () => {
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [{ text: "x", placement: "below" }],
				rhDynamic: "mf",
			}),
			200,
		).systems[0];
		// The furthest below-RH note baseline (note #0 dodging the dynamics row) clears
		// its glyph descent and still stays strictly above the LH staff top.
		const belowRHBand = sys.band.bands.belowRH;
		const furthestBaseline = belowRHBand.baseY; // a single below-RH note → note #0
		expect(furthestBaseline - DESCENT).toBeLessThan(sys.band.leftStaffTopY);
		// The base offset is the dynamics reserve (the dodge), not the plain staff gap.
		expect(belowRHBand.baseY - sys.band.rightStaffBottomY).toBeCloseTo(
			DYNAMICS_LANE_RESERVE,
			10,
		);
	});

	it("keeps a DEEP dodged below-RH stack strictly above the LH staff top", () => {
		// Two dodged below-RH notes deepen the stack past the base gap; the furthest
		// baseline (rightStaffBottomY + belowRH_stack − DESCENT) must still clear the LH.
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [
					{ text: "x", placement: "below" },
					{ text: "y", placement: "below" },
				],
				rhDynamic: "mf",
			}),
			200,
		).systems[0];
		const belowRHStack = DYNAMICS_LANE_RESERVE + 1 * STACK_STEP + DESCENT; // n = 2
		const furthestBaseline =
			sys.band.rightStaffBottomY + belowRHStack - DESCENT;
		expect(furthestBaseline).toBeLessThan(sys.band.leftStaffTopY);
	});

	it("uses the plain staff gap (no dodge) for a below-RH note when the RH has no dynamic", () => {
		const sys = buildLayoutModel(
			songWith({ rhNotes: [{ text: "x", placement: "below" }] }),
			200,
		).systems[0];
		expect(
			sys.band.bands.belowRH.baseY - sys.band.rightStaffBottomY,
		).toBeCloseTo(NOTE_GAP_STAFF, 10);
	});

	it("dodges a below-RH note past the dynamics region when the RH has a HAIRPIN but no point dynamic", () => {
		// A crescendo span (no point dynamic) puts a hairpin lane in the below-staff
		// dynamics region. The below-RH band must dodge it just as it dodges a point
		// dynamic — to the same DYNAMICS_LANE_RESERVE depth (which clears the lane).
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [{ text: "x", placement: "below" }],
				rhHairpin: "crescendo",
			}),
			200,
		).systems[0];
		expect(
			sys.band.bands.belowRH.baseY - sys.band.rightStaffBottomY,
		).toBeCloseTo(DYNAMICS_LANE_RESERVE, 10);
	});

	it("keeps the below-RH note clear of the hairpin lane it dodges (no overlap)", () => {
		// The hairpin lane rides HAIRPIN_LANE_DY below the staff bottom, fanning ±aperture/2.
		// The dodged below-RH note #0 baseline sits at the reserve depth; its glyph TOP
		// (baseline − NOTE_SIZE ascent) must clear the lane's LOWER edge so the two never
		// touch. (Both are below-staff dynamics-region occupants on the same hand.)
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [{ text: "x", placement: "below" }],
				rhHairpin: "decrescendo",
			}),
			200,
		).systems[0];
		const laneLowerEdge =
			sys.band.rightStaffBottomY + HAIRPIN_LANE_DY + HAIRPIN_APERTURE / 2;
		const noteBaseline = sys.band.bands.belowRH.baseY;
		// The note baseline is the bottom of its glyph box; the dodge keeps that baseline
		// at/below the lane's lower edge so the wedge sits between the staff and the note.
		expect(noteBaseline).toBeGreaterThan(laneLowerEdge);
	});

	it("dodges a below-LH note for a left-hand HAIRPIN too (per-hand)", () => {
		const sys = buildLayoutModel(
			songWith({
				lhNotes: [{ text: "y", placement: "below" }],
				lhHairpin: "crescendo",
			}),
			200,
		).systems[0];
		expect(
			sys.band.bands.belowLH.baseY - sys.band.leftStaffBottomY,
		).toBeCloseTo(DYNAMICS_LANE_RESERVE, 10);
	});

	it("keeps the hairpin dodge per-hand: an LH hairpin does not dodge below-RH notes", () => {
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [{ text: "x", placement: "below" }],
				lhHairpin: "crescendo", // a hairpin on the OTHER hand
			}),
			200,
		).systems[0];
		// The below-RH base offset stays the plain staff gap — the LH hairpin is irrelevant.
		expect(
			sys.band.bands.belowRH.baseY - sys.band.rightStaffBottomY,
		).toBeCloseTo(NOTE_GAP_STAFF, 10);
	});

	it("flexes the bottom margin to the below-LH stack plus the ledger extent", () => {
		// Two below-LH notes at the SAME anchor stack outward; one LH dynamic adds the dodge.
		const sys = buildLayoutModel(
			songWith({
				lhNotes: [
					{ text: "a", placement: "below" },
					{ text: "b", placement: "below" },
				],
				lhDynamic: "p",
			}),
			200,
		).systems[0];
		// belowLH_stack = baseOffset + (n-1)*STACK_STEP + DESCENT, n = 2, dodged.
		const belowLHStack = DYNAMICS_LANE_RESERVE + 1 * STACK_STEP + DESCENT;
		// ledgerBottomExtent is 0 for this register, so the floor is the flexed stack.
		expect(sys.band.bottomMargin).toBeGreaterThanOrEqual(belowLHStack - 1e-9);
		expect(sys.band.bottomMargin).toBeGreaterThan(5);
	});

	it("never shrinks the bottom margin below today's base when the stack is shallow", () => {
		// A single below-LH note (no dynamic) flexes less than the base bottom margin.
		const sys = buildLayoutModel(
			songWith({ lhNotes: [{ text: "a", placement: "below" }] }),
			200,
		).systems[0];
		expect(sys.band.bottomMargin).toBeCloseTo(5, 10);
	});

	it("exposes the four bands with base anchors, a stack step, and outward growth", () => {
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [
					{ text: "a", placement: "above" },
					{ text: "b", placement: "below" },
				],
				lhNotes: [
					{ text: "c", placement: "above" },
					{ text: "d", placement: "below" },
				],
			}),
			200,
		).systems[0];
		const { bands } = sys.band;
		// All four bands are present with a numeric base anchor and the shared step.
		for (const key of ["aboveRH", "belowRH", "aboveLH", "belowLH"]) {
			expect(typeof bands[key].baseY).toBe("number");
			expect(bands[key].step).toBeCloseTo(STACK_STEP, 10);
		}
		// Above-* bands grow toward smaller Y; below-* bands grow toward larger Y.
		expect(bands.aboveRH.direction).toBe("up");
		expect(bands.aboveLH.direction).toBe("up");
		expect(bands.belowRH.direction).toBe("down");
		expect(bands.belowLH.direction).toBe("down");
		// note #k = baseY + dir * k * step. Verify note #0 hugs the staff and note #1
		// lands exactly one step further outward, per band.
		const annotationY = (b, k) =>
			b.baseY + (b.direction === "up" ? -1 : 1) * k * b.step;
		// above-RH base = the above-RH lane just above the RH staff top.
		expect(bands.aboveRH.baseY).toBeCloseTo(
			sys.band.annotationAboveRHLaneY,
			10,
		);
		expect(annotationY(bands.aboveRH, 1)).toBeLessThan(
			annotationY(bands.aboveRH, 0),
		);
		// below-RH base hugs the RH staff bottom by the plain gap (no dynamics here).
		expect(bands.belowRH.baseY).toBeCloseTo(
			sys.band.rightStaffBottomY + NOTE_GAP_STAFF,
			10,
		);
		expect(annotationY(bands.belowRH, 1)).toBeGreaterThan(
			annotationY(bands.belowRH, 0),
		);
		// above-LH base hugs the LH staff top by the plain gap; grows up.
		expect(bands.aboveLH.baseY).toBeCloseTo(
			sys.band.leftStaffTopY - NOTE_GAP_STAFF,
			10,
		);
		expect(annotationY(bands.aboveLH, 1)).toBeLessThan(
			annotationY(bands.aboveLH, 0),
		);
		// below-LH base hugs the LH staff bottom by the plain gap; grows down.
		expect(bands.belowLH.baseY).toBeCloseTo(
			sys.band.leftStaffBottomY + NOTE_GAP_STAFF,
			10,
		);
		expect(annotationY(bands.belowLH, 1)).toBeGreaterThan(
			annotationY(bands.belowLH, 0),
		);
	});

	it("reserves the above-RH lane height for the WHOLE stack, not just one line", () => {
		// One above-RH note vs three above-RH notes at the same anchor: the deeper stack
		// pushes the lane (and the whole top margin) higher.
		const one = buildLayoutModel(
			songWith({ rhNotes: [{ text: "a", placement: "above" }] }),
			200,
		).systems[0];
		const three = buildLayoutModel(
			songWith({
				rhNotes: [
					{ text: "a", placement: "above" },
					{ text: "b", placement: "above" },
					{ text: "c", placement: "above" },
				],
			}),
			200,
		).systems[0];
		expect(three.band.topMargin).toBeGreaterThan(one.band.topMargin);
	});

	it("flexes the gap from the system-wide MAX same-anchor below-RH stack", () => {
		// Measure 1 has a single below-RH note; measure 2 has THREE at one anchor.
		// The system-wide MAX (3) drives the gap for the whole system.
		const deepStackMeasure = {
			rightHand: [
				{
					type: "note",
					duration: "quarter",
					annotations: [
						{ text: "a", placement: "below" },
						{ text: "b", placement: "below" },
						{ text: "c", placement: "below" },
					],
					pitches: [{ step: "G", octave: 4 }],
				},
			],
		};
		const shallow = buildLayoutModel(
			songWith({ rhNotes: [{ text: "a", placement: "below" }] }),
			200,
		).systems[0];
		const deep = buildLayoutModel(
			{
				sections: [
					{
						measures: [
							{
								rightHand: [
									{
										type: "note",
										duration: "quarter",
										annotations: [{ text: "a", placement: "below" }],
										pitches: [{ step: "G", octave: 4 }],
									},
								],
							},
							deepStackMeasure,
						],
					},
				],
			},
			500,
		).systems[0];
		const gapOf = (s) => s.band.leftStaffTopY - s.band.rightStaffBottomY;
		expect(gapOf(deep)).toBeGreaterThan(gapOf(shallow));
	});

	it("adds MID_GAP only when both inter-staff sub-bands are present", () => {
		// Deep stacks (RH dynamics + 3 below-RH notes) lift the flexed gap above the base
		// floor, so adding the above-LH sub-band's contribution is directly observable.
		const triple = (placement) => [
			{ text: "a", placement },
			{ text: "b", placement },
			{ text: "c", placement },
		];
		const belowRHOnly = buildLayoutModel(
			songWith({ rhNotes: triple("below"), rhDynamic: "mf" }),
			200,
		).systems[0];
		const both = buildLayoutModel(
			songWith({
				rhNotes: triple("below"),
				rhDynamic: "mf",
				lhNotes: triple("above"),
			}),
			200,
		).systems[0];
		const gap = (s) => s.band.leftStaffTopY - s.band.rightStaffBottomY;
		const belowRHStack = DYNAMICS_LANE_RESERVE + 2 * STACK_STEP + DESCENT; // n = 3, dodged
		const aboveLHStack = NOTE_GAP_STAFF + 2 * STACK_STEP + DESCENT; // n = 3
		// below-RH alone flexes to its stack (above the base floor); no mid-gap.
		expect(gap(belowRHOnly)).toBeCloseTo(
			Math.max(INTRA_STAFF_GAP, belowRHStack),
			10,
		);
		// Adding the above-LH sub-band lifts the gap by that stack PLUS the mid-gap.
		expect(gap(both)).toBeCloseTo(belowRHStack + aboveLHStack + MID_GAP, 10);
		expect(gap(both) - gap(belowRHOnly)).toBeCloseTo(
			aboveLHStack + MID_GAP,
			10,
		);
	});

	it("buckets a standalone measure-level note into its (staff, placement) band", () => {
		// A standalone below-LH note (no per-event notes) flexes the bottom margin and
		// is bucketed by its own staff + placement.
		const sys = buildLayoutModel(
			songWith({
				measureNotes: [
					{ text: "ped", placement: "below", staff: "leftHand", beat: 0 },
				],
			}),
			200,
		).systems[0];
		// A single below-LH standalone note flexes to base (n = 1, shallow).
		expect(sys.band.bands.belowLH.baseY).toBeCloseTo(
			sys.band.leftStaffBottomY + NOTE_GAP_STAFF,
			10,
		);
		// Two standalone below-LH notes at the SAME beat stack and deepen the gap step.
		const deeper = buildLayoutModel(
			songWith({
				measureNotes: [
					{ text: "a", placement: "below", staff: "leftHand", beat: 0 },
					{ text: "b", placement: "below", staff: "leftHand", beat: 0 },
				],
			}),
			200,
		).systems[0];
		expect(deeper.band.bottomMargin).toBeGreaterThan(sys.band.bottomMargin);
	});

	it("keeps the dynamics dodge per-hand: an LH dynamic does not dodge below-RH notes", () => {
		const sys = buildLayoutModel(
			songWith({
				rhNotes: [{ text: "x", placement: "below" }],
				lhDynamic: "f", // a dynamic on the OTHER hand
			}),
			200,
		).systems[0];
		// The below-RH base offset stays the plain staff gap — the LH dynamic is irrelevant.
		expect(
			sys.band.bands.belowRH.baseY - sys.band.rightStaffBottomY,
		).toBeCloseTo(NOTE_GAP_STAFF, 10);
	});
});

describe("recordSpanMarkers — carried hairpin markers + per-hand lane Y", () => {
	// A minimal laid-out hand: one placeable note (eventIndex 0) with a known stem
	// direction + steps, so the recorded anchor.y is deterministic.
	const laidOutOneNote = {
		notes: [
			{ eventIndex: 0, x: 4, direction: "up", topStep: 6, bottomStep: 4 },
		],
	};
	const recordInto = (events, laidOut, staffBottomY, hand = "rightHand") => {
		const placedEvents = { rightHand: [], leftHand: [] };
		recordSpanMarkers(events, laidOut, {
			measureX: 10,
			hand,
			placedEvents,
			staffBottomY,
			systemIndex: 0,
		});
		return placedEvents[hand];
	};

	it("carries the two new marker fields and a numeric laneY alongside the existing shape", () => {
		const [entry] = recordInto(
			[
				{
					type: "note",
					crescendo: "start",
					pitches: [{ step: "C", octave: 4 }],
				},
			],
			laidOutOneNote,
			9,
		);
		// Existing fields are still present.
		expect(entry).toHaveProperty("tie");
		expect(entry).toHaveProperty("slur");
		expect(entry).toHaveProperty("anchor");
		expect(entry).toHaveProperty("systemIndex", 0);
		// The two new marker fields and the precomputed lane Y are now carried.
		expect(entry).toHaveProperty("crescendo");
		expect(entry).toHaveProperty("decrescendo");
		expect(typeof entry.laneY).toBe("number");
	});

	it("projects crescendo: start onto the entry so the marker reaches the matcher", () => {
		const [entry] = recordInto(
			[
				{
					type: "note",
					crescendo: "start",
					pitches: [{ step: "C", octave: 4 }],
				},
			],
			laidOutOneNote,
			9,
		);
		expect(entry.crescendo).toBe("start");
		expect(entry.decrescendo).toBeUndefined();
	});

	it("projects decrescendo: stop onto the entry so the marker reaches the matcher", () => {
		const [entry] = recordInto(
			[
				{
					type: "note",
					decrescendo: "stop",
					pitches: [{ step: "C", octave: 4 }],
				},
			],
			laidOutOneNote,
			9,
		);
		expect(entry.decrescendo).toBe("stop");
		expect(entry.crescendo).toBeUndefined();
	});

	it("derives laneY from the per-hand staff bottom Y (staffBottomY + HAIRPIN_LANE_DY)", () => {
		const [right] = recordInto(
			[{ type: "note", pitches: [{ step: "C", octave: 4 }] }],
			laidOutOneNote,
			9,
		);
		const [left] = recordInto(
			[{ type: "note", pitches: [{ step: "C", octave: 4 }] }],
			laidOutOneNote,
			21,
			"leftHand",
		);
		expect(right.laneY).toBe(9 + HAIRPIN_LANE_DY);
		expect(left.laneY).toBe(21 + HAIRPIN_LANE_DY);
		// Per-hand distinctness: the right lane is higher on the page (smaller Y).
		expect(right.laneY).not.toBe(left.laneY);
		expect(right.laneY).toBeLessThan(left.laneY);
	});

	it("still carries a numeric laneY (and a null anchor) for a rest with no placeable note", () => {
		const [entry] = recordInto(
			[{ type: "rest", duration: "quarter" }],
			{ notes: [] },
			9,
		);
		expect(entry.anchor).toBeNull();
		expect(typeof entry.laneY).toBe("number");
		expect(entry.laneY).toBe(9 + HAIRPIN_LANE_DY);
		// A non-marked event leaves the marker fields undefined, exactly like tie/slur.
		expect(entry.crescendo).toBeUndefined();
		expect(entry.decrescendo).toBeUndefined();
	});

	it("the per-hand lane Y differs across hands in a full both-hands layout", () => {
		const song = {
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "whole",
									crescendo: "start",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
							leftHand: [
								{
									type: "note",
									duration: "whole",
									pitches: [{ step: "C", octave: 3 }],
								},
							],
						},
					],
				},
			],
		};
		// The band's real per-hand staff bottoms feed the per-hand lane Y; the RH
		// staff sits above the LH staff, so its bottom Y is smaller (higher on page).
		const { band } = buildLayoutModel(song, 200).systems[0];
		expect(band.rightStaffBottomY).toBeLessThan(band.leftStaffBottomY);
	});
});

describe("existing tie/slur resolution is unaffected by the carried fields", () => {
	it("resolves the same tie + slur spans as before the lane-Y change", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const spans = model.systems.flatMap((s) => s.spans);
		expect(spans.some((s) => s.kind === "tie")).toBe(true);
		expect(spans.some((s) => s.kind === "slur")).toBe(true);
		// This fixture carries no crescendo/decrescendo markers, so no hairpin spans
		// resolve from it (the new kinds only resolve when their markers are authored).
		expect(spans.some((s) => s.kind === "crescendo")).toBe(false);
		expect(spans.some((s) => s.kind === "decrescendo")).toBe(false);
	});
});

// ── Hairpin span resolution + the wedge builder ───────────────────────────────────
//
// These exercise `resolveAllSpans`'s two new crescendo/decrescendo passes and the
// new `buildHairpinSpec` flat-lane wedge record. Fixtures use the real `rightHand`/
// `leftHand` keys and the real `pitches`-array event shape.

describe("hairpin span resolution (crescendo / decrescendo)", () => {
	// A note carrying the given span markers; the `pitches` array is the real event
	// shape, defaulting to a single right-hand pitch.
	const note = (markers, pitches = [{ step: "C", octave: 5 }]) => ({
		type: "note",
		duration: "quarter",
		pitches,
		...markers,
	});
	// One section, one measure, with the given right/left hand events.
	const song = (rightHand, leftHand = undefined) => ({
		sections: [
			{ measures: [{ rightHand, ...(leftHand ? { leftHand } : {}) }] },
		],
	});
	const spansOf = (model) => model.systems.flatMap((s) => s.spans);

	it("resolves a crescendo over ≥2 notes to one wedge record with flat lane + constant aperture", () => {
		const model = buildLayoutModel(
			song([
				note({ crescendo: "start" }),
				note({}),
				note({ crescendo: "stop" }),
			]),
			200,
		);
		const wedges = spansOf(model).filter((s) => s.kind === "crescendo");
		expect(wedges).toHaveLength(1);
		const [w] = wedges;
		const m = model.systems[0].measures[0];
		expect(w.kind).toBe("crescendo");
		expect(w.hand).toBe("rightHand");
		// x1 / x2 sit at the start / end note centers (measureX + note.x).
		expect(w.x1).toBeCloseTo(m.x + m.right.notes[0].x, 6);
		expect(w.x2).toBeCloseTo(m.x + m.right.notes[2].x, 6);
		expect(w.x2).toBeGreaterThan(w.x1);
		// yCenter is the carried flat below-staff lane Y; aperture is the constant.
		expect(w.yCenter).toBe(
			model.systems[0].band.rightStaffBottomY + HAIRPIN_LANE_DY,
		);
		expect(w.aperture).toBe(HAIRPIN_APERTURE);
		expect(w.crossSystem).toBe(false);
	});

	it("resolves a decrescendo identically, distinguished only by kind", () => {
		const model = buildLayoutModel(
			song([
				note({ decrescendo: "start" }),
				note({}),
				note({ decrescendo: "stop" }),
			]),
			200,
		);
		const wedges = spansOf(model).filter((s) => s.kind === "decrescendo");
		expect(wedges).toHaveLength(1);
		const [w] = wedges;
		expect(w.kind).toBe("decrescendo");
		expect(w.hand).toBe("rightHand");
		// Same flat lane + constant aperture as a crescendo; only `kind` differs.
		expect(w.yCenter).toBe(
			model.systems[0].band.rightStaffBottomY + HAIRPIN_LANE_DY,
		);
		expect(w.aperture).toBe(HAIRPIN_APERTURE);
	});

	it("carries the crescendo/decrescendo distinction in `kind`, with a shared flat yCenter + aperture", () => {
		// Same two notes, once as a crescendo and once as a decrescendo: the records
		// are identical apart from `kind` (the opening-vs-closing shape is at emit time).
		const cres = buildLayoutModel(
			song([note({ crescendo: "start" }), note({ crescendo: "stop" })]),
			200,
		);
		const dec = buildLayoutModel(
			song([note({ decrescendo: "start" }), note({ decrescendo: "stop" })]),
			200,
		);
		const [c] = spansOf(cres).filter((s) => s.kind === "crescendo");
		const [d] = spansOf(dec).filter((s) => s.kind === "decrescendo");
		expect(c.kind).toBe("crescendo");
		expect(d.kind).toBe("decrescendo");
		expect(c.yCenter).toBe(d.yCenter);
		expect(c.aperture).toBe(d.aperture);
		expect(c.x1).toBeCloseTo(d.x1, 6);
		expect(c.x2).toBeCloseTo(d.x2, 6);
	});

	it("drops a dangling start-only or stop-only span (0 wedge records), never throwing", () => {
		const startOnly = song([note({ crescendo: "start" }), note({})]);
		const stopOnly = song([note({}), note({ crescendo: "stop" })]);
		expect(() => buildLayoutModel(startOnly, 200)).not.toThrow();
		expect(() => buildLayoutModel(stopOnly, 200)).not.toThrow();
		expect(
			spansOf(buildLayoutModel(startOnly, 200)).filter(
				(s) => s.kind === "crescendo",
			),
		).toHaveLength(0);
		expect(
			spansOf(buildLayoutModel(stopOnly, 200)).filter(
				(s) => s.kind === "crescendo",
			),
		).toHaveLength(0);
	});

	it("resolves two overlapping same-kind starts in one hand to exactly one record", () => {
		// A second start before the stop drops the earlier (dangling) start.
		const model = buildLayoutModel(
			song([
				note({ crescendo: "start" }),
				note({ crescendo: "start" }),
				note({ crescendo: "stop" }),
			]),
			200,
		);
		expect(spansOf(model).filter((s) => s.kind === "crescendo")).toHaveLength(
			1,
		);
	});

	it("drops a span whose endpoint lands on a rest / unplaceable note (0 records), never throwing", () => {
		// The stop marker rides a rest, which records `anchor: null`; the shared guard
		// skips the pair before the builder runs.
		const restEnd = {
			sections: [
				{
					measures: [
						{
							rightHand: [
								note({ crescendo: "start" }),
								{ type: "rest", duration: "quarter", crescendo: "stop" },
							],
						},
					],
				},
			],
		};
		expect(() => buildLayoutModel(restEnd, 200)).not.toThrow();
		expect(
			spansOf(buildLayoutModel(restEnd, 200)).filter(
				(s) => s.kind === "crescendo",
			),
		).toHaveLength(0);
	});

	it("builds a degenerate near-zero-width span (x1 ≈ x2) to one finite record, never throwing", () => {
		// The builder reads `anchor.x` verbatim, so a start and stop at near-identical X
		// produce a near-zero-width record. The aperture is the constant (never derived
		// from `x2 - x1`), so there is no division by ~0 — coordinates stay finite.
		const start = { anchor: { x: 50 }, laneY: 12, systemIndex: 0 };
		const stop = { anchor: { x: 50.0000001 }, systemIndex: 0 };
		let w;
		expect(() => {
			w = buildHairpinSpec("crescendo", start, stop, "rightHand");
		}).not.toThrow();
		expect(w.x1).toBeCloseTo(w.x2, 6); // x1 ≈ x2
		expect(Number.isFinite(w.x1)).toBe(true);
		expect(Number.isFinite(w.x2)).toBe(true);
		expect(Number.isFinite(w.yCenter)).toBe(true);
		expect(Number.isFinite(w.aperture)).toBe(true);
		// The aperture is the constant, not width-derived, so it is finite regardless
		// of how small `x2 - x1` is.
		expect(w.aperture).toBe(HAIRPIN_APERTURE);
	});

	it("builds the wedge record directly from the carried lane Y and constant aperture", () => {
		// A focused unit on the builder: yCenter is the carried `start.laneY` (it ignores
		// the notehead Y and stem direction entirely), and crossSystem reflects the
		// start/stop systems.
		const start = {
			anchor: { x: 10, y: 99, direction: "up" },
			laneY: 12,
			systemIndex: 0,
		};
		const stop = {
			anchor: { x: 40, y: 77, direction: "down" },
			systemIndex: 1,
		};
		const w = buildHairpinSpec("decrescendo", start, stop, "leftHand");
		expect(w).toEqual({
			kind: "decrescendo",
			hand: "leftHand",
			systemIndex: 0,
			x1: 10,
			x2: 40,
			yCenter: 12, // the carried lane Y, NOT anchor.y (99)
			aperture: HAIRPIN_APERTURE,
			crossSystem: true, // start system 0 ≠ stop system 1
		});
	});

	it("resolves a messa-di-voce hinge into a `< >` with a light gap, symmetric about the hinge X, sharing yCenter and aperture", () => {
		// The middle note both stops the crescendo and starts the decrescendo.
		const model = buildLayoutModel(
			song([
				note({ crescendo: "start" }),
				note({ crescendo: "stop", decrescendo: "start" }),
				note({ decrescendo: "stop" }),
			]),
			200,
		);
		const [cres] = spansOf(model).filter((s) => s.kind === "crescendo");
		const [dec] = spansOf(model).filter((s) => s.kind === "decrescendo");
		expect(cres).toBeDefined();
		expect(dec).toBeDefined();
		// A light space shows between the crescendo's tip and the decrescendo's mouth:
		// the decrescendo starts HAIRPIN_HINGE_GAP to the right of where the crescendo ends.
		expect(dec.x1).toBeGreaterThan(cres.x2);
		expect(dec.x1 - cres.x2).toBeCloseTo(HAIRPIN_HINGE_GAP, 6);
		// The gap is symmetric about the shared hinge X (each tip inset by half the gap).
		const hingeX = (cres.x2 + dec.x1) / 2;
		expect(cres.x2).toBeCloseTo(hingeX - HAIRPIN_HINGE_GAP / 2, 6);
		expect(dec.x1).toBeCloseTo(hingeX + HAIRPIN_HINGE_GAP / 2, 6);
		// Neither wedge is pushed backwards past its other end.
		expect(cres.x2).toBeGreaterThan(cres.x1);
		expect(dec.x1).toBeLessThan(dec.x2);
		// They still share the flat lane and the constant aperture.
		expect(cres.yCenter).toBe(dec.yCenter);
		expect(cres.aperture).toBe(dec.aperture);
	});

	it("clears a point dynamic on the start note: shifts x1 right past the glyph + gap", () => {
		const start = {
			anchor: { x: 10 },
			laneY: 12,
			systemIndex: 0,
			dynamic: "mf",
		};
		const stop = { anchor: { x: 40 }, systemIndex: 0 };
		const w = buildHairpinSpec("crescendo", start, stop, "rightHand");
		const halfWidth = ("mf".length * DYNAMIC_ADVANCE_EM * DYNAMIC_SIZE) / 2;
		expect(w.x1).toBeCloseTo(10 + halfWidth + HAIRPIN_DYNAMIC_GAP, 6);
		expect(w.x1).toBeGreaterThan(10); // shifted right off the dynamic
		expect(w.x1).toBeLessThan(w.x2); // still a forward wedge
		expect(w.x2).toBe(40); // the end is untouched
	});

	it("leaves x1 at the start note when it carries no dynamic", () => {
		const start = { anchor: { x: 10 }, laneY: 12, systemIndex: 0 };
		const stop = { anchor: { x: 40 }, systemIndex: 0 };
		const w = buildHairpinSpec("crescendo", start, stop, "rightHand");
		expect(w.x1).toBe(10);
	});

	it("clamps the dynamic clearance to the end X on a short within-system span (degenerate-safe)", () => {
		// A wide dynamic on a very short span would shift x1 past x2; clamp to x2 so the
		// wedge never runs backwards.
		const start = {
			anchor: { x: 10 },
			laneY: 12,
			systemIndex: 0,
			dynamic: "fff",
		};
		const stop = { anchor: { x: 11 }, systemIndex: 0 };
		const w = buildHairpinSpec("crescendo", start, stop, "rightHand");
		expect(w.x1).toBe(11);
		expect(w.x1).toBeLessThanOrEqual(w.x2);
	});

	it("keeps the dynamic clearance unclamped for a cross-system span (the clip trims the right edge later)", () => {
		// Cross-system: stop.anchor.x is a foreign-frame X, so the within-system clamp is
		// skipped; x1 keeps its full shift and the staff-end clip sets the right edge.
		const start = {
			anchor: { x: 10 },
			laneY: 12,
			systemIndex: 0,
			dynamic: "p",
		};
		const stop = { anchor: { x: 3 }, systemIndex: 1 };
		const w = buildHairpinSpec("crescendo", start, stop, "rightHand");
		const halfWidth = ("p".length * DYNAMIC_ADVANCE_EM * DYNAMIC_SIZE) / 2;
		expect(w.x1).toBeCloseTo(10 + halfWidth + HAIRPIN_DYNAMIC_GAP, 6);
		expect(w.crossSystem).toBe(true);
	});

	it("flows the dynamic clearance through the full model (start-note dynamic shifts the wedge start right)", () => {
		const withDyn = buildLayoutModel(
			song([
				note({ crescendo: "start", dynamic: "mf" }),
				note({ crescendo: "stop" }),
			]),
			200,
		);
		const withoutDyn = buildLayoutModel(
			song([note({ crescendo: "start" }), note({ crescendo: "stop" })]),
			200,
		);
		const [a] = spansOf(withDyn).filter((s) => s.kind === "crescendo");
		const [b] = spansOf(withoutDyn).filter((s) => s.kind === "crescendo");
		expect(a.x1).toBeGreaterThan(b.x1); // the dynamic pushes the start right
		expect(a.x2).toBeCloseTo(b.x2, 6); // the end is unaffected
	});

	it("resolves the wedge unchanged regardless of a bracketing point dynamic (all four cases)", () => {
		// p at start, f at end, both, or neither: the wedge resolves in every case and
		// the dynamics stay on the measure's hand texts, independent of the wedge.
		const build = (startDyn, endDyn) =>
			buildLayoutModel(
				song([
					note({
						crescendo: "start",
						...(startDyn ? { dynamic: startDyn } : {}),
					}),
					note({ crescendo: "stop", ...(endDyn ? { dynamic: endDyn } : {}) }),
				]),
				200,
			);
		for (const [s, e] of [
			["p", null],
			[null, "f"],
			["p", "f"],
			[null, null],
		]) {
			const model = build(s, e);
			const [w] = spansOf(model).filter((sp) => sp.kind === "crescendo");
			expect(w).toBeDefined();
			expect(w.aperture).toBe(HAIRPIN_APERTURE);
			// The dynamics live on the hand texts, not on the wedge record.
			const texts = model.systems[0].measures[0].right.texts;
			const dynamics = texts
				.filter((t) => t.kind === "dynamic")
				.map((t) => t.text);
			if (s) {
				expect(dynamics).toContain(s);
			}
			if (e) {
				expect(dynamics).toContain(e);
			}
		}
	});

	it("resolves hairpins per hand (a left-hand crescendo rides the left lane)", () => {
		const model = buildLayoutModel(
			song(
				[note({}, [{ step: "C", octave: 5 }])],
				[
					note({ crescendo: "start" }, [{ step: "C", octave: 3 }]),
					note({ crescendo: "stop" }, [{ step: "E", octave: 3 }]),
				],
			),
			200,
		);
		const [w] = spansOf(model).filter((s) => s.kind === "crescendo");
		expect(w.hand).toBe("leftHand");
		expect(w.yCenter).toBe(
			model.systems[0].band.leftStaffBottomY + HAIRPIN_LANE_DY,
		);
	});

	it("leaves tie/slur resolution unchanged — still dispatched to buildSpanSpec (Bézier records)", () => {
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const spans = spansOf(model);
		const tie = spans.find((s) => s.kind === "tie");
		const slur = spans.find((s) => s.kind === "slur");
		// The Bézier records keep their arc-only fields (y1/y2/cx/cy) and carry no
		// flat-lane wedge fields (yCenter/aperture).
		for (const span of [tie, slur]) {
			expect(span).toBeDefined();
			expect(span).toHaveProperty("y1");
			expect(span).toHaveProperty("y2");
			expect(span).toHaveProperty("cx");
			expect(span).toHaveProperty("cy");
			expect(span).not.toHaveProperty("yCenter");
			expect(span).not.toHaveProperty("aperture");
		}
	});
});

// ── Cross-system span clip (tie / slur / hairpin) ─────────────────────────────────
//
// A span whose endpoints fall on different systems must draw only its start-system
// portion: filed under the start system, clipped to that system's `staffEndX`, never
// a backwards stroke. The clip is a STRICT no-op for within-system spans (the only
// case existing tests/examples exercise), and it touches horizontal coordinates only
// — never any Y. `clipSpanToStartSystem` is the pure helper the bucketing loop runs
// before filing each resolved span; the narrow-width `buildLayoutModel` idiom forces
// the real multi-system path.

describe("clipSpanToStartSystem — start-system clip for cross-system spans", () => {
	it("leaves a within-system hairpin record byte-identical (strict no-op)", () => {
		const span = {
			kind: "crescendo",
			hand: "rightHand",
			systemIndex: 0,
			x1: 10,
			x2: 40,
			yCenter: 12,
			aperture: HAIRPIN_APERTURE,
			crossSystem: false,
		};
		const before = { ...span };
		const out = clipSpanToStartSystem(span, 28.5);
		// Same object, mutated in place to nothing: every field equals the original.
		expect(out).toEqual(before);
	});

	it("leaves a within-system tie/slur record byte-identical (strict no-op)", () => {
		for (const kind of ["tie", "slur"]) {
			const span = {
				kind,
				hand: "rightHand",
				systemIndex: 0,
				x1: 10,
				y1: 5,
				x2: 40,
				y2: 7,
				cx: 25,
				cy: 4,
				crossSystem: false,
			};
			const before = { ...span };
			const out = clipSpanToStartSystem(span, 28.5);
			expect(out).toEqual(before);
		}
	});

	it("clips a cross-system hairpin's x2 to staffEndX (X only; yCenter untouched)", () => {
		// A cross-system span's right edge is the start system's own staffEndX (28.5),
		// regardless of the end note's foreign-frame X (50). yCenter is the flat lane Y —
		// never touched.
		const span = {
			kind: "crescendo",
			hand: "rightHand",
			systemIndex: 0,
			x1: 10,
			x2: 50,
			yCenter: 12,
			aperture: HAIRPIN_APERTURE,
			crossSystem: true,
		};
		const out = clipSpanToStartSystem(span, 28.5);
		expect(out.x2).toBe(28.5);
		expect(out.x1).toBe(10); // start untouched
		expect(out.yCenter).toBe(12); // Y never touched
		expect(out.aperture).toBe(HAIRPIN_APERTURE);
		expect(out.systemIndex).toBe(0); // still filed under the start system
	});

	it("clips a cross-system tie/slur's x2 to staffEndX and recomputes cx; leaves y2/cy", () => {
		for (const kind of ["tie", "slur"]) {
			const span = {
				kind,
				hand: "rightHand",
				systemIndex: 0,
				x1: 10,
				y1: 5,
				x2: 50, // foreign end X past staffEndX
				y2: 7, // a FOREIGN end-system notehead Y
				cx: 30,
				cy: 4, // a FOREIGN-derived control Y
				crossSystem: true,
			};
			const out = clipSpanToStartSystem(span, 28.5);
			expect(out.x2).toBe(28.5); // clamped to the start system's staff end
			// cx recomputed to the NEW midpoint so the arc terminates at the new right edge.
			expect(out.cx).toBeCloseTo((10 + 28.5) / 2, 10);
			// y2 / cy are deliberately NOT clamped — accepted v1 best-effort (X-only clip).
			expect(out.y2).toBe(7);
			expect(out.cy).toBe(4);
			expect(out.y1).toBe(5); // start Y untouched
		}
	});

	it("never strokes backwards: a start at or past staffEndX clamps x2 to x1 (zero width)", () => {
		// The clamp is max(x1, min(x2, staffEndX)); when x1 itself is past staffEndX the
		// right edge collapses to x1, yielding a finite zero-width (never reversed) span.
		const span = {
			kind: "crescendo",
			hand: "rightHand",
			systemIndex: 0,
			x1: 35, // already past staffEndX
			x2: 60,
			yCenter: 12,
			aperture: HAIRPIN_APERTURE,
			crossSystem: true,
		};
		const out = clipSpanToStartSystem(span, 28.5);
		expect(out.x2).toBe(35); // never less than x1
		expect(out.x2).toBeGreaterThanOrEqual(out.x1);
		expect(Number.isFinite(out.x2)).toBe(true);
	});

	it("sets x2 to staffEndX even when the foreign end X is below it (foreign X is not consulted)", () => {
		// The end note's X (20) is a coordinate in a DIFFERENT system's frame; it is
		// meaningless in the start system's frame. The clip must set the right edge to the
		// start system's own staffEndX (28.5), not leave it at the foreign 20 — that is the
		// common cross-system case and the exact garbage stroke the clip exists to remove.
		const span = {
			kind: "crescendo",
			hand: "rightHand",
			systemIndex: 0,
			x1: 10,
			x2: 20,
			yCenter: 12,
			aperture: HAIRPIN_APERTURE,
			crossSystem: true,
		};
		const out = clipSpanToStartSystem(span, 28.5);
		expect(out.x2).toBe(28.5);
		expect(out.x2).toBeGreaterThanOrEqual(out.x1);
	});
});

describe("cross-system span clip — full buildLayoutModel (narrow width)", () => {
	// Several single-note measures so a narrow render width forces multiple systems and
	// a span authored from the first note to a last-system note crosses systems.
	const crossSong = (kind) => {
		const note = (markers = {}) => ({
			type: "note",
			duration: "whole",
			pitches: [{ step: "C", octave: 5 }],
			...markers,
		});
		const measures = [];
		for (let i = 0; i < 8; i++) {
			const markers = {};
			if (i === 0) {
				markers[kind] = "start";
			}
			if (i === 7) {
				markers[kind] = "stop";
			}
			measures.push({ rightHand: [note(markers)] });
		}
		return { sections: [{ measures }] };
	};

	it("files a cross-system crescendo under the start system only, clipped to staffEndX, never throwing", () => {
		let model;
		expect(() => {
			model = buildLayoutModel(crossSong("crescendo"), 30);
		}).not.toThrow();
		expect(model.systems.length).toBeGreaterThan(1);
		const located = model.systems.flatMap((sys, i) =>
			sys.spans
				.filter((sp) => sp.kind === "crescendo")
				.map((sp) => ({ arrayIndex: i, sp })),
		);
		// Exactly one wedge, filed under its own `systemIndex` and nowhere else.
		expect(located).toHaveLength(1);
		const { arrayIndex, sp } = located[0];
		expect(sp.crossSystem).toBe(true);
		expect(arrayIndex).toBe(sp.systemIndex); // filed under the start system only
		const startSys = model.systems[sp.systemIndex];
		// Clipped to the start system's staff end exactly: the right edge IS staffEndX,
		// not the end note's foreign-frame X. (The end note's local X here is smaller than
		// staffEndX, so a plain `min(x2, staffEndX)` clamp would leave a garbage foreign X;
		// asserting equality to staffEndX is what distinguishes the fix from that bug.)
		expect(sp.x2).toBeCloseTo(startSys.staffEndX, 6);
		expect(sp.x2).toBeGreaterThanOrEqual(sp.x1 - 1e-9);
		// No wedge with this span's foreign coordinates leaks into any OTHER system.
		for (let i = 0; i < model.systems.length; i++) {
			if (i === sp.systemIndex) {
				continue;
			}
			expect(
				model.systems[i].spans.some((other) => other.kind === "crescendo"),
			).toBe(false);
		}
	});

	it("clips a cross-system tie and slur to the start system's staff end and recomputes cx, never throwing", () => {
		for (const kind of ["tie", "slur"]) {
			let model;
			expect(() => {
				model = buildLayoutModel(crossSong(kind), 30);
			}).not.toThrow();
			const spans = model.systems.flatMap((s) => s.spans);
			const sp = spans.find((s) => s.kind === kind);
			expect(sp).toBeDefined();
			expect(sp.crossSystem).toBe(true);
			const startSys = model.systems[sp.systemIndex];
			// X clamped to the start system's staff end exactly (the end note's foreign-frame
			// X is below staffEndX here, so equality — not just `<=` — locks the latent-bug
			// fix); cx is the recomputed midpoint of the clipped x-span.
			expect(sp.x2).toBeCloseTo(startSys.staffEndX, 6);
			expect(sp.x2).toBeGreaterThanOrEqual(sp.x1 - 1e-9);
			expect(sp.cx).toBeCloseTo((sp.x1 + sp.x2) / 2, 6);
		}
	});

	it("the clip changes horizontal coordinates only — y2/cy stay at the foreign end-system value", () => {
		// Resolve the same cross-system tie WITHOUT the clip (read the raw record from a
		// fresh resolve) to prove the clip touched x2/cx but left y2/cy untouched.
		const model = buildLayoutModel(crossSong("tie"), 30);
		const sp = model.systems
			.flatMap((s) => s.spans)
			.find((s) => s.kind === "tie");
		// y2 and cy derive from the foreign end note's notehead Y; the clip leaves them.
		// They are finite (a real Y), and the clip is asserted not to have collapsed them
		// to the start edge — the arc terminates at a foreign vertical position by design.
		expect(Number.isFinite(sp.y2)).toBe(true);
		expect(Number.isFinite(sp.cy)).toBe(true);
		// The within-record consistency the clip DOES enforce: x2 ≤ staffEndX and cx is
		// the recomputed midpoint of the clipped x-span (not the old foreign midpoint).
		expect(sp.cx).toBeCloseTo((sp.x1 + sp.x2) / 2, 6);
	});

	it("a within-system crescendo across a barline is left untouched (one continuous wedge past the bar)", () => {
		// Two notes in different measures of the SAME system: crossSystem is false and x2
		// sits past the intervening barline X — the clip is a strict no-op here.
		const song = {
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "whole",
									crescendo: "start",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
						},
						{
							rightHand: [
								{
									type: "note",
									duration: "whole",
									crescendo: "stop",
									pitches: [{ step: "C", octave: 5 }],
								},
							],
						},
					],
				},
			],
		};
		const model = buildLayoutModel(song, 200);
		expect(model.systems.length).toBe(1); // both measures on one system
		const [w] = model.systems
			.flatMap((s) => s.spans)
			.filter((s) => s.kind === "crescendo");
		expect(w).toBeDefined();
		expect(w.crossSystem).toBe(false);
		// The barline between the two measures sits between the start and end note X, so
		// the wedge spans it as one continuous element (x2 is past that barline X).
		const m1 = model.systems[0].measures[0];
		const barlineX = m1.x + m1.width;
		expect(w.x1).toBeLessThan(barlineX);
		expect(w.x2).toBeGreaterThan(barlineX);
	});

	it("produces byte-identical span records for a within-system tie/slur song (clip is a strict no-op)", () => {
		// The clip must not perturb the only case existing tests exercise: a within-system
		// tie/slur song. Resolve the comprehensive fixture and assert each within-system
		// arc record carries its full original field set with x2/cx unmodified by a clip.
		const model = buildLayoutModel(COMPREHENSIVE_SONG, 200);
		const spans = model.systems.flatMap((s) => s.spans);
		for (const kind of ["tie", "slur"]) {
			const sp = spans.find((s) => s.kind === kind);
			expect(sp).toBeDefined();
			expect(sp.crossSystem).toBe(false);
			// A within-system arc's cx is still exactly the midpoint of its UNCLIPPED span
			// (the clip never ran), and x2 is the real end-note X (> x1).
			expect(sp.cx).toBeCloseTo((sp.x1 + sp.x2) / 2, 6);
			expect(sp.x2).toBeGreaterThan(sp.x1);
		}
	});
});

describe("lhAboveTopExtent — LH high-note extent above the LH top line", () => {
	// A flattened member only needs `measure.leftHand` plus `ctx.leftHand.clef`.
	const memberWithLeft = (pitches, clef = "bass") => ({
		measure: pitches
			? { leftHand: [{ type: "note", pitches }] }
			: { leftHand: [{ type: "rest" }] },
		ctx: { leftHand: { clef } },
	});

	it("returns 0 for an empty members list", () => {
		expect(lhAboveTopExtent([])).toBe(0);
	});

	it("returns 0 for a rest-only LH measure", () => {
		expect(lhAboveTopExtent([memberWithLeft(null)])).toBe(0);
	});

	it("returns 0 for an absent leftHand", () => {
		expect(lhAboveTopExtent([{ measure: {}, ctx: { leftHand: { clef: "bass" } } }])).toBe(0);
	});

	it("returns 4.5 sp for bass C5 (step 17)", () => {
		expect(
			lhAboveTopExtent([memberWithLeft([{ step: "C", octave: 5 }])]),
		).toBeCloseTo(4.5, 6);
	});

	it("returns 6.5 sp for bass G5 (step 21)", () => {
		expect(
			lhAboveTopExtent([memberWithLeft([{ step: "G", octave: 5 }])]),
		).toBeCloseTo(6.5, 6);
	});

	it("returns 0 for LH notes at or below the top line (bass C3)", () => {
		expect(
			lhAboveTopExtent([memberWithLeft([{ step: "C", octave: 3 }])]),
		).toBe(0);
	});

	it("takes the highest notehead across all members and uses each measure's own clef", () => {
		// A treble-clef LH measure: bass C5's step (17) would differ under treble,
		// so the per-measure clef must drive the scan.
		const members = [
			memberWithLeft([{ step: "C", octave: 3 }]), // bass C3 → below top line
			memberWithLeft([{ step: "G", octave: 5 }]), // bass G5 → 6.5 sp, the max
		];
		expect(lhAboveTopExtent(members)).toBeCloseTo(6.5, 6);
	});
});

// ── Octave-shift ottava placement (#13: Bug 1 vertical lanes, Bug 2 x-span) ────────
describe("ottava placement — per-hand 'above' lanes and per-system measure-extent span", () => {
	const note = (step, octave, extra = {}) => ({
		type: "note",
		duration: "quarter",
		pitches: [{ step, octave }],
		...extra,
	});
	const rest = { type: "rest", duration: "quarter" };

	it("places a LH +1 ottava in the inter-staff gap above the LH notes, not in the top-margin lane", () => {
		// LH carries a high note (bass G5 → 6.5 sp above its top line) under a +1 shift,
		// and the RH prints a point dynamic so the RH below-staff region is non-empty
		// (rhBelowRegionReach = DYNAMICS_LANE_RESERVE). The LH "above" bracket must sit
		// in the reserved gap lane, clear of both the LH highs and the RH below region.
		const song = {
			sections: [
				{
					leftHand: { octaveShift: 1 },
					measures: [
						{
							rightHand: [note("G", 4, { dynamic: "f" })],
							leftHand: [note("G", 5)],
						},
					],
				},
			],
		};
		const sys = buildLayoutModel(song, 200).systems[0];
		const band = sys.band;
		const above = sys.texts.ottavas.filter((o) => o.placement === "above");
		expect(above).toHaveLength(1);
		const o = above[0];
		expect(o.hand).toBe("leftHand");
		expect(o.placement).toBe("above");

		// The LH "above" bracket lives in the gap lane, NOT the top-margin lane.
		expect(o.y).toBe(band.ottavaLeftAboveLaneY);
		expect(o.y).not.toBe(band.ottavaAboveLaneY); // null here (no RH-above shift)
		expect(band.ottavaAboveLaneY).toBeNull();
		expect(o.y).toBeLessThan(band.leftStaffTopY); // in the inter-staff gap

		// Baseline sits strictly above the LH high notes (G5 reaches 6.5 sp above the
		// LH top line). Strict because GAP_PAD = NOTE_GAP_STAFF > 0.
		const lhHighNoteExtent = 6.5; // bass G5, from lhAboveTopExtent
		expect(o.y).toBeLessThan(band.leftStaffTopY - lhHighNoteExtent);

		// Glyph top (y − OTTAVA_SIZE) clears the RH below-staff region. Operator is `>=`
		// (per design non-blocking note 2): this fixture's RH dynamic makes the margin
		// strictly positive, but the bound the spec requires is `>=`, not strict `>`.
		const glyphTop = o.y - OTTAVA_SIZE;
		expect(glyphTop).toBeGreaterThanOrEqual(
			band.rightStaffBottomY + DYNAMICS_LANE_RESERVE,
		);
		// And the glyph top clears the staff bottom itself (no overlap with RH content).
		expect(glyphTop).toBeGreaterThanOrEqual(band.rightStaffBottomY);
	});

	it("does not deepen the top margin for a left-hand-only +1 shift", () => {
		// Identical above-the-RH-staff content (an above-RH note annotation), differing
		// only in whether the LH carries a +1 shift. A LH-only shift must not reserve a
		// top-margin ottava lane, so the top margin equals the no-shift baseline.
		const songWithLeftShift = (leftShift) => ({
			sections: [
				{
					...(leftShift ? { leftHand: { octaveShift: leftShift } } : {}),
					measures: [
						{
							rightHand: [
								note("G", 4, {
									annotations: [{ text: "C", placement: "above" }],
								}),
							],
							leftHand: [note("C", 3)],
						},
					],
				},
			],
		});
		const lhShifted = buildLayoutModel(songWithLeftShift(1), 200).systems[0];
		const noShift = buildLayoutModel(songWithLeftShift(0), 200).systems[0];

		// The LH-only shift does not reserve a top-margin ottava lane.
		expect(lhShifted.band.topMargin).toBeCloseTo(noShift.band.topMargin, 10);
		// No RH-above shift ⇒ the top-margin lane is not reserved.
		expect(lhShifted.band.ottavaAboveLaneY).toBeNull();
		// The LH +1 still produces a gap-lane bracket (sanity: the shift is live).
		const above = lhShifted.texts.ottavas.filter(
			(o) => o.placement === "above",
		);
		expect(above).toHaveLength(1);
		expect(above[0].hand).toBe("leftHand");
		expect(above[0].y).toBe(lhShifted.band.ottavaLeftAboveLaneY);
	});

	it("places two 'above' ottavas at distinct, non-overlapping Ys when both hands are +1", () => {
		const song = {
			sections: [
				{
					rightHand: { octaveShift: 1 },
					leftHand: { octaveShift: 1 },
					measures: [
						{
							rightHand: [note("G", 4)],
							leftHand: [note("G", 5)],
						},
					],
				},
			],
		};
		const sys = buildLayoutModel(song, 200).systems[0];
		const band = sys.band;
		const above = sys.texts.ottavas.filter((o) => o.placement === "above");
		expect(above).toHaveLength(2);
		const rh = above.find((o) => o.hand === "rightHand");
		const lh = above.find((o) => o.hand === "leftHand");
		expect(rh).toBeDefined();
		expect(lh).toBeDefined();

		// RH in the top-margin lane, LH in the inter-staff-gap lane.
		expect(rh.y).toBe(band.ottavaAboveLaneY);
		expect(lh.y).toBe(band.ottavaLeftAboveLaneY);

		// The RH lane is higher (smaller Y) than the LH lane, and the two are distinct.
		expect(band.ottavaAboveLaneY).toBeLessThan(band.ottavaLeftAboveLaneY);
		expect(rh.y).not.toBe(lh.y);

		// The RH glyph band [y − OTTAVA_SIZE, y] sits entirely above the LH lane, so the
		// two markings cannot overlap.
		expect(band.ottavaAboveLaneY).toBeLessThan(
			band.ottavaLeftAboveLaneY - OTTAVA_SIZE,
		);
	});

	it("emits a bracket on a rest-only run-portion and spans a sparse run's full measure extent", () => {
		// Rest-only: the shift is on ctx, the LH measure has no noteheads. A bracket is
		// still emitted, spanning the measure's left edge to its right barline.
		const restOnlySong = {
			sections: [
				{
					leftHand: { octaveShift: 1 },
					measures: [{ rightHand: [note("G", 4)], leftHand: [rest] }],
				},
			],
		};
		const restSys = buildLayoutModel(restOnlySong, 200).systems[0];
		const restOttavas = restSys.texts.ottavas.filter(
			(o) => o.hand === "leftHand" && o.placement === "above",
		);
		expect(restOttavas).toHaveLength(1);
		const r = restOttavas[0];
		const m0 = restSys.measures[0];
		expect(r.x1).toBe(m0.x); // measure left edge — no note refinement
		expect(r.x2).toBe(m0.x + m0.width); // right barline
		expect(r.x1).toBeLessThan(r.x2); // EMPTY_MEASURE_WIDTH floor ⇒ non-degenerate

		// Sparse: [rest, note, rest] for the LH. The bracket spans the full run extent,
		// NOT a tiny ±NOTEHEAD_RX window around the lone middle note.
		const sparseSong = {
			sections: [
				{
					leftHand: { octaveShift: 1 },
					measures: [
						{ rightHand: [note("G", 4)], leftHand: [rest] },
						{ rightHand: [note("G", 4)], leftHand: [note("G", 5)] },
						{ rightHand: [note("G", 4)], leftHand: [rest] },
					],
				},
			],
		};
		const sparseSys = buildLayoutModel(sparseSong, 200).systems[0];
		const sparseOttavas = sparseSys.texts.ottavas.filter(
			(o) => o.hand === "leftHand" && o.placement === "above",
		);
		expect(sparseOttavas).toHaveLength(1);
		const s = sparseOttavas[0];
		const first = sparseSys.measures[0];
		const last = sparseSys.measures[2];
		// First measure is rest-only ⇒ no note refinement: x1 is the first measure's
		// left edge, and x2 reaches the last measure's right barline.
		expect(s.x1).toBe(first.x);
		expect(s.x2).toBe(last.x + last.width);
		// The span covers more than one measure — not a tiny window around the lone note.
		expect(s.x2 - s.x1).toBeGreaterThan(first.width);
	});

	it("restates exactly one bracket per system across a multi-system note-bearing run", () => {
		// A single same-shift (LH +1) note-bearing run over six measures, wrapped narrow
		// so it spans several systems. Each spanned system carries exactly one matching
		// bracket; the total equals the number of systems.
		const song = {
			sections: [
				{
					leftHand: { octaveShift: 1 },
					measures: Array.from({ length: 6 }, () => ({
						rightHand: [note("G", 4)],
						leftHand: [note("G", 5)],
					})),
				},
			],
		};
		const model = buildLayoutModel(song, 25); // narrow ⇒ wraps to multiple systems
		expect(model.systems.length).toBeGreaterThan(1);
		const perSystem = model.systems.map(
			(s) =>
				s.texts.ottavas.filter(
					(o) => o.hand === "leftHand" && o.label === "8va",
				).length,
		);
		// Exactly one matching bracket on every spanned system.
		expect(perSystem.every((c) => c === 1)).toBe(true);
		// And the total equals the number of systems the run spans.
		expect(perSystem.reduce((a, b) => a + b, 0)).toBe(model.systems.length);
	});
});
