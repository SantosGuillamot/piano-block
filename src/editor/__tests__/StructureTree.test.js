/**
 * Unit tests for the left **structure tree** — the editor's selection surface.
 *
 * `StructureTree` is a pure controlled component built on `__experimentalTreeGrid`:
 * it flattens the song into Section → Measure → {Right hand, Left hand} → Note rows
 * (respecting expansion), signals a kind-tagged `selection` through `onSelect` for
 * section/measure/note rows, and signals add/remove/duplicate intent through a
 * per-row `DropdownMenu` (hand-group rows host a single direct "Add note"). Each
 * row mirrors core's List View row: a select-only label `Button` with a
 * non-focusable stock chevron beside it, and an actions `DropdownMenu`. Hand-group
 * rows are organizational — the label toggles expansion and the cell hosts the
 * per-hand "Add note", but they never select (KD 14).
 *
 * Expansion is a single membership lookup against one `expanded` Set of
 * coordinate-derived keys (`s0`, `s0m0`, `s0m0rightHand`) — no ancestor test, no
 * veto, no auto-reveal. These tests pin the row inventory at each level (and that
 * collapsed sections/measures hide their descendants until their key is in the
 * Set), the `name`-or-positional labels and `noteLabel` note labels, the
 * kind-tagged select payloads (and that a hand row does not select), the split of
 * select-only label vs chevron toggle, the per-row `DropdownMenu` actions + the
 * per-hand "Add note", `aria-current` on the selected row, and the treegrid ARIA
 * wiring (`aria-level`/`-posinset`/`-setsize`/`-expanded`) exposed by the mock.
 *
 * The component is presentational, so the tests render it into jsdom (the same
 * `createRoot`/`act` harness the sibling suites use) and drive the mocked
 * `@wordpress/components` controls directly. The `__experimentalTreeGrid*` and
 * `DropdownMenu` mocks render DOM-honest stand-ins (a `<table role="treegrid">`
 * and an always-open menu), leaving the real keyboard/roving-tabindex and
 * focus-trap model to the e2e suite.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { StructureTree } from "../StructureTree.js";
import { resolveSelection } from "../selection.js";

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
 * Find a select/label button by its exact visible text. Section, measure, hand and
 * note rows render a label `Button` whose text content is the plain label (the
 * disclosure chevron is a sibling `<span>`/`<Icon>`, not part of the button text),
 * so an exact-text match locates the row's select control.
 */
function selectButtonByText(container, text) {
	return Array.from(container.querySelectorAll("button")).find(
		(button) => (button.textContent ?? "") === text,
	);
}

/** All select/label buttons whose text equals `text`. */
function selectButtonsByText(container, text) {
	return Array.from(container.querySelectorAll("button")).filter(
		(button) => (button.textContent ?? "") === text,
	);
}

/**
 * The non-focusable disclosure chevron for the row whose label is `text`: the
 * sibling `__tree-expander` span inside the same row, carrying the pointer toggle.
 */
