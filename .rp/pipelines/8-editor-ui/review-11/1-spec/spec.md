# Spec — Review 11: section-remove e2e drift fix, stale-SCSS cleanup, first-run discoverability, and cheap simplifications

Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). This document is standalone: later phases work from this spec and the current code on branch `worktree-8-editor-ui` — not from prior `review-1..10/` artifacts.

## Overview

Review 10 deliberately removed the section-removal confirm dialog: section removes are now **immediate and undo-reversible**, and the jest unit tests were updated to match. Two Playwright e2e tests in `specs/editor.spec.js` were missed and still click a confirm-dialog `OK` button that no longer renders, so they will hang/fail in CI. This is the one blocking, merge-gating defect of this run.

Alongside that fix, this run addresses four lower-risk cleanups surfaced by the same multi-agent review of PR #22:

- **B2** — delete stale SCSS prose that describes on-canvas "add affordances" which moved to the structure tree + inspector (comment-only).
- **B3** — correct a misleading `:first-child` rationale comment in the same SCSS file, while keeping the inline `minWidth: "4em"` styles that three unit tests assert (comment-only on the SCSS side).
- **B4** — first-run discoverability: on a fresh block the first note sits two chevron-expands deep. Auto-expand the seeded section and measure so the first measure's "Add note" buttons are reachable immediately.
- **B5** — two no-behavior-change simplifications: drop a dead default parameter and derive a destructure from an existing single-source array.

The change stays **editor-side**: the song format/schema, `render.php`, and the front-end SVG rendering are unchanged — a published song renders byte-identically. Only `@wordpress/*` packages already available to the block are used; no new dependencies. The blocking finding (B1) is verified by **actually running** the Playwright e2e suite green, not merely by editing the tests to match the code.

### Coordinate convention

Line references below are confirmed against the live worktree tree at run start and are **evidence/starting points, not frozen coordinates** — they shift as fixes land. Implementers re-confirm each site by reading/grepping the live file before editing. Confirmed at run start: the two `name: "OK"` clicks are at `specs/editor.spec.js:669` and `:1232`; the expansion-state initializer is at `src/edit.js:100`; the dead default arg is at `src/edit.js:248`; `OVERRIDE_KEYS` is at `src/editor/inspector/SectionPanel.js:44` with the rest-destructure at `:109`. (Note: the research refers to `SectionPanel.js`; its full path is `src/editor/inspector/SectionPanel.js`.)

## Requirements

### B1 — Fix the CI-breaking section-remove e2e drift (🔴 blocking, test-only)

Bring the two Playwright e2e tests in `specs/editor.spec.js` back in line with the shipped behavior (section removes are immediate and undo-reversible; there is no confirm dialog), and verify by actually running the e2e suite green.

- **B1.1 — "Add before / Add after" flow test (drift site 1).** Delete the section-remove "click OK" step (the `editor.canvas.getByRole("button", { name: "OK", exact: true }).click()` block, currently around `:665-670`). Keep the `openRowAction("Actions for Section 3", "Remove")` click and the trailing `sections.length` → `2` poll — once the OK-click is gone, that existing poll asserts the immediate remove. Rewrite the stale comment (currently `:663-664`) to state the immediate/undo-reversible behavior. The intended resulting block:
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

- **B1.2 — dedicated section-remove test (drift site 2, currently declared at `:1191`).**
  - Rename the test from `"the Section panel Remove section button confirms via a real dialog before removing"` to **`"the Section panel Remove section button removes the section immediately"`** (matches the lowercase, present-tense, behavior-describing cadence of sibling tests).
  - Delete the OK-click block (currently `:1230-1232`). The body's `sections.length` → `1` poll already runs after the former OK-click, so deleting only the OK-click leaves a correct immediate-remove assertion.
  - Rewrite the false header comment block (currently `:1185-1190`) and the inline stale comment (currently `:1225`) to the immediate/undo-reversible story.
  - **Keep** the "Remove section" panel-button click and the `sections.length` → `1` poll.
  - **Keep** the `page` fixture parameter (currently `:1193`) — it is still used by `openSettingsSidebar(editor, page)` at `:1220`; removing it would break the test.
  - Intended resulting tail of the body:
    ```js
    // Click the panel's "Remove section" button — the section is removed immediately.
    await sidebar
        .getByRole("button", { name: "Remove section", exact: true })
        .click();

    // The section is removed immediately: sections.length drops from 2 to 1.
    await expect
        .poll(async () => (await storedSongObject(editor)).sections.length)
        .toBe(1);
    ```

