# Code Review — Review 1 (Canvas-first editor UI): APPROVED

**Verdict:** Approved
**Batch:** T1–T12 (`code-plan.md`)
**Diff reviewed:** `git diff 3f87bcd..HEAD` — commits `5e33e6c`(T1) → `37561c2`(T12).
**Reviewer:** code-reviewer

## Summary

The batch faithfully transforms the on-canvas drill-down editor into the canvas-first,
Gutenberg-native editor the design and spec require. Every requirement (1–19) and acceptance
criterion (AC1–AC17) is realized in code and exercised by tests. The editor-only boundary holds
airtight, dependencies stay WordPress-only, and conformant-by-construction is enforced and asserted.
All gating checks pass.

## Gating checks

| Check | Result |
|---|---|
| `npm run test:unit` | **525 passed / 19 suites** (green) |
| `npm run lint` (biome) | **0 warnings** — "Checked 60 files … No fixes applied" |
| `npm run build` | **clean** — webpack compiled successfully |
| Boundary `git diff --name-only 3f87bcd..HEAD -- src/notation src/song src/view.js src/render.php src/block.json` | **empty** (Req 18 airtight) |
| `package.json` runtime deps | **unchanged** (Req 19 / AC17) |
| New-code imports | only `@wordpress/element`, `@wordpress/components`, `@wordpress/block-editor`, `@wordpress/i18n` + internal modules |

## Spec / AC coverage (verified against code + tests)

- **AC1 / Req 1, 2** — `Edit` defaults to the visual branch; `SongCanvas` is the single canvas (no
  separate preview); JSON behind the unchanged toolbar toggle. Live re-render via the draw effect's
  `song`/`selection` deps. Unit + e2e ("the canvas-first visual editor is the default surface").
