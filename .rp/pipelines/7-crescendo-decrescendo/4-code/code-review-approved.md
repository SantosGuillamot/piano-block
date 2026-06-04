# Code Review

## Verdict: approved

## Batch scope

Tasks reviewed (all six code-plan tasks; re-review after the iteration-1 rejection
of Task 5 and the landed fix in commit `0d0cfb3`):

- **Task 1** — Add `crescendo` / `decrescendo` enum fields to the song schema (`src/song/schema.js`)
- **Task 2** — Add the two hairpin tuning constants (`src/notation/constants.js`)
- **Task 3** — Carry the per-hand below-staff lane Y on each recorded event (`src/notation/layout.js`)
- **Task 4** — Match and build the two new span kinds / hairpin builder (`src/notation/layout.js`)
- **Task 5** — Clip cross-system spans to the start system's staff end, generic (`src/notation/layout.js`)
- **Task 6** — Emit the wedge — `renderHairpin` dispatched by kind (`src/notation/svg.js`)

## Summary

The iteration-1 rejection was scoped solely to Task 5's cross-system clip, which
left the wedge's right edge at a foreign-frame `x2` whenever the end note's
system-local X was below the start system's `staffEndX` (the common case), and to the
AC9 tests that masked it with a `<=` assertion. Both findings are fully resolved. The
clip now sets `rightX = Math.max(span.x1, staffEndX)` — the foreign `x2` is never
consulted — so a cross-system span's right edge is the start system's own staff end,
clamped up from `x1` so a start at/past the edge collapses to a finite zero-width span
(never backwards). The AC9 full-`buildLayoutModel` tests for the cross-system
hairpin, tie, and slur now assert `x2` equals `staffEndX` (`toBeCloseTo(staffEndX, 6)`),
and the pure-helper test for the below-`staffEndX` foreign case asserts `x2 === 28.5`.
The fix is the single line that the rejection demanded: the only non-comment code
change since the rejection review is `clipSpanToStartSystem`'s `rightX` line; Tasks 1,
2, 3, 4, and 6 are byte-identical to their previously-reviewed (and praised) state,
and the within-system no-op path remains a strict no-op (both within-system
byte-identical helper tests still assert `toEqual(before)`). No scope creep, no dead
code, no regression. Both verification gates pass in my own run (262 tests, lint
clean). AC1–AC10 are all satisfied. Approving the batch.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Unit tests (jest) | `npm run test:unit` | PASS — 6 suites, 262 tests passed |
| Lint (Biome) | `npm run lint` | PASS — 23 files checked, no findings |
| Fix is minimal / no collateral change | `git diff 6387ed5..HEAD` | Only `clipSpanToStartSystem`'s `rightX` line (+ comments) and the AC9 tests changed; Tasks 1–4/6 byte-identical |
| Cross-system clip clamps to `staffEndX` (Task 5, Issue 1) | read `clipSpanToStartSystem` + `buildLayoutModel` probe | RESOLVED — `rightX = max(x1, staffEndX)`; foreign `x2` never consulted; probe `x2 = 28.5 === staffEndX` (was foreign `16.83`) |
| AC9 tests assert equality to `staffEndX` (Task 5, Issue 2) | read `layout.test.js` cross-system tests | RESOLVED — hairpin/tie/slur full-model tests assert `toBeCloseTo(staffEndX, 6)`; helper test asserts `x2 === 28.5` for foreign `x2 = 20` |
| Within-system clip is a strict no-op (AC8) | helper tests + probe | PASS — both within-system tests assert `toEqual(before)`; probe within-system `x2 = 26.73` left untouched (`staffEndX = 198.5`) |
| Degenerate-safe clamp (never backwards) | read clip + tests | PASS — `max(x1, staffEndX)`; start at/past edge → finite zero-width |
| Tie/slur `cx` recompute on clip | read clip + tests | PASS — `cx = (x1 + x2)/2` only when `typeof span.cx === "number"`; `y2`/`cy` left at foreign value by design |
| Schema delta (Task 1) | read `src/song/schema.js:148-149` | Correct — two optional `enum: ["start","stop"]` fields, validator untouched |
| Constants (Task 2) | read `src/notation/constants.js:177,184` | Correct — `HAIRPIN_APERTURE = 1.0`, `HAIRPIN_LANE_DY = 3.0`, literal/sp |
| Lane-Y carry (Task 3) | read `recordSpanMarkers` + tests | Correct — `crescendo`/`decrescendo`/`laneY` pushed unconditionally |
| Hairpin builder (Task 4) | read `buildHairpinSpec` + tests | Correct — flat lane, constant aperture, no width division |
| Emit (Task 6) | read `renderHairpin` + DOM tests | Correct — two `<line>`s in `<g data-span data-hand>`, 5-arg `line()`, opening/closing geometry |
| No pipeline refs in shipped source | inspection | PASS — none in shipped source |

