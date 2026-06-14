# Code Review — Batch (issue #19, note-names toggle)

## Verdict

**REJECTED** (iteration 1)

One real defect: the frontend toggle button's CSS selector targets a class that
no rendered element carries, so the button's styling (block display + spacing
below it) is never applied. Task 7's acceptance ("the toggle button is visually
separated from the score with spacing") is not met, and the Design Decision 5
intent ("button sits ABOVE the score in normal flow, discoverable and not
overlapping") loses its spacing. The fault spans **Task 5** (the SSR markup omits
the class the CSS expects) and **Task 7** (the CSS targets a nonexistent class).
Everything else in the batch is correct, well-tested, and on-plan.

## Batch scope

- Base ref diffed: `534f800` → HEAD.
- Implementation files reviewed: `src/song/noteNameSystem.js`,
  `src/editor/noteNames.js`, `src/notation/layout.js`, `src/notation/constants.js`,
  `src/notation/svg.js`, `src/render.php`, `src/view.js`, `src/style.scss`,
  `jest.config.js`, `test/mocks/wordpress-interactivity.js`, and the three test
  files (`src/__tests__/view.test.js`, `src/notation/__tests__/layout.test.js`,
  `src/notation/__tests__/svg.test.js`).
- `.rp/**` pipeline artifacts were NOT reviewed (out of code-review scope).
- 7 implementation commits: `0bb9a09, ad59acf, 49c6bbe, 5667816, 40de242,
  edde993, cc6c384`.

## Summary

The implementation closely follows the approved plan and design. Highlights that
check out:

- **Task 1 (shared vocabulary):** `src/song/noteNameSystem.js` is the single
  source of `SYSTEMS`/`CANONICAL_LETTERS`/`SPANISH_TOKENS`/`stepsOf`/
  `inferNoteNameSystem`/`stepInSystem`; it does NOT import `@wordpress/i18n`;
  `stepsOf` stays module-private (not exported). `noteNames.js` re-exports
  `inferNoteNameSystem`/`stepInSystem` and imports `SYSTEMS`+`stepInSystem` for
  its own use, keeping `@wordpress/i18n` only for `noteLabel`. No editor behavior
  change. `noteNames.test.js` passes unmodified.
- **Task 2 (headInputs refactor):** `stackChord` now takes `{ sFromBottom, step }[]`,
  sorts head objects by `sFromBottom`, and adds `step` to each returned head;
  `stemDirectionForChord` is left on `number[]` and called with
  `headInputs.map(h => h.sFromBottom)`; every former `positions` consumer reads
  from `headInputs` via the prescribed expressions. The accidentals
  `headInputs[pi]?.sFromBottom` lockstep is byte-identical to the prior
  `positions[pi]` (same pre-existing, validator-guarded fragility — not a new
  defect). The 4 `stackChord` test sites were migrated; no new tests added there.
- **Task 3 (single flag site):** `buildLayoutModel(song, width, { showNoteNames =
  false, system } = {})` threads to `layoutHand`; names attach only when
  `showNoteNames` is true; the `name` key is OMITTED entirely when off (not set to
  `undefined`). No vertical-geometry term reads the flag.
- **Task 4 (svg emit):** `renderNote` appends one `<text data-note-name>` per head
  iff `head.name` is present (no flag in `svg.js`), rightward of the head, past
  dots, at `NOTE_NAME_SIZE`, `text-anchor=start`. Constants `NOTE_NAME_SIZE=1.8`
  and `NAME_GAP=0.3` added with JSDoc.
- **Task 5 (render.php):** wrapper now carries `data-wp-watch="callbacks.draw"`
  (sole site), SSRs the `<button>` (with `data-wp-on--click`,
  `data-wp-bind--aria-pressed`, `data-wp-bind--hidden`, `data-wp-text`, literal
  `hidden`) and the inner score `<div>`; context seeds `showNoteNames:false`,
  `hasNameableNotes:false`, `toggleLabel` (from `__('Show note names',
  'piano-block')`), `width:0`. Empty/whitespace song still returns no wrapper.
- **Task 6 (view.js):** `actions.toggleNoteNames` mutates in place; a single
  `callbacks.draw` watch reads both `showNoteNames` and `width`; parse-once via a
  per-instance `WeakMap` keyed by the wrapper (true per-instance isolation);
  `ResizeObserver` writes `context.width`; `init` computes `hasNameableNotes` from
  a names-off probe model; `draw` re-resolves the wrapper/score/context/memo (no
  closure over `init`), renders into the inner score div so the button survives.
- **Tests:** `view.test.js` (new), `layout.test.js` (showNoteNames suite), and
  `svg.test.js` (note-name emit suite) cover AC2/AC3/AC4/AC6/AC7/AC9/AC10/AC12 at
  the unit/integration level — including the `outerHTML` byte-identity pin
  (names-off == default), English/Spanish name resolution, bare-step assertion
  (no `#`/`b`/octave digit), systemHeight + notehead-Y invariance, and on/off/on
  no-drift. The `@wordpress/interactivity` mock + jest mapping are sound.

