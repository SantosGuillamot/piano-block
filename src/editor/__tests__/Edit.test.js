/**
 * Unit tests for the block's edit container — the thin mode container that
 * switches between the canvas-first visual editor (default) and the raw-JSON
 * field.
 *
 * `Edit` owns two pieces of editor-only UI state, the `mode` (`"visual"` |
 * `"json"`) and the `selection` (driven by the structure tree, not the canvas),
 * computes the memoized `errors = validateSong(song)` once (empty string → `[]`),
 * and renders one of three surfaces. These tests pin that:
 *   - the default surface is the visual editor: the display-only `SongCanvas`
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

/**
 * Look up a structure-tree label button by its visible text, ignoring the leading
 * disclosure caret (`▸`/`▾`) the section/measure/hand/note rows render before the
 * label.
 */
function treeRowButton(container, text) {
	return [...container.querySelectorAll("button")].find(
		(button) => (button.textContent ?? "").replace(/^[▸▾]\s*/, "") === text,
	);
}

/** Click a structure-tree label row (by its caret-stripped text) inside `act`. */
function clickByText(container, text) {
	click(treeRowButton(container, text));
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

	it("seeds a note from the structure tree's per-hand Add note and opens the Note panel", () => {
		const { container, calls } = renderEdit(SONG);
		// The per-hand "Add note" lives on the structure tree's hand-group row. Open
		// the tree, then expand the section, its measure, and the right-hand group so
		// the per-hand Add note is reachable. The fixture's lone measure is measure 1
		// of section 1; its right-hand "Add note" seeds a default note.
		click(buttonByText(container, "Structure"));
		clickByText(container, "Section 1");
		clickByText(container, "Measure 1");
		clickByText(container, "Right hand");
		const addNote = fieldByName(
			container,
			"Add note to Right hand of measure 1 of section 1",
		);
		expect(addNote).not.toBeNull();
		click(addNote);

		// The add is persisted through commitSong (the raw string round-trips through
		// validateSong) — the hand now carries two events, the second a default note.
		const persisted = JSON.parse(calls.at(-1));
		const hand = persisted.sections[0].measures[0].rightHand;
		expect(hand).toHaveLength(2);
		expect(hand[1].type).toBe("note");
		expect(validateSong(calls.at(-1))).toEqual([]);

		// The new note is selected, so the per-level panels open on it.
		expect(panelByTitle(container, "Note")).not.toBeNull();
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
	});

	it("inserts a contextual note right after the selected event in the same hand", () => {
		const { container, calls } = renderEdit(SONG);
		// Select the existing first note (via the structure tree), then use the Note
		// panel's contextual "Add note": the hand is inferred from the selection and
		// the new note lands at index 1 (right after the selection), not appended past
		// it.
		selectLoneNote(container);
		click(buttonByText(container, "Add note"));

		const hand = JSON.parse(calls.at(-1)).sections[0].measures[0].rightHand;
		expect(hand).toHaveLength(2);
		// The original note is still first; the seeded one follows it.
		expect(hand[0].pitches).toEqual([{ step: "C", octave: 5 }]);
		expect(hand[1].type).toBe("note");
		expect(validateSong(calls.at(-1))).toEqual([]);

		// The new note is auto-selected at eventIndex + 1, so the Note panel stays
		// open on it (the contextual add re-targets the selection).
		expect(panelByTitle(container, "Note")).not.toBeNull();
	});

	it("clears a stale selection after a raw edit removes the selected event", () => {
		const { container } = renderEdit(SONG);
		// Select the only note (via the structure tree), revealing the per-level panels.
		selectLoneNote(container);
		expect(panelByTitle(container, "Note")).not.toBeNull();

		// Drop into JSON mode and replace the song with one whose selected event no
		// longer exists (an empty measure). Back on the canvas, the now-stale
		// selection resolves to null, so the sidebar falls back to Song-only.
		click(buttonByText(container, "Edit as JSON"));
		change(
			fieldByName(container, "Song (JSON)"),
			JSON.stringify({ sections: [{ measures: [{}] }] }),
		);
		click(buttonByText(container, "Visual editor"));

		expect(panelByTitle(container, "Song")).not.toBeNull();
		expect(panelByTitle(container, "Note")).toBeNull();
		expect(panelByTitle(container, "Measure")).toBeNull();
		expect(panelByTitle(container, "Section")).toBeNull();
	});
});

