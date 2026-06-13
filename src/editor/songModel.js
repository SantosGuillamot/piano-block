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

/**
 * The two hands, in score order (right above left). Used wherever the hand
 * vocabulary needs to iterate — `StructureTree`, `ContextEditor` — so there is
 * one canonical ordered list.
 */
export const HANDS = [
	{ key: "rightHand", label: __("Right hand", "piano-block") },
	{ key: "leftHand", label: __("Left hand", "piano-block") },
];

/** Standalone-annotation `staff`. Derived from `HANDS` so label text stays in sync. */
export const STAVES = HANDS.map((h) => ({ label: h.label, value: h.key }));

/**
 * The "none" select option shared by controls that offer an empty/absent
 * choice — barline, clef, alteration note, staff. Centralised so the text is
 * consistent across panels.
 */
export const NONE_OPTION = { label: __("None", "piano-block"), value: "" };

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

/**
 * Coerce a numeric-input string to an integer clamped to `[min, max]`. A
 * non-numeric input clamps to `min`, so a control can never produce an
 * out-of-range value. This is the one home for the rule the bounded
 * `NumberControl` editors share.
 *
 * @param {string} raw The raw field value.
 * @param {number} min The lower bound.
 * @param {number} max The upper bound.
 * @return {number} The clamped integer.
 */
export function clampInt(raw, min, max) {
	const parsed = Math.round(Number(raw));
	if (!Number.isFinite(parsed)) {
		return min;
	}
	return Math.min(max, Math.max(min, parsed));
}

/**
 * Parse a numeric-input string to a finite number, or `null` when empty or
 * invalid. The required-field sub-objects (`tempo`, `timeSignature`) use this to
 * distinguish "no value yet" from a concrete number while the author fills them.
 *
 * @param {string} raw The raw field value.
 * @return {?number} The finite number, or `null`.
 */
