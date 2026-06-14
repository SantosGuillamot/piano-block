# Design Doc — Review 11: section-remove e2e drift fix, stale-SCSS cleanup, first-run discoverability, and cheap simplifications

Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Branch `worktree-8-editor-ui`.

This document is **standalone**: the plan and code phases work from this doc plus the live code on the branch. It pins the concrete edits for the five findings B1–B5, the load-bearing e2e run/verify procedure, and the full test impact (including the e2e fallout the spec under-counted). It does not design for the out-of-scope nice-to-haves or the validated rejections.

---

## 1. Overview & approach

Review 10 removed the section-removal confirm dialog: section removes are now **immediate and undo-reversible**, and the jest unit tests were updated to match. Two Playwright e2e tests in `specs/editor.spec.js` were missed and still click a confirm-dialog `OK` button that no longer renders — they will hang/fail in CI. Fixing that drift, and **proving the fix by actually running the e2e suite green**, is the one blocking, merge-gating deliverable of this run (B1).

Alongside B1, four lower-risk cleanups from the same review:

- **B2** — delete stale SCSS prose describing on-canvas "add affordances" that moved to the structure tree + inspector (comment-only).
- **B3** — correct a misleading `:first-child` rationale comment in the same SCSS file, while keeping the inline `minWidth: "4em"` styles three unit tests assert (comment-only on the SCSS side).
- **B4** — first-run discoverability: auto-expand the seeded first section and first measure so the first measure's per-hand "Add note" buttons are reachable without two manual chevron-expands.
- **B5** — two no-behavior-change simplifications: drop a dead default parameter (`edit.js`) and derive a destructure from an existing single-source array (`SectionPanel.js`).

### Scope boundary (load-bearing)

The change stays **editor-side**. The song format/schema, `render.php`, and the front-end SVG rendering are **unchanged** — a published song renders byte-identically. B1 is test-only; B2/B3 are comment-only; B4/B5 are small editor-side code changes. Only `@wordpress/*` packages already available to the block are used; **no new dependencies**.

### What makes this run non-trivial

Four of the five findings are mechanical. The one with real design content is **B4**: auto-expanding the seeded rows collides with the e2e suite in a way the spec mis-assessed. The spec's `AC-B4-b` claimed the manual expand steps are "idempotent against already-expanded rows" — **this is false**, and B4's own auto-expand collides with **8 tests**, not the 1 the spec named.

Compounding this, review 10 shipped a **second, unreconciled behavior change** the e2e suite never caught: commit `4f3ed90` ("Make tree row labels toggle symmetrically") made a section/measure label click an **unconditional symmetric toggle** (`StructureTree.js:156-159`) — clicking an **open** row's label now **collapses** it, where the pre-`4f3ed90` handler was select-and-reveal (it never collapsed). That change never touched `specs/editor.spec.js`, so any test that relies on a section/measure label click *not* collapsing an open row is now suspect — including one the prior design wrongly called a "survivor." This run's load-bearing gate is a **green** e2e suite, so all three sources of test breakage are in scope: B1's confirm-dialog drift, B4's auto-expand ripple, and review 10's symmetric-toggle fallout. Section 4 (B4) resolves the auto-expand ripple and the symmetric-toggle fallout together; Section 7 records the spec deviations. The deviations are **test-impact corrections**, not requirement changes: B4's source change (the two-key unconditional seed) ships exactly as specified.

### Files touched

| File | Finding(s) | Nature |
| --- | --- | --- |
| `specs/editor.spec.js` | B1, B4 (e2e edits) | test edits |
| `src/edit.js` | B4 (seed), B5.1 | code |
| `src/editor/inspector/SectionPanel.js` | B5.2 | code |
| `src/editor.scss` | B2, B3 | comment-only |

All B1 and B4 e2e edits land in the **same file and suite** (`specs/editor.spec.js`), so the single e2e run gates both.

### Coordinate convention

Line references are confirmed against the live worktree tree at design start and are **evidence / starting points, not frozen coordinates** — they shift as edits land. Implementers re-confirm each site by reading/grepping the live file before editing. `SectionPanel.js` lives at `src/editor/inspector/SectionPanel.js`.

---

## 2. B1 — Fix the CI-breaking section-remove e2e drift (🔴 blocking, test-only)

Bring the two Playwright e2e tests back in line with the shipped behavior (section removes are immediate and undo-reversible; **no** confirm dialog), then verify by running the suite green.

There are exactly **two** `name: "OK"` section-remove clicks in the whole file (confirmed: `:669` and `:1232`); both are deleted. Do **not** touch unrelated `confirm`/`OK` references (button aria-labels, JSON-repopulate prose, an expansion-key string) and do **not** touch the measure-remove tests (the measure-remove path already asserts the immediate behavior with no dialog).

### 2.1 Drift site 1 — the "Add before / Add after" flow test (currently `:663-673`)

This is a broad add/remove/duplicate flow, not the dialog-regression anchor — it stays **poll-only** (no dialog guard; that would be redundant with the guard added at drift site 2).

- **Delete** the OK-click block (currently `:668-670`):
  ```js
  await editor.canvas
      .getByRole("button", { name: "OK", exact: true })
      .click();
  ```
- **Keep** the `openRowAction("Actions for Section 3", "Remove")` click and the trailing `sections.length` → `2` poll. Once the OK-click is gone, that existing poll asserts the immediate remove.
- **Rewrite** the stale comment (currently `:663-664`, which claims the remove "is gated behind a ConfirmDialog … click OK to confirm") to the immediate/undo-reversible story.