## Behavior verification

This is a pure data→SVG transform (no runtime I/O); evidence is the resolved layout
records produced by driving `buildLayoutModel` directly with the same fixture the
iteration-1 rejection used (cross-system crescendo, render width 30, 8 single-note
measures wrapping into 4 systems). A temporary probe test (added under the configured
jest transform, then removed) produced:

```
PROBE        { numSystems: 4, count: 1, arrayIndex: 0, systemIndex: 0,
               crossSystem: true, x1: 10.3, x2: 28.5, staffEndX: 28.5,
               x2EqualsStaffEndX: true }
PROBE-WITHIN { numSystems: 1, crossSystem: false, x1: 10.3, x2: 26.73,
               staffEndX: 198.5 }
```

- **Cross-system (the rejection fixture):** the wedge is filed under `systemIndex: 0`
  only (`arrayIndex: 0`, `count: 1`), and its right edge is now `x2 = 28.5`, exactly
  the start system's `staffEndX`. Before the fix this was the foreign-frame `16.83`.
  Issue 1 is resolved end-to-end, not just at the helper level.
- **Within-system:** the clip is a genuine no-op — `crossSystem: false`, and `x2 =
  26.73` (the real end-note center) is left untouched, far below `staffEndX = 198.5`.
  The fix did not perturb the within-system path that AC8 depends on.

Both observations agree with the now-strengthened AC9 assertions (which themselves
pass in my full `npm run test:unit` run), so the fix is verified by independent probe
and by the suite.

## AC coverage (re-confirmed)

- **AC1** — `validate.test.js`: a cresc span + a separate decresc span over ≥2 notes → `[]`.
- **AC2** — additive growth; a song without the fields resolves no new spans; existing assertions unchanged.
- **AC3** — `svg.test.js`: `[data-span="crescendo"]`/`[data-span="decrescendo"]`, two `<line>`s each, opening-vs-closing divergence, visibly distinct.
- **AC4** — within-system barline-crossing wedge drawn continuously past the bar (`crossSystem === false`, `x2` past the bar X).
- **AC5** — out-of-set `crescendo`/`decrescendo` flagged with path + allowed values; misspelled `cresecndo` silently ignored.
- **AC6/AC10** — dangling start/stop → 0 records; overlapping same-kind → 1; rest endpoint → 0; near-zero-width → 1 finite; all non-throwing.
- **AC7** — wedge resolves unchanged for dynamic at start/end/both/neither; dynamics and wedge independent.
- **AC8** — tie/slur stay `<path>` Bézier; within-system clip is a strict no-op (`toEqual(before)`); coexistence song renders all selectors.
- **AC9** — cross-system hairpin/tie/slur clamp `x2` to `staffEndX` (asserted by equality now), filed under start system only, no foreign-coord leak, never throws.
- **AC10** — constant aperture (no width division) + degenerate-safe clamp → finite, non-throwing.
