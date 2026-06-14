# Code Review — Review 9 (APPROVED)

Adversarial full-batch review of `git diff c7a25d1..HEAD` (code-plan tasks T1–T13;
T12 has no source diff — it filed GitHub issue #35). Branch `worktree-8-editor-ui`,
issue #8 / PR #22. This is the single full-batch review (rejection iteration N = 1).

**Verdict: APPROVED.** Every task meets its code-plan Acceptance, all real-contract
proofs are present and exercise the real component / emitted artifact (not just the
mock), all guardrails pass at HEAD, every divergence is honored, and no do-not-touch
surface was altered. No material defects found.

## Guardrails (run at HEAD)

- `npm run test:unit` — **698 tests, 22 suites, all PASS**.
- `npm run build` — **compiled successfully** (webpack 5.107.2).
- `npm run check` — **Biome clean**, "Checked 67 files, no fixes applied".

## Real-contract proofs (the standing constraint — a green mock must not hide a real regression)

- **M1 — emitted CSS.** `build/style-index.css` (front end) contains **only**
  `@font-face{…url(fonts/pb-music.…woff2)…}` — grep for `border:1px dashed`, `#767676`,
  `padding:1em` returns nothing. `build/index.css` (editor) carries no wrapper border
  either, and the `.wp-block-piano-block-piano__list-row` rule is emitted at the
  stylesheet root (`>button:last-child{flex:0 0 auto}` + `>:first-child{min-width:8em}`),
  NOT nested under the wrapper block — so it reaches the sidebar DOM. Source
  `src/style.scss` carries only `@font-face`; both SCSS headers corrected (no "shared
  wrapper rules" claim; `editor.scss` has a single accurate header — polish item 6 folded).

- **S1 — visible-vs-accessible split on the real component.** New e2e test
  ("HandConfig controls carry bare visible labels and hand-scoped accessible names")
  drives the real `SelectControl`: `getByLabel("Right hand clef")` resolves via the
  aria-label on the real `<select>`, the visible `<label>` reads bare `^Clef$`, and a
  visible "Right hand clef" label element has count 0. Unit: the OPT-1 split is locked
  (`buttonByName "Right hand add alteration"` + `buttonByText "Add alteration"`), the 3
  `buttonByText` add-alteration sites updated, all accessible-name queries unchanged.
  `AddButton` gained the additive `aria-label` passthrough; `fieldLabel` now composes
  the aria-label (comment updated).

- **S4 — className hook + real alignment.** Top-level `__list-row` rule confirmed in the
  emitted `build/index.css`. Unit: `.wp-block-piano-block-piano__list-row` className
  asserted non-null in all three lists (pitches/annotations/contextControls). e2e: new
  test confirms the class reaches the sidebar DOM via the real `HStack` and the trash is
  the row's last child with `aria-label="Right hand remove alteration"`. `align-items:
  flex-end` correctly omitted. `alignment="flex-start"` added to the HandConfig alters
  row (the one that lacked it); the other two rows kept theirs.

- **S5 — select-and-reveal.** `RowLabelCell.onClick` = `onSelect()` always +
  `onToggleExpanded(rowKey)` only when `!isExpanded`; collapse stays on chevron/ArrowLeft;
  hand-group cell untouched. Unit: collapsed-section-label click asserts select +
  `toggle===["s0"]`; already-expanded asserts select + `toggle===[]`; a collapsed-measure
  case added; chevron-toggle cases green. e2e: the real label click on "Section 1" now
  reveals "Measure 1" directly (the reported regression fixed end to end). Both stale
  docblocks (`treeRow`, `expandRow`) updated to describe select-and-reveal — correction #3.

- **S7 — real controlled ConfirmDialog at both entry points.** Entry A (SectionPanel):
  controlled `ConfirmDialog`, `setConfirmOpen(false)` in both callbacks, button opens the
  dialog. Entry B (StructureTree): `pendingRemoveSection` state lifted to the tree root,
  ONE `ConfirmDialog` rendered after `<TreeGrid>` (survives the DropdownMenu unmount), the
  section call site captures the index, `RowActionsMenu` stays generic, measure (line 446)
  and note (line 602) removes stay immediate. Unit: both entry points drive accept (assert
  remove fires) + a new cancel case (assert it does NOT). Mock `ConfirmDialog` renders
  null when `!isOpen`, "OK"/"Cancel" when open. e2e: both the tree-row remove and a new
  SectionPanel-entry test drive the REAL dialog accept path end to end (poll
  `sections.length`). `__experimentalConfirmDialog` import in both files.

## Per-task acceptance (T1–T13)

- **T1 (M1 + polish 6)** — rule deleted, `@font-face` kept, headers reconciled, emitted-CSS
  proof above. ✓
- **T2 (S9 validate.js)** — `parseAndValidate` named export parses once; `validateSong`
  is a byte-identical thin wrapper over `.errors`; 3 new unit cases (conformant/invalid
  JSON/non-conformant) present; existing validator tests green; `view.js` untouched. ✓
- **T3 (S9 edit.js)** — single memo over `parseAndValidate(song)`; `safeParse` and the
  second `JSON.parse` deleted (grep-clean); routing unchanged; stale `NotePanel.removeEvent`
  comment corrected (polish item 1). ✓
- **T4 (S1)** — verified above. ✓
- **T5 (S4)** — verified above. ✓
- **T6 (S3)** — "Note name"→"Note", "Annotation text/placement/staff"→"Text/Placement/Staff";
  all old-name test queries updated (grep confirms none remain in src). ✓
- **T7 (S2 + S10)** — four distinct titles (Note details / Barlines & annotations / Section
  overrides / Tempo & staves); SectionPanel double wrapper collapsed (panel titled, single
  retained item); `resetAll={() => emitOverrides({})}` verified byte-identical to the old
  destructure; 3 pinned tiered-title assertions updated; no `[aria-label="Advanced"]`
  remains. S10 correctly unit-unobservable (mock swallows `resetAll`) — no spurious test. ✓
- **T8 (S5)** — verified above. ✓
- **T9 (mock)** — isOpen-respecting `ConfirmDialog`, exported under both names, additive. ✓
- **T10 (S7 A)** / **T11 (S7 B)** — verified above. ✓
- **T12 (S6)** — GitHub issue #35 OPEN with the **verbatim** title and body; no source
  highlight code; SongCanvas.js untouched. ✓
- **T13 (polish)** — stale comment fixed; single-child `<Flex>` dropped in SongPanel +
  InvalidState (unused `Flex` imports removed); InvalidState microcopy → "Edit as JSON";
  "Rename" `MenuItem` gated by optional `onRename` (present on section/measure, absent on
  notes), selects the row; unit-asserted. Polish item 5 correctly left as a doc-phase note. ✓

## Divergences honored

- **S6 deferred** — no canvas-highlight code (`data-measure`/`data-section`/`measureCoords`/
  `globalMeasureNumber` grep-clean in the source diff); issue #35 filed; the SongCanvas
  `.is-selected` follow-up comments in `editor.scss` intact.
- **S8 separate** — no `EditableList` anywhere; `ListControls.js` exports only `AddButton`;
  the three list bodies stay separate (only S4's alignment/className + S1's labelling touch them).

## Do-not-touch intact

`render.php`, `view.js`, `notation/svg.js`, `song/schema.js` untouched. The `view.js`
`validateSong` gate unchanged. `setSectionAt`/`setMeasureAt`/`setEventAt`,
`omitEmpty`/`omitFalsy` untouched. The TreeGrid keyboard model (`onExpandRow`/`onCollapseRow`
→ `onExpandCollapseRow`, `data-expansion-key`, aria-hidden chevron) unchanged. The
hand-group non-selecting label cell unchanged.

## Hygiene / scope

17 source files changed, all mapping to their planned tasks — no stray edits, no unrelated
reformatting. All new visible/aria strings go through `__`/`sprintf` with the `"piano-block"`
domain (both ConfirmDialog messages confirmed). e2e specs are consistent-by-construction with
the shipped behavior. Each commit message follows the convention.
