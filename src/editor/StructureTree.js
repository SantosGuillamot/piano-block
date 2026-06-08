/**
 * The left **structure tree** — the editor's selection surface, rendered to the
 * left of the canvas inside the block's own editor area (not Gutenberg's global
 * List View). It navigates the song hierarchically — Section → Measure → {Right
 * hand, Left hand} → Note — much like the List View navigates blocks, and is the
 * way the author selects what to highlight on the canvas and edit in the right
 * inspector.
 *
 * It is built on `@wordpress/components`' `__experimentalTreeGrid` — the same
 * accessible primitive the List View is built on — so it gets the treegrid
 * keyboard model (roving tabindex, Up/Down between rows, Left/Right to
 * collapse/expand) for free, with the honest `role="treegrid"` rather than a
 * hand-rolled `role="tree"` (Design KD 3). `working.sections` is flattened into an
 * ordered list of *visible* rows (respecting expansion), each carrying its
 * `level`/`positionInSet`/`setSize` ARIA wiring and keyed by an **index-path**
 * string (`s0`, `s0/m1`, `s0/m1/rightHand`, `s0/m1/rightHand/e2`). Each row's label
 * `Button` also carries an inline `--pb-tree-depth` CSS var (`level - 1`, so
 * section=0…note=3) that `style.scss` turns into a depth `padding-left`, giving the
 * tree its visual indentation without relying on the runtime `aria-level` attribute
 * (Design KD 2); the action-button cell is left flush so only the label indents.
 *
 * It is a pure controlled component holding no song state: selecting a
 * section/measure/note row signals a kind-tagged `selection` through `onSelect`
 * (the same tuples the removed canvas/StructureList surfaces emitted, so
 * `resolveSelection` + the canvas `decorateSelection` highlight + the kind-gated
 * inspector panels all light up unchanged), and the per-row add/remove/duplicate
 * buttons signal intent through the lifted `edit.js` handlers (the single owner of
 * `working` + `commit`). **Hand-group rows are organizational, not selectable** —
 * the selection model has no "hand" kind — so they are disclosure-only labels that
 * host the per-hand "Add note" and toggle expansion (KD 14).
 *
 * Expansion is derived, not just stored: a row is expanded when it is in the
 * manual `expandedPaths` Set OR it is an ancestor of the resolved selection, so
 * the selected branch is always revealed regardless of the Set's index-path
 * staleness (Design "Expansion state"). Node labels are `name`-or-positional for
 * sections/measures and `noteLabel(event, system)` for notes. Only
 * `@wordpress/*` is used (AC13).
 */
import {
	Button,
	__experimentalTreeGrid as TreeGrid,
	__experimentalTreeGridCell as TreeGridCell,
	__experimentalTreeGridItem as TreeGridItem,
	__experimentalTreeGridRow as TreeGridRow,
} from "@wordpress/components";
import { __, sprintf } from "@wordpress/i18n";
import { noteLabel } from "./noteNames.js";

/** The two hands, in render order, with their display labels' translator keys. */
const HANDS = ["rightHand", "leftHand"];

/**
 * The disclosure caret for an expandable row: `▾` when expanded, `▸` when
 * collapsed. A plain text glyph keeps the tree `@wordpress/*`-only and renders in
 * jsdom; the real keyboard model (Left/Right to collapse/expand) comes from
 * TreeGrid.
 *
 * @param {boolean} isExpanded Whether the row is currently expanded.
 * @return {string} The caret glyph.
 */
function caret(isExpanded) {
	return isExpanded ? "▾" : "▸";
}

/**
 * Whether a path is an ancestor of the resolved selection — used to auto-expand
 * the selected branch so it is always revealed (Design "Expansion state"). The
 * selection's ancestor paths are its section path, its measure path (for a
 * measure/event selection), and its hand path (for an event selection).
 *
 * @param {string}  path      The candidate ancestor index-path string.
 * @param {?Object} selection The resolved selection, or `null`.
 * @return {boolean} `true` when `path` is an ancestor of the selection.
 */
