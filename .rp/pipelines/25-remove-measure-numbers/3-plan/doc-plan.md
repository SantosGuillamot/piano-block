# Doc Plan: Remove measure numbers from the notation

## Overview

This change removes the small measure-number labels the renderer prints
above-left of the first measure on every wrapped line after the first (e.g. a
"3" at the start of line 2). It is a pure rendering-output removal: no song
field, no block setting, and no other notation element changes. An end-to-end
sweep of the project's documentation surfaces found that **none of the shipped,
user-facing documentation ever describes or depends on the measure-number
label** — the README and the song-format reference describe the rendered
notation (what the front end shows, the above-staff tempo / ottava / dynamic
marks, the song format's `measures`/bar concept) but never the line-start number
labels. The format, the `song` attribute, and the editor UI are untouched, so
there is no author-facing field reference to update. Consequently this plan
contains a single verification task: a doc-writer confirms the user-facing docs
carry no now-stale reference to the removed label (a guard against drift), and
leaves them unchanged if — as the sweep indicates — none exists. All stale
*source* comments/JSDoc that mention the label are handled by the code phase
(they are inline code, not documentation; see "Surfaces swept" below), so this
plan does not duplicate them.

## Surfaces swept (and why each does or does not get a task)

This was a genuine end-to-end sweep of everything outside `node_modules/`,
`.git/`, and the pipeline's own `.rp/` artifacts.

- **`README.md`** — describes the block, the build model, the song format/validator,
  and "What the front end shows" (the rendered grand staff and its elements). It
  references "measure"/"measures" only as the song-format bar concept and never
  mentions the measure-number *label*. No stale prose to remove. → covered by
  Task 1's verification scope (expected no-op).
- **`docs/song-format.md`** — the canonical author-facing format reference. Every
  "measure" reference is about the format's bar/`measures` structure (barlines,
  events, standalone annotations on a measure), never the rendered line-start
  number. The format and `song` attribute are explicitly out of scope for this
  change, so nothing here needs updating. → covered by Task 1's verification scope
  (expected no-op).
- **`src/block.json` description and `package.json` description** — neither
  mentions measure numbers. → no task.
- **`specs/editor.spec.js`, `specs/render.spec.js`** (Playwright e2e) — the render
  spec asserts only on `[data-text="annotation"]` nodes and on wrapping behavior
  (how many systems render at different widths); it never asserts on a
  measure-number node, so the removal disturbs no existing assertion and there is
  no measure-number reference to scrub. (New automated coverage for the removal
  lives in the unit suite and is owned by the code phase, not here.) → no task.
- **`AGENTS.md`, `.rp.md`** — contributor/agent workflow and pipeline conventions;
  no measure-number references, and pipeline-internal by project convention. → no
  task.
- **CHANGELOG / readme.txt / CONTRIBUTING / `.github/`** — none exist in this
  repository. → no task.
- **Inline source comments / JSDoc** in `src/notation/layout.js`,
  `src/notation/svg.js`, `src/notation/constants.js` — these DO reference the
  measure-number label, but they are inline code, and this project treats
  comment/JSDoc trimming as **code** work (the code plan's tasks already trim the
  comments inside each edited function and delete the constant's doc comment).
  They are therefore owned by `code-plan.md`, not this plan, and are deliberately
  NOT duplicated here. (Note for the orchestrator: see the cross-phase note in the
  agent's report — three label-referencing comments outside the code plan's edited
  functions appear to fall outside its current task scope; that is a code-plan
  matter, not a doc surface.)

## Tasks

### Task 1: Verify the user-facing docs carry no stale measure-number reference

- **Goal:** Guarantee the shipped, user-facing documentation does not describe,
  promise, or otherwise depend on the now-removed measure-number label, so the
  docs stay in sync with the rendered output after the removal lands. The sweep
  indicates this is a no-op (no such reference exists today); this task makes that
  a checked, recorded outcome rather than an assumption, and scrubs/repairs any
  reference if one is found.
- **Audience:** End users / song authors reading the README and the song-format
  reference, and any reader who relies on the docs accurately describing what the
  published notation shows.
- **Files to change:** Verify across the shipped, user-facing documentation —
  `README.md` and `docs/song-format.md` — and edit one of them only if a
  reference to the removed label is actually found there. (The block/package
  descriptions in `src/block.json` and `package.json` were swept and carry no
  such reference; re-confirm if convenient, but they are not expected to change.)
- **Sections / scope:** In `README.md`, the rendered-notation narrative —
  "What the block does today", "What the front end shows", and "Forthcoming". In
  `docs/song-format.md`, any passage describing rendered notation or above-staff
  marks (its intro/front-end pointer and the gradual-dynamics "where it appears"
  note). Confirm none of these state or imply that the notation prints
  measure-number labels at line starts. Do NOT touch the song-format field
  reference, the `song` attribute, or the editor-UI description — the format and
  settings are unchanged by this feature.
- **Constraint:** Keep all internal-pipeline references out of any edit. Per the
  project convention, shipped docs must read as a standalone project — no mention
  of specs, design docs, plan tasks, acceptance-criterion identifiers, or review
  notes.
- **Depends on:** none.
- **Traces to:** Spec requirement 1 (no measure-number label is ever rendered) and
  requirement 2 (removal is unconditional, everywhere the notation renders) — the
  docs must not claim a behavior the renderer no longer has; spec Out-of-Scope
  (song format, `song` attribute, and editor UI unchanged) — so the author-facing
  field reference must remain untouched; code-plan Tasks 1–4 (the producer,
  spacing, consumer, and constant that drew the label are removed).
- **Acceptance:**
  - A reader of `README.md` and `docs/song-format.md` finds no statement, example,
    or implication that the rendered notation displays a measure-number label at
    the start of wrapped lines (or anywhere).
  - The documentation's description of the rendered notation and its above-staff
    elements (tempo marks, ottava brackets, dynamics) remains accurate and is not
    weakened or broken by the change — these elements are still documented as
    present.
  - The song-format field reference, the `song` attribute, and the editor-UI
    description are unchanged (the format and settings are out of scope for this
    feature).
  - If the verification finds no stale reference (the expected outcome of the
    sweep), the user-facing docs are left unchanged and that no-op result is the
    recorded conclusion; if any reference is found, it is removed or corrected so
    the docs match the post-removal rendering.
  - No internal-pipeline reference is introduced into any shipped doc.
