# Review 9 — Docs review: APPROVED

**Scope reviewed:** the documentation batch from doc-plan tasks **D1–D5** (all editing
`README.md`). Diff under review: `git diff c7a25d1..HEAD -- README.md` (5 doc-writer
commits `b7ba534`..`0067373`), verified against the **shipped code** in the worktree
(`/Users/santosguillamot/Desktop/Code/SantosGuillamot/piano-block/.claude/worktrees/8-editor-ui`,
branch `worktree-8-editor-ui`, HEAD `0067373`). The code review already passed at HEAD.

**Verdict:** APPROVED. Every per-task acceptance bar (D1–D5) is met against the real
shipped files; no drift, no over-claim, correct no-ops, no workflow/artifact leakage, and
the docs batch touched only `README.md`.

> Path caveat (resolved, not a defect): the authoritative shipped tree is the **worktree**
> (HEAD `0067373`). The sibling main-repo checkout at `…/piano-block/` is on a detached
> HEAD at the base ref `c7a25d1` and shows the pre-M1 state; all code claims below were
> verified against the worktree files, not that checkout.

## Per-task verification (README claim ↔ shipped code)

### D1 — build-model SCSS description — PASS
- Shipped `src/style.scss` carries **only** `@font-face` (the `.wp-block-piano-block-piano
  { border/padding/color }` rule is gone); its header now reads "only the @font-face
  declaration … is loaded on the front end."
- `src/editor.scss` header agrees ("The front-end stylesheet (style.scss) carries only the
  @font-face declaration; all editor surface rules … live here").
- Emitted `build/style-index.css`: `@font-face` present (1), `.wp-block-piano-block-piano`
  rule absent, `border:1px dashed` 0, `#767676` 0.
- README `:131` (build-model) and the `src/style.scss` file-layout row (`:145`) both now say
  `style.scss` carries **only** `@font-face`; a grep finds **no** remaining "block-wrapper
  rules" / "border, padding, color" attribution to the front-end stylesheet. The
  `src/editor.scss` row (`:146`) and `src/index.js` row (`:141`) remain accurate
  (index.js imports both stylesheets — lines 4–5).

### D2 — inspector panel names (Advanced → domain titles) — PASS
Exact shipped disclosure titles match the README strings byte-for-byte:
- `NotePanel.js:157` → `"Note details"`
- `MeasurePanel.js:93` → `"Barlines & annotations"`
- `SectionPanel.js:129/133` → `"Section overrides"`
- `ContextEditor.js:195` (the Song panel's tiered disclosure) → `"Tempo & staves"`
README `:37–41` and the "Progressive disclosure" paragraph (`:45`) now name these four
titles; no remaining visible "Advanced" label in the inspector code, and no README passage
states multiple panels read "Advanced". (`grep "Advanced" README.md` → none.) The
disclosure UX itself is described as unchanged — only the titles changed.

### D3 — tree interaction behaviors + S6 deferred line — PASS
- Select-and-reveal: `StructureTree.js` `RowLabelCell` onClick (lines 151–153) calls
  `onSelect()` always, then `if (!isExpanded) onToggleExpanded(rowKey)` — collapsed click
  selects+reveals, expanded click selects only; collapse stays on the chevron / ArrowLeft.
  Hand-group rows toggle expansion only (never `onSelect`); notes are leaves. README `:29`
  describes exactly this.
- Section-delete confirmation at **both** entry points: tree section row `onRemove` →
  `setPendingRemoveSection` → root `ConfirmDialog` ("Remove this section and all its
  measures and notes?", lines 628–640); SectionPanel "Remove section" (line 156) →
  `ConfirmDialog` gated by `confirmOpen` (lines 160–172). Measure removal (`onRemoveMeasure`,
  line 446) and note removal (`onRemoveNote`, line 601) stay **immediate**. README `:33`
  and `:39` describe section=confirm, measure/note=immediate+undo.
- S6 deferred line kept and still true: README `:29` retains "a section/measure canvas
  indication is a later follow-up"; `editor.scss` confirms "A section/measure selection
  adds no canvas class." No canvas highlight is claimed as shipped.

### D4 — "Rename" in the per-row menu (section/measure only) — PASS
- Polish 3 shipped: `RowActionsMenu` renders a "Rename" `MenuItem` only when `onRename` is
  passed (lines 200–207). Section row passes `onRename` (line 365); measure row passes it
  (lines 434–436); the note-row menu (~line 563) passes **no** `onRename`.
- `onRename` calls `onSelect` for the row (selects it to reveal its Name field — not an
  inline editor). README `:19`, `:33`, and the contributor row `:143` add Rename, scoped
  "section and measure rows" with note rows excluded, and describe it as a shortcut to the
  panel's Name field (not an inline editor). All three README menu lists agree.

### D5 — validator note (`parseAndValidate` split) — PASS
- Shipped `src/song/validate.js`: named `parseAndValidate(rawString)` (line 340) parses
  **once**, returns `{ data, errors }`, parse failure → `["Invalid JSON: …"]`; default
  `validateSong(rawString)` (line 360) is `parseAndValidate(rawString).errors` — the
  `(raw) → string[]` contract is byte-preserved (including the `"Invalid JSON: …"` message).
- `src/edit.js` imports `parseAndValidate` and calls it once per change (no `safeParse`).
- `src/view.js` still imports the default `validateSong` and gates on `validateSong(raw)`
  (line 57) — **not** switched to `parseAndValidate`. README `:181` drops "single", keeps
  the `validateSong` contract intact, adds the named `parseAndValidate(rawString) → { data,
  errors }` and the single-parse rationale (editor only), and does **not** imply `view.js`
  switched. Stays at contributor altitude.

## Cross-cutting gates — PASS
- **No drift / no over-claim.** Front-end render-contract passages (`:5`, `:13`, `:74–84`,
  `:147`, `:148`) remain accurate; `src/render.php` and `src/view.js` were not changed in
  the run, so the published render is byte-identical — M1 removed only a CSS frame, and the
  README does not claim otherwise. The deferred canvas highlight is not described as shipped.
- **Correct no-ops.** `docs/song-format.md` and `AGENTS.md` are untouched across the whole
  run (`git diff --name-only c7a25d1..HEAD -- docs/song-format.md AGENTS.md` → empty).
  S1/S3/S4/S8/S10 and polish-5 correctly got no README edit; polish-5's false "no new
  dependencies" claim lives in the GitHub PR text (orchestrator), and the README already
  correctly states `@wordpress/icons` is a bundled runtime dependency (`:143`).
- **No workflow/artifact leakage.** No "review N", `S#`/`T#`/`M1`, AC numbers,
  tracking-issue numbers, or `.rp/` references in the README prose. (Only legitimate
  `docs/song-format.md` doc links.)
- **Scope.** The docs batch (5 doc-writer commits) changed **only `README.md`** (12 / 12);
  no code or test files were touched by D1–D5.
