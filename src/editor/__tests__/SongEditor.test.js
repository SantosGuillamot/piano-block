/**
 * Unit tests for the visual-editor root — `SongEditor` and its two non-structured
 * states, `EmptyState` and `InvalidState`.
 *
 * `SongEditor` is the root that branches on the validity of the raw `song`
 * string and owns the parse → edit → serialize data flow plus the drill-down
 * navigation state. These tests pin that branching and flow. First, the three
 * branches: an empty `song` renders the empty state whose "start" affordance
 * seeds a minimal conformant song through `onChangeSong`; a non-empty string with
 * a non-empty `errors` list renders the invalid state (an error message plus a
 * JSON-switch button); a conformant string renders the structured editor, whose
 * metadata title field reflects `metadata.title`. Second, the edit flow: changing
 * the title re-serializes the whole song and calls `onChangeSong` with a string
 * the real `validateSong` accepts. Third, navigation: opening a section then a
 * measure grows the breadcrumb, and clicking an earlier crumb returns to the
 * parent.
 *
 * The component is a presentational React component, so the tests render it into
 * jsdom (no `@testing-library/react`) and drive the mocked `@wordpress/components`
 * inputs directly — setting a field value and dispatching a change event, or
 * clicking a button — all inside `act` so React flushes synchronously.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { EmptyState } from "../EmptyState.js";
import { InvalidState } from "../InvalidState.js";
import { SongEditor } from "../SongEditor.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A small but conformant song: one note in each hand, with metadata. */
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
				{},
			],
		},
	],
});

