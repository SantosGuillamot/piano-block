/**
 * The leaf editor for a song's optional `metadata` block — its `title` and
 * `composer`.
 *
 * Both fields are free text and both are optional. The control keeps the
 * round-trip clean by treating an empty field as "absent": it emits a metadata
 * object that carries only the non-empty fields, so clearing a field drops its
 * key entirely rather than persisting an empty string. The parent owns the
 * metadata state and re-feeds the emitted value; this component holds none.
 */
import { TextControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

/**
 * Build the next metadata object from the current one plus a single field edit,
 * dropping any key whose value is empty so an emptied field clears its key.
 *
 * @param {Object} metadata The current metadata object.
 * @param {string} key      The field being edited (`title` or `composer`).
 * @param {string} value    The field's new value.
 * @return {Object} The next metadata object with only non-empty fields set.
 */
function withField(metadata, key, value) {
	const next = { ...metadata };
	if (value) {
		next[key] = value;
	} else {
		delete next[key];
	}
	return next;
}

/**
 * Edit a song's `metadata` (title and composer).
 *
 * @param {Object}   props
 * @param {Object}   [props.metadata={}] The current metadata object.
 * @param {Function} props.onChange      Receives the next metadata object.
 * @return {Object} The rendered metadata editor.
 */
export function MetadataEditor({ metadata = {}, onChange }) {
	return (
		<>
			<TextControl
				label={__("Title", "piano-block")}
				value={metadata.title ?? ""}
				onChange={(value) => onChange(withField(metadata, "title", value))}
				__nextHasNoMarginBottom
			/>
			<TextControl
				label={__("Composer", "piano-block")}
				value={metadata.composer ?? ""}
				onChange={(value) => onChange(withField(metadata, "composer", value))}
				__nextHasNoMarginBottom
			/>
		</>
	);
}
