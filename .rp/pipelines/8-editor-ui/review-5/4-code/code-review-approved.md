# Code Review — Review 5 (T1–T3): APPROVED

**Verdict:** APPROVED.
**Batch:** T1–T3 of `3-plan/code-plan.md`. Diff base `cbde4c6`; commits `a1a3174` (T1)
→ `3236072` (T2) → `938deff` (T3).
**Branch verified:** `worktree-8-editor-ui` @ `938deff`.

## Gates

- `npm run test:unit`: **623 passed / 20 suites**, all green (the planned net −1 from
  T2: −1 StructureTree, −1 SectionPanel, +1 SongPanel; Edit retargeted not added).
- `npm run lint` (biome): clean, 63 files checked, no findings (the new sorted
  `Button` import in `SongPanel.js` satisfies the import-order rule).
- Live e2e NOT run (wp-env port conflict, as flagged). Assessed by read-through —
  self-consistent (see T2 below).

## Spec coverage

- **Req 1 / AC1** — T1: 8 per-row action buttons now `secondary` (visible chips),
  removes keep `isDestructive`, labels stay quiet. ✔
- **Req 2 / AC2** — T2: no tree/SectionPanel Add-section; one Add-section in the
  always-present SongPanel; add-section reachable in every state. ✔
- **Req 3 / AC3** — T3: CSS-only thin highlight (recolor floor + 0.125px hairline);
  no thick box. ✔
- **Req 4 / AC4** — Front-end render path byte-untouched (see Boundary). ✔
- **Req 5 / AC5** — `@wordpress/*` + stock CSS/SVG only; no new dependency
  (`package.json` not in diff). ✔

## T1 — tree buttons (`tertiary → secondary`)

Grep on `StructureTree.js` @HEAD: `variant="tertiary"` **4** (was 12 → −8),
`variant="secondary"` **8**, `isDestructive` **3** (unchanged). The 8 flipped are
exactly the per-row action buttons (section remove/duplicate/add-measure; measure
remove/duplicate; hand add-note; note remove/duplicate). The 4 remaining `tertiary`
(lines 191, 290, 398, 453) are the label/disclosure buttons — left untouched as
designed. The 3 removes still carry `isDestructive` (none added/removed), preserving
the destructive read via `is-secondary is-destructive`. `<Button>` still used 12×, so
the import is live. Test-neutral as predicted.

## T2 — Add-section relocation

`onAddSection` in `src/`: present only in `edit.js` (handler `:240`, call-site
`<SongPanel … onAddSection>` `:522`) and `SongPanel.js` (prop + button `:279`);
**absent** from `StructureTree.js` and `SectionPanel.js`. The "Add section" literal in
`src/` appears exactly once (SongPanel). `<SongPanel>` (`edit.js:518-523`) sits OUTSIDE
the `{resolvedSelection && (…)}` gate that wraps `<SectionPanel>` (`:510-517`), so the
author can add a section in every state, including nothing-selected — the gap the
selection-gated SectionPanel could not cover, with no second/lost append path.
SectionPanel keeps "Remove section" (`isDestructive`, `onRemoveSection`). The
SongPanel button is inside `<PanelBody>`. All unit touchpoints match the plan:
StructureTree/SectionPanel Add-section tests deleted + harness `addSection` wiring
dropped; Edit retargeted (dropped `selectLoneNote`, comment updated); SongPanel gained
local `buttonByText`/`click` helpers, a forwarded optional `onAddSection` in
`renderPanel`, and a test asserting the lifted handler fires once and `onChange` does
not. e2e retargeted: `page` added to fixture, `openSettingsSidebar` opened once,
tree-scoped click replaced with `sidebar.getByRole("button", { name: "Add section",
exact: true })` mirroring the existing sidebar "Add note" pattern; old
`treeAction(editor, "Add section")` fully removed; comment updated. Read-through is
self-consistent and describes a valid flow.

## T3 — highlight (the crux)

`.is-selected` in `style.scss` is CSS-only. Recolor floor scoped exactly as designed:
`*:not([fill="none"]) { fill: #007cba }`, `line { stroke: #007cba }`,
`ellipse[fill="none"] { stroke: #007cba }` — **no `<text>` selector and no
`* { stroke }` wildcard** (the only `text` occurrences are in comments and inside the
`:not([fill="none"])` literal). `:not([fill="none"])` preserves the open notehead's
hole; stroke is limited to already-stroked geometry, avoiding the ~8× font-glyph
re-magnification. Hairline `outline: 0.125px solid #007cba` + `outline-offset: 0.25px`;
**zero `outline: 1px`** remains. No JS change — `decorateSelection`/`SongCanvas.js`
untouched (only adds the class). No `svg.js`/`render.php`/`view.js`/schema change.

## Boundary

`git diff --name-only cbde4c6..HEAD` = exactly the allowed set: `StructureTree.js`,
`SongPanel.js`, `SectionPanel.js`, `edit.js`, `style.scss`, their four `__tests__/*`,
and `specs/editor.spec.js`. No `src/song/*`, no `src/notation/*` (incl. `svg.js`), no
`src/view.js`, no `src/render.php`, no `SongCanvas.js`, no `package.json`. The
front-end render path is byte-untouched → published SVG byte-identical (AC4). No
excluded alternative introduced (no `vector-effect: non-scaling-stroke`, no `getBBox`,
no `box-shadow`).

## Note (non-blocking)

The design doc prose says "7 action buttons" while listing 8 anchors; the code plan
correctly resolves this to **8**, and the code flips exactly those 8. The plan is the
binding gating artifact, so this is a design-doc wording inconsistency, not a code
defect. No action required.
