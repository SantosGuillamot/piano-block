/**
 * Unit tests for the shared list controls.
 *
 * These pin the disabled-edge and click contracts of the reusable per-row
 * control bank and the standalone add affordance. `ListControls` disables
 * move-up at the first row, move-down at the last row, and remove when the
 * caller forbids it; clicking any enabled control fires its handler exactly
 * once. `AddButton` renders an enabled labeled button that fires its handler on
 * click. The component is presentational, so the tests render it into jsdom and
 * assert on the produced `<button>` elements directly.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AddButton, ListControls } from "../ListControls.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render an element into a fresh detached container and return it. Rendering is
 * wrapped in `act` so effects and the initial commit flush synchronously.
 *
 * @param {Object} element The React element to render.
 * @return {HTMLElement} The container holding the rendered output.
 */
function renderToContainer(element) {
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() => {
		root.render(element);
	});
	return container;
}

/**
 * Look up a rendered button by its accessible name (the mock maps `label` to
 * `aria-label`).
 *
 * @param {HTMLElement} container The rendered container.
 * @param {string}      name      The accessible name to match.
 * @return {HTMLButtonElement|null} The matching button, or null.
 */
function buttonByName(container, name) {
	return [...container.querySelectorAll("button")].find(
		(button) => button.getAttribute("aria-label") === name,
	);
}

/** Click a DOM node inside an `act` so React flushes the handler. */
function click(node) {
	act(() => {
		node.click();
	});
}

describe("ListControls", () => {
	/**
	 * Render `ListControls` with sensible defaults, overridable per call. Returns
	 * the container plus the handler spies so tests can assert call counts.
	 *
	 * @param {Object} [overrides] Props to override on top of the defaults.
	 * @return {Object} The container and the three handler spies.
	 */
	function setup(overrides = {}) {
		const onMoveUp = jest.fn();
		const onMoveDown = jest.fn();
		const onRemove = jest.fn();
		const container = renderToContainer(
			createElement(ListControls, {
				index: 1,
				count: 3,
				onMoveUp,
				onMoveDown,
				onRemove,
				...overrides,
			}),
		);
		return { container, onMoveUp, onMoveDown, onRemove };
	}

	it("disables move-up on the first row", () => {
		const { container } = setup({ index: 0, count: 3 });
		expect(buttonByName(container, "Move up").disabled).toBe(true);
		expect(buttonByName(container, "Move down").disabled).toBe(false);
	});

	it("disables move-down on the last row", () => {
		const { container } = setup({ index: 2, count: 3 });
		expect(buttonByName(container, "Move down").disabled).toBe(true);
		expect(buttonByName(container, "Move up").disabled).toBe(false);
	});

	it("disables both move buttons for a single-row list", () => {
		const { container } = setup({ index: 0, count: 1 });
		expect(buttonByName(container, "Move up").disabled).toBe(true);
		expect(buttonByName(container, "Move down").disabled).toBe(true);
	});

	it("disables remove when canRemove is false", () => {
		const { container } = setup({ canRemove: false });
		expect(buttonByName(container, "Remove").disabled).toBe(true);
	});

	it("enables remove by default", () => {
		const { container } = setup();
		expect(buttonByName(container, "Remove").disabled).toBe(false);
	});

	it("calls each handler exactly once when its enabled button is clicked", () => {
		const { container, onMoveUp, onMoveDown, onRemove } = setup();
		click(buttonByName(container, "Move up"));
		click(buttonByName(container, "Move down"));
		click(buttonByName(container, "Remove"));
		expect(onMoveUp).toHaveBeenCalledTimes(1);
		expect(onMoveDown).toHaveBeenCalledTimes(1);
		expect(onRemove).toHaveBeenCalledTimes(1);
	});

	it("does not fire move-up when it is disabled on the first row", () => {
		const { container, onMoveUp } = setup({ index: 0, count: 3 });
		click(buttonByName(container, "Move up"));
		expect(onMoveUp).not.toHaveBeenCalled();
	});

	it("does not fire remove when canRemove is false", () => {
		const { container, onRemove } = setup({ canRemove: false });
		click(buttonByName(container, "Remove"));
		expect(onRemove).not.toHaveBeenCalled();
	});

	it("uses per-call accessible-label overrides", () => {
		const { container } = setup({
			moveUpLabel: "Move note earlier",
			moveDownLabel: "Move note later",
			removeLabel: "Remove note",
		});
		expect(buttonByName(container, "Move note earlier")).toBeTruthy();
		expect(buttonByName(container, "Move note later")).toBeTruthy();
		expect(buttonByName(container, "Remove note")).toBeTruthy();
	});
});

describe("AddButton", () => {
	it("renders an enabled button with its label as the accessible name", () => {
		const onClick = jest.fn();
		const container = renderToContainer(
			createElement(AddButton, { onClick, label: "Add note" }),
		);
		const button = buttonByName(container, "Add note");
		expect(button).toBeTruthy();
		expect(button.disabled).toBe(false);
	});

	it("calls its handler exactly once when clicked", () => {
		const onClick = jest.fn();
		const container = renderToContainer(
			createElement(AddButton, { onClick, label: "Add note" }),
		);
		click(buttonByName(container, "Add note"));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
