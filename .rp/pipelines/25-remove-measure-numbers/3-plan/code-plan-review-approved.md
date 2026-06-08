# Code Plan Review

## Verdict: approved

## Summary

This is a re-review of the revised 8-task code plan, prompted by the
orchestrator-directed addition of a new Task 5 that scrubs three stale
measure-number comments living outside the four edited functions in
`src/notation/layout.js`. I verified every cited line, comment string, and
structural claim against live source under `src/notation/`, and I empirically
validated the plan's load-bearing fixture-decision claim by building
`buildLayoutModel(COMPREHENSIVE_SONG, 30)` in a throwaway probe test (since
removed). The plan is complete, ordered correctly, fully traceable, and feasible
against the current codebase. New Task 5 is correct and surgical: it targets
exactly the three stale comments (`:1417` block-header, `:1712` JSDoc, `:2135`
call-site) and explicitly preserves the kept internal-index counter and its
flatten comment (`:1726-1748`). The renumbering of former Tasks 5/6/7 to 6/7/8
is consistent in every location — Overview, the fixture-decision references, the
Task 1 "Task 8's gate" note, every Depends-on edge, and the Task 8 acceptance
list. Nothing previously verified regressed; in fact the Task 8 acceptance was
tightened to whitelist the surviving `measureNumber` counter variable, closing a
latent ambiguity. I approve.

## Verification performed

**New Task 5 (the focus of this re-review) — verified against live source:**

- `layout.js:1417` reads
  `// + spans (ties/slurs) + texts (dynamics, notes, tempo, measure numbers,`
  continuing at `:1418` `// ottava). Everything is in sp units …` — matches the
  plan's quoted text; this is the `buildLayoutModel` block-header banner
  (`:1411-1420`), outside every edited function. ✓
- `layout.js:1712` reads
  `* (tempo, measure number, dynamics, notes, ottava). Resize need only re-run` —
  the `buildLayoutModel` JSDoc (`:1706-1720`), outside every edited function. ✓
- `layout.js:2135` reads
  `// ── System-level texts: tempo + measure number + ottava. ──` directly above
  `const texts = buildSystemTexts(members, measureModels, band);` (`:2136`),
  outside every edited function. ✓
- Kept-counter guard verified intact: the flatten comment "a sequential 1..N
  measure number" at `:1728`, `let measureNumber = 0;` at `:1730`,
  `measureNumber += 1;` at `:1738`, `number: measureNumber` at `:1745`. Task 5
  correctly marks all of these **KEEP** (R5/AC5). ✓
- **Exact-coverage check:** I enumerated every `measure number` / `measureNumber`
  / `measure-number` textual occurrence in `layout.js`. The three "outside the
  edited functions" comments are precisely `:1417`, `:1712`, `:2135` — Task 5's
  targets, no more, no less. The remaining occurrences are either the kept counter
  (1728/1730/1738/1745) or live inside functions already handled by Task 1
  (`buildSystemTexts` JSDoc/body at 2913/2919/2928/2956/3030) and Task 2
  (`topMarginLayout` comment at 2870/2872). Task 5 covers exactly the gap and
  nothing else. ✓

**Carried-over verifications (re-confirmed against source, no regression):**

- Task 1: `head` binding at `:2931`; its only references (`head.number === 1` at
  `:2957`, `String(head.number)` at `:2960`) sit inside the deleted
  `:2954-2964` block; `tempos`/`ottavas` loops iterate `members.forEach`, never
  `head` — so the binding genuinely becomes dead and must be removed. JSDoc at
  `:2913`/`:2919-2920`/`:2928` and return at `:3030` all match. ✓
- Task 2: `showsMeasureNumber` at `:2874`, `Math.max(...)` `innerZone` at
  `:2875-2878`, explanatory comment at `:2869-2873` — all match. ✓
- Task 3: `if (texts.measureNumber)` block at `:1104-1115` and both lead-comment
  mentions at `svg.js:1091-1092` — match. ✓
- Task 4: `constants.js:179-180`, `layout.js:49`, `svg.js:35`; import ordering
  neighbors confirmed (`MAX_STRETCH`→`MEASURE_START_PAD`,
  `LEDGER_WIDTH`→`NOTE_SIZE`). ✓
- Task 7: old test at `:2218-2230` reads `texts.measureNumber` at `:2222`/`:2226`;
  first-system guard tests at `:2059-2079` and `:2081-2115` read only
  `systems[0]`. ✓
- `svg.js:519` `data-measure` write (KEEP) and `svg.test.js` 2-measure
  single-system `SONG` (`:18-65`), `modelFor` (`:67`), and the
  `querySelector('[data-text="annotation"]')` idiom (`:136`,`:146`) — confirmed. ✓

**Fixture-decision claim — empirically validated** (probe test run then removed):
`buildLayoutModel(COMPREHENSIVE_SONG, 30)` wraps to **3 systems**; `systems[0]`
opens on measure 1 (`measureNumber === null`, tempos=1, ottavaAbove=0);
`systems[2]` opens on measure 3 (head `measures[0].number === 3`, formerly
numbered) with **tempos=1 and ottavaAbove=1**, and band fields
`tempoLaneY=3.8 < ottavaAboveLaneY=6.6 < rightStaffTopY=10.8`. This confirms
Task 7 can reuse `COMPREHENSIVE_SONG` for the later-system lane-placement test
exactly as the plan states. Note for the code-writer: the head measure number is
reached via `system.measures[0].number` (the system object exposes `measures`,
not `members`); the plan describes the observable property, not the accessor, so
this is left to TDD and is not a defect.

**Renumbering consistency — confirmed in every location:**
Overview (`:20-26`), fixture-decision (`:70-71`: Task 6 = svg.test.js,
Task 7 = layout.test.js), Task 1's "Task 8's gate" note (`:125`), all Depends-on
edges (Task 3→1; Task 4→1,2,3; Task 5→1; Task 6→3; Task 7→1,2; Task 8→1-7),
and Task 8 acceptance referencing Task 5 (`:424`). Dependency graph is acyclic
and ordering is correct. Build/lint/test scripts exist:
`build = wp-scripts build`, `lint = biome lint .`,
`test:unit = wp-scripts test-unit-js`.

## Notes (non-blocking)

- Task 8 acceptance (`:419-422`) states a repo-wide search finds "no remaining
  reference to ... `measure-number` (the removed `data-text`)." A naive grep will
  still match the `[data-text="measure-number"]` *absence-assertion* selectors
  that Tasks 6 and 7 intentionally add to the test files. The parenthetical
  ("the removed `data-text`") scopes the criterion to the production emit, and
  Tasks 6/7's own acceptance criteria explicitly require those selector-based
  absence checks to exist, so the criterion is satisfiable as intended and the
  plan is internally consistent. Worth the code-writer's awareness when running
  the Task 8 grep, but not a defect — this wording predates the revision and does
  not change what code is written.
- Likewise, the `measureNumber` grep clause in Task 8 was tightened in this
  revision to explicitly whitelist the kept internal-index counter variable
  (`layout.js:1730/1738/1745`) as "the only allowed survivor" — an improvement
  over the prior wording, not a regression.
