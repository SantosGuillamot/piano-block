# Review 7 Doc Plan — Re-home "Add measure", adopt the block-menu item set, and refresh the contributor notes

_Doc plan for review 7 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Derived from the approved `1-spec/spec.md`, `2-design-doc/design-doc.md`, and `3-plan/code-plan.md`, surveyed against the repository's existing documentation (`README.md`, `docs/song-format.md`, `AGENTS.md`). The phase-5 doc-writers execute these tasks **after the code ships** — so every task asserts against the **delivered tree on `worktree-8-editor-ui`**, not against this plan's predictions._

## How to use this plan

Three documentation tasks (D1 → D3), each self-contained (Goal / Audience / Files / Sections-scope / Depends on / Traces to / Acceptance). They have **no ordering dependency on each other** — all three edit `README.md` and may be done in any order or folded into one commit, but they are split by audience and README region so a writer can pick up one without holding the whole README in their head. Work each against the **shipped** code (read the named source files), not against the code plan's predictions.

**Commit format (every task):** imperative mood, sentence case, no trailing period, your agent name in parentheses — e.g. `Re-home Add measure and adopt the block-menu wording in the README (doc-writer)`.

**What review 7 actually changes for a doc reader** (the user-/contributor-visible deltas — confirm each in the shipped source before writing):
- The per-row tree menu (section, measure, AND note) becomes the Gutenberg block-settings set: **Duplicate, Add before, Add after** in a primary group and **Remove** in a separate group. The old per-kind item sets — the section row's **"Add measure"**, and any "Add note"-as-menu-item phrasing — are gone from the row menus. (`StructureTree.js`.)
- **"Add measure" moves OFF the section row menu and INTO the Section inspector panel** as a button (the owner-visible consequence call, design §3.3 / §8). The Section panel, which already has "Remove section", gains an "Add measure" button.
- **Positional insertion** ("Add before" / "Add after") is the new way to grow sections, measures, and notes from the tree — a reshape of the existing add, inserting a fresh node before/after the row and auto-selecting it. (`edit.js` gains six insert handlers.)
- The hand rows still host the single direct **"Add note"** button (now drawn with a real plus glyph). This is unchanged in *behavior* and stays the way to seed the first note of an empty hand — the only delta is the icon, which is not user-prose-visible, so it needs no README wording change beyond not contradicting it.
- **Visual polish** (chevron alignment, a hairline rule + more space between the tree and the canvas) — `style.scss` only. The README's prose never described chevron alignment or a tree/canvas border, so there is **nothing to document**; do NOT add new prose for these (proportionate: document only what the existing docs claim or a reader would now find wrong).
- **No format / schema / front-end change** (R-KEEP1): `docs/song-format.md`'s field reference is untouched by review 7. Its two editor-mentions (the intro pointer to the README workflow, and the `name`-field note that the tree shows section/measure names and you edit them from the Section/Measure panel) stay accurate — review 7 does not change either. **`docs/song-format.md` needs no edit**; this plan does not task it. (If a writer finds a stale editor-claim there during D1, fix it in passing and note it — but the survey found none.)

**Survey result — what is and isn't stale.** The README is the only doc with claims review 7 makes wrong. The stale claims cluster in three places: the **user authoring workflow** (the "Add, remove, and duplicate from the tree" paragraph and the Section-panel bullet — D1), the **one-line overview sentence** in the "Using the Piano block" intro (D2, bundled with D1's region), and the **contributor notes** (the `src/edit.js` + `src/editor/` file-layout rows and the e2e Tests paragraph — D3). `AGENTS.md` (5 lines, no menu/affordance specifics) and `docs/song-format.md` are unaffected.

---

## D1 — Re-home "Add measure" and adopt the block-menu item set in the authoring workflow

