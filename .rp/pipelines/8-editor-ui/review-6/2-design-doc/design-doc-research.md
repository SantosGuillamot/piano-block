# Review 6 — Design-doc Research

_Running record of the design-phase Q&A for **review 6** of the Piano block
editor-UI feature (issue #8, PR #22). Driven by design-doc-analyst-r6 in dialogue
with design-doc-researcher-r6. Inputs: the approved `1-spec/spec.md` (must satisfy
every requirement), `1-spec/spec-research.md` (feasibility findings F1-F4, built on,
not re-derived), and the baseline code in `src/editor/`, `src/edit.js`,
`src/style.scss`. Output: this file feeds the design-doc-writer (this file is NOT
`design-doc.md`)._

## 1. Charter — decisions this phase owns

The spec deliberately left these open; this phase DECIDES them on researcher
evidence, with alternatives and why-they-lost recorded. Each traces to a spec
requirement:

- **DD1 — Structure-surface placement** (R-D1): inline-restyled / `InspectorControls`
  panel / toolbar-secondary popover.
- **DD2 — Inspector shape** (R-D2): keep kind-gated stacked panels vs. `Navigator`
  drill-down.
- **DD3 — TreeGrid + DropdownMenu composition** (R-A1, R-A2, R-E8): the exact row
  shape, which core List View patterns to mirror.
- **DD4 — Disclosure affordance** (R-A3): stock chevron vs. non-collapsible tree.
- **DD5 — Single expansion model** (R-B1): the one-Set shape; auto-reveal keep/drop.
- **DD6 — Selection-key representation** (R-B2): what replaces the `s0/m1/rightHand/e2`
  index-path strings.
- **DD7 — Shared-helper consolidation homes** (R-B3): where `clampInt`/`toBoundedInt`,
  the splice helper, and the omit-when-empty helper live.
- **DD8 — Selected-note highlight mechanism** (R-C2, R-E1): the scale-decoupled
  replacement for the `SP_PX`-coupled hairline.
- **DD9 — Post-redesign shape of `edit.js` / `SongCanvas`** (R-B4, R-D3).
- **DD10 — Test strategy for the rework** (R-E1..R-E8 preservation).

## 2. Baseline facts grounded by reading the branch (this phase)

Line counts (JS + SCSS under `src/editor/`, `src/edit.js`, `src/style.scss`):
`StructureTree.js` 542, `edit.js` 529, `NotePanel.js` 292, `SongPanel.js` 284,
`songModel.js` 268, `SongCanvas.js` 215, `HandConfigEditor.js` 209, `ContextEditor.js`
188, `selection.js` 187, `MeasurePanel.js` 172, `SectionPanel.js` 146, `style.scss`
115 (of which the `@font-face` block, lines 16-22, is out of scope), `PitchEditor.js`
104, `AnnotationList.js` 75, `PitchList.js` 63, `MetadataEditor.js` 58, `AnnotationEditor.js`
55, `serializeSong.js` 53, `accessibleName.js` 51, `InvalidState.js` 51, `emit.js` 29,
`ListControls.js` 30. (Plus a `__tests__/` suite of ~15 files.)

Key mechanism the redesign targets, verified at file:line:

- **Dual-Set expansion + index-path strings + ancestor veto** live partly in `edit.js`
  (`expandedPaths`/`collapsedOverride` state + `onToggleExpanded`/`onToggleCollapsedOverride`,
  `edit.js:108-141`) and partly in `StructureTree.js` (`isSelectionAncestor` `:79-93`,
  the disjoint-regime `isExpanded`/`toggleRow` `:144-156`). Index-path strings
  (`s${i}`, `s${i}/m${j}`, …) are built throughout `StructureTree.js` (e.g. `:162`,
  `:261`, `:361`, `:431`) and used ONLY to key the two Sets.
- **Text-glyph carets**: `caret()` `StructureTree.js:65-67`, concatenated into the
  label `Button` text at `:199`, `:302`, `:402`.
- **Always-on per-row icon Buttons**: remove/duplicate/add-measure (`:206-251`),
  remove/duplicate measure (`:306-352`), per-hand add-note (`:406-421`),
  remove/duplicate note (`:469-529`).
- **`--pb-tree-depth`**: set inline per label Button (`style={{ "--pb-tree-depth": N }}`,
  e.g. `:190`, `:289`, `:397`, `:452`) and consumed by `style.scss:64-66`
  (`padding-left: calc(var(--pb-tree-depth, 0) * 1.5em)`).
- **Scale-coupled highlight**: `style.scss:92-113`, the `.is-selected` rule. The
  recolor floor (`:101-103`) is scale-INDEPENDENT (color only). The scale-COUPLED part
  is the hairline `outline: 0.125px` / `outline-offset: 0.25px` (`:111-112`) — the
  comment at `:105-110` explains these resolve in the staff-space user system, scaled
  1 sp → `SP_PX`(8) px, so the values are "divide-by-8" magic numbers tied to
  `SP_PX`. The highlight is applied editor-side by `SongCanvas.decorateSelection`
  (`SongCanvas.js:96-120`) via `node.classList.add("is-selected")` — never by the
  front end (`view.js` never sets the class), so the emitted SVG is unaffected.
- **Inspector mechanism duplication (R-B3), confirmed:**
  - `SongPanel.js:51-112` re-defines `toNumber`/`toBoundedInt`/`projectTempo`/
    `projectTimeSignature`/`emitContextMember` and the `tempoDraft`/`timeDraft`
    `useState` + `editTempo`/`editTimeSignature` (`:130-159`) — byte-for-byte the same
    draft/projection logic as `ContextEditor.js:53-132`, differing only in the emit
    sink (`emitBlock(song,"defaults",…)` vs `emitMember`/`onChange`). ~60 duplicated
    lines.
  - `clampInt` 3× (`NotePanel.js:73-79`; and per F4, `PitchEditor.js`, `HandConfigEditor.js`);
    `toBoundedInt` 2× (`SongPanel.js:60-66`, `ContextEditor.js:63-69`).
  - Per-panel emit-splice chains: `NotePanel.emitEvent` (`:119-128`),
    `MeasurePanel.emitMeasure` (`:64-71`), `SectionPanel.emitSection` (`:72-77`) — three
    hand-written variants of "splice a node back into the song at coords via
    `replaceAt`."
  - Omit-when-empty re-inlined ~9×: `emit.js:emitBlock`, `ContextEditor.emitMember`,
    `SongPanel.emitContextMember`, `NotePanel.changeOptional`, `MeasurePanel.changeName`/
    `changeBarline`, `SectionPanel.changeName`, the `AnnotationList` `undefined` branches.
- **Per-kind selection→settings reachability already works** (preserve, not fix):
  `edit.js:491-523` gates NotePanel on `kind==="event"`, MeasurePanel on
  `event||measure`, SectionPanel on any non-null selection, SongPanel always. Confirms
  spec R-E6 is a preserve-don't-regress invariant.
- **`songModel.js`** already houses the array helpers (`insertAt`/`removeAt`/`replaceAt`/
  `duplicateAt`, `:210-268`), the vocabularies, the numeric bounds, and the `new*`
  factories — the natural home for consolidated clamp helpers (R-B3 suggests exactly this).

## 3. Decisions

_(Filled as the Q&A resolves each topic. Each decision: the call, the spec trace, the
evidence it rests on, alternatives considered, and why they lost.)_

### DD1 — Structure-surface placement — DECIDED: A (inline in the block edit area, restyled), keep the "Structure" toolbar toggle

**Call:** the structure surface stays INLINE in the block edit area beside the canvas
(the status-quo location), restyled to drop the bespoke fixed rail and the inline depth
var. Keep the `BlockControls` "Structure" show/hide `ToolbarButton`.

**Spec trace:** R-D1 (inline is an explicitly-blessed option), R-C3 (no fixed-width
bespoke rail fighting native chrome), R-C1 (level-driven indent), R-D3 (a VIEW toggle is
not an action-entry-point, so keeping it doesn't violate "rationalize actions").

**Evidence (researcher, source-verified):**
- **The linchpin — TreeGrid is shrink-to-fit.** `__experimentalTreeGrid`
  (`packages/components/src/tree-grid/index.tsx`, trunk) renders a BARE
  `<table role="treegrid">` inside `<div role="application">`, with NO width/display/
  className of its own (props spread, that's it), and the `tree-grid/` directory ships NO
  stylesheet — its README says it is deliberately "not visually styled" (it only adds
  roving-tabindex/keyboard). An unstyled `<table>` sizes to its content's intrinsic width
  (it does NOT default to `width:100%`), so an inline TreeGrid does NOT fight the canvas
  for width. The current 16em `&__tree` rail (`style.scss:52-56`) is the ONLY thing
  giving the table a box today; remove it and the table just sizes to its widest row.
- **Inline layout-glue needed (all R-C3-permitted layout-glue, no bespoke component
  styling):** a flex container with `gap` (the `&__workspace` row minus the fixed rail);
  the tree column gets `flex: 0 1 auto; max-width: <ceiling>` (a WIDTH CEILING, not a
  fixed width, so a long note label can't grow the table without bound and starve the
  canvas) + `white-space:nowrap` + ellipsis on the label cell (mirroring List View's
  truncation idiom). The canvas already self-protects: `&__canvas { flex:1 1 auto;
  min-width:0 }` + `&__canvas-svg { min-width:280px; overflow-x:auto }`
  (`style.scss:73-86`). Net: A is CHEAPER in CSS than today (drop fixed rail + inline var;
  add a max-width ceiling + native truncation).
- **WHY the ceiling is load-bearing, not optional (mechanism precision):** a flex ITEM
  defaults to `min-width: auto`, and a shrink-to-fit `<table>` reports a LARGE min-content
  intrinsic width when a row label is long — so WITHOUT a constraint a long note label
  could push the tree column wider and squeeze the canvas. The canvas's `min-width:0`
  stops it being crushed, but does not stop the tree from growing. The `flex: 0 1 auto;
  max-width: <ceiling>` + `white-space:nowrap` + ellipsis is exactly what caps the table's
  growth and forces truncation past the ceiling — so it is the actual canvas-protection
  mechanism, not cosmetic. This is the same construction List View uses.
- **The "Structure" toggle is idiomatic:** stock `ToolbarButton` + `isActive`
  (`edit.js:410-417`), gated to non-JSON mode; core uses `BlockControls` toggles routinely
  (the editor's own List View is a toolbar toggle). It is editor-only state, already not
  persisted (`showTree`, `edit.js:108`). R-D3 targets add/remove/duplicate ACTION sprawl,
  not a view toggle, so keeping it is in-scope-clean.

**Alternative B (InspectorControls sidebar panel) — considered, LOST.** Feasible (core's
List View docks in the same 280px column and copes by TRUNCATION — `white-space:nowrap` +
the `Truncate` utility, never wrap/h-scroll; trunk `block-editor/.../list-view/style.scss`
+ `base-styles/_variables.scss` `$sidebar-width:280px`, indent `$grid-unit-30(24px) *
(level-1)`). But the level-4 NOTE-label budget in a 280px `PanelBody` is only ~124px
(280 − ~16 panel-pad − 72 indent − ~24 chevron − ~28 ellipsis − ~16 pad), so deep note
labels that read fully on the ~256px inline rail ELLIPSIS in the sidebar — a legibility
regression for the deepest, most-edited rows. Worse, B co-locates the tree with the
stacked Note+Measure+Section+Song panels (`edit.js:482-524`) in ONE 280px scroll column,
so structure competes with settings for space, and it pushes the tree away from the canvas
it drives. B's one upside (the `PanelBody` title bar is its own native show/hide, letting
the toolbar toggle be dropped) is a minor simplification that does not outweigh the
deep-row legibility loss. Recorded as the runner-up: most-native placement, but cramped.

**Alternative C (toolbar popover as SOLE home) — rejected by R-D1** (a popover must not be
the sole home of a surface the author returns to constantly). Viable only as a secondary
launcher, which the design does not need given A.

### DD2 — Inspector shape — DECIDED: KEEP the kind-gated stacked panels (no Navigator)

**Call:** keep the four kind-gated stacked `PanelBody` panels in `InspectorControls`
(Note → Measure → Section → Song), driven by `resolvedSelection.kind` as a pure render
(`edit.js:491-523`). Do NOT adopt `Navigator`/`useNavigator`. The review's
simplification budget goes to R-B3 de-dup (DD7), which is shape-independent.

**Spec trace:** R-D2 (panel shape OPEN, a MAY; keeping stacked panels is an explicit
allowed option), AC-D2 (selection shows that node's settings — satisfied by pure render;
the Navigator-route-sync clause is CONDITIONAL on choosing Navigator and so does not
apply), R-E6 (per-kind settings on selection — already working, preserved), R-B3/R-E5/R-E6
(the falsifiable wins, spec-stated as shape-independent, land either way).

**Evidence (researcher, source-verified):**
- **Navigator is UNCONTROLLED.** Trunk `packages/components/src/navigator/navigator/
  component.tsx`: the route lives in an internal `useReducer`; `initialPath` is consumed
  ONCE as the lazy initializer; the public contract (README) is `initialPath` (required)
  + IMPERATIVE `useNavigator().goTo()`/`goBack()`; `location` is READABLE via the hook but
  NOT settable from outside; there is NO controlled `path`/`location` prop and NO
  `onChange`/`onNavigate` callback. So there is NO clean "tree selection is the single
  source of truth, route is a pure function of it" binding — the route cannot be passed
  as a prop.
- **Sync would need two opposite imperative bridges.** Tree→inspector: an effect watching
  the selection that imperatively `goTo(pathForSelection)` with a guard against redundant
  pushes. Inspector→tree: Navigator emits no event on route change, so a native
  `NavigatorBackButton`/`ToParentButton` (the whole POINT of Navigator) would NOT update
  the tree selection unless a second effect reads `useNavigator().location` and pushes it
  back up. Two effects over two state owners with no controlled prop = the classic
  two-way-sync hazard (feedback loops, redundant-goTo guards, focus-stealing on spurious
  re-syncs) — exactly the risk F4 flagged.
- **Navigator `goTo`/`goBack` MOVE FOCUS by design** (`focusTargetSelector`/the
  `focusSelectors` map in that reducer). A selection-driven `goTo` would yank focus into
  the inspector on every tree-row click — fighting the TreeGrid roving-tabindex preserved
  for R-E8. Another reason the bridge is not free.
- **Stacked panels satisfy AC-D2's main clause by pure render.** `resolvedSelection =
  resolveSelection(working, selection)` recomputed every render (`edit.js:199`); the panels
  gate on `.kind` (`edit.js:491-523`). No second nav model exists, so the only AC-D2 clause
  that can FAIL (route ≠ selection) is structurally absent.
- **4 stacked PanelBodys is normal core density, not a smell.** Core blocks routinely
  stack 4-6 `PanelBody`/`ToolsPanel` in the 280px sidebar (Image: Settings + dimensions +
  filter + Advanced; Group/Columns: Layout + Color + Typography + Dimensions + Border +
  Advanced; the document sidebar stacks even more). Here the panels are kind-GATED so the
  4-panel max appears ONLY at the deepest event selection — nothing selected → 1 (Song),
  section → 2, measure → 3, event → 4 (`edit.js:491-523`) — each collapsible. No density
  problem for Navigator to solve.

**Alternative (Navigator drill-down) — considered, LOST.** Shippable (stable, importable),
and shows one screen at a time (arguably fewer things on screen). But it REPLACES the
current 1-state model (selection in `edit.js`, panels are a pure render of it) with a
2-state imperative two-way-sync model (no controlled route prop, no onChange), steals focus
on selection (fights R-E8), and HIDES the ancestor context that the stacked Section/Measure
panels give for free ("this note is in Measure 3 of Section 2"). No guaranteed line
reduction. The review's real win (R-B3) is shape-independent, so Navigator buys nothing the
spec asks for while adding sync-correctness risk. Recorded as the runner-up.

### DD3 — TreeGrid + DropdownMenu composition — DECIDED: mirror core's List View row exactly

**Call — the redesigned row shape (mirrors `block-editor/.../list-view/block.js`):** each
selectable row (section/measure/note) is TWO `TreeGridCell`s, each a render-prop forwarding
`{ ref, tabIndex, onFocus }` to exactly ONE focusable:
- **Contents cell:** render-prop → the label `Button` (SELECT-only, see DD4/click
  semantics), with the chevron disclosure glyph as a NON-focusable child beside it.
- **Actions cell:** render-prop → a single `DropdownMenu` whose trigger receives
  `toggleProps={{ ref, tabIndex, onFocus }}`, `icon={moreVertical}`. The popover's own
  focus-management (open on Enter/Space/click, trap while open, Escape restores focus to
  the trigger) operates INSIDE that one roving-tabindex focusable.

The non-selecting hand-group row is the same two cells, but its contents-cell focusable is
a toggle-on-click button (expand-only, no select) and its actions cell holds the single
"Add note" affordance (see item 4 below).

**Spec trace:** R-A2 (native per-row menu, not an always-on icon-button row; per-row
accessible name; `isDestructive` remove), R-E8 (every interactive row element stays a
TreeGrid roving-tabindex focusable), R-A1/R-E2 (`DropdownMenu`/`MenuGroup`/`MenuItem`
stable, `moreVertical` from `@wordpress/icons`), R-D3 (one primary action locus per
action — the row menu).

**Evidence (researcher, source-verified from List View):**
- Core's row = 2-3 `TreeGridCell`s, ONE focusable per cell via the cell's render-prop. The
  actions cell wraps the menu: `<TreeGridCell ...>{({ ref, tabIndex, onFocus }) =>
  <BlockSettingsMenu toggleProps={{ ref, tabIndex, onFocus, ... }} />}</TreeGridCell>`. The
  three forwarded props are exactly how the roving tabindex reaches the trigger.
- **CORRECTION to today's code:** today's rows put 3 action Buttons in `TreeGridItem`s
  inside ONE shared second cell (`StructureTree.js:203` cell wrapping `:206/:221/:235`
  items) — the multi-focusable-in-one-cell pattern, needed because there are 3 buttons.
  When the 3 collapse to ONE `DropdownMenu`, `TreeGridItem` is no longer needed: give the
  menu its OWN `TreeGridCell` render-prop, mirroring core (one focusable per cell).
  `TreeGridItem` is only for >1 focusable in a single cell, which the redesign no longer
  has.

**Per-kind menu contents (item 4, confirmed idiomatic):**
- Section row menu: { Duplicate, Add measure, Remove (`isDestructive`) }.
- Measure row menu: { Duplicate, Remove (`isDestructive`) }.
- Note row menu: { Duplicate, Remove (`isDestructive`) }.
- Hand-group row: a SINGLE direct "Add note" `Button` (NOT a 1-item `DropdownMenu`).
  **Justification:** R-A2's target is the always-on icon-button-ROW; one labeled action
  button is not that anti-pattern, and core's practice is a lone action stays a direct
  button (a 1-item kebab is an extra click for no grouping benefit). Recorded alternative:
  give hand rows the same DropdownMenu with just { Add note } for visual uniformity — also
  R-A2-compliant but the slightly-awkward 1-item-menu core avoids. Decision: direct Button.
- **Accessible names:** each `DropdownMenu` gets `label={ sprintf( __('Actions for %s'),
  ordinal ) }` reusing the sprintf ordinals already computed (`StructureTree.js:211-215`
  sections, `:314-322` measures, `:477-487` notes). The hand-row single button reuses its
  existing full `addNoteLabel` (`:370-379`, e.g. "Add note to Right hand of measure 1 of
  section 1") verbatim.

### DD4 — Disclosure affordance — DECIDED: a stock NON-focusable chevron glyph (keyboard expand stays TreeGrid arrows); label is SELECT-only

**Call:** replace the `▸`/`▾` TEXT glyph (`StructureTree.js:caret() 65-67`, concatenated
into the label at `:199,:302,:402`) with a stock NON-focusable `<Icon>` chevron
(`chevronRightSmall` collapsed / `chevronDownSmall` expanded, RTL-aware) shown beside the
label inside the contents cell — NOT a separate focusable. Its POINTER onClick routes to
the expansion toggle; KEYBOARD expand/collapse stays TreeGrid's Left/Right arrows (free
from `role="treegrid"`). The label `Button` becomes SELECT-only (it no longer also toggles
expansion).

**Spec trace:** R-A3 (stock disclosure affordance, not a hand-built text glyph; carets
removed), R-E8 (no NEW tab-stop — the chevron is non-focusable, so keyboard parity holds
by construction), R-B1 (select-only removes the select↔toggle coupling, see synergy below).

**Evidence (researcher, source-verified):**
- Core's `ListViewExpander` (`block-editor/.../list-view/expander.js`) is a
  `<span aria-hidden="true">` with NO tabIndex / NO role — a deliberately non-focusable
  visual pseudo-control wrapping `<Icon icon={ isRTL() ? chevronLeftSmall : chevronRightSmall }>`.
  It has a MOUSE onClick (forceToggle) for pointer users but is invisible to keyboard/SR;
  the real keyboard path is TreeGrid Left/Right reading each row's `aria-expanded`. So the
  redesign's chevron is NOT a third focusable to wrap (it answers my "is it a third
  tab-stop" question: NO).
- Core's label is SELECT-ONLY (`block-editor/.../list-view/block-select-button.js`:
  `onClick` selects only; expand/collapse is the sibling expander + TreeGrid arrows). This
  is a behavior change from today's dual `toggleRow` THEN `onSelect` (`StructureTree.js:
  194-197`).

**R-B1 / DD5 SYNERGY (important):** today's dual "select also toggles" is part of WHY the
`collapsedOverride` veto exists — selecting an expanded section also collapses it, so the
machine needs a veto to make a manual collapse stick against auto-reveal. Splitting to
SELECT-only removes that coupling: a click selects-and-reveals without ever collapsing, so
the second veto Set is unnecessary. This independently confirms DD5's "single Set, no veto"
and strengthens the case to DROP the standing auto-reveal in favor of select-time
ancestor-seeding.

**Forward note for DD10 (e2e):** when the carets go, the e2e note-row locator
(`specs/editor.spec.js:281-288`, built to TOLERATE `▸`/`▾` in labels) must drop its
caret-tolerant regex → plain name. The chevron rotation/expanded-icon detail (core swaps
right/down icons; some places rotate one via CSS) is an implementation nicety the
code-writer mirrors from core — not a design decision.

### DD5 — Single expansion model — DECIDED (F2 + R-B1; reinforced by DD4's select-only label)

_Promoted from provisional: DD4's source-verified finding that core's label is SELECT-only
removes the select↔toggle coupling that today motivates the `collapsedOverride` veto. With
select-only + select-time ancestor-seeding, a click selects-and-reveals without ever
collapsing, so the second veto Set is provably unnecessary — confirming the call below._

**Call:** one `Set` of expanded *node keys* (see DD6) lives in `edit.js`, replacing
both `expandedPaths` and `collapsedOverride`. One `onToggleExpanded(key)` toggles
membership (the immutable add/delete already at `edit.js:114-124`). `StructureTree`'s
`isExpanded(key) = expanded.has(key)` — a single lookup, no ancestor test, no veto.
The `isSelectionAncestor`/disjoint-regime logic (`StructureTree.js:79-93,144-156`) is
deleted.

**Auto-reveal-on-select: DROP it.** R-B1 makes it a product choice; F2 says if kept it
collapses to "add the selection's ancestor keys to the one Set." But dropping it is
strictly simpler and there is no spec requirement to keep it. The author selecting a
deep note row implies that row is already visible (you can't click a hidden row), so
auto-reveal only mattered for *programmatic* selection (duplicate/add auto-selects the
new node — `edit.js:229,355,370,394`). For those, the redesign seeds the new node's
ancestor keys into the Set at the same commit (a one-liner in the mutator), which is
exactly F2's "trivial add-ancestors" form — NOT a standing auto-reveal regime in the
tree. Net: no ancestor-detection code in `StructureTree` at all.
_(Alternative: keep a render-time auto-reveal. Lost: it reintroduces the ancestor test
the spec wants gone, for a case that only arises programmatically and is cleaner handled
at the mutation site.)_

**Spec trace:** R-B1 (single model, no veto Set), R-B4 (mechanism removed), R-E8
(expansion still drives `isExpanded`/`aria-expanded`).

### DD6 — Selection-key representation — DECIDED (determined by R-B2 + DD5)

**Call:** drop the `s0/m1/rightHand/e2` index-path STRINGS entirely. Two distinct needs
they conflated:

1. **React `key`** for each `TreeGridRow`: use a per-row key built inline from the
   coords (e.g. `key={`s${si}`}` / `` `s${si}m${mi}` `` / `` `s${si}m${mi}${hand}` `` /
   `` `s${si}m${mi}${hand}e${ei}` ``). These are plain JSX keys for list stability,
   never stored in app state.
2. **Expansion-Set membership** (the only reason the strings existed as state, per F2):
   only the three EXPANDABLE kinds (section, measure, hand) need a key. Use the SAME
   coordinate-derived string as the React key for those rows, so one helper
   (`expansionKey(coords)`) produces both. Notes are leaves — never expandable — so they
   never enter the Set.

The selection itself is already coordinate-tuples (`{ kind, sectionIndex, measureIndex,
hand, eventIndex }`, `selection.js`) and STAYS that shape — it was never the index-path
string. So R-B2 is satisfied: the strings as a stored addressing scheme are gone; what
remains is a thin key derivation co-located with the row render, plus the unchanged
coordinate selection tuples. Direct coordinate handlers (the lifted `edit.js` mutators
already take `(sectionIndex, measureIndex, hand, eventIndex)`) need no path parsing.

**Spec trace:** R-B2 (strings removed, plain keys + direct coordinate handlers),
AC-B2.

### DD7 — Shared-helper consolidation homes — DECIDED (R-B3 + code read + researcher confirm of the splice dispatch)

Grounded by reading all five panels + the leaf editors. Confirmed duplications and their
consolidation homes:

- **`clampInt(raw, min, max)`** — identical 3× (`NotePanel.js:73-79`,
  `PitchEditor.js:98-104`, `HandConfigEditor.js:196-202`). Home: `songModel.js` (already
  the home of the numeric bounds it clamps to, e.g. `OCTAVE_MIN/MAX`, `DOTS_MIN/MAX`).
- **`toNumber` + `toBoundedInt(raw, min)`** — identical 2× (`SongPanel.js:51-66`,
  `ContextEditor.js:53-69`). Home: `songModel.js`.
- **Draft/projection logic** (`projectTempo`/`projectTimeSignature` + the
  `tempoDraft`/`timeDraft` `useState` + `editTempo`/`editTimeSignature`) — copied
  verbatim `SongPanel.js:68-159` ⟷ `ContextEditor.js:71-132`. **Resolution (per F4):**
  give `ContextEditor` a disclosure/layout prop so `SongPanel` COMPOSES `ContextEditor`
  over `defaults` (the way `SectionPanel` already composes it over overrides,
  `SectionPanel.js:129-133`) instead of re-implementing it. This removes the ~60-line
  fork; the projection/draft logic lives once in `ContextEditor`. The split of
  `defaults` into "common-visible + advanced-disclosed" that motivated the fork becomes
  a `ContextEditor` prop, not a copy.
- **Emit-splice chains** — `NotePanel.emitEvent` (`:119-128`), `MeasurePanel.emitMeasure`
  (`:64-71`), `SectionPanel.emitSection` (`:72-77`): three `replaceAt`-based "splice a
  node back into the song at coords." **DECIDED: one splice MECHANISM with THREE typed
  faces — `setSectionAt(song, { sectionIndex }, nextSection)` /
  `setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure)` /
  `setEventAt(song, { sectionIndex, measureIndex, hand, eventIndex }, nextEvent)` — each
  destructuring ONLY its own coords and delegating to one private `replaceAt`-down-the-path
  core.** Home: `songModel.js` (same pure-array-surgery family as `replaceAt`/`insertAt`/
  `removeAt`/`duplicateAt`). This is R-B3's "single splice-into-song-at-coordinates helper"
  with the depth made explicit at each call site.
  - **CRITICAL design-note (researcher caught a bug in my first candidate):** the dispatch
    MUST be by EXPLICIT caller-declared depth, NOT "deepest-defined-coord wins." Reason:
    when an EVENT is selected, `edit.js` renders Note + Measure + Section panels
    SIMULTANEOUSLY and passes the SAME full `resolvedSelection` to all three
    (`edit.js:491-517`); `resolveSelection` returns the full event resolution
    `{ section, sectionIndex, measure, measureIndex, event, hand, eventIndex }`
    (`selection.js:161-170`). So SectionPanel and MeasurePanel each receive a selection
    that carries `eventIndex` even though they write at section/measure depth. A
    "deepest-coord-wins" `setAtPath(song, resolvedSelection, nextSection)` would mis-splice
    `nextSection` at the EVENT coord and corrupt the song. The three typed faces each
    destructure only their own coords, so a stray deeper coord is structurally ignored —
    impossible to mis-dispatch. (This is also WHY today's code has three separate
    functions: they encode the depth in the function identity; the consolidation preserves
    that depth-explicitness while sharing the splice core.)
- **Omit-when-empty** — re-inlined ~9× (`emit.js:emitBlock`, `ContextEditor.emitMember`,
  `SongPanel.emitContextMember`, `NotePanel.changeOptional`, `MeasurePanel.changeName`/
  `changeBarline`, `SectionPanel.changeName`, the `AnnotationList` undefined branches).
  Home: **`inspector/emit.js`** (alongside the existing `emitBlock`) — DECIDED to KEEP this
  split from `songModel.js`. One `omitEmpty(obj, key, value)` (set `key` when `value` has
  set fields, else delete) — the exact body shared by `emitBlock`/`emitMember`/
  `emitContextMember`; plus a sibling `omitFalsy(obj, key, value)` for the string-`name`/
  falsy-scalar variants (`changeName`/`changeBarline`/`changeOptional`). **Why split, not
  one home:** `songModel.js`'s stated purpose is song-SHAPE surgery (vocabularies + new-item
  factories + array helpers — pure shape ops); `omitEmpty`/`emitBlock` are EMIT POLICY
  (decide a key's presence on emit), a different nature, and `emit.js` is already their
  home. So `setAtPath`-faces + clamps (`clampInt`/`toBoundedInt`/`toNumber`) → `songModel.js`;
  `omitEmpty`/`omitFalsy`/`emitBlock` → `inspector/emit.js`. (One home is possible but the
  two-home split matches the existing conceptual boundary.)

**Spec trace:** R-B3 (clamp helpers once in `songModel.js`; one splice mechanism; one omit),
AC-B3, R-B4. **Note R-B3 is visual-change-independent** — no control/layout change, so
the existing panel TESTS should pass UNCHANGED after consolidation (a strong DD10 anchor).

### DD8 — Selected-note highlight mechanism — DECIDED: RECOLOR-ONLY (delete the scale-coupled outline)

**Call:** keep the three recolor lines (`style.scss:101-103`) as the whole highlight;
DELETE the enclosing hairline outline rule (`:111-112`) and its scale-coupled `0.125px`/
`0.25px` values + the divide-by-8 explainer comment (`:105-110`). The selected event's full
glyph (heads, stem, ledgers, dots, dynamic/text) recolors to selection blue — a strong,
unambiguous, scale-INDEPENDENT cue. No ring.

**Spec trace:** R-C2 (NO scale-coupled magic number remains in SCSS; highlight still works),
R-E3/AC-C2 (selected event still visibly highlighted on canvas), R-E1/AC-C2/AC-E1
(byte-identical emitted SVG + `data-*` — the recolor stays a post-render editor-only class
added by `SongCanvas.decorateSelection`, `SongCanvas.js:96-120`; `view.js` never sets it).

**Why the outline is scale-coupled (grounded at source):** the SVG root carries
`viewBox="0 0 widthSp heightSp"` (sp units) AND a pixel `width = widthSp * SP_PX`
(`svg.js:290-292`, `SP_PX=8` `constants.js:19`). The selected `<g>` is a child of that
root, so it lives in the sp USER space (1 user unit = 1 sp = 8 px) — hence `outline:
0.125px` (≈1 px) and `outline-offset: 0.25px` (≈2 px) are the ÷8 numbers tied to `SP_PX`.

**Why `filter: drop-shadow` is NOT a clean replacement (researcher, definitive, verified
against W3C SVG 1.1 Filter Effects):** a `filter` on the scaled `<g>` ALSO resolves in the
sp user space, so it is JUST AS scale-coupled. `drop-shadow`'s blur compiles to
`feGaussianBlur stdDeviation`, whose length is interpreted in the user coordinate system in
place — which for a `<g>` inside the scaled viewBox is the sp space. So
`drop-shadow(0 0 1px)` = a 1-user-unit = 1 sp = 8 CSS px halo; to get ~1 CSS px you'd write
`drop-shadow(0 0 0.125px)` — the SAME ÷8 magic number, merely relocated. GENERAL RULE: any
length-bearing CSS decoration on the scaled `<g>` (outline width, box-shadow, filter blur)
inherits the sp user space and is therefore scale-coupled. The only true constant-px ring
would be an HTML overlay over the glyph's screen bbox — a disproportionate rewrite for an
editor cue, rejected.

**Why recolor-only is sufficient (not a regression):** the recolor floor is ALREADY the
cue the design relies on cross-engine — its own comment (`style.scss:105-110`) notes the
outline "may no-op on Safari for a `<g>`, hence the recolor floor above." So the outline is
a secondary embellishment that doesn't even render on one major engine; the full-glyph
recolor is the actual signal, on every engine. `fill`/`stroke` are colors (no length), so
they carry NO scale coupling. Dropping the outline does not meaningfully weaken the cue.

**Alternative (a ring) — considered, LOST.** `filter: drop-shadow` is scale-coupled (above)
so it just moves the magic number; an HTML overlay is disproportionate. No AC requires a
ring (AC-C2 only requires the event remain "visibly highlighted"), so recolor-only is the
minimal compliant answer.

### DD9 — Post-redesign shape of edit.js / SongCanvas — DECIDED (DD1 resolves the placement-gated parts)

- **`edit.js` state shrinks:** the three expansion-related Sets/handlers
  (`expandedPaths`, `collapsedOverride`, `onToggleExpanded`,
  `onToggleCollapsedOverride`, `edit.js:108-141`) collapse to ONE `expanded` Set + one
  `onToggleExpanded` (DD5). **`showTree` STAYS** (DD1 keeps the inline "Structure" toggle).
  Net `edit.js` UI-state goes from 4 pieces (`showTree` + 3 expansion) to 2 (`showTree` +
  1 expansion Set), plus `selection`/`mode` unchanged.
- **The lifted mutators stay in `edit.js`** (it is the single owner of `working` +
  `commit`; `edit.js:210-401`). They already take direct coordinates, so DD6 needs no
  change to them. Programmatic auto-select after add/duplicate (DD5) gains a one-line
  "seed ancestor keys into `expanded`" at each mutator that auto-selects a new deep node
  (`onAddNote`, `onDuplicateMeasure`, `onDuplicateNote`).
- **`SongCanvas` is nearly untouched:** it already applies the highlight as an
  editor-only post-render decoration (`SongCanvas.js:96-120`). DD8 changes only the CSS
  the `.is-selected` class triggers, not the JS that adds it — so `SongCanvas.js` and
  `decorateSelection` need no logic change (possibly delete a now-unused `SP_PX` import
  if the JS ever referenced it — it imports `SP_PX` for width math at `:31`, unrelated to
  the highlight, so it STAYS).
- **`StructureTree` shrinks substantially:** delete `caret` (DD4), `isSelectionAncestor`
  + disjoint `isExpanded`/`toggleRow` (DD5), the index-path string state (DD6), the
  always-on icon-Button cells → one `DropdownMenu` per row (DD3), the
  `--pb-tree-depth` inline style (DD-CSS). The inherent flatten loop + per-row
  `level`/`positionInSet`/`setSize` STAYS (R-B4 names it inherent).

**Workspace wrapper (DD1):** the inline `__workspace` flex div (`edit.js:455`) STAYS — the
tree remains inline beside the canvas; the `StructureTree` props change only by the
expansion-Set collapse (one `expanded` + `onToggleExpanded` instead of the two Sets + two
toggles) and the dropped `collapsedOverride`/`onToggleCollapsedOverride`. No move to
`InspectorControls`.

### DD-CSS — Editor CSS rework (R-C1/R-C2/R-C3) — DECIDED (consolidates the SCSS decisions)

The editor region of `style.scss` (`:24-114`, excluding the out-of-scope `@font-face`
`:16-22`) is reworked to layout-glue only:
- **R-C1 — indentation:** delete the `--pb-tree-depth` inline var (set in JS at
  `StructureTree.js:190/289/397/452`) and the `&__tree &-label { padding-left: calc(var(
  --pb-tree-depth,0) * 1.5em) }` rule (`style.scss:64-66`). Replace with an attribute-keyed
  SCSS rule selecting on the rendered `[aria-level="N"]` (which `TreeGridRow`'s `level`
  prop already emits) — core's own idiom (List View uses `@for` × a grid unit). ZERO JS
  injection. (DD3's row keeps `level={1..4}` on each `TreeGridRow`, which is what emits
  `aria-level`.)
- **R-C2 — highlight:** delete the scale-coupled outline (`:111-112`) + its ÷8 comment
  (`:105-110`); keep the recolor lines (`:101-103`). See DD8. No `SP_PX`-coupled number
  remains.
- **R-C3 — layout-glue only:** delete the fixed `&__tree { width:16em }` rail
  (`:52-67`); replace with layout-glue on the tree column (`flex: 0 1 auto; max-width:
  <ceiling>` + `white-space:nowrap` + ellipsis on the label cell — DD1's canvas-protection
  mechanism). Keep the `&__workspace` flex row (`:42-47`), `&__canvas` (`:73-79`),
  `&__canvas-svg` (`:84-88`) — all legitimate layout-glue. No bespoke component styling,
  no fixed-width rail. The dashed-border block scaffold (`:24-28`) is pre-existing
  placeholder chrome, out of this review's scope to remove (not editor structure CSS the
  spec targets).

**Spec trace:** R-C1 (level-driven indent, no inline var), R-C2 (no scale-coupled magic
number; highlight works), R-C3 (layout-glue only; no fixed bespoke rail), AC-C1/AC-C2/AC-C3.

### DD10 — Test strategy — DECIDED (grounded against the existing suites; DD1-DD4 resolve the selectors)

Two test surfaces exist and both touch the redesign:
- **Unit suite** `src/editor/__tests__/` (~15 files). `StructureTree.test.js` (523 lines)
  is tightly coupled to the OLD mechanism: it strips caret glyphs in its row-finder
  (`selectButtonByText` does `.replace(/^[▸▾]\s*/, "")`, `:64-75`), seeds `expandedPaths`
  + `collapsedOverride` Sets (`:131-142`), and asserts the dual-Set veto behavior
  (`:429-489`). These tests MUST be rewritten for the redesign: caret-strip → plain name
  (DD4 removes glyphs), dual-Set assertions → single-Set (DD5), per-row icon-button
  labels (`buttonByLabel(container, "Remove section 2")`, `:333`) → DropdownMenu items
  (open the row's menu, then click the `MenuItem`). The ARIA-wiring assertions
  (`aria-level`/`-posinset`/`-setsize`/`-expanded`, `:505-523`) STAY (TreeGrid still emits
  them) and are the keyboard/a11y anchor for R-E8.
- **Inspector panel tests** (`NotePanel/MeasurePanel/SectionPanel/SongPanel.test.js`,
  `pitches/annotations/contextControls/songModel.test.js`): because R-B3 consolidation is
  visual-change-independent (DD7), these SHOULD pass UNCHANGED — they are the regression
  net proving the de-dup didn't alter behavior. New unit tests cover the extracted
  helpers (`clampInt`/`toBoundedInt`/`setAtPath`/`omitEmpty`) directly.
- **E2e** `specs/editor.spec.js` + `specs/render.spec.js`. `editor.spec.js` is coupled to:
  the caret-prefix row regex (`:280-305`), the `.wp-block-piano-block-piano__tree` class
  + "Structure" toggle (`:262-271`), per-row icon-button labels (`:302`), and the
  `is-selected` decoration assertion (`:206`, `:455`). Migration: caret-regex → plain end-
  anchored name; per-row action labels → open-menu-then-click; the `is-selected`
  assertion STAYS valid (DD8 keeps the class via the recolor floor). `render.spec.js`
  asserts the published SVG — it MUST stay green untouched (R-E1 byte-identical; AC-E1).
- **Anchor invariants the tests must pin (one per preserved requirement):** byte-identical
  publish (render.spec, R-E1/AC-E1); per-kind selection→settings (R-E6/AC-E6);
  field-reachability incl. buried fields (R-E5/AC-E5); valid-by-construction (R-E4/AC-E4);
  raw-JSON unchanged (R-E7/AC-E7); keyboard/roving-tabindex incl. the new DropdownMenu
  trigger inside `TreeGridCell`/`TreeGridItem` (R-E8/AC-E8 — e2e, since jsdom mocks don't
  exercise real roving tabindex, per `StructureTree.test.js:21-23`).

**Concrete e2e migration (now that DD1-DD4 are decided):**
- Placement: inline (DD1), so the `.wp-block-piano-block-piano__tree` class + "Structure"
  toggle assertions (`specs/editor.spec.js:262-271`) STAY valid — no sidebar-panel
  selector change.
- Row actions: per-row icon-button label lookups (`buttonByLabel(…, "Remove section 2")`,
  e2e `:302`) → open the row's `DropdownMenu` (the `moreVertical` trigger, accessible name
  "Actions for Section 2") THEN click the `MenuItem` ("Remove"/"Duplicate"/"Add measure").
  Hand-row "Add note" STAYS a direct button (DD3), so its locator is unchanged.
- Carets: the caret-tolerant note-row regex (`:281-288`) → plain end-anchored name (DD4
  removes the glyphs).
- Highlight: the `is-selected` assertion (`:206`, `:455`) STAYS valid (DD8 keeps the class).
- `render.spec.js` stays green untouched (R-E1).

**Test-strategy summary:** rewrite `StructureTree.test.js` for the new row shape (the
components mock at `test/mocks/wordpress-components.js` needs `DropdownMenu`/`MenuGroup`/
`MenuItem` stubs ADDED — it has none today per the Q0 caveat; this is a concrete plan-phase
touch-point. With the stubs, jest proves STRUCTURE: row inventory, per-row menu `label`,
kind-gated menu contents, single-Set toggle, plain-key addressing); keep the ARIA-wiring
assertions; lean on the Playwright e2e suite for the A11y/keyboard composition
(focus-trap/restore, roving tabindex reaching the menu trigger) that the mock can't prove;
keep the inspector panel tests as the unchanged-behavior regression net for R-B3; add
direct unit tests for the extracted helpers (`clampInt`/`toBoundedInt`/`setSectionAt`/
`setMeasureAt`/`setEventAt`/`omitEmpty`/`omitFalsy`).

**Two concrete plan-phase touch-points to carry forward (researcher housekeeping note):**
(1) the components mock `test/mocks/wordpress-components.js` must gain `DropdownMenu`/
`MenuGroup`/`MenuItem` stubs for the structural unit tests (R-A2/DD3); (2) the e2e
caret-tolerant note-row locator (`specs/editor.spec.js:281-288`) must drop its `▸`/`▾`
regex when DD4 removes the glyphs. Both are implementation tasks already implied by the
decisions — flagged here so the planner sees them coming.

## 4. Q&A log

### Q0 — Researcher pre-flight (unprompted) — RECEIVED

Established before Q1's substance, all to be cited in the final record:
- **Component availability (Gutenberg trunk):** `DropdownMenu`/`MenuGroup`/`MenuItem`/
  `Dropdown` STABLE; `Navigator`/`useNavigator` STABLE; `__experimentalTreeGrid*`
  public-experimental (already shipped); `privateApis`/`lock` forbidden (R-A1). Icons
  `chevronRightSmall`/`chevronDownSmall`/`chevronLeftSmall`/`moreVertical` all exist in
  `@wordpress/icons`. → DD3/DD4 component choices are all available + stable.
- **DropdownMenu-in-TreeGrid is core's OWN shipped pattern:** List View's row
  (`block-editor/src/components/list-view/block.js`) wraps its actions menu in a
  `TreeGridCell` render-prop forwarding `{ ref, tabIndex, onFocus }` into the trigger via
  `toggleProps`, icon `moreVertical`. → DD3 mirrors this exactly.
- **Level-driven indentation:** core does NOT use an inline CSS var; List View SCSS
  selects on the rendered `[aria-level="N"]` attribute (`@for` loop × a grid unit), and
  `TreeGridRow`'s `level` prop already emits `aria-level`. → the bespoke inline
  `--pb-tree-depth` (`StructureTree.js:190/289/397/452` + `style.scss:64-66`) is
  replaceable by an attribute-keyed SCSS rule with ZERO JS injection (R-C1).
- **EXPERIMENT CAVEAT (shapes DD10):** the unit suite maps `@wordpress/components` to a
  hand-written DOM-honest MOCK (`test/mocks/wordpress-components.js`) — no `DropdownMenu`/
  `Dropdown`/`Navigator` export, and it simulates NONE of TreeGrid's roving-tabindex or
  DropdownMenu's focus-trap/restore. So jest can prove STRUCTURAL outcomes (row inventory,
  per-row `label`, single-Set toggle, kind-gated menu contents, plain-key addressing) with
  a stub added, but the A11y/keyboard composition (AC-A2/AC-A8) proof rests on core's
  shipped pattern + the Playwright e2e suite, NOT jest.
- **Inspector duplication map confirmed** (matches DD7): `clampInt` 3× (`NotePanel.js:73`,
  `HandConfigEditor.js:196`, `PitchEditor.js:98`); `toNumber`/`toBoundedInt`/`projectTempo`/
  `projectTimeSignature` identical `ContextEditor.js:53-94` ⟷ `SongPanel.js:50-91`;
  omit-when-empty inlined ~9×; three splice variants. `emit.js` + `songModel.js` the
  natural homes.
- **Baseline clean:** working tree clean, `npx jest` 642/642 green, build tooling present.
  → DD10's "panel tests pass unchanged after R-B3" claim has a 642-test green baseline.

### Q1 — Structure-surface placement (R-D1) — ANSWERED → DD1 DECIDED: A (inline)

Researcher verified from source: `__experimentalTreeGrid` renders a BARE unstyled
`<table role="treegrid">` (shrink-to-fit, NOT width:100%; the `tree-grid/` dir ships no
stylesheet, README "not visually styled") — so inline needs only flex+gap + a max-width
ceiling + native truncation, cheaper than today's fixed rail and R-C3-clean. The sidebar
(B) level-4 note-label budget is only ~124px (vs ~256px inline) so deep labels ellipsis,
and B stacks the tree with 4 settings panels in one 280px scroll. The "Structure" toggle
is idiomatic and outside R-D3's action scope. Full detail in DD1.

### Q2 — Inspector shape (R-D2) — ANSWERED → DD2 DECIDED: keep stacked panels

Researcher verified from source: `Navigator` is UNCONTROLLED (route in an internal
`useReducer`; `initialPath` consumed once; imperative `goTo`/`goBack` only; no controlled
`path`/`location` prop, no `onChange`). So sync needs two opposite imperative effect
bridges over two state owners (the two-way-sync hazard F4 flagged), and `goTo` steals
focus by design (fights the TreeGrid roving-tabindex for R-E8). Stacked panels satisfy
AC-D2's main clause by pure render; 4 kind-gated collapsible panels is normal core density
(Image/Group stack 4-6), not a smell. R-B3 is shape-independent. Full detail in DD2.

### Q3 — TreeGrid row composition (DD3 R-A2/R-E8 + DD4 R-A3) — ANSWERED → DD3 + DD4 DECIDED

Researcher source-verified core's List View row and corrected two of my guesses:
- DD3: mirror core exactly — 2 `TreeGridCell` render-props per selectable row, ONE
  focusable each (label cell + actions cell holding ONE `DropdownMenu` with
  `toggleProps={{ ref, tabIndex, onFocus }}`). Drop `TreeGridItem` (only for >1 focusable
  per cell, which the 3→1-menu collapse removes). Per-kind menus confirmed; hand-group
  "Add note" stays a plain Button (R-A2 targets the icon-button-ROW, not a lone action).
- DD4: the chevron is a NON-focusable `<span aria-hidden>`/`<Icon>` glyph
  (`chevronRightSmall`/`chevronDownSmall`, RTL-aware); pointer-click toggles, keyboard
  expand stays TreeGrid arrows — NOT a third tab-stop. The label is SELECT-only (core's
  block-select-button is select-only), a change from today's dual select+toggle.
- **R-B1 synergy:** select-only removes the select↔toggle coupling that today motivates
  the `collapsedOverride` veto → confirms DD5's single-Set-no-veto and the drop of standing
  auto-reveal. Full detail in DD3 + DD4. → DD5 promoted to DECIDED.

### Q4 — DD7 setAtPath shape + DD8 highlight primitive (confirmations) — ANSWERED → DD7 + DD8 DECIDED

Researcher caught a real bug and gave a definitive scale-coupling verdict:
- **DD7 splice:** "deepest-defined-coord wins" is a BUG — `edit.js` renders Note+Measure+
  Section panels simultaneously with the SAME full `resolvedSelection` (carrying event
  coords) to all three (`edit.js:491-517`), so a coords-present dispatch would let
  SectionPanel mis-splice `nextSection` at the event coord. Fix: three typed faces
  (`setSectionAt`/`setMeasureAt`/`setEventAt`) over one private core, each destructuring
  ONLY its own coords (depth explicit at the call site). Homes: faces + clamps →
  `songModel.js`; omit helpers (`omitEmpty`/`omitFalsy`/`emitBlock`) → `inspector/emit.js`
  (emit policy ≠ shape surgery).
- **DD8 highlight:** `filter: drop-shadow` is ALSO scale-coupled (its blur compiles to
  `feGaussianBlur stdDeviation`, interpreted in the user coordinate system = the sp space
  for a `<g>` in the scaled viewBox; verified vs W3C SVG 1.1 Filter Effects), so it only
  relocates the ÷8. Recolor-only is the clean answer (the recolor floor is already the
  cross-engine cue; the outline even no-ops on Safari per its own comment). Delete the
  outline + ÷8 comment; keep the recolor lines. Full detail in DD7 + DD8.

## 5. Requirements coverage (every spec requirement → the deciding DD)

Verified each spec requirement and AC traces to a recorded decision:

| Spec req | Decision(s) | How satisfied |
|---|---|---|
| R-A1 (TreeGrid, no privateApis) | DD3 | Keep `__experimentalTreeGrid*`; `DropdownMenu`/`moreVertical` stable; no `privateApis`/`lock` (Q0). |
| R-A2 (native row menu, per-row label, isDestructive) | DD3 | One `DropdownMenu` per row, kind-gated contents, `label="Actions for <ordinal>"`, `isDestructive` remove; hand-row lone "Add note" stays a Button (not the icon-row anti-pattern). |
| R-A3 (stock disclosure, no glyphs) | DD4 | Non-focusable stock `<Icon>` chevron replaces `▸`/`▾`; carets removed. |
| R-B1 (single expansion, no veto) | DD5 | One `expanded` Set, no ancestor test/veto; auto-reveal dropped (seed at mutation site only). |
| R-B2 (index-path strings removed) | DD6 | Coordinate-derived JSX keys + one `expansionKey()` for expandable rows; selection stays coordinate-tuples. |
| R-B3 (inspector de-dup) | DD7 | clamps + splice-faces → `songModel.js`; `SongPanel` composes `ContextEditor` (drops the ~60-line fork); one `omitEmpty`/`omitFalsy` in `emit.js`. |
| R-B4 (meaningful net reduction) | DD3/DD4/DD5/DD6/DD7/DD-CSS/DD9 | Every named mechanism removed (icon rows, carets, dual-Set, index strings, dup helpers, `--pb-tree-depth`, scale-coupled outline); inherent flatten + single Set remain. |
| R-C1 (level-driven indent) | DD-CSS | `[aria-level]` SCSS replaces the inline `--pb-tree-depth` var + padding rule. |
| R-C2 (no scale-coupled number; highlight works) | DD8 | Delete the ÷8 outline; recolor-only keeps a visible cross-engine highlight. |
| R-C3 (layout-glue only, no fixed rail) | DD1/DD-CSS | Drop the 16em rail; `flex: 0 1 auto; max-width` ceiling + truncation. |
| R-D1 (placement) | DD1 | Inline (A), restyled; keep the "Structure" toggle. B/C recorded as losers. |
| R-D2 (inspector shape) | DD2 | Keep kind-gated stacked panels; Navigator rejected (uncontrolled, sync hazard, focus-steal). |
| R-D3 (rationalize action entry points) | DD3/DD9 | Row menu = one primary locus per structural action; the NotePanel's own add/remove note stays as the deliberate secondary inspector locus (consistent with R-D3's "at most a deliberate secondary"); the view toggle is not an action. |
| R-E1 (byte-identical publish) | DD8/DD9/DD10 | Highlight stays an editor-only post-render class (`SongCanvas` unchanged); `render.spec` stays green; no SVG/`data-*`/schema/`render.php` change. |
| R-E2 (only existing `@wordpress/*`) | DD3/DD4 | All components/icons ship in WP (Q0); no outside deps. |
| R-E3 (full build/edit + canvas highlight) | DD3/DD8/DD9 | Add/remove/duplicate/rename + select preserved via the row menu + lifted mutators; recolor highlight works. |
| R-E4 (valid by construction) | DD7 | Splice/omit helpers preserve the conformant-by-construction emit; panel tests are the regression net. |
| R-E5 (no field-reachability regression) | DD2/DD7/DD10 | Stacked panels + leaf editors unchanged in reach; the buried-field watchlist is an explicit DD10 anchor. |
| R-E6 (per-kind settings on selection) | DD2 | Kind-gating preserved by pure render (already working). |
| R-E7 (raw-JSON unchanged) | DD9/DD10 | JSON mode untouched; e2e pins it. |
| R-E8 (keyboard/a11y ≥ today) | DD3/DD4/DD10 | Every interactive row element stays a TreeGrid roving-tabindex focusable (label cell + menu cell); chevron non-focusable; no custom key handlers; e2e proves the composition. |

ACs map 1:1 to the requirements above (AC-A1..AC-E8); no AC is left without a deciding DD.

## 6. Blockers

None. The approved spec was complete and internally consistent with every decision this
phase needed; no spec revision is required. All ten owned decisions (DD1-DD10) plus the
DD-CSS consolidation are DECIDED on source-verified researcher evidence, with alternatives
and why-they-lost recorded.
