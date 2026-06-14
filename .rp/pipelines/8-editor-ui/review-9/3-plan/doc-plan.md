# Review 9 — Documentation Plan: README reconciliation for the front-end border removal + inspector-UI cleanup

Phase-5 documentation plan for review-9 of the Piano block (WordPress plugin; issue #8,
PR #22). This is an **ordered set of DOCUMENTATION tasks** (WHAT / WHERE / WHO) — not the
prose itself (that is the doc-writer in execution). The **spec**
(`../1-spec/spec.md`) is authoritative for WHAT shipped and the acceptance bar; the
**design doc** (`../2-design-doc/design-doc.md`) and **code plan**
(`../3-plan/code-plan.md`, tasks T1–T13) are authoritative for HOW. Every doc task's
acceptance is measured against the **SHIPPED code in the worktree**, not the plan's
intentions — the doc-writer must verify each claim against the real files (and, for M1,
the emitted `build/style-index.css`) before writing.

## What review-9 actually changes (the doc-relevant surface)

Review-9 is **entirely editor-side**. The song format/schema, `render.php`, the
front-end SVG draw, and the published render are **unchanged** — a published song renders
**byte-identically** before and after (M1 only *removes* a leaked editor style). So
`docs/song-format.md` (the author-facing format reference) needs **no edit**: no field,
enum, or schema rule changed. `AGENTS.md` (workflow guidance) is untouched.

**The only shipped doc that goes stale or gains new behavior is `README.md`.** The
review's author-/developer-visible changes map onto README passages as follows:

- **M1 + Optional polish 6 (SCSS headers):** README's build-model section claims
  `src/style.scss` carries "the block-wrapper rules" / "the `@font-face` declaration plus
  the block-wrapper rules (border, padding, color)" (`README.md:131` and the file-layout
  table row `:145`). After M1 deletes the `.wp-block-piano-block-piano { border/padding/
  color }` rule, `style.scss` carries **only** `@font-face` on the front end — so both
  README lines become FALSE in exactly the way the SCSS file headers do (those headers are
  the code phase's job in T1; the README lines are the doc phase's).
- **S2 (panel renames):** README's authoring walkthrough calls every panel's
  progressive-disclosure section a generic "*Advanced* disclosure" (`:37`, `:38`, `:39`,
  `:41`, `:45`). After S2 the four panels carry distinct domain titles ("Note details",
  "Barlines & annotations", "Section overrides", "Tempo & staves") — the "*Advanced*"
  wording is now stale UX.
- **S5 (label click = select-and-reveal):** README's selection description (`:29`) explains
  that selecting a tree row opens its panel; after S5 a **collapsed** section/measure label
  click now also **reveals** (expands) the row. New author-noticeable behavior; the README
  does not actively contradict it but is now incomplete.
- **S7 (section-delete confirmation):** README mentions "Remove section" / "Remove"
  (`:33`, `:39`) as immediate; after S7 the **section-level** delete asks for confirmation
  (measure/note removes stay immediate). New author-noticeable behavior.
- **Optional polish 3 (Rename menu item):** README lists the per-row menu as exactly
  "Duplicate / Add before / Add after / Remove" (`:19`, `:33`, and the contributor table
  `:143`). After polish 3 a **"Rename"** item is added to section/measure rows (note rows
  do not get it). The enumerated menu set is now incomplete.
- **S9 (`parseAndValidate()` + `validateSong()` wrapper):** README's contributor section
  calls `validateSong(rawString)` "the validator's **single** entry point" (`:181`). After
  S9 the module exports `validateSong` (default, byte-identical) **plus** a new named
  `parseAndValidate(raw) → { data, errors }`. The "single entry point" framing is now
  contributor-stale; the new named export is the developer-facing item the brief flags.

### Items that need NO doc edit (recorded so they are not silently revisited)

- **S1 (bare labels + hand-scoped `aria-label`), S3 (label shortenings), S4 (list-row
  alignment/CSS), S8 (no `EditableList`), S10 (`resetAll` dedup):** the README never quotes
  the affected control labels ("Right hand clef", "Note name", "Annotation placement", …),
  never describes trash-icon alignment, and never names `EditableList`/`resetAll`. Nothing
  in the shipped docs is stale, and these are low-level inspector polish / internal
  refactors with no author- or contributor-doc surface worth adding. No task.
- **S6 (deferred canvas highlight):** README `:29` already says "a section/measure canvas
  indication is a **later follow-up**" — that remains accurate (S6 is deferred to a tracking
  issue, not built). No edit. (A doc task only CONFIRMS this line still holds; see D3.)
- **`render.php` / `view.js` / front-end render contract:** unchanged. The README's
  render-contract and "What the front end shows" sections stay accurate (M1 removes only a
  CSS frame, not any render behavior). No task.
