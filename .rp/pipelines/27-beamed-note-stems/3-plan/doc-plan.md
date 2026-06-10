# Doc plan — Attach beamed-note stems to the side of the notehead

Issue: https://github.com/SantosGuillamot/piano-block/issues/27
Pipeline: `27-beamed-note-stems` (phase 3 — Plan)
Spec: `.rp/pipelines/27-beamed-note-stems/1-spec/spec.md`
Design doc: `.rp/pipelines/27-beamed-note-stems/2-design-doc/design-doc.md`
Code plan: `.rp/pipelines/27-beamed-note-stems/3-plan/code-plan.md`

## Verdict (read first): NO documentation is warranted

This change corrects an **internal rendering-geometry inconsistency** — beamed
stems were drawn through the notehead center instead of at the notehead edge,
where standalone stems already sit. It moves the stem/beam X by `±NOTEHEAD_RX`
inside `beamGeometry`, plus three test edits in `layout.test.js`. It changes
**no authoring format**, adds **no new field or value**, introduces **no new
rendered marking**, adds **no new constant or function**, and changes **no
behaviour an author interacts with or that any document describes**. Measured
against this repository's actual documentation conventions (verified below and
backed by two near-identical precedents), **the correct amount of documentation
for #27 is none.** This plan therefore contains **zero doc-writer tasks** and
records why, so a later docs phase does not invent documentation for a
non-existent feature or contradict the established pattern.

The only prose that ships with this change — the short in-source comment the
code-writer adds at the `stemDx` / `shiftedMembers` insertion point (code-plan
Task 1, item 1) and the extended/added test assertions (code-plan Tasks 1–3) —
is **not a documentation deliverable.** It is production/test code authored and
owned by the code-writer, already specified in `3-plan/code-plan.md`. It must
**not** be re-planned or duplicated here.

## How this repository documents changes (what I verified)

I surveyed the real repo (not just the pipeline artifacts) to learn its
conventions and to confirm the doc blast radius is empty.

