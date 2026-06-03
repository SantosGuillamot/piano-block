/**
 * Unit tests for the shared note-name helper (design §6.5).
 *
 * These pin the closed two-system vocabulary and the canonical
 * `step → English letter` mapping that both the validator and the renderer rely
 * on: every English letter (upper + lower), every Spanish solfège token (mixed
 * case), the null-ish sentinel for unrecognised tokens, and `isNoteName`'s
 * case-insensitive membership — the same semantics the validator used when this
 * vocabulary was private to `validate.js`.
 */
import { isNoteName, NOTE_NAMES, normalizeStep } from "../normalizeStep.js";

describe("normalizeStep", () => {
	it("maps every English letter (upper + lower case) to its own uppercase", () => {
		const letters = ["c", "d", "e", "f", "g", "a", "b"];
		for (const letter of letters) {
			const upper = letter.toUpperCase();
			expect(normalizeStep(letter)).toBe(upper);
			expect(normalizeStep(upper)).toBe(upper);
		}
	});

	it("maps every Spanish solfège token to its canonical English letter", () => {
		const cases = [
			["do", "C"],
			["re", "D"],
			["mi", "E"],
			["fa", "F"],
			["sol", "G"],
			["la", "A"],
			["si", "B"],
		];
		for (const [token, letter] of cases) {
			expect(normalizeStep(token)).toBe(letter);
		}
	});

	it("normalizes Spanish tokens case-insensitively", () => {
		expect(normalizeStep("do")).toBe("C");
		expect(normalizeStep("Do")).toBe("C");
		expect(normalizeStep("DO")).toBe("C");
		expect(normalizeStep("sol")).toBe("G");
		expect(normalizeStep("Sol")).toBe("G");
		expect(normalizeStep("SOL")).toBe("G");
	});

	it("returns null for unrecognised or non-string tokens", () => {
		expect(normalizeStep("H")).toBeNull();
		expect(normalizeStep("doh")).toBeNull();
		expect(normalizeStep("")).toBeNull();
		expect(normalizeStep(undefined)).toBeNull();
		expect(normalizeStep(null)).toBeNull();
		expect(normalizeStep(42)).toBeNull();
	});
});

describe("isNoteName", () => {
	it("accepts every recognised token, case-insensitively", () => {
		const tokens = [
			"c",
			"D",
			"e",
			"F",
			"g",
			"A",
			"b",
			"do",
			"Do",
			"DO",
			"re",
			"mi",
			"fa",
			"sol",
			"SOL",
			"la",
			"si",
		];
		for (const token of tokens) {
			expect(isNoteName(token)).toBe(true);
		}
	});

	it("rejects unrecognised tokens and non-strings", () => {
		expect(isNoteName("H")).toBe(false);
		expect(isNoteName("doh")).toBe(false);
		expect(isNoteName("")).toBe(false);
		expect(isNoteName(undefined)).toBe(false);
		expect(isNoteName(null)).toBe(false);
		expect(isNoteName(42)).toBe(false);
	});
});

describe("NOTE_NAMES", () => {
	it("is the closed 14-token lowercased vocabulary", () => {
		expect(NOTE_NAMES).toBeInstanceOf(Set);
		expect([...NOTE_NAMES].sort()).toEqual(
			[
				"a",
				"b",
				"c",
				"d",
				"do",
				"e",
				"f",
				"fa",
				"g",
				"la",
				"mi",
				"re",
				"si",
				"sol",
			].sort(),
		);
	});
});
