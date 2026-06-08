# Code plan — Review 2 (editor UI)

This plan implements the approved design doc (KD1–KD5) as discrete, ordered
tasks. Each task is independently committable with its own tests and builds
cleanly on the prior ones (one shared working tree, dispatched one code-writer at
a time, sequentially).

## Conventions for every task

- **Repo linter is biome.** Run `npm run lint` (NOT `wp-scripts lint-js`). Fix any
  finding it reports before committing.
- **Unit tests** run with the repo's existing jest setup (`npm run test:unit`). The
  baseline is **green: 548 tests / 19 suites**; every task must leave the full
  suite green (do not regress existing tests except where a task explicitly
  rewrites them).
- **e2e** (`npm run test:e2e`) requires `npm run build` + `npm run env:start`
  (Docker). Only the two e2e-touching tasks (T1, T8) add/rewrite specs; they note
  the build/env prerequisite. A code-writer that cannot run Docker e2e locally must
  still author the spec and verify the unit layer, and say so in its report.
- **Conformant-by-construction spine is untouched.** Every visual mutation must
  keep routing through `commit = commitSong(nextWorking, onChangeSong)`
  (`src/editor/serializeSong.js`), which serializes + re-validates before
  persisting. No task introduces a second persist path.
- **Commit format:** imperative, sentence case, no trailing period, agent name in
  parentheses — e.g. `Thread interactive flag and emit per-event hit-rect (code-writer)`.
- **Immutable edits only**, via the existing `insertAt` / `removeAt` / `replaceAt`
  + `newX` factories in `src/editor/songModel.js`. Never mutate a working object.

## Hard sequencing constraints (carry through)

1. **The single allowed touch of `src/notation/svg.js`** is the editor-only
   `interactive` hit-rect (T1). No task changes `render.php` or `view.js` output;
   `view.js` must keep calling `renderInto(container, model, { accessibleName })`
   with **no** `interactive` flag, so the front-end SVG stays **byte-identical**.
2. **Canvas add-grid removal and the Structure-view "Add note" must land in the
   SAME task (T7).** Never leave a state where an empty measure (including the
   seeded `newSong()` one) has no way to add a first note. T7 therefore depends on
   the lifted structural mutators (T5) and the `StructureList` (T6) already being
   in place, and removes the buttons + adds the first-note entry point together.

---

## T1 — Editor-only per-event hit-rect (KD1)

**Goal.** Fix canvas selection in the real browser by threading a new `interactive`
flag from `renderInto` down to `renderNote`/`renderRest`, and emitting one
invisible, *filled-transparent*, pointer-hittable `<rect>` as the **first child** of
each note/rest `<g>` — only when `interactive` is true. Front end stays
byte-identical (flag defaults false; `view.js` never passes it).

**Files.**
- `src/notation/svg.js` (thread the flag; emit the rect) — the one allowed touch.
- `src/notation/constants.js` (add the vertical-margin constant).
- `src/editor/SongCanvas.js` (pass `interactive: true` in its single `renderInto`
  call at `SongCanvas.js:233`).
- `src/notation/__tests__/svg.test.js` (structural unit assertions).
- `src/editor/__tests__/SongCanvas.test.js` (behavioral hit-rect-targeted click).
- `specs/editor.spec.js` (the two-altitude e2e off-ink click).

**Changes.**
1. **Thread `interactive` down the single spine** (default `false` everywhere):
   - `renderInto(container, model, options = {})` already forwards `options` to
     `renderSvg`; no signature change, but it must forward `interactive` too.
   - `renderSvg(model, { accessibleName = "", interactive = false } = {})` — pass
     `interactive` into each `renderSystem(system, interactive)`.
   - `renderSystem(system, interactive)` → `renderMeasure(measure, band, interactive)`.
   - `renderMeasure(measure, band, interactive)` → both
     `renderHand(measure.right, "rightHand", …, interactive)` and the left call.
   - `renderHand(hand, handKey, staffBottomY, resolveNoteY, interactive)` → pass
     `interactive` into each `renderNote(note, handKey, interactive)` /
     `renderRest(rest, handKey, interactive)`.
   - No other renderer (reserve, beams, spans, texts, barlines) is touched.
2. **Add a constant** in `constants.js`:
   `export const HIT_RECT_VERTICAL_MARGIN_SP = 4;` (the generous N above/below the
   staff so ledgered notes/stems fall in the hit zone). Reuse the existing
   `STAFF_HEIGHT_SP` (=4) for the staff span. Document it in the file's comment idiom.
