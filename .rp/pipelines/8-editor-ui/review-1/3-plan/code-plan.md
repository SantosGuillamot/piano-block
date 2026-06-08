# Code Plan: Review 1 — Canvas-first editor UI for the Piano block

This plan transforms the existing **on-canvas drill-down** visual editor under `src/` into the
**canvas-first, Gutenberg-native** editor the design doc specifies: an interactive sheet-music
canvas for selection/structure plus `InspectorControls` panels for settings, with raw-JSON mode
unchanged behind the existing toggle.

It is decomposed into discrete, ordered tasks dispatched **one code-writer each, sequentially,
sharing one working tree**. Order matters: each task builds cleanly on the prior and is
independently committable with its own unit and/or e2e tests passing. The notation core
(`src/notation/*`), the song layer (`src/song/*`), `src/view.js`, `src/render.php`, and
`src/block.json` are **untouched** (Req 18). All code uses only `@wordpress/*` packages already
available to blocks (Req 19).

## Grounding facts (verified against the live code)

These are the concrete anchors the tasks rely on; code-writers should re-read the cited files.

- **Mode container** `src/edit.js` already owns `mode` state, the `BlockControls` JSON toggle,
  the memoized `errors = validateSong(song)` (empty string → `[]`), `accessibleName`, and
  `onChangeSong`. Its **visual branch** renders `<SongEditor>` + `<SongPreview>` in a
  `.wp-block-piano-block-piano__visual` two-column wrapper. JSON mode is a `TextareaControl`
  labelled `"Song (JSON)"` with a non-blocking error `Notice`. **Only the visual branch changes.**
- **Render glue to reuse**: `src/editor/SongPreview.js` holds the entire reusable render path —
  `availableWidthInSp` (px→sp with the `NARROW_CONTAINER_PX`/`NARROW_SP_PX` step-down),
  `drawWhenFontReady` (font gate, jsdom fallback), the `validateSong` gate, `JSON.parse`,
  `buildLayoutModel` → `renderInto`, and the rAF-debounced one-way `ResizeObserver`. This becomes
  `SongCanvas`.
- **Notation core selection hooks already emitted by `src/notation/svg.js`** (do NOT modify):
  - `renderNote` → `<g data-kind="note" data-hand="{handKey}" data-event-index="{i}"
    id="{handKey}-note-{i}">`.
  - `renderRest` → `<g data-kind="rest" data-hand="{handKey}" data-event-index="{i}"
    id="{handKey}-rest-{i}">`.
  - `renderMeasure` → `<g data-measure="{number}">` where `number` is the **1-based global**
    measure number (`buildLayoutModel` assigns `measureNumber += 1` across all sections in order).
  - `id` is **not globally unique** (`eventIndex` resets per measure) — selection highlight MUST
    use a scoped query, not `getElementById`.
- **Global measure numbering** (`buildLayoutModel`, `src/notation/layout.js` ~line 1706): walks
  `contexts.forEach((ctx, si) => sections[si].measures.forEach((measure, mi) => { measureNumber +=
  1 })`. `measureCoords` MUST mirror this exact sections→measures order so global number N maps to
  `(sectionIndex, measureIndex)`.
- **Editor primitives to reuse unchanged**: `src/editor/songModel.js` (vocabularies, bounds,
  `newPitch/newNote/newRest/newMeasure/newSection/newSong/newEventAnnotation/newStandaloneAnnotation`,
  and `insertAt/removeAt/replaceAt`), `src/editor/serializeSong.js` (`commitSong` — serialize +
  `validateSong` guard before persist), `src/editor/noteNames.js` (`inferNoteNameSystem`,
  `noteNameOptions`, `stepInSystem`), `src/editor/accessibleName.js`.
- **Field controls to reuse as panel contents** (already conformant-by-construction, all
  controlled, hold no state): `MetadataEditor`, `ContextEditor` (+ its `HandConfigEditor`),
  `PitchEditor`, `PitchList`, `AnnotationEditor`, `AnnotationList`, `InvalidState`. `EventRow`
  holds the reusable scalar-field logic (type note↔rest with pitch seeding/dropping, optional
  `dots`/`dynamic`/`tie`/`slur`/`crescendo`/`decrescendo` omit-when-unset) — but it embeds
  `ListControls`, so the Note panel re-expresses that logic without the reorder buttons rather than
  rendering `EventRow` verbatim.
- **`commitSong(workingObject, onChangeSong)`** is the single persist path: it `JSON.stringify`s,
  runs `validateSong`, and only then calls `onChangeSong` (warns + refuses on a non-conformant
  string). Every visual edit MUST go through it.
- **Components to remove** (drill-down + reorder, superseded): `SongEditor`, `SongOverview`,
  `SectionList`, `SectionEditor`, `MeasureList`, `MeasureEditor`, `EventList`, `EventRow`,
  `Breadcrumb`, `EmptyState`, `ListControls`, and the standalone `SongPreview` (its glue is moved
  into `SongCanvas`).
- **Unit test infra**: `jest.config.js` maps `@wordpress/i18n`, `@wordpress/components`, and
  `@wordpress/block-editor` to mocks under `test/mocks/`. The components mock currently exports
  `Button, SelectControl, NumberControl, TextControl, TextareaControl, Notice, ToolbarGroup,
  ToolbarButton, __experimentalNumberControl`. **It does NOT export `PanelBody`, `ToggleControl`,
  `__experimentalToolsPanel`/`Item`, `Icon`, etc.** — the new panels need those mocks added (T1).
  The block-editor mock exports `useBlockProps, BlockControls` — it needs **`InspectorControls`**
  added (T1).
- **Unit tests referencing removed components** (must be reworked/removed in T9/T10):
  `src/editor/__tests__/SongEditor.test.js` (SongEditor/EmptyState/InvalidState + nav),
  `src/editor/__tests__/structure.test.js` (MeasureEditor/MeasureList/SectionEditor/SectionList/
  SongOverview/Breadcrumb), `src/editor/__tests__/events.test.js` (EventRow/EventList/EventEditor),
  `src/editor/__tests__/ListControls.test.js` (ListControls), `src/editor/__tests__/SongPreview.test.js`,
  and `src/editor/__tests__/Edit.test.js` (asserts the two-column visual layout + EmptyState).
  Tests that target reused leaf controls (`annotations`, `contextControls`, `pitches`,
  `noteNames`, `serializeSong`, `songModel`) stay as-is.
