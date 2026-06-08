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
 *
 * The canvas-first inspector panels add a few container/control mocks
 * (`PanelBody`, `ToggleControl`, `ToolsPanel`/`ToolsPanelItem`, `Icon`). The two
 * `ToolsPanel*` stand-ins render their children UNCONDITIONALLY — the real
 * components hide an optional control until it is revealed, but the unit tests
 * only assert that each advanced control exists and is wired, leaving the
 * reveal/hide behavior to the e2e suite.
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

/**
 * Minimal `ToolbarGroup` stand-in. The real component groups toolbar buttons;
 * here it just renders its children so the buttons are present in the DOM.
 *
 * @param {Object} props          ToolbarGroup props.
 * @param {Object} props.children The grouped controls.
 * @return {Object} A React element wrapping the children.
 */
const ToolbarGroup = ({ children }) => createElement("div", null, children);

/**
 * Minimal `ToolbarButton` stand-in. Renders a real `<button>`; the accessible
 * name comes from `label` (mapped to `aria-label`) or the button's text
 * children, mirroring the `Button` mock. `isActive`/`icon` are accepted and
 * ignored (they carry no behavior the tests assert).
 *
 * @param {Object} props ToolbarButton props.
 * @return {Object} A React `<button>` element.
 */
const ToolbarButton = ({
	onClick,
	disabled,
	label,
	"aria-label": ariaLabel,
	children,
	// Swallow props with no DOM meaning in the mock.
	icon: _icon,
	isActive: _isActive,
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
 * Minimal `PanelBody` stand-in. The real component is a collapsible sidebar
 * panel; here it renders a `<section>` whose accessible name is the panel
 * `title` (so tests can locate a panel by title) with its `children` inside.
 * `initialOpen` is accepted and ignored — the panel's contents are always in the
 * DOM under test.
 *
 * @param {Object} props PanelBody props.
 * @return {Object} A React `<section>` element.
 */
const PanelBody = ({
	title,
	children,
	// Swallow props with no behavior the tests assert.
	initialOpen: _initialOpen,
	...rest
}) => createElement("section", { "aria-label": title, ...rest }, children);

/**
 * Minimal `ToggleControl` stand-in. Renders a real `<input type="checkbox">`
 * honoring `checked`/`label`; `onChange` receives the next boolean
 * (`event.target.checked`), mirroring the real control.
 *
 * @param {Object} props ToggleControl props.
 * @return {Object} A React `<input>` element.
 */
const ToggleControl = ({
	label,
	checked,
	onChange,
	__nextHasNoMarginBottom: _margin,
	...rest
}) =>
	createElement("input", {
		type: "checkbox",
		"aria-label": label,
		checked: Boolean(checked),
		onChange: (event) => onChange?.(event.target.checked),
		...rest,
	});

/**
 * Minimal `__experimentalToolsPanel` (ToolsPanel) stand-in. The real component
 * groups optional controls behind progressive disclosure; here it renders a
 * container exposing its `label` (as `aria-label`) and its `children`
 * UNCONDITIONALLY, so a panel's advanced controls are present in the DOM for
 * assertions (the reveal/hide behavior is left to the e2e suite). `resetAll` is
 * accepted and ignored.
 *
 * @param {Object} props ToolsPanel props.
 * @return {Object} A React element wrapping the children.
 */
const ToolsPanel = ({
	label,
	children,
	// Swallow props with no behavior the tests assert.
	resetAll: _resetAll,
	...rest
}) => createElement("div", { "aria-label": label, ...rest }, children);

/**
 * Minimal `__experimentalToolsPanelItem` (ToolsPanelItem) stand-in. The real
 * component shows its control only once revealed; here it renders its `children`
 * UNCONDITIONALLY so the wrapped control is present in the DOM under test.
 * `hasValue`/`label`/`onDeselect`/`isShownByDefault` are accepted and ignored.
 *
 * @param {Object} props ToolsPanelItem props.
 * @return {Object} A React element wrapping the children.
 */
const ToolsPanelItem = ({
	children,
	// Swallow props with no behavior the tests assert.
	hasValue: _hasValue,
	label: _label,
	onDeselect: _onDeselect,
	isShownByDefault: _isShownByDefault,
	...rest
}) => createElement("div", { ...rest }, children);

/**
 * Minimal `Icon` stand-in. The real component renders an SVG glyph; here it
 * renders an inert marker carrying no behavior the tests assert. `icon`/`size`
 * are accepted and ignored.
 *
 * @param {Object} props Icon props.
 * @return {Object} A React `<span>` element.
 */
const Icon = ({ icon: _icon, size: _size, ...rest }) =>
	createElement("span", { "data-icon": true, ...rest });

module.exports = {
	Button,
	SelectControl,
	NumberControl,
	TextControl,
	TextareaControl,
	Notice,
	ToolbarGroup,
	ToolbarButton,
	PanelBody,
	ToggleControl,
	Icon,
	__experimentalNumberControl: NumberControl,
	__experimentalToolsPanel: ToolsPanel,
	__experimentalToolsPanelItem: ToolsPanelItem,
};
