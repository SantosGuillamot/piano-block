/**
 * Unit tests for the song working-object model helpers.
 *
 * These guard the two contracts every editor control leans on: the option
 * lists are real subsets of the format's enums (cross-checked here against
 * `schema.js`, the single source of truth — the shipped module deliberately
 * does NOT import the schema), and every "new item" factory produces a
 * fragment that, composed into a full song and stringified, `validateSong`
 * accepts. The immutable array helpers are checked for purity (inputs left
 * untouched) and correct results including the no-op edge cases.
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
	DOTS_MAX,
	DOTS_MIN,
	DURATIONS,
	DYNAMICS,
	EVENT_TYPES,
	insertAt,
	moveItem,
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
} from "../songModel.js";

/** Pull the values out of a `{ label, value }` option list. */
const values = (options) => options.map((option) => option.value);

/** The enum a given `$defs` property declares, for cross-checking. */
const eventEnum = (key) => songSchema.$defs.event.properties[key].enum;
const measureEnum = (key) => songSchema.$defs.measure.properties[key].enum;

describe("songModel option lists", () => {
	it("every option list is an array of `{ label, value }` pairs", () => {
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
			expect(Array.isArray(list)).toBe(true);
			expect(list.length).toBeGreaterThan(0);
			for (const option of list) {
				expect(typeof option.label).toBe("string");
				expect(option.label.length).toBeGreaterThan(0);
				expect(Object.hasOwn(option, "value")).toBe(true);
			}
		}
	});

	it("DURATIONS mirrors the event `duration` (and tempo `beatUnit`) enum", () => {
		expect(values(DURATIONS)).toEqual(eventEnum("duration"));
		expect(values(DURATIONS)).toEqual(
			songSchema.$defs.tempo.properties.beatUnit.enum,
		);
	});

	it("BEAT_TYPES mirrors the `timeSignature.beatType` enum (numbers)", () => {
		expect(values(BEAT_TYPES)).toEqual(
			songSchema.$defs.timeSignature.properties.beatType.enum,
		);
		for (const value of values(BEAT_TYPES)) {
			expect(typeof value).toBe("number");
		}
	});

	it("CLEFS mirrors the `handConfig.clef` enum", () => {
		expect(values(CLEFS)).toEqual(
			songSchema.$defs.handConfig.properties.clef.enum,
		);
	});

	it("DYNAMICS mirrors the event `dynamic` enum", () => {
		expect(values(DYNAMICS)).toEqual(eventEnum("dynamic"));
	});

	it("BARLINES mirrors the measure barline enums", () => {
		expect(values(BARLINES)).toEqual(measureEnum("barlineStart"));
		expect(values(BARLINES)).toEqual(measureEnum("barlineEnd"));
	});

	it("EVENT_TYPES mirrors the event `type` enum", () => {
		expect(values(EVENT_TYPES)).toEqual(eventEnum("type"));
	});

	it("SPAN_STATES mirrors the shared start/stop span enums", () => {
		const expected = eventEnum("tie");
		expect(values(SPAN_STATES)).toEqual(expected);
		for (const key of ["slur", "crescendo", "decrescendo"]) {
			expect(eventEnum(key)).toEqual(expected);
		}
	});

	it("PLACEMENTS mirrors the annotation `placement` enum", () => {
		expect(values(PLACEMENTS)).toEqual(
			songSchema.$defs.eventAnnotation.properties.placement.enum,
		);
	});

	it("STAVES mirrors the standalone-annotation `staff` enum", () => {
		expect(values(STAVES)).toEqual(
			songSchema.$defs.standaloneAnnotation.properties.staff.enum,
		);
	});
});

describe("songModel numeric bounds", () => {
	it("mirrors the schema's numeric bounds", () => {
		expect(BEATS_MIN).toBe(
			songSchema.$defs.timeSignature.properties.beats.minimum,
		);
		expect(OCTAVE_MIN).toBe(songSchema.$defs.pitch.properties.octave.minimum);
		expect(OCTAVE_MAX).toBe(songSchema.$defs.pitch.properties.octave.maximum);
		expect(ALTER_MIN).toBe(songSchema.$defs.pitch.properties.alter.minimum);
		expect(ALTER_MAX).toBe(songSchema.$defs.pitch.properties.alter.maximum);
		expect(OCTAVE_SHIFT_MIN).toBe(
			songSchema.$defs.handConfig.properties.octaveShift.minimum,
		);
		expect(OCTAVE_SHIFT_MAX).toBe(
			songSchema.$defs.handConfig.properties.octaveShift.maximum,
		);
		expect(DOTS_MIN).toBe(songSchema.$defs.event.properties.dots.minimum);
		expect(DOTS_MAX).toBe(songSchema.$defs.event.properties.dots.maximum);
		expect(BPM_MIN_EXCLUSIVE).toBe(0);
	});
});

