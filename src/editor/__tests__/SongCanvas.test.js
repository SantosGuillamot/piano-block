/**
 * Smoke tests for the interactive sheet-music canvas.
 *
 * `SongCanvas` reuses the notation core's render path (as the old preview did) but
 * renders from a PARSED working object and layers on selection hit-testing,
 * post-render `is-selected` decoration, and the on-canvas add affordances. These
 * tests pin the load-bearing contracts: an `<svg role="img">` mounts for a valid
 * working object AND for the seeded empty song; a click on a rendered note group
 * fires `onSelect` with the right `{ sectionIndex, measureIndex, hand, eventIndex }`;
 * the `is-selected` class lands on exactly the selected group and on nothing for a
 * stale selection; and the add-note / add-measure buttons render with their
 * accessible names and call their callbacks. The full panel/integration coverage is
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

/** The SVG host node (the inner container the core renders into). */
function svgHost(container) {
	return container.querySelector(".wp-block-piano-block-piano__canvas-svg");
}

/** Dispatch a bubbling click whose target is `node`, inside `act`. */
function clickNode(node) {
	act(() => {
		node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
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

	it("fires onSelect with the resolved coords when a note group is clicked", () => {
		const onSelect = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onSelect }),
		);
		// The second right-hand event of measure 1 is the rest at eventIndex 1.
		const group = svgHost(container).querySelector(
			'[data-measure="1"] [data-hand="rightHand"][data-event-index="1"]',
		);
		expect(group).toBeTruthy();
		// Click a descendant of the group, as a real pointer would.
		clickNode(group.firstChild ?? group);
		expect(onSelect).toHaveBeenCalledTimes(1);
		expect(onSelect).toHaveBeenCalledWith({
			sectionIndex: 0,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 1,
		});
		cleanup(container, root);
	});

	it("fires onSelect(null) when an empty staff area is clicked", () => {
		const onSelect = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onSelect }),
		);
		// The SVG root is not inside any note/rest group.
		clickNode(container.querySelector("svg"));
		expect(onSelect).toHaveBeenCalledWith(null);
		cleanup(container, root);
	});

	it("decorates exactly the selected group with is-selected", () => {
		const { container, root } = render(
			createElement(SongCanvas, {
				song: SONG,
				selection: {
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

	it("makes note/rest groups focusable for keyboard selection", () => {
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG }),
		);
		const group = svgHost(container).querySelector('[data-kind="note"]');
		expect(group.getAttribute("tabindex")).toBe("0");
		expect(group.getAttribute("role")).toBe("button");
		cleanup(container, root);
	});

	it("renders per-hand add-note buttons that call onAddNote with the coords", () => {
		const onAddNote = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onAddNote }),
		);
		// One pair per measure: 3 measures × 2 hands = 6 add-note buttons.
		const addNotes = container.querySelectorAll(
			".wp-block-piano-block-piano__add-note",
		);
		expect(addNotes).toHaveLength(6);
		// "Add note to left hand in measure 1" targets section 0, measure 0, leftHand.
		const leftMeasure1 = [...addNotes].find(
			(button) =>
				button.getAttribute("aria-label") ===
				"Add note to left hand in measure 1",
		);
		expect(leftMeasure1).toBeTruthy();
		act(() => {
			leftMeasure1.dispatchEvent(
				new window.MouseEvent("click", { bubbles: true }),
			);
		});
		expect(onAddNote).toHaveBeenCalledWith(0, 0, "leftHand");
		cleanup(container, root);
	});

	it("renders an add-measure button that calls onAddMeasure", () => {
		const onAddMeasure = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onAddMeasure }),
		);
		const addMeasure = container.querySelector(
			".wp-block-piano-block-piano__add-measure",
		);
		expect(addMeasure).toBeTruthy();
		expect(addMeasure.textContent).toBe("Add measure");
		act(() => {
			addMeasure.dispatchEvent(
				new window.MouseEvent("click", { bubbles: true }),
			);
		});
		expect(onAddMeasure).toHaveBeenCalledTimes(1);
		cleanup(container, root);
	});
});
