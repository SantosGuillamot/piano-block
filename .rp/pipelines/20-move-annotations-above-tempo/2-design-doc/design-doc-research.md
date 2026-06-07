# Design doc research — Move annotations above the tempo marking (issue #20)

> Status: COMPLETE. This document records the design decisions, the evidence
> behind each, the trade-offs considered, and how every spec requirement
> (R1–R9) and acceptance criterion (AC1–AC10) is satisfied.

## 1. Problem framing

The sheet-music renderer stacks up to three markings in the column above the top
(right-hand / treble) staff: the above-RH **annotations** lane, the right-hand
positive **octaveShift** ("ottava") bracket, and the system-level **tempo** mark.
Today they read, top to bottom, **tempo → octaveShift → annotations** (annotations
hug the staff). The owner wants **annotations → tempo → octaveShift**: the
annotation lane moves from nearest the staff to the topmost position, while tempo
and octaveShift keep their relative order. This is a vertical reorder only —
horizontal layout must not change (R6), and everything outside this column must be
unchanged (R7).

## 2. Where the layout is decided (orientation)

- The entire above-the-top-staff stack is computed in `topMarginLayout`
  (`src/notation/layout.js:2865-2910`). It returns `topMargin` plus three lane
  baselines: `annotationAboveRHLaneY`, `ottavaAboveLaneY`, `tempoLaneY`
  (null when absent).
- `topMarginLayout` is called once per system at `layout.js:1870`
  (`topMarginLayout(members, ledgerTopExtent(members), occ.aboveRH)`).
- Its three outputs flow into the system `band` at `layout.js:1928-1944`:
  `band.tempoLaneY`, `band.ottavaAboveLaneY`, `band.annotationAboveRHLaneY`, and
  `band.bands.aboveRH.baseY = top.annotationAboveRHLaneY` (the above-RH annotation
  band is the ONLY band sourced from `topMarginLayout`).
- The emit layer is order-agnostic: `buildSystemTexts` (`layout.js:2930+`) places
  the tempo at `band.tempoLaneY` (`:2948`) and ottavas at
  `band.ottavaAboveLaneY` / `band.ottavaLeftAboveLaneY` (`:2980-2981`); `svg.js`
  renders purely from the computed Y values and never hardcodes a vertical order.

### Mechanic of `topMarginLayout`

- Local `stackStep = NOTE_SIZE + TEXT_LANE_GAP` (`:2868`) — equals the band emit's
  `STACK_STEP` (`layout.js:1835`), so the reservation step matches actual rendering.
- `innerZone = max(ledgerTop, measure-number room)` (`:2875-2878`); running
  distance `d = innerZone + ABOVE_STAFF_PAD` (`:2880`); `topExtent = innerZone`
  (`:2881`).
- Three guarded if-blocks reserve in source order, each advancing `d`/`topExtent`:
  1. annotations — guard `aboveRHCount > 0` (`:2885-2891`); reserves the FULL
     multi-line stack: `topExtent = d + (aboveRHCount − 1)*stackStep + NOTE_SIZE`.
  2. ottava — guard `systemHasRightOttavaAbove(members)` (`:2892-2896`).
  3. tempo — guard `systemHasTempo(members)` (`:2897-2901`).
- `topMargin = max(SYSTEM_TOP_MARGIN, topExtent + ABOVE_STAFF_PAD)` (`:2902`);
  `at(dist) = topMargin − dist` (`:2903`). Reserved-later ⇒ larger `d` ⇒ smaller
  Y ⇒ higher on the page. Today's reservation order [annotations, ottava, tempo]
  ⇒ visual top→bottom [tempo, ottava, annotations].

## 3. Chosen approach

