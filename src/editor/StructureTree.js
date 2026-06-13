/**
 * The left **structure tree** — the editor's selection surface, rendered to the
 * left of the canvas inside the block's own editor area (not Gutenberg's global
 * List View). It navigates the song hierarchically — Section → Measure → {Right
 * hand, Left hand} → Note — much like the List View navigates blocks, and is the
 * way the author selects what to highlight on the canvas and edit in the right
 * inspector.
 *
 * It is built on `@wordpress/components`' `__experimentalTreeGrid` — the same
 * accessible primitive the List View is built on — with the honest
 * `role="treegrid"` rather than a hand-rolled `role="tree"`. Each row mirrors
 * core's List View row: two `TreeGridCell`s, each forwarding the cell's
 * `{ ref, tabIndex, onFocus }` to exactly one roving-tabindex focusable — a
 * select-only label `Button` (with a non-focusable stock chevron beside it) and
 * a single `DropdownMenu` of the row's kind-gated actions. `working.sections` is
 * flattened into an ordered list of *visible* rows (respecting expansion), each
 * carrying its `level`/`positionInSet`/`setSize` ARIA wiring. Indentation
 * derives from the rendered `aria-level` (emitted by `TreeGridRow`'s `level`),
 * styled in `editor.scss` — no inline depth variable.
 *
 * All state (song, selection, expansion) is controlled from the outside. Selecting
 * a section/measure/note row signals a kind-tagged `selection` through `onSelect`
 * (the same tuples the canvas/inspector resolve against, so `resolveSelection` +
 * the canvas `decorateSelection` highlight + the kind-gated inspector panels all
 * light up unchanged), and the per-row `DropdownMenu` items signal add / remove /
 * duplicate intent through the lifted `edit.js` handlers (the single owner of
 * `working` + `commit`). Every Remove item — section, measure, or note — fires
 * immediately through its lifted handler with no confirm dialog. Removals are
 * recoverable through WordPress's native undo, so there is no confirm dialog.
 * **Hand-group rows are organizational, not selectable** —
 * the selection model has no "hand" kind — so they are disclosure-only labels
 * that toggle expansion and host a single direct per-hand "Add note" `Button`.
 *
 * Expansion is a single membership lookup against one `expanded` Set of
 * coordinate-derived keys: `isExpanded(key) = expanded.has(key)` — no ancestor
 * test, no veto Set, no auto-reveal. The chevron's pointer `onClick` (and the
 * hand-group label's click) route to `onToggleExpanded(key)`; keyboard
 * expand/collapse routes through the `onExpandRow`/`onCollapseRow` callbacks
 * passed to `<TreeGrid>` — a shared handler reads each expandable row's
 * `data-expansion-key` and calls `onToggleExpanded(key)`.
 * Node labels are `name`-or-positional for sections/measures and
 * `noteLabel(event, system)` for notes. Only `@wordpress/*` is used.
 */
import {
	Button,
	DropdownMenu,
	Icon,
	MenuGroup,
	MenuItem,
	__experimentalTreeGrid as TreeGrid,
	__experimentalTreeGridCell as TreeGridCell,
	__experimentalTreeGridRow as TreeGridRow,
} from "@wordpress/components";
import { __, isRTL, sprintf } from "@wordpress/i18n";
import {
	chevronDownSmall,
	chevronLeftSmall,
	chevronRightSmall,
	moreVertical,
	plus,
} from "@wordpress/icons";
import { noteLabel } from "./noteNames.js";
import { eventKey, expansionKey, expansionKeyOf } from "./selection.js";
import { HANDS } from "./songModel.js";

