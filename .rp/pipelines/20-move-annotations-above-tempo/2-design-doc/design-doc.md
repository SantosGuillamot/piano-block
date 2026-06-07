# Design doc — Move annotations above the tempo marking (issue #20)

> This document is standalone: it describes the full design without requiring the
> spec or the design research. It covers the architecture and approach, the
> specific technical decisions and trade-offs, how the design satisfies each spec
> requirement (R1–R9) and acceptance criterion (AC1–AC10), the documentation
> updates required by R9, and the verification strategy (including the deep-stack
> AC5 invariant). It is a design-level document only: it does not contain the
> production code and does not break the work into tasks (those are later phases).

## 1. Background

The sheet-music renderer draws a vertical stack of markings in the column above
the top (right-hand / treble) staff. Up to three kinds of marking can appear in
that column:

- **annotations** — free text attached per-note or per-measure and placed above
  the top staff (the "above-RH" annotation lane). Only the above-the-top-staff
  annotations participate in this column; annotations placed below the top staff,
  in the gap between the two staves, or below the bottom staff are separate.
- **tempo** — the single metronome mark (e.g. "♩ = 120") drawn above the top
  staff for the whole grand staff. There is exactly one tempo per system; it is
  not per-hand.
- **octaveShift** — the rendered "ottava" bracket (e.g. 8va/15ma). The bracket
  that participates in this column is the right-hand "above" (positive) ottava.
  The left-hand "above" bracket renders in the inter-staff gap, and any "below"
  bracket from a negative shift renders below its own staff; neither is part of
  this column.

**Today** these stack, from top to bottom, as **tempo → octaveShift →
annotations**: the annotations hug the staff, the octaveShift sits above them,
and the tempo sits at the very top.

**The desired order** is, from top to bottom, **annotations → tempo →
octaveShift**: the annotation lane moves from nearest the staff to the topmost
position, while the tempo and octaveShift keep their existing relative order
(tempo directly above octaveShift). This is a purely vertical reorder —
horizontal spacing and layout must not change, and everything outside this
column must be unchanged for the same input.

## 2. Where the layout is computed (orientation)

All file references are to this worktree. The production logic lives in
`src/notation/layout.js`; the tests live in
`src/notation/__tests__/layout.test.js`.

### 2.1 `topMarginLayout` — the single function that decides the column order

The entire above-the-top-staff stack is computed in **`topMarginLayout`**
(`src/notation/layout.js:2865-2910`). It is called once per system at
`layout.js:1870`:

```
const top = topMarginLayout(members, ledgerTopExtent(members), occ.aboveRH);
```

It returns four values:

- `topMargin` — the staff's top margin (the height reserved above the staff top
  line), the **only** return value any downstream geometry depends on.
- `annotationAboveRHLaneY` — the above-RH annotation lane's baseline Y.
- `ottavaAboveLaneY` — the right-hand "above" ottava lane's baseline Y.
- `tempoLaneY` — the tempo lane's baseline Y.

Each lane Y is `null` when that marking is absent from the system. All Ys are in
system-local coordinates where **smaller Y is higher on the page**.

### 2.2 How the three outputs flow into the system band

The three lane Ys are copied into the system `band` (`layout.js:1918-1962`):

- `band.tempoLaneY = top.tempoLaneY` (`:1928`)
- `band.ottavaAboveLaneY = top.ottavaAboveLaneY` (`:1929`)
- `band.annotationAboveRHLaneY = top.annotationAboveRHLaneY` (`:1936`)
- `band.bands.aboveRH.baseY = top.annotationAboveRHLaneY` (`:1944`) — the above-RH
  annotation band is the **only** one of the four placement bands sourced from a
  `topMarginLayout` lane.

### 2.3 The emit layer is order-agnostic

The emit layer never hardcodes a vertical order; it places each marking at
whatever Y the band carries:

