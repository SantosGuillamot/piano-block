/**
 * The editable list of a note's pitches — add, remove and reorder, with the note
 * invariant enforced.
 *
 * A note's `pitches` is an ordered array; a chord is just more than one entry.
 * Each row is a `PitchEditor` with the per-row `ListControls` (move/remove) and a
 * single `AddButton` that appends a fresh pitch in the per-song system (its first
 * note name, octave 4). The one rule beyond ordering is the note invariant — a
 * note must carry at least one pitch — so the last remaining pitch's remove is
 * disabled (`canRemove` is false once the list is down to one). Every
 * add/remove/reorder/edit runs through the shared array helpers, so the list
 * never mutates its input, and an untouched pitch is passed straight through to
 * its editor, preserving its spelling verbatim.
 */
import { __ } from "@wordpress/i18n";
import { AddButton, ListControls } from "./ListControls.js";
import { noteNameOptions } from "./noteNames.js";
import { PitchEditor } from "./PitchEditor.js";
import {
	insertAt,
	moveItem,
	newPitch,
	removeAt,
	replaceAt,
} from "./songModel.js";

/**
 * Edit a note's ordered list of pitches.
 *
 * @param {Object}              props
 * @param {Object[]}            [props.pitches=[]] The current pitches.
 * @param {"english"|"spanish"} props.system       The per-song note-name system.
 * @param {Function}            props.onChange     Receives the next pitches array.
 * @return {Object} The rendered pitch list.
 */
export function PitchList({ pitches = [], system, onChange }) {
	// A new pitch is seeded with the system's first note name (octave 4), so it
	// stays in the per-song spelling by construction.
	const firstName = noteNameOptions(system)[0].value;

	return (
		<>
			{pitches.map((pitch, index) => (
				// Pitches have no stable identity, so the index is the only key
				// available; rows are simple controlled editors, so this is safe.
				<div key={index}>
					<PitchEditor
						pitch={pitch}
						system={system}
						onChange={(next) => onChange(replaceAt(pitches, index, next))}
					/>
					<ListControls
						index={index}
						count={pitches.length}
						onMoveUp={() => onChange(moveItem(pitches, index, index - 1))}
						onMoveDown={() => onChange(moveItem(pitches, index, index + 1))}
						onRemove={() => onChange(removeAt(pitches, index))}
						// The note invariant: never let the last pitch be removed.
						canRemove={pitches.length > 1}
						moveUpLabel={__("Move pitch up", "piano-block")}
						moveDownLabel={__("Move pitch down", "piano-block")}
						removeLabel={__("Remove pitch", "piano-block")}
					/>
				</div>
			))}
			<AddButton
				label={__("Add pitch", "piano-block")}
				onClick={() =>
					onChange(insertAt(pitches, pitches.length, newPitch(firstName)))
				}
			/>
		</>
	);
}
