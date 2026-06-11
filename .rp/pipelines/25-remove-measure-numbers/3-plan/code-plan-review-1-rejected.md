# Code Plan Review

## Verdict: rejected

## Summary

The plan is, in nearly every respect, excellent: it traces every task to a
specific spec AC and design decision, its per-task acceptance criteria are
observable and describe *what must be true* rather than which test to write, the
ordering (producer → spacing → consumer → constant, then test guards, then
verification) is correct and acyclic, and the fixture-reuse decision (that
`COMPREHENSIVE_SONG` at width 30 wraps to 3 systems whose `systems[2]` opens on
measure 3 with `tempos=1` and `ottavaAbove=1`) was verified empirically and is
**confirmed correct** — I reproduced it against the live source. Almost every
line/path citation in the plan checks out against the live tree. It is rejected
for a single but consequential defect: Task 1 explicitly instructs the
code-writer to keep `const head = members[0];` on a justification that is
factually false, which leaves an unused variable — dead code that AC6 forbids and
that neither Task 1's nor Task 7's acceptance criteria would catch. A minor
secondary clarity note on the Task 3 comment edit is included so it can be fixed
in the same pass.

## Issues

### Issue 1: Task 1 leaves `const head = members[0];` as dead code on a false justification

**What's wrong:** Task 1's last "Changes" bullet says: *"Leave the `tempos` and
`ottavas` computations and the `const head = members[0]` binding (**still used by
`members[0]` references**) exactly as-is."* That justification is false. In the
live `buildSystemTexts` (`src/notation/layout.js:2930-3031`), `head` is bound at
line 2931 and used in exactly two places — `head.number === 1` at line 2957 and
`String(head.number)` at line 2960 — **both inside the `measureNumber` block
(`:2954-2964`) that Task 1 deletes.** The `tempos` loop (`:2936`) and the
`ottavas` loop (`:3009`) iterate `members.forEach(...)`; neither references
`head`. So after Task 1's deletion, `const head = members[0];` has zero
consumers and becomes an unused variable. I verified there are no other `head`
uses in the function:

```
$ awk 'NR>=2930 && NR<=3031' src/notation/layout.js | grep -n head
2:	const head = members[0];        # the binding
28:		head.number === 1            # inside the deleted measureNumber block
31:					text: String(head.number),   # inside the deleted measureNumber block
```

I also confirmed against the live Biome config (`biome.json`, `recommended:
true`) that an unused `const head = members[0];` is flagged by
`lint/correctness/noUnusedVariables` ("This variable head is unused"). It is
emitted at **warning** severity, so `npm run lint` (`biome lint .`) still exits
0 — which means **Task 7's lint gate would NOT catch this**, and Task 1's
acceptance criteria (return-shape, `undefined` field, JSDoc) don't mention `head`
either. The dead binding would survive the entire plan undetected.

