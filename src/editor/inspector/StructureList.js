/**
 * The always-present sidebar **Structure** browser — the song's sections and their
 * measures, to measure depth (Req 6).
 *
 * Today sections/measures are reachable only by selecting an *event* on the canvas,
 * which leaves an empty measure (or a section with no events) unreachable. This list
 * makes the whole song browsable independent of any event selection, and carries the
 * first-note path: with the canvas add-grid gone, an empty measure has no event to
 * select, so each measure row exposes an "Add note" that seeds a default right-hand
 * note via `onAddNote` — the only way to bootstrap an empty measure.
 *
 * It is a pure controlled component — it holds no song state. Selecting a row signals
 * a kind-tagged `selection` through `onSelect`; the structural buttons signal intent
 * through the lifted `onAddSection`/`onRemoveSection`/`onAddMeasure`/`onRemoveMeasure`
 * handlers (`edit.js` owns the splice and the selection-fallout, shared with the
 * inspector panels). It mirrors `AnnotationList`'s controlled-row + trailing
 * `AddButton` shape and uses only `@wordpress/components` (Req 19).
 *
 * **Notes are not listed** (measure depth only — Req 6) and there are **no move
 * controls** (reordering is out of scope — Req 9).
 */
import { Button, PanelBody } from "@wordpress/components";
import { __, sprintf } from "@wordpress/i18n";
import { AddButton } from "../ListControls.js";

/**
 * The sidebar Structure browser: a row per section (select + remove + a nested
 * measure sub-list) and a trailing "Add section"; each section's sub-list is a row
 * per measure (select + remove) and a trailing "Add measure".
 *
 * The active row reflects the resolved selection through `aria-current`: a section
 * row is current when a `"section"` selection points at it; a measure row is current
 * when a `"measure"` (or deeper `"event"`) selection points at it. Labels carry the
 * 1-based section/measure ordinals so they are stable and assertable.
 *
 * @param {Object}   props
 * @param {Object}   props.song            The current working song object.
 * @param {?Object}  props.selection       The resolved selection, or `null`.
 * @param {Function} props.onSelect        Receives a kind-tagged selection.
 * @param {Function} props.onAddSection    Lifted: append a section.
 * @param {Function} props.onRemoveSection Lifted: remove the section at the index.
 * @param {Function} props.onAddMeasure    Lifted: append a measure to a section.
 * @param {Function} props.onRemoveMeasure Lifted: remove the measure at the coords.
 * @param {Function} props.onAddNote       Lifted: add a first note to a measure's
 *                                         hand — the measure-row "Add note" entry
 *                                         point, defaulting to the right hand. With
 *                                         the canvas add-grid gone, this is the only
 *                                         way to bootstrap an empty measure.
 * @return {Object} The rendered Structure panel.
 */
export function StructureList({
	song,
	selection,
	onSelect,
	onAddSection,
	onRemoveSection,
	onAddMeasure,
	onRemoveMeasure,
	onAddNote,
}) {
	const sections = Array.isArray(song?.sections) ? song.sections : [];

	return (
		<PanelBody title={__("Structure", "piano-block")} initialOpen>
			{sections.map((section, sectionIndex) => {
				const sectionNumber = sectionIndex + 1;
				const measures = Array.isArray(section?.measures)
					? section.measures
					: [];
				// A section row is the current selection only for a `"section"` pick;
				// a measure/event pick highlights its measure row instead.
				const sectionCurrent =
					selection?.kind === "section" &&
					selection.sectionIndex === sectionIndex;
				return (
					// Sections have no stable identity, so the index is the only key
					// available; rows are simple controlled buttons, so this is safe.
					<div key={sectionIndex}>
						<Button
							variant="tertiary"
							aria-current={sectionCurrent ? "true" : undefined}
							onClick={() => onSelect?.({ kind: "section", sectionIndex })}
						>
							{sprintf(
								// translators: %d: section number.
								__("Section %d", "piano-block"),
								sectionNumber,
							)}
						</Button>
						<Button
							icon="trash"
							label={sprintf(
								// translators: %d: section number.
								__("Remove section %d", "piano-block"),
								sectionNumber,
							)}
							isDestructive
							onClick={() => onRemoveSection?.(sectionIndex)}
						/>
						{measures.map((_measure, measureIndex) => {
							const measureNumber = measureIndex + 1;
							// A measure row is current for a measure pick OR for an
							// event pick under it (the event still has its measure
							// coords), so navigating into a note keeps its measure lit.
							const measureCurrent =
								(selection?.kind === "measure" ||
									selection?.kind === "event") &&
								selection.sectionIndex === sectionIndex &&
								selection.measureIndex === measureIndex;
							return (
								// Measures have no stable identity either — index key.
								<div key={measureIndex}>
									<Button
										variant="tertiary"
										aria-current={measureCurrent ? "true" : undefined}
										onClick={() =>
											onSelect?.({
												kind: "measure",
												sectionIndex,
												measureIndex,
											})
										}
									>
										{sprintf(
											// translators: %d: measure number within its section.
											__("Measure %d", "piano-block"),
											measureNumber,
										)}
									</Button>
									<Button
										icon="trash"
										label={sprintf(
											// translators: 1: measure number, 2: section number.
											__("Remove measure %1$d of section %2$d", "piano-block"),
											measureNumber,
											sectionNumber,
										)}
										isDestructive
										onClick={() =>
											onRemoveMeasure?.(sectionIndex, measureIndex)
										}
									/>
									{/* The first-note entry point: seeds a default RIGHT-hand
									    note (KD2 part 5) into this measure. With the canvas
									    add-grid gone, this is the only way to add a note to an
									    empty measure; `onAddNote` tolerates an empty hand. */}
									<AddButton
										label={sprintf(
											// translators: 1: measure number, 2: section number.
											__("Add note to measure %1$d of section %2$d", "piano-block"),
											measureNumber,
											sectionNumber,
										)}
										onClick={() =>
											onAddNote?.(sectionIndex, measureIndex, "rightHand")
										}
									/>
								</div>
							);
						})}
						<AddButton
							label={sprintf(
								// translators: %d: section number the measure is added to.
								__("Add measure to section %d", "piano-block"),
								sectionNumber,
							)}
							onClick={() => onAddMeasure?.(sectionIndex)}
						/>
					</div>
				);
			})}
			<AddButton
				label={__("Add section", "piano-block")}
				onClick={() => onAddSection?.()}
			/>
		</PanelBody>
	);
}
