/**
 * Unit tests for the serialize-time conformance guard.
 *
 * Two contracts are asserted. First, `serializeSong` turns a working object into
 * a string the real `validateSong` accepts (`[]`) — so a song built from the
 * conformant factories round-trips cleanly. Second, `commitSong` only persists
 * when that serialized string is conformant: a conformant object reaches
 * `onChangeSong` with the exact serialized string, while a deliberately
 * malformed object (a note with an empty `pitches` array) is refused — it never
 * calls `onChangeSong` and emits a developer `console.warn`. The warn spy is
 * restored so the shared console assertions do not fail the suite on the
 * expected (and asserted) warning.
 */
import validateSong from "../../song/validate.js";
import { commitSong, serializeSong } from "../serializeSong.js";
import { newNote, newSong } from "../songModel.js";

describe("serializeSong", () => {
	it("serializes a working object to a string the validator accepts", () => {
		const song = serializeSong(newSong());
		expect(typeof song).toBe("string");
		expect(validateSong(song)).toEqual([]);
	});
});

describe("commitSong", () => {
	it("persists the serialized string for a conformant object", () => {
		const onChangeSong = jest.fn();
		const workingObject = newSong();

		commitSong(workingObject, onChangeSong);

		expect(onChangeSong).toHaveBeenCalledTimes(1);
		expect(onChangeSong).toHaveBeenCalledWith(serializeSong(workingObject));
	});

	it("refuses a non-conformant object and warns instead of persisting", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
		const onChangeSong = jest.fn();

		// A note with an empty `pitches` array is structurally non-conformant.
		const malformedNote = { ...newNote(), pitches: [] };
		const workingObject = {
			sections: [{ measures: [{ rightHand: [malformedNote] }] }],
		};

		commitSong(workingObject, onChangeSong);

		expect(onChangeSong).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledTimes(1);

		warn.mockRestore();
	});
});
