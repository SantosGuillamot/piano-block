/**
 * Unit tests for the left **structure tree** — the editor's selection surface.
 *
 * `StructureTree` is a pure controlled component built on `__experimentalTreeGrid`:
 * it flattens the song into Section → Measure → {Right hand, Left hand} → Note rows
 * (respecting expansion), signals a kind-tagged `selection` through `onSelect` for
 * section/measure/note rows, and signals add/remove/duplicate intent through the
 * lifted `edit.js` handlers. Hand-group rows are organizational — they toggle
 * expansion and host the per-hand "Add note" but never select (KD 14).
 *
 * These tests pin the row inventory at each level (and that collapsed
 * sections/measures hide their descendants until expanded or auto-expanded by the
 * selection), the `name`-or-positional labels and `noteLabel` note labels, the
 * kind-tagged select payloads (and that a hand row does not select), the
 * add/remove/duplicate handler wiring at each level plus the per-hand "Add note",
 * the manual-vs-auto expansion behavior, and the treegrid ARIA wiring
 * (`aria-level`/`-posinset`/`-setsize`/`-expanded`) exposed by the component mock.
 *
 * The component is presentational, so the tests render it into jsdom (the same
 * `createRoot`/`act` harness the sibling suites use) and drive the mocked
 * `@wordpress/components` buttons directly. The `__experimentalTreeGrid*` mocks
 * render DOM-honest `<table role="treegrid">`/`<tr>`/`<td>` stand-ins, leaving the
 * real keyboard/roving-tabindex model to the e2e suite.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { resolveSelection } from "../selection.js";
import { StructureTree } from "../StructureTree.js";

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

/** Find a button by its accessible name (`aria-label`). */
function buttonByLabel(container, label) {
	return Array.from(container.querySelectorAll("button")).find(
		(button) => button.getAttribute("aria-label") === label,
	);
}

/**
 * Find a select/label button by the leading text of its visible label. Section,
 * measure, hand and note rows render a label `Button` whose text content carries an
 * optional disclosure caret then the label, so a prefix match locates the row's
 * select control.
 */
function selectButtonByText(container, text) {
	return Array.from(container.querySelectorAll("button")).find((button) =>
		(button.textContent ?? "").replace(/^[▸▾]\s*/, "") === text,
	);
}

/** All select/label buttons whose (caret-stripped) text equals `text`. */
function selectButtonsByText(container, text) {
	return Array.from(container.querySelectorAll("button")).filter(
		(button) => (button.textContent ?? "").replace(/^[▸▾]\s*/, "") === text,
	);
}

/** Click a node inside `act`. */
function click(node) {
	act(() => {
		node.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
	});
}

/**
 * A two-section fixture: section 0 has two measures (the first with a right-hand
 * note and a left-hand chord, the second empty); section 1 has one measure with a
 * right-hand rest. Rich enough to exercise every level and label kind.
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
						leftHand: [
							{
								type: "note",
								duration: "half",
								pitches: [
									{ step: "C", octave: 3 },
									{ step: "E", octave: 3 },
									{ step: "G", octave: 3 },
								],
							},
						],
					},
					{},
				],
			},
			{
				measures: [{ rightHand: [{ type: "rest", duration: "whole" }] }],
			},
		],
	};
}

/**
 * Render a `StructureTree` over a fixture, recording every handler invocation. The
 * `selection` is resolved against the song so the assertions exercise the same
 * kind-tagged shape `edit.js` feeds the component. `expandedPaths` defaults to a
 * Set expanding section 0 and its first measure and both hands, so the deepest rows
 * are visible without relying on auto-expand (which separate tests cover).
 */
