# Doc Plan: Frontend toggle to show note names

## Overview

This feature adds, on the published frontend only, a viewer-facing toggle control
that shows or hides per-note pitch names on the rendered sheet music. It is the
first interactive (viewer-operable) control the block has ever had on the
frontend. The names, when shown, are bare pitch letters/syllables in the song's
own notation system (e.g. "C" in English, "do" in Spanish) with no accidental
marker and no octave. The default is OFF; the choice does not persist across
loads; each block instance toggles independently; the control's on/off state is
exposed to assistive technology; the label is a translatable string. The editor
is unchanged (no toggle, no names on its canvas). With names OFF (the default),
the emitted output stays byte-identical to today's, preserving the existing
editor-canvas / frontend SVG string-equality.

The documentation work has two jobs:

1. **Add coverage** of the new viewer feature where end users and contributors
   will look for it (the README's frontend section; the block's discovery
   metadata; the contributor architecture notes; the "Forthcoming" framing).
2. **Repair drift** in every existing passage that today asserts or implies the
   frontend is render-only / has no interactive controls, that the editor and
   frontend SVG are byte-identical without qualification, or that the frontend
   does not consume the song's `language` field. Each of these becomes inaccurate
   or under-qualified once the feature ships, and must be corrected to match the
   shipped behavior the doc-writers will read in code.

Two precision points every task must respect (they are easy to get wrong and the
prior phases pin them):

- **Names-OFF output stays byte-identical to today.** The editor↔frontend SVG
  string-equality is preserved for the default (names off). It is NOT removed —
  it gains a precise scope ("when names are off / by default"). Do not describe
  the byte-identity guarantee as broken; describe its scope.
- **Names are bare steps** — no accidental in the name text, no octave digit. The
  accidental remains visible as the existing glyph next to the notehead; it is
  simply absent from the name text. The notation system follows the song
  (`language`, else inferred); the viewer cannot change it.

The host project has a small, well-organized documentation surface: a large
top-level `README.md`, one reference doc `docs/song-format.md`, the block
manifest `src/block.json`, a minimal `AGENTS.md` (workflow guard only — out of
scope), and narrative file-header comments in the source. The sweep found no
CHANGELOG, no `readme.txt`, and no examples directory. `AGENTS.md`, the plugin
PHP header, and `package.json` description are out of scope for this feature (see
"Surfaces deliberately not changed").

## Tasks

### Task 1: Document the frontend note-names toggle for end users in the README

**Goal**
Give a reader of the README a complete, accurate picture of the new viewer-facing
control: that it exists on the published page, what it does, its default state,
and its boundaries (no persistence, per-instance, system follows the song, names
are bare). This is the primary place a non-contributor learns the feature exists.

**Audience**
End users / site authors and viewers (people who place the block or read a
published page).

**Files to change**
- `README.md`

**Sections / scope**
- The "What the front end shows" section (currently the section titled for the
  frontend display, around lines 74-86): add coverage of the toggle as part of
  what a published page now shows. The reader should learn: a control appears on
  a note-bearing block; activating it reveals a pitch name on each named note;
  activating again hides them; it starts hidden; the names are bare letters/
  syllables in the song's own system (cross-reference the format doc's note-name
  systems), carrying no accidental and no octave; the choice does not persist and
  each block on a page toggles on its own.
- The top "Status" summary (around line 5) and "What the block does today"
  (around line 13): update the one-line characterization of the frontend so it no
  longer reads as purely render-only — it now also offers this viewer control.
  Keep these edits proportionate (a clause, not a re-description).

**Depends on**
None (can start once shipped behavior is observable). Logically pairs with Task 4
(drift repair in the same file) — coordinate so the two do not contradict.

**Traces to**
Spec FR1, FR2, FR3, FR4, FR6; Spec "Out of Scope" (no persistence, no shared
toggling, no viewer choice of system, no accidental/octave in names); AC1, AC2,
AC3, AC4. Code-plan Tasks 5, 6 (the SSR control + the toggle/redraw behavior).

