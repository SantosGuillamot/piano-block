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
 * hand-rolled `role="tree"`. Each row mirrors core's List View row: two
 * `TreeGridCell`s, each forwarding the cell's `{ ref, tabIndex, onFocus }` to
 * exactly one roving-tabindex focusable — a select-only label `Button` (with a
 * non-focusable stock chevron beside it) and a single `DropdownMenu` of the
 * row's kind-gated actions. `working.sections` is flattened into an ordered list
 * of *visible* rows (respecting expansion), each carrying its
 * `level`/`positionInSet`/`setSize` ARIA wiring. Indentation derives from the
 * rendered `aria-level` (emitted by `TreeGridRow`'s `level`), styled in
 * `style.scss` — no inline depth variable.
 *
 * It is a pure controlled component holding no song state: selecting a
 * section/measure/note row signals a kind-tagged `selection` through `onSelect`
 * (the same tuples the canvas/inspector resolve against, so `resolveSelection` +
 * the canvas `decorateSelection` highlight + the kind-gated inspector panels all
 * light up unchanged), and the per-row `DropdownMenu` items signal add / remove /
 * duplicate intent through the lifted `edit.js` handlers (the single owner of
 * `working` + `commit`). **Hand-group rows are organizational, not selectable** —
 * the selection model has no "hand" kind — so they are disclosure-only labels
 * that toggle expansion and host a single direct per-hand "Add note" `Button`
 * (KD 14).
 *
 * Expansion is a single membership lookup against one `expanded` Set of
 * coordinate-derived keys: `isExpanded(key) = expanded.has(key)` — no ancestor
 * test, no veto Set, no auto-reveal. The chevron's pointer `onClick` (and the
 * hand-group label's click) route to `onToggleExpanded(key)`; keyboard
 * expand/collapse stays TreeGrid's Left/Right arrows over the chevron-less rows.
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
} from "@wordpress/icons";
import { noteLabel } from "./noteNames.js";
import { expansionKey } from "./selection.js";

/** The two hands, in render order, with their display labels' translator keys. */
const HANDS = ["rightHand", "leftHand"];