- `buildSystemTexts` (`layout.js:2912+`) emits the tempo at `band.tempoLaneY`
  (`layout.js:2948`) and the RH-above ottava at `band.ottavaAboveLaneY`
  (`layout.js:2980`).
- The above-RH annotation band emits from `band.bands.aboveRH.baseY`, growing
  "up" (toward smaller Y) by `STACK_STEP` per stacked line (`layout.js:1944-1946`).
- `svg.js` renders purely from the computed Y values.

Because emit is order-agnostic, **reordering the column is entirely a matter of
which Y each lane receives** — there is no second place that encodes the order.

### 2.4 The reservation mechanic inside `topMarginLayout`

`topMarginLayout` reserves vertical space for each present lane in **source
order**, advancing two running accumulators:

- `d` — the running distance above the staff top line (positive = up). Each
  present lane records its baseline at the current `d`, then advances `d` past
  its own glyph height plus a `TEXT_LANE_GAP`.
- `topExtent` — the outermost (highest) edge reserved so far.

The relevant body (`layout.js:2868-2902`):

- `stackStep = NOTE_SIZE + TEXT_LANE_GAP` (`:2868`) — one above-RH baseline-to-
  baseline step; equals the band emit's `STACK_STEP` (`layout.js:1945`), so the
  reservation matches actual rendering.
- `innerZone = max(ledgerTop, measure-number room)` (`:2875-2878`) — the zone
  directly above the staff top that already holds high notes/ledgers and the
  measure number.
- `d = innerZone + ABOVE_STAFF_PAD` (`:2880`); `topExtent = innerZone` (`:2881`).
- Three presence-guarded `if`-blocks then reserve, **in source order**, each
  recording its `*D` distance and advancing `d`/`topExtent`:
  1. **annotations** — guard `aboveRHCount > 0` (`:2885-2891`). Reserves the
     **full** multi-line stack: `topExtent = d + (aboveRHCount − 1)*stackStep +
     NOTE_SIZE` (`:2889`).
  2. **ottava** — guard `systemHasRightOttavaAbove(members)` (`:2892-2896`).
  3. **tempo** — guard `systemHasTempo(members)` (`:2897-2901`).
- `topMargin = max(SYSTEM_TOP_MARGIN, topExtent + ABOVE_STAFF_PAD)` (`:2902`).
- `at(dist) = topMargin − dist` (`:2903`) converts each reserved distance into a
  system-local Y.

The key invariant: **reserved later ⇒ larger `d` ⇒ smaller Y ⇒ higher on the
page.** Today's source order `[annotations, ottava, tempo]` therefore yields the
visual top-to-bottom order `[tempo, ottava, annotations]` — exactly today's
behavior.

## 3. Approach

**Reorder the three reservation `if`-blocks in `topMarginLayout` to source order
`[ottava, tempo, annotations]`.** By the "reserved later ⇒ higher" invariant,
this yields the visual top-to-bottom order **annotations → tempo →
octaveShift(ottava)** — the desired result.

Concretely, the change is: *move the `aboveRHCount > 0` block (`:2885-2891`) so it
runs after the ottava block and the tempo block.* The block declarations
(`:2882-2884`), the `topMargin` computation (`:2902`), the `at()` helper (`:2903`),
and the return statement (`:2904-2909`) are left untouched.

This is the smallest correct change because the reservation blocks chain purely
through the shared `d`/`topExtent` accumulators with **no cross-block coupling**
(proved in §4.1). A pure permutation therefore reorders the column without
touching the deep-stack reservation arithmetic, the subset accounting, or any
downstream consumer.

### Why not the alternatives

- **Swap the returned lane Y values after the fact, or special-case the
  annotation lane.** Rejected: this would duplicate the stacking logic that the
  reservation loop already performs and would re-derive the deep-stack
  (`:2889`) and subset arithmetic by hand, adding code and failure surface. The
  block permutation gets all of that correct for free.
