# Design-doc review — review-8 (APPROVED)

Reviewer: `design-reviewer-r8`. Verdict: **APPROVED**.

The design doc (`.../review-8/2-design-doc/design-doc.md`) is sound, complete, and
grounded in the live source. Every spec requirement (R1–R20, O1–O5) has a concrete,
implementable design that works against the real code and the real `@wordpress/*`
package contracts, the change ordering respects real dependencies, the
"green ≠ broken" guarantee is genuinely achieved for items 1/2/16, and scope
discipline (byte-identical front end, `@wordpress/*`-only deps, the "fine as-is"
and deferred items) is intact. I verified the load-bearing claims against the
worktree rather than taking the doc's word for them.

## Groundedness — verified against the live tree

Every factual anchor the design leans on was confirmed by reading the source:

- **R1 wiring.** `StructureTree.js:569` does render `<TreeGrid label={__("Song
  structure", …)}>` today (so the value is already a translated string that lands
  as a dead attribute) with **no** `onExpandRow`/`onCollapseRow`. The components
  mock spreads `...rest` onto both `<table>` (`:456`) and `<tr>` (`TreeGridRow`
  `:471–490`), so the design's `data-expansion-key` on the `<TreeGridRow>` lands in
  both the real and mocked surfaces. `expansionKey` (`selection.js:40–49`)
  concatenates `s${si}` + `m${mi}` + `${hand}`, and `expansionKeyOf` as
  `row?.getAttribute?.("data-expansion-key") ?? null` is its exact inverse. The
  camelCase pitfall is real and correctly avoided (React does not auto-kebab
  `data-*`). The toggle-on-both decision is safe under the documented Gutenberg
  gating contract (expand-on-collapsed / collapse-on-expanded), and even a
  contract violation yields at worst one wrong toggle, never corruption.

- **R2.** The TreeGrid mock destructures `label` (`:447`) and maps it to
  `"aria-label": label` (`:456`); removing that mapping while keeping `...rest`
  lets the production `aria-label` flow through, matching the real component. No
  unit queries the tree by name today (`Edit.test.js:680,693` query
  `[role="treegrid"]`), and no e2e queries by name today — so the new always-run
  unit (aria-label present, label absent) plus the e2e
  `getByRole("treegrid", { name })` are both genuinely new guardrails, not
  re-points of existing green tests.

- **R3/R17.** `style.scss` has zero `@use`/`@import`/`@mixin`/`@include`, is the
  only `.scss` in `src/`, holds `@font-face` + wrapper rules **and** the editor-only
  rules, and its `@for $i` aria-level loop (`:83–87`) is loop-local (the only other
  `$` tokens are `$gray-300` inside CSS comments). `block.json:17` wires only
  `"style"` with no `editorStyle`; `index.js:4` imports `style.scss`. Three
  `#007cba` occurrences (`:142–144`) and the `__canvas` block (`:114–120`,
  `flex-direction`/`gap` no-ops alongside load-bearing `flex: 1 1 auto; min-width:
  0`) are exactly as described. The split is self-contained — nothing spans the
  file boundary.