The single defect is the dead button CSS (see Issues).

## Checks

| Check | Command | Result |
|---|---|---|
| Unit tests | `npm run test:unit` | PASS — 24 suites, 742 tests, all green |
| Lint (read-only) | `npm run lint` | No findings in any batch-changed file (`src/**`, `test/**`, `jest.config.js`); the only findings are in `scripts/verify-archive.mjs`, which this batch did not touch (pre-existing repo drift, explicitly not a batch defect per the guardrail note) |
| Editor regression | `noteNames.test.js` in the suite | PASS unmodified (Task 1 re-export preserves the editor surface) |
| Names-off byte identity | `svg.test.js` outerHTML pin + `layout.test.js` JSON pin | PASS (default == explicit `showNoteNames:false`) |

## Behavior verification

The toggle's live runtime behavior (click shows/hides names, resize preserves
state, per-instance independence in a real browser) is browser-level and the
project's e2e is Playwright (`npm run test:e2e`), which needs wp-env/Docker and is
NOT available in this sandbox. I did NOT run it and did NOT fabricate
browser evidence. The observable logic is instead covered by the passing
jsdom unit/integration tests:

- show/hide all names + idempotency → `layout.test.js` showNoteNames suite +
  `svg.test.js` emit suite + `view.test.js` on/off/on no-drift draw test.
- names survive resize → `view.test.js` draw reads live `showNoteNames` each fire;
  `init` ResizeObserver writes `context.width` into the same watch funnel.
- per-instance independence → `view.test.js` per-instance memo isolation +
  independent-context toggle tests.
- byte identity (AC10) → `svg.test.js` `outerHTML` equality + `layout.test.js`
  JSON equality.

Live-browser confirmation of the on-screen result (including the actual button
spacing) is an environment limitation, recorded here, NOT counted as a pass and
NOT (by itself) the rejection. The rejection is the static CSS defect below,
which is verifiable without a browser.

## Issues

### Issue 1 — Toggle button CSS targets a class no element has; button styling never applies (Tasks 5 and 7)

**Severity:** rejecting.

**What:** `src/style.scss` styles the toggle button with
`.wp-block-piano-block-piano .wp-block-piano-block-piano__toggle-note-names {
display: block; margin-bottom: 0.5rem; }`. But the SSR `<button>` in
`src/render.php` carries NO `class` attribute (`<button type="button"
data-wp-on--click=… data-wp-bind--aria-pressed=… data-wp-bind--hidden=…
data-wp-text=… hidden></button>`), and `src/view.js` never adds the class either.
A repo-wide grep confirms `wp-block-piano-block-piano__toggle-note-names` exists
ONLY at `src/style.scss:30` — it matches no rendered element. The rule is dead
CSS.

**Why it matters:** Task 7's acceptance is "The frontend toggle button is
visually separated from the score (it sits above the score with spacing and does
not overlap the SVG)." With the selector matching nothing, the button gets no
`margin-bottom` (zero spacing) and no `display:block`. Design Decision 5 calls for
the button to "sit ABOVE the score in normal flow, discoverable and not
overlapping"; the spacing that realizes that intent is never applied. (The button
will still flow above the block-level score div, so it is not catastrophic, but
the task's own acceptance — visual separation WITH spacing — is unmet, and
shipping a CSS rule wired to a nonexistent class is a defect on its face.)

**Where:**
- `src/render.php:97-102` — the `<button>` element has no `class`.
- `src/style.scss:29-33` — selector `.wp-block-piano-block-piano__toggle-note-names`.

**Fix (pick one, owner's choice):**
- Add `class="wp-block-piano-block-piano__toggle-note-names"` to the SSR button in
  `render.php` (Task 5), so the existing SCSS applies; OR
- Change the SCSS selector to match what is actually rendered — e.g. target the
  button directly under the wrapper (`.wp-block-piano-block-piano > button`) or
  put the spacing on the score container (`…__score { ... }`) — (Task 7).

Whichever is chosen, the button must end up with the intended spacing/separation
and the SCSS must reference a class/selector that the rendered markup carries.

**Re-dispatch:** Tasks **5** and **7**.

## Non-blocking observations (NOT rejections)

- **No rightward name dodge (Task 4).** The plan/design recommended a
  `stackAccidentals`-style rightward column-pack for clashing chord/run names, but
  BOTH the plan (Task 4 step 4) and the design (Decision 8, Risks) explicitly
  permit a "no-dodge v1" as an acceptable first tier against AC13's "not
  illegible" bar. The shipped code places all chord names at the same base X (each
  at its head's true Y), with no column-pack. This is a plan-sanctioned
  simplification, not scope creep or a deviation — recorded for awareness only.
  In dense same-X chords the names can still overlap vertically; if QA later finds
  this illegible, the dodge (or OPT-B name lane) is the documented follow-up.
- **AC13 / extreme-ledger clip** is a documented gated contingency that the
  default ship path intentionally omits (zero systemHeight delta both states),
  consistent with the design. Not a defect.