/**
 * The non-focusable stock disclosure chevron shown beside an expandable row's
 * label, mirroring core's `ListViewExpander`: a `<span aria-hidden="true">`
 * wrapping a stock `<Icon>` (right/left when collapsed per text direction, down
 * when expanded). It carries a **pointer** `onClick` that toggles expansion but
 * has **no `tabIndex` and no role** — it is a visual cue for sighted/pointer
 * users, not a tab stop. Keyboard expand/collapse stays TreeGrid's Left/Right
 * arrows reading each row's `aria-expanded`. A stable class gives jest and the
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
 * The left structure tree.
 *
 * @param {Object}   props
 * @param {Object}   props.song               The current working song object.
 * @param {?Object}  props.selection          The resolved selection, or `null`.
 * @param {string}   props.system             The song's note-name system, for note labels.
 * @param {Set}      props.expanded           The single Set of expanded coordinate keys.
 * @param {Function} props.onToggleExpanded   Toggle a key's membership in `expanded`.
 * @param {Function} props.onSelect           Receives a kind-tagged selection.
 * @param {Function} props.onRemoveSection    Lifted: remove the section at the index.
 * @param {Function} props.onDuplicateSection Lifted: duplicate the section after itself.
 * @param {Function} props.onAddMeasure       Lifted: append a measure to a section.
 * @param {Function} props.onRemoveMeasure    Lifted: remove the measure at the coords.
 * @param {Function} props.onDuplicateMeasure Lifted: duplicate the measure after itself.
 * @param {Function} props.onAddNote          Lifted: add a note to a measure's hand.
 * @param {Function} props.onRemoveNote       Lifted: remove the note at the coords.
 * @param {Function} props.onDuplicateNote    Lifted: duplicate the note after itself.
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
	onAddMeasure,
	onRemoveMeasure,
	onDuplicateMeasure,
	onAddNote,
	onRemoveNote,
	onDuplicateNote,
}) {
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
			>
				<TreeGridCell>
					{(cellProps) => (
						<>
							<TreeExpander
								isExpanded={sectionExpanded}
								onToggle={() => onToggleExpanded?.(sectionKey)}
							/>
							<Button
								{...cellProps}
								className="wp-block-piano-block-piano__tree-label"
								variant="tertiary"
								aria-current={sectionSelected ? "true" : undefined}
								onClick={() => onSelect?.({ kind: "section", sectionIndex })}
							>
								{sectionLabel}
							</Button>
						</>
					)}
				</TreeGridCell>
				<TreeGridCell>
					{({ ref, tabIndex, onFocus }) => (
						<DropdownMenu
							icon={moreVertical}
							toggleProps={{ ref, tabIndex, onFocus }}
							label={sprintf(
								// translators: %d: section number.
								__("Actions for Section %d", "piano-block"),
								sectionNumber,
							)}
						>
							<MenuGroup>
								<MenuItem onClick={() => onDuplicateSection?.(sectionIndex)}>
									{__("Duplicate", "piano-block")}
								</MenuItem>
								<MenuItem onClick={() => onAddMeasure?.(sectionIndex)}>
									{__("Add measure", "piano-block")}
								</MenuItem>
								<MenuItem
									isDestructive
									onClick={() => onRemoveSection?.(sectionIndex)}
								>
									{__("Remove", "piano-block")}
								</MenuItem>
							</MenuGroup>
						</DropdownMenu>
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
				>
					<TreeGridCell>
						{(cellProps) => (
							<>
								<TreeExpander
									isExpanded={measureExpanded}
									onToggle={() => onToggleExpanded?.(measureKey)}
								/>
								<Button
									{...cellProps}
									className="wp-block-piano-block-piano__tree-label"
									variant="tertiary"
									aria-current={measureSelected ? "true" : undefined}
									onClick={() =>
										onSelect?.({
											kind: "measure",
											sectionIndex,
											measureIndex,
										})
									}
								>
									{measureLabel}
								</Button>
							</>
						)}
					</TreeGridCell>
					<TreeGridCell>
						{({ ref, tabIndex, onFocus }) => (
							<DropdownMenu
								icon={moreVertical}
								toggleProps={{ ref, tabIndex, onFocus }}
								label={sprintf(
									// translators: 1: measure number, 2: section number.
									__("Actions for Measure %1$d of section %2$d", "piano-block"),
									measureNumber,
									sectionNumber,
								)}
							>
								<MenuGroup>
									<MenuItem
										onClick={() =>
											onDuplicateMeasure?.(sectionIndex, measureIndex)
										}
									>
										{__("Duplicate", "piano-block")}
									</MenuItem>
									<MenuItem
										isDestructive
										onClick={() =>
											onRemoveMeasure?.(sectionIndex, measureIndex)
										}
									>
										{__("Remove", "piano-block")}
									</MenuItem>
								</MenuGroup>
							</DropdownMenu>
						)}
					</TreeGridCell>
				</TreeGridRow>,
			);

			if (!measureExpanded) {
				return;
			}

			HANDS.forEach((hand, handPosition) => {
				const handKey = expansionKey({ sectionIndex, measureIndex, hand });
				const handExpanded = isExpanded(handKey);
				const events = Array.isArray(measure?.[hand]) ? measure[hand] : [];
				// Hand-group labels carry the section/measure ordinals so an exact-name
				// lookup never collides across measures.
				const handLabel =
					hand === "rightHand"
						? __("Right hand", "piano-block")
						: __("Left hand", "piano-block");
				const addNoteLabel = sprintf(
					// translators: 1: hand name, 2: measure number, 3: section number.
					__("Add note to %1$s of measure %2$d of section %3$d", "piano-block"),
					handLabel,
					measureNumber,
					sectionNumber,
				);

				// Hand-group rows are organizational/non-selecting (KD 14): the label
				// toggles expansion (the non-selecting expander) and the actions cell
				// holds a single direct "Add note" Button, never onSelect.
				rows.push(
					<TreeGridRow
						key={handKey}
						level={3}
						positionInSet={handPosition + 1}
						setSize={HANDS.length}
						isExpanded={handExpanded}
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
									icon="plus"
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
					const eventKey = `${handKey}e${eventIndex}`;
					const eventSelected =
						selection?.kind === "event" &&
						selection.sectionIndex === sectionIndex &&
						selection.measureIndex === measureIndex &&
						selection.hand === hand &&
						selection.eventIndex === eventIndex;

					rows.push(
						<TreeGridRow
							key={eventKey}
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
								{({ ref, tabIndex, onFocus }) => (
									<DropdownMenu
										icon={moreVertical}
										toggleProps={{ ref, tabIndex, onFocus }}
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
									>
										<MenuGroup>
											<MenuItem
												onClick={() =>
													onDuplicateNote?.(
														sectionIndex,
														measureIndex,
														hand,
														eventIndex,
													)
												}
											>
												{__("Duplicate", "piano-block")}
											</MenuItem>
											<MenuItem
												isDestructive
												onClick={() =>
													onRemoveNote?.(
														sectionIndex,
														measureIndex,
														hand,
														eventIndex,
													)
												}
											>
												{__("Remove", "piano-block")}
											</MenuItem>
										</MenuGroup>
									</DropdownMenu>
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
		</div>
	);
}
