/**
 * Unit tests for the editor's song-shape helpers and constrained-field
 * vocabularies.
 *
 * Two contracts are asserted here. First, every presentational option list and
 * numeric bound mirrors the format's single source of truth — the schema's own
 * enums and integer ranges (imported ONLY in this test to cross-check, never in
 * the shipped module). Second, every "new item" factory produces a fragment
 * that, composed into a `newSong()`-shaped context and serialized, the real
 * `validateSong` accepts — so the controls that reuse these factories are
 * conformant by construction. The array helpers are asserted pure (input
 * untouched) including their no-op and out-of-range edge cases.
 */
import songSchema from "../../song/schema.js";
import validateSong from "../../song/validate.js";
import {
	ALTER_MAX,
	ALTER_MIN,
	BARLINES,
	BEAT_TYPES,
	BEATS_MIN,
	BPM_MIN_EXCLUSIVE,
	CLEFS,
	clampInt,
	DOTS_MAX,
	DOTS_MIN,
	DURATIONS,
	DYNAMICS,
	duplicateAt,
	EVENT_TYPES,
	insertAt,
	newEventAnnotation,
	newMeasure,
	newNote,
	newPitch,
	newRest,
	newSection,
	newSong,
	newStandaloneAnnotation,
	OCTAVE_MAX,
	OCTAVE_MIN,
	OCTAVE_SHIFT_MAX,
	OCTAVE_SHIFT_MIN,
	PLACEMENTS,
	removeAt,
	replaceAt,
	SPAN_STATES,
	STAVES,
	setEventAt,
	setMeasureAt,
	setSectionAt,
	toBoundedInt,
	toNumber,
} from "../songModel.js";

/** The raw values an option list presents, in order. */
const values = (options) => options.map((option) => option.value);

describe("option-list vocabularies mirror the schema enums", () => {
	it("DURATIONS mirrors the event-duration / beat-unit enum", () => {
		expect(values(DURATIONS)).toEqual(
			songSchema.$defs.event.properties.duration.enum,
		);
		expect(values(DURATIONS)).toEqual(
			songSchema.$defs.tempo.properties.beatUnit.enum,
		);
	});

	it("BEAT_TYPES mirrors the time-signature beat-type enum (numbers)", () => {
		expect(values(BEAT_TYPES)).toEqual(
			songSchema.$defs.timeSignature.properties.beatType.enum,
		);
	});

	it("CLEFS mirrors the hand-config clef enum", () => {
		expect(values(CLEFS)).toEqual(
			songSchema.$defs.handConfig.properties.clef.enum,
		);
	});

	it("DYNAMICS mirrors the event-dynamic enum", () => {
		expect(values(DYNAMICS)).toEqual(
			songSchema.$defs.event.properties.dynamic.enum,
		);
	});

	it("BARLINES mirrors the measure barline enums", () => {
		expect(values(BARLINES)).toEqual(
			songSchema.$defs.measure.properties.barlineStart.enum,
		);
		expect(values(BARLINES)).toEqual(
			songSchema.$defs.measure.properties.barlineEnd.enum,
		);
	});

	it("EVENT_TYPES mirrors the event-type enum", () => {
		expect(values(EVENT_TYPES)).toEqual(
			songSchema.$defs.event.properties.type.enum,
		);
	});

	it("SPAN_STATES mirrors the tie / slur / crescendo / decrescendo enums", () => {
		const { tie, slur, crescendo, decrescendo } =
			songSchema.$defs.event.properties;
		expect(values(SPAN_STATES)).toEqual(tie.enum);
		expect(values(SPAN_STATES)).toEqual(slur.enum);
		expect(values(SPAN_STATES)).toEqual(crescendo.enum);
		expect(values(SPAN_STATES)).toEqual(decrescendo.enum);
	});

	it("PLACEMENTS mirrors the annotation placement enum", () => {
		expect(values(PLACEMENTS)).toEqual(
			songSchema.$defs.eventAnnotation.properties.placement.enum,
		);
		expect(values(PLACEMENTS)).toEqual(
			songSchema.$defs.standaloneAnnotation.properties.placement.enum,
		);
	});

	it("STAVES mirrors the standalone-annotation staff enum", () => {
		expect(values(STAVES)).toEqual(
			songSchema.$defs.standaloneAnnotation.properties.staff.enum,
		);
	});

	it("every option carries a non-empty label and a member value", () => {
		const lists = [
			DURATIONS,
			BEAT_TYPES,
			CLEFS,
			DYNAMICS,
			BARLINES,
			EVENT_TYPES,
			SPAN_STATES,
			PLACEMENTS,
			STAVES,
		];
		for (const list of lists) {
			for (const option of list) {
				expect(typeof option.label).toBe("string");
				expect(option.label.length).toBeGreaterThan(0);
				expect(option).toHaveProperty("value");
			}
		}
	});
});