**Goal.** Make the README's user-facing authoring workflow describe the **delivered** tree menu and Section panel: the per-row menu offers **Duplicate, Add before, Add after, Remove** at section/measure/note level; **"Add measure" is now a button in the Section inspector panel**, not a section-row menu item; "Add before"/"Add after" are the positional way to grow the song from the tree; the hand-row "Add note" still seeds the first note of an empty hand; "Add section" stays in the Song panel; "Duplicate" still deep-copies immediately after the original. Remove every claim that the tree menu has "Add measure" or per-kind add items.

**Audience.** Plugin users / song authors (the "Using the Piano block" reader) — non-technical, following the authoring workflow.

**Files.** `README.md` (the "Using the Piano block" section — primarily the "Add, remove, and duplicate from the tree" paragraph and the Section-panel bullet).

**Sections-scope.**
- The **"Add, remove, and duplicate from the tree"** paragraph (currently around `README.md:33`): rewrite so it states the **shipped** row-menu item set — **Duplicate, Add before, Add after, Remove** at section, measure, AND note level — and that **positional inserts ("Add before"/"Add after") grow the song from the tree** (a fresh node lands before/after the chosen row and is selected). State that **"Add measure" is now in the Section panel** (not the section row), that **per-hand "Add note"** on each hand-group row still seeds the first note of an otherwise-empty measure, and that **"Add section" is in the Song panel** (unchanged). Keep the accurate claims: **Duplicate** still inserts a deep copy immediately after the original (section copies measures/notes/name; measure copies both hands/name; note copies pitches/properties), and **reordering is still unavailable** (no move controls). Drop the stale "Add measure is on each section row" clause entirely.
- The **Section panel** bullet (currently around `README.md:39`, "A convenience **Remove section** also appears here"): add that the Section panel **also offers an "Add measure" button** (the way to add a measure, including re-seeding a section emptied of measures). Verify the button's presence and label in the shipped `src/editor/inspector/SectionPanel.js` before describing it.
- Spot-check the **"Browse and select with the structure tree"** paragraph (around `:29`) and the **Note panel** bullet (around `:37`): the hand rows still "host that hand's Add note button" (still true — keep) and the Note panel still offers its own "Add note" / "Remove note" (still true — keep). Only correct these if the shipped code contradicts them.

**Depends on.** The shipped T1+T2 code (render-function menu, the block-menu item set, the six positional-insert handlers, the SectionPanel "Add measure" button). Read `src/editor/StructureTree.js`, `src/editor/inspector/SectionPanel.js`, and `src/edit.js` to confirm the exact item set, labels, and the panel button before writing.

**Traces to.** R-MENU1 (block-menu item set), R-MENU2 (positional insertion), R-MENU3 (hand-row "Add note" kept), R-KEEP6 (Section-panel "Add measure" keeps the capability reachable). Design §3.1, §3.2, §3.3, §8.

**Acceptance.**
- The "Add, remove, and duplicate from the tree" paragraph names the row-menu items as the delivered set (**Duplicate, Add before, Add after, Remove**) and no longer claims the section row has an "Add measure" item — verify the labels against the shipped `StructureTree.js` (exactly "Add before" / "Add after").
- The README states that **"Add measure" lives in the Section inspector panel**, and the Section-panel bullet lists an "Add measure" button alongside "Remove section" — verified present in shipped `SectionPanel.js`.
- "Add section" is still described as living in the Song panel; the per-hand "Add note" is still described as seeding the first note of an empty hand; "Duplicate" still described as a deep copy after the original; reordering still described as unavailable. None of these regress.
- No README sentence claims a tree-menu "Add measure", "Move up/down", "Copy/Cut", or block-style menu on a hand row.
- No new prose invented for the chevron-alignment or tree/canvas-separator visual polish (out of scope for the prose docs).
- `docs/song-format.md` links from/into this section still resolve (the `#2-build-the-song-in-the-visual-editor` and `#using-the-piano-block` anchors are unchanged).

---

## D2 — Refresh the one-line "what you do from the tree" overview sentence

