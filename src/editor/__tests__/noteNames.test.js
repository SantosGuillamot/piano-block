/**
 * Unit tests for the per-song note-name system helper.
 *
 * These pin three contracts. First, `inferNoteNameSystem` reads a parsed song
 * and reports which of the two note-name systems it is written in — Spanish if
 * any pitch uses a Spanish spelling, English otherwise (including a song with
 * no pitches and a brand-new song). Second, `noteNameOptions` lists the seven
 * names of a system in order, with the exact display spelling stored into a
 * pitch's `step` as each option's `value`. Third, `stepInSystem` rewrites an
 * existing `step` into a system's spelling, canonicalizing across systems and
 * staying idempotent. Every option `value` is cross-checked against the shared
 * vocabulary's `isNoteName`. Fourth, `mapSong` rewrites every `pitch.step` of a
 * whole song into a target system, stamps `language`, leaves `handConfig.alters`
 * keys English-canonical, tolerates a malformed song, and stays conformant.
 * Fifth, `noteLabel` turns an event into its tree label — `"rest"` for a rest,
 * else its pitch name(s) in the song's system, space-joined, with no octave.
 */
import { isNoteName } from "../../song/normalizeStep.js";
import validateSong from "../../song/validate.js";
import {
	inferNoteNameSystem,
	mapSong,
	noteLabel,
	noteNameOptions,
	stepInSystem,
} from "../noteNames.js";

/**
 * Build a parsed song whose single note carries pitches with the given steps.
 *
 * @param {string[]} steps The `step` spellings to seed the note's pitches with.
 * @return {Object} A parsed-song-shaped object containing those pitches.
 */
function songWithSteps(steps) {
	return {
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: steps.map((step) => ({ step, octave: 4 })),
							},
						],
					},
				],
			},
		],
	};
}

describe("inferNoteNameSystem", () => {
	it('returns "spanish" when any pitch uses a Spanish spelling', () => {
		expect(inferNoteNameSystem(songWithSteps(["do", "re", "mi"]))).toBe(
			"spanish",
		);
		expect(inferNoteNameSystem(songWithSteps(["sol"]))).toBe("spanish");
	});

	it('returns "english" for a C-D-E song', () => {
		expect(inferNoteNameSystem(songWithSteps(["C", "D", "E"]))).toBe("english");
	});

	it('returns "english" for a song with no pitches', () => {
		expect(inferNoteNameSystem({ sections: [{ measures: [{}] }] })).toBe(
			"english",
		);
		expect(inferNoteNameSystem({ sections: [] })).toBe("english");
		expect(inferNoteNameSystem({})).toBe("english");
	});

	it("finds Spanish spellings in the left hand and across sections", () => {
		const song = {
			sections: [
				{ measures: [{ rightHand: [{ type: "rest", duration: "quarter" }] }] },
				{
					measures: [
						{
							leftHand: [
								{
									type: "note",
									duration: "quarter",
									pitches: [{ step: "la", octave: 3 }],
								},
							],
						},
					],
				},
			],
		};
		expect(inferNoteNameSystem(song)).toBe("spanish");
	});

	it("is case-insensitive about Spanish spellings", () => {
		expect(inferNoteNameSystem(songWithSteps(["DO", "Sol"]))).toBe("spanish");
	});

	it('defaults to "english" for a missing or malformed song', () => {
		expect(inferNoteNameSystem(undefined)).toBe("english");
		expect(inferNoteNameSystem(null)).toBe("english");
		expect(inferNoteNameSystem("not a song")).toBe("english");
	});
});

describe("noteNameOptions", () => {
	it("lists the English names in order with their exact values", () => {
		expect(noteNameOptions("english")).toEqual([
			{ label: "C", value: "C" },
			{ label: "D", value: "D" },
			{ label: "E", value: "E" },
			{ label: "F", value: "F" },
			{ label: "G", value: "G" },
			{ label: "A", value: "A" },
			{ label: "B", value: "B" },
		]);
	});

	it("lists the Spanish names in order with their exact values", () => {
		expect(noteNameOptions("spanish")).toEqual([
			{ label: "do", value: "do" },
			{ label: "re", value: "re" },
			{ label: "mi", value: "mi" },
			{ label: "fa", value: "fa" },
			{ label: "sol", value: "sol" },
			{ label: "la", value: "la" },
			{ label: "si", value: "si" },
		]);
	});

	it("yields option values that are all recognised note names", () => {
		for (const system of ["english", "spanish"]) {
			for (const { value } of noteNameOptions(system)) {
				expect(isNoteName(value)).toBe(true);
			}
		}
	});
});

describe("stepInSystem", () => {
	it("rewrites a step into the requested system's spelling", () => {
		expect(stepInSystem("do", "english")).toBe("C");
		expect(stepInSystem("G", "spanish")).toBe("sol");
	});

	it("canonicalizes case-insensitively before rewriting", () => {
		expect(stepInSystem("SOL", "english")).toBe("G");
		expect(stepInSystem("c", "spanish")).toBe("do");
	});

	it("falls back to the system's first name for an unrecognised step", () => {
		expect(stepInSystem("H", "english")).toBe("C");
		expect(stepInSystem("doh", "spanish")).toBe("do");
		expect(stepInSystem(undefined, "english")).toBe("C");
	});

	it("is idempotent — rewriting an already-converted step is a no-op", () => {
		const steps = ["C", "do", "G", "sol", "B", "si", "H"];
		for (const step of steps) {
			for (const system of ["english", "spanish"]) {
				const once = stepInSystem(step, system);
				expect(stepInSystem(once, system)).toBe(once);
			}
		}
	});
});