- **Optional polish 5 (PR "no new dependencies" line):** the FALSE claim lives in the
  **GitHub PR description**, which is the orchestrator's to fix at close-out — NOT a repo
  file. The README does **not** contain a "no new dependencies" claim; on the contrary,
  `README.md:143` already correctly states `@wordpress/icons` is "a bundled `@wordpress/*`
  runtime dependency." So there is **no repo doc to correct** for polish 5. This plan does
  not assign it a task; it is flagged here so the doc-writer/orchestrator does not hunt for
  a phantom README edit. **(Action owner: orchestrator, GitHub PR text — out of doc scope.)**

---

## Doc tasks

All tasks edit the **single file `README.md`**. They are ordered to group related passages
and minimize same-file churn; the doc-writer should apply them as a coherent set and verify
each against the shipped code before committing. **Standing rule (from `AGENTS.md`):** never
reference the pipeline workflow or its artifacts (`design §X`, `T#`, "review N", AC#) in
the README — it must read as a standalone project doc.

### D1 — Correct the build-model SCSS description (style.scss now carries only `@font-face` front-end-side)

- **Goal** — Make the README's build-model description of the two stylesheets accurate
  after M1: `src/style.scss` carries **only** the `@font-face` declaration on the front end
  (the dashed block-wrapper border/padding/color rule is gone); `src/editor.scss` carries
  the editor-only surface rules. Remove every "block-wrapper rules" / "border, padding,
  color" claim about `style.scss`.
- **Audience** — Plugin developer / contributor (the "For contributors → The build model"
  and "File layout" sections).
- **Files** — `README.md`.
- **Sections-scope** — The **build-model** bullet on SCSS (`README.md:131`, "Styles are
  split across two stylesheets…") and the **file-layout table** row for `src/style.scss`
  (`:145`, "Front-end / shared styling only — the `@font-face` declaration and the
  block-wrapper rules"). Re-confirm the `src/editor.scss` table row (`:146`) and the
  index.js row (`:141`) still read correctly after the change.
- **Depends on** — none.
- **Traces to** — M1 (front-end placeholder-border removal); Optional polish 6 (the SCSS
  header trim that T1 folds in). This documents the same reality the corrected
  `src/style.scss` / `src/editor.scss` file headers assert.
- **Acceptance** —
  - Neither `README.md:131` nor the `src/style.scss` table row claims `style.scss` carries
    "block-wrapper rules" or "border, padding, color"; both describe `style.scss` as
    carrying **only** the `@font-face` declaration on the front end.
  - The description matches the **shipped** `src/style.scss` (verify the file contains only
    the two header comments + `@font-face`, no `.wp-block-piano-block-piano { … }` rule)
    **and** the corrected `src/style.scss` / `src/editor.scss` file headers (the wording
    should not contradict the in-file headers T1 rewrote).
  - The `src/editor.scss` table row still accurately lists the editor-only surfaces
    (workspace, tree, canvas, selection highlight) — unchanged by M1, so it stays correct.
  - A grep of `README.md` finds no remaining "block-wrapper rules" / "border, padding,
    color" attribution to the front-end stylesheet.

### D2 — Update the inspector-panel names: the "Advanced" disclosures now have domain titles

- **Goal** — Replace the README's generic "*Advanced* disclosure" wording in the authoring
  walkthrough with the shipped distinct domain titles, so an author reading the README sees
  the panel names they will actually see in the editor.
- **Audience** — End author / user (the "Using the Piano block → Configure the selection in
  the sidebar" walkthrough).
- **Files** — `README.md`.
- **Sections-scope** — The "Configure the selection in the sidebar" bullets (`:37` Note
  panel "*Advanced* disclosure", `:38` Measure panel "behind *Advanced*", `:39` Section
  panel "behind *Advanced*", `:41` Song/tiered "behind *Advanced*") and the "**Progressive
  disclosure**" paragraph (`:45`, which generalizes "*Advanced* disclosure").
- **Depends on** — none.
- **Traces to** — S2 (rename the four "Advanced" panels to distinct domain names: Note
  details / Barlines & annotations / Section overrides / Tempo & staves; collapse
  SectionPanel's double wrapper).
- **Acceptance** —
  - Each walkthrough bullet names the panel's shipped title: the Note panel's advanced
    section reads **"Note details"**, the Measure panel's reads **"Barlines & annotations"**,
    the Section panel's reads **"Section overrides"**, and the Song panel's tiered advanced
    reads **"Tempo & staves"** — verified against the shipped `NotePanel.js`,
    `MeasurePanel.js`, `SectionPanel.js`, `ContextEditor.js` titles (the exact strings the
    code uses; re-confirm — design intent is fixed but exact wording is a code fact).
  - The "Progressive disclosure" paragraph still accurately describes the
    common-up-front / less-common-behind-a-disclosure pattern, but no longer implies every
    such disclosure is literally labelled "Advanced."
  - No README passage states that multiple panels read identically "Advanced."
  - The doc-writer does NOT over-claim: the disclosure UX (a small disclosure tucking the
    less-common settings) is unchanged; only the **titles** changed.

### D3 — Reflect the new tree-interaction behaviors: label click reveals, section delete confirms (and confirm S6 stays deferred)

- **Goal** — Update the structure-tree authoring description for the two new
  author-noticeable behaviors this review ships — a section/measure **label click now
  selects AND reveals** (expands a collapsed row), and **removing a section now asks for
  confirmation** — and confirm the existing "section/measure canvas indication is a later
  follow-up" sentence is still accurate (S6 deferred, not built).
- **Audience** — End author / user (the "Browse and select with the structure tree" and
  "Add, remove, and duplicate from the tree" / sidebar-panel passages).
- **Files** — `README.md`.
- **Sections-scope** — The "**Browse and select with the structure tree**" paragraph (`:29`,
  the selection + "later follow-up" sentence), the "**Add, remove, and duplicate from the
  tree**" paragraph (`:33`, "Remove"), and the **Section panel** bullet (`:39`, "convenience
  **Remove section**").
- **Depends on** — none.
- **Traces to** — S5 (label click select-and-reveal); S7 (section-level delete
  confirmation, both entry points: the structure-tree section row "Remove" and the Section
  panel "Remove section"); S6 (deferred — the existing "later follow-up" line must remain
  accurate, no canvas highlight was added).
- **Acceptance** —
  - The tree description states that **selecting** a section/measure row opens its panel AND
    that clicking a **collapsed** section/measure label also **reveals** (expands) the row's
    contents (clicking an already-expanded label selects without collapsing — collapse stays
    on the chevron / ArrowLeft). The note-row and hand-group-row behavior is described
    accurately (notes are leaves; hand-group rows toggle on click as before). Verified
    against the shipped `StructureTree.js` `RowLabelCell` `onClick`.
  - The delete description states that **removing a section** asks for **confirmation**
    (because it cascades to all the section's measures and notes), at **both** the
    structure-tree section row "Remove" and the **Section panel** "Remove section" button;
    and that **measure** and **note** removes stay **immediate** (recoverable via the
    editor's global undo). Verified against the shipped `StructureTree.js` /
    `SectionPanel.js` confirm wiring (the `ConfirmDialog`).
  - The existing "**a section/measure canvas indication is a later follow-up**" sentence
    (`:29`) is **kept and still accurate** — no canvas highlighting was added (S6 deferred).
    The doc-writer must NOT claim a section/measure canvas highlight now exists.
  - No artifact/workflow references leak into the prose (no "S5"/"S7", no "tracking issue
    number" — describe behavior, not the pipeline).

### D4 — Add "Rename" to the documented per-row menu (section/measure rows only)

- **Goal** — Update the README's enumeration of the structure-tree per-row action menu to
  include the new **"Rename"** item, scoped correctly (section and measure rows have it;
  note rows do not), so the documented menu set matches the shipped menu.
- **Audience** — End author / user (the per-row-menu enumeration) and, secondarily, the
  contributor file-layout note that lists the same menu set.
- **Files** — `README.md`.
- **Sections-scope** — The per-row-menu mentions in "Using the Piano block" (`:19`
  "Duplicate / Add before / Add after / Remove" and `:33` "**Duplicate**, **Add before**,
  **Add after**, and **Remove**") and the contributor file-layout `src/editor/` row that
  re-lists "Duplicate / Add before / Add after / Remove" (`:143`).
- **Depends on** — none. (May be authored alongside D3 since both touch the tree-menu
  passages, but it has no hard dependency.)
- **Traces to** — Optional polish 3 (add a "Rename" `MenuItem` to `RowActionsMenu`,
  rendered only when an `onRename` is provided — section/measure rows pass it, note rows do
  not).
- **Acceptance** —
  - The documented per-row menu includes **Rename** wherever the shipped menu does — i.e.
    section and measure rows. The doc-writer verifies against the shipped `RowActionsMenu` /
    `StructureTree.js` that note rows do **not** get a Rename item, and the README does not
    claim they do (if the README's enumeration is row-kind-agnostic, the prose must make the
    section/measure-only scope clear, or qualify it).
  - The README briefly describes what Rename does as shipped — i.e. it selects the row so
    its panel's **Name** field is the place to retype the name (the smallest in-scope
    mechanism the code uses; verify the shipped behavior — if it focuses the field, say so;
    if it only selects the row, say that and do not over-promise an inline editor).
  - The contributor file-layout `src/editor/` row's menu enumeration is updated to match (or
    left accurate) so the two menu lists in the README do not disagree.
  - Cross-check D4 against the shipped code last: if polish 3 (T13) was **not** shipped
    (it is an Optional item — confirm it landed before documenting it), this task is
    **dropped**, not written speculatively. Documenting a Rename item that did not ship would
    be worse than omitting it.

### D5 — Refresh the contributor validator note for the `parseAndValidate` split (single-parse path)

- **Goal** — Update the README's contributor description of the validator so it reflects the
  shipped two-export shape after S9: `validateSong` stays the default `(raw) → string[]`
  entry point (byte-identical), and a new named `parseAndValidate(raw) → { data, errors }`
  parses once and returns both the parsed object and the errors — used by `edit.js` to
  collapse the former double-parse to a single parse per change.
- **Audience** — Plugin developer / contributor (the "For contributors → The song format
  and validator" section).
- **Files** — `README.md`.
- **Sections-scope** — The "The song format and validator" subsection, specifically the
  sentence describing **`validateSong(rawString)` as "the validator's single entry point"**
  (`:181`). Add a brief note on `parseAndValidate` and the single-parse rationale; keep the
  `validateSong` contract description (its `(raw) → string[]` shape, "a parse failure *is* a
  conformance error," informational-only) intact and accurate.
- **Depends on** — none.
- **Traces to** — S9 (`parseAndValidate()` named export + thin `validateSong` wrapper; the
  `edit.js` single-parse switch and the deleted `safeParse`).
- **Acceptance** —
  - The README no longer calls `validateSong` the "single" entry point in a way that
    contradicts the new named export; it describes `validate.js` as exporting the
    `validateSong` default `(raw) → string[]` **and** the named
    `parseAndValidate(raw) → { data, errors }`, with `parseAndValidate` parsing the raw
    string **once** (the editor derives both the conformance errors and the parsed working
    object from one parse, instead of parsing twice). Verified against the shipped
    `src/song/validate.js` (both exports present; `validateSong` re-expressed as
    `parseAndValidate(raw).errors`) and `src/edit.js` (`safeParse` deleted; one parse path).
  - The `validateSong` contract description stays byte-accurate (default export, same
    signature, same `"Invalid JSON: …"` parse-failure behavior, informational-only,
    never-blocks-saving) — the front-end `view.js` gate still uses `validateSong` unchanged
    and the README must not imply `view.js` switched to `parseAndValidate`.
  - The note stays at the contributor altitude (it does not drag field-level format detail
    in — `docs/song-format.md` remains the author-facing reference) and contains no
    pipeline/workflow references.
  - This is a **low-priority** task: if the doc-writer judges the existing `:181` sentence
    survives with a one-clause tweak (drop "single", add the `parseAndValidate` mention),
    that is sufficient — do not balloon the validator subsection.

---

## Coverage check (every doc-relevant review-9 item maps to a task or an explicit no-op)

- **M1 + Optional polish 6** → **D1** (README build-model + style.scss table row).
- **S2** → **D2** (panel-name walkthrough).
- **S5 + S7 + S6-confirmation** → **D3** (tree-interaction behaviors; S6 line kept accurate).
- **Optional polish 3 (Rename)** → **D4** (gated on the item actually shipping).
- **S9** → **D5** (contributor validator note).
- **S1, S3, S4, S8, S10** → no doc task (no shipped-doc surface; recorded above).
- **S6 (the deferral itself)** → no edit beyond D3's confirmation that the existing
  "later follow-up" line stays accurate.
- **Optional polish 4 (microcopy), polish 1 (stale comment), polish 2 (`<Flex>` drop)** →
  no doc task (README quotes none of these; internal/microcopy only).
- **Optional polish 5 (PR "no new dependencies")** → **no repo doc task**; the false claim
  is in the GitHub PR description (orchestrator's close-out, out of doc scope). README is
  already correct on `@wordpress/icons` being a bundled runtime dependency.

## Honesty / drift guardrails for the doc-writer (apply to every task)

- **Verify against the SHIPPED code, not this plan.** Each task's acceptance points at the
  real worktree files (and, for D1, the emitted `build/style-index.css` should confirm the
  border rule is gone). Re-read the named files before writing; if the shipped code differs
  from what a task assumes (e.g. an Optional item did not land, or a panel title's exact
  wording differs), document **what shipped** — or drop the task — rather than the plan's
  intention.
- **D4 is conditional.** The Rename menu item is an Optional polish item; confirm it is in
  the shipped tree before documenting it. Do not document an un-shipped affordance.
- **Stay editor-side.** Nothing in review-9 changes the format, the front-end render, or the
  published output. Do not edit `docs/song-format.md`, and do not let any "what the front
  end shows" / render-contract README passage drift — they remain accurate.
- **No workflow/artifact leakage** (`AGENTS.md` rule): describe behavior and code, never
  "review N", `S#`/`T#`/`M1`, AC numbers, or `.rp/` artifacts, in the README prose.
