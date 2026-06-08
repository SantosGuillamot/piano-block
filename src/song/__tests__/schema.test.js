/**
 * Sanity checks for the song schema-as-data module.
 *
 * The schema is fully exercised indirectly by the validator's unit tests,
 * which consume it to accept/reject fixtures. These minimal
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

	it("defines the gradual-dynamic span fields symmetric with `tie` / `slur`", () => {
		const { properties } = songSchema.$defs.event;
		// `crescendo` / `decrescendo` are two independent optional start/stop
		// enums, byte-for-byte symmetric with the existing `tie` / `slur`.
		expect(properties.crescendo).toEqual({ enum: ["start", "stop"] });
		expect(properties.decrescendo).toEqual({ enum: ["start", "stop"] });
	});

	it("declares the optional `language` enum (the note-name system keys), not required", () => {
		// Editor-internal, permissive: the enum keys are exactly the note-name
		// system keys (`spanish` / `english`), and the field is never required.
		expect(songSchema.properties.language).toEqual({
			enum: ["spanish", "english"],
		});
		expect(songSchema.required).not.toContain("language");
	});
});
