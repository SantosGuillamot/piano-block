# Review 11: Fix the CI-breaking section-remove e2e drift, plus stale-SCSS, first-run discoverability, and cheap simplification cleanups

_Review 11 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/` or `review-1..10/` artifact folders._

## Owner verdict

> Do another review for the multi-agent review comment on PR #22. Don't include the nice-to-haves, and run autonomously through the whole pipeline.

The owner wants this review run to address **everything actionable EXCEPT the review's own "🟢 Nice-to-have / follow-up" list** — i.e. implement the one **🔴 Blocking** finding and the four **🟡 Worth doing** findings, while honoring the review's **"⛔ Considered but NOT recommended"** rejections (those are validated decisions — do not undo them) and **excluding every 🟢 nice-to-have** (the large mutator-collapse refactor, `@wordpress/a11y` `speak()` announcements, move up/down, octave-in-tree-labels, and cosmetic token swaps — none of these are in scope this run). Run autonomously through all phases (spec → docs).

## Origin

This review is driven by a multi-agent code-review comment the owner posted on PR #22: four independent reviewers (simplification, Gutenberg-component usage, styles, UX/behavior) examined the PR, then a synthesizer independently verified their claims against the code — overturning a couple of overstated findings and confirming one test-breaking issue — before merging them into a single review. It was generated against the current branch tip, which already carries review 10's changes; several findings are direct consequences of review 10's work (most importantly the **blocking** finding below, which is e2e fallout from review 10's confirm-dialog removal).

Convenience link: https://github.com/SantosGuillamot/piano-block/pull/22#issuecomment-4699612017

> **Verdict (from the review).** Strong, genuinely Gutenberg-native PR with a clean, well-factored editor. It is **one finding away from merge-ready**: a single real spec/code drift (two Playwright e2e tests still expect a section-removal confirm dialog this PR deliberately deleted) will fail CI and must be fixed before merge. Everything else is cosmetic, a follow-up enhancement, or a reviewer overstatement.

Note on provenance vs. current code: the findings were verified against the source at the current branch tip, so the file/line references below are fresh as of run start. They are nonetheless **evidence and starting points, not frozen coordinates** — spec/design research must re-confirm exact lines against the live tree, since they will shift as fixes land.

## What the review asks for (in scope)

### 🔴 Blocking (must fix before merge)

**B1. e2e/code drift: section-remove confirm dialog — HIGH (test-breaking).** `specs/editor.spec.js:664-674` and `:1191-1238`.
Review 10 intentionally removed the section-removal `ConfirmDialog` (commit `c8ec03c`; docs now say removes are "immediate, undo-reversible"), and updated the **jest** tests — but **two Playwright e2e tests were missed** and still click a `{ name: "OK" }` button that no longer renders. Both will hang/fail in `npm run test:e2e`. (Confirmed at run start: the "click OK" / ConfirmDialog references live at `specs/editor.spec.js:664-669` and the test "the Section panel Remove section button confirms via a real dialog before removing" at `:1191` with its `OK` click at `:1232`.)
**Fix:** delete the "click OK" steps (around `:668-670` and `:1230-1232`), drop or rename the "confirms via a real dialog" test at `:1191` so it instead asserts the **immediate** remove (poll that `sections.length` dropped by one after clicking "Remove section"), and scrub the now-false comments at `:664`, `:1185-1190`, `:1225`. **Do NOT re-add the dialog** — the design and unit tests deliberately chose immediate, undo-reversible deletes.
**This finding is the e2e fallout that review 10's wp-env-execution gap masked.** Its verification is therefore special — see "Verification constraint" below: making the tests match the code is not enough; the e2e suite must actually be RUN green, since the whole point is CI-breakage.

### 🟡 Worth doing (in scope this run)

**B2. Stale SCSS prose.** `editor.scss:6-8`, `:106-107`. Delete the "on-canvas add affordances" language — those affordances moved to the tree + Note panel; the comments are stale residue (the `__add-note`/`__add-measure`/`__canvas-actions` hook classes are referenced only as a negative guard in `SongCanvas.test.js`, so this is stale **prose**, not dead code). Comment-only; no behavior change.

**B3. Reconcile the inline `minWidth` story (keep the inline style; fix the misleading SCSS comment).** `HandConfigEditor.js:193`, `PitchEditor.js:79,91`; `editor.scss:21-27`. The review's recommendation: **leave the inline `style={{ minWidth: "4em" }}`** (three unit tests assert `style.minWidth === "4em"` — `pitches.test.js:216,231`, `contextControls.test.js:421` — so moving `4em` to SCSS would break tests and is out of scope), and instead **fix the misleading SCSS comment at `editor.scss:21-27`**: it claims `:first-child` is the "SelectControl + NumberControl pair," but the row has **three** children, so `:first-child` is only the SelectControl. Correct the comment to describe the real selector target. Comment-only; do not move the inline style to SCSS.

**B4. First-run discoverability.** `edit.js:132-138`. On a fresh block the first note is two chevron-expands deep with no canvas call-to-action. The review's suggested options: **auto-expand the seeded section + measure** (the lighter option), **or** add a "Start a song" affordance. The spec/design phase decides which approach (auto-expand is the smaller, lower-risk change); implement one so a new author can reach the first note without hunting. Keep it editor-side and minimal.

**B5. Cheap simplifications (no behavior risk).**
- Drop the dead default arg at `edit.js:248` (re-confirm the exact site by grep — it is a default parameter that is never reached/needed).
- In `SectionPanel.js:109`, derive the `keep` destructure from the existing `OVERRIDE_KEYS` array instead of repeating the key list literally (single source of truth; behavior unchanged).

## Out of scope

### 🟢 Nice-to-have / follow-up — EXCLUDED by the owner (do NOT implement this run)

- Collapsing the ~12 near-identical structural mutators (`edit.js:185-495`) into descriptors + generic ops — a real win but a large refactor for a separate PR (already tracked as follow-up issue #36).
- `@wordpress/a11y` `speak()` announcements on remove (an a11y enhancement, not a bug).
- Move up/down reordering (a design-deferred feature) via a `moveAt` helper.
- Tree note labels omitting the octave (C4/C5 ambiguity) in `noteNames.js:155-162`.
- Cosmetic token swaps (`#ddd`→`$gray-300`, `24px`→`$grid-unit-30`, etc.).

