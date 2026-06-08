# Design Doc Review

## Verdict: rejected

## Summary

This is a strong, unusually well-grounded design. Every code location it names was
verified line-for-line against the source (`buildSystemTexts` producer at
`layout.js:2956-2964` / return `:3030`, `topMarginLayout` reservation at
`layout.js:2874-2878`, `renderSystemTexts` consumer at `svg.js:1104-1115`, the
`MEASURE_NUMBER_SIZE` constant at `constants.js:180` with imports at `layout.js:49`
and `svg.js:35`, the kept internal counter at `layout.js:1730-1748` feeding
`data-measure` at `svg.js:519`, and the single obsolete test at
`layout.test.js:2218-2230`). The non-clipping arithmetic is correct against the real
constants (`SYSTEM_TOP_MARGIN=5`, `ABOVE_STAFF_PAD=1`, `MEASURE_NUMBER_SIZE=2.2`, so
the number term is a fixed `3.2`, which can never lift `topMargin` past the floor of
`5` on its own). Coverage of R1, R2, R4, R5 and AC1, AC2, AC4, AC5, AC6 is faithful
and traceable, and the doc reflects the research with nothing silently dropped. It is
rejected for one substantive internal inconsistency: the design relies on an
"AC3-style test" as the named mitigation for the single path it admits changes pixels,
but never commits that test in its Components or test-strategy sections — so AC3's
non-regression guarantee on that exact path ends up with no committed coverage. A
second, smaller traceability gap (AC2) compounds the same under-commitment.

## Issues

### Issue 1: The named AC3 / R-1 mitigation test is never committed in the design's test set

**What's wrong:** The design identifies Case 1b — a *later* (numbered) system that
*also* carries a tempo or ottava lane — as "the ONLY path that changes pixels"
(Key Decisions, Risks R-1, Failure Modes). For that path it repeatedly names a
specific mitigation: "the AC3-style test with tempo and ottava on a later system
confirms marks remain present and correctly placed" (Failure Modes bullet 2;
Risks R-1 mitigation). But the design's committed test set — enumerated in
**Components → Modified** and in **Key Decisions → "Replace the one old test…"** — is
exactly two tests: a model-level *absence* test (every system lacks `measureNumber`)
and a DOM-level *absence* test (zero `[data-text="measure-number"]` nodes). Neither
asserts anything about tempo/ottava placement, and neither targets a later numbered
system carrying a lane. So the test the design leans on as its R-1/AC3 safeguard is
referenced but never actually added.

This is not covered by the existing suite either. The only lane-stacking tests
(`layout.test.js:2059` "tempo, ottava, and note lanes stack above the staff" and
`:2081` "the top margin flexes…") both operate solely on `systems[0]` — the first
system, which opens on measure 1 and was therefore *never numbered*. They never
exercised the number-binding `innerZone` path, so they cannot serve as the Case 1b
guard the design invokes. The result: AC3's non-regression guarantee on the one path
the design itself says changes pixels has **no committed test** — only a prose
arithmetic argument.

**Where in design doc:** Internal inconsistency between (a) "Failure Modes and
Observability" (bullet "the top-margin collapse clips or overlaps real above-staff
content" → "Detected by an AC3-style test that renders a wrapping song with tempo
changes and ottava brackets on later systems") and "Risks → R-1" (same mitigation),
versus (b) "Components → Modified" (`layout.test.js`, `svg.test.js` entries) and
"Key Decisions → Replace the one old test…", which commit only the two absence tests.

**Suggestion:** Make the test set match the claims. Either (a) add the AC3-style
later-system lane test to the committed test list (Components and the test-strategy
Key Decision), specifying it renders a wrapping song with a tempo change and an
ottava bracket on a system *after the first* and asserts those marks are present and
land on their expected lanes (e.g. `tempoLaneY`/`ottavaAboveLaneY`, marks not
clipped) — i.e. promote it from prose mitigation to a committed test; or (b) if the
intent is to rely solely on the arithmetic proof plus the existing suite, then delete
the "AC3-style test" language from Failure Modes and R-1 and explicitly state that
AC3 on Case 1b is covered by argument rather than a test — and justify why that is
sufficient. As written, the doc claims a mitigation it does not deliver.

**Why it matters:** Case 1b is the design's own highest-attention risk and its only
behavior-changing path. Leaving it guarded only by a prose argument — while the doc
asserts a test guards it — means two implementers could reasonably build different
test suites, and a future regression to the lane stacking on later systems would ship
undetected. Traceability to AC3 ("above-staff marks survive on later lines… no
overlap or clipping introduced by the removal") is the weakest link in an otherwise
fully-traced design, and the doc currently papers over that gap rather than resolving
it.

### Issue 2: AC2's "no other above-staff element is added, removed, or shifted" has no committed test and is asserted only by prose

**What's wrong:** AC2 requires that for a single-line song, "no other above-staff
element is added, removed, or shifted by the change." The design addresses AC2 only
in the "Coverage of the remaining acceptance criteria" prose ("The producer/consumer
edits do not add, remove, or shift tempos or ottavas, so a one-system render is
unaffected apart from the (already-absent) label"). No committed test pins this.
On its own this would be a borderline, possibly-acceptable prose argument for a
"nothing changes" criterion — but combined with Issue 1 it shows a consistent pattern
of the test plan under-committing relative to the design's own stated guarantees, and
the single-system top-margin path *does* touch the edited `topMarginLayout` code, so
"unaffected" is a claim worth a cheap pin rather than asserting by inspection.

**Where in design doc:** "Key Decisions → Coverage of the remaining acceptance
criteria → AC2"; absence of any corresponding entry in "Components → Modified" tests.

**Suggestion:** Either add a small committed assertion that a single-system render's
`topMargin` / lane baselines are unchanged by the edit (a cheap regression pin, e.g.
the existing first-system lane test already nearly covers this and could be cited
explicitly as the AC2 guard), or explicitly state in the doc that AC2 is covered by
the existing `systems[0]` lane/top-margin tests (`layout.test.js:2059`, `:2081`),
naming them, so the coverage is traceable rather than implied.

**Why it matters:** Traceability is a core review bar: every acceptance criterion
should map to a concrete decision *or* a concrete test, not to a bare prose assurance.
AC2 currently maps to neither a new test nor an explicitly-named existing one. Naming
the existing coverage (or adding a pin) closes the gap with near-zero cost and removes
ambiguity about what the implementer must verify.
