# Spec research — Review 11 (editor-UI, PR #22)

Iterative Q&A between the spec-analyst and the spec-researcher (`researcher-r11`) to turn
the review-11 intent into testable requirements + acceptance criteria for findings B1–B5.

Scope (from `0-prompt/prompt.md`): one 🔴 blocking finding (B1) + four 🟡 worth-doing
findings (B2–B5). The 🟢 nice-to-haves are EXCLUDED and the ⛔ rejections are validated
decisions left untouched.

The coordinates below are re-confirmed against the live worktree tree (branch
`worktree-8-editor-ui`) at run start, not copied from the intent — they shift as fixes land.

---

## Findings under spec (summary of intent)

- **B1 (🔴 blocking, CI-breaking):** Two Playwright e2e tests in `specs/editor.spec.js` still
  click an `{ name: "OK" }` confirm button for section-remove that review 10 deleted (removes
  are now immediate, undo-reversible). Delete the OK-click steps, rewrite the `:1191`
  "confirms via a real dialog" test to assert the IMMEDIATE remove, scrub the false comments.
  **Verification is special: the e2e suite must actually RUN green, not merely edited to match.**
- **B2 (🟡):** Stale SCSS prose in `editor.scss` (the "on-canvas add affordances" language).
  Comment-only, no behavior change.
- **B3 (🟡):** Fix the misleading SCSS comment at `editor.scss:21-27` (`:first-child` is NOT the
  "SelectControl + NumberControl pair"; the row has three children so it is only the leading
  control). KEEP the inline `style={{ minWidth: "4em" }}` (moving 4em to SCSS breaks 3 unit tests).
- **B4 (🟡):** First-run discoverability — on a fresh block the first note is two chevron-expands
  deep. Auto-expand the seeded section + measure (the lighter option) vs. a "Start a song" CTA.
- **B5 (🟡):** Two cheap simplifications: drop the dead default arg at `edit.js:248`; derive the
  `keep` destructure in `SectionPanel.js:109` from the existing `OVERRIDE_KEYS` array.

---

## Q&A log

(Running record of questions to `researcher-r11` and the confirmed answers, below.)

### Round 1 — B1 (blocking e2e drift) + e2e-execution feasibility

**Question (to researcher):** Re-confirm against the live file every section-remove `OK` click and
every stale ConfirmDialog comment in `specs/editor.spec.js`; confirm no third drifted test exists;
specify the cleanest rewrite of the `:1191` test (assert the IMMEDIATE remove via polling
`sections.length`); and — load-bearing — establish whether `npm run test:e2e` can actually be RUN
green in this worktree (wp-env harness, ports, alternate-port recipe), since review 10's silent
e2e-skip is exactly what let B1 ship.

**Answer (confirmed against live tree):**

*No ConfirmDialog in src.* A repo grep finds NO `ConfirmDialog`/`__experimentalConfirmDialog`
anywhere under `src/` — the code path removes sections immediately (undo-reversible). So the e2e
tests are the only drift.