- **B1.3 — negative regression guard (the renamed `:1191` test only).** After the "Remove section" click and before the poll, assert the confirm-dialog button does not exist:
  ```js
  // No confirm dialog: the remove is immediate. A re-added ConfirmDialog would
  // surface an "OK" button here and re-break this test.
  await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);
  ```
  Use `toHaveCount(0)`, page-scoped (matching the old OK locator scope). This makes a future re-added dialog re-break the suite loudly — the whole point of B1. Add this guard to the `:1191` test only; drift site 1 stays poll-only (it is a broad add/remove/duplicate flow, not the dialog-regression anchor, so a second guard there is redundant).

- **B1.4 — do not regress.** Do NOT re-introduce a `ConfirmDialog` / `__experimentalConfirmDialog` anywhere. Do not touch the measure-remove tests (the measure-remove path at `:646-661` already asserts the immediate behavior with no dialog) or any unrelated `confirm`/`OK` references in the file (button aria-labels, JSON-repopulate prose, an expansion-key string). The only two `name: "OK"` clicks in the whole spec are the two being deleted (`:669`, `:1232`).

### B2 — Delete stale SCSS prose (🟡, comment-only)

Remove the "on-canvas add affordances" language from `src/editor.scss` (the affordances now live in the structure tree + Note panel).

