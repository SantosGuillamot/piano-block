/**
 * Unit-test mock for `@wordpress/components`.
 *
 * `@wordpress/components` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. The editor's presentational components
 * only need `Button` under test; this mock renders a real DOM `<button>` that
 * honors the props the components rely on — `onClick`, `disabled`, the
 * `label`/`aria-label` accessible name, and `children` text — so jsdom tests can
 * assert disabled state and click behavior without the full component library.
 */
const { createElement } = require("@wordpress/element");

/**
 * Minimal `Button` stand-in. `icon`/`variant` are accepted and ignored (they
 * carry no behavior the tests assert); the accessible name comes from `label`
 * (mapped to `aria-label`) or, failing that, the button's text children.
 *
 * @param {Object} props Button props.
 * @return {Object} A React `<button>` element.
 */
const Button = ({
	onClick,
	disabled,
	label,
	"aria-label": ariaLabel,
	children,
	// Swallow props that have no DOM meaning in the mock.
	icon: _icon,
	variant: _variant,
	...rest
}) =>
	createElement(
		"button",
		{
			type: "button",
			onClick,
			disabled,
			"aria-label": ariaLabel ?? label,
			...rest,
		},
		children,
	);

module.exports = { Button };