- **AC2 / Req 10** — Lazy editor-side `newSong()` seed; attribute stays `""` until first edit
  (`Edit.test.js` "seeds an empty song … attribute stays empty", `calls` length 0; e2e "seeds an
  empty staff yet stores nothing").
- **AC3 / Req 3** — Canvas-first selection via scoped `[data-measure][data-hand][data-event-index]`
  hit-test; `selection.js` mirrors `buildLayoutModel`'s sections→measures walk, **pinned by rendering
  the real core** in `selection.test.js` (not a hand-restated expectation). `SongCanvas.test.js`
  covers note, rest, empty-area-clear, cross-section flatten, Enter/Space.
- **AC4 / Req 4** — Note/Measure/Section panels bound to the resolved selection (`edit.js`
  236–260); e2e "selecting a note reveals the Note, Measure and Section panels".
- **AC5 / Req 5, 6** — `SongPanel` always; selection-dependent panels only when `resolvedSelection`
  is non-null. Unit "shows only the Song panel when nothing is selected" + e2e.
- **AC6 / AC7 / Req 8** — Full model coverage across the four panels; every committed song asserted
  `validateSong([])`. `SongPanel` reaches metadata + `defaults` (tempo/timeSig common, beatUnit +
  per-hand config disclosed); `NotePanel` reaches type/duration/pitches + dots/dynamic/4 spans/
  annotations; `MeasurePanel` barlines + standalone annotations; `SectionPanel` overrides.
- **AC8 / Req 9** — Canvas add-note with hand = staff (`onAddNote(si, mi, hand)`), insert-after-
  selected logic in `edit.js`; unit + e2e "adding a note on the canvas stores it in the chosen hand"
  (asserts `leftHand` undefined when adding right).
- **AC9 / Req 11** — Add/remove at every level: add-note + add-measure on canvas; add/remove section,
  remove measure, remove note, chord pitch add/remove in panels. Remove-note drops the emptied hand;
  remove-measure tolerates `measures: []`; remove-section needs no min-one guard (root requires only
  `sections`, no `minItems` — confirmed in `schema.js`). Reorder omitted: `ListControls` move bank,
  `moveItem`, and `moveRow` all removed; consumers (`PitchList`/`AnnotationList`/`HandConfigEditor`)
  use inline remove buttons; no dangling references.
- **AC10 / Req 7** — `ToolsPanel`/`ToolsPanelItem` progressive disclosure in every panel with correct
  `hasValue`/`onDeselect` omit-when-unset semantics; `resetAll` strips all disclosed members.
- **AC11 / AC13 / Req 13, 16** — Every visual edit funnels through `commit` → `commitSong`'s
  serialize-time `validateSong` guard; non-empty invalid routes to `InvalidState` (no canvas/panels).
- **AC12 / AC15 / Req 2, 15, 17** — JSON branch byte-for-byte unchanged: stores raw verbatim even
  when invalid, non-blocking notice; round-trip and stale-selection-clearing covered.
- **AC14 / Req 14** — `inferNoteNameSystem`/`noteNameOptions` reused; new-note type-switch seeds the
  first name in the per-song system; e2e "round-trip preserves Spanish note names".
- **AC16 / Req 18** — Front-end untouched; follows from the empty boundary diff.
- **AC17 / Req 19** — Audited above.

## Extra-scrutiny files (T1 mocks, T2 selection.js, T3 SongCanvas.js)

- **T1 mocks** — Additive only; `InspectorControls`, `PanelBody`, `ToggleControl`, the
  `ToolsPanel`/`ToolsPanelItem` family (rendering children unconditionally, as specified), and `Icon`
  added with faithful prop honoring. Existing suites unaffected (525 green).
- **T2 `selection.js`** — Correct: `measureCoords` walks sections-outer/measures-inner; the
  invariant test renders the real `buildLayoutModel`→`renderSvg` and pins `data-measure` order
  position-for-position; `globalMeasureNumber` inverse, `resolveSelection` stale handling (every
  level), and `selectionQuery` scoping all covered (incl. a real-SVG "resolves to exactly one node"
  test).
- **T3 `SongCanvas.js`** — Correct render-path reuse (font gate, px→sp, rAF one-way `ResizeObserver`,
  try/catch clear-on-failure); native click/keydown listeners `stopPropagation` so the block stays
  selected (design risk addressed); decoration runs post-draw so it never targets a not-yet-rendered
  node. 14-case unit suite covers all behaviors.

## e2e (`specs/editor.spec.js`)

The live suite was **not** run (wp-env port conflict with the original repo, per the dispatch). The
spec was statically verified against real selectors: locators match the classes/labels `SongCanvas`
and the panels emit (`.wp-block-piano-block-piano__canvas`, `data-kind="note"`, the `sprintf`
add-note labels, PanelBody titles, `MetadataEditor`'s "Title", `InvalidState`'s "Edit as JSON"), the
toolbar-vs-canvas "Edit as JSON" collision is correctly disambiguated (`clickBlockToolbarButton` vs
`editor.canvas.getByRole`), and the sidebar is opened on `page` (not the canvas iframe). The retained
JSON-mode/round-trip coverage is behaviorally identical. **Assessment:** acceptable for this gate —
the integrated select→panels and add-note flows are also covered at the unit level by the `Edit.test.js`
rewrite (which drives a real click on the rendered note group through the live `SongCanvas` hit-test),
so the canvas-first contract is not solely dependent on the unrun e2e run. Running the e2e suite in CI
remains a recommended follow-up but is not a blocker.

## Non-blocking nits (no re-dispatch required)

1. `src/editor/__tests__/selection.test.js` lines 109–113 — a tautological `expect(measure).toBe(SONG…same expression…)`
   self-comparison; the meaningful pin is the `measureCoords` equality + the `toHaveLength` count
   check, so coverage is intact. Cosmetic.
2. `src/editor/accessibleName.js` line 4 — doc-comment still references the removed `SongPreview`.
   It is a comment in an out-of-scope, unchanged file (not a code reference); harmless. Worth a
   one-line touch-up in the Docs phase.

## Verdict

**Approved.** No task re-dispatch required.
