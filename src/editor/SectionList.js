/**
 * The editable list of a song's sections — each a one-line summary with an
 * "open" affordance to drill into its `SectionEditor`, the shared move/remove
 * controls, and an append button.
 *
 * A section is an opaque container at this level (its overrides and measures are
 * edited only once opened), so a row here is a label plus controls — not an
 * inline editor. The schema permits an empty `sections` array, so this list
 * allows removing every section; the empty state (and seeding a first section) is
 * the SongEditor's concern. Every add/remove/reorder runs through the shared
 * array helpers, so the list never mutates its input. The parent owns the song
 * state and re-feeds the emitted array; this component holds none.
 */
import { __, sprintf } from "@wordpress/i18n";
import { AddButton, ListControls } from "./ListControls.js";
import { insertAt, moveItem, newSection, removeAt } from "./songModel.js";

/**
 * Edit a song's ordered list of sections.
 *
 * @param {Object}   props
 * @param {Object[]} [props.sections=[]] The current sections.
 * @param {Function} props.onChange      Receives the next sections array.
 * @param {Function} props.onOpenSection Called with a section's index to open it.
 * @return {Object} The rendered section list.
 */
export function SectionList({ sections = [], onChange, onOpenSection }) {
	return (
		<div>
			{sections.map((_section, index) => (
				// Sections have no stable identity, so the index is the only key
				// available; rows are summaries, not editors, so this is safe.
				<div key={index}>
					<button type="button" onClick={() => onOpenSection?.(index)}>
						{sprintf(
							/* translators: %d: section number. */
							__("Section %d", "piano-block"),
							index + 1,
						)}
					</button>
					<ListControls
						index={index}
						count={sections.length}
						onMoveUp={() => onChange(moveItem(sections, index, index - 1))}
						onMoveDown={() => onChange(moveItem(sections, index, index + 1))}
						onRemove={() => onChange(removeAt(sections, index))}
						moveUpLabel={__("Move section up", "piano-block")}
						moveDownLabel={__("Move section down", "piano-block")}
						removeLabel={__("Remove section", "piano-block")}
					/>
				</div>
			))}
			<AddButton
				label={__("Add section", "piano-block")}
				onClick={() =>
					onChange(insertAt(sections, sections.length, newSection()))
				}
			/>
		</div>
	);
}
