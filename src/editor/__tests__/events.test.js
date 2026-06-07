/**
 * Unit tests for the event editor stack — `EventRow`, `EventList` and
 * `EventEditor`.
 *
 * An event carries a required `type` and `duration` plus a handful of optional
 * fields (`dots`, `dynamic`, the four spans `tie`/`slur`/`crescendo`/
 * `decrescendo`, `pitches` and event `annotations`). The tests pin the rules the
 * design rests on. First, the optional fields omit their key when unset and set
 * it — and only ever to an enum value — when chosen: `dots` is omitted at 0, the
 * `dynamic` and the four span selects offer an empty option that drops the key,
 * and a chosen value is one of the schema's enums. Second, `type` and `duration`
 * are always present. Third, switching `note`→`rest` drops `pitches` (a rest has
 * none), and switching `rest`→`note` seeds exactly one pitch (the note
 * invariant). Fourth, `EventList` appends new notes/rests, reorders and removes
 * rows, and collapses an empty hand to `undefined` so the parent drops the key.
 * Fifth, `EventEditor` drills into a single event's chord `pitches` (only for a
 * note) and its event `annotations`. Every resulting event, wrapped into a
 * measure/section/song, is accepted by the real `validateSong` — the
 * conformant-by-construction guarantee checked at the event level, including a
 * `note` so the non-empty-pitches invariant is exercised.
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
import { EventEditor } from "../EventEditor.js";
import { EventList } from "../EventList.js";
import { EventRow } from "../EventRow.js";

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

/** Look up a button by its accessible name. */
function buttonByName(container, name) {
	return [...container.querySelectorAll("button")].find(
		(button) => button.getAttribute("aria-label") === name,
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
 * Wrap an emitted event into a measure/section/song and assert the real
 * validator accepts it.
 *
 * @param {Object} event The emitted event.
 */
function expectEventConformant(event) {
	const song = {
		sections: [{ measures: [{ rightHand: [event] }] }],
	};
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

/**
 * Wrap a whole events array into a hand in a measure/section/song and assert the
 * real validator accepts it.
 *
 * @param {Object[]} events The emitted events array.
 */
function expectEventsConformant(events) {
	const song = {
		sections: [{ measures: [{ rightHand: events }] }],
	};
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("EventRow", () => {
	/**
	 * Render an `EventRow` that feeds its own emission back in (so it behaves
	 * like a controlled control across edits) while recording every emission.
	 *
	 * @param {Object} initial The starting event.
	 * @param {string} system  The per-song note-name system.
	 * @return {{ container: HTMLElement, calls: Object[] }} The render handle.
	 */
	function renderRow(initial, system = "english") {
		const calls = [];
		let event = initial;
		let handle;
		const onChange = (next) => {
			event = next;
			calls.push(next);
			handle.rerender(
				createElement(EventRow, {
					event,
					system,
					index: 0,
					count: 1,
					onChange,
					onMoveUp: () => {},
					onMoveDown: () => {},
					onRemove: () => {},
					onDrillIn: () => {},
				}),
			);
		};
		handle = render(
			createElement(EventRow, {
				event,
				system,
				index: 0,
				count: 1,
				onChange,
				onMoveUp: () => {},
				onMoveDown: () => {},
				onRemove: () => {},
				onDrillIn: () => {},
			}),
		);
		return { container: handle.container, calls };
	}

	it("offers exactly the event types and durations", () => {
		const { container } = renderRow({ type: "rest", duration: "quarter" });
		const types = [
			...fieldByName(container, "Event type").querySelectorAll("option"),
		].map((option) => option.value);
		expect(types).toEqual(["note", "rest"]);
		const durations = [
			...fieldByName(container, "Duration").querySelectorAll("option"),
		].map((option) => option.value);
		expect(durations).toEqual([
			"whole",
			"half",
			"quarter",
			"eighth",
			"sixteenth",
			"thirty-second",
		]);
	});

	it("drops pitches when switching note → rest", () => {
		const { container, calls } = renderRow({
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 4 }],
		});
		change(fieldByName(container, "Event type"), "rest");
		expect(calls.at(-1)).toEqual({ type: "rest", duration: "quarter" });
		expect(calls.at(-1).pitches).toBeUndefined();
		expectEventConformant(calls.at(-1));
	});

	it("seeds exactly one pitch when switching rest → note", () => {
		const { container, calls } = renderRow({
			type: "rest",
			duration: "quarter",
		});
		change(fieldByName(container, "Event type"), "note");
		const next = calls.at(-1);
		expect(next.type).toBe("note");
		expect(next.duration).toBe("quarter");
		expect(next.pitches).toHaveLength(1);
		expectEventConformant(next);
	});

	it("seeds the pitch in the per-song system on rest → note (Spanish)", () => {
		const { container, calls } = renderRow(
			{ type: "rest", duration: "quarter" },
			"spanish",
		);
		change(fieldByName(container, "Event type"), "note");
		// The seeded pitch uses the system's first name; octave 4.
		expect(calls.at(-1).pitches).toEqual([{ step: "do", octave: 4 }]);
		expectEventConformant(calls.at(-1));
	});

	it("always keeps type and duration when the duration changes", () => {
		const { container, calls } = renderRow({
			type: "rest",
			duration: "quarter",
		});
		change(fieldByName(container, "Duration"), "eighth");
		expect(calls.at(-1)).toEqual({ type: "rest", duration: "eighth" });
		expectEventConformant(calls.at(-1));
	});

	it("omits dots at zero and sets it (bounded) when chosen", () => {
		const { container, calls } = renderRow({
			type: "rest",
			duration: "quarter",
		});
		const dots = fieldByName(container, "Dots");
		expect(dots.getAttribute("min")).toBe("0");
		expect(dots.getAttribute("max")).toBe("2");

		change(dots, "1");
		expect(calls.at(-1)).toEqual({
			type: "rest",
			duration: "quarter",
			dots: 1,
		});
		expectEventConformant(calls.at(-1));

		// Back to zero: the dots key is dropped, not emitted as 0.
		change(fieldByName(container, "Dots"), "0");
		expect(calls.at(-1)).toEqual({ type: "rest", duration: "quarter" });
		expect(calls.at(-1).dots).toBeUndefined();
		expectEventConformant(calls.at(-1));
	});

	it("omits the dynamic key when unset and sets it to an enum value when chosen", () => {
		const { container, calls } = renderRow({
			type: "rest",
			duration: "quarter",
		});
		const dynamic = fieldByName(container, "Dynamic");
		// An empty option is offered to unset.
		const values = [...dynamic.querySelectorAll("option")].map(
			(option) => option.value,
		);
		expect(values).toContain("");
		expect(values).toEqual(
			expect.arrayContaining(["pp", "p", "mp", "mf", "f", "ff", "sf", "sfz"]),
		);

		change(dynamic, "mf");
		expect(calls.at(-1)).toEqual({
			type: "rest",
			duration: "quarter",
			dynamic: "mf",
		});
		expectEventConformant(calls.at(-1));

		// Back to the empty option: the dynamic key is dropped.
		change(fieldByName(container, "Dynamic"), "");
		expect(calls.at(-1)).toEqual({ type: "rest", duration: "quarter" });
		expect(calls.at(-1).dynamic).toBeUndefined();
		expectEventConformant(calls.at(-1));
	});

	it.each([
		"tie",
		"slur",
		"crescendo",
		"decrescendo",
	])("omits %s when unset and sets it to an enum value when chosen", (field) => {
		const label = field[0].toUpperCase() + field.slice(1);
		const { container, calls } = renderRow({
			type: "rest",
			duration: "quarter",
		});
		const select = fieldByName(container, label);
		const values = [...select.querySelectorAll("option")].map(
			(option) => option.value,
		);
		// An empty option to unset, plus exactly the span states.
		expect(values).toEqual(["", "start", "stop"]);

		change(select, "start");
		expect(calls.at(-1)).toEqual({
			type: "rest",
			duration: "quarter",
			[field]: "start",
		});
		expectEventConformant(calls.at(-1));

		// Back to the empty option: the key is dropped.
		change(fieldByName(container, label), "");
		expect(calls.at(-1)).toEqual({ type: "rest", duration: "quarter" });
		expect(calls.at(-1)[field]).toBeUndefined();
		expectEventConformant(calls.at(-1));
	});

	it("preserves event annotations when switching note → rest (they stay valid)", () => {
		const { container, calls } = renderRow({
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 4 }],
			annotations: [{ text: "x", placement: "above" }],
		});
		change(fieldByName(container, "Event type"), "rest");
		expect(calls.at(-1)).toEqual({
			type: "rest",
			duration: "quarter",
			annotations: [{ text: "x", placement: "above" }],
		});
		expectEventConformant(calls.at(-1));
	});

	it("invokes onDrillIn from the drill-in button", () => {
		let drilled = false;
		const handle = render(
			createElement(EventRow, {
				event: {
					type: "note",
					duration: "quarter",
					pitches: [{ step: "C", octave: 4 }],
				},
				system: "english",
				index: 0,
				count: 1,
				onChange: () => {},
				onMoveUp: () => {},
				onMoveDown: () => {},
				onRemove: () => {},
				onDrillIn: () => {
					drilled = true;
				},
			}),
		);
		click(buttonByName(handle.container, "Edit event details"));
		expect(drilled).toBe(true);
	});
});

