# Design Doc Review

## Verdict: approved

## Summary

This is a complete, well-grounded, and now fully source-accurate design. It excises
the measure-number feature along its single producer/consumer path — the
`measureNumber` computation in `buildSystemTexts` (layout.js:2956, returned at :3030),
the `data-text="measure-number"` draw in `renderSystemTexts` (svg.js:1104-1115), the
`showsMeasureNumber` reservation in `topMarginLayout` (layout.js:2874-2878), and the
now-orphaned `MEASURE_NUMBER_SIZE` constant (constants.js:180, imported at layout.js:49
and svg.js:35) — while explicitly preserving the unrelated internal index that feeds
`data-measure` (layout.js:1730-1745 → svg.js:519). Every code location, the
consumer audit (`texts.measureNumber` read only in the renderer guard and the one
obsolete test at layout.test.js:2222/:2226), the absence of any barrel re-export, and
the non-clipping arithmetic (`MEASURE_NUMBER_SIZE + 1 = 3.2` vs. floor
`SYSTEM_TOP_MARGIN = 5`, `ABOVE_STAFF_PAD = 1`) were verified line-for-line against the
live source on this branch. The two substantive issues from review 1 are resolved: the
AC3/Case-1b later-system lane-placement test is now a committed member of the test set
(Components item b; fully specified in the three-test-guard Key Decision; referenced as a
committed test in Risks R-1 and Failure Modes), and AC2 is given a named guard — the
existing, unmodified first-system tests, with correct reasoning that `systems[0]` opens
on measure 1 so the edited branch yields `innerZone = ledgerTop` before and after.
Review 2's sole issue — stale line-number citations — is also resolved: the doc now
cites `layout.test.js:2059`, `:2081`, and `constants.js:180`, all of which I confirmed
match the live source exactly. Coverage of R1-R5 and AC1-AC6 is faithful and traceable,
alternatives and trade-offs are given for every decision, dependencies and failure modes
are enumerated, and the doc stays at design altitude (it specifies what each test must
assert, deferring fixture authoring to the Plan phase). No genuine defect remains.

## Verification performed

- `layout.test.js:2059` = `it("tempo, ottava, and note lanes stack above the staff", ...)` — confirmed; reads `buildLayoutModel(COMPREHENSIVE_SONG, 200).systems[0]` (single-system, measure 1) and asserts `tempoLaneY < ottavaAboveLaneY < annotationAboveRHLaneY < rightStaffTopY` plus marks on-lane. Valid AC2 guard; correctly unable to guard Case 1b.
- `layout.test.js:2081` = `it("the top margin flexes: no note/ottava → a shallower margin than with them", ...)` — confirmed; reads `systems[0]`, pins the top-margin flex.
- `constants.js:180` = `export const MEASURE_NUMBER_SIZE = 2.2;` (doc comment at :179) — confirmed.
- Producer `buildSystemTexts` measureNumber block (layout.js:2956-2964) and return `{ tempos, measureNumber, ottavas }` (layout.js:3030) — confirmed.
- Reservation in `topMarginLayout`: `showsMeasureNumber = members[0]?.number !== 1` and `innerZone = Math.max(ledgerTop, showsMeasureNumber ? MEASURE_NUMBER_SIZE + 1 : 0)` (layout.js:2874-2878) — confirmed.
- Consumer `renderSystemTexts` guard `if (texts.measureNumber)` emitting `data-text="measure-number"` / `font-size: MEASURE_NUMBER_SIZE` (svg.js:1104-1115) — confirmed.
- Imports at layout.js:49 and svg.js:35; constant referenced in exactly five places; no `export ... from` / `export *` in src/notation/ — confirmed.
- Internal index counter (layout.js:1730-1745) → `data-measure` (svg.js:519), distinct from the visible label — confirmed.
- Consumer audit: `system.texts.measureNumber` read only in the renderer guard and the obsolete test (layout.test.js:2222, :2226) — confirmed.
- Obsolete behavior test "measure 1 is not numbered; a later system numbers its first measure" (layout.test.js:2218) exists and asserts the old behavior — confirmed; correctly slated for replacement.
- Constants `SYSTEM_TOP_MARGIN = 5` (constants.js:93), `ABOVE_STAFF_PAD = 1` (constants.js:103) — confirmed; non-clipping arithmetic holds.