function renderTree({
	song = fixtureSong(),
	selection = null,
	expandedPaths = new Set([
		"s0",
		"s0/m0",
		"s0/m0/rightHand",
		"s0/m0/leftHand",
	]),
	collapsedOverride = new Set(),
	system = "english",
} = {}) {
	const calls = {
		select: [],
		toggle: [],
		toggleOverride: [],
		removeSection: [],
		duplicateSection: [],
		addMeasure: [],
		removeMeasure: [],
		duplicateMeasure: [],
		addNote: [],
		removeNote: [],
		duplicateNote: [],
	};
	const { container, unmount } = render(
		createElement(StructureTree, {
			song,
			selection: resolveSelection(song, selection),
			system,
			expandedPaths,
			onToggleExpanded: (path) => calls.toggle.push(path),
			collapsedOverride,
			onToggleCollapsedOverride: (path) => calls.toggleOverride.push(path),
			onSelect: (next) => calls.select.push(next),
			onRemoveSection: (si) => calls.removeSection.push(si),
			onDuplicateSection: (si) => calls.duplicateSection.push(si),
			onAddMeasure: (si) => calls.addMeasure.push(si),
			onRemoveMeasure: (si, mi) => calls.removeMeasure.push([si, mi]),
			onDuplicateMeasure: (si, mi) => calls.duplicateMeasure.push([si, mi]),
			onAddNote: (si, mi, hand) => calls.addNote.push([si, mi, hand]),
			onRemoveNote: (si, mi, hand, ei) =>
				calls.removeNote.push([si, mi, hand, ei]),
			onDuplicateNote: (si, mi, hand, ei) =>
				calls.duplicateNote.push([si, mi, hand, ei]),
		}),
	);
	return { container, unmount, calls };
}

describe("StructureTree — inventory", () => {
	it("renders section, measure, hand and note rows at the right levels", () => {
		const { container, unmount } = renderTree();
		const rowLevel = (text) => selectButtonByText(container, text).closest("tr");
		expect(rowLevel("Section 1").getAttribute("aria-level")).toBe("1");
		expect(rowLevel("Measure 1").getAttribute("aria-level")).toBe("2");
		expect(rowLevel("Right hand").getAttribute("aria-level")).toBe("3");
		expect(rowLevel("Left hand").getAttribute("aria-level")).toBe("3");
		// The right-hand note row (C) and the left-hand chord row (C E G) are leaves.
		expect(rowLevel("C").getAttribute("aria-level")).toBe("4");
		expect(rowLevel("C E G").getAttribute("aria-level")).toBe("4");
		unmount();
	});

	it("hides a collapsed section's descendants until expanded", () => {
		// Nothing expanded and no selection: only the two section rows show.
		const { container, unmount } = renderTree({ expandedPaths: new Set() });
		expect(selectButtonByText(container, "Section 1")).toBeTruthy();
		expect(selectButtonByText(container, "Section 2")).toBeTruthy();
		// No measures, hands or notes are visible while collapsed.
		expect(selectButtonsByText(container, "Measure 1")).toHaveLength(0);
		expect(selectButtonByText(container, "Right hand")).toBeFalsy();
		expect(selectButtonByText(container, "C")).toBeFalsy();
		unmount();
	});

	it("hides a collapsed measure's hands until the measure is expanded", () => {
		// Section 0 expanded but its measures collapsed: measure rows show, no hands.
		const { container, unmount } = renderTree({
			expandedPaths: new Set(["s0"]),
		});
		expect(selectButtonsByText(container, "Measure 1")).toHaveLength(1);
		expect(selectButtonByText(container, "Measure 2")).toBeTruthy();
		expect(selectButtonByText(container, "Right hand")).toBeFalsy();
		unmount();
	});

	it("renders both hand groups for an expanded measure, even an empty one", () => {
		// Measure 2 of section 0 is empty `{}` — both hand groups still render so a
		// note can be seeded into either via the per-hand Add note.
		const { container, unmount } = renderTree({
			expandedPaths: new Set(["s0", "s0/m1"]),
		});
		const measureTwoRow = selectButtonByText(container, "Measure 2").closest("tr");
		// Both hand rows follow measure 2 in the flattened order.
		expect(selectButtonsByText(container, "Right hand").length).toBeGreaterThan(0);
		expect(selectButtonsByText(container, "Left hand").length).toBeGreaterThan(0);
		expect(measureTwoRow).toBeTruthy();
		unmount();
	});
});

