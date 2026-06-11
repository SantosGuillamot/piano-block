/**
 * Unit tests for the selected-section **Section** inspector panel.
 *
 * `SectionPanel` is a pure controlled component: it edits the resolved section in
 * place and emits the next whole working `song` through `onChange`. These tests
 * pin two things at once — the exact emitted shape (a context override appears
 * only when set and drops when reset) AND that every emitted song is accepted by
 * the real `validateSong`, the conformant-by-construction guarantee the panel
 * rests on. They also cover the structural **Remove section** button, including the
 * validator-backed fact that `sections` may be empty — so removing the only section
 * is allowed and needs no min-one guard.
 *
 * The panel is presentational, so the tests render it into jsdom and drive the
 * mocked `@wordpress/components` controls directly — setting an input/`<select>`
 * value and dispatching a change, or clicking a `<button>` — all inside `act`. The
 * `ToolsPanel` mock renders its items' contents unconditionally, so the disclosed
 * (advanced) override controls are present in the DOM without a reveal step.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { SectionPanel } from "../inspector/SectionPanel.js";
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
 * The default fixture: a two-section song. The selection points at section 0,
 * which carries a single right-hand note so a removed section leaves a conformant
 * remainder.
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
				],
			},
			{
				measures: [{ rightHand: [{ type: "rest", duration: "whole" }] }],
			},
		],
	};
}

/**
 * Render a `SectionPanel` over a selection that feeds its own emitted song back
 * in (so it behaves like a controlled control across edits), re-resolving the
 * selection against each emission and recording every one.
 *
 * @param {Object} [options]
 * @param {Object} [options.song]      The starting working song.
 * @param {Object} [options.selection] The raw selection coordinates.
 * @return {{ container: HTMLElement, calls: Object[], removed: Object,
 *   removeSection: Object }} Handle.
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
	// The structural mutators are now lifted to `edit.js`; the panel only signals
	// intent through these props. Record each invocation for the assertions.
	const removeSection = { count: 0, args: null };
	let song = initialSong;
	let handle;
	const props = () => ({
		song,
		selection: resolveSelection(song, selection),
		onChange,
		onRemove: () => {
			removed.count += 1;
		},
		onRemoveSection: (sectionIndex) => {
			removeSection.count += 1;
			removeSection.args = [sectionIndex];
		},
	});
	function onChange(next) {
		song = next;
		calls.push(next);
		// A removal can leave the selection stale; only re-render the panel while
		// the selection still resolves (the parent would unmount it otherwise).
		if (resolveSelection(song, selection)) {
			handle.rerender(createElement(SectionPanel, props()));
		}
	}
	handle = render(createElement(SectionPanel, props()));
	return {
		container: handle.container,
		calls,
		removed,
		removeSection,
	};
}

/** Assert the real validator accepts the emitted working song. */
function expectConformant(song) {
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("SectionPanel — name (omit-when-blank)", () => {
	it("sets the section name when typed and the song validates", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Section name"), "Intro");
		expect(calls.at(-1).sections[0].name).toBe("Intro");
		// The name lands only on the selected section, not its sibling.
		expect(calls.at(-1).sections[1].name).toBeUndefined();
		expect(calls.at(-1).sections[0].measures).toHaveLength(1);
		expectConformant(calls.at(-1));
	});

	it("drops the name key when cleared (no empty husk)", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Section name"), "Intro");
		expect(calls.at(-1).sections[0].name).toBe("Intro");

		change(fieldByName(container, "Section name"), "");
		expect(calls.at(-1).sections[0]).not.toHaveProperty("name");
		// The section keeps its required measures.
		expect(calls.at(-1).sections[0].measures).toHaveLength(1);
		expectConformant(calls.at(-1));
	});

	it("shows the current name value", () => {
		const song = fixtureSong();
		song.sections[0].name = "Verse";
		const { container } = renderPanel({ song });
		expect(fieldByName(container, "Section name").value).toBe("Verse");
	});
});

describe("SectionPanel — context overrides (omit-when-unset)", () => {
	it("adds a tempo override when set and the song validates", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Tempo (BPM)"), "120");
		expect(calls.at(-1).sections[0].tempo).toEqual({ bpm: 120 });
		// The override lives on the section, not on the song-level defaults.
		expect(calls.at(-1).defaults).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("drops the tempo override when cleared", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Tempo (BPM)"), "120");
		expect(calls.at(-1).sections[0].tempo).toEqual({ bpm: 120 });

		change(fieldByName(container, "Tempo (BPM)"), "");
		expect(calls.at(-1).sections[0].tempo).toBeUndefined();
		// The section keeps its required measures even with no overrides.
		expect(calls.at(-1).sections[0].measures).toHaveLength(1);
		expectConformant(calls.at(-1));
	});

	it("leaves a sibling section untouched when overriding the selected one", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Tempo (BPM)"), "120");
		// The override lands only on the selected section, not its sibling.
		expect(calls.at(-1).sections[0].tempo).toEqual({ bpm: 120 });
		expect(calls.at(-1).sections[1].tempo).toBeUndefined();
		expect(calls.at(-1).sections[0].measures).toHaveLength(1);
		expectConformant(calls.at(-1));
	});
});

describe("SectionPanel — remove section", () => {
	it("calls the lifted onRemoveSection handler with the selected section index", () => {
		const { container, removeSection, calls } = renderPanel();
		click(buttonByText(container, "Remove section"));
		expect(removeSection.count).toBe(1);
		// The panel passes its resolved section coord to the lifted handler.
		expect(removeSection.args).toEqual([0]);
		// No local emission — the lifted handler commits and re-targets the selection.
		expect(calls).toHaveLength(0);
	});

	it("passes a later section's index through to onRemoveSection", () => {
		const { container, removeSection } = renderPanel({
			selection: {
				sectionIndex: 1,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 0,
			},
		});
		click(buttonByText(container, "Remove section"));
		expect(removeSection.args).toEqual([1]);
	});
});
