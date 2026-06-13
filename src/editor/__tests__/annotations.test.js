/**
 * Unit tests for the annotation editors and `AnnotationList`.
 *
 * Two annotation kinds share one editor: event-anchored annotations (`text`,
 * `placement`) and standalone measure annotations (`text`, `placement`,
 * `staff`). Every field these kinds carry is required by the schema, so the
 * editor must always keep them present — an empty `text` is a conformant empty
 * string, not an absent field. The tests pin that always-present shape per kind,
 * pin the add/remove behavior of the list (including that emptying the list
 * signals removal so an empty `annotations` array is never serialized), and —
 * the conformant-by-construction guarantee — wrap each emitted annotation into a
 * host event/measure and assert the real `validateSong` accepts it. Reordering
 * is omitted in this version, so the list offers only add/remove/edit.
 *
 * The editors are presentational React components, so the tests render them into
 * jsdom and drive the mocked `@wordpress/components` inputs directly — setting a
 * `<textarea>`/`<select>` value and dispatching a change event, or clicking a
 * `<button>` — all inside `act` so React flushes synchronously.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import validateSong from "../../song/validate.js";
import { AnnotationEditor } from "../AnnotationEditor.js";
import { AnnotationList } from "../AnnotationList.js";

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

/** Look up an input/select/textarea by its accessible name (`aria-label`). */
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
	let prototype;
	if (node.tagName === "SELECT") {
		prototype = window.HTMLSelectElement.prototype;
	} else if (node.tagName === "TEXTAREA") {
		prototype = window.HTMLTextAreaElement.prototype;
	} else {
		prototype = window.HTMLInputElement.prototype;
	}
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
 * Wrap an event annotation onto a host event and assert the validator accepts
 * the resulting song.
 *
 * @param {Object} annotation The emitted event annotation.
 */
function expectEventAnnotationConformant(annotation) {
	const song = {
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "rest",
								duration: "quarter",
								annotations: [annotation],
							},
						],
					},
				],
			},
		],
	};
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

/**
 * Wrap a standalone annotation onto a host measure and assert the validator
 * accepts the resulting song.
 *
 * @param {Object} annotation The emitted standalone annotation.
 */
function expectStandaloneAnnotationConformant(annotation) {
	const song = {
		sections: [{ measures: [{ annotations: [annotation] }] }],
	};
	expect(validateSong(JSON.stringify(song))).toEqual([]);
}

describe("AnnotationEditor", () => {
	/**
	 * Render an `AnnotationEditor` that feeds its own emission back in (so it
	 * behaves like a controlled control across edits) while recording every
	 * emission. Returns the container and the recorded calls.
	 *
	 * @param {string} kind    `"event"` or `"standalone"`.
	 * @param {Object} initial The starting annotation.
	 * @return {{ container: HTMLElement, calls: Object[] }} The render handle.
	 */
	function renderEditor(kind, initial) {
		const calls = [];
		let annotation = initial;
		let handle;
		const onChange = (next) => {
			annotation = next;
			calls.push(next);
			handle.rerender(
				createElement(AnnotationEditor, { annotation, kind, onChange }),
			);
		};
		handle = render(
			createElement(AnnotationEditor, { annotation, kind, onChange }),
		);
		return { container: handle.container, calls };
	}

	it("keeps an event annotation carrying both text and placement", () => {
		const { container, calls } = renderEditor("event", {
			text: "",
			placement: "above",
		});

		change(fieldByName(container, "Annotation text"), "cresc.");
		expect(calls.at(-1)).toEqual({ text: "cresc.", placement: "above" });
		expectEventAnnotationConformant(calls.at(-1));

		change(fieldByName(container, "Annotation placement"), "below");
		expect(calls.at(-1)).toEqual({ text: "cresc.", placement: "below" });
		expectEventAnnotationConformant(calls.at(-1));
	});

	it("keeps text present (as an empty string) when text is cleared", () => {
		const { container, calls } = renderEditor("event", {
			text: "cresc.",
			placement: "above",
		});
		change(fieldByName(container, "Annotation text"), "");
		expect(calls.at(-1)).toEqual({ text: "", placement: "above" });
		expectEventAnnotationConformant(calls.at(-1));
	});

	it("offers exactly the two placements and no staff for an event annotation", () => {
		const { container } = renderEditor("event", {
			text: "",
			placement: "above",
		});
		const placement = fieldByName(container, "Annotation placement");
		const values = [...placement.querySelectorAll("option")].map(
			(option) => option.value,
		);
		expect(values).toEqual(["above", "below"]);
		expect(fieldByName(container, "Annotation staff")).toBeNull();
	});

	it("keeps a standalone annotation carrying text, placement and staff", () => {
		const { container, calls } = renderEditor("standalone", {
			text: "",
			placement: "above",
			staff: "rightHand",
		});

		change(fieldByName(container, "Annotation text"), "rit.");
		expect(calls.at(-1)).toEqual({
			text: "rit.",
			placement: "above",
			staff: "rightHand",
		});
		expectStandaloneAnnotationConformant(calls.at(-1));

		change(fieldByName(container, "Annotation staff"), "leftHand");
		expect(calls.at(-1)).toEqual({
			text: "rit.",
			placement: "above",
			staff: "leftHand",
		});
		expectStandaloneAnnotationConformant(calls.at(-1));
	});

	it("offers exactly the two staves for a standalone annotation", () => {
		const { container } = renderEditor("standalone", {
			text: "",
			placement: "above",
			staff: "rightHand",
		});
		const staff = fieldByName(container, "Annotation staff");
		const values = [...staff.querySelectorAll("option")].map(
			(option) => option.value,
		);
		expect(values).toEqual(["rightHand", "leftHand"]);
	});
});

