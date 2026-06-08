# Docs review — APPROVED — Issue #21: Space notes horizontally according to their duration

**Verdict: APPROVED.** This is the singleton docs-phase terminator. The approved
doc-plan's zero-documentation conclusion is **correct and holds against what
actually shipped**. I re-verified every load-bearing claim adversarially against
the real repo and the shipped diff; nothing user-facing or contributor-facing was
genuinely missed. Approving a zero-documentation outcome is the right call here:
#21 is a TEST-ONLY change with no source change, no new format field, no new
rendered marking, no new public symbol, and no new authoring capability.

## What actually shipped (verified against the diff)

`git diff --stat origin/trunk..HEAD -- ':!.rp'`:

```
 src/notation/__tests__/layout.test.js | 233 ++++++++++++++++++++++++++++++++++
 src/notation/__tests__/svg.test.js    |  42 ++++++
 2 files changed, 275 insertions(+)
```

Only two existing test files changed (+275, append-only). `git diff --name-only`
excluding `.rp/` lists exactly those two files; filtering out `__tests__` leaves
nothing — **no source/behavior file changed.** This matches the spec's "verify /
lock" framing exactly: the duration-ordered spacing behavior was already shipped;
#21 only adds regression tests that protect it.

## Independent verification of the no-docs decision

I treated the "none" conclusion with maximum skepticism and went looking for any
doc a real reader, contributor, or author would now need. I found none.

1. **`README.md` and `docs/song-format.md` are unchanged and SHOULD be.**
   `git diff origin/trunk..HEAD -- README.md docs/song-format.md` is **empty**. ✔
   - **File-layout table** (`README.md:118`) already lists `src/notation/__tests__/`
     with both `layout.test.js` and `svg.test.js`. #21 appends to those two existing
     files and creates **no new file**, so the table is already accurate — no edit. ✔
   - **"Tests" paragraph** (`README.md:166`) is generic — "The renderer's pure
     layout/emit layers have their own suite (`src/notation/__tests__/`), so the
     musical geometry is verified without a browser." It enumerates **no per-test
     cases** for the notation suite, so there is no list #21's tests should join, and
     per the #14 precedent it should not start one. The new tests fall inside that
     still-accurate sentence. ✔
   - **`docs/song-format.md` is author-facing and out of scope.** A grep for
     `spacing|horizontal|advance|geometry|pixel|duration-(based|order|propor)` surfaces
     only annotation/hairpin **placement** prose (per-event annotation columns, the
     `beat` anchor, the hairpin wedge span) — **never** the duration→spacing model,
     `advanceFor`, or any horizontal-spacing geometry. #21 adds no field, value, or
     authoring capability, so this reference gains nothing. The spec's `§Out of Scope`
     (line 211) confirms documentation of the duration→spacing contract is
     "optional/additive … not required for #21." ✔

2. **No NEW source symbol → nothing to doc-comment.** Every `const` introduced by
   the diff is a **test-local fixture variable** (`AC1_EVENTS`, `songOf`, `layout`,
   `chord`, `single`, `mixed`, etc.) — none are exported source symbols. The spacing
   symbols the tests reference already exist **with** doc-comments and are unchanged
   by #21: `advanceFor` (`layout.js:778`), `MIN_ADV`/`ADV_K` (`constants.js:64-67`),
   `MAX_STRETCH` (`constants.js:84`), `MEASURE_START_PAD` (`constants.js:79`). There
   is no symbol to document. ✔

3. **No CHANGELOG / release-notes venue exists.** Consistent with the doc-plan and
   its approval; no such file exists in the project, so no entry is possible or
   warranted. ✔

4. **AGENTS.md `.rp/`-free rule satisfied for the docs surface.** No shipped file
   references `.rp/`: `git diff origin/trunk..HEAD -- ':!.rp' | grep '\.rp/'` is
   empty. The two test files (and their in-test block comment) are `.rp/`-free, as
   the code-plan constrained. The docs surface ships nothing, so the rule is
   trivially satisfied for docs. ✔

## Observation (out of scope for this gate; recorded for transparency)

The shipped test descriptions use `(AC1)`…`(AC10)` tokens and an `AC1_EVENTS`
fixture name. AGENTS.md lists "acceptance criteria `AC#`" among workflow citations
to confine to `.rp/`. I considered whether this is a docs gap and concluded it is
**not my gate to act on**, for three reasons: (a) it is **test code** — `it()`
descriptions and a fixture identifier — owned by the **code phase**, not a
documentation deliverable; my mandate explicitly excludes the test files' own
intent text. (b) It is a **pre-existing, already-shipped convention**: `(AC4)`,
`(AC7)`, `(AC8)` already appear in `svg.test.js` on `origin/trunk` (lines 1150,
1186, 1222) from the prior hairpin/dynamics work, so #21 merely follows an
established pattern the code phase (plan → writer → code-reviewer) already accepted.
(c) It touches **no documentation** (README, song-format.md, doc-comments), so the
zero-docs decision is unaffected either way. I flag it here only so the record is
complete; it does **not** create a docs task and does **not** block this approval.

## Conclusion

A zero-documentation docs phase is the correct outcome for this TEST-ONLY,
no-source-change, no-new-authoring-capability issue. The shipped diff is exactly
what the doc-plan predicted (two test files, +275, append-only), `README.md` and
`docs/song-format.md` are unchanged and should remain so, no new symbol needs a
doc-comment, and no shipped file cites the `.rp/` workflow. The doc-plan's
reasoning and the #14 precedent hold against what actually shipped. **APPROVED.**