/**
 * Select the SONG fixture's lone right-hand note through the structure tree (the
 * selection surface — the canvas no longer hit-tests). Opens the tree, drills down
 * to the note row, and clicks it. The fixture note is a C5 → its row label is "C".
 */
function selectLoneNote(container) {
	click(buttonByText(container, "Structure"));
	clickByText(container, "Section 1");
	clickByText(container, "Measure 1");
	clickByText(container, "Right hand");
	clickByText(container, "C");
}

describe("Edit — kind-tagged panel gating", () => {
	it("shows all three per-level panels for an event-kind tree selection", () => {
		const { container } = renderEdit(SONG);
		selectLoneNote(container);
		// A note-row selection is kind:"event": every panel gates open.
		expect(panelByTitle(container, "Section")).not.toBeNull();
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		expect(panelByTitle(container, "Note")).not.toBeNull();
	});
});

describe("Edit — lifted structural mutators", () => {
	it("onAddSection appends an empty-but-conformant section through commit", () => {
		const { container, calls } = renderEdit(SONG);
		// The Section panel (reachable once an event is selected) drives the lifted
		// onAddSection handler that owns the splice.
		selectLoneNote(container);
		click(buttonByText(container, "Add section"));

		const persisted = JSON.parse(calls.at(-1));
		expect(persisted.sections).toHaveLength(2);
		expect(persisted.sections[1].measures).toHaveLength(1);
		expect(validateSong(calls.at(-1))).toEqual([]);
	});

	it("onRemoveSection removes the selected section and clears the now-stale selection", () => {
		const { container, calls } = renderEdit(SONG);
		selectLoneNote(container);
		expect(panelByTitle(container, "Section")).not.toBeNull();
		click(buttonByText(container, "Remove section"));

		// The only section is removed (a conformant empty sections array), and the
		// selection that pointed under it is cleared, so the per-level panels vanish.
		const persisted = JSON.parse(calls.at(-1));
		expect(persisted.sections).toEqual([]);
		expect(validateSong(calls.at(-1))).toEqual([]);
		expect(panelByTitle(container, "Note")).toBeNull();
		expect(panelByTitle(container, "Measure")).toBeNull();
		expect(panelByTitle(container, "Section")).toBeNull();
		expect(panelByTitle(container, "Song")).not.toBeNull();
	});

	it("onRemoveMeasure removes the selected measure and clears the now-stale selection", () => {
		const { container, calls } = renderEdit(SONG);
		selectLoneNote(container);
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		click(buttonByText(container, "Remove measure"));

		// The lone measure is removed (leaving a conformant empty measures array),
		// and the selection under it is cleared.
		const persisted = JSON.parse(calls.at(-1));
		expect(persisted.sections[0].measures).toEqual([]);
		expect(validateSong(calls.at(-1))).toEqual([]);
		expect(panelByTitle(container, "Note")).toBeNull();
		expect(panelByTitle(container, "Measure")).toBeNull();
		expect(panelByTitle(container, "Section")).toBeNull();
	});

	it("onAddMeasure targets the section the structure tree fires for", () => {
		const { container, calls } = renderEdit(SONG);
		// The structure tree's per-section "Add measure" signals the lifted
		// onAddMeasure with that section's explicit index — section 1 (the lone one).
		// The section-row action is present as soon as the tree is open.
		click(buttonByText(container, "Structure"));
		click(fieldByName(container, "Add measure to section 1"));
		const persisted = JSON.parse(calls.at(-1));
		expect(persisted.sections[0].measures).toHaveLength(2);
		expect(persisted.sections[0].measures[1]).toEqual({});
		expect(validateSong(calls.at(-1))).toEqual([]);
	});

	it("onRemoveNote removes the note, drops the emptied hand, and clears the stale selection", () => {
		const { container, calls } = renderEdit(SONG);
		// Select the lone note, then use the Note panel's Remove — the panel signals
		// the lifted onRemoveNote, the single owner of the splice.
		selectLoneNote(container);
		expect(panelByTitle(container, "Note")).not.toBeNull();
		click(buttonByText(container, "Remove note"));

		// The only event in the right hand is gone, so the hand key is dropped,
		// leaving a conformant empty measure; the now-stale selection is cleared.
		const persisted = JSON.parse(calls.at(-1));
		expect(persisted.sections[0].measures[0].rightHand).toBeUndefined();
		expect(validateSong(calls.at(-1))).toEqual([]);
		expect(panelByTitle(container, "Note")).toBeNull();
		expect(panelByTitle(container, "Measure")).toBeNull();
		expect(panelByTitle(container, "Section")).toBeNull();
		expect(panelByTitle(container, "Song")).not.toBeNull();
	});

	it("onRemoveNote keeps the hand when another event remains", () => {
		// A two-event right hand: removing the selected first note leaves the trailing
		// rest, so the hand key stays.
		const TWO_EVENT_SONG = JSON.stringify({
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
								{ type: "rest", duration: "quarter" },
							],
						},
					],
				},
			],
		});
		const { container, calls } = renderEdit(TWO_EVENT_SONG);
		selectLoneNote(container);
		click(buttonByText(container, "Remove note"));

		const hand = JSON.parse(calls.at(-1)).sections[0].measures[0].rightHand;
		expect(hand).toHaveLength(1);
		expect(hand[0].type).toBe("rest");
		expect(validateSong(calls.at(-1))).toEqual([]);
	});
});

