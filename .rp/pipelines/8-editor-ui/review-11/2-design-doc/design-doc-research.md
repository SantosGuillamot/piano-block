# Design research — Review 11 (editor-UI, PR #22)

Iterative Q&A between the design-doc-analyst and the design-doc-researcher
(`design-researcher-r11`) to settle the concrete, implementation-level approach for the
five findings B1–B5. This phase decides **exact edit sites + how**, the **e2e run
procedure**, and **test impact** — not architecture. The findings are small/mechanical
changes to an existing editor; nothing here designs for the out-of-scope nice-to-haves or
the validated rejections.

Inputs: `1-spec/spec.md` (approved requirements) and `1-spec/spec-research.md`. Coordinates
below are re-confirmed against the live worktree tree (branch `worktree-8-editor-ui`) at
design-phase start; they are starting points, re-confirmed by implementers before editing.

---

## Live-tree re-confirmation at design start (analyst-verified before Q&A)

All spec coordinates verified accurate against the live tree:

- `src/edit.js:24` — `expansionKey` is imported (alongside `ancestorKeys`, `resolveSelection`).
- `src/edit.js:100` — `const [expanded, setExpanded] = useState(() => new Set());` (the B4 site).
- `src/edit.js:109-119` — `onToggleExpanded(key)` is a **toggle**: `next.has(key) ? delete : add`.
- `src/edit.js:245-247` — the stale "default-to-last fallback" comment above `onAddMeasure`.
- `src/edit.js:248` — `const onAddMeasure = (sectionIndex = working.sections.length - 1) => {` (B5.1 site).
- `src/editor/inspector/SectionPanel.js:44` — `OVERRIDE_KEYS = ["tempo", "timeSignature", "rightHand", "leftHand"]`.
- `src/editor/inspector/SectionPanel.js:55` — `projectOverrides` loop already consumes `OVERRIDE_KEYS`.
- `src/editor/inspector/SectionPanel.js:108-111` — `emitOverrides` rest-destructure (B5.2 site).
- `src/editor.scss:6-8` — file-header "on-canvas add affordances sit beside it" stale prose (B2.1).
- `src/editor.scss:20-27` — the `> :first-child` "SelectControl+NumberControl pair" comment (B3.1).
- `src/editor.scss:28-31` — `min-width: 8em` rule (KEEP value; distinct from inline 4em).
- `src/editor.scss:106-107` — `&__canvas` "the SVG host plus the add affordances" stale prose (B2.2).
- `specs/editor.spec.js:663-673` — drift site 1 (OK-click at `:669`, comment at `:663-664`, poll at `:671-673`).
- `specs/editor.spec.js:1185-1238` — drift site 2 (test name `:1191`, header comment `:1185-1190`,
  inline comment `:1225`, OK-click `:1232`, poll `:1235-1237`).

E2e infrastructure verified at design start:
- `docker ps`: the **main repo's** wp-env is up, holding default ports 8888 (dev) / 8889 (tests).
- Ports **8890 / 8891 are FREE** (`lsof` empty).
- `wp-env` version **11.7.0** present (honors `WP_ENV_PORT` / `WP_ENV_TESTS_PORT` overrides).

---

## Open design problem surfaced before Q&A: B4's e2e impact on `expandRow`

The spec (AC-B4-b) asserts the `:469` flow "still passes … its manual expand steps are
idempotent against already-expanded rows." **The live evidence contradicts this:**

- `expandRow(editor, name)` (`specs/editor.spec.js:337-339`) is a blind chevron click:
  `await rowChevron(editor, name).click();` — no expanded-state check.
- The chevron's `onClick={onToggle}` (`StructureTree.js:102`) routes to `onToggleExpanded(key)`,
  which **toggles** (`edit.js:109`): clicking an already-expanded row **collapses** it.
