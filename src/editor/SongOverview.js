/**
 * The top level of the structural editor — a song's optional `metadata`, its
 * optional `defaults` context, and its list of sections.
 *
 * This is the home view the SongEditor opens to: the `MetadataEditor` over the
 * song's `metadata`, a `ContextEditor` over its `defaults`, and the
 * `SectionList`. Each child emits only what it carries — `metadata` and
 * `defaults` are dropped when empty so an untouched song stays minimal — and this
 * component routes those emissions back into the whole song object, which it
 * emits upward. The parent owns the song state and re-feeds the emitted value;
 * this component holds none.
 */
import { __ } from "@wordpress/i18n";
import { ContextEditor } from "./ContextEditor.js";
import { MetadataEditor } from "./MetadataEditor.js";
import { SectionList } from "./SectionList.js";

/**
 * Emit the song with `key` set to `value`, dropping the key when `value` has no
 * set fields so an emptied optional block clears its key.
 *
 * @param {Object}   song     The current song object.
 * @param {string}   key      The optional block being set (`metadata`/`defaults`).
 * @param {Object}   value    The block's next value.
 * @param {Function} onChange Receives the next song object.
 */
function emitBlock(song, key, value, onChange) {
	const next = { ...song };
	if (value && Object.keys(value).length > 0) {
		next[key] = value;
	} else {
		delete next[key];
	}
	onChange(next);
}

/**
 * Edit the whole song at the overview level.
 *
 * @param {Object}              props
 * @param {Object}              props.song          The current song object.
 * @param {"english"|"spanish"} props.system        The per-song note-name system.
 * @param {Function}            props.onChange      Receives the next song.
 * @param {Function}            props.onOpenSection Called with a section's index
 *                                                  to open its editor.
 * @return {Object} The rendered song overview.
 */
export function SongOverview({
	song,
	system: _system,
	onChange,
	onOpenSection,
}) {
	return (
		<div>
			<MetadataEditor
				metadata={song.metadata}
				onChange={(metadata) => emitBlock(song, "metadata", metadata, onChange)}
			/>
			<ContextEditor
				context={song.defaults}
				heading={__("Defaults", "piano-block")}
				onChange={(defaults) => emitBlock(song, "defaults", defaults, onChange)}
			/>
			<SectionList
				sections={song.sections}
				onChange={(sections) => onChange({ ...song, sections })}
				onOpenSection={onOpenSection}
			/>
		</div>
	);
}