describe("StructureTree — labels", () => {
	it("labels sections and measures positionally when unnamed", () => {
		const { container, unmount } = renderTree();
		expect(selectButtonByText(container, "Section 1")).toBeTruthy();
		expect(selectButtonByText(container, "Section 2")).toBeTruthy();
		expect(selectButtonByText(container, "Measure 1")).toBeTruthy();
		expect(selectButtonByText(container, "Measure 2")).toBeTruthy();
		unmount();
	});

	it("prefers a section's and measure's name when set", () => {
		const song = fixtureSong();
		song.sections[0].name = "Intro";
		song.sections[0].measures[0].name = "Pickup";
		const { container, unmount } = renderTree({ song });
		expect(selectButtonByText(container, "Intro")).toBeTruthy();
		expect(selectButtonByText(container, "Pickup")).toBeTruthy();
		// The positional fallbacks for the named rows are no longer shown.
		expect(selectButtonByText(container, "Section 1")).toBeFalsy();
		expect(selectButtonByText(container, "Measure 1")).toBeFalsy();
		unmount();
	});

	it("labels notes, chords and rests via noteLabel", () => {
		const { container, unmount } = renderTree();
		// A single right-hand note → its pitch name; the left-hand chord → joined.
		expect(selectButtonByText(container, "C")).toBeTruthy();
		expect(selectButtonByText(container, "C E G")).toBeTruthy();
		// Section 1's measure carries a rest — expand it and assert the "rest" label.
		unmount();
		const { container: c2, unmount: u2 } = renderTree({
			expandedPaths: new Set(["s1", "s1/m0", "s1/m0/rightHand"]),
		});
		expect(selectButtonByText(c2, "rest")).toBeTruthy();
		u2();
	});

	it("labels hand groups Right hand / Left hand", () => {
		const { container, unmount } = renderTree();
		expect(selectButtonByText(container, "Right hand")).toBeTruthy();
		expect(selectButtonByText(container, "Left hand")).toBeTruthy();
		unmount();
	});

	it("respects the note-name system for note labels", () => {
		const { container, unmount } = renderTree({ system: "spanish" });
		// The English `C` note reads `do` in the Spanish system (canonicalized
		// through stepInSystem); the chord reads `do mi sol`.
		expect(selectButtonByText(container, "do")).toBeTruthy();
		expect(selectButtonByText(container, "do mi sol")).toBeTruthy();
		unmount();
	});
});

describe("StructureTree — select", () => {
	it("selects a section row with a section-kind payload", () => {
		const { container, unmount, calls } = renderTree();
		click(selectButtonByText(container, "Section 2"));
		expect(calls.select).toEqual([{ kind: "section", sectionIndex: 1 }]);
		unmount();
	});

	it("selects a measure row with a measure-kind payload", () => {
		const { container, unmount, calls } = renderTree();
		click(selectButtonByText(container, "Measure 2"));
		expect(calls.select).toEqual([
			{ kind: "measure", sectionIndex: 0, measureIndex: 1 },
		]);
		unmount();
	});

	it("selects a note row with an event-kind payload carrying its hand", () => {
		const { container, unmount, calls } = renderTree();
		// The left-hand chord row carries hand "leftHand", event index 0.
		click(selectButtonByText(container, "C E G"));
		expect(calls.select).toEqual([
			{
				kind: "event",
				sectionIndex: 0,
				measureIndex: 0,
				hand: "leftHand",
				eventIndex: 0,
			},
		]);
		unmount();
	});

	it("does not select when a hand-group row is clicked", () => {
		const { container, unmount, calls } = renderTree();
		click(selectButtonByText(container, "Right hand"));
		// A hand row toggles expansion but never selects.
		expect(calls.select).toEqual([]);
		expect(calls.toggle).toEqual(["s0/m0/rightHand"]);
		unmount();
	});
});

