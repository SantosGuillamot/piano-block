/**
 * Sanity checks for the song schema-as-data module (design §7).
 *
 * The schema is fully exercised indirectly by the validator's unit tests
 * (Task 3), which consume it to accept/reject fixtures. These minimal
 * assertions just guard the load-bearing shape the walker relies on: the
 * root requirement and the single `note → pitches` conditional.
 */
import songSchema from "../schema.js";

describe("songSchema", () => {
	it("exports an object whose only required top-level member is `sections`", () => {
		expect(typeof songSchema).toBe("object");
		expect(songSchema.type).toBe("object");
		expect(songSchema.required).toEqual(["sections"]);
	});

	it("defines the `note → pitches` conditional on `$defs.event`", () => {
		const event = songSchema.$defs.event;
		// Discriminant: type === "note".
		expect(event.if.properties.type.const).toBe("note");
		// Consequence: pitches is required for a note.
		expect(event.then.required).toContain("pitches");
	});
});
