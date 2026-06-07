# Doc Plan: More horizontal space at the start of each measure

## Overview

This feature is a small, internal rendering refinement: it adds a fixed
horizontal lead-in (an "opening clearance", `MEASURE_START_PAD = 1.0` sp) at the
start of every measure on both staves, so the first event no longer hugs the
barline / measure boundary. All changes live in `src/notation/` and are
invisible at the author/song-format level — the same song JSON renders with
~1 sp more breathing room before the opening note.

A repository-wide sweep of the documentation surfaces (`README.md`, `AGENTS.md`,
`docs/song-format.md`, and the inline doc-comments under `src/notation/`) found
**no external or author-facing documentation that describes measure-start
spacing, names the layout spacing constants, or pins their numeric values** — so
the user/contributor-facing prose drifts none. There is, however, **one
narrative inline doc-comment that the feature falsifies**: the
`ACCIDENTAL_LEAD_EXTRA` doc-comment in `src/notation/constants.js`. It currently
asserts that a plain opening note "hugs the boundary" and that an accidental
opening note "shifts right" relative to that hugging note — both claims become
untrue once the lead-in lands (under the larger-of composition the design adopts,
a plain opening note and an accidental opening note share the **same** opening
slot, so neither hugs the boundary and neither shifts right relative to the
other). The code phase does **not** own this comment — its enumerated
comment-hygiene touch points are the new `MEASURE_START_PAD` comment (code-plan
T1), the `BARLINE_POST_PAD` comment (T4), and the `layout.js` lead-inset /
packing comments (T3); the `ACCIDENTAL_LEAD_EXTRA` comment is named by none of
them. This doc plan therefore claims that comment as a doc-phase-owned surface
(Task D2).

In sum, the inline comments the code phase authors (`MEASURE_START_PAD`,
`BARLINE_POST_PAD`, and the `layout.js` comments) are out of this plan's scope;
the documentation surfaces this plan owns are (1) verifying the external /
author-facing prose stays accurate (Task D1) and (2) refreshing the stale
`ACCIDENTAL_LEAD_EXTRA` narrative the code phase leaves behind (Task D2). The
plan creates no new user-facing prose. The rationale for scoping the remaining
surfaces out is recorded in the "Deliberately scoped out" section below.

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
    owned by the code phase). The `ACCIDENTAL_LEAD_EXTRA` comment is the separate
    concern of Task D2.

### Task D2: Refresh the `ACCIDENTAL_LEAD_EXTRA` doc-comment so it stops describing the old hugging behavior

- **Goal:** Bring the `ACCIDENTAL_LEAD_EXTRA` doc-comment in
  `src/notation/constants.js` back in sync with the landed code. Its narrative
  currently describes the pre-lead-in world — that a plain opening note hugs the
  measure boundary and that an accidental opening note shifts right relative to
  that hugging note. After the lead-in lands, a plain opening note no longer hugs
  the boundary (it sits a uniform opening slot in from it) and an accidental
  opening note lands at the **same** opening position as a plain one (the two
  compose by the larger-of rule, not by stacking), with the accidental glyph
  drawn into / to the left of that opening slot rather than the note shifting
  right. Rewrite the comment to describe this composed behavior so the prose no
  longer contradicts the code.
- **Audience:** Contributors reading the notation engine's constants — the
  developer who needs to understand what role `ACCIDENTAL_LEAD_EXTRA` plays in
  the opening-measure spacing now that a uniform lead-in also exists.
- **Files:**
  - `src/notation/constants.js` (edit — the `ACCIDENTAL_LEAD_EXTRA` doc-comment
    only)
- **Sections-scope:**
  - Edit **only** the doc-comment block immediately above
    `export const ACCIDENTAL_LEAD_EXTRA` (today around `constants.js:139-145`).
    Do NOT change the constant's value (`= 1`), its name, or any code.
  - The refreshed comment must drop the two now-false clauses — that the plain
    opening note "hugs the boundary" and that an accidental opening note "shifts
    right by this much" relative to a hugging note — and instead describe
    `ACCIDENTAL_LEAD_EXTRA` as the accidental's share of the measure's opening
    slot, which composes with the uniform opening lead-in by the larger-of rule
    (so a plain and an accidental opening note share the same opening position),
    with the accidental glyph occupying that slot / drawn to the left of the
    notehead.
  - Do NOT duplicate or restate the `MEASURE_START_PAD` doc-comment that the code
    phase owns (code-plan T1). This comment may *refer* to the uniform opening
    lead-in (and may name `MEASURE_START_PAD` as the constant that supplies it,
    consistent with how `BARLINE_POST_PAD`'s comment cross-references it), but it
    must not re-explain what that constant is or re-document its value — it stays
    focused on the accidental's role.
  - Do NOT touch any other doc-comment in `constants.js` (the
    `MEASURE_START_PAD`, `BARLINE_POST_PAD`, and other comments are out of scope).
  - The rewritten comment must read as standalone project documentation: it MUST
    NOT reference the internal pipeline workflow or its artifacts (no `AC#`, `T#`,
    `design §`, "spec", "Decision D#", "review N"), per `AGENTS.md`.
- **Depends on:** Code phase (the `max()` composition landing — code-plan T3) and
  Task D1 (so all `constants.js` comment edits are reasoned about together).
  Executed in phase 5 **after** the code has landed, so the writer describes the
  shipped post-composition behavior by reading the actual `buildLayoutModel`
  logic and the final `MEASURE_START_PAD` / `BARLINE_POST_PAD` comments, not a
  predicted one.
- **Traces to:** Spec Acceptance Criterion 7 (no stale "hug the boundary"
  narrative left contradicting the lead-in) and Spec Acceptance Criterion 3 (an
  opening accidental note lands at the same opening position as a plain one, the
  glyph occupying the opening slot); code-plan T3 (the
  `openingClearance = max(MEASURE_START_PAD, noteAccidentalLead)` composition that
  falsifies the old comment).
- **Acceptance:**
  - A contributor reading the `ACCIDENTAL_LEAD_EXTRA` doc-comment understands that
    `ACCIDENTAL_LEAD_EXTRA` is the accidental's share of the measure's opening
    slot and that it composes with the uniform opening lead-in by the larger-of
    rule, so a plain opening note and an accidental opening note end up at the
    same opening position.
  - The comment no longer states or implies that a plain opening note hugs the
    measure boundary, and no longer states that an accidental opening note shifts
    right relative to a hugging plain note.
  - The comment still explains what the accidental glyph does with the slot (it
    occupies it / is drawn to the left of the notehead), so the constant's purpose
    remains clear.
  - The comment does not re-document `MEASURE_START_PAD` (no duplication of the
    constant the code phase owns), and contains no `.rp/`-workflow references
    (`AC#`, `T#`, `design §`, "spec", etc.).
  - The constant's value and declaration (`export const ACCIDENTAL_LEAD_EXTRA = 1`)
    are unchanged, and no other comment or code in `constants.js` is modified by
    this task.

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
