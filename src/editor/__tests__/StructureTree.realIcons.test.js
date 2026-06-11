/**
 * Real-icon guard for the structure tree (R-REG3b) — the canary that catches
 * root cause #2 (a string `icon` slug instead of a real `@wordpress/icons`
 * element) forever.
 *
 * Review 6 shipped the hand-row Add-note button with `icon="plus"` (a Dashicon
 * SLUG string). A string slug routes through `Icon` → `<Dashicon>` and needs the
 * dashicons stylesheet, which is not reliably present in the editor canvas
 * iframe — so the glyph rendered as an empty bordered square. The fix (T1)
 * passes the real element `icon={plus}`, a pre-rendered SVG that `Icon`
 * `cloneElement`s into an inline `<svg>` needing no stylesheet. The whole unit
 * suite ran green through that regression because its `@wordpress/icons` mock
 * makes every icon an inert string sentinel — a string and an element are
 * indistinguishable to it. This test closes that gap.
 *
 * Unlike the rest of the suite, THIS file runs under the `real-icons` jest
 * project (see `jest.config.js`), which DROPS the `@wordpress/icons` mapping so
 * the specifier resolves to the genuine installed package — `plus` /
 * `moreVertical` / `chevronRightSmall` are real SVG elements here, not string
 * sentinels. (`jest.requireActual` would NOT work: against the still-mapped
 * specifier it resolves back through `moduleNameMapper` to the string mock — the
 * un-map MUST happen at the config level.) That project also carries the
 * six-module React-dedup `moduleNameMapper`, a HARD prerequisite: without it
 * `isValidElement(plus)` is `false` (an icon element built by the package's
 * nested React 18 carries a different `$$typeof` Symbol than the top-level React
 * the runner uses), so a real icon could not even render. The smoke-check below
 * confirms the un-map + dedup actually resolved a real element before the real
 * assertions run.
 *
 * The components mock is reused verbatim (its DOM-honest `TreeGrid*` /
 * `MenuItem` stand-ins pass children through untouched, so real SVGs flow into
 * the mocked table) EXCEPT for the three icon-bearing components — `Icon`,
 * `Button` and `DropdownMenu` — which are swapped, locally to this file, so each
 * renders its `icon` through an element-rendering `Icon` that mirrors the real
 * `Icon`'s `cloneElement(icon)`: a real inline `<svg>` for an element and
 * NOTHING for a string (`isValidElement("plus")` is false, and a string cannot
 * be `cloneElement`d). The default stand-ins swallow the `icon` prop on
 * `Button`/`DropdownMenu` (the rest of the suite never inspects glyphs), but the
 * real components render it through `Icon`; mirroring that here is what lets the
 * canary observe the real `<svg>` through the production surface. So the
 * assertions go GREEN for `icon={plus}` and RED for an `icon="plus"` regression
 * — the same path the string would break on.
 */

// Override the three icon-bearing components for THIS file only.
// `jest.requireActual` here resolves THROUGH `moduleNameMapper` to the project's
// stand-ins mock (this file un-maps only `@wordpress/icons`, not
// `@wordpress/components`), so every other DOM-honest stand-in
// (TreeGrid/TreeGridCell/MenuItem/MenuGroup…) is kept as-is.
//
// The default stand-ins SWALLOW the `icon` prop on `Button`/`DropdownMenu` (the
// rest of the suite never inspects glyphs), but the real components render that
// `icon` through `Icon` — so to observe the real `<svg>` through the production
// surface, this file's `Button`/`DropdownMenu` render their `icon` through the
// element-rendering `Icon`, exactly as the real components do. `Icon` itself
// mirrors the real `Icon`'s `cloneElement(icon)`: a real inline `<svg>` for an
// element, nothing for a string (`isValidElement("plus")` is false, and a string
// cannot be `cloneElement`d) — which is precisely what makes the assertions go
// GREEN for `icon={plus}` and RED for an `icon="plus"` regression.
jest.mock("@wordpress/components", () => {
	const actual = jest.requireActual("@wordpress/components");
	const { createElement, isValidElement, cloneElement } =
		jest.requireActual("@wordpress/element");

	const Icon = ({ icon }) => (isValidElement(icon) ? cloneElement(icon) : null);

	// Mirror the real `Button`: render the `icon` through `Icon` (so an element
	// becomes an inline `<svg>` inside the button), keeping the stand-in's
	// label/onClick wiring the assertions rely on.
	const Button = ({
		onClick,
		disabled,
		label,
		"aria-label": ariaLabel,
		icon,
		children,
		variant: _variant,
		isDestructive: _isDestructive,
		...rest
	}) =>
		createElement(
			"button",
			{
				type: "button",
				onClick,
				disabled,
				"aria-label": ariaLabel ?? label,
				...rest,
			},
			icon ? createElement(Icon, { icon }) : null,
			children,
		);

	// Mirror the real `DropdownMenu`: its toggle is a `Button` carrying the `icon`,
	// so the toggle renders the icon's `<svg>` too. Otherwise keeps the stand-in's
	// core guard (render-function children) and find-trigger-then-query layout.
	const DropdownMenu = ({
		label,
		children,
		controls,
		toggleProps = {},
		icon,
		...rest
	}) => {
		if (!controls?.length && typeof children !== "function") {
			return null;
		}
		return createElement(
			"div",
			rest,
			createElement(
				"button",
				{ type: "button", "aria-label": label, ...toggleProps },
				icon ? createElement(Icon, { icon }) : null,
			),
			typeof children === "function"
				? children({ isOpen: false, onToggle: () => {}, onClose: () => {} })
				: children,
		);
	};

	return { ...actual, Icon, Button, DropdownMenu };
});