/**
 * The non-focusable stock disclosure chevron shown beside an expandable row's
 * label, mirroring core's `ListViewExpander`: a `<span aria-hidden="true">`
 * wrapping a stock `<Icon>` (right/left when collapsed per text direction, down
 * when expanded). It carries a **pointer** `onClick` that toggles expansion but
 * has **no `tabIndex` and no role** — it is a visual cue for sighted/pointer
 * users, not a tab stop. Keyboard expand/collapse routes through the
 * `onExpandRow`/`onCollapseRow` callbacks on the parent `<TreeGrid>`. A stable
 * class gives jest and the
 * e2e drill-down a deterministic, non-positional locator.
 *
 * @param {Object}   props
 * @param {boolean}  props.isExpanded Whether the row is currently expanded.
 * @param {Function} props.onToggle   Pointer-only expansion toggle.
 * @return {Object} The rendered chevron span.
 */
function TreeExpander({ isExpanded, onToggle }) {
	return (
		// A non-focusable, aria-hidden visual cue (mirroring core's ListViewExpander):
		// it has a pointer onClick but no role/tabIndex/key handler on purpose — the
		// keyboard expand/collapse path is TreeGrid's Left/Right arrows over the row,
		// so this span is invisible to keyboard and screen readers by design.
		<span
			aria-hidden="true"
			className="wp-block-piano-block-piano__tree-expander"
			onClick={onToggle}
		>
			<Icon
				icon={
					isExpanded
						? chevronDownSmall
						: isRTL()
							? chevronLeftSmall
							: chevronRightSmall
				}
			/>
		</span>
	);
}

/**
 * The shared label cell for section and measure rows — a non-focusable
 * `TreeExpander` beside a label `Button` that always toggles expansion
 * symmetrically. The `Button` carries `aria-current` when its row is selected,
 * and signals `onSelect` on every click; it also calls `onToggleExpanded` on
 * every click regardless of the current expansion state — collapsing an expanded
 * row and expanding a collapsed one (symmetric toggle). The `TreeGridCell` stays
 * at the call site so the roving-tabindex `cellProps` reach exactly this Button.
 *
 * @param {Object}   props
 * @param {string}   props.expansionKey    The coordinate key for the row.
 * @param {boolean}  props.isExpanded      Whether the row is currently expanded.
 * @param {boolean}  props.selected        Whether this row is currently selected.
 * @param {string}   props.label           The visible row label.
 * @param {Function} props.onToggleExpanded Toggle expansion of this row's key.
 * @param {Function} props.onSelect         Signal a selection for this row.
 * @param {Object}   props.cellProps        The roving-tabindex props from `TreeGridCell`.
 * @return {Object} The rendered label cell contents.
 */
function RowLabelCell({
	expansionKey: rowKey,
	isExpanded,
	selected,
	label,
	onToggleExpanded,
	onSelect,
	cellProps,
}) {
	return (
		<>
			<TreeExpander
				isExpanded={isExpanded}
				onToggle={() => onToggleExpanded?.(rowKey)}
			/>
			<Button
				{...cellProps}
				className="wp-block-piano-block-piano__tree-label"
				variant="tertiary"
				aria-current={selected ? "true" : undefined}
				onClick={() => {
					onSelect?.();
					onToggleExpanded?.(rowKey);
				}}
			>
				{label}
			</Button>
		</>
	);
}

/**
 * The shared actions `DropdownMenu` cell for section, measure, and note rows.
 * Receives the roving-tabindex props as `toggleProps` (forwarded from the
 * `TreeGridCell` render prop, mirroring core's List View pattern), and
 * four action callbacks bound to the row's coordinates by the caller.
 * Render-function children are used (required by the `DropdownMenu` mock and
 * the real component) so the always-open mock canary stays green.
 *
 * The optional `onRename` prop gates a "Rename" `MenuItem` that selects the row
 * (so its inspector panel opens and the row's name field is editable). Pass
 * `onRename` only at call sites where the row has a name field (sections and
 * measures); omit it at note rows, which have no name field.
 *
 * @param {Object}    props
 * @param {Object}    props.toggleProps  The roving-tabindex props for the toggle button.
 * @param {string}    props.label        The accessible name for the toggle button.
 * @param {Function}  props.onDuplicate  Duplicate this row's item.
 * @param {Function}  props.onAddBefore  Insert a new item before this one.
 * @param {Function}  props.onAddAfter   Insert a new item after this one.
 * @param {Function}  props.onRemove     Remove this row's item.
 * @param {Function}  [props.onRename]   Optional: select the row to reveal its name
 *                                       field. Absent on note rows (no name field).
 * @return {Object} The rendered actions dropdown.
 */
