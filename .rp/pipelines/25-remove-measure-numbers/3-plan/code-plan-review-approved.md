# Code Plan Review

## Verdict: approved

## Summary

The revised plan resolves both issues from `code-plan-review-1-rejected.md` and
introduces no new defects. Issue 1 (the dead `const head = members[0];` binding)
is now fixed: Task 1 has an explicit "Changes" bullet directing deletion of the
binding at `layout.js:2931` together with the `measureNumber` block, on the
correct (and now factually true) justification that `head`'s only consumers were
the deleted lines `:2957` (`head.number === 1`) and `:2960`
(`String(head.number)`); Task 1 also adds a dedicated acceptance criterion
requiring the binding be gone and correctly noting it must be verified by reading
code, not by the lint gate. Issue 2 (the lead comment naming "measure number"
twice) is fixed: Task 3 now instructs removal of BOTH mentions, at `svg.js:1091`
and `:1092`. I re-verified every load-bearing citation against the live tree:
the `head` binding/uses, the two svg.js comment mentions, the constant + its two
imports (alphabetical order preserved on deletion), the kept internal index
counter (`layout.js:1730/1738/1745`) vs. the removed model field, the
`data-measure` write (`svg.js:519`), the test-file pins, and the empirical
fixture claim. The plan traces every spec AC and design decision to at least one
task, its per-task acceptance criteria are observable and describe what must be
true (not which test to write), the ordering (producer → spacing → consumer →
constant, then test guards, then verification) is acyclic and correct, and it
prescribes no specific tests and no documentation work.

## Verification performed against live source

- **Issue 1 resolved (verified).** `src/notation/layout.js:2931` binds
  `const head = members[0];`; its only references in `buildSystemTexts` are
  `head.number === 1` (`:2957`) and `String(head.number)` (`:2960`), both inside
  the `measureNumber` block (`:2954-2964`) that Task 1 deletes. The `tempos`
  loop (`:2936`) and `ottavas` loop (`:3009`) iterate `members.forEach(...)` and
  never read `head`. Task 1 now deletes the binding and asserts no unused
  variable remains. I confirmed Biome treats an unused `const head` as
  `lint/correctness/noUnusedVariables` at **warning** severity with
  `biome lint` exiting 0, so Task 1's instruction to verify by reading code
  (rather than relying on Task 7's lint gate) is correct.
- **Issue 2 resolved (verified).** `src/notation/svg.js` lead comment mentions
  the measure number twice — `:1091` ("…, the measure number, and the ottava
  brackets.") and `:1092` ("Tempo + measure number + ottava labels are plain
  font text…"). Task 3 now removes BOTH, citing both lines.
- **Pinned facts all match live tree.** `constants.js:179-180`
  (doc comment + `MEASURE_NUMBER_SIZE = 2.2`); imports at `layout.js:49` and
  `svg.js:35`; the complete `MEASURE_NUMBER_SIZE` reference set is exactly five
  sites (definition, two imports, `layout.js:2877`, `svg.js:1110`); alphabetical
  import order is preserved by line deletion (MAX_STRETCH → MEASURE_START_PAD in
  layout.js; LEDGER_WIDTH → NOTE_SIZE in svg.js). `topMarginLayout` reservation
  at `:2874` (`showsMeasureNumber`) and `:2875-2878` (`Math.max innerZone`);
  `ledgerTop` is a direct parameter, so `innerZone = ledgerTop` is valid. The
  `data-measure` write (`svg.js:519`) and the kept internal index counter
  (`layout.js:1730/1738/1745`) are correctly left untouched (AC5). The
  `system.texts.measureNumber` reader set is exactly the renderer guard (deleted
  by Task 3) and the old test at `layout.test.js:2218-2230` reading `:2222`/`:2226`
  (replaced by Task 6). First-system AC2 guards at `:2059`/`:2081` and
  `COMPREHENSIVE_SONG` at `:931`; `svg.test.js` `SONG` `:18-65`, `modelFor` `:67`,
  `[data-text="annotation"]` idiom present.
- **Empirical fixture claim confirmed.** `buildLayoutModel(COMPREHENSIVE_SONG, 30)`
  yields 3 systems: `systems[0]` (headNum 1, tempos 1, ottavaAbove 0,
  measureNumber null), `systems[1]` (headNum 2), `systems[2]` (headNum 3,
  tempos 1, ottavaAbove 1). So the model-absence test's wrap-guard
  (`systems.length > 1`) is non-vacuous, and Task 6's `.find(...)` for a later
  system with `number !== 1`, `tempos.length > 0`, and an `above` ottava resolves
  to `systems[2]`.
- **Scripts exist** for Task 7: `build = wp-scripts build`, `lint = biome lint .`,
  `test:unit = wp-scripts test-unit-js`.

## Note (no action required)

Task 7's final acceptance bullet describes a repo-wide search for `measureNumber`
"(as the removed model field)". A literal `grep measureNumber` would still match
the kept internal index counter at `layout.js:1730/1738/1745`. This is not a
defect: the qualifier is explicit, and the plan's "Codebase facts" section, Task
1, and the design's AC5 coverage all clearly distinguish the removed model field
from the kept internal counter, so a code-writer executing the full plan will not
delete the counter. This scoping was present and accepted in review 1 and has not
regressed.
