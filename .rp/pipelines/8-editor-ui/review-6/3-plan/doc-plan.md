# Doc Plan: Review 6 — Simplify the editor UI with Gutenberg-native components and styles

Review 6 is a **refactor**: it re-bases the structure tree on stock Gutenberg
parts (a per-row `DropdownMenu` instead of always-on icon buttons, a stock
chevron instead of a text glyph, level-driven indentation, a single expansion
`Set`, coordinate-derived keys), de-duplicates inspector mechanism, and reduces
custom CSS — **while preserving every authoring capability and leaving the
published output byte-identical** (spec R-E1, R-E3; design §1). It adds **no**
authoring capability and changes **no** song format, schema, `render.php`, or
front-end SVG.

Because the review is mechanism-only, **almost all of it is reader-invisible**.
The honest scope is **one minimal contributor-facing doc edit** (D1 below): the
README's `src/edit.js` file-layout row names the tree's expansion state as
**"expanded-path state,"** and review 6 removes exactly that — the index-path
strings (`s0/m1/rightHand/e2`) and the dual-`Set` regime — replacing them with a
single coordinate-keyed expansion `Set` (spec R-B1, R-B2; design §4.1–§4.2;
code-plan T4/T5). That one phrase is the sole live README claim review 6
falsifies. Everything else is checked and ruled out below.

`docs/song-format.md` needs **no** change: it documents the song *format* and
schema (untouched this review) and points at the README for every UI affordance;
its UI mentions — the structure tree shows a section/measure `name`, and you edit
that `name` from the Section / Measure inspector panel (`docs/song-format.md:122`)
— stay true (the tree, the names, and the Name fields all survive review 6).

Single doc task, single working tree.

---

## What was checked and found to need NO doc edit

The discipline here matches reviews 4 and 5: a doc edit is warranted only when a
review **falsifies a claim the README literally makes**, not when it changes a
widget mechanism below the altitude the README documents.

- **Row actions: always-on icon buttons → per-row `DropdownMenu` (R-A2; design
  §3.3; code-plan T4).** This is the review's one user-visible change, but it does
  **not** falsify any README sentence. The README describes *which row hosts which
  action* and *what the action does* — it never characterizes the controls as
  "always-on icon buttons" or otherwise pins the widget shape:
  - `README.md:33` — "The tree gives you **add, remove, and duplicate** controls
    for measures and notes ... and **remove and duplicate** for sections ... **Add
    measure** is on each section row." After review 6 **every one** of these
    actions is still reachable from those exact rows (now via the row's actions
    menu), so each clause stays literally true — the controls still live on those
    rows. **No edit.**
  - `README.md:29` / `README.md:33` — hand-group rows "host that hand's **Add
    note** button" and "per-hand **Add note** on each hand-group row." The
    hand-row **Add note stays a direct `Button`** (design §3.3; code-plan T4
    change #5 keeps the full `addNoteLabel` verbatim), so this remains literally
    true. **No edit.**
  - `README.md:37` / `README.md:39` — the Note panel "offers **Add note** ... and
    **Remove note**" and the Section panel's "**Remove section** also appears
    here." Review 6 does not touch the inspector panels' action controls
    (code-plan T1/T2 are pure mechanism de-dup; design §3.2 keeps the kind-gated
    stacked panels). **No edit.**
  This is the same call review 4 recorded for button theming ("the README does not
  describe ... button styling") and review 5 for the chips-vs-icons restyle (no
  invisible/hover claim in the README). Menu-vs-button is widget chrome; the
  README stays accurate. **No edit.**
- **Disclosure: text-glyph carets (`▸`/`▾`) → stock non-focusable chevron;
  select-only label (R-A3, R-B1; design §3.4; code-plan T4).** `README.md:29`
  says sections and measures are "**expandable and collapsible**" — still true;
  the README never names the disclosure widget (caret vs chevron) and never claims
  the row **label** is what toggles expansion. (The label becoming select-only is
  an interaction-mechanism change the README does not describe.) **No edit.**
- **Selected-event highlight: scale-coupled hairline outline → recolor-only
  (R-C2; design §5.2; code-plan T6).** `README.md:29` says selecting a note
  "**highlights** the matching note on the canvas" and `README.md:12`/`:19` call
  the canvas "the live render with **selection highlighting**." None
  characterizes the highlight's *size, weight, or style* (thin line vs box vs
  recolor), and the note still highlights, so nothing becomes false. Identical to
  the review-4 and review-5 no-change calls on highlight appearance. The emitted
  SVG is byte-identical (R-E1/AC-C2), so the front-end sections (`### 4`) are
  untouched. **No edit.**