describe("songModel factories", () => {
	/** Compose a fragment-bearing event into a full song for validation. */
	const songWithEvents = (events) => ({
		sections: [{ measures: [{ rightHand: events }] }],
	});

	it("newPitch defaults to C4 and honours overrides", () => {
		expect(newPitch()).toEqual({ step: "C", octave: 4 });
		expect(newPitch("G", 5)).toEqual({ step: "G", octave: 5 });
	});

	it("newNote seeds the required pitch and validates inside a measure", () => {
		const note = newNote();
		expect(note.type).toBe("note");
		expect(note.pitches).toEqual([{ step: "C", octave: 4 }]);
		expect(validateSong(JSON.stringify(songWithEvents([note])))).toEqual([]);
	});

	it("newRest validates inside a measure", () => {
		const rest = newRest();
		expect(rest).toEqual({ type: "rest", duration: "quarter" });
		expect(validateSong(JSON.stringify(songWithEvents([rest])))).toEqual([]);
	});

	it("newMeasure is an empty conformant measure", () => {
		expect(newMeasure()).toEqual({});
		const song = { sections: [{ measures: [newMeasure()] }] };
		expect(validateSong(JSON.stringify(song))).toEqual([]);
	});

	it("newSection is a conformant section", () => {
		const section = newSection();
		expect(section.measures).toEqual([{}]);
		expect(validateSong(JSON.stringify({ sections: [section] }))).toEqual([]);
	});

	it("newSong is the minimal conformant song", () => {
		const song = newSong();
		expect(song).toEqual({ sections: [{ measures: [{}] }] });
		expect(validateSong(JSON.stringify(song))).toEqual([]);
	});

	it("newEventAnnotation validates on an event", () => {
		const annotation = newEventAnnotation();
		expect(annotation).toEqual({ text: "", placement: "above" });
		const note = { ...newNote(), annotations: [annotation] };
		expect(validateSong(JSON.stringify(songWithEvents([note])))).toEqual([]);
	});

	it("newStandaloneAnnotation validates on a measure", () => {
		const annotation = newStandaloneAnnotation();
		expect(annotation).toEqual({
			text: "",
			placement: "above",
			staff: "rightHand",
		});
		const song = {
			sections: [{ measures: [{ annotations: [annotation] }] }],
		};
		expect(validateSong(JSON.stringify(song))).toEqual([]);
	});
});

describe("songModel array helpers", () => {
	it("insertAt inserts without mutating the input", () => {
		const list = [1, 2, 3];
		const result = insertAt(list, 1, 9);
		expect(result).toEqual([1, 9, 2, 3]);
		expect(list).toEqual([1, 2, 3]);
		expect(result).not.toBe(list);
	});

	it("insertAt appends when index is at or past the end", () => {
		expect(insertAt([1, 2], 2, 9)).toEqual([1, 2, 9]);
		expect(insertAt([1, 2], 99, 9)).toEqual([1, 2, 9]);
	});

	it("removeAt removes without mutating the input", () => {
		const list = [1, 2, 3];
		const result = removeAt(list, 1);
		expect(result).toEqual([1, 3]);
		expect(list).toEqual([1, 2, 3]);
		expect(result).not.toBe(list);
	});

	it("removeAt returns a copy for an out-of-range index", () => {
		const list = [1, 2, 3];
		const result = removeAt(list, 99);
		expect(result).toEqual([1, 2, 3]);
		expect(result).not.toBe(list);
	});

	it("moveItem moves an element without mutating the input", () => {
		const list = [1, 2, 3, 4];
		const result = moveItem(list, 0, 2);
		expect(result).toEqual([2, 3, 1, 4]);
		expect(list).toEqual([1, 2, 3, 4]);
		expect(result).not.toBe(list);
	});

	it("moveItem to the same index is a no-op copy", () => {
		const list = [1, 2, 3];
		const result = moveItem(list, 1, 1);
		expect(result).toEqual([1, 2, 3]);
		expect(result).not.toBe(list);
	});

	it("replaceAt replaces without mutating the input", () => {
		const list = [1, 2, 3];
		const result = replaceAt(list, 1, 9);
		expect(result).toEqual([1, 9, 3]);
		expect(list).toEqual([1, 2, 3]);
		expect(result).not.toBe(list);
	});

	it("replaceAt returns a copy for an out-of-range index", () => {
		const list = [1, 2, 3];
		const result = replaceAt(list, 99, 9);
		expect(result).toEqual([1, 2, 3]);
		expect(result).not.toBe(list);
	});
});
