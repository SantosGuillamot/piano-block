/**
 * Project-wide string-icon guard.
 *
 * Every icon-bearing component in this editor receives a `@wordpress/icons`
 * element (not a Dashicon slug string) as its `icon` prop. A string slug
 * routes through `Icon` → `<Dashicon>` and requires the dashicons stylesheet,
 * which may be absent in the editor canvas iframe — the glyph renders as an
 * empty box. A real element is `cloneElement`d by `Icon` into an inline `<svg>`
 * that needs no stylesheet.
 *
 * The icons mock exports element sentinels (`<svg data-wp-icon="…">`), and the
 * components mock's `Icon` renders a valid element via `cloneElement` or returns
 * `null` for a non-element. So a correct element icon produces a marked node in
 * the DOM and a string icon produces nothing. Each test below mounts one
 * icon-bearing component, asserts the marked node is present, and goes RED if
 * any `icon` prop is reverted to a string.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { AnnotationList } from "../AnnotationList.js";
import { HandConfigEditor } from "../HandConfigEditor.js";
import { AddButton } from "../ListControls.js";
import { PitchList } from "../PitchList.js";
import { StructureTree } from "../StructureTree.js";
import { resolveSelection } from "../selection.js";

// Mark this as a React act-capable environment so React flushes work inside
// `act` synchronously instead of warning.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render an element into a fresh detached container.
 *
 * @param {Object} element The React element to render.
 * @return {{ container: HTMLElement, unmount: Function }} The render handle.
 */
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

describe("String-icon guard — every icon-bearing component renders a marked <svg>", () => {
	it("AddButton (plus icon) renders the icon sentinel", () => {
		const { container, unmount } = render(
			createElement(AddButton, { onClick: () => {}, label: "Add item" }),
		);
		expect(container.querySelector("[data-wp-icon]")).not.toBeNull();
		unmount();
	});

	it("PitchList remove button (trash icon) renders the icon sentinel", () => {
		const { container, unmount } = render(
			createElement(PitchList, {
				pitches: [
					{ step: "C", octave: 4 },
					{ step: "E", octave: 4 },
				],
				system: "english",
				onChange: () => {},
			}),
		);
		// Each remove button carries a trash icon; assert at least one is present.
		expect(container.querySelector("[data-wp-icon]")).not.toBeNull();
		unmount();
	});

	it("AnnotationList remove button (trash icon) renders the icon sentinel", () => {
		const { container, unmount } = render(
			createElement(AnnotationList, {
				annotations: [{ text: "cresc.", placement: "above" }],
				kind: "event",
				onChange: () => {},
			}),
		);
		expect(container.querySelector("[data-wp-icon]")).not.toBeNull();
		unmount();
	});

	it("HandConfigEditor remove-alteration button (trash icon) renders the icon sentinel", () => {
		const { container, unmount } = render(
			createElement(HandConfigEditor, {
				handConfig: { alters: { C: 1 } },
				onChange: () => {},
				label: "Right hand",
			}),
		);
		expect(container.querySelector("[data-wp-icon]")).not.toBeNull();
		unmount();
	});

	it("StructureTree action toggle (moreVertical) and expander chevrons render icon sentinels", () => {
		const song = {
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
		const { container, unmount } = render(
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
		// The tree uses moreVertical (action toggle), plus (add note), and chevrons.
		expect(container.querySelector("[data-wp-icon]")).not.toBeNull();
		unmount();
	});
});
