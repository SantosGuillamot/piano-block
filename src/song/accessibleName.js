/**
 * The accessible name for a song, computed from its `metadata`. Shared by the
 * front-end entry (`view.js`) and the editor (`edit.js` via `SongCanvas`), so
 * both surfaces announce the same name for the same song without duplicating the
 * derivation logic.
 */
import { __, _x, sprintf } from "@wordpress/i18n";

/** A string trimmed to its content, or `""` when the value is absent/non-string. */
function trimmedString(value) {
	return typeof value === "string" ? value.trim() : "";
}

/**
 * The accessible name for a song, computed from its `metadata`. A metadata
 * string counts only when non-empty after trim. The non-author strings are
 * i18n-wrapped (`@wordpress/i18n`); the title-only case is the author's own text,
 * so it is passed through verbatim with no wrapper.
 *
 * @param {{ title?: string, composer?: string }} [metadata] The song metadata.
 * @return {string} The single accessible name (set on the SVG `<title>`).
 */
export function accessibleNameFor(metadata) {
	const title = trimmedString(metadata?.title);
	const composer = trimmedString(metadata?.composer);

	if (title && composer) {
		// translators: 1: song title, 2: composer name.
		return sprintf(
			_x("%1$s by %2$s", "sheet music label", "piano-block"),
			title,
			composer,
		);
	}
	if (title) {
		// The author's own title — no wrapper.
		return title;
	}
	if (composer) {
		// translators: %s: composer name.
		return sprintf(
			_x("Piano sheet music by %s", "sheet music label", "piano-block"),
			composer,
		);
	}
	return __("Piano sheet music", "piano-block");
}
