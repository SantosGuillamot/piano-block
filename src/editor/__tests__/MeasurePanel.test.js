/**
 * Unit tests for the selected-measure **Measure** inspector panel.
 *
 * `MeasurePanel` is a pure controlled component: it edits the resolved measure in
 * place and emits the next whole working `song` through `onChange`. These tests
 * pin two things at once — the exact emitted shape (the two barlines and the
 * standalone annotations appear only when set and drop when cleared) AND that
 * every emitted song is accepted by the real `validateSong`, the conformant-by-
 * construction guarantee the panel rests on. They also cover the structural
 * **Remove measure** button, which removes the measure from its section (leaving
 * a conformant empty `measures: []` when it was the last) and signals the parent
 * to clear the now-stale selection.
 *
 * The panel is presentational, so the tests render it into jsdom and drive the
 * mocked `@wordpress/components` controls directly — setting a `<select>` value
 * and dispatching a change, or clicking a `<button>` — all inside `act`. The
 * `ToolsPanel` mock renders its items' contents unconditionally, so the disclosed
 * (advanced) controls are present in the DOM without a reveal step.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { MeasurePanel } from "../inspector/MeasurePanel.js";
import { resolveSelection } from "../selection.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render an element into a fresh detached container and return both the
 * container and a `rerender` that re-renders the same root (so the test can feed
 * the just-emitted song back in, mirroring controlled-component usage).
 *
 * @param {Object} element The React element to render.
 * @return {{ container: HTMLElement, rerender: Function }} The render handle.
 */
function render(element) {
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() => {
		root.render(element);
	});
	return {
		container,
		rerender: (next) => {
			act(() => {
				root.render(next);
			});
		},
	};
}

/** Look up an input/select by its accessible name (mapped to `aria-label`). */
function fieldByName(container, name) {
	return container.querySelector(`[aria-label="${name}"]`);
}

/** Find a button by its visible text or accessible name. */
function buttonByText(container, text) {
	return Array.from(container.querySelectorAll("button")).find(
		(button) =>
			button.textContent === text || button.getAttribute("aria-label") === text,
	);
}

/**
 * Set a controlled field's value and dispatch a change event inside `act`. The
 * value is set through the native prototype setter React's tracker observes, so
 * the synthetic `onChange` fires — the standard jsdom recipe for a controlled
 * input.
 */
function change(node, value) {
	const prototype =
		node.tagName === "SELECT"
			? window.HTMLSelectElement.prototype
			: window.HTMLInputElement.prototype;
	const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
	act(() => {
		setter.call(node, value);
		node.dispatchEvent(new window.Event("input", { bubbles: true }));
		node.dispatchEvent(new window.Event("change", { bubbles: true }));
	});
}

/** Click a node inside `act`. */
function click(node) {
	act(() => {
		node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
}

/**
 * The default fixture: a two-section song. Section 0 has two measures; the
 * selection points at section 0, measure 0, which carries a single right-hand
 * note so a removed measure leaves a conformant remainder.
 */
function fixtureSong() {
	return {
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "C", octave: 4 }],
							},
						],
					},
					{
						rightHand: [{ type: "rest", duration: "quarter" }],
					},
				],
			},
			{
				measures: [{ rightHand: [{ type: "rest", duration: "whole" }] }],
			},
		],
	};
}

/**
 * Render a `MeasurePanel` over a selection that feeds its own emitted song back
 * in (so it behaves like a controlled control across edits), re-resolving the
 * selection against each emission and recording every one.
 *
 * @param {Object} [options]
 * @param {Object} [options.song]      The starting working song.
 * @param {Object} [options.selection] The raw selection coordinates.
 * @return {{ container: HTMLElement, calls: Object[], removed: Object,
 *   removeMeasure: Object }} Handle.
 */