describe("EventList", () => {
	/**
	 * Render an `EventList` that feeds its own emission back in (so the list
	 * behaves like a controlled control across edits) while recording every
	 * emission.
	 *
	 * @param {Object[]} initial The starting events array.
	 * @param {string}   system  The per-song note-name system.
	 * @return {{ container: HTMLElement, calls: any[] }} The render handle.
	 */
	function renderList(initial, system = "english") {
		const calls = [];
		let events = initial;
		let handle;
		const onChange = (next) => {
			// Mirror a parent that drops the key on `undefined`: keep an array so the
			// list can keep rendering, but record exactly what was emitted.
			events = next ?? [];
			calls.push(next);
			handle.rerender(
				createElement(EventList, {
					events,
					system,
					onChange,
					label: "Right hand",
				}),
			);
		};
		handle = render(
			createElement(EventList, {
				events,
				system,
				onChange,
				label: "Right hand",
			}),
		);
		return { container: handle.container, calls };
	}

	it("renders its label", () => {
		const { container } = renderList([{ type: "rest", duration: "quarter" }]);
		expect(container.textContent).toContain("Right hand");
	});

	it("appends a new note", () => {
		const { container, calls } = renderList([]);
		click(buttonByName(container, "Add note"));
		const next = calls.at(-1);
		expect(next).toHaveLength(1);
		expect(next[0].type).toBe("note");
		expect(next[0].pitches).toHaveLength(1);
		expectEventsConformant(next);
	});

	it("appends a new rest", () => {
		const { container, calls } = renderList([]);
		click(buttonByName(container, "Add rest"));
		const next = calls.at(-1);
		expect(next).toHaveLength(1);
		expect(next[0]).toEqual({ type: "rest", duration: "quarter" });
		expectEventsConformant(next);
	});

	it("seeds an added note in the per-song system (Spanish)", () => {
		const { container, calls } = renderList([], "spanish");
		click(buttonByName(container, "Add note"));
		expect(calls.at(-1)[0].pitches).toEqual([{ step: "do", octave: 4 }]);
		expectEventsConformant(calls.at(-1));
	});

	it("removes a row, collapsing the empty hand to undefined", () => {
		const { calls } = renderList([{ type: "rest", duration: "quarter" }]);
		// First locate the single remove button from the initial render.
		const handle = render(
			createElement(EventList, {
				events: [{ type: "rest", duration: "quarter" }],
				system: "english",
				onChange: (next) => calls.push(next),
				label: "Right hand",
			}),
		);
		click(buttonByName(handle.container, "Remove event"));
		expect(calls.at(-1)).toBeUndefined();
	});

	it("reorders events when a row is moved", () => {
		const { container, calls } = renderList([
			{
				type: "note",
				duration: "quarter",
				pitches: [{ step: "C", octave: 4 }],
			},
			{ type: "rest", duration: "eighth" },
		]);
		click(buttonByName(container, "Move event down"));
		expect(calls.at(-1)).toEqual([
			{ type: "rest", duration: "eighth" },
			{
				type: "note",
				duration: "quarter",
				pitches: [{ step: "C", octave: 4 }],
			},
		]);
		expectEventsConformant(calls.at(-1));
	});

	it("edits a single event in place, leaving its siblings untouched", () => {
		const { container, calls } = renderList([
			{ type: "rest", duration: "quarter" },
			{ type: "rest", duration: "eighth" },
		]);
		const durations = [...container.querySelectorAll("select")].filter(
			(select) => select.getAttribute("aria-label") === "Duration",
		);
		change(durations[1], "half");
		expect(calls.at(-1)).toEqual([
			{ type: "rest", duration: "quarter" },
			{ type: "rest", duration: "half" },
		]);
		expectEventsConformant(calls.at(-1));
	});
});