Reorder the three reservation if-blocks in `topMarginLayout` to source order
**[ottava, tempo, annotations]**, which yields visual top→bottom
**annotations → tempo → octaveShift(ottava)**. The block reservation chains
purely through the `d`/`topExtent` accumulators with no cross-block coupling
(D1), so this single permutation is the smallest correct change; declarations,
the return, and `at()` are untouched. Update three order-bearing comments for R9
(M1 `:2850-2852`, M2 `:1866`, M3 `:2947`; D3). No other production change. See
Section 4 for the per-topic evidence and Section 8 for the decision summary.

## 4. Design Q&A log

### Topic 1 — Core reorder mechanic and hidden cross-block coupling

**Question.** Is a pure reorder of the three reservation if-blocks
([annotations, ottava, tempo] → [ottava, tempo, annotations]) sufficient and
correct, with no hidden cross-block coupling, no return-statement change, and
correct `topExtent`/`topMargin` across all subset combinations (including the
deep multi-line annotation stack)?

**Evidence (researcher, code trace + numeric simulation).**

Per-block read/write inventory of the three if-blocks:
- annotations (`:2885-2891`): reads `aboveRHCount`, `d`, `stackStep`,
  `NOTE_SIZE`, `TEXT_LANE_GAP`; writes `annotationAboveRHD = d` (`:2886`),
  `topExtent` (`:2889`), `d` (`:2890`).
- ottava (`:2892-2896`): reads `systemHasRightOttavaAbove(members)`, `d`,
  `OTTAVA_SIZE`, `TEXT_LANE_GAP`; writes `ottavaD = d` (`:2893`), `topExtent`
  (`:2894`), `d` (`:2895`).
- tempo (`:2897-2901`): reads `systemHasTempo(members)`, `d`, `TEMPO_SIZE`,
  `TEXT_LANE_GAP`; writes `tempoD = d` (`:2898`), `topExtent` (`:2899`),
  `d` (`:2900`).

Findings:
- **No hidden coupling.** Each `*D` is written exactly once (in its own block)
  and read exactly once (in the return at `:2906-2908`). No block reads another
  block's `*D`. The only inter-block channels are the shared accumulators `d`
  and `topExtent`. The three blocks are therefore freely permutable.
- **Return / `at()` unchanged.** The return (`:2904-2909`) maps each lane field
  to its own `*D`; `at(dist) = topMargin − dist` is a pure per-distance
  transform. Reordering the blocks changes which lane receives the larger `d`,
  and the return reflects that with no edit.
- **`topExtent`/`topMargin` correct across all subsets.** Every present block
  sets `topExtent` to its own outer edge, so the LAST present block always
  leaves `topExtent` at the true outermost edge; absent blocks are skipped.
  Because `topMargin` sums the same set of glyph heights regardless of order,
  it is identical to today's value in every subset and can never come out
  smaller than the real stack height. Simulated values (sp), new order, all
  satisfy annotation < tempo < ottava (smaller Y = higher):

  | subset | topMargin | annotation | tempo | ottava |
  |---|---|---|---|---|
  | all three (n=1) | 11.00 | 3.80 | 7.20 | 10.00 |
  | annotations only | 5.00 | 4.00 | — | — |
  | ottava only | 5.00 | — | — | 4.00 |
  | tempo only | 5.00 | — | 4.00 | — |
  | annotations + tempo (no ottava) | 8.20 | 3.80 | 7.20 (hugs staff) | — |
  | tempo + ottava (no annotations) | 7.60 | — | 3.80 | 6.60 (unchanged) |
  | nothing above | 5.00 (= SYSTEM_TOP_MARGIN) | — | — | — |