**Acceptance**
- A README reader who has never seen the feature can, from the frontend section
  alone, state: that the published page shows a control on a note-bearing block,
  what activating it does, that it defaults to hidden, that names are bare
  (no accidental, no octave) and in the song's own system, and that the choice is
  per-block and does not survive a reload.
- The README no longer characterizes the frontend as showing only static
  notation with no viewer controls.
- No exact button label, attribute name, function name, or pixel/position detail
  is asserted (those live in code and may drift); the description is behavioral.

---

### Task 2: Document accessibility, translation, and gating of the toggle in the README

**Goal**
Cover the qualities of the control that matter for accessibility and
internationalization, and the conditions under which the control appears at all,
so the README's frontend story is complete and matches the gating the feature
ships.

**Audience**
End users / site authors, with an eye to accessibility-conscious and non-English
site operators.

**Files to change**
- `README.md`

**Sections / scope**
- Within the frontend section (same area as Task 1): note that the control
  communicates its current on/off state to assistive technology, and that its
  label is a translatable string under the existing `piano-block` text domain
  (consistent with how the block already supplies translated strings to the
  frontend, e.g. the accessible name).
- Gating: state when the control does and does not appear — it appears only when
  the block actually draws nameable notes; a song that renders nothing (empty/
  whitespace, or invalid/non-conformant) shows no control, and a conformant song
  with nothing to name (e.g. only rests) renders without the control.

**Depends on**
None. Shares the README frontend section with Tasks 1 and 4 — keep consistent.

**Traces to**
Spec FR5 (coverage incl. rests get no name), FR7 (state to AT), FR8 (translatable
label), FR11 (gating); AC5, AC8, AC9, AC12. Code-plan Task 5 (translatable label
into context, aria state, the `hidden`/gating binding), Task 6 (`hasNameableNotes`
gating).

**Acceptance**
- A reader learns that the control's state is exposed to assistive technology and
  that its label is translatable under the `piano-block` text domain.
- A reader can predict, for the three non-rendering / no-nameable-notes cases,
  that no control appears.
- The description does not name specific ARIA attributes, directive names, or the
  exact label string (drift-prone implementation detail); it states the
  observable guarantees.

---

### Task 3: Document the toggle's architecture and the names pipeline for contributors

**Goal**
Explain to a contributor how the feature is built and which invariants must be
preserved when extending it: that the frontend now carries its first
Interactivity-API-driven viewer control with per-instance state, where the
toggle markup is server-rendered vs. where the redraw is wired, where the shared
note-name vocabulary now lives, and — critically — that names-OFF output stays
byte-identical so the editor↔frontend equivalence holds.

**Audience**
Contributors / maintainers (people extending the renderer, the view module, or
the note-name system).

**Files to change**
- `README.md`

**Sections / scope**
- The "For contributors" file-layout table (around lines 165-189): update the
  entries that the feature changes so they describe the shipped roles —
  `src/render.php` (no longer a *childless* wrapper: it now also server-renders
  the toggle control and an inner score container, and seeds the additional
  per-instance context), `src/view.js` (now also owns the viewer toggle: a
  per-instance toggle state, a single redraw path that responds to both the
  toggle and resize, and the client-side gating that reveals the control only
  when there are nameable notes), `src/notation/` (the layout model can now carry
  a per-note name and the SVG layer can emit it; the byte-identity note gains its
  "names off / default" scope), and `src/song/` (a new shared note-name-system
  module is the single source of the per-system spellings and resolution,
  consumed by both the editor and the renderer). Add a row for the new
  `src/song/` note-name-system module if the table lists sibling `src/song/`
  modules individually (it does).
- The "Render contract" contributor passage (around lines 225-229): update it so
  it no longer says the wrapper is *childless* and seeds only `song` +
  accessible name — it now also carries the SSR toggle, an inner score container,
  and the additional seeded context (default-off state, the translatable label,
  the gating flag, a width/redraw signal), while keeping the existing invariant
  that PHP still does no validation/gating (render-or-nothing stays client-side).