import { createElement, isValidElement } from "@wordpress/element";
import { plus } from "@wordpress/icons";
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

/** Find a label/select button by its exact visible text. */
function selectButtonByText(container, text) {
	return Array.from(container.querySelectorAll("button")).find(
		(button) => (button.textContent ?? "") === text,
	);
}

/**
 * A one-section fixture whose single measure carries a right-hand note, with the
 * section/measure/right-hand keys expanded so the hand row (and its Add-note
 * button) and the note row (and its action toggle) are all present.
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
				],
			},
		],
	};
}

/** Render a `StructureTree` over the fixture with the deepest rows revealed. */
function renderTree() {
	const song = fixtureSong();
	return render(
		createElement(StructureTree, {
			song,
			selection: resolveSelection(song, null),
			system: "english",
			expanded: new Set(["s0", "s0m0", "s0m0rightHand"]),
			onToggleExpanded: () => {},
			onSelect: () => {},
			onRemoveSection: () => {},
			onDuplicateSection: () => {},
			onAddSectionBefore: () => {},
			onAddSectionAfter: () => {},
			onRemoveMeasure: () => {},
			onDuplicateMeasure: () => {},
			onAddMeasureBefore: () => {},
			onAddMeasureAfter: () => {},
			onAddNote: () => {},
			onRemoveNote: () => {},
			onDuplicateNote: () => {},
			onAddNoteBefore: () => {},
			onAddNoteAfter: () => {},
		}),
	);
}

describe("StructureTree — real-icon guard (R-REG3b)", () => {
	it("resolves the real @wordpress/icons element (un-map + React dedup smoke-check)", () => {
		// If this fails, the `real-icons` jest project did not un-map
		// `@wordpress/icons` and/or the React-dedup mapper is missing — the real
		// assertions below would be meaningless without a genuine element here.
		expect(isValidElement(plus)).toBe(true);
		// The string sentinel the rest of the suite uses is NOT a valid element —
		// this is the distinction the canary below turns into a DOM assertion.
		expect(isValidElement("plus")).toBe(false);
	});

	it("renders the hand-row Add-note button with a real inline <svg> (THE root-cause-#2 canary)", () => {
		// This is the assertion that goes RED for `icon="plus"` (a string → no
		// `<svg>`) and GREEN for `icon={plus}` (the real element → an inline
		// `<svg>`). The hand-row `plus` is the ONLY icon review 6 shipped as a
		// string, so it is the actual regression guard — the toggle/chevron below
		// were already real elements and would pass even on the broken branch.
		const { container, unmount } = renderTree();
		const addNote = buttonByLabel(
			container,
			"Add note to Right hand of measure 1 of section 1",
		);
		expect(addNote).toBeTruthy();
		expect(addNote.querySelector("svg")).toBeTruthy();
		unmount();
	});

	it("renders the row-action toggle and disclosure chevron with real inline <svg> (completeness)", () => {
		// These already rendered real elements pre-fix, so they are NOT the
		// regression guard — they only prove the harness renders real icons
		// end-to-end (the un-map + dedup + element-rendering Icon all work).
		const { container, unmount } = renderTree();
		const toggle = buttonByLabel(container, "Actions for Section 1");
		expect(toggle).toBeTruthy();
		expect(toggle.querySelector("svg")).toBeTruthy();

		// The non-focusable disclosure chevron beside the Section 1 label.
		const sectionRow = selectButtonByText(container, "Section 1").closest("tr");
		const chevron = sectionRow.querySelector(
			".wp-block-piano-block-piano__tree-expander",
		);
		expect(chevron).toBeTruthy();
		expect(chevron.querySelector("svg")).toBeTruthy();
		unmount();
	});
});
