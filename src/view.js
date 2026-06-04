/**
 * The frontend `viewScript` entry (design §2.5, §2.6, §4, §6.3, §7) — the thin,
 * DOM-coupled half of the renderer. WordPress enqueues this on the frontend only,
 * only when the block is present, after the block markup. It owns NO layout math:
 * every musical decision lives in the pure layout layer (`notation/layout.js`); the
 * emit layer (`notation/svg.js`) turns the model into SVG. This file only wires the
 * DOM to those two.
 *
 * Per block container (the wrapper `<div>` `render.php` emits, T9) it:
 *   1. reads the inert `application/json` `<script>`'s `textContent` (the raw song);
 *   2. runs the reused `validateSong` gate — render-or-nothing (design §2.6);
 *   3. for a conformant song, parses it, builds the layout model at the live
 *      container width, and mounts the SVG (a non-conformant or invalid song leaves
 *      the wrapper empty — the §2.5 non-renderable state, no raw echo, no error);
 *   4. computes the accessible name from `metadata` (design §7, i18n-wrapped);
 *   5. gates the FIRST draw on the music font so the ornate glyphs are present on
 *      first paint (design §2.4 / open item #1); and
 *   6. reflows on container resize via a rAF-debounced, one-way `ResizeObserver`
 *      (design §6.3 / §4 — width flows container → SVG only, never back).
 */

import domReady from "@wordpress/dom-ready";
import { __, _x, sprintf } from "@wordpress/i18n";
import { SP_PX } from "./notation/constants.js";
import { MUSIC_FONT_FAMILY } from "./notation/glyphs.js";
import { buildLayoutModel } from "./notation/layout.js";
import { renderInto } from "./notation/svg.js";
import validateSong from "./song/validate.js";

/**
 * The block wrapper class WordPress emits for `piano-block/piano` (the
 * `get_block_wrapper_attributes()` class on `render.php`'s `<div>`). The frontend
 * scopes its query to this so it never touches unrelated markup.
 */
const BLOCK_CLASS = "wp-block-piano-block-piano";

/**
 * The class on the inert JSON `<script>` `render.php` nests inside the wrapper
 * (design §2.2). Scoped to the wrapper so a stray match elsewhere is impossible.
 */
const SONG_SCRIPT_CLASS = "wp-block-piano-block-piano__song";

/** Below this container width (px) the staff space steps down a notch (design §6.3). */
const NARROW_CONTAINER_PX = 480;
/** The stepped-down sp→px scale used below `NARROW_CONTAINER_PX`. */
const NARROW_SP_PX = 7;

/**
 * The accessible name for a song, computed from its `metadata` (design §7). A
 * metadata string counts only when non-empty after trim. The non-author strings are
 * i18n-wrapped (`@wordpress/i18n`); the title-only case is the author's own text, so
 * it is passed through verbatim with no wrapper.
 *
 * @param {{ title?: string, composer?: string }} [metadata] The song metadata.
 * @return {string} The single accessible name (set on the SVG `<title>`).
 */
export function accessibleNameFor(metadata) {
	const title = trimmedString(metadata?.title);
	const composer = trimmedString(metadata?.composer);

	if (title && composer) {
		// translators: 1: song title, 2: composer name.
		return sprintf(
			_x("%1$s by %2$s", "sheet music label", "piano-block"),
			title,
			composer,
		);
	}
	if (title) {
		// The author's own title — no wrapper (design §7).
		return title;
	}
	if (composer) {
		// translators: %s: composer name.
		return sprintf(
			_x("Piano sheet music by %s", "sheet music label", "piano-block"),
			composer,
		);
	}
	return __("Piano sheet music", "piano-block");
}

/** A string trimmed to its content, or `""` when the value is absent/non-string. */
function trimmedString(value) {
	return typeof value === "string" ? value.trim() : "";
}

/**
 * The available width for the layout, in staff spaces, from a container's live
 * content width (design §6.3). Converts px → sp via `SP_PX`, stepping the scale down
 * one notch below `NARROW_CONTAINER_PX` so a phone packs more onto each system.
 *
 * @param {Element} container The block wrapper.
 * @return {number} The available width in staff spaces (≥ 0).
 */
function availableWidthInSp(container) {
	const widthPx = Math.max(container.clientWidth ?? 0, 0);
	const spPx =
		widthPx > 0 && widthPx < NARROW_CONTAINER_PX ? NARROW_SP_PX : SP_PX;
	return widthPx / spPx;
}

/**
 * Wire one block container: gate on `validateSong`, and for a conformant song draw
 * the notation and attach the resize observer. A non-renderable song (invalid JSON
 * or non-conformant) leaves the wrapper empty (design §2.5) — no raw echo, no error.
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
	// non-conformant structure. Any error → render nothing (design §2.6).
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
	// accidentals, flags, brace) are present on first paint (design §2.4). Subsequent
	// resize redraws need not re-wait — the font is cached by then.
	drawWhenFontReady(draw);

	observeResize(container, draw);
}

/**
 * Run `draw` once the music font is loaded, so the first paint has the ornate glyphs
 * (design §2.4 / open item #1). Falls back to an immediate draw when the Font Loading
 * API is unavailable (the hand-drawn skeleton still renders without the font).
 *
 * @param {() => void} draw The first-draw callback.
 */
function drawWhenFontReady(draw) {
	const fonts = typeof document !== "undefined" ? document.fonts : null;
	if (!fonts?.load) {
		draw();
		return;
	}
	// Load the renamed family specifically, then fall back to the broader ready promise;
	// either way the draw runs (never blocked) and never rejects to the console.
	fonts
		.load(`1em "${MUSIC_FONT_FAMILY}"`)
		.catch(() => {})
		.then(() => draw());
}

/**
 * Attach a rAF-debounced, one-way `ResizeObserver` to the container (design §6.3 /
 * §4). On a width change it re-runs `draw` (re-pack/justify + a fresh SVG); it NEVER
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

// Boot on DOM ready: wire every Piano block container on the page (design §4).
domReady(() => {
	const containers = document.querySelectorAll(`.${BLOCK_CLASS}`);
	for (const container of containers) {
		setupContainer(container);
	}
});
