# Design Doc Review

## Verdict: rejected

## Summary

The two issues from review 1 are genuinely and well resolved. The revised doc now
**commits** the later-system lane-placement test in its actual test set — it appears in
Components → Modified (item b), is fully specified in the "Specify a three-test guard"
Key Decision (what it must render and assert: a later system with `number ≠ 1`,
`tempos.length > 0`, an above-ottava, with `tempoLaneY < ottavaAboveLaneY <
rightStaffTopY` and each mark landing on its lane baseline), and is referenced
consistently as a committed test (not a prose mitigation) in Risks R-1 and Failure
Modes. AC2 is now given a **named** guard: the existing, unmodified first-system
lane/top-margin tests, with the correct reasoning that `systems[0]` opens on measure 1
so the edited `topMarginLayout` branch produces `innerZone = ledgerTop` before and after
the change. The core design remains sound and verified against the source: the
producer (`buildSystemTexts`), consumer (`renderSystemTexts`), reservation
(`topMarginLayout`), and constant (`MEASURE_NUMBER_SIZE`) all exist as described; the
consumer audit holds (`texts.measureNumber` read only in the renderer guard and the one
obsolete test); there is no barrel re-export of the constant; and the non-clipping
arithmetic is correct against the real constants (`SYSTEM_TOP_MARGIN = 5`,
`ABOVE_STAFF_PAD = 1`, `MEASURE_NUMBER_SIZE = 2.2`, number term `= 3.2`, pinned to the
floor of 5). It is rejected for one factual/traceability defect that the design's own
AC2 and AC3/Case-1b reasoning leans on: the existing tests it points to are cited at the
wrong line numbers — seven times — and those wrong lines point at unrelated tests. This
is a cheap, mechanical fix, but because the AC2 guard and the entire "a new test is
required" argument hinge on pointing at the *correct* existing tests, the citation must
be right.

## Issues

### Issue 1: The named existing AC2 / Case-1b guard tests are cited at the wrong line numbers (seven occurrences), pointing at unrelated tests

**What's wrong:** The design repeatedly identifies its AC2 guard and its
Case-1b/AC3 reference point as "the existing first-system lane/top-margin tests" at
`layout.test.js:2059` ("tempo, ottava, and note lanes stack above the staff") and
`:2081` ("the top margin flexes…"). The descriptive titles are correct, but the line
numbers are not. In the current source those two tests are at **`layout.test.js:1972`**
("tempo, ottava, and note lanes stack above the staff") and **`:1994`** ("the top margin
flexes: no note/ottava → a shallower margin than with them"). The cited lines point at
*different* tests: `:2059` is "staff lines are inset and all content stays inside the
box" and `:2081` falls inside "ties and slurs anchor at the note centers." The wrong
`:2059`/`:2081` pair appears in seven places (design-doc.md lines 101–102, 247, 296–297,
340, 344, 365).

This matters more than a stray typo because the AC2 coverage argument and the AC3/R-1
"why a new test is needed" argument are *built on* these citations. The design's AC2
claim is "these existing tests pin `systems[0]`'s `topMargin` and lane baselines, and
because `systems[0]` opens on measure 1 they pass unchanged." The design's AC3 claim is
"these existing tests only read `systems[0]` (never numbered), so they cannot guard
Case 1b — hence the new later-system test." Both arguments are in fact *true of the real
tests at :1972/:1994* (I verified: both call `buildLayoutModel(COMPREHENSIVE_SONG,
200).systems[0]`, a single-system render opening on measure 1, and assert
`tempoLaneY < ottavaAboveLaneY < annotationAboveRHLaneY < rightStaffTopY` and the
top-margin flex). So the reasoning is sound — it just points at the wrong code, and a
reviewer or implementer who opens `:2059`/`:2081` to confirm the AC2 guard will find
tests that assert nothing about top margin or lane stacking, breaking the traceability
the doc depends on.

**Where in design doc:** Components → Modified (`layout.test.js` bullet, lines 101–102);
Key Decisions → "Specify a three-test guard" (line 247); Key Decisions → "Coverage of
the remaining acceptance criteria → AC2" (lines 296–297); Failure Modes (lines 340, 344);
Risks → R-1 (line 365).

**Suggestion:** Replace every `layout.test.js:2059` / `:2081` citation with
`layout.test.js:1972` ("tempo, ottava, and note lanes stack above the staff") and
`layout.test.js:1994` ("the top margin flexes…"). Optionally cite the tests by their
descriptive title alongside the line number so a future line drift is self-correcting.

**Why it matters:** Traceability is a core review bar: a named guard must point at the
test it claims to be. The AC2 coverage and the AC3/Case-1b "new test required" rationale
are the two arguments review 1 forced into the doc; both now resolve correctly *only* if
the citation resolves to the right tests. As written, anyone verifying the design against
the suite is sent to unrelated tests, which undermines the very guarantees the revision
was meant to nail down.

### Issue 2: `MEASURE_NUMBER_SIZE` is cited at the wrong line (line 180 vs. actual 168)

**What's wrong:** Components → Modified states the constant is "Defined at line 180 with
a doc comment." In the current source `MEASURE_NUMBER_SIZE = 2.2` is at
**`constants.js:168`** (the doc comment "Measure-number text size…" is at `:167`). The
substance is correct — the constant exists, has a doc comment, is imported in `layout.js`
and `svg.js`, and has exactly five references with no barrel re-export — only the line
number is off.

**Where in design doc:** Components → Modified, `constants.js` bullet (line 90).

**Suggestion:** Change "Defined at line 180" to "Defined at line 168" (doc comment at
167), or drop the specific line number and refer to it by name, since the design already
identifies it unambiguously by symbol.

**Why it matters:** Same traceability bar as Issue 1, lower stakes (this citation is not
load-bearing for any argument and the symbol name disambiguates). Flagged so the doc's
code references are accurate end-to-end; correcting it alongside Issue 1 is near-zero
cost.
