# Code Plan Review

## Verdict: rejected

## Summary

The plan is, with one exception, excellent: thorough, well-traced, and verified
against live code. I confirmed the constant placement, the import block shape, the
packing pass (`layout.js:1750-1767`), the placement walk (`leadInset` at `:1974`,
`cx = leadInset` at `:1987`), the both-coordinate coupling correctly landing in a
single atomic task (T3), the dead-store blast radius (the only readers of
`m.noteAccidentalLead` are `:1767` and `:1976`, both rewritten in T3, leaving the
field with zero readers), the TDD RED/GREEN sequence, the baseline of 263 passing
(ran it — `layout.test.js` = 216, `svg.test.js` = 47), the post-change count of 265,
the test-runner invocation, the AC2 RED-then-GREEN arithmetic (current gap ≈ 0.83 sp
< 1.1 threshold, realized ≈ 1.83 sp after T3), the accidental `dx > 0` field, the
`measureLayout`-vs-`buildLayoutModel` empty-measure distinction, and the svg.test.js
non-regression analysis (`:1072`/`:1104` symmetry diffs, `:707-714`/`:1176-1182`
ordering invariants, `:731` trailing-bar X, `svg.js:751` draws `note.x − acc.dx`).
Dependencies are correct and acyclic (T1 → T2 → T3 → T4/T5). The plan is blocked on a
single self-contradiction in T1's import directive, which an implementer could
resolve two different ways. Fix that one item and this is approvable.

## Issues

### Issue 1: T1's import-placement directive contradicts its own "alphabetical order" rationale and the live `layout.js` import block

**What's wrong:** T1 (`code-plan.md:63-66`) says to add `MEASURE_START_PAD` to
`layout.js`'s named-import block "in alphabetical order, between `MAX_STRETCH` and
`MIN_ADV`." Those two anchors are right (`MAX_STRETCH` is at `layout.js:48`,
`MIN_ADV` at `:51`), but the live block has two intervening symbols the directive
omits: `MEASURE_NUMBER_SIZE` (`:49`) and `MID_GAP` (`:50`). Alphabetically,
`MEASURE_START_PAD` sorts AFTER `MEASURE_NUMBER_SIZE` (`MEASURE_N…` < `MEASURE_S…`)
and BEFORE `MID_GAP` (`ME…` < `MI…`), so the correct alphabetical slot is between
`MEASURE_NUMBER_SIZE` (`:49`) and `MID_GAP` (`:50`) — not between `MAX_STRETCH`
(`:48`) and `MIN_ADV` (`:51`). An implementer who obeys the literal anchor would
place the symbol immediately after `MAX_STRETCH`, i.e. BEFORE `MEASURE_NUMBER_SIZE`,
which is not alphabetical and contradicts the stated intent. Two implementers could
diverge here (one honors the anchor, one honors "alphabetical").

Note this affects ONLY the `layout.js` import in T1. The same "between `MAX_STRETCH`
and `MIN_ADV`" phrasing for the `layout.test.js` import (referenced via T2,
`:94-98`) IS correct, because that file's block has no `MEASURE_NUMBER_SIZE` or
`MID_GAP` (confirmed at `layout.test.js:21-22`). Do not change T2.

**Where in plan:** Task T1, Changes bullet 2 (`code-plan.md:63-66`).

**Suggestion:** Reword the directive to: "Insert `MEASURE_START_PAD` in alphabetical
order, between `MEASURE_NUMBER_SIZE` (`:49`) and `MID_GAP` (`:50`)." Optionally drop
the now-irrelevant `MAX_STRETCH (:48)` / `MIN_ADV (:51)` references for that bullet
to avoid reintroducing the ambiguity.

**Why it matters:** Task self-containedness requires that an implementer act with no
guesswork. As written, the directive's literal anchor and its stated alphabetical
rationale disagree, so the task is internally inconsistent and the resulting code
placement is non-deterministic. It is a small, mechanical fix, but it is a real
contradiction against the live file, which is exactly what this review must catch.