- B4 auto-expands `s0` + `s0m0` **unconditionally** on every mount.
- There are **11 `expandRow(editor, "Section 1")` call sites** and several
  `expandRow(editor, "Measure 1")` sites across the e2e suite (`:482-483`, `:544-545`, `:593`,
  `:690`, `:1342`, `:1372-1373`, `:1515-1516`, `:1546-1547`). Each first-expands Section 1 /
  Measure 1 as its opening step.

If `s0`/`s0m0` start expanded, each of these `expandRow("Section 1")` opening calls would
**collapse** the section it means to open — breaking the test. So B4 is **not** test-neutral
at the e2e layer, contrary to AC-B4-b's idempotency claim. The design must settle how this is
handled (and whether it is a spec-level concern to escalate).

---

## E2e run-procedure analysis (analyst-verified at design start)

The B1 run procedure is load-bearing (it is the gap that let B1 ship). Verified facts about
how the worktree's Playwright run actually targets the right server:

- `package.json` scripts: `build` = `wp-scripts build`; `env:start` = `wp-env start`;
  `env:stop` = `wp-env stop`; `test:e2e` = `wp-scripts test-playwright`;
  `test:unit` = `wp-scripts test-unit-js`.
- `playwright.config.js` extends `@wordpress/scripts/config/playwright.config.js` (only adds
  `testDir: "./specs"`). The inherited base config's `webServer` (resolved live) is:
  ```
  command: "npm run wp-env start"   // NO port env vars baked in
  port: 8889                         // HARDCODED to the default tests port
  reuseExistingServer: true
  ```
- `baseURL` comes from `WP_BASE_URL` (defaulting to the tests site). The navigation target is
  `WP_BASE_URL`, **independent of** the `webServer.port` health-check.
- **The subtlety:** `webServer.port` is hardcoded to **8889**, not derived from `WP_BASE_URL`.
  With the main repo's wp-env holding 8889 and `reuseExistingServer: true`, Playwright's
  health check sees 8889 already up and **skips booting** — so it never tries to start wp-env
  on the occupied default ports. Meanwhile navigation goes to `WP_BASE_URL` = the worktree's
  tests port. So the recipe works **provided the worktree's own wp-env is started first**
  (step 2) on 8890/8891, so the 8891 site is actually serving when Playwright navigates there.
- Worktree env verified: `node_modules/.bin/wp-env` present (own copy, not a symlink to main),
  `wp-scripts` present, `@wordpress/env` README documents the `WP_ENV_PORT`/`WP_ENV_TESTS_PORT`
  overrides (lines 144-147, 324).
- **Recommended hardening (to settle with researcher):** carry `WP_ENV_PORT=8890
  WP_ENV_TESTS_PORT=8891` on the `test:e2e` command too (not only on `env:start`), so that if
  the `webServer` health-check ever DID try to boot (e.g. 8889 not up), the re-invoked
  `npm run wp-env start` inherits the alt ports instead of colliding on the defaults. This is a
  belt-and-suspenders addition to the spec's step-3 (`WP_BASE_URL` only).

## B4 fix-space analysis (analyst-verified before Q&A)

The B4 ↔ e2e collision (the only real design problem) and its candidate resolutions:

- **Full blast radius:** all 8 e2e tests that call `expandRow("Section 1")` / `"Measure 1")`
  first do `editor.insertBlock` (mounts the block → auto-expand fires at mount, when the song
  is still empty), then most call `seedSongViaJson` (sets the `song` attribute but does **not**
  remount, so the already-seeded `s0`/`s0m0` membership persists). So **gating the seed to the
  empty song does NOT help** — every one of these tests mounts empty first, so both the gated
  and unconditional seed fire identically here. Sites: `:482-483`, `:544-545`, `:593`, `:690`,
  `:1342`, `:1372-1373`, `:1515-1516`, `:1546-1547`.
- **Idempotency signal available:** the structure tree is a real `__experimentalTreeGridRow`
  (`StructureTree.js:62,359,421`), whose `isExpanded` prop maps to **`aria-expanded`** on the
  `<tr>` (confirmed by the project's own mock contract at
  `test/mocks/wordpress-components.js:509,531`, which mirrors the real component). So a row's
  expanded state is observable via `aria-expanded` on its `<tr>` — a stable signal a Playwright
  helper can branch on.
