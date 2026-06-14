/**
 * The frontend `viewScriptModule` entry — a thin Interactivity API store module.
 *
 * WordPress builds this as a real ES module (via `viewScriptModule` in `block.json`)
 * and enqueues it on the frontend only, only when the block is present. It owns boot,
 * lifecycle, and per-instance state; every musical decision lives in the pure layout
 * layer (`notation/layout.js`); the emit layer (`notation/svg.js`) turns the model
 * into SVG. This file only wires the Interactivity API to those two.
 *
 * The store registers:
 *   - `callbacks.init` wired via `data-wp-init` on the block wrapper: parses the
 *     song once, caches the result in a per-instance `WeakMap` memo keyed by the
 *     wrapper element, gates the FIRST draw on the music font, then attaches a
 *     rAF-debounced `ResizeObserver` that writes `context.width` on a width change
 *     so `callbacks.draw` (the watch) fires automatically.
 *   - `callbacks.draw` wired via `data-wp-watch="callbacks.draw"` on the wrapper
 *     (the attribute is emitted by `render.php`, NOT by this file): the SINGLE
 *     owner of the imperative draw, re-resolving everything it needs from
 *     `getElement().ref` + the per-instance memo — no closure over `init`'s locals.
 *   - `actions.toggleNoteNames`: flips `context.showNoteNames` in place so the
 *     reactive watch fires and `draw` re-runs.
 *
 * Imperative-SVG carve-out: the SVG body is built imperatively in the frozen
 * notation core (`createElementNS` + `container.replaceChildren`). The spec
 * explicitly authorises that imperative mount as an accepted exception to the
 * directives-only ideal — analogous to the allowed `.focus()` write. The iAPI win
 * here is ownership of boot, lifecycle, and state, not declarative rendering of the
 * notation.
 *
 * Per-instance memo: a module-level `WeakMap<Element, { data, fontReady }>` keyed
 * by the wrapper element. Each block instance's `init` seeds its own entry; `draw`
 * looks up the same key via `getElement().ref`, so the two lifecycles always operate
 * on identical per-instance state with no cross-instance leak. The `WeakMap` is
 * naturally garbage-collected when the wrapper leaves the DOM.
 */

import { store, getContext, getElement } from "@wordpress/interactivity";
import { availableWidthInSp, drawWhenFontReady } from "./notation/dom.js";
import { buildLayoutModel } from "./notation/layout.js";
import { renderInto } from "./notation/svg.js";
import { parseAndValidate } from "./song/validate.js";
import { inferNoteNameSystem } from "./song/noteNameSystem.js";

/**
 * Per-instance memo keyed by the block wrapper element. Each entry holds:
 *   - `data` {object}  The parsed song object (computed once by `init`).
 *   - `fontReady` {boolean}  `true` after the music font gate resolves (set by
 *     `init`'s `drawWhenFontReady` callback); `draw` returns early until then.
 *
 * Using a `WeakMap` rather than a module-level variable or a context field ensures
 * true per-instance isolation: two Piano blocks on the same page each write their
 * own entry, look up their own entry, and are naturally collected when their element
 * leaves the DOM.
 *
 * @type {WeakMap<Element, { data: object, fontReady: boolean }>}
 */
const instanceMemo = new WeakMap();

/**
 * Attach a rAF-debounced, one-way `ResizeObserver` to `score`. On a width change
 * it WRITES `context.width` (via the live `getContext()` bound to the current
 * element scope) instead of calling draw directly — the write triggers the reactive
 * `data-wp-watch="callbacks.draw"` watch automatically. It NEVER reads the
 * container width back through the observer, so it cannot trigger an observer loop.
 * The work is wrapped in `requestAnimationFrame`, which also clears the benign
 * "undelivered notifications" browser warning.
 *
 * Returns the `ResizeObserver` instance so the caller can disconnect it on unmount,
 * or `undefined` when `ResizeObserver` is unavailable.
 *
 * @param {Element}           score   The inner score `<div>` to observe.
 * @param {() => object}      getCtx  Bound getter for the per-instance context
 *   (captured by `init` at attachment time via `getContext`).
 * @return {ResizeObserver|undefined}
 */
function observeResize( score, getCtx ) {
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
			// Write to context.width; the reactive watch fires draw automatically.
			getCtx().width = availableWidthInSp( score );
		} );
	} );
	observer.observe( score );
	return observer;
}

/**
 * Return `true` when the layout model contains at least one notehead record — i.e.
 * the song has at least one note event in any measure of any system. A song with
 * only rests (or an empty song) returns `false`.
 *
 * Used by `init` to gate the button's `hasNameableNotes` context flag: only when
 * this is `true` should the toggle button be revealed.
 *
 * @param {{ systems: Array<{ measures: Array<{ right?: { notes?: object[] },
 *   left?: { notes?: object[] } }> }> }} model The layout model.
 * @return {boolean}
 */
function hasNameableNotes( model ) {
	return model.systems.some( ( s ) =>
		s.measures.some(
			( m ) =>
				( m.right?.notes?.length || 0 ) +
					( m.left?.notes?.length || 0 ) >
				0,
		),
	);
}