**Where in plan:** Task 1, "Changes" — final bullet ("Leave … the `const head =
members[0]` binding (still used by `members[0]` references) exactly as-is").
Also implicated: Task 1 "Acceptance" (does not assert `head` was removed) and
Task 7 "Acceptance" (its `npm run lint` check passes despite the warning, and
its repo-wide search greps for `MEASURE_NUMBER_SIZE` / `measureNumber` /
`measure-number` / `showsMeasureNumber` — none of which is `head`).

**Suggestion:** Change Task 1 to instruct deleting the now-orphaned `const head =
members[0];` binding (line 2931) together with the `measureNumber` block, since
`head`'s only consumers are the deleted lines. Add a Task 1 acceptance criterion
such as: *"`buildSystemTexts` declares no variable left unused by the removal
(in particular, the `head`/`members[0]` binding that only the measure-number
computation read is gone)."* Optionally strengthen Task 7's repo-wide search or
note that lint must be free of `noUnusedVariables` warnings, not just errors —
otherwise AC6's "no dead code" is not actually enforced by the plan's gate.

**Why it matters:** A code-writer following the plan literally would keep
`const head = members[0];`, producing exactly the dead code AC6 prohibits
("any code … left unused by the removal does not remain as dead code"). Because
Biome treats this as a non-failing warning, the plan's own verification (Task 7)
would not surface it, so the defect ships. The instruction is also internally
self-contradictory: Task 1 elsewhere correctly aims for "no dead JSDoc/prose" and
cites AC6, yet this bullet directs the writer to retain a dead binding.

### Issue 2 (minor): Task 3's comment edit under-specifies — the lead comment names "measure number" twice

**What's wrong:** Task 3 says: *"In the function's lead comment (`:1089-1093`),
drop **the** 'the measure number' mention…"* (singular). The live lead comment in
`src/notation/svg.js:1089-1093` actually mentions the measure number **twice**:
line 1091 (`"… the measure number, and the ottava brackets."`) and line 1092
(`"Tempo + measure number + ottava labels are plain font text…"`). The singular
"the mention" could be read as removing only one occurrence.

**Where in plan:** Task 3, "Changes" — second bullet (lead-comment edit).

**Suggestion:** Reword to "remove **both** measure-number mentions from the lead
comment (lines 1091 and 1092) so it describes only the tempo marks and ottava
brackets." (Task 3's acceptance criterion — "The function's lead comment no
longer mentions a measure number" — already pins the correct end state, so this
is a wording tightening, not a coverage gap.)

**Why it matters:** Two independent code-writers could produce different comment
text (one removes one mention, one removes both), and a half-edited comment would
leave a stale "measure number" reference — a small AC6 dead-prose smell. The
acceptance criterion constrains the end state, so this is minor and would not
reject on its own, but it is cheap to fix in the same revision.

## Notes for the writer (verified, no action needed)

These were checked against the live source and are **correct** — listed so the
revision does not accidentally "fix" them:

- All line/path citations in the "Codebase facts pinned" section match the live
  tree: `constants.js:179-180`, `layout.js:49` import, `layout.js:1729-1748`
  internal index (KEEP), `topMarginLayout` at `:2865-2910` with the reservation
  at `:2874` (`showsMeasureNumber`) and `:2875-2878` (`Math.max innerZone`),
  `buildSystemTexts` at `:2930-3031` with JSDoc `:2912-2929`, `measureNumber`
  computation `:2954-2964`, return `:3030`; `svg.js:35` import,
  `renderSystemTexts` lead comment `:1089-1093`, emit block `:1104-1115`,
  `data-measure` write `:519`; `layout.test.js:2218-2230` old test (reads
  `texts.measureNumber` at `:2222`/`:2226`), `:2059-2079` and `:2081-2115`
  first-system guards, `COMPREHENSIVE_SONG` at `:931-1034`; `svg.test.js:18-65`
  local `SONG`, `:67` `modelFor`, `[data-text="annotation"]` idiom at `:136`/`:146`.
- The empirical fixture claim is confirmed: `buildLayoutModel(COMPREHENSIVE_SONG,
  30)` yields 3 systems — `systems[0]` (headNum 1, tempos 1, ottavaAbove 0,
  measureNumber null), `systems[1]` (headNum 2), `systems[2]` (headNum 3, tempos
  1, **ottavaAbove 1**). So Task 6's `.find(...)` for a later system with
  `number !== 1`, `tempos.length > 0`, and an `above` ottava resolves to
  `systems[2]`, and width 200 yields a single system (AC2 guard reads
  `systems[0]`). Task 6's lane chain correctly omits the null
  `annotationAboveRHLaneY` for that later system.
- The complete `MEASURE_NUMBER_SIZE` reference set is exactly the five sites the
  design enumerated; Tasks 1–4 remove all visible-label sites and leave the
  internal `let measureNumber = 0` index (`layout.js:1730/1738/1745`) untouched
  (AC5). No e2e spec (`specs/render.spec.js`, `specs/editor.spec.js`) asserts on
  the measure-number label, so removal breaks no end-to-end coverage.
- Task 7's commands all exist: `build` = `wp-scripts build`, `lint` =
  `biome lint .`, `test:unit` = `wp-scripts test-unit-js`.
