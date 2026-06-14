# Code review — Review 4 (Structure-tree polish), batch T1–T7

**Verdict: APPROVED**

Reviewed adversarially against `3-plan/code-plan.md`, `2-design-doc/design-doc.md`,
and `1-spec/spec.md`. Diff base `a98c448..HEAD` (`ac45c82`), commits `af768df`(T1)
→ `ac45c82`(T7). Branch verified live as `worktree-8-editor-ui`.

## Gates

- `npm run test:unit` — **624 passed / 20 suites** (matches the expected
  629-baseline − several T4 removals + 2 T7 additions; suite count stays 20).
- `npm run lint` (biome) — clean, 63 files checked, no findings.
- No `package.json` / `package-lock.json` diff → **no new dependency** (AC9).
- e2e (`specs/editor.spec.js`) was NOT run live (wp-env port conflict, as flagged);
  assessed by read-through — see below.

## Boundary (AC8 / KD8) — PASS

`git diff --name-only a98c448..HEAD` touches ONLY editor files: `edit.js`,
`StructureTree.js`, `SongCanvas.js`, `selection.js`, `style.scss`, their unit tests,
and `specs/editor.spec.js`. NO `src/song/*`, `src/notation/*` (incl. `svg.js`),
`src/view.js`, or `src/render.php`. Front-end render is structurally untouched; SVG
emit byte-identical.

## The crux — T7 collapse fix (Req 7 / AC7, Option B) — PASS

- `StructureTree.js:146-149` is exactly the veto form:
  `isSelectionAncestor(path, selection) ? !(collapsedOverride?.has(path) ?? false)
  : (expandedPaths?.has(path) ?? false)`. The bare `|| isSelectionAncestor` OR is
  gone; `isSelectionAncestor` is still called **live** (not snapshotted).
- No `useEffect` in `edit.js` (imports only `useMemo, useState`); no Set seeded from
  the selection.
- `collapsedOverride` Set + `onToggleCollapsedOverride` live in `edit.js:110-141`
  (same immutable add/delete shape as `expandedPaths`), threaded into `StructureTree`
  at `edit.js:463-464`.
- The toggle dispatcher `toggleRow` (`StructureTree.js:155-158`) routes
  ancestor → `onToggleCollapsedOverride`, non-ancestor → `onToggleExpanded`; the
  section/measure rows keep their accompanying `onSelect`.
- **Both halves of AC7 are tested** (`StructureTree.test.js`):
  - `:444-483` — clicking the ancestor "Measure 1" routes to `toggleOverride`
    (`["s0/m0"]`) and NOT `toggle`; a re-render with `s0/m0` in `collapsedOverride`
    hides the hand rows + leaf while the ancestor row stays visible (manual collapse
    beats auto-reveal).
  - `:485-504` — a different leaf with an EMPTY override still auto-reveals its
    ancestors (no over-suppression regression).
  - The existing auto-expand test (`:422-442`) and the non-ancestor toggle test
    (`:413-420`) are retained and green.
- Real-component integration: `Edit.test.js` does NOT mock `@wordpress/components`,
  so `selectLoneNote` drills through the real TreeGrid + the new routing. Traced:
  each drill-down row is never an ancestor of the *current* selection at click time,
  so it routes to `onToggleExpanded` as before — the drill-down still works.

## Per-task verification

- **T1** — `edit.js:108` `useState(true)`; comment (`:98-107`) rewritten as
  open-by-default/editor-only/not-persisted; no `useEffect` re-forces it.
  `Edit.test.js:515-540` asserts the full AC1 cycle (present on mount → close →
  reopen); `selectLoneNote` and the selection tests dropped their leading Structure
  click. e2e `openStructureTree` repurposed to `assertStructureTreeOpen` and all five
  call sites fixed; doc-comments updated.
- **T2** — each of the four label `Button`s carries `style={{ "--pb-tree-depth": N }}`
  with N = level−1 (section 0, measure 1, hand 2, note 3); the action-button cells do
  NOT. One SCSS rule (`style.scss:64-66`) on `&-label` reads the var with a `0`
  default. The selector matches the element that carries the var.
- **T3** — every per-row action `Button` (remove/duplicate section, add measure,
  remove/duplicate measure, add note, remove/duplicate note) now has
  `variant="tertiary"`; removes keep `isDestructive`; the trailing "Add section"
  stays `variant="secondary"`.
- **T4** — `decorateSelection` (`SongCanvas.js:96-120`) early-returns on
  `selection?.kind !== "event"`; section/measure branches gone; event branch verbatim.
  `measureNumbersForSection` and `scrollGroupIntoView`/`scrollIntoView` fully pruned
  (grep across `src`/`specs` finds zero leftovers, incl. no `is-active`). `style.scss`
  `.is-active-*` rules + comment removed; `.is-selected` kept. Unit + e2e highlight
  assertions removed; panel-reveal half retained; e2e test renamed.
- **T5** — `.is-selected` is `outline: 1px solid #007cba; outline-offset: 1px;`
  (`style.scss:92-95`); admin blue kept; comment updated.
- **T6** — `InspectorControls` JSX reordered Note → Measure → Section → Song
  (`edit.js:492-520`) with every gate verbatim (`SongPanel` moved first→last);
  gating comment rewritten. `Edit.test.js` asserts presence by kind, all green.
- **T7** — see crux above.

## Rationale

Every spec Requirement (1–9) and Acceptance Criterion (AC1–AC9) is realized in code
and pinned by tests. The collapse fix is implemented as the design's Option B exactly
— pure-render veto, live `isSelectionAncestor`, no effect, two-Set owner in `edit.js`,
routing in `StructureTree` — and both directions of AC7 are tested, including the real
TreeGrid integration in `Edit.test.js`. The boundary holds (editor-only, no front-end
file, no new dependency). Dead code (`measureNumbersForSection`, `scrollGroupIntoView`)
is fully pruned with no leftover references, and all stale doc-comments are updated.
Unit (624/20) and lint gates are green. The e2e changes, read through, correctly
reflect open-by-default and the removed highlight while keeping the panel-reveal
coverage; no e2e behavior is left encoding now-false preconditions. Nothing blocks the
Code phase.
