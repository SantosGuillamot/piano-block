/**
 * The visual-editor root — the component that branches on the song's validity,
 * owns the parse → edit → serialize data flow, and drives the drill-down
 * navigation.
 *
 * The block persists exactly one thing: the raw `song` string. This root is the
 * single place that turns that string into something the structured editors can
 * work with and turns their edits back into a string. It branches three ways:
 *   - empty (`song.trim() === ""`): the `EmptyState`, which seeds a minimal song;
 *   - invalid (`errors.length > 0`): the `InvalidState`, which routes to raw JSON;
 *   - conformant: the structured editor, opened to the drill-down level the
 *     author has navigated to.
 *
 * The single source of truth stays the string. The working object is parsed only
 * for a conformant song and memoized on the string, so typical edits do not
 * re-parse; the note-name `system` is inferred once and memoized on the parsed
 * object. No parsed object is held as separate React state — only the *navigation*
 * (which section / measure / event is open) is local UI state. Every child
 * `onChange` produces the next slice, which this root splices into the working
 * object with the shared array helpers and commits through `commitSong`, so the
 * serialize-time conformance guard always runs before the string is persisted.
 *
 * Navigation is a path of indices (`sectionIndex` → `measureIndex` →
 * `hand`/`eventIndex`); each drill-in deepens it and the breadcrumb walks back up.
 * After an edit can invalidate the open path (e.g. removing the open section), the
 * path is repaired on render — clamped or popped to a level that still exists — so
 * the editor never tries to open a missing item.
 */
import { useMemo, useState } from "@wordpress/element";
import { __, sprintf } from "@wordpress/i18n";
import { Breadcrumb } from "./Breadcrumb.js";
import { EmptyState } from "./EmptyState.js";
import { EventEditor } from "./EventEditor.js";
import { InvalidState } from "./InvalidState.js";
import { MeasureEditor } from "./MeasureEditor.js";
import { inferNoteNameSystem } from "./noteNames.js";
import { SectionEditor } from "./SectionEditor.js";
import { SongOverview } from "./SongOverview.js";
import { commitSong } from "./serializeSong.js";
import { replaceAt } from "./songModel.js";

/**
 * Repair a navigation path against the current working object, popping any level
 * whose underlying item no longer exists (e.g. after a remove). Levels are
 * dependent — a missing section invalidates everything below it — so the first
 * missing level truncates the rest.
 *
 * @param {Object} path The current navigation path.
 * @param {Object} song The parsed working object.
 * @return {Object} A path whose every level points at an existing item.
 */
function repairPath(path, song) {
	const { sectionIndex, measureIndex, hand, eventIndex } = path;
	if (sectionIndex === undefined) {
		return {};
	}
	const section = song.sections?.[sectionIndex];
	if (!section) {
		return {};
	}
	if (measureIndex === undefined) {
		return { sectionIndex };
	}
	const measure = section.measures?.[measureIndex];
	if (!measure) {
		return { sectionIndex };
	}
	if (hand === undefined || eventIndex === undefined) {
		return { sectionIndex, measureIndex };
	}
	if (!measure[hand]?.[eventIndex]) {
		return { sectionIndex, measureIndex };
	}
	return { sectionIndex, measureIndex, hand, eventIndex };
}

/**
 * Build the breadcrumb trail labels for a (repaired) path: "Song", then a
 * numbered crumb per open level, the last being the current view.
 *
 * @param {Object} path The repaired navigation path.
 * @return {string[]} The ordered crumb labels, root first.
 */
function trailFor(path) {
	const { sectionIndex, measureIndex, hand, eventIndex } = path;
	const trail = [__("Song", "piano-block")];
	if (sectionIndex === undefined) {
		return trail;
	}
	trail.push(
		sprintf(
			/* translators: %d: section number. */
			__("Section %d", "piano-block"),
			sectionIndex + 1,
		),
	);
	if (measureIndex === undefined) {
		return trail;
	}
	trail.push(
		sprintf(
			/* translators: %d: measure number. */
			__("Measure %d", "piano-block"),
			measureIndex + 1,
		),
	);
	if (hand === undefined || eventIndex === undefined) {
		return trail;
	}
	const handLabel =
		hand === "rightHand"
			? __("Right hand", "piano-block")
			: __("Left hand", "piano-block");
	trail.push(
		sprintf(
			/* translators: %1$s: hand name; %2$d: event number. */
			__("%1$s event %2$d", "piano-block"),
			handLabel,
			eventIndex + 1,
		),
	);
	return trail;
}