3. **Emit the rect** in `renderNote`/`renderRest`, gated on `interactive`, as the
   **first** appended child of the group (before ledgers/noteheads/glyph), so the
   visible ink paints over it and only the empty interior resolves to the rect:
   - Width: a fixed conservative `~2 sp` centered on the event column `x` — keep it
     **conservative (~2sp)** so overlapping rects in tight columns don't let a
     gap-click resolve to a neighbor. Define a local `const HIT_RECT_WIDTH_SP = 2;`
     in `svg.js` (a presentation constant local to the emit, alongside the existing
     `GLYPH_FONT_SIZE_SP`), and place at `x = note.x − HIT_RECT_WIDTH_SP / 2`.
   - Height/Y: within `<g data-hand transform="translate(0 staffBottomY)">` the
     staff bottom line is local Y=0 and the top is `−STAFF_HEIGHT_SP`. Emit the rect
     spanning local Y `[−STAFF_HEIGHT_SP − N, 0 + N]` with N =
     `HIT_RECT_VERTICAL_MARGIN_SP`: `y = −STAFF_HEIGHT_SP − N`,
     `height = STAFF_HEIGHT_SP + 2N`.
   - Hittability: **filled transparent** — `fill: "transparent"` (genuinely
     hit-testable, needs no CSS). Do NOT use `fill:none`/`visibility:hidden` (not
     hit targets). Add `data-hit=""` ONLY as a test/observability marker; do **not**
     stamp `data-kind`/`data-hand`/`data-event-index` on the rect (that would
     duplicate the `selectionQuery` match and let `querySelector` pick the rect over
     the `<g>`). Selection still resolves by `closest('[data-kind]')` walking up to
     the `<g>`.
   - Use the existing `el("rect", {...})` helper (note: the module's private `rect()`
     helper hard-codes `fill: INK` and is for beams/barlines — do **not** reuse it;
     build the hit-rect via `el` so the transparent fill is explicit).
4. **`SongCanvas`** passes `interactive: true`: change the
   `renderInto(container, model, { accessibleName })` call (line ~233) to
   `renderInto(container, model, { accessibleName, interactive: true })`.

**Tests.**
- *Unit (svg.test.js — front-end parity + structure):*
  - With no options (the front-end call shape), assert **no** `[data-hit]` rect is
    emitted in any note/rest group — front-end byte-identity guard.
  - With `{ interactive: true }`, assert each `[data-kind="note"]` and
    `[data-kind="rest"]` group's **first child** is a `<rect>` with
    `fill="transparent"` and `data-hit`, carrying **no** `data-kind`/`data-hand`/
    `data-event-index`, and that `rect.closest('[data-kind]')` is its own group.
- *Unit (SongCanvas.test.js — behavioral, replaces the "click `group.firstChild`"
  habit):* render `SongCanvas` (which passes `interactive: true`), locate a note/rest
  group's **hit-rect** (`[data-hit]`), dispatch a synthetic bubbling click whose
  `target` is the **rect** (not `group.firstChild` ink), and assert `onSelect` fires
  the correct `{ sectionIndex, measureIndex, hand, eventIndex }` tuple. Keep the
  existing click tests green (they click `group.firstChild`, still valid since ink is
  inside the group).
