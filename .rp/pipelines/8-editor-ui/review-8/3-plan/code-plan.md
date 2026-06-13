# Review 8 — Code plan

An ordered list of implementation tasks (T1…T18) that turn the approved design
(`../2-design-doc/design-doc.md`) into discrete, dependency-ordered, independently
testable commits. Each task leaves the tree green: `npm run test:unit`, `npm run build`,
and `npm run check` (Biome) all pass at the commit. E2E (`npm run test:e2e`) is
Docker-based and may not run in-env; e2e spec changes are planned as their own tasks
(T17) and must EXIST and be consistent-by-construction even if not executed here.

The **Traces to** fields are planning-only: no pipeline reference (`.rp/`, task IDs,
`R#`/`O#`, `AC#`, `KD`, `T#`) may appear in shipped code, tests, or comments. When a task
edits a comment that carries such a tag, it strips it.

Phase order (from the design's change ordering): **A** pure helpers → **B** consumers →
**C** atomic mock+production pairs → **D** independent islands. `StructureTree.js` is
touched by T6 (R1), T13 (R7), T14 (O2), T15 (R18 docblock last) — sequenced so they do
not collide. `edit.js` is touched by T7 (R6/R10/R20/R4-edit) and T11 (R9 import) /
T12 (R11 memo); T7 lands first, T11/T12 after.

---

## Phase A — pure helpers (no UI)

### T1 — selection.js key contract + kind stamp + compat delete + measureCoords de-export

- **Goal.** Make `selection.js` the single home of the whole expansion-key contract by
  adding three pure, React-free helpers (`ancestorKeys`, `eventKey`, `expansionKeyOf`)
  beside `expansionKey`, delete the now-dead backward-compat defaulting block in
  `resolveSelection`, and drop the test-only `measureCoords` export (per-symbol O4).
- **Files.**
  - `src/editor/selection.js`
  - `src/editor/__tests__/selection.test.js`
- **Changes.**
  - Add `ancestorKeys({ sectionIndex, measureIndex, hand })` returning the three-key
    reveal array, built from `expansionKey`:
    ```
    [ expansionKey({ sectionIndex }),
      expansionKey({ sectionIndex, measureIndex }),
      expansionKey({ sectionIndex, measureIndex, hand }) ]
    ```
    It is the **three-key** reveal only (section→measure→hand). Single-key reveal sites
    keep calling `expansionKey` directly — do not add a single-key variant.
  - Add `eventKey({ sectionIndex, measureIndex, hand, eventIndex })` =
    `expansionKey({ sectionIndex, measureIndex, hand }) + "e" + eventIndex` (produces
    `s0m1rightHande0`). Used only as the leaf-row React key by `StructureTree` (T13/T6
    consume it).
  - Add `expansionKeyOf(row)` = `row?.getAttribute?.("data-expansion-key") ?? null` — the
    symmetric inverse of `expansionKey` (pure, DOM-arg-only, no React). Document it as the
    read side of the key contract.
  - In `resolveSelection`, delete the untagged-but-complete `kind` defaulting expression
    (current lines ~144-153: the `selection.kind ?? (… ? "event" : undefined)` block) and
    replace it with a plain `const { kind } = selection;` (or read `selection.kind`
    directly), keeping the `if (kind === undefined || sectionIndex === undefined) return
    null;` guard. Delete the **Backward compatibility** docblock paragraph (current lines
    ~120-125) that describes the now-removed compat behavior. The rest of `resolveSelection`
    (the section→measure→event walk) is unchanged.
  - **`measureCoords` de-export (per-symbol O4).** `measureCoords` is used internally by
    `globalMeasureNumber` (in this file) and is imported by no production module — only by
    `selection.test.js`. Drop the `export` keyword on `measureCoords` (keep the function body;
    `globalMeasureNumber` still calls it). Per the per-symbol rule (do not orphan a test on a
    removed export), **update `selection.test.js`**: remove `measureCoords` from its import
    list and delete the `describe("measureCoords", …)` block (current lines ~81-126) and any
    other line that calls `measureCoords` directly. The `globalMeasureNumber` test that
    *exercises* the same flatten through the public function stays (it pins the invariant
    indirectly). If a `globalMeasureNumber` test currently reads `measureCoords` for its
    expected value (e.g. the "exact 1-based inverse" assertion ~128-129), rewrite it to build
    its expectation without importing `measureCoords` (inline the expected coords array).
  - In the docblock, strip any pipeline-provenance tags encountered while editing (this
    file's `repairPath` comment fix is handled in T15/R18; do not pre-empt it here — only
    remove the compat paragraph and any tag inside text you touch).
  - **Tests (selection.test.js).** Add a new describe pinning byte-identity:
    `ancestorKeys({ sectionIndex: 0, measureIndex: 1, hand: "rightHand" })` ===
    `["s0", "s0m1", "s0m1rightHand"]`; `eventKey({ sectionIndex: 0, measureIndex: 1, hand:
    "rightHand", eventIndex: 0 })` === `"s0m1rightHande0"`. Add a mount-free unit on
    `expansionKeyOf`: a synthetic `<tr>` (via `document.createElement("tr")` +
    `setAttribute("data-expansion-key", "s0m1rightHand")`) returns `"s0m1rightHand"`, and a
    `<tr>` without the attribute returns `null`. **Delete** the compat test
    `'tags an untagged-complete event tuple as kind:"event" (backward compat)'` (current
    lines ~238-246). Keep all other `resolveSelection` tests unchanged.
- **Depends on.** none.
- **Traces to.** R20, R10, O4 (measureCoords); A20, A10, AO4; Guardrail A.
- **Acceptance.** `npm run test:unit` green (new byte-identity + `expansionKeyOf` units pass;
  the deleted compat test is gone; the `measureCoords` describe is removed and no test imports
  `measureCoords`; the `globalMeasureNumber` and remaining selection tests pass).
  `npm run check` clean (no unused-export lint on `measureCoords`, still called by
  `globalMeasureNumber`). The existing `expansionKey` tests stay green.

### T2 — songModel.js: updateHandEvents, HANDS, NONE_OPTION, export cleanup

- **Goal.** Add the `updateHandEvents` mutator helper (encoding the empty-hand rule once),
  consolidate the hand vocabulary into one `HANDS` export with `STAVES` derived from it,
  export a single `NONE_OPTION`, and apply the per-symbol export cleanup.
- **Files.**
  - `src/editor/songModel.js`
  - `src/editor/__tests__/songModel.test.js`
- **Changes.**
  - **`updateHandEvents(song, { sectionIndex, measureIndex, hand }, fn)`** beside the
    `set*At` faces, composing on `setMeasureAt`:
    ```
    export function updateHandEvents(song, { sectionIndex, measureIndex, hand }, fn) {
      const measure = song.sections[sectionIndex].measures[measureIndex];
      const nextEvents = fn(measure[hand] ?? []);
      let nextMeasure;
      if (nextEvents == null || nextEvents.length === 0) {
        const { [hand]: _dropped, ...rest } = measure;
        nextMeasure = rest;
      } else {
        nextMeasure = { ...measure, [hand]: nextEvents };
      }
      return setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure);
    }
    ```
    `fn` receives `measure[hand] ?? []` (a grow `fn` on a missing hand gets `[]` and returns
    a non-empty array, creating the key). Empty array or `null` → delete the hand key
    (`undefined`, never `[]`). No existence guard inside (matches `setEventAt`; callers
    guard). Document it in the `set*At` family style.
  - **`HANDS`** — one ordered `{ key, label }` array with translator-wrapped labels:
    ```
    export const HANDS = [
      { key: "rightHand", label: __("Right hand", "piano-block") },
      { key: "leftHand", label: __("Left hand", "piano-block") },
    ];
    ```
    Replace the literal `STAVES` (current lines ~95-98) with a **derived** export:
    `export const STAVES = HANDS.map((h) => ({ label: h.label, value: h.key }));`
    (byte-identical to the literal). Keep `STAVES` exported (its importers `AnnotationEditor`
    and `songModel.test.js` are unchanged).
  - **`NONE_OPTION`** — add `export const NONE_OPTION = { label: __("None", "piano-block"),
    value: "" };` (the "None" text, matching today's `NotePanel`/`MeasurePanel` value). Its
    consumers are wired in T8.
  - **O4 export cleanup (per-symbol). Scope: `songModel.js` symbols only** (`measureCoords` is
    in `selection.js`, handled in T1; `serializeSong` is in `serializeSong.js`, addressed as a
    note below):
    - **DELETE** `newRest` (current lines ~195-202) entirely.
    - **DELETE** `BPM_MIN_EXCLUSIVE` (current line ~120) and its docblock. Do NOT wire it
      anywhere; the BPM control keeps `min={1}`.
    - Drop only the `export` keyword on `toNumber` (keep the body; still called by
      `toBoundedInt`). Per the per-symbol rule, **update `songModel.test.js`**: remove
      `toNumber` from its import list and delete the `'toNumber returns a finite number or
      null…'` test (current lines ~362-368). (`toNumber`'s behavior is still exercised
      indirectly through `toBoundedInt`'s test, if present; the dedicated test referenced the
      now-private export and must go.)
    - **Dead mock deletion.** In `test/mocks/wordpress-components.js`, delete the
      `ToggleControl` and `__experimentalTreeGridItem`/`TreeGridItem` stand-ins and their
      `module.exports` entries — confirmed no production component and no test uses them. (This
      mock file is also edited by T9; either task may make this deletion, but assign it here to
      keep T9 focused on icons. If sequencing makes it cleaner, the writer may fold this single
      deletion into T9 instead — flag in the commit which task carried it.)
    - **`serializeSong` (note, no change in this task).** `serializeSong` is exported from
      `src/editor/serializeSong.js` and imported by `serializeSong.test.js` (`import {
      commitSong, serializeSong }`). Per the per-symbol rule, the cheapest correct choice is to
      **keep the `serializeSong` export** (the test still imports and exercises it). Do not edit
      `serializeSong.js`. (Dropping the export would require deleting/rewriting the
      `serializeSong` test for no benefit.)
  - **`newRest` test deletion (songModel.test.js).** Delete the `'newRest is a typed quarter
    rest…'` test (current lines ~197-198). **Also fix the second `newRest` usage** at current
    line ~242 (`song.sections[0].measures[0].leftHand = [newRest()];`) by inlining the
    literal `{ type: "rest", duration: "quarter" }` so that test no longer references the
    deleted factory. Remove `newRest` and `BPM_MIN_EXCLUSIVE` from the test's import list.
  - **`BPM_MIN_EXCLUSIVE` test deletion.** Delete the `'BPM_MIN_EXCLUSIVE is the strict lower
    bound…'` test (current lines ~179-180).
  - **`updateHandEvents` test (songModel.test.js).** Add a describe matching the `set*At`
    test convention: grow (`fn` returns a non-empty array on a hand that had events) → key
    present with the new array; grow on a missing hand → key created; shrink-to-empty
    (`fn` returns `[]`) → key **absent** (`expect(measure.rightHand).toBeUndefined()`);
    shrink-non-last (`fn` returns a trimmed non-empty array) → key present, trimmed; `fn`
    returns `null` → key absent; plus an immutability check (the input `song` is unmutated).
  - **`STAVES` enum-mirror test** (current lines ~120-121, ~136) stays green unchanged
    (STAVES shape is byte-identical).
- **Depends on.** none.
- **Traces to.** R6, O2, R15, O4; A6, AO2, A15, AO4.
- **Acceptance.** `npm run test:unit` green: the new `updateHandEvents` units pass; the
  `STAVES` enum-mirror test passes; the `newRest`/`BPM_MIN_EXCLUSIVE`/`toNumber` tests are
  deleted and `songModel.test.js` imports no removed symbol; `serializeSong.test.js` still
  imports and passes; no suite references the deleted `ToggleControl`/`TreeGridItem` mocks.
  `npm run check` clean (no unused-export lint on de-exported `toNumber`, still used by
  `toBoundedInt`; no dead `newRest`/`BPM_MIN_EXCLUSIVE`).

---

## Phase B — consumers of Phase A

### T6 — StructureTree keyboard expand/collapse (TreeGrid wiring)

- **Goal.** Wire the real TreeGrid keyboard expand/collapse contract: pass
  `onExpandRow`/`onCollapseRow` to a single shared in-component handler that reads the row's
  `data-expansion-key` and routes to the existing `onToggleExpanded`; stamp
  `data-expansion-key` on every expandable row; switch the leaf row's React key to `eventKey`.
- **Files.**
  - `src/editor/StructureTree.js`
  - `src/editor/__tests__/StructureTree.test.js`
- **Changes.**
  - Import `expansionKeyOf` and `eventKey` from `./selection.js` (alongside the existing
    `expansionKey`).
  - Add a shared handler in the component body (closes over `onToggleExpanded` from props):
    ```
    const onExpandCollapseRow = (row) => {
      const key = expansionKeyOf(row);
      if (key) onToggleExpanded?.(key);
    };
    ```
  - Change the `<TreeGrid>` (current line ~569) to pass both
    `onExpandRow={onExpandCollapseRow}` and `onCollapseRow={onExpandCollapseRow}`. (The R2
    `aria-label` swap is a separate atomic task, T10 — do not change `label` here; T10 owns
    that line. To avoid collision, T6 adds only the two callback props to the existing
    `<TreeGrid label={…} …>`; T10 then swaps `label` → `aria-label`.)
  - On each of the three **expandable** `TreeGridRow`s (section, measure, hand), add the
    kebab-literal attribute `data-expansion-key={sectionKey}` /
    `data-expansion-key={measureKey}` / `data-expansion-key={handKey}` respectively (the same
    string already used for the React `key` and the `expanded`-Set membership). **Author it
    as the kebab literal** `data-expansion-key` (NOT `data-expansionKey` — JSX does not
    auto-kebab `data-*`). It goes on the `<TreeGridRow>`, not a cell.
  - The leaf (note) `TreeGridRow` (current line ~452) must **not** carry
    `data-expansion-key`. Replace its inline React key construction:
    `const eventKey = \`${handKey}e${eventIndex}\`;` (current line ~443) with
    `const noteKey = eventKey({ sectionIndex, measureIndex, hand, eventIndex });` and use
    `key={noteKey}` (rename the local to avoid shadowing the imported `eventKey`).
  - **Tests (StructureTree.test.js).** Add an always-run jsdom guard: render `StructureTree`
    (with a song expanded enough to show section/measure/hand rows) and assert (a) the
    `<table role="treegrid">` was passed non-no-op `onExpandRow`/`onCollapseRow` — assert
    structurally by simulating: query an expandable row `<tr>` carrying `data-expansion-key`,
    confirm the attribute value equals the expected key string (e.g. `"s0"` for the section
    row); (b) each expandable row (section/measure/hand) carries `data-expansion-key` and the
    leaf note row does not. (The pure routing of `expansionKeyOf` → `onToggleExpanded` is
    pinned in T1's `expansionKeyOf` unit; this task pins the attribute presence + value.)
    Existing StructureTree tests (row inventory, selection, menus) stay green.
- **Depends on.** T1 (consumes `expansionKeyOf`, `eventKey`).
- **Traces to.** R1, R20 (consumer); A1, A20; Guardrail A.
- **Acceptance.** `npm run test:unit` green: new guard asserts callbacks-passed +
  per-expandable-row `data-expansion-key` (correct kebab key strings) + leaf row has none;
  existing StructureTree assertions unchanged. `npm run check` clean. (The real-arrow
  ArrowRight/ArrowLeft path is the e2e in T17.)

### T7 — edit.js: adopt set*At/updateHandEvents, ancestorKeys reveals, kind stamp, control props

- **Goal.** Replace `edit.js`'s eight inline two-level rebuilds with `setSectionAt` /
  `updateHandEvents`, route the three three-key reveals through `ancestorKeys`, stamp
  `kind: "event"` on the `onAddNote` selection, and apply the `edit.js` control-prop fixes.
- **Files.**
  - `src/edit.js`
- **Changes.**
  - **Imports.** From `./editor/songModel.js`, add exactly `setSectionAt` and
    `updateHandEvents` to the existing import (`duplicateAt`, `insertAt`, `newMeasure`,
    `newNote`, `newSection`, `newSong`, `removeAt`). **Do NOT** import `setMeasureAt` or
    `setEventAt` (no edit.js caller; would be dead imports). From `./editor/selection.js`, add
    `ancestorKeys` to the existing import (`expansionKey`, `resolveSelection`).
  - **The eight rebuilds** (per the design's per-site table):
    - `onAddMeasure`: `commit(setSectionAt(working, { sectionIndex }, { ...section, measures:
      insertAt(section.measures, section.measures.length, newMeasure()) }))`.
    - `onRemoveMeasure`: `commit(setSectionAt(working, { sectionIndex }, { ...section,
      measures: removeAt(section.measures, measureIndex) }))`.
    - `onDuplicateMeasure`: `commit(setSectionAt(working, { sectionIndex }, { ...section,
      measures: duplicateAt(section.measures, measureIndex) }))`.
    - `insertMeasureAt`: `commit(setSectionAt(working, { sectionIndex }, { ...section,
      measures: insertAt(section.measures, target, newMeasure()) }))`.
    - `onAddNote`: `commit(updateHandEvents(working, { sectionIndex, measureIndex, hand },
      (events) => insertAt(events, insertIndex, newNote())))`. Keep `insertIndex` computed in
      `edit.js` from `resolvedSelection` (selection awareness stays out of the helper). The
      existing `const events = measure[hand] ?? []` line may be removed (the helper passes
      `events` into `fn`); keep whatever `insertIndex` needs (it reads `events.length` — so
      keep a local `events` read OR compute length inside the selection branch; simplest:
      keep `const events = measure[hand] ?? [];` for the `insertIndex` fallback).
    - `onRemoveNote`: `commit(updateHandEvents(working, { sectionIndex, measureIndex, hand },
      (events) => removeAt(events, eventIndex)))` — the helper owns the empty-hand key-drop.
      Delete the whole `let nextMeasure / if-else / sections.map` block (current lines
      ~311-324). Keep the `if (!measure?.[hand]) return;` guard and the post-commit stale
      selection clear.
    - `onDuplicateNote`: `commit(updateHandEvents(working, { sectionIndex, measureIndex,
      hand }, (events) => duplicateAt(events, eventIndex)))`.
    - `insertNoteAt`: `commit(updateHandEvents(working, { sectionIndex, measureIndex, hand },
      (events) => insertAt(events, target, newNote())))`.
    - In every case the `const section = working.sections[sectionIndex]` guard lines stay
      (they drive the existence guard and read `section.measures`); only the `nextMeasures` +
      `working.sections.map(...)` rebuild pair (and `onRemoveNote`'s if-else) disappears.
  - **Reveals.** Replace each of the three three-key
    `revealAncestors(expansionKey({ sectionIndex }), expansionKey({ sectionIndex,
    measureIndex }), expansionKey({ sectionIndex, measureIndex, hand }))` calls (in
    `onAddNote`, `onDuplicateNote`, `insertNoteAt`) with
    `revealAncestors(...ancestorKeys({ sectionIndex, measureIndex, hand }))`. **Leave** the
    single-key reveals in `onDuplicateMeasure` and `insertMeasureAt`
    (`revealAncestors(expansionKey({ sectionIndex }))`) calling `expansionKey` directly.
  - **Kind stamp.** In `onAddNote`, change the post-commit
    `setSelection({ sectionIndex, measureIndex, hand, eventIndex: insertIndex })` to add
    `kind: "event"` (so every selection producer stamps `kind`; the compat block was deleted
    in T1).
  - **Control props (R4, edit.js portion).** On the raw-JSON `TextareaControl` (current lines
    ~528-538) add `__next40pxDefaultSize` and `__nextHasNoMarginBottom`. (No `NumberControl`
    or other Button-family control in `edit.js` besides the `ToolbarButton`s, which take the
    40px size implicitly via the toolbar; do not add `__next40pxDefaultSize` to
    `ToolbarButton` — it is not in the list. Only the `TextareaControl` is affected here.)
- **Depends on.** T1 (`ancestorKeys`), T2 (`setSectionAt`, `updateHandEvents`).
- **Traces to.** R6, R20 (consumer), R10 (consumer), R4 (edit.js); A6, A20, A10, A4.
- **Acceptance.** `npm run test:unit` green: `Edit.test.js`'s empty-hand assertion
  (`expect(persisted.sections[0].measures[0].rightHand).toBeUndefined()`, current line ~516)
  stays green **unchanged**; the "keeps the hand when another event remains" case (the
  trimmed-array branch) stays green; the add/duplicate/insert integration cases stay green.
  `npm run check` clean (no dead `setMeasureAt`/`setEventAt` imports; `__song-input` className
  on the textarea stays for now — its CSS hook is removed in T9/T16). Behavior for empty /
  valid / invalid JSON unchanged.

### T8 — NONE_OPTION consumers + HandConfigEditor array helpers + ALTER_KEY_OPTIONS + ContextEditor HANDS

- **Goal.** Route every "none" select option through the single `NONE_OPTION`, switch
  `HandConfigEditor` to the shared array helpers and to `noteNameOptions("english")` for
  `ALTER_KEY_OPTIONS`, and have `ContextEditor` read hand labels via the `HANDS` export.
- **Files.**
  - `src/editor/inspector/NotePanel.js`
  - `src/editor/inspector/MeasurePanel.js`
  - `src/editor/ContextEditor.js`
  - `src/editor/HandConfigEditor.js`
- **Changes.**
  - **NotePanel / MeasurePanel.** Replace each local `NONE_OPTION` declaration
    (NotePanel ~line 63, MeasurePanel ~line 37) with an import of `NONE_OPTION` from
    `../songModel.js` (each file already imports from `../songModel.js`; add the name). Use
    the imported `NONE_OPTION` everywhere the local one was used.
  - **ContextEditor.** Replace the two `{ label: __("—", "piano-block"), value: "" }` idioms
    (current lines ~150, ~173) with the imported `NONE_OPTION` (import from `./songModel.js`).
    Replace the hand-label reads (current `context.rightHand`/`context.leftHand` label
    sources at ~182, ~189, ~230, ~241) so any restated rightHand/leftHand label literal reads
    from the `HANDS` export by key (import `HANDS` from `./songModel.js`; build a key→label
    lookup, e.g. `HANDS.find((h) => h.key === "rightHand").label`, or map once). Behavior and
    rendered labels unchanged.
  - **HandConfigEditor.**
    - Add `replaceAt`, `removeAt`, `insertAt` to the existing `./songModel.js` import.
      Replace the local `replaceRow` helper (current lines ~188-192) with `replaceAt`; replace
      the inline `rows.filter((_, i) => i !== index)` (current line ~173) with
      `removeAt(rows, index)`; replace the spread-append `[...rows, …]` (current line ~180)
      with `insertAt(rows, rows.length, …)`. Delete the now-unused `replaceRow`.
    - Replace the `ALTER_KEY_OPTIONS` definition (current lines ~37-40) with a derivation from
      `noteNameOptions("english")` (import `noteNameOptions` from `./noteNames.js`). Confirm
      the produced `{ label, value }` shape matches what the alteration-note select expects
      (note letters C–B). The `'Right hand alteration note'` options assertion in
      `contextControls.test.js` (~line 366-383) must stay green.
    - Replace the `{ label: __("—", "piano-block"), value: "" }` idiom (current line ~119)
      with the imported `NONE_OPTION`.
- **Depends on.** T2 (`NONE_OPTION`, `HANDS`).
- **Traces to.** R15, R14, O2 (ContextEditor consumer); A15, A14, AO2.
- **Acceptance.** `npm run test:unit` green: `contextControls.test.js`,
  `pitches.test.js`, `annotations.test.js`, `NotePanel.test.js`, `MeasurePanel.test.js` all
  pass; the `'Right hand alteration note'` options and the clef/octave-shift locators (by the
  unchanged composed aria-labels) still resolve; the HandConfigEditor add/remove/replace
  behavior is unchanged. `npm run check` clean (no unused `replaceRow`; the `—`→`None` text
  change is internal). The barline-vs-clef "None" text is now consistent.

---

## Phase C — atomic mock+production pairs

### T9 — Element icons + project-wide string-icon guard + realIcons/two-project lighten + AddButton

- **Goal.** Convert every string-slug icon to a `@wordpress/icons` element, replace the
  icons mock + default Icon/Button/DropdownMenu mocks with element-rendering forms so a
  string icon renders nothing, add one project-wide RED-on-regression string-icon assertion
  covering all icon-bearing components, delete the realIcons test + two-project jest config +
  React-dedup mapper, and migrate the AddButton locators from aria-label to text. **All in
  one commit** (splitting leaves the guard wrong-colored mid-flight).
- **Files.**
  - `test/mocks/wordpress-icons.js`
  - `test/mocks/wordpress-components.js`
  - `jest.config.js`
  - `src/editor/ListControls.js`
  - `src/editor/PitchList.js`
  - `src/editor/AnnotationList.js`
  - `src/editor/HandConfigEditor.js`
  - `src/editor/__tests__/StructureTree.realIcons.test.js` (delete)
  - `src/editor/__tests__/pitches.test.js`
  - `src/editor/__tests__/annotations.test.js`
  - `src/editor/__tests__/contextControls.test.js` (if it locates the HandConfigEditor
    add-alteration button by aria-label — see below)
  - a new project-wide guard test, e.g. `src/editor/__tests__/icons.test.js`
- **Changes.**
  - **`test/mocks/wordpress-icons.js`.** Build the runner's `createElement` from
    `@wordpress/element` and export each icon as an inert React **element** sentinel with a
    distinguishable marker, e.g.
    `const plus = createElement("svg", { "data-wp-icon": "plus" });` — for every export
    currently a string (`moreVertical`, `chevronRightSmall`, `chevronDownSmall`,
    `chevronLeftSmall`, `plus`) and **add** `trash` (newly imported by the leaf editors).
    Keep `module.exports` listing every name.
  - **`test/mocks/wordpress-components.js`.** Change the default `Icon` mock from the
    icon-blind `<span data-icon>` to the element-rendering form:
    `isValidElement(icon) ? cloneElement(icon) : null` (import `isValidElement`,
    `cloneElement` from `@wordpress/element`). Change default `Button` and `DropdownMenu` to
    render `icon ? createElement(Icon, { icon }) : null` as part of their output (Button:
    render the icon node before/with children; DropdownMenu: render it in the toggle button)
    — so a correct element icon renders the marked node and a string icon renders nothing.
    Keep the DropdownMenu null-on-non-render-fn guard unchanged (T13 relies on it). **Ripple:**
    rendering the icon adds a child node to iconful buttons suite-wide; the marker `<svg>` has
    no text so `.textContent` is usually unaffected, but the writer must run the full suite.
  - **`jest.config.js`.** Collapse `projects: [unit, real-icons]` to a single flat config:
    remove the `real-icons` project, the `REAL_ICONS_TEST` const, the `testPathIgnorePatterns`
    exclusion, the `testMatch`, and the `reactDedupMapper` (no longer needed — the sentinel is
    runner-built). Keep `wordpressMocks`, the `iconsMock` mapping (now pointing at the
    element-sentinel mock), `setupFiles`, and `reporters`. Rewrite the file's docblock to
    describe the single flat config (strip the two-project/React-dedup narrative).
  - **`src/editor/__tests__/StructureTree.realIcons.test.js`.** Delete the file.
  - **Production element icons:**
    - `ListControls.js` AddButton (current lines ~24-29): change
      `<Button variant="secondary" icon="plus" label={label}>{label}</Button>` to
      `<Button variant="secondary" icon={plus} onClick={onClick}>{label}</Button>` — drop the
      **inner Button `label` prop** (redundant: the visible text child is the accessible
      name), keep the `{label}` text child and the `AddButton` `label` parameter. Add
      `import { plus } from "@wordpress/icons"`.
    - `PitchList.js` (current line ~47), `AnnotationList.js` (current line ~61),
      `HandConfigEditor.js` (current line ~171): `icon="trash"` → `icon={trash}`, **add
      `isDestructive`**, **keep the `label`** (it is the queried `aria-label`). Each file adds
      `import { trash } from "@wordpress/icons"`.
    - `StructureTree.js`'s existing element icons stay (no change).
  - **AddButton locator migration (NOT test-neutral).** The jsdom Button mock derives
    `aria-label` only from the `label`/`aria-label` prop, not text children. After dropping
    AddButton's inner `label`, `buttonByName(container, "Add pitch")` /
    `"Add annotation"` returns nothing. Migrate the ~5 affected add-button locators to **text**:
    add a `buttonByText` helper (matching `button.textContent === name`) in `pitches.test.js`
    (~line 287: `Add pitch`) and `annotations.test.js` (~lines 271, 278, 288, 289:
    `Add annotation`), and use it for the add-button clicks. **Leave the Remove-button
    locators on aria-label** (the trash buttons keep their `label`). If
    `contextControls.test.js` locates the HandConfigEditor add-alteration button by
    aria-label, that button is rendered via `AddButton` — but note O3 (T16) handles its
    composed label; in this task, only change AddButton's locators that break from the
    inner-label drop. Verify the `'Right hand add alteration'`/`'Right hand remove alteration'`
    buttons in `contextControls.test.js` (~lines 340, 358, 364, 378): the **remove** alteration
    button is a trash `Button` keeping `label` (stays aria-label-locatable); the **add**
    alteration button is an `AddButton` whose inner label drops — migrate that one to text if
    the test queries it by name (it currently uses `buttonByName(container, "Right hand add
    alteration")`), i.e. add/extend a `buttonByText` there too.
  - **Project-wide guard test (new file, e.g. `icons.test.js`).** One parametrized test that
    mounts **each** icon-bearing component — `ListControls`/`AddButton` (plus), `PitchList`,
    `AnnotationList`, `HandConfigEditor` (trash), and `StructureTree` (moreVertical, plus,
    chevrons) — with minimal valid props, and asserts each rendered icon host carries the
    sentinel marker (e.g. `container.querySelector("[data-wp-icon]")` truthy, or per-button
    `button.querySelector("svg")` truthy). It must be RED if any of these is given a string
    `icon` (renders no marked node) and GREEN once all are elements. Document the test's
    purpose in plain language (no pipeline tags).
- **Depends on.** T6 (StructureTree's `data-expansion-key`/keys already in place so the guard
  mounts the post-R1 tree), T8 (HandConfigEditor already on shared helpers; AddButton
  add-alteration locator coexists with O3 in T16 — T9 lands before T16, so T16 re-confirms
  the composed labels). Practically: T9 depends on T2 (icons unaffected) and the production
  files being in their T6/T8 state; sequence T9 after T8.
- **Traces to.** R16, O1; A16, AO1; Guardrail B (DropdownMenu guard preserved).
- **Acceptance.** `npm run test:unit` green across the **single** flat project: the new
  project-wide guard passes (all icon-bearing components render the marked node); flipping any
  one production `icon` back to a string makes the guard go RED (writer verifies once locally);
  `pitches.test.js`/`annotations.test.js`/`contextControls.test.js` pass with the migrated
  text locators; the realIcons test is gone and `jest.config.js` is single-project.
  `npm run check` clean. `npm run build` succeeds.

### T10 — Accessible name: TreeGrid aria-label + mock de-translation

- **Goal.** Give the tree a real accessible name via `aria-label` and stop the TreeGrid mock
  from mapping `label` → `aria-label`, so the unit surface matches the real prop surface.
  **One commit** (mock + production + new unit).
- **Files.**
  - `src/editor/StructureTree.js`
  - `test/mocks/wordpress-components.js`
  - `src/editor/__tests__/StructureTree.test.js`
- **Changes.**
  - **Production.** At the `<TreeGrid>` (current line ~569, already carrying the T6
    callbacks), swap `label={__("Song structure", "piano-block")}` for
    `aria-label={__("Song structure", "piano-block")}` and drop the `label` prop.
  - **Mock (TreeGrid stand-in, current lines ~445-458).** Remove the `label` destructure and
    the `"aria-label": label` mapping, leaving
    `createElement("table", { role: "treegrid", ...rest }, createElement("tbody", null,
    children))`. The `...rest` spread now carries the production `aria-label` through as a real
    attribute (matching the real component). Update the mock's docblock to say the accessible
    name flows through `...rest` (strip the `label` pass-through sentence).
  - **Tests (StructureTree.test.js).** Add an always-run unit: render `StructureTree`, query
    `container.querySelector('[role="treegrid"]')`, assert it has
    `getAttribute("aria-label") === "Song structure"` and `getAttribute("label") === null`
    (no dead `label` attribute). No existing unit queries the tree by name, so nothing else
    needs re-query; `Edit.test.js`'s `[role="treegrid"]` queries (~lines 680, 693) stay green.
- **Depends on.** T6 (same `<TreeGrid>` line; T6 added the callbacks, T10 swaps label→aria-label).
- **Traces to.** R2; A2.
- **Acceptance.** `npm run test:unit` green: the new aria-label-present/label-absent unit
  passes; the mock no longer maps `label`; `Edit.test.js` treegrid-by-role queries pass.
  `npm run check` clean. (The real `getByRole("treegrid", { name: "Song structure" })` is the
  e2e in T17.)

---

## Phase D — independent islands

### T11 — Shared helper extraction (accessibleName + notation/dom), front-end byte-identity

- **Goal.** Remove the verbatim editor/front-end duplication by moving `accessibleNameFor`
  down to `src/song/accessibleName.js` and `availableWidthInSp`/`drawWhenFontReady` (plus the
  `NARROW_*` consts) to a new React-free `src/notation/dom.js`; repoint all importers.
- **Files.**
  - `src/song/accessibleName.js` (new)
  - `src/editor/accessibleName.js` (delete)
  - `src/notation/dom.js` (new)
  - `src/edit.js`
  - `src/view.js`
  - `src/editor/SongCanvas.js`
- **Changes.**
  - **`src/song/accessibleName.js` (new).** Move `accessibleNameFor` and its private
    `trimmedString` here byte-identical, with the same `@wordpress/i18n` imports
    (`__`, `_x`, `sprintf`). Export only `accessibleNameFor`. Write a fresh docblock
    describing the shared editor/front-end accessible-name derivation (no `SongPreview`
    reference, no pipeline tags).
  - **Delete `src/editor/accessibleName.js`** (no shim).
  - **`src/edit.js`.** Repoint `import { accessibleNameFor } from "./editor/accessibleName.js"`
    → `from "./song/accessibleName.js"`. (Memo body change is T12; this is import-path only.)
  - **`src/view.js`.** Delete the local `accessibleNameFor` (current lines ~56-80) and
    `trimmedString` (~82-85) bodies; add `import { accessibleNameFor } from
    "./song/accessibleName.js"`.
  - **`src/notation/dom.js` (new).** Move `availableWidthInSp` and `drawWhenFontReady` here.
    Move `NARROW_CONTAINER_PX` (480) and `NARROW_SP_PX` (7) as module-private consts. Import
    `SP_PX` from `./constants.js` and `MUSIC_FONT_FAMILY` from `./glyphs.js`. The canonical
    `availableWidthInSp` uses the optional-chaining form `container?.clientWidth ?? 0`. **This
    module must NOT import `@wordpress/element`** (React-free). Export both functions. Write a
    fresh docblock (no pipeline tags).
  - **`src/view.js`.** Delete the local `availableWidthInSp`/`drawWhenFontReady`/`NARROW_*`
    (current lines ~43-45, ~95-100, ~152-164); import them from `./notation/dom.js`. Leave the
    `observeResize`/ResizeObserver wiring (current ~176-191) in `view.js` (NOT unified).
  - **`src/editor/SongCanvas.js`.** Delete the local
    `availableWidthInSp`/`drawWhenFontReady`/`NARROW_*` (current ~37-40, ~52-57, ~67-77);
    import them from `../notation/dom.js`. Leave the React/`useEffect` ResizeObserver wiring
    (current ~179-201) in `SongCanvas` (NOT unified).
- **Depends on.** none (Phase D island), but touches `edit.js` import — sequence after T7 to
  avoid edit.js collision. **Depends on.** T7.
- **Traces to.** R9; A9; Global parity gate.
- **Acceptance.** `npm run test:unit` green: `SongCanvas.test.js` passes (width/font behavior
  unchanged); no test imported the moved functions (they were module-private) so no test
  repoint is needed. `npm run build` succeeds and the front-end bundle gains no React (verify
  `dom.js` has no `@wordpress/element` import). `render.spec.js` front-end assertions are
  consistent-by-construction (rendered output byte-identical). `npm run check` clean (the old
  `src/editor/accessibleName.js` is deleted and nothing imports it).

### T12 — edit.js parse-once memo (R11)

- **Goal.** Make `edit.js` parse `song` once: the `accessibleName` memo reuses the
  already-parsed `working` memo, and `isInvalid` is reduced accordingly.
- **Files.**
  - `src/edit.js`
- **Changes.**
  - Change the `accessibleName` memo (current lines ~145-154) to not re-parse: 
    `const accessibleName = useMemo(() => (song.trim() === "" ? "" :
    accessibleNameFor(working?.metadata)), [song, working]);` (drop the `JSON.parse(song)` /
    try-catch; `working` is already the parsed object or `null`).
  - Reduce `isInvalid` (current lines ~182-183) to
    `const isInvalid = song.trim() !== "" && errors.length > 0;` (a non-empty song with errors
    is invalid; `validateSong` already treats unparseable JSON as a conformance error, so
    `working === null` is implied by `errors.length > 0` for non-empty input).
  - The `working` memo (~161-166) and `safeParse` stay; behavior for empty / valid / invalid
    JSON is unchanged.
- **Depends on.** T11 (the `accessibleNameFor` import path is settled; same `edit.js` region),
  T7 (same file).
- **Traces to.** R11; A11.
- **Acceptance.** `npm run test:unit` green: `Edit.test.js` empty/valid/invalid-song behavior
  unchanged (the invalid-route test ~line 283 and the empty-seed test ~line 231 stay green).
  `npm run check` clean.

### T13 — StructureTree: RowActionsMenu + RowLabelCell extraction (R7)

- **Goal.** Extract the triplicated row-actions `DropdownMenu` into one module-local
  `RowActionsMenu`, and fold the byte-identical section+measure label cells into one
  `RowLabelCell`, preserving roving-tabindex forwarding, select-only label cell, and
  render-function `DropdownMenu` children.
- **Files.**
  - `src/editor/StructureTree.js`
  - `src/editor/__tests__/StructureTree.test.js` (only if assertions need adjusting; expected
    test-neutral)
- **Changes.**
  - Add module-local `RowActionsMenu({ toggleProps, label, onDuplicate, onAddBefore,
    onAddAfter, onRemove })` (above the `StructureTree` export, beside `TreeExpander`). It
    renders `<DropdownMenu icon={moreVertical} toggleProps={toggleProps} label={label}>{(
    { onClose }) => (<>…</>)}</DropdownMenu>` with two `MenuGroup`s — (Duplicate / Add before /
    Add after) then (destructive Remove) — each `MenuItem.onClick = () => { onX?.(); onClose();
    }`. Render-function children are mandatory (the DropdownMenu mock returns `null`
    otherwise).
  - Replace the three copy-pasted actions cells (section ~202-256, measure ~313-368, note
    ~479-559) with `<TreeGridCell>{(p) => <RowActionsMenu toggleProps={p} label={…}
    onDuplicate={…} onAddBefore={…} onAddAfter={…} onRemove={…} />}</TreeGridCell>`, binding
    the row's coordinates into each handler (matching today's bound calls and labels).
  - Add module-local `RowLabelCell({ expansionKey, isExpanded, selected, label,
    onToggleExpanded, onSelect })` rendering `<TreeExpander …>` + the select-only label
    `Button` (`aria-current={selected ? "true" : undefined}`, `onClick={() => onSelect()}`,
    `className="wp-block-piano-block-piano__tree-label"`, `variant="tertiary"`). Use it for the
    **section and measure** label cells only (they are byte-identical twins). **Leave the hand
    label cell explicit** (its Button `onClick` drives `onToggleExpanded`, no `aria-current`)
    and the **note label cell explicit** (no chevron, leaf). Note: `RowLabelCell` takes the
    cell render-prop `cellProps` for the Button (spread onto the Button) — pass it through; the
    `<TreeGridCell>` stays at the call site (shape A) like `RowActionsMenu`.
  - `data-expansion-key` stays on the `<TreeGridRow>` (T6), untouched by this cell folding.
- **Depends on.** T6 (StructureTree's row keys + `data-expansion-key` already in place), T10
  (the `aria-label` swap already landed). Sequence within StructureTree.js: T6 → T13.
- **Traces to.** R7; A7; Guardrail B.
- **Acceptance.** `npm run test:unit` green: `StructureTree.test.js` (which mounts the whole
  tree and queries rendered DOM) confirms each row still renders Duplicate / Add before / Add
  after / Remove with correct bound coordinates (the `selectButtonByText` menu traversals at
  ~446-447, 476-477, 527-528, 544-545 stay green), the toggle button still renders (proving
  children stayed a render function) and carries its `aria-label`, the section/measure label
  cells are select-only (the `aria-current` assertions stay green), and the per-hand "Add note"
  button is unchanged. `npm run check` clean. Net ~140 lines removed.

### T14 — StructureTree: consume HANDS (O2)

- **Goal.** Have `StructureTree` iterate the `HANDS` export instead of its local
  `["rightHand","leftHand"]` array and its restated hand-label literals.
- **Files.**
  - `src/editor/StructureTree.js`
- **Changes.**
  - Import `HANDS` from `./songModel.js`.
  - Replace the local `const HANDS = ["rightHand", "leftHand"];` (current line ~64) usage: the
    hand loop becomes `HANDS.forEach(({ key: hand, label: handLabel }, handPosition) => { … })`
    (`handPosition` = index; `h.key` is the hand key, `h.label` is the display label). Replace
    the restated hand-label conditional (current lines ~382-385:
    `hand === "rightHand" ? __("Right hand"…) : __("Left hand"…)`) by using `handLabel` from
    the iterated entry. `setSize={HANDS.length}` stays correct. Remove the local `HANDS` const.
- **Depends on.** T2 (`HANDS` export), T6, T13 (same file; sequence T14 after T13 per the
  within-file order R1 → R7 → O2 → R18).
- **Traces to.** O2 (consumer); AO2.
- **Acceptance.** `npm run test:unit` green: `StructureTree.test.js` hand-row labels and the
  per-hand "Add note to Right hand…/Left hand…" labels (the assertions at ~501, ~507) stay
  byte-identical. `npm run check` clean.

### T15 — StructureTree docblock + project-wide comment/provenance fixes (R18)

- **Goal.** Fix stale comments that name nonexistent code and strip pipeline-provenance tags,
  including rewriting the `StructureTree` docblock's false "Left/Right works for free" keyboard
  claims to describe the real `onExpandRow`/`onCollapseRow` path. **Docblock rewritten last**
  (after R1/R7/O2 land in StructureTree).
- **Files.**
  - `src/editor/StructureTree.js`
  - `src/editor/inspector/NotePanel.js`
  - `src/editor/inspector/MeasurePanel.js`
  - `src/editor/inspector/SectionPanel.js`
  - `src/editor/selection.js`
  - (note: `src/editor/accessibleName.js` is already deleted in T11 — its `SongPreview`
    comment is gone with it; nothing to do there.)
- **Changes.**
  - **StructureTree docblock** (current ~1-41) and inline comments: rewrite the
    "treegrid keyboard model … Left/Right to collapse/expand for free" and
    "keyboard expand/collapse stays TreeGrid's Left/Right arrows" claims to describe the real
    wiring: `StructureTree` passes `onExpandRow`/`onCollapseRow` to a shared handler that reads
    each expandable row's `data-expansion-key` and toggles the single `expanded` Set. Update
    the `TreeExpander` comment that says the keyboard path is "TreeGrid's Left/Right arrows over
    the row" to reflect that the chevron is the pointer-only affordance while keyboard
    expand/collapse routes through the callbacks. Strip any `KD 14` (and similar) tags from the
    hand-group comment.
  - **NotePanel.js** (~26-27, ~108-110): fix comments referencing `EventRow` (no longer
    exists) to name the real current structure.
  - **MeasurePanel.js** (~18): fix the `MeasureEditor`/`BarlineControl` comment.
  - **SectionPanel.js** (~17): fix the `SectionEditor` comment.
  - **selection.js** (~115): fix the `repairPath` comment (the existence-check chain is now
    inline in `resolveSelection`; reword to describe it without naming the removed helper).
  - Across all edited comments, strip pipeline-provenance tags (`KD …`, `T…`, `AC…`, `R-REG…`).
    Do not touch unrelated comments.
- **Depends on.** T6, T13, T14 (StructureTree docblock describes the post-R1/R7/O2 code), T1
  (selection.js compat paragraph already removed). Sequence last within StructureTree.js.
- **Traces to.** R18; A18.
- **Acceptance.** `npm run test:unit` green (comments only; no behavior change).
  `npm run check` clean. A grep confirms no shipped comment names `EventRow`, `MeasureEditor`,
  `BarlineControl`, `SectionEditor`, `repairPath`, or `SongPreview`, and no provenance tag
  (`KD `, `AC`, `R-REG`, bare `T<digit>`) remains in the edited files.

### T16 — emit.js re-home + omit-helper unification + annotations collapse + ContextEditor heading + sprintf labels (R12, R13, R19, O3)

- **Goal.** Move `emit.js` up to `src/editor/emit.js` (exporting only `omitEmpty`/`omitFalsy`,
  `emitBlock` inlined), unify `MetadataEditor`'s `withField` to `omitFalsy`, collapse the
  duplicated annotations drop-key wrappers in `NotePanel`/`MeasurePanel` to a single idiom,
  remove the duplicated `<h3>` heading in `ContextEditor`, and switch `HandConfigEditor` label
  composition to sprintf.
- **Files.**
  - `src/editor/inspector/emit.js` → move to `src/editor/emit.js`
  - `src/editor/ContextEditor.js`
  - `src/editor/MetadataEditor.js`
  - `src/editor/inspector/NotePanel.js`
  - `src/editor/inspector/MeasurePanel.js`
  - `src/editor/inspector/SectionPanel.js`
  - `src/editor/inspector/SongPanel.js`
  - `src/editor/HandConfigEditor.js`
  - `src/editor/__tests__/emit.test.js`
  - new test for whitespace-Title drop (extend `SongPanel.test.js` or a Metadata test)
  - `src/editor/__tests__/contextControls.test.js` (O3 locator confirmation only)
- **Changes.**
  - **Move `emit.js`** from `src/editor/inspector/emit.js` to `src/editor/emit.js`. Inline
    `emitBlock` away: it ends up exporting only `omitEmpty` and `omitFalsy`. Update importers'
    relative paths:
    - `ContextEditor.js` (~line 45): `./inspector/emit.js` → `./emit.js`. Keeps `omitEmpty`.
      Inline its local `emitMember` (~58-60) as direct `onChange(omitEmpty(...))` calls at its
      use sites.
    - `NotePanel.js` (~52), `MeasurePanel.js` (~34), `SectionPanel.js` (~40):
      `./emit.js` → `../emit.js` (each imports `omitFalsy`).
    - `SongPanel.js` (~30): `./emit.js` → `../emit.js`; it imports `emitBlock` today — switch
      to importing `omitEmpty` and inline the former `emitBlock` call as
      `onChange(omitEmpty(...))`.
    - `emit.test.js` (~line 9): `../inspector/emit.js` → `../emit.js`, and **drop** the
      `emitBlock` import and its `describe("emitBlock …")` cases (~64+) so the suite does not go
      red on a missing export.
  - **MetadataEditor.** Add `import { omitFalsy } from "./emit.js"`. Switch the two `onChange`
    sites (~47, ~53) from local `withField` to `omitFalsy`. Delete the local `withField`
    (~23-31). (Behavior flip: a whitespace-only Title now drops, consistent with Section name.)
    Add `__next40pxDefaultSize` to the two `TextControl`s here as part of R4 — **no**, R4 is the
    dedicated pass in T18; do NOT add control props here. Only the emit/withField change.
  - **NotePanel / MeasurePanel annotations collapse.** Replace the two duplicated annotations
    drop-key wrappers (NotePanel ~223-241 / its `onDeselect` via `changeOptional` at ~226;
    MeasurePanel ~127-147 / its inline-destructure `onDeselect` at ~130-133) with a single
    consistent one-liner idiom via the omit helpers. Pick one `onDeselect` form for both (e.g.
    both drop the `annotations` key via `omitFalsy(obj, "annotations", undefined)` →
    `emit*(...)`), so the two surfaces share one idiom. Behavior unchanged.
  - **ContextEditor heading removal.** Remove the `heading` prop (current ~line 103) and the two
    raw `<h3>{heading}</h3>` renders (~198, ~257). In `SectionPanel.js`, drop the
    `heading={__("Section overrides", …)}` prop it passes to `ContextEditor` (~138-142) — the
    wrapping `ToolsPanelItem` already labels it "Section overrides".
  - **HandConfigEditor sprintf labels (O3).** Replace `fieldLabel = (field) => (label ?
    \`${label} ${field}\` : field)` (current ~line 96) with a sprintf template that composes
    **byte-identically**: `label ? sprintf(/* translators: 1: hand label, 2: field name. */
    __("%1$s %2$s", "piano-block"), label, field) : field`. The composed strings must remain
    exactly `"Right hand clef"`, `"Right hand octave shift"`, `"Right hand alteration"`,
    `"Right hand alteration note"`, `"Right hand add alteration"`, `"Right hand remove
    alteration"` (and the Left-hand equivalents) so `contextControls.test.js` locators stay
    green. Import `sprintf` from `@wordpress/i18n` if not already imported. (The add/remove
    alteration buttons compose their `label` via the same `fieldLabel`; confirm they stay
    byte-identical.)
  - **New whitespace-Title test.** Add a test (in `SongPanel.test.js` or a Metadata-focused
    test) asserting that setting the Title to `"   "` (whitespace only) now **drops** the
    `title` key from the emitted metadata (pins the unified `omitFalsy` behavior). Confirm the
    existing `SongPanel.test.js` clear-with-`""` case (~146-153) still passes (both old and new
    drop on `""`).
- **Depends on.** T9 (AddButton/locator migrations already settled; O3's add-alteration label
  is composed through the same path — sequence T16 after T9 so the text-locator helper exists
  if needed), T8 (HandConfigEditor already on shared helpers + NONE_OPTION). R13 after R12 is
  satisfied within this single task (the annotations collapse uses the re-homed omit helpers).
- **Traces to.** R12, R13, R19, O3; A12, A13, A19, AO3.
- **Acceptance.** `npm run test:unit` green: `emit.test.js` passes against `../emit.js` with no
  `emitBlock`; the new whitespace-Title test passes; `contextControls.test.js` HandConfigEditor
  locators (clef/octave-shift/alteration/add-alteration/remove-alteration, by their unchanged
  composed aria-labels) stay green; `NotePanel.test.js`/`MeasurePanel.test.js` annotations
  behavior unchanged; no component imports `emit.js` across the `inspector/` boundary.
  `npm run check` clean (no unused `withField`/`emitMember`/`emitBlock`; no
  cross-`inspector/`-boundary import).

### T17 — CSS split + selection color/trim + block.json/index.js wiring (R3, R17)

- **Goal.** Move the editor-only CSS into a new `src/editor.scss`, leave only the front-end /
  shared rules in `src/style.scss`, wire `index.js` and `block.json`, and apply the R17 edits
  (admin-color var, `__canvas` trim, drop `__song-input` hook + stale comments) to the moved
  rules. Also remove the dead `__song-input` className in `edit.js`.
- **Files.**
  - `src/editor.scss` (new)
  - `src/style.scss`
  - `src/index.js`
  - `src/block.json`
  - `src/edit.js`
- **Changes.**
  - **`src/editor.scss` (new).** Move everything currently nested under
    `.wp-block-piano-block-piano` from `&__workspace` onward — `&__workspace`, `&__tree` and
    its `[role="gridcell"]` flex, the `@for $i` aria-level indent loop, `-expander`, `-label`,
    `&__canvas`, `&__canvas-svg` and `.is-selected` — **re-parented under their own
    `.wp-block-piano-block-piano { … }` block**, reusing the same `&__` nesting verbatim. The
    `@for $i` loop moves byte-identical (loop-local `$i`). Move the editor rules' doc-comment
    header into this file and rewrite it per R17/R18 (drop the stale `__song-input` sentence and
    any stale comments; no pipeline tags).
  - **`src/style.scss`.** Retain only the `@font-face` "PB Music" declaration (and its
    docblock) and the pre-existing wrapper rules (`border`, `padding`, `color`) on
    `.wp-block-piano-block-piano`. Remove everything moved to `editor.scss`.
  - **R17 edits (applied to the moved rules in `editor.scss`):**
    - Replace the three `#007cba` occurrences (in `.is-selected`, current ~142-144) with
      `var(--wp-admin-theme-color, #007cba)`. `.is-selected` stays **recolor-only** (only
      fill/stroke color values change; no layout/size/transform).
    - Trim `&__canvas` to `flex: 1 1 auto; min-width: 0;` (drop the no-op `flex-direction:
      column; gap: 0.5em;`).
    - Delete the unused `&__song-input` class hook (if present in the moved CSS) and stale
      comments.
  - **`src/index.js`.** Add `import "./editor.scss";` beside the existing `import
    "./style.scss";` (order irrelevant — separate emitted files).
  - **`src/block.json`.** Keep `"style": "file:./style-index.css"`; **add** `"editorStyle":
    "file:./index.css"`.
  - **`src/edit.js`.** Remove the now-dead `className="wp-block-piano-block-piano__song-input"`
    from the raw-JSON `TextareaControl` (current ~line 537) — no CSS or test targets it.
- **Depends on.** T7 (edit.js textarea already touched there; sequence after). Independent of
  other Phase D islands otherwise.
- **Traces to.** R3, R17; A3, A17; Guardrails C, D.
- **Acceptance.** `npm run build` emits `build/style-index.css` (front-end/shared) **and**
  `build/index.css` (editor-only) plus their `-rtl` variants. `npm run test:unit` green (no
  test pins the stylesheet build; the unit suite imports no CSS). `npm run check` clean.
  `render.spec.js` front-end assertions are consistent-by-construction (moved classes never
  appear on the front end; `.is-selected` recolor-only keeps the SVG byte-identical). Manual
  build inspection confirms `index.css` carries the workspace/tree/canvas/`.is-selected` rules
  and `style-index.css` carries only `@font-face` + wrapper rules.

### T18 — Control props pass (R4, project-wide) + Flex/HStack spacing (O5)

- **Goal.** Add `__next40pxDefaultSize` to every interactive control across the editor UI,
  remove `__nextHasNoMarginBottom` from every `NumberControl`, and apply `Flex`/`HStack`
  spacing to the bare-`div` rows and adjacent button pairs.
- **Files.**
  - `src/editor/inspector/SongPanel.js`
  - `src/editor/inspector/NotePanel.js`
  - `src/editor/inspector/MeasurePanel.js`
  - `src/editor/inspector/SectionPanel.js`
  - `src/editor/ContextEditor.js`
  - `src/editor/HandConfigEditor.js`
  - `src/editor/PitchEditor.js`
  - `src/editor/PitchList.js`
  - `src/editor/MetadataEditor.js`
  - `src/editor/AnnotationEditor.js`
  - `src/editor/AnnotationList.js`
  - `src/editor/ListControls.js`
  - `src/editor/InvalidState.js`
  - (`src/edit.js`'s `TextareaControl` already got `__next40pxDefaultSize` in T7.)
- **Changes.**
  - **R4 — `__next40pxDefaultSize`.** Add it to **every** `Button`, `SelectControl`,
    `TextControl`, `NumberControl`, `TextareaControl`, and Button-family control in the files
    above (the inspector panels, the context/hand/pitch/metadata/annotation editors, the list
    controls, the invalid-state view). This is a prop-presence pass — no behavior change.
  - **R4 — remove `__nextHasNoMarginBottom` from every `NumberControl`** (it has no such prop;
    forwards unknown props to `<input>`, producing React unknown-prop warnings). The
    `NumberControl`s are in `ContextEditor.js` (~143, ~166), `HandConfigEditor.js` (~141, ~168),
    `PitchEditor.js` (~77, ~88), `NotePanel.js` (~188). Keep `__nextHasNoMarginBottom` on
    `SelectControl`/`TextControl`/`TextareaControl` (those accept it). Note the components mock
    swallows `__nextHasNoMarginBottom` on NumberControl, so removing it does not change DOM but
    removes the real-WP warning.
  - **O5 — Flex/HStack.** Replace the bare-`div` rows with `Flex`/`HStack` (import from
    `@wordpress/components`):
    - `PitchList.js` (the per-pitch row ~40-53), `AnnotationList.js` (~54-65),
      `HandConfigEditor.js` (the per-alters row ~144-175).
    - Adjacent button pairs: `NotePanel.js` (Add note / Remove note ~247-261),
      `SectionPanel.js` (Add measure / Remove section ~146-156), `SongPanel.js` (the
      Add-section button area ~77), `InvalidState.js` (~46-48).
    Pure cosmetic; the buttons/controls keep their roles and accessible names so the existing
    locators stay green.
- **Depends on.** T9 (AddButton/icon swaps settled), T16 (HandConfigEditor labels + emit
  settled), T8 (NONE_OPTION/array helpers settled). Sequence late (project-wide, touches many
  files already edited). Independent of T17.
- **Traces to.** R4, O5; A4, AO5.
- **Acceptance.** `npm run test:unit` green: all panel/editor tests pass (the Flex/HStack
  wrappers do not change accessible names or roles; the control-prop additions are swallowed by
  the mocks). `npm run check` clean. Manual/real-WP verification (or code grep) confirms every
  listed control carries `__next40pxDefaultSize` and no `NumberControl` carries
  `__nextHasNoMarginBottom`. (No `__next40pxDefaultSize` deprecation warning and no
  `NumberControl` unknown-prop warning would remain on WP 6.8+.)

### T19 — README dependency wording + dead interactive hit-rect removal (R5, R8)

- **Goal.** Remove the dead `interactive` hit-rect feature from the notation core and its
  tests, and correct the README's runtime-dependency claim plus its interactive/hit-rect docs.
- **Files.**
  - `src/notation/svg.js`
  - `src/notation/constants.js`
  - `src/notation/__tests__/svg.test.js`
  - `README.md`
- **Changes.**
  - **`src/notation/svg.js`.**
    - `renderSvg(model, { accessibleName = "", interactive = false } = {})` → drop the
      `interactive` option: `renderSvg(model, { accessibleName = "" } = {})`.
    - Remove the trailing positional `interactive` param from each of the five render functions
      (`renderSystem`/`renderMeasure`/`renderHand`/`renderNote`/`renderRest`) and the
      corresponding call-site args (mechanical; remove all together).
    - Delete `hitRect` (current ~250-260, the only place `data-hit` is emitted), the two
      `if (interactive)` branches (note ~773-775, rest ~920-922), and `HIT_RECT_WIDTH_SP`
      (~64). Remove the `HIT_RECT_VERTICAL_MARGIN_SP` import (~34).
    - `renderInto` forwards the options object unchanged (it never named `interactive`).
  - **`src/notation/constants.js`.** Delete the `HIT_RECT_VERTICAL_MARGIN_SP` definition. Leave
    `SP_PX` and the rest untouched.
  - **`src/notation/__tests__/svg.test.js`.** Delete the
    `describe("renderSvg — editor-only per-event hit-rect (interactive flag)" …)` block
    (current ~986-1045): both the "emits NO hit-rect when interactive is explicitly false"
    (~999-1001) and the three `{ interactive: true }` feature cases (~1004-1044). **Keep** the
    flagless no-hit assertions inside it that call `renderSvg(model)` with no options
    (~988-995) — re-home them into a surviving describe (e.g. a "front-end emit has no hit
    rects" `it`) so at least one "a flagless render emits no `data-hit`" assertion remains,
    pointing at the now flag-free `renderSvg`. The non-interactive structural blocks elsewhere
    in `svg.test.js` stay green unchanged.
  - **`README.md`.**
    - **R5:** reword the "no new runtime dependency" line (~143) and the "ajv would be the
      first runtime dependency" framing (~179 "first") to acknowledge `@wordpress/icons` as a
      bundled `@wordpress/*` runtime dependency, keeping the validator's zero-dependency /
      schema-as-data narrative intact. Do not add or remove any dependency.
    - **R8 tail:** drop the file-layout `interactive` hit-rect clause (~148-149), delete the
      "now-dormant `interactive` hit-rect" section (~158-160) entirely, and drop the
      interactive-hit-rect test clause (~201). Keep the "byte-identical front end" point (now
      unconditional).
- **Depends on.** none (Phase D island; touches `notation/`, `svg.test.js`, README only — no
  overlap with the editor tasks). Can run any time after T2; sequence here for batching.
- **Traces to.** R8, R5; A8, A5; Global parity gate.
- **Acceptance.** `npm run test:unit` green: the non-interactive `svg.test.js` structural blocks
  stay green; at least one flagless "no `data-hit`" assertion remains and passes (now
  unconditionally true — `data-hit` no longer exists in production). `npm run check` clean (no
  dead `HIT_RECT_*`, no `interactive` references in `src/notation/`). `render.spec.js`'s
  `[data-hit]` count-0 guard (~529) stays consistent-by-construction (front-end SVG unchanged).
  A grep confirms `src/notation/` has no `interactive`, `hitRect`, `HIT_RECT_WIDTH_SP`, or
  `HIT_RECT_VERTICAL_MARGIN_SP`, and `README.md` no longer claims "no new runtime dependency"
  nor calls ajv the "first" runtime dependency.

### T20 — e2e specs: keyboard expand/collapse + accessible-name (R1, R2)

- **Goal.** Add the real-contract Playwright e2e coverage that the always-run jsdom guardrails
  back: keyboard ArrowRight/ArrowLeft expand/collapse driven through the real TreeGrid, and the
  tree resolvable by `getByRole("treegrid", { name: "Song structure" })`. These specs must
  EXIST and be consistent-by-construction even though Docker-based e2e may not run in-env.
- **Files.**
  - `specs/editor.spec.js`
- **Changes.**
  - Add an e2e test that focuses a section row, presses **ArrowRight** to expand and asserts
    the child measure rows appear; presses **ArrowLeft** to collapse and asserts they
    disappear; repeats for a measure row (→ hand rows) and a hand row (→ note rows) — driving
    the **real** keyboard path (`page.keyboard.press("ArrowRight")` / `"ArrowLeft"` on the
    focused row), NOT clicking the `.wp-block-piano-block-piano__tree-expander` chevron. Reuse
    the existing structure-tree helpers (`structureTree`, the row locators) where possible; do
    not remove the existing chevron-driven `expandRow` helper (other specs use it for pointer
    coverage).
  - Add an assertion that the tree resolves by accessible name:
    `expect(structureTree(editor).getByRole("treegrid", { name: "Song structure" }))` (or the
    page-scoped equivalent) is visible.
  - Keep the existing e2e specs intact; these are additive.
- **Depends on.** T6 (keyboard callbacks + `data-expansion-key`), T10 (`aria-label`). Sequence
  after both.
- **Traces to.** R1, R2; A1 (e2e), A2 (e2e); the "tests green ≠ real component broken"
  meta-rule.
- **Acceptance.** The new specs are present and internally consistent (selectors match the
  production attributes/labels introduced in T6/T10). `npm run check` clean. (Execution is
  Docker-based and may be skipped in-env; the specs must be correct by construction. If
  `npm run test:e2e` is runnable, both new specs pass.)

---

## Ordering summary

1. **T1** — selection.js: ancestorKeys/eventKey/expansionKeyOf + kind stamp + compat delete (Phase A)
2. **T2** — songModel.js: updateHandEvents + HANDS/derived STAVES + NONE_OPTION + O4 export cleanup (Phase A)
3. **T6** — StructureTree keyboard expand/collapse wiring (Phase B; R1)
4. **T7** — edit.js: set*At/updateHandEvents adoption + ancestorKeys reveals + kind stamp + edit.js control props (Phase B; R6/R20/R10/R4)
5. **T8** — NONE_OPTION consumers + HandConfigEditor array helpers + ALTER_KEY_OPTIONS + ContextEditor HANDS (Phase B; R15/R14/O2)
6. **T9** — element icons + project-wide string-icon guard + realIcons/two-project lighten + AddButton (Phase C atomic; R16/O1)
7. **T10** — TreeGrid aria-label + mock de-translation (Phase C atomic; R2)
8. **T11** — shared helper extraction: src/song/accessibleName.js + src/notation/dom.js (Phase D; R9)
9. **T12** — edit.js parse-once memo (Phase D; R11)
10. **T13** — StructureTree RowActionsMenu + RowLabelCell extraction (Phase D; R7)
11. **T14** — StructureTree consume HANDS (Phase D; O2 consumer)
12. **T15** — StructureTree docblock + project-wide comment/provenance fixes (Phase D; R18)
13. **T16** — emit.js re-home + omit unify + annotations collapse + ContextEditor heading + sprintf labels (Phase D; R12/R13/R19/O3)
14. **T17** — CSS split + selection color/trim + block.json/index.js wiring (Phase D; R3/R17)
15. **T18** — control-props pass + Flex/HStack spacing (Phase D; R4/O5)
16. **T19** — README dependency wording + dead interactive hit-rect removal (Phase D; R5/R8)
17. **T20** — e2e specs: keyboard expand/collapse + accessible-name (Phase D; R1/R2 e2e)

Within `StructureTree.js`: **T6 (R1) → T13 (R7) → T14 (O2) → T15 (R18 docblock)** — same-file
tasks sequenced so they do not collide. The two atomic pairs (T9 = R16+O1, T10 = R2) are each a
single commit. `edit.js`: **T7 → T11 (import) → T12 (memo) → T17 (textarea className)**.