describe("numeric bounds mirror the schema ranges", () => {
	it("BEATS_MIN mirrors the time-signature beats minimum", () => {
		expect(BEATS_MIN).toBe(
			songSchema.$defs.timeSignature.properties.beats.minimum,
		);
	});

	it("OCTAVE_MIN / OCTAVE_MAX mirror the pitch octave range", () => {
		expect(OCTAVE_MIN).toBe(songSchema.$defs.pitch.properties.octave.minimum);
		expect(OCTAVE_MAX).toBe(songSchema.$defs.pitch.properties.octave.maximum);
	});

	it("ALTER_MIN / ALTER_MAX mirror the pitch alter range (and alters values)", () => {
		expect(ALTER_MIN).toBe(songSchema.$defs.pitch.properties.alter.minimum);
		expect(ALTER_MAX).toBe(songSchema.$defs.pitch.properties.alter.maximum);
	});

	it("OCTAVE_SHIFT_MIN / OCTAVE_SHIFT_MAX mirror the octave-shift range", () => {
		expect(OCTAVE_SHIFT_MIN).toBe(
			songSchema.$defs.handConfig.properties.octaveShift.minimum,
		);
		expect(OCTAVE_SHIFT_MAX).toBe(
			songSchema.$defs.handConfig.properties.octaveShift.maximum,
		);
	});

	it("DOTS_MIN / DOTS_MAX mirror the event dots range", () => {
		expect(DOTS_MIN).toBe(songSchema.$defs.event.properties.dots.minimum);
		expect(DOTS_MAX).toBe(songSchema.$defs.event.properties.dots.maximum);
	});

	it("BPM_MIN_EXCLUSIVE is the strict lower bound (bpm > 0)", () => {
		expect(BPM_MIN_EXCLUSIVE).toBe(0);
	});
});

describe("factories produce conformant fragments", () => {
	it("newPitch defaults to middle C and accepts overrides", () => {
		expect(newPitch()).toEqual({ step: "C", octave: 4 });
		expect(newPitch("G", 5)).toEqual({ step: "G", octave: 5 });
	});

	it("newNote seeds the required pitch (the note invariant)", () => {
		const note = newNote();
		expect(note.type).toBe("note");
		expect(note.duration).toBe("quarter");
		expect(note.pitches).toEqual([{ step: "C", octave: 4 }]);
	});

	it("newRest is a typed quarter rest with no pitches", () => {
		expect(newRest()).toEqual({ type: "rest", duration: "quarter" });
	});

	it("newMeasure is an empty (conformant) measure", () => {
		expect(newMeasure()).toEqual({});
	});

	it("newSection seeds one empty measure", () => {
		expect(newSection()).toEqual({ measures: [{}] });
	});

	it("newSong is the minimal conformant song", () => {
		expect(newSong()).toEqual({ sections: [{ measures: [{}] }] });
	});

	it("newEventAnnotation defaults to empty text placed above", () => {
		expect(newEventAnnotation()).toEqual({ text: "", placement: "above" });
	});

	it("newStandaloneAnnotation defaults to right-hand, placed above", () => {
		expect(newStandaloneAnnotation()).toEqual({
			text: "",
			placement: "above",
			staff: "rightHand",
		});
	});

	// Each fragment is composed into a full song and serialized; the real
	// validator must accept it (no errors).
	const expectConformant = (song) =>
		expect(validateSong(JSON.stringify(song))).toEqual([]);

	it("newSong serializes to a conformant song", () => {
		expectConformant(newSong());
	});

	it("a note inside a measure inside a section is conformant", () => {
		const song = newSong();
		song.sections[0].measures[0].rightHand = [newNote()];
		expectConformant(song);
	});

	it("a rest inside a measure is conformant", () => {
		const song = newSong();
		song.sections[0].measures[0].leftHand = [newRest()];
		expectConformant(song);
	});

	it("a standalone measure annotation is conformant", () => {
		const song = newSong();
		song.sections[0].measures[0].annotations = [newStandaloneAnnotation()];
		expectConformant(song);
	});

	it("an event annotation on a note is conformant", () => {
		const note = newNote();
		note.annotations = [newEventAnnotation()];
		const song = newSong();
		song.sections[0].measures[0].rightHand = [note];
		expectConformant(song);
	});

	it("an extra pitch added to a note is conformant", () => {
		const note = newNote();
		note.pitches.push(newPitch("E", 4));
		const song = newSong();
		song.sections[0].measures[0].rightHand = [note];
		expectConformant(song);
	});
});

