/**
 * Unit tests for the pitch editor and `PitchList`.
 *
 * A pitch carries a required `step` and `octave` and an optional `alter`. The
 * tests pin three things the design rests on. First, `step` is edited through
 * the per-song note-name dropdown, so a Spanish-system editor offers `do…si`
 * and writing a step stores that system's spelling (`G`→`sol`). Second, an
 * untouched pitch keeps its original spelling verbatim — a `do` left alone is
 * still read as `do` until the author edits it — because nothing rewrites a
 * `step` until its `onChange` fires. Third, the numeric fields clamp to the
 * format's bounds, `alter: 0` is omitted from the emission, and a note keeps at
 * least one pitch (the last pitch's remove is disabled). Reordering is omitted
 * in this version, so the list offers only add/remove/edit. Each emitted pitch,
 * wrapped into a note in a song, is accepted by the real `validateSong` — the
 * conformant-by-construction guarantee checked at the pitch level, including a
 * Spanish round-trip.
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
import { PitchEditor } from "../PitchEditor.js";
import { PitchList } from "../PitchList.js";

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

/** Look up a button by its exact visible text content. */
function buttonByText(container, name) {
	return [...container.querySelectorAll("button")].find(
		(button) => button.textContent === name,
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
 * Wrap an emitted pitch into a single-pitch note in a minimal song and assert
 * the real validator accepts it.
 *
 * @param {Object} pitch The emitted pitch.
 */
function expectPitchConformant(pitch) {
	const song = {
		sections: [
			{
				measures: [
					{
						rightHand: [
							{ type: "note", duration: "quarter", pitches: [pitch] },
						],
					},
				],
			},
		],
	};
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

/**
 * Wrap a whole pitches array into a note in a minimal song and assert the real
 * validator accepts it.
 *
 * @param {Object[]} pitches The emitted pitches array.
 */
function expectPitchesConformant(pitches) {
	const song = {
		sections: [
			{
				measures: [
					{ rightHand: [{ type: "note", duration: "quarter", pitches }] },
				],
			},
		],
	};
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("PitchEditor", () => {
	/**
	 * Render a `PitchEditor` that feeds its own emission back in (so it behaves
	 * like a controlled control across edits) while recording every emission.
	 *
	 * @param {Object} initial The starting pitch.
	 * @param {string} system  The per-song note-name system.
	 * @return {{ container: HTMLElement, calls: Object[] }} The render handle.
	 */
	function renderEditor(initial, system) {
		const calls = [];
		let pitch = initial;
		let handle;
		const onChange = (next) => {
			pitch = next;
			calls.push(next);
			handle.rerender(createElement(PitchEditor, { pitch, system, onChange }));
		};
		handle = render(createElement(PitchEditor, { pitch, system, onChange }));
		return { container: handle.container, calls };
	}

	it("offers the Spanish spellings in a Spanish-system editor", () => {
		const { container } = renderEditor({ step: "do", octave: 4 }, "spanish");
		const step = fieldByName(container, "Note");
		const values = [...step.querySelectorAll("option")].map(
			(option) => option.value,
		);
		expect(values).toEqual(["do", "re", "mi", "fa", "sol", "la", "si"]);
	});

	it("writes the system spelling when the step changes (G → sol in Spanish)", () => {
		const { container, calls } = renderEditor(
			{ step: "do", octave: 4 },
			"spanish",
		);
		// The select's options are Spanish, so choosing the fifth degree writes
		// "sol" — the canonical G in the per-song system.
		change(fieldByName(container, "Note"), "sol");
		expect(calls.at(-1)).toEqual({ step: "sol", octave: 4 });
		expectPitchConformant(calls.at(-1));
	});

	it("shows an untouched cross-system step selected without rewriting it", () => {
		// English system but the stored step is the Spanish "do" (canonical C).
		// The select must show it selected (matched on canonical letter) yet the
		// component must NOT emit a rewrite until the author edits the pitch.
		const { container, calls } = renderEditor(
			{ step: "do", octave: 4 },
			"english",
		);
		const step = fieldByName(container, "Note");
		// "do" canonicalizes to C, so the C option is the selected one.
		expect(step.value).toBe("C");
		// No edit fired, so nothing was emitted: the stored "do" stands.
		expect(calls).toHaveLength(0);
	});

	it("clamps octave to its bounds", () => {
		const { container } = renderEditor({ step: "C", octave: 4 }, "english");
		const octave = fieldByName(container, "Octave");
		expect(octave.getAttribute("min")).toBe("0");
		expect(octave.getAttribute("max")).toBe("9");
	});

	// R-LR2: the Octave NumberControl carries an inline min-width so it does not
	// collapse when sharing the list-row flex container with the leading select.
	it("Octave NumberControl has a min-width of 4em (R-LR2)", () => {
		const { container } = renderEditor({ step: "C", octave: 4 }, "english");
		const octave = fieldByName(container, "Octave");
		expect(octave.style.minWidth).toBe("4em");
	});

	it("clamps alter to its bounds", () => {
		const { container } = renderEditor({ step: "C", octave: 4 }, "english");
		const alter = fieldByName(container, "Alteration");
		expect(alter.getAttribute("min")).toBe("-2");
		expect(alter.getAttribute("max")).toBe("2");
	});

	// R-LR2: the Alteration NumberControl carries an inline min-width so it does
	// not collapse when sharing the list-row flex container with the leading select.
	it("Alteration NumberControl has a min-width of 4em (R-LR2)", () => {
		const { container } = renderEditor({ step: "C", octave: 4 }, "english");
		const alter = fieldByName(container, "Alteration");
		expect(alter.style.minWidth).toBe("4em");
	});

	it("emits alter only when non-zero and omits it at zero", () => {
		const { container, calls } = renderEditor(
			{ step: "C", octave: 4 },
			"english",
		);

		change(fieldByName(container, "Alteration"), "1");
		expect(calls.at(-1)).toEqual({ step: "C", octave: 4, alter: 1 });
		expectPitchConformant(calls.at(-1));

		// Back to natural: the alter key is dropped, not emitted as 0.
		change(fieldByName(container, "Alteration"), "0");
		expect(calls.at(-1)).toEqual({ step: "C", octave: 4 });
		expect(calls.at(-1).alter).toBeUndefined();
		expectPitchConformant(calls.at(-1));
	});

	it("keeps step and octave present when the octave changes", () => {
		const { container, calls } = renderEditor(
			{ step: "C", octave: 4 },
			"english",
		);
		change(fieldByName(container, "Octave"), "5");
		expect(calls.at(-1)).toEqual({ step: "C", octave: 5 });
		expectPitchConformant(calls.at(-1));
	});
});

describe("PitchList", () => {
	/**
	 * Render a `PitchList` that feeds its own emission back in (so the list
	 * behaves like a controlled control across edits) while recording every
	 * emission.
	 *
	 * @param {Object[]} initial The starting pitches array.
	 * @param {string}   system  The per-song note-name system.
	 * @return {{ container: HTMLElement, calls: any[] }} The render handle.
	 */
	function renderList(initial, system) {
		const calls = [];
		let pitches = initial;
		let handle;
		const onChange = (next) => {
			pitches = next;
			calls.push(next);
			handle.rerender(createElement(PitchList, { pitches, system, onChange }));
		};
		handle = render(createElement(PitchList, { pitches, system, onChange }));
		return { container: handle.container, calls };
	}

	it("disables removal of the last (only) pitch", () => {
		const { container } = renderList([{ step: "C", octave: 4 }], "english");
		const remove = buttonByName(container, "Remove pitch");
		expect(remove.disabled).toBe(true);
	});

	it("allows removal once there is more than one pitch", () => {
		const { container } = renderList(
			[
				{ step: "C", octave: 4 },
				{ step: "E", octave: 4 },
			],
			"english",
		);
		const removes = [...container.querySelectorAll("button")].filter(
			(button) => button.getAttribute("aria-label") === "Remove pitch",
		);
		expect(removes.every((button) => button.disabled)).toBe(false);
	});

	it("appends a new pitch in the per-song system (first name, octave 4)", () => {
		const { container, calls } = renderList(
			[{ step: "do", octave: 4 }],
			"spanish",
		);
		click(buttonByText(container, "Add pitch"));
		// The seeded pitch uses the system's first name; octave 4.
		expect(calls.at(-1)).toEqual([
			{ step: "do", octave: 4 },
			{ step: "do", octave: 4 },
		]);
		expectPitchesConformant(calls.at(-1));
	});

	it("removes a pitch down to (but not below) one", () => {
		const { container, calls } = renderList(
			[
				{ step: "C", octave: 4 },
				{ step: "E", octave: 4 },
			],
			"english",
		);
		click(buttonByName(container, "Remove pitch"));
		expect(calls.at(-1)).toEqual([{ step: "E", octave: 4 }]);
		expectPitchesConformant(calls.at(-1));
	});

	it("leaves an untouched Spanish pitch as-is until it is edited (round-trip)", () => {
		// A Spanish-system list holding "do": nothing is edited, so the original
		// spelling stands and the list (wrapped in a note) validates unchanged.
		const { calls } = renderList([{ step: "do", octave: 4 }], "spanish");
		expect(calls).toHaveLength(0);
		expectPitchesConformant([{ step: "do", octave: 4 }]);
	});

	it("edits a single pitch in place, leaving its siblings untouched", () => {
		const { container, calls } = renderList(
			[
				{ step: "C", octave: 4 },
				{ step: "E", octave: 4 },
			],
			"english",
		);
		// Edit the second pitch's octave; the first must stay verbatim.
		const octaves = [...container.querySelectorAll("input")].filter(
			(input) => input.getAttribute("aria-label") === "Octave",
		);
		change(octaves[1], "5");
		expect(calls.at(-1)).toEqual([
			{ step: "C", octave: 4 },
			{ step: "E", octave: 5 },
		]);
		expectPitchesConformant(calls.at(-1));
	});

	// S4 className hook: each pitch-row HStack carries the __list-row class so
	// the top-level editor.scss rule can target it (the HStack mock spreads
	// ...rest onto the <div>, so className reaches the DOM).
	it("pitch rows carry the __list-row className hook (S4 CSS engagement)", () => {
		const { container } = renderList([{ step: "C", octave: 4 }], "english");
		expect(
			container.querySelector(".wp-block-piano-block-piano__list-row"),
		).not.toBeNull();
	});
});
