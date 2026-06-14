# Code Plan — Review 11: section-remove e2e drift fix, stale-SCSS cleanup, first-run discoverability, and cheap simplifications

Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Branch `worktree-8-editor-ui`.

This plan is derived from `1-spec/spec.md` and `2-design-doc/design-doc.md`, confirmed against the live code on the branch. It covers exactly the five findings B1–B5 — no more, no less. It designs nothing for the out-of-scope nice-to-haves (#36 mutator refactor, `speak()`, move up/down, octave-less labels, cosmetic token swaps) or the validated rejections (`omitEmpty` for `resetAll`, breadcrumb/move-button "mismatch", boundary-remove disabling). It does NOT re-add any section-remove confirm dialog and does NOT move the inline `minWidth: "4em"` into SCSS.

## Coordinate convention

All line numbers below are **evidence / starting points, not frozen coordinates** — they shift as edits land. Each task instructs the implementer to re-confirm the site by reading/grepping the live file before editing. `SectionPanel.js` lives at `src/editor/inspector/SectionPanel.js`.

## Files touched

| File | Task(s) | Nature |
| --- | --- | --- |
| `src/editor.scss` | T1 (B2), T2 (B3) | comment-only |
| `src/edit.js` | T3 (B4 seed), T7 (B5.1) | code |
| `src/editor/inspector/SectionPanel.js` | T8 (B5.2) | code |
| `specs/editor.spec.js` | T4 (B1), T5 (B4 Hazard A), T6 (B4 Hazard B) | test edits |
| — (verification gate) | T9 (build + unit), T10 (e2e run, BLOCKING) | run-only |

## Task ordering rationale

T1–T8 are the source/test edits, grouped by file and concern so they can be done in any order relative to each other (they touch disjoint regions). T9 (unit + build) and T10 (the load-bearing e2e run) come last and gate everything. The two e2e-edit tasks for B4 (T5, T6) and the B1 e2e-edit task (T4) all land in `specs/editor.spec.js`; they are independent edits to that one file and are all verified by the single T10 run. T3 (the B4 source seed) MUST land before T10 because it is what makes T5/T6's reconciliations necessary and correct.

---

## T1 — B2: delete stale on-canvas "add affordances" SCSS prose (comment-only)

**Goal.** Remove the language in `src/editor.scss` that claims on-canvas add affordances exist; the adds now live in the structure tree + Note panel. No selector/rule/behavior change.

**Files.**
- `src/editor.scss` (file-header comment, currently `:6-8`; `&__canvas` block comment, currently `:106-107`).

**Changes.**
1. Re-grep the live file for the file-header comment. Rewrite it so the clause "on-canvas add affordances sit beside it" (currently inside `:6-9`) no longer claims canvas-side add affordances, while keeping the display/highlight facts and the `InspectorControls` sidebar facts. Current text: *"The sheet-music canvas displays the score and highlights the current selection (display + highlight only); on-canvas add affordances sit beside it; the song-level and selected-event settings live in the block's `InspectorControls` sidebar, which WordPress styles."* — drop the "on-canvas add affordances sit beside it" clause only.
2. Rewrite the `&__canvas` block comment (currently `:106-107`): "The canvas display wrapper: the SVG host plus the add affordances." → so it no longer references nonexistent canvas add affordances (e.g. "The canvas display wrapper: the SVG host."). **Keep** the load-bearing `min-width: 0` rationale that immediately follows (currently `:107-109`) verbatim — it explains why the canvas column can shrink inside the flex workspace.
3. Do NOT change any selector, rule, or value. Do NOT touch `src/editor/selection.js` (its `:130` "add-note target" reference is valid and unrelated — out of scope).

**Depends on.** None.

**Traces to.** B2 (B2.1, B2.2, B2.3); AC-B2-a, AC-B2-b. Design §3.

**Acceptance.**
- No prose in `src/editor.scss` describes any on-canvas add affordance; comments reflect that adds live in the structure tree + inspector.
- No SCSS rule/selector/value changed (diff is comments only).
- `src/editor/selection.js` untouched.
- Gated by T9 (`npm run build` succeeds; the `SongCanvas.test.js` negative guard — which asserts the `__add-note`/`__add-measure`/`__canvas-actions` hook classes are ABSENT — is unaffected because those classes remain absent).

---

## T2 — B3: fix the misleading `:first-child` SCSS rationale; keep inline 4em (comment-only on SCSS)

**Goal.** Correct the `> :first-child` rationale comment in `src/editor.scss` so it describes a single leading control, not a "SelectControl + NumberControl pair." Keep the SCSS `min-width: 8em` value and the inline `minWidth: "4em"` JS styles untouched.

**Files.**
- `src/editor.scss` (the `> :first-child` rationale comment, currently `:20-27`).

**Changes.**
1. Re-grep the live file for the `> :first-child` rationale block. Rewrite the description (currently `:21-27`, which reads "the leading leaf editor (PitchEditor / AnnotationEditor / the SelectControl+NumberControl pair in HandConfig)") so it describes `:first-child` as the row's **single leading control** — e.g. the leading `SelectControl`, or the leading control of the editor Fragment. Rationale to encode (do not put requirement IDs in the comment): the list-row has three children (in `HandConfigEditor.js` a `SelectControl`, a `NumberControl`, and a trailing trash `Button`); `PitchEditor`/`AnnotationEditor` return React Fragments that flatten their controls into the parent `HStack`; so across all three list-row users (`PitchList`, `AnnotationList`, `HandConfigEditor`) `:first-child` is always a single leading control, never a pair. Keep the `min-width` "keeps it from shrinking to zero at narrow inspector widths" intent and the 8em-matches-SelectControl-floor reasoning.
2. Do NOT change the SCSS `min-width: 8em` rule value (currently `:30`) — it is distinct from the inline 4em and no unit test depends on it changing.
3. Do NOT touch the inline `style={{ minWidth: "4em" }}` at `HandConfigEditor.js:193`, `PitchEditor.js:79`, `PitchEditor.js:91`. Do NOT move `4em` into SCSS.

**Depends on.** None. (Disjoint region from T1, but same file — apply both edits cleanly.)

**Traces to.** B3 (B3.1, B3.2); AC-B3-a, AC-B3-b. Design §4.

**Acceptance.**
- The `:first-child` comment accurately describes a single leading control; no "pair" claim remains.
- `min-width: 8em` value unchanged; no rule/selector change.
- Inline `minWidth: "4em"` styles untouched.
- Gated by T9: the three `minWidth === "4em"` assertions (`pitches.test.js:216`, `pitches.test.js:231`, `contextControls.test.js:421`) still pass; `npm run build` succeeds.

---

## T3 — B4 source: auto-expand the seeded first section + first measure (`src/edit.js`)

**Goal.** On mount, seed the expansion Set with exactly the first section key and the first measure key, so a freshly inserted block shows Section 1 + Measure 1 expanded and the per-hand "Add note" buttons are reachable without two manual chevron-expands.

**Files.**
- `src/edit.js` (expansion-state initializer, currently `:100`).

**Changes.**
1. Re-grep the live file for `useState(() => new Set())` (currently `:100`). Confirm `expansionKey` is imported (currently `:24`). Replace the initializer with the **two-key unconditional seed**:
   ```js
   const [expanded, setExpanded] = useState(
       () =>
           new Set([
               expansionKey({ sectionIndex: 0 }),
               expansionKey({ sectionIndex: 0, measureIndex: 0 }),
           ]),
   );
   ```
2. Use `expansionKey(...)` — NOT literal `"s0"`/`"s0m0"` strings — so the seed and the toggle/lookup logic cannot drift on key shape.
3. Seed **exactly these two keys**. Do NOT seed the hand key (`s0m0rightHand`): the "Add note" button sits on the hand row, visible once the measure is expanded.
4. Seed **unconditionally** — do NOT gate on `song.trim() === ""`. The Set is membership-only; an inert key for a nonexistent row is harmless, and gating would force the once-run initializer to close over `song`.
5. Do NOT add a "Start a song" CTA or any net-new UI. Touch no toggle/collapse/auto-reveal/focus logic — only the initial Set membership.

**Depends on.** None (source change). Must land before T10 (the e2e run) so T4/T5/T6's reconciliations are exercised against the real seeded behavior.

**Traces to.** B4 (B4.1, B4.2, B4.3); AC-B4-a, AC-B4-b (source side). Design §5.2, §5.5.

**Acceptance.**
- The initializer seeds exactly `expansionKey({ sectionIndex: 0 })` and `expansionKey({ sectionIndex: 0, measureIndex: 0 })`, unconditionally, via the helper.
- No toggle/collapse/auto-reveal/focus logic changed.
- Gated by T9 (`npm run test:unit` + `npm run build` pass — unit tests drive expansion explicitly and none asserts initial membership) and by T10 for the on-canvas behavior (`AC-B4-a`).

---

## T4 — B1: fix the two section-remove e2e drift sites in `specs/editor.spec.js` (BLOCKING, test-only edits)

**Goal.** Bring the two Playwright e2e tests back in line with shipped behavior — section removes are immediate and undo-reversible, no confirm dialog — by deleting the two stale "click OK" steps, rewriting the stale comments, renaming the dedicated test, and adding the page-scoped no-dialog regression guard. (Running the suite green is T10.)

**Files.**
- `specs/editor.spec.js` (drift site 1, currently `:663-673`; drift site 2, currently `:1185-1238`).

**Changes.**

*Drift site 1 — the "Add before / Add after" flow test (currently `:663-673`):*
1. Re-grep for the only-two `name: "OK"` clicks (currently `:669`, `:1232`). Delete the OK-click block at drift site 1 (currently `:668-670`):
   ```js
   await editor.canvas
       .getByRole("button", { name: "OK", exact: true })
       .click();
   ```
2. Keep the `openRowAction(editor, "Actions for Section 3", "Remove")` click and the trailing `sections.length` → `2` poll.
3. Rewrite the stale comment (currently `:663-664`, which claims the remove "is gated behind a ConfirmDialog … click OK to confirm") to the immediate/undo-reversible story. Intended resulting block:
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
4. Drift site 1 stays **poll-only** — do NOT add a no-dialog guard here (redundant with site 2's guard).

*Drift site 2 — the dedicated section-remove test (currently `:1185-1238`):*
5. Rename the test (currently `:1191`) from `"the Section panel Remove section button confirms via a real dialog before removing"` to `"the Section panel Remove section button removes the section immediately"`.
6. Delete the OK-click block (currently `:1230-1232`): `await page.getByRole("button", { name: "OK" }).click();`
7. Rewrite the false header comment block (currently `:1185-1190`, describing a `__experimentalConfirmDialog`) and the inline stale comment (currently `:1225`, "it opens the real ConfirmDialog") to the immediate/undo-reversible story.
8. **Keep** the "Remove section" panel-button click and the `sections.length` → `1` poll. **Keep** the `page` fixture parameter (currently `:1193`) — it is still used by `openSettingsSidebar(editor, page)` (currently `:1220`).
9. **Add the negative regression guard** AFTER the "Remove section" click and BEFORE the poll, page-scoped:
   ```js
   // No confirm dialog: the remove is immediate. A re-added ConfirmDialog would
   // surface an "OK" button here and re-break this test.
   await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);
   ```
   Intended resulting tail:
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

*Do-not-regress:*
10. Do NOT re-introduce a `ConfirmDialog` / `__experimentalConfirmDialog` anywhere (code or tests). Do NOT touch the measure-remove tests (currently `:646-661`, already asserting immediate behavior with no dialog). Do NOT touch any other `confirm`/`OK` reference in the file (button aria-labels, JSON-repopulate prose, an expansion-key string). After this task the two deleted clicks must be the only `name: "OK"` clicks removed.

**Depends on.** None (test-only). Verified by T10.

**Traces to.** B1 (B1.1, B1.2, B1.3, B1.4); AC-B1-a, AC-B1-b. Design §2.1, §2.2, §2.3.

**Acceptance.**
- No `name: "OK"` section-remove click and no stale ConfirmDialog/"real dialog" comment remain; the two clicks deleted; the six stale comments (currently `:664`, `:1186`, `:1188`, the `:1191` test name, `:1225`, `:1230`) gone or rewritten to the immediate/undo-reversible story.
- The dedicated test is renamed to "the Section panel Remove section button removes the section immediately" and contains the page-scoped `toHaveCount(0)` no-dialog guard placed after the "Remove section" click and before the poll; its `page` param is retained.
- Gated by T10 (the section-remove tests run green).

---

## T5 — B4 Hazard A: make `expandRow` idempotent + two keyboard-test collapse inserts (`specs/editor.spec.js`)

**Goal.** Resolve the auto-expand collision between T3's seed and the blind `expandRow` chevron helper across the 8 affected drill-down/keyboard tests, with one idempotent helper rewrite (fixes 6) plus two raw-collapse inserts (the 2 keyboard tests that assert a collapsed-start premise).

**Files.**
- `specs/editor.spec.js` (`expandRow` helper, currently `:337-339`; keyboard test currently `:1294`; keyboard test currently `:1331`).

**Changes.**

*Prong 1 — idempotent `expandRow` (fixes `:469`, `:530`, `:676`, `:1361`, `:1504`, `:1535`):*
1. Re-grep for `async function expandRow` (currently `:337-339`). Rewrite it to read the row's `aria-expanded` and click the chevron **only when not already `"true"`**:
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
   The row locator mirrors `rowChevron`'s own resolution (`tr` + `.filter({ has: treeRow })`). This matches the helper's documented "Expand … revealing its children" intent.

*Prong 2 — two raw-collapse inserts for the keyboard expand/collapse tests:*
2. `:1294` (ArrowRight/Left on the **section** row, section→measures). Re-grep for the test and its `assertStructureTreeOpen` (currently `:1305`) and collapsed-premise assert (currently `:1307`/`:1313`). Insert AFTER `assertStructureTreeOpen` and BEFORE the collapsed-premise assert:
   ```js
   // edit.js seeds s0 expanded on mount; collapse it so this test can drive the
   // keyboard expand from a known-collapsed section row.
   await rowChevron(editor, "Section 1").click();
   ```
   Use the **raw `rowChevron(...).click()` toggle**, NOT `expandRow` (now idempotent expand-only → would no-op). After insert: section row visible ✓, `Measure 1` count-0 ✓; the ArrowRight-expand / ArrowLeft-collapse body unchanged. Do NOT drop the collapsed-start assert.
3. `:1331` (ArrowRight/Left on the **measure** row, measure→hands). Re-grep for the test and its existing `expandRow(editor, "Section 1")` (currently `:1342`) and the measure-row locator (currently `:1344`). The `expandRow("Section 1")` becomes a no-op (section already auto-open) and correctly leaves `s0` OPEN. Insert AFTER that `expandRow` and BEFORE the measure-row locator:
   ```js
   // edit.js seeds s0m0 expanded on mount; collapse the measure so this test can
   // drive the keyboard expand from a known-collapsed measure row (the section
   // stays expanded so the measure row is visible to receive focus).
   await rowChevron(editor, "Measure 1").click();
   ```
   **Order is load-bearing**: section-expand FIRST (keeps the measure row present), THEN collapse the measure. Use raw `rowChevron(...).click()`, NOT `expandRow`. After insert: measure row visible ✓, `Right hand` count-0 ✓; the keyboard drive unchanged.
4. Do NOT introduce a new `collapseRow` helper — two one-line inserts don't warrant it; the raw chevron click is the existing documented toggle affordance.

**Depends on.** T3 (the seed is what creates this collision; the fixes are only correct against the seeded behavior). Verified by T10.

**Traces to.** B4 (e2e fallout, Hazard A); design §5.3 (Hazard A), §5.4 (Prong 1, Prong 2); spec deviations 1 & 2; AC-B4-b. Design §5.4.

**Acceptance.**
- `expandRow` reads `aria-expanded` and clicks the chevron only when the row is not already `"true"`.
- The `:1294` and `:1331` tests each have exactly one raw `rowChevron(...).click()` collapse insert at the specified position, in the specified order; no `collapseRow` helper added.
- Gated by T10: all 8 Hazard-A sites (`:469`, `:530`, `:676`, `:1294`, `:1331`, `:1361`, `:1504`, `:1535`) run green.

---

## T6 — B4 Hazard B: reconcile the symmetric-label-toggle reds + stale "select-only" prose (`specs/editor.spec.js`)

**Goal.** Reconcile `specs/editor.spec.js` with the already-shipped symmetric LABEL toggle (`4f3ed90`, `StructureTree.js:156-159`) — a section/measure label click now selects AND toggles expansion (collapsing an open row). Fix the one RED-on-HEAD site (`:580`) and the one RED-under-B4 site (`:757`), plus the comment-only JSDoc/prose cleanup. No source change.

**Files.**
- `specs/editor.spec.js` (`:580`/`:601` test; `:757`/`:774`/`:786` test; `treeRow` JSDoc currently `:290-295`; stale prose at `:21-26`, `:477`, `:542`, `:587`).

**Changes.**

*`:580` (RED on HEAD — independent of B4):*
1. Re-grep for the "…adds, removes and duplicates…" test. At its bare `await treeRow(editor, "Section 1").click();` (currently `:601`) that selects Section 1 for the panel — that label click now collapses the `s0` opened by the `expandRow` at `:593`, so the `openRowAction("Measure 1", …)` at `:613` no longer finds an expanded section. Replace the bare collapsing click with **select-then-idempotent-re-open**:
   ```js
   // The label click selects Section 1 (for the panel) AND toggles its
   // expansion (4f3ed90's symmetric toggle), collapsing the s0 opened above.
   // Re-open it idempotently so Measure 1 stays revealed for the row action below.
   await treeRow(editor, "Section 1").click();
   await expandRow(editor, "Section 1");
   ```
   After the label collapse, `s0`'s `aria-expanded` is `"false"`, so the idempotent `expandRow` (from T5) genuinely re-opens it. Also fix the now-stale comment (currently `:586-588`) that calls the label "select-only" — it selects AND toggles.

*`:757` (RED under B4 only):*
2. Re-grep for the "selecting structure-tree rows reveals the right panels" test. Under B4, `s0` and `s0m0` auto-open at mount; this test expects to OPEN them via label clicks. Insert a raw chevron collapse immediately BEFORE each label click so the label click genuinely opens-and-selects:
   - BEFORE the `treeRow("Section 1").click()` (currently `:774`):
     ```js
     // edit.js seeds s0 expanded on mount; collapse it so the label click below
     // opens-and-selects Section 1 (rather than collapsing it via 4f3ed90's
     // symmetric toggle) and the next assert sees Measure 1 revealed.
     await rowChevron(editor, "Section 1").click();
     ```
   - BEFORE the `treeRow("Measure 1").click()` (currently `:786`):
     ```js
     // edit.js seeds s0m0 expanded on mount; collapse it so the label click below
     // opens-and-selects Measure 1 and genuinely reveals its hand rows.
     await rowChevron(editor, "Measure 1").click();
     ```
   Then rewrite the stale prose (currently `:770-772`, `:778-779`, `:783-784`) that describes the pre-`4f3ed90` "select-and-reveal, never collapses" label, to the symmetric-toggle contract: a section/measure label click selects AND toggles expansion, so the test collapses the auto-open row first to drive the open path.

*Prong 3 (cont.) — JSDoc / prose reconciliation (comment-only, no-assertion-impact):*
3. `treeRow` JSDoc (currently `:290-295`): rewrite the "SELECT-AND-REVEAL … never collapses" description to the actual contract — a section/measure label click is a symmetric toggle that selects the row AND toggles its expansion (collapsing an open row), per `4f3ed90`; a note-leaf label click only selects.
4. Leave the `expandRow` JSDoc (currently `:324-332`) — T5 aligns the body with its existing "Expand … revealing its children" intent.
5. Reconcile the remaining stale "select-only" / "never collapses" prose at `:21-26`, `:477`, `:542`, `:587` to the symmetric-toggle reality. Comment-only, no assertion impact.

*Safe sites — leave untouched:*
6. Do NOT change the label-click sites `:547` (note "C" leaf click), `:804` (rename), `:1222` (drift-site-2) — each only needs the row SELECTED, never expanded, so the symmetric toggle is inert for them.

**Depends on.** T5 (`:580`'s re-open uses the now-idempotent `expandRow`; T3 makes `:757` red). Verified by T10.

**Traces to.** B4 (e2e fallout, Hazard B); design §5.3 (Hazard B), §5.4 (Prong 3 + JSDoc/prose); spec deviation 3 (the `:580` BF-1 finding); AC-B4-c, AC-B4-d, AC-B4-e. Design §5.4.

**Acceptance.**
- `:601`'s bare collapsing label click is replaced with `await treeRow("Section 1").click(); await expandRow("Section 1");`; the `:586-588` comment is corrected.
- `:774` and `:786` each have a raw `rowChevron(...).click()` collapse inserted before the label click; the `:770-772`/`:778-779`/`:783-784` prose is rewritten to the symmetric-toggle contract.
- The `treeRow` JSDoc and the `:21-26`/`:477`/`:542`/`:587` prose describe the symmetric toggle.
- The safe sites (`:547`, `:804`, `:1222`) are untouched.
- No source change. Gated by T10: `:580` and `:757` run green.

---

## T7 — B5.1: drop the dead default parameter + fold the stale comment (`src/edit.js`)

**Goal.** Remove the never-reached default for `sectionIndex` on `onAddMeasure`, and fold the now-stale "default-to-last fallback" clause out of the comment above it. No behavior change.

**Files.**
- `src/edit.js` (`onAddMeasure` declaration, currently `:248`; its lead comment, currently `:245-247`).

**Changes.**
1. Re-grep for `const onAddMeasure = (sectionIndex = working.sections.length - 1) =>` (currently `:248`). Change to:
   ```js
   const onAddMeasure = (sectionIndex) => {
   ```
   The only caller (`SectionPanel.js`, `onClick={() => onAddMeasure?.(sectionIndex)}`) and every test caller (`SectionPanel.test.js:279`, `:289`, `Edit.test.js:503`) always pass an explicit `sectionIndex`. (`onAddMeasureBefore` / `onAddMeasureAfter` are separate functions — leave them alone.)
2. Rewrite the lead comment (currently `:245-247`) to drop the middle "default-to-last fallback" clause, keeping the "explicit `sectionIndex`" and "selection left as-is" facts. For example:
   > Append an empty measure to a section. The Structure list passes an explicit `sectionIndex`. The new measure is reachable via the Structure list, so the selection is left as-is.

**Depends on.** None (independent region in `edit.js` from T3). Verified by T9.

**Traces to.** B5 (B5.1); AC-B5-a, AC-B5-c. Design §6.1.

**Acceptance.**
- `onAddMeasure` has no default for `sectionIndex`; the comment no longer mentions a default-to-last fallback.
- Gated by T9: all existing `onAddMeasure` callers/tests pass (`SectionPanel.test.js`, `Edit.test.js`); `npm run test:unit` + `npm run build` pass.

---

## T8 — B5.2: derive `keep` from `OVERRIDE_KEYS` (`src/editor/inspector/SectionPanel.js`)

**Goal.** Inside `emitOverrides`, replace the four-key rest-destructure with a derivation from the existing `OVERRIDE_KEYS` array, making `OVERRIDE_KEYS` the single source shared by both the projection loop and the rebuild. Identical behavior.

**Files.**
- `src/editor/inspector/SectionPanel.js` (`emitOverrides`, currently `:108-111`; `OVERRIDE_KEYS`, currently `:44`).

**Changes.**
1. Re-grep for `const { tempo, timeSignature, rightHand, leftHand, ...keep } = section;` (currently `:109`). Replace with:
   ```js
   const keep = Object.fromEntries(
       Object.entries(section).filter(([key]) => !OVERRIDE_KEYS.includes(key)),
   );
   ```
2. Leave the following `emitSection({ ...keep, ...next });` (currently `:110`) unchanged. This drops exactly the four `OVERRIDE_KEYS` and keeps everything else (`measures`, `name`, etc.) — identical behavior to the rest-destructure.
3. Do NOT reuse `omitEmpty`/`omitFalsy` from `emit.js` — they are single-key set-or-delete reducers, the wrong shape here.

**Depends on.** None. Verified by T9.

**Traces to.** B5 (B5.2); AC-B5-b, AC-B5-c. Design §6.2.

**Acceptance.**
- `emitOverrides` derives `keep` from `OVERRIDE_KEYS` via `Object.fromEntries(...filter...)`; no repeated literal key list; the `emitSection({ ...keep, ...next })` line is unchanged.
- Gated by T9: override set/unset behavior unchanged; `SectionPanel.test.js` passes; `npm run test:unit` + `npm run build` pass.

---

## T9 — Unit + build gate for B2, B3, B4 (source), B5

**Goal.** Confirm the comment-only and code edits in T1, T2, T3, T7, T8 pass the unit suite and the build. This gates everything except the e2e-only assertions (which T10 gates).

**Files.** None (run-only). Run from the worktree root.

**Changes.**
1. Run `npm run test:unit`. It MUST pass. In particular, the three `minWidth === "4em"` assertions (`pitches.test.js:216`, `pitches.test.js:231`, `contextControls.test.js:421`), the `SongCanvas.test.js` negative-guard, `SectionPanel.test.js` (`emitOverrides` behavior + `onAddMeasure` callers `:279`/`:289`), and `Edit.test.js:503` must all pass. No snapshot tests exist anywhere in `src/` or `specs/`, so the comment-only edits trip nothing.
2. Run `npm run build`. It MUST succeed.
3. If anything fails: this is **work to fix in the offending source/test task (T1–T8), not a blocker** — fix and re-run until green. Re-confirm after fixes.

**Depends on.** T1, T2, T3, T7, T8 (and incidentally clean against T4–T6, which are e2e-only).

**Traces to.** AC-B2-b, AC-B3-b, AC-B4-b (source side), AC-B5-a, AC-B5-b, AC-B5-c; spec "Test gating summary"; design §8.

**Acceptance.**
- `npm run test:unit` passes green.
- `npm run build` succeeds.
- Real results reported (which suites/tests ran). No silent skip.

---

## T10 — B1 BLOCKING: actually RUN the Playwright e2e suite GREEN (alt-ports recipe)

**Goal.** Prove B1 (and re-confirm all of T4, T5, T6, and B4's on-canvas behavior) by **actually running** the Playwright e2e suite GREEN on the worktree's own wp-env on free alt ports. "Tests edited to match the code" is NOT acceptance — the suite must run green. This is the one merge-gating deliverable.

**Files.** None (run-only). Run from the worktree root.

**Changes (the exact recipe, in order).**
1. `npm run build`
2. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:start`
3. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 WP_BASE_URL=http://localhost:8891 npm run test:e2e`
4. (cleanup, always) `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:stop`

Notes carried from spec AC-B1-c and design §2.4 (encode for the implementer, do NOT put in shipped code):
- The default ports 8888/8889 are held by the main repo's running wp-env; the worktree run MUST use alt ports 8890/8891 (confirmed free at design time). `WP_ENV_PORT`/`WP_ENV_TESTS_PORT` env overrides beat `.wp-env.json`.
- `WP_BASE_URL=http://localhost:8891` is Playwright's navigation target → the worktree's tests site on 8891.
- Carry `WP_ENV_PORT`/`WP_ENV_TESTS_PORT` on step 3 too (reboot-safety): if the health-check port were down, the bare `npm run wp-env start` fallback inherits the alt ports rather than colliding on 8888/8889.
- Step 4 cleanup runs regardless of pass/fail.

**The suite MUST be GREEN**, including: the two section-remove drift tests (T4); the 8 Hazard-A drill-down/keyboard tests (T5: `:469`, `:530`, `:676`, `:1294`, `:1331`, `:1361`, `:1504`, `:1535`); the two Hazard-B symmetric-toggle tests (T6: `:580`, `:757`); and the `:469` first-note flow re-confirming B4's on-canvas behavior (`AC-B4-a`).

**STOP-and-report-blocker path (no silent skip).** If — after genuine effort (build, alt-port `env:start`, env-var overrides) — the suite genuinely cannot be executed in-environment, **STOP and report it explicitly as a blocker** (spec AC-B1-d / design §2.4). A silent skip is the review-10 failure mode and is not acceptable. On current evidence (docker up, wp-env 11.7.0 present, ports 8890/8891 free, env-var override mechanism verified) this path is not expected. Either way, report the **real** pass/fail result of step 3.

**Depends on.** T3 (seed source), T4, T5, T6 (all e2e edits). Also benefits from T9 being green first, but the e2e run is the independent gate.

**Traces to.** B1 (B1.1–B1.4); AC-B1-c, AC-B1-d; AC-B4-a, AC-B4-b (e2e side), AC-B4-c, AC-B4-d; spec "Test gating summary"; design §2.4, §8.

**Acceptance.**
- The recipe is run from the worktree root in order; step 3 runs the suite to completion.
- The suite is GREEN (the section-remove tests, the 8 Hazard-A tests, the 2 Hazard-B tests, and the `:469` flow all pass).
- The real pass/fail result is reported. If genuinely un-runnable after genuine effort: STOP and report an explicit blocker — no silent skip.
- `env:stop` cleanup is run.

---

## Coverage check

| Finding | Task(s) | Gate |
| --- | --- | --- |
| **B1** (section-remove e2e drift, 🔴 BLOCKING) | T4 (edits) + T10 (real e2e run) | T10 e2e GREEN |
| **B2** (stale SCSS prose, comment-only) | T1 | T9 (unit + build) |
| **B3** (`:first-child` comment + keep inline 4em) | T2 | T9 (unit + build) |
| **B4** (first-run auto-expand) | T3 (source) + T5 (Hazard A e2e) + T6 (Hazard B e2e) | T9 (source) + T10 (e2e) |
| **B5** (cheap simplifications) | T7 (B5.1) + T8 (B5.2) | T9 (unit + build) |

Out-of-scope items (#36 mutator refactor, `speak()`, move up/down, octave-less labels, cosmetic tokens) and validated rejections (`omitEmpty` for `resetAll`, breadcrumb/move "mismatch", boundary-remove disabling) have **no task** — by design. No ConfirmDialog is re-added; inline `minWidth: "4em"` stays inline; `selection.js` and the measure-remove tests are untouched.
