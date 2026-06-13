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
 * Look up a structure-tree label button by its exact visible text. After the
 * review-6 redesign the label is plain text (the disclosure chevron is a sibling
 * non-focusable `<span>`, not part of the button), so this is an exact match.
 */
function treeRowButton(container, text) {
	return [...container.querySelectorAll("button")].find(
		(button) => (button.textContent ?? "") === text,
	);
}

/**
 * Click a structure-tree label row (by its exact text) inside `act`. The label is
 * select-only after the redesign, so this **selects** the row; it no longer
 * expands it. Use `expandRow` to reveal a row's children.
 */
function clickByText(container, text) {
	click(treeRowButton(container, text));
}

/**
 * Reveal a row's children by clicking its non-focusable disclosure chevron — the
 * `__tree-expander` span beside the row's label, whose pointer `onClick` routes to
 * `onToggleExpanded`. The select-only label no longer expands, so an ancestor must
 * be expanded through its chevron before its child rows render.
 */
function expandRow(container, text) {
	const row = treeRowButton(container, text).closest("tr");
	const expander = row.querySelector(
		".wp-block-piano-block-piano__tree-expander",
	);
	click(expander);
}

/**
 * How many structure-tree label rows currently render with the exact text. A row
 * is present only when its ancestors are expanded, so a count rising after an
 * add/duplicate (with no manual expand in between) proves the mutation-site seed
 * opened the new node's branch.
 */
function countTreeRows(container, text) {
	return [
		...container.querySelectorAll(".wp-block-piano-block-piano__tree-label"),
	].filter((label) => (label.textContent ?? "") === text).length;
}

/** Open a row's actions menu (by its exact `aria-label`) and click a MenuItem. */
function clickRowAction(container, menuLabel, itemText) {
	const menu = fieldByName(container, menuLabel).closest("td");
	const item = [...menu.querySelectorAll("button")].find(
		(button) => button.textContent === itemText,
	);
	click(item);
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
		// The per-hand "Add note" lives on the structure tree's hand-group row. The
		// tree is open by default, so expand the section, its measure, and the
		// right-hand group (via their chevrons — the labels are select-only) so the
		// per-hand Add note is reachable. The fixture's lone measure is measure 1 of
		// section 1; its right-hand "Add note" seeds a default note.
		expandRow(container, "Section 1");
		expandRow(container, "Measure 1");
		expandRow(container, "Right hand");
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
 * selection surface — the canvas no longer hit-tests). The tree is open by default,
 * but the label is select-only, so expand the section, its measure and the
 * right-hand group via their chevrons before selecting the note row. The fixture
 * note is a C5 → its row label is "C".
 */
