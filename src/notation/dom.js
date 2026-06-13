/**
 * DOM-coupled layout helpers shared by the front-end entry (`view.js`) and the
 * editor canvas (`SongCanvas.js`). These functions bridge the live DOM (container
 * width, the Font Loading API) and the pure notation core — no React, no
 * `@wordpress/element`.
 */
import { SP_PX } from "./constants.js";
import { MUSIC_FONT_FAMILY } from "./glyphs.js";

/** Below this container width (px) the staff space steps down a notch. */
const NARROW_CONTAINER_PX = 480;
/** The stepped-down sp→px scale used below `NARROW_CONTAINER_PX`. */
const NARROW_SP_PX = 7;

/**
 * The available width for the layout, in staff spaces, from a container's live
 * content width. Converts px → sp via `SP_PX`, stepping the scale down one notch
 * below `NARROW_CONTAINER_PX` so a narrow viewport packs more onto each system.
 * Tolerates a missing or zero-width container (jsdom reports `clientWidth` as 0):
 * it returns 0, which the layout floors without throwing.
 *
 * @param {?Element} container The block wrapper.
 * @return {number} The available width in staff spaces (≥ 0).
 */
export function availableWidthInSp(container) {
	const widthPx = Math.max(container?.clientWidth ?? 0, 0);
	const spPx =
		widthPx > 0 && widthPx < NARROW_CONTAINER_PX ? NARROW_SP_PX : SP_PX;
	return widthPx / spPx;
}

/**
 * Run `draw` once the music font is loaded, so the first paint has the ornate
 * glyphs (clefs, rests, accidentals, flags, brace). Falls back to an immediate
 * draw when the Font Loading API is unavailable (the hand-drawn skeleton still
 * renders without the font).
 *
 * @param {() => void} draw The first-draw callback.
 */
export function drawWhenFontReady(draw) {
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