- **e2e** `specs/editor.spec.js` drives the built block in wp-env; it currently asserts the
  drill-down empty state (`"Start a new song"`), the two-column preview container
  (`.wp-block-piano-block-piano__preview`), and the structured `Title` field. It is rewritten in
  T11 to drive the canvas + sidebar. JSON-mode and round-trip tests stay behaviorally identical.
- **Styles**: `src/style.scss` has editor-only rules under `.wp-block-piano-block-piano`
  (`__visual`, `__editor`, `__preview`, `__breadcrumb`, `__panel`, `__list-row`, `__mode-toggle`).
  These are reworked in T8 to style the canvas + selection decoration; the `@font-face` block and
  the front-end-relevant rules stay.

## Design decisions inherited (do not re-litigate)

Selection by scoped `[data-measure][data-hand][data-event-index]` query (not `id`); editor-side
`measureCoords` flatten mirroring `buildLayoutModel`; settings in `InspectorControls` (Song always;
Note/Measure/Section on selection); `ToolsPanel` progressive disclosure for optional fields;
lazy editor-side `newSong()` seeding (attribute stays `""` until first edit); canvas default-note
add with hand = staff; add/remove placement (add-note + add-measure on canvas; add/remove section,
remove measure, remove note, chord pitch add/remove in panels); **reorder omitted in v1**;
conformant-by-construction with serialize-time `validateSong` guard; per-song note-name system
preserved. These come from the design doc's Key Decisions and are fixed inputs.

---

## Task order overview

1. **T1** — Test mocks: add `InspectorControls`, `PanelBody`, `ToggleControl`, `ToolsPanel` family, `Icon`.
2. **T2** — `selection.js`: pure selection helpers (`measureCoords`, `resolveSelection`, query scoping).
3. **T3** — `SongCanvas`: interactive render surface (selection hit-test + decoration + add affordances).
4. **T4** — `SongPanel`: always-present Song inspector panel.
5. **T5** — `NotePanel`: selected-event inspector panel (+ note↔rest, pitches, remove note).
6. **T6** — `MeasurePanel`: selected measure inspector panel (+ remove measure).
7. **T7** — `SectionPanel`: selected section inspector panel (+ add/remove section).
8. **T8** — Rewrite `Edit`'s visual branch: wire canvas + selection state + inspector panels; styles.
9. **T9** — Remove the drill-down/reorder components and their obsolete unit tests.
10. **T10** — Add/rework unit tests for the new modules (selection, canvas, panels, Edit container).
11. **T11** — Rewrite the e2e spec for the canvas-first editor.
12. **T12** — Final integration check: build, lint, unit, e2e wiring, boundary audit.

---

## T1 — Add unit-test mocks for the new WP controls

**Goal:** Make the new inspector panels testable under Jest by extending the existing WP-package
mocks, before any panel code is written. No production code changes.

**Files:**
- `test/mocks/wordpress-block-editor.js` (edit)
- `test/mocks/wordpress-components.js` (edit)

**Changes:**
- In `wordpress-block-editor.js`, add an **`InspectorControls`** stand-in that renders its children
  inline inside a marked container (mirror the existing `BlockControls` mock:
  `createElement("div", { "data-inspector-controls": true }, children)`). Export it alongside
  `useBlockProps`, `BlockControls`.
- In `wordpress-components.js`, add minimal stand-ins, generic and behavior-light, following the
  file's existing style:
  - **`PanelBody`** — renders `title` as a heading and its `children` (e.g.
    `createElement("section", { "aria-label": title }, [heading, children])`); accept and ignore
    `initialOpen`. Tests locate a panel by its title.
  - **`ToggleControl`** — render an `<input type="checkbox">` honoring `checked`/`label`/`onChange`
    (`onChange(event.target.checked)`), with `aria-label` from `label`.
  - **`__experimentalToolsPanel` (ToolsPanel)** — render a container that exposes its `label` (e.g.
    `aria-label`) and renders `children`; accept and ignore `resetAll`. **Crucially, the mock must
    render its `ToolsPanelItem` children's contents unconditionally** so a panel's advanced controls
    are present in the DOM for assertions (the real component hides them until revealed; the unit
    tests assert the controls *exist and are wired*, leaving reveal/hide behavior to e2e).
  - **`__experimentalToolsPanelItem` (ToolsPanelItem)** — render its `children`; accept and ignore
    `hasValue`, `label`, `onDeselect`, `isShownByDefault`.
  - **`Icon`** — render nothing meaningful (`createElement("span", { "data-icon": true })`) or pass
    through; accept and ignore `icon`/`size`. (Only if a panel/canvas uses `Icon`.)
  - Export all added names; keep the `__experimental*` aliases consistent with how production code
    imports them (production imports `__experimentalToolsPanel as ToolsPanel`,
    `__experimentalToolsPanelItem as ToolsPanelItem`).

**Depends on:** none (first task).

**Traces to:** enables AC4, AC5, AC10 unit coverage; supports Req 4–7. Infrastructure for all panel
tasks.

**Acceptance:** `npm run test:unit` still passes (the mocks are additive; existing suites
unaffected). A throwaway import check (or the first panel test in T10) can resolve the new exports.
No production source changed.

---

## T2 — `selection.js`: pure selection-coordinate helpers

**Goal:** Provide the pure functions that translate between the canvas's emitted `data-*` hooks and
a `{ sectionIndex, measureIndex, hand, eventIndex }` selection, mirroring the core's measure
ordering. No React, no DOM creation — only data + a query-string builder.

**Files:**
- `src/editor/selection.js` (new)
- `src/editor/__tests__/selection.test.js` (new)

**Changes:**
- `measureCoords(song)` → returns an array indexed by **0-based global measure position** giving
  `{ sectionIndex, measureIndex }`, built by walking `song.sections[].measures[]` in the **same
  order** `buildLayoutModel` uses (sections outer, measures inner). Global measure **number** N
  emitted by the core is 1-based, so coords for `data-measure="N"` is `measureCoords(song)[N - 1]`.
  Tolerate a malformed/missing song by returning `[]`.
