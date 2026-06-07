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
 * vocabulary's `isNoteName`.
 */
import { isNoteName } from "../../song/normalizeStep.js";
import {
	inferNoteNameSystem,
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
