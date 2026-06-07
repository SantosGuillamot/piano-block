/**
 * Unit tests for the editor's live sheet-music preview.
 *
 * `SongPreview` is the read-only mirror of the front-end render: given the raw
 * song string it runs the reused `validateSong` gate and, for a conformant
 * song, mounts an `<svg role="img">` into its container via the notation core.
 * These tests pin that render-or-nothing contract, the re-render on a changed
 * `song` prop, and the accessible name flowing onto the SVG `<title>`. They
 * render the component into jsdom (no `@testing-library/react`) and assert on
 * the produced DOM directly.
 *
 * jsdom reports `clientWidth` as 0, so the preview must render at the floor
 * width without throwing; these tests rely on that 0-width tolerance and on the
 * no-Font-Loading-API fallback path (`document.fonts` is left undefined), so the
 * first draw runs immediately and synchronously inside the mount effect.
 *
 * It must NOT touch `src/view.js`: the preview owns its own thin glue.
 */
import { createElement } from "@wordpress/element";
import { act } from "react";
import { createRoot } from "react-dom/client";
import SongPreview from "../SongPreview.js";

// Mark this as a React act-capable environment so React flushes work (including
// the mount effect that draws the SVG) synchronously inside `act`.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/** A small but conformant song: one note in each hand, with metadata. */
const SONG = JSON.stringify({
	metadata: { title: "Hello", composer: "Ada" },
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
					],
					leftHand: [
						{
							type: "note",
							duration: "whole",
							pitches: [{ step: "C", octave: 3 }],
						},
					],
				},
			],
		},
	],
});

/** A second, visibly different conformant song (a different pitch). */
const OTHER_SONG = JSON.stringify({
	metadata: { title: "Bye" },
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "half",
							pitches: [{ step: "G", octave: 4 }],
						},
					],
				},
			],
		},
	],
});

/**
 * Render an element into a fresh detached container appended to the document so
 * effects run against a live DOM, then return both. Rendering is wrapped in
 * `act` so the mount effect (the first draw) flushes synchronously.
 *
 * @param {Object} element The React element to render.
 * @return {{ container: HTMLElement, root: import("react-dom/client").Root }}
 *   The host container and its root (for re-rendering / unmount).
 */
function render(element) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => {
		root.render(element);
	});
	return { container, root };
}

/** Unmount and detach a rendered container inside `act`, flushing cleanup. */
function cleanup(container, root) {
	act(() => {
		root.unmount();
	});
	container.remove();
}

describe("SongPreview", () => {
	it("mounts an <svg role='img'> for a conformant song", () => {
		const { container, root } = render(
			createElement(SongPreview, { song: SONG }),
		);
		const svg = container.querySelector("svg");
		expect(svg).toBeTruthy();
		expect(svg.getAttribute("role")).toBe("img");
		cleanup(container, root);
	});

	it("leaves the container empty for an empty song", () => {
		const { container, root } = render(
			createElement(SongPreview, { song: "   " }),
		);
		expect(container.querySelector("svg")).toBeNull();
		cleanup(container, root);
	});

	it("leaves the container empty for an invalid song", () => {
		const { container, root } = render(
			createElement(SongPreview, { song: "{ not json" }),
		);
		expect(container.querySelector("svg")).toBeNull();
		cleanup(container, root);
	});

	it("leaves the container empty for a non-conformant song", () => {
		// Valid JSON but structurally non-conformant (sections must be an array).
		const { container, root } = render(
			createElement(SongPreview, {
				song: JSON.stringify({ metadata: {}, sections: {} }),
			}),
		);
		expect(container.querySelector("svg")).toBeNull();
		cleanup(container, root);
	});

	it("re-renders the SVG when the song prop changes", () => {
		const { container, root } = render(
			createElement(SongPreview, { song: SONG }),
		);
		const first = container.querySelector("svg");
		expect(first).toBeTruthy();

		act(() => {
			root.render(createElement(SongPreview, { song: OTHER_SONG }));
		});
		const second = container.querySelector("svg");
		expect(second).toBeTruthy();
		// A fresh draw is a single DOM swap, so the SVG node is replaced.
		expect(second).not.toBe(first);
		cleanup(container, root);
	});

	it("clears the SVG when the song prop becomes invalid", () => {
		const { container, root } = render(
			createElement(SongPreview, { song: SONG }),
		);
		expect(container.querySelector("svg")).toBeTruthy();

		act(() => {
			root.render(createElement(SongPreview, { song: "" }));
		});
		expect(container.querySelector("svg")).toBeNull();
		cleanup(container, root);
	});

	it("reflects the accessibleName on the SVG <title>", () => {
		const { container, root } = render(
			createElement(SongPreview, {
				song: SONG,
				accessibleName: "Hello by Ada",
			}),
		);
		const title = container.querySelector("svg title");
		expect(title).toBeTruthy();
		expect(title.textContent).toBe("Hello by Ada");
		cleanup(container, root);
	});

	it("renders without throwing when the container reports a 0 width", () => {
		// jsdom already reports clientWidth as 0; assert the floor draw still mounts.
		const { container, root } = render(
			createElement(SongPreview, { song: SONG }),
		);
		expect(container.querySelector("svg")).toBeTruthy();
		cleanup(container, root);
	});
});
