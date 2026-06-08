# Code Plan Review — Review 1 (APPROVED)

**Artifact:** `3-plan/code-plan.md`
**Verdict:** Approved
**Reviewer:** code-plan-reviewer

## Summary

The plan correctly transforms the on-canvas drill-down editor into the canvas-first,
Gutenberg-native editor the design doc specifies. Every grounding fact it relies on was
verified against the live code on this branch; every spec requirement (1–19) and acceptance
criterion (AC1–AC17) traces to at least one task; the task order is sound for sequential,
single-working-tree execution; and the editor-only boundary is respected. The two non-blocking
refinements below are recorded for the code-writers but do not warrant a rejection.

## Verification performed (live code)

- **Mode container (`src/edit.js`):** confirmed — owns `mode` state, the `BlockControls` JSON
  toggle, the memoized `errors = validateSong(song)` (empty → `[]`), `accessibleName`, and
  `onChangeSong`; the visual branch renders `SongEditor` + `SongPreview` in the
  `__visual` two-column wrapper. Only the visual branch is touched (T8). Matches the plan.
- **Render glue (`src/editor/SongPreview.js`):** confirmed — `NARROW_CONTAINER_PX`/`NARROW_SP_PX`,
  `availableWidthInSp`, `drawWhenFontReady`, the `validateSong` gate + `JSON.parse`, the
  `buildLayoutModel → renderInto` draw, and the rAF-debounced one-way `ResizeObserver` are all
  present exactly as T3 describes porting them into `SongCanvas`.
- **Notation core hooks (`src/notation/svg.js`):** confirmed — `renderNote`/`renderRest` emit
  `data-kind`, `data-hand`, `data-event-index`, and `id="{hand}-{kind}-{i}"` on the note/rest
  group; `renderMeasure` emits `data-measure="{measure.number}"`. The note/rest node itself
  carries `data-hand`, so the plan's `closest('[data-kind]')` → read `data-hand` is correct and
  unambiguous (even though the enclosing staff `<g data-hand>` also carries it).
- **Global measure numbering (`src/notation/layout.js:1706`+):** confirmed — `buildLayoutModel`
  walks `contexts.forEach((ctx, si) => sections[si].measures.forEach((measure, mi) => {
  measureNumber += 1; … number: measureNumber }))`, 1-based, sections-outer/measures-inner.
  T2's `measureCoords` ordering and the `data-measure="N"` → `measureCoords[N-1]` mapping are
  exact. The plan rightly pins this with a test against the core walk.
- **`id` not globally unique:** confirmed (`eventIndex` resets per measure) — the scoped
  `[data-measure][data-hand][data-event-index]` query (not `getElementById`) is required and is
  what the plan specifies.
- **Reused leaf logic:** confirmed `EventRow.changeType` (rest drops `pitches`; note seeds
  `[newPitch(firstName)]`), `PitchList`'s last-pitch `canRemove` guard, `MeasureEditor.changeHand`
  (drop hand key when empty) and `BarlineControl` omit-when-unset, `SectionEditor`'s
  `OVERRIDE_KEYS` projection, `SongOverview.emitBlock`, and `EventEditor`'s drop-`annotations`-
  when-empty — all match the behaviors T4–T7 reuse.
- **Factories/helpers (`src/editor/songModel.js`):** confirmed `newPitch/newNote/newRest/
  newMeasure/newSection/newSong/newEventAnnotation/newStandaloneAnnotation` and
  `insertAt/removeAt/replaceAt/moveItem`. `newSong()` = one section, one empty measure (seeds the
  empty grand staff for AC2).
- **`commitSong` (`src/editor/serializeSong.js`):** confirmed as the single serialize +
  `validateSong`-guard + persist path T8 funnels every edit through.
