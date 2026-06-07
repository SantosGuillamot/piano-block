# Code plan review — APPROVED

**Artifact reviewed:** `.rp/pipelines/20-move-annotations-above-tempo/3-plan/code-plan.md`
**Against:** `1-spec/spec.md`, `2-design-doc/design-doc.md`
**Verdict:** **APPROVED**
**R9/AC10 boundary verdict:** Sound — explicitly owned by the doc plan; not orphaned.

---

## Scope of review

Adversarial review of the code plan: task self-containment + TDD field
completeness, ordering/dependencies, spec/design coverage, the R9/AC10 scope
boundary, and a line-by-line check of the plan's code-level claims against the
actual worktree source.

## Code-level claims verified against the worktree

All checked against `src/notation/layout.js` and
`src/notation/__tests__/layout.test.js` in this worktree.

- **Current source order `[annotations, ottava, tempo]`** — confirmed:
  annotations `if (aboveRHCount > 0)` at `layout.js:2885-2891`, ottava
  `if (systemHasRightOttavaAbove(members))` at `:2892-2896`, tempo
  `if (systemHasTempo(members))` at `:2897-2901`.
- **Untouched scaffolding** — declarations `let annotationAboveRHD/ottavaD/tempoD
  = null` at `:2882-2884`; `stackStep`/`innerZone`/`d`/`topExtent` setup
  `:2866-2881`; `topMargin` `:2902`; `at()` `:2903`; return `:2904-2909`. The
  return maps each lane field to its own `*D` (`:2906-2908`), so it needs no edit
  after the permutation — confirmed.
- **Block independence (the reorder's correctness premise)** — each `*D` is
  written exactly once in its own block and read once in the return; the only
  inter-block channels are `d` and `topExtent`. No block reads another block's
  `*D`. The pure permutation is therefore sound across all subsets and the deep
  stack.
- **Order-asserting test** — `layout.test.js:2059-2079`, inside
  `describe("layout-polish fixes", …)` (`:2043`). Current chain
  `tempoLaneY < ottavaAboveLaneY` (`:2066`),
  `ottavaAboveLaneY < annotationAboveRHLaneY` (`:2067-2069`),
  `annotationAboveRHLaneY < rightStaffTopY` (`:2070-2072`). The plan's flip
  yields `annotationAboveRHLaneY < tempoLaneY < ottavaAboveLaneY <
  rightStaffTopY` — exactly **AC1**. Emit-tracks-lane loops (`:2073-2078`) stay,
  covering **AC2**. Verified the test passes against current code (baseline
  green) via `npm run test:unit -- src/notation/__tests__/layout.test.js -t
  "stack above the staff"`.
- **AC5 is genuinely untested today** — `COMPREHENSIVE_SONG` (`:931`) carries
  exactly one above-RH annotation (`{ text: "C", placement: "above" }` at
  `:950`), so its first system has `aboveRHCount = 1`. The plan's premise for the
  new deep-stack test is correct.
- **Band fields the tasks assert on all exist** — `band.topMargin` (`:1919`),
  `band.tempoLaneY` (`:1928`), `band.ottavaAboveLaneY` (`:1929`),
  `band.annotationAboveRHLaneY` (`:1936`). `deep.texts.tempos` is a valid field.
- **Tempo fixture shape** `{ bpm: 120, beatUnit: "quarter" }` matches the
  project convention (`:934`).
- **TDD failure direction is correct** — under the current order annotations are
  reserved first (largest Y, nearest staff), so today
  `annotationAboveRHLaneY > tempoLaneY`; the new test's
  `annotationAboveRHLaneY < tempoLaneY` therefore fails against current code and
  genuinely drives the reorder.
- **R9 doc-comment sites exist as cited** — M1 doc-comment `layout.js:2849-2852`,
  M2 call-site comment `:1866`, M3 tempo-emit comment `// Topmost lane, above the
  note zone.` at `:2947`.

## Task structure, ordering, coverage

- **Fields complete.** Every task carries Goal / Files / Changes / Depends on /
  Traces to / Acceptance. Each is self-contained and executable by a fresh
  code-writer.
- **TDD ordering correct.** Task 1 (deep-stack AC5 test) and Task 2 (flip the
  order assertions) are written first and fail against current code; Task 3 (the
  production reorder) makes them green and `Depends on` both. Task 4 is correctly
  marked optional (AC4 nice-to-have, matching design §7.3) and `Depends on`
  Task 3.
- **Spec/design fully covered.** The three required pieces are all present and
  correctly specified: (1) reorder the three reservation blocks to
  `[ottava, tempo, annotations]` (Task 3, design D1/§3); (2) the inverted order
  assertions in the existing test (Task 2, design §7.1); (3) the new deep-stack
  AC5 test (Task 1, design §7.2). The "tests that stay valid as-is" set
  (AC3/AC6/AC7/AC8/AC9, design §7.4) is correctly left untouched.
- **Smart deviation from the design's illustration.** The design §7.2 sketched a
  `note(...)` helper; the test file has no shared `note(...)` helper (only
  block-scoped ones with different signatures at `:2949`, `:3451`, `:3658`).
  Task 1 correctly builds an inline song object via
  `buildLayoutModel(deepSong, 200).systems[0]` — the executable, fixture-style
  approach. Good.

## R9 / AC10 boundary — not orphaned

The writer deferred the three R9 doc-comment updates (M1
`layout.js:2849-2852`, M2 `:1866`, M3 `:2947`) to the doc plan. This is **sound**
for this project and, crucially, **not orphaned**:

- The plan's header (line 6) states documentation updates "are handled in the
  separate doc plan in this phase."
- The closing section (lines 177-180) repeats this explicitly and **names all
  three exact sites** (M1/M2/M3 with line numbers and design §6), stating they
  are "out of scope for this code plan and are covered by the separate doc plan
  in this phase."

Ownership is explicit and the sites are enumerated, so R9/AC10 cannot fall
through the cracks. The split between code plan (production + tests) and doc plan
(R9 comments) is appropriate for a sibling phase-3 artifact set.

## Minor, non-blocking notes for the code-writer

- **Test command name.** The plan's "Run tests" note says
  `npm test -- src/notation/__tests__/layout.test.js`. There is no `test`
  script; the project uses `npm run test:unit -- …` (`wp-scripts test-unit-js`,
  Jest — globals `describe`/`it`, not vitest). The full e2e suite is
  `npm run test:e2e` (Playwright), not `specs/render.spec.js` via the same
  runner. A code-writer will discover this, but the script name is technically
  inaccurate.
- **Cosmetic line-number drift (~1 line).** A few references are off by one
  (e.g. the `topMarginLayout` doc-comment is `:2849-2852`, the plan/design cite
  `:2850-2852`). Within tolerance; the cited anchors are unambiguous.

Neither note affects task correctness, ordering, coverage, or requirement
ownership.

## Decision

The plan is correct, well-ordered, fully covers the spec/design implementation
(reorder + inverted assertion + deep-stack AC5 test), and keeps R9/AC10 explicitly
owned by the doc plan. **APPROVED.**
