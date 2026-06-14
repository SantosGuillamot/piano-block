# Code Plan Review — APPROVED (review-9, iteration 1)

**Verdict: APPROVED.** The code plan (`code-plan.md`) is complete, correctly ordered,
feasible against the live tree at `worktree-8-editor-ui` (tip `c7a25d1`), and its
acceptance criteria are rigorous where a real `@wordpress/components` / `@wordpress/icons`
contract or build-output fact is at stake. Reviewer: **code-plan-reviewer**, N=1.

This document records what was verified, gate by gate. Every file/line reference cited in
the plan was checked against the live source; the handful that are off by a line or two
fall inside the plan's own stated "re-confirm exact coordinates before editing" tolerance
and are anchored by quoted code excerpts, not bare line numbers.

## Completeness — every item has a task (or a documented no-op)

| Item | Task | Verified |
| --- | --- | --- |
| M1 (front-end border leak) | T1 | `style.scss:25-29` rule + `:17-23` @font-face + `:1-5` header all present; `editor.scss:1-6` header + `:9-16` in-block comment both carry the stale "shared wrapper rules" claim to fold. Emitted-CSS proof required. |
| Optional polish 6 (editor.scss dup header) | T1 (folded) | Confirmed the two stale headers exist. |
| S1 (drop per-control hand prefix) | T4 | `HandConfigEditor.js` controls + `ListControls.js` `AddButton` + 3 `buttonByText` sites. Correction #1 folded. |
| S2 (rename 4 "Advanced" + collapse) | T7 | NotePanel:157 / MeasurePanel:93 / SectionPanel:126 / ContextEditor:195 all `label="Advanced"`; SectionPanel double-wrapper `:125-142`. |
| S3 (shorten 4 labels) | T6 | PitchEditor:62 / AnnotationEditor:32,39,48. |
| S4 (floating trash) | T5 | HandConfig alters `HStack:158` lacks `alignment`; PitchList:41 / AnnotationList:55 already have it. |
| S5 (select-and-reveal) | T8 | `RowLabelCell` onClick `:141`; cell already receives `isExpanded`/`onToggleExpanded`/`expansionKey`. Correction #3 folded. |
| S6 (canvas highlight — DEFER) | T12 | Tracking issue, verbatim title/body. `origin` = SantosGuillamot/piano-block. |
| S6-tracking-issue | T12 | Same. |
| S7 (confirm section delete) | T9 + T10 + T11 | Mock has no ConfirmDialog (confirmed); both entry points + lift-outside-DropdownMenu. |
| **S8 (keep lists separate)** | **no task (correct)** | Satisfied by T4/T5 leaving the three bodies in place; recorded in Conventions. |
| S9 (single parse) | T2 + T3 | `validate.js` shape matches design; `edit.js` `safeParse:51-57`, errors memo `:140-143`, working memo `:153-158`. |
| S10 (dedupe resetAll) | T7 (folded) | `resetAll` body `:127-133`. Correction #2 (unit-unobservable) honored. |
| Optional polish 1–4 | T13 | edit.js stale comment `:305-308`; `<Flex>` SongPanel:78-86 / InvalidState:46-54; "Switch to JSON" `:34`; Rename MenuItem. |
| Optional polish 5 (PR prose) | doc-phase note (no code task) | Correctly flagged in T13 acceptance, not silently dropped. |

Nothing silently dropped. S8's no-task is the correct decision and is explicitly recorded.

## Task quality — self-contained, accurate, design-faithful

Each task carries Goal / Files / Changes / Depends on / Traces to / Acceptance. Spot-checks
against the live tree:

- **T2** — `validateValue` (`validate.js:112`) and `songSchema` (import `:38`) are in scope,
  so `parseAndValidate` can be written exactly as the design's code block; the thin
  `validateSong` wrapper keeps the `(raw)→string[]` + `"Invalid JSON: …"` contract
  byte-identical. `validate.test.js` exists with a `validateSong` describe to extend.
- **T3** — `safeParse`, both memos, and the single-import switch are all where the plan says;
  `validateSong` is used only by the `errors` memo in `edit.js` (plan correctly says to drop
  the default import if it becomes unused). `Edit.test.js` has the conformant-renders-canvas
  (`:335`) and non-conformant-routes-to-InvalidState (`:285`) cases the acceptance relies on.
- **T4/T5/T7/T8/T10/T11** — every cited control, prop, call site, and test query line was
  confirmed (see Mock-fact and Test-reference checks below). The Changes match the design
  doc's decisions (OPT-1 bare-label + aria-label; top-level `__list-row` CSS; one-line
  onClick; lift-to-StructureTree single dialog; one combined SectionPanel edit) — no
  re-design.

## Mock facts — the unit-vs-e2e split is correctly grounded

Verified against `test/mocks/wordpress-components.js`:
- `Button` accessible name = `ariaLabel ?? label` (`:55`) → T4 trash label→aria-label swap
  and AddButton passthrough are honored on the mock.
- `SelectControl`/`NumberControl`/`TextControl`/`TextareaControl` set `"aria-label": label`
  then spread `...rest` last (`:97,137,159,181`) → a separately-passed `aria-label` overrides
  (T4).
