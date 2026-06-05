# Doc Plan: More horizontal space at the start of each measure

## Overview

This feature is a small, internal rendering refinement: it adds a fixed
horizontal lead-in (an "opening clearance", `MEASURE_START_PAD = 1.0` sp) at the
start of every measure on both staves, so the first event no longer hugs the
barline / measure boundary. All changes live in `src/notation/` and are
invisible at the author/song-format level — the same song JSON renders with
~1 sp more breathing room before the opening note. A repository-wide sweep of
the documentation surfaces (`README.md`, `AGENTS.md`, `docs/song-format.md`,
`.rp.md`) found **no external or narrative documentation that describes
measure-start spacing, names the layout spacing constants, or pins their numeric
values** — so this change drifts no shipped prose. The only documentation
surfaces the feature actually touches are **inline doc-comments in
`src/notation/constants.js` and `src/notation/layout.js`**, and those are already
fully authored by the code phase (code-plan tasks T1, T3, and T4). This doc plan
therefore does **not** create new prose; it consists of a single verification
task that confirms the external/narrative docs remain accurate after the code
lands, so nothing silently goes out of sync. The rationale for scoping new docs
out is recorded in the "Deliberately scoped out" section below.

## Tasks

### Task D1: Verify external and narrative docs stay accurate after the lead-in lands

- **Goal:** Confirm that the user-facing and contributor documentation
  (`README.md`, `AGENTS.md`, `docs/song-format.md`) remains correct after the
  measure-start lead-in ships, and that no statement about measure-start
  positioning, the first event's placement, or the notation engine's constants
  has become misleading — making any minimal correction only if a real drift is
  found.
- **Audience:** End users (song authors reading `docs/song-format.md`) and
  contributors (reading `README.md`'s notation-engine overview).
- **Files:**
  - `README.md` (verify; edit only if a real drift is found)
  - `docs/song-format.md` (verify; edit only if a real drift is found)
  - `AGENTS.md` (read-only reference — see Sections-scope; expected NO edit)
- **Sections-scope:**
  - In `docs/song-format.md`, re-read the **standalone-annotation `beat`**
    description and the **note `beat`** description (the passages that say an
    annotation/note with `beat` absent "anchors near the measure's left edge" /
    "at the bar's left edge", equivalent to `beat: 0`). Confirm these still read
    correctly: they describe which onset an event *anchors to* (the author's
    mental model), not a precise engraving offset, and `beat: 0` still anchors at
    the measure start after this change — the lead-in only adds uniform breathing
    room before that anchor and does not change which onset is first or move the
    author-facing semantics. Expected outcome: **no edit needed.** Only if a
    passage states a concrete pixel/sp gap or claims the first note sits *flush*
    against the boundary (it does not today) should it be softened — and a grep
    confirms no such concrete-gap claim exists.
  - In `README.md`, re-read the **`src/notation/` row of the file-map table**
    (the cell describing `layout.js` / `constants.js` as "the shared sp/layout
    constants" and "all musical geometry in staff-space units"). Confirm it stays
    accurate: it is a generic descriptor and does not enumerate constants or pin
    values, so adding `MEASURE_START_PAD` does not contradict it. Expected
    outcome: **no edit needed.** Do NOT add a per-constant list or document the
    lead-in value here — the README deliberately keeps field/value detail out of
    this overview.
  - Do NOT touch the inline doc-comments in `src/notation/constants.js`
    (`MEASURE_START_PAD`, `BARLINE_POST_PAD`) or `src/notation/layout.js`
    (the packing-pass and `leadInset` comments) — those are owned by code-plan
    tasks T1/T3/T4 and editing them here would duplicate or conflict with the
    code phase.
  - If any correction *is* made to `README.md` or `docs/song-format.md`, it MUST
    NOT reference the internal pipeline workflow or its artifacts (no `AC#`,
    `T#`, `design §`, "spec", "review N") — per `AGENTS.md`, shipped docs must
    read as a standalone project. `AGENTS.md` is consulted only for this rule and
    is not itself edited.
- **Depends on:** none (executed in phase 5 against the landed code; reads the
  implemented behavior to confirm doc accuracy).
- **Traces to:** Spec Requirement 6 (uniform across all measure types, including
  the author-invisible empty-measure case) and Spec Requirement 7 (no regression
  in dependent rendering); design "Components → `svg.js` (untouched)" and the
  author-invisible nature of the change; the absence of any spec requirement for
  new user-facing documentation.
- **Acceptance:**
  - The reader of `docs/song-format.md` still gets a correct mental model: a
    `beat`-absent / `beat: 0` event anchors at the start of its measure, and no
    passage claims the first event sits flush against the barline or states a
    concrete pixel/sp opening gap that the lead-in would falsify.
  - The reader of `README.md`'s notation-engine overview still gets an accurate
    description of `src/notation/` (`layout.js`, `constants.js`, staff-space
    geometry) with no contradiction introduced by the new constant.
  - If no drift is found, the task records that explicitly (the docs are verified
    unchanged); if a drift is found, the minimal correction is applied and
    contains no `.rp/`-workflow references.
  - No inline doc-comment in `src/notation/` is modified by this task (those are
    owned by the code phase).

## Deliberately scoped out

- **No new `MEASURE_START_PAD` doc-comment task.** The new constant's
  doc-comment is authored by code-plan **T1** (it ships the constant *with* its
  doc-comment in the "Horizontal spacing" section of `constants.js`). Adding a
  doc task for it would duplicate or conflict with the code phase.
- **No `BARLINE_POST_PAD` comment task.** The softening of that stale
  doc-comment is authored by code-plan **T4**. Owned by the code phase.
- **No `layout.js` inline-comment task.** The `leadInset` / packing-pass comment
  refreshes are authored by code-plan **T3** ("Comment hygiene"). Owned by the
  code phase.
- **No CHANGELOG entry.** The repository has no `CHANGELOG` file and no changelog
  section in `README.md` or elsewhere; the project does not keep one. Fabricating
  one for an internal spacing tweak is not warranted.
- **No README "spacing" / engraving-tuning section.** `README.md` documents the
  block's behavior, the song-format contract, and the contributor architecture;
  it deliberately keeps per-constant and per-value detail out (it defers
  field-level detail to `docs/song-format.md`). A sub-staff-space rendering
  refinement that does not change the song format or any author-visible contract
  does not earn a new section, and the spec asks for none.
- **No `docs/song-format.md` content addition.** The lead-in is invisible at the
  format level — the same JSON renders, just with more opening breathing room —
  so there is no new field, value, or author-facing behavior to document. D1
  only verifies the existing `beat`/left-edge prose stays accurate.
- **No `svg.js` / test documentation.** `svg.js` is untouched by the design, and
  test files are not a documentation surface; the code phase (T2, T5) owns them.
