/**
 * The song working-object vocabulary: the one place the constrained editor
 * controls draw their closed option lists, numeric bounds, and minimal
 * "new item" factories from.
 *
 * The option lists mirror the format's enums as presentational
 * `{ label, value }` pairs ready for a `SelectControl`; the numeric bounds feed
 * `NumberControl` props; and the factories build the smallest fragment each
 * control can insert that is still conformant by construction (a fresh note,
 * for instance, seeds its required pitch). The array helpers are the immutable
 * primitives every list control edits through — they return new arrays and
 * never mutate their input.
 *
 * This module is intentionally pure and dependency-free: it imports neither the
 * schema nor any runtime package. The vocabularies are transcribed here for
 * presentation; a unit test cross-checks them against the schema's enums so the
 * two cannot drift. Labels are plain display strings — translation is applied
 * by the rendering controls that consume these lists, not here.
 */

/**
 * Note / rest durations — reused for an event's `duration` and a tempo's
 * `beatUnit`. Labels are friendly names; values are the format's tokens.
 */
export const DURATIONS = [
	{ label: "Whole", value: "whole" },
	{ label: "Half", value: "half" },
	{ label: "Quarter", value: "quarter" },
	{ label: "Eighth", value: "eighth" },
	{ label: "Sixteenth", value: "sixteenth" },
	{ label: "Thirty-second", value: "thirty-second" },
];

/** Time-signature beat types — the note value one beat represents (numbers). */
export const BEAT_TYPES = [
	{ label: "1", value: 1 },
	{ label: "2", value: 2 },
	{ label: "4", value: 4 },
	{ label: "8", value: 8 },
	{ label: "16", value: 16 },
	{ label: "32", value: 32 },
];

/** Per-hand clefs. */
export const CLEFS = [
	{ label: "Treble", value: "treble" },
	{ label: "Bass", value: "bass" },
	{ label: "Alto", value: "alto" },
	{ label: "Tenor", value: "tenor" },
];

/** Dynamic markings, from softest to loudest plus the accents. */
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

/** Barline styles, for a measure's start and end. */
export const BARLINES = [
	{ label: "Regular", value: "regular" },
	{ label: "Repeat start", value: "repeat-start" },
	{ label: "Repeat end", value: "repeat-end" },
	{ label: "Double", value: "double" },
	{ label: "Final", value: "final" },
];

/** The two kinds of musical event. */
export const EVENT_TYPES = [
	{ label: "Note", value: "note" },
	{ label: "Rest", value: "rest" },
];

/**
 * The shared start/stop span state, used by `tie`, `slur`, `crescendo`, and
 * `decrescendo`.
 */
export const SPAN_STATES = [
	{ label: "Start", value: "start" },
	{ label: "Stop", value: "stop" },
];

/** Annotation placement relative to the staff. */
export const PLACEMENTS = [
	{ label: "Above", value: "above" },
	{ label: "Below", value: "below" },
];

/** The staff a standalone annotation belongs to. */
export const STAVES = [
	{ label: "Right hand", value: "rightHand" },
	{ label: "Left hand", value: "leftHand" },
];

/** Numeric bounds, named for reuse by `NumberControl` props and tests. */
export const BEATS_MIN = 1;
export const OCTAVE_MIN = 0;
export const OCTAVE_MAX = 9;
export const ALTER_MIN = -2;
export const ALTER_MAX = 2;
export const OCTAVE_SHIFT_MIN = -2;
export const OCTAVE_SHIFT_MAX = 2;
export const DOTS_MIN = 0;
export const DOTS_MAX = 2;
/** A tempo's `bpm` must be strictly greater than this. */
export const BPM_MIN_EXCLUSIVE = 0;

/**
 * A single pitch.
 *
 * @param {string} step   The note name (defaults to middle-C's name).
 * @param {number} octave The octave number.
 * @return {Object} A conformant pitch fragment.
 */
export function newPitch(step = "C", octave = 4) {
	return { step, octave };
}

/**
 * A fresh note, seeding the required pitch so it is conformant by construction
 * (a note must carry at least one pitch).
 *
 * @return {Object} A conformant note event.
 */
export function newNote() {
	return { type: "note", duration: "quarter", pitches: [newPitch()] };
}

/**
 * A fresh rest.
 *
 * @return {Object} A conformant rest event.
 */
export function newRest() {
	return { type: "rest", duration: "quarter" };
}

/**
 * An empty measure — conformant on its own (a measure has no required members).
 *
 * @return {Object} A conformant measure.
 */
export function newMeasure() {
	return {};
}

/**
 * A section seeded with one empty measure (a section requires `measures`).
 *
 * @return {Object} A conformant section.
 */
export function newSection() {
	return { measures: [newMeasure()] };
}

/**
 * The minimal conformant song the empty state seeds: one section, one measure.
 *
 * @return {Object} A conformant song.
 */
export function newSong() {
	return { sections: [newSection()] };
}

/**
 * A blank per-event annotation (anchored to its host event, so no `staff`).
 *
 * @return {Object} A conformant event annotation.
 */
export function newEventAnnotation() {
	return { text: "", placement: "above" };
}

/**
 * A blank standalone annotation (placed on a measure, so it names its `staff`).
 *
 * @return {Object} A conformant standalone annotation.
 */
export function newStandaloneAnnotation() {
	return { text: "", placement: "above", staff: "rightHand" };
}

/**
 * Insert `item` at `index`, returning a new array; the input is never mutated.
 * An index at or past the end appends.
 *
 * @param {Array}  list  The source array.
 * @param {number} index The position to insert at.
 * @param {*}      item  The value to insert.
 * @return {Array} A new array with `item` inserted.
 */
export function insertAt(list, index, item) {
	const next = list.slice();
	next.splice(index, 0, item);
	return next;
}

/**
 * Remove the element at `index`, returning a new array; the input is never
 * mutated. An out-of-range index yields a plain copy.
 *
 * @param {Array}  list  The source array.
 * @param {number} index The position to remove.
 * @return {Array} A new array without the removed element.
 */
export function removeAt(list, index) {
	const next = list.slice();
	if (index >= 0 && index < next.length) {
		next.splice(index, 1);
	}
	return next;
}

/**
 * Move the element from `from` to `to`, returning a new array; the input is
 * never mutated. Moving to the same index yields a plain copy.
 *
 * @param {Array}  list The source array.
 * @param {number} from The current index.
 * @param {number} to   The destination index.
 * @return {Array} A new array with the element moved.
 */
export function moveItem(list, from, to) {
	const next = list.slice();
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
}

/**
 * Replace the element at `index` with `item`, returning a new array; the input
 * is never mutated. An out-of-range index yields a plain copy.
 *
 * @param {Array}  list  The source array.
 * @param {number} index The position to replace.
 * @param {*}      item  The replacement value.
 * @return {Array} A new array with the element replaced.
 */
export function replaceAt(list, index, item) {
	const next = list.slice();
	if (index >= 0 && index < next.length) {
		next[index] = item;
	}
	return next;
}
