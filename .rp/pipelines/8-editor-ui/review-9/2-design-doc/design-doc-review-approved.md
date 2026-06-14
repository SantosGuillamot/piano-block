# Design Doc Review — APPROVED (review-9, iteration 1)

**Artifact reviewed:** `2-design-doc/design-doc.md`
**Verdict:** APPROVED.
**Reviewer role:** design-doc-reviewer (adversarial). Iteration N = 1.

The design is complete against the spec, sound and feasible against the **real**
live source (verified) and the **real** `@wordpress/components` contracts (verified
to the extent the externalized package permits, with the right e2e fallbacks where
it does not), faithful to the spec's deliberate divergences with rationale carried
inline, has the three research corrections folded in, carries an adequate
real-contract test strategy, and stays at design altitude. No material defects.

---

## What I verified (and how)

I read all four inputs in full (design-doc, spec, design-doc-research, prompt) and
then checked the load-bearing claims against the live tree at branch
`worktree-8-editor-ui` — the real source files, the real unit mock, the real test
files (line-by-line), `package.json`, and `block.json`. The mandate flagged S7 and
S1 as the historically-fragile spots; I scrutinized those hardest.

### Completeness vs spec — PASS

Every spec requirement has a design: **M1** (pure removal + folded comment
reconciliation), **S1–S10**, and the six optional-polish items are each present with
a concrete mechanism. **S6 is an explicit DEFER** with the **verbatim** tracking-issue
title and body reproduced in the design (`design-doc.md` S6 section) — byte-matching
the spec's S6 text; nothing is silently dropped. The "Explicitly fine as-is"
do-not-touch list is restated as a hard constraint (TreeGrid a11y, `__next40pxDefaultSize`
universality, load-bearing duplication, prior-review wins, the `view.js` `validateSong`
gate).

### Soundness / feasibility — PASS (the load-bearing decisions, scrutinized)

**S7 — tree-level ConfirmDialog state survives the DropdownMenu popover unmount
(the central decision).** Confirmed against `StructureTree.js`:
- `StructureTree` is genuinely a pure controlled component with **zero internal
  state** and **no `@wordpress/element` import** (source confirmed) — so adding
  `useState(null)` for `pendingRemoveSection` is its first state, as the design says.
- The section remove fires at `onRemove={() => onRemoveSection?.(sectionIndex)}`
  (`StructureTree.js:332`), inside `RowActionsMenu`'s `DropdownMenu` render-prop,
  where each `MenuItem` does `onAction?.(); onClose();` (`:206-211`) — the popover
  unmounts on close (confirmed). The design's fix changes that site to
  `setPendingRemoveSection(sectionIndex)`; `sectionIndex` is the `sections.forEach`
  param and is genuinely in lexical scope at that site (confirmed). The state lives
  in `StructureTree`, which renders BOTH the menu and the tree-root dialog, so
  `onClose()` tears down only the popover while `StructureTree` re-renders with the
  pending index set and the root `ConfirmDialog` reads it. This is the correct,
  minimal shape; OPTION B (per-row stateful wrapper) is correctly rejected because
  rows are inline `rows.push(<TreeGridRow…>)`, not components (confirmed).
- `RowActionsMenu` is correctly left generic/untouched (it is shared by
  section/measure/note rows — confirmed via the three call sites at `:322`, `:389`,
  `:524`); only the section call site is gated.
- "Only-one-open by construction" holds: the panel dialog (entry A, sidebar subtree)
  and the tree dialog (entry B, tree subtree) are reached by mutually-exclusive flows,
  each with its own local state. `@wordpress/components` is externalized (confirmed
  absent from `node_modules`), so the "multiple ConfirmDialog" caveat is a
  real-runtime-only concern, correctly punted to the controlled-mode invariant.
- Entry A (`SectionPanel`) is genuinely self-contained: `SectionPanel` holds no state
  today (confirmed) and gains a trivial local `useState` confirm flag.

