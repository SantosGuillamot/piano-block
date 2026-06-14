# Review 9 — Code Plan: front-end placeholder-border leak + inspector-UI cleanup + reuse/simplification

Phase-4 implementation plan for review-9 of the Piano block (WordPress plugin; issue
#8, PR #22). This is an **ordered, dependency-aware** breakdown of TASKS a fresh
`code-writer` executes one at a time with TDD, on one working tree, sequentially. The
**design doc** (`../2-design-doc/design-doc.md`) is authoritative for HOW; the **spec**
(`../1-spec/spec.md`) is authoritative for WHAT and the acceptance bar. Where a task
rides a real `@wordpress/components` / `@wordpress/icons` contract or a build-output
fact, its acceptance demands real-component / e2e / emitted-CSS proof — a green mock must
not mask a real regression.

File/line references were re-confirmed against the live tree at `worktree-8-editor-ui`
(tip `c7a25d1`) while writing this plan; they will shift as fixes land, so a code-writer
must re-confirm the exact coordinates before editing (use the surrounding code excerpts
quoted here as the anchor, not the line number).

## Conventions every task obeys

- **Repo stays green at each commit.** The guardrails are `npm run test:unit`,
  `npm run build`, and `npm run check` (Biome — `check --write` formats + lints). Run all
  three before committing; a task is not done until they pass. The e2e specs
  (`specs/editor.spec.js`) cannot run here (Docker/Playwright unavailable), so they are
  kept **consistent-by-construction**: when a task changes behavior an e2e covers, the
  task edits the spec/docblock in the same commit so the spec still describes the shipped
  code, even though it is not executed in this run.
- **i18n**: every visible/aria string goes through `__`/`sprintf` with the `"piano-block"`
  text domain, matching the surrounding code. Do not touch the existing clean
  `sprintf` + `__` usage except where a task explicitly says so.
- **Out of scope / do-not-touch** (from spec "Out of Scope" + design §1): the song
  schema, `render.php`, the front-end SVG draw, the `view.js` `validateSong` gate, the
  TreeGrid keyboard model + `aria-hidden` chevron, `__next40pxDefaultSize` universality,
  the load-bearing `setSectionAt`/`setMeasureAt`/`setEventAt` + `omitEmpty`/`omitFalsy` +
  per-panel `resetAll` key sets duplication, and the hand-group row's bespoke
  non-selecting label cell. No task plans an edit to these. **S8 = no `EditableList`** is
  added (decision recorded; only S4's `alignment`/`className` and S1's labelling touch
  the three list files).
- **Three inherited corrections** (design §1, "Three spec-claim corrections"): S1 has real
  unit churn (the 3 `buttonByText("Right hand add alteration")` sites at
  `contextControls.test.js:347,371,385`); S10's `resetAll` swap is **unit-unobservable**
  (the `ToolsPanel` mock swallows `resetAll`), so its acceptance reflects that; S5 makes
  two e2e docblocks (`treeRow`, `expandRow`) stale and they must be updated.

## Ordering rationale (why this sequence)

The tasks are sequenced to (a) minimize same-file collisions on one working tree, (b)
respect real data dependencies, and (c) front-load the highest-value, lowest-risk fixes:

1. **T1 (M1 + polish 6)** is standalone (only `style.scss` + `editor.scss` + a build
   step) and the single Must-fix — do it first.
2. **T2 (S9 validate.js)** must land before **T3 (S9 edit.js)** because `edit.js`'s
   single-parse switch imports the new `parseAndValidate` named export.
3. **T4 (S1)** touches `HandConfigEditor.js` + `ListControls.js` (`AddButton`
   `aria-label`) + the 3 `contextControls` test sites. **T5 (S4)** also touches
   `HandConfigEditor.js` (alters row) + `PitchList.js` + `AnnotationList.js` + `editor.scss`.
   T4 before T5 so the HandConfigEditor label split lands first, then the alignment/className
   touch is a clean, separate edit on the same file (no rebase churn within one file).
4. **T6 (S3)** is independent label renames (PitchEditor/AnnotationEditor + their tests).
5. **T7 (S2 + S10)** is one combined edit to the SectionPanel `ToolsPanel` element (title
   rename + double-wrapper collapse + `resetAll` swap) plus the three other "Advanced"
   renames (NotePanel/MeasurePanel/ContextEditor) and the 3 pinned tiered-title test sites.
   It lands the SectionPanel structure **before** T9 (S7 entry A) adds a `ConfirmDialog`
   to that same file, so the two SectionPanel edits don't collide.
6. **T8 (S5)** is the `RowLabelCell` onClick change + its unit cases + two e2e docblocks.
   It lands the `RowLabelCell`/`StructureTree` behavior **before** T10 (S7 entry B) adds
   `pendingRemoveSection` state to `StructureTree`, so the two StructureTree edits are
   sequential, not overlapping.
7. **T9 (S7 mock prerequisite)** extends the unit mock with `ConfirmDialog` — a
   prerequisite for the S7 unit tests in T10/T11.
8. **T10 (S7 entry A — SectionPanel)** and **T11 (S7 entry B — StructureTree)** add the two
   controlled dialogs; both depend on T9's mock. T10 after T7 (SectionPanel structure
   settled); T11 after T8 (StructureTree behavior settled).
9. **T12 (S6 tracking issue)** files the GitHub issue — no source, can run any time after
   T1; placed late so it doesn't block code work.
10. **T13 (optional polish)** sweeps the small string/comment/wrapper edits + the Rename
    MenuItem; last so it rebases cleanly over everything.