- **Update only the one doc-comment the spec flagged.** Rejected: the
  documentation sweep (§6) found two additional comments that assert/imply the
  old order. AC10 forbids *any* documentation still describing the old order, so
  all three must change.

## 4. Technical decisions and trade-offs

### 4.1 D1 — The reorder is a pure, correct permutation of three independent blocks

**Decision.** Implement the reorder as a pure permutation of the three
reservation `if`-blocks to source order `[ottava, tempo, annotations]`.
Declarations, `topMargin`, `at()`, and the return are untouched.

**Why it is correct — no hidden cross-block coupling.** A read/write inventory of
the three blocks:

| block | reads | writes |
|---|---|---|
| annotations (`:2885-2891`) | `aboveRHCount`, `d`, `stackStep`, `NOTE_SIZE`, `TEXT_LANE_GAP` | `annotationAboveRHD`, `topExtent`, `d` |
| ottava (`:2892-2896`) | `systemHasRightOttavaAbove(members)`, `d`, `OTTAVA_SIZE`, `TEXT_LANE_GAP` | `ottavaD`, `topExtent`, `d` |
| tempo (`:2897-2901`) | `systemHasTempo(members)`, `d`, `TEMPO_SIZE`, `TEXT_LANE_GAP` | `tempoD`, `topExtent`, `d` |

- Each `*D` is written exactly once (in its own block) and read exactly once (in
  the return, `:2906-2908`). **No block reads another block's `*D`.** The only
  inter-block channels are the shared accumulators `d` and `topExtent`. The three
  blocks are therefore freely permutable.
- The return maps each lane field to its own `*D`, and `at()` is a pure
  per-distance transform. Reordering the blocks changes *which lane receives the
  larger `d`*, and the return reflects that automatically — no edit needed.

**Why `topExtent` / `topMargin` stay correct across all subsets.** Every present
block sets `topExtent` to its own outer edge, so the *last present* block always
leaves `topExtent` at the true outermost edge; absent blocks are skipped by their
guards. Because `topMargin` sums the same set of glyph heights regardless of
order, it is identical to today's value in every subset and can never come out
smaller than the real stack height. Simulated values (in sp) under the **new**
order, all satisfying `annotation < tempo < ottava` (smaller Y = higher):

| subset | topMargin | annotation | tempo | ottava |
|---|---|---|---|---|
| all three (n=1) | 11.00 | 3.80 | 7.20 | 10.00 |
| annotations only | 5.00 | 4.00 | — | — |
| ottava only | 5.00 | — | — | 4.00 |
| tempo only | 5.00 | — | 4.00 | — |
| annotations + tempo (no ottava) | 8.20 | 3.80 | 7.20 (hugs staff) | — |
| tempo + ottava (no annotations) | 7.60 | — | 3.80 | 6.60 (unchanged) |
| nothing above | 5.00 (= `SYSTEM_TOP_MARGIN`) | — | — | — |

