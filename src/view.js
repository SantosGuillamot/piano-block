/**
 * The frontend `viewScriptModule` entry — a thin Interactivity API store module.
 *
 * WordPress builds this as a real ES module (via `viewScriptModule` in `block.json`)
 * and enqueues it on the frontend only, only when the block is present. It owns boot,
 * lifecycle, and per-instance state; every musical decision lives in the pure layout
 * layer (`notation/layout.js`); the emit layer (`notation/svg.js`) turns the model
 * into SVG. This file only wires the Interactivity API to those two.
 *
 * The store registers a single `callbacks.init` wired via `data-wp-init` on the block
 * wrapper. Per block instance it:
 *   1. reads the container from `getElement().ref` (live, painted wrapper — non-null
 *      inside `data-wp-init`);
 *   2. reads the raw song string and the server-computed accessible name from
 *      per-instance context (`getContext()`);
 *   3. runs the reused `parseAndValidate` gate once — a single parse yields both the
 *      conformance errors and the parsed data; any error → render nothing
 *      (validate-once: resize redraws skip re-validation and re-parsing);
 *   4. for a conformant song, builds the draw closure over the parsed data (frozen core);
 *   5. gates the FIRST draw on the music font so the ornate glyphs are present on
 *      first paint; and
 *   6. attaches a rAF-debounced, one-way `ResizeObserver` and returns a disconnect
 *      cleanup so the Interactivity API can tear it down on unmount.
 *
 * Imperative-SVG carve-out: the SVG body is built imperatively in the frozen notation
 * core (`createElementNS` + `container.replaceChildren`). The spec explicitly
 * authorises that imperative mount as an accepted exception to the directives-only
 * ideal — analogous to the allowed `.focus()` write. The iAPI win here is ownership
 * of boot, lifecycle, and state, not declarative rendering of the notation.
 */

import { store, getContext, getElement } from "@wordpress/interactivity";
import { availableWidthInSp, drawWhenFontReady } from "./notation/dom.js";
import { buildLayoutModel } from "./notation/layout.js";
import { renderInto } from "./notation/svg.js";
import { parseAndValidate } from "./song/validate.js";

/**
 * Attach a rAF-debounced, one-way `ResizeObserver` to the container. On a width
 * change it re-runs `draw` (re-pack/justify + a fresh SVG); it NEVER writes the
 * container width back, so it cannot trigger an observer loop. The work is wrapped
 * in `requestAnimationFrame`, which also clears the benign "undelivered
 * notifications" warning.
 *
 * Returns the `ResizeObserver` instance so the caller can disconnect it on unmount,
 * or `undefined` when `ResizeObserver` is unavailable.
 *
 * @param {Element}   container The observed block wrapper.
 * @param {() => void} draw     The redraw callback.
 * @return {ResizeObserver|undefined}
 */
function observeResize( container, draw ) {
	if ( typeof ResizeObserver === 'undefined' ) {
		return;
	}
	let frame = 0;
	const observer = new ResizeObserver( () => {
		if ( frame ) {
			return;
		}
		frame = requestAnimationFrame( () => {
			frame = 0;
			draw();
		} );
	} );
	observer.observe( container );
	return observer;
}

store( 'piano-block/piano', {
	callbacks: {
		init() {
			const { ref: container } = getElement();
			const { song: raw, accessibleName } = getContext();

			// The reused gate: a single `parseAndValidate` call both parses the raw
			// string and checks conformance, covering invalid JSON and a non-conformant
			// structure in ONE parse. Any error → render nothing (a parse failure
			// surfaces as a non-empty `errors`, so no separate JSON.parse guard is
			// needed). Validate-once — resize redraws reuse the parsed `data` with no
			// re-validation and no re-parsing.
			const { data, errors } = parseAndValidate( raw );
			if ( errors.length > 0 ) {
				return;
			}

			// `draw` closes over the cached `data` and the context `accessibleName`;
			// it contains no `parseAndValidate`, so resize redraws reuse the cached
			// parse with no re-validation and no re-parsing (validate-once, R6/D16).
			// `renderInto` ends in `container.replaceChildren(svg)` — the authorised
			// imperative carve-out write (D11).
			const draw = () => {
				const model = buildLayoutModel( data, availableWidthInSp( container ) );
				renderInto( container, model, { accessibleName } );
			};

			// Gate the FIRST draw on the music font so the ornate glyphs (clefs,
			// rests, accidentals, flags, brace) are present on first paint. Subsequent
			// resize redraws need not re-wait — the font is cached by then. Runs
			// before the observer is attached, so the initial draw is unconditional.
			drawWhenFontReady( draw );

			const observer = observeResize( container, draw );

			// Return a cleanup function — `data-wp-init` treats a function return value
			// as a `useEffect` teardown, run on unmount. The `?.` covers the
			// no-ResizeObserver path where `observeResize` returns `undefined`.
			return () => observer?.disconnect();
		},
	},
} );
