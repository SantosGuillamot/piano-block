# Spec review — review-9 — APPROVED

**Verdict: APPROVED.** Iteration N = 1. Reviewed `1-spec/spec.md` against the
phase-0 intent (`0-prompt/prompt.md`) and the settled decisions in
`1-spec/spec-research.md`, and cross-checked the load-bearing claims against the
live worktree. The spec is complete, faithful, testable, free of scope creep /
design, and standalone. No material defects.

## What I verified

### Completeness — PASS
Every actionable item from the owner's "everything actionable" scope is covered,
with a Requirements subsection AND a matching Acceptance Criteria block for each:

- **M1** — full removal of the `.wp-block-piano-block-piano` border/padding/color
  rule, `@font-face` kept, both `style.scss`/`editor.scss` stale headers
  reconciled, and a **build-output** acceptance criterion (emitted
  `build/style-index.css` no longer carries the wrapper rule after `npm run build`;
  front-end render unframed).
- **S1–S10** — all ten present and individually specified.
- **S6** — present as an explicit **DEFER**, not missing: a dedicated requirement
  section states "no canvas highlighting is added," and the exact tracking-issue
  **Title + Body** are embedded verbatim for the code phase to file. Acceptance
  pins "no highlighting added" + "issue filed with the exact text."
- **Optional polish** — all six items present in both Requirements and Acceptance
  (stale `NotePanel.removeEvent` comment, single-child `<Flex>` wrappers, "Rename"
  `MenuItem`, `InvalidState` microcopy, the PR-prose `@wordpress/icons` line, the
  `editor.scss` duplicate header).

Nothing is silently dropped.

### Faithfulness — PASS
The spec matches the intent and the research's settled decisions, including the
deliberate divergences from the review's literal wording — each carrying its
rationale:

- A dedicated "Why several items diverge from the review's literal wording"
  section records all four delegated judgment calls.
- **S6 = DEFER** (not built) — rationale: owner singled it out as the deferrable
  item; the "where am I?" gap is partly closed by `aria-current` + kind-titled
  panels (strengthened by S5); net-new canvas plumbing spends risk on the one item
  marked safe to defer. Faithful to the intent's S6 nuance.
- **S8 = keep three list bodies SEPARATE, no `EditableList`** — rationale: net
  ~+13 LOC (no reduction), rule-of-three unmet (only `PitchList`/`AnnotationList`
  are clean callers), `HandConfigEditor`'s alters body genuinely doesn't fit, and
  review-8's still-unmet "fourth list" trigger. This is exactly the weighing the
  review delegated ("net simplification vs. distinct invariants"), made on the
  merits and recorded — not silently extracted nor silently dropped.
- **S1** (bare visible label + hand-scoped `aria-label`) and **S7** (section-level
  ConfirmDialog only) likewise carry rationale and match the intent verbatim
  ("push hand scope to aria-label/help"; "at minimum confirm the section-level
  remove").
- The owner's full owner-approved scope ("M1 + S1–S10 + optional polish") is
  stated, and the review's "Explicitly fine as-is" do-not-touch list is reproduced
  as explicit **Out of Scope** (TreeGrid a11y, `__next40pxDefaultSize`,
  load-bearing duplication, prior-review wins, byte-identical front-end render).

### Testability — PASS
Every requirement has a concrete, verifiable acceptance criterion, and the
standing "tests-green incompatible with real-component-broken" constraint is
honored where a fix rides a real contract or a build-output fact:

- **M1** verifies the **emitted** `build/style-index.css` after `npm run build`
  (not source-only).
- **S1** requires a real-component/e2e check that the **visible** label reads the
  bare form ("Clef") while the **accessible name** stays hand-scoped ("Right hand
  clef") — the one place the `aria-label` override must be proven on the real
  `<select>`/`<input>`/`Button`, not just the mock.
- **S4** requires real-component/e2e visual verification plus a className-hook unit
  assertion (the mock swallows `alignment`).
- **S7** requires the e2e suite to drive the real `ConfirmDialog` confirm end to
  end, with the mock stand-in mirroring the accept/cancel contract.

I independently confirmed against the live tree the mock facts these criteria
depend on: `Button` maps `aria-label: ariaLabel ?? label`; `SelectControl`/
`NumberControl` set `"aria-label": label` then spread `...rest` (so a passed
`aria-label` overrides); `HStack` swallows `alignment`; the mock has **no**
`ConfirmDialog` (so S7's mock-extension requirement is real, not free). I also
confirmed the structural facts driving the divergences: `RowActionsMenu` is reused
at three call sites (section `:332`, measure `:406`, note `:561`) — so S7's
"gate the section call site, not the shared component, lift the dialog outside the
`DropdownMenu`" is correct; `ListControls.js` exports only `AddButton` (S8/S1);
`validateSong` is the default export with the `"Invalid JSON: <msg>"` message and
`edit.js` does the `safeParse` second parse (S9); all four "Advanced" titles exist
(S2); `<g data-measure>` exists and no `data-section` (S6 feasibility note).

### No scope creep / no design — PASS
The spec stays at WHAT + acceptance. Where it names a mechanism
(`__experimentalConfirmDialog`, the optional `fieldset`+`legend` heading), it marks
exact wording/architecture as a design-phase choice and the heading as optional
sighted-UX polish. It introduces no requirement beyond the intent + research.

### Standalone — PASS
Overview, Requirements, Out of Scope, and a consolidated Acceptance Criteria
section let a later phase build and verify from this document alone.

## Non-blocking observations (did not affect the verdict)
- The spec cites branch tip `c7a25d1`, while the live tip is `60e2db7`. This is
  benign: `60e2db7`/`c9884a4` are this run's own spec/prompt artifact commits with
  no source change, so the `c7a25d1` line references remain valid — and the spec
  already instructs later phases to re-confirm exact coordinates as fixes land.
- The research's tangential note about the stale `edit.js` "style.scss lays them
  out as a flex row" comment is not carried into M1 — correctly, since research
  itself marked it "out of strict M1 scope, not a blocker."

Neither rises to a material defect.
