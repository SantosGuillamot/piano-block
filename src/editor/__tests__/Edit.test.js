/**
 * Unit tests for the block's edit container — the thin mode container that
 * switches between the canvas-first visual editor (default) and the raw-JSON
 * field.
 *
 * `Edit` owns two pieces of editor-only UI state, the `mode` (`"visual"` |
 * `"json"`) and the canvas `selection`, computes the memoized
 * `errors = validateSong(song)` once (empty string → `[]`), and renders one of
 * three surfaces. These tests pin that:
 *   - the default surface is the visual editor: the interactive `SongCanvas`
 *     (its rendered `<svg>`) plus the always-present `SongPanel` inside the
 *     `InspectorControls` sidebar, with the "Song (JSON)" textarea NOT in the
 *     DOM;
 *   - an empty song is seeded editor-side: the canvas mounts an empty grand-staff
 *     `<svg>` (no EmptyState button) while the persisted attribute stays `""`
 *     until a first edit;
 *   - with nothing selected the sidebar shows only the Song panel — no
 *     Note/Measure/Section panels;
 *   - a non-empty *invalid* song routes to the invalid state ("Edit as JSON"),
 *     not the canvas;
 *   - toggling to JSON mode shows the raw-JSON textarea with its exact label and,
 *     for a non-conformant song, the non-blocking error notice carrying the
 *     validator's first message;
 *   - editing the textarea persists the raw text verbatim through
 *     `setAttributes({ song })` — even when it is invalid — preserving today's
 *     "store unconditionally, validation never blocks saving" behavior.
 *
 * The component is a presentational React component, so the tests render it into
 * jsdom (no `@testing-library/react`) and drive the mocked controls directly —
 * clicking the toolbar toggle, or setting a textarea value and dispatching a
 * change event — all inside `act` so React flushes synchronously. The mocked
 * `@wordpress/block-editor` renders `useBlockProps`/`BlockControls`/
 * `InspectorControls` inline (the last into a `data-inspector-controls` marker).
 */
import { createElement, useState } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Edit from "../../edit.js";
import validateSong from "../../song/validate.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A small but conformant song: one note, with metadata. */
const SONG = JSON.stringify({
	metadata: { title: "Hello", composer: "Ada" },
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "C", octave: 5 }],
						},
					],
				},
			],
		},
	],
});

/** Valid JSON but structurally non-conformant (no `sections`). */
const INVALID_SONG = '{"foo":"bar"}';

/**
 * Render an element into a fresh detached container and return both the
 * container and a `rerender` that re-renders the same root.
 *
 * @param {Object} element The React element to render.
 * @return {{ container: HTMLElement, rerender: Function }} The render handle.
 */