describe("AnnotationList", () => {
	/**
	 * Render an `AnnotationList` that feeds its own emission back in (so the list
	 * behaves like a controlled control across edits) while recording every
	 * emission. Returns the container and the recorded calls.
	 *
	 * @param {string}   kind    `"event"` or `"standalone"`.
	 * @param {Object[]} initial The starting annotations array.
	 * @return {{ container: HTMLElement, calls: any[] }} The render handle.
	 */
	function renderList(kind, initial = []) {
		const calls = [];
		let annotations = initial;
		let handle;
		const onChange = (next) => {
			// A removal signal (undefined) leaves the list empty for re-render.
			annotations = next ?? [];
			calls.push(next);
			handle.rerender(
				createElement(AnnotationList, { annotations, kind, onChange }),
			);
		};
		handle = render(
			createElement(AnnotationList, { annotations, kind, onChange }),
		);
		return { container: handle.container, calls };
	}

	it("appends a fully-required event annotation and validates", () => {
		const { container, calls } = renderList("event");
		click(buttonByText(container, "Add annotation"));
		expect(calls.at(-1)).toEqual([{ text: "", placement: "above" }]);
		expectEventAnnotationConformant(calls.at(-1)[0]);
	});

	it("appends a fully-required standalone annotation carrying a staff", () => {
		const { container, calls } = renderList("standalone");
		click(buttonByText(container, "Add annotation"));
		expect(calls.at(-1)).toEqual([
			{ text: "", placement: "above", staff: "rightHand" },
		]);
		expectStandaloneAnnotationConformant(calls.at(-1)[0]);
	});

	it("signals removal (no empty array) once the last annotation is removed", () => {
		const { container, calls } = renderList("event");

		click(buttonByText(container, "Add annotation"));
		click(buttonByText(container, "Add annotation"));
		expect(calls.at(-1)).toHaveLength(2);

		click(buttonByName(container, "Remove annotation"));
		expect(calls.at(-1)).toHaveLength(1);

		// Removing the final annotation emits undefined, not an empty array, so the
		// parent drops the key rather than serializing `annotations: []`.
		click(buttonByName(container, "Remove annotation"));
		expect(calls.at(-1)).toBeUndefined();
	});

	it("edits a single row in place, leaving its siblings untouched", () => {
		const { container, calls } = renderList("event", [
			{ text: "first", placement: "above" },
			{ text: "second", placement: "above" },
		]);

		const textareas = [...container.querySelectorAll("textarea")];
		change(textareas[1], "edited");
		expect(calls.at(-1)).toEqual([
			{ text: "first", placement: "above" },
			{ text: "edited", placement: "above" },
		]);
		for (const annotation of calls.at(-1)) {
			expectEventAnnotationConformant(annotation);
		}
	});

	// S4 className hook: each annotation-row HStack carries the __list-row class
	// so the top-level editor.scss rule can target it (the HStack mock spreads
	// ...rest onto the <div>, so className reaches the DOM).
	it("annotation rows carry the __list-row className hook (S4 CSS engagement)", () => {
		const { container } = renderList("event", [
			{ text: "cresc.", placement: "above" },
		]);
		expect(
			container.querySelector(".wp-block-piano-block-piano__list-row"),
		).not.toBeNull();
	});
});