- **Candidate fixes:**
  1. **Make `expandRow` expand-only / idempotent** (preferred): in `specs/editor.spec.js:337`,
     check the row's `aria-expanded` and click the chevron only if collapsed. One helper, in
     the same e2e file B1 already edits; fixes all 8 sites at once; preserves B4.2's
     unconditional seed (no closure over `song`, no gating). Trade-off: the helper is no longer
     a pure "click the chevron" — but its JSDoc already says "Expand … revealing its children,"
     so expand-only matches its documented intent.
  2. Gate the seed to the empty song — REJECTED both by spec B4.2 and by the blast-radius fact
     above (insertBlock mounts empty, so gating changes nothing for these tests).
  3. Edit each affected test to drop its now-redundant first expand — more sites touched, more
     churn, and risks the tests no longer exercising the expand interaction at all.
- **Direction (to confirm with researcher):** keep B4.2's unconditional seed; resolve the e2e
  collision by making `expandRow` idempotent (candidate 1). This keeps B4 exactly as specified
  and contains the test-impact to one helper.

## Q&A log

(Running record of questions to `design-researcher-r11` and the confirmed answers.)

### Round 1 — B4 e2e impact (the one real design problem)

**Question (to researcher):** For each e2e test that opens with `expandRow("Section 1")` /
`"Measure 1")`, trace exactly what happens after B4 auto-expands `s0`/`s0m0` on mount:
(a) confirm the chevron click truly toggles (collapses an already-open row) and the expander is
not a separate expand-only affordance; (b) confirm both `insertBlock` and `seedSongViaJson`
paths hit the auto-expanded initial state; (c) for each site, do the following assertions/clicks
fail after collapse-instead-of-expand; (d) net verdict + exact line numbers. Breakage map first,
no fix proposed yet.

**Answer (confirmed against live tree).** B4's unconditional seed BREAKS the e2e suite; the
spec's AC-B4-b "idempotent" claim is false at the e2e layer. Details:

- *(a) Chevron is a pure toggle.* `rowChevron` (`specs:317-322`) → blind `.click()` (`:337-339`);
  `TreeExpander.onClick={onToggle}` (`StructureTree.js:102`) → `onToggleExpanded(rowKey)` (`:149`)
  → `edit.js:109` `has ? delete : add`. The chevron renders on every section/measure row
  regardless of `isExpanded` (only the glyph swaps) — not an expand-only affordance. Clicking an
  open row collapses it. (Aside: the label `Button` `onClick` at `StructureTree.js:156-159` also
  toggles symmetrically; its JSDoc claims "select-and-reveal, never collapse" — a doc/code drift,
  but irrelevant to `expandRow`, which uses the chevron. Flagged only.)
- *(b) Seed hits both paths, once per mount.* `expanded` `useState` lives in `Edit` (`edit.js:100`);
  neither `seedSongViaJson` (JSON textarea → `song` attr) nor `switchToVisualMode` (mode toggle)
  remounts. The initializer runs once at `editor.insertBlock`; the `s0`/`s0m0` membership persists
  the whole test. Coordinate keys match the seeded song's section0/measure0 too. No recovery
  between mount and the first `expandRow`.
- *(c)/(d) Per-site verdict.* **8 tests break, 1 survives.** Breaks: `:469`, `:530`, `:676`,
  `:1294`, `:1331`, `:1361`, `:1504`, `:1535`. Survives: `:580` (its `:601`
  `treeRow("Section 1").click()` label-toggles `s0` back open before any measure-level op — fragile,
  by accident). **The researcher found a site the spec missed:** `:1294` does NOT use `expandRow`
  but hard-asserts the collapsed-seed premise at `:1313`
  (`expect(treeRow("Measure 1")).toHaveCount(0)`), which auto-expanding `s0` breaks directly.

### Round 1 follow-up — analyst's refinement of the breakage map (which sites the helper fix covers)