function isSelectionAncestor(path, selection) {
	if (!selection) {
		return false;
	}
	const ancestors = [`s${selection.sectionIndex}`];
	if (selection.measureIndex !== undefined) {
		ancestors.push(`s${selection.sectionIndex}/m${selection.measureIndex}`);
	}
	if (selection.hand !== undefined) {
		ancestors.push(
			`s${selection.sectionIndex}/m${selection.measureIndex}/${selection.hand}`,
		);
	}
	return ancestors.includes(path);
}

/**
 * The left structure tree.
 *
 * @param {Object}   props
 * @param {Object}   props.song              The current working song object.
 * @param {?Object}  props.selection         The resolved selection, or `null`.
 * @param {string}   props.system            The song's note-name system, for note labels.
 * @param {Set}      props.expandedPaths     The manually-expanded index-path strings.
 * @param {Function} props.onToggleExpanded  Toggle a path's manual expansion.
 * @param {Function} props.onSelect          Receives a kind-tagged selection.
 * @param {Function} props.onAddSection      Lifted: append a section.
 * @param {Function} props.onRemoveSection   Lifted: remove the section at the index.
 * @param {Function} props.onDuplicateSection Lifted: duplicate the section after itself.
 * @param {Function} props.onAddMeasure      Lifted: append a measure to a section.
 * @param {Function} props.onRemoveMeasure   Lifted: remove the measure at the coords.
 * @param {Function} props.onDuplicateMeasure Lifted: duplicate the measure after itself.
 * @param {Function} props.onAddNote         Lifted: add a note to a measure's hand.
 * @param {Function} props.onRemoveNote      Lifted: remove the note at the coords.
 * @param {Function} props.onDuplicateNote   Lifted: duplicate the note after itself.
 * @return {Object} The rendered structure tree.
 */
