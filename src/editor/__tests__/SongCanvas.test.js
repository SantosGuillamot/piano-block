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
			kind: "event",
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

	it("fires onSelect for a clicked rest group, not just a note", () => {
		const onSelect = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onSelect }),
		);
		// The rest at eventIndex 1 of measure 1 is a `data-kind="rest"` group —
		// the hit-test reads rests exactly as it reads notes.
		const rest = svgHost(container).querySelector(
			'[data-measure="1"][data-kind="rest"], [data-measure="1"] [data-kind="rest"]',
		);
		expect(rest).toBeTruthy();
		expect(rest.getAttribute("data-kind")).toBe("rest");
		clickNode(rest.firstChild ?? rest);
		expect(onSelect).toHaveBeenCalledWith({
			kind: "event",
			sectionIndex: 0,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 1,
		});
		cleanup(container, root);
	});

	it("fires onSelect when the per-event hit-rect (not the ink) is the click target", () => {
		// SongCanvas passes `interactive: true`, so each note/rest group has a
		// transparent first-child hit-rect covering its column. A real off-ink click in
		// the column lands on THAT rect — the bug today is that a gap-click hits no ink
		// and resolves to nothing. Targeting the rect proves the column is selectable.
		const onSelect = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onSelect }),
		);
		// The lone note of global measure 3 (section 1, measure 0).
		const group = svgHost(container).querySelector(
			'[data-measure="3"] [data-hand="rightHand"][data-event-index="0"]',
		);
		expect(group).toBeTruthy();
		const hit = group.querySelector("[data-hit]");
		expect(hit).toBeTruthy();
		// The rect carries no data-kind/data-hand/data-event-index of its own; selection
		// must resolve by walking up to the enclosing group.
		expect(hit.hasAttribute("data-hand")).toBe(false);
		expect(hit.hasAttribute("data-event-index")).toBe(false);
		clickNode(hit);
		expect(onSelect).toHaveBeenCalledWith({
			kind: "event",
			sectionIndex: 1,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 0,
		});
		cleanup(container, root);
	});

	it("resolves a click in a later section through the measure flatten", () => {
		const onSelect = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onSelect }),
		);
		// The lone note of global measure 3 lives in section 1, measure 0 — the
		// click must translate `data-measure="3"` back through `measureCoords`.
		const group = svgHost(container).querySelector(
			'[data-measure="3"] [data-hand="rightHand"][data-event-index="0"]',
		);
		expect(group).toBeTruthy();
		clickNode(group.firstChild ?? group);
		expect(onSelect).toHaveBeenCalledWith({
			kind: "event",
			sectionIndex: 1,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 0,
		});
		cleanup(container, root);
	});

	it("fires onSelect on Enter/Space over a focused note group", () => {
		const onSelect = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onSelect }),
		);
		const group = svgHost(container).querySelector(
			'[data-measure="3"] [data-hand="rightHand"][data-event-index="0"]',
		);
		expect(group).toBeTruthy();
		// Enter on the focused group activates the same selection a click would.
		act(() => {
			group.dispatchEvent(
				new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
			);
		});
		expect(onSelect).toHaveBeenCalledWith({
			kind: "event",
			sectionIndex: 1,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 0,
		});
		// Space behaves the same.
		onSelect.mockClear();
		act(() => {
			group.dispatchEvent(
				new window.KeyboardEvent("keydown", { key: " ", bubbles: true }),
			);
		});
		expect(onSelect).toHaveBeenCalledWith({
			kind: "event",
			sectionIndex: 1,
			measureIndex: 0,
			hand: "rightHand",
			eventIndex: 0,
		});
		cleanup(container, root);
	});

	it("ignores keydowns that are neither Enter nor Space, and those off a group", () => {
		const onSelect = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onSelect }),
		);
		const group = svgHost(container).querySelector('[data-kind="note"]');
		// A non-activation key over a group does nothing.
		act(() => {
			group.dispatchEvent(
				new window.KeyboardEvent("keydown", { key: "a", bubbles: true }),
			);
		});
		// Enter off any group (on the bare SVG root) does nothing either.
		act(() => {
			container
				.querySelector("svg")
				.dispatchEvent(
					new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
				);
		});
		expect(onSelect).not.toHaveBeenCalled();
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

	it("targets the right hand and later measures with the correct coords", () => {
		const onAddNote = jest.fn();
		const { container, root } = render(
			createElement(SongCanvas, { song: SONG, onAddNote }),
		);
		const addNotes = [
			...container.querySelectorAll(".wp-block-piano-block-piano__add-note"),
		];
		// "Add note to right hand in measure 1" targets section 0, measure 0, right.
		const rightMeasure1 = addNotes.find(
			(button) =>
				button.getAttribute("aria-label") ===
				"Add note to right hand in measure 1",
		);
		expect(rightMeasure1).toBeTruthy();
		act(() => {
			rightMeasure1.dispatchEvent(
				new window.MouseEvent("click", { bubbles: true }),
			);
		});
		expect(onAddNote).toHaveBeenCalledWith(0, 0, "rightHand");
		// "Add note … in measure 3" maps the global number back through the flatten
		// to section 1, measure 0.
		const rightMeasure3 = addNotes.find(
			(button) =>
				button.getAttribute("aria-label") ===
				"Add note to right hand in measure 3",
		);
		expect(rightMeasure3).toBeTruthy();
		act(() => {
			rightMeasure3.dispatchEvent(
				new window.MouseEvent("click", { bubbles: true }),
			);
		});
		expect(onAddNote).toHaveBeenLastCalledWith(1, 0, "rightHand");
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

	it("decorates the one measure group with is-active-measure for a measure selection", () => {
		const { container, root } = render(
			createElement(SongCanvas, {
				song: SONG,
				// Section 0, measure 1 → global measure 2.
				selection: { kind: "measure", sectionIndex: 0, measureIndex: 1 },
			}),
		);
		const active = container.querySelectorAll(".is-active-measure");
		expect(active).toHaveLength(1);
		expect(active[0].getAttribute("data-measure")).toBe("2");
		// A measure highlight is distinct from the event outline — nothing is
		// `is-selected` and no section box is drawn.
		expect(container.querySelectorAll(".is-selected")).toHaveLength(0);
		expect(container.querySelectorAll(".is-active-section")).toHaveLength(0);
		cleanup(container, root);
	});

	it("decorates every measure group of a section with is-active-section", () => {
		const { container, root } = render(
			createElement(SongCanvas, {
				song: SONG,
				// Section 0 spans global measures 1 and 2.
				selection: { kind: "section", sectionIndex: 0 },
			}),
		);
		const active = container.querySelectorAll(".is-active-section");
		expect(active).toHaveLength(2);
		const numbers = [...active]
			.map((group) => group.getAttribute("data-measure"))
			.sort();
		expect(numbers).toEqual(["1", "2"]);
		// No event outline and no single-measure box for a section highlight.
		expect(container.querySelectorAll(".is-selected")).toHaveLength(0);
		expect(container.querySelectorAll(".is-active-measure")).toHaveLength(0);
		cleanup(container, root);
	});

	it("decorates a later section's lone measure with is-active-section", () => {
		const { container, root } = render(
			createElement(SongCanvas, {
				song: SONG,
				// Section 1 is just global measure 3.
				selection: { kind: "section", sectionIndex: 1 },
			}),
		);
		const active = container.querySelectorAll(".is-active-section");
		expect(active).toHaveLength(1);
		expect(active[0].getAttribute("data-measure")).toBe("3");
		cleanup(container, root);
	});

	it("decorates nothing for a stale measure or section selection", () => {
		// A measure index past the section's end (and a section index out of range)
		// resolves to no group, so the highlight simply disappears.
		const stale = render(
			createElement(SongCanvas, {
				song: SONG,
				selection: { kind: "measure", sectionIndex: 0, measureIndex: 9 },
			}),
		);
		expect(stale.container.querySelectorAll(".is-active-measure")).toHaveLength(
			0,
		);
		cleanup(stale.container, stale.root);

		const staleSection = render(
			createElement(SongCanvas, {
				song: SONG,
				selection: { kind: "section", sectionIndex: 9 },
			}),
		);
		expect(
			staleSection.container.querySelectorAll(".is-active-section"),
		).toHaveLength(0);
		cleanup(staleSection.container, staleSection.root);
	});

	it("scrolls the highlighted measure group into view when scrollIntoView exists", () => {
		// jsdom has no scrollIntoView on SVG groups; install a spy on the prototype so
		// the guarded call is exercised, then assert it ran for a measure selection.
		const proto = window.SVGElement.prototype;
		const had = Object.hasOwn(proto, "scrollIntoView");
		const original = proto.scrollIntoView;
		const spy = jest.fn();
		proto.scrollIntoView = spy;
		try {
			const { container, root } = render(
				createElement(SongCanvas, {
					song: SONG,
					selection: { kind: "measure", sectionIndex: 0, measureIndex: 0 },
				}),
			);
			expect(spy).toHaveBeenCalled();
			cleanup(container, root);
		} finally {
			if (had) {
				proto.scrollIntoView = original;
			} else {
				delete proto.scrollIntoView;
			}
		}
	});

	it("does not throw when scrollIntoView is absent (jsdom)", () => {
		// With no scrollIntoView on the group, a measure selection must still draw the
		// highlight and not throw — the guard tolerates the missing API.
		const { container, root } = render(
			createElement(SongCanvas, {
				song: SONG,
				selection: { kind: "measure", sectionIndex: 0, measureIndex: 0 },
			}),
		);
		expect(container.querySelectorAll(".is-active-measure")).toHaveLength(1);
		cleanup(container, root);
	});
});
