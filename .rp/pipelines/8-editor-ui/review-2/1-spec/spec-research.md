# Spec Research: Review 2 — Selection fix, contextual add/remove, sidebar structure, note-language toggle

# Review 2: Fix canvas selection, contextual add/remove, sidebar structure management, and a note-language toggle

_Review 2 of the Piano block editor-UI feature (Issue #8, PR #22). Self-contained; later phases work from this prompt + the current code on the (trunk-rebased) branch, not from `base/` or `review-1/`._

## Goal (from prompt)

1. Make canvas note selection actually work (clicking a note/rest selects it).
2. Replace the plain on-canvas add buttons with selection-contextual add/remove-note controls (hand inferred); move section/measure management into the sidebar as a browsable add/remove/edit view.
3. Add a song-level Spanish/English note-language option that drives how note names are shown.
Carried over: `@wordpress/*` only; editor-only (format/render/schema unchanged).

## Q&A

### Q1 — Selection contract (the fix)

Clicking a note/rest selects it (highlight + sidebar panels). (a) Should clicking empty canvas space deselect (back to Song-only) or keep the current selection? (b) Keep keyboard selection (focus a note + Enter/Space), or is mouse click enough for now?

**A:** (a) Clicking empty canvas space **deselects** (sidebar back to Song-only). (b) **Mouse click is enough** for now — keyboard selection is not required (may be dropped/deferred).

### Q2 — Contextual add/remove note: placement + the empty case

With a note selected, offer add-note/remove-note (hand inferred). (a) Do these controls live in the sidebar (Note panel) or as a contextual control on the canvas? (b) How is the FIRST note added to an empty measure/hand (nothing to select)? Should the sidebar measure view offer "add note to right/left hand"? (c) Does "add note" insert after the selected note in the same hand?

**A:** (a) The controls can live on the **canvas, or both** canvas + sidebar — design's choice. (b) The empty / nothing-selected first-note case is **left to design**. (c) Insert position relative to the selection is likewise a design detail (reasonable default: after the selected note, same hand).

### Q3 — Sidebar structure view shape

(a) Depth: a browsable list of sections → measures (notes still edited via canvas), or also individual notes? (b) Interactions: add/remove section, add/remove measure, select a section/measure to edit its settings — correct? (c) Does picking a measure/section in the list also highlight/scroll the canvas, or is the list independent of canvas selection?

**A:** (a) **Measure depth** is enough (sections → measures; not individual notes). (b) Yes — add/remove section, add/remove measure, select-to-edit-settings. (c) Yes — picking a measure/section should also **highlight/scroll the canvas** (desired/nice-to-have).

### Q4 — How the note-language option is realized (format-boundary call)

Switching the song-level Spanish/English language: (A) **convert** all stored note names to the chosen language (no schema change, editor-only; selector reflects current language; mixed songs unified on switch) — recommended; (B) **store an explicit `noteLanguage` field** (persists for empty songs but changes the song format/schema and possibly render.php/front-end); (C) **display-only** editor preference (stored names unchanged, not persisted).

**A:** Both **B + A**: a **stored song-level `language` setting** (because the note names will be used on the frontend in the future) **and** switching it **converts** all existing notes to the chosen language. → Review-2 **does add a song-level language field to the song format/schema** (a deliberate exception to "format unchanged"); the front-end consuming it is future work. The setting and conversion keep the song's note names consistent with the chosen language.

### Q5 — Language setting: initial value, and front-end scope this iteration

(a) For **existing songs** with no language field yet, infer the initial language from their current note spellings (Spanish if they use do/re/mi…, else English)? And what default for a **new/empty** song — English? (b) Confirm the front-end (`render.php` / SVG) is **not** changed to use the new field in this iteration (it's stored and round-trips, but consuming it on the frontend is future work)?

**A:** (b) confirmed — front-end is NOT changed to consume the field this iteration (stored + round-trips only; frontend use is future work). (a) taken as proposed: infer initial language from existing songs' spellings; default new/empty songs to English.

### Q6 — Carry-overs, boundary, reordering

Confirm: conformant-by-construction, `@wordpress/*`-only deps, raw-JSON toggle unchanged, progressive disclosure all still hold; the editor-only boundary is relaxed ONLY for the new `language` schema field (render.php/front-end SVG unchanged this iteration); reordering of sections/measures stays out of scope (sidebar does add/remove + edit only).

_Awaiting answer._

## Research

- **Current selection wiring (src/editor/SongCanvas.js, src/edit.js):** a click/keydown on the canvas host runs `selectionFromTarget`, which finds the nearest `[data-kind="note"|"rest"]`, reads `data-hand`/`data-event-index` and the enclosing `[data-measure]` global number, maps via `selection.js`, and calls `onSelect` → `setSelection` in `edit.js`. `resolveSelection` clears stale selections; `decorateSelection` adds `is-selected` after each draw. The mechanism is correct in unit tests (jsdom) but the user reports it does not work in the live editor — so the failure is a **runtime** issue (e.g. SVG/glyph `pointer-events`, an intercepting overlay such as the layered add-`<button>`s, focus/scroll, or a DOM-shape change from trunk's notation rewrite). Root-cause belongs to the design/code phase; the live e2e never ran, so it was not caught.
- **Add affordances today (SongCanvas.js):** real HTML `<button>`s layered beside the SVG — a per-hand "add note" button and one end-of-score "add measure" button — signalling `onAddNote`/`onAddMeasure`; the parent (`edit.js`) performs the structural edit and sets the resulting selection. The user finds these unclear and visually plain ("all white").
- **Note-name system today (review-1):** inferred per-song from existing pitches (Spanish vs English) rather than chosen explicitly; pitch `step` controls use that system; untouched pitches round-trip verbatim. The user wants an explicit song-level language selector instead.
- **Sidebar today:** always-present "Song" panel; "Note"/"Measure"/"Section" panels shown only when a note is selected (so measures/sections are reachable only via a selected note). The user wants to browse/add/remove/edit all sections and measures from the sidebar directly.

## Out of Scope

Confirmed with owner:

1. Front-end consuming the `language` field / showing note names on the published page — future work (the field is stored + round-trips only).
2. Changing `render.php` or the front-end SVG rendering — unchanged this iteration.
3. Reordering sections/measures/events — add/remove + edit only.
4. Individual notes/events in the sidebar structure list — measure depth only (notes edited via canvas).
5. Keyboard selection on the canvas — mouse-only this iteration (review-1's focus+Enter may be dropped).
6. Direct measure/section selection by clicking the canvas — reached via the sidebar list (which highlights the canvas).
7. Audio playback — future.
8. Best-effort loading of invalid songs (still routed to raw JSON) and large-song performance tuning — carried over.

## Consolidated Requirements

1. **Canvas selection works:** clicking a note/rest on the rendered staff selects it (visible highlight + the sidebar panels populate). Clicking empty canvas space **deselects** (sidebar back to Song-only). Mouse click suffices; keyboard selection not required. (Q1)
2. **Contextual add/remove note:** with a note selected, the author can **add a note** and **remove the selected note**, with the **hand inferred** from the selection (no hand picker). The controls live on the canvas and/or sidebar (design's choice). The insert position and the empty/first-note path are design details. (Q2)
3. **Sidebar structure view:** the sidebar presents a browsable list of **all sections and their measures** (measure depth; not individual notes). The author can **add/remove sections**, **add/remove measures**, and **select a section or measure** to edit its settings. Selecting one also **highlights/scrolls to it on the canvas**. (Q3)
4. **Song-level language setting (format change):** add a stored song-level **`language`** field (Spanish/English) to the song format/schema; the **Song panel** exposes a selector. Switching the language **converts** every stored note name to the chosen language. **Existing** songs without the field infer their initial language from current spellings; **new/empty** songs default to **English**. The field **round-trips** through raw JSON and validation accepts it. (Q4, Q5)
5. **Note names shown in the selected language:** the editor's note-name controls present names in the song's current language. (Q4)
6. **Boundary (relaxed only for `language`):** the song schema changes solely to add the `language` field; **`render.php` and the front-end SVG rendering are unchanged** this iteration. (Q5, Q6)
7. **Clear affordances:** add/remove controls are visually legible using standard `@wordpress/components` button styling (not unstyled/plain). (prompt #2)
8. **Carry-overs:** conformant-by-construction; `@wordpress/*`-only deps; raw-JSON editing behind the toolbar toggle unchanged (non-blocking validation); progressive disclosure for uncommon settings; live canvas re-render on edit; all other review-1 behavior not changed here. (Q6)
