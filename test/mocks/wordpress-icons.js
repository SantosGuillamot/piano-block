/**
 * Unit-test mock for `@wordpress/icons`.
 *
 * `@wordpress/icons` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. The real package exports icon
 * components/SVG objects; each icon-bearing component passes them to
 * `<Icon icon={...}>` / `<Button icon={...}>` / `<DropdownMenu icon={...}>`.
 * Each export here is an inert React element (an `<svg>` with a distinguishable
 * `data-wp-icon` attribute) built with `@wordpress/element`'s `createElement`.
 * Because the components mock renders element icons through `Icon` (which
 * `cloneElement`s a valid element) and renders nothing for a non-element, a
 * string icon prop produces no marked node — which is exactly what the
 * project-wide string-icon guard tests for.
 */
const { createElement } = require("@wordpress/element");

const moreVertical = createElement("svg", { "data-wp-icon": "moreVertical" });
const chevronRightSmall = createElement("svg", {
	"data-wp-icon": "chevronRightSmall",
});
const chevronDownSmall = createElement("svg", {
	"data-wp-icon": "chevronDownSmall",
});
const chevronLeftSmall = createElement("svg", {
	"data-wp-icon": "chevronLeftSmall",
});
const plus = createElement("svg", { "data-wp-icon": "plus" });
const trash = createElement("svg", { "data-wp-icon": "trash" });

module.exports = {
	moreVertical,
	chevronRightSmall,
	chevronDownSmall,
	chevronLeftSmall,
	plus,
	trash,
};
