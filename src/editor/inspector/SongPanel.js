/**
 * The always-present **Song** inspector panel.
 *
 * Rendered inside `InspectorControls` regardless of selection, this is the
 * song-level settings panel: the song's optional `metadata` (title/composer) and
 * its `defaults` context. The common context fields — the tempo bpm and the time
 * signature — are visible directly; the uncommon ones — the tempo's `beatUnit`
 * and each hand's `handConfig` — hide behind a `ToolsPanel` so the panel stays
 * shallow but reaches the whole `defaults` model (Req 5, 7, 8; AC5, AC10).
 *
 * The panel is a pure controlled component: it holds no song state and emits the
 * next whole working `song` through `onChange` (the parent commits it). For the
 * `defaults` context it composes the shared `ContextEditor` in its `"tiered"`
 * layout — common tempo/time fields visible, `beatUnit` and the hand configs under
 * an `Advanced` disclosure — so the draft/projection/emit logic lives once in
 * `ContextEditor` rather than being forked here. The panel only wraps that
 * editor's emission back into the whole song. The non-context controls — the
 * song's `metadata`, the note-language select, and the Add-section button — stay
 * outside `ContextEditor` (the note-language select in particular is a common
 * Song-level control, not an advanced one).
 *
 * Every control is one of the bounded leaf editors or a closed-vocabulary select,
 * so the panel is conformant by construction.
 */
import { Button, PanelBody, SelectControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { ContextEditor } from "../ContextEditor.js";
import { omitEmpty } from "../emit.js";
import { MetadataEditor } from "../MetadataEditor.js";
import { mapSong } from "../noteNames.js";

/**
 * The note-language `SelectControl` options. Each `value` is a recognised
 * note-name system key (matching `inferNoteNameSystem`'s return and `mapSong`'s
 * `targetSystem`), so the selected value composes directly with the stored
 * `language` and the pitch controls' `system` with no translation.
 */
const LANGUAGES = [
	{ label: __("English", "piano-block"), value: "english" },
	{ label: __("Spanish", "piano-block"), value: "spanish" },
];

/**
 * The always-present Song-level settings panel.
 *
 * @param {Object}              props
 * @param {Object}              props.song     The current working song object.
 * @param {"english"|"spanish"} props.system       The per-song note-name system.
 * @param {Function}            props.onChange      Receives the next working song.
 * @param {Function}            props.onAddSection  Lifted: append a section.
 * @return {Object} The rendered Song panel.
 */
export function SongPanel({ song, system, onChange, onAddSection }) {
	const context = song.defaults ?? {};

	return (
		<PanelBody title={__("Song", "piano-block")} initialOpen>
			<MetadataEditor
				metadata={song.metadata}
				onChange={(metadata) => onChange(omitEmpty(song, "metadata", metadata))}
			/>

			<SelectControl
				label={__("Note language", "piano-block")}
				value={system}
				options={LANGUAGES}
				onChange={(target) => onChange(mapSong(song, target))}
				__nextHasNoMarginBottom
			/>

			<ContextEditor
				context={context}
				layout="tiered"
				onChange={(next) => onChange(omitEmpty(song, "defaults", next))}
			/>

			<Button variant="secondary" onClick={() => onAddSection?.()}>
				{__("Add section", "piano-block")}
			</Button>
		</PanelBody>
	);
}