Analyst-verified extension (read `:1294`/`:1331`/`:1361` + `StructureTree.js:477-481` directly):
the hand rows render only when the **measure** is expanded (`if (!measureExpanded) return;` at
`:477-479`, then `HANDS.forEach` at `:481`). So the three keyboard expand/collapse tests split by
which level they assert:

- **`:1361` (hand→notes): FULLY fixed by an idempotent `expandRow`.** `:1372`/`:1373` expand
  `s0`/`s0m0` (helper makes them no-ops when already open); the test then asserts at the **note**
  level — `:1381` `treeRow("C")` `toHaveCount(0)` — and B4 does NOT auto-expand the hand key
  (`s0m0rightHand`), so notes stay hidden. Passes with only the helper fix.
- **`:1294` (section→measures): needs a per-test remedy.** No `expandRow` precedes the broken
  assertion; `:1313` asserts `Measure 1` `toHaveCount(0)` with `s0` auto-open → fails. The whole
  ArrowRight-expands / ArrowLeft-collapses narrative assumes a collapsed start.
- **`:1331` (measure→hands): needs a per-test remedy.** `:1342` `expandRow("Section 1")` is
  helper-fixable, but `:1349` asserts `Right hand` `toHaveCount(0)` while `s0m0` is auto-open —
  and an open measure renders its hand rows (`:481`) → fails. The "measure collapsed, hands hidden"
  premise is contradicted by the auto-expanded `s0m0`.

**So the fix is two-pronged:** (1) make `expandRow` idempotent (covers `:469`, `:530`, `:676`,
`:1361`, `:1504`, `:1535` — the drill-down tests); (2) a per-test remedy for `:1294` and `:1331`,
whose assertions depend on the auto-expanded level starting collapsed. The `:580` survivor needs
no change but should be re-confirmed in the real run.

### Round 2 — fix direction (idempotent helper, two keyboard-test remedies, run-procedure hardening)

**Question (to researcher):** Settle, evidence-cited: (Q2a) the exact idempotent `expandRow`
rewrite + confirm `aria-expanded` is reliable on the *real* `__experimentalTreeGridRow`, not only
the mock; (Q2b) the cleanest minimal `:1294` remedy that keeps the section keyboard
expand-then-collapse intent; (Q2c) the cleanest minimal `:1331` remedy for the measure keyboard
test; (Q2d) whether step-3 of the run recipe should carry `WP_ENV_PORT`/`WP_ENV_TESTS_PORT`
alongside `WP_BASE_URL` to harden the `webServer`-reboot fallback.

**Answer (confirmed against live tree + Gutenberg trunk source).**

- **Q2a — idempotent `expandRow` via `aria-expanded`.** Reliable on the real component: the mock
  renders `<tr role="row" aria-expanded={isExpanded === undefined ? undefined : isExpanded}>`
  (`test/mocks/wordpress-components.js:516-535`, `:531`); the real Gutenberg
  `packages/components/src/tree-grid/row.tsx` (trunk) renders `<tr role="row"
  aria-expanded={isExpanded}>` — same contract (React omits the attr when `isExpanded` is
  undefined). `StructureTree` passes `isExpanded` + `data-expansion-key` on the SAME `<tr>` for
  section (`:364-365`) and measure (`:426`+) rows, so every section/measure
  `<tr[data-expansion-key]>` carries `aria-expanded="true"|"false"`. (`@wordpress/components` is a
  webpack external → `wp.components` global at runtime, imported at `StructureTree.js:63`; it is
  not in `node_modules`, so the real source is web-verified, not locally greppable.) Exact rewrite
  of `specs/editor.spec.js:337-339`:
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
  The row locator mirrors `rowChevron`'s own `tr` + `.filter({ has: treeRow })` resolution
  (`:318-321`), so no new fragility. No `aria-expanded` fallback needed (it is reliable). This one
  edit fixes the six drill-down sites (`:469`, `:530`, `:676`, `:1361`, `:1504`, `:1535`) with zero
  per-test churn.

