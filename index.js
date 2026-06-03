const { registerBlockType } = wp.blocks;
const { createElement } = wp.element;
const { useBlockProps } = wp.blockEditor;
const { __ } = wp.i18n;

registerBlockType("piano-block/piano", {
	edit() {
		return createElement(
			"p",
			useBlockProps(),
			__("Piano block — editor placeholder", "piano-block"),
		);
	},
});
