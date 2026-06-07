/**
 * Unit tests for the block's edit container — the thin mode container that
 * switches between the visual editor (default) and the raw-JSON field.
 *
 * `Edit` owns one piece of editor-only UI state, the `mode` (`"visual"` |
 * `"json"`), computes the memoized `errors = validateSong(song)` once (empty
 * string → `[]`), and renders one of two surfaces. These tests pin that:
 *   - the default surface is visual mode (the structured editor is present and
 *     the "Song (JSON)" textarea is NOT in the DOM);
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
 * `@wordpress/block-editor` renders `useBlockProps`/`BlockControls` inline.
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
	it("defaults to visual mode: the structured editor is present, the JSON textarea is not", () => {
		const { container } = renderEdit(SONG);
		// Visual mode shows the structured editor (its metadata Title field).
		expect(fieldByName(container, "Title")).not.toBeNull();
		expect(fieldByName(container, "Title").value).toBe("Hello");
		// The raw-JSON textarea is absent in visual mode.
		expect(fieldByName(container, "Song (JSON)")).toBeNull();
	});

	it("shows the empty state in visual mode for an empty song", () => {
		const { container } = renderEdit("");
		// No structured editor, no JSON textarea — the empty-state affordance shows.
		expect(fieldByName(container, "Title")).toBeNull();
		expect(fieldByName(container, "Song (JSON)")).toBeNull();
		expect(buttonByText(container, "Start a new song")).toBeDefined();
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
		expect(fieldByName(container, "Title")).not.toBeNull();
	});

	it("the visual mode's InvalidState JSON switch jumps to JSON mode", () => {
		const { container } = renderEdit(INVALID_SONG);
		// A non-conformant song renders the invalid state, not the JSON field yet.
		expect(fieldByName(container, "Song (JSON)")).toBeNull();
		const jsonSwitch = buttonByText(container, "Edit as JSON");
		expect(jsonSwitch).toBeDefined();
		click(jsonSwitch);
		// Now in JSON mode: the raw field carries the invalid text verbatim.
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

	it("renders a live preview alongside the structured editor in visual mode", () => {
		const { container } = renderEdit(SONG);
		// The conformant song mounts an <svg> in the preview column, and its
		// <title> carries the metadata-derived accessible name.
		const title = container.querySelector("svg title");
		expect(title).not.toBeNull();
		expect(title.textContent).toBe("Hello by Ada");
	});
});
