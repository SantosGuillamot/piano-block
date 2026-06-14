# Code-plan review 2 — APPROVED

**Verdict:** Approved.
**Reviewer:** code-plan-reviewer (review-4, re-review).
**Plan under review:** `3-plan/code-plan.md` (writer fix commit `4c76279`).
**Prior review:** `3-plan/code-plan-review-1-rejected.md` (one blocking gap: the e2e spec
`specs/editor.spec.js` was omitted from T1 and T4's scope).

## Summary

The single blocking gap from review 1 is fully resolved. The writer's commit `4c76279`
("Add e2e spec to T1 and T4 scope in code plan") is surgical (+49/-3, one file) and touches
only T1, T4, and one added cross-cutting paragraph. Everything review 1 verified as correct
(T2/T3/T5/T6/T7, the editor-only boundary, the gates, Req/AC coverage, KD1–KD8, the T7
Option B collapse veto with its AC7 + un-overridden-reveal tests) is byte-for-byte
unchanged — no new tasks, no restructuring. I re-verified every newly-cited e2e line number
against live `specs/editor.spec.js` and they all match.

## T1 — resolved

- **Files** now include `specs/editor.spec.js` (line 36).
- New **step 5** (lines 62–76) names the `openStructureTree` helper (`:261-263`) and all
  five call sites — `:408`, `:468`, `:512`, `:574`, `:611` — and instructs removing every
  `openStructureTree(editor)` call (or repurposing the helper to a no-op/assert-already-open)
  so the now-open tree is not toggled shut. It also rewrites the helper's "hidden by default"
  doc-comment (`:255-259`) and the `structureTree` trailing comment (`:270`, "Only present
  once `openStructureTree` has toggled it on") to open-by-default. This fixes the
  `await expect(structureTree(editor)).toBeVisible()` (`:409`) break and the downstream
  `treeRow(...).click()` call sites.
- **Acceptance** gains the matching criterion (lines 89–92): no `openStructureTree(editor)`
  call remains (or it is a verified no-op), and the doc-comments describe open-by-default.
- **Live-source check:** the helper sits at `:255-263`, the "hidden by default" prose at
  `:258`, the `structureTree` "Only present once …" comment at `:270`, and the five
  `openStructureTree(editor)` calls at `:408/468/512/574/611` — all confirmed.

## T4 — resolved

- **Files** now include `specs/editor.spec.js` (line 183).
- New **step 7** (lines 239–252) names the test "selecting structure-tree rows reveals the
  right panels and highlights the canvas" and instructs dropping both `is-active-*`
  assertions — section at `:584-586`, measure at `:595-597` — and the stale highlight prose
  in the surrounding comments (`:576-590`), mirroring the unit-side `SongCanvas.test.js`
  treatment. It explicitly **keeps the panel-reveal half** (Section click → Section visible /
  Measure+Note absent; Measure click → Measure+Section visible / Note absent) and notes the
  optional title rename.
- **Acceptance** gains the matching criterion (lines 268–271): the spec no longer asserts
  `[data-measure].is-active-section`/`is-active-measure`, the highlight comments are gone, and
  the panel-reveal assertions are retained.
- **Live-source check:** `is-active-section` at `:585` and `is-active-measure` at `:596`, the
  highlight comments at `:578` and `:590`, and the retained panel-reveal assertions
  (`:581-583`, `:592-594`) — all confirmed.

## No regression

The `4c76279` diff modifies only: T1 (Files / new step 5 / Traces line / Acceptance), T4
(Files / new step 7 / Acceptance), and one added cross-cutting paragraph (lines 456–462)
acknowledging the e2e suite is updated in lock-step under R2 and that T6's reorder is
correctly out of e2e scope (its panel assertions test presence by kind, not DOM order).
T2, T3, T5, T6, and T7 — including the Option B veto form
(`ancestor ? !collapsedOverride.has(path) : expandedPaths.has(path)`), the dropped bare
`|| isSelectionAncestor`, the live `isSelectionAncestor`, no `useEffect`, no Set seeded from
selection, and the AC7 + un-overridden-reveal tests — are unchanged. The editor-only boundary
(no `src/song/*`, `src/notation/*`, `src/view.js`, `src/render.php`; no new dependency), the
gates (`npm run test:unit`, `npm run lint` / biome; 629-test / 20-suite baseline), and full
Req 1–9 / AC 1–9 / KD1–KD8 coverage all stand as verified in review 1.

## Verdict

All blocking concerns from review 1 are addressed and nothing else regressed. The plan is
**approved** for the code phase.
