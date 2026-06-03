import { useBlockProps } from "@wordpress/block-editor";
import { Notice, TextareaControl } from "@wordpress/components";
import { useMemo } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import validateSong from "./song/validate";

/**
 * Editor representation of the Piano block.
 *
 * Renders the block's only authoring affordance: a raw-JSON `song` field on the
 * block canvas (design §6.3). The author edits the song document as text; the
 * raw string persists unconditionally on every change (design §6.1, AC6) — even
 * when it is invalid JSON or non-conformant. Validation is a pure, presentational
 * side-computation that surfaces a non-blocking error notice; it NEVER blocks
 * saving, clears the field, or substitutes a parsed value (requirement 9, AC6).
 *
 * @param {Object}   props               Block edit props.
 * @param {Object}   props.attributes    The block's attributes.
 * @param {string}   props.attributes.song The raw song JSON string.
 * @param {Function} props.setAttributes  Updates the block's attributes.
 * @return {Element} The block's editor markup.
 */
export default function Edit({ attributes, setAttributes }) {
	const { song } = attributes;

	// Pure, presentational validation: re-run only when the text changes. The
	// empty string is the "no song" state and is never validated (design §6.2).
	const errors = useMemo(
		() => (song.trim() === "" ? [] : validateSong(song)),
		[song],
	);

	return (
		<div {...useBlockProps()}>
			<TextareaControl
				label={__("Song (JSON)", "piano-block")}
				help={__(
					"The raw song document as JSON. Validation is informational and never blocks saving.",
					"piano-block",
				)}
				value={song}
				onChange={(next) => setAttributes({ song: next })}
				rows={12}
				className="wp-block-piano-block-piano__song-input"
			/>
			{errors.length > 0 && (
				<Notice status="error" isDismissible={false}>
					{errors[0]}
				</Notice>
			)}
		</div>
	);
}