### ⛔ Considered but NOT recommended — validated rejections (do NOT do)

- **Routing `ContextEditor` `resetAll` through `omitEmpty`** — rejected: `resetAll` does three things `omitEmpty` cannot (a `setTempoDraft()` React-state side-effect, deleting two keys, and deleting a nested `tempo.beatUnit`). Leave `ContextEditor.js:196-209` as-is.
- **Treating the missing breadcrumb / move-up-down buttons as a "description–code mismatch"** — down-ranked: both were *intentionally* dropped in the design; the stale text is the PR **description**, not the code. (Not a code change.)
- **Disabling boundary removes in the tree menu** — rejected: zero-section / zero-measure songs validate, so there is no invariant to guard (unlike last-pitch, which is correctly guarded).

## Verification constraint (carried from review 10 — load-bearing for B1)

Review 10 could not execute the Playwright e2e suite in the worktree (the worktree's `wp-env` was not started and the default ports were held by the main repo's running containers). **That gap is exactly what let B1 ship undetected.** Therefore, for this run:

- **B1's fix MUST be verified by actually running the e2e suite green**, not merely by editing the tests to match the code. "Tests edited to match" is not "tests pass." The code phase must run `npm run test:e2e` (starting the worktree's `wp-env` on alternate ports if the default ports are still occupied) and report the real result. If, after genuine effort, the e2e suite cannot be executed in the environment, the code phase must **stop and report that explicitly as a blocker** rather than claim B1 verified — do not repeat review 10's silent-skip.
- The jest-assertable parts (B5 logic, any unit coverage) keep their normal `npm run test:unit` + `npm run build` gates. The repo's unit-test script is `test:unit` (not `test`).

## Constraints carried over

- The change stays **editor-side**: the song format/schema, `render.php`, and the front-end SVG rendering are unchanged — a published song renders byte-identically.
- Use only `@wordpress/*` packages already available to the block; no new outside dependencies. (B2/B3 are comment-only; B1 is test-only; B4/B5 are small editor-side code changes.)
- Preserve the wins from prior reviews: the real-`TreeGrid` keyboard model and accessibility parity, the immediate/undo-reversible deletes (B1 must NOT reintroduce a confirm dialog), the monotonic `focusRequest` focus management, the inline `minWidth` list-row floors (B3 keeps them), the depth-fixed `setXAt` helpers, `omitEmpty`/`omitFalsy`, and raw-JSON mode.
- "Tests green must not mask a real broken component": B1 in particular is an e2e-contract concern — its verification must exercise the real Playwright run, not a stub.
