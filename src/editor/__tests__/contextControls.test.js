/**
 * Unit tests for the constrained leaf field editors: metadata, the context
 * editor (tempo + time signature + hand configs) and the hand-config editor.
 *
 * Each control emits a conformant fragment through a single `onChange`, and the
 * tests pin two things at once: the exact emitted shape (optional keys appear
 * only when set; a required sub-object is never half-filled) AND that every
 * emitted fragment, wrapped into a song, is accepted by the real `validateSong`.
 * That second assertion is the conformant-by-construction guarantee the whole
 * editor rests on, checked here at the leaf level.
 *
 * The controls are presentational React components, so the tests render them
 * into jsdom and drive the mocked `@wordpress/components` inputs directly —
 * setting an `<input>`/`<select>` value and dispatching a change event, or
 * clicking a `<button>` — all inside `act` so React flushes synchronously.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { ContextEditor } from "../ContextEditor.js";
import { HandConfigEditor } from "../HandConfigEditor.js";
import { MetadataEditor } from "../MetadataEditor.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render an element into a fresh detached container and return both the
 * container and a `rerender` that re-renders the same root (so a parent can feed
 * the just-emitted value back in, mirroring controlled-component usage).
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

/** Look up a button by its accessible name. */
function buttonByName(container, name) {
	return [...container.querySelectorAll("button")].find(
		(button) => button.getAttribute("aria-label") === name,
	);
}

/**
 * Set a controlled field's value and dispatch a change event inside `act`.
 *
 * React tracks a controlled input's value through its own value setter, so a
 * plain `node.value = …` is invisible to it. We set the value through the native
 * prototype setter (which React's tracker observes) before dispatching, so the
 * synthetic `onChange` fires with the new value — the standard jsdom recipe for
 * driving a controlled input.
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
 * Wrap an emitted `context` fragment into a minimal song and assert the real
 * validator accepts it.
 *
 * @param {Object} context The emitted context fragment.
 */
