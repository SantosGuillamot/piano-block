# Code plan review — APPROVED

_Re-review of `.rp/pipelines/8-editor-ui/review-10/3-plan/code-plan.md` (commit `7634d9b`, "Revise code plan") against the prior rejection (`code-plan-review-1-rejected.md`), the approved design (`2-design-doc/design-doc.md`), and spec (`1-spec/spec.md`), verified against the live tree on branch `worktree-8-editor-ui`._

## Verdict: APPROVED

The single blocking finding from review 1 (F1 — the false "inspector leaf editors are under `src/editor/inspector/`" path correction) is fully fixed, and nothing else regressed. The revision is a targeted path correction and nothing more.

---

## F1 fix — confirmed fully resolved

**Live tree (verified with `find src/editor -name '*.js'`):**
- The five leaf editors live directly under `src/editor/`: `PitchList.js`, `PitchEditor.js`, `HandConfigEditor.js`, `AnnotationList.js`, `ContextEditor.js`.
- The four panels live under `src/editor/inspector/`: `NotePanel.js`, `MeasurePanel.js`, `SectionPanel.js`, `SongPanel.js`.

**Line 14** now reads correctly: it lists the five leaf editors under `src/editor/` and the four panels (including `SongPanel.js`, which is correctly at `src/editor/inspector/SongPanel.js`) under `src/editor/inspector/`. The earlier conflation of all eight under `inspector/` is gone.

**Per-task path audit (grep over the whole plan):**
- No leaf editor (`PitchList`/`PitchEditor`/`HandConfigEditor`/`AnnotationList`/`ContextEditor`) is referenced under `inspector/` anywhere — zero stray occurrences.
- **Task 4** now cites the five leaf editors at the correct `src/editor/` prefix (`PitchList.js:43`, `HandConfigEditor.js:164/168/178`, `AnnotationList.js:57`, `PitchEditor.js:69/80`).
- **Task 6** correctly keeps `NotePanel.js:235` and `MeasurePanel.js:136` under `inspector/` — these are genuine panels, so no change was needed (and none was made). Verified against the live tree.
- **Task 9** uses bare filenames (no directory prefix), so the F1 defect never applied there; correctly left unchanged.

**Intra-file coordinates re-spot-checked at the corrected paths** (the path move did not desync line numbers):
- `PitchList.js:43`, `HandConfigEditor.js:164`, `AnnotationList.js:57` → `alignment="flex-start"` ✓
- `HandConfigEditor.js:168` → `label={__("Alteration note", …)}` ✓
- `HandConfigEditor.js:178`, `PitchEditor.js:69`, `:80` → `<NumberControl` ✓

The `src/editor/inspector/SectionPanel.js` correction (Tasks 2) and the `src/edit.js` correction remain intact and correct.

---

## No regression — confirmed

A diff of the revised plan (`7634d9b`) against the version reviewed and rejected in review 1 (`1f8487c`) shows **only** the F1 fix: the line-14 bullet rewrite plus the six `src/editor/inspector/` → `src/editor/` prefix corrections in Task 4. No other line changed.

Everything the prior review approved on the merits therefore carries forward byte-identically and remains valid:
- **Coverage** — all 11 in-scope requirements planned (R-TREE/T1, R-DEL/T2, R-FOCUS/T3, R-LR1-3/T4, R-JSON/T5, R-NOOP/T6, R-INVALID + `__experimentalVStack` mock/T7, R-DOCS/T8, R-NUM/T9, R-FOLLOWUP/T10); the cross-cutting item held as guardrails; nothing out-of-scope pulled in.
- **Ordering / buildability** — the hard-ordered chains 2→3 (shared `StructureTree.js` `@wordpress/element` import) and 3→5→8 (disjoint `edit.js` regions) are correct; each task ends on a compiling, test-green file.
- **T2↔T3 import handoff + split docstring** — honest (T2 deletes the whole `import { useState }` line; T3 re-adds `import { useEffect, useRef }`; the class docstring is split R-DEL half / focus half to avoid documenting not-yet-present code).
- **Honest jest-vs-e2e split** — DOM focus and `HStack` `alignment` are correctly e2e-only (the mock would false-green); R-LR2 `min-width` is genuinely jest-assertable; no jest test asserts `alignment`, DOM focus, or `__nextHasNoMarginBottom` on a `NumberControl`.
- **R-NUM** changes nothing and records the real-contract rationale; the T4↔T9 non-conflict is correctly called out.
- **R-FOLLOWUP** relabels #35 and files the three other follow-ups (4 total), implementing none.

---

## Conclusion

The plan is complete, correctly ordered, buildable task-by-task, has an honest test strategy, and its stated coordinate corrections now match the live tree. Approved.
