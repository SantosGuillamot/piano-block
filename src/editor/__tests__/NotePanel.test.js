/**
 * Unit tests for the selected-event **Note** inspector panel.
 *
 * `NotePanel` is a pure controlled component: it edits the resolved selection in
 * place and emits the next whole working `song` through `onChange`. These tests
 * pin two things at once — the exact emitted shape (the cross-field note↔rest
 * rule; optional keys appear only when set and drop when cleared; the chord is
 * edited through `PitchList`) AND that every emitted song is accepted by the real
 * `validateSong`, the conformant-by-construction guarantee the panel rests on.
 * They also cover the structural **Remove note** button, which signals
 * `onRemoveNote` with the selection's own coords — the parent owns the splice and
 * the selection clear — and the contextual **Add note** button, which signals
 * `onAddNote` with the selection's own coords — the hand is inferred from the
 * selection, never prompted (AC3).
 *
 * The panel is presentational, so the tests render it into jsdom and drive the
 * mocked `@wordpress/components` controls directly — setting an `<input>`/
 * `<select>` value and dispatching a change, or clicking a `<button>` — all
 * inside `act`. The `ToolsPanel` mock renders its items' contents unconditionally,
 * so the disclosed (advanced) controls are present in the DOM without a reveal
 * step.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { NotePanel } from "../inspector/NotePanel.js";
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
 * The default fixture: a one-section song whose single measure has a right-hand
 * note (a single C4) followed by a rest, so the selection points at index 0.
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
							{ type: "rest", duration: "quarter" },
						],
					},
				],
			},
		],
	};
}

/**
 * Render a `NotePanel` over a selection that feeds its own emitted song back in
 * (so it behaves like a controlled control across edits), re-resolving the
 * selection against each emission and recording every one.
 *
 * @param {Object} [options]
 * @param {Object} [options.song]      The starting working song.
 * @param {Object} [options.selection] The raw selection coordinates.
 * @return {{ container: HTMLElement, calls: Object[], removed: Object[],
 *   added: Object[] }} Handle.
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
	const removed = [];
	const added = [];
	let song = initialSong;
	let handle;
	const props = () => ({
		song,
		selection: resolveSelection(song, selection),
		system: "english",
		onChange,
		onRemoveNote: (...args) => {
			removed.push(args);
		},
		onAddNote: (...args) => {
			added.push(args);
		},
	});
	function onChange(next) {
		song = next;
		calls.push(next);
		// A removal can leave the selection stale; only re-render the panel while
		// the selection still resolves (the parent would unmount it otherwise).
		if (resolveSelection(song, selection)) {
			handle.rerender(createElement(NotePanel, props()));
		}
	}
	handle = render(createElement(NotePanel, props()));
	return { container: handle.container, calls, removed, added };
}

/** Assert the real validator accepts the emitted working song. */
function expectConformant(song) {
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("NotePanel — required fields", () => {
	it("renders the type, duration and pitch controls for a note selection", () => {
		const { container } = renderPanel();
		expect(fieldByName(container, "Event type")).not.toBeNull();
		expect(fieldByName(container, "Duration")).not.toBeNull();
		// PitchList renders a per-pitch note-name select; a note shows one.
		expect(container.querySelector('[aria-label="Note name"]')).not.toBeNull();
	});

	it("changes the duration and the song validates", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Duration"), "half");
		expect(calls.at(-1).sections[0].measures[0].rightHand[0].duration).toBe(
			"half",
		);
		expectConformant(calls.at(-1));
	});
});