function selectLoneNote(container) {
	expandRow(container, "Section 1");
	expandRow(container, "Measure 1");
	expandRow(container, "Right hand");
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
		// The always-present Song panel hosts "Add section" (reachable with nothing
		// selected); it drives the lifted onAddSection handler that owns the splice.
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
		// The SectionPanel button removes immediately — no confirm dialog.
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

	it("onAddMeasure targets the selected section from the Section panel button", () => {
		const { container, calls } = renderEdit(SONG);
		// "Add measure" re-homed from the section row menu to the Section inspector
		// panel: the panel renders only when a section/measure/event is selected, so
		// select the section row first to reveal it, then click its "Add measure"
		// button — its visible text is unique now the tree item is gone, and it signals
		// the lifted onAddMeasure with the selection's section index.
		clickByText(container, "Section 1");
		click(buttonByText(container, "Add measure"));
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

describe("Edit — mutation-site ancestor seeding", () => {
	// Auto-reveal-on-select is dropped, so a deep node an add/duplicate auto-selects
	// is visible in the tree ONLY because the mutator seeds its ancestor expansion
	// keys into the one `expanded` Set. Each test reaches the action through the
	// already-open ancestors it needs, mutates, then asserts the new deep node's row
	// renders (its branch stayed/became open) and its ancestor rows report
	// `aria-expanded="true"` — proof the seed, not a stale expansion, opened it.

	/** The `aria-expanded` of the row whose label is `text`, or `undefined`. */
	function rowExpanded(container, text) {
		return treeRowButton(container, text)
			?.closest("tr")
			?.getAttribute("aria-expanded");
	}

	it("onAddNote seeds the section/measure/hand so the new note row renders", () => {
		const { container } = renderEdit(SONG);
		// Reach the per-hand "Add note": expand section → measure → right hand.
		expandRow(container, "Section 1");
		expandRow(container, "Measure 1");
		expandRow(container, "Right hand");
		// One note row ("C") before the add.
		expect(countTreeRows(container, "C")).toBe(1);

		click(
			fieldByName(
				container,
				"Add note to Right hand of measure 1 of section 1",
			),
		);

		// The seed keeps the section/measure/hand open, so the new (default C) note
		// row renders alongside the original — two "C" rows now.
		expect(countTreeRows(container, "C")).toBe(2);
		expect(rowExpanded(container, "Section 1")).toBe("true");
		expect(rowExpanded(container, "Measure 1")).toBe("true");
		expect(rowExpanded(container, "Right hand")).toBe("true");
		// The new note is selected, so its panels open on it.
		expect(panelByTitle(container, "Note")).not.toBeNull();
	});

	it("onDuplicateMeasure seeds the section so the new measure row renders", () => {
		const { container } = renderEdit(SONG);
		// Expand the section to reach the measure's actions menu.
		expandRow(container, "Section 1");
		expect(countTreeRows(container, "Measure 1")).toBe(1);

		clickRowAction(
			container,
			"Actions for Measure 1 of section 1",
			"Duplicate",
		);

		// The seed keeps the section open, so both the original and the new measure
		// row ("Measure 2") render under it.
		expect(countTreeRows(container, "Measure 1")).toBe(1);
		expect(countTreeRows(container, "Measure 2")).toBe(1);
		expect(rowExpanded(container, "Section 1")).toBe("true");
		// The copy is selected, so the Measure panel opens on it.
		expect(panelByTitle(container, "Measure")).not.toBeNull();
	});

	it("onAddMeasureAfter inserts a fresh measure at i+1, commits, and selects it", () => {
		const { container, calls } = renderEdit(SONG);
		// Expand the section to reach the measure's actions menu, then "Add after".
		expandRow(container, "Section 1");
		expect(countTreeRows(container, "Measure 1")).toBe(1);

		clickRowAction(
			container,
			"Actions for Measure 1 of section 1",
			"Add after",
		);

		// The new (empty `{}`) measure lands at index 1; the song stays conformant.
		const persisted = JSON.parse(calls.at(-1));
		expect(persisted.sections[0].measures).toHaveLength(2);
		expect(persisted.sections[0].measures[1]).toEqual({});
		expect(validateSong(calls.at(-1))).toEqual([]);
		// The seed keeps the section open, so both measure rows render under it.
		expect(countTreeRows(container, "Measure 1")).toBe(1);
		expect(countTreeRows(container, "Measure 2")).toBe(1);
		expect(rowExpanded(container, "Section 1")).toBe("true");
		// The new measure is selected, so the Measure panel opens on it.
		expect(panelByTitle(container, "Measure")).not.toBeNull();
	});

	it("onDuplicateNote seeds the section/measure/hand so the copy's row renders", () => {
		const { container } = renderEdit(SONG);
		// Expand down to the note row to reach its actions menu.
		expandRow(container, "Section 1");
		expandRow(container, "Measure 1");
		expandRow(container, "Right hand");
		expect(countTreeRows(container, "C")).toBe(1);

		clickRowAction(
			container,
			"Actions for Note 1 of Right hand of measure 1 of section 1",
			"Duplicate",
		);

		// The seed keeps the branch open, so the copy's row renders beside the
		// original — two "C" rows now.
		expect(countTreeRows(container, "C")).toBe(2);
		expect(rowExpanded(container, "Section 1")).toBe("true");
		expect(rowExpanded(container, "Measure 1")).toBe("true");
		expect(rowExpanded(container, "Right hand")).toBe("true");
		// The copy is selected, so the Note panel opens on it.
		expect(panelByTitle(container, "Note")).not.toBeNull();
	});
});

describe("Edit — structure tree", () => {
	it("opens the structure tree by default and toggles it closed and open from the toolbar button", () => {
		const { container } = renderEdit(SONG);
		// The tree is open by default: the workspace holds it (a treegrid) on first
		// render, before any toggle.
		const workspace = container.querySelector(
			".wp-block-piano-block-piano__workspace",
		);
		expect(workspace).not.toBeNull();
		expect(
			workspace.querySelector(".wp-block-piano-block-piano__tree"),
		).not.toBeNull();
		expect(container.querySelector('[role="treegrid"]')).not.toBeNull();

		// The first Structure click closes the open-by-default tree.
		click(buttonByText(container, "Structure"));
		expect(
			workspace.querySelector(".wp-block-piano-block-piano__tree"),
		).toBeNull();

		// A second click reopens it (the full AC1 toggle cycle).
		click(buttonByText(container, "Structure"));
		expect(
			workspace.querySelector(".wp-block-piano-block-piano__tree"),
		).not.toBeNull();
		expect(container.querySelector('[role="treegrid"]')).not.toBeNull();
	});

	it("selecting a tree section row reveals only the Section panel", () => {
		const { container } = renderEdit(SONG);
		// The tree is open by default, so drill straight into the section row.
		clickByText(container, "Section 1");
		// A section selection gates the Section panel only (plus the always-on Song).
		expect(panelByTitle(container, "Song")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
		expect(panelByTitle(container, "Measure")).toBeNull();
		expect(panelByTitle(container, "Note")).toBeNull();
	});

	it("selecting a tree measure row reveals the Measure and Section panels", () => {
		const { container } = renderEdit(SONG);
		// The tree is open by default: expand the section (via its chevron), then
		// select its measure row.
		expandRow(container, "Section 1");
		clickByText(container, "Measure 1");
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
		expect(panelByTitle(container, "Note")).toBeNull();
	});

	it("selecting a tree note row reveals all three per-level panels", () => {
		const { container } = renderEdit(SONG);
		// The tree is open by default: expand down to the lone right-hand note (via
		// the chevrons — the labels are select-only) and select it.
		expandRow(container, "Section 1");
		expandRow(container, "Measure 1");
		expandRow(container, "Right hand");
		// The fixture note is a C5 → its row label is "C" (no octave).
		clickByText(container, "C");
		expect(panelByTitle(container, "Note")).not.toBeNull();
		expect(panelByTitle(container, "Measure")).not.toBeNull();
		expect(panelByTitle(container, "Section")).not.toBeNull();
	});
});