S8 needs no task (it is a no-op decision, satisfied by T4/T5 leaving the three list
bodies separate). The PR-prose polish (item 5) is a doc-phase note, not a code change, so
it is **not** a code task (called out in T13's acceptance).

---

## T1 — M1: remove the front-end placeholder-border leak + reconcile the SCSS headers

- **Goal** — Delete the leaked `.wp-block-piano-block-piano` border/padding/color rule from
  `src/style.scss` and correct the now-stale `style.scss` + `editor.scss` headers, proven
  by the emitted `build/style-index.css`.
- **Files** — `src/style.scss`, `src/editor.scss`.
- **Changes**
  - In `src/style.scss`, delete the entire `.wp-block-piano-block-piano { border: 1px
    dashed #767676; padding: 1em; color: #767676; }` rule (currently `:25-29`). **Keep the
    `@font-face` block (`:17-23`) byte-for-byte** — the front-end SVG glyphs need the font.
    After this, `style.scss` carries only the two header comments + `@font-face`.
  - Correct the `src/style.scss` file header (`:1-5`): drop "and the shared wrapper rules"
    so it states that only the `@font-face` declaration loads on the front end (editor-only
    rules live in `editor.scss`).
  - In `src/editor.scss`, fold the file header (`:1-6`) and the in-block comment (`:9-16`)
    into **one** accurate description (this is also Optional polish item 6 — the duplicate
    `editor.scss` header trim). The corrected text must NOT claim `style.scss` carries
    "shared wrapper rules (border, padding, color)"; it should say `style.scss` carries
    only the `@font-face` on the front end and `editor.scss` carries the editor-only surface
    rules. Keep one header that accurately describes the file; do not leave two stale ones.
  - Do **not** add any editor-only replacement border affordance (spec M1.3 / design M1.4:
    pure removal).
- **Depends on** — none.
- **Traces to** — M1; Optional polish item 6.
- **Acceptance**
  - `src/style.scss` no longer contains `border`, `padding`, or `color` on
    `.wp-block-piano-block-piano`; the `@font-face` block is unchanged.
  - Both SCSS headers are accurate (no "shared wrapper rules" claim); `editor.scss` has a
    single file header, not a duplicated one.
  - **Emitted-artifact proof (required, not source-only):** run `npm run build`, then assert
    `build/style-index.css` no longer contains the wrapper border/padding/color rule (grep
    for `border:1px dashed` and `#767676` returns nothing in that file) and still contains
    the `@font-face` referencing the `.woff2` `url()`; assert `build/index.css` (editor
    bundle) is unaffected. Capture the grep result in the commit's verification. No existing
    unit test pins the wrapper rule (grep-confirmed), so the deletion breaks no test.
  - `npm run test:unit`, `npm run build`, `npm run check` all pass.

---

## T2 — S9 (part 1): add `parseAndValidate` named export to `song/validate.js`

- **Goal** — Add a `parseAndValidate(raw) → { data, errors }` named export that parses the
  string **once**, and re-express the default `validateSong` as a byte-identical thin
  wrapper over it.
- **Files** — `src/song/validate.js`, `src/song/__tests__/validate.test.js`.
- **Changes** (design S9, the exact shape):
  - Add, as a **new named export**, `parseAndValidate(rawString)`:
    - `try { data = JSON.parse(rawString) } catch (error) { return { data: null, errors:
      ["Invalid JSON: ${error.message}"] } }` — using the **exact** same
      `` `Invalid JSON: ${error.message}` `` template the current `validateSong` produces
      (so the parse-failure message is byte-identical).
    - On a successful parse: `const errors = []; validateValue(data, songSchema, "",
      errors); return { data, errors };` (the has-errors case still returns the parsed
      `data` — harmless; the caller decides).
  - Re-express the **default export** as `export default function validateSong(rawString)
    { return parseAndValidate(rawString).errors; }`. Its `(raw) → string[]` contract and
    its `"Invalid JSON: …"` output stay byte-identical. Keep the existing JSDoc on
    `validateSong`; add a JSDoc block for `parseAndValidate` documenting the three result
    shapes.
- **Depends on** — none.
- **Traces to** — S9.
- **Acceptance**
  - **New `parseAndValidate` unit tests** added to `validate.test.js` (a new `describe`):
    - conformant song (e.g. `'{"sections":[{"measures":[]}]}'`) → `{ data: <parsed
      object>, errors: [] }` (assert `data` deep-equals the parsed object and `errors` is
      `[]`).
    - invalid JSON (e.g. `"{ not json"`) → `{ data: null, errors: ["Invalid JSON: …"] }`
      (assert `data === null` and `errors` has exactly one message starting `Invalid
      JSON:`).
    - well-formed but non-conformant (e.g. `"{}"`) → `data` deep-equals `{}` AND `errors`
      is the same non-empty list `validateSong("{}")` returns (assert
      `parseAndValidate("{}").errors` equals `validateSong("{}")`).
  - **All existing `validateSong` tests stay green unchanged** (proves the default-export
    contract held byte-for-byte). `view.js` and the ~15 validator-dependent files are
    untouched.
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T3 — S9 (part 2): collapse `edit.js` to a single parse via `parseAndValidate`

- **Goal** — In `edit.js`, parse the song **once** via `parseAndValidate`, derive both
  `errors` and the parsed `working` from that one result, and delete `safeParse` and the
  second `JSON.parse`.
- **Files** — `src/edit.js`, `src/editor/__tests__/Edit.test.js` (only if a behavioral
  assertion needs it — see acceptance; the existing valid/invalid routing cases should
  stay green unchanged).
- **Changes** (design S9 "Where the switch lives"):
  - Change the import: `import validateSong, { parseAndValidate } from
    "./song/validate.js";` (keep the default import too — it is still used by nothing else
    in `edit.js` after the switch, so verify and drop `validateSong` from the import if it
    becomes unused, OR keep it if any other reference remains; re-confirm by grepping
    `edit.js` for `validateSong`).
  - Replace the two separate `useMemo`s (the `errors` memo `:140-143` and the `working`
    memo `:153-158`) with a single memo over `song` keyed on one `parseAndValidate(song)`
    result:
    - `const { data, errors } = useMemo(() => song.trim() === "" ? { data: newSong(),
      errors: [] } : parseAndValidate(song), [song]);`
    - Derive `working`: the empty-string branch already yields `data = newSong()` with
      `errors: []`; otherwise `working = errors.length > 0 ? null : data`. Keep `working`
      as a derived value (it can be a plain `const working = ...` after the memo, or folded
      into the memo's return — pick the shape that keeps `accessibleName`/`system`/
      `resolvedSelection` reading from `working` exactly as before). Preserve lazy seeding:
      the empty-string case seeds `newSong()` and the attribute stays `""` until first edit.
  - **Delete the `safeParse` function (`:51-57`)** and its only call.
  - Leave the observable routing unchanged: a valid song renders the canvas; a non-empty
    invalid one routes to `InvalidState` (`isInvalid` logic unchanged).
- **Depends on** — T2 (imports `parseAndValidate`).
- **Traces to** — S9.
- **Acceptance**
  - `edit.js` calls `JSON.parse` (directly or via `validateSong`) **once** per change:
    `safeParse` is deleted; there is exactly one parse path (`parseAndValidate`). Grep
    `edit.js` confirms no `safeParse` and no second `JSON.parse`.
  - Existing `Edit.test.js` cases stay green unchanged — the valid-song-renders-canvas and
    invalid-song-routes-to-InvalidState behaviors are preserved (the change is internal
    parse count, not observable routing). No new unit test is required, but if the
    code-writer wants a guard, a small assertion that a conformant `song` string still
    yields a rendered canvas (a `__canvas` element present) and an invalid one yields the
    InvalidState notice is acceptable — it must not change existing assertions.
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T4 — S1: drop the per-control hand prefix (bare visible label + hand-scoped `aria-label`)

- **Goal** — In `HandConfigEditor`, make each control's **visible** label the bare,
  title-cased field name while keeping its **accessible name** hand-scoped via an explicit
  `aria-label`; add an `aria-label` passthrough to `AddButton`.
- **Files** — `src/editor/HandConfigEditor.js`, `src/editor/ListControls.js`,
  `src/editor/__tests__/contextControls.test.js`.
- **Changes** (design S1 — mechanism OPT-1, "honest on the real component"):
  - In `ListControls.js`, `AddButton`: add an optional `aria-label` (accept it as
    `"aria-label": ariaLabel` in the destructure) and forward it to the inner `Button`'s
    `aria-label`. Visible children (`label`) stay the visible text. This is a small
    additive prop; the other two callers (`PitchList` "Add pitch", `AnnotationList` "Add
    annotation") pass no `aria-label`, so their accessible name is unchanged. Update
    `AddButton`'s JSDoc to document the new optional `aria-label`.
  - In `HandConfigEditor.js`, keep `fieldLabel(field)` composing the hand-scoped name via
    `sprintf("%1$s %2$s", label, field)` (it stays the **`aria-label`** source). Split each
    control's labelling into two props — bare title-cased **visible** `label` + hand-scoped
    **`aria-label`**:
    - clef `SelectControl` (`~:130`): `label={__("Clef", "piano-block")}`,
      `aria-label={fieldLabel(__("clef", "piano-block"))}`.
    - octave `NumberControl` (`~:140`): `label={__("Octave shift", "piano-block")}`,
      `aria-label={fieldLabel(__("octave shift", "piano-block"))}`.
    - alteration-note `SelectControl` (`~:160`): `label={__("Alteration note",
      "piano-block")}`, `aria-label={fieldLabel(__("alteration note", "piano-block"))}`.
    - alteration `NumberControl` (`~:170`): `label={__("Alteration", "piano-block")}`,
      `aria-label={fieldLabel(__("alteration", "piano-block"))}`.
    - per-row trash `Button` (`~:188`): keep `icon={trash}` (icon-only visible affordance,
      no visible text); replace its `label={fieldLabel(...)}` with
      `aria-label={fieldLabel(__("remove alteration", "piano-block"))}` (the `Button` mock
      maps `ariaLabel ?? label`, and the real Button accepts `aria-label`). Note: the
      existing code uses the `label` prop on Button for the accessible name; passing
      `aria-label` directly is equivalent on both mock and real component — re-confirm the
      real `Button` honors `aria-label` (it does). Keep `isDestructive`.
    - `AddButton` (`~:195`): `label={__("Add alteration", "piano-block")}` (visible),
      `aria-label={fieldLabel(__("add alteration", "piano-block"))}` (forwarded to inner
      Button via the new passthrough).
  - This intentionally creates **two i18n strings per control** (a title-cased visible
    label and a lower-case fragment fed to `fieldLabel`); that is the cleanest honest
    split (design "Capitalization design note"). Update the inline comment on `fieldLabel`
    to reflect that it now composes the **`aria-label`**, not the visible label.
  - Do **not** add a flat-layout per-hand `fieldset`/`legend` heading (design OMITS it;
    optional, adds test churn).
  - **Test churn (correction #1):** update the three `buttonByText(container, "Right hand
    add alteration")` sites in `contextControls.test.js` (`:347, :371, :385`) to
    `buttonByText(container, "Add alteration")` (the AddButton's **visible** text is now
    bare). The accessible-name queries stay unchanged: `fieldByName(..., "Right hand
    clef"/"Right hand octave shift"/"Right hand alteration note"/"Right hand
    alteration")` and `buttonByName(..., "Right hand remove alteration")` (`:365`) all
    still match because the `aria-label`s are preserved.
- **Depends on** — T1 (clean tree; no file overlap, but keeps the sequence linear).
- **Traces to** — S1; design correction #1.
- **Acceptance**
  - `HandConfigEditor` controls render **bare** visible labels ("Clef", "Octave shift",
    "Alteration note", "Alteration", "Add alteration") while each carries a hand-scoped
    `aria-label` ("Right hand clef", etc.). `AddButton` forwards an `aria-label` to its
    inner `Button`.
  - **New additive unit assertion (in `contextControls.test.js`):** assert the add button's
    **accessible name** is "Right hand add alteration" (`buttonByName`) while its **visible
    text** is "Add alteration" (`buttonByText`) — this locks the OPT-1 split on the mock.
    Optionally assert a control (e.g. clef select) has `aria-label="Right hand clef"` while
    not relying on a visible "Right hand clef" label.
  - The three updated `buttonByText` sites now find "Add alteration"; all accessible-name
    queries (clef/octave/alteration-note/alteration/remove) pass **unchanged** — proving
    the accessible name is preserved via `aria-label`.
  - **Real-component proof (standing constraint — required):** the e2e suite must include a
    check (add to `specs/editor.spec.js`, in the section/HandConfig context) that drives the
    real `SelectControl`/`Button` and confirms a control's **visible** label reads the bare
    form (e.g. "Clef") while its **accessible name** stays hand-scoped (e.g. "Right hand
    clef") — proving the `aria-label` override on the real `<select>`/`<input>`/`Button`,
    not only the mock. (Consistent-by-construction: write the spec assertion; it is not run
    here but must describe the shipped behavior. If no HandConfig control is currently
    reached in any e2e flow, add the smallest flow that opens the Song panel's tiered
    Advanced → Right hand and asserts the visible-vs-accessible split via Playwright's
    `getByLabel` for the accessible name and a text/visible-label query for the bare label.)
  - e2e churn for existing strings = zero (no `getByLabel`/`getByText` targets a
    HandConfig control today; the "Right hand"/"Left hand" e2e strings are tree rows /
    action labels, untouched).
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T5 — S4: fix the floating/misaligned trash icons in list rows (alignment + className + top-level CSS)

- **Goal** — Standardize `alignment="flex-start"` on all three list rows, give each row a
  `__list-row` className hook, and add a **top-level** editor-only CSS rule (so it reaches
  the sidebar DOM) carrying only the safe bits.
- **Files** — `src/editor/HandConfigEditor.js`, `src/editor/PitchList.js`,
  `src/editor/AnnotationList.js`, `src/editor.scss`, and the three list tests
  (`contextControls.test.js`, `pitches.test.js`, `annotations.test.js`) for the className
  assertions.
- **Changes** (design S4 — S8 keeps bodies separate, no shared component):
  - Add `alignment="flex-start"` to the `HandConfigEditor` alters-row `HStack` (`~:158`) —
    it is the one row lacking it. `PitchList` (`~:41`) and `AnnotationList` (`~:55`) already
    have it; leave those alignment props as-is.
  - Pass `className="wp-block-piano-block-piano__list-row"` on **each** of the three row
    `HStack`s directly (HandConfigEditor alters row, PitchList row, AnnotationList row).
    Today no list row passes a `className` (grep-clean); the `HStack` mock spreads
    `...rest` onto its `<div>` and the real `HStack` forwards `className`, so it reaches the
    DOM in both. Use the full BEM-style class (matching the existing `__tree`/`__canvas`
    convention) so the selector is unambiguous.
  - In `src/editor.scss`, add the rule as a **stylesheet-root** selector — NOT nested
    inside the `.wp-block-piano-block-piano { … }` block (the inspector renders in the
    sidebar, OUTSIDE the wrapper, so a nested rule would not match):
    ```scss
    // Top-level (sidebar is outside the block wrapper):
    .wp-block-piano-block-piano__list-row {
      > button:last-child { flex: 0 0 auto; }   // trailing trash: fixed-size, non-shrinking
      > :first-child { min-width: …; }           // leading editor keeps a sensible minimum
    }
    ```
    Load-bearing facts: **top-level selector**, **`flex: 0 0 auto` on the trailing trash**,
    **`min-width` on the leading control**, and **`align-items: flex-end` OMITTED** unless
    residual misalignment remains after S1+S3 shorten the labels. The exact `min-width`
    value and the precise child selectors are a code-phase detail — confirm the per-list
    child shape (the leaf editor — `PitchEditor`/`AnnotationEditor`/the two HandConfig
    controls — renders the leading children; the trash `Button` is trailing) and write
    selectors that match all three. A sensible `min-width` is on the order of the existing
    `__canvas-svg` `min-width` idiom; pick a value that keeps the leading select from
    collapsing (e.g. a few em) and document the choice in a comment.
  - Optionally add `size="small"` to the per-row trash `Button` in each list (review nicety;
    the real `Button` accepts it, the mock swallows it) — apply consistently across the
    three rows if added, or omit consistently.
- **Depends on** — T4 (HandConfigEditor edited there first; this is a separate, later edit
  on the same file).
- **Traces to** — S4; S8 (kept-separate, in-place).
- **Acceptance**
  - The `HandConfigEditor` alters row now has `alignment="flex-start"`; all three rows
    carry `className="wp-block-piano-block-piano__list-row"`.
  - The `editor.scss` `__list-row` rule is at the **stylesheet root** (not nested under the
    wrapper block), carries `flex: 0 0 auto` on the trash and `min-width` on the leading
    control, and **omits** `align-items: flex-end`.
  - **Unit (className hook present):** in each of `contextControls.test.js` (HandConfig
    alters), `pitches.test.js`, and `annotations.test.js`, add an assertion that
    `container.querySelector('.wp-block-piano-block-piano__list-row')` is non-null after a
    row renders (the mock spreads `className`, so it reaches the `<div>`). This proves the
    CSS has its hook. (The `HStack` mock swallows `alignment`, so alignment is NOT
    unit-observable — do not assert it at unit level.)
  - **e2e / real-component proof (required):** the actual visual alignment (trash no longer
    floats mid-row) must be exercised against the real `HStack`/`Button`/`SelectControl`.
    Add (or extend) an e2e assertion in `specs/editor.spec.js` that the trash button and its
    row's editor share the row baseline / the trash sits at the input edge — the smallest
    real-DOM check that the className rule engages. (Consistent-by-construction; not run
    here, but the spec must describe the shipped row.)
  - Existing `PitchList`/`AnnotationList`/`HandConfigEditor` tests stay green (no body
    refactor — S8).
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T6 — S3: shorten the four wrapping/truncating labels

- **Goal** — Shorten the four visible labels (`PitchEditor` "Note name" → "Note";
  `AnnotationEditor` "Annotation text/placement/staff" → "Text"/"Placement"/"Staff") and
  update every test querying the old names.
- **Files** — `src/editor/PitchEditor.js`, `src/editor/AnnotationEditor.js`,
  `src/editor/__tests__/NotePanel.test.js`, `src/editor/__tests__/pitches.test.js`,
  `src/editor/__tests__/annotations.test.js`.
- **Changes** (design S3 — these controls are single-instance per panel for the
  accessible-name purpose, so visible label = accessible name = the short form; no per-hand
  disambiguation, unlike S1):
  - `PitchEditor.js:62`: `label={__("Note name", "piano-block")}` → `__("Note",
    "piano-block")`.
  - `AnnotationEditor.js:32`: `"Annotation text"` → `"Text"`.
  - `AnnotationEditor.js:39`: `"Annotation placement"` → `"Placement"` (this is the fix
    for the "Ab…" truncation — the long label was starving the option text).
  - `AnnotationEditor.js:48`: `"Annotation staff"` → `"Staff"`.
  - Update tests querying the old names:
    - `NotePanel.test.js:184,316`: `[aria-label="Note name"]` → `"Note"`.
    - `pitches.test.js:170,184,197`: `fieldByName(…, "Note name")` → `"Note"`.
    - `annotations.test.js` (`:178,182,192,202,207,217,225,240`): `"Annotation
      text"/"Annotation placement"/"Annotation staff"` → `"Text"/"Placement"/"Staff"` at
      every `fieldByName` call site.
- **Depends on** — none (independent files; placed after T5 to keep the sequence linear).
- **Traces to** — S3.
- **Acceptance**
  - Visible labels are the short forms: `PitchEditor` shows "Note"; `AnnotationEditor`
    shows "Text"/"Placement"/"Staff". The placement select no longer carries the long
    "Annotation placement" label (so it no longer truncates — a real-component visual
    consequence of the shorter label; no separate e2e needed beyond the existing annotation
    e2e continuing to pass with the new label text).
  - Every test querying the old names is updated to the new short names and passes; no test
    still references "Note name"/"Annotation text"/"Annotation placement"/"Annotation
    staff" (grep the test suite to confirm none remain).
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T7 — S2 + S10: rename the four "Advanced" panels; collapse SectionPanel's double wrapper; swap its `resetAll`

- **Goal** — Give all four "Advanced" panels distinct domain titles, collapse
  `SectionPanel`'s redundant `ToolsPanel "Advanced"` → `ToolsPanelItem "Section overrides"`
  double wrapper into a single "Section overrides" disclosure, and replace its `resetAll`
  body with `() => emitOverrides({})`.
- **Files** — `src/editor/inspector/SectionPanel.js`,
  `src/editor/inspector/NotePanel.js`, `src/editor/inspector/MeasurePanel.js`,
  `src/editor/ContextEditor.js`, `src/editor/__tests__/contextControls.test.js`,
  `src/editor/__tests__/SongPanel.test.js`.
- **Changes** (design S2 + S10 — one combined edit on the SectionPanel `ToolsPanel`):
  - **Four title renames** (distinct domain names; no two visible panels read identically):
    - `NotePanel.js:157` `ToolsPanel label`: `"Advanced"` → `__("Note details",
      "piano-block")`.
    - `MeasurePanel.js:93` `ToolsPanel label`: `"Advanced"` → `__("Barlines &
      annotations", "piano-block")`.
    - `SectionPanel.js:126` `ToolsPanel label`: `"Advanced"` → `__("Section overrides",
      "piano-block")`.
    - `ContextEditor.js:195` (tiered) `ToolsPanel label`: `"Advanced"` → `__("Tempo &
      staves", "piano-block")`.
  - **SectionPanel double-wrapper collapse + S10 `resetAll` swap** (one element, `:125-142`):
    keep exactly **one** `ToolsPanelItem` child (a `ToolsPanel` needs ≥1 item to host the
    reveal/`hasValue`/`onDeselect` machinery — the `ContextEditor` cannot be a direct
    `ToolsPanel` child and still participate in per-item disclosure). The collapse is
    achieved by **retitling the outer panel to the domain name** (done above) so the visible
    redundancy ("Advanced" panel whose only child is a "Section overrides" item) is gone —
    the title now appears once, at the panel level. Replace the inline destructure `resetAll`
    body (`:127-133`) with `resetAll={() => emitOverrides({})}` (S10 — byte-identical
    behavior; `emitOverrides({})` performs the exact same override strip). Keep the retained
    `ToolsPanelItem`'s `onDeselect={() => emitOverrides({})}` and `hasValue` as-is. The
    resulting element:
    ```jsx
    <ToolsPanel
      label={__("Section overrides", "piano-block")}
      resetAll={() => emitOverrides({})}
    >
      <ToolsPanelItem
        label={__("Section overrides", "piano-block")}
        hasValue={() => Object.keys(overrides).length > 0}
        onDeselect={() => emitOverrides({})}
      >
        <ContextEditor context={overrides} onChange={emitOverrides} />
      </ToolsPanelItem>
    </ToolsPanel>
    ```
    (The retained item label and the panel label both read "Section overrides"; the item
    label is the per-item disclosure heading, the panel label is the panel title.)
  - **Pinned tiered-title test updates** (the three sites that assert the literal
    "Advanced" on the tiered panel):
    - `contextControls.test.js:260,272`: `container.querySelector('[aria-label="Advanced"]')`
      → `'[aria-label="Tempo & staves"]'`.
    - `SongPanel.test.js:284`: `container.querySelector('[aria-label="Advanced"]')` →
      `'[aria-label="Tempo & staves"]'` (the language-select-not-inside assertion).
  - The NotePanel/MeasurePanel/SectionPanel renames are not pinned by the literal
    "Advanced" string in tests (re-confirm by grepping the three test files for "Advanced"
    — only the tiered/`contextControls`/`SongPanel` sites should match). The code-writer
    MAY add an assertion in `NotePanel.test.js`/`MeasurePanel.test.js`/`SectionPanel.test.js`
    that the new title renders (the `ToolsPanel` mock exposes `label` as `aria-label`, so
    `[aria-label="Note details"]` etc. is queryable) and that "Advanced" no longer appears
    on these panels — small and unit-sufficient.
- **Depends on** — T5 (SectionPanel untouched by T5; this lands the SectionPanel structure
  before T10 adds a dialog to it).
- **Traces to** — S2; S10; design corrections #2 (S10 unit-unobservable).
- **Acceptance**
  - All four titles are distinct domain names (Note details / Barlines & annotations /
    Section overrides / Tempo & staves); no two visible panels read "Advanced".
  - SectionPanel's outer `ToolsPanel` reads "Section overrides" and its `resetAll` is
    `() => emitOverrides({})`; the single `ToolsPanelItem` is retained;
    `resetAll`/`onDeselect` both strip every override (byte-identical to before).
  - The three pinned tiered-title assertions are updated to "Tempo & staves" and pass; a
    grep confirms no test still asserts `[aria-label="Advanced"]`.
  - **S10 is unit-unobservable (correction #2):** the `ToolsPanel` mock swallows `resetAll`
    and no existing test drives it, so the spec's "existing reset test stays green" is
    vacuously true — the swap needs no new test and the existing
    `SectionPanel.test.js` "drops the tempo override when cleared" case (which clears via
    the control's `onChange`, not `resetAll`) stays green unchanged. Do NOT add a
    mock-extending `resetAll` test (out of scope, adds mock surface).
  - ToolsPanel reset/deselect emissions are unchanged.
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T8 — S5: make a section/measure label click "select-and-reveal"

- **Goal** — Change `RowLabelCell`'s label `Button` `onClick` to select always and expand
  only when the row is currently collapsed; update the unit cases and the two stale e2e
  docblocks.
- **Files** — `src/editor/StructureTree.js`,
  `src/editor/__tests__/StructureTree.test.js`, `specs/editor.spec.js`.
- **Changes** (design S5 — one-line onClick change, no new props):
  - In `RowLabelCell` (`~:141`), change the label `Button`'s `onClick` from `() =>
    onSelect?.()` to:
    ```jsx
    onClick={() => {
      onSelect?.();
      if (!isExpanded) onToggleExpanded?.(rowKey);
    }}
    ```
    The cell already receives `isExpanded`, `onToggleExpanded`, and `expansionKey: rowKey`
    — no new props. `RowLabelCell` is shared by section AND measure rows, so both gain
    select-and-reveal in one edit. Update the `RowLabelCell` JSDoc/inline comment (it
    currently says "select-only … never toggles") to describe select-and-reveal.
  - The **hand-group row** (`~:443-459`) is a separate bespoke cell — leave it unchanged
    (toggle-only, never selects). Do not touch it.
  - **Unit cases (`StructureTree.test.js` "select-only label vs chevron toggle"
    describe, `:376-405`):**
    - Rewrite the "selects (not toggles) when a section label is clicked" case (`:377-386`,
      `expanded: new Set()`): clicking a **collapsed** section label now asserts BOTH
      `calls.select === [{ kind: "section", sectionIndex: 0 }]` AND `calls.toggle ===
      ["s0"]`. Rename the case to reflect select-and-reveal (e.g. "selects AND expands when
      a collapsed section label is clicked").
    - Add a case: clicking an **already-expanded** section label (`expanded: new
      Set(["s0"])`) asserts `calls.select` fires but `calls.toggle === []` (no collapse).
    - The two chevron-toggle cases (`:388-405`) stay green unchanged (the chevron still
      toggles, never selects).
    - Optionally add a measure-label collapsed-click case asserting select + expand with
      the measure key, mirroring the section case.
  - **e2e (`specs/editor.spec.js`):** update the two stale docblocks AND add/adjust a real
    label-click reveal:
    - `treeRow` docblock (`~:280-298`): currently asserts the label is "SELECT-ONLY for
      section/measure/note rows … no longer toggles expansion". Update to: section/measure
      labels now **select-and-reveal** (select always, expand if collapsed); note rows
      remain select-only (notes are leaves, no expansion); the hand-group row remains the
      toggle-only/non-selecting exception. Keep the actions-trigger / add-note collision
      notes (still accurate).
    - `expandRow` docblock (`~:322-334`): currently asserts "the label is select-only, so a
      label click no longer expands — drilling … goes through the chevron". Update to: a
      collapsed-row label click now also expands (both the chevron and a collapsed-row label
      expand), so `expandRow` may keep clicking the chevron and its callers still work — but
      the comment must stop asserting the label can't expand. `expandRow`'s body (clicking
      the chevron) may stay as-is.
    - Add (or adapt the existing select-reveal flow near `:760-778`) a real label-click
      assertion: click a **collapsed** section/measure label (not the chevron) and confirm
      the row's descendants become visible — the reported "clicking the text doesn't reveal
      anything" fixed end to end. (Consistent-by-construction: write the spec; not run here.)
      Note the existing test at `:765,774` clicks `treeRow(...)` then separately
      `expandRow(...)` via chevron — after S5 the collapsed-label click itself reveals, so
      that flow can be tightened to assert the descendants appear from the label click;
      keep the spec coherent with the shipped behavior.
- **Depends on** — T7 (StructureTree untouched by T7; this lands the RowLabelCell behavior
  before T11 adds `pendingRemoveSection` state to StructureTree).
- **Traces to** — S5; design correction #3 (two stale docblocks).
- **Acceptance**
  - `RowLabelCell`'s label `onClick` fires `onSelect()` always and `onToggleExpanded(rowKey)`
    only when `!isExpanded`; collapse stays on the chevron/ArrowLeft; the hand-group row is
    unchanged.
  - The rewritten unit case asserts collapsed-section-label click = select + expand
    (`toggle === ["s0"]`); the new case asserts already-expanded-label click = select, no
    toggle (`toggle === []`); the chevron-toggle cases stay green.
  - Both stale e2e docblocks (`treeRow`, `expandRow`) are updated to describe
    select-and-reveal (hand-group remains the toggle-only exception); a real label-click
    reveal assertion exists in the spec (descendants become visible on a collapsed-label
    click).
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T9 — S7 (prerequisite): add an `isOpen`-respecting `ConfirmDialog` to the unit mock

- **Goal** — Extend `test/mocks/wordpress-components.js` with a controlled
  `__experimentalConfirmDialog` stand-in that renders nothing when closed and a
  message + confirm/cancel buttons when open.
- **Files** — `test/mocks/wordpress-components.js`.
- **Changes** (design S7 "Mock extension"):
  - Add a `ConfirmDialog` stand-in: render **nothing when `!isOpen`** (mirrors controlled
    mode, so tests not expecting a dialog see no stray buttons); when `isOpen`, render
    `children` (the message) plus a confirm `<button>` and a cancel `<button>` wired to
    `onConfirm`/`onCancel`. Give the two buttons **stable accessible names** so tests can
    locate them — use the real component's defaults ("OK" for confirm, "Cancel" for cancel)
    OR honor `confirmButtonText`/`cancelButtonText` props if passed; pick one and document
    it in the mock's JSDoc. (The S7 call sites in T10/T11 do not pass custom button text, so
    default "OK"/"Cancel" is the simplest — the unit tests will click by those names.)
  - Export it under `__experimentalConfirmDialog` (and optionally also `ConfirmDialog`) in
    the `module.exports` block. Add a JSDoc block mirroring the existing mock docstrings'
    style (note: respects `isOpen`, mirrors the real accept/cancel contract, renders
    nothing when closed).
- **Depends on** — none functionally (mock-only), but placed after T8 so it immediately
  precedes its consumers T10/T11.
- **Traces to** — S7 (test plumbing).
- **Acceptance**
  - The mock exports `__experimentalConfirmDialog`; the stand-in renders nothing when
    `isOpen` is false and renders the message + a confirm button + a cancel button (with
    stable, documented accessible names) when `isOpen` is true.
  - No existing test regresses (the mock addition is purely additive; nothing imports
    `ConfirmDialog` yet until T10). `npm run test:unit`, `npm run build`, `npm run check`
    pass.

---

## T10 — S7 (entry A): confirm the SectionPanel "Remove section" with a controlled `ConfirmDialog`

- **Goal** — Gate `SectionPanel`'s "Remove section" button behind a controlled
  `__experimentalConfirmDialog`, with `setIsOpen(false)` in both callbacks.
- **Files** — `src/editor/inspector/SectionPanel.js`,
  `src/editor/__tests__/SectionPanel.test.js`, `src/editor/__tests__/Edit.test.js`,
  `specs/editor.spec.js`.
- **Changes** (design S7 entry point A — self-contained, state local to the panel):
  - Add imports: `import { useState } from "@wordpress/element";` (SectionPanel currently
    holds no state) and `import { __experimentalConfirmDialog as ConfirmDialog } from
    "@wordpress/components";` (add to the existing `@wordpress/components` import block).
  - Add `const [confirmOpen, setConfirmOpen] = useState(false);` in the component body.
  - Change the "Remove section" `Button` `onClick` from `() => onRemoveSection?.(
    sectionIndex)` to `() => setConfirmOpen(true)`.
  - Render a controlled `ConfirmDialog` in the panel body:
    ```jsx
    <ConfirmDialog
      isOpen={confirmOpen}
      onConfirm={() => { setConfirmOpen(false); onRemoveSection?.(sectionIndex); }}
      onCancel={() => setConfirmOpen(false)}
    >
      {__("Remove this section and all its measures and notes?", "piano-block")}
    </ConfirmDialog>
    ```
    `setIsOpen(false)` (here `setConfirmOpen(false)`) is called in BOTH callbacks
    (controlled-mode requirement).
  - **Unit (`SectionPanel.test.js` "remove section" describe, `:254-275`):**
    - Rewrite "calls the lifted onRemoveSection handler …" (`:255-263`): click "Remove
      section", then click the dialog's confirm ("OK" per the T9 mock), THEN assert
      `removeSection.count === 1` and `removeSection.args === [0]`. (The button now only
      opens the dialog; the confirm fires the remove.)
    - Update "passes a later section's index …" (`:265-274`) the same way: click "Remove
      section", click confirm, assert `removeSection.args === [1]`.
    - Add a **cancel** case: click "Remove section", click the dialog's cancel, assert
      `removeSection.count === 0` (cancel does NOT remove).
  - **Unit (`Edit.test.js:461`):** the "onRemoveSection removes the selected section …"
    case clicks `buttonByText(container, "Remove section")` — that is the **SectionPanel**
    button (Edit renders the real panel), routing through entry A's dialog. Insert a
    confirm-click ("OK") between the "Remove section" click and the assertions on the
    persisted song. The measure/note remove cases in `Edit.test.js` (`:478` "Remove
    measure", `:511,:547` "Remove note") stay **untouched** (those paths stay immediate).
  - **e2e (`specs/editor.spec.js`):** the SectionPanel "Remove section" path is reached via
    the panel button (if an e2e exercises it). If a section-panel-remove e2e flow exists,
    insert a real dialog-confirm click; otherwise add the smallest flow that selects a
    section, clicks the panel "Remove section", confirms the real `ConfirmDialog`, and polls
    that `sections.length` dropped. (Consistent-by-construction; not run here.)
- **Depends on** — T9 (mock `ConfirmDialog`); T7 (SectionPanel structure settled).
- **Traces to** — S7.
- **Acceptance**
  - SectionPanel's "Remove section" opens a controlled `ConfirmDialog` (`setConfirmOpen(
    false)` in both `onConfirm` and `onCancel`); confirm fires `onRemoveSection`, cancel
    does not.
  - The two existing SectionPanel remove tests drive the confirm before asserting; a new
    cancel-does-not-remove case is added; `Edit.test.js:461` drives the confirm before
    asserting the section splice. Measure/note remove tests are untouched and green.
  - The e2e suite drives the **real** SectionPanel section-remove confirm (accept path) end
    to end (spec written; consistent-by-construction).
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T11 — S7 (entry B): confirm the structure-tree section-row "Remove" via a lifted `ConfirmDialog`

- **Goal** — Gate the structure-tree **section call site** behind a single controlled
  `ConfirmDialog` lifted to the `StructureTree` level (surviving the `DropdownMenu`
  unmount), leaving `RowActionsMenu` generic and the measure/note call sites immediate.
- **Files** — `src/editor/StructureTree.js`,
  `src/editor/__tests__/StructureTree.test.js`, `specs/editor.spec.js`.
- **Changes** (design S7 entry point B — OPTION A: lift to StructureTree, ONE dialog at the
  tree root):
  - Add imports: `import { useState } from "@wordpress/element";` (StructureTree currently
    has zero internal state) and add `__experimentalConfirmDialog as ConfirmDialog` to the
    existing `@wordpress/components` import block.
  - Add `const [pendingRemoveSection, setPendingRemoveSection] = useState(null);` (holds the
    `sectionIndex` to remove, or `null`) in the component body.
  - Change the **section row's** remove call site (`:332`) from `onRemove={() =>
    onRemoveSection?.(sectionIndex)}` to `onRemove={() => setPendingRemoveSection(
    sectionIndex)}` — capturing the in-scope `sectionIndex` into state. The `MenuItem`
    still calls `onClose()` and the popover unmounts, but the pending state survives because
    it lives in `StructureTree`, not the menu. **`RowActionsMenu` stays generic — untouched**
    (it is shared by section/measure/note rows; confirming inside it would wrongly gate all
    three).
  - Leave the **measure** call site (`:406`) and the **note** call site (`:561`)
    immediate (unchanged).
  - Render ONE `ConfirmDialog` at the tree root, alongside/after `<TreeGrid>` inside the
    wrapping `<div>` (`:579-588`):
    ```jsx
    <ConfirmDialog
      isOpen={pendingRemoveSection !== null}
      onConfirm={() => {
        onRemoveSection?.(pendingRemoveSection);
        setPendingRemoveSection(null);
      }}
      onCancel={() => setPendingRemoveSection(null)}
    >
      {__("Remove this section and all its measures and notes?", "piano-block")}
    </ConfirmDialog>
    ```
    (Only-one-open by construction: this tree dialog and the T10 panel dialog are reached by
    mutually-exclusive flows and each has its own local state — never both open at once.)
  - Update the `StructureTree` module/JSDoc note if it claims the component holds no state
    (it now holds `pendingRemoveSection`).
  - **Unit (`StructureTree.test.js`):**
    - The section-row remove case (`:432-451` "removes and duplicates a section from its
      DropdownMenu", which clicks `selectButtonByText(sectionTwoMenu, "Remove")` and asserts
      `calls.removeSection === [1]`): after S7, the menu's "Remove" only opens the dialog,
      so the test must click the dialog's confirm ("OK") before asserting `calls.removeSection
      === [1]`. Adjust this case (and any other case that drives a **section** "Remove") to
      insert the confirm step. The `Duplicate` assertion in the same case is unaffected.
    - Add a **cancel-does-not-remove** case for the section row: open the section menu, click
      "Remove", click the dialog's cancel, assert `calls.removeSection === []`.
    - The **measure** remove case (`:476` → `calls.removeMeasure === [[0,1]]`) and the
      **note** remove case (`:527` → `calls.removeNote === [[0,0,"rightHand",0]]`) stay
      **untouched** (immediate), proving section-only scoping.
  - **e2e (`specs/editor.spec.js`):** the section-row remove site is the `openRowAction(
    editor, "Actions for Section 3", "Remove")` → poll `sections.length` flow (`~:658-664`).
    Insert a real dialog-confirm click between `openRowAction(…, "Remove")` and the
    `sections.length` poll. The measure-row remove (`~:642-656`, "Actions for Measure 3 …",
    "Remove") stays unconfirmed. (Consistent-by-construction; not run here.)
- **Depends on** — T9 (mock `ConfirmDialog`); T8 (StructureTree behavior settled — both edit
  StructureTree.js, so T8 then T11 are sequential).
- **Traces to** — S7.
- **Acceptance**
  - The structure-tree **section** remove opens ONE controlled `ConfirmDialog` lifted to the
    `StructureTree` root (`pendingRemoveSection` state); confirm fires `onRemoveSection`,
    cancel clears the pending state. The measure and note call sites stay immediate.
    `RowActionsMenu` is unchanged (still generic).
  - The section-row remove unit case drives the confirm before asserting `removeSection ===
    [1]`; a cancel-does-not-remove case is added; the measure/note remove cases are untouched
    and green.
  - The e2e suite drives the **real** `ConfirmDialog` section-remove (accept path) at the
    tree row site (spec written; consistent-by-construction).
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## T12 — S6: file the deferred-canvas-highlight tracking issue

- **Goal** — File the GitHub tracking issue for the deferred section/measure canvas
  highlight, with the exact title and body from the spec/design, so the work is recorded.
- **Files** — none in the repo (this is a `gh issue create` action against the GitHub repo;
  no source edit). The existing "later follow-up" comments in `SongCanvas.js` and
  `editor.scss` `.is-selected` are accurate and need **no edit**.
- **Changes**
  - File the issue against the repo `SantosGuillamot/piano-block` (the worktree's `origin`
    remote) using `gh issue create` with the **verbatim** title and body below (copied
    exactly from spec S6 / design S6 — do not paraphrase). Confirm `gh auth status` first;
    if unauthenticated or `gh issue create` is not permitted in this environment, STOP and
    report a blocker to `team-lead` rather than inventing an alternative — do NOT write the
    issue text into a source file as a substitute.
  - **Title (verbatim):**
    ```
    Editor: highlight the selected section/measure on the sheet-music canvas
    ```
  - **Body (verbatim — the full block from spec S6 / design S6, "When a section or measure
    row is selected …" through "… verified against the real emitted SVG (not just jest
    stubs).").** Use the exact text in the spec's S6 Requirements / design §S6 body block.
- **Depends on** — none in the repo (can run any time after T1). Placed late so it does not
  block code work.
- **Traces to** — S6; S6-tracking-issue.
- **Acceptance**
  - A GitHub issue exists on `SantosGuillamot/piano-block` with the **exact** title and body
    above (capture the created issue URL in the commit message / report). No source file is
    edited; no canvas highlighting is added this review.
  - The existing `SongCanvas.js` and `editor.scss` `.is-selected` "later follow-up" comments
    remain accurate (verify by reading — no edit needed).
  - If `gh issue create` cannot run, a blocker is reported to `team-lead` (not a silent skip
    and not a source-file substitute).
  - `npm run test:unit`, `npm run build`, `npm run check` still pass (no source change).

---

## T13 — Optional polish sweep (in-scope items 1–4, 6 already folded; + Rename MenuItem)

- **Goal** — Apply the small in-scope polish edits: the stale `edit.js` comment, the
  single-child `<Flex>` drops, the `InvalidState` microcopy, and the "Rename" `MenuItem`.
  (Polish item 6 — `editor.scss` duplicate header — is already done in T1. Polish item 5 —
  PR-prose "no new dependencies" — is a **doc-phase note, NOT a code change**.)
- **Files** — `src/edit.js`, `src/editor/inspector/SongPanel.js`,
  `src/editor/InvalidState.js`, `src/editor/StructureTree.js`,
  `src/editor/__tests__/StructureTree.test.js` (for the Rename assertion), and a re-confirm
  that no test asserts the dropped `<Flex>` wrapper shape.
- **Changes** (design "Optional polish", smallest in-scope mechanisms):
  1. **Stale `edit.js` comment (`~:305-308`):** the `onRemoveNote` comment says "Reproduces
     `NotePanel.removeEvent`" — grep confirms no `removeEvent` symbol exists. Drop or correct
     that clause (keep the rest of the comment accurate: it drops the `[hand]` key when the
     list empties, rebuilds measure→section→song, commits, clears a now-stale selection).
     Pure comment edit.
  2. **Single-child `<Flex>` wrappers — drop the wrapper** (design's decision: render the
     `Button` directly, not "standardize on HStack" which keeps a pointless one-child
     wrapper):
     - `SongPanel.js:78-86`: remove the `<Flex>` wrapping the "Add section" `Button`; render
       the `Button` directly. Remove the now-unused `Flex` from the `@wordpress/components`
       import (`:25`).
     - `InvalidState.js:46-54`: remove the `<Flex>` wrapping the "Edit as JSON" `Button`;
       render the `Button` directly. Remove the now-unused `Flex` from the import (`:17`).
     - Re-confirm no test asserts the wrapping `<div>` shape (the mock `Flex` renders a bare
       `<div>`, so any test asserting button presence by label/text still passes). Grep
       `SongPanel.test.js` / `Edit.test.js` for any structural `<div>` assertion around these
       buttons; none expected.
  3. **`InvalidState` microcopy (`:34`):** the body text says "Switch to JSON" while the
     button reads "Edit as JSON" — change the body to use "Edit as JSON" (matching the button
     `:52` and the toolbar toggle). One string edit. Re-confirm no test pins the old "Switch
     to JSON" phrasing.
  4. **"Rename" `MenuItem` in `RowActionsMenu`** (match List View; smallest mechanism =
     select the row and let its panel's name field be edited):
     - Add an optional `onRename` prop to `RowActionsMenu`; render a "Rename" `MenuItem`
       **only when `onRename` is provided** (so section/measure rows get it, note rows — which
       have no name field — do not). The Rename item calls `onRename?.(); onClose();`.
     - Wire `onRename` at the **section** and **measure** call sites: the smallest in-scope
       mechanism is to select the row (so its panel shows). The simplest implementation is
       `onRename={() => onSelect?.({ kind: "section", sectionIndex })}` at the section site
       and the measure equivalent — reusing the existing `onSelect` so the panel (with its
       "Section name"/"Measure name" `TextControl`) appears. Focusing the name field is a
       real-DOM nicety best left to e2e; selecting the row is the unit-observable, smallest
       mechanism that satisfies "match List View" without a new inline editor. Do NOT pass
       `onRename` at the note call site (notes have no name field).
     - Update the `RowActionsMenu` JSDoc to document the optional `onRename`.
     - **Unit (`StructureTree.test.js`):** assert a "Rename" `MenuItem` appears on a section
       row's menu and on a measure row's menu, and is **absent** on a note row's menu; assert
       that activating "Rename" on a section row selects it (`calls.select` gets the section
       selection). The focus-the-field behavior is e2e-only (note it in the spec if a cheap
       flow exists; not required at unit level).
- **Depends on** — T11 (StructureTree edited last there; this is the final StructureTree
  touch). Placed last so it rebases cleanly over all prior edits.
- **Traces to** — Optional polish items 1, 2, 3, 4. (Item 6 done in T1; item 5 is a
  doc-phase note — see acceptance.)
- **Acceptance**
  - The stale `NotePanel.removeEvent` clause in `edit.js` is dropped/corrected (grep confirms
    no `removeEvent` reference remains in a comment that claims it exists).
  - The single-child `<Flex>` wrappers in `SongPanel` and `InvalidState` are gone (Buttons
    render directly); the now-unused `Flex` imports are removed; existing button-presence
    tests pass unchanged.
  - `InvalidState` body uses "Edit as JSON" (no "Switch to JSON" remains).
  - A "Rename" `MenuItem` appears on section/measure rows and is absent on note rows;
    activating it on a section row selects the row (unit-asserted). `RowActionsMenu` stays
    generic (the item is gated by the optional `onRename`).
  - **Polish item 5 (PR prose) is explicitly NOT a code change** — it is a doc-phase note
    that `@wordpress/icons` is a real, intended runtime dependency; this task makes no source
    edit for it (called out so it is not silently dropped).
  - `npm run test:unit`, `npm run build`, `npm run check` pass.

---

## Coverage check (every spec/design item maps to a task)

- **M1** → T1 (+ build-output proof). **Optional polish 6** → T1 (folded).
- **S1** → T4 (+ real-component e2e proof; correction #1 test churn folded).
- **S2** → T7. **S10** → T7 (folded; correction #2 unit-unobservable).
- **S3** → T6.
- **S4** → T5 (+ className unit + e2e visual proof). **S8** → no task (kept-separate
  decision; satisfied by T4/T5 leaving the three bodies separate; recorded in Conventions).
- **S5** → T8 (+ unit rewrite + e2e label-click reveal; correction #3 two docblocks folded).
- **S6** → T12 (tracking issue, verbatim). **S6-tracking-issue** → T12.
- **S7** → T9 (mock) + T10 (entry A, SectionPanel) + T11 (entry B, StructureTree); real
  `ConfirmDialog` e2e accept/cancel proof in T10/T11.
- **S9** → T2 (validate.js) + T3 (edit.js single parse).
- **Optional polish 1–4** → T13. **Polish 5** → doc-phase note (no code task; flagged in T13).

## Sequencing summary

T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10 → T11 → T12 → T13.

Shared-file collision avoidance: HandConfigEditor (T4 labels, then T5 alignment);
SectionPanel (T7 structure, then T10 dialog); StructureTree (T8 onClick, then T11 dialog,
then T13 Rename); validate.js→edit.js dependency (T2 before T3); the mock
(T9) before its S7 consumers (T10, T11). Each task keeps the repo green
(`npm run test:unit` + `npm run build` + `npm run check`) at commit, with the e2e specs
kept consistent-by-construction where behavior changed.