describe("immutable array helpers", () => {
	it("insertAt returns a new array with the item spliced in", () => {
		const list = ["a", "b", "c"];
		const result = insertAt(list, 1, "x");
		expect(result).toEqual(["a", "x", "b", "c"]);
		expect(list).toEqual(["a", "b", "c"]);
		expect(result).not.toBe(list);
	});

	it("insertAt appends when index is at the end", () => {
		expect(insertAt(["a", "b"], 2, "c")).toEqual(["a", "b", "c"]);
	});

	it("removeAt returns a new array without the item", () => {
		const list = ["a", "b", "c"];
		const result = removeAt(list, 1);
		expect(result).toEqual(["a", "c"]);
		expect(list).toEqual(["a", "b", "c"]);
		expect(result).not.toBe(list);
	});

	it("removeAt out of range returns a copy (no-op)", () => {
		const list = ["a", "b"];
		const result = removeAt(list, 5);
		expect(result).toEqual(["a", "b"]);
		expect(result).not.toBe(list);
	});

	it("replaceAt swaps in a new item without mutating", () => {
		const list = ["a", "b", "c"];
		const result = replaceAt(list, 1, "x");
		expect(result).toEqual(["a", "x", "c"]);
		expect(list).toEqual(["a", "b", "c"]);
		expect(result).not.toBe(list);
	});

	it("replaceAt out of range returns a copy (no-op)", () => {
		const list = ["a", "b"];
		const result = replaceAt(list, 5, "x");
		expect(result).toEqual(["a", "b"]);
		expect(result).not.toBe(list);
	});

	it("duplicateAt inserts a copy immediately after the original", () => {
		const list = ["a", "b", "c"];
		const result = duplicateAt(list, 1);
		expect(result).toEqual(["a", "b", "b", "c"]);
		expect(list).toEqual(["a", "b", "c"]);
		expect(result).not.toBe(list);
	});

	it("duplicateAt deep-copies the item (nested mutation does not leak)", () => {
		const section = { measures: [{}] };
		const list = [section];
		const result = duplicateAt(list, 0);
		expect(result).toHaveLength(2);
		expect(result[1]).toEqual(section);
		expect(result[1]).not.toBe(section);
		// Mutating a nested field of the copy must not touch the original.
		result[1].measures.push({});
		expect(section.measures).toHaveLength(1);
	});

	it("duplicateAt out of range returns a copy (no-op)", () => {
		const list = ["a", "b"];
		expect(duplicateAt(list, 5)).toEqual(["a", "b"]);
		expect(duplicateAt(list, -1)).toEqual(["a", "b"]);
		expect(duplicateAt(list, 5)).not.toBe(list);
	});
});

