# Design doc review — APPROVED

**Subject:** `2-design-doc/design-doc.md` — Move annotations above the tempo marking (issue #20)
**Reviewer:** design-doc-reviewer
**Verdict:** APPROVED
**Iteration:** 1

## Summary

The design is sound, complete, faithful to the approved spec, and its code-level
claims are correct. The chosen approach — a pure permutation of the three
reservation `if`-blocks in `topMarginLayout` to source order
`[ottava, tempo, annotations]` — is the smallest correct change and is fully
justified by evidence I independently re-verified against the source. Every
requirement (R1–R9) and acceptance criterion (AC1–AC10) is genuinely addressed.

## What I verified against the source

### Core reorder mechanic (R1, R2)
- `topMarginLayout` is at `src/notation/layout.js:2865-2910`. Confirmed the
  reservation loop: `d`/`topExtent` accumulators, three presence-guarded blocks
  in source order [annotations `:2885-2891`, ottava `:2892-2896`, tempo
  `:2897-2901`], `topMargin = max(SYSTEM_TOP_MARGIN, topExtent + ABOVE_STAFF_PAD)`
  (`:2902`), `at(dist) = topMargin − dist` (`:2903`).
- The invariant "reserved later ⇒ larger `d` ⇒ smaller Y ⇒ higher" holds, so
  source order `[ottava, tempo, annotations]` yields visual top→bottom
  `annotations → tempo → octaveShift`. Confirmed.
- No hidden cross-block coupling: each `*D` is written once (own block) and read
  once (return `:2904-2909`); only `d`/`topExtent` are shared. The blocks are
  freely permutable; the return and `at()` need no edit. Confirmed.

### Numeric claims (R4, R5, R8) — independently reproduced
- Re-ran the subset simulation with the real constants (NOTE_SIZE=2.8,
  TEXT_LANE_GAP=0.6, OTTAVA_SIZE=2.2, TEMPO_SIZE=2.8, ABOVE_STAFF_PAD=1,
  SYSTEM_TOP_MARGIN=5; `constants.js`). Every row of the design's subset table
  reproduced exactly: all-three n=1 → topMargin 11, ann 3.8, temp 7.2, ott 10;
  ann+tempo → 8.2; tempo+ott → 7.6 (unchanged); nothing → 5. Ordering
  `ann < temp < ott` holds in every subset (R4, R8).
- Deep stack n=3 reproduced exactly: topMargin 17.8, lowest annotation 10.6,
  tempo 14.0 → lowest annotation strictly above the tempo (10.6 < 14.0), topmost
  glyph top sits exactly 1 sp above the staff top (= ABOVE_STAFF_PAD). The AC5
  invariant holds and the margin grows. Confirmed.

### No horizontal / downstream change (R6, R7) — independently reproduced
- Simulated OLD vs NEW order topMargin across all subsets including deep stacks.
  Difference is **exactly 0** for every non-deep subset and ~1.8e-15…3.6e-15 sp
  for deep multi-line annotation stacks — exactly the design's documented benign
  ULP note (≤3.6e-15 sp). Since `topMargin` is the only geometry output and it is
  order-invariant, all downstream Ys (`rhBottomY`, inter-staff gap, `lhTopY`,
  `bottomMargin`, `systemHeight`, the four band `baseY`s) and all horizontal
  layout are unchanged. Confirmed (`layout.js:1871-1962`).
- The return is consumed at exactly the four sites the design lists; only
  `aboveRH.baseY` (`:1944`) is sourced from a top-margin lane; belowRH/aboveLH/
  belowLH derive from staff Ys only (`:1948-1962`); `ottavaLeftAboveLaneY`
  derives from `lhTopY` (`:1933-1935`), independent of reservation order; "below"
  ottava emits at `staffBottomY + 2` (`:3004`). R7 holds.

### Both-hands scoping (R3)
- Band routing is a pure `(hand, placement)` function with no override:
  `noteBandResolver` (`svg.js:487-508`) and `bandKeyFor` (`svg.js:581-587`). A
  left-hand annotation can never select `aboveRH`. Single system-level tempo
  emitted once at `band.tempoLaneY` (`layout.js:2948`). Confirmed.

### Documentation sweep (R9 / AC10)
- All three flagged sites describe the OLD order and require updating:
  - **M1 `layout.js:2850-2852`** — "the above-RH note lane nearest the staff,
    then an above-staff ottava, then the tempo at the very top" = old order.
  - **M2 `layout.js:1866`** — "(the above-RH note stack, an above-staff ottava,
    the tempo) stacked over the ledger zone" = old innermost→outermost.
  - **M3 `layout.js:2947`** — "// Topmost lane, above the note zone." (the tempo
    emit) = false under the new order (tempo becomes the middle lane).
- An independent grep for order-bearing language (`topmost`, `nearest the
  staff`, `at the very top`, `above the ottava/tempo`, `stacked over`, etc.)
  across `layout.js`, `constants.js`, `svg.js` surfaced no additional
  order-asserting comments. The design's "leave" list is correctly classified:
  `constants.js:100` ("above the topmost lane" — generic, still true),
  `layout.js:1847` (below-band hug — unrelated), `layout.js:2887` ("stack grows
  UP" — internal direction, AC3). No project markdown describes the visual stack
  order. Confirmed.

### Verification strategy (AC1–AC10), incl. the deep-stack AC5 invariant
- The single order-asserting test is `layout.test.js:2059-2079`; its comment
  (`:2064-2065`) and the two assertions (`:2066-2069`) state the old order and
  flip as the design describes; the third assertion
  (`annotationAboveRHLaneY < rightStaffTopY`, `:2070-2072`) and the two
  emit-tracks-lane loops (`:2073-2078`) stay valid. Confirmed this is the ONLY
  order-asserting test (grep of all LaneY comparisons).
- AC3 test (`:2606-2636`) is value/direction-tracking, not order/absolute — it
  survives. AC6 test (`:3776-3787`) compares both unchanged endpoints
  (`ottavaAboveLaneY`, `ottavaLeftAboveLaneY`) — it survives. Null-lane presence
  (`:3693-3695`, `:3741`, `:2113-2114`) and top-margin flex (`:2081-2115`)
  survive (guard- / topMargin-driven). Confirmed.
- The AC5 deep-stack invariant is correctly identified as currently untested
  (the only above-RH fixture, `COMPREHENSIVE_SONG`, has `aboveRHCount = 1`) and
  the design adds a focused test (≥2 same-anchor above-RH annotations + a tempo)
  asserting (a) `annotationAboveRHLaneY < tempoLaneY` and (b) topMargin grows.
  This genuinely covers the subtlest invariant the change relies on. The AC
  coverage map (§7.5) is complete and accurate.

## Minor, non-blocking observation (no action required)

- Design §2.4 (line 108) cites `STACK_STEP` at `layout.js:1945`; that line is a
  *use* (`step: STACK_STEP` in the band), while the local definition is at
  `layout.js:1835`. The equivalence claim itself is correct — both equal
  `NOTE_SIZE + TEXT_LANE_GAP` — and the imprecise line reference affects no
  decision. Not grounds for rejection; flagged only for the implementer's
  convenience.

## Conclusion

The approach is correct and minimal, the scope-isolation argument (D2) holds
under independent simulation, the R9 sweep is complete (all three doc sites
correctly classified), and the verification strategy covers every AC including
the deep-stack AC5 invariant. **APPROVED.**