- **Deep-stack reservation correct.** With annotations reserved LAST, line
  `:2889` `topExtent = d + (aboveRHCount − 1)*stackStep + NOTE_SIZE` uses the
  `d` already advanced past ottava + tempo, so the whole stack reserves on top
  of them. Simulated all-three with `aboveRHCount = 3`: `topMargin = 17.80`,
  lowest annotation baseline (note #0) `= 10.60`, `tempoLaneY = 14.00` ⇒ the
  lowest annotation line is strictly above the tempo (10.60 < 14.00); the
  topmost glyph top sits 1.00 sp above the staff top, inside `topMargin` with
  the `ABOVE_STAFF_PAD = 1` clearance. No annotation line overlaps tempo or
  ottava.

**Decision (D1).** Implement the reorder as a pure permutation of the three
reservation if-blocks in `topMarginLayout` to source order
**[ottava, tempo, annotations]**. The variable declarations (`:2882-2884`),
the return statement (`:2904-2909`), and `at()` are left untouched. The change
is literally "move the `aboveRHCount` block to run after the ottava and tempo
blocks."

**Benign note (record for reviewers).** In the deep all-three case the
new-order `topMargin` differs from the old-order value by ~3.6e-15 sp — pure
floating-point accumulation-order noise (the additions are mathematically
commutative; only the last ULP shifts). At `SP_PX = 8` that is ~3e-14 px,
far below any visible or test-relevant threshold (all order assertions are
strict `<` with margins ≥ 0.6 sp). No mitigation needed; noted so a reviewer
diffing raw `topMargin` values is not surprised by a non-bit-identical result.

### Topic 2 — Scope isolation: the reorder touches only the above-RH band

**Question.** Prove the reorder is surgically contained: no other lane, band,
margin, or system dimension depends on the *order* in which `topMarginLayout`
reserves, so R7 (no regression in unaffected regions) and the "both hands"
reading of R3/R4 hold.

**Evidence (researcher, grep-backed).**

- **`topMarginLayout` return is read at exactly four sites** (grep of `top.` in
  non-test `layout.js`): `top.topMargin` (`:1871`), `top.tempoLaneY` (`:1928`),
  `top.ottavaAboveLaneY` (`:1929`), `top.annotationAboveRHLaneY` (`:1936` and
  `:1944`). No other field is consumed anywhere. **`topMargin` is the only
  return value any downstream GEOMETRY depends on**; the three lane Ys feed only
  the text/ottava emit and the above-RH band's own `baseY`.
- **Consequence.** Since `topMargin` is order-invariant per input (Topic 1),
  `rhBottomY = topMargin + STAFF_HEIGHT_SP` (`:1872`) and everything derived
  from it — `effectiveInterStaffGap` (`:1901-1905`), `lhTopY` (`:1906`),
  `lhBottomY` (`:1907`), `bottomMargin` (`:1912-1915`), `systemHeight`
  (`:1916`), and all four band `baseY`s — is unchanged except the ≤3.6e-15 sp
  ULP noise. The reorder changes ONLY which of the three top-margin lanes is
  highest; nothing else moves.
- **The other three bands derive from staff Ys only**, never from a top-margin
  lane Y: `belowRH.baseY = rhBottomY + belowRHBase` (`:1948-1952`),
  `aboveLH.baseY = lhTopY − NOTE_GAP_STAFF` (`:1953-1957`),
  `belowLH.baseY = lhBottomY + belowLHBase` (`:1958-1962`). Only
  `aboveRH.baseY` (`:1944`) is sourced from a top-margin lane. R7 holds for
  belowRH / aboveLH / belowLH.
- **`ottavaLeftAboveLaneY`** (LH-above ottava, inter-staff gap) is computed at
  `:1933-1935` from `lhTopY` and LH extents — independent of the reservation
  order. Both endpoints of the RH-above-vs-LH-above relationship are unchanged,
  so AC6 / the test at `layout.test.js:3776-3787` is preserved.
- **"Below" ottava** (negative shift) emits at `staffBottomY + 2`
  (`buildSystemTexts`, `layout.js:3004`), independent of the top-margin lanes.
  Untouched (R7). (Verified independently: the "above" branch uses
  `ottavaAboveLaneY`/`ottavaLeftAboveLaneY` at `:2978-2981`; only the RH-above
  value participates in this change, and only its order relative to
  tempo/annotations changes.)
- **"Both hands" scoping.** Band routing is a pure `(hand, placement)` function
  with no override: per-event notes via `noteBandResolver`
  (`svg.js:487-508`, `leftHand → aboveLH/belowLH`, `rightHand → aboveRH/belowRH`;
  callers `:533`, `:541`); standalone annotations via `bandKeyFor`
  (`svg.js:581-587`, identical rule; caller `:619`). A left-hand annotation can
  NEVER select `aboveRH`. The single system-level tempo (one emit at
  `band.tempoLaneY`, `layout.js:2948`; no per-hand tempo) sits above the whole
  grand staff, so moving annotations above that one tempo serves both hands at
  once without relocating any LH band.

**Decision (D2).** The change is confined to the relative vertical order of the
three top-margin lanes inside `topMarginLayout`. No downstream geometry, no
other band, no LH/inter-staff/below marking, and no horizontal value is
affected. "Both hands" is satisfied structurally by the single grand-staff
tempo; no LH band is moved. This confirms R3, R4 ("both hands"), R6 (horizontal
geometry is wholly outside `topMarginLayout`), and R7.

### Topic 3 — Complete documentation sweep for R9 / AC10

**Question.** R9/AC10 require that NO documentation continue to describe the old
order. The spec/research called out only one site (the `topMarginLayout`
doc-comment). Sweep exhaustively and classify every order-bearing comment.

**Evidence (researcher + independent verification).** Order-bearing language
about the above-top-staff stack is confined to `src/notation/` (`layout.js` +
`constants.js`). No project markdown (`docs/song-format.md`, `README`) describes
the visual stack order — those describe the JSON song format and placement
(above/below the staff), which is unchanged. `.rp/*` pipeline artifacts are out
of R9 scope.

**MUST-UPDATE (3 sites).**

- **M1 — `layout.js:2850-2852`** (the `topMarginLayout` doc-comment, the site
  the spec already flagged). Current order-bearing sentence states the old
  innermost→outermost = [annotations, ottava, tempo] ("the above-RH note lane
  nearest the staff, then an above-staff ottava, then the tempo at the very
  top"). Rewrite to the new order: an above-staff ottava nearest the staff, then
  the tempo, then the above-RH note (annotation) lane at the very top. Drop the
  trailing "(and the tempo)" parenthetical, which assumed the tempo was
  outermost. The following sentence (`:2853-2855`, "The above-RH lane reserves
  height for the WHOLE stack … so a deep above-RH stack lifts the lanes (and the
  margin) above it") stays true — LEAVE.
- **M2 — `layout.js:1866`** (the call-site comment). Current "(the above-RH note
  stack, an above-staff ottava, the tempo) stacked over the ledger zone" lists
  innermost→outermost in the OLD order. Rewrite to "(an above-staff ottava, the
  tempo, the above-RH note stack) stacked over the ledger zone". Rest of the
  comment stays true. **Additional to the spec's flagged site.**
- **M3 — `layout.js:2947`** (the tempo emit comment). Current "// Topmost lane,
  above the note zone." is false under the new order (the tempo is now the
  MIDDLE lane; annotations are topmost). Rewrite to make the tempo the middle
  lane, e.g. "// Middle lane: above the ottava, below the above-RH annotation
  lane." **Additional to the spec's flagged site.**

