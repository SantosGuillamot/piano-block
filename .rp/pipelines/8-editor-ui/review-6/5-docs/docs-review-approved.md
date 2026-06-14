# Docs Review — Review 6 (D1 batch): APPROVED

**Reviewer:** doc-reviewer-r6
**Batch:** D1, commit `653d938` — README `src/edit.js` file-layout row corrected to name the single expansion `Set`.
**Verdict:** **APPROVED**

---

## What the batch claims to do

D1 updates the one contributor-facing claim review 6 falsifies: the `src/edit.js`
file-layout row (`README.md:142`) said `edit.js` owns the "`showTree` toggle and
**expanded-path state**" for the tree. Review 6 removed the index-path string
addressing (`s0/m1/rightHand/e2`) and the dual-`Set` expansion regime
(`expandedPaths` + `collapsedOverride`), replacing them with a single coordinate-keyed
expansion `Set`. So "expanded-path state" named a mechanism that no longer exists.
The edit rewords it to "`showTree` toggle and **a single expansion `Set`**".

## Verification against the SHIPPED code (eeda17a), not the plan's predictions

The doc plan (D1, "Depends on") required the README to follow whatever the shipped
`src/edit.js` actually names, and set T5's grep acceptance as the gate. I ran it
against the delivered code:

- `grep -nE 'expandedPaths|collapsedOverride|onToggleCollapsedOverride' src/edit.js`
  → **none found.** The old dual-`Set` regime is gone, exactly as the plan predicted.
- `src/edit.js:109` — `const [expanded, setExpanded] = useState(() => new Set());`
  and `:113` — `const onToggleExpanded = (key) => { … }`. **Exactly one** expansion
  `Set` + **one** toggle. `showTree` survives at `:108`.

So the README's new wording ("a single expansion `Set`") matches the shipped code's
reality precisely — singular `Set`, no "path", no "dual", no plural-`Set` framing.

## Acceptance checklist (D1)

- [x] The `src/edit.js` row no longer contains "expanded-path state" (or any
  "path"/"index-path"/dual-`Set` framing). It describes the single expansion `Set`.
  Repo-wide grep for `expanded-path|index-path|s0/m1|collapsedOverride|expandedPaths|dual-Set`
  in `README.md` returns **nothing**.
- [x] The wording matches the SHIPPED `src/edit.js` (one `expanded` Set, no
  `expandedPaths`/`collapsedOverride`) — verified above.
- [x] The rest of the `src/edit.js` row is **byte-unchanged**. `git diff eeda17a 653d938 -- README.md`
  shows the *only* delta inside the row is the phrase swap; `showTree`, the
  `TextareaControl`/`Notice` JSON-mode clause, the structural-mutators clause, the
  "tree and the sidebar share one mutation path" clause, the kind-tagged-selection
  clause, and "the canvas no longer produces selection" all remain verbatim.
- [x] **No other README line changed** — the diff touches exactly line 142;
  the `src/editor/` row (`:143`), the workflow prose (`:29`/`:33`), `src/style.scss`
  (`:145`), the status summary (line 5), `## Forthcoming`, and the front-end / JSON /
  format / validator / hit-rect sections are all untouched.
- [x] `docs/song-format.md` is **not** modified (D1 commit stat: `README.md | 2 +-`, 1 file).
- [x] Reads in the README's existing dense file-layout register; no broken Markdown
  links or anchors introduced (single-row phrase swap, no link syntax involved).

## Independent sanity-sweep (the task's explicit ask): no stale UI description left anywhere

Beyond D1's own acceptance, I checked every UI surface the doc plan scoped out as
"NO doc edit" against the **shipped** code, to confirm no stale description survives
and the doc plan missed nothing material:

- **Per-row always-on action buttons → per-row `DropdownMenu`.** Shipped:
  `StructureTree.js` imports `DropdownMenu` + `moreVertical` and renders one
  `DropdownMenu` per section/measure/note row (`:193`, `:277`, `:419`); the hand
  row keeps a direct `addNoteLabel` `Button` (`:367`). The README never
  characterizes the controls as "always-on icon buttons" (grep for
  `always-on|icon button|icon-button` in README → none), and `:33`'s
  "add/remove/duplicate … on each section row / per-hand Add note on each
  hand-group row" stays literally true — the actions still live on those rows.
  **Doc plan call correct; no edit.**
- **Text-glyph carets → stock chevron.** Shipped: `StructureTree.js` uses
  `chevronDownSmall`/`chevronLeftSmall`/`chevronRightSmall` (`:54-56`, `:94-97`);
  no `▸`/`▾`/`caret`. The README never names the disclosure widget (grep for
  `caret|glyph|▸|▾` in README → none). `:29`'s "expandable and collapsible" stays
  true. **No edit.**
- **Depth CSS variable → `aria-level`.** Shipped: `style.scss` has no
  `--pb-tree-depth`; indentation is keyed on `[aria-level="#{$i}"]` (`:67`). The
  README's `src/style.scss` row says only "Placeholder styling (editor + front
  end)" — still accurate. **No edit.**
- **Hairline outline highlight → recolor-only.** Shipped: `style.scss` has no
  `outline`/`SP_PX`/`0.125`/`0.25`/divide-by-8 rule (the only match is a comment
  *explaining the removal* at `:110`). README's `:29`/`:12`/`:19` describe
  "highlight"/"selection highlighting" without size/weight/style — still true; the
  selected event still recolors (`SongCanvas.decorateSelection` adds `is-selected`,
  `SongCanvas.js:118`). **No edit.**
- **Index-path keys → coordinate-derived keys; dual expansion `Set`s → single.**
  This is the *one* falsified claim — handled by D1. Repo-wide README grep confirms
  no residue elsewhere.
- **`SongPanel`'s forked draft logic → composes `ContextEditor`.** Shipped:
  `SongPanel.js:27` imports and `:71` renders `ContextEditor`; no in-panel
  `projectTempo`/`tempoDraft` fork. README describes panels by the fields they
  expose, not internal helper factoring. **No edit.**
- **Inspector helper de-dup.** Shipped: `clampInt` (`songModel.js:133`) and
  `toBoundedInt` (`songModel.js:166`) each defined exactly once. README makes no
  helper-count claim. **No edit.**
- **`SongCanvas` display+highlight only; `SP_PX` import stays.** Shipped:
  `SongCanvas.js:18`/`:161-162` confirm "display + highlight only … No `interactive`
  flag", and `SP_PX` is imported for width math (`:31`), unrelated to the highlight —
  consistent with the README's `src/editor/` row and the dormant-hit-rect section
  (`:158-160`). `StructureList` is gone (no file on disk). `__experimentalTreeGrid`
  (`StructureTree.js:48`) and the `__workspace` wrapper (`edit.js:458`) survive,
  matching `:143`. **No edit.**
- **`docs/song-format.md` UI mentions** (`:9` structure tree + sidebar; `:122`
  Section/Measure inspector panel, positional fallback) — all survive review 6.
  **No edit.**

**Doc-plan gaps found:** none. The doc plan's "what was checked and found to need
NO doc edit" list matches the shipped code's reality at every point; the single live
falsification (the expansion-state phrase) is the one D1 fixes, and no other stale
UI description survives review 6 anywhere in `README.md` or `docs/song-format.md`.

---

**VERDICT: APPROVED** — D1 (`653d938`) corrects the only README claim review 6
falsifies, matches the SHIPPED `src/edit.js` (one `expanded` Set, no
`expandedPaths`/`collapsedOverride`), leaves the rest of the row and every other doc
line byte-unchanged, and the repository documentation carries no remaining stale UI
description.
