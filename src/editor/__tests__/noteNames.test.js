/**
 * Unit tests for the per-song note-name system helper.
 *
 * These pin the three contracts the pitch editor leans on: a song's note-name
 * system is inferred from the spellings its pitches already use (Spanish when
 * any pitch spells a note in solfège, English otherwise — including an empty or
 * brand-new song); each system's `SelectControl` option list carries the seven
 * display spellings in order, with `value`s that are all recognised note names;
 * and `stepInSystem` rewrites any existing `step` into the chosen system's
 * spelling, idempotently.
 */
import { isNoteName } from "../../song/normalizeStep.js";
import {
	inferNoteNameSystem,
	noteNameOptions,
	stepInSystem,
} from "../noteNames.js";

/** A minimal song whose single note carries the given pitch `step`s. */
const songWithSteps = (...steps) => ({
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
});

describe("inferNoteNameSystem", () => {
	it("returns `spanish` for a song whose pitches use Spanish spellings", () => {
		expect(inferNoteNameSystem(songWithSteps("do", "sol"))).toBe("spanish");
	});

	it("returns `english` for a C-D-E song", () => {
		expect(inferNoteNameSystem(songWithSteps("C", "D", "E"))).toBe("english");
	});

	it("returns `english` for a song with no pitches", () => {
		expect(inferNoteNameSystem({ sections: [{ measures: [{}] }] })).toBe(
			"english",
		);
	});

	it("returns `english` for a new/empty song", () => {
		expect(inferNoteNameSystem({})).toBe("english");
		expect(inferNoteNameSystem(null)).toBe("english");
	});
});

describe("noteNameOptions", () => {
	it("lists the Spanish names in order with those exact values", () => {
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

	it("lists the English names in order with those exact values", () => {
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

	it("uses only recognised note names as values", () => {
		for (const system of ["english", "spanish"]) {
			for (const option of noteNameOptions(system)) {
				expect(isNoteName(option.value)).toBe(true);
			}
		}
	});
});

describe("stepInSystem", () => {
	it("rewrites a Spanish step into its English spelling", () => {
		expect(stepInSystem("do", "english")).toBe("C");
	});

	it("rewrites an English step into its Spanish spelling", () => {
		expect(stepInSystem("G", "spanish")).toBe("sol");
	});

	it("maps case-insensitively", () => {
		expect(stepInSystem("SOL", "english")).toBe("G");
		expect(stepInSystem("g", "spanish")).toBe("sol");
	});

	it("falls back to the system's first name for an unrecognised step", () => {
		expect(stepInSystem("H", "english")).toBe("C");
		expect(stepInSystem("doh", "spanish")).toBe("do");
	});

	it("is idempotent — a rewritten step rewrites to itself", () => {
		const steps = ["C", "do", "G", "sol", "B", "si", "H"];
		for (const system of ["english", "spanish"]) {
			for (const step of steps) {
				const once = stepInSystem(step, system);
				expect(stepInSystem(once, system)).toBe(once);
			}
		}
	});
});