**LEAVE (order-agnostic; rationale).**

- `constants.js:100` (`ABOVE_STAFF_PAD`): "…and above the topmost lane" is
  generic — there is still a topmost lane (now annotations); no old-order claim.
- `constants.js:106` (`TEXT_LANE_GAP`): "(chord / ottava / tempo)" is an
  unordered example list of glyphs that use the gap, not a top-to-bottom claim.
  (Optional nicety: "chord" is the legacy name for the above-RH annotation lane;
  renaming is not an R9 obligation since no order is asserted.)
- `layout.js:2701-2707` (`systemHasTempo` doc): says which texts need a lane;
  no order claim.
- `layout.js:2887` ("the stack grows UP … topmost note's glyph"): describes the
  annotation stack's internal growth direction (still up — AC3), not inter-lane
  order.
- `layout.js:2869` ("The innermost reserved zone … high notes/ledgers AND the
  measure number"): describes the inner zone below all three lanes; unchanged.
- `layout.js:1712`, `layout.js:2135`, `svg.js` `renderSystemTexts` doc,
  `layout.js:2912-2928` (`buildSystemTexts` doc): unordered enumerations of text
  KINDS produced; no vertical order.
- `docs/song-format.md`, `README`: describe the song format / placement
  semantics, not the inter-lane stack order.

**Tests describing the old order (for the test-impact topic).** Independent
grep found exactly ONE: `layout.test.js:2059` block — its comment (`:2064-2065`,
"Stacked top→bottom: tempo above the ottava above the above-RH note lane") and
the two ordering assertions (`:2066-2069`). The 2082-2084 comment is
order-agnostic. The e2e spec (`specs/render.spec.js`) has no tempo-vs-annotation
order check (its only vertical assertion, `:803`, is above-note vs below-note).

**Decision (D3).** The full R9/AC10 surface is THREE production comments
(M1 `layout.js:2850-2852`, M2 `layout.js:1866`, M3 `layout.js:2947`). M2 and M3
are additional to the single site the spec called out; the design doc records
all three so the implementation phase satisfies AC10 completely. No markdown
doc requires change.

### Topic 4 — Test & verification strategy

**Question.** Which tests change, what are the exact new assertions, and should
the design recommend adding coverage for the deep-stack (AC5) and subset (AC4)
cases?

**Evidence (researcher + independent verification).**

- **The one order-asserting test (`layout.test.js:2059-2079`).** Exactly two
  assertions flip, plus the comment. Current (`:2064-2069`): comment "Stacked
  top→bottom: tempo above the ottava above the above-RH note lane" and
  `tempoLaneY < ottavaAboveLaneY` then `ottavaAboveLaneY < annotationAboveRHLaneY`.
  New: comment "the above-RH note (annotation) lane above the tempo above the
  ottava" and `annotationAboveRHLaneY < tempoLaneY` then
  `tempoLaneY < ottavaAboveLaneY`. The third assertion
  (`annotationAboveRHLaneY < rightStaffTopY`, `:2070-2072`) stays valid (the
  annotation lane is still above the staff top, now further above). New chain:
  `annotationAboveRHLaneY < tempoLaneY < ottavaAboveLaneY < rightStaffTopY`
  (AC1). The two emit-tracks-lane loops (`:2073-2075` `t.y ≈ tempoLaneY`;
  `:2076-2078` `o.y ≈ ottavaAboveLaneY`) stay as-is — `buildSystemTexts` still
  emits at those lanes (`layout.js:2948`, `:2980`) (AC2).
- **No other existing unit test changes** (each survives the pure value shift):
  - `:2606-2612` — `aboveRH.baseY == annotationAboveRHLaneY` + grows up: value-
    tracking + direction (still sourced at `layout.js:1944`, direction "up" at
    `:1946`), not an absolute Y. Survives (AC3).
  - `:3776-3787` — RH-above vs LH-above ottava: both endpoints unchanged by the
    reorder. Survives (AC6).
  - `:3694-3695`, `:3741`, `:2113-2114` — null-lane presence: guard-driven
    (`systemHasRightOttavaAbove` / `systemHasTempo`), unchanged by a block
    reorder. Survive.
  - `:2081-2115` — top-margin flex (rich > plain): `topMargin` order-invariant
    per input (Topic 1). Survives (AC8).
  - `:3714-3749` — LH-only +1 shift doesn't deepen the top margin: `topMargin`
    + presence guard unchanged. Survives.
- **e2e (`specs/render.spec.js`)** — no change. Its only vertical comparison is
  `:803` (above-note vs below-note bounding boxes); no tempo-vs-annotation Y
  comparison exists. The reorder doesn't move below-* relative to above-*.
- **Coverage gap.** `COMPREHENSIVE_SONG` (`layout.test.js:931-1034`) carries
  exactly ONE above-RH annotation ("C", `:950`), so its system has
  `aboveRHCount = 1`. The 2059 block exercises only n=1 ordering. **AC5 (deep
  stack: ≥2 same-anchor above-RH annotations, lowest line strictly above the
  tempo, margin grows) is currently untested** and would pass only implicitly —
  yet it is the subtlest invariant (the whole multi-line stack must clear the
  tempo + ottava reserved beneath it). No existing fixture has ≥2 same-anchor
  above-RH annotations, so a deep-stack test needs a small NEW fixture; the
  `note(...)` helper (`layout.test.js:3725-3729`) makes this trivial:
  `note("G", 4, { annotations: [{ text: "C", placement: "above" },
  { text: "rit.", placement: "above" }] })` in a section with a tempo. AC4
  subset cases are partially covered (the n=1 block exercises tempo-above-ottava
  indirectly); the "ann + tempo, no ottava" case is untested but lower priority.

**Decision (D4).** Verification surface =
1. Flip the two assertions + comment in the `layout.test.js:2059` block (the
   canonical AC1/AC2 signal).
2. ADD one focused deep-stack test (new tiny fixture: ≥2 same-anchor above-RH
   annotations + a tempo) asserting (a) the lowest annotation baseline
   `annotationAboveRHLaneY < tempoLaneY` (the whole stack clears the tempo) and
   (b) `topMargin` grows vs the single-annotation case (covers AC5, currently
   untested).
3. Optionally one subset assertion for "annotations + tempo, no ottava"
   (`annotationAboveRHLaneY < tempoLaneY`, tempo hugs the staff) for AC4 — lower
   priority, design records it as a nice-to-have.
No other unit test and no e2e test changes.

## 5. Spec requirement coverage (R1–R9)

| Req | How the design satisfies it | Evidence |
|---|---|---|
| **R1** New top→bottom order annotations → tempo → octaveShift | Reorder the three reservation if-blocks in `topMarginLayout` to [ottava, tempo, annotations] (D1); reserved-later ⇒ higher, so annotations become topmost. | D1; `layout.js:2879-2901` |
| **R2** Tempo stays directly above octaveShift | Tempo is still reserved after (above) the ottava; only annotations change role. The ottava becomes the lane hugging the staff solely because annotations vacated it. | D1 trace; subset "tempo + ottava" unchanged |
| **R3** Applies to both hands (single grand-staff tempo) | One system-level tempo above the top staff; band routing is a pure (hand, placement) function — LH annotations can never reach `aboveRH`. No LH band relocated. | D2; `svg.js:487-508`, `:581-587`; `layout.js:2948` |
| **R4** Subset behavior preserved (no phantom gap) | Each block is presence-guarded; absent lanes reserve nothing. Verified across all subsets numerically. | D1 subset table |
| **R5** Deep stacks clear the tempo; margin grows | Annotations reserved LAST account the full stack on top of ottava + tempo; `topMargin` grows to fit. n=3 trace: lowest line 10.6 < tempo 14.0. | D1 deep-stack walk |
| **R6** No horizontal change | Horizontal geometry is wholly outside `topMarginLayout`; the change touches only vertical lane order. | D2 (only `topMargin` + lane Ys returned; horizontal untouched) |
| **R7** No regression in unaffected regions | `topMargin` is order-invariant, so all downstream Ys/bands/margins are unchanged (±ULP). belowRH/aboveLH/belowLH, LH-above ottava, below ottavas all independent. | D2; `layout.js:1948-1962`, `:1933-1935`, `:3004` |
| **R8** Top margin stays tight when nothing above | "Nothing above" subset collapses `topMargin` to `SYSTEM_TOP_MARGIN` (= 5), unchanged. | D1 subset table; `layout.js:2902` |
| **R9** Keep documentation in sync | Update THREE comments (M1 `:2850-2852`, M2 `:1866`, M3 `:2947`) to the new order; all other order-adjacent text is order-agnostic. | D3 |

## 6. Test & doc impact

**Production change (single function).**
- `src/notation/layout.js` `topMarginLayout` (`:2865-2910`): reorder the three
  reservation if-blocks to source order **[ottava, tempo, annotations]** (D1).
  Variable declarations (`:2882-2884`), the return (`:2904-2909`), and `at()`
  are untouched.

**Documentation (R9 — three comments, D3).**
- M1 `layout.js:2850-2852` (`topMarginLayout` doc-comment order sentence).
- M2 `layout.js:1866` (call-site lane list).
- M3 `layout.js:2947` (tempo emit "Topmost lane" comment).

**Tests (D4).**
- Update `layout.test.js:2059` block: flip the two order assertions + comment.
- Add a focused deep-stack test (new small fixture) for AC5.
- (Optional) add an "ann + tempo, no ottava" subset assertion for AC4.
- No other unit test; no e2e change (`specs/render.spec.js` unaffected).

## 7. Trade-offs / alternatives considered

- **Reorder if-blocks (chosen) vs. swap lane variables / post-hoc Y arithmetic.**
  The reservation loop already chains purely through `d`/`topExtent` with no
  cross-block coupling (D1), so a pure block permutation is the smallest correct
  change and keeps the deep-stack reservation arithmetic (`:2889`) correct for
  free. Swapping the returned Y values after the fact, or special-casing the
  annotation lane, would duplicate the stacking logic and risk the deep-stack /
  subset accounting — rejected as more code and more failure surface.
- **Update only the one spec-flagged doc-comment vs. all three.** The sweep
  (D3) found two additional comments (M2, M3) that assert/imply the old order.
  AC10 forbids ANY doc still describing the old order, so all three must change;
  updating only M1 would leave M2/M3 stale and fail AC10.
- **Flip the existing test only vs. flip + add a deep-stack test.** The deepest
  invariant the change relies on (the multi-line stack clearing the tempo, AC5)
  is currently untested because the only fixture has `aboveRHCount = 1`. Adding
  one small focused test guards the subtlest property at negligible cost;
  relying on implicit coverage was rejected (D4).
- **Floating-point ULP note.** The chosen reorder leaves `topMargin` summing the
  same heights in a different order, producing a ≤3.6e-15 sp difference in the
  deep all-three case. Mathematically commutative; far below any visible or
  test-relevant threshold. No mitigation; recorded so a reviewer diffing raw
  values is not surprised (D1).

## 8. Summary of decisions

- **D1** — Implement as a pure permutation of the three reservation if-blocks in
  `topMarginLayout` to source order [ottava, tempo, annotations]; declarations,
  return, and `at()` untouched.
- **D2** — The change is surgically contained to the three top-margin lanes'
  relative order; `topMargin` is order-invariant so all downstream geometry,
  other bands, LH/inter-staff/below markings, and horizontal layout are
  unchanged. "Both hands" is satisfied by the single grand-staff tempo.
- **D3** — Update three comments for R9/AC10: M1 `layout.js:2850-2852`,
  M2 `layout.js:1866`, M3 `layout.js:2947` (M2/M3 additional to the spec's
  flagged site).
- **D4** — Flip the two assertions + comment in `layout.test.js:2059`, and add a
  focused deep-stack test (new small fixture) for AC5 (currently untested);
  optional subset assertion for AC4. No other unit/e2e changes.

Status: COMPLETE.
