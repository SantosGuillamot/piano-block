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
import { resolveSelection } from "./editor/selection.js";
import { commitSong } from "./editor/serializeSong.js";
import { insertAt, newMeasure, newNote, newSong } from "./editor/songModel.js";
import SongCanvas from "./editor/SongCanvas.js";
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

	// Editor-only UI state: the selected event on the canvas, or `null` for none.
	// Not persisted; resolved against the working object each render, so a stale
	// selection (after a structural edit, undo, or raw edit) falls back to none.
	const [selection, setSelection] = useState(null);

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
	// spelling. Defaults to English for an empty/absent working object.
	const system = useMemo(() => inferNoteNameSystem(working), [working]);

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

	// Append an empty measure to the last section. The new measure is reachable via
	// its own canvas add-note affordance, so the selection is left as-is.
	const onAddMeasure = () => {
		const lastIndex = working.sections.length - 1;
		if (lastIndex < 0) {
			return;
		}
		const section = working.sections[lastIndex];
		const nextMeasures = insertAt(
			section.measures,
			section.measures.length,
			newMeasure(),
		);
		const nextSections = working.sections.map((current, index) =>
			index === lastIndex ? { ...section, measures: nextMeasures } : current,
		);
		commit({ ...working, sections: nextSections });
	};

	return (
		<div {...useBlockProps()}>
			<BlockControls>
				<ToolbarGroup>
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
					<SongCanvas
						song={working}
						accessibleName={accessibleName}
						selection={resolvedSelection}
						onSelect={setSelection}
						onAddNote={onAddNote}
						onAddMeasure={onAddMeasure}
					/>
					<InspectorControls>
						<SongPanel song={working} system={system} onChange={commit} />
						{resolvedSelection && (
							<>
								<NotePanel
									song={working}
									selection={resolvedSelection}
									system={system}
									onChange={commit}
									onRemove={() => setSelection(null)}
								/>
								<MeasurePanel
									song={working}
									selection={resolvedSelection}
									onChange={commit}
									onRemove={() => setSelection(null)}
								/>
								<SectionPanel
									song={working}
									selection={resolvedSelection}
									onChange={commit}
									onRemove={() => setSelection(null)}
								/>
							</>
						)}
					</InspectorControls>
				</>
			)}
		</div>
	);
}