describe("Edit — structure tree", () => {
	it("toggles the structure tree open and closed from the toolbar button", () => {
		const { container } = renderEdit(SONG);
		// The workspace exists but holds no tree until the Structure toggle is on.
		const workspace = container.querySelector(
			".wp-block-piano-block-piano__workspace",
		);
		expect(workspace).not.toBeNull();
		expect(
			workspace.querySelector(".wp-block-piano-block-piano__tree"),
		).toBeNull();

		// Toggling the Structure button reveals the tree (a treegrid in the workspace).
		click(buttonByText(container, "Structure"));
		expect(
			workspace.querySelector(".wp-block-piano-block-piano__tree"),
		).not.toBeNull();
		expect(container.querySelector('[role="treegrid"]')).not.toBeNull();

		// Toggling it off hides the tree again.
		click(buttonByText(container, "Structure"));
		expect(
			workspace.querySelector(".wp-block-piano-block-piano__tree"),
		).toBeNull();
	});

	it("selecting a tree section row reveals only the Section panel", () => {
		const { container } = renderEdit(SONG);
		click(buttonByText(container, "Structure"));
		clickByText(container, "Section 1");
		// A section selection gates the Section panel only (plus the always-on Song).
		expect(panelByTitle(container, "Song")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
		expect(panelByTitle(container, "Measure")).toBeNull();
		expect(panelByTitle(container, "Note")).toBeNull();
	});

	it("selecting a tree measure row reveals the Measure and Section panels", () => {
		const { container } = renderEdit(SONG);
		click(buttonByText(container, "Structure"));
		// Expand the section, then select its measure row.
		clickByText(container, "Section 1");
		clickByText(container, "Measure 1");
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
		expect(panelByTitle(container, "Note")).toBeNull();
	});

	it("selecting a tree note row reveals all three per-level panels", () => {
		const { container } = renderEdit(SONG);
		click(buttonByText(container, "Structure"));
		// Drill down to the lone right-hand note and select it.
		clickByText(container, "Section 1");
		clickByText(container, "Measure 1");
		clickByText(container, "Right hand");
		// The fixture note is a C5 → its row label is "C" (no octave).
		clickByText(container, "C");
		expect(panelByTitle(container, "Note")).not.toBeNull();
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
	});
});
