# Doc plan — Issue #21: Space notes horizontally according to their duration

## Verdict (read first): NO documentation is warranted

This change is **TEST-ONLY**. It adds regression tests that lock the
already-implemented, already-shipped duration-ordered horizontal-spacing behavior;
it changes **no source**, introduces **no new user-facing feature**, **no new
format field**, **no new rendered marking**, and **no new or changed constant or
function**. Measured honestly against this repository's actual documentation
conventions, **the correct amount of documentation for #21 is none.** This plan
therefore contains **zero doc-writer tasks** and records why, so a later docs phase
does not invent documentation for a non-existent feature.

The one piece of prose that ships with this change — the intent-stating **leading
block comment** above the new `describe("duration-ordered horizontal spacing
(issue #21)")` in `layout.test.js` — is **not a documentation deliverable**. It is
authored by the code-writer as part of the test code and is already specified in
`3-plan/code-plan.md` (Task 1, item 1). It must **not** be re-planned or
duplicated here.

## How this repository documents changes (what I verified)

I explored the real repo (not the pipeline artifacts) to learn its conventions:

- **Surface area.** There are exactly two user-facing docs:
  - `README.md` — project overview + a "For contributors" section (build model,
    file layout, scripts, the song format/validator, and a "Tests" paragraph).
  - `docs/song-format.md` — the **author-facing** reference for the song JSON
    format: every field, allowed values, note-name systems, an annotated example.
    It documents *what the author writes*, not rendering geometry.
- **No CHANGELOG / release-notes file exists.** The project keeps none
  (`package.json` is a private `0.1.0` scaffold). No changelog entry is possible
  or warranted.
- **`AGENTS.md` hard rule.** Shipped code and docs must contain **no reference to
  the `.rp/` workflow** — no `design §X`, no `AC#`, no plan-task `T#`, no
  "review N". Any documentation that ever ships must obey this. (This plan ships
  nothing, so the rule is satisfied trivially, but it is recorded so a later
  phase cannot violate it.)
- **Engraving/layout internals are NOT user-documented.** They live as **in-source
  doc-comments** on the constants/functions (e.g. `advanceFor`,
  `MEASURE_START_PAD`, `ACCIDENTAL_LEAD_EXTRA`, `BARLINE_POST_PAD`) and as
  **test-file block comments / feature-grouped `describe` blocks**. Neither
  `README.md` nor `docs/song-format.md` describes the horizontal-spacing model.
- **Decisive precedent — issue #14 ("horizontal breathing room at the start of
  each measure," commit `4ef0889`).** This is the closest analog to #21: a
  horizontal-spacing engraving refinement on the layout layer. Even though #14
  **did** change source (`layout.js`, `constants.js`) and add layout tests, it
  touched **zero** user-facing docs — `git log` over `README.md`/`docs/` for that
  work is empty. Its entire docs phase was **doc-comments on the spacing
  constants** it introduced/changed (`MEASURE_START_PAD`, `BARLINE_POST_PAD`,
  `ACCIDENTAL_LEAD_EXTRA`). The pattern is unambiguous: incremental engraving
  spacing work is documented in-source on the symbols it touches, never in the
  user docs.
- **When user docs DO change.** The doc-writer commits to `README.md` /
  `docs/song-format.md` are reserved for **format/feature** changes — new optional
  fields (gradual dynamics `crescendo`/`decrescendo`), new rendered markings
  (octaveShift brackets, hairpin wedges), and the `notes`→`annotations` rename.
  Every one of those added or changed an author-visible capability. #21 adds none.

## Applying the conventions to #21

| Candidate venue | Warranted? | Why |
| --- | --- | --- |
| `CHANGELOG` / release note | **No** | No such file exists; the project keeps no release notes. |
| `docs/song-format.md` | **No** | It documents the author-written JSON format. #21 adds no field, value, or authoring capability. Spacing is rendering geometry, out of this doc's scope. The spec marks a spacing-contract note as *optional/additive, not required for #21* (Spec §"Out of Scope": "Documentation of the duration→spacing contract is optional/additive… not required for #21"). |
| `README.md` "For contributors → Tests" (`README.md:166`) | **No** | This paragraph already covers the change generically: "The renderer's pure layout/emit layers have their own suite (`src/notation/__tests__/`), so the musical geometry is verified without a browser." The new regression tests fall inside that still-accurate sentence. Per the #14 precedent, incremental engraving regression tests are not enumerated here; adding a #21-specific sentence would over-document a test-only change and break the established pattern. |
| `README.md` "File layout" | **No** | Already lists `src/notation/__tests__/` with `layout.test.js`/`svg.test.js`. No new file is created (#21 appends to the two existing test files), so the table needs no edit. |
| In-source doc-comment | **No** | Doc-comments document a symbol. #21 adds/changes **no** source symbol (no new constant or function — the `advanceFor`/`MEASURE_START_PAD`/`MAX_STRETCH` doc-comments already exist and are unchanged). There is nothing to comment. |
| Leading block comment on the new test `describe` | **N/A here** | Required, but it is **test code** owned by the code-writer (code-plan Task 1). Not a doc task; not re-planned here. |

## Tasks

**None.** This change warrants no documentation under the repository's conventions.

(If a future, separate issue chooses to tune the compressive spacing constants —
the deferred OQ1/OQ2 follow-up gated on the owner's reference image — that change
would update the **in-source doc-comments** on the affected constants, following
the #14 precedent. That is explicitly **not** part of #21 and is recorded only to
mark where such documentation would live if it ever became warranted.)

## Acceptance for this doc-plan

- Shipped tree's documentation (`README.md`, `docs/song-format.md`) is **unchanged**
  by #21 — verifiable: `git diff` on those paths is empty after the Code phase.
- No `.rp/`-workflow reference appears in any shipped file (AGENTS.md rule) — trivially
  satisfied, as #21 ships only the two test files plus their in-test block comment,
  which the code-plan already constrains to be `.rp/`-free.
- The plan adds no doc-writer task and does not duplicate the test-file block comment
  that the code-plan already owns.