**S1 — bare-label + `aria-label` reaches/overrides the accessible name on the REAL
components, not just the mock.** Verified the mechanism end to end:
- Real mock contract confirmed: `Button` accessible name = `ariaLabel ?? label`
  (mock `:55`); `SelectControl`/`NumberControl`/`TextControl`/`TextareaControl` set
  `"aria-label": label` then spread `...rest` (mock `:86-97`, `:128-137`, `:146-160`,
  `:169-182`) — a separately-passed `aria-label` lands in `...rest`, is spread last,
  and overrides the label-derived name. The design does NOT rest the real-component
  claim on the mock: it explicitly routes a real-component/e2e proof (visible label =
  bare "Clef" while accessible name stays "Right hand clef") to verify the override on
  the real `<select>`/`<input>`/`Button`. The researcher's Gutenberg-trunk
  `{...restProps}`-after-named-`label` finding is the cited basis; this is the honest,
  non-mock-only design.
- `AddButton` passthrough is feasible and additive: today `AddButton({onClick,label})`
  renders `<Button …>{label}</Button>` with no `aria-label` (`ListControls.js:25-36`,
  confirmed). Adding an optional `aria-label`/`ariaLabel` forwarded to the inner
  `Button` is a small additive prop; the two other callers (PitchList/AnnotationList)
  pass none, so their names are unchanged.

**S4 — CSS as a top-level selector (inspector renders in the sidebar, outside the
block wrapper).** Confirmed `editor.scss` nests `&__workspace`/`&__tree`/`&__canvas`
inside `.wp-block-piano-block-piano { … }` (`editor.scss:8`), which would NOT match
the `InspectorControls` sidebar DOM. The design correctly mandates a **stylesheet-root**
`.wp-block-piano-block-piano__list-row { … }` selector, with the `className` hook
passed on each row `HStack` (the `HStack` mock spreads `...rest` so `className` reaches
the `<div>`; mock `:203-209` confirmed) and `alignment="flex-start"` added to the one
row that lacks it (`HandConfigEditor.js:158`, confirmed — `PitchList`/`AnnotationList`
already pass it). Exact `min-width`/child selectors are correctly deferred to code.

**S9 — `parseAndValidate`/`validateSong` byte-identical wrapper.** Confirmed
`validate.js`'s real default export is
`try { JSON.parse } catch { return ["Invalid JSON: " + error.message] }; validateValue(…); return errors` (`:332-343`). The design's `parseAndValidate` reproduces that
parse-failure string byte-for-byte (same template, same `error.message`) and
re-expresses the default export as `parseAndValidate(raw).errors`, so the `(raw) →
string[]` contract and the `view.js` gate are untouched. The `edit.js` switch (delete
`safeParse` at `:51-57`, collapse the two `useMemo`s keyed on the single
`parseAndValidate(song)` result, preserve the empty-string `newSong()` seeding) is
sound and matches the real `edit.js` shape (confirmed `:51-57`, `:140-158`).

**M1 — removal scope.** Confirmed the leaked rule at `style.scss:25-29`, the
`@font-face` to keep at `:17-23`, `block.json:18` loading `style-index.css` as
`"style"` (front-end + editor), and the two stale headers (`style.scss:1-5`,
`editor.scss:1-6`). The design's pure-removal + one-accurate-header reconciliation
(folding polish item 6) is correct. Build-output verification (`build/style-index.css`
no longer carries the rule; `build/index.css` unaffected) is the right emitted-artifact
check, not source-only.

### Faithfulness — PASS

The deliberate divergences from the review's literal wording are honored WITH
rationale carried inline: **S6 = DEFER** (verbatim issue), **S8 = keep three list
bodies separate** (no `EditableList`; net ~+13 LOC, rule-of-three unmet,
`HandConfigEditor` storage-transform misfit, review-8 trigger still unmet),
**S1 = OPT-1** bare-label + aria, **S7 = section-only**. No scope creep: S1's flat-layout
per-hand heading is correctly OMITTED (optional; a11y carried by `aria-label`s), the
optional `align-items: flex-end` is correctly omitted-unless-residual, and the
`view.js` gate is explicitly left on `validateSong`.

### Three research corrections folded in — PASS

