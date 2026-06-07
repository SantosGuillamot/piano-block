/**
 * The editor's single home for the song working-object vocabularies and the
 * minimal "new item" factories every constrained control reuses.
 *
 * The visual editor only ever edits a conformant working object, so it must
 * present the same closed vocabularies and numeric bounds the format defines.
 * Rather than import the schema (which is declarative data the validator
 * interprets, not presentational metadata), this module restates those
 * vocabularies as `{ label, value }` option lists ready for `SelectControl` and
 * as named numeric bounds ready for `NumberControl` — with i18n-wrapped labels
 * where a friendlier label helps and the raw value otherwise. A test
 * cross-checks every value and bound against the schema's own enums and ranges,
 * so the two cannot silently drift.
 *
 * The factories return the smallest fragment that is conformant on its own —
 * e.g. `newNote` seeds the one pitch a note requires — so every control that
 * adds an item produces a song that stays conformant by construction.
 */
import { __ } from "@wordpress/i18n";

/**
 * Event `duration` and tempo `beatUnit`: the note-value vocabulary, longest to
 * shortest.
 */
export const DURATIONS = [
	{ label: __("Whole", "piano-block"), value: "whole" },
	{ label: __("Half", "piano-block"), value: "half" },
	{ label: __("Quarter", "piano-block"), value: "quarter" },
	{ label: __("Eighth", "piano-block"), value: "eighth" },
	{ label: __("Sixteenth", "piano-block"), value: "sixteenth" },
	{ label: __("Thirty-second", "piano-block"), value: "thirty-second" },
];

/** Time-signature `beatType`: the lower-numeral note values (as numbers). */
export const BEAT_TYPES = [
	{ label: "1", value: 1 },
	{ label: "2", value: 2 },
	{ label: "4", value: 4 },
	{ label: "8", value: 8 },
	{ label: "16", value: 16 },
	{ label: "32", value: 32 },
];

/** Hand-config `clef`. */
export const CLEFS = [
	{ label: __("Treble", "piano-block"), value: "treble" },
	{ label: __("Bass", "piano-block"), value: "bass" },
	{ label: __("Alto", "piano-block"), value: "alto" },
	{ label: __("Tenor", "piano-block"), value: "tenor" },
];

/** Event `dynamic`: the dynamic markings, softest to loudest then accents. */
export const DYNAMICS = [
	{ label: "pp", value: "pp" },
	{ label: "p", value: "p" },
	{ label: "mp", value: "mp" },
	{ label: "mf", value: "mf" },
	{ label: "f", value: "f" },
	{ label: "ff", value: "ff" },
	{ label: "sf", value: "sf" },
	{ label: "sfz", value: "sfz" },
];

/** Measure `barlineStart` / `barlineEnd`. */
export const BARLINES = [
	{ label: __("Regular", "piano-block"), value: "regular" },
	{ label: __("Repeat start", "piano-block"), value: "repeat-start" },
	{ label: __("Repeat end", "piano-block"), value: "repeat-end" },
	{ label: __("Double", "piano-block"), value: "double" },
	{ label: __("Final", "piano-block"), value: "final" },
];

/** Event `type`. */
export const EVENT_TYPES = [
	{ label: __("Note", "piano-block"), value: "note" },
	{ label: __("Rest", "piano-block"), value: "rest" },
];

/**
 * The shared start/stop span state, used by `tie`, `slur`, `crescendo` and
 * `decrescendo`.
 */
export const SPAN_STATES = [
	{ label: __("Start", "piano-block"), value: "start" },
	{ label: __("Stop", "piano-block"), value: "stop" },
];

/** Annotation `placement`. */
export const PLACEMENTS = [
	{ label: __("Above", "piano-block"), value: "above" },
	{ label: __("Below", "piano-block"), value: "below" },
];

/** Standalone-annotation `staff`. */
export const STAVES = [
	{ label: __("Right hand", "piano-block"), value: "rightHand" },
	{ label: __("Left hand", "piano-block"), value: "leftHand" },
];

/** Time-signature `beats`: at least one beat per measure. */
export const BEATS_MIN = 1;

/** Pitch `octave` range. */
export const OCTAVE_MIN = 0;
export const OCTAVE_MAX = 9;

