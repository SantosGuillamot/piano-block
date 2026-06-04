# Code Review

## Verdict: rejected

## Batch scope

Tasks reviewed (all six code-plan tasks):

- **Task 1** — Add `crescendo` / `decrescendo` enum fields to the song schema (`src/song/schema.js`)
- **Task 2** — Add the two hairpin tuning constants (`src/notation/constants.js`)
- **Task 3** — Carry the per-hand below-staff lane Y on each recorded event (`src/notation/layout.js`)
- **Task 4** — Match and build the two new span kinds / hairpin builder (`src/notation/layout.js`)
- **Task 5** — Clip cross-system spans to the start system's staff end, generic (`src/notation/layout.js`)
- **Task 6** — Emit the wedge — `renderHairpin` dispatched by kind (`src/notation/svg.js`)

## Summary

The batch is close to complete and of high quality across five of six tasks: the
schema/validator behavior (Task 1), constants (Task 2), lane-Y carry (Task 3),
hairpin builder + matcher reuse (Task 4), and the `renderHairpin` emitter (Task 6)
are all correct, faithful to the design and plan, and well covered by tests. The
within-system tie/slur output is provably unchanged (the clip is a strict no-op for
`crossSystem === false`), messa-di-voce is gap-free, the near-zero-width span is
finite, crescendo vs. decrescendo are visibly distinct, and AC4's continuous wedge
genuinely crosses the barline. Both verification gates pass. **However, Task 5's
cross-system clip is defective**: when the end note's system-local X is smaller than
the start system's `staffEndX` (the common case), the clamp leaves the span's right
edge at a foreign-frame coordinate rather than clamping it to `staffEndX`. This is
the exact "garbage stroke to a foreign coordinate" the clip was designed to fix; it
violates the Task 5 acceptance criterion ("its `x2` equals the start system's
`staffEndX`") and the AC9 cross-system test was written with a `<=` assertion that
masks the gap. Rejecting on Task 5 only.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit tests (jest) | `npm run test:unit` | PASS — 6 suites, 262 tests passed |
| Lint (Biome) | `npm run lint` | PASS — 23 files checked, no findings |
| Schema delta (Task 1) | read `src/song/schema.js` | Correct — two optional `enum: ["start","stop"]` fields, validator untouched |
| Constants (Task 2) | read `src/notation/constants.js` | Correct — `HAIRPIN_APERTURE = 1.0`, `HAIRPIN_LANE_DY = 3.0`, both literal/sp, JSDoc'd |
| Lane-Y carry (Task 3) | read `recordSpanMarkers` | Correct — `crescendo`/`decrescendo`/`laneY` pushed unconditionally, existing reads unchanged |
| Hairpin builder (Task 4) | read `buildHairpinSpec` + probe | Correct — flat lane, constant aperture, no width division |
| Cross-system clip (Task 5) | read `clipSpanToStartSystem` + probe | **DEFECT** — foreign `x2 < staffEndX` left at foreign value (see Issue 1) |
| Emit (Task 6) | read `renderHairpin` + DOM tests | Correct — two `<line>`s in `<g data-span data-hand>`, 5-arg `line()`, opening/closing geometry |
| AGENTS.md (no pipeline refs in shipped source) | `grep -nE 'AC[0-9]\|Req \|Task [0-9]\|OQ-' src/**.js` | PASS — none in shipped source |
| Within-system AC8 no-op | read clip + tests | PASS — `if (!span.crossSystem) return span;` strict no-op |
| Messa-di-voce hinge | probe | PASS — `cresc.x2 === decresc.x1`, shared `yCenter`/`aperture` |
| Near-zero-width span | probe / test | PASS — finite coords, never throws |
| AC4 continuous wedge | probe | PASS — `x2` (21.53) strictly past barline X (16.33), one `<g>` |

## Behavior verification

This is a pure data→SVG transform (no runtime I/O); evidence is the resolved layout
records and emitted DOM, produced by driving `buildLayoutModel` / `renderSvg`
directly. Key probe (cross-system crescendo, narrow width 30, 8 single-note
measures — the exact fixture the AC9 layout test uses):

```
num systems: 4
located cresc spans: 1
{ arrayIndex: 0, systemIndex: 0, crossSystem: true,
  x1: 10.3, x2: 16.83, staffEndX: 28.5, clippedToEnd: false }
```

The end note lives in **system 3**; `x2 = 16.83` is system 3's *second-measure*
local X (`systems[3].measures[1].x === 16.83`), drawn into **system 0**'s frame.
The start system's `staffEndX` is `28.5`. The clamp `max(x1, min(x2, staffEndX)) =
max(10.3, min(16.83, 28.5)) = 16.83` is a no-op, so the wedge's right edge sits at a
meaningless foreign coordinate inside system 0's *first* measure — not at the start
system's staff end. The same holds for cross-system tie and slur (all three resolve
to `x2 = 16.83`). The clip only ever clamps to `staffEndX` in the rare case where the
foreign end X happens to exceed `staffEndX` (verified: a 6-measure, 8-notes-per-measure
song at width 50 gives `x2 == staffEndX == 48.5`).

## Issues

### Issue 1: Cross-system clip leaves a foreign-frame `x2` whenever the end note's system-local X is below `staffEndX`

**Task:** Task 5: Clip cross-system spans to the start system's staff end (generic)

**What's wrong:** `clipSpanToStartSystem` clamps the right edge with
`rightX = Math.max(span.x1, Math.min(span.x2, staffEndX))`. For a cross-system span,
`span.x2` is the end note's *system-local* coordinate from a **different** system's
frame — it has no meaning in the start system's frame and can be any value in roughly
`[STAFF_MARGIN_X, that-system's staffEndX]`. When that foreign value is **less than**
the start system's `staffEndX` (the common case — an end note early in its own
measure/system), `Math.min(x2, staffEndX)` returns the foreign value unchanged, so the
clip is a no-op and the wedge's right edge is drawn to a foreign-frame X. This is
precisely the "wrong stroke to a foreign coordinate" / garbage stroke the design's
clip exists to eliminate (design "Cross-system clip…" decision, lines 326–359), and
it fails to draw the actual within-system portion (the span should reach the start
system's staff end). The defect is generic across hairpin, tie, and slur, since all
three share the helper.

**Where:** `src/notation/layout.js:2331` (inside `clipSpanToStartSystem`, defined at
`:2326`), the line
`const rightX = Math.max(span.x1, Math.min(span.x2, staffEndX));`. Reached from the
post-resolution bucketing loop at `src/notation/layout.js:1891`.

**Expected:** Per the Task 5 acceptance criterion — "its `x2` equals the start
system's `staffEndX`" — and the design's stated purpose (right edge = the start
system's drawn staff end; draw the start-system portion), a cross-system span's right
edge must be set to `staffEndX`, not to the foreign end-system X. The end X is *not
known* in the start frame, so `min(x2, staffEndX)` is the wrong operation: for a
cross-system span the right edge should be `staffEndX` itself, clamped only to never
fall below `x1` (so a start at/past the edge collapses to zero width, never
backwards) — e.g. `rightX = Math.max(span.x1, staffEndX)`. (The design's literal
formula `max(x1, min(x2_or_known, staffEndX))` is the trap here: `x2` is *not*
"known" in the start frame for a cross-system span, which is why the design's own test
plan, line 516, and AC-coverage map, line 568, specify the outcome as
`x2 === staffEndX` / "draws the within-system portion **to `staffEndX`**". The
implementation must satisfy that outcome.)

### Issue 2: AC9 cross-system tests assert only `x2 <= staffEndX`, masking the foreign-coordinate gap

**Task:** Task 5: Clip cross-system spans to the start system's staff end (generic)

**What's wrong:** The cross-system tests in
`src/notation/__tests__/layout.test.js` assert `sp.x2 <= startSys.staffEndX + 1e-9`
(crescendo) and the same for tie/slur. Because the actual `x2` is a foreign value
(16.83) that is *already* below `staffEndX` (28.5), this assertion passes even though
the clip never clamped and the right edge is a foreign-frame coordinate. The test
therefore does not verify the Task 5 acceptance criterion it claims to cover ("its
`x2` equals the start system's `staffEndX`") and would not catch Issue 1. The
near-zero-width / never-backwards helper tests are fine, but the full-`buildLayoutModel`
cross-system tests need an equality (or near-equality to `staffEndX`) assertion that
fails today and passes once Issue 1 is fixed.

**Where:** `src/notation/__tests__/layout.test.js` — the
`"files a cross-system crescendo under the start system only, clipped to staffEndX…"`
test (asserts `sp.x2 <= startSys.staffEndX + 1e-9`) and the
`"clips a cross-system tie and slur to the start system's staff end…"` test (same
`<=` assertion).

**Expected:** Assert the clamped right edge **equals** the start system's `staffEndX`
for a cross-system span whose end note is on a later system (i.e.
`expect(sp.x2).toBeCloseTo(startSys.staffEndX)` — distinguishing the fixed clip from
today's foreign-coordinate value, exactly as the design's test plan calls for at
line 516: "`x2 === systems[startIdx].staffEndX` (the clamp — distinguishing the fix
from today's garbage `x2`)"). Keep the separate degenerate-safe pure-helper test that
checks `x2` never falls below `x1`.

## Notes on the reported known deviations (assessed, all acceptable)

- Exporting `recordSpanMarkers`, `buildHairpinSpec`, and `clipSpanToStartSystem` from
  `layout.js` as test infrastructure is consistent with the existing `matchSpans`
  export and is sound. No issue.
- Extracting the cross-system clip into the pure `clipSpanToStartSystem` helper is a
  clean refactor; the helper itself is well-structured (the `typeof span.cx ===
  "number"` branch correctly distinguishes tie/slur arcs from hairpin records). The
  *logic flaw* in Issue 1 is independent of the extraction. No issue with the
  extraction.
- AC4's continuous-wedge test placing the end note as the 2nd event of measure 2 so
  `x2 > barX` strictly is verified sound (`x2 = 21.53` vs. `barX = 16.33`). No issue.