**Goal.** Fix the single summary sentence in the "Using the Piano block" intro that enumerates the tree operations, so it matches the delivered block-menu model (positional inserts at every level; "Add measure" in the Section panel) instead of the old per-kind "add/remove/duplicate for measures and notes and remove/duplicate for sections … adding a section lives in the Song panel" enumeration.

**Audience.** Plugin users / song authors — the same reader as D1; split out only because this sentence is in the section's **intro overview** (a different README region from D1's body paragraphs) and a writer may handle the one-liner separately.

**Files.** `README.md` (the "Using the Piano block" intro sentence, currently around `:19`).

**Sections-scope.**
- The intro sentence at `README.md:19` ("…run add/remove/duplicate for measures and notes and remove/duplicate for sections from that tree (adding a section lives in the sidebar's Song panel)…"): rewrite the parenthetical/enumeration so it reflects the delivered reality — the tree's per-row menu offers **Duplicate / Add before / Add after / Remove** at every level (so add is now positional at section level too), **"Add measure" is in the Section panel**, and **"Add section" is in the Song panel**. Keep it a single high-level sentence; the detail lives in D1's body paragraph. Do not let this sentence and D1's paragraph contradict each other.

**Depends on.** Same shipped code as D1 (T1+T2). Coordinate with D1 so the overview sentence and the body paragraph agree.

**Traces to.** R-MENU1, R-MENU2, R-KEEP6. Design §3.1, §3.3.

**Acceptance.**
- The intro sentence no longer enumerates a per-kind operation set that omits positional inserts; it summarizes the delivered tree menu (Duplicate / Add before / Add after / Remove) and correctly locates "Add measure" (Section panel) and "Add section" (Song panel).
- The sentence is consistent with D1's body paragraph (no contradiction between the overview and the detail).
- It stays a brief overview — no new field-level detail introduced here.

---

## D3 — Update the contributor file-layout rows and the e2e Tests paragraph

**Goal.** Bring the contributor-facing notes in line with the delivered code: the `src/edit.js` and `src/editor/` file-layout rows must describe the **new mutator surface** (positional-insert handlers alongside add/remove/duplicate; "Add measure" re-homed to the Section panel; the block-menu item set on the tree), and the **Tests** paragraph's e2e description must mention the positional-insert exercise and the Section-panel "Add measure" path. Keep these proportionate — update only the clauses review 7 makes wrong; do NOT rewrite accurate prose.

**Audience.** Contributors / maintainers (the "For contributors" reader) — technical, reading the file-layout table and the testing notes to understand the editor's structure.

**Files.** `README.md` (the "For contributors" section — the `src/edit.js` and `src/editor/` rows of the file-layout table, and the **Tests** paragraph under "The song format and validator").

**Sections-scope.**
- The **`src/edit.js`** file-layout row (currently around `:142`): the "structural mutators the tree drives — add/remove/**duplicate** section, measure, and note, plus rename via the panels" clause should also reflect the **positional-insert handlers** (Add before / Add after at section, measure, and note) that `edit.js` now owns, and that **"Add measure" is driven from the Section panel** rather than the tree. Read the delivered `src/edit.js` to confirm the handler surface (the six `onAdd{Section,Measure,Note}{Before,After}` handlers + the kept `onAddMeasure` now wired to `SectionPanel`) before wording it. Keep the row's accurate framing (single owner of `working` + `commit`, one mutation path shared by tree and sidebar).
- The **`src/editor/`** file-layout row (currently around `:143`): the clause "hosts add/remove/duplicate for measures and notes and remove/duplicate for sections (adding a section moved to the Song panel) plus the per-hand 'Add note'" should be updated to the delivered model — the tree's per-row menu is the **Gutenberg block-menu set (Duplicate / Add before / Add after / Remove)** at section/measure/note, **"Add measure" is in the Section panel**, "Add section" stays in the Song panel, and the per-hand "Add note" stays. Keep the rest of the row (TreeGrid foundation, `__workspace` layout, display-only canvas, removed `StructureList`, inspector panels, selection helpers) — review 7 does not change those.
- The **Tests** paragraph (currently around `:201`, under "The song format and validator"): the e2e clause "selection now flows through the **structure tree** … with tree-driven add/remove/**duplicate**/rename of measures and notes and remove/**duplicate**/rename of sections — adding a section is exercised through the sidebar **Song** panel" should also mention that the e2e now exercises **positional inserts ("Add before"/"Add after")** and that **measure-growing is exercised through the Section-panel "Add measure" button** (matching the delivered `specs/editor.spec.js`). Keep the rest of the paragraph (front-end three-state coverage, hostile-text inertness, the dormant `interactive` hit-rect note) as-is. Confirm against the shipped `specs/editor.spec.js` what the e2e actually asserts before describing it (the e2e is consistency-only and may not have run, but the README should describe the spec as written).