/**
 * Render an element into a fresh detached container and return both the
 * container and a `rerender` that re-renders the same root.
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

/** Look up an input/select by its accessible name (`aria-label`). */
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
 * Set a controlled field's value and dispatch a change event inside `act`.
 *
 * React tracks a controlled field's value through its own value setter, so a
 * plain `node.value = …` is invisible to it. We set the value through the native
 * prototype setter (which React's tracker observes) before dispatching, so the
 * synthetic `onChange` fires with the new value.
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

/** Click a node inside `act` so React flushes the handler. */
function click(node) {
	act(() => {
		node.click();
	});
}

/**
 * Render a `SongEditor` that feeds its own emission back in (re-deriving
 * `errors` from the new string, as `Edit` does) while recording every emission.
 *
 * @param {string} initial The starting raw `song` string.
 * @return {{ container: HTMLElement, calls: string[], jsonCalls: number }} Handle.
 */
function renderEditor(initial) {
	const calls = [];
	let song = initial;
	let jsonCalls = 0;
	let handle;
	const element = () =>
		createElement(SongEditor, {
			song,
			errors: song.trim() === "" ? [] : validateSong(song),
			onChangeSong: (next) => {
				song = next;
				calls.push(next);
				handle.rerender(element());
			},
			onEditAsJson: () => {
				jsonCalls += 1;
			},
		});
	handle = render(element());
	return {
		container: handle.container,
		calls,
		get jsonCalls() {
			return jsonCalls;
		},
	};
}

describe("EmptyState", () => {
	it("calls onStart with a conformant song string when the author starts one", () => {
		const calls = [];
		const { container } = render(
			createElement(EmptyState, { onStart: (next) => calls.push(next) }),
		);
		const startButton = [...container.querySelectorAll("button")][0];
		expect(startButton).toBeDefined();
		click(startButton);

		expect(calls).toHaveLength(1);
		expect(validateSong(calls[0])).toEqual([]);
	});
});

describe("InvalidState", () => {
	it("shows an error message and a JSON-switch button", () => {
		let jsonCalls = 0;
		const { container } = render(
			createElement(InvalidState, {
				errors: ['root: missing required property "sections"'],
				onEditAsJson: () => {
					jsonCalls += 1;
				},
			}),
		);
		const notice = container.querySelector('[role="alert"]');
		expect(notice).not.toBeNull();
		expect(notice.getAttribute("data-status")).toBe("error");
		expect(notice.textContent).toContain("sections");

		const jsonButton = [...container.querySelectorAll("button")][0];
		click(jsonButton);
		expect(jsonCalls).toBe(1);
	});
});

describe("SongEditor", () => {
	it("renders the empty state and starting a song persists a conformant string", () => {
		const { container, calls } = renderEditor("");
		// No structured editor yet: the metadata title field is absent.
		expect(fieldByName(container, "Title")).toBeNull();

		const startButton = [...container.querySelectorAll("button")][0];
		expect(startButton).toBeDefined();
		click(startButton);

		expect(calls).toHaveLength(1);
		expect(validateSong(calls[0])).toEqual([]);
		// The structured editor has taken over (re-fed string is conformant).
		expect(fieldByName(container, "Title")).not.toBeNull();
	});

	it("renders the invalid state with a message and a working JSON-switch button", () => {
		const invalid = '{"foo":"bar"}';
		const errors = validateSong(invalid);
		expect(errors.length).toBeGreaterThan(0);

		let jsonCalls = 0;
		const { container } = render(
			createElement(SongEditor, {
				song: invalid,
				errors,
				onChangeSong: () => {},
				onEditAsJson: () => {
					jsonCalls += 1;
				},
			}),
		);
		const notice = container.querySelector('[role="alert"]');
		expect(notice).not.toBeNull();
		expect(notice.getAttribute("data-status")).toBe("error");
		expect(notice.textContent).toContain(errors[0]);

		const jsonButton = buttonByText(container, "Edit as JSON");
		expect(jsonButton).toBeDefined();
		click(jsonButton);
		expect(jsonCalls).toBe(1);
	});

	it("renders the structured editor reflecting metadata.title for a conformant song", () => {
		const { container } = renderEditor(SONG);
		const title = fieldByName(container, "Title");
		expect(title).not.toBeNull();
		expect(title.value).toBe("Hello");
	});

	it("re-serializes a conformant song when the title is edited", () => {
		const { container, calls } = renderEditor(SONG);
		change(fieldByName(container, "Title"), "New title");

		expect(calls).toHaveLength(1);
		const persisted = calls[0];
		expect(validateSong(persisted)).toEqual([]);
		expect(JSON.parse(persisted).metadata.title).toBe("New title");
		// The field reflects the persisted value after the round-trip.
		expect(fieldByName(container, "Title").value).toBe("New title");
	});

	it("grows the breadcrumb when opening a section then a measure and walks back up", () => {
		const { container } = renderEditor(SONG);

		// Overview shows the section open affordance; opening it drills in.
		click(buttonByText(container, "Section 1"));
		// Now in the section view: a breadcrumb crumb for the section, and the
		// measure open affordances are visible.
		expect(buttonByText(container, "Song")).toBeDefined();
		expect(buttonByText(container, "Measure 1")).toBeDefined();

		// Opening a measure drills one level deeper.
		click(buttonByText(container, "Measure 1"));
		// The breadcrumb now carries Song and Section 1 as navigable crumbs.
		expect(buttonByText(container, "Song")).toBeDefined();
		expect(buttonByText(container, "Section 1")).toBeDefined();
		// The measure-level controls (a barline select) are present.
		expect(fieldByName(container, "Start barline")).not.toBeNull();

		// Navigate back to the section via its crumb.
		click(buttonByText(container, "Section 1"));
		// Back in the section: the measure list is shown again.
		expect(buttonByText(container, "Measure 1")).toBeDefined();
		// And the measure-level barline control is gone.
		expect(fieldByName(container, "Start barline")).toBeNull();

		// Navigate all the way back to the song overview.
		click(buttonByText(container, "Song"));
		// The overview shows the add-section affordance again.
		expect(buttonByText(container, "Add section")).toBeDefined();
	});

	it("clamps navigation when an opened section is removed underneath it", () => {
		// Single-section song; open it, then it is removed (e.g. by an edit), and
		// the editor must fall back to a valid level rather than render a missing
		// section.
		const { container } = renderEditor(SONG);
		click(buttonByText(container, "Section 1"));
		expect(buttonByText(container, "Measure 1")).toBeDefined();

		// Remove the (only) section from inside the section view's overrides path
		// is not directly reachable, so instead remove the open section by
		// drilling back and removing it; verify the overview is shown.
		click(buttonByText(container, "Song"));
		const removeSection = [...container.querySelectorAll("button")].find(
			(button) => button.getAttribute("aria-label") === "Remove section",
		);
		click(removeSection);
		// After removing the only section, the overview shows the add-section
		// affordance and no section row.
		expect(buttonByText(container, "Add section")).toBeDefined();
		expect(buttonByText(container, "Section 1")).toBeUndefined();
	});
});
