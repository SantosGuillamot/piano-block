# Spec review — Review 11 — APPROVED

Adversarial review of `1-spec/spec.md` for completeness, internal consistency,
testability, and faithfulness to the intent (`0-prompt/prompt.md`) and research
(`1-spec/spec-research.md`). Load-bearing claims were verified against the live
worktree (branch `worktree-8-editor-ui`). **Verdict: APPROVED.**

## Scope faithfulness — complete, nothing dropped or smuggled

- All five in-scope findings are captured as testable requirements: **B1** (🔴
  blocking, e2e drift), **B2** (stale SCSS prose), **B3** (misleading `:first-child`
  comment + keep inline `minWidth`), **B4** (first-run auto-expand), **B5** (two cheap
  simplifications).
- The 🟢 nice-to-haves (mutator-collapse #36, `@wordpress/a11y` `speak()`, move
  up/down, octave-in-tree-labels, cosmetic token swaps) are correctly in **Out of
  Scope** — none are silently designed or implemented.
- The ⛔ validated rejections (resetAll-via-`omitEmpty`, breadcrumb/move-up-down
  "mismatch", disabling boundary removes) are listed under "do NOT undo or
  re-litigate" — none are re-introduced.

## B1 — the crux — verified correct and verification is strong enough

- The two `name: "OK"` clicks exist live at `specs/editor.spec.js:669` and `:1232`,
  and a full-file sweep confirms these are the **only** two such clicks; the other
  `confirm`/`OK` hits (`:262`, `:935`, `:940`, `:1023`, `:1176`, `:1307`) are
  unrelated prose and are correctly left untouched (B1.4 / AC-B1-a). The `:1191`
  test really is "…confirms via a real dialog before removing"; the stale comments
  sit at `:664`, `:1186`, `:1188`, `:1191`, `:1225`, `:1230` as the spec states.
- The fix asserts the **immediate** remove (keeps the existing `sections.length`
  polls after deleting the OK-clicks); the spec's "intended resulting" blocks match
  the live helper idiom (`openRowAction(editor, …)` returns an awaited locator;
  `storedSongObject`, `openSettingsSidebar(editor, page)` exist with the expected
  signatures). It does **not** re-add the dialog.
- The `toHaveCount(0)` negative regression guard is present (B1.3 / AC-B1-b),
  page-scoped, placed after the "Remove section" click and before the poll, in the
  `:1191` test only. The `page` fixture param is correctly retained (still used by
  `openSettingsSidebar(editor, page)` at `:1220`).
- **Most important:** AC-B1-c makes "the e2e suite actually RUNS GREEN" an
  acceptance criterion with the concrete alt-ports recipe (`build` → `env:start` on
  `WP_ENV_PORT=8890`/`WP_ENV_TESTS_PORT=8891` → `test:e2e` with
  `WP_BASE_URL=http://localhost:8891` → `env:stop`), and explicitly states "Tests
  edited to match is NOT acceptance." AC-B1-d requires the code phase to **STOP and
  report a blocker** if the suite genuinely cannot run (no silent skip — the exact
  review-10 gap). I confirmed the recipe is executable: docker is up with the main
  repo's wp-env holding 8888/8889, the worktree's own wp-env is not started, and
  **8890/8891 are free** — so AC-B1-d's "this path is not expected" is grounded. The
  verification is stronger than "edited to match."

## B2–B5 — exact scope, correctly gated

- **B2** is comment-only against `src/editor.scss` and explicitly does **not** touch
  `src/editor/selection.js`. The `__add-note`/`__add-measure`/`__canvas-actions`
  classes are negative-guard-only, so the prose is stale, not dead code — no test
  impact.
- **B3** keeps the inline `minWidth: "4em"` (verified live at
  `HandConfigEditor.js:193`, `PitchEditor.js:79`/`:91`) and the three asserting
  tests (`pitches.test.js:216`/`:231`, `contextControls.test.js:421`); it fixes only
  the SCSS comment and explicitly forbids moving 4em to SCSS. The "single leading
  control" rationale is sound: the list-row has three children (SelectControl,
  NumberControl, trash Button) and `PitchEditor`/`AnnotationEditor` return Fragments
  that flatten into the parent `HStack`.
- **B4** seeds the expansion Set with `expansionKey({ sectionIndex: 0 })` and
  `expansionKey({ sectionIndex: 0, measureIndex: 0 })` (helper imported at
  `edit.js:24`, yields `s0`/`s0m0`), unconditionally (inert keys are harmless), and
  correctly identifies the target as the per-hand "Add note" buttons that
  `StructureTree`'s `HANDS.forEach` renders for every measure.
- **B5.1** drops the dead default at `edit.js:248` (every caller passes an explicit
  `sectionIndex`). **B5.2** derives `keep` from `OVERRIDE_KEYS` (single source at
  `SectionPanel.js:44`, also consumed by the projection loop at `:55`); the
  replacement is behavior-identical to the rest-destructure at `:109`.
- Gating is honest: B1 by the real e2e run; B2/B3/B5 by `test:unit` + `build`; B4 by
  `test:unit` + `build` with the `:469` flow re-confirmed in the e2e run. No
  false-green path. (Verified: no snapshot tests anywhere.)

## Non-blocking observations (noted, not gating)

- B5.1 removes the default at `edit.js:248`, but the adjacent comment at
  `edit.js:245-247` ("the default-to-last fallback covers a call with no target")
  describes the removed fallback and is not called out for update. Cosmetic
  loose-end in the same hunk; no behavior or test impact. A diligent implementer
  should tidy it, and the spec's coordinate convention ("re-confirm each site by
  reading the live file") covers this.
- B2/B3 line ranges are slightly off the exact live lines (e.g. the `:first-child`
  stale text is on `:22`, `min-width: 8em` on `:30`; the on-canvas clause on `:7`).
  The spec explicitly frames all coordinates as "evidence/starting points, not
  frozen coordinates" and mandates live re-confirmation, so this is by design and
  harmless.

## Verdict

Complete, internally consistent, faithful to the intent, and testable with no
false-green path. **APPROVED.**