- The "Tests" contributor passage (around line 231): qualify the byte-identical
  claim so it reads as "byte-identical when names are off (the default)",
  preserving — not removing — the editor↔frontend equivalence, and noting the
  feature adds coverage pinning the names-off equivalence and the names-on
  behavior.
- Cross-cutting framing: somewhere appropriate in the contributor section, record
  that this is the first viewer-operable control on the frontend and that
  per-instance local context (never global state) is the pattern future frontend
  controls should follow.

**Depends on**
None for starting, but its accuracy depends on the shipped code; the doc-writer
must read `render.php`, `view.js`, `src/notation/`, and the new `src/song/`
module rather than this plan.

**Traces to**
Spec FR12 (Interactivity API, per-instance state), FR13 (editor unchanged,
names-off byte-identical); AC4, AC6, AC10, AC11. Design "Approach" (three
layers), Key Decisions 1-7; Code-plan Tasks 1, 3, 4, 5, 6.

**Acceptance**
- A contributor can, from the contributor section, locate which file owns the SSR
  toggle markup, which file owns the toggle state and redraw, where per-note
  names are resolved and emitted, and where the shared note-name vocabulary lives.
- The contributor section states the names-OFF byte-identity invariant (editor↔
  frontend SVG equivalence preserved for the default) and frames it as the rule
  to preserve when extending names — it does NOT describe the equivalence as
  removed.
- The render-contract passage no longer calls the wrapper "childless" and
  reflects the SSR toggle, inner score container, and added seeded context, while
  still stating PHP does no validation/gating.
- The file-layout table entries for the changed files match their shipped roles;
  no entry still implies the frontend is render-only or that the wrapper has no
  children.
- No exact function signatures, parameter lists, context-key names, or directive
  attribute names are pinned (drift-prone); roles and invariants are described.

---

### Task 4: Repair stale frontend-is-render-only and unqualified byte-identity claims in the README

**Goal**
Find and correct every README statement that, after this feature ships, wrongly
implies the frontend has no interactive controls / only renders the score, or
asserts editor↔frontend byte-identity without the "names off" qualifier, or lists
the frontend as not consuming the song's `language`. This is the drift-repair
pass that keeps the README internally consistent with Tasks 1-3.

**Audience**
All README readers (end users and contributors) — the goal is a document with no
self-contradiction once the feature is live.

**Files to change**
- `README.md`

**Sections / scope**
Audit and correct at least these known passages (the doc-writer should re-sweep
for any others, since line numbers will shift):
- Status / overview (line 5) and "interactive block" paragraph (line 13): the
  "draws its song … directly in the page" framing now coexists with a viewer
  control.
- "What the front end shows" (lines 76, 84): "the score itself shows only the
  music" and "the front end … decides whether to render" should accommodate the
  new control.
