/**
 * The editable list of one hand's events — a labeled column of `EventRow`s with
 * add/remove/reorder.
 *
 * A measure's `rightHand` / `leftHand` is an ordered array of events. Each row is
 * an `EventRow` (its own inline controls plus per-row `ListControls`), and two
 * `AddButton`s append a fresh note or rest so the author can add either without a
 * second step — each seeded conformant by construction (a note carries its one
 * required pitch in the per-song system). The schema permits a hand array to be
 * absent but, being permissive, also accepts an empty one — yet an empty
 * `rightHand: []` is noise the round-trip should not persist. So this list never
 * emits an empty array: when the author removes the last row it signals removal
 * by emitting `undefined`, and the parent drops the hand key entirely. Every
 * add/remove/reorder runs through the shared array helpers, so the list never
 * mutates its input.
 *
 * Drilling into a row (its chord pitches and event annotations) is the parent's
 * concern: each row's `onDrillIn` is forwarded up with the row's index so the
 * parent can open the right `EventEditor`.
 */
import { __ } from "@wordpress/i18n";
import { EventRow } from "./EventRow.js";
import { AddButton } from "./ListControls.js";
import { noteNameOptions } from "./noteNames.js";
import {
	insertAt,
	moveItem,
	newNote,
	newPitch,
	newRest,
	removeAt,
	replaceAt,
} from "./songModel.js";

/**
 * Edit one hand's ordered list of events.
 *
 * @param {Object}              props
 * @param {Object[]}            [props.events=[]] The current events.
 * @param {"english"|"spanish"} props.system      The per-song note-name system.
 * @param {Function}            props.onChange    Receives the next events array,
 *                                                or `undefined` when emptied.
 * @param {string}              props.label       The hand's name (e.g. "Right
 *                                                hand").
 * @param {Function}            [props.onDrillIn] Called with a row's index to
 *                                                open its detail editor.
 * @return {Object} The rendered event list.
 */
export function EventList({ events = [], system, onChange, label, onDrillIn }) {
	// Emit the next list, collapsing an empty list to `undefined` so the parent
	// drops the hand key rather than serializing an empty events array.
	const emit = (next) => onChange(next.length > 0 ? next : undefined);

	return (
		<div>
			<p>{label}</p>
			{events.map((event, index) => (
				// Events have no stable identity, so the index is the only key
				// available; rows are simple controlled editors, so this is safe.
				<EventRow
					key={index}
					event={event}
					system={system}
					index={index}
					count={events.length}
					onChange={(next) => emit(replaceAt(events, index, next))}
					onMoveUp={() => emit(moveItem(events, index, index - 1))}
					onMoveDown={() => emit(moveItem(events, index, index + 1))}
					onRemove={() => emit(removeAt(events, index))}
					onDrillIn={() => onDrillIn?.(index)}
				/>
			))}
			<AddButton
				label={__("Add note", "piano-block")}
				onClick={() => emit(insertAt(events, events.length, newNoteIn(system)))}
			/>
			<AddButton
				label={__("Add rest", "piano-block")}
				onClick={() => emit(insertAt(events, events.length, newRest()))}
			/>
		</div>
	);
}

/**
 * A new note seeded with one pitch in the per-song system. `newNote` seeds the
 * English default `C`, so respell its sole pitch in the song's first name.
 *
 * @param {"english"|"spanish"} system The per-song note-name system.
 * @return {Object} A conformant note event in the song's spelling.
 */
function newNoteIn(system) {
	return {
		...newNote(),
		pitches: [newPitch(noteNameOptions(system)[0].value)],
	};
}
