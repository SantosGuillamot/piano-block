/**
 * Unit tests for the structural editor stack — `MeasureEditor`, `MeasureList`,
 * `SectionEditor`, `SectionList`, `SongOverview` and the `Breadcrumb`.
 *
 * These are the drill-down editors (song → section → measure) plus the
 * navigation trail that ties them together. The tests pin the rules the design
 * rests on. First, each list adds, removes and reorders its items through the
 * shared array helpers: a section's measures and a song's sections. Second, a
 * section always keeps its required `measures` key (even when every measure is
 * removed). Third, the optional blocks omit their key when empty: a measure's
 * barlines, its hands and its annotations; a song's `metadata` and `defaults`;
 * and a section's context overrides. Fourth, the `Breadcrumb` is pure — it
 * renders one crumb per trail entry, makes the last non-interactive, and calls
 * `onNavigate(level)` for an earlier crumb. Throughout, representative emitted
 * songs are wrapped (or used whole) and handed to the real `validateSong`, which
 * must accept them — the conformant-by-construction guarantee at the structural
 * level.
 *
 * The editors are presentational React components, so the tests render them into
 * jsdom and drive the mocked `@wordpress/components` inputs directly — setting a
 * `<select>`/`<input>` value and dispatching a change event, or clicking a
 * `<button>` — all inside `act` so React flushes synchronously.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { Breadcrumb } from "../Breadcrumb.js";
import { MeasureEditor } from "../MeasureEditor.js";
import { MeasureList } from "../MeasureList.js";
import { SectionEditor } from "../SectionEditor.js";
import { SectionList } from "../SectionList.js";
import { SongOverview } from "../SongOverview.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

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

/** Look up a button by its accessible name (`aria-label`). */
function buttonByName(container, name) {
	return [...container.querySelectorAll("button")].find(
		(button) => button.getAttribute("aria-label") === name,
	);
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

/** Assert the real validator accepts the whole song. */
function expectSongConformant(song) {
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("MeasureEditor", () => {
	/**
	 * Render a `MeasureEditor` that feeds its own emission back in (so it behaves
	 * like a controlled control across edits) while recording every emission.
	 *
	 * @param {Object} initial The starting measure.
	 * @param {string} system  The per-song note-name system.
	 * @return {{ container: HTMLElement, calls: Object[], drills: any[] }} Handle.
	 */
	function renderMeasure(initial, system = "english") {
		const calls = [];
		const drills = [];
		let measure = initial;
		let handle;
		const onDrillIn = (...args) => drills.push(args);
		const onChange = (next) => {
			measure = next;
			calls.push(next);
			handle.rerender(
				createElement(MeasureEditor, { measure, system, onChange, onDrillIn }),
			);
		};
		handle = render(
			createElement(MeasureEditor, { measure, system, onChange, onDrillIn }),
		);
		return { container: handle.container, calls, drills };
	}

	it("sets a barline when chosen and omits the key when cleared", () => {
		const { container, calls } = renderMeasure({});
		change(fieldByName(container, "Start barline"), "repeat-start");
		expect(calls.at(-1)).toEqual({ barlineStart: "repeat-start" });
		expectSongConformant({
			sections: [{ measures: [calls.at(-1)] }],
		});

		// Back to the empty option: the key is dropped, not emitted as "".
		change(fieldByName(container, "Start barline"), "");
		expect(calls.at(-1)).toEqual({});
		expect(calls.at(-1).barlineStart).toBeUndefined();
	});

	it("offers exactly the barline vocabulary plus an empty option", () => {
		const { container } = renderMeasure({});
		const values = [
			...fieldByName(container, "End barline").querySelectorAll("option"),
		].map((option) => option.value);
		expect(values).toEqual([
			"",
			"regular",
			"repeat-start",
			"repeat-end",
			"double",
			"final",
		]);
	});

	it("adds events to a hand and drops the hand key when emptied", () => {
		const { container, calls } = renderMeasure({});
		// The right-hand list's own "Add note" appends into the rightHand key.
		click(buttonByName(container, "Add note"));
		expect(calls.at(-1).rightHand).toHaveLength(1);
		expectSongConformant({ sections: [{ measures: [calls.at(-1)] }] });

		// Removing the only event drops the whole hand key.
		click(buttonByName(container, "Remove event"));
		expect(calls.at(-1)).toEqual({});
		expect(calls.at(-1).rightHand).toBeUndefined();
	});

	it("writes the two hands independently", () => {
		const { container, calls } = renderMeasure({});
		// Two "Add rest" buttons exist (one per hand list); the second is the left.
		const addRests = [...container.querySelectorAll("button")].filter(
			(button) => button.getAttribute("aria-label") === "Add rest",
		);
		click(addRests[1]);
		expect(calls.at(-1).leftHand).toHaveLength(1);
		expect(calls.at(-1).rightHand).toBeUndefined();
		expectSongConformant({ sections: [{ measures: [calls.at(-1)] }] });
	});

	it("adds a measure-level standalone annotation and drops the key when emptied", () => {
		const { container, calls } = renderMeasure({});
		click(buttonByName(container, "Add annotation"));
		expect(calls.at(-1).annotations).toHaveLength(1);
		// A standalone annotation carries a staff, so the measure stays conformant.
		expectSongConformant({ sections: [{ measures: [calls.at(-1)] }] });

		click(buttonByName(container, "Remove annotation"));
		expect(calls.at(-1)).toEqual({});
		expect(calls.at(-1).annotations).toBeUndefined();
	});

	it("forwards a hand drill-in tagged with the hand and index", () => {
		const { container, drills } = renderMeasure({
			rightHand: [
				{
					type: "note",
					duration: "quarter",
					pitches: [{ step: "C", octave: 4 }],
				},
				{ type: "rest", duration: "quarter" },
			],
		});
		const drillButtons = [...container.querySelectorAll("button")].filter(
			(button) => button.getAttribute("aria-label") === "Edit event details",
		);
		click(drillButtons[1]);
		expect(drills.at(-1)).toEqual(["rightHand", 1]);
	});

	it("treats an empty measure as conformant", () => {
		expectSongConformant({ sections: [{ measures: [{}] }] });
	});
});

describe("MeasureList", () => {
	/**
	 * Render a `MeasureList` that feeds its own emission back in while recording
	 * every emission and every open request.
	 *
	 * @param {Object[]} initial The starting measures array.
	 * @return {{ container: HTMLElement, calls: any[], opened: number[] }} Handle.
	 */
	function renderList(initial) {
		const calls = [];
		const opened = [];
		let measures = initial;
		let handle;
		const onOpenMeasure = (index) => opened.push(index);
		const onChange = (next) => {
			measures = next;
			calls.push(next);
			handle.rerender(
				createElement(MeasureList, { measures, onChange, onOpenMeasure }),
			);
		};
		handle = render(
			createElement(MeasureList, { measures, onChange, onOpenMeasure }),
		);
		return { container: handle.container, calls, opened };
	}

	it("appends a new measure", () => {
		const { container, calls } = renderList([{}]);
		click(buttonByName(container, "Add measure"));
		expect(calls.at(-1)).toEqual([{}, {}]);
		expectSongConformant({ sections: [{ measures: calls.at(-1) }] });
	});

	it("opens a measure by index", () => {
		const { container, opened } = renderList([{}, {}, {}]);
		click(buttonByText(container, "Measure 2"));
		expect(opened.at(-1)).toBe(1);
	});

	it("reorders measures when a row is moved", () => {
		const { container, calls } = renderList([
			{ barlineStart: "regular" },
			{ barlineStart: "final" },
		]);
		click(buttonByName(container, "Move measure down"));
		expect(calls.at(-1)).toEqual([
			{ barlineStart: "final" },
			{ barlineStart: "regular" },
		]);
		expectSongConformant({ sections: [{ measures: calls.at(-1) }] });
	});

	it("removes a measure, allowing the list down to empty", () => {
		const { container, calls } = renderList([{}]);
		click(buttonByName(container, "Remove measure"));
		expect(calls.at(-1)).toEqual([]);
		// A section with an empty measures array is still conformant.
		expectSongConformant({ sections: [{ measures: calls.at(-1) }] });
	});
});

describe("SectionEditor", () => {
	/**
	 * Render a `SectionEditor` that feeds its own emission back in while recording
	 * every emission and every measure-open request.
	 *
	 * @param {Object} initial The starting section.
	 * @return {{ container: HTMLElement, calls: Object[], opened: number[] }} Handle.
	 */
	function renderSection(initial) {
		const calls = [];
		const opened = [];
		let section = initial;
		let handle;
		const onOpenMeasure = (index) => opened.push(index);
		const onChange = (next) => {
			section = next;
			calls.push(next);
			handle.rerender(
				createElement(SectionEditor, { section, onChange, onOpenMeasure }),
			);
		};
		handle = render(
			createElement(SectionEditor, { section, onChange, onOpenMeasure }),
		);
		return { container: handle.container, calls, opened };
	}

	it("always keeps the measures key when an override is edited", () => {
		const { container, calls } = renderSection({ measures: [{}] });
		change(fieldByName(container, "Tempo (BPM)"), "120");
		expect(calls.at(-1).measures).toEqual([{}]);
		expect(calls.at(-1).tempo).toEqual({ bpm: 120 });
		expectSongConformant({ sections: [calls.at(-1)] });
	});

	it("omits an override key when its value is cleared, keeping measures", () => {
		const { container, calls } = renderSection({
			tempo: { bpm: 90 },
			measures: [{}],
		});
		change(fieldByName(container, "Tempo (BPM)"), "");
		expect(calls.at(-1).tempo).toBeUndefined();
		expect(calls.at(-1).measures).toEqual([{}]);
		expectSongConformant({ sections: [calls.at(-1)] });
	});

	it("adds a measure through its measure list, keeping measures required", () => {
		const { container, calls } = renderSection({ measures: [{}] });
		click(buttonByName(container, "Add measure"));
		expect(calls.at(-1).measures).toEqual([{}, {}]);
		expectSongConformant({ sections: [calls.at(-1)] });
	});

	it("forwards a measure-open request by index", () => {
		const { container, opened } = renderSection({ measures: [{}, {}] });
		click(buttonByText(container, "Measure 2"));
		expect(opened.at(-1)).toBe(1);
	});

	it("does not leak the section's measures into its context overrides", () => {
		// The ContextEditor must not see `measures`; were it leaked, an override
		// edit could echo it back in the wrong place. A barline-free section with
		// only measures edited via tempo proves measures survives untouched.
		const { container, calls } = renderSection({
			measures: [{ barlineStart: "regular" }],
		});
		change(fieldByName(container, "Tempo (BPM)"), "60");
		expect(calls.at(-1).measures).toEqual([{ barlineStart: "regular" }]);
		expectSongConformant({ sections: [calls.at(-1)] });
	});
});

describe("SectionList", () => {
	/**
	 * Render a `SectionList` that feeds its own emission back in while recording
	 * every emission and every open request.
	 *
	 * @param {Object[]} initial The starting sections array.
	 * @return {{ container: HTMLElement, calls: any[], opened: number[] }} Handle.
	 */
	function renderList(initial) {
		const calls = [];
		const opened = [];
		let sections = initial;
		let handle;
		const onOpenSection = (index) => opened.push(index);
		const onChange = (next) => {
			sections = next;
			calls.push(next);
			handle.rerender(
				createElement(SectionList, { sections, onChange, onOpenSection }),
			);
		};
		handle = render(
			createElement(SectionList, { sections, onChange, onOpenSection }),
		);
		return { container: handle.container, calls, opened };
	}

	it("appends a new section seeded with one measure", () => {
		const { container, calls } = renderList([{ measures: [{}] }]);
		click(buttonByName(container, "Add section"));
		const next = calls.at(-1);
		expect(next).toHaveLength(2);
		// A brand-new section seeds one empty measure (so it is meaningful).
		expect(next[1]).toEqual({ measures: [{}] });
		expectSongConformant({ sections: next });
	});

	it("opens a section by index", () => {
		const { container, opened } = renderList([
			{ measures: [{}] },
			{ measures: [{}] },
		]);
		click(buttonByText(container, "Section 2"));
		expect(opened.at(-1)).toBe(1);
	});

	it("moves the second section up ahead of the first", () => {
		const { container, calls } = renderList([
			{ tempo: { bpm: 60 }, measures: [{}] },
			{ tempo: { bpm: 120 }, measures: [{}] },
		]);
		const upButtons = [...container.querySelectorAll("button")].filter(
			(button) => button.getAttribute("aria-label") === "Move section up",
		);
		// The first section's up is disabled; the second section's up moves it up.
		click(upButtons[1]);
		expect(calls.at(-1)).toEqual([
			{ tempo: { bpm: 120 }, measures: [{}] },
			{ tempo: { bpm: 60 }, measures: [{}] },
		]);
		expectSongConformant({ sections: calls.at(-1) });
	});

	it("removes a section, allowing the list down to empty", () => {
		const { container, calls } = renderList([{ measures: [{}] }]);
		click(buttonByName(container, "Remove section"));
		expect(calls.at(-1)).toEqual([]);
		// The schema permits an empty sections array; the empty state is T9's job.
		expectSongConformant({ sections: calls.at(-1) });
	});
});

describe("SongOverview", () => {
	/**
	 * Render a `SongOverview` that feeds its own emission back in while recording
	 * every emission and every section-open request.
	 *
	 * @param {Object} initial The starting song.
	 * @param {string} system  The per-song note-name system.
	 * @return {{ container: HTMLElement, calls: Object[], opened: number[] }} Handle.
	 */
	function renderOverview(initial, system = "english") {
		const calls = [];
		const opened = [];
		let song = initial;
		let handle;
		const onOpenSection = (index) => opened.push(index);
		const onChange = (next) => {
			song = next;
			calls.push(next);
			handle.rerender(
				createElement(SongOverview, {
					song,
					system,
					onChange,
					onOpenSection,
				}),
			);
		};
		handle = render(
			createElement(SongOverview, { song, system, onChange, onOpenSection }),
		);
		return { container: handle.container, calls, opened };
	}

	it("emits metadata only when a field is set, dropping it when cleared", () => {
		const { container, calls } = renderOverview({
			sections: [{ measures: [{}] }],
		});
		change(fieldByName(container, "Title"), "Prelude");
		expect(calls.at(-1).metadata).toEqual({ title: "Prelude" });
		expectSongConformant(calls.at(-1));

		change(fieldByName(container, "Title"), "");
		expect(calls.at(-1).metadata).toBeUndefined();
		expectSongConformant(calls.at(-1));
	});

	it("emits defaults only when a field is set, dropping it when cleared", () => {
		const { container, calls } = renderOverview({
			sections: [{ measures: [{}] }],
		});
		change(fieldByName(container, "Tempo (BPM)"), "100");
		expect(calls.at(-1).defaults).toEqual({ tempo: { bpm: 100 } });
		expectSongConformant(calls.at(-1));

		change(fieldByName(container, "Tempo (BPM)"), "");
		expect(calls.at(-1).defaults).toBeUndefined();
		expectSongConformant(calls.at(-1));
	});

	it("adds, reorders and removes sections, keeping the section list current", () => {
		const { container, calls } = renderOverview({
			sections: [{ measures: [{}] }],
		});
		click(buttonByName(container, "Add section"));
		expect(calls.at(-1).sections).toHaveLength(2);
		expectSongConformant(calls.at(-1));

		const upButtons = [...container.querySelectorAll("button")].filter(
			(button) => button.getAttribute("aria-label") === "Move section up",
		);
		click(upButtons[1]);
		expect(calls.at(-1).sections).toHaveLength(2);
		expectSongConformant(calls.at(-1));

		const removeButtons = [...container.querySelectorAll("button")].filter(
			(button) => button.getAttribute("aria-label") === "Remove section",
		);
		click(removeButtons[0]);
		expect(calls.at(-1).sections).toHaveLength(1);
		expectSongConformant(calls.at(-1));
	});

	it("forwards a section-open request by index", () => {
		const { container, opened } = renderOverview({
			sections: [{ measures: [{}] }, { measures: [{}] }],
		});
		click(buttonByText(container, "Section 2"));
		expect(opened.at(-1)).toBe(1);
	});

	it("keeps a minimal song conformant when nothing optional is set", () => {
		const { calls } = renderOverview({ sections: [{ measures: [{}] }] });
		// No edits yet — the seeded song must already be conformant.
		expectSongConformant({ sections: [{ measures: [{}] }] });
		expect(calls).toHaveLength(0);
	});
});

describe("Breadcrumb", () => {
	it("renders one crumb per trail entry with the last non-interactive", () => {
		const { container } = render(
			createElement(Breadcrumb, {
				trail: ["Song", "Section 2", "Measure 3"],
				onNavigate: () => {},
			}),
		);
		// Two earlier crumbs are buttons; the current crumb is not.
		const buttons = [...container.querySelectorAll("button")];
		expect(buttons.map((button) => button.textContent)).toEqual([
			"Song",
			"Section 2",
		]);
		expect(container.textContent).toContain("Measure 3");
		expect(buttonByText(container, "Measure 3")).toBeUndefined();
		// The current crumb is marked for assistive tech.
		expect(container.querySelector('[aria-current="page"]').textContent).toBe(
			"Measure 3",
		);
	});

	it("navigates to a crumb's level when an earlier crumb is clicked", () => {
		const levels = [];
		const { container } = render(
			createElement(Breadcrumb, {
				trail: ["Song", "Section 2", "Measure 3"],
				onNavigate: (level) => levels.push(level),
			}),
		);
		click(buttonByText(container, "Song"));
		expect(levels.at(-1)).toBe(0);
		click(buttonByText(container, "Section 2"));
		expect(levels.at(-1)).toBe(1);
	});

	it("renders a single root crumb as the current view", () => {
		const { container } = render(
			createElement(Breadcrumb, { trail: ["Song"], onNavigate: () => {} }),
		);
		// A one-entry trail is the root view: no navigable crumbs.
		expect(container.querySelectorAll("button")).toHaveLength(0);
		expect(container.querySelector('[aria-current="page"]').textContent).toBe(
			"Song",
		);
	});
});