function toNumber(raw) {
	if (raw === "" || raw === null || raw === undefined) {
		return null;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parse a numeric-input string to an integer ≥ `min`, or `null` when empty.
 * Unlike `clampInt`, an empty value stays `null` (not floored to `min`) so a
 * not-yet-filled required field can remain absent.
 *
 * @param {string} raw The raw field value.
 * @param {number} min The lower bound.
 * @return {?number} The bounded integer, or `null`.
 */
export function toBoundedInt(raw, min) {
	const parsed = toNumber(raw);
	if (parsed === null) {
		return null;
	}
	return Math.max(min, Math.round(parsed));
}

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

/**
 * Return a new array with a deep copy of the element at `index` inserted
 * immediately after it (so the original and its copy sit side by side). The
 * copy is a `structuredClone`, so mutating the copy never touches the original
 * — duplicating a section copies all its measures and notes, a measure both
 * hands, a note its pitches. An out-of-range index yields a plain copy (the
 * tolerate-and-copy convention `removeAt`/`replaceAt` follow), avoiding the
 * `structuredClone(undefined)` that would otherwise corrupt the list. Never
 * mutates `list`.
 *
 * @param {Array}  list  The source array.
 * @param {number} index The index of the element to duplicate.
 * @return {Array} A new array with the deep copy inserted after the original.
 */
export function duplicateAt(list, index) {
	if (index < 0 || index >= list.length) {
		return list.slice();
	}
	return insertAt(list, index + 1, structuredClone(list[index]));
}

/**
 * Return a new song with `nextSection` spliced in at `sectionIndex`, every level
 * above the splice rebuilt immutably.
 *
 * CRITICAL: reads ONLY `sectionIndex`; the splice depth is fixed by the face
 * chosen, never inferred from whichever coords happen to be present.
 *
 * @param {Object} song              The current song object.
 * @param {Object} coords            The selection coords (only `sectionIndex` is read).
 * @param {number} coords.sectionIndex The section index to replace.
 * @param {Object} nextSection       The replacement section.
 * @return {Object} A new song with the section replaced.
 */
export function setSectionAt(song, { sectionIndex }, nextSection) {
	return {
		...song,
		sections: replaceAt(song.sections, sectionIndex, nextSection),
	};
}

/**
 * Return a new song with `nextMeasure` spliced in at `sectionIndex`/`measureIndex`,
 * every level above the splice rebuilt immutably.
 *
 * CRITICAL: reads ONLY `sectionIndex` and `measureIndex` (see `setSectionAt`); a
 * stray deeper coord on the selection is ignored.
 *
 * @param {Object} song               The current song object.
 * @param {Object} coords             The selection coords (only the two read).
 * @param {number} coords.sectionIndex The section index.
 * @param {number} coords.measureIndex The measure index to replace.
 * @param {Object} nextMeasure        The replacement measure.
 * @return {Object} A new song with the measure replaced.
 */
export function setMeasureAt(
	song,
	{ sectionIndex, measureIndex },
	nextMeasure,
) {
	const section = song.sections[sectionIndex];
	const nextSection = {
		...section,
		measures: replaceAt(section.measures, measureIndex, nextMeasure),
	};
	return setSectionAt(song, { sectionIndex }, nextSection);
}

/**
 * Return a new song with `nextEvent` spliced in at
 * `sectionIndex`/`measureIndex`/`hand`/`eventIndex`, every level above the splice
 * rebuilt immutably.
 *
 * CRITICAL: reads ONLY its own four coords (see `setSectionAt`); the face fixes
 * the splice depth, the coordinates do not.
 *
 * @param {Object} song               The current song object.
 * @param {Object} coords             The selection coords (only the four read).
 * @param {number} coords.sectionIndex The section index.
 * @param {number} coords.measureIndex The measure index.
 * @param {string} coords.hand         The hand key (`rightHand`/`leftHand`).
 * @param {number} coords.eventIndex   The event index to replace.
 * @param {Object} nextEvent          The replacement event.
 * @return {Object} A new song with the event replaced.
 */
export function setEventAt(
	song,
	{ sectionIndex, measureIndex, hand, eventIndex },
	nextEvent,
) {
	const measure = song.sections[sectionIndex].measures[measureIndex];
	const nextMeasure = {
		...measure,
		[hand]: replaceAt(measure[hand], eventIndex, nextEvent),
	};
	return setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure);
}

/**
 * Apply `fn` to the events array of `hand` in the given measure, then return a
 * new song reflecting the result. Encodes the empty-hand rule once: when `fn`
 * returns an empty array or `null`, the hand key is deleted from the measure
 * (a measure with no events on a hand must carry no key for that hand, not an
 * empty array). When `fn` returns a non-empty array, the hand key is present
 * with that array.
 *
 * `fn` receives `measure[hand] ?? []`: a grow `fn` called on a hand that did
 * not previously exist gets `[]` and may return a non-empty array to create the
 * key. Callers guard against missing section/measure; this helper does not.
 *
 * @param {Object}   song              The current song object.
 * @param {Object}   coords            The selection coords.
 * @param {number}   coords.sectionIndex The section index.
 * @param {number}   coords.measureIndex The measure index.
 * @param {string}   coords.hand        The hand key (`rightHand`/`leftHand`).
 * @param {Function} fn                 Receives the current events array (or `[]`),
 *                                      returns the next events array or `null`.
 * @return {Object} A new song with the hand events updated or the hand key dropped.
 */
export function updateHandEvents(
	song,
	{ sectionIndex, measureIndex, hand },
	fn,
) {
	const measure = song.sections[sectionIndex].measures[measureIndex];
	const nextEvents = fn(measure[hand] ?? []);
	let nextMeasure;
	if (nextEvents == null || nextEvents.length === 0) {
		const { [hand]: _dropped, ...rest } = measure;
		nextMeasure = rest;
	} else {
		nextMeasure = { ...measure, [hand]: nextEvents };
	}
	return setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure);
}