- **Schema (`src/song/schema.js`):** confirmed `required: ["sections"]` with `sections` as an
  unbounded `type: "array"` (no `minItems`), and `section.measures` likewise unbounded. This
  **resolves both questions the plan flagged**: a song with zero sections is conformant, and an
  empty `measures: []` is conformant (T6's removal of the last measure is valid).
- **Test infra:** confirmed `jest.config.js` maps only `@wordpress/i18n`, `/components`,
  `/block-editor`; `@wordpress/element` resolves through the `@wordpress/scripts` preset (so no
  element mock is needed — the plan's omission is correct). The components mock exports do **not**
  include `PanelBody`, `ToggleControl`, the `ToolsPanel` family, or `Icon`, and the block-editor
  mock lacks `InspectorControls` — exactly what T1 adds.
- **Baseline:** `npx wp-scripts test-unit-js` → **539 passed, 18 suites**. The plan's claim that
  T1's additive mocks leave existing suites green is well-founded.
- **Obsolete tests:** confirmed the five suites T9/T10 retire (`SongEditor.test.js`,
  `structure.test.js`, `events.test.js`, `ListControls.test.js`, `SongPreview.test.js`) plus the
  `Edit.test.js` rewrite, and that the leaf-control suites (`annotations`, `contextControls`,
  `pitches`, `noteNames`, `serializeSong`, `songModel`) stay. The e2e `specs/editor.spec.js`
  drives the drill-down empty state, `__preview` container, and canvas `Title` — exactly the
  locators T11 replaces, while keeping `switchToJsonMode`/`switchToVisualMode`/`seedSongViaJson`/
  `storedSong`.

## Coverage & boundary checks

- **Requirements 1–19:** all traced (per-task "Traces to" + the traceability table). Notably
  Req 18 (editor-only boundary) is asserted as a `git diff` audit in T12, and Req 19 (WP-only
  deps) as an import grep in T12.
- **AC1–AC17:** all referenced across T2–T12. AC12 via T8 (JSON branch unchanged) + T11 round-trip;
  AC16 via the untouched front-end path audited in T12; AC17 via T12's dependency grep.
- **Editor-only boundary:** no task touches `src/notation/*`, `src/song/*`, `src/view.js`,
  `src/render.php`, `src/block.json`, or the schema. The core's `data-*`/`id` hooks are read-only
  inputs (T2/T3). T9 deletions and the `ListControls`-consumer rewrites stay inside `src/editor/*`.
- **Design fidelity:** honors every Key Decision — selection by scoped query; editor-side
  `measureCoords` mirroring `buildLayoutModel`; `InspectorControls` panels (Song always;
  Note/Measure/Section on selection); `ToolsPanel` disclosure; lazy editor-side `newSong()`
  seeding (attribute stays `""` until first edit); canvas default-note add with hand-by-staff;
  reorder omitted (T9 drops `ListControls` and its move buttons); drill-down components removed;
  conformant-by-construction with the serialize-time guard; per-song note-name fidelity; WP-only
  deps.
- **No smuggled decisions:** the two genuinely open schema questions (zero sections / empty
  measures) are deferred to tests against the real validator rather than hard-coded — correct.

## Non-blocking refinements for the code-writers (no re-plan required)

1. **T4 — `ContextEditor` split wording is internally inconsistent (use the stated fallback).**
   `ContextEditor` is monolithic: it renders tempo + beatUnit + beats + beatType **and both**
   `HandConfigEditor`s as one flat fragment with internal tempo/timeSignature draft state. The
   plan's primary phrasing — "keep `ContextEditor` whole for the common fields **and** wrap the
   per-hand `HandConfigEditor`s in `ToolsPanelItem`s" — is not literally achievable, because the
   HandConfigEditors live *inside* `ContextEditor` and cannot also be wrapped separately while the
   whole `ContextEditor` is rendered. The plan already supplies the correct escape hatch ("if a
   finer split is needed, prefer composing the existing leaf controls — `HandConfigEditor`, the
   tempo/time-sig fields — directly"). T4's code-writer should take that path (compose the leaf
   controls), not the "whole `ContextEditor`" path, and must not alter `ContextEditor`'s emit
   contract. This is implementation guidance, not a spec/design conflict.

2. **T7 — the Remove-section guard resolves to "not required" (keep it test-driven).** The schema
   allows zero sections, so "Remove section disabled when it is the only section" is not mandated
   by conformance. The plan correctly leaves this for a test against the real validator and says
   "implement the guard accordingly." Result: the last-section guard is optional UX, not a
   conformance requirement — the code-writer should confirm via `validateSong` and not add it as a
   conformance safeguard. (A removed-only-section that leaves `{ sections: [] }` still validates,
   so the parent's selection-clear is the only strict requirement.)

Both are clarifications a competent code-writer would resolve correctly given the plan's own
fallbacks; neither blocks execution.

## Verdict

**Approved.** The plan is complete, correctly ordered, feasible against the live code, faithful to
the design doc, and boundary-respecting. The two refinements above are recorded for the
code-writers and require no changes to the plan.
