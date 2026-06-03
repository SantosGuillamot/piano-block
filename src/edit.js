import { useBlockProps } from "@wordpress/block-editor";
import { __ } from "@wordpress/i18n";

/**
 * Editor representation of the Piano block.
 *
 * Renders a static placeholder paragraph — a scaffold for the future
 * interactive piano. No attributes, controls, or save (dynamic block).
 *
 * @return {Element} The block's editor markup.
 */
export default function Edit() {
	return (
		<p {...useBlockProps()}>
			{__("Piano block — editor placeholder", "piano-block")}
		</p>
	);
}
