import { BlockControls, useBlockProps } from "@wordpress/block-editor";
import {
	Notice,
	TextareaControl,
	ToolbarButton,
	ToolbarGroup,
} from "@wordpress/components";
import { useMemo, useState } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { accessibleNameFor } from "./editor/accessibleName.js";
import { SongEditor } from "./editor/SongEditor.js";
import SongPreview from "./editor/SongPreview.js";
import validateSong from "./song/validate.js";

/**
 * The block's editor — a thin mode container.
 *
 * The block persists exactly one thing: the raw `song` string. This container
 * branches on an editor-only `mode` toggle and never holds the song any other
 * way:
 *   - **visual mode** (the default surface): the structured `SongEditor` beside a
 *     live, read-only `SongPreview`. The editor turns the string into a working
 *     object and back; the preview mirrors the front-end render. They sit side by
 *     side but are NEVER two editors — the preview is read-only.
 *   - **JSON mode**: the raw `song` document as a textarea, edited as plain text.
 *     The raw string persists unconditionally on every change — even when it is
 *     invalid JSON or non-conformant. Validation is a pure, presentational
 *     side-computation surfacing a non-blocking error notice; it NEVER blocks
 *     saving, clears the field, or substitutes a parsed value.
 *
 * `errors = validateSong(song)` is computed once (memoized on the string; the
 * empty string is the "no song" state and is never validated) and passed to both
 * surfaces. `mode` is editor-only UI state and is NOT persisted to attributes.
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

	// Pure, presentational validation: re-run only when the text changes. The
	// empty string is the "no song" state and is never validated.
	const errors = useMemo(
		() => (song.trim() === "" ? [] : validateSong(song)),
		[song],
	);

	// The single source of truth stays the string; every edit persists it raw.
	const onChangeSong = (next) => setAttributes({ song: next });

	// The accessible name announced on the preview's SVG `<title>`, derived from
	// the song's metadata only when it is conformant (mirrors the front end). A
	// non-conformant song renders no preview, so the name is unused then.
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
			) : (
				<div className="wp-block-piano-block-piano__visual">
					<div className="wp-block-piano-block-piano__editor">
						<SongEditor
							song={song}
							errors={errors}
							onChangeSong={onChangeSong}
							onEditAsJson={() => setMode("json")}
						/>
					</div>
					<SongPreview song={song} accessibleName={accessibleName} />
				</div>
			)}
		</div>
	);
}
