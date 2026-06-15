# Code Review — Batch (issue #19, note-names toggle)

## Verdict

**REJECTED** (iteration 2)

The iteration-1 defect IS resolved: the SSR `<button>` in `render.php` now carries
`class="wp-block-piano-block-piano__toggle-note-names"`, which matches the
`style.scss` selector, so the rule is no longer dead and the button gets its
`margin-bottom` spacing — Task 7's acceptance ("button visually separated from the
score with spacing") is now met.

But the fix, by activating a previously-dead CSS rule, introduces a NEW defect: the
same rule sets `display: block` unconditionally on the button, and an author-origin
`display` declaration overrides the user-agent `[hidden] { display: none }` rule.
The button is therefore VISIBLE even when it carries the `hidden` attribute. This
breaks the SSR-hidden-until-init gating that the whole feature depends on:

- **FOUC** — the button is now visible before JS hydrates (Design Decision 7
  promises "no flash, no mismatch").
- **AC9 / AC12** — for an all-rests (no nameable notes) song, an invalid song, or
  JS disabled, `hasNameableNotes` stays false and `data-wp-bind--hidden` keeps the
  `hidden` attribute present, but `display: block` defeats it, so a dangling
  control is shown. Task 5's acceptance ("with JS disabled, the button is hidden")
  is no longer met.

This is statically verifiable from the CSS cascade (author normal beats UA normal,
origin before specificity) — no browser needed. Everything else in the batch is
unchanged from iteration 1 and remains correct and on-plan.

## Batch scope

- Base ref diffed: `534f800` → HEAD. The only change since iteration 1
  (`99b207e`) is the single class addition on `render.php:98` (commit `cc72d80`).
- Implementation files in the full feature: `src/song/noteNameSystem.js`,
  `src/editor/noteNames.js`, `src/notation/layout.js`, `src/notation/constants.js`,
  `src/notation/svg.js`, `src/render.php`, `src/view.js`, `src/style.scss`,
  `jest.config.js`, `test/mocks/wordpress-interactivity.js`, and the three test
  files (`src/__tests__/view.test.js`, `src/notation/__tests__/layout.test.js`,
  `src/notation/__tests__/svg.test.js`).
- `.rp/**` pipeline artifacts were NOT reviewed (out of code-review scope).
- 8 implementation commits: `0bb9a09, ad59acf, 49c6bbe, 5667816, 40de242, edde993,
  cc6c384, cc72d80`.

## Summary

The re-dispatched fix (Task 5, commit `cc72d80`) is a single additive line:
`class="wp-block-piano-block-piano__toggle-note-names"` on the SSR `<button>`. A
repo-wide grep now finds that class string in exactly two places — `render.php:98`
(rendered markup) and `style.scss:30` (selector) — so the class↔selector contract
is satisfied and the original "dead CSS" defect is gone. The
`.wp-block-piano-block-piano__score` selector remains consistent across
`render.php:104`, `view.js:158`/`view.js:235`, and the test mock.

Tasks 1–4, 6, and 7's SCSS are byte-identical to iteration 1 (the diff
`99b207e..HEAD` touches only `render.php`), so their iteration-1 approval still
holds:

- **Task 1** — shared `noteNameSystem.js`, no `@wordpress/i18n`, re-exports intact.
- **Task 2** — `headInputs` `{ sFromBottom, step }[]` threading; `stemDirectionForChord`
  still `number[]`; downstream consumers migrated per the prescribed expressions.
- **Task 3** — single `buildLayoutModel(song, width, { showNoteNames, system })`
  flag; `name` key omitted when off (byte-identity preserved).
- **Task 4** — `<text data-note-name>` emitted iff `head.name` present; no flag in
  `svg.js`; names-off output byte-identical.
- **Task 6** — toggle action mutates in place; single `callbacks.draw` watch reads
  `showNoteNames`+`width`; per-instance `WeakMap` memo; `ResizeObserver` writes
  `context.width`; `init` computes `hasNameableNotes`; `draw` re-resolves the score
  div via the same selector so the SSR button survives redraws.
- **Tests** — all pass (see Checks).

The single new defect is the `display: block` / `[hidden]` clash (see Issues).

