/**
 * Unit tests for the sidebar **Structure** browser.
 *
 * `StructureList` is a pure controlled component: it renders the song's sections
 * and their measures (to measure depth — notes are NOT listed) and only signals
 * intent — selecting a row through `onSelect` (kind-tagged), and add/remove through
 * the lifted `onAddSection`/`onRemoveSection`/`onAddMeasure`/`onRemoveMeasure`
 * handlers `edit.js` owns. These tests pin the row inventory, the kind-tagged select
 * payloads, the lifted-handler wiring with the right coords, the `aria-current`
 * active state, and the measure-depth invariant (no event-level rows).
 *
 * The panel is presentational, so the tests render it into jsdom and drive the
 * mocked `@wordpress/components` buttons directly — clicking a `<button>` inside
 * `act`. The `PanelBody` mock renders its contents unconditionally.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { resolveSelection } from "../selection.js";
import { StructureList } from "../inspector/StructureList.js";

// Mark this as a React act-capable environment so React flushes work inside `act`.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** Render an element into a fresh detached container, with an act-wrapped unmount. */
function render(element) {
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() => {
		root.render(element);
	});
	return {
		container,
		unmount: () => {
			act(() => {
				root.unmount();
			});
		},
	};
}

/** Find a button by its visible text or accessible name. */
function buttonByText(container, text) {
	return Array.from(container.querySelectorAll("button")).find(
		(button) =>
			button.textContent === text || button.getAttribute("aria-label") === text,
	);
}