describe("StructureTree — add/remove/duplicate", () => {
	it("removes and duplicates a section with its index", () => {
		const { container, unmount, calls } = renderTree();
		click(buttonByLabel(container, "Remove section 2"));
		click(buttonByLabel(container, "Duplicate section 1"));
		expect(calls.removeSection).toEqual([1]);
		expect(calls.duplicateSection).toEqual([0]);
		unmount();
	});

	it("adds a measure to a section from the section row", () => {
		const { container, unmount, calls } = renderTree();
		click(buttonByLabel(container, "Add measure to section 2"));
		expect(calls.addMeasure).toEqual([1]);
		unmount();
	});

	it("removes and duplicates a measure with its coords", () => {
		const { container, unmount, calls } = renderTree();
		click(buttonByLabel(container, "Remove measure 2 of section 1"));
		click(buttonByLabel(container, "Duplicate measure 1 of section 1"));
		expect(calls.removeMeasure).toEqual([[0, 1]]);
		expect(calls.duplicateMeasure).toEqual([[0, 0]]);
		unmount();
	});

	it("adds a note to each hand via the per-hand Add note", () => {
		const { container, unmount, calls } = renderTree();
		click(
			buttonByLabel(
				container,
				"Add note to Right hand of measure 1 of section 1",
			),
		);
		click(
			buttonByLabel(
				container,
				"Add note to Left hand of measure 1 of section 1",
			),
		);
		expect(calls.addNote).toEqual([
			[0, 0, "rightHand"],
			[0, 0, "leftHand"],
		]);
		unmount();
	});

	it("removes and duplicates a note with its full coords", () => {
		const { container, unmount, calls } = renderTree();
		click(
			buttonByLabel(
				container,
				"Remove note 1 of Right hand of measure 1 of section 1",
			),
		);
		click(
			buttonByLabel(
				container,
				"Duplicate note 1 of Left hand of measure 1 of section 1",
			),
		);
		expect(calls.removeNote).toEqual([[0, 0, "rightHand", 0]]);
		expect(calls.duplicateNote).toEqual([[0, 0, "leftHand", 0]]);
		unmount();
	});
});

