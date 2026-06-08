# Doc Plan Review — Editor UI for editing the song

**Verdict: approved**

Reviewed `3-plan/doc-plan.md` (tasks D1–D5) adversarially against `1-spec/spec.md`
(Req 1–13, AC1–AC12), `2-design-doc/design-doc.md`, `3-plan/code-plan.md`
(T1–T15), and the live repo docs (`README.md`, `docs/song-format.md`,
`AGENTS.md`).

## Coverage — complete

Every user- and contributor-facing change the feature ships is documented, and
nothing is documented that the code plan does not ship:

- **Visual editor as the new default** — D1 (status blurb + "What the block does
  today"), D2 (authoring workflow), D4 (contributor file layout). Matches Req 1 /
  AC1 and code-plan T9/T12.
- **Live preview** (read-only, updates on edit, same notation as the front end) —
  D1, D2, D4. Matches Req 5 / AC6 and code-plan T10.
- **Raw JSON behind a mode switch** (not a side-by-side twin editor; preview is
  read-only) — D1, D2, D4. Matches Req 7/10 / AC7/AC11 and code-plan T12.
- **Drill-down navigation** (song → section → measure → event) — D2. Matches
  Req 2/3 and code-plan T8/T9.
- **Button-based add/remove/reorder, no drag-and-drop** — D2. Matches Req 3 /
  AC4 and code-plan T3.
- **Empty-start vs non-empty-invalid → raw-JSON routing** — D2. Matches Req 9 /
  AC2/AC8 and code-plan T9 (`EmptyState`/`InvalidState`).
- **Per-song note-name preservation (English/Spanish)** — D2 and D5. Matches
  Req 11 / AC9 and code-plan T2/T6.
- **"A visual authoring UI" removed from Forthcoming** — D3. Matches Req 1 / AC1.
- **`src/edit.js` as mode container + new `src/editor/` tree in the file-layout
  table** — D4. Matches Req 12/13 / AC10/AC12 and code-plan T12 + the `src/editor/`
  grouping.

No reader-visible change is missing; no invented UI detail (the plan explicitly
forbids over-specifying button labels/screens beyond what ships).

## Accuracy of "unchanged" — correct

- D5 keeps `docs/song-format.md` a **light touch**: only the "by hand / no visual
  editor yet" wording in the intro and the README cross-link targets are edited;
  the field tables, shapes, enums, inheritance rules, examples, and the annotated
  example are explicitly left untouched (sections-scope + acceptance). This is
  right — the format/schema does not change (Req 13, code-plan T15 boundary
  audit), so the reference must not be rewritten.
- D4 correctly preserves the rows for `src/view.js`, `src/render.php`,
  `src/notation/`, `src/song/*`, and `src/block.json` as unchanged and warns
  against falsely describing them as changed. Consistent with the editor-only
  boundary.

## Task shape — sound

All five tasks carry Goal / Audience / Files / Sections-scope / Depends on /
Traces to / Acceptance. File paths are real and verified to exist
(`README.md`, `docs/song-format.md`). Scope is confined to those two files only
(D1–D4 → `README.md`, D5 → `docs/song-format.md`); no source code and no
`AGENTS.md` edits — correct, since AGENTS.md is an internal contributor guide,
not a feature-facing doc. Dependency order is correct and necessary: D1 first;
D2/D3/D4 depend on D1; D5 depends on D2 for the anchor coordination.

## Drift resistance & scope — good

Tasks are scoped to specifically named sections (status blurb, "What the block
does today", "Using the Piano block", "Forthcoming", "File layout", song-format
"Intro and mental model"). No sweeping rewrites; D5 is explicitly minimal. The
existing anchors other docs depend on are protected (`#using-the-piano-block`,
`#4-what-the-front-end-shows`, `#annotated-example-song`).

## Anchor-renumbering risk — handled, not a defect

D2's "renumber steps as needed" could shift the `### 4. What the front end shows`
heading and therefore its `#4-what-the-front-end-shows` anchor, which is the
inbound target of **two** links in `docs/song-format.md` (lines 9 and 315 of the
current file). The plan addresses this explicitly and in both directions: D2's
acceptance flags the inbound-link update, and D5's sections-scope + acceptance
require the song-format links to resolve to the correct (possibly renumbered)
anchors, with D5 depending on D2. The plural "e.g. the `#using-the-piano-block`
and `#4-what-the-front-end-shows` links" in D5 covers both occurrences. This is
a correctly-mitigated coordination point, not a gap.

## AGENTS.md compliance — clean

The global "Shipped-doc constraints" block forbids `.rp/` references and any
`AC#`/`Req#`/`T#` citation in the shipped docs, and states that the "Traces to"
fields are planning-only and MUST NOT appear in the docs — matching AGENTS.md
exactly. Every task's acceptance independently re-asserts "No pipeline/AC/Req/T
references."

## Conclusion

The plan is thorough, accurate to the shipped behavior, tightly scoped, and
fully AGENTS.md-compliant. No blocking issues. Approved.
