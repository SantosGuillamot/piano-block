# Doc-plan review — APPROVED

Pipeline: `27-beamed-note-stems` (phase 3 — Plan)
Reviewer: doc-plan-reviewer
Iteration: N=1 (no prior rejections)

Reviewed: `.rp/pipelines/27-beamed-note-stems/3-plan/doc-plan.md`
Against: `1-spec/spec.md`, `2-design-doc/design-doc.md`, `3-plan/code-plan.md`,
and the repository's actual docs (`README.md`, `docs/song-format.md`,
`AGENTS.md`), source (`src/notation/layout.js`, `src/notation/svg.js`), and the
cited precedents (#21, #15, #14).

## Verdict

**APPROVED.** The doc plan's central conclusion — that #27 warrants **zero
documentation tasks** — is correct and well-defended. I scrutinized that verdict
adversarially, since "no tasks" is the easiest verdict to get wrong, and every
load-bearing claim it rests on verifies against the actual repository.

## What I verified (and the result)

### The change really adds no documentable surface

`spec.md` and `code-plan.md` agree the fix is one offset inside `beamGeometry`
(`src/notation/layout.js`) plus three test edits in `layout.test.js`. It adds no
authoring format field/value, no new rendered marking, and no new exported
symbol. The code plan's `stemDx` / `shiftedMembers` are **local variables**
inside `beamGeometry` with no new import and no new public symbol — so there is
no new symbol whose JSDoc would need authoring. Confirmed.

### The two user-facing docs are genuinely out of scope

- There are exactly **two** user-facing docs (`README.md`, `docs/song-format.md`);
  `.rp.md` is pipeline config, not user-facing. Confirmed by enumerating all
  shipped `.md` files.
- `grep -inE "stem|beam|notehead|engrav"` over `README.md` returns only
  note-name-map, Tests, and cross-link hits — **nothing** about stem/beam
  placement. Confirmed.
- `stem`/`beam` appear **nowhere** in `docs/song-format.md`; the only `notehead`
  hits are annotation-alignment prose, untouched by this change. Confirmed.
- `README.md:45` is `### 4. What the front end shows` (capability-level —
  "notes, rests, and accidentals are drawn"; no claim about where a stem
  attaches) and `README.md:166` is the "Tests" paragraph whose generic
  `src/notation/__tests__/` sentence already covers the new `beamGeometry`
  assertions. Both citations resolve exactly as the plan states. The
  `#4-what-the-front-end-shows` anchor matches GitHub's heading slug.

### The #15-derived in-source check — the one thing that could warrant a task

This is the sharpest test, because #15's doc plan found doc-writer work
**precisely** because stale in-source prose asserted the old behaviour
("4/4 eighths beam in 2s"). The doc plan claims it checked `beamGeometry`'s
comments and found none assert center-anchored stems. I verified this directly:

- `beamGeometry`'s JSDoc and inline comments (`layout.js:483-572`) describe the
  **direction rule** (extreme rule), the **flat-beam Y** computation, which
  notehead a stem attaches to **vertically** (lowest for up / highest for down),
  and the **primary/secondary/stub** structure. **None claims the stem X sits at
  the notehead center.** The center-anchored behaviour lived only in the bare
  code (`x: m.x`, line 530), with no narrative asserting it. So, unlike #15,
  there is no stale prose to correct. Confirmed.
- The input-`x` JSDoc ("the emit/spacing layer supplies the per-column X") still
  describes the unchanged input contract — the fix shifts an internal copy, not
  the input — so it does not become stale. Confirmed.
- `svg.js` `renderBeam` (`813-836`) draws `stem.x`/`segment.x1`/`segment.x2`
  verbatim (only horizontal math is the `Math.abs(x2-x1)` width passthrough); its
  doc-comment makes no X-placement claim, so it does not become stale. The plan's
  "`svg.js` unchanged, no comment becomes wrong" claim holds. Confirmed.
- `renderStem`'s edge-rule comment (`svg.js:784-785`, "Stem-up attaches at the
  notehead's right edge…") stays accurate and is exactly the standalone rule the
  new in-source comment should reference. Correctly assigned to the code-writer.

### The precedents say what the plan says they say

- **#21** (rendering-geometry change): doc plan reached "NO documentation is
  warranted" with **zero** doc-writer tasks, on the same reasoning. Confirmed by
  reading its doc-plan.
- **#15** (engraving refinement that changed source): its only doc footprint was
  in-source prose because a JSDoc asserted the now-wrong old behaviour — the
  exact distinguisher #27 lacks. Confirmed.
- **Git history** corroborates the pattern: every `doc-writer` commit on
  `README.md`/`docs/` maps to a **format/feature** change (octaveShift brackets,
  gradual dynamics, the notes→annotations rename, the song-format reference) —
  there is **no** doc-writer commit for a pure engraving-geometry refinement.

### Supporting claims

- No `CHANGELOG`/release-notes file exists; the format has no `version` field.
  Confirmed.
- `AGENTS.md` carries the verbatim rule barring `.rp/`-workflow references
  (`design §X`, `AC#`, `T#`, "review N") in shipped code/docs. Confirmed.
- No screenshot/snapshot baselines exist anywhere in the repo, so "nothing to
  re-bless" holds. Confirmed.

## Drift-resistance assessment

The plan is well-built against a later docs phase inventing or contradicting
documentation. It (1) records the AGENTS.md constraint so any prose that ever
ships stays workflow-free; (2) explicitly disclaims the in-source comment and
test assertions as code-writer-owned (code-plan Tasks 1–3), preventing
double-ownership; (3) names exactly where future stem/beam-engraving docs would
live if a separate issue ever warranted them; and (4) gives a verifiable
acceptance check (`git diff` on `README.md`/`docs/song-format.md` is empty after
the Code phase).

## Alignment with spec and code plan

The doc plan introduces no contradiction with spec R1-R6/AC1-8 or the code
plan. Its scope (no doc changes) is consistent with the spec's R5/R8 scope and
the code plan's file boundaries.

## Nits (non-blocking, not required to address)

- The doc plan references "R5/R8" in spirit via the code plan; the spec labels
  scope as R5 (and acceptance criterion 8). No action needed — the doc plan
  itself does not mis-cite.

No blocking issues. Approved.