- `resolveSelection(song, selection)` → given the parsed working `song` and a selection object,
  return `{ event, measure, section, sectionIndex, measureIndex, hand, eventIndex }` when every
  level still exists, else `null` (stale selection after a structural change / undo / raw edit).
  Reuse the same existence checks the old `repairPath` used
  (`song.sections?.[si]` → `.measures?.[mi]` → `measure[hand]?.[eventIndex]`).
- A small helper to build the **scoped highlight query** for a selection's global measure number +
  hand + event index, e.g. `selectionQuery({ measureNumber, hand, eventIndex })` returning
  `'[data-measure="N"] [data-hand="H"] [data-event-index="I"]'`. (Used by `SongCanvas` in T3.)
- A helper to map a selection's `(sectionIndex, measureIndex)` → **global measure number**
  (the inverse of `measureCoords`), so the canvas can scope the highlight query and the add-note
  target. Name it e.g. `globalMeasureNumber(song, sectionIndex, measureIndex)` (1-based; `null`
  if out of range).
- Document the invariant that `measureCoords` mirrors `buildLayoutModel`; the test pins it.

**Depends on:** none (pure module; can land before or after T1, but ordered here so T3 can import it).

**Traces to:** Req 3, 18; AC3, AC6. Design "selection.js" component and "Editor-side flatten must
track the core's measure ordering" risk.

**Acceptance:** `selection.test.js` passes and pins:
- `measureCoords` on a 2-section song (e.g. section 0 has 2 measures, section 1 has 1) returns
  `[{0,0},{0,1},{1,0}]`, matching `buildLayoutModel`'s global numbering (assert by also running
  `buildLayoutModel` and reading the emitted `data-measure` order, OR by a fixed expected array
  with a comment tying it to the core walk).
- `globalMeasureNumber` is the exact inverse on the same fixture.
- `resolveSelection` returns the right event/measure/section for a live selection and `null` when
  any level is out of range (removed section, removed measure, removed event).
- `selectionQuery` produces the scoped attribute selector string for given coords.

---

## T3 — `SongCanvas`: interactive sheet-music surface

**Goal:** The single interactive canvas. Reuses `SongPreview`'s render path verbatim (font gate,
px→sp width, `buildLayoutModel` → `renderInto`, rAF `ResizeObserver`), renders the **working object
directly** (so the seeded empty song shows an empty grand staff), and adds: click/keyboard
selection hit-testing, post-render selection decoration, and on-canvas add-note (per hand) +
add-measure affordances. It does **not** own selection state (the parent does) — it receives the
current selection and emits selection/add intents.

**Files:**
- `src/editor/SongCanvas.js` (new)
- `src/style.scss` (edit — add canvas/decoration/affordance rules; full styling consolidated in T8,
  but the classes this component emits are introduced here)

**Changes:**
- Port the reusable glue from `SongPreview.js` into `SongCanvas.js`: `NARROW_CONTAINER_PX`,
  `NARROW_SP_PX`, `availableWidthInSp`, `drawWhenFontReady`, the measured-width state + draw effect,
  and the `ResizeObserver` effect. **Render from a parsed working object**, not the raw string:
  prop is `song` (the working object) plus `accessibleName`. The draw effect calls
  `buildLayoutModel(song, availableWidthInSp(container))` then `renderInto`. (The validity gate now
  lives in the parent `Edit`, which only mounts `SongCanvas` for a valid/seeded song — so the canvas
  assumes a renderable working object, but stays defensive: wrap the build/render in try/catch and
  clear the container on failure, mirroring `SongPreview`.)