1. **S1 real unit churn = 3 `buttonByText` sites.** Verified: exactly three
   `buttonByText(container, "Right hand add alteration")` calls at
   `contextControls.test.js:347,371,385`. Verified the helper semantics that make this
   correct: `buttonByText` matches `button.textContent` (`:66-70`) while `fieldByName`
   (`:54-56`) and `buttonByName` (`:59-63`) match `aria-label`. Under OPT-1 the
   AddButton's visible text becomes "Add alteration" (so the three `buttonByText` sites
   churn) while every accessible-name query stays green — exactly as the design states.
2. **S10 swap unit-unobservable.** Verified: the `ToolsPanel` mock swallows `resetAll`
   (`:304-310`), and `SectionPanel.test.js:229-237` clears overrides via a control's
   `onChange`, not `resetAll`; no test drives `resetAll` (confirmed zero occurrences).
   The "existing reset test stays green" is vacuously true; the byte-identical swap
   needs no test update. Correct.
3. **S5 two stale e2e docblocks.** Verified both the `treeRow` docblock
   (`editor.spec.js:290-293`) and the `expandRow` docblock (`:322-327`) assert the
   label is select-only / "no longer toggles/expands"; both go stale for
   section/measure rows under S5 and the design flags both for update. Correct.

### Test-strategy adequacy ("tests-green ≠ real-broken") — PASS

Real-component / emitted-artifact verification is required exactly where a fix rides a
real contract: **M1** (build-output grep), **S1** (e2e visible-vs-accessible-name proof
on the real `<select>`/`<input>`/`Button`), **S4** (unit asserts the className hook;
e2e proves the real alignment since the mock swallows `alignment`), **S5** (unit
collapsed→select+expand / expanded→select-only; e2e real label-click reveal),
**S7** (unit drives the mock dialog accept/cancel; e2e drives the REAL `ConfirmDialog`
section-remove end to end). Mock-level-only is reserved for genuinely-sufficient pure
items (**S2** title renames via the `ToolsPanel` `label`→`aria-label` exposure, **S3**
label renames, **S9** pure-function shapes, **S10** identical emission, string/comment
polish). The S7 test sites are all verified accurate against the live tree, including
that `Edit.test.js:461` routes through entry A because `Edit` renders the **real**
`SectionPanel` (no `jest.mock` of it — confirmed), and the measure/note remove tests
that must stay untouched (`StructureTree.test.js:476,527`; `NotePanel.test.js:367,401`;
`MeasurePanel.test.js:253,269`; `Edit.test.js:478,511`) all exist as cited.

### Altitude & standalone — PASS

The doc is architecture + interfaces + state-ownership + test strategy + cross-item
sequencing, NOT a task-by-task plan: it gives component/API shapes and the load-bearing
decisions while explicitly deferring exact coordinates, exact CSS `min-width`/child
selectors, and exact i18n string finalization to the code/plan phase. It is
self-contained (a reader needs only this file). File/line references are correctly
framed as evidence that will shift.

---

## Citation accuracy (independent sweep)

A full sweep of the design's test/source line cites (S2, S3, S5, S7, S9, S10, polish)
against the live tree found **16 of 17 accurate**; the one "off" item (#17,
`edit.js:305-308`) is itself the stale `NotePanel.removeEvent` comment that Optional
polish item 1 exists to fix — i.e. the design correctly identifies it as stale. The
`validateSong` "~15 test files" claim is corroborated (70 call sites across the suite).

## Minor, non-blocking observations (for the plan/code phase, NOT defects)

- **S7 / `StructureTree.test.js:446`** is a combined test (clicks Section 2 "Remove"
  AND Section 1 "Duplicate", asserting both `removeSection===[1]` and
  `duplicateSection===[0]`). The design's "click the dialog's confirm before asserting
  `removeSection===[1]`" is correct but the plan should note the confirm-click must be
  inserted for the Remove path only, leaving the Duplicate assertion intact. Design
  altitude is fine; this is a code-phase precision note.
- **S1 two-i18n-strings-per-control** (a title-cased visible `label` plus a lower-case
  fragment fed to `fieldLabel`) is the cleanest honest split, as the design argues;
  the plan should ensure the `fieldLabel` fragment stays lower-case so "Right hand
  clef" reads naturally while the visible label is title-cased.

These are guidance, not blocking issues.

---

**APPROVED.** Proceed to the plan phase.
