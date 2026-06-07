/**
 * The drill-in detail view for a single event — what the inline `EventRow`
 * deliberately leaves out because it does not fit on one row: a note's chord
 * `pitches` and the event's free-text `annotations`.
 *
 * The row edits an event's scalar fields inline; this editor edits its two
 * nested lists. `PitchList` appears only for a `note` (a rest has no pitches),
 * and the event `AnnotationList` (`kind="event"`) appears for either, since an
 * annotation is valid on a rest too. Both lists already enforce their own rules —
 * the note invariant (at least one pitch) and the drop-empty-annotations rule —
 * so this editor only routes their emissions back into the event, dropping the
 * `annotations` key when the list empties. A back affordance (`onBack`) returns
 * to the event list. The parent owns the event state and re-feeds the emitted
 * value; this component holds none.
 */
import { Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { AnnotationList } from "./AnnotationList.js";
import { PitchList } from "./PitchList.js";

/**
 * Edit a single event's nested lists.
 *
 * @param {Object}              props
 * @param {Object}              props.event    The current event object.
 * @param {"english"|"spanish"} props.system   The per-song note-name system.
 * @param {Function}            props.onChange Receives the next event.
 * @param {Function}            props.onBack   Called to return to the event list.
 * @return {Object} The rendered event detail editor.
 */
export function EventEditor({ event, system, onChange, onBack }) {
	return (
		<div>
			<Button
				icon="arrow-left-alt2"
				label={__("Back to events", "piano-block")}
				onClick={onBack}
			>
				{__("Back to events", "piano-block")}
			</Button>
			{event.type === "note" ? (
				<PitchList
					pitches={event.pitches}
					system={system}
					onChange={(pitches) => onChange({ ...event, pitches })}
				/>
			) : null}
			<AnnotationList
				annotations={event.annotations}
				kind="event"
				onChange={(annotations) => {
					if (annotations === undefined) {
						const { annotations: _dropped, ...rest } = event;
						onChange(rest);
						return;
					}
					onChange({ ...event, annotations });
				}}
			/>
		</div>
	);
}