## Checks

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm run test:unit` | PASS — 24 suites, 742 tests, all green |
| Lint (read-only) | `npm run lint` | No findings in any batch-changed file (`src/**`, `test/mocks/**`, `jest.config.js`). The only findings are in `scripts/verify-archive.mjs`, which is NOT in this batch (`git diff --name-only 534f800..HEAD` does not include it) — pre-existing repo drift, explicitly not a batch defect per the guardrail note |
| Class↔selector linkage | `grep -rn "wp-block-piano-block-piano__toggle-note-names" src/` | MATCH — `render.php:98` (markup) and `style.scss:30` (selector); original dead-CSS defect resolved |
| Fix scope | `git diff 99b207e..HEAD -- src/` | Single additive line on `render.php:98`; nothing else changed since iteration 1 |

## Behavior verification

Live browser e2e (Playwright/wp-env/Docker) is unavailable in this sandbox; I did
NOT run it and did NOT fabricate browser evidence. The observable toggle/draw logic
remains covered by the passing jsdom unit/integration tests and the static
class↔selector match (recorded as the evidence for the styling hookup).

The NEW defect below is NOT a live-browser gap — it is a deterministic CSS-cascade
outcome (author `display: block` overriding the UA `[hidden]` rule), verifiable from
the stylesheet text alone. Note: the existing jsdom tests do NOT and cannot catch it
— jsdom does not apply the user-agent `[hidden] { display: none }` stylesheet, so a
`getComputedStyle`/visibility assertion in jsdom would not reflect the real browser
behavior. That is why the unit suite is green despite the defect.

## Issues

### Issue 1 — `display: block` on the toggle button defeats its `hidden` attribute; button shows when it must be hidden (Tasks 5 and 7)

**Severity:** rejecting.

**What:** `style.scss:29-34` styles the button with
`.wp-block-piano-block-piano .wp-block-piano-block-piano__toggle-note-names {
display: block; margin-bottom: 0.5rem; }`. The fix in `render.php:98` now applies
that class to the SSR `<button>`, which also carries the literal `hidden` attribute
and `data-wp-bind--hidden="!context.hasNameableNotes"`. The mechanism that makes
`hidden` hide an element is the user-agent rule `[hidden] { display: none }`. An
author-origin normal declaration (`display: block`) always wins over a
user-agent-origin normal declaration in the cascade (origin is compared before
specificity). So the `display: block` overrides `[hidden] { display: none }`, and
the button is rendered VISIBLE whenever the class is present, regardless of the
`hidden` attribute.

**Why it matters:**
- **FOUC (Design Decision 7).** The button is SSR'd `hidden` precisely so it is
  invisible before JS hydrates. With `display: block` active, it is visible from
  first paint — the "no flash, no mismatch" guarantee is broken.
- **AC9 / Task 5 acceptance / AC12.** For an all-rests conformant song (no note
  records), `init` leaves `hasNameableNotes` false, so `data-wp-bind--hidden` keeps
  the `hidden` attribute on the button — but `display: block` shows it anyway: a
  dangling control with no nameable notes to toggle. Same with JS disabled (the
  literal `hidden` is supposed to keep it hidden; `display: block` defeats that).
  Task 5's acceptance "With JS disabled, the button is hidden (literal `hidden`)"
  and AC9 ("no nameable notes → no control") are not met.

This is the direct, foreseeable side effect of the fix: in iteration 1 the
`display: block` rule was dead (matched nothing) and therefore harmless; the fix
activates it, and activation breaks the gating contract. The spacing half of the
fix is correct; the `display` half is not.

**Where:**
- `src/style.scss:31` — unconditional `display: block` on the toggle button.
- `src/render.php:98` — the class that now binds that rule to the button (which
  also carries `hidden` / `data-wp-bind--hidden`).

**Fix (pick one, owner's choice — keep the spacing, stop defeating `hidden`):**
- Scope the display so it does not apply while hidden, e.g.
  `.wp-block-piano-block-piano__toggle-note-names:not([hidden]) { display: block;
  margin-bottom: 0.5rem; }` (Task 7); OR
- Drop `display: block` entirely and rely on `margin-bottom` for the spacing (a
  `<button>` is already block-level enough for "sits above the score" once the
  inner score `<div>` is its block-level sibling — the spacing is what the
  acceptance requires, not a forced `display`) (Task 7); OR
- Any equivalent that keeps the UA `[hidden]` hiding behavior intact while still
  giving the visible button its `margin-bottom` separation.

Whichever is chosen: when `hasNameableNotes` is false / pre-JS, the button MUST stay
hidden; when shown, it MUST keep its spacing above the score.

**Re-dispatch:** Tasks **5** and **7** (the defect spans the markup that applies the
class and the SCSS that over-specifies `display`; the cleanest single-file fix is in
`style.scss`, but record both tasks since the contract is shared).

## Non-blocking observations (NOT rejections)

- The original iteration-1 defect (dead button CSS) IS resolved — recorded as
  confirmed, not as an open issue.
- **No rightward name dodge (Task 4)** — unchanged from iteration 1; a
  plan-sanctioned "no-dodge v1" simplification (plan Task 4 step 4; design Decision
  8). Not a defect.
- **AC13 / extreme-ledger clip** — a documented gated contingency the default ship
  path intentionally omits (zero `systemHeight` delta both states). Not a defect.