describe("numeric-input parse helpers", () => {
	it("clampInt rounds and stays inside the bounds", () => {
		expect(clampInt("3", 0, 9)).toBe(3);
		expect(clampInt("3.4", 0, 9)).toBe(3);
		expect(clampInt("3.6", 0, 9)).toBe(4);
	});

	it("clampInt clamps at and beyond each bound", () => {
		expect(clampInt("0", 0, 9)).toBe(0);
		expect(clampInt("9", 0, 9)).toBe(9);
		expect(clampInt("-5", 0, 9)).toBe(0);
		expect(clampInt("42", 0, 9)).toBe(9);
	});

	it("clampInt returns min for a non-numeric input", () => {
		// `Number("")` is 0 (finite), so an empty string clamps into range, not to
		// min; only a genuinely non-numeric value (NaN) falls back to min.
		expect(clampInt("", -2, 2)).toBe(0);
		expect(clampInt("abc", -2, 2)).toBe(-2);
		expect(clampInt(undefined, -2, 2)).toBe(-2);
	});

	it("toNumber returns a finite number or null for empty/invalid", () => {
		expect(toNumber("4")).toBe(4);
		expect(toNumber("4.5")).toBe(4.5);
		expect(toNumber("")).toBeNull();
		expect(toNumber(null)).toBeNull();
		expect(toNumber(undefined)).toBeNull();
		expect(toNumber("abc")).toBeNull();
	});

	it("toBoundedInt rounds, floors at min, and returns null when empty", () => {
		expect(toBoundedInt("4", 1)).toBe(4);
		expect(toBoundedInt("4.6", 1)).toBe(5);
		expect(toBoundedInt("0", 1)).toBe(1);
		expect(toBoundedInt("-3", 1)).toBe(1);
		expect(toBoundedInt("", 1)).toBeNull();
		expect(toBoundedInt("abc", 1)).toBeNull();
	});
});

describe("typed splice faces dispatch by caller depth, not by coords", () => {
	// A two-section song; each section carries two measures; the first measure of
	// section 0 carries one right-hand note. Enough depth to prove each face
	// splices at its own level and ignores any stray deeper coord.
	const makeSong = () => ({
		sections: [
			{
				name: "A",
				measures: [
					{ rightHand: [{ type: "note", duration: "quarter" }] },
					{ name: "m1" },
				],
			},
			{ name: "B", measures: [{}, {}] },
		],
	});

	it("setSectionAt replaces only the section, never mutating the input", () => {
		const song = makeSong();
		const next = setSectionAt(song, { sectionIndex: 1 }, { name: "B2" });
		expect(next.sections[1]).toEqual({ name: "B2" });
		expect(next.sections[0]).toBe(song.sections[0]);
		expect(song.sections[1]).toEqual({ name: "B", measures: [{}, {}] });
	});

	it("setSectionAt ignores a stray deeper coord (replaces only the section)", () => {
		const song = makeSong();
		// measureIndex/eventIndex are present but must be structurally ignored.
		const next = setSectionAt(
			song,
			{ sectionIndex: 0, measureIndex: 9, eventIndex: 9 },
			{ name: "A2" },
		);
		expect(next.sections[0]).toEqual({ name: "A2" });
		expect(next.sections[1]).toBe(song.sections[1]);
	});

	it("setMeasureAt replaces only the measure at its two coords", () => {
		const song = makeSong();
		const next = setMeasureAt(
			song,
			{ sectionIndex: 0, measureIndex: 1 },
			{ name: "m1-edited" },
		);
		expect(next.sections[0].measures[1]).toEqual({ name: "m1-edited" });
		expect(next.sections[0].measures[0]).toBe(song.sections[0].measures[0]);
		expect(next.sections[1]).toBe(song.sections[1]);
	});

	it("setMeasureAt ignores a stray deeper coord (hand/eventIndex)", () => {
		const song = makeSong();
		const next = setMeasureAt(
			song,
			{ sectionIndex: 0, measureIndex: 0, hand: "rightHand", eventIndex: 9 },
			{ name: "m0-edited" },
		);
		expect(next.sections[0].measures[0]).toEqual({ name: "m0-edited" });
		expect(next.sections[0].measures[1]).toBe(song.sections[0].measures[1]);
	});

	it("setEventAt replaces only the event at its four coords", () => {
		const song = makeSong();
		const nextEvent = { type: "rest", duration: "half" };
		const next = setEventAt(
			song,
			{ sectionIndex: 0, measureIndex: 0, hand: "rightHand", eventIndex: 0 },
			nextEvent,
		);
		expect(next.sections[0].measures[0].rightHand[0]).toEqual(nextEvent);
		expect(next.sections[0].measures[1]).toBe(song.sections[0].measures[1]);
		expect(next.sections[1]).toBe(song.sections[1]);
		// Input untouched.
		expect(song.sections[0].measures[0].rightHand[0]).toEqual({
			type: "note",
			duration: "quarter",
		});
	});
});
