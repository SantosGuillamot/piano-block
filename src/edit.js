import {
	BlockControls,
	InspectorControls,
	useBlockProps,
} from "@wordpress/block-editor";
import {
	Notice,
	TextareaControl,
	ToolbarButton,
	ToolbarGroup,
} from "@wordpress/components";
import { useMemo, useState } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { accessibleNameFor } from "./editor/accessibleName.js";
import { InvalidState } from "./editor/InvalidState.js";
import { MeasurePanel } from "./editor/inspector/MeasurePanel.js";
import { NotePanel } from "./editor/inspector/NotePanel.js";
import { SectionPanel } from "./editor/inspector/SectionPanel.js";
import { SongPanel } from "./editor/inspector/SongPanel.js";
import { inferNoteNameSystem } from "./editor/noteNames.js";
import SongCanvas from "./editor/SongCanvas.js";
import { StructureTree } from "./editor/StructureTree.js";
import { resolveSelection } from "./editor/selection.js";
import { commitSong } from "./editor/serializeSong.js";
import {
	duplicateAt,
	insertAt,
	newMeasure,
	newNote,
	newSection,
	newSong,
	removeAt,
} from "./editor/songModel.js";
import validateSong from "./song/validate.js";

/**
 * Parse a `song` string to its working object, returning `null` on a parse throw
 * rather than propagating. A defensive companion to the `errors` gate: a
 * non-conformant string never reaches a render that uses the parse, but a string
 * that is invalid JSON would otherwise throw here.
 *
 * @param {string} song The raw `song` string.
 * @return {?Object} The parsed working object, or `null` on a parse failure.
 */
function safeParse(song) {
	try {
		return JSON.parse(song);
	} catch {
		return null;
	}
}

/**
 * The block's editor — a thin mode container.
 *
 * The block persists exactly one thing: the raw `song` string. This container
 * branches on an editor-only `mode` toggle and never holds the song any other
 * way:
 *   - **visual mode** (the default surface): the canvas-first editor — an
 *     interactive sheet-music `SongCanvas` the author both reads and edits on,
 *     plus the block's `InspectorControls` settings panels. The always-present
 *     `SongPanel` edits song-level settings; selecting an event on the canvas also
 *     reveals the `NotePanel`/`MeasurePanel`/`SectionPanel` bound to that event's
 *     event, measure, and section. The container turns the string into a working
 *     object — seeding an empty song with `newSong()` so the canvas shows an empty
 *     grand staff — and routes every edit back through `commitSong`, which
 *     serializes and re-validates before persisting. A non-empty *invalid* song
 *     can't be edited visually, so it routes to `InvalidState` ("Edit as JSON").
 *   - **JSON mode**: the raw `song` document as a textarea, edited as plain text.
 *     The raw string persists unconditionally on every change — even when it is
 *     invalid JSON or non-conformant. Validation is a pure, presentational
 *     side-computation surfacing a non-blocking error notice; it NEVER blocks
 *     saving, clears the field, or substitutes a parsed value.
 *
 * `errors = validateSong(song)` is computed once (memoized on the string; the
 * empty string is the "no song" state and is never validated) and gates both the
 * visual branch and the JSON notice. `mode` and the visual branch's `selection`
 * are editor-only UI state and are NOT persisted to attributes.
 *
 * @param {Object}   props                 Block edit props.
 * @param {Object}   props.attributes      The block's attributes.
 * @param {string}   props.attributes.song The raw song JSON string.
 * @param {Function} props.setAttributes   Updates the block's attributes.
 * @return {Element} The block's editor markup.
 */