store( 'piano-block/piano', {
	actions: {
		/**
		 * Toggle the per-instance note-names display. Mutates `context.showNoteNames`
		 * in place (never reassign — Interactivity API reactivity requires mutation).
		 * The `data-wp-watch="callbacks.draw"` watch fires automatically because the
		 * reactive read in `callbacks.draw` subscribes to this field.
		 */
		toggleNoteNames() {
			const c = getContext();
			c.showNoteNames = ! c.showNoteNames;
		},
	},

	callbacks: {
		/**
		 * Per-instance boot callback, wired via `data-wp-init` on the wrapper.
		 *
		 * Runs once per block instance when the Interactivity API hydrates the element.
		 * Responsibilities:
		 *   1. Parse the song once (validate-once: resize + toggle redraws reuse the
		 *      cached `data` with no re-parse and no re-validation).
		 *   2. Seed the per-instance `instanceMemo` entry (`data` + `fontReady`).
		 *   3. Compute `hasNameableNotes` from a names-off layout model and set
		 *      `context.hasNameableNotes` so the button becomes visible for songs with
		 *      at least one notehead.
		 *   4. Gate the FIRST draw on the music font via `drawWhenFontReady`; on
		 *      resolve, set `memo.fontReady = true` and write the initial
		 *      `context.width` so the watch-driven `callbacks.draw` runs for the first
		 *      time (draw returns early until `fontReady` is set).
		 *   5. Attach a rAF-debounced `ResizeObserver` to the INNER score `<div>`
		 *      (not the wrapper) that writes `context.width` on every width change.
		 *   6. Return a teardown function so the Interactivity API disconnects the
		 *      observer on unmount.
		 *
		 * @return {() => void} Cleanup function — disconnects the `ResizeObserver`.
		 */
		init() {
			const { ref: wrapper } = getElement();
			const score = wrapper.querySelector(
				'.wp-block-piano-block-piano__score',
			);
			const c = getContext();
			const { song: raw } = c;

			// Validate-once: a single `parseAndValidate` call both parses the raw
			// string and checks conformance. Any error → render nothing, leave
			// `hasNameableNotes` false, return with no observer (no teardown needed).
			const { data, errors } = parseAndValidate( raw );
			if ( errors.length > 0 ) {
				return;
			}

			// Seed the per-instance memo. `fontReady` starts false; `callbacks.draw`
			// returns early until the font gate below flips it true.
			const memo = { data, fontReady: false };
			instanceMemo.set( wrapper, memo );

			// Compute hasNameableNotes once (names-off model, no DOM, pure data).
			// Build with showNoteNames:false — we only need the structural shape to
			// detect whether any note records exist.
			const probeModel = buildLayoutModel( data, 0, { showNoteNames: false } );
			c.hasNameableNotes = hasNameableNotes( probeModel );

			// Capture the context getter in a closure so the ResizeObserver (which
			// runs outside the store's scope restoration) can still write to the
			// correct per-instance context. `getContext` is scope-bound at call time,
			// so we wrap it once here while the iAPI scope is live.
			const getCtx = () => c;

			// Gate the FIRST draw on the music font so ornate glyphs (clefs, rests,
			// accidentals, flags, brace) are present on first paint. After the font
			// resolves, flip `fontReady` true and write the initial `context.width`
			// to trigger the watch-driven `callbacks.draw`.
			drawWhenFontReady( () => {
				memo.fontReady = true;
				c.width = availableWidthInSp( score );
			} );

			// Attach the ResizeObserver to the INNER score div (not the wrapper), so
			// width changes reflect the score's actual rendering area. Writes
			// `context.width` on each change; the watch fires `callbacks.draw`.
			const observer = observeResize( score, getCtx );

			// Return a cleanup function — `data-wp-init` treats a function return value
			// as a teardown, run on unmount. The `?.` covers the no-ResizeObserver path.
			return () => observer?.disconnect();
		},

		/**
		 * The SINGLE draw funnel, wired via `data-wp-watch="callbacks.draw"` on the
		 * wrapper (that HTML attribute is owned by `render.php`; this file only
		 * registers the method). Fires automatically whenever `context.showNoteNames`
		 * or `context.width` changes because this callback reads both — the
		 * Interactivity API tracks those reads as reactive subscriptions.
		 *
		 * This method does NOT close over `init`'s local scope: every value it needs
		 * is re-resolved on each invocation via `getElement().ref` (wrapper),
		 * `.querySelector` (score div), `getContext()` (context fields), and the
		 * `instanceMemo` `WeakMap` (parsed song + font-ready flag). The resolution
		 * path is identical to `init`'s, so the two lifecycles can never diverge and
		 * there is no `ReferenceError`.
		 *
		 * Returns early when the per-instance memo has not been seeded (parse error)
		 * or when the music font is not yet ready (the first `drawWhenFontReady`
		 * callback has not fired). The watch may fire before `init` completes if the
		 * context changes during hydration; the early-return guard is safe in that
		 * race.
		 */
		draw() {
			const c = getContext();
			// Read both reactive fields — subscribes this watch to both signals.
			const show = c.showNoteNames;
			const width = c.width;

			const { ref: wrapper } = getElement();
			const score = wrapper.querySelector(
				'.wp-block-piano-block-piano__score',
			);

			// Look up the per-instance memo seeded by `init`.
			const memo = instanceMemo.get( wrapper );
			// Guard: memo absent (parse error) or font not yet ready.
			if ( ! memo?.fontReady ) {
				return;
			}

			const { data } = memo;
			const { accessibleName } = c;

			// Resolve the note-name system from the parsed song's pitches; falls back
			// to 'english' for a song with no pitches.
			const system = data.language ?? inferNoteNameSystem( data );

			const model = buildLayoutModel( data, width, {
				showNoteNames: show,
				system,
			} );

			// `renderInto` targets the inner score <div>, so the SSR <button> in the
			// wrapper is never touched — it survives every redraw.
			renderInto( score, model, { accessibleName } );
		},
	},
} );
