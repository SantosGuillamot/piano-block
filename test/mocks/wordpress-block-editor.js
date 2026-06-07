/**
 * Unit-test mock for `@wordpress/block-editor`.
 *
 * `@wordpress/block-editor` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. The mode container (`edit.js`) wraps the
 * block in `useBlockProps()` and exposes a toolbar mode switch via
 * `BlockControls`; the tests need both rendered into jsdom so they can assert on
 * the produced DOM. The mocks are deliberately generic so they carry no behavior
 * beyond passing props/children through.
 */
const { createElement } = require("@wordpress/element");

/**
 * Minimal `useBlockProps` stand-in. The real hook returns the wrapper props
 * (className, ref, etc.); here it just echoes back whatever props it is given (or
 * an empty object), so the wrapper element still receives its own props
 * (className) and spreads cleanly.
 *
 * @param {Object} [props] The caller's wrapper props.
 * @return {Object} The same props (or `{}`).
 */
const useBlockProps = (props = {}) => props;

/**
 * Minimal `BlockControls` stand-in. The real component portals its children into
 * the block toolbar; here it renders them inline inside a marked container so the
 * toolbar's controls are present in the DOM under test.
 *
 * @param {Object} props          BlockControls props.
 * @param {Object} props.children The toolbar controls.
 * @return {Object} A React element wrapping the children.
 */
const BlockControls = ({ children }) =>
	createElement("div", { "data-block-controls": true }, children);

module.exports = { useBlockProps, BlockControls };