- **CSS reduction: drop `--pb-tree-depth`, the fixed 16em rail, the scale-coupled
  outline → layout-glue only (R-C1, R-C3; design §5.1, §5.3; code-plan T6).**
  Pure internal styling. The README does not describe row indentation, the rail's
  width, or any editor CSS detail. The `src/style.scss` file-layout row
  (`README.md:145`) calls it "Placeholder styling (editor + front end)" — still
  accurate. **No edit.**
- **Inspector de-duplication: shared `clampInt`/`toBoundedInt`/splice/omit
  helpers; `SongPanel` composes `ContextEditor` (R-B3; design §4.3; code-plan
  T1/T2).** Visual-change-independent (the panel tests pass unchanged) — no
  control, layout, or field-reachability change (R-E5 preserved). The README
  describes the panels by *what fields they expose*, not by their internal helper
  factoring, so nothing it states changes. **No edit.**
- **`src/editor/` file-layout row (`README.md:143`).** Reads:
  `StructureTree` "built on `@wordpress/components`' `__experimentalTreeGrid`,"
  "the **selection surface** and **hosts add/remove/duplicate for measures and
  notes and remove/duplicate for sections (adding a section moved to the Song
  panel) plus the per-hand 'Add note'**," "rendered in a **`__workspace`** flex
  layout," `SongCanvas` "**display + highlight only**," and "The right-sidebar
  **`StructureList` was removed**." Review 6 **keeps** `__experimentalTreeGrid`
  (R-A1), **keeps** the inline `__workspace` wrapper (design §3.1/§2.2),
  **keeps** the same action-locus story (the actions just move into a row menu —
  still hosted on those rows), and does not touch `SongCanvas` logic (design
  §4.4). Every clause in this row stays true. **No edit.** (Contrast with
  `README.md:142`'s "expanded-path state," which review 6 *does* falsify — that is
  D1.)
- **Toolbar "Structure" toggle / inline placement (R-D1; design §3.1; code-plan
  T4/T7).** Placement stays **inline** beside the canvas and the **Structure**
  toggle stays. `README.md:29`'s "open by default ... a toolbar button
  (Structure) closes and reopens it" and the inline-beside-canvas framing stay
  true. **No edit.**
- **Raw-JSON mode, front-end render, requirements, build model, scripts, the song
  format/validator, the dormant `interactive` hit-rect (`README.md:58-86`,
  `:88-201`).** Untouched by review 6 (R-E7 raw-JSON unchanged; R-E1 publish
  byte-identical). The `### The now-dormant interactive hit-rect` note
  (`:158-160`) and the Tests paragraph (`:201`) describe `svg.js`, `view.js`, and
  the e2e suite's *capabilities*, none of which review 6 changes (code-plan T7
  keeps `render.spec.js` byte-untouched and migrates only `editor.spec.js`'s tree
  interactions, which the README does not enumerate at that grain). **No edit.**
- **`docs/song-format.md`.** No format/schema/`render.php` change this review; its
  UI mentions (`:9`, `:60`, `:122`) all stay true. **No edit.**

---

## D1 — Correct the README `src/edit.js` row so it names a single expansion `Set`, not "expanded-path state"

**Goal.** Update the one contributor-facing claim review 6 falsifies: the
`src/edit.js` file-layout row says `edit.js` "owns the **`showTree` toggle and
expanded-path state** for the tree." Review 6 **removes** the index-path string
addressing (`s0/m1/rightHand/e2`) and the dual-`Set` expansion regime
(`expandedPaths` + `collapsedOverride`) and replaces them with a **single
expansion `Set`** keyed by coordinate-derived keys (spec R-B1/R-B2; design
§4.1–§4.2; code-plan T4 rebuilds the tree's single-`Set` model and T5 collapses
`edit.js` to one `expanded` Set + one toggle). So "expanded-path state" now names
a mechanism that no longer exists. Reword it to describe the **single expansion
`Set`** `edit.js` owns, without claiming "paths." The `showTree` toggle and the
"structural mutators the tree drives" framing stay true and unchanged.

