/**
 * The canvas-first editor's single interactive surface — the rendered sheet-music
 * staff the author both reads and edits on. It replaces the old read-only preview:
 * it reuses the very same notation-core render path (the px→sp width rule, the
 * music-font gate, `buildLayoutModel` → `renderInto`, and the rAF-debounced
 * `ResizeObserver`) but renders from a PARSED working object — so the seeded empty
 * song shows an empty grand staff — and layers three editor behaviors on top:
 *
 *   1. SELECTION hit-testing — a click (or Enter/Space on a focused group) on a
 *      note/rest resolves to a `{ sectionIndex, measureIndex, hand, eventIndex }`
 *      selection via the core's emitted `data-*` hooks (`data-kind`/`data-hand`/
 *      `data-event-index` on the event, `data-measure` on its measure group) and
 *      the editor-side `measureCoords` flatten; a click on empty staff clears it.
 *   2. SELECTION decoration — after each draw, the currently-selected group is
 *      marked `is-selected` and made focusable, located by the scoped
 *      `selectionQuery` (the emitted `id` is not globally unique, so a measure-
 *      scoped query is required). Re-applied on every redraw; a stale selection
 *      (query matches nothing) decorates nothing.
 *   3. ADD affordances — real HTML `<button>`s layered beside the SVG (not
 *      SVG-embedded, so they get native focus/labels): per hand per measure an
 *      "add note" button (hand = which staff), and one end-of-score "add measure"
 *      button. They only SIGNAL intent (`onAddNote`/`onAddMeasure`); the parent
 *      owns the structural edit + the resulting selection.
 *
 * Like the old preview, the thin DOM glue here MIRRORS `view.js` rather than
 * importing it, so the editor stays decoupled from the front-end entry. This
 * component owns NO selection state — the parent passes the current `selection`
 * and the working `song` object, and this component emits selection/add intents.
 */

import { Button } from "@wordpress/components";
import { useEffect, useRef, useState } from "@wordpress/element";
import { __, sprintf } from "@wordpress/i18n";
import { SP_PX } from "../notation/constants.js";
import { MUSIC_FONT_FAMILY } from "../notation/glyphs.js";
import { buildLayoutModel } from "../notation/layout.js";
import { renderInto } from "../notation/svg.js";
import {
	globalMeasureNumber,
	measureCoords,
	selectionQuery,
} from "./selection.js";

/** Below this container width (px) the staff space steps down a notch. */
const NARROW_CONTAINER_PX = 480;
/** The stepped-down sp→px scale used below `NARROW_CONTAINER_PX`. */
const NARROW_SP_PX = 7;

/** The two hands, paired with their canvas add-note label, in staff order. */
const HANDS = [
	{ key: "rightHand", label: __("right hand", "piano-block") },
	{ key: "leftHand", label: __("left hand", "piano-block") },
];

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
 * @return {?{ sectionIndex: number, measureIndex: number, hand: string,
 *   eventIndex: number }} The selection, or `null` for an empty-area activation.
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
	return {
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
 * Decorate the selected note/rest group with `is-selected` after a draw, located
 * by the measure-scoped `selectionQuery`. A stale selection (the query matches
 * nothing — the event was removed, or the song changed) decorates nothing, so the
 * highlight simply disappears until a live selection is set.
 *
 * @param {Element}  container The canvas container holding the SVG.
 * @param {?Object}  selection The current selection tuple, or `null`.
 * @param {Object}   song      The working song object (for the global number).
 */
function decorateSelection(container, selection, song) {
	if (!selection) {
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
 * The interactive sheet-music canvas. Renders the working song with the notation
 * core, hit-tests note/rest selection, decorates the current selection, and
 * exposes per-measure add-note (hand = staff) and an end-of-score add-measure
 * affordance. Renders nothing into the SVG host on a build/render failure (the
 * container is left empty), staying defensive even though the parent only mounts
 * it for a valid/seeded working object.
 *
 * @param {Object}   props
 * @param {Object}   props.song            The parsed working song object.
 * @param {?Object}  props.selection       The current selection tuple, or `null`.
 * @param {string}  [props.accessibleName] The SVG `<title>` accessible name.
 * @param {(selection: ?Object) => void} props.onSelect Called with a selection
 *   tuple on a note/rest activation, or `null` on an empty-area activation.
 * @param {(sectionIndex: number, measureIndex: number, hand: string) => void}
 *   props.onAddNote Called to append a note to a measure's hand (hand = staff).
 * @param {() => void} props.onAddMeasure Called to append a measure to the song.
 * @return {Object} The canvas element (the SVG host plus the add affordances).
 */
export default function SongCanvas({
	song,
	selection = null,
	accessibleName = "",
	onSelect,
	onAddNote,
	onAddMeasure,
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

	// The add-note affordances, one pair per measure (right/left hand), labelled by
	// their global measure number so the labels are stable and assertable.
	const coords = measureCoords(song);

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
			<div className="wp-block-piano-block-piano__canvas-actions">
				{coords.map(({ sectionIndex, measureIndex }, position) => {
					const measureNumber = position + 1;
					return HANDS.map(({ key, label }) => (
						<Button
							key={`${measureNumber}-${key}`}
							variant="secondary"
							className="wp-block-piano-block-piano__add-note"
							label={sprintf(
								// translators: 1: hand (e.g. "right hand"), 2: measure number.
								__("Add note to %1$s in measure %2$d", "piano-block"),
								label,
								measureNumber,
							)}
							onClick={() => onAddNote?.(sectionIndex, measureIndex, key)}
						/>
					));
				})}
				<Button
					variant="secondary"
					className="wp-block-piano-block-piano__add-measure"
					onClick={() => onAddMeasure?.()}
				>
					{__("Add measure", "piano-block")}
				</Button>
			</div>
		</div>
	);
}
