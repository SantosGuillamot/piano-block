# Doc Plan Review 1 — REJECTED

**Verdict:** Rejected.
**Artifact under review:** `.rp/pipelines/8-editor-ui/review-5/3-plan/doc-plan.md`

## Summary

The plan correctly identifies the central user-facing change (Add-section moved
off the structure tree *and* out of the Section panel, into the always-present
Song panel) and correctly targets the two load-bearing claims at README `:33`
(tree) and `:39` (Section panel), plus the Song-panel addition at `:41`. Its
"no doc change" calls for the button-styling and highlight-size polish, and for
`docs/song-format.md`, are sound and correctly justified — those changes are
reader-invisible and falsify nothing.

However, the plan **under-scopes**: it explicitly asserts that **no heading
outside `## Using the Piano block` makes an Add-section location claim** ("Do
not touch ... or any other heading — none make an Add-section location claim",
doc-plan `:97-99`), and that assertion is **false**. The live README carries the
same "add at every level from the tree" claim — now falsified by the
Add-section relocation — in **at least one, arguably two** places the plan rules
out. Under-scoping is the key risk for this mostly-invisible review, so this
must be corrected before approval.

## Must fix

### 1. (Blocking) README `:143` — file-layout `src/editor/` row claims the tree "hosts add ... at every level"

Under `## For contributors` → `### File layout`, the `src/editor/` row states the
structure tree:

> "... the toggleable Section → Measure → {Right hand, Left hand} → Note outline
> that is the **selection surface** and **hosts add/remove/duplicate at every
> level** plus the per-hand 'Add note' ..."

"Add ... at every level" lists **section** as a level. After this review the tree
hosts remove/duplicate at the section level but **no longer hosts add-section**
(code-plan Task 2 removes the tree footer button; design KD2). So "add ... at
every level" is now inaccurate for sections — the **exact same defect** the plan
already recognizes at README `:19` and addresses in its "Consistency sweep." The
trailing "plus the per-hand 'Add note'" stays true (Add-note stays in the tree).

This line is the structural mirror of `:19`, yet the plan's section-scope (`##
Using the Piano block` only) and its "no other heading" assertion exclude it. Add
a task item (or extend the consistency sweep) to give `:143` the **same minimal,
light touch** prescribed for `:19`: the tree still hosts add/remove/duplicate for
measures and notes and remove/duplicate for sections, but **adding a section is
in the Song panel**, not the tree. Keep it minimal and consistent with edits 1–3;
do not over-rewrite the row.

### 2. (Blocking) Correct the doc-plan's false "no other heading" assertion (doc-plan `:97-99`)

Regardless of the exact wording chosen for fix #1, the plan's own claim that no
heading outside `## Using the Piano block` carries an Add-section location claim
must be **removed or corrected**, because a future code-writer following the plan
literally would skip `:143` (and `:201`, below) on the plan's explicit say-so.
The section-scope must be widened to include the file-layout `src/editor/` row,
or the plan must explicitly enumerate `:143` (and decide `:201`) as in-scope.

### 3. (Should fix / decide explicitly) README `:201` — test paragraph claims "tree-driven add ... of sections"

Under `### The song format and validator`, the **Tests** paragraph says the e2e:

> "... selection now flows through the **structure tree** ... with **tree-driven
> add/remove/duplicate/rename of sections, measures, and notes** ..."

Per code-plan Task 2 step 9, the Add-section e2e step in `specs/editor.spec.js`
is **retargeted from the tree to the sidebar Song panel** (`treeAction(editor,
"Add section")` → a sidebar-scoped `getByRole("button", { name: "Add section"
})`). So "tree-driven add ... of sections" no longer matches what the test does
for the add-section case (remove/duplicate/rename of sections, and all of
measures/notes, remain tree-driven). The plan must either (a) add a light touch
here so the description matches the retargeted test, or (b) consciously rule it
in/out with a one-line rationale — but it cannot be left silently excluded under
the now-incorrect "no other heading" blanket. (Recommendation: a light touch,
e.g. note that the section *add* is exercised through the sidebar while
remove/duplicate/rename stay tree-driven, OR drop "add" from the section clause
without over-editing the dense paragraph.)

## What is already correct (keep as-is)

- The three primary edits (README `:33` tree claim, `:39` Section-panel claim,
  `:41` Song-panel addition) are correctly identified, scoped, and bounded, with
  Add-measure / per-hand Add-note correctly preserved as tree affordances and the
  "seed the first note" / Duplicate / "Reordering is not available" prose kept.
- The `:19` consistency sweep is correctly flagged as a possible light touch.
- The "no doc change" calls are genuinely not falsified: button styling
  (tertiary→secondary — README makes no invisible/hover claim); smaller highlight
  (README never states its size and the front end is byte-identical, AC4);
  `docs/song-format.md` (no format/schema change — grep confirms it has **zero**
  "add section" mentions). These are correct and should stay "no doc edit."
- Proportionality is otherwise good — no invented docs for the reader-invisible
  polish.

## Required for approval

Add coverage for README `:143` (blocking), correct the doc-plan's false "no
other heading outside `## Using the Piano block`" assertion / widen the
section-scope accordingly (blocking), and explicitly resolve README `:201`
(in or out, with rationale). Keep every addition a **minimal, light touch** in
the README's existing voice — this remains a small polish pass and must not grow
into a contributor-doc rewrite.