**Audience.** Contributors reading the file-layout table to understand what
`edit.js` owns.

**Files.** `README.md` only. (No `docs/song-format.md` change; no inline
code-symbol docs; no pipeline references.)

**Sections-scope.** Exactly the `src/edit.js` row of the `### File layout` table
(currently `README.md:142`), and only the **"`showTree` toggle and expanded-path
state"** phrase within it. Leave the rest of the row verbatim — the mode-container
description, the `TextareaControl`/`Notice` JSON-mode clause, the "structural
mutators the tree drives — add/remove/**duplicate** section, measure, and note,
plus rename via the panels" clause, the "tree and the sidebar share one mutation
path" clause, the "kind-tagged selection" clause, and "the canvas no longer
produces selection" are all still true after review 6 and must not change.

**Changes.**

1. **`README.md:142`, the phrase "`showTree` toggle and expanded-path state."**
   Replace "expanded-path state" with wording that names the **single expansion
   `Set`** `edit.js` owns for the tree (e.g. "the `showTree` toggle and a single
   expansion `Set` for the tree," or equivalent). Do **not** reintroduce the words
   "path"/"index-path"/"dual" or any plural-`Set` framing — the point of the edit
   is that those are gone. Keep "`showTree` toggle" verbatim (it survives, design
   §3.1/§4.4). Keep the phrase minimal and in the row's dense register; do not
   expand it into a sentence about coordinate keys or auto-reveal — the file-layout
   table documents *what `edit.js` owns*, not the key-derivation detail (that lives
   in the code, not the README).

**Depends on.** Nothing (sole doc task). Authored against the SHIPPED `src/edit.js`
— confirm against the delivered code (after code-plan T5) that `edit.js` holds
**one** expansion `Set` (T5's acceptance: `grep` shows no `expandedPaths`,
`collapsedOverride`, `onToggleCollapsedOverride`; exactly one `expanded` Set + one
`onToggleExpanded`). Write the wording to match whatever the shipped code actually
names that state, not the plan's predicted identifier.

**Traces to.** Spec R-B1 (single expansion model, dual-`Set` regime eliminated),
R-B2 (index-path strings removed); design §4.1 (DD5 single `Set`), §4.2 (DD6 drop
the index-path strings), §4.4 (DD9 `edit.js` UI-state 4 pieces → 2: `showTree` +
one `Set`); code-plan T4 (tree single-`Set` model) and T5 (`edit.js` state
collapse).

**Acceptance.**
- The `src/edit.js` file-layout row no longer contains the phrase
  "expanded-path state" (or any "path"/"index-path"/dual-`Set` framing of the
  tree's expansion state); it instead describes the **single expansion `Set`**
  `edit.js` owns.
- The wording matches the SHIPPED `src/edit.js`: `edit.js` holds exactly one
  expansion `Set` (no `expandedPaths`/`collapsedOverride`). If the delivered code
  diverges from the plan's predicted shape, the README follows the code.
- The rest of the `src/edit.js` row is **byte-unchanged** — `showTree` toggle, the
  JSON-mode `TextareaControl`/`Notice` clause, the structural-mutators clause, the
  "tree and the sidebar share one mutation path" clause, the kind-tagged-selection
  clause, and "the canvas no longer produces selection" all remain.
- **No other README line is changed** — not the `src/editor/` row (`:143`, still
  true: `__experimentalTreeGrid`, `__workspace`, the action-locus story, and
  `SongCanvas` survive), not the `### 2` workflow prose (`:29`/`:33`, no false
  claim from the menu/chevron/highlight changes), not `src/style.scss` (`:145`),
  not the front-end / JSON / format / validator / hit-rect sections. The line-5
  status summary and `## Forthcoming` make no expansion-mechanism claim — leave
  them.
- `docs/song-format.md` is **not** modified.
- The edit reads in the README's existing voice and density; no broken Markdown
  links or anchors.