export default function Edit({ attributes, setAttributes }) {
	const { song } = attributes;

	// Editor-only UI state: which surface is shown. Visual is the default; never
	// persisted to attributes.
	const [mode, setMode] = useState("visual");

	// Editor-only UI state: the selected node, or `null` for none. Not persisted;
	// resolved against the working object each render, so a stale selection (after a
	// structural edit, undo, or raw edit) falls back to none.
	const [selection, setSelection] = useState(null);

	// Editor-only UI state: whether the left structure tree is shown (open by
	// default on mount), which tree rows are manually expanded (by index-path
	// string), and which selection-ancestor rows the author has manually collapsed.
	// None is persisted; the toolbar toggle closes and reopens the tree and a manual
	// close sticks for the session (nothing re-forces it open). The expanded Set is
	// layered with auto-expand of the selection's ancestors in the tree; the
	// `collapsedOverride` Set is the manual-collapse veto over that auto-reveal, so a
	// deliberate collapse of a selected node's ancestor sticks (it does not spring
	// back open). Both Sets are index-path-keyed best-effort, so their staleness
	// after a structural edit is best-effort (same wart, not new).
	const [showTree, setShowTree] = useState(true);
	const [expandedPaths, setExpandedPaths] = useState(() => new Set());
	const [_collapsedOverride, setCollapsedOverride] = useState(() => new Set());

	// Toggle a tree row's manual expansion by its index-path string. A new Set is
	// built each call so React sees a fresh reference and re-renders the tree.
	const onToggleExpanded = (path) => {
		setExpandedPaths((current) => {
			const next = new Set(current);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	// Dead since the StructureTree redesign dropped the dual-Set/veto regime (the
	// tree now takes a single `expanded` Set and no longer accepts this toggle).
	// Kept (underscore-prefixed to satisfy no-unused-vars) only as the harmless
	// bridge while edit.js's own state collapse waits for T5, which deletes this
	// function and the now-dead `collapsedOverride` state outright.
	const _onToggleCollapsedOverride = (path) => {
		setCollapsedOverride((current) => {
			const next = new Set(current);
			if (next.has(path)) {
				next.delete(path);
			} else {
				next.add(path);
			}
			return next;
		});
	};

	// Pure, presentational validation: re-run only when the text changes. The
	// empty string is the "no song" state and is never validated.
	const errors = useMemo(
		() => (song.trim() === "" ? [] : validateSong(song)),
		[song],
	);

	// The single source of truth stays the string; every edit persists it raw.
	const onChangeSong = (next) => setAttributes({ song: next });

	// The accessible name announced on the canvas's SVG `<title>`, derived from the
	// song's metadata only when it is conformant (mirrors the front end). A
	// non-conformant song renders no canvas, so the name is unused then.
	const accessibleName = useMemo(() => {
		if (errors.length > 0 || song.trim() === "") {
			return "";
		}
		try {
			return accessibleNameFor(JSON.parse(song)?.metadata);
		} catch {
			return "";
		}
	}, [song, errors]);

	// The working object the visual branch edits. An empty song is seeded with
	// `newSong()` so the canvas shows an empty grand staff (the attribute stays
	// `""` until a first edit commits — lazy seeding, never persisted on mount); a
	// non-empty conformant song is parsed; a non-empty invalid one is `null` (it
	// routes to `InvalidState` below).
	const working = useMemo(() => {
		if (song.trim() === "") {
			return newSong();
		}
		return errors.length > 0 ? null : safeParse(song);
	}, [song, errors]);

	// The per-song note-name system, so the panels edit pitches in the song's own
	// spelling. A stored `language` field is authoritative; inference from the
	// pitches is the fallback only when the field is absent (so a language-less
	// song still reads its system from its spellings, defaulting to English for an
	// empty/absent working object).
	const system = useMemo(
		() => working?.language ?? inferNoteNameSystem(working),
		[working],
	);

	// A non-empty song that does not parse-and-validate cannot be edited visually:
	// route to the invalid state (no canvas, no panels) so the author can fix it in
	// raw-JSON mode. The empty-then-seeded case has a non-null `working`, so it
	// never lands here.
	const isInvalid =
		song.trim() !== "" && (errors.length > 0 || working === null);

	// Resolve the selection against the live working object every render: a stale
	// selection (its event/measure/section no longer exists) resolves to `null`, so
	// the sidebar falls back to the always-present Song panel only.
	const resolvedSelection = resolveSelection(working, selection);

	// The single persist path for every visual edit: serialize the next working
	// object, re-validate, and only then commit the raw string (conformant by
	// construction; the guard catches a latent control bug).
	const commit = (nextWorking) => commitSong(nextWorking, onChangeSong);

	// Append a note to a measure's hand (hand = the staff the canvas affordance
	// belongs to). When the current selection is an event in that same hand, the
	// new note is inserted right after it; otherwise it is appended. The new note
	// is then selected so its panel opens on it.
	const onAddNote = (sectionIndex, measureIndex, hand) => {
		const section = working.sections[sectionIndex];
		const measure = section.measures[measureIndex];
		const events = measure[hand] ?? [];
		const insertIndex =
			resolvedSelection &&
			resolvedSelection.sectionIndex === sectionIndex &&
			resolvedSelection.measureIndex === measureIndex &&
			resolvedSelection.hand === hand
				? resolvedSelection.eventIndex + 1
				: events.length;
		const nextEvents = insertAt(events, insertIndex, newNote());
		const nextMeasures = section.measures.map((current, index) =>
			index === measureIndex ? { ...measure, [hand]: nextEvents } : current,
		);
		const nextSections = working.sections.map((current, index) =>
			index === sectionIndex ? { ...section, measures: nextMeasures } : current,
		);
		commit({ ...working, sections: nextSections });
		setSelection({ sectionIndex, measureIndex, hand, eventIndex: insertIndex });
	};

	// The four structural mutators, lifted here as the single owner of `working` +
	// `commit` (the panels and, from T6, the Structure list only signal intent).
	// Each is the same immutable splice the panels used to do locally, written once;
	// removing the selected section/measure (or one above it) clears the now-stale
	// selection so the sidebar falls back to Song-only.

	// Append an empty-but-conformant section. The new section is reachable via the
	// Structure list, so the current selection is left as-is.
	const onAddSection = () => {
		commit({
			...working,
			sections: insertAt(
				working.sections,
				working.sections.length,
				newSection(),
			),
		});
	};

	// Remove a section. If the selection pointed at (or under) the removed section,
	// it is now stale, so clear it.
	const onRemoveSection = (sectionIndex) => {
		commit({
			...working,
			sections: removeAt(working.sections, sectionIndex),
		});
		if (selection?.sectionIndex === sectionIndex) {
			setSelection(null);
		}
	};

	// Append an empty measure to a section. The Structure list passes an explicit
	// `sectionIndex`; the default-to-last fallback covers a call with no target. The
	// new measure is reachable via the Structure list, so the selection is left as-is.
	const onAddMeasure = (sectionIndex = working.sections.length - 1) => {
		const section = working.sections[sectionIndex];
		if (!section) {
			return;
		}
		const nextMeasures = insertAt(
			section.measures,
			section.measures.length,
			newMeasure(),
		);
		const nextSections = working.sections.map((current, index) =>
			index === sectionIndex ? { ...section, measures: nextMeasures } : current,
		);
		commit({ ...working, sections: nextSections });
	};

	// Remove a measure from a section. If the selection pointed at (or under) the
	// removed measure, it is now stale, so clear it.
	const onRemoveMeasure = (sectionIndex, measureIndex) => {
		const section = working.sections[sectionIndex];
		if (!section) {
			return;
		}
		const nextMeasures = removeAt(section.measures, measureIndex);
		const nextSections = working.sections.map((current, index) =>
			index === sectionIndex ? { ...section, measures: nextMeasures } : current,
		);
		commit({ ...working, sections: nextSections });
		if (
			selection?.sectionIndex === sectionIndex &&
			selection?.measureIndex === measureIndex
		) {
			setSelection(null);
		}
	};

	// Remove an event from a measure's hand (the lifted note-level remove the Note
	// panel signals, so the splice lives in one place). Reproduces
	// `NotePanel.removeEvent`: drop the `[hand]` key when its list empties, else set
	// it; rebuild measure → section → song immutably; commit. If the selection
	// pointed at the removed event, it is now stale, so clear it.
	const onRemoveNote = (sectionIndex, measureIndex, hand, eventIndex) => {
		const section = working.sections[sectionIndex];
		if (!section) {
			return;
		}
		const measure = section.measures[measureIndex];
		if (!measure?.[hand]) {
			return;
		}
		const nextEvents = removeAt(measure[hand], eventIndex);
		let nextMeasure;
		if (nextEvents.length > 0) {
			nextMeasure = { ...measure, [hand]: nextEvents };
		} else {
			const { [hand]: _dropped, ...restMeasure } = measure;
			nextMeasure = restMeasure;
		}
		const nextMeasures = section.measures.map((current, index) =>
			index === measureIndex ? nextMeasure : current,
		);
		const nextSections = working.sections.map((current, index) =>
			index === sectionIndex ? { ...section, measures: nextMeasures } : current,
		);
		commit({ ...working, sections: nextSections });
		if (
			selection?.sectionIndex === sectionIndex &&
			selection?.measureIndex === measureIndex &&
			selection?.hand === hand &&
			selection?.eventIndex === eventIndex
		) {
			setSelection(null);
		}
	};

	// The three duplicate mutators: each inserts a deep copy right after the
	// original via `duplicateAt` (index + 1) and commits, then selects the copy so
	// its panel opens on it (mirroring `onAddNote`'s auto-select). Each guards a
	// missing section/measure/hand so a stale call is a no-op, never a throw.

	// Duplicate a whole section after itself.
	const onDuplicateSection = (sectionIndex) => {
		if (!working.sections[sectionIndex]) {
			return;
		}
		commit({
			...working,
			sections: duplicateAt(working.sections, sectionIndex),
		});
		setSelection({ kind: "section", sectionIndex: sectionIndex + 1 });
	};

	// Duplicate a measure after itself, within its section.
	const onDuplicateMeasure = (sectionIndex, measureIndex) => {
		const section = working.sections[sectionIndex];
		if (!section?.measures[measureIndex]) {
			return;
		}
		const nextMeasures = duplicateAt(section.measures, measureIndex);
		const nextSections = working.sections.map((current, index) =>
			index === sectionIndex ? { ...section, measures: nextMeasures } : current,
		);
		commit({ ...working, sections: nextSections });
		setSelection({
			kind: "measure",
			sectionIndex,
			measureIndex: measureIndex + 1,
		});
	};

	// Duplicate an event after itself, within its measure's hand.
	const onDuplicateNote = (sectionIndex, measureIndex, hand, eventIndex) => {
		const section = working.sections[sectionIndex];
		if (!section) {
			return;
		}
		const measure = section.measures[measureIndex];
		if (!measure?.[hand]?.[eventIndex]) {
			return;
		}
		const nextEvents = duplicateAt(measure[hand], eventIndex);
		const nextMeasures = section.measures.map((current, index) =>
			index === measureIndex ? { ...measure, [hand]: nextEvents } : current,
		);
		const nextSections = working.sections.map((current, index) =>
			index === sectionIndex ? { ...section, measures: nextMeasures } : current,
		);
		commit({ ...working, sections: nextSections });
		setSelection({
			kind: "event",
			sectionIndex,
			measureIndex,
			hand,
			eventIndex: eventIndex + 1,
		});
	};

	return (
		<div {...useBlockProps()}>
			<BlockControls>
				<ToolbarGroup>
					{/* The structure-tree toggle, meaningful only on the visual surface
					    (the left tree is the selection surface; in JSON mode there is no
					    canvas to pair it with). Mirrors the "Edit as JSON" toggle. */}
					{mode !== "json" && (
						<ToolbarButton
							isActive={showTree}
							onClick={() => setShowTree((current) => !current)}
						>
							{__("Structure", "piano-block")}
						</ToolbarButton>
					)}
					<ToolbarButton
						isActive={mode === "json"}
						onClick={() => setMode(mode === "json" ? "visual" : "json")}
					>
						{mode === "json"
							? __("Visual editor", "piano-block")
							: __("Edit as JSON", "piano-block")}
					</ToolbarButton>
				</ToolbarGroup>
			</BlockControls>
			{mode === "json" ? (
				<>
					<TextareaControl
						label={__("Song (JSON)", "piano-block")}
						help={__(
							"The raw song document as JSON. Validation is informational and never blocks saving.",
							"piano-block",
						)}
						value={song}
						onChange={onChangeSong}
						rows={12}
						className="wp-block-piano-block-piano__song-input"
					/>
					{errors.length > 0 && (
						<Notice status="error" isDismissible={false}>
							{errors[0]}
						</Notice>
					)}
				</>
			) : isInvalid ? (
				<InvalidState errors={errors} onEditAsJson={() => setMode("json")} />
			) : (
				<>
					{/* The editor workspace: the left structure tree (the selection
					    surface, toggled by the Structure toolbar button) beside the canvas
					    (display + highlight). The tree column is left, the canvas right;
					    `style.scss` lays them out as a flex row. */}
					<div className="wp-block-piano-block-piano__workspace">
						{showTree && (
							<StructureTree
								song={working}
								selection={resolvedSelection}
								system={system}
								expanded={expandedPaths}
								onToggleExpanded={onToggleExpanded}
								onSelect={setSelection}
								onRemoveSection={onRemoveSection}
								onDuplicateSection={onDuplicateSection}
								onAddMeasure={onAddMeasure}
								onRemoveMeasure={onRemoveMeasure}
								onDuplicateMeasure={onDuplicateMeasure}
								onAddNote={onAddNote}
								onRemoveNote={onRemoveNote}
								onDuplicateNote={onDuplicateNote}
							/>
						)}
						<SongCanvas
							song={working}
							accessibleName={accessibleName}
							selection={resolvedSelection}
						/>
					</div>
					<InspectorControls>
						{/* Render the panels most-specific first — Note → Measure →
						    Section → Song — gating each by the selection's kind: only an
						    event has a note; a measure/event also has a measure; every
						    kind has a section; Song is always shown, last. So a note
						    selection shows Note+Measure+Section+Song, a measure shows
						    Measure+Section+Song, a section shows Section+Song, and nothing
						    selected shows Song only (the same per-kind sets as before;
						    only the order changed). */}
						{resolvedSelection?.kind === "event" && (
							<NotePanel
								song={working}
								selection={resolvedSelection}
								system={system}
								onChange={commit}
								onRemoveNote={onRemoveNote}
								onAddNote={onAddNote}
							/>
						)}
						{(resolvedSelection?.kind === "event" ||
							resolvedSelection?.kind === "measure") && (
							<MeasurePanel
								song={working}
								selection={resolvedSelection}
								onChange={commit}
								onRemoveMeasure={onRemoveMeasure}
							/>
						)}
						{resolvedSelection && (
							<SectionPanel
								song={working}
								selection={resolvedSelection}
								onChange={commit}
								onRemoveSection={onRemoveSection}
							/>
						)}
						<SongPanel
							song={working}
							system={system}
							onChange={commit}
							onAddSection={onAddSection}
						/>
					</InspectorControls>
				</>
			)}
		</div>
	);
}
