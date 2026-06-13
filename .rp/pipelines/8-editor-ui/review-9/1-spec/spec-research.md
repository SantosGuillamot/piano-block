# Review 9 — Spec research (running record)

Phase-1 spec research for review-9 on the Piano block (issue #8, PR #22). This
file records each genuinely-open question, the evidence gathered (from the live
tree at branch `worktree-8-editor-ui`, tip `c7a25d1`), and the resolved
requirement. The firm items (no material open question once the code was read)
are recorded directly with their evidence; the open decisions (S1, S4, S6, S7,
S8) are driven through Q&A with the researcher and resolved below.

Scope is the owner-approved full set: **M1 + S1–S10 + the optional polish**,
preserving the review's "Explicitly fine as-is" list. Everything stays
**editor-side**: the song format/schema, `render.php`, and the front-end SVG
rendering are unchanged — a published song renders byte-identically before and
after. (M1 only *removes* a leaked editor style from the front end.)

A standing constraint colours every acceptance criterion: **"tests green" must
stay incompatible with "real component broken."** Where a fix depends on a real
`@wordpress/components` / `@wordpress/icons` contract (S1's `aria-label`, S4's
CSS, S8's extracted component) or a build-output fact (M1), the verification
must exercise that real contract, not only the jest stubs.

---

## Firm items (code read; no material open question)

### M1 — Front-end placeholder-border leak (Must fix)

**Evidence (live tree):**

- `src/style.scss:25-29` defines the leaked rule:
  ```scss
  .wp-block-piano-block-piano {
  	border: 1px dashed #767676;
  	padding: 1em;
  	color: #767676;
  }
  ```
- `src/block.json:18` loads `style-index.css` as `"style"` (front end + editor);
  `src/index.js:4` imports `style.scss`.
- Confirmed in the **emitted** build:
  - `build/style-index.css` (front end) carries
    `.wp-block-piano-block-piano{border:1px dashed #767676;color:#767676;padding:1em}`
    after the `@font-face`.
  - `build/index.css` (editor) does **not** carry the wrapper rule (it has only
    the `&__workspace`/`&__tree`/`&__canvas` editor rules). So it is a pure
    front-end leak.
- `render.php:41` emits `<div {block wrapper attrs}>` whose class is
  `.wp-block-piano-block-piano`; `view.js` `renderInto` → `svg.js`
  `replaceChildren` draws the finished SVG inside it. So every published block
  frames its sheet music in the dashed-gray placeholder box.
- **No test asserts the wrapper rule.** Grep of `specs/` and `src/` finds the
  border only in `src/style.scss` itself and the two header comments below — no
  unit/e2e test pins `border`/`dashed`/`#767676`/`padding:1em` on the wrapper.
  So deleting the rule breaks no existing test directly.

**Comment drift that must be reconciled with the deletion (else the headers
lie):**

- `src/style.scss:1-5` header says style.scss carries "the @font-face
  declaration **and the shared wrapper rules**" loaded on the front end.
- `src/editor.scss:1-6` header repeats: "The front-end stylesheet (style.scss)
  carries only the @font-face declaration **and the shared wrapper rules
  (border, padding, color)**."
- After M1 deletes the wrapper rule, style.scss carries **only** `@font-face` on
  the front end. Both headers must be updated to say exactly that, or they
  become stale/misleading. (The `editor.scss:9-16` duplicate-header optional-
  polish item overlaps this same region — see Optional polish.)
- Minor, tangential: `edit.js:553` comment says "`style.scss` lays them out as a
  flex row," but the `&__workspace` flex layout actually lives in `editor.scss`.
  Out of strict M1 scope; note it for the doc/code phase but not a blocker.

**Resolved requirement (M1):**

1. Delete the `.wp-block-piano-block-piano { … }` rule from `src/style.scss`.
   Keep the `@font-face` (the front-end SVG glyphs need the font).
2. Update the `style.scss` and `editor.scss` header comments so they no longer
   claim "shared wrapper rules" load on the front end — style.scss carries
   **only** `@font-face` on the front end after this change.
3. No editor-only replacement affordance is added unless a later item needs one
   (the review says "if an editor-only affordance is wanted, add a scoped
   version to `src/editor.scss`" — none is required by the other items, so M1 is
   a pure removal).

**Verification (must check the EMITTED CSS, not the source):**

- Run `npm run build`, then assert `build/style-index.css` no longer contains
  the wrapper rule (it retains only `@font-face` referencing the woff2). Assert
  the front-end render is unframed (no border/padding/color on the wrapper).
- `build/index.css` (editor) is unaffected by this change.

---

### S2 — Rename the four generic "Advanced" panels (Should fix)

**Evidence:** four panels are literally titled `__("Advanced", …)`:

- `NotePanel.js:157` (the event optional-members ToolsPanel).
- `MeasurePanel.js:93` (barlines + annotations ToolsPanel).
- `SectionPanel.js:126` (section overrides ToolsPanel).
- `ContextEditor.js:195` (tiered layout's advanced ToolsPanel, used by the Song
  panel).

Three of these can stack in one sidebar (Note + Measure + Section panels are all
shown for an event selection), and all four read identically.

**SectionPanel double wrapper (S2's second half):** `SectionPanel.js:125-142` is
a `ToolsPanel label="Advanced"` whose **single** child is a
`ToolsPanelItem label="Section overrides"` wrapping the `ContextEditor`. That is
a redundant double disclosure for one item.

**Tests that pin "Advanced" (must update if the ContextEditor tiered title
changes):**

- `contextControls.test.js:260,272` query `[aria-label="Advanced"]` on the
  **tiered** ContextEditor (the Song panel's). If `ContextEditor.js:195` is
  renamed (e.g. "Tempo & staves"), these two assertions must update to the new
  title.
- `SongPanel.test.js:284` queries `[aria-label="Advanced"]` (same tiered panel)
  to assert the language select is **not** inside it — must update to the new
  title too.
- No test pins the NotePanel/MeasurePanel/SectionPanel "Advanced" titles by that
  string (they assert structure via the ToolsPanel mock, not the literal title),
  so those three renames are low-risk — but the design/code phase must
  re-confirm against the live tests as they shift.

**Resolved requirement (S2):**

1. Rename all four "Advanced" titles to domain names. Suggested (final wording
   is a design-phase nicety, but the spec fixes the intent — no two visible
   panels read identically):
   - `NotePanel.js:157` → "Note details" (event optional members).
   - `MeasurePanel.js:93` → "Barlines & annotations".
   - `SectionPanel` → "Section overrides" (see #2).
   - `ContextEditor.js:195` (tiered) → "Tempo & staves".
2. Collapse SectionPanel's redundant double wrapper: the `ToolsPanel` should
   carry the domain title ("Section overrides") and host the `ContextEditor`
   directly (or via a single item) — not a `ToolsPanel "Advanced"` whose only
   child is a `ToolsPanelItem "Section overrides"`. The `resetAll` behaviour
   (drop every override) must be preserved through the collapse.
3. Update the three "Advanced"-string assertions above to the new tiered title.

**Verification:** unit tests assert the new titles render (and the old "Advanced"
string no longer appears on these panels); the ToolsPanel reset/deselect
behaviour is unchanged.

---

### S3 — Shorten labels that wrap or truncate (Should fix)

**Evidence:**

- `PitchEditor.js:62` visible label `__("Note name", …)` → shorten to "Note".
- `AnnotationEditor.js:32` `__("Annotation text", …)` → "Text".
- `AnnotationEditor.js:39` `__("Annotation placement", …)` → "Placement" (this
  select currently truncates to "Ab…" — i.e. "Above"/"Below" options never get
  the visible label they need; the long "Annotation placement" label is the
  cause).
- `AnnotationEditor.js:48` `__("Annotation staff", …)` → "Staff".

**Tests that pin these labels (must update):**

- `NotePanel.test.js:184,316` query `[aria-label="Note name"]` → "Note".
- `pitches.test.js:170,184,197` `fieldByName(container, "Note name")` → "Note".
- `annotations.test.js:178,182,192,202,207,217,225,240` use
  `"Annotation text"` / `"Annotation placement"` / `"Annotation staff"` → the
  three shortened names.

**Resolved requirement (S3):** shorten the four visible labels as above and
update every test that queries them by the old name. (Interaction with S1's
aria-label decision: S3's controls are single-instance per panel — there is only
one "Note"/"Text"/"Placement"/"Staff" in a given panel — so no per-hand
disambiguation is needed here; the visible label and accessible name can both be
the short form. Confirm there is no second instance that the shortening would
collide with — the pitch list can have multiple "Note" selects in one note's
chord, so see the note below.)

- **Open sub-point folded into S1's aria decision:** a chord renders several
  `PitchEditor`s, so several "Note" selects coexist in one NotePanel. They are
  already index-keyed rows; the existing tests query the first match. Confirm the
  shortening does not make a *test* ambiguous (the tests act on a single-row
  note), and that AT users still get a per-row distinction if needed — but the
  review explicitly asks only to shorten the visible label, so the spec keeps the
  accessible name equal to the visible short label unless S1's decision
  generalises an aria-label convention.

---

### S5 — Section/measure label click = "select-and-reveal" (Should fix)

**Evidence:**

- `StructureTree.js:136-144` (`RowLabelCell`'s label `Button`) `onClick`
  currently calls only `onSelect?.()`. The cell already receives
  `isExpanded`, `onToggleExpanded`, and `rowKey` (expansionKey) props — so the
  expand-if-collapsed wiring is available without new props.
- Expand/collapse otherwise lives on the chevron (`TreeExpander`, pointer
  onClick → `onToggleExpanded`) and the TreeGrid Arrow keys
  (`onExpandRow`/`onCollapseRow` → shared handler).
- The behaviour is **deliberate** (the review confirms it is not a bug) but
  diverges from core List View and is internally inconsistent: the **hand-group**
  row's label *does* toggle on click (`StructureTree.js:454`,
  `onClick={() => onToggleExpanded?.(handKey)}`).
- Test pin: `StructureTree.test.js:377-386` — "selects (not toggles) when a
  section label is clicked" asserts `calls.select === [{kind:"section",
  sectionIndex:0}]` **and** `calls.toggle === []` with the section starting
  collapsed (`expanded: new Set()`).

**Resolved requirement (S5):** change `RowLabelCell`'s label `Button` onClick to
select-and-reveal:

```js
onClick={() => { onSelect?.(); if (!isExpanded) onToggleExpanded?.(rowKey); }}
```

- Select always fires.
- Expand fires **only when the row is currently collapsed** (clicking an
  already-expanded row's label selects but does **not** collapse it — collapse
  stays on the chevron / ArrowLeft, preserving the "collapse is deliberate"
  affordance and not fighting the user).
- Hand-group rows are unchanged (they remain toggle-only; they never select).

**Test updates (S5):**

- Rewrite `StructureTree.test.js:377-386`: clicking a **collapsed** section
  label now asserts `calls.select === [{kind:"section", sectionIndex:0}]` **and**
  `calls.toggle === ["s0"]` (select + expand).
- Add/keep a case: clicking an **already-expanded** section label selects but
  does **not** toggle (`calls.toggle === []`) — pinning that an expanded row's
  label does not collapse.
- The chevron-toggle cases (`:388-405`) stay green unchanged.

**Verification:** unit (the above) plus the e2e drives a real label click and
confirms the row's descendants become visible after the click (select-and-reveal
end to end) — this is the "clicking the text doesn't toggle" report being fixed.

---

### S9 — Remove the redundant second JSON parse per render (Should fix)

**Evidence:**

- `edit.js:140-143` computes `errors = validateSong(song)` (memoized on `song`);
  `validateSong` (`validate.js:332-343`) `JSON.parse`s the raw string internally
  and **discards** the parsed object, returning only `string[]`.
- `edit.js:153-158` then computes `working`: on the valid path it calls
  `safeParse(song)` (`edit.js:51-57`, a second `JSON.parse`). So the same string
  is parsed twice on every change of a valid song.
- **Other callers of the public API (constrain the change):**
  - `view.js:57` calls `validateSong(raw).length > 0` as its render-or-nothing
    gate (front end). The `validateSong(raw) → string[]` contract MUST be kept.
  - `validate.test.js` and `schema.test.js` call
    `validateSong(JSON.stringify(song)) → []`/error list. These pin the
    `string[]` contract.

**Blast radius (researcher-confirmed — sharpens the intent):** `validateSong` is
the **default export** of `song/validate.js` (`:332`) with **two production
callers** — `edit.js:141` (the redundant one S9 targets) AND `view.js:57`, the
**front-end render gate** (`if (validateSong(raw).length > 0) return`) — plus
~15 test files call it directly (`validate.test.js`, `schema.test.js`,
`Edit.test.js`, the panel tests, `serializeSong.test.js`, …). So the intent's
"keep `validateSong(raw) → string[]`" is **MANDATORY, not optional**: the front
end and the whole test suite depend on the default export's signature and
behaviour.

**Resolved requirement (S9):**

1. Add `parseAndValidate(raw) → { data, errors }` as a **new NAMED export** of
   `song/validate.js` that parses **once**. It must MIRROR `validateSong`'s
   parse-failure behaviour: on a `JSON.parse` throw return
   `{ data: null, errors: ["Invalid JSON: <msg>"] }` (the exact same
   `"Invalid JSON: …"` message `validate.js:337` produces); on a conformant parse
   `{ data: <parsed>, errors: [] }`; on a parsed-but-non-conformant song
   `{ data: <parsed>, errors: [<messages>] }`. (`edit.js` already maps
   `errors.length > 0 → working = null`, so returning the parsed `data` in the
   has-errors case is harmless and lets the caller decide — recommended.)
2. Keep `validateSong` as the **default export, UNCHANGED** in signature and
   behaviour. It MAY be re-expressed as a thin wrapper over `parseAndValidate`
   (returning `.errors`), but its `(raw) → string[]` contract and its
   `"Invalid JSON: …"` parse-failure output must stay byte-identical — `view.js`
   and all ~15 test files keep passing untouched.
3. In `edit.js`, compute `parseAndValidate(song)` **once** (memoized on `song`);
   derive both `errors` and `working` from its single result; **delete
   `safeParse`** (`edit.js:51-57`) and the second parse at `edit.js:157`. This
   collapses the two `JSON.parse` calls (`validate.js:335` + `edit.js:53`) to one
   per change.
4. Add a `parseAndValidate` unit test (parsed `data` for a conformant song;
   `{ data: null, errors: ["Invalid JSON: …"] }` for invalid JSON; the error
   list for a non-conformant song). The existing `validateSong` tests stay green
   unchanged — proving the default-export contract held.

**Out of scope:** the front-end `view.js` gate stays on `validateSong`
(unchanged) — view.js does its own parse for the render and is not part of the
editor double-parse; do NOT refactor it to `parseAndValidate`. Only `edit.js`
switches.

**Verification:** validator unit tests (old `string[]` contract intact, new
`parseAndValidate` shape), plus an `edit.js`/Edit test confirming a valid song
still renders the canvas (parsed once) and an invalid one still routes to
`InvalidState`.

---

### S10 — SectionPanel `resetAll` duplicates `emitOverrides({})` (Should fix)

**Evidence:** `SectionPanel.js:127-133` `resetAll` destructures
`{ tempo, timeSignature, rightHand, leftHand, ...keep } = section; emitSection(keep)`
— which is exactly what `emitOverrides({})` does (`:108-111`:
`const { tempo, timeSignature, rightHand, leftHand, ...keep } = section;
emitSection({ ...keep, ...next })` with `next = {}`). The "Explicitly fine"
note confirms this is the one same-file `resetAll` dup (the other panels'
`resetAll` key sets are per-level and must stay).

**Resolved requirement (S10):** replace SectionPanel's `resetAll` body with
`resetAll={() => emitOverrides({})}`. Behaviour is byte-identical; only the
duplication is removed. (This interacts with S2's double-wrapper collapse — the
`resetAll` lives on the `ToolsPanel`; keep it as `() => emitOverrides({})` after
the title rename.)

**Verification:** the existing SectionPanel reset test stays green (reset drops
every override, keeping `measures` and non-override keys).

---

## Optional / nice-to-have (in scope; firm)

All confirmed against the live tree:

- **Stale comment `edit.js:305-308`** references `NotePanel.removeEvent`
  ("Reproduces `NotePanel.removeEvent`…"). Grep confirms no `removeEvent` symbol
  exists anywhere. Drop/correct the stale comment on `onRemoveNote`.
- **Single-child `<Flex>` wrappers:** `SongPanel.js:78` wraps a single
  "Add section" `Button`; `InvalidState.js:46` wraps a single "Edit as JSON"
  `Button`. Drop the wrapper or standardise on `HStack` (pick one and apply
  consistently).
- **Add a "Rename" `MenuItem` to `RowActionsMenu`** (`StructureTree.js:166-219`)
  to match List View — currently the menu has Duplicate / Add before / Add after
  / Remove only, no Rename. (Design phase: a Rename action needs an inline-edit
  or prompt path; confirm the cheapest in-scope mechanism — section/measure names
  are already editable via their panels, so Rename can focus the panel name field
  or open an inline editor. Keep it small.)
- **Microcopy alignment (`InvalidState`):** body text says "Switch to JSON"
  (`:34`) while the button reads "Edit as JSON" (`:52`). Align the verb (use
  "Edit as JSON" in both, matching the toolbar toggle in `edit.js:522`).
- **PR-description fix, not code:** `@wordpress/icons` IS a real runtime
  dependency (`package.json:31-33`: `"dependencies": { "@wordpress/icons":
  "^10.32.0" }`). It is the right call; the "no new dependencies" line belongs in
  the PR description, which should be corrected — the **code** is fine. (This is a
  PR-prose fix; the code/doc phase notes it, no source change.)
- **`editor.scss:9-16` duplicates the file header (`:1-6`).** Trim one. This
  overlaps M1's comment reconciliation: the editor.scss header (`:1-6`) and the
  in-`.wp-block-...` comment (`:9-16`) both describe the front-end/editor split
  and the "shared wrapper rules"; after M1 removes the wrapper rule, fold these
  into one accurate description rather than two stale ones.

---

## Test-harness facts (from `test/mocks/wordpress-components.js`) — load-bearing

The unit suite mocks `@wordpress/components` (the real package is externalized by
the build and absent from `node_modules`). The mock's exact prop handling
decides what each fix can verify at unit level vs what needs e2e (the real
component). Key facts, gathered by reading the mock:

- **`Button`** maps accessible name as `"aria-label": ariaLabel ?? label` — so an
  explicit `aria-label` prop **overrides** the visible `label`/text. → S1's
  OPT-1 (visible "Add alteration", accessible "Right hand add alteration") is
  mechanically possible AND unit-testable for the button.
- **`SelectControl` / `NumberControl` / `TextControl` / `TextareaControl`** set
  `"aria-label": label` and then spread `...rest`. A separately-passed
  `aria-label` lands in `...rest` and (being spread last) overrides — so in the
  **mock** an explicit `aria-label` works. **AND it works on the REAL component
  too** (researcher-confirmed against Gutenberg trunk source
  `select-control/index.tsx` + `number-control/index.tsx`): both spread
  `{...restProps}` onto the native `<select>`/`<input>` after the named `label`,
  so a consumer `aria-label` reaches the real element and (per ARIA precedence)
  overrides the `<label>`-derived accessible name. → **S1's OPT-1 (visible bare
  "Clef" + `aria-label="Right hand clef"`) is honest on the real component**, not
  a mock-only trick — so existing aria-label-based tests pass unchanged with zero
  churn. (See S1 below; an earlier "OPT-1 is a trap" reading was retracted once
  the trunk source confirmed the `restProps` spread.)
- **`HStack`** SWALLOWS `alignment` (`alignment: _alignment`) — it renders a bare
  `<div>` with no alignment in the DOM. → **S4's `alignment="flex-start"` is NOT
  unit-observable.** S4 (the trash-icon alignment + the `__list-row` CSS) is a
  real-component / CSS concern, verifiable only by e2e or by asserting the
  rendered className the CSS targets — not by a jest assertion on layout.
- **`ToolsPanel` / `ToolsPanelItem`** render children UNCONDITIONALLY and expose
  `label` as `aria-label` (ToolsPanel only). → S2's title renames and the
  SectionPanel double-wrapper collapse are unit-testable via
  `[aria-label="<new title>"]`; the reveal/hide is e2e.
- **No `ConfirmDialog` / `__experimentalConfirmDialog` in the mock.** → If S7 uses
  a `ConfirmDialog`, the mock must be EXTENDED (add a stand-in that exposes the
  confirm/cancel affordances) and the delete tests must drive it. That is real
  test plumbing, not a free win — factor into S7's cost.
- **`DropdownMenu`** mock requires render-function children (mirrors core's guard)
  and renders menu content inline. → S7's confirm-on-Remove (if placed in the
  `RowActionsMenu` Remove `MenuItem`) and the optional "Rename" `MenuItem` are
  unit-reachable (the menu items are always in the DOM under test).

These facts are folded into the S1/S4/S7 acceptance criteria below as they
resolve.

## Open decisions — driven through Q&A (all RESOLVED)

Status: **all five open decisions resolved** — S6 (defer + tracking issue), S1
(OPT-1: bare visible label + hand in `aria-label`, real-component-honest, zero
churn), S8 (do NOT extract `EditableList`; keep all three list bodies separate —
the measured LOC shows no net simplification and the rule-of-three is unmet), S4
(flex-start rows in place + top-level `__list-row` CSS), S7 (section-only
confirmation via `__experimentalConfirmDialog`). Each was settled on
evidence the researcher verified against the live tree and, where the real
`@wordpress/components` contract or prior-review history mattered, against
Gutenberg trunk source / the committed review-8 artifacts. The only remaining item
is pasting the S6 tracking-issue text verbatim (the decision itself is final).

---

### S6 — Section/measure canvas highlight: **DEFER (open a tracking issue)** — RESOLVED

**The explicit decision the spec must state (and does):** **do NOT implement
section/measure canvas highlighting in this review. Open a tracking issue and
defer.** It does **not** silently disappear — it is recorded here and the
tracking-issue text is captured verbatim below for the code/doc phase to file.

**Evidence weighed (researcher-confirmed against the live tree):**

- **Feasibility is real but unequal.** The only measure-level DOM hook is
  `<g data-measure="N">` (`svg.js:519`, N = 1-based global measure number). There
  is **no** section-level group and **no `data-section`** anywhere
  (whole-tree grep). So:
  - A **measure** highlight is cheap (~10–15 lines + one CSS rule): reuse
    `globalMeasureNumber(song, si, mi)` (already imported by `SongCanvas`) →
    `[data-measure="N"]` → add an editor-only class post-render, exactly the
    `.is-selected` pattern. Staff lines / clef / key+time signature are
    **system-level siblings** (`renderSystem` → `staffLines`, `svg.js:302-305`),
    NOT inside the measure group, so a measure recolor tints only that measure's
    **notes + barlines** and leaves the staff black — no ugly staff-line paint
    (mild barline tint is the only cosmetic bleed, optionally excludable).
  - A **section** highlight is moderate (~25–35 lines): no single hook, so it
    must compute the section's measures via `measureCoords`, map each to its
    global N, and decorate the **range** of `[data-measure="N"]` groups.
- **Constraints would hold either way.** The class is added only at
  `SongCanvas.js:75` inside `decorateSelection` (guarded `kind !== "event"` →
  early return); `view.js` never sets it. A new measure/section recolor follows
  the same post-render, editor-only pattern, so the front-end SVG stays
  byte-identical and the recolor-only highlight win is preserved.
- **The code already promises deferral.** `SongCanvas.js:13-16` and `:40-43`
  both call section/measure canvas indication "a later follow-up"; `editor.scss`
  `:106-108` documents "A section/measure selection adds no canvas class — those
  kinds are surfaced through the structure tree and the inspector panels" as
  deliberate. The review itself frames S6 as "Acknowledged as a deferred
  follow-up … worth a tracking issue."

**Rationale for deferring (the spec phase's call, made on the merits):**

1. **The owner singled S6 out as the deferrable item** — the one finding where
   the intent says the spec may "open a tracking issue and defer." Every other
   actionable item (M1, S1–S5, S7–S10, polish) is to be done now; S6 is the
   explicit exception.
2. **The "where am I?" gap is already partly closed** without canvas work: the
   selected tree row carries `aria-current` (`StructureTree.js:140`), and the
   inspector shows kind-titled panels (Note / Measure / Section) for the
   selection. S5 (select-and-reveal) further strengthens tree feedback this run.
3. **Value density.** This run already carries a large, user-visible batch
   (the M1 front-end fix + the whole inspector-UI cluster). Adding net-new canvas
   decoration plumbing + new CSS that must not clash with the event `.is-selected`
   recolor + new e2e (the highlight must be verified against the **real** SVG, per
   the standing constraint) spends risk/effort on the one item explicitly marked
   safe to defer. Deferring keeps the run focused and lower-risk.
4. **Cheap to pick up later.** The feasibility notes above (and the existing
   `globalMeasureNumber`/`measureCoords` helpers) mean a future run can implement
   measure-first, then section, with no new SVG-emit work.

**Tracking-issue text:** captured verbatim in the dedicated "S6 tracking issue —
text to file" section below (title + body with the gap, the deferral rationale,
the `data-measure`-only / no-`data-section` feasibility note, the
staff-lines-are-system-level caveat, and a measure-first acceptance hint). The
code/doc phase files it.

**No code change for S6 this review** beyond (optionally) leaving the existing
"later follow-up" comments accurate — they already describe the deferred state
correctly, so they need no edit. Do NOT add canvas highlighting.

---

### S1 — Drop the redundant "Right hand / Left hand" control prefix — RESOLVED

**Evidence (researcher-confirmed against the real component, not just the mock):**

- `HandConfigEditor.fieldLabel` (`:101-109`) composes
  `sprintf("%1$s %2$s", hand, field)` → "Right hand clef", "Right hand octave
  shift", "Right hand alteration note", "Right hand alteration", and the button
  "Right hand add alteration" (`:195`) / "Right hand remove alteration" (`:188`).
  `fieldLabel` already returns the **bare** field name when no `label` is passed
  (`:109`).
- The **tiered** layout (Song panel) already gives each hand its own
  `ToolsPanelItem` titled "Right hand"/"Left hand" (`ContextEditor.js:219-239`),
  so the prefix is doubly redundant there.
- The **flat** layout (Section panel, `ContextEditor.js:245-256`) renders both
  `HandConfigEditor`s **inline with NO per-hand heading**. Dropping the prefix in
  flat would, if the controls carried *only* a bare label, make the two hands'
  "Clef"/"Clef" **visually and a11y indistinguishable**. The chosen mechanism
  (OPT-1, below) keeps a hand-scoped **`aria-label`** on every control, which
  resolves the **a11y** ambiguity directly; a visible per-hand heading then
  remains only a **sighted-UX nicety** in flat layout, not an a11y requirement.

**The aria mechanism — OPT-1 (bare visible label + hand in `aria-label`) is the
choice, and it IS honest on the real components.** This corrects an earlier
worst-case reading. The researcher fetched the **authoritative Gutenberg trunk
source** (`packages/components/src/select-control/index.tsx` and
`number-control/index.tsx`) and confirmed:

- Both `SelectControl` and `NumberControl` render `label` as a **visible
  `<label>`** (associated by id), AND spread `{...restProps}` onto the native
  `<select>`/`<input>` **after** the named `label`. So a consumer-passed
  `aria-label` **lands on the real native element**, and per ARIA precedence
  `aria-label` **overrides** the `<label>`-derived accessible name. No
  `hideLabelFromVision` is needed (that would hide the visible "Clef" — not what
  we want).
- The `Button` real component already accepts `aria-label` (the trash + AddButton
  are Buttons).

So **OPT-1 is mechanically valid on the real components**: pass visible
`label="Clef"` (short, no wrap — meets the S1/S3 visual goal) **plus** explicit
`aria-label="Right hand clef"` (full AT disambiguation, which wins the accessible
name on the real `<select>`/`<input>`). This is **not** a mock-only trick — it
holds on the real component — so it satisfies the standing "tests-green
incompatible with real-broken" constraint. And it matches the review intent
**verbatim**: "Labels become Clef / Octave shift / …; **push hand scope to
aria-label/help** if AT disambiguation wanted."

**This also DISSOLVES the flat-layout ambiguity (part A) without a new region.**
Because the two hands' controls stay AT-distinguishable via their `aria-label`
("Right hand clef" vs "Left hand clef") even though both **visibly** read "Clef",
the per-hand titled region is **no longer required for accessibility** — it
**downgrades to OPTIONAL sighted-UX polish** (a visible per-hand heading is still
nice for sighted users in the flat Section-panel layout, but a11y no longer
depends on it, and it is no longer coupled to test churn).

**The mock honors OPT-1 too (so existing tests pass unchanged):** the
`SelectControl` mock sets `"aria-label": label` then spreads `...rest`
(`wordpress-components.js:86` then `:97`) — a passed `aria-label` in `...rest`
overrides (later key wins); `NumberControl` is the same (`:130` then `:136`);
`Button` is already `ariaLabel ?? label` (`:55`). So `fieldByName(container,
"Right hand clef")` still matches under OPT-1 because the accessible name stays
"Right hand <field>" — now via the explicit `aria-label` instead of via `label`.

**Resolved requirement (S1):**

1. In `HandConfigEditor`, **keep composing the hand-scoped name** ("Right hand
   clef", …) but pass it as the control's **`aria-label`**, and pass the **bare**
   field name as the **visible `label`**:
   - `SelectControl`/`NumberControl`: visible `label="Clef"` / `"Octave shift"` /
     `"Alteration note"` / `"Alteration"`; `aria-label="Right hand clef"` etc.
     (still built via `sprintf` for translator reordering).
   - Trash `Button`: bare or icon-only visible affordance, `aria-label="Right hand
     remove alteration"`.
   - `AddButton`: visible children "Add alteration", `aria-label="Right hand add
     alteration"` (the `AddButton` component must forward an `aria-label` to its
     inner `Button` — small, additive prop).
   The tiered layout's existing per-hand `ToolsPanelItem` heading stays as is.
2. **Per-hand titled region in flat layout = OPTIONAL sighted-UX polish, not
   required.** If the design phase wants a visible "Right hand"/"Left hand"
   heading in the flat (Section-panel) layout for sighted clarity, it may add one
   from these REAL options (researcher-vetted):
   - **`fieldset` + `legend` — recommended as cheapest-real.** Raw HTML, a
     semantically labelled group (the `legend` also names the group for AT — a
     bonus), **zero new component, zero new mock export**; only needs a small CSS
     reset for the default `fieldset` border/margin.
   - `BaseControl` with a `label` (core's standard grouping idiom; renders a real
     heading via `BaseControl.VisualLabel`) — needs a jest-mock export.
   - `__experimentalVStack` + `__experimentalHeading` (renders a visible heading) —
     both need mock exports; heaviest.
   But a11y does NOT depend on this region (the `aria-label`s carry the hand
   scope), so it is not a blocker and adds no test churn if omitted.

**Test updates (S1) — ~ZERO churn (the win of OPT-1):**

- **e2e is NOT affected.** Every "Right hand"/"Left hand" string in
  `specs/editor.spec.js` is a **structure-tree row or tree action-menu** label
  (e.g. `:481` "Add note to Right hand of measure 1 of section 1"), NOT a
  HandConfigEditor inspector control. Confirmed.
- **Existing unit tests pass UNCHANGED.** `SongPanel.test.js:219,220,226` and
  `contextControls.test.js` (~`:234,251,275,290,330,337,340,347,358,365,371,373,
  385,390`) query controls by accessible name ("Right hand clef" / "…octave
  shift" / "…alteration" / "…alteration note" / "…add alteration" / "…remove
  alteration") via `fieldByName` (= `aria-label`). Under OPT-1 the accessible name
  **stays** "Right hand <field>" (now via explicit `aria-label`), so these
  assertions still match. Only the **visible** text changes to the bare form,
  which the tests do **not** assert.
- **One small additive change** worth a test: `AddButton` gains an `aria-label`
  passthrough; add/keep a unit assertion that the add button's accessible name is
  "Right hand add alteration" while its visible text is "Add alteration". A new
  assertion (optional) can pin that the **visible** label is the bare form to lock
  the S1 intent in.

**Verification:** unit tests confirm (a) each control's accessible name is the
hand-scoped "Right hand <field>" (existing assertions, unchanged), and (b) — to
guard the real contract per the standing constraint — an e2e / real-component
check confirms the **visible** label reads the bare "Clef"/… while the
**accessible name** remains hand-scoped (i.e. the `aria-label` truly reaches and
overrides on the real `<select>`/`<input>`, not just in the mock). This is the
one place the OPT-1 mechanism must be proven against the real component so a green
mock can't mask a real regression.

---

### S8 — Extract `EditableList` for the repeated list body — RESOLVED (KEEP ALL THREE SEPARATE; do not extract)

**The explicit decision the spec must state (and does):** **Do NOT extract an
`EditableList`. Keep all three list bodies (`PitchList`, `AnnotationList`,
`HandConfigEditor`'s alters) as they are.** Instead, satisfy S4 in place. The
review *explicitly delegated this weighing to the spec* — "decide whether
parameterizing them into one component is a **net simplification** or whether the
**distinct invariants justify keeping them separate**" — and, on the evidence
below, the spec's judgment is **keep separate**. This diverges from the review's
*literal* "extract one `EditableList`" wording, but it is precisely the
spec-delegated call, made on the merits and recorded with its rationale (neither
silently extracting nor silently dropping the question).

**The LOC math — extraction is NOT a line win (the deciding evidence).** Measured
on the live tree:

- `PitchList` body = 29 lines; `AnnotationList` body = 28 lines; ~16–18 lines of
  *repeated scaffolding* each (the `items.map(...)` wrapper, the
  `HStack` row, the trash `Button`, the `AddButton`).
- **Removed by extraction:** 2 × ~16 ≈ **~32 lines** of duplicated scaffolding.
- **Added by extraction:** the `EditableList` component itself (~25–30 lines, incl.
  the `canRemove`/`collapseEmpty` params + docblock) **+** each caller's
  `<EditableList … />` call site (~8–10 lines × 2 ≈ ~18) ≈ **~45 lines**.
- **Net ≈ +13 LOC** — extraction is **LOC-neutral-to-slightly-positive, not a
  reduction.** The only real benefit is a single canonical row/trash/add structure
  (one place to fix S4 alignment / add `size="small"` / tweak a11y), bought with a
  **new ~5-prop parameter surface + a layer of indirection**.

**Why keep separate (rationale):**

1. **Rule of three is unmet.** There are only **two** cleanly-extractable callers
   (PitchList, AnnotationList) — HandConfigEditor's alters body is a poor fit
   (below), so it is not a third clean instance. Abstracting a shared primitive
   over two callers, for no LOC win and with added indirection, is the classic
   premature-abstraction shape.
2. **Review-8's own trigger is still UNMET, on its own terms.** Review-8 rejected
   a generic `EditableList` in three committed places (its `prompt.md:88`,
   `spec.md:300-301`, `design-doc:186`) citing the three distinct invariants
   (PitchList min-one, AnnotationList collapse-empty→`undefined`, HandConfigEditor
   map-derived rows) with an explicit **revisit trigger: "revisit only if a fourth
   list appears."** No fourth list has appeared. Review-9 considered overriding on
   a *different* basis ("last repeated structure standing"), but once the LOC math
   shows no net simplification and the rule-of-three is unmet, **review-8's
   reasoning still holds** and is honored rather than overridden.
3. **HandConfigEditor genuinely doesn't fit.** Its alters body is **not** a
   standalone list: it is a **fragment among siblings** (clef `SelectControl` +
   octave `NumberControl` render above it), each row is **two controls** (note
   select + value number), and its `onChange` rebuilds the **whole** hand config
   via `buildHandConfig(handConfig, rows)` from rows **derived from a map each
   render and written back as a fresh map**. Forcing it into a shared list would
   require a `buildHandConfig` adapter and import a **storage-transform concern**
   into a list primitive — so it stays out regardless.
4. **The one concrete downstream benefit (S4) does NOT require extraction.** S4's
   row-alignment fix is satisfied **in place**: `PitchList` and `AnnotationList`
   already pass `alignment="flex-start"`; only `HandConfigEditor.js:158` lacks it
   and gets it added directly. No `EditableList` is needed to fix the floating
   trash.

**Resolved requirement (S8):**

1. **No `EditableList` is added.** `ListControls.js` keeps exporting just
   `AddButton`. `PitchList`, `AnnotationList`, and `HandConfigEditor` keep their
   own list bodies.
2. The S4 alignment fix lands **in place** (add `alignment="flex-start"` to
   `HandConfigEditor.js:158`; the other two already have it) — see S4. Any
   `__list-row` CSS class is applied to each list's existing row `HStack`
   directly.
3. The "Explicitly fine as-is" intent is effectively **reaffirmed** for this
   item: the distinct invariants (and the absence of a net simplification or a
   fourth list) justify keeping the three bodies separate.

**Rationale recorded explicitly (so the question is not silently dropped):** the
review asked the spec to *weigh* extraction vs. separation; weighed against the
measured LOC (net ~+13, no reduction), the unmet rule-of-three (only two clean
callers), HandConfigEditor's genuine non-fit, and review-8's still-valid
reasoning (its four-list trigger unmet), the spec concludes the **distinct
invariants justify keeping them separate** and that extraction would add an
abstraction for no simplification. This is the explicit, on-the-merits answer the
review delegated — recorded here in full so a reviewer can see *why* the literal
"extract" wording was not followed.

**Verification:** no new component or test is required for S8 itself; the existing
`PitchList` / `AnnotationList` / `HandConfigEditor` tests stay green unchanged
(no refactor touches them). The S4 alignment fix is verified under S4.

---

### S4 — Fix the floating / misaligned trash icons in the list rows — RESOLVED

**Evidence:**

- The list rows are bare `HStack`s, and `editor.scss` has **no inspector/list
  rules at all** (confirmed: it carries only `&__workspace`, `&__tree`,
  `&__canvas`, `&__canvas-svg .is-selected`). So when a control's label wraps to
  two lines, the row grows taller than the fixed ~40px trash `Button`, and the
  icon parks at the row's **top**.
- The **worst case is `HandConfigEditor.js:158`** — its alters-row `HStack` has
  **no `alignment` prop at all**, so its trash floats mid-row. `PitchList.js:41`
  and `AnnotationList.js:55` already pass `alignment="flex-start"`.
- **The alignment intent — resolving the review's apparent flex-start vs flex-end
  contradiction.** The review says to add `alignment="flex-start"` to the HStack
  (top-align the row's content) AND a `__list-row` rule with `align-items:
  flex-end`. These are not in conflict once read by role: the **HStack
  `alignment="flex-start"`** is the row's cross-axis baseline so a multi-line
  label and the trash share a top edge (no mid-row float); the **`align-items`
  pinning + `flex: 0 0 auto` on the icon + `min-width` on the select** is the
  CSS that keeps the trailing trash a fixed-size, non-shrinking item pinned to the
  input edge rather than stretching or collapsing. The **bigger win is S1 + S3**:
  once the labels stop wrapping (bare "Clef"/"Note"/"Text"/…), the rows are
  single-line and read cleanly with very little CSS — the alignment fix is the
  belt-and-suspenders for any residual multi-line case (e.g. a long localized
  label). The spec's intent: **rows top-align their content and the trash is a
  fixed-size item that does not float**; the exact `align-items` value is a
  design-phase detail as long as the trash no longer parks mid-row.

**Resolution direction (researcher-refined): lead with the HStack prop +
label-shortening; treat heavy CSS as a fallback.** The flex-start (the HStack's
**child cross-axis** alignment) and the review's `align-items: flex-end` (a CSS
rule on the **same vertical axis, opposite direction**) genuinely conflict if put
on the same element — the review offered them as *alternative* remedies, read
loosely. The clean path: standardize `alignment="flex-start"` on every row (it
top-aligns the editor and trash cleanly, and **once S1 + S3 shorten the labels
the rows are single-line** so editor and trash are the same height and alignment
barely matters), and add the `__list-row` CSS **only for the safe, uncontentious
bits** (`flex: 0 0 auto` on the trash so it never shrinks/stretches, `min-width`
on the leading select) — **drop the contentious `align-items: flex-end`** unless
a residual misalignment remains.

**Resolved requirement (S4):**

1. **`alignment="flex-start"` on every list row, fixed in place** (S8 keeps the
   three list bodies separate — no `EditableList`). `PitchList.js:41` and
   `AnnotationList.js:55` already pass it; **add `alignment="flex-start"` to
   `HandConfigEditor.js:158`** (the one row that lacks it — the worst floating
   case). Three small, local edits, no shared component.
2. **Add a small editor-only list-row rule** carrying the safe bits only:
   `flex: 0 0 auto` on the trash `Button`, a sensible `min-width` on the leading
   select. **Omit `align-items: flex-end`** unless residual misalignment is
   observed after S1+S3. The row(s) must pass a `className` (e.g. `__list-row`) so
   the CSS has a hook — net-new wiring, since today no list `HStack`/control
   passes a `className` (confirmed grep-clean).
3. **CRITICAL DOM-scoping subtlety (must be honored by design):** the inspector
   panels render inside `InspectorControls` — the **sidebar**, which is
   **OUTSIDE** the block's `.wp-block-piano-block-piano` wrapper. So a
   `&__list-row` rule **nested under** `.wp-block-piano-block-piano` in
   `editor.scss` (the way `&__workspace`/`&__tree`/`&__canvas` are nested) will
   **NOT match** the sidebar DOM. The list-row rule MUST be emitted as a
   **top-level selector** (`.wp-block-piano-block-piano__list-row { … }` at the
   stylesheet root, not nested inside the wrapper block) so it reaches the
   sidebar. This is the one easy-to-get-wrong part of S4.
4. Optionally give the per-row trash `size="small"` (review's optional nicety) —
   it shrinks the icon button ~40px→~24px, reducing the vertical mismatch and
   directly helping the alignment; the real `Button` accepts `size`, the mock
   swallows it (harmless).

**Verification (NOT a jest assertion on layout):** the `HStack` `alignment` prop
is **swallowed by the unit mock** (it renders a bare `<div>`), so S4's alignment
is **not unit-observable**. Verify via (a) the rendered **className** the CSS
targets (a unit test can assert the row carries the `__list-row` class so the CSS
has a hook), and (b) the e2e / real-component path for the actual visual
alignment — exercising the real `HStack`/`Button`/`SelectControl`, not the stub.
This satisfies the standing "tests-green incompatible with real-component-broken"
constraint: the layout fix is proven against the real components, not the mock.

---

### S7 — Destructive deletes: confirmation / surfaced undo — RESOLVED (section-only confirmation)

**Evidence:**

- Four delete sites, no confirmation and no surfaced undo, relying entirely on
  the editor's global undo (Cmd-Z): the structure-tree `RowActionsMenu` "Remove"
  (`StructureTree.js:205-214`), `NotePanel.js:254-263` ("Remove note"),
  `MeasurePanel.js:143-150` ("Remove measure"), `SectionPanel.js:153-160`
  ("Remove section"). Removing a **section silently deletes all its measures and
  notes** — the highest blast radius; a measure delete nukes its notes; a note
  delete is a single event.
- The review's minimum: "**At minimum confirm the section-level remove** or
  surface undo as the recovery path."
- **Tests that click Remove and assert the signal fires immediately** (these
  break if a confirm intercepts the path they cover):
  - `StructureTree.test.js:446` (section Remove → `removeSection`), `:476`
    (measure), `:527` (note).
  - `NotePanel.test.js:367` ("Remove note" → `onRemoveNote`).
  - `MeasurePanel.test.js` / `SectionPanel.test.js` Remove-button tests.
- **The mock has no `ConfirmDialog`** — adding a confirm means **extending
  `test/mocks/wordpress-components.js`** with a stand-in that exposes the
  confirm/cancel affordances, and the affected delete tests must drive the
  confirm's accept.

**Resolved requirement (S7) — confirm the SECTION-level remove only:**

1. **Add a confirmation to the section-level remove only** — the one delete whose
   blast radius is "all measures and notes in the section." Confirm at **both**
   section-remove entry points so the same destructive action is guarded wherever
   it is triggered (guarding only one would leave the other as a confusing
   unconfirmed path):
   - **EASY entry point — the `SectionPanel` "Remove section" button**
     (`SectionPanel.js:156-159`). Self-contained: a local `useState` confirm flag
     + a controlled `ConfirmDialog` rendered in the panel.
   - **HARDER entry point — the structure-tree section-row "Remove."** Gate the
     **section call site** `StructureTree.js:332`
     (`onRemove={() => onRemoveSection?.(sectionIndex)}`), NOT the shared
     `RowActionsMenu` component (which is reused by section/measure/note — its three
     `onRemove` call sites are `:332` section, `:406` measure, `:561` note;
     confirming inside it would wrongly gate all three levels). **Wrinkle the
     design must handle:** the `DropdownMenu` popover **unmounts on close**
     (`StructureTree.js:205-211` does `onRemove(); onClose();`), so a confirm flag
     hosted *inside* the menu would be torn down before the dialog can act. The
     pending-confirm state + the `ConfirmDialog` must be **lifted OUTSIDE the
     DropdownMenu** — to the section row or the `StructureTree` level — so the
     dialog survives the menu closing. This lift is **the bulk of S7's
     implementation work**; the panel button is the trivial part.
   - Measure-level (`StructureTree.js:406`, `MeasurePanel.js:146-149`) and
     note-level (`StructureTree.js:561`, `NotePanel.js:258-262`) removes stay
     **immediate** (lower blast radius; global undo remains the recovery path,
     unchanged) — keeping the measure/note Remove tests green without modification.
2. **Mechanism = `@wordpress/components` `__experimentalConfirmDialog`**
   (`ConfirmDialog`), the WordPress-idiomatic in-editor confirm — core uses it for
   block-removal warnings and pattern-category deletes, and it is explicitly built
   to replace native `confirm()`. Researcher-confirmed caveats the design phase
   must respect:
   - It is **experimental** (subject to breaking change) — acceptable here, it is
     core's own current idiom, but pin the import name.
   - **Use it in CONTROLLED mode.** API (researcher-confirmed from the core
     handbook): `import { __experimentalConfirmDialog as ConfirmDialog } from
     "@wordpress/components"`; props — `children` (REQUIRED, the message body),
     `onConfirm` (REQUIRED), `onCancel` (REQUIRED in controlled mode), `isOpen`
     (controls visibility), `confirmButtonText`/`cancelButtonText` (optional,
     default "OK"/"Cancel"). In controlled mode the **parent owns visibility and
     MUST `setIsOpen(false)` inside BOTH callbacks** to close. Reference wiring for
     the panel button (the easy site):
     ```jsx
     const [confirmOpen, setConfirmOpen] = useState(false);
     <Button isDestructive onClick={() => setConfirmOpen(true)}>Remove section</Button>
     <ConfirmDialog
       isOpen={confirmOpen}
       onConfirm={() => { setConfirmOpen(false); onRemoveSection?.(sectionIndex); }}
       onCancel={() => setConfirmOpen(false)}
     >
       {__("Remove this section and all its measures and notes?", "piano-block")}
     </ConfirmDialog>
     ```
     (Uncontrolled mode — omit `isOpen` — auto-opens on mount, so it would have to
     be conditionally *mounted* on a pending flag; controlled is the cleaner fit.)
     The tree entry point uses the same wiring but with the flag lifted outside the
     menu (see #1's wrinkle).
   - **"Multiple `ConfirmDialog`s are not supported"** (a new instance closes the
     last). Since only the **section** remove is confirmed (one logical action at a
     time), this is satisfied — but the two section entry points (tree + panel)
     should not both mount an open dialog simultaneously. Keep each panel/tree's
     dialog state local and only-one-open by construction.
   - **Do NOT use `window.confirm` as the primary mechanism:** besides being
     non-idiomatic and deprecated in core's direction, **jsdom's `window.confirm`
     returns `false` by default**, so it would *block every delete in the unit
     tests* unless stubbed — a worse test story than the mock stand-in.
     `window.confirm` is only a last-resort fallback if `ConfirmDialog` proves
     unusable. The spec's requirement is "the section remove asks for confirmation
     before deleting," with `ConfirmDialog` as the chosen mechanism.
   (Surfaced-undo via `@wordpress/notices` `createNotice` with an Undo action is
   the review's stated alternative, but it is **heavier** — a net-new `notices`
   dispatch import plus an undo handler that must capture and restore the
   pre-delete song — for the same recovery the existing global Cmd-Z undo already
   provides. The spec chooses **confirmation** as the lighter, more direct guard.)
3. **Test plumbing (part of S7's acceptance):** extend
   `test/mocks/wordpress-components.js` with a `__experimentalConfirmDialog`
   stand-in: render `children` + a confirm `<button>` + a cancel `<button>`, gated
   on `isOpen` (**render nothing when `isOpen` is false**, mirroring controlled
   mode — otherwise tests that don't expect a dialog would see stray buttons).
   Update the **section-remove** sites to drive the confirm's accept before
   asserting the remove fires, and add a **cancel-does-NOT-remove** case. Exact
   churn sites (researcher-enumerated; ~5 — small, the strongest argument for
   section-only):
   - **Unit:** `StructureTree.test.js:446` (section Remove), `SectionPanel.test.js`
     Remove-section tests (~`:257,272`), `Edit.test.js:461` (Remove section →
     asserts splice + selection clear).
   - **e2e:** `editor.spec.js:660` (Remove on a section row → polls
     `sections.length`) must click the real dialog's confirm.
   - **Untouched** (no confirm on these paths): `StructureTree.test.js:476,527`
     (measure/note), `NotePanel.test.js:367,401`, `MeasurePanel.test.js:253,269`,
     `Edit.test.js:478,511,547` (measure/note), `editor.spec.js:565,648`
     (note/measure removes).

**Rationale:** section-only confirmation targets the single highest-blast-radius,
cascading delete (the review's explicit minimum), gives the clearest "are you
sure?" where it matters most, and minimizes test churn (~5 sites vs roughly triple
for all-levels). It does not over-prompt the frequent, low-stakes note/measure
deletes, which keep the existing global Cmd-Z undo as their (documented, not
silently dropped) recovery path.

**Verification:** unit tests — section remove asks for confirmation, accept
removes, cancel does not; measure/note removes still fire immediately. The mock
`ConfirmDialog` stand-in must mirror the real component's accept/cancel contract
so "tests green" can't mask a broken real dialog (per the standing constraint),
and the e2e suite drives the real section-remove confirm end to end.

---

## S6 tracking issue — text to file (verbatim)

The code/doc phase files this as a GitHub tracking issue on the repo, so the
deferred S6 work does not disappear.

**Title:** Editor: highlight the selected section/measure on the sheet-music canvas

**Body:**

> When a section or measure row is selected in the structure tree, the canvas
> shows no visual feedback — only an *event* (note/rest) selection paints
> `.is-selected` (recolor-only, `src/editor/SongCanvas.js` `decorateSelection` +
> `src/editor.scss` `.is-selected`). Selecting "Measure 2" or a section highlights
> nothing on the preview, the main "where am I?" gap. Selection is still conveyed
> by the tree row (`aria-current`) and the inspector panel title, so this is an
> enhancement, not a dead end.
>
> Deferred from review-9 (cost/value): feasible but non-trivial. Feasibility notes
> from the code: each measure is emitted as `<g data-measure='N'>` (1-based GLOBAL
> number, `src/notation/svg.js`), reachable post-render exactly like the event
> highlight via `globalMeasureNumber(song, si, mi)` (`src/editor/selection.js`,
> already imported by SongCanvas). A MEASURE highlight is a small add (~10-15 lines
> + one editor-only CSS rule). A SECTION highlight has no single DOM hook (no
> `data-section`/section group) — it must decorate the RANGE of measure groups in
> the section (iterate `measureCoords`, filter by sectionIndex, query each
> `[data-measure]`). CAVEAT: a `<g data-measure>` contains the notes AND that
> measure's barlines (but NOT staff lines/clef/sigs, which are system-level
> siblings), so a whole-group recolor tints barlines too — acceptable, or exclude
> via `:not([data-barline])`.
>
> CONSTRAINTS (must hold): editor-only (class added post-render by SongCanvas;
> view.js never sets it → front-end SVG stays byte-identical), recolor-only (no
> layout shift), must not clash with the event `.is-selected` recolor.
>
> ACCEPTANCE HINT: selecting a measure (and optionally a section) in the tree
> visibly highlights the corresponding measure group(s) on the canvas; front-end
> render unchanged; verified against the real emitted SVG (not just jest stubs).

---

## Acceptance criteria — consolidated checklist

Each item is "done" only when its verification (above) passes. The standing
constraint applies throughout: where a fix rides a real `@wordpress/components` /
`@wordpress/icons` contract or a build-output fact, the verification exercises the
**real** contract, not only the jest stubs.

**M1 (Must) —**
- [ ] `.wp-block-piano-block-piano { border/padding/color }` rule deleted from
  `src/style.scss`; `@font-face` kept.
- [ ] `style.scss` + `editor.scss` header comments updated — no longer claim
  "shared wrapper rules" load on the front end (style.scss carries only
  `@font-face` there).
- [ ] After `npm run build`, **`build/style-index.css` no longer contains the
  wrapper rule** (only `@font-face` + woff2); `build/index.css` unaffected; the
  published render is unframed. (Build-output verification, not source-only.)

**S1 — (OPT-1: bare visible label + hand in `aria-label`)**
- [ ] HandConfigEditor controls show **bare** visible labels ("Clef", "Octave
  shift", "Alteration note", "Alteration", "Add alteration") while keeping a
  hand-scoped **`aria-label`** ("Right hand clef" etc.) — verified to reach and
  override the accessible name on the **real** `<select>`/`<input>`/`Button`, not
  just the mock.
- [ ] `AddButton` forwards an `aria-label` to its inner `Button`.
- [ ] Existing unit tests pass **unchanged** (they query the hand-scoped
  accessible name, which OPT-1 preserves); zero e2e churn. A real-component/e2e
  check confirms visible="Clef" while accessible name stays "Right hand clef".
- [ ] Per-hand visible heading in flat layout is OPTIONAL sighted-UX polish (not a
  blocker; a11y carried by the `aria-label`s).

**S2 —**
- [ ] The four "Advanced" titles renamed to distinct domain names (Note details /
  Barlines & annotations / Section overrides / Tempo & staves). No two visible
  panels read identically.
- [ ] SectionPanel's redundant `ToolsPanel "Advanced"` → single `ToolsPanelItem
  "Section overrides"` double wrapper collapsed (title on the panel; resetAll
  preserved). The three "Advanced"-string test assertions updated to the new
  tiered title.

**S3 —**
- [ ] Labels shortened: PitchEditor "Note name"→"Note"; AnnotationEditor
  "Annotation text/placement/staff"→"Text"/"Placement"/"Staff". The placement
  select no longer truncates. Every test querying the old names updated.

**S4 —**
- [ ] `alignment="flex-start"` on every list row, in place (already on
  `PitchList.js:41` + `AnnotationList.js:55`; **added to `HandConfigEditor.js:158`**).
  No shared component (S8 keeps them separate).
- [ ] `__list-row` rule added as a **top-level** selector (NOT nested under the
  wrapper block, so it reaches the sidebar DOM): safe bits only (`flex:0 0 auto`
  trash, `min-width` select); `align-items: flex-end` omitted unless residual
  misalignment. Row carries the `className` hook. Verified via className (unit) +
  real-component/e2e (visual).

**S5 —**
- [ ] `RowLabelCell` label onClick = select-always + expand-if-collapsed (`onSelect()`
  then `if (!isExpanded) onToggleExpanded(rowKey)`); collapse stays on chevron /
  ArrowLeft. Hand-group rows unchanged.
- [ ] `StructureTree.test.js:377-386` rewritten (collapsed-label click → select +
  expand); a case pins that an already-expanded label selects but does not
  collapse. Chevron-toggle cases stay green. e2e drives a real label click →
  descendants revealed.

**S6 —**
- [ ] **Deferred.** No canvas highlighting added this review. The tracking-issue
  text (above) is filed by the code/doc phase. Existing "later follow-up" comments
  remain accurate (no edit needed).

**S7 —**
- [ ] **Section-level remove only** asks for confirmation (controlled
  `__experimentalConfirmDialog`, `setIsOpen(false)` in both callbacks) at **both**
  section entry points: the easy `SectionPanel` "Remove section" button, and the
  harder structure-tree section-row "Remove" — gating the section call site
  `StructureTree.js:332` with the pending-confirm flag + dialog **lifted OUTSIDE
  the `DropdownMenu`** (which unmounts on close). `RowActionsMenu` stays generic.
- [ ] Measure/note removes stay immediate (Cmd-Z recovery, documented).
- [ ] Mock gains an `isOpen`-respecting `ConfirmDialog` stand-in; the ~5
  section-remove test sites (`StructureTree.test.js:446`,
  `SectionPanel.test.js:257,272`, `Edit.test.js:461`, `editor.spec.js:660`) drive
  accept; a cancel-does-not-remove case added; measure/note tests untouched.

**S8 — (KEEP SEPARATE; no extraction)**
- [ ] **No `EditableList` added.** All three list bodies (`PitchList`,
  `AnnotationList`, `HandConfigEditor`) stay separate — the measured LOC shows no
  net simplification (~+13), the rule-of-three is unmet (only two clean callers),
  HandConfigEditor genuinely doesn't fit, and review-8's "fourth list" trigger is
  still unmet. The decision (and divergence from the review's literal "extract"
  wording) is recorded with rationale in S8.
- [ ] No refactor → the existing `PitchList`/`AnnotationList`/`HandConfigEditor`
  tests stay green unchanged. (S4's alignment fix is the only touch to these
  files, verified under S4.)

**S9 —**
- [ ] `parseAndValidate(raw) → { data, errors }` added as a new **named** export of
  `song/validate.js`, mirroring the `"Invalid JSON: …"` parse-failure shape.
- [ ] `validateSong` stays the **default** export, signature/behaviour
  byte-identical (`view.js` + ~15 test files untouched).
- [ ] `edit.js` parses **once** via `parseAndValidate`; `safeParse` deleted; the
  two `JSON.parse`s collapse to one. New `parseAndValidate` unit test; existing
  validator tests green.

**S10 —**
- [ ] SectionPanel `resetAll` replaced with `() => emitOverrides({})`; behaviour
  byte-identical; existing reset test green.

**Optional polish —**
- [ ] Stale `NotePanel.removeEvent` comment dropped/corrected (`edit.js:305-308`).
- [ ] Single-child `<Flex>` wrappers (`SongPanel.js:78`, `InvalidState.js:46`)
  dropped or standardised on `HStack`.
- [ ] "Rename" `MenuItem` added to `RowActionsMenu` (smallest in-scope mechanism).
- [ ] `InvalidState` microcopy: body "Switch to JSON" aligned to the "Edit as
  JSON" verb.
- [ ] PR description's "no new dependencies" line corrected (`@wordpress/icons` is
  a real, intended runtime dep) — **PR prose, no source change**.
- [ ] `editor.scss` duplicate header (`:1-6` vs `:9-16`) trimmed to one accurate
  description (folded with M1's comment reconciliation).

---

## Out of scope (do NOT touch)

- The **song format/schema**, **`render.php`**, and the **front-end SVG
  rendering** — a published song renders **byte-identically** before and after.
  M1 only removes a leaked editor style; it must not change how the SVG is drawn.
- The front-end **`view.js`** validator gate — stays on `validateSong`; not
  refactored to `parseAndValidate`.
- No **new outside dependencies** — only `@wordpress/*` packages already available
  to blocks (`@wordpress/icons` is already bundled on this branch).
- The review's **"Explicitly fine as-is" list** — do NOT "fix" any of it:
  - TreeGrid keyboard accessibility (verified complete; the `aria-hidden` /
    pointer-only chevron is correct).
  - `__next40pxDefaultSize` universality; `__nextHasNoMarginBottom` correctly
    never on a `NumberControl`; element-imported icons; `isDestructive`;
    `sprintf` + `__` i18n.
  - Load-bearing duplication: the depth-fixed
    `setSectionAt`/`setMeasureAt`/`setEventAt`; `omitEmpty` vs `omitFalsy`; the
    per-panel `resetAll` key sets (only SectionPanel's same-file dup is S10); the
    hand-group row's bespoke non-selecting label cell.
- **S6 canvas highlighting** — explicitly deferred to a tracking issue (not built
  this review).
- Prior-review wins to preserve: select-only labels (now extended by S5 to
  select-and-reveal), the single expansion Set, coordinate keys, `[aria-level]`
  indent, the recolor-only event highlight, the TreeGrid keyboard model /
  accessibility parity, and raw-JSON mode untouched.
