/**
 * Unit tests for the shared notation constants module.
 *
 * These pin the contract that downstream layers (`layout.js`, `svg.js`) rely on:
 * the hairpin tuning constants are exported, numeric, in a sane sp range, and —
 * critically — `HAIRPIN_APERTURE` is a fixed literal that is never derived from a
 * span's width (a width-derived aperture would divide by `(x2 - x1)`, which is
 * zero/near-zero for a degenerate two-note span — a NaN/Infinity risk).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HAIRPIN_APERTURE, HAIRPIN_LANE_DY } from "../constants.js";

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