describe("EventEditor", () => {
	/**
	 * Render an `EventEditor` that feeds its own emission back in while recording
	 * every emission.
	 *
	 * @param {Object} initial The starting event.
	 * @param {string} system  The per-song note-name system.
	 * @return {{ container: HTMLElement, calls: Object[], back: number }} Handle.
	 */
	function renderEditor(initial, system = "english") {
		const calls = [];
		const state = { back: 0 };
		let event = initial;
		let handle;
		const onBack = () => {
			state.back += 1;
		};
		const onChange = (next) => {
			event = next;
			calls.push(next);
			handle.rerender(
				createElement(EventEditor, { event, system, onChange, onBack }),
			);
		};
		handle = render(
			createElement(EventEditor, { event, system, onChange, onBack }),
		);
		return { container: handle.container, calls, state };
	}

	it("shows the pitch list only for a note", () => {
		const note = renderEditor({
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 4 }],
		});
		expect(fieldByName(note.container, "Note name")).not.toBeNull();

		const rest = renderEditor({ type: "rest", duration: "quarter" });
		expect(fieldByName(rest.container, "Note name")).toBeNull();
	});

	it("edits chord pitches through the pitch list", () => {
		const { container, calls } = renderEditor({
			type: "note",
			duration: "quarter",
			pitches: [{ step: "C", octave: 4 }],
		});
		click(buttonByName(container, "Add pitch"));
		expect(calls.at(-1).pitches).toEqual([
			{ step: "C", octave: 4 },
			{ step: "C", octave: 4 },
		]);
		expectEventConformant(calls.at(-1));
	});

	it("adds and removes event annotations, dropping the key when emptied", () => {
		const { container, calls } = renderEditor({
			type: "rest",
			duration: "quarter",
		});
		click(buttonByName(container, "Add annotation"));
		expect(calls.at(-1).annotations).toHaveLength(1);
		expectEventConformant(calls.at(-1));

		click(buttonByName(container, "Remove annotation"));
		expect(calls.at(-1)).toEqual({ type: "rest", duration: "quarter" });
		expect(calls.at(-1).annotations).toBeUndefined();
		expectEventConformant(calls.at(-1));
	});

	it("invokes onBack from the back affordance", () => {
		const { container, state } = renderEditor({
			type: "rest",
			duration: "quarter",
		});
		click(buttonByName(container, "Back to events"));
		expect(state.back).toBe(1);
	});
});
