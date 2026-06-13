/**
 * The editable list of annotations of one kind, hosted by an event or a measure.
 *
 * Both an event's `annotations` and a measure's `annotations` are ordered arrays
 * of free-text annotations, so they share this one list: each row is an
 * `AnnotationEditor`, with a per-row remove button and a single `AddButton` that
 * appends the right new item for the list's `kind`.
 *
 * The schema permits the `annotations` array to be absent but, being permissive,
 * also accepts an empty one — yet an empty `annotations: []` is noise the
 * round-trip should not persist. So this list never emits an empty array: when
 * the author removes the last row it signals removal by emitting `undefined`, and
 * the parent drops the `annotations` key entirely. Every add/remove runs through
 * the shared array helpers, so the list never mutates its input.
 */
import { Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { trash } from "@wordpress/icons";
import { AnnotationEditor } from "./AnnotationEditor.js";
import { AddButton } from "./ListControls.js";
import {
	insertAt,
	newEventAnnotation,
	newStandaloneAnnotation,
	removeAt,
	replaceAt,
} from "./songModel.js";

/** The new-item factory for each annotation kind. */
const FACTORIES = {
	event: newEventAnnotation,
	standalone: newStandaloneAnnotation,
};

/**
 * Edit an ordered list of annotations of one `kind`.
 *
 * @param {Object}   props
 * @param {Object[]} [props.annotations=[]] The current annotations.
 * @param {string}   props.kind             `"event"` or `"standalone"`.
 * @param {Function} props.onChange         Receives the next annotations array,
 *                                          or `undefined` when the list empties.
 * @return {Object} The rendered annotation list.
 */
export function AnnotationList({ annotations = [], kind, onChange }) {
	// Emit the next list, collapsing an empty list to `undefined` so the parent
	// drops the key rather than serializing an empty `annotations` array.
	const emit = (next) => onChange(next.length > 0 ? next : undefined);

	return (
		<>
			{annotations.map((annotation, index) => (
				// Annotations have no stable identity, so the index is the only key
				// available; rows are simple controlled editors, so this is safe.
				<div key={index}>
					<AnnotationEditor
						annotation={annotation}
						kind={kind}
						onChange={(next) => emit(replaceAt(annotations, index, next))}
					/>
					<Button
						icon={trash}
						isDestructive
						label={__("Remove annotation", "piano-block")}
						onClick={() => emit(removeAt(annotations, index))}
					/>
				</div>
			))}
			<AddButton
				label={__("Add annotation", "piano-block")}
				onClick={() =>
					emit(insertAt(annotations, annotations.length, FACTORIES[kind]()))
				}
			/>
		</>
	);
}
