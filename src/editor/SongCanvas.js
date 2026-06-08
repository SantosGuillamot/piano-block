/**
 * The canvas-first editor's single interactive surface — the rendered sheet-music
 * staff the author both reads and edits on. It replaces the old read-only preview:
 * it reuses the very same notation-core render path (the px→sp width rule, the
 * music-font gate, `buildLayoutModel` → `renderInto`, and the rAF-debounced
 * `ResizeObserver`) but renders from a PARSED working object — so the seeded empty
 * song shows an empty grand staff — and layers two editor behaviors on top:
 *
 *   1. SELECTION hit-testing — a click (or Enter/Space on a focused group) on a
 *      note/rest resolves to a `{ sectionIndex, measureIndex, hand, eventIndex }`
 *      selection via the core's emitted `data-*` hooks (`data-kind`/`data-hand`/
 *      `data-event-index` on the event, `data-measure` on its measure group) and
 *      the editor-side `measureCoords` flatten; a click on empty staff clears it.
 *   2. SELECTION decoration — after each draw, the current selection is marked,
 *      branched by its `kind`: an event group is `is-selected` (located by the
 *      scoped `selectionQuery`, since the emitted `id` is not globally unique); a
 *      measure group is `is-active-measure`; a section's measure groups are each
 *      `is-active-section` (derived from `measureNumbersForSection` — the emit
 *      carries no `data-section`). Event groups are also made focusable. A
 *      measure/section highlight `scrollIntoView`s its group; re-applied on every
 *      redraw, and a stale selection (query matches nothing) decorates nothing.
 *
 * Adding/removing is no longer a canvas affordance: the contextual add/remove note
 * lives in the `NotePanel` and the section/measure/first-note add-remove lives in the
 * sidebar `StructureList`. This component is selection + decoration only.
 *
 * Like the old preview, the thin DOM glue here MIRRORS `view.js` rather than
 * importing it, so the editor stays decoupled from the front-end entry. This
 * component owns NO selection state — the parent passes the current `selection`
 * and the working `song` object, and this component emits selection intents only.
 */

import { useEffect, useRef, useState } from "@wordpress/element";
import { SP_PX } from "../notation/constants.js";
import { MUSIC_FONT_FAMILY } from "../notation/glyphs.js";
import { buildLayoutModel } from "../notation/layout.js";
import { renderInto } from "../notation/svg.js";
import {
	globalMeasureNumber,
	measureCoords,
	measureNumbersForSection,
	selectionQuery,
} from "./selection.js";

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
 * Resolve a click/activation target inside the rendered SVG to a selection tuple,
 * or `null` when the activation did not land on a note/rest (empty staff area).
 *
 * Reads the core's emitted hooks: the nearest `[data-kind="note"|"rest"]`
 * ancestor carries `data-hand` + `data-event-index`; its enclosing
 * `[data-measure]` group carries the 1-based global measure number, which
 * `measureCoords(song)[N - 1]` maps to `(sectionIndex, measureIndex)`.
 *
 * @param {EventTarget} target The activation target (the clicked/focused node).
 * @param {Object}      song   The working song object (for the measure flatten).
 * @return {?{ kind: "event", sectionIndex: number, measureIndex: number,
 *   hand: string, eventIndex: number }} The selection, or `null` for an
 *   empty-area activation.
 */
function selectionFromTarget(target, song) {
	if (!target || typeof target.closest !== "function") {
		return null;
	}
	const event = target.closest('[data-kind="note"], [data-kind="rest"]');
	if (!event) {
		return null;
	}
	const measureGroup = event.closest("[data-measure]");
	if (!measureGroup) {
		return null;
	}
	const measureNumber = Number(measureGroup.getAttribute("data-measure"));
	const coords = measureCoords(song)[measureNumber - 1];
	if (!coords) {
		return null;
	}
	const hand = event.getAttribute("data-hand");
	const eventIndex = Number(event.getAttribute("data-event-index"));
	// Canvas selections are always events; the `kind` tag lets the sidebar gate the
	// per-level panels and the structure list share one selection shape.
	return {
		kind: "event",
		sectionIndex: coords.sectionIndex,
		measureIndex: coords.measureIndex,
		hand,
		eventIndex,
	};
}

/**
 * Make every rendered note/rest group focusable + button-like, so it can be
 * tabbed to and activated with Enter/Space (the keyboard baseline; richer
 * note-to-note traversal is a later refinement). Runs after each draw on the
 * freshly mounted SVG.
 *
 * @param {Element} container The canvas container holding the SVG.
 */
function makeEventsFocusable(container) {
	const events = container.querySelectorAll(
		'[data-kind="note"], [data-kind="rest"]',
	);
	events.forEach((node) => {
		node.setAttribute("tabindex", "0");
		node.setAttribute("role", "button");
	});
}

/**
 * Scroll a located group into view, guarding the call so jsdom (which has no
 * `scrollIntoView` on SVG children) and a stale/empty match never throw.
 *
 * @param {?Element} group The group to reveal, or a falsy value to skip.
 */