function RowActionsMenu({
	toggleProps,
	label,
	onDuplicate,
	onAddBefore,
	onAddAfter,
	onRemove,
	onRename,
}) {
	return (
		<DropdownMenu icon={moreVertical} toggleProps={toggleProps} label={label}>
			{({ onClose }) => (
				<>
					<MenuGroup>
						{onRename && (
							<MenuItem
								onClick={() => {
									onRename?.();
									onClose();
								}}
							>
								{__("Rename", "piano-block")}
							</MenuItem>
						)}
						<MenuItem
							onClick={() => {
								onDuplicate?.();
								onClose();
							}}
						>
							{__("Duplicate", "piano-block")}
						</MenuItem>
						<MenuItem
							onClick={() => {
								onAddBefore?.();
								onClose();
							}}
						>
							{__("Add before", "piano-block")}
						</MenuItem>
						<MenuItem
							onClick={() => {
								onAddAfter?.();
								onClose();
							}}
						>
							{__("Add after", "piano-block")}
						</MenuItem>
					</MenuGroup>
					<MenuGroup>
						<MenuItem
							isDestructive
							onClick={() => {
								onRemove?.();
								onClose();
							}}
						>
							{__("Remove", "piano-block")}
						</MenuItem>
					</MenuGroup>
				</>
			)}
		</DropdownMenu>
	);
}

/**
 * The left structure tree.
 *
 * @param {Object}   props
 * @param {Object}   props.song               The current working song object.
 * @param {?Object}  props.selection          The resolved selection, or `null`.
 * @param {string}   props.system             The song's note-name system, for note labels.
 * @param {Set}      props.expanded           The single Set of expanded coordinate keys.
 * @param {Function} props.onToggleExpanded   Toggle a key's membership in `expanded`.
 * @param {Function} props.onSelect           Receives a kind-tagged selection.
 * @param {Function} props.onRemoveSection     Lifted: remove the section at the index.
 * @param {Function} props.onDuplicateSection  Lifted: duplicate the section after itself.
 * @param {Function} props.onAddSectionBefore  Lifted: insert a section before this one.
 * @param {Function} props.onAddSectionAfter   Lifted: insert a section after this one.
 * @param {Function} props.onRemoveMeasure     Lifted: remove the measure at the coords.
 * @param {Function} props.onDuplicateMeasure  Lifted: duplicate the measure after itself.
 * @param {Function} props.onAddMeasureBefore  Lifted: insert a measure before this one.
 * @param {Function} props.onAddMeasureAfter   Lifted: insert a measure after this one.
 * @param {Function} props.onAddNote           Lifted: add a note to a measure's hand.
 * @param {Function} props.onRemoveNote        Lifted: remove the note at the coords.
 * @param {Function} props.onDuplicateNote     Lifted: duplicate the note after itself.
 * @param {Function} props.onAddNoteBefore     Lifted: insert a note before this one.
 * @param {Function} props.onAddNoteAfter      Lifted: insert a note after this one.
 * @return {Object} The rendered structure tree.
 */