- *e2e (editor.spec.js — real browser, authoritative):* seed `CONFORMANT_SONG`,
  switch to visual mode, open the settings sidebar; click the single note group at an
  explicit `position` **off the notehead/stem** (the staff-gap above the notehead —
  the bbox-center point that fails today, e.g. `position: { x: <column center>, y:
  <a few px above the notehead> }` on the group's bounding box). Assert the **Note**
  panel becomes visible and the group gains `is-selected`. This fails before the fix,
  passes after.

**Depends on.** None (first task).

**Traces to.** Req 1–3, 15; AC1, AC2, AC12.

**Acceptance.**
- `npm run test:unit` green; new svg + SongCanvas unit tests pass.
- `npm run lint` clean.
- Front-end parity: rendering through the `view.js` call shape (no `interactive`)
  emits zero hit-rects (asserted).
- e2e off-ink click selects the note (run after `npm run build` + env start, or
  authored + unit-verified with a note in the report if Docker is unavailable).

---

## T2 — Schema `language` enum field (KD4 part 1)

**Goal.** Add the additive, permissive `language` enum to the root schema so it
round-trips and validates; never blocks raw-JSON saving.

**Files.**
- `src/song/schema.js`
- `src/song/__tests__/schema.test.js`
- `src/song/__tests__/validate.test.js`

**Changes.**
1. In `songSchema.properties`, add a sibling to `metadata`/`defaults`/`sections`:
   `language: { enum: ["spanish", "english"] }`. **Use the `SYSTEMS` keys
   `"spanish"`/`"english"`** (matching `inferNoteNameSystem`'s return and
   `noteNames.js`'s `SYSTEMS` keys), NOT ISO `es`/`en` — so `language === system`
   composes with zero translation. No `required` change. Add a short doc comment in
   the file's existing idiom noting it is editor-internal and permissive.

**Tests.**
- *schema.test.js:* assert `songSchema.properties.language` equals
  `{ enum: ["spanish", "english"] }`; assert `language` is **not** in
  `songSchema.required`.
- *validate.test.js:* a song with `language: "spanish"` (and with `"english"`)
  validates to `[]`; a song with `language: "fr"` produces exactly one
  "not one of the allowed values" message and **no** other error (so raw JSON still
  stores it — the message is informational); a song with **no** `language` still
  validates `[]` (the field is optional).

**Depends on.** None (independent of T1; ordered here for grouping).

**Traces to.** Req 10, 15, 16, 17; AC11, AC13, AC14.

**Acceptance.** `npm run test:unit` green; `npm run lint` clean; the new validate/schema
assertions pass.

---

## T3 — Song-wide language source-of-truth + pitch converter (KD4 parts 2, 3)

**Goal.** Add the pure `mapSong(song, targetSystem)` converter (rewrite every
`pitch.step` via `stepInSystem`, set `language`, leave alters keys English-canonical)
and switch the editor's `system` to read the stored field first. No UI yet (the
selector is T4) — this lands the data path so T4 is a thin control.

**Files.**
- `src/editor/noteNames.js` (add `mapSong`).
- `src/edit.js` (change `system` to `working.language ?? inferNoteNameSystem(working)`).
- `src/editor/__tests__/noteNames.test.js`

**Changes.**
1. **`mapSong(song, targetSystem)`** in `noteNames.js` — a pure function that
   returns a new song object:
   - Walks `sections[].measures[].{rightHand,leftHand}[].pitches[]`, rewriting each
     `pitch.step` via `stepInSystem(pitch.step, targetSystem)` (idempotent +
     canonicalizing). Build immutably (map/spread), never mutate the input.
   - Sets `language: targetSystem` on the returned root.
   - Converts **`pitch.step` only** — does NOT touch `handConfig.alters` keys (they
     stay English-canonical; the renderer normalizes them, and the visual editor only
     writes English alters keys, so converting them would fight the editor for zero
     visible benefit — design KD4 part 3, option A).
   - Tolerates a malformed/partial song (missing arrays) without throwing, mirroring
     `stepsOf`'s defensive walk.
2. **`edit.js`:** change `const system = useMemo(() => inferNoteNameSystem(working),
   [working])` to `useMemo(() => working?.language ?? inferNoteNameSystem(working),
   [working])`. A stored `language` is authoritative; inference is the fallback only
   when the field is absent (AC10). Update the adjacent doc-comment to say so.

**Tests.**
- *noteNames.test.js:*
  - `mapSong` to `"spanish"` rewrites `{ step: "C" }` → `{ step: "do" }` across all
    hands/sections and sets `language: "spanish"`; round-trips back to `"english"`
    (`do` → `C`). Idempotent: mapping to the same system twice equals once.
  - `mapSong` leaves a `handConfig.alters` key (e.g. `{ C: 1 }`) unchanged and does
    NOT introduce a Spanish alters key.
  - Conformance: `validateSong(JSON.stringify(mapSong(song, "spanish")))` is `[]`.
  - Malformed input (no `sections`) returns an object with just
    `language` set, without throwing.

**Depends on.** T2 (the `language` field the converter writes must validate).

**Traces to.** Req 10, 12, 13, 14, 16; AC9, AC10, AC13.

**Acceptance.** `npm run test:unit` green; `npm run lint` clean; the editor still infers
English for a language-less song (existing Edit tests stay green).

---

## T4 — Language selector in the Song panel (KD4 parts 4, 5)

**Goal.** Add a `SelectControl` in `SongPanel` that shows the current `system` and,
on change, runs `mapSong` + commits. Display already follows `system` once it reads
`working.language` (T3), so this is the visible selector + the conversion trigger.

**Files.**
- `src/editor/inspector/SongPanel.js` (consume the currently-ignored `system` prop;
  add the selector).
- `src/editor/__tests__/SongPanel.test.js`

**Changes.**
1. `SongPanel` currently ignores its `system` prop (`system: _system`). Change to
   `system` and add a `LANGUAGES` option list (local const):
   `[{ label: __("English","piano-block"), value: "english" },
   { label: __("Spanish","piano-block"), value: "spanish" }]`.
2. Render a `SelectControl label={__("Note language","piano-block")} value={system}
   options={LANGUAGES}` near the top of the panel (a common Song-level control,
   like tempo/time-sig — NOT behind the Advanced ToolsPanel). Its `onChange(target)`
   calls `onChange(mapSong(song, target))` (import `mapSong` from `../noteNames.js`).
   The existing `onChange` is the parent's `commit`, so conversion re-validates +
   persists through the single spine.
3. **Do not** stamp `language` in `newSong()` (default-by-inference; KD4 part 5) —
   no change to `songModel.js`. A new empty song infers English and shows it; the
   field is written on the first switch.

**Tests.**
- *SongPanel.test.js:* render with `system="english"` and a single-`C` song; assert
  the "Note language" select shows `english`; fire `onChange("spanish")` and assert
  the emitted song has `language: "spanish"` and the pitch step is `"do"`. Reverse
  (`spanish` → `english`) returns `"C"`. Assert the selector is **not** inside the
  Advanced ToolsPanel (it renders as a top-level control).

**Depends on.** T3 (`mapSong` + `system` reading `working.language`).

**Traces to.** Req 11, 12, 13, 14; AC9, AC10.

**Acceptance.** `npm run test:unit` green; `npm run lint` clean; switching the selector
converts pitches and stores `language` (asserted at the panel level; the e2e is in T8).

---

## T5 — Kind-tagged selection + lifted structural mutators (KD3 parts 1, 2, 3)

**Goal.** Generalize the selection to `kind: "section" | "measure" | "event"`,
make `resolveSelection` stop at the tagged depth, gate the inspector panels by kind,
and lift the four structural mutators into `edit.js` as the single owner (panels drop
their local copies). No new UI surface yet — this is the data + gating spine the
Structure list (T6) and first-note path (T7) build on. Today's event behavior is
preserved (an untagged-but-complete tuple still resolves as before, for backward
compatibility within a single rebase).

**Files.**
- `src/editor/selection.js` (`resolveSelection` kind handling; add
  `measureNumbersForSection`).
- `src/edit.js` (lift `onAddSection`/`onRemoveSection`/`onAddMeasure(si)`/
  `onRemoveMeasure(si, mi)`; pass them to panels; kind-gate the panel block;
  set `kind: "event"` on canvas selections via `onSelect`).
- `src/editor/SongCanvas.js` (`selectionFromTarget` returns `kind: "event"`).
- `src/editor/inspector/SectionPanel.js` (drop local `addSection`/`removeSection`;
  take `onAddSection`/`onRemoveSection` props).
- `src/editor/inspector/MeasurePanel.js` (drop local `removeMeasure`; take
  `onRemoveMeasure` prop).
- `src/editor/inspector/NotePanel.js` (unchanged behavior; it already takes
  `onAddNote` in T7 — here only verify props still flow).
- `src/editor/__tests__/selection.test.js`
- `src/editor/__tests__/Edit.test.js`
- `src/editor/__tests__/SectionPanel.test.js`, `MeasurePanel.test.js` (adjust to the
  new prop-driven mutators).

**Changes.**
1. **`resolveSelection(song, selection)`** — branch on `selection.kind`, resolving
   top-down and stopping at the named depth, returning the deepest tagged object:
   - `"section"` → `{ kind, section, sectionIndex }` (null if section missing).
   - `"measure"` → `+ { measure, measureIndex }` (null if section OR measure missing).
   - `"event"` → `+ { event, hand, eventIndex }` (today's full resolution).
   - A missing lower level invalidates the whole (dependent-null chain preserved).
   - **Backward compatibility:** an **untagged** selection that carries all four
     event fields (`sectionIndex/measureIndex/hand/eventIndex`) still resolves as an
     event (so existing canvas selections set before T5's `onSelect` change keep
     working within the rebase). An untagged **partial** (e.g. only
     section+measure) still resolves to `null` (malformed). The returned object
     always carries a `kind` (default `"event"` for the untagged-complete case).
2. **`measureNumbersForSection(song, sectionIndex)`** in `selection.js` — filter
   `measureCoords(song)` to the target `sectionIndex` and map each to its 1-based
   global number (position + 1). Used by T6's section highlight (no emit change).
3. **`edit.js` lifted mutators** (single owner of `working` + `commit`), each the
   immutable splice the panels do today, written **once**:
   - `onAddSection()` — append `newSection()` to `working.sections`, commit.
   - `onRemoveSection(sectionIndex)` — `removeAt`, commit; if the removed section was
     the selected one (or an ancestor of it), clear/re-target the selection.
   - `onAddMeasure(sectionIndex)` — append `newMeasure()` to that section's measures
     (the existing `onAddMeasure` hardcodes the last section; **add the
     `sectionIndex` arg** so the list can target a specific section). Commit.
   - `onRemoveMeasure(sectionIndex, measureIndex)` — `removeAt` that section's
     measures, commit; clear/re-target the selection if it pointed at/under the
     removed measure.
   - Selection-fallout is lifted here too (the panels' `onRemove={() =>
     setSelection(null)}` pattern, generalized).
4. **Panel gating by kind** in `edit.js`: replace the single
   `resolvedSelection && (<Note/><Measure/><Section/>)` with kind-keyed conditionals:
   - `SongPanel` always (unchanged).
   - `SectionPanel` for **every** resolved kind (every kind has a section).
   - `MeasurePanel` for `"measure"` and `"event"`.
   - `NotePanel` for `"event"` only.
   So a section selection shows Section only; a measure selection shows
   Measure+Section; an event selection shows all three (today's behavior preserved).
5. **Panels drop their local structural copies**, taking the lifted handlers as
   props:
   - `SectionPanel`: remove its `addSection`/`removeSection`; render the **Add
     section**/**Remove section** buttons wired to `onAddSection`/`onRemoveSection`
     props (pass `sectionIndex` from the resolved selection to `onRemoveSection`).
   - `MeasurePanel`: remove its `removeMeasure`; wire **Remove measure** to
     `onRemoveMeasure(sectionIndex, measureIndex)` prop.
   - `edit.js` passes the lifted handlers to both these panels (and, in T6/T7, to the
     `StructureList`).
6. **`SongCanvas.selectionFromTarget`** returns `{ kind: "event", sectionIndex,
   measureIndex, hand, eventIndex }` (add the `kind` tag). `edit.js`'s `onAddNote`
   already reads `resolvedSelection.sectionIndex/measureIndex/hand/eventIndex`, which
   the kind-tagged resolved object still carries — verify it keeps matching.

**Tests.**
- *selection.test.js:*
  - `resolveSelection` with `{ kind: "section", sectionIndex }` resolves to
    `{ kind, section, sectionIndex }` and `null` when the section is gone;
    `{ kind: "measure", … }` resolves Measure+Section and `null` when either is gone;
    `{ kind: "event", … }` resolves all three (today's assertions, tagged).
  - The pinned-contract reconciliation: an **untagged partial**
    `{ sectionIndex, measureIndex }` still resolves to `null`; an untagged-complete
    event tuple still resolves (backward compat) and carries `kind: "event"`.
  - `measureNumbersForSection(SONG, 0)` returns the global numbers of section 0's
    measures (`[1, 2]` for the existing fixture) and `[]` for an out-of-range section.
- *Edit.test.js:* a section-kind selection renders Section but not Measure/Note;
  a measure-kind selection renders Measure+Section but not Note; an event-kind
  selection renders all three. `onAddSection`/`onRemoveSection`/`onAddMeasure(si)`/
  `onRemoveMeasure(si, mi)` produce the expected `sections` shape through `commit`
  and re-target/clear the selection as specified.
- *SectionPanel.test.js / MeasurePanel.test.js:* the panels now call the **passed-in**
  handlers (assert the prop callbacks fire with the right coords), not their own
  local mutators.

**Depends on.** T1 (so `kind: "event"` rides on the now-reachable selection; not a
hard code dependency but keeps the selection path coherent). Ordered after T4 for
grouping; no dependency on T2–T4.

**Traces to.** Req 6, 7, 8, 9; AC5, AC6, AC7, AC8, AC13.

**Acceptance.** `npm run test:unit` green (selection + Edit + panel suites updated);
`npm run lint` clean; event selection behavior unchanged in the editor.

---

## T6 — StructureList component + canvas highlight/scroll (KD3 parts 4, 5)

**Goal.** Add the always-present sidebar Structure browser (sections→measures, to
measure depth) with select/add/remove wired to T5's lifted mutators, and derive the
canvas highlight (measure direct, section derived via `measureNumbersForSection`) +
`scrollIntoView` — with **no emit change** (front end stays byte-identical).

**Files.**
- `src/editor/inspector/StructureList.js` (new).
- `src/edit.js` (render `StructureList` in `InspectorControls`, always, alongside
  `SongPanel`; pass `working`, `selection`/`resolvedSelection`, `setSelection`, and
  the lifted `onAddSection`/`onRemoveSection`/`onAddMeasure`/`onRemoveMeasure`).
- `src/editor/SongCanvas.js` (`decorateSelection` branches by `kind`; add the derived
  section + direct measure highlight + scroll).
- `src/style.scss` (new `is-active-measure` / `is-active-section` highlight classes,
  distinct from the event `is-selected` outline).
- `src/editor/__tests__/StructureList.test.js` (new).
- `src/editor/__tests__/SongCanvas.test.js` (kind-branched decoration).

**Changes.**
1. **`StructureList`** — a controlled component (no song state), mirroring
   `AnnotationList`'s controlled-row + trailing `AddButton` pattern, all
   `@wordpress/components`:
   - Props: `{ song, selection, onSelect, onAddSection, onRemoveSection,
     onAddMeasure, onRemoveMeasure, onAddNote }` (the `onAddNote` measure-row entry
     point is wired in T7; accept the prop here and render the button in T7 — see
     sequencing note).
   - Render inside a `PanelBody title={__("Structure","piano-block")}`.
   - Each **section row**: a select `Button` (label e.g. "Section N") that calls
     `onSelect({ kind: "section", sectionIndex })`, a remove
     `Button icon="trash"` → `onRemoveSection(sectionIndex)`, and a nested measure
     sub-list. The selected row uses `isPressed` (and/or `aria-current`) keyed off
     the resolved selection's `kind`/indices.
   - Each **measure row** (within a section): a select `Button` (label e.g.
     "Measure M") → `onSelect({ kind: "measure", sectionIndex, measureIndex })`, a
     remove `Button icon="trash"` → `onRemoveMeasure(sectionIndex, measureIndex)`.
     (The measure-row "Add note" button is added in T7.)
   - Trailing `AddButton label={__("Add section")}` → `onAddSection()`; each
     section's measure sub-list ends with `AddButton label={__("Add measure")}` →
     `onAddMeasure(sectionIndex)`.
   - **Notes are NOT listed** (measure depth only — Req 6); **no move controls**
     (Req 9).
2. **`edit.js`** renders `StructureList` in `InspectorControls` **always** (right
   after `SongPanel`), so the song is browsable with nothing selected (AC5) and the
   first-note flow (T7) has an entry point. Wire it to `setSelection` and the lifted
   mutators.
3. **Canvas highlight + scroll** in `SongCanvas.decorateSelection`, branched by
   `selection.kind` (no emit change):
   - `"event"` → today's scoped `selectionQuery` node, class `is-selected`.
   - `"measure"` → `globalMeasureNumber(song, si, mi)` → N → decorate the one
     `[data-measure="N"]` group with `is-active-measure`.
   - `"section"` → `measureNumbersForSection(song, si)` → decorate each
     `[data-measure="K"]` group with `is-active-section`.
   - After locating the group(s), `group.scrollIntoView({ inline: "nearest", block:
     "nearest" })` (a section scrolls its **first** measure group into view). Guard
     `typeof group.scrollIntoView === "function"` so jsdom (no scrollIntoView) and a
     stale/empty match don't throw. *Documented fallback if scrollIntoView proves
     flaky across engines:* set `host.scrollLeft` from the group's
     `getBoundingClientRect()` / model translate X on the `overflow-x:auto` host —
     implement only if the e2e shows flakiness.
   - Import `measureNumbersForSection` from `selection.js`.
4. **`style.scss`** — add `is-active-measure` / `is-active-section` rules under
   `&__canvas-svg` (a subtle box/fill highlight, distinct from the
   `is-selected` outline so a whole-measure/section box doesn't clash). Follow the
   existing comment idiom; editor-only (front end never sees these classes).

**Tests.**
- *StructureList.test.js:* renders a row per section and per measure for a
  multi-section fixture; clicking a section row calls `onSelect` with
  `{ kind: "section", sectionIndex }`; clicking a measure row calls it with
  `{ kind: "measure", sectionIndex, measureIndex }`; the **Add section** / **Add
  measure** / remove buttons call the right lifted handlers with the right coords;
  the selected row reflects `isPressed`/`aria-current`. **Notes are not listed**
  (assert no event-level rows). All controls are `@wordpress/components` (no outside
  import).
- *SongCanvas.test.js:* a `kind: "measure"` selection decorates exactly the
  `[data-measure="N"]` group with `is-active-measure` (and nothing with
  `is-selected`); a `kind: "section"` selection decorates every measure group in that
  section with `is-active-section`; a `kind: "event"` selection still decorates
  exactly one `is-selected` (existing test preserved); a stale measure/section
  selection decorates nothing. `scrollIntoView` is called when present (spy) and the
  absence of it in jsdom does not throw.

**Depends on.** T5 (kind-tagged selection, lifted mutators,
`measureNumbersForSection`).

**Traces to.** Req 6, 7, 8, 9, 15, 19; AC5, AC6, AC7, AC8, AC12, AC15.

**Acceptance.** `npm run test:unit` green (new StructureList + updated SongCanvas suites);
`npm run lint` clean; the Structure panel renders always and selecting a row
highlights the canvas; front-end emit unchanged (no `data-section`, no new emit).

---

## T7 — Selection-contextual add/remove note + remove the canvas add-grid (KD2)

**Goal (the hard-sequenced task).** Move add-note into the `NotePanel` (hand inferred
from the selection, insert-after, auto-select the new note), expose the
measure-level first-note "Add note" in the Structure list, and **in the same change**
remove the on-canvas add-grid (`__canvas-actions`: the per-hand add-note buttons and
the end-of-score add-measure button). Both handlers (`onAddNote`, `onAddMeasure`) are
**kept** — only the buttons go.

**Files.**
- `src/editor/inspector/NotePanel.js` (add an "Add note" `Button` beside "Remove
  note"; take a new `onAddNote` prop).
- `src/edit.js` (pass `onAddNote` to `NotePanel`; pass `onAddNote` to
  `StructureList`; stop passing `onAddNote`/`onAddMeasure` to `SongCanvas`).
- `src/editor/SongCanvas.js` (remove the `HANDS` map and the entire
  `__canvas-actions` block + its `onAddNote`/`onAddMeasure` props + the now-unused
  `Button`/`sprintf`/`coords` for buttons; `SongCanvas` becomes
  selection + decoration only).
- `src/editor/inspector/StructureList.js` (render the measure-row "Add note" button
  wired to `onAddNote(sectionIndex, measureIndex, "rightHand")` — the first-note
  entry point).
- `src/style.scss` (remove the now-dead `&__canvas-actions` rule; keep
  `&__canvas` / `&__canvas-svg`).
- `src/editor/__tests__/NotePanel.test.js` (new add-note assertions).
- `src/editor/__tests__/SongCanvas.test.js` (remove the four add-button tests; keep
  selection/decoration tests).
- `src/editor/__tests__/StructureList.test.js` (measure-row "Add note" assertion).

**Changes.**
1. **`NotePanel`** gains an **Add note** `Button` (standard `@wordpress/components`
   `Button`, side by side with the existing **Remove note**), calling
   `onAddNote(selection.sectionIndex, selection.measureIndex, selection.hand)` — the
   hand is the selection's hand, **inferred, never prompted** (AC3). `NotePanel`
   already receives `song` + `selection`; add the one new `onAddNote` prop. No new
   structural logic — `edit.js`'s existing `onAddNote` already inserts at
   `eventIndex + 1` and auto-selects the new note.
2. **`edit.js`:** pass `onAddNote={onAddNote}` to `NotePanel` and to `StructureList`;
   **remove** `onAddNote`/`onAddMeasure` from the `SongCanvas` props. Keep both
   handlers defined (`onAddNote` used by NotePanel + Structure first-note;
   `onAddMeasure(sectionIndex)` used by Structure's "Add measure" from T6).
3. **`SongCanvas`:** delete the `HANDS` const, the `__canvas-actions`
   `<div>` and everything in it, the `onAddNote`/`onAddMeasure` props, and the
   now-unused imports (`Button`, `sprintf`) and the `coords = measureCoords(song)`
   line that only fed the buttons. Keep the SVG host, the selection listeners, the
   focusable + decoration logic. Update the component's top doc-comment to drop the
   "ADD affordances" bullet (it is now selection + decoration only).
4. **`StructureList` measure row** renders the **Add note** `Button`
   (`onAddNote(sectionIndex, measureIndex, "rightHand")`) — the entry point that
   bootstraps an empty measure/hand (the canvas grid is gone, so an empty measure has
   no event to select; `onAddNote` already tolerates an empty hand via
   `measure[hand] ?? []`). Default the hand to right hand per KD2 part 5.

**Tests.**
- *NotePanel.test.js:* with an event selected, the "Add note" button calls
  `onAddNote` with the selection's `(sectionIndex, measureIndex, hand)` — assert the
  hand matches the selected hand (inferred). (The "new note is selected after"
  behavior lives in `edit.js`'s `onAddNote` and is covered by an Edit-level
  assertion: after add, the resolved selection points at `eventIndex + 1`.)
- *StructureList.test.js:* the measure-row "Add note" calls
  `onAddNote(sectionIndex, measureIndex, "rightHand")`.
- *SongCanvas.test.js:* **remove** the four add-button tests ("renders per-hand
  add-note buttons…", "targets the right hand and later measures…", "renders an
  add-measure button…"); assert the canvas no longer renders
  `.wp-block-piano-block-piano__add-note` / `__add-measure` / `__canvas-actions`.
  Keep all selection/decoration/focusable tests.

**Depends on.** T5 (kind-tagged selection + lifted handlers) and **T6** (the
`StructureList` must exist so the first-note entry point lands together with the
canvas-grid removal — the hard sequencing constraint).

**Traces to.** Req 4, 5; AC3, AC4.

**Acceptance.** `npm run test:unit` green (NotePanel + StructureList + SongCanvas suites
updated; no stranded-measure gap — the Structure "Add note" exists in the same
commit that removes the canvas grid); `npm run lint` clean. Manually: an empty
seeded song can still add a first note via the Structure list.

---

## T8 — e2e coverage for the new flows + final integration audit (KD1–KD5)

**Goal.** Rewrite the moved e2e and add specs for the new behaviors, then run the
full build/lint/unit/e2e audit and confirm the front-end boundary.

**Files.**
- `specs/editor.spec.js` (rewrite the first-note e2e; add Structure, add/remove,
  language, and front-end-parity specs).
- (No production code changes expected; only if the audit surfaces a defect.)

**Changes.**
1. **Rewrite the moved first-note e2e.** The existing "adding a note on the canvas
   stores it in the chosen hand" (which is the first-note-into-the-seeded-empty-song
   flow via the now-removed canvas button) becomes the **Structure-view first-note
   path**: insert a block → open the settings sidebar → in the **Structure** panel
   select the seeded empty measure → click its **Add note** → assert the stored song
   carries a right-hand note in that measure and the canvas re-renders a note group.
   Update the stale comment that references the canvas add-note button.
2. **Add e2e specs:**
   - *Add/remove note (selection-contextual):* select a note → NotePanel **Add
     note** → a second note appears in the same hand (inferred) and is selected →
     **Remove note** → it is gone.
   - *Structure add/remove section & measure:* via the Structure panel, add/remove a
     section and a measure and assert the stored `sections` shape updates.
   - *Select-to-edit + highlight:* selecting a measure/section row reveals the right
     panels (Measure+Section / Section only) and applies the canvas highlight class
     (`is-active-measure` / `is-active-section`).
   - *Language conversion + persistence (AC9/AC10/AC11):* with an English single-`C`
     song, switch the Song panel's **Note language** to Spanish → the stored song has
     `language: "spanish"` and the pitch step is `"do"`; switch back → `"english"`/`C`.
     Seed a language-less Spanish song (`do`) and assert the selector shows Spanish
     (inference). Round-trip the `language` field through JSON mode and back (it is
     preserved, validates, never blocks saving).
   - *Front-end parity (AC12):* keep/confirm the existing front-end render spec
     (`specs/render.spec.js`) passes unchanged — a saved song (now possibly carrying
     `language`) renders identically; the published DOM has **no** hit-rect (the
     emit is editor-only).
3. **Final integration audit:**
   - `npm run build` (compiles `src/` → `build/`), `npm run lint` (biome) clean,
     `npm run test:unit` green (full suite, with all the rewritten/added unit tests from
     T1–T7), `npm run test:e2e` (after `npm run env:start`).
   - **Boundary check:** confirm `view.js` still calls `renderInto(container, model,
     { accessibleName })` with **no** `interactive`, `render.php` is unchanged, and
     the only `svg.js` change is the gated hit-rect. Confirm the only schema change
     is the additive `language` enum.
   - **Deps check (AC15):** every new production import under `src/editor/**` +
     `src/edit.js` is `@wordpress/*` or a local relative path (no outside runtime
     dependency).

**Depends on.** T1–T7 (exercises all of them end to end).

**Traces to.** Req 1–19; AC1–AC15 (the e2e is the authoritative real-browser guard;
the audit closes KD5's cross-cutting constraints).

**Acceptance.** `npm run build` succeeds; `npm run lint` clean; `npm run test:unit` green
(target ≥ 548 baseline, adjusted for the tests this review rewrites/adds);
`npm run test:e2e` green for the new + existing specs; the boundary + deps audit
confirms front-end byte-identity and WordPress-only deps. If Docker e2e cannot run
locally, the specs are authored and the unit + build + lint layers verified, with the
gap stated explicitly in the report.

---

## Task summary (order)

1. **T1** — Editor-only per-event hit-rect (KD1).
2. **T2** — Schema `language` enum field (KD4.1).
3. **T3** — Song-wide `mapSong` converter + `language`-first `system` (KD4.2–3).
4. **T4** — Language selector in the Song panel (KD4.4–5).
5. **T5** — Kind-tagged selection + lifted structural mutators (KD3.1–3).
6. **T6** — `StructureList` + derived canvas highlight/scroll (KD3.4–5).
7. **T7** — Selection-contextual add/remove note + remove the canvas add-grid (KD2)
   — **lands together with T6's first-note entry point** (hard sequencing).
8. **T8** — e2e for the new flows + final integration/boundary/deps audit (KD5).

KD5 (conformant-by-construction, raw-JSON unchanged, disclosure, WordPress-only
deps) is satisfied across T1–T7 by routing every mutation through `commitSong` and
using only `@wordpress/components`, and is explicitly audited in T8.