- `HStack` swallows `alignment`, spreads `className` via `...rest` onto `<div>`
  (`:203-209`) → T5 asserts the className hook, NOT alignment (correct).
- `ToolsPanel` exposes `label` as `aria-label`, **swallows `resetAll`** (`:304-310`) → T7
  title renames testable; S10 swap unit-unobservable (correction #2 correct).
- `DropdownMenu` renders render-function children inline (`:402-404`) → T11 confirm-click is
  queryable.
- **No `ConfirmDialog` in the mock** → T9 is a genuine prerequisite (`module.exports` block
  `:546-568` is where the export lands).

## Ordering & same-file collisions — sequential, no inversions

Code-writers run one at a time on ONE tree. Verified the load-bearing pairs:
- **validate.js → edit.js**: T2 before T3 (T3 imports `parseAndValidate`). ✓
- **Mock before S7 consumers**: T9 before T10/T11. ✓
- **HandConfigEditor**: T4 (labels) then T5 (alignment/className) — same file, sequential. ✓
- **SectionPanel**: T7 (title/collapse/resetAll) then T10 (dialog) — sequential. ✓
- **StructureTree**: T8 (onClick) → T11 (pendingRemoveSection) → T13 (Rename MenuItem) — all
  three sequential, no overlap. ✓
- **S2/S10 share one ToolsPanel element** → handled as one combined edit in T7 (not split). ✓

No same-file collision between concurrently-needed tasks; no dependency inversion.

## Acceptance rigor — real-contract fixes demand real/emitted proof

- **M1/T1**: emitted `build/style-index.css` grep (no `border:1px dashed`/`#767676`, retains
  `@font-face`); `build/index.css` unaffected. Grep confirmed no unit test pins the wrapper
  rule (`border: 1px dashed #767676` appears only in `src/style.scss`), so deletion breaks
  nothing.
- **S1/T4**: e2e drives real `SelectControl`/`Button` — visible "Clef" vs accessible "Right
  hand clef".
- **S4/T5**: unit className hook + e2e real `HStack`/`Button`/`SelectControl` alignment.
- **S5/T8**: unit rewrite (collapsed→select+expand `toggle===["s0"]`; expanded→select-only
  `toggle===[]`) + e2e collapsed-label-click reveal.
- **S7/T10,T11**: real `ConfirmDialog` accept AND cancel, both entry points.

The three inherited corrections are all honored: #1 (buttonByText churn at
`contextControls.test.js:347,371,385`), #2 (S10 unit-unobservable), #3 (two stale e2e
docblocks `treeRow` `:290`-region, `expandRow` `:324`-region).

## Test-reference checks (all confirmed)

- `contextControls.test.js`: `aria-label="Advanced"` `:260,272`; `buttonByText("Right hand
  add alteration")` `:347,371,385`; `buttonByName("Right hand remove alteration")` `:365`;
  accessible-name `fieldByName("Right hand clef"/…)` `:234,251,290,330,338` stay green.
- `SongPanel.test.js`: `aria-label="Advanced"` `:284`; `Right hand clef`/`Left hand clef`
  `:219,220,226` stay green.
- `NotePanel.test.js`: `Note name` `:184,316`. `pitches.test.js`: `Note name` `:170,184,197`.
  `annotations.test.js`: text/placement/staff `:178,182,192,202,207,217,225,240`.
- `StructureTree.test.js`: select-only describe `:376`, section-label case `:377`
  (`new Set()` `:379`), chevron cases `:388-405`; section remove `:433`/`:446`/`:448`,
  measure `:476`/`:478`, note `:527`/`:529`.
- `SectionPanel.test.js`: remove-section describe `:254`, cases `:255-263`/`:265-274`; the
  `drops the tempo override when cleared` reset test `:229` clears via control `onChange`
  (stays green under S10).
- `Edit.test.js`: `Remove section` `:461`, `Remove measure` `:478`, `Remove note`
  `:511,547`.
- `specs/editor.spec.js`: `treeRow` docblock SELECT-ONLY `:290`-region; `expandRow` docblock
  `:324`-region; `openRowAction("Actions for Section 3","Remove")`→`sections.length`
  `:660-663`; measure-3 remove `:645-648`; select-reveal flow `:761-778`.

## Do-not-touch — clean

No task plans an edit to the song schema, `render.php`, the front-end SVG draw, the
`view.js` `validateSong` gate, the TreeGrid keyboard model / `aria-hidden` chevron,
`__next40pxDefaultSize`, the `setSectionAt`/`setMeasureAt`/`setEventAt` + `omitEmpty`/
`omitFalsy` + per-panel `resetAll` key-set duplication, or the hand-group row's bespoke
non-selecting cell. T13's `<Flex>` drops and the Rename `MenuItem` are in-scope polish, not
on the protected list.

## Altitude — a task plan, not a redesign

The plan defers HOW to the design doc throughout and adds no new requirements. Acceptance
criteria are concrete pass/fail. Each task keeps `npm run test:unit` / `npm run build` /
`npm run check` (Biome) green at commit, with the e2e specs kept consistent-by-construction
where behavior changed.

**No material defects found. Approved.**