*Drift site 1 — the measure/section "Add before / Add after" test.* In `specs/editor.spec.js`:
- Stale comment at `:664` ("the section-row remove is gated behind a ConfirmDialog … click 'OK' to
  confirm").
- The OK-click is `:665-670` (`editor.canvas.getByRole("button", { name: "OK", exact: true }).click()`,
  reached after the `openRowAction(… "Section 3", "Remove")` click).
- The poll `sections.length` → `2` follows at `:671-673`.
- **Fix:** delete the OK-click block (`:665-670`) and rewrite the stale comment at `:663-664`; KEEP
  the `openRowAction(… "Remove")` click and the trailing poll. The poll already proves the section
  is gone, so with the OK-click removed it asserts the immediate remove correctly.

*Drift site 2 — the dedicated "confirms via a real dialog" test.* In `specs/editor.spec.js`:
- Test declared at `:1191`: `"the Section panel Remove section button confirms via a real dialog
  before removing"`.
- False comment block `:1185-1190` ("now opens a real `__experimentalConfirmDialog` … confirms the
  real dialog") and the inline stale comment at `:1225` ("it opens the real ConfirmDialog").
- The "Remove section" panel-button click is `:1226-1228`.
- The OK-click is `:1230-1232` (`page.getByRole("button", { name: "OK" }).click()`).
- The poll `sections.length` → `1` follows at `:1235-1237`.
- **Fix:** rename the test away from "confirms via a real dialog"; delete the OK-click (`:1230-1232`)
  and rewrite the `:1185-1190` header comment + `:1225` inline comment; KEEP the "Remove section"
  click and the poll (which already asserts the 2 → 1 drop, i.e. the immediate remove). Helper names
  used by the test (all exist): `storedSongObject`, `seedSongViaJson`, `switchToVisualMode`,
  `openSettingsSidebar`, `assertStructureTreeOpen`, `treeRow`, `inspectorPanel`.

*No third drifted test.* Grep across the repo for `"OK"` / `ConfirmDialog` / `confirm` tied to a
section/measure remove finds only these two sites. The `name: "OK"` click appears in the whole spec
ONLY at `:669` and `:1232`. Stale dialog comments are at `:664`, `:1186`, `:1188`, `:1191` (the test
name itself), `:1225`, `:1230`. Other `confirm`/`OK` hits in the file are unrelated (button
aria-labels, JSON-repopulate prose, an expansion-key string) and stay untouched. The **measure**
remove path already tests the immediate behavior (`:646-661`: `openRowAction(… "Remove")` → poll
`measures.length` → `2`, no dialog), so only the two **section** removes carry the dead OK-click.

**Finalized B1 rewrites (confirmed shapes):**

*Site 1 — the "Add before / Add after" test (around `:663-673`).* Delete the OK-click (`:668-670`);
rewrite the stale comment; keep the `openRowAction("Actions for Section 3", "Remove")` click and the
poll. Resulting block:
```
// Remove the third (empty) section from its actions menu → removed immediately
// (no confirm dialog; removes are immediate and undo-reversible).
await (
    await openRowAction(editor, "Actions for Section 3", "Remove")
).click();
await expect
    .poll(async () => (await storedSongObject(editor)).sections.length)
    .toBe(2);
```

*Site 2 — the dedicated section-remove test (`:1191`).* Confirmed test **rename**:
`"the Section panel Remove section button removes the section immediately"`. The body's poll already
runs AFTER the OK-click, so deleting only the OK-click (`:1230-1232`) leaves a correct
immediate-remove assertion. Rewrite the header comment (`:1185-1190`) and the inline comment
(`:1225`) to state the immediate/undo-reversible behavior. Resulting tail of the body:
```
// Click the panel's "Remove section" button — the section is removed immediately.
await sidebar
    .getByRole("button", { name: "Remove section", exact: true })
    .click();

// The section is removed immediately: sections.length drops from 2 to 1.
await expect
    .poll(async () => (await storedSongObject(editor)).sections.length)
    .toBe(1);
```
The `page` fixture parameter (`:1193`) STAYS — it is still used by `openSettingsSidebar(editor, page)`
at `:1220`, so removing it would break the test. All seven helpers the test uses exist with the exact
names (`storedSongObject`, `seedSongViaJson`, `switchToVisualMode`, `openSettingsSidebar`,
`assertStructureTreeOpen`, `treeRow`, `inspectorPanel`, plus `openRowAction`).

**e2e EXECUTION constraint (load-bearing — the whole point of B1):**
- `package.json:15` `test:e2e` = `wp-scripts test-playwright`; `build` = `wp-scripts build` (`:12`);
  `env:start` = `wp-env start` (`:16`).
- `playwright.config.js` extends the `@wordpress/scripts` base config. `baseURL` comes from
  `WP_BASE_URL`, defaulting to `http://localhost:8889`. The base config's `webServer` runs
  `npm run wp-env start` with `reuseExistingServer: true`, keyed on the baseURL port.
- `.wp-env.json` = `{ core: null, phpVersion: "8.3", plugins: ["."] }` — no `port`/`testsPort`, so
  it uses the defaults **8888 (dev) / 8889 (tests)**. No `.wp-env.override.json` exists.
- **The default ports are OCCUPIED.** `docker ps` shows a running wp-env instance
  (`wp-env-piano-block-803b0016`) mapping wordpress → 8888 and tests-wordpress → 8889. Its bind mount
  (docker-compose.yml) points at the **MAIN repo** path, NOT this worktree. The worktree's own wp-env
  is NOT started. **This is the exact review-10 gap.**
- **Feasible via alternate ports.** wp-env honors `WP_ENV_PORT` and `WP_ENV_TESTS_PORT` env overrides
  (documented in `node_modules/@wordpress/env/README.md`); the env vars beat `.wp-env.json`. Recipe
  for the code phase:
  1. `npm run build` (e2e runs against the built block).
  2. Start the worktree's wp-env on free ports, e.g.
     `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:start`.
  3. Run the suite against the worktree's tests site:
     `WP_BASE_URL=http://localhost:8891 npm run test:e2e`
     (baseURL → the tests port 8891; `reuseExistingServer: true` reuses the just-started container).
  4. Verify GREEN. "Tests edited to match" is NOT "tests pass."
- If, after genuine effort, the suite still cannot run, the code phase MUST stop and report the
  blocker explicitly — it must NOT silently skip (the review-10 failure mode).

### Pre-grounded evidence for B2–B5 (researcher confirmed up front)

**B2 (stale SCSS prose, comment-only).** File is `src/editor.scss` (note: NOT under `src/editor/`).
Stale prose at `:6-8` ("on-canvas add affordances sit beside it") and `:106-107` ("The canvas
display wrapper: the SVG host plus the add affordances"). The `__add-note` / `__add-measure` /
`__canvas-actions` hook classes are referenced ONLY in
`src/editor/__tests__/SongCanvas.test.js:172,175,178` as a NEGATIVE guard (asserting they are
absent) — so the comments are stale prose, not dead code. No behavior change; no test impact.
*(Scoping note: `src/editor/selection.js:130` mentions an "add-note target" but that is a different,
valid reference — mapping a click back to core's `data-measure`. B2 does NOT touch `selection.js`.)*

**B3 (misleading SCSS comment; keep the inline style).** The list-row has THREE children:
`HandConfigEditor.js:167` (SelectControl), `:178` (NumberControl), `:196` (trash Button). So
`> :first-child` targets the SelectControl ALONE, not a "SelectControl + NumberControl pair." The
misleading comment is at `src/editor.scss:20-21` (the `> :first-child` rationale line that reads
"… / the SelectControl+NumberControl pair in HandConfig"). Comment-only fix.
- That SCSS rule sets `min-width: 8em` (`editor.scss:28-31`), which is DISTINCT from the inline
  `style={{ minWidth: "4em" }}` in JS (`HandConfigEditor.js:193`, `PitchEditor.js:79`,
  `PitchEditor.js:91`). KEEP the inline 4em — three unit tests assert it: `pitches.test.js:216`,
  `pitches.test.js:231`, `contextControls.test.js:421`. Do NOT move 4em into SCSS.
- Additional structural fact (analyst-verified): `PitchEditor` and `AnnotationEditor` both return
  React Fragments (`<>…</>`), so their controls flatten into the parent `HStack`. Thus across all
  three list-row users (`PitchList`, `AnnotationList`, `HandConfigEditor`) `:first-child` is always a
  single leading control — never a pair. The corrected comment should describe `:first-child` as the
  row's single leading control (e.g. the leading SelectControl), with min-width keeping it from
  collapsing at narrow inspector widths.

**B4 (first-run discoverability).** `src/edit.js`. The empty-song seed is the `useMemo` at
`:132-138` (`song.trim() === "" ? { data: newSong(), errors: [] } : parseAndValidate(song)`);
`newSong()` is defined at `src/editor/songModel.js:232` → `{ sections: [newSection()] }` →
`newSection()` = `{ measures: [newMeasure()] }`. The expansion state starts EMPTY:
`src/edit.js:100` `const [expanded, setExpanded] = useState(() => new Set())`, so on a fresh block
the seeded section and measure are collapsed and the first note sits two chevron-expands deep. The
`expansionKey` helper (`selection.js:40`) yields `s0` for the section and `s0m0` for the first
measure. `revealAncestors` (`edit.js:125-126`) is the existing "add keys to the Set" helper.
- **Approach decision (auto-expand = smaller / lower-risk):** seed the initial expanded Set with the
  seeded section+measure keys for the empty-song case, instead of adding a "Start a song" CTA (which
  would be net-new UI). Exact seed shape to be pinned in round 2.

**B5 (cheap simplifications).**
- Dead default arg: `src/edit.js:248` `const onAddMeasure = (sectionIndex = working.sections.length - 1)`.
  The ONLY caller is `SectionPanel.js:141` `onClick={() => onAddMeasure?.(sectionIndex)}`, which
  ALWAYS passes an explicit `sectionIndex`, so the default is never reached. (`onAddMeasureBefore` /
  `onAddMeasureAfter` are separate functions near `edit.js:450-452`.) Drop the `= …` default.
- Single-source destructure: `SectionPanel.js:109`
  `const { tempo, timeSignature, rightHand, leftHand, ...keep } = section;` repeats the key list that
  already exists as `OVERRIDE_KEYS = ["tempo", "timeSignature", "rightHand", "leftHand"]`
  (`SectionPanel.js:44`, already consumed by the loop at `:55`). Derive `keep` from `OVERRIDE_KEYS`
  so there is one source of truth; behavior unchanged.

### Round 2 — B1 test rename + regression guard, B4 seed shape, B5 idiom, snapshot/test impact

**Question (to researcher):** Pin (Q3) the exact B1 test rename + whether to add a negative
dialog-regression guard; (Q4) the exact B4 auto-expand seed shape, scope, and what the author
actually reaches; (Q5) the exact `keep` derivation line; (Q6) any snapshot or `onAddMeasure`
no-arg test impact.

**Answers (confirmed against live tree):**

*Q3 — B1 rename + regression guard.* Sibling test names in `specs/editor.spec.js` are lowercase,
present-tense, behavior-describing (e.g. `:792` "renaming a section through its panel relabels its
structure-tree row"; `:912` "a sidebar edit is reflected in the stored song"). The confirmed rename
fits that cadence: **"the Section panel Remove section button removes the section immediately"**.
- **Add ONE negative regression guard, to the `:1191` test only** (it is the canonical "S7
  real-component proof" anchor for the Section-panel remove). After the "Remove section" click and
  BEFORE the poll, assert the dialog button does not exist:
  ```
  // No confirm dialog: the remove is immediate. A re-added ConfirmDialog would
  // surface an "OK" button here and re-break this test.
  await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);
  ```
  Use `toHaveCount(0)` (must not exist), page-scoped (matching the old OK locator scope). This makes
  a future re-added dialog re-break the suite loudly — the whole point of B1.
- **Site 1 (`:663` region) stays poll-only** — it is a broad "adds, removes and duplicates" flow, not
  the dialog-regression anchor; a second guard there is redundant. (Its poll is `sections.length` →
  `2` after removing section 3 of 3.)

*Q4 — B4 seed shape.*
- **Initializer (idiomatic, key-shape-safe):** replace `edit.js:100`'s `useState(() => new Set())`
  with
  ```
  useState(
      () =>
          new Set([
              expansionKey({ sectionIndex: 0 }),
              expansionKey({ sectionIndex: 0, measureIndex: 0 }),
          ]),
  )
  ```
  Use `expansionKey(...)` (already imported at `edit.js:24`, used at `:367`/`:448`) rather than literal
  `"s0"`/`"s0m0"` strings, so the two sides can never drift on key shape.
- **Scope: unconditional** (seed on every mount, not gated to the empty song). The `expanded` Set is
  membership-only; a key for a row that does not exist is inert (no row, no effect, no error path). On
  a saved multi-section song this merely pre-opens its first section + first measure — harmless and
  arguably nice. Gating to `song.trim() === ""` would force the once-run initializer to close over
  `song` for no real risk reduction. Recommendation: unconditional.
- **What the author reaches (accurate framing).** `newMeasure()` returns `{}` —
  the seeded measure is EMPTY (no hand, no note). But `StructureTree` renders BOTH hand-group rows for
  every measure unconditionally (`StructureTree.js:481` `HANDS.forEach`, with `events = []` for an
  empty measure), and each hand-group row's actions cell holds a direct "Add note to <hand>…" Button.
  So after auto-expanding `s0` + `s0m0`, the author sees: Section 1 → Measure 1 → [Right hand row, Left
  hand row], each with a visible "Add note" button — the real first-note entry point for an empty
  measure. The existing e2e at `:469` ("the seeded empty measure adds its first note from the
  structure tree") documents the two manual chevron-expands (expand Section 1, expand Measure 1) that
  B4 removes. So B4's accurate goal: **make the first measure's "Add note" buttons visible on first
  render without the two manual chevron-expands.** Exactly TWO keys are required (`s0` + `s0m0`);
  expanding only the section is not enough, and the hand rows themselves need NOT be expanded (their
  Add-note button sits on the hand ROW, visible once the measure is expanded).

*Q5 — B5 `keep` derivation.* No existing key-LIST omit util (`omitEmpty`/`omitFalsy` in `emit.js` are
single-key set-or-delete reducers — wrong shape, do not reuse). Exact replacement at
`SectionPanel.js:109` (inside `emitOverrides`):
```
const keep = Object.fromEntries(
    Object.entries(section).filter(([key]) => !OVERRIDE_KEYS.includes(key)),
);
```
The following `emitSection({ ...keep, ...next })` line is unchanged. Behavior is identical to the
rest-destructure (drops exactly the four `OVERRIDE_KEYS`, keeps `measures` + `name` + anything else;
key order is equivalent and irrelevant under the subsequent spread). This makes `OVERRIDE_KEYS` the
single source shared by both the projection loop (`:55`) and the rebuild.

*Q6 — snapshot / test impact.*
- **No snapshot tests anywhere.** `toMatchSnapshot`/`toMatchInlineSnapshot` grep across `src/` +
  `specs/` = zero hits; no `__snapshots__` dirs; no CSS/SCSS snapshot. So B2/B3 comment-only edits trip
  nothing.
- **No no-arg `onAddMeasure` caller.** Every caller passes an explicit `sectionIndex`
  (`SectionPanel.js:141`; tests `SectionPanel.test.js:279`,`:289`, `Edit.test.js:503`). Dropping the
  default arg at `edit.js:248` breaks nothing.
- **B5 `keep` change has no direct-shape assertion** — `SectionPanel.test.js` exercises
  `emitOverrides` by behavior (override set/unset), which is unchanged.
- **Net:** B2, B3, B5 all carry zero behavior/test breakage; they remain gated by the standard
  `npm run test:unit` + `npm run build`.

---

## Consolidated requirements + acceptance criteria

### B1 — Fix the CI-breaking section-remove e2e drift (🔴 blocking)

**Requirement.** Bring the two Playwright e2e tests in `specs/editor.spec.js` back in line with the
shipped behavior (section removes are immediate and undo-reversible; there is no confirm dialog), and
verify by ACTUALLY RUNNING the e2e suite green.

- B1.1 Delete the section-remove "click OK" step in the "Add before / Add after" test (the
  `editor.canvas.getByRole("button", { name: "OK", exact: true }).click()` block, currently
  `:668-670`). Keep the `openRowAction("Actions for Section 3", "Remove")` click and the trailing
  `sections.length` → `2` poll. Rewrite the stale comment (currently `:663-664`) to state the
  immediate/undo-reversible behavior.
- B1.2 In the dedicated section-remove test (currently `:1191`): rename it to
  **"the Section panel Remove section button removes the section immediately"**; delete the OK-click
  block (currently `:1230-1232`); rewrite the header comment (`:1185-1190`) and the inline comment
  (`:1225`) to the immediate/undo-reversible story; keep the "Remove section" click and the
  `sections.length` → `1` poll; keep the `page` fixture parameter (still used by
  `openSettingsSidebar`).
- B1.3 Add ONE negative regression guard in the renamed `:1191` test, after the "Remove section"
  click and before the poll: `await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);`
  (asserts no confirm dialog exists, so a re-added dialog re-breaks this test).
- B1.4 Do NOT re-introduce a `ConfirmDialog`/`__experimentalConfirmDialog` anywhere; do not touch the
  measure-remove tests (they already assert the immediate path) or any unrelated `confirm`/`OK`
  references in the file.

**Acceptance criteria.**
- AC-B1-a No `name: "OK"` section-remove click and no stale ConfirmDialog/"real dialog" comment remain
  in `specs/editor.spec.js` (the two clicks at `:669`/`:1232` and the six stale comments at
  `:664`/`:1186`/`:1188`/`:1191`/`:1225`/`:1230` are gone or rewritten).
- AC-B1-b The renamed `:1191` test contains the `toHaveCount(0)` no-dialog guard.
- AC-B1-c **`npm run test:e2e` is actually RUN and passes GREEN** (the section-remove tests included),
  using the worktree's own wp-env on free ports. Recipe (from the worktree root):
  1. `npm run build`
  2. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:start`
  3. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 WP_BASE_URL=http://localhost:8891 npm run test:e2e`
  4. (cleanup) `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:stop`
  The code phase MUST report the real pass/fail result. "Tests edited to match" is NOT acceptance.
- AC-B1-d If — after genuine effort — the e2e suite cannot be executed in-environment, the code phase
  STOPS and reports that explicitly as a blocker (no silent skip). On current evidence (docker up,
  wp-env 11.7.0 present, ports 8890/8891 free, env-var port override works) this path is not expected.

### B2 — Delete stale SCSS prose (🟡, comment-only)

**Requirement.** Remove the "on-canvas add affordances" language from `src/editor.scss` (the
affordances now live in the tree + Note panel).

- B2.1 Rewrite the file-header comment so the stale "on-canvas add affordances sit beside it" clause
  (currently `:6-8`) no longer claims canvas-side add affordances.
- B2.2 Rewrite the `&__canvas` block comment (currently `:106-107`) so "the SVG host plus the add
  affordances" no longer references nonexistent canvas add affordances.
- B2.3 Do not touch `src/editor/selection.js` (its "add-note target" line is a valid, unrelated
  reference). No selector/rule/behavior change.

**Acceptance criteria.**
- AC-B2-a `src/editor.scss` no longer describes any on-canvas add affordances; the comments reflect
  that adds live in the structure tree + inspector.
- AC-B2-b No SCSS rule/selector changes; `npm run build` succeeds; no test references break (the
  negative-guard test in `SongCanvas.test.js` is unaffected — it tests the absence of the classes,
  which is unchanged).

### B3 — Fix the misleading `:first-child` SCSS comment; keep the inline minWidth (🟡, comment-only)

**Requirement.** Correct the `> :first-child` rationale comment in `src/editor.scss` (currently
`:20-21`) so it no longer claims `:first-child` is "the SelectControl + NumberControl pair." The row
has three children (and `PitchEditor`/`AnnotationEditor` render Fragments that flatten in), so
`:first-child` is only the single leading control.

- B3.1 Rewrite the comment to describe `:first-child` as the row's single leading control (the
  leading `SelectControl`, or the leading control of the editor fragment), kept from collapsing by the
  `min-width`.
- B3.2 KEEP the inline `style={{ minWidth: "4em" }}` at `HandConfigEditor.js:193`, `PitchEditor.js:79`,
  `PitchEditor.js:91`. Do NOT move `4em` into SCSS (three unit tests assert
  `style.minWidth === "4em"`). Do not change the SCSS `min-width: 8em` rule value.

**Acceptance criteria.**
- AC-B3-a The `:first-child` comment in `src/editor.scss` accurately describes a single leading
  control, not a "SelectControl + NumberControl pair."
- AC-B3-b The inline `minWidth: "4em"` styles are untouched; `pitches.test.js` and
  `contextControls.test.js` (the three `minWidth === "4em"` assertions) still pass; `npm run build`
  succeeds.

### B4 — First-run discoverability: auto-expand the seeded section + measure (🟡)

**Requirement.** On render, pre-expand the first section and its first measure so the first measure's
"Add note" buttons are reachable without two manual chevron-expands.

- B4.1 Change the expansion state initializer at `src/edit.js:100` to seed the Set with exactly the
  first section key and first measure key, using `expansionKey`:
  `new Set([ expansionKey({ sectionIndex: 0 }), expansionKey({ sectionIndex: 0, measureIndex: 0 }) ])`.
- B4.2 Seed unconditionally (do not gate on the empty-song case); inert keys for nonexistent rows are
  harmless.
- B4.3 Do not add a "Start a song" CTA or any net-new UI; this is the lighter, lower-risk option.

**Acceptance criteria.**
- AC-B4-a On a freshly inserted block, the structure tree shows Section 1 and Measure 1 expanded, with
  the Right hand / Left hand rows and their "Add note" buttons visible without any manual expand.
- AC-B4-b Existing tree interactions (toggle/collapse, the add/duplicate auto-reveal, focus
  management) are unchanged; `npm run test:unit` + `npm run build` pass. (The code phase should
  re-confirm the e2e flow at `:469` still passes — it expands rows that may already be expanded, which
  is idempotent — as part of the B1 e2e run.)

### B5 — Cheap simplifications (🟡, no behavior change)

**Requirement.** Two single-source/dead-code cleanups with no behavior change.

- B5.1 Drop the dead default parameter at `src/edit.js:248`: change
  `const onAddMeasure = (sectionIndex = working.sections.length - 1) => {` to
  `const onAddMeasure = (sectionIndex) => {` (every caller passes an explicit `sectionIndex`).
- B5.2 At `SectionPanel.js:109`, derive `keep` from `OVERRIDE_KEYS` instead of repeating the key list:
  ```
  const keep = Object.fromEntries(
      Object.entries(section).filter(([key]) => !OVERRIDE_KEYS.includes(key)),
  );
  ```
  Leave the following `emitSection({ ...keep, ...next })` unchanged.

**Acceptance criteria.**
- AC-B5-a `edit.js:248` has no default for `sectionIndex`; all existing `onAddMeasure` callers/tests
  pass.
- AC-B5-b `SectionPanel.js` `emitOverrides` derives `keep` from `OVERRIDE_KEYS`; override set/unset
  behavior is unchanged and `SectionPanel.test.js` passes.
- AC-B5-c `npm run test:unit` + `npm run build` pass (no snapshot tests exist to trip).

### Cross-cutting constraints (carried from the intent)

- Editor-side only: the song format/schema, `render.php`, and front-end SVG rendering are unchanged; a
  published song renders byte-identically. (B1 is test-only; B2/B3 are comment-only; B4/B5 are small
  editor-side changes.)
- Use only `@wordpress/*` packages already available; no new dependencies.
- Preserve prior-review wins (real `TreeGrid` keyboard model + a11y parity, immediate/undo-reversible
  deletes — B1 must NOT reintroduce a confirm dialog, monotonic `focusRequest` focus, inline
  `minWidth` row floors — B3 keeps them, depth-fixed `setXAt` helpers, `omitEmpty`/`omitFalsy`,
  raw-JSON mode).
- The 🟢 nice-to-haves are out of scope this run; the ⛔ rejections (resetAll-via-omitEmpty,
  breadcrumb/move mismatch, disabling boundary removes) are validated decisions and are NOT touched.
