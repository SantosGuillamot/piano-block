/**
 * The editable list of a section's measures — each a one-line summary with an
 * "open" affordance to drill into its `MeasureEditor`, the shared move/remove
 * controls, and an append button.
 *
 * A measure is an opaque container (its contents are edited only once opened), so
 * a row here is just a label plus controls — not an inline editor. The schema
 * only requires a section to carry a `measures` array, and a permissive empty one
 * is conformant, so this list allows removing every measure (the empty state is
 * the SongEditor's concern). Every add/remove/reorder runs through the shared
 * array helpers, so the list never mutates its input. The parent owns the section
 * state and re-feeds the emitted array; this component holds none.
 */
import { __, sprintf } from "@wordpress/i18n";
import { AddButton, ListControls } from "./ListControls.js";
import { insertAt, moveItem, newMeasure, removeAt } from "./songModel.js";

/**
 * Edit a section's ordered list of measures.
 *
 * @param {Object}   props
 * @param {Object[]} [props.measures=[]]  The current measures.
 * @param {Function} props.onChange       Receives the next measures array.
 * @param {Function} props.onOpenMeasure  Called with a measure's index to open it.
 * @return {Object} The rendered measure list.
 */
export function MeasureList({ measures = [], onChange, onOpenMeasure }) {
	return (
		<div>
			{measures.map((_measure, index) => (
				// Measures have no stable identity, so the index is the only key
				// available; rows are summaries, not editors, so this is safe.
				<div key={index}>
					<button type="button" onClick={() => onOpenMeasure?.(index)}>
						{sprintf(
							/* translators: %d: measure number. */
							__("Measure %d", "piano-block"),
							index + 1,
						)}
					</button>
					<ListControls
						index={index}
						count={measures.length}
						onMoveUp={() => onChange(moveItem(measures, index, index - 1))}
						onMoveDown={() => onChange(moveItem(measures, index, index + 1))}
						onRemove={() => onChange(removeAt(measures, index))}
						moveUpLabel={__("Move measure up", "piano-block")}
						moveDownLabel={__("Move measure down", "piano-block")}
						removeLabel={__("Remove measure", "piano-block")}
					/>
				</div>
			))}
			<AddButton
				label={__("Add measure", "piano-block")}
				onClick={() =>
					onChange(insertAt(measures, measures.length, newMeasure()))
				}
			/>
		</div>
	);
}
