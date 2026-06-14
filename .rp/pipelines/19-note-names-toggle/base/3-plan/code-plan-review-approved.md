# Code Plan Review

## Verdict: approved

## Summary

The revised plan resolves every issue from the prior rejection and survives a
fresh adversarial pass with no new defects. It is well sequenced, traceable to
the spec and design, feasible against the actual codebase, and scope-disciplined
(frontend-only; the editor's no-third-arg `buildLayoutModel` call is preserved).

All pinned line numbers and file paths were re-verified against the worktree:
`stackChord` at `layout.js:324` (sort `(a,b)=>a-b`, returns
`{sFromBottom,y,side,displaced}[]`); `stemDirectionForChord` at `:262`
(`@param {number[]} positions`) with exactly TWO callers — `:1503` in
`layoutHand` and `:512` in `beamGeometry` (which passes the independent
`allSteps` number array and is correctly left untouched); `layoutHand` at
`:1462`; the per-event `positions` walk at `:1493-1500`; the accidentals loop at
`:1507-1517`; ledger loop at `:1521-1527`; dot loop at `:1530-1537`;
`topStep`/`bottomStep` at `:1558-1559`; `buildLayoutModel(song,
availableWidthInSp)` at `:1747`; the `systemHeight`/system assembly through
`:2164-2180`; `stackAccidentals` at `:690`. The `hasNameableNotes` model path
`model.systems[].measures[].{right,left}.notes` matches the real shape exactly:
`buildLayoutModel` returns `{ systems, ... }`, each system carries `measures`
(the `measureModels` pushed at `:2145-2155` with `right`/`left`), and each
`right`/`left` is a `layoutHand` result `{ notes, rests, beams, texts }`. The
four `stackChord` test sites at `layout.test.js:285/293/303/310` and the
`noteNames.test.js` imports (`inferNoteNameSystem`, `mapSong`, `noteLabel`,
`noteNameOptions`, `stepInSystem` from `../noteNames.js`) check out, as does the
`edit.js:165-166` parity expression (`working?.language ?? inferNoteNameSystem`)
and `parseAndValidate` returning `{ data, errors }` where `data.language` is the
authoritative system field.

### Prior issues — all genuinely resolved

- **Issue 1 (blocking) — `data-wp-watch` ownership.** RESOLVED. Task 5's literal
  wrapper markup now carries `data-wp-watch="callbacks.draw"`; Task 5 step 3
  states render.php is the SOLE owner; Task 5 has an acceptance bullet asserting
  the wrapper carries exactly one such attribute as the sole emission site. Task
  6's old "OR add it here" branch is gone — it now states plainly the attribute
  is owned by Task 5 and that view.js only registers the store method (with a
  matching acceptance bullet).
- **Issue 2 (should-fix) — `draw` re-resolves DOM.** RESOLVED. Task 6 step 4
  explicitly states `draw` does NOT close over `init`'s scope and re-resolves
  the wrapper via `getElement().ref`, the score div via the same
  `.wp-block-piano-block-piano__score` selector `init` uses, `accessibleName`
  via `getContext()`, and `data`/`fontReady` via the per-instance memo — with a
  dedicated acceptance bullet.
- **Issue 3 (should-fix) — `stepsOf` not exported.** RESOLVED. Task 1 keeps
  `stepsOf` module-private (only `inferNoteNameSystem` walks it), exports only
  `stepInSystem`, `inferNoteNameSystem`, and `SYSTEMS`, does not import `stepsOf`
  into `noteNames.js`, and the acceptance bullet asserts `stepsOf` is NOT
  exported.
- **Issue 4 (minor) — `stemDirectionForChord` caller phrasing.** RESOLVED. Task
  2 step 3 names both callers (`:1503` changed, `:512` `allSteps` unaffected and
  not to be touched), matching the codebase.

### Fresh pass — no new problems

- Coverage of AC1–AC13 is intact (the closing coverage table maps each AC to its
  tasks), including the AC10/AC11 byte-identity guarantees (one flag site,
  default OFF, `head.name` key omitted when off, no `svg.js` flag) and AC4
  per-instance isolation (local context, per-instance memo, no module-level
  single variable).
- Ordering/dependencies are coherent: T1 (none), T2 (none, before T3), T3
  (T1+T2), T4 (T3), T5 (pairs with T6), T6 (T1,T3,T4,T5), T7 (T5).
- Test scope is disciplined: exactly the four `stackChord` migrations are in
  scope ("Do NOT add or design new test cases"); the design's `outerHTML` pin
  tests are correctly NOT turned into plan tasks. No doc tasks.
- The accidentals-loop adaptation (Task 2 step 3) preserves today's behavior in
  either offered form (index-aligned `headInputs[pi]` or paired-walk) and
  requires byte-identical accidental records — it neither introduces nor is
  required to fix the pre-existing index-lockstep fragility the design flagged.
- The `draw` width handling (reads `c.width` to subscribe the watch, then
  re-measures via `availableWidthInSp(score)`) is an intentional, consistent
  iAPI pattern, not a contradiction.

The plan is complete, ordered, feasible, and traceable. Approved.