describe("noteLabel", () => {
	it("labels a single-pitch note by its pitch name in the system", () => {
		const note = {
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 4 }],
		};
		expect(noteLabel(note, "english")).toBe("C");
	});

	it("labels a Spanish-spelled note by its spelling in the Spanish system", () => {
		const note = {
			type: "note",
			duration: "quarter",
			pitches: [{ step: "do", octave: 4 }],
		};
		expect(noteLabel(note, "spanish")).toBe("do");
	});

	it("space-joins a chord's pitch names", () => {
		const chord = {
			type: "note",
			duration: "quarter",
			pitches: [
				{ step: "C", octave: 4 },
				{ step: "E", octave: 4 },
				{ step: "G", octave: 4 },
			],
		};
		expect(noteLabel(chord, "english")).toBe("C E G");
	});

	it("labels a rest as the i18n 'rest' string", () => {
		expect(noteLabel({ type: "rest", duration: "quarter" }, "english")).toBe(
			"rest",
		);
	});

	it("canonicalizes the stored spelling through stepInSystem", () => {
		const note = {
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 4 }],
		};
		// An English-spelled note rendered in the Spanish system shows "do".
		expect(noteLabel(note, "spanish")).toBe("do");
	});

	it("never includes an octave in the label", () => {
		const note = {
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 5 }],
		};
		expect(noteLabel(note, "english")).toBe("C");
	});

	it("is throw-free for a malformed note with no pitches", () => {
		expect(() => noteLabel({ type: "note" }, "english")).not.toThrow();
		expect(noteLabel({ type: "note" }, "english")).toBe("");
		expect(noteLabel(undefined, "english")).toBe("");
		expect(noteLabel(null, "english")).toBe("");
	});
});

/**
 * A two-section, two-hand song whose pitches span both staves, plus a
 * `handConfig.alters` map keyed by an English-canonical letter. Used to prove
 * `mapSong` rewrites every `pitch.step` across the whole tree while leaving the
 * alters key untouched.
 *
 * @return {Object} A parsed-song-shaped object.
 */
function multiHandSong() {
	return {
		sections: [
			{
				handConfig: { rightHand: { alters: { C: 1 } } },
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [
									{ step: "C", octave: 4 },
									{ step: "E", octave: 4 },
								],
							},
						],
						leftHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "G", octave: 2 }],
							},
						],
					},
				],
			},
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "A", octave: 4 }],
							},
						],
					},
				],
			},
		],
	};
}

/** Collect every `pitch.step` of a song in document order. */
function stepsList(song) {
	const steps = [];
	for (const section of song.sections ?? []) {
		for (const measure of section.measures ?? []) {
			for (const hand of [measure.rightHand, measure.leftHand]) {
				for (const event of hand ?? []) {
					for (const pitch of event.pitches ?? []) {
						steps.push(pitch.step);
					}
				}
			}
		}
	}
	return steps;
}

describe("mapSong", () => {
	it("rewrites every pitch.step into the target system and stamps language", () => {
		const spanish = mapSong(multiHandSong(), "spanish");
		// C E (right) G (left) of section 0, then A of section 1.
		expect(stepsList(spanish)).toEqual(["do", "mi", "sol", "la"]);
		expect(spanish.language).toBe("spanish");
	});

	it("round-trips back to English", () => {
		const there = mapSong(multiHandSong(), "spanish");
		const back = mapSong(there, "english");
		expect(stepsList(back)).toEqual(["C", "E", "G", "A"]);
		expect(back.language).toBe("english");
	});

	it("is idempotent — mapping to the same system twice equals once", () => {
		const once = mapSong(multiHandSong(), "spanish");
		const twice = mapSong(once, "spanish");
		expect(twice).toEqual(once);
	});

	it("leaves handConfig.alters keys English-canonical", () => {
		const spanish = mapSong(multiHandSong(), "spanish");
		const alters = spanish.sections[0].handConfig.rightHand.alters;
		expect(alters).toEqual({ C: 1 });
		expect(alters).not.toHaveProperty("do");
	});

	it("does not mutate the input song", () => {
		const song = multiHandSong();
		const before = JSON.parse(JSON.stringify(song));
		mapSong(song, "spanish");
		expect(song).toEqual(before);
	});

	it("produces a conformant song", () => {
		const spanish = mapSong(multiHandSong(), "spanish");
		expect(validateSong(JSON.stringify(spanish))).toEqual([]);
	});

	it("tolerates a malformed song, returning just the language stamp", () => {
		expect(mapSong({}, "spanish")).toEqual({ language: "spanish" });
		expect(() => mapSong(undefined, "english")).not.toThrow();
		expect(mapSong(undefined, "english")).toEqual({ language: "english" });
	});
});