- **R6.** `edit.js` imports `insertAt`/`removeAt`/`duplicateAt`/`newX` but **not**
  `setSectionAt`/`setMeasureAt`/`setEventAt`. Eight inline two-level rebuilds
  confirmed (onAddNote, onAddMeasure, onRemoveMeasure, onRemoveNote,
  onDuplicateMeasure, onDuplicateNote, insertMeasureAt, insertNoteAt). The
  empty-hand drop is inline in onRemoveNote (`let nextMeasure / if-else / sections.map`)
  and byte-matches the helper's empty/null branch. `setMeasureAt` composes via
  `setSectionAt → replaceAt`; the `set*At` faces' read-only-own-coords invariant is
  documented (`songModel.js` docblock). The **dead-import trap is correctly flagged**:
  edit.js imports exactly `{ setSectionAt, updateHandEvents }`; the four measure-array
  sites use `setSectionAt` (they replace the whole section's `measures`), the four
  hand-array sites use `updateHandEvents`, and `setEventAt` legitimately stays
  panel-only (the only in-place note replace is in `NotePanel`). The `Edit.test.js`
  `toBeUndefined()` empty-hand pin (`:505–522`) and the "keeps the hand" case
  (`:524–553`) both exist and stay green.

- **R7.** The triplicated DropdownMenu (section/measure/note) and the repeated
  chevron+label cell are present. The DropdownMenu mock returns `null` unless
  `children` is a render function (`:371–374`) — the canary the design relies on —
  and `TreeGridCell` invokes its render-prop child with `{}` (`:514`), making the
  `toggleProps` trio e2e-only at the prop level and structural at the unit level,
  exactly as the doc states. Shape A (cell stays at the call site) is the only shape
  that can receive the roving-tabindex arg; the section+measure label cells are the
  verbatim twins, hand/note genuinely diverge. Test-neutral (whole-tree mount).

- **R8.** `interactive` is an options-object key
  (`renderSvg(model, { accessibleName = "", interactive = false } = {})`); both
  production callers (`SongCanvas.js:163`, `view.js:134`) already pass an options
  object without it. The flag threads as the last positional param through all five
  render functions; `hitRect` holds the only `data-hit` write — confirmed by grepping
  the whole repo (only `svg.js:258` plus comments and tests), so the surviving
  `[data-hit]`-count-0 pins (`svg.test.js` flagless calls; `render.spec.js:528–529`)
  are real, not tautological. The "when interactive" describe and the two constants
  are present and removable.

- **R9.** `view.js` defines `accessibleNameFor` + `trimmedString` locally and
  `src/editor/accessibleName.js` is byte-identical with `edit.js` as its sole
  importer — so the move-down + delete + repoint is clean. `glyphs.js` and
  `constants.js` each have **zero** imports (`MUSIC_FONT_FAMILY`, `SP_PX` exported),
  so `dom.js → {constants, glyphs}` is a genuine leaf-ward edge with no cycle and no
  React. The `container?.clientWidth ?? 0` superset is safe for `view.js` (always a
  real element). The two ResizeObservers genuinely differ (React state + cleanup vs.
  forever-lived imperative draw); the deliberate non-unification is correct.

- **R10/R20.** Exactly one untagged `setSelection` (onAddNote `:218`); the
  resolveSelection compat block (`:144–153`) + its docblock paragraph (`:120–124`) +
  the compat test (`selection.test.js:238–247`) all exist. The three-key reveal trios
  (onAddNote, onDuplicateNote, insertNoteAt) and the two single-key reveal sites
  (onDuplicateMeasure, insertMeasureAt) are exactly as scoped — `ancestorKeys` is the
  three-key reveal only, the single-key sites keep calling `expansionKey` directly.

- **R11.** I confirmed the `isInvalid` reduction is genuinely behavior-preserving:
  `validateSong` returns a parse error for unparseable JSON, so `errors.length === 0`
  guarantees `safeParse` succeeds and `working === null` is impossible — the
  `|| working === null` term is provably redundant. The design's justification is
  correct, not hand-waved.

- **R12/R13.** `emit.js` lives at `src/editor/inspector/emit.js` exporting
  `omitEmpty`/`omitFalsy`/`emitBlock`; `omitFalsy` trims and `omitEmpty` does not —
  so the `withField → omitFalsy` swap really does flip whitespace-only-Title to
  "drop." The design correctly counts **five** production importers (ContextEditor
  `./inspector/emit.js`; NotePanel/MeasurePanel/SectionPanel/SongPanel `./emit.js`)
  plus the test plus MetadataEditor — the spec's "the production importer"
  undersold it, and the design caught that. `MetadataEditor`/`ContextEditor` are in
  `src/editor/` (the cross-boundary import is real). The NotePanel/MeasurePanel
  onDeselect idiom split is confirmed.

- **R14/R15/O2/O3/O4.** `HandConfigEditor`'s `replaceRow`/inline filter/spread-append,
  `ALTER_KEY_OPTIONS`, the `${label} ${field}` concat, and `icon="trash"` are all
  present; it already imports from `songModel.js`. The two `NONE_OPTION` declarations
  and the `{ label: "—", value: "" }` idiom (ContextEditor `:150,173`,
  HandConfigEditor `:119`) are confirmed. `STAVES` is a literal twin of the proposed
  derived export; `notation/layout.js:897` has its own `HANDS` (correctly left
  untouched — different layer). `newRest`/`BPM_MIN_EXCLUSIVE` are production-dead
  with only test importers; `toNumber`/`measureCoords` are used internally; the
  `ToggleControl`/`TreeGridItem` mocks are dead. `BPM_MIN_EXCLUSIVE = 0` is an
  exclusive bound that must **not** be wired as the inclusive `min` — the
  DELETE-and-keep-`min={1}` decision is correct.

- **R16/O1.** The default mocks swallow `icon` (`Button` `:37`; `Icon` renders an
  icon-blind `<span data-icon>` `:323–324`; `DropdownMenu` `:368`), so string vs.
  element icons are indistinguishable today — the blindness the guard must close.
  The four live slug strings (`ListControls.js:26`, `PitchList.js:47`,
  `AnnotationList.js:61`, `HandConfigEditor.js:171`) are in leaf editors the
  StructureTree-only realIcons test never mounts, so the design's **project-wide**
  sentinel-render guard is genuinely stronger, not merely cheaper. I confirmed the
  runner React is 19.2.7 while `@wordpress/icons` nests React 18.3.1 (the exact
  mismatch `reactDedupMapper` bridges), and `@wordpress/element` resolves to React 19
  — so runner-built sentinels are valid elements with no `$$typeof` mismatch and the
  dedup mapper truly becomes unnecessary once the realIcons test (the only importer
  of the real package) is deleted. The AddButton non-test-neutrality is real and
  correctly handled: the jsdom Button mock derives `aria-label` only from
  `label`/`aria-label` (`:48`), so dropping the inner `<Button label>` requires
  migrating the ~5 aria-label locators to text (the visible `{label}` child remains).
  The "keep the trash buttons' `label`" call is right (those labels back live test
  locators).

- **R5/R18.** `package.json:31–33` adds the real `@wordpress/icons` dependency
  (present in node_modules at 10.32.0 — bundled, not externalized like
  `@wordpress/components`, which is **absent** from node_modules). README lines 143
  ("no new runtime dependency") and 179 (ajv "first") and the dead-code README tail
  exist. The `repairPath` stale comment the design names is real (`selection.js:114`,
  "the structural editor's old `repairPath` chain") — an earlier narrow line-read
  missed it; on full-context read it is present, so R18's list is grounded.

## Completeness

Every requirement maps to a concrete design section: R1 §1/§3, R2 §10, R3 §5,
R4 §4/§6, R5 §11, R6 §2/§4, R7 §3, R8 §8, R9 §7, R10 §1/§4, R11 §4, R12 §11,
R13 §11, R14 §11, R15 §2, R16 §9, R17 §5, R18 §3/§11, R19 §11, R20 §1/§4; O1 §9,
O2 §2/§3, O3 §11, O4 §2, O5 §11. The change ordering (Phases A–D) respects real
dependencies: Phase A pure helpers first, **R20 before R1** (R1 consumes
`expansionKeyOf`), the two mock+production pairs (R16+O1, R2) kept atomic, and the
within-StructureTree sequence R1 → R7 → O2 → R18 with the docblock rewritten last.
The atomic R16+O1 and R2 pairings are justified by a concrete masking hazard, and the
doc explicitly checks that R7's DropdownMenu null-guard is undisturbed by R16/O1.

## "Green ≠ broken" guarantee (items 1, 2, 16)

Genuinely achieved for all three: each gets a real-contract e2e **plus** an
always-run jsdom guardrail that fails RED on the masked regression. R1: e2e drives
real ArrowRight/ArrowLeft; jsdom pins `expansionKeyOf` mapping + non-no-op callbacks
passed + each expandable row carries `data-expansion-key`. R2: e2e resolves by
role+name; jsdom pins aria-label present / label absent with the de-translated mock.
R16: de-helpfulized mocks make a string `icon` render nothing, and a project-wide
parametrized assertion mounts every icon host (the four leaf editors + StructureTree)
and requires the sentinel marker node. The mock "helpfulness" that hid bugs 1 and 2 is
explicitly removed in both cases.

## Scope discipline

The byte-identical front-end boundary is preserved: R8 is purely-additive dead-code
removal, R9 is React-free extraction-down (confirmed no React/`@wordpress/element`
enters the front-end bundle), R17 keeps `.is-selected` recolor-only — all pinned by
`render.spec.js` + non-interactive `svg.test.js`. No new outside dependency (icons is
already bundled). The "fine as-is" decisions (custom tree CSS, aria-hidden chevron,
toggleProps forwarding, three distinct `set*At` faces, ContextEditor draft model, no
generic EditableList, ink hard-coding, workspace flex, component placement) are
untouched. The two deferred Optional items (ToolsPanel-in-PanelBody; dashed-border
follow-up) stay out.

## Correctness of resolved decisions

- DELETE `BPM_MIN_EXCLUSIVE`, do **not** wire it as `min` — correct (exclusive 0 vs.
  inclusive `min`; `min={1}` + bounded-int clamp already enforce the bound).
- `ResizeObserver` deliberately not unified — correct (genuinely divergent lifecycles;
  unifying would drag `@wordpress/element` into the front-end bundle or strip React
  from the editor).
- `setEventAt` stays panel-only — correct (no edit.js caller; the only in-place note
  replace is in NotePanel).

## Minor, non-blocking observations (for the writer's awareness, not rework)

- **R4 / `ToolbarButton`.** `edit.js` renders two `ToolbarButton`s (`:509`, `:516`)
  besides the raw-JSON `TextareaControl`. The design's "any Button-family control"
  covers them, and `__next40pxDefaultSize` appears nowhere in `src/` today (R4's
  premise holds). In real WP, `__next40pxDefaultSize` is a `Button`/`ToolbarButton`
  prop; applying it to toolbar buttons is benign. This is a spec-scope directive the
  design faithfully carries — no design change needed, just a heads-up that the
  code-writer should apply it broadly (the acceptance gate is "no
  `__next40pxDefaultSize` deprecation warning remains").
- The design's `expansionKeyOf` always-run guard asserts "callbacks passed +
  attribute present"; it cannot drive the real arrow gating in jsdom (the mock
  swallows the callbacks). The doc is explicit that this is by design and the e2e
  owns the real keypress — acceptable and correctly scoped.

None of the above blocks approval.

## Verdict

**APPROVED.** The design is implementable on the existing code, preserves every
stated invariant, and the verification strategy makes the masked regressions
genuinely catchable. Proceed to the plan phase.