/** Pitch `alter` range (and the value range of hand-config `alters`). */
export const ALTER_MIN = -2;
export const ALTER_MAX = 2;

/** Hand-config `octaveShift` range. */
export const OCTAVE_SHIFT_MIN = -2;
export const OCTAVE_SHIFT_MAX = 2;

/** Event `dots` range. */
export const DOTS_MIN = 0;
export const DOTS_MAX = 2;

/** Tempo `bpm`: the strict lower bound — bpm must be greater than this. */
export const BPM_MIN_EXCLUSIVE = 0;

/**
 * A minimal pitch.
 *
 * @param {string} [step="C"]  The note name.
 * @param {number} [octave=4]  The octave (middle-C octave by default).
 * @return {{ step: string, octave: number }} A conformant pitch fragment.
 */
export function newPitch(step = "C", octave = 4) {
	return { step, octave };
}

/**
 * A minimal note, seeded with the one pitch a note requires (the note
 * invariant: a note must carry at least one pitch).
 *
 * @return {Object} A conformant note event.
 */
export function newNote() {
	return { type: "note", duration: "quarter", pitches: [newPitch()] };
}

/**
 * A minimal rest.
 *
 * @return {Object} A conformant rest event.
 */
export function newRest() {
	return { type: "rest", duration: "quarter" };
}

/**
 * A minimal measure. An empty measure is conformant — the schema requires
 * nothing inside one.
 *
 * @return {Object} A conformant measure.
 */
export function newMeasure() {
	return {};
}

/**
 * A minimal section, seeded with one empty measure (a section requires a
 * `measures` array).
 *
 * @return {Object} A conformant section.
 */
export function newSection() {
	return { measures: [newMeasure()] };
}

/**
 * The minimal conformant song the empty state seeds: one section with one empty
 * measure.
 *
 * @return {Object} A conformant song working object.
 */
export function newSong() {
	return { sections: [newSection()] };
}

/**
 * A minimal event annotation (anchored to its host event's hand/position).
 *
 * @return {Object} A conformant event annotation.
 */
export function newEventAnnotation() {
	return { text: "", placement: "above" };
}

/**
 * A minimal standalone (measure-level) annotation. Unanchored to any event, it
 * must declare the staff it belongs to.
 *
 * @return {Object} A conformant standalone annotation.
 */
export function newStandaloneAnnotation() {
	return { text: "", placement: "above", staff: "rightHand" };
}

/**
 * Return a new array with `item` inserted at `index` (the existing elements at
 * and after `index` shift right). Never mutates `list`.
 *
 * @param {Array}  list  The source array.
 * @param {number} index The insertion index.
 * @param {*}      item  The item to insert.
 * @return {Array} A new array with `item` inserted.
 */
export function insertAt(list, index, item) {
	const next = list.slice();
	next.splice(index, 0, item);
	return next;
}

/**
 * Return a new array with the element at `index` removed. An out-of-range index
 * yields a plain copy. Never mutates `list`.
 *
 * @param {Array}  list  The source array.
 * @param {number} index The index to remove.
 * @return {Array} A new array without the element.
 */
export function removeAt(list, index) {
	const next = list.slice();
	if (index >= 0 && index < next.length) {
		next.splice(index, 1);
	}
	return next;
}

/**
 * Return a new array with the element at `from` moved to `to`. A no-op move (same
 * index) or an out-of-range index yields a plain copy. Never mutates `list`.
 *
 * @param {Array}  list The source array.
 * @param {number} from The current index of the element to move.
 * @param {number} to   The target index.
 * @return {Array} A new array with the element repositioned.
 */
export function moveItem(list, from, to) {
	const next = list.slice();
	if (
		from === to ||
		from < 0 ||
		from >= next.length ||
		to < 0 ||
		to >= next.length
	) {
		return next;
	}
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}

/**
 * Return a new array with the element at `index` replaced by `item`. An
 * out-of-range index yields a plain copy. Never mutates `list`.
 *
 * @param {Array}  list  The source array.
 * @param {number} index The index to replace.
 * @param {*}      item  The replacement item.
 * @return {Array} A new array with the element replaced.
 */
export function replaceAt(list, index, item) {
	const next = list.slice();
	if (index >= 0 && index < next.length) {
		next[index] = item;
	}
	return next;
}