function renderPanel({
	song: initialSong = fixtureSong(),
	selection = {
		sectionIndex: 0,
		measureIndex: 0,
		hand: "rightHand",
		eventIndex: 0,
	},
} = {}) {
	const calls = [];
	const removed = { count: 0 };
	// The remove-measure mutator is now lifted to `edit.js`; the panel only signals
	// intent through this prop. Record each invocation for the assertions.
	const removeMeasure = { count: 0, args: null };
	let song = initialSong;
	let handle;
	const props = () => ({
		song,
		selection: resolveSelection(song, selection),
		onChange,
		onRemove: () => {
			removed.count += 1;
		},
		onRemoveMeasure: (sectionIndex, measureIndex) => {
			removeMeasure.count += 1;
			removeMeasure.args = [sectionIndex, measureIndex];
		},
	});
	function onChange(next) {
		song = next;
		calls.push(next);
		// A removal can leave the selection stale; only re-render the panel while
		// the selection still resolves (the parent would unmount it otherwise).
		if (resolveSelection(song, selection)) {
			handle.rerender(createElement(MeasurePanel, props()));
		}
	}
	handle = render(createElement(MeasurePanel, props()));
	return { container: handle.container, calls, removed, removeMeasure };
}

/** Assert the real validator accepts the emitted working song. */
function expectConformant(song) {
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("MeasurePanel — name (omit-when-blank)", () => {
	it("sets the measure name when typed and the song validates", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Measure name"), "Pickup");
		expect(calls.at(-1).sections[0].measures[0].name).toBe("Pickup");
		// The name lands only on the selected measure, not its sibling.
		expect(calls.at(-1).sections[0].measures[1].name).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("drops the name key when cleared (no empty husk)", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Measure name"), "Pickup");
		expect(calls.at(-1).sections[0].measures[0].name).toBe("Pickup");

		change(fieldByName(container, "Measure name"), "");
		expect(calls.at(-1).sections[0].measures[0]).not.toHaveProperty("name");
		expectConformant(calls.at(-1));
	});

	it("shows the current name value", () => {
		const song = fixtureSong();
		song.sections[0].measures[0].name = "Chorus";
		const { container } = renderPanel({ song });
		expect(fieldByName(container, "Measure name").value).toBe("Chorus");
	});
});

describe("MeasurePanel — barlines (omit-when-unset)", () => {
	it("adds the end barline when set and the song validates", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "End barline"), "final");
		expect(calls.at(-1).sections[0].measures[0].barlineEnd).toBe("final");
		expectConformant(calls.at(-1));
	});

	it("drops the end barline key when cleared", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "End barline"), "final");
		expect(calls.at(-1).sections[0].measures[0].barlineEnd).toBe("final");

		change(fieldByName(container, "End barline"), "");
		expect(calls.at(-1).sections[0].measures[0].barlineEnd).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("adds the start barline independently of the end barline", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Start barline"), "repeat-start");
		expect(calls.at(-1).sections[0].measures[0].barlineStart).toBe(
			"repeat-start",
		);
		expect(calls.at(-1).sections[0].measures[0].barlineEnd).toBeUndefined();
		expectConformant(calls.at(-1));
	});
});

describe("MeasurePanel — standalone annotations", () => {
	it("hosts the standalone annotations list under the advanced disclosure", () => {
		const { container, calls } = renderPanel();
		click(buttonByText(container, "Add annotation"));
		const measure = calls.at(-1).sections[0].measures[0];
		expect(measure.annotations).toHaveLength(1);
		expectConformant(calls.at(-1));
	});
});

describe("MeasurePanel — remove measure", () => {
	it("calls the lifted onRemoveMeasure handler with the selected coords (no local mutation)", () => {
		const { container, removeMeasure, calls } = renderPanel();
		click(buttonByText(container, "Remove measure"));
		expect(removeMeasure.count).toBe(1);
		// The panel passes its resolved section/measure coords to the lifted handler.
		expect(removeMeasure.args).toEqual([0, 0]);
		// No local emission — the lifted handler commits and re-targets the selection.
		expect(calls).toHaveLength(0);
	});

	it("passes a later section/measure's coords through to onRemoveMeasure", () => {
		const { container, removeMeasure } = renderPanel({
			selection: {
				sectionIndex: 1,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 0,
			},
		});
		click(buttonByText(container, "Remove measure"));
		expect(removeMeasure.args).toEqual([1, 0]);
	});
});
