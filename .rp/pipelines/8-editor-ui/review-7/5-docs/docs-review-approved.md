# Review 7 — Docs batch review (D1–D3): APPROVED

Adversarial review of the complete review-7 docs batch — three tasks, once — for the Piano block editor-UI pipeline (issue #8, PR #22, team `8-editor-ui`). Each commit was checked against the **shipped** T1–T5 code (approved at `1293651`), the approved `3-plan/doc-plan.md`, and the whole-repository docs for stale descriptions.

## The batch under review

| Task | Commit | Scope |
|---|---|---|
| D1 | `045a583` | Re-home "Add measure" + adopt the block-menu item set in the authoring workflow (README body — the tree-actions paragraph and the Section-panel bullet) |
| D2 | `86b8772` | Refresh the one-line tree-overview sentence (README "Using the Piano block" intro) |
| D3 | `6f50159` | Contributor file-layout rows (`src/edit.js`, `src/editor/`) + e2e Tests paragraph |

## Verdict

**APPROVED.** All three commits accurately describe the shipped reality, the doc-plan acceptance criteria are met for each task, the overview sentence (D2) and the body paragraph (D1) agree, and the whole-repo sanity sweep found no stale description left anywhere. No doc-plan gap found.

---

## What I verified against the shipped code

### D1 — authoring workflow (`045a583`)

- **Row-menu item set.** README:33 now states every section, measure, and note row carries the same per-row **⋮** menu of **Duplicate / Add before / Add after / Remove**. Confirmed in `src/editor/StructureTree.js`: each of the three `DropdownMenu`s (section L204, measure L315, note L481) renders two `MenuGroup`s — group 1 = Duplicate / Add before / Add after, group 2 = the `isDestructive` Remove. Labels are exactly `"Duplicate"`, `"Add before"`, `"Add after"`, `"Remove"` (`__()` calls at L222–L249, L334–L361, L510–L552). No per-kind "Add measure"/"Add note" menu item survives on any row.
- **"Add before"/"Add after" grow the song and auto-select.** README:33 says they "insert a fresh section, measure, or note immediately before or after the chosen row and select the new node." Confirmed in `src/edit.js`: `insertSectionAt`/`insertMeasureAt`/`insertNoteAt` (L420–L498) splice a fresh `newSection()`/`newMeasure()`/`newNote()` at `target` (= index for "before", index+1 for "after") and call `setSelection({… target})`. Accurate.
- **"Add measure" re-homed to the Section panel.** README:33 and the Section-panel bullet (README:39) say the Section panel "also offers an Add measure button … and a convenience Remove section." Confirmed in `src/editor/inspector/SectionPanel.js`: an `<Button>` labeled exactly `"Add measure"` (L146–L148) renders before the `"Remove section"` button (L150–L156), wired to `onAddMeasure(sectionIndex)`. The wiring is real — `edit.js` passes `onAddMeasure` to `<SectionPanel>` (L617), not to the tree.
- **Retained-accurate claims hold.** "Add section" still in the Song panel (`edit.js` L624 passes `onAddSection` to `<SongPanel>`); per-hand "Add note" still seeds an empty hand (StructureTree L425–L431, a single `Button` on each hand row); "Duplicate" is a deep copy after the original (`duplicateAt` in `songModel.js` L315 uses `structuredClone` + `insertAt(index+1)`); "Reordering is not available — no move controls" is still true (no move handler exists anywhere). None regressed.
- No new prose was invented for the chevron-alignment or tree/canvas-separator visual polish (correctly out of scope).

### D2 — overview sentence (`86b8772`)

- README:19 now reads: each row's menu offers **Duplicate / Add before / Add after / Remove**, with the parenthetical correctly locating "Add measure" in the Section panel and "Add section" in the Song panel. The stale `add/remove/duplicate for measures and notes and remove/duplicate for sections (adding a section lives in the sidebar's Song panel)` enumeration is gone. It stays a single high-level sentence with no field-level detail, and it does **not** contradict D1's body paragraph (both name the same four-item set and the same two panel homes).

### D3 — contributor rows + Tests paragraph (`6f50159`)

- **`src/edit.js` row (README:142)** now names the six positional inserts ("Add before / Add after at section, measure, and note, each splicing a fresh node beside the row and auto-selecting it"), the per-hand `onAddNote`, the `onAddSection` the Song panel signals, and the `onAddMeasure` the **Section panel** signals — explicitly noting "the tree menu no longer drives adding a measure." Matches the handler surface in `edit.js` (L429–L498 inserts, L199 `onAddNote`, L235 `onAddSection`, L261 `onAddMeasure`) and the wiring (L617/L624). Accurate.
- **`src/editor/` row (README:143)** now describes the per-row menu as the Gutenberg block-menu set (`DropdownMenu` of Duplicate / Add before / Add after / Remove), keeps the per-hand "Add note," and leaves "Add measure" to the Section panel / "Add section" to the Song panel. Matches `StructureTree.js`. Unchanged-and-accurate framing (TreeGrid foundation, `__workspace` layout, display-only canvas, removed `StructureList`, inspector panels, selection helpers) is left intact.
- **Tests paragraph (README:201)** now mentions the row menu's positional inserts ("Add before"/"Add after", asserted to splice at the right index and auto-select the new node) and measure-growing through the Section panel's "Add measure" button, alongside the retained remove/duplicate/rename and section-add-via-Song-panel clauses. Verified against shipped `specs/editor.spec.js`: the dedicated positional-insert test "a measure row's Add before / Add after insert at the right index and auto-select" (L667), the Section-panel "Add measure" exercise (L599), the Song-panel "Add section" (L627), Duplicate/Remove from the actions menu (L611–L647), rename via the "Section name" field (L794–L797), the canvas-no-select assertion (`not.toHaveClass(/is-selected/)`, L522), and the Note-language conversion (L817+). The "front end three-state coverage, hostile-text inertness, and dormant `interactive` hit-rect" clauses are correctly left as-is. The test-only `jest.config.js` React-dedup mapper and the hardened `DropdownMenu` mock are correctly **not** surfaced (harness internals; the Tests paragraph does not enumerate at that grain).

## Whole-repository sanity sweep (beyond D1–D3's own acceptance)

Swept `README.md`, `docs/song-format.md`, and `AGENTS.md` for any stale description review 7 should have killed:

- **Old per-kind menu item sets** — gone. No surviving "add/remove/duplicate for measures and notes and remove/duplicate for sections" enumeration anywhere.
- **"Add measure" in the tree menu** — gone. Every "Add measure" mention (README:19, :39, :143, :201) correctly locates it in the Section panel.
- **"Add note" attributions** — all correct (hand-row button at README:29/:33/:143, Note-panel button at README:37); none claims a tree-menu "Add note" item.
- **Move/reorder/copy/cut affordances** — none claimed; "Reordering is not available — the tree has no move controls" (README:33) remains true.
- **The string-plus icon / real-icon canary** — the README never described the Add-note icon's glyph (it is not user-prose-visible), so there was nothing to make stale; the code uses `icon={plus}` (the real glyph, StructureTree L427). No contradiction.
- **Test-harness reality** — the README makes no numeric test-count claims (no "22 suites / 678 unit / 20 e2e" assertions to drift); its qualitative Tests paragraph matches the shipped specs. Proportionate.
- **`docs/song-format.md` (R-KEEP1)** — its two editor-mentions (the intro pointer to the README workflow at L9, and the `name`-field note that the tree shows section/measure names and you edit them from the Section/Measure panel at L108/L122) are both still accurate; review 7 changed neither. Correctly untouched.
- **`AGENTS.md`** — no menu/affordance specifics; correctly unaffected.
- **Anchors** — `#using-the-piano-block`, `#2-build-the-song-in-the-visual-editor`, `#4-what-the-front-end-shows` all resolve (headings present at README:17, :25, :74); the `docs/song-format.md` cross-links into this section still target live anchors.

No doc-plan gap surfaced: the plan's survey correctly identified the README as the only doc with claims review 7 makes wrong, and the three regions it scoped (authoring workflow, overview sentence, contributor notes) were exactly the stale spots.

## Commit-hygiene note

All three commit subjects are imperative, sentence case, no trailing period, with the writer's agent name in parentheses — conformant. (D2 and D3 carry a `Co-Authored-By` trailer; not part of the review criteria.)

---

**VERDICT: APPROVED** — D1 `045a583`, D2 `86b8772`, D3 `6f50159` all match the shipped T1–T5 code, satisfy their doc-plan acceptance, agree with one another, and leave no stale description anywhere in the repository docs.