describe("StructureTree — expansion", () => {
	it("toggles a section's manual expansion when its row is clicked", () => {
		const { container, unmount, calls } = renderTree({
			expandedPaths: new Set(),
		});
		click(selectButtonByText(container, "Section 1"));
		expect(calls.toggle).toEqual(["s0"]);
		unmount();
	});

	it("auto-expands the selection's ancestors even with an empty expandedPaths", () => {
		// Select the left-hand chord with NOTHING manually expanded: the tree must
		// reveal its section, measure and hand so the selected leaf is visible.
		const { container, unmount } = renderTree({
			expandedPaths: new Set(),
			selection: {
				kind: "event",
				sectionIndex: 0,
				measureIndex: 0,
				hand: "leftHand",
				eventIndex: 0,
			},
		});
		expect(selectButtonByText(container, "Section 1")).toBeTruthy();
		expect(selectButtonByText(container, "Measure 1")).toBeTruthy();
		expect(selectButtonByText(container, "Left hand")).toBeTruthy();
		expect(selectButtonByText(container, "C E G")).toBeTruthy();
		// The unrelated right-hand branch stays collapsed (no auto-expand of it).
		expect(selectButtonByText(container, "C")).toBeFalsy();
		unmount();
	});

	it("routes a selection-ancestor's collapse to the override, and the override beats auto-reveal (AC7)", () => {
		// Select the left-hand chord so s0, s0/m0 and s0/m0/leftHand auto-reveal.
		const selection = {
			kind: "event",
			sectionIndex: 0,
			measureIndex: 0,
			hand: "leftHand",
			eventIndex: 0,
		};
		const { container, unmount, calls } = renderTree({
			expandedPaths: new Set(),
			collapsedOverride: new Set(),
			selection,
		});
		// The ancestor rows and the selected leaf are revealed.
		expect(selectButtonByText(container, "Measure 1")).toBeTruthy();
		expect(selectButtonByText(container, "Left hand")).toBeTruthy();
		expect(selectButtonByText(container, "C E G")).toBeTruthy();

		// Collapsing an ancestor row (Measure 1) routes to the override, not the
		// manual expandedPaths Set — that is what lets a manual collapse stick.
		click(selectButtonByText(container, "Measure 1"));
		expect(calls.toggleOverride).toEqual(["s0/m0"]);
		expect(calls.toggle).toEqual([]);
		unmount();

		// Re-render with that ancestor in collapsedOverride (the controlled analog of
		// the parent applying the toggle): the override vetoes the auto-reveal, so the
		// ancestor's descendants are hidden while the ancestor row itself stays visible.
		const { container: c2, unmount: u2 } = renderTree({
			expandedPaths: new Set(),
			collapsedOverride: new Set(["s0/m0"]),
			selection,
		});
		expect(selectButtonByText(c2, "Measure 1")).toBeTruthy();
		expect(selectButtonByText(c2, "Left hand")).toBeFalsy();
		expect(selectButtonByText(c2, "Right hand")).toBeFalsy();
		expect(selectButtonByText(c2, "C E G")).toBeFalsy();
		u2();
	});

	it("still auto-reveals a different selection's ancestors when the override is empty (AC7 reveal half)", () => {
		// A different leaf (the right-hand C note) with an EMPTY override: its
		// ancestors must still auto-reveal — the override only vetoes paths it holds.
		const { container, unmount } = renderTree({
			expandedPaths: new Set(),
			collapsedOverride: new Set(),
			selection: {
				kind: "event",
				sectionIndex: 0,
				measureIndex: 0,
				hand: "rightHand",
				eventIndex: 0,
			},
		});
		expect(selectButtonByText(container, "Section 1")).toBeTruthy();
		expect(selectButtonByText(container, "Measure 1")).toBeTruthy();
		expect(selectButtonByText(container, "Right hand")).toBeTruthy();
		expect(selectButtonByText(container, "C")).toBeTruthy();
		unmount();
	});

	it("marks the selected row aria-current", () => {
		const { container, unmount } = renderTree({
			selection: { kind: "section", sectionIndex: 1 },
		});
		expect(
			selectButtonByText(container, "Section 2").getAttribute("aria-current"),
		).toBe("true");
		expect(
			selectButtonByText(container, "Section 1").getAttribute("aria-current"),
		).toBeNull();
		unmount();
	});
});

describe("StructureTree — a11y wiring", () => {
	it("carries aria-posinset/aria-setsize on sibling rows", () => {
		const { container, unmount } = renderTree();
		const sectionTwoRow = selectButtonByText(container, "Section 2").closest("tr");
		expect(sectionTwoRow.getAttribute("aria-posinset")).toBe("2");
		expect(sectionTwoRow.getAttribute("aria-setsize")).toBe("2");
		unmount();
	});

	it("carries aria-expanded on an expandable row reflecting its state", () => {
		const { container, unmount } = renderTree();
		// Section 0 is expanded in the default fixture; section 1 is not.
		const sectionOneRow = selectButtonByText(container, "Section 1").closest("tr");
		const sectionTwoRow = selectButtonByText(container, "Section 2").closest("tr");
		expect(sectionOneRow.getAttribute("aria-expanded")).toBe("true");
		expect(sectionTwoRow.getAttribute("aria-expanded")).toBe("false");
		unmount();
	});
});
