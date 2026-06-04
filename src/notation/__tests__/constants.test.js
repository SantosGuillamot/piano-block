/**
 * Unit tests for the shared notation constants.
 *
 * These pin the note-annotation geometry values consumed by the layout/emit
 * layers and guard the temporary `CHORD_SYMBOL_SIZE` alias that keeps the
 * existing importers resolving until they switch to `NOTE_SIZE`.
 */
import {
	CHORD_SYMBOL_SIZE,
	DYNAMICS_LANE_RESERVE,
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

	it("keeps CHORD_SYMBOL_SIZE as a temporary alias of NOTE_SIZE", () => {
		expect(CHORD_SYMBOL_SIZE).toBe(NOTE_SIZE);
		expect(CHORD_SYMBOL_SIZE).toBe(2.8);
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
});
