/**
 * Pure selection-coordinate helpers — the bridge between the canvas's emitted
 * `data-*` hooks and an editor-only selection.
 *
 * A selection is `{ sectionIndex, measureIndex, hand, eventIndex }`: which event,
 * in which hand, of which measure, of which section. The notation core's SVG emit
 * (`src/notation/svg.js`) does NOT carry the section/measure *indices* — it tags
 * each measure group with a single **1-based global** measure number
 * (`data-measure`) and each note/rest with its hand and per-measure event index
 * (`data-hand` / `data-event-index`). So translating a click on the staff into a
 * selection (and a selection back into a scoped highlight query) needs an
 * editor-side flatten of `song.sections[].measures[]` that mirrors the exact order
 * the core numbers measures in.
 *
 * This module is the whole of that translation: it is pure data + a query-string
 * builder, with no React and no DOM creation. The canvas (`SongCanvas`) owns the
 * actual hit-testing and decoration; it only calls these helpers.
 *
 * THE INVARIANT: `measureCoords` walks sections outer, measures inner — the same
 * order `buildLayoutModel` uses when it assigns `number: measureNumber` (a `+= 1`
 * across every section's measures in order, see `src/notation/layout.js`). A unit
 * test pins this so the two cannot drift; if the core's walk ever changes, both
 * must change together.
 */

/**
 * The ordered `(sectionIndex, measureIndex)` of every measure, indexed by its
 * **0-based global position** — the same flatten the notation core numbers from.
 *
 * The core emits `data-measure="N"` where N is the 1-based global measure number,
 * so the coords for a given `data-measure` value are `measureCoords(song)[N - 1]`.
 * The walk mirrors `buildLayoutModel`'s exactly: every section in order, each of
 * its measures in order.
 *
 * A malformed or missing song (no `sections` array, a section with no `measures`
 * array) contributes no entries rather than throwing, so a stale or partial
 * working object yields `[]` (or a shorter list) instead of an error.
 *
 * @param {?Object} song The working song object.
 * @return {{ sectionIndex: number, measureIndex: number }[]} The per-global-measure coords.
 */
export function measureCoords(song) {
	const sections = Array.isArray(song?.sections) ? song.sections : [];
	const coords = [];
	// Sections outer, measures inner — the order `buildLayoutModel` numbers from.
	sections.forEach((section, sectionIndex) => {
		const measures = Array.isArray(section?.measures) ? section.measures : [];
		measures.forEach((_measure, measureIndex) => {
			coords.push({ sectionIndex, measureIndex });
		});
	});
	return coords;
}

/**
 * The 1-based global measure number for a `(sectionIndex, measureIndex)` — the
 * inverse of `measureCoords`. Used by the canvas to scope the highlight query and
 * the add-note target back to the core's emitted `data-measure`.
 *
 * @param {?Object} song         The working song object.
 * @param {number}  sectionIndex The section's index.
 * @param {number}  measureIndex The measure's index within its section.
 * @return {?number} The 1-based global measure number, or `null` when the coords
 *   are out of range.
 */
export function globalMeasureNumber(song, sectionIndex, measureIndex) {
	const coords = measureCoords(song);
	const position = coords.findIndex(
		(coord) =>
			coord.sectionIndex === sectionIndex &&
			coord.measureIndex === measureIndex,
	);
	return position === -1 ? null : position + 1;
}

/**
 * Resolve a selection against the current working object, returning the live
 * section/measure/event it points at — or `null` when any tagged level no longer
 * exists.
 *
 * A selection is **kind-tagged** — `{ kind: "section" | "measure" | "event", … }`
 * — and the resolver walks top-down (section → measure → event), stopping at the
 * depth the `kind` names and returning the deepest tagged object:
 *   - `"section"` → `{ kind, section, sectionIndex }`.
 *   - `"measure"` → `+ { measure, measureIndex }`.
 *   - `"event"`   → `+ { event, hand, eventIndex }` (the full resolution).
 *
 * Levels are dependent: a missing higher level invalidates everything below it. The
 * existence checks mirror the structural editor's old `repairPath` chain
 * (`song.sections?.[si]` → `.measures?.[mi]` → `measure[hand]?.[eventIndex]`), so
 * a selection left stale by a structural edit, an undo/redo, or a raw-JSON change
 * resolves to `null` and the sidebar falls back to Song-only — no edit ever
 * targets a missing object.
 *
 * **Backward compatibility:** an *untagged* selection that carries all four event
 * fields still resolves as an event (so a canvas selection set before its `onSelect`
 * stamps `kind` keeps working within a single rebase), and the returned object
 * carries `kind: "event"`. An untagged *partial* (e.g. only section + measure) has no
 * `kind` to make it well-formed, so it resolves to `null` (malformed).
 *
 * @param {?Object} song      The working song object.
 * @param {?Object} selection The selection `{ kind?, sectionIndex, measureIndex?, hand?, eventIndex? }`.
 * @return {?{
 *   kind: string,
 *   section: Object,
 *   sectionIndex: number,
 *   measure?: Object,
 *   measureIndex?: number,
 *   event?: Object,
 *   hand?: string,
 *   eventIndex?: number,
 * }} The resolved selection, or `null` when stale/absent.
 */
export function resolveSelection(song, selection) {
	if (!selection) {
		return null;
	}
	const { sectionIndex, measureIndex, hand, eventIndex } = selection;
	// Default the kind for an untagged-but-complete event tuple (backward compat);
	// an untagged partial has no kind, so it stays malformed below.
	const kind =
		selection.kind ??
		(sectionIndex !== undefined &&
		measureIndex !== undefined &&
		hand !== undefined &&
		eventIndex !== undefined
			? "event"
			: undefined);
	if (kind === undefined || sectionIndex === undefined) {
		return null;
	}

	const section = song?.sections?.[sectionIndex];
	if (!section) {
		return null;
	}
	if (kind === "section") {
		return { kind, section, sectionIndex };
	}

	if (measureIndex === undefined) {
		return null;
	}
	const measure = section.measures?.[measureIndex];
	if (!measure) {
		return null;
	}
	if (kind === "measure") {
		return { kind, section, sectionIndex, measure, measureIndex };
	}

	if (hand === undefined || eventIndex === undefined) {
		return null;
	}
	const event = measure[hand]?.[eventIndex];
	if (!event) {
		return null;
	}
	return {
		kind,
		section,
		sectionIndex,
		measure,
		measureIndex,
		event,
		hand,
		eventIndex,
	};
}

/**
 * Build the scoped attribute selector that locates a selected note/rest group in
 * the rendered SVG. The emitted `id` (`{hand}-{kind}-{eventIndex}`) is NOT
 * globally unique — `eventIndex` resets per measure — so the highlight must scope
 * by the global measure number first, then the hand and event index within it.
 *
 * @param {Object} target               The query target.
 * @param {number} target.measureNumber The 1-based global measure number.
 * @param {string} target.hand          The hand key (`rightHand`/`leftHand`).
 * @param {number} target.eventIndex    The event's per-measure index.
 * @return {string} The scoped CSS attribute selector.
 */
export function selectionQuery({ measureNumber, hand, eventIndex }) {
	return `[data-measure="${measureNumber}"] [data-hand="${hand}"][data-event-index="${eventIndex}"]`;
}