function scrollGroupIntoView(group) {
	if (group && typeof group.scrollIntoView === "function") {
		group.scrollIntoView({ inline: "nearest", block: "nearest" });
	}
}

/**
 * Decorate (and scroll to) the current selection after a draw, branched by its
 * `kind` — the emit carries no `data-section`, so a section highlight is *derived*
 * as the set of its measures' `data-measure` groups (no emit change, front end
 * byte-identical):
 *   - `"event"`   → the measure-scoped `selectionQuery` group, class `is-selected`.
 *   - `"measure"` → the one `[data-measure="N"]` group, class `is-active-measure`.
 *   - `"section"` → every `[data-measure="K"]` group of the section, class
 *     `is-active-section` (the section scrolls its *first* measure into view).
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
	if (!selection) {
		return;
	}

	if (selection.kind === "section") {
		const numbers = measureNumbersForSection(song, selection.sectionIndex);
		let firstGroup = null;
		numbers.forEach((measureNumber) => {
			const group = container.querySelector(
				`[data-measure="${measureNumber}"]`,
			);
			if (group) {
				group.classList.add("is-active-section");
				firstGroup = firstGroup ?? group;
			}
		});
		scrollGroupIntoView(firstGroup);
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

	if (selection.kind === "measure") {
		const group = container.querySelector(`[data-measure="${measureNumber}"]`);
		if (group) {
			group.classList.add("is-active-measure");
			scrollGroupIntoView(group);
		}
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
 * The interactive sheet-music canvas. Renders the working song with the notation
 * core, hit-tests note/rest selection, and decorates the current selection. Renders
 * nothing into the SVG host on a build/render failure (the container is left empty),
 * staying defensive even though the parent only mounts it for a valid/seeded working
 * object.
 *
 * @param {Object}   props
 * @param {Object}   props.song            The parsed working song object.
 * @param {?Object}  props.selection       The current selection tuple, or `null`.
 * @param {string}  [props.accessibleName] The SVG `<title>` accessible name.
 * @param {(selection: ?Object) => void} props.onSelect Called with a selection
 *   tuple on a note/rest activation, or `null` on an empty-area activation.
 * @return {Object} The canvas element (the SVG host).
 */
export default function SongCanvas({
	song,
	selection = null,
	accessibleName = "",
	onSelect,
}) {
	const containerRef = useRef(null);
	// A measured-width state whose change re-runs the draw effect on resize. It
	// only ever flows container → SVG (the effect reads `clientWidth` directly), so
	// this never feeds the container width back and cannot loop.
	const [, setMeasuredWidth] = useState(0);

	// Draw effect: build the model at the live width and mount the SVG, then make
	// events focusable and decorate the current selection. Re-runs on a `song` or
	// `selection` change (and a resize, via `setMeasuredWidth` from the observer).
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
				// `interactive: true` adds the editor-only per-event hit-rect so a click in
				// a note/rest column (not just on its thin ink) resolves to the group. The
				// front-end `view.js` omits the flag, keeping the published SVG identical.
				renderInto(container, model, { accessibleName, interactive: true });
			} catch {
				container.replaceChildren();
				return;
			}
			makeEventsFocusable(container);
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

	// Keep the live `song`/`onSelect` in a ref so the native listeners (subscribed
	// once below) always read the current values without re-subscribing each render.
	const activateRef = useRef(null);
	activateRef.current = (target) => {
		onSelect?.(selectionFromTarget(target, song));
	};

	// Selection listeners on the host: a click (or Enter/Space on a focused
	// note/rest group) resolves to a selection; an empty-area click clears it.
	// They are native listeners rather than JSX props because the activation target
	// is a group the notation core renders imperatively into the host. Each call
	// stops propagation so it never bubbles out to deselect the block — the
	// inspector panels require the block to stay selected.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		const onClick = (clickEvent) => {
			clickEvent.stopPropagation();
			activateRef.current(clickEvent.target);
		};
		const onKeyDown = (keyEvent) => {
			if (keyEvent.key !== "Enter" && keyEvent.key !== " ") {
				return;
			}
			// Only act on a focused note/rest group; let other keys pass through.
			if (
				!keyEvent.target?.closest?.('[data-kind="note"], [data-kind="rest"]')
			) {
				return;
			}
			keyEvent.preventDefault();
			keyEvent.stopPropagation();
			activateRef.current(keyEvent.target);
		};
		container.addEventListener("click", onClick);
		container.addEventListener("keydown", onKeyDown);
		return () => {
			container.removeEventListener("click", onClick);
			container.removeEventListener("keydown", onKeyDown);
		};
	}, []);

	return (
		<div className="wp-block-piano-block-piano__canvas">
			{/* The SVG host. The notation core renders into this node; native click /
			    keydown listeners (wired in an effect, not as JSX props) delegate to the
			    focusable note/rest groups the core emits inside it. The host is just a
			    render container — the selectable controls are those inner groups, each
			    made focusable + `role="button"` after every draw. */}
			<div
				ref={containerRef}
				className="wp-block-piano-block-piano__canvas-svg"
			/>
		</div>
	);
}