- **Q2b — `:1294` remedy (collapse `s0` in setup).** Insert ONE raw chevron click after
  `assertStructureTreeOpen` (`:1305`) and before the collapsed-premise assert (`:1307`):
  ```js
  // edit.js seeds s0 expanded on mount; collapse it so this test can drive the
  // keyboard expand from a known-collapsed section row.
  await rowChevron(editor, "Section 1").click();
  ```
  Use raw `rowChevron(...).click()` (a toggle), NOT `expandRow` (now idempotent → would no-op). The
  also-seeded `s0m0` is inert while `s0` is collapsed (the measure row is not rendered), and this
  test never touches the measure level, so the lingering membership is harmless. After: `:1312` s0
  visible ✓, `:1313` Measure 1 count-0 ✓; the ArrowRight-expand / ArrowLeft-collapse body is
  unchanged. (Dropping the collapsed-start assert was rejected — it is the guard that gives
  ArrowRight something to prove.)

- **Q2c — `:1331` remedy (collapse `s0m0` in setup, AFTER the section expand).** The existing
  `:1342` `expandRow("Section 1")` becomes a no-op (section already auto-open) and correctly leaves
  `s0` OPEN — which is needed so the Measure 1 row stays visible to receive the collapse click.
  Insert ONE raw chevron click after `:1342`, before the measure-row locator (`:1344`):
  ```js
  // edit.js seeds s0m0 expanded on mount; collapse the measure so this test can
  // drive the keyboard expand from a known-collapsed measure row (the section
  // stays expanded so the measure row is visible to receive focus).
  await rowChevron(editor, "Measure 1").click();
  ```
  Order is load-bearing: section-expand FIRST (keeps the measure row present), THEN collapse the
  measure. After: `:1348` measure row visible ✓, `:1349` Right hand count-0 ✓; the keyboard drive
  is unchanged.

- **Q2d — run-procedure hardening confirmed; the spec recipe is already correct.** Base webServer
  (`@wordpress/scripts/config/playwright.config.js:48-53`): `command: "npm run wp-env start"` (no
  port flags), `port: baseUrl.port` where `baseUrl = new URL(WP_BASE_URL || "http://localhost:8889")`
  (`:13`), `reuseExistingServer: true`. With `WP_BASE_URL=http://localhost:8891`, the health-check
  targets 8891 (the worktree's tests site, started in step 2) → up → reuse, no boot. The risk: if
  the health-check port were ever DOWN, Playwright would run the bare `npm run wp-env start`, which
  without the port overrides would boot on `.wp-env.json` defaults 8888/8889 → collide with the
  main repo. **Therefore step 3 MUST carry the port overrides too** (wp-env honors env over
  `.wp-env.json`, README `:152`/`:618`/`:814-815`, wp-env 11.7.0) — they are load-bearing
  reboot-safety, not redundant. This is exactly what spec `AC-B1-c` step 3 already prescribes:
  ```
  WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 WP_BASE_URL=http://localhost:8891 npm run test:e2e
  ```
  Keep the spec recipe verbatim; the design records WHY both are present (`WP_BASE_URL` → the
  navigation target on 8891; `WP_ENV_PORT`/`WP_ENV_TESTS_PORT` → reboot-safety on the alt ports).

---

## Settled design decisions (authoritative for the plan/code phases)

All coordinates are starting points — implementers re-confirm each site against the live file
before editing. The five findings are mechanical; the only finding with non-trivial design is B4,
whose e2e fallout is larger than the spec enumerated (resolved below). Nothing here changes a
requirement; the design pins the concrete edits + the e2e run/verify procedure + the full test
impact.

### B1 — section-remove e2e drift (🔴 blocking, test-only)

Edit `specs/editor.spec.js` exactly as the spec's intended blocks specify:

- **Drift site 1 (`:663-673`).** Delete the OK-click block (`:668-670`,
  `editor.canvas.getByRole("button", { name: "OK", exact: true }).click()`); rewrite the stale
  comment (`:663-664`) to the immediate/undo-reversible story; KEEP the
  `openRowAction("Actions for Section 3", "Remove")` click and the `sections.length` → `2` poll.
  Poll-only (no dialog guard here — this is the broad add/remove/duplicate flow, not the
  regression anchor).
- **Drift site 2 (`:1185-1238`).** Rename the test (`:1191`) to **"the Section panel Remove section
  button removes the section immediately"**; delete the OK-click block (`:1230-1232`,
  `page.getByRole("button", { name: "OK" }).click()`); rewrite the header comment (`:1185-1190`)
  and the inline comment (`:1225`) to the immediate/undo-reversible story; KEEP the "Remove section"
  click and the `sections.length` → `1` poll; KEEP the `page` fixture param (`:1193`, still used by
  `openSettingsSidebar` at `:1220`). Add the negative regression guard AFTER the "Remove section"
  click and BEFORE the poll:
  ```js
  // No confirm dialog: the remove is immediate. A re-added ConfirmDialog would
  // surface an "OK" button here and re-break this test.
  await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);
  ```
  Page-scoped `toHaveCount(0)` (matches the old OK locator scope).
