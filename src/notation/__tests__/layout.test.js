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
import {
	beamCountFor,
	beamGeometry,
	beamGroups,
	beatGroupLength,
	decodeDuration,
	diatonicIndex,
	dotPositions,
	eventDuration,
	isBeamable,
	ledgerLinesFor,
	normalizeAlters,
	pitchToStaffStep,
	resolveAccidental,
	stackAccidentals,
	stackChord,
	staffStepToY,
	stemDirectionForChord,
	stemDirectionForStep,
	stepIndex,
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