describe("NotePanel — note↔rest cross-field rule", () => {
	it("drops pitches when switching a note to a rest", () => {
		const { container, calls } = renderPanel();
		change(fieldByName(container, "Event type"), "rest");
		const event = calls.at(-1).sections[0].measures[0].rightHand[0];
		expect(event.type).toBe("rest");
		expect(event.pitches).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("seeds one pitch when switching a rest to a note", () => {
		const { container, calls } = renderPanel({
			selection: {
				sectionIndex: 0,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 1,
			},
		});
		change(fieldByName(container, "Event type"), "note");
		const event = calls.at(-1).sections[0].measures[0].rightHand[1];
		expect(event.type).toBe("note");
		expect(event.pitches).toHaveLength(1);
		expectConformant(calls.at(-1));
	});
});

describe("NotePanel — pitch list", () => {
	it("adds a chord pitch through PitchList and the song validates", () => {
		const { container, calls } = renderPanel();
		click(buttonByText(container, "Add pitch"));
		expect(
			calls.at(-1).sections[0].measures[0].rightHand[0].pitches,
		).toHaveLength(2);
		expectConformant(calls.at(-1));
	});
});

describe("NotePanel — advanced disclosure (omit-when-unset)", () => {
	it("adds a dynamic key when set and drops it when cleared", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Dynamic"), "mf");
		expect(calls.at(-1).sections[0].measures[0].rightHand[0].dynamic).toBe(
			"mf",
		);
		expectConformant(calls.at(-1));

		change(fieldByName(container, "Dynamic"), "");
		expect(
			calls.at(-1).sections[0].measures[0].rightHand[0].dynamic,
		).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("adds a span (tie) and drops it when cleared", () => {
		const { container, calls } = renderPanel();

		change(fieldByName(container, "Tie"), "start");
		expect(calls.at(-1).sections[0].measures[0].rightHand[0].tie).toBe("start");
		expectConformant(calls.at(-1));

		change(fieldByName(container, "Tie"), "");
		expect(
			calls.at(-1).sections[0].measures[0].rightHand[0].tie,
		).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("hosts the event annotations list under the advanced disclosure", () => {
		const { container, calls } = renderPanel();
		click(buttonByText(container, "Add annotation"));
		const event = calls.at(-1).sections[0].measures[0].rightHand[0];
		expect(event.annotations).toHaveLength(1);
		expectConformant(calls.at(-1));
	});

	it("adds the numeric dots key when set and drops it at zero", () => {
		const { container, calls } = renderPanel();

		// The dots NumberControl is a numeric (not enum) optional field: a nonzero
		// value sets the key, and clamping back to zero drops it (omit-when-unset).
		change(fieldByName(container, "Dots"), "1");
		expect(calls.at(-1).sections[0].measures[0].rightHand[0].dots).toBe(1);
		expectConformant(calls.at(-1));

		change(fieldByName(container, "Dots"), "0");
		expect(
			calls.at(-1).sections[0].measures[0].rightHand[0].dots,
		).toBeUndefined();
		expectConformant(calls.at(-1));
	});

	it("clamps an over-range dots value to the schema max", () => {
		const { container, calls } = renderPanel();
		// A value past the max clamps into range so the control can never emit a
		// non-conformant number.
		change(fieldByName(container, "Dots"), "9");
		expect(calls.at(-1).sections[0].measures[0].rightHand[0].dots).toBe(2);
		expectConformant(calls.at(-1));
	});
});

describe("NotePanel — rest selection", () => {
	it("omits the pitch list for a rest event", () => {
		const { container } = renderPanel({
			selection: {
				sectionIndex: 0,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 1,
			},
		});
		// A rest still shows type/duration but has no chord, so PitchList's
		// per-pitch note-name select is absent.
		expect(fieldByName(container, "Event type")).not.toBeNull();
		expect(fieldByName(container, "Duration")).not.toBeNull();
		expect(container.querySelector('[aria-label="Note name"]')).toBeNull();
	});
});

describe("NotePanel — add note", () => {
	it("calls onAddNote with the selection's coords and inferred hand", () => {
		const { container, added } = renderPanel();
		click(buttonByText(container, "Add note"));
		// The hand is the selection's own hand — inferred, never prompted (AC3).
		expect(added).toEqual([[0, 0, "rightHand"]]);
	});

	it("infers the left hand when a left-hand event is selected", () => {
		const { container, added } = renderPanel({
			song: {
				sections: [
					{
						measures: [
							{
								leftHand: [
									{
										type: "note",
										duration: "quarter",
										pitches: [{ step: "C", octave: 3 }],
									},
								],
							},
						],
					},
				],
			},
			selection: {
				sectionIndex: 0,
				measureIndex: 0,
				hand: "leftHand",
				eventIndex: 0,
			},
		});
		click(buttonByText(container, "Add note"));
		expect(added).toEqual([[0, 0, "leftHand"]]);
	});
});

describe("NotePanel — remove note", () => {
	it("signals onRemoveNote with the selection's coords (the parent owns the splice)", () => {
		// The panel no longer splices locally: Remove note signals the lifted
		// handler with the selection's `(sectionIndex, measureIndex, hand,
		// eventIndex)`; the parent removes the event, drops an emptied hand, and
		// clears the now-stale selection (covered in `Edit.test.js`).
		const { container, calls, removed } = renderPanel();
		click(buttonByText(container, "Remove note"));
		expect(removed).toEqual([[0, 0, "rightHand", 0]]);
		// No song is emitted from the panel — the remove flows through the parent.
		expect(calls).toHaveLength(0);
	});

	it("signals onRemoveNote with a left-hand event's own coords", () => {
		const { container, removed } = renderPanel({
			song: {
				sections: [
					{
						measures: [
							{
								leftHand: [
									{
										type: "note",
										duration: "quarter",
										pitches: [{ step: "C", octave: 3 }],
									},
									{ type: "rest", duration: "quarter" },
								],
							},
						],
					},
				],
			},
			selection: {
				sectionIndex: 0,
				measureIndex: 0,
				hand: "leftHand",
				eventIndex: 1,
			},
		});
		click(buttonByText(container, "Remove note"));
		expect(removed).toEqual([[0, 0, "leftHand", 1]]);
	});
});