**Depends on.** The shipped T2 code (mutator surface in `edit.js`, SectionPanel button) and T5 (the migrated `specs/editor.spec.js`). Read `src/edit.js`, `src/editor/StructureTree.js`, `src/editor/inspector/SectionPanel.js`, and `specs/editor.spec.js` to confirm the delivered surface before writing.

**Traces to.** R-MENU1, R-MENU2, R-KEEP6 (file-layout rows); R-REG3c, R-MENU2 (Tests paragraph). Design §3.1–§3.3, §5.3.

**Acceptance.**
- The `src/edit.js` row mentions the positional-insert handlers and that "Add measure" is driven from the Section panel; it no longer implies the tree drives "Add measure".
- The `src/editor/` row describes the per-row menu as the block-menu set and locates "Add measure" in the Section panel; it no longer says the tree hosts "add for measures" via the old per-kind items.
- The Tests paragraph mentions the positional-insert e2e exercise and the Section-panel "Add measure" growth path, consistent with the shipped `specs/editor.spec.js`.
- No contributor row or test claim references a runtime dependency added by review 7 (none was — R-KEEP2); the test-only `jest.config.js` React-dedup mapper and the hardened `DropdownMenu` mock are harness internals and need NOT be surfaced in the README unless the writer judges the Tests paragraph already enumerates harness specifics at that grain (it does not today — so do not add them).
- Accurate, unchanged contributor prose (build model, the validator/schema section, the render contract, the `interactive` hit-rect note) is left untouched.

---

## Requirements-coverage map (task → requirement)

| Requirement | Doc task(s) | What the docs say |
|---|---|---|
| R-MENU1 (block-menu item set: Duplicate / Add before / Add after / Remove) | D1, D2, D3 | The tree's per-row menu offers exactly this set at section/measure/note; old per-kind items gone. |
| R-MENU2 (positional insertion grows the song from the tree) | D1, D2, D3 | "Add before"/"Add after" insert a fresh node before/after the row and select it. |
| R-MENU3 (hand rows keep the direct "Add note") | D1 | Per-hand "Add note" still seeds the first note of an empty hand. |
| R-KEEP6 ("Add measure" re-homed to the Section panel — owner-visible) | D1, D2, D3 | "Add measure" is a Section-panel button (not a tree-menu item); the capability stays reachable. |
| R-REG3c (e2e migrated for consistency) | D3 | The Tests paragraph reflects the positional-insert + Section-panel "Add measure" e2e. |
| R-KEEP1 (no format/front-end change) | (none) | `docs/song-format.md` and the front-end README sections need no edit; confirmed unaffected. |
| R-POLISH1 / R-POLISH2 (chevron alignment, tree/canvas separation) | (none) | Visual-only; the README never described them, so no prose change — explicitly out of scope. |
| R-REG1 / R-REG2 / R-REG3a / R-REG3b / R-KEEP2 (regression fix + test harness) | (none) | Harness/implementation internals with no user-/contributor-prose footprint in the existing docs. |