- The editor-vs-frontend equivalence sentence (line 49: the canvas "draws the
  song with the same notation the published page uses"): now true only for the
  names-off default — the frontend can additionally show names the editor never
  does. Qualify it without overstating divergence (geometry is unchanged; the
  frontend simply overlays optional names).
- The "Forthcoming"/additive-growth mention that the frontend "reads neither"
  `language` nor `name` (line 223): the `language` half is now stale — the
  frontend DOES read `language` (to pick the note-name system when names are on).
  The `name` half stays true. Split or re-qualify accordingly.

**Depends on**
Should land together with Tasks 1-3 (same file). Sequence so the additive
coverage (1-3) and this repair pass agree on wording for the byte-identity scope
and the `language` consumption.

**Traces to**
Spec FR4 (frontend uses the song's system; names match the editor's), FR13
(byte-identical names-off); AC3, AC10. Design Key Decisions 2, 3 (one flag,
default off; `system = language ?? infer`). Code-plan Tasks 3, 6.

**Acceptance**
- No README passage, after the change, states or implies the frontend is
  render-only / has no viewer controls.
- Every byte-identity / "same notation as the published page" claim is scoped to
  the names-off default (the equivalence is preserved, not deleted).
- The README no longer says the frontend does not consume `language`; it reflects
  that `language` selects the note-name system on the frontend when names are
  shown, while `name` is still frontend-unused.
- The repaired statements are consistent with the coverage added in Tasks 1-3
  (no contradiction between sections).

---

### Task 5: Update the `language` field and related passages in the song-format reference

**Goal**
Correct the song-format reference so it no longer tells readers the frontend
ignores `language`, and so the canonical note-name-systems context reflects that
those names can now also appear on the published page (not only in the editor).
Keep `name` documented as frontend-unused (unchanged by this feature).

**Audience**
Song authors / format readers (people writing or reading the song JSON).

**Files to change**
- `docs/song-format.md`

**Sections / scope**
- The `language` field section (lines 48-62), specifically the "Front end does
  not consume it yet … Consuming it on the front end is future work" bullet
  (line 61): correct it — the frontend now consumes `language` to choose the
  note-name system shown when the viewer turns names on; absent `language` falls
  back to inference from the spellings (same resolution the editor uses). Keep
  the "what it means in the editor" and "stored/round-trips/validates" bullets
  accurate.
- The additive-growth passage (line 424: "the front end reads neither"):
  re-qualify so it is correct — the frontend now reads `language` (for the
  note-name display), while `name` remains frontend-unused.
- The `name` field section (lines 106-124): verify it still correctly says the
  frontend ignores `name` (it does — leave it accurate; do not over-edit).
- Optionally, the note-name-systems section (around lines 378-397) and/or the
  intro's frontend sentence (line 9): a brief note that these names are what the
  optional frontend display shows, with a cross-reference to the README's
  frontend section — coverage only, no format change (the format itself is
  unchanged by this feature).

**Depends on**
None for starting; pairs with Task 4 so the README and the format doc agree on
"the frontend now consumes `language`."

**Traces to**
Spec FR4 (system follows the song's `language`, else inferred); AC3. Design Key
Decision 3 (`system = data.language ?? inferNoteNameSystem`). Code-plan Task 6
(`system = data.language ?? infer` in the view module).

**Acceptance**
- The `language` section no longer states the frontend ignores the field or that
  consuming it is future work; it states the frontend uses it to pick the
  note-name system for the optional on-page name display, with inference as the
  fallback when it is absent.
- The additive-growth "reads neither" claim is corrected for `language` while
  `name` remains documented as frontend-unused.
- No claim is added that the song *format* changed (it did not); the only change
  is which field the frontend now reads.
- Any cross-reference points to the README's frontend section rather than
  duplicating the behavioral description.

---

### Task 6: Refresh the block manifest's discovery metadata

**Goal**
Make the block's own user-facing description and keywords reflect that the
published block now offers a viewer note-name display, so the feature is
discoverable from the inserter and the manifest is not silently stale.

**Audience**
End users discovering the block in the inserter; anyone reading the block
manifest as the block's self-description.

**Files to change**
- `src/block.json`

**Sections / scope**
- The block `description` (line 9): extend it so it conveys that the frontend
  renders the song as sheet music with an optional viewer control to show note
  names. Keep it concise and aligned with the existing tone; do not remove the
  existing storage/render summary.
- The `keywords` (line 10): add a term or two that reflect the feature
  (note names / pitch names), so a search for that concept surfaces the block.
- Do NOT change `attributes`, `supports`, `viewScriptModule`, `render`,
  `textdomain`, or `title` — this feature adds no block attribute and changes no
  wiring (the toggle state is runtime context, not a stored attribute).

**Depends on**
None.

**Traces to**
Spec Overview and FR1, FR2 (the frontend now shows an optional note-name
display). Code-plan Task 5 (the SSR control is the user-visible surface).

**Acceptance**
- The block's `description` mentions, in user-facing terms, the optional
  on-page note-name display; it remains concise and consistent with the existing
  description's tone.
- `keywords` includes a note-names / pitch-names term.
- No structural manifest fields (`attributes`, `supports`, `viewScriptModule`,
  `render`, `textdomain`) are altered, reflecting that the feature stores no new
  attribute.

---

### Task 7: Refresh stale frontend-scope narrative comments in the source

**Goal**
Bring the file-header narrative comments that frame the frontend as render-only
(or that enumerate the consumers of the shared note-name vocabulary) into line
with the shipped feature, so a contributor reading a file's header is not misled.
This covers explanatory header blocks only — not trivial inline comments.

**Audience**
Contributors reading source file headers to orient themselves.

**Files to change**
- `src/view.js` (header block: currently frames the module as wiring the
  Interactivity API for boot/lifecycle with "every musical decision" in the pure
  layers — it now also owns a viewer toggle and its redraw)
- `src/render.php` (header block: currently describes a render-or-nothing,
  draw-only frontend — it now also server-renders the toggle control)
- `src/song/normalizeStep.js` (header: currently says "both the validator and the
  renderer" consume the vocabulary — a new shared note-name-system module and the
  frontend view now also participate; the doc-writer should reconcile what the
  shipped sibling module says vs. this one)
- `src/editor/noteNames.js` (header: now that the vocabulary/resolution moves to a
  shared module this file imports, the header should reflect that the shared
  definitions live in the sibling module, with editor-only pieces remaining here)
- The new shared note-name-system module under `src/song/` (ensure it carries an
  accurate header describing it as the single source of the per-system spellings/
  resolution consumed by editor and renderer) — only if Task 1 of the code plan
  did not already give it one; the doc-writer adds/repairs the header to match its
  shipped role.

The doc-writer must read the SHIPPED files and only adjust comments that are
actually inaccurate after the change; comments already correct (e.g. the pure
`layout.js` / `constants.js` headers, which the feature does not falsify) must be
left alone.

**Depends on**
The code tasks (the comments must match shipped code). The doc-writer reads the
files as merged, not this plan.

**Traces to**
Spec FR12, FR13; AC10, AC11. Design Components (the new shared module; the
changed `render.php`, `view.js`, `noteNames.js`). Code-plan Tasks 1, 5, 6.

**Acceptance**
- No file-header narrative comment in the changed files still frames the frontend
  as having no viewer controls / being draw-only when it now ships a toggle.
- The note-name-vocabulary header comments name the actual set of consumers after
  the refactor (validator, renderer, editor, and frontend view, via the shared
  module) rather than an outdated subset.
- Headers that remain accurate (pure layout/constants layers) are unchanged.
- No comment introduces detail that will drift (exact directive names, signatures);
  comments describe roles and invariants.

---

## Surfaces deliberately not changed (with reasons)

- **`AGENTS.md`** — a 6-line workflow guard (keep `.rp/` internals out of shipped
  artifacts). It contains no architecture, frontend, or feature content. Nothing
  to update.
- **`piano-block.php` plugin header description** and **`package.json`
  description** — author-/registry-facing summaries that are already generic and
  storage-focused; they do not enumerate frontend features and are not the
  surface a user or contributor consults for this behavior. Updating them is not
  required by this feature's spec and would be scope creep; leave them unless a
  reviewer rules otherwise.
- **No CHANGELOG / `readme.txt` / examples directory exists** in the project, so
  there is no version/changelog surface to update. (If one is later introduced,
  it is out of scope for this run.)
- **Pure `src/notation/layout.js` and `src/notation/constants.js` header
  comments** — these describe pure geometry/data and remain accurate (the feature
  adds an additive per-head name and a new constant without falsifying the
  headers). Touch only if a specific sentence becomes wrong after the merge.

## Coverage check (every affected surface mapped to a task)

- README — frontend user coverage of the toggle: Tasks 1, 2.
- README — contributor architecture / pipeline / byte-identity scope: Task 3.
- README — drift repair (render-only framing, byte-identity qualifier,
  `language` consumption): Task 4.
- `docs/song-format.md` — `language` consumption, additive-growth claim,
  note-name-systems cross-reference: Task 5.
- `src/block.json` — discovery metadata (description, keywords): Task 6.
- Source narrative header comments (`view.js`, `render.php`,
  `song/normalizeStep.js`, `editor/noteNames.js`, new shared module): Task 7.
- `AGENTS.md`, plugin PHP header, `package.json`, CHANGELOG (absent),
  pure-layer comments: deliberately not changed (see section above).
