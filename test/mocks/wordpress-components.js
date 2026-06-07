/**
 * Unit-test mock for `@wordpress/components`.
 *
 * `@wordpress/components` is externalized by the build and absent from
 * `node_modules`, so Jest maps it here. The editor's presentational components
 * need a handful of controls under test; this mock renders real DOM elements
 * that honor the props the components rely on — so jsdom tests can assert
 * offered values, ranges, disabled state and change behavior without the full
 * component library. The mocks are deliberately generic so every editor task
 * reuses them.
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

/**
 * Minimal `SelectControl` stand-in. Renders a real `<select>` whose `<option>`s
 * come from the `options` prop (`{ label, value }`), so tests can assert exactly
 * which values are offered. `value` is coerced to a string for the DOM and the
 * matching option's original-typed value is passed back through `onChange` (the
 * real control's `value` may be a number — e.g. `beatType` — but the DOM only
 * speaks strings).
 *
 * @param {Object} props SelectControl props.
 * @return {Object} A React `<select>` element.
 */
const SelectControl = ({
	label,
	value,
	options = [],
	onChange,
	// Swallow props with no behavior the tests assert.
	__nextHasNoMarginBottom: _margin,
	...rest
}) =>
	createElement(
		"select",
		{
			"aria-label": label,
			value: value === undefined || value === null ? "" : String(value),
			onChange: (event) => {
				if (!onChange) {
					return;
				}
				const selected = options.find(
					(option) => String(option.value) === event.target.value,
				);
				onChange(selected ? selected.value : event.target.value);
			},
			...rest,
		},
		options.map((option) =>
			createElement(
				"option",
				{ key: String(option.value), value: String(option.value) },
				option.label,
			),
		),
	);

/**
 * Minimal `__experimentalNumberControl` stand-in. Renders an
 * `<input type="number">` honoring `min`/`max`/`step`/`value`; `onChange`
 * receives the raw string value (mirroring the real control, which yields the
 * field text — empty string when cleared).
 *
 * @param {Object} props NumberControl props.
 * @return {Object} A React `<input>` element.
 */
const NumberControl = ({
	label,
	value,
	min,
	max,
	step,
	onChange,
	__nextHasNoMarginBottom: _margin,
	...rest
}) =>
	createElement("input", {
		type: "number",
		"aria-label": label,
		value: value === undefined || value === null ? "" : String(value),
		min,
		max,
		step,
		onChange: (event) => onChange?.(event.target.value),
		...rest,
	});

/**
 * Minimal `TextControl` stand-in. Renders an `<input type="text">`; `onChange`
 * receives the field's string value.
 *
 * @param {Object} props TextControl props.
 * @return {Object} A React `<input>` element.
 */
const TextControl = ({
	label,
	value,
	onChange,
	__nextHasNoMarginBottom: _margin,
	...rest
}) =>
	createElement("input", {
		type: "text",
		"aria-label": label,
		value: value === undefined || value === null ? "" : String(value),
		onChange: (event) => onChange?.(event.target.value),
		...rest,
	});

/**
 * Minimal `TextareaControl` stand-in. Renders a real `<textarea>`; `onChange`
 * receives the field's string value, mirroring the real control.
 *
 * @param {Object} props TextareaControl props.
 * @return {Object} A React `<textarea>` element.
 */
const TextareaControl = ({
	label,
	value,
	onChange,
	__nextHasNoMarginBottom: _margin,
	...rest
}) =>
	createElement("textarea", {
		"aria-label": label,
		value: value === undefined || value === null ? "" : String(value),
		onChange: (event) => onChange?.(event.target.value),
		...rest,
	});

/**
 * Minimal `Notice` stand-in. Renders its children inside a `role="alert"`
 * element tagged with `data-status`, so tests can find the notice and assert its
 * status without the full component library. `isDismissible` is accepted and
 * ignored (it carries no behavior the tests assert).
 *
 * @param {Object} props Notice props.
 * @return {Object} A React `<div role="alert">` element.
 */
const Notice = ({
	status,
	children,
	// Swallow props with no behavior the tests assert.
	isDismissible: _isDismissible,
	...rest
}) =>
	createElement(
		"div",
		{ role: "alert", "data-status": status, ...rest },
		children,
	);

module.exports = {
	Button,
	SelectControl,
	NumberControl,
	TextControl,
	TextareaControl,
	Notice,
	__experimentalNumberControl: NumberControl,
};