- **Selection hit-test:** attach a `click` handler (and `keydown` for Enter/Space) on the container.
  On activation, `event.target.closest('[data-kind="note"], [data-kind="rest"]')` → read
  `data-hand` + `data-event-index`; `closest('[data-measure]')` → read the global measure number;
  convert via the parent-supplied `song` working object using `measureCoords`/`measureCoords[N-1]`
  to `(sectionIndex, measureIndex)`; call `props.onSelect({ sectionIndex, measureIndex, hand,
  eventIndex })`. A click that resolves no note/rest (empty staff area) calls `props.onSelect(null)`
  (clear) — but must **not** bubble to a block-deselect (see T8). Make the note/rest groups
  focusable for keyboard activation (post-render decoration sets `tabindex="0"` and
  `role="button"` on note/rest groups, or on at least the selectable ones — keep it simple:
  baseline is focus + Enter/Space to select, per design's open question).
- **Selection decoration (post-render):** after each `renderInto`, if a `selection` prop is present,
  build the scoped query from `selection.js` (`globalMeasureNumber` + `selectionQuery`) and add an
  `is-selected` class to the matched `<g>` (and set focus affordances). Re-apply on every redraw
  (the draw effect depends on `song` and `selection`). If the query matches nothing (stale
  selection), do nothing. Never targets a not-yet-rendered node (decoration runs inside the draw
  callback, after `renderInto`).
- **Add affordances** (canvas-native, hand = staff — Decision "Add notes on the canvas"):
  - Per-hand **add-note**: render a small WP `Button` per staff per measure (or one pair per
    measure: "Add note (right hand)" / "Add note (left hand)") positioned near each staff. On click,
    call `props.onAddNote(sectionIndex, measureIndex, hand)`. The parent appends `newNote()` to that
    hand (after the selected event if it is in that hand, else append) and selects it (T8 owns the
    append+select logic so `SongCanvas` stays declarative). Keep these as real DOM buttons layered
    over/under the SVG (HTML overlay, not SVG-embedded), so they get native focus/labels — the
    simplest conformant approach.
  - End-of-score **add-measure**: a single "Add measure" `Button` after the canvas. On click, call
    `props.onAddMeasure()`. Parent appends `newMeasure()` to the **last section**'s `measures`.
  - Labels via `@wordpress/i18n` `__`. Use stable, asserted accessible names: `"Add measure"`,
    `"Add note to right hand in measure %d"` / left, via `sprintf` (so e2e/unit can target them).
- Emit class names under the block's BEM-ish prefix: e.g. container
  `wp-block-piano-block-piano__canvas`, selected node `is-selected`, the add buttons
  `wp-block-piano-block-piano__add-note` / `__add-measure`. Add minimal rules to `style.scss`
  (e.g. `.is-selected` outline/highlight on the selected `<g>`; positioning for the add buttons).
- **Do not** import or read `view.js`; keep the editor self-contained (mirror `SongPreview`'s note).

**Depends on:** T2 (`selection.js`).

**Traces to:** Req 1, 3, 6, 9, 10, 11; AC2, AC3, AC6, AC8. Design "SongCanvas", "Selection highlight
by scoped query", "Add notes on the canvas", "Seed the empty song editor-side".

**Acceptance:** `SongCanvas` renders an `<svg role="img">` for a valid working object (incl. the
seeded `newSong()` empty grand staff). A click on a rendered note `<g>` (simulated by dispatching a
click whose target is inside `[data-kind="note"]`) calls `onSelect` with the correct
`{ sectionIndex, measureIndex, hand, eventIndex }` for a multi-section fixture. The `is-selected`
class lands on exactly the `<g>` matching the current `selection` prop after render, and on no node
when the selection is stale. The add-note and add-measure buttons render with their accessible
names and call the right callbacks. (These assertions are unit-tested in T10; this task ships the
component + a smoke test inline if convenient, but T10 owns the full suite.)

---

## T4 — `SongPanel`: always-present Song inspector panel

**Goal:** The Song-level settings panel, rendered inside `InspectorControls` regardless of
selection: metadata + `defaults` context, with per-hand `handConfig` and other uncommon fields
behind `ToolsPanel` progressive disclosure. Pure controlled component; emits a next working `song`.

**Files:**
- `src/editor/inspector/SongPanel.js` (new)
- `src/editor/inspector/` (new directory)

**Changes:**
- Render a `PanelBody` titled e.g. `__("Song", "piano-block")`.
- **Common (always visible):** `MetadataEditor` over `song.metadata` (title/composer), and the
  common `defaults` context fields. Reuse `ContextEditor` over `song.defaults`. To honor progressive
  disclosure (AC10), split the context: the **common** set visible by default (per design, a small
  set — e.g. tempo bpm + time signature), and the **advanced** set (`beatUnit`, per-hand
  `handConfig` clef/alters/octaveShift) inside a `ToolsPanel`. Implementation note: `ContextEditor`
  is monolithic today; the simplest faithful approach is to **keep `ContextEditor` whole for the
  common fields and wrap the per-hand `HandConfigEditor`s in `ToolsPanelItem`s** within a
  `ToolsPanel`. If a finer split is needed, prefer composing the existing leaf controls
  (`HandConfigEditor`, the tempo/time-sig fields) directly over rewriting `ContextEditor`. Do not
  change `ContextEditor`'s emit contract.
- Route emissions back into the whole `song` object exactly as `SongOverview` did
  (`emitBlock(song, "metadata"|"defaults", value, onChange)` — drop the key when empty). Lift that
  small `emitBlock` helper into this panel (or a shared `inspector/` util) so an emptied
  `metadata`/`defaults` drops its key (clean round-trip).
- Props: `{ song, system, onChange }` where `onChange` receives the next working `song` (the
  parent runs it through `commitSong`). `system` comes from `inferNoteNameSystem` (parent-derived).
- Conformant by construction: only reused constrained controls; no free numeric/text outside the
  bounded leaf editors.

**Depends on:** T1 (mocks for `PanelBody`/`ToolsPanel`).

**Traces to:** Req 5, 7, 8; AC5, AC7, AC10. Design "Sidebar panels — SongPanel", "Native progressive
disclosure".

**Acceptance:** Unit-tested in T10. Rendered in isolation, `SongPanel` shows the Title/Composer
fields and the common context controls; editing the title emits a `song` whose `metadata.title`
updated and which `validateSong` accepts; clearing it drops `metadata`. The advanced `ToolsPanel`
hosts the per-hand config controls (present in the DOM under the test mock). No selection required.

---

## T5 — `NotePanel`: selected-event inspector panel

**Goal:** The panel for the currently-selected event (note or rest): the common required fields
(type, pitches/duration) visible, the optional fields behind `ToolsPanel`, plus **Remove note**.
Edits the resolved event and emits a next working `song`.

**Files:**
- `src/editor/inspector/NotePanel.js` (new)

**Changes:**
- Render a `PanelBody` titled e.g. `__("Note", "piano-block")` (the spec's "Note" = any event).
- Receives the **resolved selection** (event + its coords) and the working `song` + `system`.
- **Common (visible):**
  - `type` note↔rest (`SelectControl` over `EVENT_TYPES`). Apply the cross-field rule from
    `EventRow.changeType` verbatim: switching to `rest` drops `pitches`; switching to `note` seeds
    `[newPitch(firstName)]` in the per-song system. Reuse that logic (extract a small helper or
    inline the same code — do not import `EventRow`, which carries `ListControls`).
  - `duration` (`SelectControl` over `DURATIONS`).
  - For a `note`: `PitchList` over `event.pitches` (chord add/remove/edit; **the note invariant —
    last pitch can't be removed — is already enforced by `PitchList`**). Note: `PitchList` currently
    embeds `ListControls` move buttons; since reorder is omitted in v1, either (a) leave `PitchList`
    as-is for pitches (chords are short; the move buttons are harmless), or (b) if T9 removes
    `ListControls`, update `PitchList`/`AnnotationList`/`HandConfigEditor` to drop the move buttons.
    **Decide once in T9 and keep consistent** (see T9 note). The default-preferred choice: **remove
    move buttons** to match "reorder omitted", updating `ListControls` consumers accordingly.
- **Advanced (`ToolsPanel`, reveal = add field, reset = remove field):** `dots`, `dynamic`, `tie`,
  `slur`, `crescendo`, `decrescendo` (each a `ToolsPanelItem` whose `hasValue` checks the event key,
  whose control sets the key to an enum value, and whose `onDeselect`/reset drops the key — the
  omit-when-unset rule, conformant by construction). Plus the event-anchored **annotations**:
  reuse `AnnotationList` (`kind="event"`) inside a `ToolsPanelItem`, dropping the `annotations` key
  when emptied (as `EventEditor` did).
- **Remove note:** a `Button` (`isDestructive`) that removes the event from its hand
  (`removeAt(measure[hand], eventIndex)`), dropping the hand key when it empties (as
  `MeasureEditor.changeHand` did), and emits the next `song`. After removal the parent clears the
  selection (T8).
- Route every edit back into the whole `song` via the same splice pattern `SongEditor` used
  (`replaceAt(song.sections, si, { ...section, measures: replaceAt(section.measures, mi,
  { ...measure, [hand]: replaceAt(measure[hand], eventIndex, nextEvent) }) })`). Provide a small
  local helper for "replace the selected event in `song`" and "remove the selected event from
  `song`" to keep call sites readable.
- Props: `{ song, selection (resolved), system, onChange, onRemove }` (or fold remove into
  `onChange` + a parent-side selection clear — keep the interface minimal and documented).

**Depends on:** T1; reuses `PitchList`, `PitchEditor`, `AnnotationList`, `songModel`.

**Traces to:** Req 7, 8, 11; AC7, AC9, AC10, AC11. Design "Sidebar panels — NotePanel".

**Acceptance:** Unit-tested in T10. Given a resolved note selection, the panel shows type/duration/
pitch controls; switching type to `rest` emits a `song` whose event lost `pitches`; setting a
`dynamic` adds the key and `validateSong` accepts the result; "Remove note" removes the event (and
drops the emptied hand). All emitted songs pass `validateSong`.

---

## T6 — `MeasurePanel`: selected-measure inspector panel

**Goal:** The panel for the measure the selected event belongs to: `barlineStart`/`barlineEnd` and
standalone (staff-anchored) annotations behind disclosure, plus **Remove measure**.

**Files:**
- `src/editor/inspector/MeasurePanel.js` (new)

**Changes:**
- Render a `PanelBody` titled e.g. `__("Measure", "piano-block")`.
- Receives the resolved measure + its coords and the working `song`.
- **Advanced (`ToolsPanel`):** `barlineStart`, `barlineEnd` (each a `ToolsPanelItem` over
  `SelectControl`/`BARLINES`, omit-when-unset as `MeasureEditor.BarlineControl` did), and standalone
  `AnnotationList` (`kind="standalone"`) dropping `annotations` when emptied (as `MeasureEditor`
  did). Per design, the measure has **no required common field**, so the panel may be all-advanced
  (or show the two barlines as the small common set — pick per the design's "common vs advanced is
  determined during design"; default: barlines behind disclosure, since they are uncommon).
- **Remove measure:** a `Button` (`isDestructive`) that removes the measure
  (`removeAt(section.measures, measureIndex)`) from its section and emits the next `song`. After
  removal the parent clears the selection (the event no longer exists). **Guard:** a section's
  `measures` is required but **may be empty** (`newSection` seeds one, but `{ measures: [] }` is
  conformant) — removing the last measure of a section is allowed and leaves `measures: []`. Confirm
  against `validateSong` in the test.
- Route edits into the whole `song` via the section→measures splice (`replaceAt(song.sections, si,
  { ...section, measures: replaceAt(section.measures, mi, nextMeasure) })`).

**Depends on:** T1; reuses `AnnotationList`, `songModel`.

**Traces to:** Req 7, 8, 11; AC7, AC9, AC10. Design "Sidebar panels — MeasurePanel".

**Acceptance:** Unit-tested in T10. Setting `barlineEnd` adds the key and the song validates;
clearing it drops the key; "Remove measure" removes the measure (and `validateSong` accepts an
empty `measures`). All emitted songs pass `validateSong`.

---

## T7 — `SectionPanel`: selected-section inspector panel

**Goal:** The panel for the section the selected event belongs to: context overrides behind
disclosure, plus **Add section** and **Remove section**.

**Files:**
- `src/editor/inspector/SectionPanel.js` (new)

**Changes:**
- Render a `PanelBody` titled e.g. `__("Section", "piano-block")`.
- Receives the resolved section + its index and the working `song`.
- **Advanced (`ToolsPanel`):** the section's context **overrides** — reuse the `SectionEditor`
  override-projection logic (`OVERRIDE_KEYS = ["tempo","timeSignature","rightHand","leftHand"]`):
  project the section's override keys into a context object, hand it to `ContextEditor`, and on
  change rebuild the section from its non-override keys (always keeping `measures`) plus the override
  keys the context still carries. Wrap in a `ToolsPanel`/`ToolsPanelItem`(s) so overrides are
  revealed/reset (an unset override drops its key — clean round-trip).
- **Add section:** a `Button` that appends `newSection()` to `song.sections`
  (`insertAt(song.sections, song.sections.length, newSection())`) and emits the next `song`. (Add
  is in the panel per the design's add/remove placement; the new section is empty-but-conformant.)
- **Remove section:** a `Button` (`isDestructive`) that removes the section
  (`removeAt(song.sections, sectionIndex)`) and emits the next `song`. After removal the parent
  clears the selection. Note: `song.sections` is required and must be a non-empty array? Check the
  schema via `validateSong`: if a song with **zero sections** is non-conformant, then **Remove
  section must be disabled when it is the only section** (mirror `PitchList`'s last-item guard). The
  test pins which is correct against the real validator; implement the guard accordingly.

**Depends on:** T1; reuses `ContextEditor`, `songModel`.

**Traces to:** Req 7, 8, 11; AC7, AC9, AC10. Design "Sidebar panels — SectionPanel", "Add/remove
placement".

**Acceptance:** Unit-tested in T10. Revealing and setting a context override (e.g. tempo) emits a
`song` whose section carries that override and which validates; resetting it drops the override;
"Add section" appends a conformant section; "Remove section" removes it (with the last-section guard
behaving per the validator). All emitted songs pass `validateSong`.

---

## T8 — Rewrite `Edit`'s visual branch: wire canvas + selection + inspector

**Goal:** Make the canvas-first editor live. `Edit` keeps the mode toggle and JSON branch untouched;
its visual branch now owns editor-only **selection** state, derives the working object (seeded when
empty), gates on validity (`InvalidState` for non-empty invalid), renders `SongCanvas` + the
`InspectorControls` panels, and routes every edit through `commitSong`. Styles updated to match.

**Files:**
- `src/edit.js` (edit)
- `src/style.scss` (edit — finalize canvas/inspector styles; remove dead drill-down rules)

**Changes:**
- Keep: `mode` state, `BlockControls` toggle, `errors = validateSong(song)` memo (empty → `[]`),
  `accessibleName` memo, JSON-mode branch (textarea + non-blocking `Notice`) — all **unchanged**.
- **Visual branch rewrite:**
  - Add editor-only `selection` state: `{ sectionIndex, measureIndex, hand, eventIndex } | null`,
    `useState(null)`. Not persisted.
  - Derive the **working object**: `const working = song.trim() === "" ? newSong() : (errors.length
    ? null : safeParse(song))`. Memoize on `song`/`errors`. (`safeParse` returns `null` on a parse
    throw, defensively.)
  - Derive `system = inferNoteNameSystem(working)` (memoized; default `"english"`).
  - **Branch:**
    - Non-empty **invalid** (`song.trim() !== "" && (errors.length > 0 || working === null)`):
      render `InvalidState` (errors + "Edit as JSON" → `setMode("json")`). No canvas, no panels.
      (Req 16; AC13.)
    - Otherwise (empty→seeded, or valid): render the **canvas + inspector**.
  - **Resolve the selection** against `working` each render via `resolveSelection(working,
    selection)`; if it returns `null`, treat as no selection (sidebar shows only `SongPanel`). This
    auto-clears a stale selection after structural edits/undo/raw edits (design failure mode).
  - **Edit helper** `commit(nextWorking)` → `commitSong(nextWorking, onChangeSong)` (serialize-time
    `validateSong` guard, Req 11/13). All panel `onChange`s and canvas add intents funnel through it.
  - **Add intents** (own the structural ops the canvas only *signals*):
    - `onSelect(sel)` → `setSelection(sel)` (or `null` to clear).
    - `onAddNote(si, mi, hand)` → append `newNote()` to that hand. If the current selection is an
      event in the same `(si, mi, hand)`, insert **after** it (`insertAt(list, eventIndex + 1, …)`);
      else append (`insertAt(list, list.length, …)`). Commit, then set the selection to the new
      note's coords so the sidebar opens on it (Decision "Add notes on the canvas"). Hand = the
      staff the affordance belongs to (Req 9; AC8).
    - `onAddMeasure()` → append `newMeasure()` to the **last** section's `measures`; commit. (Leave
      selection as-is; the new empty measure is reachable via its add-note affordance — design open
      question accepted.)
  - **Render:**
    - `<SongCanvas song={working} accessibleName={accessibleName} selection={resolvedSelection}
      onSelect={…} onAddNote={…} onAddMeasure={…} />` in the visual wrapper.
    - `<InspectorControls>`: always `<SongPanel song={working} system={system} onChange={commit} />`;
      and when `resolvedSelection` is non-null, also `<NotePanel …>`, `<MeasurePanel …>`,
      `<SectionPanel …>` bound to the resolved event/measure/section, each with `onChange={commit}`
      and the parent-owned selection-clear on remove.
  - **Block-deselect guard:** the canvas click handler must not bubble to deselect the block (the
    inspector requires the block selected). Ensure the canvas container stops propagation
    appropriately OR relies on the click landing within the block — verify in e2e (T11). Document
    the constraint (design risk "InspectorControls requires block selection").
  - **First-edit persistence of the seed:** for an empty song, `working = newSong()` but the
    attribute stays `""` until the first edit calls `commit` (lazy seeding — Decision; AC2). Do not
    persist on mount.
- **Styles** (`style.scss`): rework the editor-only block:
  - Drop the two-column `__visual`/`__editor`/`__preview` layout (single canvas now) and the
    drill-down `__breadcrumb`/`__panel`/`__list-row` rules (those components are gone).
  - Add/keep: a `__canvas` container rule (the SVG host; keep `overflow-x:auto`, a sensible
    min-width so `clientWidth` is non-zero), the `.is-selected` highlight, and the add-button
    layout. Keep the `@font-face` block and any front-end-relevant rules verbatim.

**Depends on:** T2, T3, T4, T5, T6, T7.

**Traces to:** Req 1, 2, 4, 5, 6, 9, 10, 11, 16, 17, 18; AC1, AC2, AC3, AC4, AC5, AC6, AC8, AC9,
AC11, AC13, AC15. Design "Edit (mode container)", per-edit data flow, "Settings in
InspectorControls", "Seed the empty song editor-side".

**Acceptance:** Unit-tested in T10 (the `Edit.test.js` rework). Manually/in-test: a fresh block shows
the seeded empty grand-staff canvas (no raw JSON), the attribute is `""` until a first edit; a valid
song shows the canvas + `SongPanel` in the inspector with no selection; selecting a note adds
Note/Measure/Section panels; an edit re-renders the canvas; a non-empty invalid song shows
`InvalidState`; JSON mode is byte-for-byte the prior behavior. `npm run build` succeeds.

---

## T9 — Remove the drill-down + reorder components and their obsolete unit tests

**Goal:** Delete the superseded components and the now-dead reorder controls, and resolve the
`ListControls`-consumer question consistently, leaving a clean tree with no dangling imports.

**Files (delete):**
- `src/editor/SongEditor.js`, `src/editor/SongOverview.js`, `src/editor/SectionList.js`,
  `src/editor/SectionEditor.js`, `src/editor/MeasureList.js`, `src/editor/MeasureEditor.js`,
  `src/editor/EventList.js`, `src/editor/EventRow.js`, `src/editor/Breadcrumb.js`,
  `src/editor/EmptyState.js`, `src/editor/SongPreview.js`, `src/editor/ListControls.js`.
- Obsolete tests: `src/editor/__tests__/SongEditor.test.js`,
  `src/editor/__tests__/structure.test.js`, `src/editor/__tests__/events.test.js`,
  `src/editor/__tests__/ListControls.test.js`, `src/editor/__tests__/SongPreview.test.js`.
  (The `Edit.test.js` rework lands in T10, not here — but if its current assertions reference
  removed components and block the build/lint, **stub it to a `it.todo`/skip in this task with a
  pointer to T10**, or move the rewrite into T10 and keep T9 limited to deletions. Prefer the
  latter: leave `Edit.test.js` failing-but-pending only if the suite can still run; otherwise
  temporarily skip the file and re-enable in T10.)

**Changes:**
- Delete the files above. Grep for any remaining imports of the deleted modules
  (`grep -rn "SongEditor\|SongOverview\|SectionList\|SectionEditor\|MeasureList\|MeasureEditor\|
  EventList\|EventRow\|Breadcrumb\|EmptyState\|SongPreview\|ListControls" src`) and fix them — by
  this point only the new code should reference the survivors.
- **`ListControls` removal decision (reorder omitted in v1):** `ListControls` is consumed by
  `PitchList`, `AnnotationList`, and `HandConfigEditor` (move-up/down + remove). Since reorder is
  dropped, update those three to **drop the move-up/down buttons** and keep their add/remove
  behavior, removing the `ListControls` import. Keep their remove affordance (inline `Button` with
  the existing labels/`canRemove` guard). Update their unit tests (`pitches.test.js`,
  `annotations.test.js`, and any hand-config assertions in `contextControls.test.js`) to drop the
  move-button assertions while keeping add/remove/edit coverage. **This keeps `removeAt`/`insertAt`/
  `replaceAt` in `songModel`; remove `moveItem` only if it has no remaining consumers** (grep first
  — `moveItem`/`moveRow` may be referenced by `HandConfigEditor`'s local `moveRow`; remove dead
  helpers and their `songModel.test.js` assertions only if truly unused).
- Do **not** touch the notation core, song layer, or the reused leaf editors' emit contracts.

**Depends on:** T8 (the new code must already reference only survivors before deletion).

**Traces to:** Req 12 (reorder omitted); design "Removed" list, "Add/remove placement; omit
reordering".

**Acceptance:** The deleted files are gone; `grep` finds no references to them in `src/`;
`npm run test:unit` passes for the surviving + updated leaf-control suites; `npm run build` and
`npm run lint:js` (via `wp-scripts`) succeed with no unresolved imports. `moveItem`/move helpers are
removed iff unused, with their tests updated.

---

## T10 — Unit tests for the new modules

**Goal:** Full unit coverage for the new selection helpers, canvas, inspector panels, and the
rewritten `Edit` container, using the existing jsdom + WP-mock harness.

**Files:**
- `src/editor/__tests__/selection.test.js` (created in T2 — extend if needed here)
- `src/editor/__tests__/SongCanvas.test.js` (new)
- `src/editor/__tests__/inspectorPanels.test.js` (new) — or one file per panel
  (`SongPanel.test.js`, `NotePanel.test.js`, `MeasurePanel.test.js`, `SectionPanel.test.js`).
- `src/editor/__tests__/Edit.test.js` (rewrite)

**Changes:**
- **`SongCanvas.test.js`:** render with a multi-section fixture; assert the `<svg role="img">`
  mounts (rely on the existing jsdom 0-width tolerance + no-Font-Loading-API fallback, as
  `SongPreview.test.js` did); dispatch a click on a node inside a `[data-kind="note"]` group and
  assert `onSelect` fires with the right coords; pass a `selection` prop and assert `is-selected`
  lands on exactly the matching `<g>` and on nothing for a stale selection; assert the add-note /
  add-measure buttons render with their accessible names and call their callbacks. Render the seeded
  `newSong()` and assert an empty grand staff `<svg>` mounts (AC2).
- **Panel tests:** for each panel, render in isolation with a fixture `song` + resolved selection,
  drive the mocked controls (set value + dispatch change, click buttons) inside `act`, and assert:
  the emitted `song` reflects the change, `validateSong` accepts every emission (conformant by
  construction — AC11), optional fields omit-when-unset, and the structural add/remove buttons
  behave (incl. the last-pitch and last-section guards). Reuse the `change`/`click`/`fieldByName`/
  `buttonByText` helpers from the existing tests.
- **`Edit.test.js` rewrite:** keep the JSON-mode assertions (default-visual, toggle to JSON shows
  the `"Song (JSON)"` textarea, non-blocking error notice, store-verbatim-even-when-invalid — these
  are behavior-unchanged). Replace the drill-down/two-column assertions with canvas-first ones:
  - a fresh (empty) block renders the **canvas** with a seeded empty-staff `<svg>` (not an
    EmptyState button) and the attribute stays `""` until an edit;
  - a valid song renders the canvas + an `InspectorControls` region containing the **Song** panel
    and **no** Note/Measure/Section panels when nothing is selected (AC5);
  - a non-empty invalid song renders `InvalidState` with "Edit as JSON" (AC13);
  - the inspector is found via the `data-inspector-controls` mock marker.
  (Selecting a note end-to-end is awkward in jsdom because selection needs a real rendered SVG +
  click target; cover the *selection→panels* path at the unit level via `SongCanvas` (onSelect) and
  the panels directly, and cover the integrated select-on-canvas flow in e2e (T11). If feasible,
  add an `Edit`-level test that drives `onSelect` by simulating a click on a rendered note group,
  asserting the Note panel appears.)

**Depends on:** T1–T9.

**Traces to:** AC2, AC3, AC4, AC5, AC6, AC7, AC9, AC10, AC11, AC13, AC15. Verifies the design's
component contracts and failure modes.

**Acceptance:** `npm run test:unit` passes with the new suites; coverage spans selection mapping,
canvas selection/decoration/add, each panel's edit + conformance + structural ops, and the Edit
container's branching. No reference to removed components remains in any test.

---

## T11 — Rewrite the e2e spec for the canvas-first editor

**Goal:** Update `specs/editor.spec.js` to drive the real built block as the canvas-first editor in
wp-env, keeping the JSON-mode/persistence/round-trip coverage and replacing the drill-down
assertions with canvas + sidebar ones.

**Files:**
- `specs/editor.spec.js` (edit)

**Changes:**
- **Keep (behaviorally identical):** the JSON-mode tests — conformant shows no error and stores
  verbatim; invalid JSON / non-conformant flagged yet stored; round-trip across save/reload
  including HTML-significant characters; the mode-switch helpers (`switchToJsonMode` /
  `switchToVisualMode` via the toolbar buttons "Edit as JSON" / "Visual editor"); `seedSongViaJson`;
  `storedSong`.
- **Replace the drill-down/preview/empty-state assertions:**
  - **Default surface (AC1):** a freshly inserted block shows the **canvas** (the rendered `<svg>` in
    the canvas container, now `.wp-block-piano-block-piano__canvas`) — not the raw textarea, not a
    "Start a new song" button. Update `previewContainer` → a `canvasContainer` locator and the
    "visual editor is the default" + "freshly inserted block" tests accordingly.
  - **Seeded empty song (AC2):** a fresh block renders an empty grand-staff `<svg>` ready for notes,
    and the stored `song` attribute is `""` (the lazy seed isn't persisted until an edit). Replace
    the old "starts empty" assertions: still assert `attributes.song === ""`, but assert the canvas
    `<svg>` is visible (seeded), and that switching to JSON shows an **empty** textarea.
  - **Add a note on the canvas, hand by staff (AC8):** click the canvas "Add note to right hand …"
    affordance; assert the stored song now has a right-hand event in the target measure and the
    canvas re-rendered. (Mirror with the left hand if practical.)
  - **Select a note + sidebar panels (AC3, AC4, AC5):** with a seeded/added note present, click the
    note on the staff (`editor.canvas.locator('[data-kind="note"]')`); open the block settings
    sidebar (`editor.openDocumentSettingsSidebar()` or the equivalent e2e util) and assert the
    **Note**, **Measure**, and **Section** panels are present in addition to the always-present
    **Song** panel; with nothing selected, only **Song** is present.
  - **A visual edit is reflected (AC6/AC7):** edit a field in the sidebar (e.g. the Song panel's
    Title) and assert `storedSong` reflects it — replacing the old `titleField`-on-canvas test
    (`Title` now lives in the inspector sidebar, so locate it there:
    `page.getByRole('region', …)` / the settings sidebar locator, not `editor.canvas`).
  - **Non-empty invalid routes to JSON (AC13):** unchanged in intent — seed `NON_CONFORMANT_JSON`,
    return to visual, assert the invalid `Notice` + the canvas "Edit as JSON" button, and that the
    sidebar Song-panel Title field is absent.
  - **Round-trip preserves Spanish names (AC14):** keep, but make the "unrelated edit" the
    inspector Title field (now in the sidebar) instead of the canvas Title.
- Update the file's header comment to describe the canvas-first surface and the sidebar panels.
- Note for the implementer: sidebar controls are rendered into the editor's document settings
  sidebar (the main page, not `editor.canvas` iframe). Use the e2e util to open it and locate
  controls by role/label on `page` (or the provided sidebar locator), distinct from canvas locators.

**Depends on:** T8 (the editor must behave as specified); T1–T7 supply the panels/labels.

**Traces to:** AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC12, AC13, AC14, AC15, AC16 (round-trip).
Mirrors the design's data flow and selection contract end to end.

**Acceptance:** `npm run test:e2e` passes against a freshly built block in wp-env (prereqs:
`npm run build`, `npm run env:start`). Every retained JSON-mode/round-trip test still passes
unchanged in behavior; the new canvas-first/sidebar tests pass. (If the CI/wp-env run isn't
available in the working tree, the implementer must at least confirm the spec compiles and the
locators match the emitted classes/labels from T3/T8, and document the run command.)

---

## T12 — Final integration check: build, lint, unit, e2e wiring, boundary audit

**Goal:** Confirm the whole change builds and passes, and that the editor-only boundary and
WP-only-deps invariants hold.

**Files:** none changed except small fixes surfaced by the checks (kept minimal and committed with a
clear message).

**Changes / checks:**
- `npm run build` — clean build of `src/` → `build/`.
- `npm run lint:js` / `lint:css` (via `wp-scripts`) — no new lint errors.
- `npm run test:unit` — all unit suites green (new + retained).
- `npm run test:e2e` — green if wp-env is runnable here; otherwise confirm the spec compiles and
  document the command + expected result.
- **Boundary audit (Req 18):** `git diff --stat` since the review-1 base must show **no changes**
  under `src/notation/*`, `src/song/*`, `src/view.js`, `src/render.php`, `src/block.json`. The
  notation core's emitted `data-*`/`id` hooks are read-only inputs. Confirm a song saved via the
  visual editor renders identically to the same song authored in raw JSON (AC16) — the front-end
  path is untouched, so this follows from the boundary holding.
- **Dependency audit (Req 19):** `package.json` runtime deps unchanged; the new code imports only
  `@wordpress/*` (`@wordpress/element`, `@wordpress/block-editor` incl. `InspectorControls`,
  `@wordpress/components` incl. `PanelBody`/`ToolsPanel`/`ToggleControl`/`Button`/`Notice`/
  `Select`/`Number`/`Text`/`Textarea`Controls, `@wordpress/i18n`). Grep the new files' imports to
  confirm.
- Verify no dead references to removed components remain anywhere (`src/`, `specs/`, `test/`).

**Depends on:** T1–T11.

**Traces to:** Req 18, 19; AC11, AC12, AC15, AC16, AC17.

**Acceptance:** All four `npm` checks pass (or e2e documented if unrunnable); the boundary `git diff`
shows zero changes to the protected files; the dependency grep shows only `@wordpress/*` imports in
new code; no dangling imports. The branch is in a shippable state.

---

## Traceability summary

| Requirement / AC | Tasks |
|---|---|
| Req 1 canvas-first, live re-render | T3, T8 |
| Req 2 raw JSON behind same toggle | T8 (JSON branch unchanged) |
| Req 3 select event on canvas | T2, T3, T8 |
| Req 4 sidebar shows note+measure+section | T5, T6, T7, T8 |
| Req 5 always-present Song panel | T4, T8 |
| Req 6 nothing selected → only Song | T8, T10 |
| Req 7 progressive disclosure | T4–T7 (ToolsPanel) |
| Req 8 full model coverage | T4–T7 |
| Req 9 add note on canvas, hand by staff | T3, T8 |
| Req 10 seed minimal song | T3, T8 |
| Req 11 add/remove at every level | T3 (canvas add), T5–T7 (panel add/remove), T8 |
| Req 12 reorder omitted | T9 |
| Req 13 conformant by construction | T4–T7, T8 (commitSong guard) |
| Req 14 note-name fidelity | reused `noteNames.js` (T4–T5), T11 |
| Req 15 two modes one song | T8 |
| Req 16 invalid → raw JSON | T8 (InvalidState), T11 |
| Req 17 raw never blocks saving | T8 (JSON branch unchanged) |
| Req 18 editor-only boundary | all tasks; audited T12 |
| Req 19 WP-only deps | all tasks; audited T12 |
| AC1–AC17 | covered across T2–T12 (see per-task Traces) |