Intended resulting block:
```js
// Remove the third (empty) section from its actions menu → removed immediately
// (no confirm dialog; removes are immediate and undo-reversible).
await (
    await openRowAction(editor, "Actions for Section 3", "Remove")
).click();
await expect
    .poll(async () => (await storedSongObject(editor)).sections.length)
    .toBe(2);
```

### 2.2 Drift site 2 — the dedicated section-remove test (currently `:1185-1238`)

- **Rename** the test (currently `:1191`) from
  `"the Section panel Remove section button confirms via a real dialog before removing"`
  to **`"the Section panel Remove section button removes the section immediately"`** (matches the lowercase, present-tense, behavior-describing cadence of sibling tests).
- **Delete** the OK-click block (currently `:1230-1232`):
  ```js
  await page.getByRole("button", { name: "OK" }).click();
  ```
- **Rewrite** the false header comment block (currently `:1185-1190`, which describes a `__experimentalConfirmDialog` and "confirms the real dialog") and the inline stale comment (currently `:1225`, "it opens the real ConfirmDialog") to the immediate/undo-reversible story.
- **Keep** the "Remove section" panel-button click and the `sections.length` → `1` poll.
- **Keep** the `page` fixture parameter (currently `:1193`) — it is still used by `openSettingsSidebar(editor, page)` at `:1220`; removing it would break the test.

