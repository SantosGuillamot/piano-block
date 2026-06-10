# Code plan review — APPROVED

Pipeline: `27-beamed-note-stems` (phase 3 — Plan)
Reviewed: `.rp/pipelines/27-beamed-note-stems/3-plan/code-plan.md`
Against: `1-spec/spec.md`, `2-design-doc/design-doc.md`
Rejection iteration: N=1 (no prior rejections)

## Verdict

Approved. The plan is complete, feasible, and aligned with both the spec and
the design doc. Every factual claim I checked against the source holds, and
the three tasks together cover all spec requirements (R1–R6) and acceptance
criteria (AC1–AC8) with correct traceability.

## What I verified against the source

Every load-bearing claim in the plan was checked against the worktree, not
taken on trust:

1. **Line references are exact.** `beamGeometry` spans
   `src/notation/layout.js:505-575`; `direction` is computed at line 512; the
   four raw-`m.x` readers are the stems map (529–533), the primary beam
   (540–541), the secondary-beam loop (546), and the stub loop (567–568, with
   `stubLen = NOTEHEAD_RX * 1.5` at 565). The `beamY` computation reads
   `members.map(...)` at 524/526 and uses steps only, so switching it to the
   shifted copy is indeed cosmetic. `NOTEHEAD_RX` is already imported and used
   in-function — no new import needed, as the plan states.
2. **The emit layer is a verbatim passthrough.** `renderStem`
   (`src/notation/svg.js:785`) and `appendFlag` (`:801`) apply the standalone
   edge rule exactly as quoted. `renderBeam` (`svg.js:813-836`) draws `stem.x`,
   `segment.x1`, `segment.x2` with no `note.x` reads; its only horizontal
   arithmetic is the width `Math.abs(segment.x2 - segment.x1)`, which a rigid
   translation leaves unchanged. "svg.js untouched" is sound.
3. **The test block matches the plan's description.**
   `src/notation/__tests__/layout.test.js:512-547` contains exactly three
   tests: the stem-up flat-beam test with the breaking expectation
   `{ level: 1, x1: 0, x2: 4 }` at line 524, the levels-only secondary-beam
   test, and the existence/level-only stub test. `NOTEHEAD_RX` (line 30) and
   `beamGeometry` (line 39) are already imported.
4. **The stem-down fixture works.** `stemDirectionForChord`
   (`layout.js:262-275`) with all steps 6: `maxDist = 2`, `farthestAbove`
   true, `farthestBelow` false → `"down"`. The plan's
   `topStep: 6, bottomStep: 6` fixture yields the negative offset R6.2
   requires.
5. **The stub assertions match the actual arithmetic.** For the existing stub
   fixture (members `x: 0, beamCount: 1` and `x: 4, beamCount: 2`), the stub
   lands on the second member with `towardPrev = true`, so `x2 = member.x`
   (the kept stem endpoint, shifted to `4 + NOTEHEAD_RX`) and
   `x2 − x1 = NOTEHEAD_RX * 1.5`. The plan's Task 3 assertions are exactly
   right, including the warning not to apply the first/last-stem rule to
   non-primary segments.
6. **The "only one assertion fails after Task 1" claim holds.** `beamGeometry`
   has exactly one production caller (`layout.js:1558`), and no test outside
   the `beamGeometry` block in `layout.test.js` references `stems`, `beams`,
   or `beamY` (checked `layout.test.js`, `svg.test.js`, `constants.test.js`).
   The Playwright specs (`specs/render.spec.js`, `specs/editor.spec.js`)
   assert system counts, re-wrapping, and one standalone-note
   X-ordering/bounds case — none sensitive to a 0.6 sp beam shift.
7. **The test command exists.** `npm run test:unit` →
   `wp-scripts test-unit-js` (`package.json:14`).

## Quality of the plan itself

- **Completeness.** Tasks 1–3 cover the code change, the breaking-test update
  with up-group assertions, and the additive down-group/secondary/stub
  coverage — exactly the spec's R6.1/R6.2/R6.3 set. Out-of-scope items
  (overflow clamp, DOM test, mixed directions) carry the design doc's
  declines explicitly so the implementer won't scope-creep.
- **Feasibility.** Each task names files, line numbers, exact code/assertion
  text, and a runnable verification step. Dependencies are correctly ordered
  (Task 1 → 2 → 3) with the shared-file sequencing called out.
- **Alignment.** The shift-the-input approach matches the design doc's chosen
  approach verbatim, and each task's "Traces to" section maps to real spec
  requirements and design sections.
- **TDD honesty.** The plan acknowledges Task 1 is code-first (the broken
  assertion only flips meaning after the code change) and compensates with an
  explicit fail-then-pass observation — a reasonable, well-justified
  exception.

## Minor notes (non-blocking)

- The plan cites `renderBeam` as lines 813–831; the function body actually
  closes at 836. The cited content (the X-verbatim reads) is within the range
  and correct, so this has no effect on execution.
- Task 1's instruction that non-X fields (`beamCount`, `topStep`,
  `bottomStep`) may be read off either array is correct — the spread copies
  them unchanged — and usefully pre-empts a reviewer question.

No changes requested.
