/**
 * The editor's live, read-only sheet-music preview — the in-editor mirror of the
 * front-end render. Given the author's RAW song string it reuses the notation
 * core end to end: the `validateSong` gate, the pure `buildLayoutModel` layout,
 * and the `renderInto` SVG emit. It owns NO layout math; like `view.js` it is
 * only thin DOM glue, but it lives entirely in the editor and never imports from
 * `view.js`.
 *
 * Per render (an effect keyed on the `song` string and the measured container
 * width) it:
 *   1. runs the reused `validateSong` gate — render-or-nothing: any error (or an
 *      empty/whitespace song) clears the container and draws nothing, matching the
 *      front-end's non-renderable state (no raw echo, no error);
 *   2. for a conformant song, parses it, builds the layout model at the live
 *      container width (px → sp, stepping the scale down on a narrow box), and
 *      mounts the SVG with the caller's `accessibleName`;
 *   3. gates the FIRST draw on the music font so the ornate glyphs are present on
 *      first paint, falling back to an immediate draw when the Font Loading API is
 *      unavailable (jsdom, or a browser without it); and
 *   4. reflows on container resize via a rAF-debounced, one-way `ResizeObserver`
 *      that re-measures the width and lets the effect re-run (width flows
 *      container → SVG only, never back), torn down on unmount.
 *
 * The thin glue here (the px → sp width rule, the font gate, the resize observer)
 * deliberately MIRRORS `view.js` rather than importing it, so the editor stays
 * decoupled from the front-end entry.
 */
import { useEffect, useRef, useState } from "@wordpress/element";
import { SP_PX } from "../notation/constants.js";
import { MUSIC_FONT_FAMILY } from "../notation/glyphs.js";
import { buildLayoutModel } from "../notation/layout.js";
import { renderInto } from "../notation/svg.js";
import validateSong from "../song/validate.js";

/** Below this container width (px) the staff space steps down a notch. */
const NARROW_CONTAINER_PX = 480;
/** The stepped-down sp→px scale used below `NARROW_CONTAINER_PX`. */
const NARROW_SP_PX = 7;

/**
 * The available width for the layout, in staff spaces, from a container's live
 * content width. Converts px → sp via `SP_PX`, stepping the scale down one notch
 * below `NARROW_CONTAINER_PX` so a narrow editor packs more onto each system.
 * Mirrors `view.js`'s rule (not imported). Tolerates a 0 width (jsdom reports
 * `clientWidth` as 0): it returns 0, which the layout floors without throwing.
 *
 * @param {?Element} container The preview container.
 * @return {number} The available width in staff spaces (≥ 0).
 */
function availableWidthInSp(container) {
	const widthPx = Math.max(container?.clientWidth ?? 0, 0);
	const spPx =
		widthPx > 0 && widthPx < NARROW_CONTAINER_PX ? NARROW_SP_PX : SP_PX;
	return widthPx / spPx;
}

/**
 * Run `draw` once the music font is loaded, so the first paint has the ornate
 * glyphs (clefs, rests, accidentals, flags, brace). Falls back to an immediate
 * draw when the Font Loading API is unavailable (the hand-drawn skeleton still
 * renders without the font). Mirrors `view.js`'s `drawWhenFontReady` (not
 * imported).
 *
 * @param {() => void} draw The first-draw callback.
 */
function drawWhenFontReady(draw) {
	const fonts = typeof document !== "undefined" ? document.fonts : null;
	if (!fonts?.load) {
		draw();
		return;
	}
	// Load the renamed family specifically; either way the draw runs (never
	// blocked) and the rejection is swallowed so nothing reaches the console.
	fonts
		.load(`1em "${MUSIC_FONT_FAMILY}"`)
		.catch(() => {})
		.then(() => draw());
}

/**
 * A live, read-only sheet-music preview of the conformant song, rendered with the
 * notation core. Non-renderable input (empty/whitespace, invalid JSON, or
 * non-conformant) draws nothing — the container is left empty.
 *
 * @param {Object}  props
 * @param {string}  props.song             The author's RAW song string.
 * @param {string} [props.accessibleName] The accessible name set on the SVG
 *   `<title>` (computed by the caller from the song metadata). Defaults to "".
 * @return {Object} The preview container element.
 */
export default function SongPreview({ song, accessibleName = "" }) {
	const containerRef = useRef(null);
	// A measured-width state whose change re-runs the draw effect on resize. It
	// only ever flows container → SVG (the effect reads `clientWidth` directly),
	// so this never feeds the container width back and cannot loop.
	const [, setMeasuredWidth] = useState(0);

	// Draw effect: gate on `validateSong`, then for a conformant song build the
	// model at the live width and mount the SVG. Re-runs on a `song` change (and a
	// resize, via `setMeasuredWidth` from the observer below).
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		// The reused gate covers both invalid JSON ("Invalid JSON: …") and a
		// non-conformant structure; a whitespace-only string fails JSON.parse too.
		// Any error → clear the container and render nothing (front-end parity).
		if (validateSong(song).length > 0) {
			container.replaceChildren();
			return;
		}

		// Safe after a clean validate (it cannot fail), but wrapped defensively so a
		// surprise still leaves the container empty rather than throwing.
		let data;
		try {
			data = JSON.parse(song);
		} catch {
			container.replaceChildren();
			return;
		}

		const draw = () => {
			const model = buildLayoutModel(data, availableWidthInSp(container));
			renderInto(container, model, { accessibleName });
		};

		// Gate the FIRST draw on the music font; subsequent resize redraws need not
		// re-wait (the font is cached by then).
		drawWhenFontReady(draw);
	}, [song, accessibleName]);

	// Resize observer: a rAF-debounced, one-way reflow. On a width change it bumps
	// the measured-width state, which re-runs the draw effect at the new width. It
	// NEVER writes the container width back, so it cannot trigger an observer loop.
	useEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === "undefined") {
			return;
		}
		let frame = 0;
		const observer = new ResizeObserver(() => {
			if (frame) {
				return;
			}
			frame = requestAnimationFrame(() => {
				frame = 0;
				setMeasuredWidth(Math.max(container.clientWidth ?? 0, 0));
			});
		});
		observer.observe(container);
		return () => {
			if (frame) {
				cancelAnimationFrame(frame);
			}
			observer.disconnect();
		};
	}, []);

	return (
		<div ref={containerRef} className="wp-block-piano-block-piano__preview" />
	);
}