- **User-facing surface area — exactly two documents:**
  - `README.md` — project overview + a "For contributors" section (build
    model, file layout, scripts, the song format/validator, a "Tests"
    paragraph). Its [What the front end shows](../../../../README.md#4-what-the-front-end-shows)
    section describes the rendered notation at a **capability** level ("the
    staves, clefs, notes, rests, and accidentals are drawn by the plugin
    itself"). It does **not** describe engraving geometry — no stems, no beams,
    no notehead edges. `grep -in -E "stem|beam|notehead|engrav"` over
    `README.md` returns **nothing** relevant to stem/beam placement.
  - `docs/song-format.md` — the **author-facing** reference for the song JSON
    format: every field, allowed values, the two note-name systems, the
    annotated example. It documents *what the author writes*, not rendering
    geometry. "stem" and "beam" appear **nowhere** in it; the only "notehead"
    mentions are about annotation alignment, untouched by this change. The fix
    adds no field, value, or authoring capability for it to cover.
- **No CHANGELOG / release-notes file exists.** The project keeps none
  (`package.json` is a private scaffold; `README.md` states the format has "no
  `version` field"). No changelog entry is possible or warranted.
- **`AGENTS.md` hard rule.** Shipped code and docs must contain **no reference
  to the `.rp/` workflow** — no `design §X`, no `AC#`, no plan-task `T#`, no
  "review N". Any prose that ever ships must obey this. (This plan ships
  nothing; the rule is recorded so a later phase cannot violate it, and so the
  code-writer's in-source comment stays workflow-free.)
- **Engraving/layout internals are NOT user-documented.** They live as
  **in-source doc-comments** on the constants/functions (e.g. `NOTEHEAD_RX`,
  `STEM_LENGTH`, `beamGeometry`, `renderStem`/`renderBeam`) and as
  **test-file block comments / feature-grouped `describe` blocks**. Neither
  `README.md` nor `docs/song-format.md` describes stem or beam placement.
- **When user docs DO change.** The doc-writer commits to `README.md` /
  `docs/song-format.md` are reserved for **format/feature** changes — new
  optional fields (gradual dynamics `crescendo`/`decrescendo`), new rendered
  markings (octave-shift brackets, hairpin wedges), the `notes`→`annotations`
  rename. Every one added or changed an author-visible capability. #27 adds
  none.

### Decisive precedents

Two prior pipelines are direct analogs and settle the question:

- **#21 — "Space notes horizontally according to their duration"** (a
  rendering-geometry change). Its doc-plan
  (`.rp/pipelines/21-note-spacing-by-duration/3-plan/doc-plan.md`) reached the
  verdict **"NO documentation is warranted"** with **zero doc-writer tasks**,
  on exactly the reasoning above: spacing is rendering geometry, out of the
  format reference's scope; no new field, value, or capability; the README's
  "Tests" sentence already covers the new layout tests generically. #27 is the
  same shape (a geometry refinement on the layout layer), and like #21 it does
  add a little ships-with-the-code prose (there, a test `describe` block
  comment; here, one in-source comment plus test assertions) — explicitly **not**
  a doc deliverable in either case.

- **#15 — "Beam chained eighth notes as a single group"** and **#14 —
  "measure-start spacing"** (engraving refinements that *did* change source).
  Both touched **zero** user-facing docs; their entire documentation footprint
  was **in-source doc-comments on the symbols they changed.** #15's doc-plan
  found its only "doc blast radius" was stale in-source prose (a JSDoc that
  still asserted the old "beam in pairs" behaviour) — and confirmed `README.md`
  and `docs/song-format.md` needed no change because "beam" appears in neither.

### Why #27's doc blast radius is empty even in-source

The #15 precedent flags the one thing that *could* warrant a task: in-source
prose that asserts the **old** (now-wrong) behaviour. I checked `beamGeometry`
(`src/notation/layout.js:495–575`) directly. Its JSDoc and inline comments
describe the **direction rule**, the **beam Y** (extreme-stem-end) computation,
the **stem spans**, and the **primary/secondary/stub segment** structure. **None
of them claims the stem X sits at the notehead center.** The center-anchored
behaviour lived only in the code (`x: m.x`), with no narrative asserting it. So,
unlike #15, there is no stale prose to correct — not in the user docs, and not
even in the source comments. The new in-source comment the code-writer adds
(explaining the edge offset) is fresh prose introduced *by* the code change, owned
by code-plan Task 1, not a pre-existing comment this plan must fix.

## Applying the conventions to #27

| Candidate venue | Warranted? | Why |
| --- | --- | --- |
| `CHANGELOG` / release note | **No** | No such file exists; the project keeps no release notes and has no format `version` to annotate. |
| `docs/song-format.md` | **No** | It documents the author-written JSON format. #27 adds no field, value, or authoring capability. Stem/beam placement is rendering geometry, out of this doc's scope; "stem" and "beam" appear nowhere in it. |
| `README.md` "What the front end shows" (`README.md:45`) | **No** | Describes rendered notation at a capability level ("notes, rests, and accidentals are drawn"); it makes no claim about *where a stem attaches*. The fix changes nothing this section asserts. Adding stem/beam-geometry prose would over-document an internal refinement at a level the README deliberately abstracts above. |
| `README.md` "For contributors → Tests" (`README.md:166`) | **No** | This paragraph already covers the change generically: "The renderer's pure layout/emit layers have their own suite (`src/notation/__tests__/`), so the musical geometry is verified without a browser." The updated/added `beamGeometry` assertions fall inside that still-accurate sentence. Per the #14/#21 precedent, incremental engraving regression tests are not enumerated here. |
| `README.md` "File layout" | **No** | Already lists `src/notation/layout.js`, `svg.js`, and `src/notation/__tests__/` with `layout.test.js`. No new file is created (#27 edits existing files), so the table needs no edit. |
| In-source doc-comment (existing) | **No** | Doc-comments document a symbol's stated contract. `beamGeometry`'s JSDoc/comments do not assert center-anchored stems, so none becomes wrong. There is no existing comment to correct. |
| New in-source comment at the `stemDx`/`shiftedMembers` site | **N/A here** | Required, but it is **production code** owned by the code-writer (code-plan Task 1, item 1). Not a doc task; not re-planned here. It must stay free of `.rp/`-workflow references (`AGENTS.md`). |
| Extended / added `beamGeometry` test assertions | **N/A here** | **Test code** owned by the code-writer (code-plan Tasks 1–3). Not a doc task. |

## Tasks

**None.** This change warrants no documentation under the repository's
conventions.

(If a future, separate issue ever adds an author-facing or contributor-facing
description of stem/beam engraving — e.g. a "how the renderer engraves stems and
beams" contributor note — that documentation would live in-source on the
affected symbols and/or the README "For contributors" section, following the
#14/#15/#21 precedent. That is explicitly **not** part of #27 and is recorded
only to mark where such documentation would live if it ever became warranted.)

## Acceptance for this doc-plan

- The shipped tree's documentation (`README.md`, `docs/song-format.md`) is
  **unchanged** by #27 — verifiable: `git diff` on those paths is empty after
  the Code phase.
- No `.rp/`-workflow reference appears in any shipped file (`AGENTS.md` rule) —
  in particular the code-writer's new in-source comment at the
  `stemDx`/`shiftedMembers` site reads as standalone engine prose, citing the
  standalone `renderStem` edge rule, not any pipeline artifact.
- The plan adds no doc-writer task and does not duplicate the in-source comment
  or the test assertions that the code-plan already owns (code-plan Tasks 1–3).