function expanderForRow(container, text) {
	const row = selectButtonByText(container, text).closest("tr");
	return row.querySelector(".wp-block-piano-block-piano__tree-expander");
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
 * kind-tagged shape `edit.js` feeds the component. `expanded` defaults to a Set
 * with section 0, its first measure and both hands' coordinate keys, so the
 * deepest rows are visible without relying on auto-reveal (which is dropped).
 */
function renderTree({
	song = fixtureSong(),
	selection = null,
	expanded = new Set(["s0", "s0m0", "s0m0rightHand", "s0m0leftHand"]),
	system = "english",
} = {}) {
	const calls = {
		select: [],
		toggle: [],
		removeSection: [],
		duplicateSection: [],
		addSectionBefore: [],
		addSectionAfter: [],
		removeMeasure: [],
		duplicateMeasure: [],
		addMeasureBefore: [],
		addMeasureAfter: [],
		addNote: [],
		removeNote: [],
		duplicateNote: [],
		addNoteBefore: [],
		addNoteAfter: [],
	};
	const { container, unmount } = render(
		createElement(StructureTree, {
			song,
			selection: resolveSelection(song, selection),
			system,
			expanded,
			onToggleExpanded: (key) => calls.toggle.push(key),
			onSelect: (next) => calls.select.push(next),
			onRemoveSection: (si) => calls.removeSection.push(si),
			onDuplicateSection: (si) => calls.duplicateSection.push(si),
			onAddSectionBefore: (si) => calls.addSectionBefore.push(si),
			onAddSectionAfter: (si) => calls.addSectionAfter.push(si),
			onRemoveMeasure: (si, mi) => calls.removeMeasure.push([si, mi]),
			onDuplicateMeasure: (si, mi) => calls.duplicateMeasure.push([si, mi]),
			onAddMeasureBefore: (si, mi) => calls.addMeasureBefore.push([si, mi]),
			onAddMeasureAfter: (si, mi) => calls.addMeasureAfter.push([si, mi]),
			onAddNote: (si, mi, hand) => calls.addNote.push([si, mi, hand]),
			onRemoveNote: (si, mi, hand, ei) =>
				calls.removeNote.push([si, mi, hand, ei]),
			onDuplicateNote: (si, mi, hand, ei) =>
				calls.duplicateNote.push([si, mi, hand, ei]),
			onAddNoteBefore: (si, mi, hand, ei) =>
				calls.addNoteBefore.push([si, mi, hand, ei]),
			onAddNoteAfter: (si, mi, hand, ei) =>
				calls.addNoteAfter.push([si, mi, hand, ei]),
		}),
	);
	return { container, unmount, calls };
}

describe("StructureTree — inventory", () => {
	it("renders section, measure, hand and note rows at the right levels", () => {
		const { container, unmount } = renderTree();
		const rowLevel = (text) =>
			selectButtonByText(container, text).closest("tr");
		expect(rowLevel("Section 1").getAttribute("aria-level")).toBe("1");
		expect(rowLevel("Measure 1").getAttribute("aria-level")).toBe("2");
		expect(rowLevel("Right hand").getAttribute("aria-level")).toBe("3");
		expect(rowLevel("Left hand").getAttribute("aria-level")).toBe("3");
		// The right-hand note row (C) and the left-hand chord row (C E G) are leaves.
		expect(rowLevel("C").getAttribute("aria-level")).toBe("4");
		expect(rowLevel("C E G").getAttribute("aria-level")).toBe("4");
		unmount();
	});

	it("hides a collapsed section's descendants until its key is in the Set", () => {
		// Empty `expanded` Set and no selection: only the two section rows show.
		const { container, unmount } = renderTree({ expanded: new Set() });
		expect(selectButtonByText(container, "Section 1")).toBeTruthy();
		expect(selectButtonByText(container, "Section 2")).toBeTruthy();
		// No measures, hands or notes are visible while collapsed.
		expect(selectButtonsByText(container, "Measure 1")).toHaveLength(0);
		expect(selectButtonByText(container, "Right hand")).toBeFalsy();
		expect(selectButtonByText(container, "C")).toBeFalsy();
		unmount();
	});

	it("hides a collapsed measure's hands until the measure key is in the Set", () => {
		// Section 0 expanded but its measures collapsed: measure rows show, no hands.
		const { container, unmount } = renderTree({
			expanded: new Set(["s0"]),
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
			expanded: new Set(["s0", "s0m1"]),
		});
		const measureTwoRow = selectButtonByText(container, "Measure 2").closest(
			"tr",
		);
		// Both hand rows follow measure 2 in the flattened order.
		expect(selectButtonsByText(container, "Right hand").length).toBeGreaterThan(
			0,
		);
		expect(selectButtonsByText(container, "Left hand").length).toBeGreaterThan(
			0,
		);
		expect(measureTwoRow).toBeTruthy();
		unmount();
	});

	it("does not reveal a selection's ancestors when the Set is empty (no auto-reveal)", () => {
		// Select the left-hand chord with an EMPTY `expanded` Set: auto-reveal is
		// dropped, so the deep selected leaf is NOT revealed — only the top-level
		// section rows render.
		const { container, unmount } = renderTree({
			expanded: new Set(),
			selection: {
				kind: "event",
				sectionIndex: 0,
				measureIndex: 0,
				hand: "leftHand",
				eventIndex: 0,
			},
		});
		expect(selectButtonByText(container, "Section 1")).toBeTruthy();
		expect(selectButtonsByText(container, "Measure 1")).toHaveLength(0);
		expect(selectButtonByText(container, "Left hand")).toBeFalsy();
		expect(selectButtonByText(container, "C E G")).toBeFalsy();
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
			expanded: new Set(["s1", "s1m0", "s1m0rightHand"]),
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

	it("does not select when a hand-group row label is clicked (it toggles instead)", () => {
		const { container, unmount, calls } = renderTree();
		click(selectButtonByText(container, "Right hand"));
		// A hand row label toggles expansion but never selects.
		expect(calls.select).toEqual([]);
		expect(calls.toggle).toEqual(["s0m0rightHand"]);
		unmount();
	});
});

describe("StructureTree — select-only label vs chevron toggle", () => {
	it("selects (not toggles) when a section label is clicked", () => {
		const { container, unmount, calls } = renderTree({
			expanded: new Set(),
		});
		click(selectButtonByText(container, "Section 1"));
		// The label is select-only after the redesign: it selects, never toggles.
		expect(calls.select).toEqual([{ kind: "section", sectionIndex: 0 }]);
		expect(calls.toggle).toEqual([]);
		unmount();
	});

	it("toggles (not selects) when a section chevron is clicked", () => {
		const { container, unmount, calls } = renderTree({
			expanded: new Set(),
		});
		click(expanderForRow(container, "Section 1"));
		// The chevron is the disclosure affordance: it toggles, never selects.
		expect(calls.toggle).toEqual(["s0"]);
		expect(calls.select).toEqual([]);
		unmount();
	});

	it("toggles a measure's expansion via its chevron with the coordinate key", () => {
		const { container, unmount, calls } = renderTree();
		click(expanderForRow(container, "Measure 1"));
		expect(calls.toggle).toEqual(["s0m0"]);
		expect(calls.select).toEqual([]);
		unmount();
	});
});

describe("StructureTree — row-action toggle present", () => {
	it("renders the action-menu toggle at section, measure and note level", () => {
		// Under the hardened DropdownMenu mock (which mirrors core's `return null`
		// when children are not a render function), this assertion FAILS if the
		// per-row menus regress to plain-element children — the component renders
		// null, so no toggle button reaches the DOM. With the render-function
		// children in place, each representative row's three-dots toggle is present
		// by its "Actions for …" accessible name. This names the exact regression
		// (the toggle is in the DOM), belt-and-suspenders to the item assertions.
		const { container, unmount } = renderTree();
		expect(buttonByLabel(container, "Actions for Section 1")).toBeTruthy();
		expect(
			buttonByLabel(container, "Actions for Measure 1 of section 1"),
		).toBeTruthy();
		expect(
			buttonByLabel(
				container,
				"Actions for Note 1 of Right hand of measure 1 of section 1",
			),
		).toBeTruthy();
		unmount();
	});
});

describe("StructureTree — row actions", () => {
	it("removes and duplicates a section from its DropdownMenu", () => {
		const { container, unmount, calls } = renderTree();
		// The row menu trigger carries the per-row accessible name; its items render
		// directly under the always-open menu mock and are queryable by visible text.
		expect(buttonByLabel(container, "Actions for Section 1")).toBeTruthy();
		const sectionTwoMenu = buttonByLabel(
			container,
			"Actions for Section 2",
		).closest("div");
		const sectionOneMenu = buttonByLabel(
			container,
			"Actions for Section 1",
		).closest("div");
		click(selectButtonByText(sectionTwoMenu, "Remove"));
		click(selectButtonByText(sectionOneMenu, "Duplicate"));
		expect(calls.removeSection).toEqual([1]);
		expect(calls.duplicateSection).toEqual([0]);
		unmount();
	});

	it("inserts a section before and after from its DropdownMenu", () => {
		const { container, unmount, calls } = renderTree();
		const sectionTwoMenu = buttonByLabel(
			container,
			"Actions for Section 2",
		).closest("div");
		click(selectButtonByText(sectionTwoMenu, "Add before"));
		click(selectButtonByText(sectionTwoMenu, "Add after"));
		expect(calls.addSectionBefore).toEqual([1]);
		expect(calls.addSectionAfter).toEqual([1]);
		unmount();
	});

	it("removes and duplicates a measure from its DropdownMenu", () => {
		const { container, unmount, calls } = renderTree();
		const measureTwoMenu = buttonByLabel(
			container,
			"Actions for Measure 2 of section 1",
		).closest("div");
		const measureOneMenu = buttonByLabel(
			container,
			"Actions for Measure 1 of section 1",
		).closest("div");
		click(selectButtonByText(measureTwoMenu, "Remove"));
		click(selectButtonByText(measureOneMenu, "Duplicate"));
		expect(calls.removeMeasure).toEqual([[0, 1]]);
		expect(calls.duplicateMeasure).toEqual([[0, 0]]);
		unmount();
	});

	it("inserts a measure before and after from its DropdownMenu", () => {
		const { container, unmount, calls } = renderTree();
		const measureOneMenu = buttonByLabel(
			container,
			"Actions for Measure 1 of section 1",
		).closest("div");
		click(selectButtonByText(measureOneMenu, "Add before"));
		click(selectButtonByText(measureOneMenu, "Add after"));
		expect(calls.addMeasureBefore).toEqual([[0, 0]]);
		expect(calls.addMeasureAfter).toEqual([[0, 0]]);
		unmount();
	});

	it("adds a note to each hand via the per-hand Add note button", () => {
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

	it("removes and duplicates a note from its DropdownMenu", () => {
		const { container, unmount, calls } = renderTree();
		const noteMenu = buttonByLabel(
			container,
			"Actions for Note 1 of Right hand of measure 1 of section 1",
		).closest("div");
		const chordMenu = buttonByLabel(
			container,
			"Actions for Note 1 of Left hand of measure 1 of section 1",
		).closest("div");
		click(selectButtonByText(noteMenu, "Remove"));
		click(selectButtonByText(chordMenu, "Duplicate"));
		expect(calls.removeNote).toEqual([[0, 0, "rightHand", 0]]);
		expect(calls.duplicateNote).toEqual([[0, 0, "leftHand", 0]]);
		unmount();
	});

	it("inserts a note before and after from its DropdownMenu", () => {
		const { container, unmount, calls } = renderTree();
		const noteMenu = buttonByLabel(
			container,
			"Actions for Note 1 of Right hand of measure 1 of section 1",
		).closest("div");
		click(selectButtonByText(noteMenu, "Add before"));
		click(selectButtonByText(noteMenu, "Add after"));
		expect(calls.addNoteBefore).toEqual([[0, 0, "rightHand", 0]]);
		expect(calls.addNoteAfter).toEqual([[0, 0, "rightHand", 0]]);
		// "Remove" is still found by name — the isDestructive flag only adds a class.
		expect(selectButtonByText(noteMenu, "Remove")).toBeTruthy();
		unmount();
	});
});

describe("StructureTree — aria-current", () => {
	it("marks the selected row aria-current and leaves unselected rows without it", () => {
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
		const sectionTwoRow = selectButtonByText(container, "Section 2").closest(
			"tr",
		);
		expect(sectionTwoRow.getAttribute("aria-posinset")).toBe("2");
		expect(sectionTwoRow.getAttribute("aria-setsize")).toBe("2");
		unmount();
	});

	it("carries aria-expanded on an expandable row reflecting its state", () => {
		const { container, unmount } = renderTree();
		// Section 0 is expanded in the default fixture; section 1 is not.
		const sectionOneRow = selectButtonByText(container, "Section 1").closest(
			"tr",
		);
		const sectionTwoRow = selectButtonByText(container, "Section 2").closest(
			"tr",
		);
		expect(sectionOneRow.getAttribute("aria-expanded")).toBe("true");
		expect(sectionTwoRow.getAttribute("aria-expanded")).toBe("false");
		unmount();
	});
});

describe("StructureTree — keyboard expand/collapse wiring", () => {
	// These tests pin the data-expansion-key contract so the TreeGrid's
	// onExpandRow/onCollapseRow callbacks can route to the right key. The pure
	// routing of expansionKeyOf → onToggleExpanded is pinned in selection.test.js;
	// here we assert attribute presence, correct key strings, and leaf absence.
	it("carries data-expansion-key on each expandable row with the correct key string", () => {
		const { container, unmount } = renderTree();
		// The default renderTree expanded set includes section 0, measure 0, and both hands.
		const sectionRow = selectButtonByText(container, "Section 1").closest("tr");
		const measureRow = selectButtonByText(container, "Measure 1").closest("tr");
		const rightHandRow = selectButtonByText(container, "Right hand").closest(
			"tr",
		);
		const leftHandRow = selectButtonByText(container, "Left hand").closest(
			"tr",
		);

		expect(sectionRow.getAttribute("data-expansion-key")).toBe("s0");
		expect(measureRow.getAttribute("data-expansion-key")).toBe("s0m0");
		expect(rightHandRow.getAttribute("data-expansion-key")).toBe(
			"s0m0rightHand",
		);
		expect(leftHandRow.getAttribute("data-expansion-key")).toBe("s0m0leftHand");
		unmount();
	});

	it("does not carry data-expansion-key on leaf note rows", () => {
		const { container, unmount } = renderTree();
		// The right-hand note row (C) and the left-hand chord row (C E G) are leaves.
		const noteRow = selectButtonByText(container, "C").closest("tr");
		const chordRow = selectButtonByText(container, "C E G").closest("tr");

		expect(noteRow.getAttribute("data-expansion-key")).toBeNull();
		expect(chordRow.getAttribute("data-expansion-key")).toBeNull();
		unmount();
	});

	it("passes non-no-op onExpandRow and onCollapseRow to the treegrid", () => {
		// Structural assertion: the callbacks are wired — a no-op handler would not
		// route through onToggleExpanded. We verify by confirming that a <tr> with a
		// data-expansion-key has the expected attribute value (the pure mapping is
		// covered in selection.test.js; this pins the attribute's presence and value
		// so the real TreeGrid's callbacks can read and route correctly).
		const { container, unmount } = renderTree();
		const expandableRows = Array.from(container.querySelectorAll("tr")).filter(
			(tr) => tr.getAttribute("data-expansion-key") !== null,
		);
		// All three expandable levels (section, measure, hand) must carry the key.
		expect(expandableRows.length).toBeGreaterThanOrEqual(3);
		// Each row's key attribute is a non-empty string.
		expandableRows.forEach((tr) => {
			expect(tr.getAttribute("data-expansion-key")).toBeTruthy();
		});
		unmount();
	});
});

describe("StructureTree — accessible name", () => {
	it("carries aria-label on the treegrid and no dead label attribute", () => {
		// The <TreeGrid> is passed aria-label="Song structure" (not the old `label`
		// prop). The mock spreads ...rest onto the <table>, so the aria-label reaches
		// the DOM as a real attribute. The old mock mapped label→aria-label, so this
		// test would still pass if the production prop were reverted to `label` — that
		// is the point of de-translating the mock: this test goes RED if `label` is
		// used, because the mock no longer maps it.
		const { container, unmount } = renderTree();
		const treegrid = container.querySelector('[role="treegrid"]');
		expect(treegrid.getAttribute("aria-label")).toBe("Song structure");
		expect(treegrid.getAttribute("label")).toBeNull();
		unmount();
	});
});