export function StructureTree({
	song,
	selection,
	system,
	expanded,
	onToggleExpanded,
	onSelect,
	onRemoveSection,
	onDuplicateSection,
	onAddSectionBefore,
	onAddSectionAfter,
	onRemoveMeasure,
	onDuplicateMeasure,
	onAddMeasureBefore,
	onAddMeasureAfter,
	onAddNote,
	onRemoveNote,
	onDuplicateNote,
	onAddNoteBefore,
	onAddNoteAfter,
}) {
	// Shared handler for both onExpandRow and onCollapseRow: reads the focused row's
	// data-expansion-key and routes to the single onToggleExpanded callback.
	const onExpandCollapseRow = (row) => {
		const key = expansionKeyOf(row);
		if (key) onToggleExpanded?.(key);
	};

	const sections = Array.isArray(song?.sections) ? song.sections : [];

	// Expansion is a single membership lookup against the one `expanded` Set: no
	// ancestor test, no veto, no auto-reveal. A row whose key is absent stays
	// collapsed, hiding its descendants (the flatten below skips them).
	const isExpanded = (key) => expanded?.has(key) ?? false;

	const rows = [];

	sections.forEach((section, sectionIndex) => {
		const sectionNumber = sectionIndex + 1;
		const sectionKey = expansionKey({ sectionIndex });
		const sectionExpanded = isExpanded(sectionKey);
		const measures = Array.isArray(section?.measures) ? section.measures : [];
		const sectionLabel =
			section?.name ||
			sprintf(
				// translators: %d: section number.
				__("Section %d", "piano-block"),
				sectionNumber,
			);
		const sectionSelected =
			selection?.kind === "section" && selection.sectionIndex === sectionIndex;

		rows.push(
			<TreeGridRow
				key={sectionKey}
				level={1}
				positionInSet={sectionNumber}
				setSize={sections.length}
				isExpanded={sectionExpanded}
				data-expansion-key={sectionKey}
			>
				<TreeGridCell>
					{(cellProps) => (
						<RowLabelCell
							expansionKey={sectionKey}
							isExpanded={sectionExpanded}
							selected={sectionSelected}
							label={sectionLabel}
							onToggleExpanded={onToggleExpanded}
							onSelect={() => onSelect?.({ kind: "section", sectionIndex })}
							cellProps={cellProps}
						/>
					)}
				</TreeGridCell>
				<TreeGridCell>
					{(p) => (
						<RowActionsMenu
							toggleProps={p}
							label={sprintf(
								// translators: %d: section number.
								__("Actions for Section %d", "piano-block"),
								sectionNumber,
							)}
							onRename={() => onSelect?.({ kind: "section", sectionIndex })}
							onDuplicate={() => onDuplicateSection?.(sectionIndex)}
							onAddBefore={() => onAddSectionBefore?.(sectionIndex)}
							onAddAfter={() => onAddSectionAfter?.(sectionIndex)}
							onRemove={() => onRemoveSection?.(sectionIndex)}
						/>
					)}
				</TreeGridCell>
			</TreeGridRow>,
		);

		if (!sectionExpanded) {
			return;
		}

		measures.forEach((measure, measureIndex) => {
			const measureNumber = measureIndex + 1;
			const measureKey = expansionKey({ sectionIndex, measureIndex });
			const measureExpanded = isExpanded(measureKey);
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
					key={measureKey}
					level={2}
					positionInSet={measureNumber}
					setSize={measures.length}
					isExpanded={measureExpanded}
					data-expansion-key={measureKey}
				>
					<TreeGridCell>
						{(cellProps) => (
							<RowLabelCell
								expansionKey={measureKey}
								isExpanded={measureExpanded}
								selected={measureSelected}
								label={measureLabel}
								onToggleExpanded={onToggleExpanded}
								onSelect={() =>
									onSelect?.({
										kind: "measure",
										sectionIndex,
										measureIndex,
									})
								}
								cellProps={cellProps}
							/>
						)}
					</TreeGridCell>
					<TreeGridCell>
						{(p) => (
							<RowActionsMenu
								toggleProps={p}
								label={sprintf(
									// translators: 1: measure number, 2: section number.
									__("Actions for Measure %1$d of section %2$d", "piano-block"),
									measureNumber,
									sectionNumber,
								)}
								onRename={() =>
									onSelect?.({ kind: "measure", sectionIndex, measureIndex })
								}
								onDuplicate={() =>
									onDuplicateMeasure?.(sectionIndex, measureIndex)
								}
								onAddBefore={() =>
									onAddMeasureBefore?.(sectionIndex, measureIndex)
								}
								onAddAfter={() =>
									onAddMeasureAfter?.(sectionIndex, measureIndex)
								}
								onRemove={() => onRemoveMeasure?.(sectionIndex, measureIndex)}
							/>
						)}
					</TreeGridCell>
				</TreeGridRow>,
			);

			if (!measureExpanded) {
				return;
			}

			HANDS.forEach(({ key: hand, label: handLabel }, handPosition) => {
				const handKey = expansionKey({ sectionIndex, measureIndex, hand });
				const handExpanded = isExpanded(handKey);
				const events = Array.isArray(measure?.[hand]) ? measure[hand] : [];
				// Hand-group labels carry the section/measure ordinals so an exact-name
				// lookup never collides across measures.
				const addNoteLabel = sprintf(
					// translators: 1: hand name, 2: measure number, 3: section number.
					__("Add note to %1$s of measure %2$d of section %3$d", "piano-block"),
					handLabel,
					measureNumber,
					sectionNumber,
				);

				// Hand-group rows are organizational/non-selecting: the label toggles
				// expansion (the non-selecting expander) and the actions cell holds a
				// single direct "Add note" Button, never onSelect.
				rows.push(
					<TreeGridRow
						key={handKey}
						level={3}
						positionInSet={handPosition + 1}
						setSize={HANDS.length}
						isExpanded={handExpanded}
						data-expansion-key={handKey}
					>
						<TreeGridCell>
							{(cellProps) => (
								<>
									<TreeExpander
										isExpanded={handExpanded}
										onToggle={() => onToggleExpanded?.(handKey)}
									/>
									<Button
										{...cellProps}
										className="wp-block-piano-block-piano__tree-label"
										variant="tertiary"
										onClick={() => onToggleExpanded?.(handKey)}
									>
										{handLabel}
									</Button>
								</>
							)}
						</TreeGridCell>
						<TreeGridCell>
							{(cellProps) => (
								<Button
									{...cellProps}
									icon={plus}
									variant="secondary"
									label={addNoteLabel}
									onClick={() => onAddNote?.(sectionIndex, measureIndex, hand)}
								/>
							)}
						</TreeGridCell>
					</TreeGridRow>,
				);

				if (!handExpanded) {
					return;
				}

				events.forEach((event, eventIndex) => {
					const eventNumber = eventIndex + 1;
					const noteKey = eventKey({
						sectionIndex,
						measureIndex,
						hand,
						eventIndex,
					});
					const eventSelected =
						selection?.kind === "event" &&
						selection.sectionIndex === sectionIndex &&
						selection.measureIndex === measureIndex &&
						selection.hand === hand &&
						selection.eventIndex === eventIndex;

					rows.push(
						<TreeGridRow
							key={noteKey}
							level={4}
							positionInSet={eventNumber}
							setSize={events.length}
						>
							<TreeGridCell>
								{(cellProps) => (
									<Button
										{...cellProps}
										className="wp-block-piano-block-piano__tree-label"
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
								{(p) => (
									<RowActionsMenu
										toggleProps={p}
										label={sprintf(
											// translators: 1: note number, 2: hand name, 3: measure number, 4: section number.
											__(
												"Actions for Note %1$d of %2$s of measure %3$d of section %4$d",
												"piano-block",
											),
											eventNumber,
											handLabel,
											measureNumber,
											sectionNumber,
										)}
										onDuplicate={() =>
											onDuplicateNote?.(
												sectionIndex,
												measureIndex,
												hand,
												eventIndex,
											)
										}
										onAddBefore={() =>
											onAddNoteBefore?.(
												sectionIndex,
												measureIndex,
												hand,
												eventIndex,
											)
										}
										onAddAfter={() =>
											onAddNoteAfter?.(
												sectionIndex,
												measureIndex,
												hand,
												eventIndex,
											)
										}
										onRemove={() =>
											onRemoveNote?.(
												sectionIndex,
												measureIndex,
												hand,
												eventIndex,
											)
										}
									/>
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
			<TreeGrid
				aria-label={__("Song structure", "piano-block")}
				onExpandRow={onExpandCollapseRow}
				onCollapseRow={onExpandCollapseRow}
			>
				{rows}
			</TreeGrid>
		</div>
	);
}