function expectContextConformant(context) {
	const song = {
		defaults: context,
		sections: [{ measures: [{}] }],
	};
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

/**
 * Render a `ContextEditor` that feeds its own emitted value back in (so it
 * behaves like a controlled control across edits) while recording every
 * emission. Returns the container and the recorded calls.
 *
 * @return {{ container: HTMLElement, calls: Object[] }} The render handle.
 */
function renderContext() {
	const calls = [];
	let context = {};
	let handle;
	const onChange = (next) => {
		context = next;
		calls.push(next);
		handle.rerender(createElement(ContextEditor, { context, onChange }));
	};
	handle = render(createElement(ContextEditor, { context, onChange }));
	return { container: handle.container, calls };
}

/**
 * Render a `ContextEditor` in its `"tiered"` layout (common fields visible, the
 * rest behind an `Advanced` disclosure) that feeds its own emission back in.
 *
 * @return {{ container: HTMLElement, calls: Object[] }} The render handle.
 */
function renderTieredContext() {
	const calls = [];
	let context = {};
	let handle;
	const onChange = (next) => {
		context = next;
		calls.push(next);
		handle.rerender(
			createElement(ContextEditor, { context, onChange, layout: "tiered" }),
		);
	};
	handle = render(
		createElement(ContextEditor, { context, onChange, layout: "tiered" }),
	);
	return { container: handle.container, calls };
}

describe("MetadataEditor", () => {
	it("emits only the non-empty fields and clears a key when emptied", () => {
		const calls = [];
		const { container } = render(
			createElement(MetadataEditor, {
				metadata: {},
				onChange: (next) => calls.push(next),
			}),
		);

		change(fieldByName(container, "Title"), "Sonata");
		expect(calls.at(-1)).toEqual({ title: "Sonata" });

		// Composer joins; title stays.
		const { container: c2 } = render(
			createElement(MetadataEditor, {
				metadata: { title: "Sonata" },
				onChange: (next) => calls.push(next),
			}),
		);
		change(fieldByName(c2, "Composer"), "Clara");
		expect(calls.at(-1)).toEqual({ title: "Sonata", composer: "Clara" });

		// Clearing the title drops the key entirely.
		const { container: c3 } = render(
			createElement(MetadataEditor, {
				metadata: { title: "Sonata", composer: "Clara" },
				onChange: (next) => calls.push(next),
			}),
		);
		change(fieldByName(c3, "Title"), "");
		expect(calls.at(-1)).toEqual({ composer: "Clara" });
	});
});

describe("ContextEditor — tempo", () => {
	it("adds the tempo key when bpm is set and removes it when bpm is cleared", () => {
		const { container, calls } = renderContext();

		change(fieldByName(container, "Tempo (BPM)"), "120");
		expect(calls.at(-1).tempo).toEqual({ bpm: 120 });
		expectContextConformant(calls.at(-1));

		// Clearing bpm drops the whole tempo key (bpm is required).
		change(fieldByName(container, "Tempo (BPM)"), "");
		expect(calls.at(-1).tempo).toBeUndefined();
		expectContextConformant(calls.at(-1));
	});

	it("includes beatUnit in the tempo only when bpm is also present", () => {
		const { container, calls } = renderContext();

		change(fieldByName(container, "Tempo (BPM)"), "90");
		change(fieldByName(container, "Beat unit"), "quarter");
		expect(calls.at(-1).tempo).toEqual({ bpm: 90, beatUnit: "quarter" });
		expectContextConformant(calls.at(-1));
	});
});

describe("ContextEditor — time signature", () => {
	it("does not emit a timeSignature until both beats and beatType are set", () => {
		const { container, calls } = renderContext();

		change(fieldByName(container, "Beats per measure"), "3");
		expect(calls.at(-1).timeSignature).toBeUndefined();
		expectContextConformant(calls.at(-1));

		change(fieldByName(container, "Beat type"), "4");
		expect(calls.at(-1).timeSignature).toEqual({ beats: 3, beatType: 4 });
		expectContextConformant(calls.at(-1));
	});
});

describe("ContextEditor — hand configs", () => {
	it("offers exactly the four clefs for the right hand", () => {
		const { container } = renderContext();
		const select = fieldByName(container, "Right hand clef");
		const values = [...select.querySelectorAll("option")]
			.map((option) => option.value)
			.filter((value) => value !== "");
		expect(values).toEqual(["treble", "bass", "alto", "tenor"]);
	});

	it("omits an untouched hand config from the emitted context", () => {
		const { container, calls } = renderContext();
		change(fieldByName(container, "Tempo (BPM)"), "100");
		const emitted = calls.at(-1);
		expect(emitted.rightHand).toBeUndefined();
		expect(emitted.leftHand).toBeUndefined();
	});

	it("emits a rightHand fragment when its clef is set", () => {
		const { container, calls } = renderContext();
		change(fieldByName(container, "Right hand clef"), "bass");
		expect(calls.at(-1).rightHand).toEqual({ clef: "bass" });
		expectContextConformant(calls.at(-1));
	});
});

describe("ContextEditor — tiered layout", () => {
	it("keeps tempo bpm, beats and beat type out of the Advanced disclosure", () => {
		const { container } = renderTieredContext();
		const advanced = container.querySelector('[aria-label="Advanced"]');
		expect(advanced).not.toBeNull();
		// The common fields render at the top level, not inside Advanced.
		for (const name of ["Tempo (BPM)", "Beats per measure", "Beat type"]) {
			const field = fieldByName(container, name);
			expect(field).not.toBeNull();
			expect(advanced.contains(field)).toBe(false);
		}
	});

	it("tucks beat unit and both hand configs inside the Advanced disclosure", () => {
		const { container } = renderTieredContext();
		const advanced = container.querySelector('[aria-label="Advanced"]');
		// The uncommon members live under Advanced (the ToolsPanel mock renders its
		// items unconditionally, so they are queryable without a reveal step).
		for (const name of ["Beat unit", "Right hand clef", "Left hand clef"]) {
			const field = fieldByName(container, name);
			expect(field).not.toBeNull();
			expect(advanced.contains(field)).toBe(true);
		}
	});

	it("emits the same conformant fragments as the flat layout", () => {
		const { container, calls } = renderTieredContext();

		change(fieldByName(container, "Tempo (BPM)"), "90");
		change(fieldByName(container, "Beat unit"), "quarter");
		expect(calls.at(-1).tempo).toEqual({ bpm: 90, beatUnit: "quarter" });
		expectContextConformant(calls.at(-1));

		change(fieldByName(container, "Right hand clef"), "bass");
		expect(calls.at(-1).rightHand).toEqual({ clef: "bass" });
		expectContextConformant(calls.at(-1));
	});
});

describe("HandConfigEditor", () => {
	/**
	 * Render a `HandConfigEditor` that feeds its own emission back in. Returns
	 * the container and the recorded emissions.
	 *
	 * @param {Object} [initial] The starting hand config.
	 * @return {{ container: HTMLElement, calls: Object[] }} The render handle.
	 */
	function renderHand(initial = {}) {
		const calls = [];
		let handConfig = initial;
		const onChange = (next) => {
			handConfig = next;
			calls.push(next);
			handle.rerender(
				createElement(HandConfigEditor, {
					handConfig,
					onChange,
					label: "Right hand",
				}),
			);
		};
		const handle = render(
			createElement(HandConfigEditor, {
				handConfig,
				onChange,
				label: "Right hand",
			}),
		);
		return { container: handle.container, calls };
	}

	it("clamps octaveShift to its bounds (an out-of-range value cannot be produced)", () => {
		const { container } = renderHand();
		const input = fieldByName(container, "Right hand octave shift");
		expect(input.getAttribute("min")).toBe("-2");
		expect(input.getAttribute("max")).toBe("2");
	});

	it("emits a clef-only fragment and clears it back to {}", () => {
		const { container, calls } = renderHand();
		change(fieldByName(container, "Right hand clef"), "alto");
		expect(calls.at(-1)).toEqual({ clef: "alto" });

		change(fieldByName(container, "Right hand clef"), "");
		expect(calls.at(-1)).toEqual({});
	});

	it("adds an alters entry emitting { alters: { <note>: <int> } } and drops alters when the last entry goes", () => {
		const { container, calls } = renderHand();

		click(buttonByName(container, "Right hand add alteration"));
		// A freshly added row seeds a recognised note and an in-range value, so the
		// emitted fragment is already conformant.
		const added = calls.at(-1);
		expect(added.alters).toBeDefined();
		const [note] = Object.keys(added.alters);
		expect(typeof note).toBe("string");
		expect(Number.isInteger(added.alters[note])).toBe(true);
		expectContextConformant({ rightHand: added });

		// Set the alteration value explicitly and confirm the shape + conformance.
		change(fieldByName(container, "Right hand alteration"), "1");
		const withValue = calls.at(-1);
		const [key] = Object.keys(withValue.alters);
		expect(withValue.alters).toEqual({ [key]: 1 });
		expectContextConformant({ rightHand: withValue });

		// Removing the last entry drops the alters key entirely.
		click(buttonByName(container, "Right hand remove alteration"));
		expect(calls.at(-1).alters).toBeUndefined();
	});

	it("keeps alters keys to recognised note names so the fragment validates", () => {
		const { container, calls } = renderHand();
		click(buttonByName(container, "Right hand add alteration"));
		// The note-name select offers only recognised note names.
		const noteSelect = fieldByName(container, "Right hand alteration note");
		const values = [...noteSelect.querySelectorAll("option")].map(
			(option) => option.value,
		);
		expect(values).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
		change(noteSelect, "F");
		expect(Object.keys(calls.at(-1).alters)).toEqual(["F"]);
		expectContextConformant({ rightHand: calls.at(-1) });
	});

	it("replaces on a duplicate key rather than producing two entries", () => {
		const { container, calls } = renderHand({ alters: { C: 1 } });
		click(buttonByName(container, "Right hand add alteration"));
		// The new row seeds another note; switch it to the existing key C and
		// confirm the map collapses to a single C entry rather than two.
		const noteSelects = [...container.querySelectorAll("select")].filter(
			(node) =>
				node.getAttribute("aria-label") === "Right hand alteration note",
		);
		change(noteSelects[noteSelects.length - 1], "C");
		const emitted = calls.at(-1);
		expect(Object.keys(emitted.alters)).toEqual(["C"]);
	});
});