- **B2.1** Rewrite the file-header comment so the stale "on-canvas add affordances sit beside it" clause (currently `:6-8`) no longer claims canvas-side add affordances.
- **B2.2** Rewrite the `&__canvas` block comment (currently `:106-107`) so "the SVG host plus the add affordances" no longer references nonexistent canvas add affordances.
- **B2.3** No selector/rule/behavior change. Do not touch `src/editor/selection.js` — its "add-note target" line (`:130`) is a valid, unrelated reference (mapping a click back to core's `data-measure`), explicitly out of scope for B2.

The `__add-note` / `__add-measure` / `__canvas-actions` hook classes are referenced only in `src/editor/__tests__/SongCanvas.test.js` as a negative guard (asserting they are absent), so these are stale prose, not dead code; the edit trips no tests.

### B3 — Fix the misleading `:first-child` SCSS comment; keep the inline minWidth (🟡, comment-only on SCSS)

Correct the `> :first-child` rationale comment in `src/editor.scss` (currently `:20-21`). It claims `:first-child` is "the SelectControl + NumberControl pair," but the list-row has three children (`HandConfigEditor.js`: a SelectControl, a NumberControl, and a trash Button), and `PitchEditor`/`AnnotationEditor` render React Fragments that flatten their controls into the parent `HStack`. Across all three list-row users (`PitchList`, `AnnotationList`, `HandConfigEditor`), `:first-child` is therefore always a single leading control — never a pair.

- **B3.1** Rewrite the comment so it describes `:first-child` as the row's single leading control (e.g. the leading `SelectControl`, or the leading control of the editor fragment), kept from collapsing at narrow inspector widths by the rule's `min-width`. Do not change the SCSS `min-width: 8em` rule value (currently `:28-31`); it is distinct from the inline 4em below.
- **B3.2** KEEP the inline `style={{ minWidth: "4em" }}` at `HandConfigEditor.js:193`, `PitchEditor.js:79`, and `PitchEditor.js:91`. Do NOT move `4em` into SCSS — three unit tests assert `style.minWidth === "4em"` (`pitches.test.js:216`, `pitches.test.js:231`, `contextControls.test.js:421`).

### B4 — First-run discoverability: auto-expand the seeded section + measure (🟡)

On render, pre-expand the first section and its first measure so the first measure's "Add note" buttons are reachable without two manual chevron-expands.

Context: the empty-song seed (`newSong()` → one section → one measure) produces an **empty** measure — `newMeasure()` returns `{}` (no hand, no note). `StructureTree` nonetheless renders both hand-group rows (Right hand, Left hand) for every measure, and each hand-group row's actions cell holds a direct "Add note to `<hand>`…" Button. So the real first-note entry point for an empty measure is the per-hand "Add note" buttons, which become visible once the section and measure are expanded. The expansion state currently starts empty (`new Set()`), so on a fresh block the seeded section and measure are collapsed.

- **B4.1** Change the expansion-state initializer at `src/edit.js:100` from `useState(() => new Set())` to seed the Set with exactly the first section key and first measure key, using the existing `expansionKey` helper (already imported at `edit.js:24`):
  ```js
  useState(
      () =>
          new Set([
              expansionKey({ sectionIndex: 0 }),
              expansionKey({ sectionIndex: 0, measureIndex: 0 }),
          ]),
  )
  ```
  Use `expansionKey(...)` rather than literal `"s0"`/`"s0m0"` strings so the two sides cannot drift on key shape. Exactly these two keys are required — expanding only the section is not enough, and the hand rows themselves need not be expanded (their "Add note" button sits on the hand row, visible once the measure is expanded).
- **B4.2** Seed **unconditionally** (do not gate on the empty-song case). The `expanded` Set is membership-only; a key for a row that does not exist is inert (no row, no effect, no error). On a saved multi-section song this merely pre-opens its first section + first measure — harmless. Gating to `song.trim() === ""` would force the once-run initializer to close over `song` for no real risk reduction.
- **B4.3** Do NOT add a "Start a song" CTA or any net-new UI; auto-expand is the lighter, lower-risk option chosen here.

### B5 — Cheap simplifications (🟡, no behavior change)

Two single-source / dead-code cleanups with no behavior change.

- **B5.1** Drop the dead default parameter at `src/edit.js:248`: change
  `const onAddMeasure = (sectionIndex = working.sections.length - 1) => {` to
  `const onAddMeasure = (sectionIndex) => {`. The only caller (`SectionPanel.js`, `onClick={() => onAddMeasure?.(sectionIndex)}`) always passes an explicit `sectionIndex`, and every test caller (`SectionPanel.test.js:279`,`:289`, `Edit.test.js:503`) passes one too, so the default is never reached. (`onAddMeasureBefore` / `onAddMeasureAfter` are separate functions.)
- **B5.2** At `src/editor/inspector/SectionPanel.js:109` (inside `emitOverrides`), derive `keep` from the existing `OVERRIDE_KEYS` array (`:44`, already consumed by the projection loop at `:55`) instead of repeating the four-key list literally:
  ```js
  const keep = Object.fromEntries(
      Object.entries(section).filter(([key]) => !OVERRIDE_KEYS.includes(key)),
  );
  ```
  Leave the following `emitSection({ ...keep, ...next })` line unchanged. This drops exactly the four `OVERRIDE_KEYS` and keeps everything else (`measures`, `name`, etc.) — identical behavior to the rest-destructure — and makes `OVERRIDE_KEYS` the single source shared by both the projection loop and the rebuild. Do not reuse `omitEmpty`/`omitFalsy` from `emit.js`: they are single-key set-or-delete reducers, the wrong shape here.

### Cross-cutting constraints (carried from the intent)

- **Editor-side only.** The song format/schema, `render.php`, and front-end SVG rendering are unchanged; a published song renders byte-identically. B1 is test-only; B2/B3 are comment-only; B4/B5 are small editor-side code changes.
- **No new dependencies.** Use only `@wordpress/*` packages already available to the block.
- **Preserve prior-review wins.** The real `TreeGrid` keyboard model and a11y parity; the immediate/undo-reversible deletes (B1 must NOT reintroduce a confirm dialog); the monotonic `focusRequest` focus management; the inline `minWidth` list-row floors (B3 keeps them); the depth-fixed `setXAt` helpers; `omitEmpty`/`omitFalsy`; and raw-JSON mode.

## Out of Scope

The following are explicitly excluded this run. Design and implement nothing for them.

### 🟢 Nice-to-haves — excluded by the owner

- Collapsing the ~12 near-identical structural mutators (`edit.js`) into descriptors + generic ops (a large refactor for a separate PR; tracked as follow-up issue #36).
- `@wordpress/a11y` `speak()` announcements on remove.
- Move up/down reordering via a `moveAt` helper.
- Tree note labels omitting the octave (C4/C5 ambiguity).
- Cosmetic token swaps (`#ddd`→`$gray-300`, `24px`→`$grid-unit-30`, etc.).

### ⛔ Validated rejections — do NOT undo or re-litigate

- **Routing `ContextEditor` `resetAll` through `omitEmpty`** — rejected: `resetAll` does three things `omitEmpty` cannot (a `setTempoDraft()` React-state side-effect, deleting two keys, and deleting a nested `tempo.beatUnit`). Leave `ContextEditor.js:196-209` as-is.
- **Treating the missing breadcrumb / move-up-down buttons as a "description–code mismatch"** — down-ranked: both were intentionally dropped in the design; the stale text is the PR description, not the code. Not a code change.
- **Disabling boundary removes in the tree menu** — rejected: zero-section / zero-measure songs validate, so there is no invariant to guard (unlike last-pitch, which is correctly guarded).

### Other exclusions

- Do NOT re-add any section-remove confirm dialog (`ConfirmDialog` / `__experimentalConfirmDialog`).
- Do NOT move the inline `minWidth: "4em"` styles into SCSS (B3 keeps them inline).
- Do NOT touch `src/editor/selection.js` (its "add-note target" reference is valid and unrelated).
- Do NOT touch the measure-remove e2e tests or unrelated `confirm`/`OK` references in `specs/editor.spec.js`.

## Acceptance Criteria

### B1 — section-remove e2e drift

- **AC-B1-a** No `name: "OK"` section-remove click and no stale ConfirmDialog/"real dialog" comment remain in `specs/editor.spec.js`: the two clicks (currently `:669`, `:1232`) are deleted and the six stale comments (currently at `:664`, `:1186`, `:1188`, `:1191` (the test name), `:1225`, `:1230`) are gone or rewritten to the immediate/undo-reversible story.
- **AC-B1-b** The dedicated section-remove test is renamed to **"the Section panel Remove section button removes the section immediately"** and contains the `await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);` no-dialog guard, placed after the "Remove section" click and before the `sections.length` poll. Its `page` fixture parameter is retained.
- **AC-B1-c** **`npm run test:e2e` is actually RUN and passes GREEN** (the section-remove tests included), using the worktree's own wp-env on free ports. Recipe (from the worktree root):
  1. `npm run build`
  2. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:start`
  3. `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 WP_BASE_URL=http://localhost:8891 npm run test:e2e`
  4. (cleanup) `WP_ENV_PORT=8890 WP_ENV_TESTS_PORT=8891 npm run env:stop`

  The default ports 8888/8889 are held by the main repo's running wp-env, so the worktree run MUST use the alternate ports above; `WP_ENV_PORT`/`WP_ENV_TESTS_PORT` env overrides beat `.wp-env.json`, and `WP_BASE_URL` points Playwright at the worktree's tests site. The code phase MUST report the real pass/fail result. **"Tests edited to match" is NOT acceptance** — the suite must run green.
- **AC-B1-d** If — after genuine effort — the e2e suite cannot be executed in-environment, the code phase **STOPS and reports that explicitly as a blocker** (no silent skip; this is exactly the review-10 failure mode). On current evidence (docker up, wp-env present, ports 8890/8891 free, env-var port override works) this path is not expected.

### B2 — stale SCSS prose

- **AC-B2-a** `src/editor.scss` no longer describes any on-canvas add affordances; the comments reflect that adds live in the structure tree + inspector.
- **AC-B2-b** No SCSS rule/selector changes; `npm run build` succeeds; no test references break (the negative-guard test in `SongCanvas.test.js` is unaffected — it tests the absence of the hook classes, which is unchanged).

### B3 — misleading `:first-child` comment / inline minWidth

- **AC-B3-a** The `:first-child` comment in `src/editor.scss` accurately describes a single leading control, not a "SelectControl + NumberControl pair." The SCSS `min-width: 8em` rule value is unchanged.
- **AC-B3-b** The inline `minWidth: "4em"` styles (`HandConfigEditor.js:193`, `PitchEditor.js:79`, `PitchEditor.js:91`) are untouched; the three `minWidth === "4em"` assertions (`pitches.test.js:216`, `:231`, `contextControls.test.js:421`) still pass; `npm run build` succeeds.

### B4 — first-run discoverability

- **AC-B4-a** On a freshly inserted block, the structure tree shows Section 1 and Measure 1 expanded, with the Right hand / Left hand rows and their "Add note" buttons visible without any manual chevron-expand.
- **AC-B4-b** Existing tree interactions (toggle/collapse, the add/duplicate auto-reveal, focus management) are unchanged; `npm run test:unit` + `npm run build` pass. The e2e flow at `specs/editor.spec.js:469` ("the seeded empty measure adds its first note from the structure tree") still passes as part of the B1 e2e run — its manual expand steps are idempotent against already-expanded rows.

### B5 — cheap simplifications

- **AC-B5-a** `src/edit.js:248` has no default for `sectionIndex`; all existing `onAddMeasure` callers/tests pass.
- **AC-B5-b** `src/editor/inspector/SectionPanel.js` `emitOverrides` derives `keep` from `OVERRIDE_KEYS` (no repeated literal key list); override set/unset behavior is unchanged and `SectionPanel.test.js` passes.
- **AC-B5-c** `npm run test:unit` + `npm run build` pass (no snapshot tests exist to trip).

### Test gating summary

- **B1** is gated by the **real e2e run** (AC-B1-c / AC-B1-d) — running the suite green, not editing tests to match.
- **B2, B3, B5** are gated by `npm run test:unit` + `npm run build`. No snapshot tests exist anywhere in `src/` or `specs/`, so the comment-only edits trip nothing.
- **B4** is gated by `npm run test:unit` + `npm run build`, with the `:469` e2e flow re-confirmed during the B1 e2e run.
