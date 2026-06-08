/**
 * Sanity checks for the song schema-as-data module.
 *
 * The schema is fully exercised indirectly by the validator's unit tests,
 * which consume it to accept/reject fixtures. These minimal
 * assertions just guard the load-bearing shape the walker relies on: the
 * root requirement and the single `note → pitches` conditional.
 */
import songSchema from "../schema.js";
import validateSong from "../validate.js";

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

	it("declares the optional `name` string on section and measure, not required", () => {
		// Editor-side label, additive and permissive: a `{ type: "string" }`
		// field on both section and measure, never in either `required` array
		// (mirrors the `language` precedent — present but optional).
		expect(songSchema.$defs.section.properties.name).toEqual({
			type: "string",
		});
		expect(songSchema.$defs.measure.properties.name).toEqual({
			type: "string",
		});
		expect(songSchema.$defs.section.required).not.toContain("name");
		expect(songSchema.$defs.measure.required ?? []).not.toContain("name");
	});
});

describe("song `name` validation (additive optional field)", () => {
	it("accepts a section and measure carrying a string `name`", () => {
		const song = {
			sections: [
				{
					name: "Verse",
					measures: [{ name: "Pickup" }],
				},
			],
		};
		expect(validateSong(JSON.stringify(song))).toEqual([]);
	});

	it("does not regress existing valid songs that omit `name`", () => {
		// A pre-existing song without any `name` keys stays valid — `name` is
		// purely additive and never required.
		expect(validateSong('{"sections":[{"measures":[{}]}]}')).toEqual([]);
	});

	it("reports a type error for a non-string section/measure `name`", () => {
		// A non-string `name` is a type error (documenting the declared type) but
		// the field is never `required`, so its absence is always fine.
		const sectionErrors = validateSong(
			JSON.stringify({ sections: [{ name: 7, measures: [] }] }),
		);
		expect(sectionErrors).toEqual([
			"sections[0].name: expected string but got number",
		]);

		const measureErrors = validateSong(
			JSON.stringify({ sections: [{ measures: [{ name: 7 }] }] }),
		);
		expect(measureErrors).toEqual([
			"sections[0].measures[0].name: expected string but got number",
		]);
	});
});
