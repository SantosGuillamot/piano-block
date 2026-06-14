# Review 7 Doc Plan — Review APPROVED

_Adversarial review of `.rp/pipelines/8-editor-ui/review-7/3-plan/doc-plan.md` (commit `c42c763`) by **doc-plan-reviewer-r7**, for review 7 of the Piano block editor-UI pipeline (issue #8, PR #22). Reviewed against the approved spec (`1-spec/spec.md`), design doc (`2-design-doc/design-doc.md`), and code plan (`3-plan/code-plan.md`), and against an independent sweep of the repository docs (`README.md`, `docs/song-format.md`, `AGENTS.md`) on `worktree-8-editor-ui`._

## Verdict

**APPROVED.** The three-task plan (D1 → D3) is complete, drift-resistant, and aligned. It catches every stale doc claim that the T1-T5 code makes wrong, correctly leaves every unaffected claim alone, frames every task to assert against the **delivered** tree (not predictions), and is proportionate (no invented prose for visual-only polish or harness internals the docs never carried). No blocking issues found.

## What I checked

### 1. Completeness — the independent doc sweep (the historical failure mode: under-scoping)

I read `README.md` in full and grepped every menu / affordance / add / duplicate / reorder mention, then diffed each against what T1-T5 delivers (block-menu item set; "Add measure" re-homed from the section row menu to a `SectionPanel` button; six positional-insert handlers; hand-row `plus` glyph; chevron/divider CSS polish; hardened mock + real-icon canary + React-dedup mapper; migrated e2e).

**Every stale README claim is tasked — no gap:**

| README location | Stale claim (falsified by T1-T5) | Tasked by |
|---|---|---|
| `:19` intro overview sentence | "run add/remove/duplicate for measures and notes and remove/duplicate for sections … (adding a section lives in the Song panel)" — omits positional inserts; no "Add measure" relocation | **D2** |
| `:33` "Add, remove, and duplicate from the tree" | "Add measure is on each section row"; per-kind add/remove/duplicate enumeration; no positional inserts | **D1** |
| `:39` Section-panel bullet | only "Remove section" — must gain the "Add measure" button | **D1** |
| `:142` `src/edit.js` file-layout row | "add/remove/**duplicate** section, measure, and note" — no positional handlers; no "Add measure" re-home | **D3** |
| `:143` `src/editor/` file-layout row | "hosts add/remove/duplicate for measures and notes and remove/duplicate for sections … plus the per-hand 'Add note'" | **D3** |
| `:201` Tests paragraph | "tree-driven add/remove/**duplicate**/rename … adding a section is exercised through the Song panel" — no positional-insert / Section-panel "Add measure" e2e | **D3** |

**Every untasked location is genuinely unaffected — I verified each makes no claim review 7 falsifies:**

- `:5` Status blurb and `:12` "What the block does today": describe only "navigate and select … adjust the selected node's settings." No tree-menu item-set claim. Correctly untouched.
- `:29` "Browse and select": "the Right hand / Left hand rows … host that hand's **Add note** button" stays true (R-MENU3 keeps it; the icon swap is not prose-visible). D1 correctly says spot-check-and-keep.
- `:37` Note-panel bullet: "It also offers **Add note** … and **Remove note**" — the Note **panel** is untouched by review 7 (R-MENU3). D1 correctly says keep.
- `:41` Song-panel bullet: "Add section control" — unchanged; "Add section" stays in the Song panel. Correctly untouched.
- `:33` tail: "**Reordering is not available** — the tree has no move controls" — still true (no move controls added). D1 correctly says keep.
- `:43` "Name a section or measure" and `:31` "Tree labels": no menu/affordance claim. Untouched.
- `:205` Forthcoming: "navigate and select … adjust the selected node's settings" — no item-set claim. Untouched.
- `docs/song-format.md` `:9` (intro README pointer) and `:122` (`name`-field note: "You edit it from the **Section / Measure** inspector panel"): both stay accurate — review 7 adds an "Add measure" button to the Section panel but changes neither the Name field nor where it is edited. Plan correctly tasks no `song-format.md` edit.
- `AGENTS.md`: 5 lines, no menu/affordance specifics. Unaffected, as the plan states.

The plan's own survey statement (its "Survey result" bullet) matches my independent finding exactly: the README is the only stale doc, and the staleness clusters in the three regions D1/D2/D3 cover. No under-scoping.

### 2. The testing-story candidate (team-lead-flagged) is handled correctly

I grepped the README for `jest.config`, `test/mocks`, `moduleNameMapper`, `DropdownMenu`, `mock`, `dedup`, `real-icon` — the README mentions **none** of them (the only "sentinel" hit is the unrelated "no song sentinel" in the storage model). So D3's acceptance call — that the React-dedup mapper and the hardened `DropdownMenu` mock are harness internals to be **excluded** from the README because "the Tests paragraph does not enumerate harness specifics at that grain today" — is correct and proportionate. Adding them would over-scope and introduce a new grain of detail the docs never carried. The e2e prose the README **does** describe (the `specs/` Tests paragraph) is correctly updated by D3.

### 3. Drift-resistance

- The header and every task assert against "the **delivered tree** on `worktree-8-editor-ui`," not the code plan's predictions — the correct stance for post-code doc-writers.
- Each task names the exact shipped files to read before writing (`StructureTree.js`, `inspector/SectionPanel.js`, `edit.js`, `specs/editor.spec.js`, plus the test files) and tells the writer to confirm the item set, labels ("Add before" / "Add after"), and the panel button against source. I confirmed all referenced files exist on-branch, so the verification instructions are actionable.
- All "currently around `:X`" line anchors are accurate against the current README (`:19`, `:29`, `:33`, `:37`, `:39`, `:142`, `:143`, `:201`).
- The plan forbids inventing prose for the chevron-alignment and tree/canvas-divider polish (D1 acceptance bullet 5; the R-POLISH1/2 "(none)" coverage rows) — correct, since the README never described either, so a reader would find nothing now wrong.
- D2 is explicitly cross-checked against D1 for consistency (overview sentence vs. body paragraph must not contradict), closing the one place two tasks touch overlapping subject matter.

### 4. Alignment with spec / design / code plan

- Traces are accurate: D1 → R-MENU1/2/3, R-KEEP6 (design §3.1–§3.3, §8); D2 → R-MENU1/2, R-KEEP6 (§3.1, §3.3); D3 → R-MENU1/2, R-KEEP6, R-REG3c (§3.1–§3.3, §5.3).
- The owner-visible consequence (design §3.3 / §8 — "Add measure" leaving the section row menu for the Section panel) is faithfully carried into the user-facing prose (D1) and the contributor rows (D3).
- The requirements-coverage map's "(none)" rows are each correctly justified: R-KEEP1 (no format/front-end change — `song-format.md` confirmed unaffected), R-POLISH1/2 (visual-only, never documented), and R-REG1/2/3a/3b/R-KEEP2 (harness/implementation internals with no existing doc footprint).

## Issues

None blocking. No task-level rejections.

## One-line verdict

APPROVED