/**
 * The structured editor: the breadcrumb plus the view for the open level. Every
 * edit produces the next whole song object, which the caller commits.
 *
 * @param {Object}              props
 * @param {Object}              props.song     The parsed working object.
 * @param {"english"|"spanish"} props.system   The per-song note-name system.
 * @param {Object}              props.path     The repaired navigation path.
 * @param {Function}            props.onNavigate Truncate the path to a crumb level.
 * @param {Function}            props.setPath  Replace the navigation path.
 * @param {Function}            props.onChange Receives the next whole song object.
 * @return {Object} The rendered structured editor.
 */
function StructuredEditor({
	song,
	system,
	path,
	onNavigate,
	setPath,
	onChange,
}) {
	const { sectionIndex, measureIndex, hand, eventIndex } = path;
	const trail = trailFor(path);

	let view;
	if (sectionIndex === undefined) {
		view = (
			<SongOverview
				song={song}
				system={system}
				onChange={onChange}
				onOpenSection={(index) => setPath({ sectionIndex: index })}
			/>
		);
	} else if (measureIndex === undefined) {
		const section = song.sections[sectionIndex];
		view = (
			<SectionEditor
				section={section}
				onChange={(nextSection) =>
					onChange({
						...song,
						sections: replaceAt(song.sections, sectionIndex, nextSection),
					})
				}
				onOpenMeasure={(index) =>
					setPath({ sectionIndex, measureIndex: index })
				}
			/>
		);
	} else if (hand === undefined || eventIndex === undefined) {
		const section = song.sections[sectionIndex];
		const measure = section.measures[measureIndex];
		view = (
			<MeasureEditor
				measure={measure}
				system={system}
				onChange={(nextMeasure) =>
					onChange({
						...song,
						sections: replaceAt(song.sections, sectionIndex, {
							...section,
							measures: replaceAt(section.measures, measureIndex, nextMeasure),
						}),
					})
				}
				onDrillIn={(drillHand, index) =>
					setPath({
						sectionIndex,
						measureIndex,
						hand: drillHand,
						eventIndex: index,
					})
				}
			/>
		);
	} else {
		const section = song.sections[sectionIndex];
		const measure = section.measures[measureIndex];
		const event = measure[hand][eventIndex];
		view = (
			<EventEditor
				event={event}
				system={system}
				onChange={(nextEvent) =>
					onChange({
						...song,
						sections: replaceAt(song.sections, sectionIndex, {
							...section,
							measures: replaceAt(section.measures, measureIndex, {
								...measure,
								[hand]: replaceAt(measure[hand], eventIndex, nextEvent),
							}),
						}),
					})
				}
				onBack={() => setPath({ sectionIndex, measureIndex })}
			/>
		);
	}

	return (
		<div>
			<Breadcrumb trail={trail} onNavigate={onNavigate} />
			{view}
		</div>
	);
}

/**
 * The visual-editor root.
 *
 * @param {Object}   props
 * @param {string}   props.song         The raw song string (single source of truth).
 * @param {string[]} props.errors       The memoized `validateSong(song)` result.
 * @param {Function} props.onChangeSong Persists the next raw song string.
 * @param {Function} props.onEditAsJson Switches to the raw-JSON editor.
 * @return {Object} The rendered visual editor.
 */
export function SongEditor({ song, errors, onChangeSong, onEditAsJson }) {
	const [path, setPath] = useState({});

	// Parse only a conformant song, memoized on the raw string so typical edits
	// don't re-parse. The branch order below guarantees we only read this when
	// the song is non-empty and conformant.
	const parsed = useMemo(() => {
		if (song.trim() === "" || errors.length > 0) {
			return null;
		}
		try {
			return JSON.parse(song);
		} catch {
			return null;
		}
	}, [song, errors]);

	// Infer the note-name system once per parsed object.
	const system = useMemo(
		() => (parsed ? inferNoteNameSystem(parsed) : "english"),
		[parsed],
	);

	if (song.trim() === "") {
		return <EmptyState onStart={onChangeSong} />;
	}

	if (errors.length > 0 || !parsed) {
		return <InvalidState errors={errors} onEditAsJson={onEditAsJson} />;
	}

	// Repair the open path against the current song so a removed item never
	// leaves the editor pointing at a missing level.
	const safePath = repairPath(path, parsed);

	return (
		<StructuredEditor
			song={parsed}
			system={system}
			path={safePath}
			onNavigate={(level) => {
				// `level` is the crumb's index in the trail; level 0 is the song root.
				if (level === 0) {
					setPath({});
				} else if (level === 1) {
					setPath({ sectionIndex: safePath.sectionIndex });
				} else if (level === 2) {
					setPath({
						sectionIndex: safePath.sectionIndex,
						measureIndex: safePath.measureIndex,
					});
				}
			}}
			setPath={setPath}
			onChange={(nextSong) => commitSong(nextSong, onChangeSong)}
		/>
	);
}