**Add the negative regression guard** AFTER the "Remove section" click and BEFORE the poll:
```js
// No confirm dialog: the remove is immediate. A re-added ConfirmDialog would
// surface an "OK" button here and re-break this test.
await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);
```
Use `toHaveCount(0)`, **page-scoped** (matching the old OK locator's scope). This is the point of B1: a future re-added dialog would surface an "OK" button and re-break the suite loudly. The guard goes on this test only.

Intended resulting tail of the body:
```js
// Click the panel's "Remove section" button — the section is removed immediately.
await sidebar
    .getByRole("button", { name: "Remove section", exact: true })
    .click();

// No confirm dialog: the remove is immediate. A re-added ConfirmDialog would
// surface an "OK" button here and re-break this test.
await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);

// The section is removed immediately: sections.length drops from 2 to 1.
await expect
    .poll(async () => (await storedSongObject(editor)).sections.length)
    .toBe(1);
```

### 2.3 Do-not-regress constraints

- Do **NOT** re-introduce a `ConfirmDialog` / `__experimentalConfirmDialog` anywhere (in code or in tests).
- Do **NOT** touch the measure-remove tests (the measure-remove path at `:646-661` already asserts the immediate behavior with no dialog).
- Do **NOT** touch any other `confirm`/`OK` reference in the file.

### 2.4 The e2e run + verify procedure (load-bearing)

**This procedure is the gate for B1, and it simultaneously re-confirms the B4 e2e edits (Section 4) — they live in the same suite.** "Tests edited to match the code" is **NOT** acceptance; the suite must run **green**. Running the suite is the exact gap that let B1 ship in review 10.

From the worktree root, in order:

1. `npm run build`
2. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:start`
3. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 WP_BASE_URL=http://localhost:8891 npm run test:e2e`
4. (cleanup) `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:stop`

**Why each piece** (verified against the live config and `@wordpress/env` 11.7.0):

- **Alt ports 8890/8891.** The **main repo's** wp-env is already up (`docker ps`), holding the default ports **8888** (dev) / **8889** (tests). Ports **8890/8891 are free** (`lsof` empty). The worktree run must use the alternate ports.
- **`WP_ENV_PORT` / `WP_ENV_TESTS_PORT` on step 2.** These env overrides beat `.wp-env.json` (which has no `port`/`testsPort`), so the worktree's own wp-env boots its dev site on 8890 and its **tests site on 8891**. The worktree has its own `node_modules/.bin/wp-env` (not a symlink to main).
- **`WP_BASE_URL=http://localhost:8891` on step 3.** This is Playwright's **navigation target** — it points the suite at the worktree's tests site on 8891, independent of the `webServer` health-check.
- **`WP_ENV_PORT` / `WP_ENV_TESTS_PORT` ALSO on step 3 (reboot-safety, not redundant).** `playwright.config.js` extends `@wordpress/scripts/config/playwright.config.js`, whose `webServer` is: `command: "npm run wp-env start"` (no port flags baked in), `port: baseUrl.port` (derived from `WP_BASE_URL` → 8891), `reuseExistingServer: true`. With the step-2 container already serving 8891, the health-check sees it up and **reuses** it (no boot). **But** if the health-check port were ever down, Playwright would run the bare `npm run wp-env start`; without the port overrides on its environment that bare invocation would boot on the `.wp-env.json` defaults 8888/8889 and **collide** with the main repo. Carrying the overrides on step 3 guarantees the fallback boot inherits the alt ports.

**STOP-and-report-blocker path (no silent skip).** If — after genuine effort (build, alt-port `env:start`, env-var overrides) — the suite genuinely cannot be executed in-environment, the code phase **STOPS and reports it explicitly as a blocker**. A silent skip is exactly the review-10 failure mode and is not acceptable. On current evidence (docker up, wp-env 11.7.0 present, ports 8890/8891 free, env-var override mechanism verified), this path is not expected. The code phase MUST report the real pass/fail result of step 3.

---

## 3. B2 — Delete stale SCSS prose (🟡, comment-only)

`src/editor.scss`, **comments only** — no selector/rule/behavior change. The on-canvas "add affordances" the comments describe no longer exist; adds now live in the structure tree + inspector.

- **File-header comment (currently `:6-8`).** Rewrite so the "on-canvas add affordances sit beside it" clause no longer claims canvas-side add affordances. The current text reads: *"The sheet-music canvas displays the score and highlights the current selection (display + highlight only); on-canvas add affordances sit beside it; the song-level and selected-event settings live in the block's `InspectorControls` sidebar …"*. The rewrite drops the "on-canvas add affordances sit beside it" claim while keeping the display/highlight and inspector facts.
- **`&__canvas` block comment (currently `:106-107`).** Rewrite "The canvas display wrapper: the SVG host plus the add affordances." so it no longer references nonexistent canvas add affordances. **Keep** the load-bearing `min-width: 0` rationale that immediately follows it (it explains why the canvas column can shrink inside the flex workspace).

**Do NOT** touch `src/editor/selection.js` — its "add-note target" reference (`:130`) is a valid, unrelated mapping of a click back to core's `data-measure`, explicitly out of scope.

The `__add-note` / `__add-measure` / `__canvas-actions` hook classes are referenced only in `src/editor/__tests__/SongCanvas.test.js` as a **negative guard** (asserting they are absent). They are stale prose, not dead code; the edit trips no tests.

---

## 4. B3 — Fix the misleading `:first-child` SCSS comment; keep the inline 4em (🟡, comment-only on SCSS)

`src/editor.scss:20-27`, **comment only**.

The current comment claims `:first-child` is "the PitchEditor / AnnotationEditor / the SelectControl+NumberControl pair in HandConfig." That is wrong:

- The list-row has **three** children: in `HandConfigEditor.js` a `SelectControl` (`:167`), a `NumberControl` (`:178`), and a trailing trash `Button` (`:196`).
- `PitchEditor` / `AnnotationEditor` return **React Fragments** (e.g. `PitchEditor.js` closes `</>` at `:94`) that flatten their controls into the parent `HStack`.

So across all three list-row users (`PitchList`, `AnnotationList`, `HandConfigEditor`), `:first-child` is **always a single leading control** — never a pair.

- **B3.1** — Rewrite the `> :first-child` rationale (currently `:20-27`) so it describes the row's **single leading control** (e.g. the leading `SelectControl`, or the leading control of the editor Fragment), kept from collapsing to zero at narrow inspector widths by the rule's `min-width`. Do **NOT** change the SCSS `min-width: 8em` rule value (currently `:28-31`) — it is distinct from the inline 4em and three unit tests do **not** depend on it changing.
- **B3.2** — **KEEP** the inline `style={{ minWidth: "4em" }}` at `HandConfigEditor.js:193`, `PitchEditor.js:79`, and `PitchEditor.js:91`. Do **NOT** move `4em` into SCSS — three unit tests assert `style.minWidth === "4em"`: `pitches.test.js:216`, `pitches.test.js:231`, `contextControls.test.js:421`.

---

## 5. B4 — First-run discoverability: auto-expand the seeded section + measure (🟡) + its resolved e2e fallout

This is the one finding with real design content. The **source change** is exactly as the spec specified; the **e2e fallout** is larger than the spec assessed and is resolved here. That fallout has two independent sources (§5.3): **Hazard A**, B4's own auto-expand colliding with the blind chevron helper, and **Hazard B**, review 10's already-shipped symmetric label toggle (`4f3ed90`) that was never reconciled — one red of which (`:580`) is independent of B4 and red on HEAD today.

### 5.1 Context: why two keys

The empty-song seed (`newSong()` → one section → one measure) produces an **empty** measure — `newMeasure()` returns `{}` (no hand, no note). `StructureTree` nonetheless renders both hand-group rows (Right hand, Left hand) for every measure, and each hand-group row's actions cell holds a direct "Add note to `<hand>`…" `Button` (the hand rows render only when the **measure** is expanded: `StructureTree.js` `if (!measureExpanded) return;` at `:477-479`, then `HANDS.forEach` at `:481`). So the real first-note entry point for an empty measure is the per-hand "Add note" buttons, visible once the section **and** measure are expanded.

The expansion state currently starts empty (`src/edit.js:100`: `useState(() => new Set())`), so on a fresh block the seeded section and measure are collapsed and the first note sits two chevron-expands deep.

### 5.2 Source change (`src/edit.js:100`)

Replace `useState(() => new Set())` with the **two-key unconditional seed**, using the existing `expansionKey` helper (already imported at `edit.js:24`):

```js
const [expanded, setExpanded] = useState(
    () =>
        new Set([
            expansionKey({ sectionIndex: 0 }),
            expansionKey({ sectionIndex: 0, measureIndex: 0 }),
        ]),
);
```

Design decisions baked into this:

- **Use `expansionKey(...)`, not literal `"s0"` / `"s0m0"` strings.** The same helper produces the keys the toggle/lookup logic reads, so the two sides cannot drift on key shape.
- **Exactly these two keys.** Expanding only the section is not enough (the measure's hand rows would still be hidden). The hand rows themselves need **not** be seeded — their "Add note" button sits on the hand row, visible once the measure is expanded. The hand key (`s0m0rightHand`) is deliberately never auto-seeded.
- **Seed UNCONDITIONALLY** (do not gate on the empty-song case). The `expanded` Set is membership-only; a key for a row that does not exist is inert (no row, no effect, no error). On a saved multi-section song this merely pre-opens its first section + first measure — harmless. Gating to `song.trim() === ""` would force the once-run `useState` initializer to **close over `song`** for no real risk reduction.
- **No "Start a song" CTA, no net-new UI.** Auto-expand is the lighter, lower-risk option chosen here.

This source change touches no toggle / collapse / auto-reveal / focus logic; it only seeds the initial membership of the Set.

### 5.3 The e2e fallout — two independent hazards (spec under-counted both — resolved here)

There are **two** distinct sources of e2e breakage in this run, and the prior design conflated them. **Hazard A** is B4's own auto-expand colliding with the blind chevron helper. **Hazard B** is review 10's already-shipped symmetric label toggle (`4f3ed90`) that was never reconciled into `specs/editor.spec.js` — it produces one RED **on HEAD** (independent of B4) plus one more RED **only under B4**.

#### Hazard A — B4 auto-expand vs. the blind `expandRow` chevron helper (8 tests)

`AC-B4-b` asserted the `:469` flow "still passes … its manual expand steps are **idempotent** against already-expanded rows." **This is false**, and the real blast radius is **8 tests, not 1**:

- `expandRow(editor, name)` (`specs/editor.spec.js:337-339`) is a **blind chevron click** — no expanded-state check.
- The chevron's `onClick` routes to `onToggleExpanded(key)` (`StructureTree.js:102` → `edit.js:109`), which **toggles** (`has(key) ? delete : add`). The chevron renders on every section/measure row regardless of expanded state (only the glyph swaps) — it is **not** an expand-only affordance.
- Therefore, with `s0` / `s0m0` auto-open from mount, a blind `expandRow("Section 1")` / `expandRow("Measure 1")` **COLLAPSES** the row it means to open.
- The `expanded` `useState` lives in `Edit` and runs once at `editor.insertBlock` (mount). Neither `seedSongViaJson` (JSON textarea → `song` attr) nor `switchToVisualMode` (mode toggle) **remounts**, so the `s0` / `s0m0` membership persists the whole test. Every affected test mounts **empty** first, so gating the seed to the empty song would change nothing for these tests — confirming the unconditional seed (5.2) is correct and gating is pointless.

**Hazard-A blast radius — 8 tests break:**

| Site | Test | Level it asserts | Remedy |
| --- | --- | --- | --- |
| `:469` | seeded empty measure adds first note | drill-down | Prong 1 (helper) |
| `:530` | drill-down flow | drill-down | Prong 1 (helper) |
| `:676` | measure Add before/after | drill-down | Prong 1 (helper) |
| `:1294` | ArrowRight/Left on **section** row | section→measures | **Prong 2** (collapse `s0`) |
| `:1331` | ArrowRight/Left on **measure** row | measure→hands | **Prong 2** (collapse `s0m0`) |
| `:1361` | ArrowRight/Left on **hand** row | hand→notes | Prong 1 (helper) |
| `:1504` | drill-down flow | drill-down | Prong 1 (helper) |
| `:1535` | drill-down flow | drill-down | Prong 1 (helper) |

`:1294` is the site the spec missed entirely: it does **not** use `expandRow` at all, but hard-asserts the collapsed-seed premise at `:1313` (`expect(treeRow("Measure 1")).toHaveCount(0)`), which auto-expanding `s0` breaks directly. `:1361` (hand→notes) is fully fixed by Prong 1 alone because B4 does **not** auto-expand the hand key, so its note-level assertion (`:1381` `treeRow("C")` count-0) is unaffected.

#### Hazard B — the unreconciled symmetric LABEL toggle (`4f3ed90`)

Review 10's `4f3ed90` made a section/measure label click an **unconditional symmetric toggle** (`StructureTree.js:156-159`): clicking an **OPEN** section/measure label now **COLLAPSES** it, where the pre-`4f3ed90` handler was select-and-reveal (it never collapsed). `specs/editor.spec.js` was never reconciled. Auditing all six label-click sites (`treeRow(editor, …).click()` — `:547`, `:601`, `:774`, `:786`, `:804`, `:1222`):

| Site | Test | Effect of symmetric toggle | Remedy |
| --- | --- | --- | --- |
| `:580` / `:601` | "…adds, removes and duplicates…" | **RED on HEAD** (independent of B4): `:593` `expandRow` opens `s0`; `:601` label-click **collapses** `s0`; `:613` `openRowAction` on "Measure 1" needs `s0` open → fails. | **Prong 3** (re-open `s0`) |
| `:757` / `:774` + `:786` | "selecting structure-tree rows reveals the right panels" | **RED under B4 only** (green on HEAD: the section starts collapsed there). Under B4, `s0` auto-opens; `:774` label-click **collapses** it, so `:780` `expect(treeRow("Measure 1")).toBeVisible()` fails; `:786` then cannot find Measure 1. | **Prong 3** (collapse auto-open first) |
| `:547` | note "C" leaf click | SAFE — only needs the row **selected**; toggling a note leaf is inert. | none |
| `:804` | rename | SAFE — only needs the row **selected**, never expanded. | none |
| `:1222` | drift-site-2 | SAFE — only needs the row **selected**, never expanded. | none |

So Hazard B adds **one RED on HEAD** (`:580`, the BF-1 finding, masked until now by the wp-env gap that kept the e2e suite from running) and **one RED under B4** (`:757`). The three remaining label sites (`:547`, `:804`, `:1222`) are safe because each only requires the row selected — a label click that also toggles a note leaf, or selects an already-correct row, changes nothing they assert. Both Hazard-B reds are remedied in **Prong 3** (§5.4).

### 5.4 Resolution — three prongs (keep the two-key seed exactly)

The seed (5.2) is unchanged. Both hazards are contained to `specs/editor.spec.js` — **no source change**. Prong 1 (one idempotent helper edit) and Prong 2 (two raw collapse inserts) fix Hazard A; Prong 3 reconciles Hazard B's two symmetric-toggle reds (plus a comment-only JSDoc/prose cleanup).

#### Prong 1 — make `expandRow` idempotent (one helper edit, fixes 6 drill-down tests)

Rewrite `expandRow` (`specs/editor.spec.js:337-339`) to read the row's `aria-expanded` and click the chevron **only when not already `"true"`**:

```js
async function expandRow(editor, name) {
    // Idempotent: edit.js seeds s0 + s0m0 expanded on mount, so the seeded
    // first section/measure may already be open. The chevron is a pure toggle,
    // so clicking an open row would COLLAPSE it — only click when collapsed.
    // The row's <tr> carries aria-expanded (real + mock __experimentalTreeGridRow);
    // "true" means already open → no-op.
    const row = structureTree(editor)
        .locator("tr")
        .filter({ has: treeRow(editor, name) });
    if ((await row.getAttribute("aria-expanded")) !== "true") {
        await rowChevron(editor, name).click();
    }
}
```

Why this is sound:

- **`aria-expanded` is reliable on the real component, not only the mock.** The structure tree's rows are real `__experimentalTreeGridRow`s. The real Gutenberg `packages/components/src/tree-grid/row.tsx` (trunk) renders `<tr role="row" aria-expanded={isExpanded}>`, and the project's own mock mirrors that contract (`test/mocks/wordpress-components.js:531`). React omits the attribute when `isExpanded` is `undefined`. `StructureTree` passes `isExpanded` + `data-expansion-key` on the **same** `<tr>` for section (`:364-365`) and measure (`:426`) rows, so every section/measure `<tr[data-expansion-key]>` carries `aria-expanded="true"|"false"`. (`@wordpress/components` is a webpack external resolving to the `wp.components` runtime global, not in `node_modules`, so the real source is web-verified, not locally greppable.)
- **The row locator mirrors `rowChevron`'s own resolution** (`tr` + `.filter({ has: treeRow })`, `:318-321`), so no new fragility is introduced.
- **It matches the helper's documented intent.** The JSDoc already says "Expand … revealing its children" — expand-only is the documented behavior; the old blind-toggle was the latent bug.

This fixes the six drill-down sites (`:469`, `:530`, `:676`, `:1361`, `:1504`, `:1535`) with **zero per-test churn**.

#### Prong 2 — two one-line collapse inserts for the keyboard expand/collapse tests

An idempotent helper cannot fix `:1294` and `:1331`: both **assert a row's children are hidden** (a collapsed-start premise), which the auto-open seed directly contradicts. Each needs one raw `rowChevron(...).click()` collapse insert. Use **raw `rowChevron(...).click()`** (still a toggle), NOT `expandRow` (now idempotent expand-only → would no-op against the already-open row). No new `collapseRow` helper is introduced — two one-line inserts don't warrant it, and the raw chevron click is the existing, documented toggle affordance.

- **`:1294` (section→measures).** Insert AFTER `assertStructureTreeOpen` (`:1305`) and BEFORE the collapsed-premise assert (`:1307`):
  ```js
  // edit.js seeds s0 expanded on mount; collapse it so this test can drive the
  // keyboard expand from a known-collapsed section row.
  await rowChevron(editor, "Section 1").click();
  ```
  This collapses the auto-open `s0`. The also-seeded `s0m0` is inert while `s0` is collapsed (the measure row is not rendered), and this test never touches the measure level, so the lingering membership is harmless. After the insert: `:1312` section row visible ✓, `:1313` `Measure 1` count-0 ✓; the ArrowRight-expand / ArrowLeft-collapse body is unchanged. (Dropping the collapsed-start assert was rejected — it is the guard that gives ArrowRight something to prove.)

- **`:1331` (measure→hands).** The existing `:1342` `expandRow("Section 1")` becomes a **no-op** (section already auto-open) and correctly leaves `s0` **OPEN** — which is needed so the Measure 1 row stays rendered to receive the collapse click. Insert AFTER `:1342` and BEFORE the measure-row locator (`:1344`):
  ```js
  // edit.js seeds s0m0 expanded on mount; collapse the measure so this test can
  // drive the keyboard expand from a known-collapsed measure row (the section
  // stays expanded so the measure row is visible to receive focus).
  await rowChevron(editor, "Measure 1").click();
  ```
  **Order is load-bearing:** section-expand FIRST (`:1342`, keeps the measure row present), THEN collapse the measure. After the insert: `:1348` measure row visible ✓, `:1349` `Right hand` count-0 ✓; the keyboard drive is unchanged.

#### Prong 3 — reconcile the symmetric-label-toggle reds (Hazard B)

`4f3ed90` already shipped the symmetric LABEL toggle (`StructureTree.js:156-159`); the suite was never reconciled. Two sites need a one-line reconciliation each — both in `specs/editor.spec.js`, no source change.

- **`:580` (RED on HEAD — the BF-1 finding).** At `:601`, the test currently does a bare `await treeRow(editor, "Section 1").click();` to **select** Section 1 (for the panel), but that label click now **collapses** the `s0` opened by the `:593` `expandRow` — so `:613`'s `openRowAction("Measure 1", …)` no longer finds an expanded section. Replace the bare collapsing click with **select-then-idempotent-re-open**:
  ```js
  // The label click selects Section 1 (for the panel) AND toggles its
  // expansion (4f3ed90's symmetric toggle), collapsing the s0 opened above.
  // Re-open it idempotently so Measure 1 stays revealed for the row action below.
  await treeRow(editor, "Section 1").click();
  await expandRow(editor, "Section 1");
  ```
  After the label collapse, `s0`'s `aria-expanded` is `"false"`, so the idempotent `expandRow` (Prong 1) genuinely re-opens it — `s0` is open for `:613`. Also fix the now-stale `:586-588` comment that calls the label "select-only" — it selects **and** toggles.

- **`:757` (RED under B4 only).** Under B4, `s0` (and `s0m0`) auto-open at mount; this test expects to **open** them via label clicks. Insert a raw chevron collapse immediately BEFORE each label click so the label click genuinely opens-and-selects:
  - BEFORE `:774` (`treeRow("Section 1").click()`):
    ```js
    // edit.js seeds s0 expanded on mount; collapse it so the label click below
    // opens-and-selects Section 1 (rather than collapsing it via 4f3ed90's
    // symmetric toggle) and :780 sees Measure 1 revealed.
    await rowChevron(editor, "Section 1").click();
    ```
  - BEFORE `:786` (`treeRow("Measure 1").click()`):
    ```js
    // edit.js seeds s0m0 expanded on mount; collapse it so the label click below
    // opens-and-selects Measure 1 and genuinely reveals its hand rows.
    await rowChevron(editor, "Measure 1").click();
    ```
  Then rewrite the stale `:770-772` / `:778-779` / `:783-784` prose (which still describes the pre-`4f3ed90` "select-and-reveal, never collapses" label) to the symmetric-toggle contract: a section/measure label click selects **and** toggles expansion, so the test collapses the auto-open row first to drive the open path.

##### Prong 3 (cont.) — JSDoc / prose reconciliation (comment-only, no-assertion-impact)

Alongside the two load-bearing `:580` / `:757` remedies above, Prong 3 carries a comment-only cleanup. These edits **change no assertion or interaction** — they are stale comments left behind by `4f3ed90`, listed separately so they are **not** conflated with the load-bearing remedies:

- **`treeRow` JSDoc (`:290-295`).** Rewrite the current "SELECT-AND-REVEAL … never collapses" description to the actual contract: *a section/measure label click is a symmetric toggle — it selects the row AND toggles its expansion (collapsing an open row), per `4f3ed90`*. (A note-leaf label click only selects; there is nothing to expand.)
- **`expandRow` JSDoc (`:324-332`).** Fine as-is — leave it. (Prong 1 already aligns the helper body with the existing "Expand … revealing its children" intent.)
- **Other stale "select-only" prose (`:21-26`, `:477`, `:542`, `:587`).** Reconcile each to the symmetric-toggle reality where it still claims a label click is select-only / never collapses. Comment-only, no-assertion-impact.

### 5.5 Source-side B4 verification

`AC-B4-b`'s source-side claim ("existing tree interactions unchanged; `test:unit` + `build` pass") holds: seeding the initial Set touches no toggle / collapse / auto-reveal / focus logic, and the unit tests do not assert the initial expansion membership (jest tree tests drive expansion explicitly). The e2e side of B4 is verified by the B1 run (Section 2.4) — all the affected tests live in the same suite.

---

## 6. B5 — Cheap simplifications (🟡, no behavior change)

Two single-source / dead-code cleanups, no behavior change.

### 6.1 B5.1 — drop the dead default arg (`src/edit.js:248`) + fold the stale comment (`:245-247`)

The only caller of `onAddMeasure` (`SectionPanel.js`, `onClick={() => onAddMeasure?.(sectionIndex)}`) always passes an explicit `sectionIndex`, and every test caller (`SectionPanel.test.js:279`, `:289`, `Edit.test.js:503`) passes one too. The default is never reached. (`onAddMeasureBefore` / `onAddMeasureAfter` are separate functions, unaffected.)

- **Drop the default** at `:248`:
  ```js
  // before
  const onAddMeasure = (sectionIndex = working.sections.length - 1) => {
  // after
  const onAddMeasure = (sectionIndex) => {
  ```
- **Fold the now-stale clause out of the comment above** (`:245-247`, same hunk). It currently reads:
  > Append an empty measure to a section. The Structure list passes an explicit `sectionIndex`; the default-to-last fallback covers a call with no target. The new measure is reachable via the Structure list, so the selection is left as-is.

  Rewrite to **drop the middle "default-to-last fallback" clause** (no caller relies on a default), keeping the "explicit `sectionIndex`" and "selection left as-is" facts. For example:
  > Append an empty measure to a section. The Structure list passes an explicit `sectionIndex`. The new measure is reachable via the Structure list, so the selection is left as-is.

### 6.2 B5.2 — derive `keep` from `OVERRIDE_KEYS` (`src/editor/inspector/SectionPanel.js:109`)

Inside `emitOverrides`, replace the four-key rest-destructure with a derivation from the existing `OVERRIDE_KEYS` array (`:44`, already consumed by the projection loop at `:55`):

```js
// before (currently :109)
const { tempo, timeSignature, rightHand, leftHand, ...keep } = section;
// after
const keep = Object.fromEntries(
    Object.entries(section).filter(([key]) => !OVERRIDE_KEYS.includes(key)),
);
```

Leave the following `emitSection({ ...keep, ...next });` (`:110`) **unchanged**. This drops exactly the four `OVERRIDE_KEYS` and keeps everything else (`measures`, `name`, etc.) — **identical behavior** to the rest-destructure — and makes `OVERRIDE_KEYS` the single source shared by both the projection loop and the rebuild.

Do **NOT** reuse `omitEmpty` / `omitFalsy` from `emit.js`: they are single-key set-or-delete reducers, the wrong shape here.

---

## 7. Key decisions & trade-offs

1. **B4 seed is unconditional, not gated to the empty song.** Trade-off: a saved multi-section song pre-opens its first section + first measure even though it didn't need first-run guidance. Accepted because (a) the Set is membership-only and inert keys are harmless, and (b) gating would force the once-run `useState` initializer to close over `song` — added complexity and a stale-closure footgun for no real risk reduction. *(Spec-aligned: B4.2.)*

2. **The e2e collisions are resolved by one idempotent helper + a handful of raw-toggle inserts, not by editing each affected test.** Trade-off: `expandRow` is no longer a literal "click the chevron" — it now branches on `aria-expanded`. Accepted because the branch matches the helper's documented intent ("Expand … revealing its children"), fixes 6 Hazard-A sites with zero per-test churn, and `aria-expanded` is a stable, verified signal on the real component. The two keyboard tests (Hazard A, Prong 2) and the two symmetric-toggle reds (Hazard B, Prong 3 — `:580` and `:757`) genuinely need a known expansion state, so they get explicit raw-toggle collapses / re-opens (the documented existing affordances) rather than a new `collapseRow` helper that a few one-liners don't justify. *(This is the resolution of the spec deviations; see items below.)*

3. **B1 adds a page-scoped `toHaveCount(0)` no-dialog guard to drift site 2 only.** Trade-off: drift site 1 stays poll-only, so it would not catch a re-added dialog. Accepted because site 1 is a broad add/remove/duplicate flow, not the regression anchor; a second guard there is redundant. The single anchored guard is what makes a re-added `ConfirmDialog` re-break the suite loudly — the whole point of B1. *(Spec-aligned: B1.3.)*

4. **B3 keeps the inline `minWidth: "4em"` inline, and keeps the SCSS `min-width: 8em` value.** Trade-off: the "4em" floor stays in JS rather than consolidating into SCSS. Required — three unit tests assert `style.minWidth === "4em"`, and the 8em rule is a distinct narrow-width floor. B3 is comment-only on the SCSS side. *(Spec-aligned: B3.2.)*

5. **B5.2 uses `Object.fromEntries(... filter ...)`, not `omitEmpty`/`omitFalsy`.** Those helpers are single-key set-or-delete reducers — the wrong shape for dropping a known key set. The chosen form makes `OVERRIDE_KEYS` the single source for both the projection loop and the rebuild. *(Spec-aligned: B5.2.)*

### Spec deviations recorded by this design (no requirement changed)

All three are **test-impact corrections**. B4's source change (the two-key unconditional seed) ships **exactly as specified**, and Hazard B is a reconciliation with already-shipped source (`4f3ed90`) — **no new source change**.

1. **`AC-B4-b` is factually wrong** where it says the manual expand steps are "idempotent against already-expanded rows." `expandRow` toggles (collapses) an open row; it is not idempotent. The design corrects this with the idempotent-helper rewrite (Prong 1) and documents the true toggle behavior.
2. **The spec's B4 e2e impact under-counted.** It named only `:469`; the real Hazard-A blast radius is **8 tests** (`:469`, `:530`, `:676`, `:1294`, `:1331`, `:1361`, `:1504`, `:1535`), including `:1294`, which does not use `expandRow` at all but hard-asserts the collapsed-seed premise. Additionally, Hazard B (deviation 3) contributes **one further B4-only red, `:757`**, from the symmetric label toggle interacting with the auto-open seed. The design enumerates and remedies all of them (Section 5).
3. **`:580` is a pre-existing RED on HEAD, independent of B4 — the BF-1 finding.** Commit `4f3ed90` ("Make tree row labels toggle symmetrically") made a section/measure label click an unconditional symmetric toggle (`StructureTree.js:156-159`) — clicking an **open** label now **collapses** it — but never reconciled `specs/editor.spec.js`. `:580`'s `:601` label click collapses the `s0` opened at `:593`, so `:613` fails. This was undiagnosed because the wp-env gap (the review-10 failure to actually run the e2e suite) masked it. It is reconciled here in Prong 3 (`:601` select-then-idempotent-re-open), with no source change.

### Out of scope (design nothing for these)

- 🟢 Nice-to-haves excluded by the owner: collapsing the ~12 structural mutators into descriptors + generic ops (follow-up issue #36); `@wordpress/a11y` `speak()` on remove; move up/down reordering; tree note labels omitting the octave; cosmetic token swaps.
- ⛔ Validated rejections — do NOT undo or re-litigate: routing `ContextEditor` `resetAll` through `omitEmpty` (leave `ContextEditor.js:196-209` as-is); treating the missing breadcrumb / move-up-down buttons as a description–code mismatch (it's the PR description that's stale, not the code); disabling boundary removes in the tree menu (zero-section / zero-measure songs validate, so there is no invariant to guard).
- Do NOT re-add any section-remove confirm dialog; do NOT move the inline `minWidth: "4em"` into SCSS; do NOT touch `src/editor/selection.js`; do NOT touch the measure-remove e2e tests or unrelated `confirm`/`OK` references.

### Preserved prior-review wins

The real `TreeGrid` keyboard model and a11y parity; the immediate/undo-reversible deletes (B1 must NOT reintroduce a confirm dialog); the monotonic `focusRequest` focus management; the inline `minWidth` list-row floors (B3 keeps them); the depth-fixed `setXAt` helpers; `omitEmpty`/`omitFalsy`; and raw-JSON mode.

---

## 8. Test strategy & gating

| Finding | Gate | Notes |
| --- | --- | --- |
| **B1** | **Real e2e run** (Section 2.4) | Running the suite **green**, not editing tests to match. The same single run is load-bearing for all three sources of breakage: B1's confirm-dialog drift, B4's auto-expand ripple (Hazard A), and `4f3ed90`'s symmetric-toggle fallout (Hazard B). STOP-and-report-blocker path documented; no silent skip. |
| **B2** | `npm run test:unit` + `npm run build` | Comment-only. The `SongCanvas.test.js` negative guard asserts the hook classes are **absent** — unchanged, so unaffected. |
| **B3** | `npm run test:unit` + `npm run build` | Comment-only on SCSS. The three `minWidth === "4em"` assertions (`pitches.test.js:216`, `:231`, `contextControls.test.js:421`) still pass — the inline styles are untouched. |
| **B4 (source)** | `npm run test:unit` + `npm run build` | Unit tests drive expansion explicitly; none asserts initial membership. |
| **B4 (e2e)** | The B1 e2e run | Helper rewrite (Prong 1) + the two keyboard-test inserts (Prong 2) + the two symmetric-toggle reconciliations (Prong 3 — `:580` re-open, `:757` collapse-before-label) are all in `specs/editor.spec.js`, gated by the single e2e run. |
| **B5** | `npm run test:unit` + `npm run build` | No behavior change. `SectionPanel.test.js` exercises `emitOverrides` by behavior (no direct-shape assertion); `B5.1` callers all pass an explicit `sectionIndex`. |

No snapshot tests exist anywhere in `src/` or `specs/`, so the comment-only and no-behavior-change edits trip nothing.

### Acceptance verification map

- **AC-B1-a** — both OK-clicks deleted (`:669`, `:1232`); the six stale ConfirmDialog/"real dialog" comments gone or rewritten to the immediate/undo-reversible story.
- **AC-B1-b** — drift site 2 renamed to "…removes the section immediately"; page-scoped `toHaveCount(0)` no-dialog guard placed after the "Remove section" click and before the poll; `page` fixture param retained.
- **AC-B1-c** — `npm run test:e2e` actually RUN and GREEN via the alt-ports recipe; real pass/fail reported.
- **AC-B1-d** — if the suite genuinely cannot run, STOP and report an explicit blocker (no silent skip).
- **AC-B2-a/b** — no on-canvas add-affordance prose remains; no rule/selector change; `build` succeeds; negative-guard test unaffected.
- **AC-B3-a/b** — `:first-child` comment describes a single leading control; `min-width: 8em` value unchanged; inline 4em untouched and its three assertions pass.
- **AC-B4-a** — a freshly inserted block shows Section 1 + Measure 1 expanded, with the Right/Left hand rows and their "Add note" buttons visible with no manual expand.
- **AC-B4-b** — existing tree interactions unchanged; `test:unit` + `build` pass; the `:469` e2e flow passes as part of the B1 run (its expand steps are now genuinely idempotent via the helper fix).
- **AC-B4-c (Hazard B, `:580` — RED on HEAD)** — `:601`'s bare collapsing label click is replaced with select-then-idempotent-re-open (`await treeRow("Section 1").click(); await expandRow("Section 1");`) so `s0` is open for `:613`; the stale `:586-588` "select-only" comment is corrected; the `:580` test passes in the B1 run.
- **AC-B4-d (Hazard B, `:757` — RED under B4)** — a raw `rowChevron("Section 1").click()` collapse is inserted before `:774` and a raw `rowChevron("Measure 1").click()` collapse before `:786`, so each label click opens-and-selects rather than collapsing; the stale `:770-772`/`:778-779`/`:783-784` prose is rewritten to the symmetric-toggle contract; the `:757` test passes in the B1 run.
- **AC-B4-e (JSDoc, comment-only)** — the `treeRow` JSDoc (`:290-295`) describes the symmetric toggle (selects AND toggles expansion, per `4f3ed90`); the remaining stale "select-only" prose (`:21-26`, `:477`, `:542`, `:587`) is reconciled. No assertion impact.
- **AC-B5-a/b/c** — `edit.js:248` has no default; `SectionPanel.js` `emitOverrides` derives `keep` from `OVERRIDE_KEYS`; `test:unit` + `build` pass.