function render(element) {
	const container = document.createElement("div");
	document.body.appendChild(container);
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

/** Look up an input/select/textarea by its accessible name (`aria-label`). */
function fieldByName(container, name) {
	return container.querySelector(`[aria-label="${name}"]`);
}

/** Look up a button by its visible text content. */
function buttonByText(container, text) {
	return [...container.querySelectorAll("button")].find(
		(button) => button.textContent === text,
	);
}

/** The mocked `InspectorControls` sidebar region (the panels' host), or null. */
function inspector(container) {
	return container.querySelector("[data-inspector-controls]");
}

/** A rendered inspector `PanelBody` by its title (the mock's `aria-label`). */
function panelByTitle(container, title) {
	return container.querySelector(`[aria-label="${title}"]`);
}

/** Click a node inside `act` so React flushes the handler. */
function click(node) {
	act(() => {
		node.click();
	});
}

/**
 * Set a controlled field's value and dispatch a change event inside `act`.
 *
 * React tracks a controlled field's value through its own value setter, so a
 * plain `node.value = …` is invisible to it. We set the value through the native
 * prototype setter (which React's tracker observes) before dispatching, so the
 * synthetic `onChange` fires with the new value.
 */
function change(node, value) {
	const setter = Object.getOwnPropertyDescriptor(
		window.HTMLTextAreaElement.prototype,
		"value",
	).set;
	act(() => {
		setter.call(node, value);
		node.dispatchEvent(new window.Event("input", { bubbles: true }));
		node.dispatchEvent(new window.Event("change", { bubbles: true }));
	});
}

/**
 * Render `Edit` with its own `song` attribute state, so `setAttributes({ song })`
 * persists and re-renders as the real editor does. Records every persisted song.
 *
 * @param {string} initial The starting raw `song` string.
 * @return {{ container: HTMLElement, calls: string[] }} The render handle.
 */
function renderEdit(initial) {
	const calls = [];
	function Host() {
		const [song, setSong] = useState(initial);
		return createElement(Edit, {
			attributes: { song },
			setAttributes: (next) => {
				calls.push(next.song);
				setSong(next.song);
			},
		});
	}
	const { container } = render(createElement(Host));
	return { container, calls };
}

describe("Edit mode container", () => {
	it("defaults to visual mode: the canvas and the Song panel are present, the JSON textarea is not", () => {
		const { container } = renderEdit(SONG);
		// The visual editor renders the interactive canvas (its rendered <svg>) and
		// the always-present Song panel inside the InspectorControls sidebar.
		expect(container.querySelector("svg")).not.toBeNull();
		expect(inspector(container)).not.toBeNull();
		expect(panelByTitle(container, "Song")).not.toBeNull();
		// The raw-JSON textarea is absent in visual mode.
		expect(fieldByName(container, "Song (JSON)")).toBeNull();
	});

	it("seeds an empty song editor-side: the canvas mounts but the attribute stays empty", () => {
		const { container, calls } = renderEdit("");
		// No raw-JSON textarea, no EmptyState button — the empty song is seeded with
		// newSong() so the canvas mounts an empty grand-staff <svg> ready for notes.
		expect(fieldByName(container, "Song (JSON)")).toBeNull();
		expect(buttonByText(container, "Start a new song")).toBeUndefined();
		expect(container.querySelector("svg")).not.toBeNull();
		// The seed is lazy: nothing is persisted until a first edit.
		expect(calls).toHaveLength(0);
		// Switching to JSON mode shows an empty textarea (the attribute is still "").
		click(buttonByText(container, "Edit as JSON"));
		expect(fieldByName(container, "Song (JSON)").value).toBe("");
	});

	it("shows only the Song panel when nothing is selected", () => {
		const { container } = renderEdit(SONG);
		// With no canvas selection, the sidebar holds the always-present Song panel
		// and none of the selection-dependent Note/Measure/Section panels.
		expect(panelByTitle(container, "Song")).not.toBeNull();
		expect(panelByTitle(container, "Note")).toBeNull();
		expect(panelByTitle(container, "Measure")).toBeNull();
		expect(panelByTitle(container, "Section")).toBeNull();
	});

	it("reveals the Note/Measure/Section panels when a note is selected on the canvas", () => {
		const { container } = renderEdit(SONG);
		// Click the rendered note group the conformant fixture emits on the canvas;
		// the container's native click handler resolves it to a selection, which
		// reveals the per-level panels alongside the always-present Song panel.
		const note = container.querySelector('[data-kind="note"]');
		expect(note).not.toBeNull();
		act(() => {
			note.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
		});
		expect(panelByTitle(container, "Song")).not.toBeNull();
		expect(panelByTitle(container, "Note")).not.toBeNull();
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
	});

	it("toggling the toolbar switch shows the raw-JSON textarea with its exact label", () => {
		const { container } = renderEdit(SONG);
		const toggle = buttonByText(container, "Edit as JSON");
		expect(toggle).toBeDefined();
		click(toggle);

		const textarea = fieldByName(container, "Song (JSON)");
		expect(textarea).not.toBeNull();
		expect(textarea.tagName).toBe("TEXTAREA");
		expect(textarea.value).toBe(SONG);
		// The structured editor is gone — the two modes never show side by side.
		expect(fieldByName(container, "Title")).toBeNull();
	});

	it("toggles back to visual mode from JSON mode", () => {
		const { container } = renderEdit(SONG);
		click(buttonByText(container, "Edit as JSON"));
		expect(fieldByName(container, "Song (JSON)")).not.toBeNull();

		const back = buttonByText(container, "Visual editor");
		expect(back).toBeDefined();
		click(back);
		expect(fieldByName(container, "Song (JSON)")).toBeNull();
		// Back on the visual surface: the canvas and the Song panel are present.
		expect(container.querySelector("svg")).not.toBeNull();
		expect(panelByTitle(container, "Song")).not.toBeNull();
	});

	it("routes a non-empty invalid song to the invalid state, not the canvas", () => {
		const { container } = renderEdit(INVALID_SONG);
		// A non-conformant song renders the invalid state: no canvas, no Song panel,
		// and not the JSON field yet.
		expect(fieldByName(container, "Song (JSON)")).toBeNull();
		expect(container.querySelector("svg")).toBeNull();
		expect(panelByTitle(container, "Song")).toBeNull();
		// Its "Edit as JSON" affordance jumps to JSON mode with the invalid text.
		const jsonSwitch = buttonByText(container, "Edit as JSON");
		expect(jsonSwitch).toBeDefined();
		click(jsonSwitch);
		const textarea = fieldByName(container, "Song (JSON)");
		expect(textarea).not.toBeNull();
		expect(textarea.value).toBe(INVALID_SONG);
	});

	it("shows the non-blocking error notice in JSON mode for a non-conformant song", () => {
		const errors = validateSong(INVALID_SONG);
		expect(errors.length).toBeGreaterThan(0);

		const { container } = renderEdit(INVALID_SONG);
		click(buttonByText(container, "Edit as JSON"));

		const notice = container.querySelector('[role="alert"]');
		expect(notice).not.toBeNull();
		expect(notice.getAttribute("data-status")).toBe("error");
		expect(notice.textContent).toBe(errors[0]);
	});

	it("does not show an error notice in JSON mode for a conformant song", () => {
		const { container } = renderEdit(SONG);
		click(buttonByText(container, "Edit as JSON"));
		expect(container.querySelector('[role="alert"]')).toBeNull();
	});

	it("editing the JSON textarea persists the raw text verbatim, even when invalid", () => {
		const { container, calls } = renderEdit(SONG);
		click(buttonByText(container, "Edit as JSON"));

		const textarea = fieldByName(container, "Song (JSON)");
		const RAW = "{ not valid json at all";
		change(textarea, RAW);

		// The raw text is stored unconditionally — validation never blocks saving.
		expect(calls).toContain(RAW);
		expect(fieldByName(container, "Song (JSON)").value).toBe(RAW);
		// And the error notice now reflects the (invalid) text.
		const notice = container.querySelector('[role="alert"]');
		expect(notice).not.toBeNull();
		expect(notice.textContent).toBe(validateSong(RAW)[0]);
	});

	it("renders the conformant song on the canvas with its accessible name", () => {
		const { container } = renderEdit(SONG);
		// The conformant song mounts an <svg> on the canvas, and its <title> carries
		// the metadata-derived accessible name passed down to the canvas.
		const title = container.querySelector("svg title");
		expect(title).not.toBeNull();
		expect(title.textContent).toBe("Hello by Ada");
	});
});
