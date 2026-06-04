/**
 * Unit tests for the shared notation constants module.
 *
 * These pin two contracts the layout/emit layers rely on:
 *
 * - The note-annotation geometry values (`NOTE_SIZE` as the sole note-annotation
 *   text size, plus the band gaps / reserves the four placement bands consume).
 * - The hairpin tuning constants: exported, numeric, in a sane sp range, and —
 *   critically — `HAIRPIN_APERTURE` is a fixed literal that is never derived from a
 *   span's width (a width-derived aperture would divide by `(x2 - x1)`, which is
 *   zero/near-zero for a degenerate two-note span — a NaN/Infinity risk).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	DYNAMICS_LANE_RESERVE,
	HAIRPIN_APERTURE,
	HAIRPIN_LANE_DY,
	MID_GAP,
	NOTE_CLAMP_INSET,
	NOTE_GAP_STAFF,
	NOTE_SIZE,
	TEXT_LANE_GAP,
} from "../constants.js";

describe("notation constants — note-annotation geometry", () => {
	it("exports NOTE_SIZE as the note-annotation text size", () => {
		expect(NOTE_SIZE).toBe(2.8);
	});

	it("exports NOTE_GAP_STAFF as a number with the recommended value", () => {
		expect(NOTE_GAP_STAFF).toBe(1);
		expect(typeof NOTE_GAP_STAFF).toBe("number");
	});

	it("exports MID_GAP as a number with the recommended value", () => {
		expect(MID_GAP).toBe(1.2);
		expect(typeof MID_GAP).toBe("number");
	});

	it("exports DYNAMICS_LANE_RESERVE as a number with the recommended value", () => {
		expect(DYNAMICS_LANE_RESERVE).toBe(4.5);
		expect(typeof DYNAMICS_LANE_RESERVE).toBe("number");
	});

	it("exports NOTE_CLAMP_INSET as a number with the recommended value", () => {
		expect(NOTE_CLAMP_INSET).toBe(1);
		expect(typeof NOTE_CLAMP_INSET).toBe("number");
	});

	it("leaves TEXT_LANE_GAP unchanged so one stack step is NOTE_SIZE + TEXT_LANE_GAP = 3.4 sp", () => {
		expect(TEXT_LANE_GAP).toBe(0.6);
		expect(NOTE_SIZE + TEXT_LANE_GAP).toBeCloseTo(3.4);
	});

	it("reserves enough below-staff depth to clear the hairpin lane's lower edge", () => {
		// A below note's dodge (DYNAMICS_LANE_RESERVE) must clear BOTH below-staff
		// dynamics occupants: the point-dynamic glyph row AND the hairpin lane. The
		// hairpin lane's lower edge is HAIRPIN_LANE_DY + HAIRPIN_APERTURE / 2; the
		// reserve must exceed it so a below note never overlaps a hairpin wedge.
		expect(DYNAMICS_LANE_RESERVE).toBeGreaterThan(
			HAIRPIN_LANE_DY + HAIRPIN_APERTURE / 2,
		);
	});
});

describe("hairpin tuning constants", () => {
	test("HAIRPIN_APERTURE is an exported finite positive number", () => {
		expect(typeof HAIRPIN_APERTURE).toBe("number");
		expect(Number.isFinite(HAIRPIN_APERTURE)).toBe(true);
		expect(HAIRPIN_APERTURE).toBeGreaterThan(0);
	});

	test("HAIRPIN_LANE_DY is an exported finite positive number (below-staff offset)", () => {
		expect(typeof HAIRPIN_LANE_DY).toBe("number");
		expect(Number.isFinite(HAIRPIN_LANE_DY)).toBe(true);
		// Positive Y is downward: the lane sits below the staff bottom line.
		expect(HAIRPIN_LANE_DY).toBeGreaterThan(0);
	});

	test("HAIRPIN_APERTURE is a literal constant, not computed from any span dimension", () => {
		const source = readFileSync(join(__dirname, "..", "constants.js"), "utf8");
		const line = source
			.split("\n")
			.find((l) => l.includes("export const HAIRPIN_APERTURE"));
		expect(line).toBeDefined();
		// The right-hand side must be a bare numeric literal: no arithmetic, no
		// reference to width / x1 / x2 / span geometry.
		const rhs = line.split("=")[1].replace(/;.*/, "").trim();
		expect(rhs).toMatch(/^\d+(\.\d+)?$/);
	});
});