export function StructureTree({
	song,
	selection,
	system,
	expandedPaths,
	onToggleExpanded,
	onSelect,
	onAddSection,
	onRemoveSection,
	onDuplicateSection,
	onAddMeasure,
	onRemoveMeasure,
	onDuplicateMeasure,
	onAddNote,
	onRemoveNote,
	onDuplicateNote,
}) {
	const sections = Array.isArray(song?.sections) ? song.sections : [];

	// A path is expanded when manually toggled OR when it is an ancestor of the
	// selection (auto-expand the selected branch, so it is revealed regardless of
	// the manual Set's index-path staleness).
	const isExpanded = (path) =>
		(expandedPaths?.has(path) ?? false) ||
		isSelectionAncestor(path, selection);

	const rows = [];

	sections.forEach((section, sectionIndex) => {
		const sectionNumber = sectionIndex + 1;
		const sectionPath = `s${sectionIndex}`;
		const sectionExpanded = isExpanded(sectionPath);
		const measures = Array.isArray(section?.measures) ? section.measures : [];
		const sectionLabel =
			section?.name ||
			sprintf(
				// translators: %d: section number.
				__("Section %d", "piano-block"),
				sectionNumber,
			);
		const sectionSelected =
			selection?.kind === "section" &&
			selection.sectionIndex === sectionIndex;

		rows.push(
			<TreeGridRow
				key={sectionPath}
				data-path={sectionPath}
				level={1}
				positionInSet={sectionNumber}
				setSize={sections.length}
				isExpanded={sectionExpanded}
			>
				<TreeGridCell>
					{(cellProps) => (
						<Button
							{...cellProps}
							className="wp-block-piano-block-piano__tree-label"
							style={{ "--pb-tree-depth": 0 }}
							variant="tertiary"
							aria-expanded={sectionExpanded}
							aria-current={sectionSelected ? "true" : undefined}
							onClick={() => {
								onToggleExpanded?.(sectionPath);
								onSelect?.({ kind: "section", sectionIndex });
							}}
						>
							{`${caret(sectionExpanded)} ${sectionLabel}`}
						</Button>
					)}
				</TreeGridCell>
				<TreeGridCell>
					{() => (
						<>
							<TreeGridItem>
								{() => (
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
								)}
							</TreeGridItem>
							<TreeGridItem>
								{() => (
									<Button
										icon="admin-page"
										label={sprintf(
											// translators: %d: section number.
											__("Duplicate section %d", "piano-block"),
											sectionNumber,
										)}
										onClick={() => onDuplicateSection?.(sectionIndex)}
									/>
								)}
							</TreeGridItem>
							<TreeGridItem>
								{() => (
									<Button
										icon="plus"
										label={sprintf(
											// translators: %d: section number the measure is added to.
											__("Add measure to section %d", "piano-block"),
											sectionNumber,
										)}
										onClick={() => onAddMeasure?.(sectionIndex)}
									/>
								)}
							</TreeGridItem>
						</>
					)}
				</TreeGridCell>
			</TreeGridRow>,
		);

		if (!sectionExpanded) {
			return;
		}

		measures.forEach((measure, measureIndex) => {
			const measureNumber = measureIndex + 1;
			const measurePath = `s${sectionIndex}/m${measureIndex}`;
			const measureExpanded = isExpanded(measurePath);
			const measureLabel =
				measure?.name ||
				sprintf(
					// translators: %d: measure number within its section.
					__("Measure %d", "piano-block"),
					measureNumber,
				);
			const measureSelected =
				(selection?.kind === "measure" || selection?.kind === "event") &&
				selection.sectionIndex === sectionIndex &&
				selection.measureIndex === measureIndex;

			rows.push(
				<TreeGridRow
					key={measurePath}
					data-path={measurePath}
					level={2}
					positionInSet={measureNumber}
					setSize={measures.length}
					isExpanded={measureExpanded}
				>
					<TreeGridCell>
						{(cellProps) => (
							<Button
								{...cellProps}
								className="wp-block-piano-block-piano__tree-label"
								style={{ "--pb-tree-depth": 1 }}
								variant="tertiary"
								aria-expanded={measureExpanded}
								aria-current={measureSelected ? "true" : undefined}
								onClick={() => {
									onToggleExpanded?.(measurePath);
									onSelect?.({
										kind: "measure",
										sectionIndex,
										measureIndex,
									});
								}}
							>
								{`${caret(measureExpanded)} ${measureLabel}`}
							</Button>
						)}
					</TreeGridCell>
					<TreeGridCell>
						{() => (
							<>
								<TreeGridItem>
									{() => (
										<Button
											icon="trash"
											label={sprintf(
												// translators: 1: measure number, 2: section number.
												__(
													"Remove measure %1$d of section %2$d",
													"piano-block",
												),
												measureNumber,
												sectionNumber,
											)}
											isDestructive
											onClick={() =>
												onRemoveMeasure?.(sectionIndex, measureIndex)
											}
										/>
									)}
								</TreeGridItem>
								<TreeGridItem>
									{() => (
										<Button
											icon="admin-page"
											label={sprintf(
												// translators: 1: measure number, 2: section number.
												__(
													"Duplicate measure %1$d of section %2$d",
													"piano-block",
												),
												measureNumber,
												sectionNumber,
											)}
											onClick={() =>
												onDuplicateMeasure?.(sectionIndex, measureIndex)
											}
										/>
									)}
								</TreeGridItem>
							</>
						)}
					</TreeGridCell>
				</TreeGridRow>,
			);

			if (!measureExpanded) {
				return;
			}

			HANDS.forEach((hand, handPosition) => {
				const handPath = `s${sectionIndex}/m${measureIndex}/${hand}`;
				const handExpanded = isExpanded(handPath);
				const events = Array.isArray(measure?.[hand]) ? measure[hand] : [];
				// Hand-group labels carry the section/measure ordinals so an exact-name
				// lookup never collides across measures.
				const handLabel =
					hand === "rightHand"
						? __("Right hand", "piano-block")
						: __("Left hand", "piano-block");
				const addNoteLabel = sprintf(
					// translators: 1: hand name, 2: measure number, 3: section number.
					__(
						"Add note to %1$s of measure %2$d of section %3$d",
						"piano-block",
					),
					handLabel,
					measureNumber,
					sectionNumber,
				);

				// Hand-group rows are organizational/non-selecting (KD 14): they toggle
				// expansion and host the per-hand "Add note", but never call onSelect.
				rows.push(
					<TreeGridRow
						key={handPath}
						data-path={handPath}
						level={3}
						positionInSet={handPosition + 1}
						setSize={HANDS.length}
						isExpanded={handExpanded}
					>
						<TreeGridCell>
							{(cellProps) => (
								<Button
									{...cellProps}
									className="wp-block-piano-block-piano__tree-label"
									style={{ "--pb-tree-depth": 2 }}
									variant="tertiary"
									aria-expanded={handExpanded}
									onClick={() => onToggleExpanded?.(handPath)}
								>
									{`${caret(handExpanded)} ${handLabel}`}
								</Button>
							)}
						</TreeGridCell>
						<TreeGridCell>
							{() => (
								<TreeGridItem>
									{() => (
										<Button
											icon="plus"
											label={addNoteLabel}
											onClick={() =>
												onAddNote?.(sectionIndex, measureIndex, hand)
											}
										/>
									)}
								</TreeGridItem>
							)}
						</TreeGridCell>
					</TreeGridRow>,
				);

				if (!handExpanded) {
					return;
				}

				events.forEach((event, eventIndex) => {
					const eventNumber = eventIndex + 1;
					const eventPath = `${handPath}/e${eventIndex}`;
					const eventSelected =
						selection?.kind === "event" &&
						selection.sectionIndex === sectionIndex &&
						selection.measureIndex === measureIndex &&
						selection.hand === hand &&
						selection.eventIndex === eventIndex;

					rows.push(
						<TreeGridRow
							key={eventPath}
							data-path={eventPath}
							level={4}
							positionInSet={eventNumber}
							setSize={events.length}
						>
							<TreeGridCell>
								{(cellProps) => (
									<Button
										{...cellProps}
										className="wp-block-piano-block-piano__tree-label"
										style={{ "--pb-tree-depth": 3 }}
										variant="tertiary"
										aria-current={eventSelected ? "true" : undefined}
										onClick={() =>
											onSelect?.({
												kind: "event",
												sectionIndex,
												measureIndex,
												hand,
												eventIndex,
											})
										}
									>
										{noteLabel(event, system)}
									</Button>
								)}
							</TreeGridCell>
							<TreeGridCell>
								{() => (
									<>
										<TreeGridItem>
											{() => (
												<Button
													icon="trash"
													label={sprintf(
														// translators: 1: note number, 2: hand name, 3: measure number, 4: section number.
														__(
															"Remove note %1$d of %2$s of measure %3$d of section %4$d",
															"piano-block",
														),
														eventNumber,
														handLabel,
														measureNumber,
														sectionNumber,
													)}
													isDestructive
													onClick={() =>
														onRemoveNote?.(
															sectionIndex,
															measureIndex,
															hand,
															eventIndex,
														)
													}
												/>
											)}
										</TreeGridItem>
										<TreeGridItem>
											{() => (
												<Button
													icon="admin-page"
													label={sprintf(
														// translators: 1: note number, 2: hand name, 3: measure number, 4: section number.
														__(
															"Duplicate note %1$d of %2$s of measure %3$d of section %4$d",
															"piano-block",
														),
														eventNumber,
														handLabel,
														measureNumber,
														sectionNumber,
													)}
													onClick={() =>
														onDuplicateNote?.(
															sectionIndex,
															measureIndex,
															hand,
															eventIndex,
														)
													}
												/>
											)}
										</TreeGridItem>
									</>
								)}
							</TreeGridCell>
						</TreeGridRow>,
					);
				});
			});
		});
	});

	return (
		<div className="wp-block-piano-block-piano__tree">
			<TreeGrid label={__("Song structure", "piano-block")}>{rows}</TreeGrid>
			<Button
				variant="secondary"
				icon="plus"
				onClick={() => onAddSection?.()}
			>
				{__("Add section", "piano-block")}
			</Button>
		</div>
	);
}