/** Click a node inside `act`. */
function click(node) {
	act(() => {
		node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
}

/**
 * A two-section fixture: section 0 has two measures, section 1 has one. So the
 * Structure list shows two section rows and three measure rows total.
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
						],
					},
					{ rightHand: [{ type: "rest", duration: "whole" }] },
				],
			},
			{
				measures: [
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
		],
	};
}

/**
 * Render a `StructureList` over a fixture, recording every handler invocation. The
 * `selection` is resolved against the song so the active-state assertions exercise
 * the same kind-tagged shape `edit.js` feeds the component.
 */
function renderList({ song = fixtureSong(), selection = null } = {}) {
	const calls = {
		select: [],
		addSection: 0,
		removeSection: [],
		addMeasure: [],
		removeMeasure: [],
	};
	const { container, unmount } = render(
		createElement(StructureList, {
			song,
			selection: resolveSelection(song, selection),
			onSelect: (next) => calls.select.push(next),
			onAddSection: () => {
				calls.addSection += 1;
			},
			onRemoveSection: (sectionIndex) => calls.removeSection.push(sectionIndex),
			onAddMeasure: (sectionIndex) => calls.addMeasure.push(sectionIndex),
			onRemoveMeasure: (sectionIndex, measureIndex) =>
				calls.removeMeasure.push([sectionIndex, measureIndex]),
		}),
	);
	return { container, unmount, calls };
}

describe("StructureList — inventory", () => {
	it("renders a row per section and per measure (to measure depth)", () => {
		const { container, unmount } = renderList();
		// Two section select rows.
		expect(buttonByText(container, "Section 1")).toBeTruthy();
		expect(buttonByText(container, "Section 2")).toBeTruthy();
		expect(buttonByText(container, "Section 3")).toBeFalsy();
		// Section 0 has measures 1 and 2; section 1 has measure 1. The measure
		// labels are scoped per section, so two "Measure 1" rows exist.
		const measureOnes = Array.from(container.querySelectorAll("button")).filter(
			(button) => button.textContent === "Measure 1",
		);
		expect(measureOnes).toHaveLength(2);
		expect(buttonByText(container, "Measure 2")).toBeTruthy();
		unmount();
	});

	it("does not list notes (measure depth only)", () => {
		const { container, unmount } = renderList();
		// No control labels the individual events — the deepest rows are measures.
		const labels = Array.from(container.querySelectorAll("button")).map(
			(button) => button.textContent || button.getAttribute("aria-label"),
		);
		expect(labels.some((label) => /note/i.test(label))).toBe(false);
		unmount();
	});

	it("renders an empty section's measure controls without throwing", () => {
		// A section with zero measures still shows its row and an Add measure — the
		// first-note path needs a reachable, addable empty section.
		const { container, unmount } = renderList({
			song: { sections: [{ measures: [] }] },
		});
		expect(buttonByText(container, "Section 1")).toBeTruthy();
		expect(buttonByText(container, "Add measure to section 1")).toBeTruthy();
		unmount();
	});
});

describe("StructureList — select", () => {
	it("selects a section row with a section-kind payload", () => {
		const { container, unmount, calls } = renderList();
		click(buttonByText(container, "Section 2"));
		expect(calls.select).toEqual([{ kind: "section", sectionIndex: 1 }]);
		unmount();
	});

	it("selects a measure row with a measure-kind payload", () => {
		const { container, unmount, calls } = renderList();
		// The second measure of section 0.
		const section0 = container.querySelector("div");
		const measureTwo = Array.from(section0.querySelectorAll("button")).find(
			(button) => button.textContent === "Measure 2",
		);
		click(measureTwo);
		expect(calls.select).toEqual([
			{ kind: "measure", sectionIndex: 0, measureIndex: 1 },
		]);
		unmount();
	});

	it("selects the lone measure of a later section with the right coords", () => {
		const { container, unmount, calls } = renderList();
		// Section 1's only measure — its "Measure 1" is the second one in the list.
		const measureOnes = Array.from(container.querySelectorAll("button")).filter(
			(button) => button.textContent === "Measure 1",
		);
		click(measureOnes[1]);
		expect(calls.select).toEqual([
			{ kind: "measure", sectionIndex: 1, measureIndex: 0 },
		]);
		unmount();
	});
});

describe("StructureList — add/remove", () => {
	it("calls onAddSection from the trailing Add section button", () => {
		const { container, unmount, calls } = renderList();
		click(buttonByText(container, "Add section"));
		expect(calls.addSection).toBe(1);
		unmount();
	});

	it("calls onAddMeasure with the section index", () => {
		const { container, unmount, calls } = renderList();
		click(buttonByText(container, "Add measure to section 2"));
		expect(calls.addMeasure).toEqual([1]);
		unmount();
	});

	it("calls onRemoveSection with the section index", () => {
		const { container, unmount, calls } = renderList();
		click(buttonByText(container, "Remove section 2"));
		expect(calls.removeSection).toEqual([1]);
		unmount();
	});

	it("calls onRemoveMeasure with the section and measure indices", () => {
		const { container, unmount, calls } = renderList();
		click(buttonByText(container, "Remove measure 2 of section 1"));
		expect(calls.removeMeasure).toEqual([[0, 1]]);
		unmount();
	});
});

describe("StructureList — active state", () => {
	it("marks the selected section row aria-current and no measure row", () => {
		const { container, unmount } = renderList({
			selection: { kind: "section", sectionIndex: 1 },
		});
		expect(
			buttonByText(container, "Section 2").getAttribute("aria-current"),
		).toBe("true");
		expect(
			buttonByText(container, "Section 1").getAttribute("aria-current"),
		).toBeNull();
		// No measure row is current for a section selection.
		const currentMeasures = Array.from(
			container.querySelectorAll("button"),
		).filter(
			(button) =>
				/^Measure/.test(button.textContent) &&
				button.getAttribute("aria-current") === "true",
		);
		expect(currentMeasures).toHaveLength(0);
		unmount();
	});

	it("marks the selected measure row aria-current and no section row", () => {
		const { container, unmount } = renderList({
			selection: { kind: "measure", sectionIndex: 0, measureIndex: 1 },
		});
		const measureTwo = buttonByText(container, "Measure 2");
		expect(measureTwo.getAttribute("aria-current")).toBe("true");
		// The owning section row is NOT marked for a measure selection.
		expect(
			buttonByText(container, "Section 1").getAttribute("aria-current"),
		).toBeNull();
		unmount();
	});

	it("keeps a measure row current when an event under it is selected", () => {
		// Navigating from a measure into one of its notes (an event selection) still
		// resolves to the same measure coords, so the measure row stays lit.
		const { container, unmount } = renderList({
			selection: {
				kind: "event",
				sectionIndex: 0,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 0,
			},
		});
		const measureOnes = Array.from(container.querySelectorAll("button")).filter(
			(button) => button.textContent === "Measure 1",
		);
		// Section 0's "Measure 1" is the first such row.
		expect(measureOnes[0].getAttribute("aria-current")).toBe("true");
		unmount();
	});
});
