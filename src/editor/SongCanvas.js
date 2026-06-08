/**
 * The canvas-first editor's read surface — the rendered sheet-music staff the
 * author reads while editing through the structure tree and inspector panels. It
 * replaces the old read-only preview: it reuses the very same notation-core render
 * path (the px→sp width rule, the music-font gate, `buildLayoutModel` →
 * `renderInto`, and the rAF-debounced `ResizeObserver`) but renders from a PARSED
 * working object — so the seeded empty song shows an empty grand staff — and layers
 * one editor behavior on top:
 *
 *   SELECTION decoration — after each draw, an `"event"` selection's note/rest
 *   group is marked `is-selected` (located by the scoped `selectionQuery`, since
 *   the emitted `id` is not globally unique); re-applied on every redraw, and a
 *   stale selection (query matches nothing) decorates nothing. A section or
 *   measure selection decorates nothing on the canvas — those kinds are surfaced
 *   only through the structure tree and the inspector panels (a dedicated
 *   section/measure canvas indication is a later follow-up).
 *
 * The canvas is display + highlight only — it does NOT hit-test or set selection.
 * Selection is driven by the left structure tree (`StructureTree`); the contextual
 * add/remove note lives in the `NotePanel` and the section/measure/first-note
 * add-remove lives in the tree. The canvas renders the front-end-identical SVG
 * (no `interactive` hit-rect) and only adds the `is-selected` class.
 *
 * Like the old preview, the thin DOM glue here MIRRORS `view.js` rather than
 * importing it, so the editor stays decoupled from the front-end entry. This
 * component owns NO selection state — the parent passes the current `selection`
 * and the working `song` object, and this component only decorates them.
 */

import { useEffect, useRef, useState } from "@wordpress/element";
import { SP_PX } from "../notation/constants.js";
import { MUSIC_FONT_FAMILY } from "../notation/glyphs.js";
import { buildLayoutModel } from "../notation/layout.js";
import { renderInto } from "../notation/svg.js";
import { globalMeasureNumber, selectionQuery } from "./selection.js";

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
 * @param {?Element} container The canvas container.
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
 * draw when the Font Loading API is unavailable (jsdom, or a browser without it).
 * Mirrors `view.js`'s `drawWhenFontReady` (not imported).
 *
 * @param {() => void} draw The first-draw callback.
 */
function drawWhenFontReady(draw) {
	const fonts = typeof document !== "undefined" ? document.fonts : null;
	if (!fonts?.load) {
		draw();
		return;
	}
	fonts
		.load(`1em "${MUSIC_FONT_FAMILY}"`)
		.catch(() => {})
		.then(() => draw());
}

/**
 * Decorate the current selection after a draw. Only an `"event"` selection
 * decorates: its note/rest group is marked `is-selected`, located by the
 * measure-scoped `selectionQuery` (the emitted `id` is not globally unique, since
 * `eventIndex` resets per measure). A section or measure selection decorates
 * nothing on the canvas — those kinds are surfaced through the structure tree and
 * the inspector panels (a dedicated section/measure canvas indication is a later
 * follow-up).
 *
 * A stale selection (its global number is `null`, or the query matches nothing —
 * the node was removed or the song changed) decorates nothing, so the highlight
 * simply disappears until a live selection is set.
 *
 * @param {Element}  container The canvas container holding the SVG.
 * @param {?Object}  selection The current selection tuple, or `null`.
 * @param {Object}   song      The working song object (for the global numbers).
 */
function decorateSelection(container, selection, song) {
	if (selection?.kind !== "event") {
		return;
	}

	const measureNumber = globalMeasureNumber(
		song,
		selection.sectionIndex,
		selection.measureIndex,
	);
	if (measureNumber === null) {
		return;
	}

	const node = container.querySelector(
		selectionQuery({
			measureNumber,
			hand: selection.hand,
			eventIndex: selection.eventIndex,
		}),
	);
	if (node) {
		node.classList.add("is-selected");
	}
}

/**
 * The sheet-music canvas. Renders the working song with the notation core and
 * decorates the current selection (display + highlight only — selection is driven
 * by the structure tree, not by clicking the canvas). Renders nothing into the SVG
 * host on a build/render failure (the container is left empty), staying defensive
 * even though the parent only mounts it for a valid/seeded working object.
 *
 * @param {Object}   props
 * @param {Object}   props.song            The parsed working song object.
 * @param {?Object}  props.selection       The current selection tuple, or `null`.
 * @param {string}  [props.accessibleName] The SVG `<title>` accessible name.
 * @return {Object} The canvas element (the SVG host).
 */
export default function SongCanvas({
	song,
	selection = null,
	accessibleName = "",
}) {
	const containerRef = useRef(null);
	// A measured-width state whose change re-runs the draw effect on resize. It
	// only ever flows container → SVG (the effect reads `clientWidth` directly), so
	// this never feeds the container width back and cannot loop.
	const [, setMeasuredWidth] = useState(0);

	// Draw effect: build the model at the live width, mount the SVG, then decorate
	// the current selection. Re-runs on a `song` or `selection` change (and a
	// resize, via `setMeasuredWidth` from the observer).
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}

		const draw = () => {
			// Defensive: the parent gates validity and only mounts the canvas for a
			// renderable working object, but a surprise must leave the host empty
			// rather than throw (mirrors the old preview's try/catch).
			try {
				const model = buildLayoutModel(song, availableWidthInSp(container));
				// No `interactive` flag: the canvas is display-only, so it renders the
				// front-end-identical SVG (no per-event hit-rect) and never hit-tests.
				renderInto(container, model, { accessibleName });
			} catch {
				container.replaceChildren();
				return;
			}
			decorateSelection(container, selection, song);
		};

		// Gate the FIRST draw on the music font; later resize/selection redraws need
		// not re-wait (the font is cached by then).
		drawWhenFontReady(draw);
	}, [song, selection, accessibleName]);

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
		<div className="wp-block-piano-block-piano__canvas">
			{/* The SVG host. The notation core renders into this node; the host is a
			    display-only render container — the selectable controls live in the
			    structure tree, not here. After each draw an `"event"` selection's
			    note/rest group is decorated with the `is-selected` class. */}
			<div
				ref={containerRef}
				className="wp-block-piano-block-piano__canvas-svg"
			/>
		</div>
	);
}
