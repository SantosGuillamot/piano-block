# Docs Review — Review 5 (D1): APPROVED

**Batch:** D1 of `3-plan/doc-plan.md` — relocate the README's "Add section"
documentation off the structure tree (and out of the Section panel) into the
always-present Song panel.
**Diff reviewed:** `git diff 9ea7b41..HEAD` — single doc commit `ff92dc0`
("Document Add section in the Song panel"), `README.md` only.
**Verdict:** APPROVED.

## Rationale

D1 is accurate against the shipped code, complete at every enumerated false
claim, and stays light-touch (README only) without leaking the reader-invisible
polish. The prior failure mode (under-scoping the Add-section claims) is fully
addressed: all six plan-enumerated lines are corrected and an independent grep
finds no surviving claim that puts section-adding in the tree or the Section
panel.

## Accuracy vs shipped code (verified)

- `src/editor/inspector/SongPanel.js` — gains `onAddSection` (prop `:124`, JSDoc
  `:121`) and an "Add section" `Button` wired to `onAddSection?.()` (`:279-280`).
  README `:41` now documents this. ✓
- `src/editor/inspector/SectionPanel.js` — only "Remove section"
  (`onRemoveSection`, `:140-142`); no Add-section button/prop. README `:39` now
  reads "**Remove section**" only. ✓
- `src/editor/StructureTree.js` — no Add-section footer; keeps "Add measure"
  (`:242`) and per-hand "Add note" (`:373`); no `onAddSection`. README `:33`/`:143`
  match. ✓
- `src/edit.js` — `onAddSection` threaded to `<SongPanel>` only (`:522`); absent
  from `<StructureTree>` (`:457-474`) and `<SectionPanel>` (`:511-516`). ✓

## Completeness (no under-scoping)

All six enumerated lines fixed:
- `:19` (intro) — "remove/duplicate for sections from that tree (adding a section
  lives in the sidebar's Song panel)".
- `:33` (Add/remove/duplicate paragraph) — "Adding a section lives in the block
  settings sidebar"; Add measure / per-hand Add note kept as tree affordances;
  "seed the first note" clause preserved; Duplicate and "Reordering is not
  available" prose intact.
- `:39` (Section panel bullet) — Add-section half removed, "Remove section" kept;
  Name + Advanced/overrides unchanged.
- `:41` (Song panel) — gains the Add-section control, reachable with nothing
  selected.
- `:143` (`### File layout` `src/editor/` row) — "add/remove/duplicate for
  measures and notes and remove/duplicate for sections (adding a section moved to
  the Song panel) plus the per-hand 'Add note'".
- `:201` (`### The song format and validator` Tests paragraph) — "tree-driven
  add/remove/duplicate/rename of measures and notes and remove/duplicate/rename of
  sections — adding a section is exercised through the sidebar **Song** panel".

Independent grep for "add section"/"every level"/"bottom of the tree"/"add … from
the tree" returns only the three already-corrected lines (`:19`, `:29`, `:33`);
none places section-adding in the tree or Section panel. `:5` (Status) and `:205`
(Forthcoming) make no Add-section *location* claim — correctly out of scope and
untouched.

## No drift / over-reach

- README only; `git diff 9ea7b41..HEAD --name-only` is `README.md` alone.
- No reader-invisible polish documented: zero occurrences of
  `secondary`/`tertiary`; no highlight-size/recolor/outline/hairline wording was
  introduced for the note highlight (the lone "hairline" hit at `:205` is the
  pre-existing crescendo/decrescendo hairpin, unrelated). Existing
  "selection highlighting"/"highlights the matching note" prose never
  characterizes the highlight's size, so it stays valid.
- `docs/song-format.md` untouched (`git diff` empty) — correct, no format/schema
  change.
- No pipeline references; no inline code-symbol docs.

## Style

The edits read in the README's existing voice and density; no broken Markdown
links or anchors introduced.