**Why the deep stack stays correct.** With annotations reserved **last**, line
`:2889` (`topExtent = d + (aboveRHCount − 1)*stackStep + NOTE_SIZE`) uses the `d`
already advanced past the ottava and the tempo, so the whole multi-line stack
reserves on top of them. Simulated all-three with `aboveRHCount = 3`:
`topMargin = 17.80`, the lowest annotation baseline (note #0) `= 10.60`, and
`tempoLaneY = 14.00` — so the lowest annotation line is strictly above the tempo
(10.60 < 14.00). The topmost glyph top sits 1.00 sp above the staff top, inside
`topMargin` with the `ABOVE_STAFF_PAD = 1` clearance. No annotation line overlaps
the tempo or the ottava.

**Trade-off / benign note for reviewers.** In the deep all-three case the new
`topMargin` differs from the old value by ~3.6e-15 sp — pure floating-point
accumulation-order noise (the additions are mathematically commutative; only the
last ULP shifts). At `SP_PX = 8` that is ~3e-14 px, far below any visible or
test-relevant threshold (all order assertions are strict `<` with margins
≥ 0.6 sp). No mitigation is needed; it is recorded only so a reviewer diffing raw
`topMargin` values is not surprised by a non-bit-identical result.

### 4.2 D2 — The change is surgically contained; nothing downstream depends on the order

**Decision.** The change is confined to the relative vertical order of the three
top-margin lanes inside `topMarginLayout`. No downstream geometry, no other band,
no LH / inter-staff / below marking, and no horizontal value is affected.

**Evidence.**

- **The return is consumed at exactly four sites** (`top.` in non-test
  `layout.js`): `top.topMargin` (`:1871`), `top.tempoLaneY` (`:1928`),
  `top.ottavaAboveLaneY` (`:1929`), and `top.annotationAboveRHLaneY` (`:1936` and
  `:1944`). **`topMargin` is the only return value any downstream *geometry*
  depends on**; the three lane Ys feed only the text/ottava emit and the above-RH
  band's own `baseY`.
- Since `topMargin` is order-invariant per input (§4.1), everything derived from
  it is unchanged (modulo the ≤3.6e-15 sp ULP noise): `rhBottomY = topMargin +
  STAFF_HEIGHT_SP` (`:1872`), `effectiveInterStaffGap` (`:1901-1905`), `lhTopY`
  (`:1906`), `lhBottomY` (`:1907`), `bottomMargin` (`:1912-1915`), `systemHeight`
  (`:1916`), and all four band `baseY`s. The reorder changes **only** which of
  the three top-margin lanes is highest; nothing else moves.
- **The other three placement bands derive from staff Ys only**, never from a
  top-margin lane: `belowRH.baseY = rhBottomY + belowRHBase` (`:1948-1952`),
  `aboveLH.baseY = lhTopY − NOTE_GAP_STAFF` (`:1953-1957`),
  `belowLH.baseY = lhBottomY + belowLHBase` (`:1958-1962`). Only `aboveRH.baseY`
  (`:1944`) is sourced from a top-margin lane.
- **The LH-above ottava lane** `ottavaLeftAboveLaneY` (inter-staff gap) is
  computed at `:1933-1935` from `lhTopY` and LH extents — independent of the
  reservation order. Both endpoints of the "RH-above sits above LH-above"
  relationship are therefore unchanged.
- **The "below" ottava** (negative shift) emits at `staffBottomY + 2`
  (`buildSystemTexts`, ~`layout.js:3004`), independent of the top-margin lanes.

**"Both hands" is satisfied structurally.** Band routing is a pure
`(hand, placement)` function with no override: per-event notes route via
`noteBandResolver` (`svg.js:487-508`: `leftHand → aboveLH/belowLH`,
`rightHand → aboveRH/belowRH`) and standalone annotations via `bandKeyFor`
(`svg.js:581-587`, same rule). A left-hand annotation can **never** select
`aboveRH`. There is a single system-level tempo (one emit at `band.tempoLaneY`,
`layout.js:2948`; no per-hand tempo), so moving the annotations above that one
tempo serves both hands at once without relocating any LH band.

## 5. How the design satisfies each requirement (R1–R9)

| Req | How the design satisfies it |
|---|---|
| **R1** New top→bottom order annotations → tempo → octaveShift | Reorder the three reservation blocks to `[ottava, tempo, annotations]` (D1); "reserved later ⇒ higher" makes annotations topmost. (`layout.js:2885-2901`) |
| **R2** Tempo stays directly above octaveShift | Tempo is still reserved after (above) the ottava; only the annotations change role. The ottava becomes the lane hugging the staff solely because the annotations vacated it. (D1; the "tempo + ottava" subset row is unchanged) |
| **R3** Applies to both hands (single grand-staff tempo) | One system-level tempo above the top staff; band routing is a pure `(hand, placement)` function, so LH annotations can never reach `aboveRH`. No LH band is relocated. (D2; `svg.js:487-508`, `:581-587`; `layout.js:2948`) |
| **R4** Subset behavior preserved (no phantom gap) | Each block is presence-guarded; absent lanes reserve nothing. Verified numerically across every subset (D1 table). |
| **R5** Deep stacks clear the tempo; margin grows | Annotations reserved **last** account the full stack on top of the ottava + tempo; `topMargin` grows to fit. n=3 trace: lowest line 10.6 < tempo 14.0. (D1 deep-stack walk; `layout.js:2889`) |
| **R6** No horizontal change | Horizontal geometry is wholly outside `topMarginLayout`; the change touches only vertical lane order, and `topMargin` (the only geometry output) is order-invariant. (D2) |
| **R7** No regression in unaffected regions | `topMargin` is order-invariant, so all downstream Ys, bands, and margins are unchanged (±ULP). belowRH / aboveLH / belowLH, the LH-above ottava, and the below ottavas are all independent. (D2; `layout.js:1948-1962`, `:1933-1935`, ~`:3004`) |
| **R8** Top margin stays tight when nothing is above | The "nothing above" subset collapses `topMargin` to `SYSTEM_TOP_MARGIN` (= 5), unchanged. (D1 table; `layout.js:2902`) |
| **R9** Keep documentation in sync | Update three order-bearing comments to the new order (§6); all other order-adjacent text is order-agnostic and stays. |

## 6. Documentation updates (R9 / AC10)

Order-bearing language about the above-the-top-staff stack is confined to
`src/notation/layout.js`. No project markdown (`docs/song-format.md`, `README`)
describes the visual stack order — those describe the JSON song format and
above/below placement, which is unchanged. `.rp/*` pipeline artifacts are out of
R9 scope.

A full sweep classifies the order-bearing comments as follows.

### Must update (3 sites)

- **M1 — `layout.js:2850-2852`** (the `topMarginLayout` doc-comment; the site the
  spec already flagged). The current order-bearing sentence states the old
  innermost→outermost order: "*the above-RH note lane nearest the staff, then an
  above-staff ottava, then the tempo at the very top*". Rewrite to the new order:
  an above-staff ottava nearest the staff, then the tempo, then the above-RH note
  (annotation) lane at the very top. Drop the trailing "*(and the tempo)*"
  parenthetical, which assumed the tempo was outermost. The next sentence
  (`:2853-2855`, "the above-RH lane reserves height for the WHOLE stack … so a
  deep above-RH stack lifts the lanes (and the margin) above it") stays true —
  leave it.
- **M2 — `layout.js:1866`** (the call-site comment). The current parenthetical
  "*(the above-RH note stack, an above-staff ottava, the tempo) stacked over the
  ledger zone*" lists innermost→outermost in the **old** order. Rewrite to "(an
  above-staff ottava, the tempo, the above-RH note stack) stacked over the ledger
  zone". The rest of the comment stays true. *Additional to the spec's flagged
  site.*
- **M3 — `layout.js:2947`** (the tempo emit comment). The current "*// Topmost
  lane, above the note zone.*" is false under the new order (the tempo is now the
  **middle** lane; the annotations are topmost). Rewrite so the tempo is the
  middle lane, e.g. "// Middle lane: above the ottava, below the above-RH
  annotation lane." *Additional to the spec's flagged site.*

### Leave (order-agnostic — rationale)

- `constants.js:100` (`ABOVE_STAFF_PAD`): "…and above the topmost lane" is
  generic — there is still a topmost lane (now annotations); no old-order claim.
- `constants.js:106` (`TEXT_LANE_GAP`): "(chord / ottava / tempo)" is an
  unordered example list of glyphs that use the gap, not a top-to-bottom claim.
  (Optional nicety: "chord" is the legacy name for the above-RH annotation lane;
  renaming is not an R9 obligation since no order is asserted.)
- `layout.js:2701-2707` (`systemHasTempo` doc): says which texts need a lane; no
  order claim.
- `layout.js:2887` ("the stack grows UP … topmost note's glyph"): describes the
  annotation stack's **internal** growth direction (still up — AC3), not the
  inter-lane order.
- `layout.js:2869` ("The innermost reserved zone … high notes/ledgers AND the
  measure number"): describes the inner zone below all three lanes; unchanged.
- `layout.js` text-kind enumerations and `buildSystemTexts` doc
  (`layout.js:2912-2928`): unordered lists of text **kinds** produced; no
  vertical order.
- `docs/song-format.md`, `README`: describe the song format / placement
  semantics, not the inter-lane stack order.

AC10 is satisfied iff all three of M1, M2, M3 are updated. Updating only M1
(the single site the spec called out) would leave M2 and M3 stale and fail AC10;
the design records all three so the implementation phase can satisfy AC10
completely.

## 7. Verification strategy

The production change is a single permutation in one function, so the
verification surface is small and targeted at the order invariant and the
subtle deep-stack case.

### 7.1 Flip the one order-asserting test (AC1, AC2, AC9)

`src/notation/__tests__/layout.test.js:2059-2079` — the test
*"tempo, ottava, and note lanes stack above the staff"*. Exactly two assertions
flip, plus the comment:

- **Comment (`:2064-2065`).** From "Stacked top→bottom: tempo above the ottava
  above the above-RH note lane" to a description of the new order (the above-RH
  note/annotation lane above the tempo above the ottava).
- **Assertion 1 (`:2066`).** From `tempoLaneY < ottavaAboveLaneY` to
  `annotationAboveRHLaneY < tempoLaneY`.
- **Assertion 2 (`:2067-2069`).** From `ottavaAboveLaneY < annotationAboveRHLaneY`
  to `tempoLaneY < ottavaAboveLaneY`.
- **Assertion 3 (`:2070-2072`).** `annotationAboveRHLaneY < rightStaffTopY` stays
  valid — the annotation lane is still above the staff top, now further above.

The resulting chain `annotationAboveRHLaneY < tempoLaneY < ottavaAboveLaneY <
rightStaffTopY` is exactly **AC1**. The two emit-tracks-lane loops (`:2073-2075`
`t.y ≈ tempoLaneY`; `:2076-2078` `o.y ≈ ottavaAboveLaneY`) stay as-is —
`buildSystemTexts` still emits at those lanes — which covers **AC2**.

### 7.2 Add a focused deep-stack test (AC5 — currently untested)

The deepest invariant the change relies on is that a **multi-line** annotation
stack clears the tempo (and the ottava reserved beneath it). This is currently
**untested**: the only fixture with an above-RH annotation (`COMPREHENSIVE_SONG`)
carries exactly one such annotation, so its system has `aboveRHCount = 1`, and the
`:2059` block exercises only the n=1 ordering. AC5 would otherwise pass only
implicitly.

Add one small new fixture with **≥2 same-anchor above-RH annotations plus a
tempo**. The existing `note(...)` test helper makes this trivial, e.g.:

```
note("G", 4, { annotations: [
  { text: "C", placement: "above" },
  { text: "rit.", placement: "above" },
] })
```

in a section that also carries a tempo. Assert:

1. **The whole stack clears the tempo.** The above-RH lane baseline (note #0,
   the lowest annotation line) is strictly above the tempo:
   `annotationAboveRHLaneY < tempoLaneY`.
2. **The margin grows.** `topMargin` for the deep-stack system is greater than
   `topMargin` for an otherwise-identical single-annotation system.

Together these cover **AC5** (lowest annotation line strictly above the tempo;
the top margin grows to accommodate the stack).

### 7.3 Optional subset assertion (AC4 — nice-to-have)

Optionally add an "annotations + tempo, no ottava" subset assertion
(`annotationAboveRHLaneY < tempoLaneY`, with the tempo hugging the staff) for the
**AC4** subset cases. This is lower priority — the n=1 block already exercises
tempo-above-ottava indirectly — and is recorded as a nice-to-have.

### 7.4 Tests that stay valid as-is (regression coverage for AC3, AC6–AC9)

Each of these survives the pure value shift without edits:

- **`aboveRH.baseY == annotationAboveRHLaneY` + grows up** — value-tracking +
  direction (sourced at `layout.js:1944`, direction "up" at `:1946`), not an
  absolute Y. Covers **AC3**.
- **RH-above vs LH-above ottava** — both endpoints are unchanged by the reorder.
  Covers **AC6**.
- **Null-lane presence** assertions — guard-driven
  (`systemHasRightOttavaAbove` / `systemHasTempo`), unchanged by a block reorder.
- **Top-margin flex (rich > plain), `:2081-2115`** — `topMargin` is
  order-invariant per input. Covers **AC8**.
- **LH-only +1 shift does not deepen the top margin** — `topMargin` + presence
  guard unchanged.
- **The e2e suite (`specs/render.spec.js`)** — no change. Its only vertical
  comparison is above-note vs below-note bounding boxes; there is no
  tempo-vs-annotation Y comparison, and the reorder does not move below-* relative
  to above-*.

This is **AC9**: the existing suite passes after updating the single order-
asserting test; no other existing test requires changes. Horizontal-position
checks remain valid because no horizontal value changes (**AC7**, from D2/R6).

### 7.5 Acceptance-criteria coverage map

| AC | Where verified |
|---|---|
| AC1 New order | §7.1 flipped order chain |
| AC2 Tempo/ottava unchanged relative to each other | §7.1 emit-tracks-lane loops + the tempo-above-ottava assertion |
| AC3 Annotation stack still grows upward | §7.4 `aboveRH.baseY` + direction "up" |
| AC4 Subset cases | §7.3 optional assertion; n=1 block covers tempo-above-ottava |
| AC5 Deep stack clears tempo; margin grows | §7.2 new focused test |
| AC6 Unaffected lanes (LH-above ottava, below bands) | §7.4 RH-vs-LH ottava test; D2 isolation |
| AC7 No horizontal change | §7.4 (existing horizontal checks stay valid); D2/R6 |
| AC8 Top margin tight when nothing above | §7.4 top-margin flex test |
| AC9 Suite green after one test update | §7.1 + §7.4 (only the order test changes) |
| AC10 Documentation matches new order | §6 (M1, M2, M3 all updated) |

## 8. Summary of decisions

- **D1** — Implement the reorder as a pure permutation of the three reservation
  `if`-blocks in `topMarginLayout` to source order `[ottava, tempo, annotations]`;
  the declarations, the `topMargin` computation, `at()`, and the return are
  untouched. The blocks are independent (each `*D` written and read exactly once;
  only `d`/`topExtent` are shared), so the permutation is correct across all
  subsets and the deep stack. A ≤3.6e-15 sp ULP difference in `topMargin` is
  benign and noted for reviewers.
- **D2** — The change is surgically contained to the three top-margin lanes'
  relative order. `topMargin` (the only geometry output) is order-invariant, so
  all downstream geometry, the other three bands, the LH / inter-staff / below
  markings, and all horizontal layout are unchanged. "Both hands" is satisfied by
  the single grand-staff tempo and the pure `(hand, placement)` band routing.
- **D3** — Update three order-bearing comments for R9/AC10:
  M1 `layout.js:2850-2852`, M2 `layout.js:1866`, M3 `layout.js:2947` (M2 and M3
  are additional to the spec's flagged site). No markdown doc requires change.
- **D4** — Flip the two order assertions + comment in the
  `layout.test.js:2059` block, and add a focused deep-stack test (a small new
  fixture with ≥2 same-anchor above-RH annotations + a tempo) for AC5, which is
  currently untested. Optionally add an "annotations + tempo, no ottava" subset
  assertion for AC4. No other unit test and no e2e test change.
