/**
 * Unit-test mock for `@wordpress/icons`.
 *
 * `@wordpress/icons` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. The real package exports icon
 * components/SVG objects; the structure tree only passes them straight through
 * to `<Icon icon={...}>` / `<DropdownMenu icon={...}>`, both of which swallow
 * the `icon` prop in the components mock — so any inert value works as a
 * sentinel. Each export is a trivial string so the import resolves and the value
 * passes through harmlessly; the tests never inspect the glyph itself.
 */
const moreVertical = "moreVertical";
const chevronRightSmall = "chevronRightSmall";
const chevronDownSmall = "chevronDownSmall";
const chevronLeftSmall = "chevronLeftSmall";
const plus = "plus";

module.exports = {
	moreVertical,
	chevronRightSmall,
	chevronDownSmall,
	chevronLeftSmall,
	plus,
};
