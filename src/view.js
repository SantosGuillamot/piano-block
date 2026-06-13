/**
 * The frontend `viewScript` entry — the thin, DOM-coupled half of the renderer.
 * WordPress enqueues this on the frontend only, only when the block is present,
 * after the block markup. It owns NO layout math: every musical decision lives in
 * the pure layout layer (`notation/layout.js`); the emit layer (`notation/svg.js`)
 * turns the model into SVG. This file only wires the DOM to those two.
 *
 * Per block container (the wrapper `<div>` `render.php` emits) it:
 *   1. reads the inert `application/json` `<script>`'s `textContent` (the raw song);
 *   2. runs the reused `validateSong` gate — render-or-nothing;
 *   3. for a conformant song, parses it, builds the layout model at the live
 *      container width, and mounts the SVG (a non-conformant or invalid song leaves
 *      the wrapper empty — the non-renderable state, no raw echo, no error);
 *   4. computes the accessible name from `metadata` (i18n-wrapped);
 *   5. gates the FIRST draw on the music font so the ornate glyphs are present on
 *      first paint; and
 *   6. reflows on container resize via a rAF-debounced, one-way `ResizeObserver`
 *      (width flows container → SVG only, never back).
 */

import domReady from "@wordpress/dom-ready";
import { availableWidthInSp, drawWhenFontReady } from "./notation/dom.js";
import { buildLayoutModel } from "./notation/layout.js";
import { renderInto } from "./notation/svg.js";
import { accessibleNameFor } from "./song/accessibleName.js";
import validateSong from "./song/validate.js";

/**
 * The block wrapper class WordPress emits for `piano-block/piano` (the
 * `get_block_wrapper_attributes()` class on `render.php`'s `<div>`). The frontend
 * scopes its query to this so it never touches unrelated markup.
 */
const BLOCK_CLASS = "wp-block-piano-block-piano";

/**
 * The class on the inert JSON `<script>` `render.php` nests inside the wrapper.
 * Scoped to the wrapper so a stray match elsewhere is impossible.
 */
const SONG_SCRIPT_CLASS = "wp-block-piano-block-piano__song";

/**
 * Wire one block container: gate on `validateSong`, and for a conformant song draw
 * the notation and attach the resize observer. A non-renderable song (invalid JSON
 * or non-conformant) leaves the wrapper empty — no raw echo, no error.
 *
 * @param {Element} container The block wrapper `<div>`.
 */
function setupContainer(container) {
	const script = container.querySelector(`script.${SONG_SCRIPT_CLASS}`);
	if (!script) {
		return;
	}

	const raw = script.textContent ?? "";
	// The reused gate: one call covers both invalid JSON ("Invalid JSON: …") and a
	// non-conformant structure. Any error → render nothing.
	if (validateSong(raw).length > 0) {
		return;
	}

	// Safe after a clean validate (it cannot fail), but wrapped defensively so a
	// surprise still leaves the wrapper empty rather than throwing on the frontend.
	let data;
	try {
		data = JSON.parse(raw);
	} catch {
		return;
	}

	const accessibleName = accessibleNameFor(data?.metadata);
	const draw = () => {
		const model = buildLayoutModel(data, availableWidthInSp(container));
		renderInto(container, model, { accessibleName });
	};

	// Gate the FIRST draw on the music font so the ornate glyphs (clefs, rests,
	// accidentals, flags, brace) are present on first paint. Subsequent
	// resize redraws need not re-wait — the font is cached by then.
	drawWhenFontReady(draw);

	observeResize(container, draw);
}

/**
 * Attach a rAF-debounced, one-way `ResizeObserver` to the container. On a width
 * change it re-runs `draw` (re-pack/justify + a fresh SVG); it NEVER
 * writes the container width back, so it cannot trigger an observer loop. The work is
 * wrapped in `requestAnimationFrame`, which also clears the benign "undelivered
 * notifications" warning.
 *
 * @param {Element} container The observed block wrapper.
 * @param {() => void} draw The redraw callback.
 */
function observeResize(container, draw) {
	if (typeof ResizeObserver === "undefined") {
		return;
	}
	let frame = 0;
	const observer = new ResizeObserver(() => {
		if (frame) {
			return;
		}
		frame = requestAnimationFrame(() => {
			frame = 0;
			draw();
		});
	});
	observer.observe(container);
}

// Boot on DOM ready: wire every Piano block container on the page.
domReady(() => {
	const containers = document.querySelectorAll(`.${BLOCK_CLASS}`);
	for (const container of containers) {
		setupContainer(container);
	}
});
