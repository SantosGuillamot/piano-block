# Doc Plan Review — Review 11 — APPROVED

Reviewer: doc-plan-reviewer. Iteration 1. Verdict: **APPROVE**.

Plan reviewed: `3-plan/doc-plan.md` (commit `4215efe`), three tasks DT1, DT2, DT3.

## Verdict basis

Read in full: spec (`1-spec/spec.md`), design doc (`2-design-doc/design-doc.md`),
code plan (`3-plan/code-plan.md`, B1–B5 / T1–T10), and the live doc surface
(`README.md`, `docs/song-format.md`, `AGENTS.md`). Verified each no-op against the
live files rather than trusting the plan's prose.

### COMPLETE + DRIFT-RESISTANT

Every shipped behavior change in B1–B5 that has a doc surface is covered:

- **B4 (first-run auto-expand) → DT1 — real README update, scope correct.** The
  README "Build the song in the visual editor" section promises at `:27` "nothing
  to press first — you start adding notes straight away" and at `:33` that the
  per-hand "Add note" button "is how you seed the first note of an otherwise empty
  measure," but it never states that a freshly inserted block opens with the first
  section + first measure already expanded so those buttons are reachable. Confirmed
  by grep: no existing "pre-expand / already expanded / first section / first
  measure" statement exists in the README. The README genuinely needs DT1. DT1's
  scope is accurate to the shipped two-key seed (code-plan T3 / design §5.2): only
  the first section + first measure pre-expanded, no claim that hand rows or other
  rows auto-expand, no "Start a song" CTA, fold into existing `:27`/`:33` rather
  than a new paragraph. No over-claim, no contradiction with the existing
  "open by default" (`:29`) / "expandable and collapsible" (`:29`) facts.
- **B1, B2, B3, B5** have no shipped-doc surface (below) — correctly routed to
  verified-no-op tasks DT2/DT3.

### VERIFIED NO-OPS ARE REAL (checked against live files myself)

- **DT2 (B1, test-only) — real no-op.** `grep -niE 'confirm|dialog|prompt|\bOK\b'`
  over `README.md`, `docs/song-format.md`, `AGENTS.md` surfaces ONLY the
  already-correct immediate/undo-reversible statements: `README.md:33`
  ("Remove happens immediately at every row level (no prompt) … any removal —
  a section included — can be reversed with the editor's normal undo") and
  `README.md:39` ("discards the section and everything in it directly (no prompt),
  recoverable with the editor's normal undo"). No stale "confirm dialog" /
  "click OK to confirm" / "real dialog" claim anywhere in shipped docs. B1 is a
  test-only drift fix (code-plan T4); the user-facing remove behavior is unchanged
  and already documented correctly. No-op valid.
- **DT3 (B2/B3/B5, internal-source-only) — real no-op.** Confirmed the touched
  prose lives only in internal source: stale SCSS at `src/editor.scss:7` (on-canvas
  add affordances), `:21` (`:first-child` rationale), `:106` (canvas wrapper);
  dead default arg at `src/edit.js:248`; `new Set()` initializer at `src/edit.js:100`.
  The only doc-surface mentions are the generic File-layout rows, and both stay
  accurate: `src/editor.scss` row (`README.md:146`, "the workspace layout, structure
  tree, canvas, and selection highlight" — cites neither the `:first-child`
  rationale nor any `min-width` value) and `src/edit.js` row (`README.md:142`,
  mentions `onAddMeasure` and "a single expansion Set" but documents no parameter
  defaults and no seed contents). Nothing drifts. No-op valid.

### ALIGNED + CLEAN (AGENTS.md)

`grep -niE '\.rp/|AC-B|Req#|\bT[0-9]+\b|review [0-9]+|4f3ed90|S5|S7|entry [AB]|B[0-9]\b'`
over the three shipped docs hits only `AGENTS.md:5` — which is the rule's own
definition, not a leak. No `.rp/` / `AC#` / `T#` / commit sha / phase token /
`B#` finding label reaches any shipped doc. The plan's own shipped-artifact-rule
section is correct; the `B1`..`B5` labels appear only in the plan for traceability
and never instructed into the README. Audience / Files / Sections-scope for all
three tasks are sane.

## Coverage

| Finding | Task | Outcome | Verified |
| --- | --- | --- | --- |
| B1 (section-remove e2e drift, test-only) | DT2 | verified-no-op | README `:33`/`:39` already correct |
| B2 (stale SCSS prose) | DT3 | verified-no-op | internal `src/editor.scss` only |
| B3 (`:first-child` comment) | DT3 | verified-no-op | internal `src/editor.scss` only |
| B4 (first-run auto-expand) | DT1 | real README update | README lacks the pre-expand statement |
| B5 (cheap simplifications) | DT3 | verified-no-op | internal `src/edit.js` / `SectionPanel.js` only |

Plan is complete, drift-resistant, its no-ops are genuinely verified against the
live docs, and it carries no pipeline-token leak. Approved.