- **Do not** re-introduce any `ConfirmDialog`/`__experimentalConfirmDialog`; do not touch the
  measure-remove tests or unrelated `confirm`/`OK` references. The only two `name: "OK"` clicks in
  the file are the two being deleted (`:669`, `:1232`).

**Run + verify procedure (load-bearing — this is the gap that let B1 ship).** From the worktree
root, in order:
1. `npm run build`
2. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:start`
3. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 WP_BASE_URL=http://localhost:8891 npm run test:e2e`
4. (cleanup) `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:stop`

Why each piece: the main repo's wp-env holds default ports 8888/8889 (verified `docker ps`), so the
worktree run uses 8890/8891 (verified free). `WP_ENV_PORT`/`WP_ENV_TESTS_PORT` override
`.wp-env.json` (no `port`/`testsPort` there). `WP_BASE_URL` points Playwright's navigation at the
worktree tests site (8891); the base config's `webServer` (`port: baseUrl.port`, `reuseExistingServer:
true`) then reuses the step-2 container rather than rebooting. The port vars MUST also ride on step 3
(reboot-safety: if the health-check port were down, the bare `npm run wp-env start` the webServer
would spawn must inherit the alt ports, not collide on the defaults).

**The e2e run is the gate for B1, AND it re-confirms the B4 test edits below** (all the affected
tests live in the same suite). The code phase MUST report the real pass/fail. If — after genuine
effort (build, alt-port env:start, env-var overrides) — the suite genuinely cannot run, the code
phase STOPS and reports it as an explicit blocker (no silent skip). On current evidence (docker up,
wp-env 11.7.0, ports 8890/8891 free, override mechanism verified) this path is not expected.

### B4 — first-run discoverability (🟡) + its e2e fallout (the one real design decision)

**Source change (exactly as spec B4.1/B4.2):** at `src/edit.js:100`, replace
`useState(() => new Set())` with the two-key unconditional seed using the `expansionKey` helper
(imported at `:24`):
```js
useState(
    () =>
        new Set([
            expansionKey({ sectionIndex: 0 }),
            expansionKey({ sectionIndex: 0, measureIndex: 0 }),
        ]),
)
```
Unconditional (not gated to the empty song): the Set is membership-only, inert keys for nonexistent
rows are harmless, and gating would force the once-run initializer to close over `song` for no real
benefit. Exactly two keys (`s0` + `s0m0`); the hand rows need not be seeded (their "Add note" button
sits on the hand row, visible once the measure is expanded). No "Start a song" CTA, no net-new UI.

**E2e fallout (larger than AC-B4-b stated — design resolves it).** AC-B4-b's claim that the manual
expand steps are "idempotent against already-expanded rows" is FALSE: `expandRow`
(`specs/editor.spec.js:337`) is a blind chevron click, and the chevron is a pure toggle
(`StructureTree.js:102` → `onToggleExpanded` → `edit.js:109`). With `s0`/`s0m0` auto-open, **8 e2e
tests break** (the spec enumerated only `:469`). Resolution — two prongs:

- **Prong 1 — make `expandRow` idempotent** (one helper edit at `specs/editor.spec.js:337-339`).
  Read the row's `<tr>` `aria-expanded` (reliable on the real `__experimentalTreeGridRow`, verified
  against Gutenberg trunk `tree-grid/row.tsx` and the local mock contract
  `test/mocks/wordpress-components.js:531`) and click the chevron only when not already `"true"`:
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
  Fixes the six drill-down tests with zero per-test churn: `:469`, `:530`, `:676`, `:1361`, `:1504`,
  `:1535`.

- **Prong 2 — per-test setup remedy for the two keyboard expand/collapse tests** whose collapsed-
  start premise B4 disturbs (an idempotent helper cannot help — they assert a row's children are
  hidden):
  - **`:1294` (section→measures):** insert after `assertStructureTreeOpen` (`:1305`), before the
    premise assert (`:1307`): `await rowChevron(editor, "Section 1").click();` (raw toggle — collapses
    the auto-open `s0`). Restores `:1313` `Measure 1` count-0; keyboard body unchanged.
  - **`:1331` (measure→hands):** insert AFTER the existing `:1342` `expandRow("Section 1")` (now a
    no-op leaving `s0` open so the measure row stays visible) and before the measure-row locator
    (`:1344`): `await rowChevron(editor, "Measure 1").click();` (collapses the auto-open `s0m0`).
    Restores `:1349` `Right hand` count-0; keyboard body unchanged. Order is load-bearing
    (section-expand first, then measure-collapse).

  Use raw `rowChevron(...).click()` (a toggle) for both inserts, NOT `expandRow` (now idempotent
  expand-only → would no-op against the already-open row). No new `collapseRow` helper is introduced
  (two one-line inserts don't warrant it; the raw chevron click is the existing, documented toggle
  affordance).

- **`:580` survives unchanged** (its `:601` label-click re-opens `s0` before any measure op) but is
  re-confirmed in the B1 e2e run. The hand-key (`s0m0rightHand`) is never auto-seeded, so note-level
  assertions (e.g. `:1361:1381`, `:1381` is `treeRow("C")` count-0) are unaffected.

Source-side AC-B4-b ("existing tree interactions unchanged; `test:unit` + `build` pass") holds:
seeding the initial Set touches no toggle/collapse/auto-reveal/focus logic; the unit tests do not
assert the initial expansion membership (jest tree tests drive expansion explicitly).

### B2 — stale SCSS prose (🟡, comment-only)

`src/editor.scss`, comments only, no selector/rule/behavior change:
- `:6-8` file-header: rewrite so the "on-canvas add affordances sit beside it" clause no longer
  claims canvas-side add affordances (adds live in the structure tree + inspector).
- `:106-107` `&__canvas` block comment: rewrite "the SVG host plus the add affordances" so it no
  longer references nonexistent canvas add affordances (keep the load-bearing `min-width: 0`
  rationale that follows).
- Do NOT touch `src/editor/selection.js` (its `:130` "add-note target" reference is valid/unrelated).
  The `__add-note`/`__add-measure`/`__canvas-actions` hook classes are referenced only as a negative
  guard in `src/editor/__tests__/SongCanvas.test.js` (asserting absence) — stale prose, not dead
  code; the edit trips nothing.

### B3 — misleading `:first-child` SCSS comment (🟡, comment-only on SCSS); keep inline 4em

`src/editor.scss:20-27`, comment only: rewrite the `> :first-child` rationale so it describes the
row's single leading control (the leading `SelectControl`, or the leading control of the editor
Fragment), kept from collapsing at narrow inspector widths by the rule's `min-width` — NOT a
"SelectControl + NumberControl pair." Structural truth (verified): the list-row has three children
(`HandConfigEditor.js:167` SelectControl, `:178` NumberControl, `:196` trash Button), and
`PitchEditor`/`AnnotationEditor` return Fragments (`PitchEditor.js` closes `</>` at `:94`) that
flatten their controls into the parent `HStack`, so `:first-child` is always a single leading
control across all three users.

- Do NOT change the SCSS `min-width: 8em` rule value (`:28-31`); it is distinct from the inline 4em.
- KEEP the inline `style={{ minWidth: "4em" }}` at `HandConfigEditor.js:193`, `PitchEditor.js:79`,
  `PitchEditor.js:91` — three unit tests assert it (`pitches.test.js:216`, `:231`,
  `contextControls.test.js:421`). Do NOT move 4em into SCSS.

### B5 — cheap simplifications (🟡, no behavior change)

- **B5.1 — `src/edit.js:248`:** change `const onAddMeasure = (sectionIndex = working.sections.length
  - 1) => {` to `const onAddMeasure = (sectionIndex) => {`. Same-hunk cleanup (flagged by the
  spec-reviewer): fold the now-stale "default-to-last fallback" sentence out of the comment above
  (`:245-247`) — that comment currently reads "The Structure list passes an explicit `sectionIndex`;
  the default-to-last fallback covers a call with no target. The new measure is reachable via the
  Structure list, so the selection is left as-is." Rewrite to drop the middle "default-to-last
  fallback" clause (no caller relies on a default — the only caller `SectionPanel.js` and every test
  caller `SectionPanel.test.js:279`/`:289`, `Edit.test.js:503` pass an explicit `sectionIndex`),
  keeping the "explicit sectionIndex" and "selection left as-is" facts.
- **B5.2 — `src/editor/inspector/SectionPanel.js:109`:** replace the rest-destructure
  `const { tempo, timeSignature, rightHand, leftHand, ...keep } = section;` with a derivation from
  the existing `OVERRIDE_KEYS` (`:44`, already consumed by the projection loop at `:55`):
  ```js
  const keep = Object.fromEntries(
      Object.entries(section).filter(([key]) => !OVERRIDE_KEYS.includes(key)),
  );
  ```
  Leave the following `emitSection({ ...keep, ...next });` (`:110`) unchanged. Identical behavior
  (drops exactly the four `OVERRIDE_KEYS`, keeps `measures`/`name`/anything else); makes
  `OVERRIDE_KEYS` the single source for both the projection loop and the rebuild. Do NOT reuse
  `omitEmpty`/`omitFalsy` from `emit.js` (single-key set-or-delete reducers — wrong shape).

### Test strategy & gating (consolidated)

- **B1:** gated by the **real e2e run** (procedure above), which simultaneously verifies the B4
  e2e edits (same suite). Pass/fail reported truthfully; STOP-and-report-blocker path documented.
- **B2, B3, B5:** gated by `npm run test:unit` + `npm run build`. Comment-only (B2/B3) and
  no-behavior-change (B5); no snapshot tests exist anywhere in `src/`/`specs/`, so nothing trips.
  B5.2 has no direct-shape assertion (`SectionPanel.test.js` exercises `emitOverrides` by behavior).
- **B4 source side:** gated by `npm run test:unit` + `npm run build`; **B4 e2e side:** the helper +
  two keyboard-test edits are verified by the B1 e2e run (all in `specs/editor.spec.js`).

### Spec deviations recorded by this design (no requirement changed)

1. **AC-B4-b is factually wrong** ("manual expand steps idempotent against already-expanded rows").
   `expandRow` toggles (collapses) an open row; it is not idempotent. The design corrects this with
   the idempotent-helper rewrite and documents the true behavior.
2. **The spec's B4 e2e impact under-counted.** It named only `:469`; the real blast radius is 8
   tests (`:469`, `:530`, `:676`, `:1294`, `:1331`, `:1361`, `:1504`, `:1535`), including `:1294`
   which does not use `expandRow` at all but hard-asserts the collapsed-seed premise. The design
   enumerates and remedies all of them. This is a test-impact correction, not a requirement change —
   B4's source change (the two-key unconditional seed) is implemented exactly as specified.
