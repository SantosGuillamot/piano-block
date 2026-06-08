/**
 * Smoke tests for the sheet-music canvas.
 *
 * `SongCanvas` reuses the notation core's render path (as the old preview did) but
 * renders from a PARSED working object and layers on post-render `is-selected`
 * decoration only — it is selection-decoration only, it does NOT hit-test or set
 * selection (selection is driven by the structure tree). These tests pin the
 * load-bearing contracts: an `<svg role="img">` mounts for a valid working object
 * AND for the seeded empty song; the `is-selected` class lands on exactly the
 * selected event group, on nothing for a stale selection, and on nothing for a
 * section/measure selection (those kinds are surfaced through the tree/panels, not
 * the canvas); and the canvas renders NO add affordances (those live in the
 * structure tree and the Note panel now). The full panel/integration coverage is
 * owned by the later inspector/Edit suites; this is the component-level smoke.
 *
 * Like `SongPreview.test.js`, these render into jsdom (no `@testing-library/react`)
 * and rely on the 0-width tolerance and the no-Font-Loading-API fallback
 * (`document.fonts` left undefined), so the first draw runs synchronously inside the
 * mount effect.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import SongCanvas from "../SongCanvas.js";
import { newSong } from "../songModel.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A multi-section working object: section 0 has two measures (the first with two
 * right-hand events and one left-hand event), section 1 has one. The global measure
 * walk numbers these 1, 2, 3.
 */
const SONG = {
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
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
				{
					rightHand: [
						{
							type: "note",
							duration: "half",
							pitches: [{ step: "E", octave: 5 }],
						},
					],
				},
			],
		},
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "G", octave: 4 }],
						},
					],
				},
			],
		},
	],
};

/** Render an element into a fresh container appended to the document, in `act`. */
function render(element) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => {
		root.render(element);
	});
	return { container, root };
}

/** Unmount and detach a rendered container inside `act`. */
function cleanup(container, root) {
	act(() => {
		root.unmount();
	});
	container.remove();
}

describe("SongCanvas", () => {
	it("mounts an <svg role='img'> for a valid working object", () => {
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG }),
		);
		const svg = container.querySelector("svg");
		expect(svg).toBeTruthy();
		expect(svg.getAttribute("role")).toBe("img");
		cleanup(container, root);
	});

	it("renders an empty grand staff for the seeded empty song", () => {
		// The seeded `newSong()` (one section, one empty measure) must still draw a
		// staff the author can add to — the canvas-first empty state.
		const { container, root } = render(
			createElement(SongCanvas, { song: newSong() }),
		);
		expect(container.querySelector("svg")).toBeTruthy();
		cleanup(container, root);
	});

	it("decorates exactly the selected group with is-selected", () => {
		const { container, root } = render(
			createElement(SongCanvas, {
				song: SONG,
				selection: {
					kind: "event",
					sectionIndex: 1,
					measureIndex: 0,
					hand: "rightHand",
					eventIndex: 0,
				},
			}),
		);
		const selected = container.querySelectorAll(".is-selected");
		expect(selected).toHaveLength(1);
		// It is the note in the third global measure (section 1, measure 0).
		const node = selected[0];
		expect(node.getAttribute("data-event-index")).toBe("0");
		expect(node.closest("[data-measure]").getAttribute("data-measure")).toBe(
			"3",
		);
		cleanup(container, root);
	});

	it("decorates nothing for a stale selection", () => {
		const { container, root } = render(
			createElement(SongCanvas, {
				song: SONG,
				// eventIndex 9 does not exist in that measure/hand.
				selection: {
					kind: "event",
					sectionIndex: 0,
					measureIndex: 0,
					hand: "rightHand",
					eventIndex: 9,
				},
			}),
		);
		expect(container.querySelectorAll(".is-selected")).toHaveLength(0);
		cleanup(container, root);
	});

	it("renders no on-canvas add affordances (they live in the sidebar now)", () => {
		// The add-grid moved to the structure tree (add section/measure/first-note)
		// and the Note panel (contextual add note). The canvas is decoration only —
		// none of the old add-grid nodes remain.
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG }),
		);
		expect(
			container.querySelector(".wp-block-piano-block-piano__canvas-actions"),
		).toBeNull();
		expect(
			container.querySelector(".wp-block-piano-block-piano__add-note"),
		).toBeNull();
		expect(
			container.querySelector(".wp-block-piano-block-piano__add-measure"),
		).toBeNull();
		cleanup(container, root);
	});

	it("decorates nothing for a section or measure selection", () => {
		// Section/measure selections are surfaced through the structure tree and the
		// inspector panels, not the canvas — neither kind adds any class to the SVG.
		const section = render(
			createElement(SongCanvas, {
				song: SONG,
				selection: { kind: "section", sectionIndex: 0 },
			}),
		);
		expect(section.container.querySelectorAll(".is-selected")).toHaveLength(0);
		cleanup(section.container, section.root);

		const measure = render(
			createElement(SongCanvas, {
				song: SONG,
				selection: { kind: "measure", sectionIndex: 0, measureIndex: 1 },
			}),
		);
		expect(measure.container.querySelectorAll(".is-selected")).toHaveLength(0);
		cleanup(measure.container, measure.root);
	});
});
