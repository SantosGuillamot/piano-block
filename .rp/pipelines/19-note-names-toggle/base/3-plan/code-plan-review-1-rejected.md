# Code Plan Review

## Verdict: rejected

## Summary

The plan is, on the whole, strong: it is well sequenced, its pinned line numbers
and file paths check out against the real codebase (`stackChord` at 324,
`stemDirectionForChord` at 262, `layoutHand` at 1462, `buildLayoutModel` at 1747,
the `systemHeight` assembly at 1894-1952, `stackAccidentals` at 690, the four
`stackChord` test sites at 285/293/303/310, `el()`/`setText`/the annotation
emitter in `svg.js`, the constants in `constants.js`, `edit.js:166-167` parity,
and the `noteNames.test.js` imports). The `hasNameableNotes` model path
(`model.systems[].measures[].{right,left}.notes`) matches the actual model shape
exactly. Every spec AC (AC1–AC13, including AC10/AC11 byte-identity) is mapped to
at least one task, the refactor-before-render ordering is correct, and test
migration is correctly scoped to the four `stackChord` call sites only (no
test-planning beyond the contract-change migration, no doc tasks). The existing
suite is green at baseline (283 tests in `layout.test.js` + `noteNames.test.js`).

It is rejected for ONE blocking issue: the `data-wp-watch="callbacks.draw"`
directive — the single most load-bearing reactive directive for AC2 (toggle
redraw) and AC7 (resize redraw) — has no unambiguous, testable owner. Task 5's
prescribed wrapper markup omits it, Task 5's acceptance criteria do not require
it, and Task 6 explicitly offers a false "OR add it here" choice that no
code-writer can fulfill in `view.js`. Two code-writers could each assume the other
places it, shipping a non-functional toggle that still passes both tasks'
acceptance criteria. There are also two secondary clarity gaps in the Task 6
`draw` wiring that should be tightened on the way through.

## Issues

### Issue 1 (blocking) — `data-wp-watch="callbacks.draw"` has no unambiguous, testable owner

- **What's wrong:** The `data-wp-watch="callbacks.draw"` directive is an HTML
  attribute on the SSR wrapper; it can only be emitted by `render.php` (the
  Interactivity API binds the directive from server-rendered markup). `view.js`
  registers store callbacks via `store()` and never writes attributes onto the
  wrapper, so it physically cannot add `data-wp-watch`. Yet:
  - Task 5's prescribed literal wrapper markup (plan lines 411-423) lists
    `data-wp-init="callbacks.init"` but NOT `data-wp-watch`.
  - Task 5's acceptance criteria (plan lines 443-449) enumerate the button's
    directives and the inner score div, but never assert `data-wp-watch` on the
    wrapper — so Task 5 passes WITHOUT it.
  - Task 6 then says (plan lines 512-515, 534-539) to add it "as part of Task 5's
    directives, OR add it here per the project's directive convention" — the
    second branch is impossible in `view.js`, and the "coordinate so the attribute
    is present exactly once" instruction leaves both writers able to assume the
    other owns it.
- **Where in plan:** Task 5 "Changes" step 3 (the markup block) and Task 5
  Acceptance; Task 6 "Changes" step 4 and the closing "NOTE on the watch directive
  location".
- **Suggestion:** Make Task 5 the sole owner. Add `data-wp-watch="callbacks.draw"`
  to Task 5's literal wrapper markup (alongside `data-wp-init="callbacks.init"`),
  and add a Task 5 acceptance bullet asserting the wrapper carries exactly one
  `data-wp-watch="callbacks.draw"`. In Task 6, delete the "OR add it here" branch
  and state plainly that the directive is owned by Task 5's `render.php` markup;
  Task 6 only registers `callbacks.draw` in the store.
- **Why it matters:** Without the directive on the wrapper, the toggle and the
  resize never re-fire the draw — AC2, AC6, and AC7 silently fail — and because
  neither task's acceptance criteria require the attribute, the failure ships
  green. This is exactly the "two code-writers would produce the same changes"
  guarantee breaking down on the feature's central reactive wire.

### Issue 2 (should-fix) — Task 6 `draw` pseudo-code uses out-of-scope identifiers without saying how `draw` re-resolves them

- **What's wrong:** `callbacks.draw` is a separate store method and does NOT close
  over `init`'s locals, yet Task 6's pseudo-code (plan lines 516-528) reads bare
  `score`, `accessibleName`, `cachedParsedSong`, and `fontReady`. The prose names
  the per-instance memo for `cachedParsedSong`/`fontReady`, but it never states
  that `draw` must itself call `getElement().ref` to recover the wrapper and
  `querySelector` the inner score div, nor that `accessibleName` is read via
  `getContext()`. A code-writer could try to reference `init`'s `score`/closure
  and produce a `ReferenceError`, or resolve the element inconsistently with
  `init`.
- **Where in plan:** Task 6 "Changes" step 4 (the `draw()` snippet) and step 3
  (the memo description).
- **Suggestion:** State explicitly that inside `draw` the wrapper comes from
  `getElement().ref`, the score div from the same `.__score` `querySelector` that
  `init` uses, and `accessibleName` from `getContext()` — so `init` and `draw`
  resolve the same per-instance element and string by the same means.
- **Why it matters:** The single redraw funnel is the spine of AC2/AC6/AC7; if
  `draw` cannot reliably reach its own score element and accessible name, the
  redraw is non-deterministic or throws, and two writers will diverge on the
  resolution.

### Issue 3 (minor) — `stepsOf` is exported by Task 1 but no consumer in the chosen design uses it

- **What's wrong:** Task 1 requires exporting `stepsOf` "the names the layout layer
  and `view.js` and the gating will import" (plan lines 101-102, 133), but the
  chosen `hasNameableNotes` implementation (Task 6 / Design Decision 7) uses the
  built-model check `model.systems...notes.length`, NOT a `stepsOf` walk. Today
  `stepsOf` is a private function used only inside `noteNames.js`'s
  `inferNoteNameSystem`; nothing imports it. The plan justifies the export by a
  consumer that the plan itself does not wire up.
- **Where in plan:** Task 1 "Changes" step 1 and Acceptance.
- **Suggestion:** Either drop `stepsOf` from the required exports (keep it private
  to the new module, called only by `inferNoteNameSystem`), or correct the
  rationale to "exported for completeness as part of the shared vocabulary; no
  current frontend consumer." Removing the dangling consumer claim keeps the
  scope-discipline and traceability clean.
- **Why it matters:** A required export justified by a non-existent consumer is a
  small traceability defect; it invites a writer to wire an unused import or to
  wonder which gating path is authoritative.

## Notes (non-blocking, for the writer's awareness)

- The design and plan describe `stemDirectionForChord` as having "the single
  caller inside `layoutHand`." There are in fact two callers in `layout.js`
  (line 1503 in `layoutHand`, and line 512 in `beamGeometry`). The 512 caller
  passes an independent `number[]` (`allSteps`) and is unaffected because the
  signature is explicitly preserved — so this is phrasing looseness, not a defect.
  No change required, but the writer should not be surprised by the second caller.
- Task 6's per-instance memo choice ("`WeakMap` keyed by the element, or stored on
  context") leaves an implementation choice, but both forms satisfy the same
  observable contract (parse once per instance, no cross-instance leak), so this
  is acceptable granularity rather than a hidden design decision.
