# Code Review — Batch (issue #19, note-names toggle)

## Verdict

**APPROVED** (after iteration 3)

The iteration-2 defect is resolved. The `style.scss` toggle-button rule is now
scoped with `:not([hidden])`, so the author-origin `display: block` declaration no
longer applies to a button that carries the `hidden` attribute. The UA rule
`[hidden] { display: none }` is therefore the only applicable `display` declaration
in the hidden state, and the button stays hidden pre-JS and when
`hasNameableNotes` is false (FOUC-safe; AC9/AC12 and Task 5's "with JS disabled,
the button is hidden" hold). In the shown state the same rule applies both
`display: block` and `margin-bottom: 0.5rem`, so the visible button keeps its
spacing above the score (Task 7 acceptance). No new defect is introduced by the
scoping. The rest of the batch (Tasks 1–6) is byte-identical to the prior
iterations and remains correct and on-plan.

## Batch scope

- Base ref diffed: `534f800` → HEAD.
- The only change since iteration 2 (`cc72d80`) is the single-file fix in
  `src/style.scss` (commit `d25f598`): the selector
  `.wp-block-piano-block-piano__toggle-note-names` is now
  `.wp-block-piano-block-piano__toggle-note-names:not([hidden])`, plus a JSDoc
  note explaining why. `git diff --name-only cc72d80..HEAD -- src/ test/
  jest.config.js` reports `src/style.scss` only.
- Implementation files in the full feature: `src/song/noteNameSystem.js`,
  `src/editor/noteNames.js`, `src/notation/layout.js`, `src/notation/constants.js`,
  `src/notation/svg.js`, `src/render.php`, `src/view.js`, `src/style.scss`,
  `jest.config.js`, `test/mocks/wordpress-interactivity.js`, and the three test
  files (`src/__tests__/view.test.js`, `src/notation/__tests__/layout.test.js`,
  `src/notation/__tests__/svg.test.js`).
- `.rp/**` pipeline artifacts were NOT reviewed (out of code-review scope).
- Implementation commits: `0bb9a09, ad59acf, 49c6bbe, 5667816, 40de242, edde993,
  cc6c384, cc72d80, d25f598`.

## Summary

The re-dispatched fix is a single scoping change on the toggle-button SCSS rule.
The CSS cascade resolves cleanly in both states:

- **Hidden state** (button has the literal `hidden` attribute pre-JS, and keeps it
  while `data-wp-bind--hidden="!context.hasNameableNotes"` is true): the
  `:not([hidden])` selector does NOT match, so the author `display: block` is never
  applied. The only applicable `display` declaration is the user-agent
  `[hidden] { display: none }`, so the button is hidden. This restores FOUC-safety
  (Design Decision 7), AC9 (no nameable notes → no control), AC12 (invalid/empty →
  no control), and Task 5's "with JS disabled, the button is hidden".
- **Shown state** (after `init` sets `hasNameableNotes` true, the bind drops the
  `hidden` attribute): `:not([hidden])` matches, so both `display: block` and
  `margin-bottom: 0.5rem` apply from the same rule block. The button sits above the
  score with spacing — Task 7 acceptance ("visually separated from the score with
  spacing, does not overlap the SVG") holds. The scoping does NOT break shown-state
  spacing, because `display` and `margin-bottom` live in one rule gated by the same
  `:not([hidden])`; when the button is shown, both apply together.

Tasks 1–4, 6, and the `render.php` Task-5 markup are byte-identical to the
iteration-1/2 approvals (the diff `cc72d80..HEAD` touches only `style.scss`), so
their prior confirmations still hold:

- **Task 1** — shared `src/song/noteNameSystem.js`; no `@wordpress/i18n`; `stepsOf`
  stays module-private; `noteNames.js` re-exports `inferNoteNameSystem`/
  `stepInSystem` and imports `SYSTEMS`+`stepInSystem`; no editor behavior change;
  `noteNames.test.js` passes unmodified.
- **Task 2** — `stackChord` takes `{ sFromBottom, step }[]`, sorts head objects by
  `sFromBottom`, adds `step` to each head; `stemDirectionForChord` stays `number[]`,
  called with `headInputs.map(h => h.sFromBottom)`; every former `positions`
  consumer reads from `headInputs` via the prescribed expressions.
- **Task 3** — single `buildLayoutModel(song, width, { showNoteNames = false,
  system } = {})` flag; names attach only when on; the `name` key is omitted
  entirely when off (byte-identity preserved); no vertical-geometry term reads the
  flag.
- **Task 4** — `renderNote` emits one `<text data-note-name>` per head iff
  `head.name` is present; no flag in `svg.js`; names-off output byte-identical;
  `NOTE_NAME_SIZE=1.8` and `NAME_GAP=0.3` added.
- **Task 5 (markup)** — wrapper carries the sole `data-wp-watch="callbacks.draw"`;
  SSR `<button>` (with `type="button"`, the toggle class,
  `data-wp-on--click="actions.toggleNoteNames"`,
  `data-wp-bind--aria-pressed="context.showNoteNames"`,
  `data-wp-bind--hidden="!context.hasNameableNotes"`,
  `data-wp-text="context.toggleLabel"`, literal `hidden`); inner score `<div>`;
  context seeds `showNoteNames:false`, `hasNameableNotes:false`, `toggleLabel`
  (from `__('Show note names', 'piano-block')`), `width:0`; empty/whitespace song
  still returns no wrapper.
- **Task 6** — `actions.toggleNoteNames` mutates in place; single `callbacks.draw`
  watch reads both `showNoteNames` and `width`; per-instance `WeakMap` memo;
  `ResizeObserver` writes `context.width`; `init` computes `hasNameableNotes`;
  `draw` re-resolves wrapper/score/context/memo (no `init` closure) and renders
  into the inner score div so the SSR button survives every redraw. The
  `.wp-block-piano-block-piano__score` selector is consistent across `render.php`,
  `view.js`, and the test mock.

## Checks

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm run test:unit` | PASS — 24 suites, 742 tests, all green |
| Lint (read-only) | `npm run lint` | No findings on any batch-changed file (`src/**`, `test/**`, `jest.config.js`). The only findings are in `scripts/verify-archive.mjs`, which this batch does not touch (`git diff --name-only 534f800..HEAD` excludes it) — pre-existing repo drift, not a batch defect per the guardrail note |
| Fix scope | `git diff --name-only cc72d80..HEAD -- src/ test/ jest.config.js` | `src/style.scss` only — the single scoping line; Tasks 1–6 unchanged |
| Selector linkage | `grep -rn "toggle-note-names\|__score" src/` | `toggle-note-names` matches `render.php:98` (markup) + `style.scss:32` (selector); `__score` matches `render.php:104` + `view.js:158`/`view.js:235` (consistent) |

## Behavior verification

Live browser e2e (Playwright/wp-env/Docker) is unavailable in this sandbox; I did
NOT run it and did NOT fabricate browser evidence. This is recorded as an
environment limitation, not a defect.

The hidden/shown styling outcome of the fix is a deterministic CSS-cascade fact,
verifiable from the stylesheet text alone (origin is compared before specificity;
the `:not([hidden])` selector simply does not match a hidden button, so the author
`display` declaration never enters the cascade for that state — the UA
`[hidden] { display: none }` wins by default). No browser is needed to confirm it.
Note that the jsdom unit suite cannot exercise this (jsdom does not apply the UA
`[hidden]` stylesheet), so the green suite neither catches nor masks it; the cascade
reasoning is the evidence.

The rest of the observable toggle/draw logic is covered by the passing jsdom
unit/integration tests:

- show/hide all names + idempotency → `layout.test.js` showNoteNames suite +
  `svg.test.js` emit suite + `view.test.js` on/off/on no-drift draw test (AC2/AC6).
- names survive resize → `view.test.js` draw reads live `showNoteNames` each fire;
  `init` ResizeObserver writes `context.width` into the same watch funnel (AC7).
- per-instance independence → `view.test.js` per-instance memo isolation +
  independent-context toggle tests (AC4).
- names-off byte identity → `svg.test.js` `outerHTML` equality + `layout.test.js`
  JSON equality (AC10).
- English/Spanish bare-step resolution (no `#`/`b`/octave) → `layout.test.js` /
  `svg.test.js` (AC3).
- gating (`hasNameableNotes`) and invalid/empty handling → `view.test.js`
  init/early-return tests (AC9/AC12).

Live-browser confirmation of the on-screen result (actual button visibility and
spacing in a real browser) is the noted environment limitation, recorded here, not
counted as a pass and not a defect.

## Issues

None. The iteration-2 defect (`display: block` defeating the `hidden` attribute) is
resolved by the `:not([hidden])` scoping, with the shown-state spacing intact and
no new problem introduced.

### Non-blocking observations (NOT defects)

- **Iteration-1 and iteration-2 defects both resolved** — the toggle button class
  is present (render.php) and matches the SCSS selector, and that selector is now
  scoped so it never overrides the UA `[hidden]` rule. Recorded as confirmed.
- **No rightward name dodge (Task 4)** — a plan-sanctioned "no-dodge v1"
  simplification (plan Task 4 step 4; design Decision 8). In dense same-X chords
  names can overlap vertically; the dodge / OPT-B name lane is the documented
  follow-up if QA finds it illegible. Not a defect.
- **AC13 / extreme-ledger clip** — a documented gated contingency the default ship
  path intentionally omits (zero `systemHeight` delta in both states). Not a defect.
