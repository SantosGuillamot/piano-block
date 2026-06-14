# Review 6 Design Doc — Simplify the editor UI with Gutenberg-native components and styles

_Architecture and component/API design for review 6 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Standalone: a plan-phase reader with this file, `1-spec/spec.md`, and the code on branch `worktree-8-editor-ui` has everything needed to produce a correct code plan. This doc carries the decisions made during design research (with rationale, losing alternatives, and exact integration points); it does not re-open them._

## 1. Goal and shape of the change

The Piano block already ships a working visual editor: a custom structure tree (Section → Measure → hand → Note) beside a read-only sheet-music canvas, with per-kind settings panels in the inspector and a raw-JSON toolbar toggle. The owner's verdict is that it works but "the implementation looks overly complex." Review 6 does **not** add authoring capability. It makes the editor UI simpler, more native to the WordPress editor, and built from Gutenberg's own parts, with a meaningful net reduction in editor-UI code — while preserving every authoring capability and leaving the published output byte-identical.

The change is strictly editor-side. The song schema, `render.php`, and the front-end SVG (including its `data-*` selection hooks and the `@font-face` "PB Music" notation font) are untouched, so a published song renders byte-identically before and after.

The work has three thrusts, each backed by the decisions in §3–§5:

1. **Re-native the structure surface** (§3): keep `__experimentalTreeGrid` as the foundation but mirror core's own List View row — a per-row `DropdownMenu` instead of always-on icon buttons, a stock non-focusable chevron instead of a text glyph, level-driven indentation instead of an injected CSS variable.
2. **Collapse hand-rolled mechanism** (§4): one expansion `Set` instead of two, coordinate-derived keys instead of stored index-path strings, and consolidated inspector helpers instead of per-panel copies.
3. **Reduce custom CSS** (§5): drop the fixed bespoke rail and the scale-coupled selection outline; keep only layout-glue that belongs in the editor.

## 2. Architecture overview

### 2.1 Current decomposition (baseline, verified on-branch)

The editor entry is `src/edit.js` (529 lines), a thin mode container that owns all editor-only state and the four structural mutators, and routes between three surfaces:

- **Visual mode** — an inline flex workspace (`__workspace`) holding `StructureTree` (the selection surface, left) beside `SongCanvas` (display + highlight, right), plus the kind-gated inspector panels (`NotePanel` / `MeasurePanel` / `SectionPanel` / `SongPanel`) in `InspectorControls`.
- **Invalid mode** — `InvalidState` for a non-empty song that fails to parse-and-validate.
- **JSON mode** — a raw textarea with non-blocking validation.

`edit.js` is the single owner of the working object (`working`, a memoized parse/seed of the `song` string) and of `commit` (which serializes, re-validates, and persists the raw string via `commitSong`). All mutators are lifted here and take direct coordinates; the panels and the tree only signal intent.

The structure tree lives in `src/editor/StructureTree.js` (542 lines). The inspector panels live in `src/editor/inspector/` (`SongPanel.js`, `SectionPanel.js`, `MeasurePanel.js`, `NotePanel.js`, plus `emit.js`); the shared leaf editors and the model live in `src/editor/` (`ContextEditor.js`, `HandConfigEditor.js`, `MetadataEditor.js`, `PitchEditor.js`, `PitchList.js`, `AnnotationList.js`, `AnnotationEditor.js`, `selection.js`, `songModel.js`, `noteNames.js`, `accessibleName.js`). Editor styles are in `src/style.scss` (the editor region is lines 24–115; the `@font-face` block at 16–22 is front-end notation, out of scope).

> **Path note.** The design research record sometimes wrote `ContextEditor.js` / `songModel.js` without a directory prefix. On the branch those two files (and the other leaf editors) live at `src/editor/`, while `emit.js` and the four `*Panel.js` files live at `src/editor/inspector/`. This doc uses the on-branch paths.

### 2.2 Target decomposition

The decomposition does **not** change — the same files, the same surfaces, the same `edit.js`-owns-state-and-mutators architecture. What changes is the internal mechanism of three of them and the styling:

- `StructureTree.js` shrinks substantially: the row becomes two `TreeGridCell`s mirroring core's List View (a select-only label cell with a non-focusable chevron, and an actions cell holding one `DropdownMenu`), the caret glyph / index-path strings / dual-Set expansion logic / `--pb-tree-depth` injection are deleted, and `TreeGridItem` is no longer used.
- `edit.js` UI-state shrinks from four pieces (`showTree` + `expandedPaths` + `collapsedOverride` + their two toggles) to two (`showTree` + one `expanded` Set + one toggle). The mutators stay; three of them gain a one-line ancestor-seed.
- The inspector de-duplicates: `SongPanel` composes `ContextEditor` instead of forking it; clamp helpers and three typed splice faces move to `songModel.js`; the omit-when-empty helpers consolidate in `inspector/emit.js`.
- `SongCanvas.js` is untouched in logic (it still adds the `is-selected` class post-render); only the CSS that class triggers changes.
- `style.scss` editor region becomes layout-glue only.

### 2.3 Data flow (unchanged in shape)

Selection stays a kind-tagged coordinate tuple (`{ kind, sectionIndex, measureIndex, hand, eventIndex }`, `selection.js`), held in `edit.js` and resolved against `working` every render via `resolveSelection`. The structure tree signals selection through `onSelect`; the canvas decorates the resolved selection; the inspector panels render kind-gated on `resolvedSelection.kind`. This pure-render selection model is preserved and is the reason no second navigation model is introduced (§3.2).

## 3. Native structure surface

### 3.1 DD1 — Placement: keep the structure surface INLINE in the block edit area (restyled)

**Decision.** The structure surface stays inline beside the canvas (the status-quo location), restyled to drop the bespoke fixed rail and the injected depth variable. The `BlockControls` "Structure" show/hide `ToolbarButton` (`edit.js:410-417`) stays.

**Spec trace.** R-D1 (inline is an explicitly-blessed option), R-C3 (no fixed-width bespoke rail fighting native chrome), R-C1 (level-driven indent), R-D3 (a view toggle is not an action entry point, so keeping it does not violate "rationalize actions").

**Rationale.** `__experimentalTreeGrid` renders a bare, unstyled `<table role="treegrid">` inside `<div role="application">` — it ships no stylesheet and its README states it is deliberately "not visually styled" (it only adds roving-tabindex / keyboard). An unstyled table sizes to its content's intrinsic width (it does **not** default to `width:100%`), so an inline TreeGrid does not fight the canvas for width. The current 16em `&__tree` rail (`style.scss:52-67`) is the only thing boxing the table today; removing it lets the table size to its widest row. This makes inline **cheaper** in CSS than today: drop the fixed rail and the inline var, add a max-width ceiling plus native truncation.

The needed layout-glue (all R-C3-permitted, no bespoke component styling): a flex container with `gap` (the `&__workspace` row minus the fixed rail); the tree column gets `flex: 0 1 auto; max-width: <ceiling>` plus `white-space:nowrap` and ellipsis on the label cell. The max-width ceiling is **load-bearing, not cosmetic**: a flex item defaults to `min-width:auto`, and a shrink-to-fit table reports a large min-content width when a row label is long, so without a constraint a long note label could push the tree column wider and starve the canvas. The canvas already self-protects (`&__canvas { flex:1 1 auto; min-width:0 }`, `&__canvas-svg { min-width:280px; overflow-x:auto }`, `style.scss:73-86`), but `min-width:0` only stops the canvas being crushed; it does not stop the tree growing. The ceiling + `white-space:nowrap` + ellipsis is what caps the table's growth and forces truncation — the same construction List View uses.

**Alternatives considered and why they lost.**

- **B — `InspectorControls` sidebar panel.** Feasible (core's List View docks in the same ~280px column and copes by truncation). Lost on two counts. First, the level-4 note-label budget in a 280px `PanelBody` is only ~124px (280 − ~16 panel pad − 72 indent − ~24 chevron − ~28 ellipsis − ~16 pad), so deep note labels that read fully on the ~256px inline rail would ellipsis in the sidebar — a legibility regression for the deepest, most-edited rows. Second, B co-locates the tree with the stacked Note+Measure+Section+Song panels in one 280px scroll column, so structure competes with settings for space and is pushed away from the canvas it drives. B's one upside (the `PanelBody` title bar is its own native show/hide, so the toolbar toggle could be dropped) is a minor simplification that does not outweigh the deep-row legibility loss. Recorded runner-up: most-native placement, but cramped.
- **C — toolbar popover as the sole home.** Rejected by R-D1 (a popover must not be the sole home of a surface the author returns to constantly). Viable only as a secondary launcher, which the design does not need given A.

### 3.2 DD2 — Inspector shape: KEEP the kind-gated stacked panels (no Navigator)

**Decision.** Keep the four kind-gated stacked `PanelBody` panels in `InspectorControls` (Note → Measure → Section → Song), driven by `resolvedSelection.kind` as a pure render (`edit.js:491-523`). Do **not** adopt `Navigator` / `useNavigator`. The simplification budget goes to the R-B3 de-dup (§4.3), which is shape-independent.

**Spec trace.** R-D2 (panel shape is OPEN, a MAY; keeping stacked panels is an explicit allowed option), AC-D2 (selection shows that node's settings — satisfied by pure render; the Navigator-route-sync clause is conditional on choosing Navigator and so does not apply), R-E6 (per-kind settings on selection — already working, preserved), R-B3/R-E5/R-E6 (the falsifiable wins, spec-stated as shape-independent, land either way).

**Rationale.** `Navigator` is **uncontrolled**: its route lives in an internal `useReducer`; `initialPath` is consumed once as the lazy initializer; the public contract is `initialPath` plus the imperative `useNavigator().goTo()` / `goBack()`; `location` is readable via the hook but not settable from outside; there is no controlled `path`/`location` prop and no `onChange`. So there is no clean "tree selection is the single source of truth, route is a pure function of it" binding. Syncing it to the tree selection would need two opposite imperative bridges (an effect that `goTo(pathForSelection)` on selection change with a redundant-push guard, plus a second effect reading `useNavigator().location` to push route changes back up to the selection) over two state owners with no controlled prop — the classic two-way-sync hazard. Worse, `goTo`/`goBack` move focus by design, so a selection-driven `goTo` would yank focus into the inspector on every tree-row click, fighting the TreeGrid roving-tabindex preserved for R-E8.

The stacked panels satisfy AC-D2's main clause by pure render (`resolvedSelection` is recomputed every render at `edit.js:199`; the panels gate on `.kind` at `edit.js:491-523`), so the only AC-D2 clause that can fail (route ≠ selection) is structurally absent. Four kind-gated collapsible `PanelBody`s is normal core density (core blocks routinely stack 4–6), and the four-panel max appears only at the deepest event selection (nothing selected → 1 Song panel; section → 2; measure → 3; event → 4).

**Alternative considered and why it lost.** Navigator drill-down is shippable (stable, importable) and shows one screen at a time, but it replaces the current one-state pure-render model with a two-state imperative two-way-sync model, steals focus on selection (fights R-E8), hides the ancestor context the stacked Section/Measure panels give for free, and yields no guaranteed line reduction. The review's real win (R-B3) is shape-independent, so Navigator buys nothing the spec asks for while adding sync-correctness risk.

### 3.3 DD3 — TreeGrid + DropdownMenu row composition: mirror core's List View row

**Decision.** Each selectable row (section / measure / note) is **two `TreeGridCell`s**, each a render-prop forwarding `{ ref, tabIndex, onFocus }` to exactly one focusable, mirroring `block-editor/.../list-view/block.js`:

- **Contents cell** → the label `Button` (select-only — see §3.4), with the chevron disclosure glyph as a non-focusable child beside it.
- **Actions cell** → a single `DropdownMenu` whose trigger receives `toggleProps={{ ref, tabIndex, onFocus }}` and `icon={ moreVertical }`. The popover's own focus management (open on Enter/Space/click, trap while open, Escape restores focus to the trigger) operates inside that one roving-tabindex focusable.

The non-selecting hand-group row uses the same two cells: its contents-cell focusable is a toggle-on-click button (expand-only, no select), and its actions cell holds a single direct "Add note" `Button`.

**Spec trace.** R-A2 (native per-row menu, not an always-on icon-button row; per-row accessible name; `isDestructive` remove), R-E8 (every interactive row element stays a TreeGrid roving-tabindex focusable), R-A1/R-E2 (`DropdownMenu` / `MenuGroup` / `MenuItem` stable, `moreVertical` from `@wordpress/icons`), R-D3 (one primary action locus per action — the row menu).

**Rationale.** Core's List View row is 2–3 `TreeGridCell`s with one focusable per cell via the cell's render-prop; its actions cell wraps the menu as `<TreeGridCell>{({ ref, tabIndex, onFocus }) => <BlockSettingsMenu toggleProps={{ ref, tabIndex, onFocus }} />}</TreeGridCell>` — the three forwarded props are exactly how the roving tabindex reaches the trigger.

**`TreeGridItem` is dropped.** Today's rows put three action `Button`s in `TreeGridItem`s inside one shared second cell (`StructureTree.js:203` cell wrapping the items at `:206/:221/:235`) — the multi-focusable-in-one-cell pattern, which is exactly what `TreeGridItem` is for (>1 focusable per cell). When the three buttons collapse to one `DropdownMenu`, give the menu its own `TreeGridCell` render-prop (one focusable per cell, like core); `TreeGridItem` is then unnecessary and removed.

**Per-kind menu contents** (confirmed idiomatic):

| Row kind | Actions cell contents |
|---|---|
| Section | `DropdownMenu` { Duplicate, Add measure, Remove (`isDestructive`) } |
| Measure | `DropdownMenu` { Duplicate, Remove (`isDestructive`) } |
| Note | `DropdownMenu` { Duplicate, Remove (`isDestructive`) } |
| Hand group | a single direct "Add note" `Button` (not a one-item menu) |

The hand-group lone "Add note" stays a direct button rather than a one-item `DropdownMenu`: R-A2's target is the always-on icon-button **row**, and one labeled action button is not that anti-pattern; core's practice is that a lone action stays a direct button (a one-item kebab is an extra click for no grouping benefit). Recorded alternative: give hand rows a `DropdownMenu` with just { Add note } for visual uniformity — also R-A2-compliant, but the slightly awkward one-item menu core avoids. Decision: direct Button.

**Accessible names.** Each `DropdownMenu` gets `label={ sprintf( __( 'Actions for %s', 'piano-block' ), ordinal ) }`, reusing the sprintf ordinals already computed in the current per-row button labels (sections around `StructureTree.js:211-215`, measures `:314-322`, notes `:477-487`). The hand-row single button reuses its existing full `addNoteLabel` (`StructureTree.js:370-379`, e.g. "Add note to Right hand of measure 1 of section 1") verbatim.

### 3.4 DD4 — Disclosure affordance: a stock non-focusable chevron; the label is select-only

**Decision.** Replace the `▸` / `▾` text glyph (`caret()`, `StructureTree.js:65-67`, concatenated into the label at `:199`, `:302`, `:402`) with a stock **non-focusable** `<Icon>` chevron (`chevronRightSmall` collapsed / `chevronDownSmall` expanded, RTL-aware) shown beside the label inside the contents cell — not a separate focusable. Its **pointer** `onClick` routes to the expansion toggle; **keyboard** expand/collapse stays TreeGrid's Left/Right arrows (free from `role="treegrid"`). The label `Button` becomes **select-only** — it no longer also toggles expansion.

**Spec trace.** R-A3 (stock disclosure affordance, not a hand-built text glyph; carets removed), R-E8 (no new tab-stop — the chevron is non-focusable, so keyboard parity holds by construction), R-B1 (select-only removes the select↔toggle coupling — see the synergy below).

**Rationale.** Core's `ListViewExpander` is a `<span aria-hidden="true">` with no `tabIndex` and no role — a deliberately non-focusable visual pseudo-control wrapping `<Icon icon={ isRTL() ? chevronLeftSmall : chevronRightSmall }>`. It has a mouse `onClick` (force-toggle) for pointer users but is invisible to keyboard/SR; the real keyboard path is TreeGrid Left/Right reading each row's `aria-expanded`. So the redesign's chevron is **not** a third tab-stop to wrap. Core's label is select-only (its `block-select-button` selects on click; expand/collapse is the sibling expander + TreeGrid arrows) — a behavior change from today's dual `toggleRow` then `onSelect` (`StructureTree.js:194-197`).

**Synergy with the single expansion model (important).** Today's "select also toggles" is part of why the `collapsedOverride` veto exists: selecting an expanded section also collapses it, so the machine needs a veto to make a manual collapse stick against auto-reveal. Splitting to select-only removes that coupling — a click selects-and-reveals without ever collapsing — so the second veto Set becomes provably unnecessary. This independently confirms §4.1's "single Set, no veto."

The chevron rotation / expanded-icon detail (core swaps right/down icons; some places rotate one via CSS) is an implementation nicety the code phase mirrors from core, not a design decision.

## 4. Simplify the implementation (net code reduction)

### 4.1 DD5 — Single expansion model

**Decision.** One `Set` of expanded **node keys** (see §4.2) lives in `edit.js`, replacing both `expandedPaths` and `collapsedOverride`. One `onToggleExpanded(key)` toggles membership (the immutable add/delete already at `edit.js:114-124` is reused for the single Set; the second toggle `onToggleCollapsedOverride` at `:131-141` is deleted). In `StructureTree`, `isExpanded(key) = expanded.has(key)` — a single lookup, no ancestor test, no veto. The `isSelectionAncestor` helper (`StructureTree.js:79-93`) and the disjoint-regime `isExpanded`/`toggleRow` (`:144-156`) are deleted.

**Auto-reveal-on-select: DROP it.** R-B1 makes auto-reveal a product choice; F2 says if kept it collapses to "add the selection's ancestor keys to the one Set." Dropping it is strictly simpler and no spec requirement keeps it. The author selecting a deep note row implies that row is already visible (you cannot click a hidden row), so auto-reveal only ever mattered for **programmatic** selection — the duplicate/add mutators that auto-select a new node (`edit.js:229`, `:355`, `:370`, `:394`). For those, the redesign seeds the new node's ancestor keys into the Set at the same commit (a one-liner at the mutation site), which is exactly F2's "trivial add-ancestors" form — not a standing auto-reveal regime in the tree. Net: no ancestor-detection code in `StructureTree` at all.

**Spec trace.** R-B1 (single model, no veto Set), R-B4 (mechanism removed), R-E8 (expansion still drives `isExpanded` / `aria-expanded`).

**Alternative considered and why it lost.** Keep a render-time auto-reveal: lost because it reintroduces the ancestor test the spec wants gone, for a case that only arises programmatically and is cleaner handled at the mutation site.

### 4.2 DD6 — Selection-key representation: drop the index-path strings

**Decision.** Drop the `s0/m1/rightHand/e2` index-path **strings** entirely. They conflated two distinct needs, now separated:

1. **React `key`** for each `TreeGridRow`: a per-row key built inline from the coordinates (e.g. `` `s${si}` ``, `` `s${si}m${mi}` ``, `` `s${si}m${mi}${hand}` ``, `` `s${si}m${mi}${hand}e${ei}` ``). These are plain JSX keys for list stability, never stored in app state.
2. **Expansion-Set membership** (the only reason the strings existed as state): only the three **expandable** kinds (section, measure, hand) need a key. Use the same coordinate-derived string as the React key for those rows, so one helper (`expansionKey(coords)`) produces both. Notes are leaves — never expandable — so they never enter the Set.

The selection itself is already coordinate tuples (`selection.js`) and stays that shape — it was never the index-path string. So R-B2 is satisfied: the strings as a stored addressing scheme are gone; what remains is a thin key derivation co-located with the row render plus the unchanged coordinate selection tuples. The lifted `edit.js` mutators already take `(sectionIndex, measureIndex, hand, eventIndex)`, so direct coordinate handlers need no path parsing.

**Spec trace.** R-B2 (strings removed; plain keys + direct coordinate handlers), AC-B2.

### 4.3 DD7 — Shared-helper consolidation

The duplications below are confirmed on-branch. Each gets one home.

**Clamp / parse helpers → `src/editor/songModel.js`** (already the home of the numeric bounds these clamp to, e.g. `OCTAVE_MIN`/`MAX`, `DOTS_MIN`/`MAX`, `BEATS_MIN`, and of the array helpers `insertAt`/`removeAt`/`replaceAt`/`duplicateAt`):

- `clampInt(raw, min, max)` — identical three times (`NotePanel.js:73-79`, `PitchEditor.js`, `HandConfigEditor.js`).
- `toNumber(raw)` + `toBoundedInt(raw, min)` — identical two times (`SongPanel.js:51-66`, `ContextEditor.js:53-69`).

**Draft/projection logic → composed, not copied.** `projectTempo` / `projectTimeSignature` plus the `tempoDraft`/`timeDraft` `useState` and `editTempo`/`editTimeSignature` are copied verbatim between `SongPanel.js:68-159` and `ContextEditor.js:71-132` (~60 lines), differing only in the emit sink (`SongPanel` emits `defaults` via `emitBlock`; `ContextEditor` calls its `emitMember`/`onChange`). Resolution (per F4): give `ContextEditor` a disclosure/layout prop so `SongPanel` **composes** `ContextEditor` over `defaults` — the way `SectionPanel` already composes it over a section's overrides (`SectionPanel.js:129-133`) — instead of re-implementing it. The projection/draft logic then lives once, in `ContextEditor`. The split of `defaults` into "common-visible + advanced-disclosed" that motivated the fork becomes a `ContextEditor` prop, not a copy. The code phase must preserve `SongPanel`'s current visible layout (the common tempo/time fields directly visible; `beatUnit` and the two hand configs behind the `Advanced` `ToolsPanel`) through that prop — this is a mechanism de-dup, not a layout change.

**Emit-splice chains → three typed faces over one private core, in `src/editor/songModel.js`.** Three `replaceAt`-based "splice a node back into the song at coords" exist: `NotePanel.emitEvent` (`:119-128`), `MeasurePanel.emitMeasure` (`:64-71`), `SectionPanel.emitSection` (`:72-77`). Consolidate to one splice mechanism with three typed faces, each destructuring **only** its own coordinates and delegating to one private `replaceAt`-down-the-path core:

- `setSectionAt(song, { sectionIndex }, nextSection)`
- `setMeasureAt(song, { sectionIndex, measureIndex }, nextMeasure)`
- `setEventAt(song, { sectionIndex, measureIndex, hand, eventIndex }, nextEvent)`

> **CRITICAL — dispatch by explicit caller-declared depth, NOT "deepest-defined-coord wins."** When an event is selected, `edit.js` renders Note + Measure + Section panels simultaneously and passes the **same** full `resolvedSelection` to all three (`edit.js:491-517`); `resolveSelection` returns the full event resolution `{ section, sectionIndex, measure, measureIndex, event, hand, eventIndex }` (`selection.js`). So `SectionPanel` and `MeasurePanel` each receive a selection carrying `eventIndex` even though they write at section/measure depth. A single "deepest-coord-wins" `setAtPath(song, resolvedSelection, nextSection)` would mis-splice `nextSection` at the event coord and corrupt the song. The three typed faces each destructure only their own coords, so a stray deeper coord is structurally ignored — mis-dispatch is impossible. (This is also why today's code has three separate functions: they encode the depth in the function identity. The consolidation preserves that depth-explicitness while sharing the splice core.)

**Omit-when-empty → `src/editor/inspector/emit.js`** (alongside the existing `emitBlock`). The omit-when-empty rule is re-inlined ~9× (`emit.js:emitBlock`, `ContextEditor.emitMember`, `SongPanel.emitContextMember`, `NotePanel.changeOptional`, `MeasurePanel.changeName`/`changeBarline`, `SectionPanel.changeName`, the `AnnotationList` undefined branches). Consolidate to:

- `omitEmpty(obj, key, value)` — set `key` when `value` has set fields, else delete it (the exact body shared by `emitBlock`/`emitMember`/`emitContextMember`).
- `omitFalsy(obj, key, value)` — the string-`name` / falsy-scalar variant used by `changeName`/`changeBarline`/`changeOptional`.

**Why two homes, not one.** `songModel.js`'s stated purpose is song-**shape** surgery (vocabularies + new-item factories + array helpers — pure shape ops); `omitEmpty`/`emitBlock` are **emit policy** (deciding a key's presence on emit), a different nature, and `emit.js` is already their home. So: clamp helpers + the three splice faces → `songModel.js`; `omitEmpty`/`omitFalsy`/`emitBlock` → `inspector/emit.js`. (One home is possible, but the two-home split matches the existing conceptual boundary.)

**Spec trace.** R-B3 (clamp helpers once in `songModel.js`; one splice mechanism; one omit), AC-B3, R-B4. **R-B3 is visual-change-independent** — no control or layout change — so the existing panel tests should pass unchanged after consolidation (a strong test anchor; see §6).

### 4.4 DD9 — Post-redesign shape of `edit.js` / `SongCanvas` / `StructureTree`

- **`edit.js` state shrinks.** The three expansion-related pieces (`expandedPaths`, `collapsedOverride`, and the two toggles, `edit.js:108-141`) collapse to one `expanded` Set plus one `onToggleExpanded` (§4.1). **`showTree` stays** (§3.1 keeps the inline "Structure" toggle). Net UI-state goes from 4 pieces (`showTree` + 3 expansion) to 2 (`showTree` + 1 expansion Set), with `selection`/`mode` unchanged.
- **The lifted mutators stay in `edit.js`** (the single owner of `working` + `commit`, `edit.js:210-401`). They already take direct coordinates, so §4.2 needs no change to them. The programmatic auto-select after add/duplicate (§4.1) gains a one-line "seed ancestor keys into `expanded`" at each mutator that auto-selects a new deep node (`onAddNote`, `onDuplicateMeasure`, `onDuplicateNote`).
- **`SongCanvas.js` is untouched in logic.** It already applies the highlight as an editor-only post-render decoration via `decorateSelection` adding `is-selected` (`SongCanvas.js:96-120`); §5.2 changes only the CSS that class triggers, not the JS that adds it. `SongCanvas` imports `SP_PX` for width math (`:31`), unrelated to the highlight — that import **stays**.
- **`StructureTree` shrinks substantially:** delete `caret` (§3.4), `isSelectionAncestor` + the disjoint `isExpanded`/`toggleRow` (§4.1), the index-path string state (§4.2), the always-on icon-button cells in favor of one `DropdownMenu` per row (§3.3), the `--pb-tree-depth` inline style (§5.1). The inherent flatten loop plus per-row `level`/`positionInSet`/`setSize` **stays** — R-B4 names it inherent (TreeGrid renders a flat caller-ordered table and does not flatten nested children itself).
- **The inline `__workspace` wrapper stays** (`edit.js:455`): the tree remains inline beside the canvas. `StructureTree`'s props change only by the expansion-Set collapse — one `expanded` + `onToggleExpanded` replace the two Sets + two toggles, and `collapsedOverride`/`onToggleCollapsedOverride` are dropped. No move to `InspectorControls`.

**Inherent work that MAY remain (per R-B4, not a failure to simplify):** the recursive flatten of the song into an ordered list of `TreeGridRow`s each carrying its `level`/`positionInSet`/`setSize`; and app-owned expansion state in one single form (TreeGrid delegates expansion entirely to the caller and stores none).

## 5. Eliminate / reduce custom CSS (DD-CSS)

The editor region of `style.scss` (`:24-114`, excluding the out-of-scope `@font-face` at `:16-22`) is reworked to layout-glue only.

### 5.1 R-C1 — Level-driven indentation

Delete the `--pb-tree-depth` inline var (set in JS at `StructureTree.js:190`, `:289`, `:397`, `:452`) and the rule that consumes it (`&__tree &-label { padding-left: calc(var(--pb-tree-depth, 0) * 1.5em) }`, `style.scss:64-66`). Replace with an attribute-keyed SCSS rule selecting on the rendered `[aria-level="N"]` attribute — core's own idiom (List View uses a `@for` loop × a grid unit). `TreeGridRow`'s `level` prop already emits `aria-level` (the redesigned row keeps `level={1..4}` on each `TreeGridRow`), so indentation derives from the tree's own level with **zero JS injection**.

### 5.2 R-C2 — Selected-event highlight: RECOLOR-ONLY (delete the scale-coupled outline) — DD8

**Decision.** Keep the three recolor lines (`style.scss:101-103`) as the whole highlight; **delete** the enclosing hairline outline rule (`:111-112`) and its scale-coupled `0.125px`/`0.25px` values plus the divide-by-8 explainer comment (`:105-110`). The selected event's full glyph (heads, stem, ledgers, dots, dynamic/text) recolors to selection blue — a strong, scale-independent cue. No ring.

**Spec trace.** R-C2 (no scale-coupled magic number remains in SCSS; highlight still works), R-E3/AC-C2 (selected event still visibly highlighted on canvas), R-E1/AC-C2/AC-E1 (byte-identical emitted SVG + `data-*` — the recolor stays a post-render editor-only class added by `SongCanvas.decorateSelection`; `view.js` never sets it).

**Why the outline is scale-coupled.** The SVG root carries `viewBox="0 0 widthSp heightSp"` (sp units) and a pixel `width = widthSp * SP_PX` (`svg.js`, `SP_PX=8` in `constants.js`). The selected `<g>` is a child of that root, so it lives in the sp user space (1 user unit = 1 sp = 8 px) — hence `outline: 0.125px` (≈1 px) and `outline-offset: 0.25px` (≈2 px) are the ÷8 numbers tied to `SP_PX`.

**Why no length-bearing replacement is clean.** Any length-bearing CSS decoration on the scaled `<g>` (outline width, box-shadow, filter blur) inherits the sp user space and is therefore scale-coupled. In particular `filter: drop-shadow` is **not** a fix: its blur compiles to `feGaussianBlur stdDeviation`, whose length is interpreted in the user coordinate system — the sp space for a `<g>` inside the scaled viewBox — so `drop-shadow(0 0 1px)` is a 1-sp = 8-CSS-px halo, and getting ~1 CSS px would need `drop-shadow(0 0 0.125px)`, the same ÷8 magic number merely relocated (verified against W3C SVG 1.1 Filter Effects). The only true constant-px ring would be an HTML overlay over the glyph's screen bbox — a disproportionate rewrite for an editor cue, rejected.

**Why recolor-only is sufficient (not a regression).** The recolor floor is already the cross-engine cue the design relies on — its own comment (`style.scss:105-110`) notes the outline "may no-op on Safari for a `<g>`, hence the recolor floor above." The outline is a secondary embellishment that does not even render on one major engine; the full-glyph recolor is the actual signal, on every engine. `fill`/`stroke` are colors (no length), so they carry no scale coupling. AC-C2 only requires the event remain "visibly highlighted," so recolor-only is the minimal compliant answer.

### 5.3 R-C3 — Layout-glue only

Delete the fixed `&__tree { width:16em; … }` rail (`style.scss:52-67`); replace with layout-glue on the tree column (`flex: 0 1 auto; max-width: <ceiling>` + `white-space:nowrap` + ellipsis on the label cell — §3.1's canvas-protection mechanism). Keep the `&__workspace` flex row (`:42-47`), `&__canvas` (`:73-79`), and `&__canvas-svg` (`:84-88`) — all legitimate layout-glue. No bespoke component styling, no fixed-width rail. The dashed-border block scaffold (`:24-28`) is pre-existing placeholder chrome, out of this review's scope to remove (it is not the editor structure CSS the spec targets). The `@font-face` declaration (`:16-22`) is untouched.

**Spec trace.** R-C1 (level-driven indent, no inline var), R-C2 (no scale-coupled magic number; highlight works), R-C3 (layout-glue only; no fixed bespoke rail), AC-C1/AC-C2/AC-C3.

## 6. Preserved capabilities, invariants, and test strategy (DD10)

### 6.1 Preserved invariants (Group E, non-negotiable)

- **R-E1 — byte-identical publish.** No change to the song schema, `render.php`, or the front-end SVG / its `data-*` hooks. The highlight stays an editor-only post-render class (`SongCanvas` unchanged); `view.js` never sets `is-selected`.
- **R-E2 — only existing `@wordpress/*` packages.** `DropdownMenu`/`MenuGroup`/`MenuItem` are stable; `__experimentalTreeGrid*` is public-experimental (already shipped); `moreVertical`/`chevronRightSmall`/`chevronDownSmall`/`chevronLeftSmall` all ship in `@wordpress/icons`. No `privateApis`/`lock`/`PrivateListView`. No outside runtime deps.
- **R-E3 — full visual build/edit + canvas highlight** preserved via the row menu + the lifted mutators + the recolor highlight.
- **R-E4 — valid by construction** preserved: the splice/omit helpers and the leaf editors keep the conformant-by-construction emit (required-field constraints and omit-when-empty round-trip).
- **R-E5 — no field-reachability regression.** The stacked panels and leaf editors are unchanged in reach; the buried-field watchlist below is an explicit test anchor.
- **R-E6 — per-kind settings on selection** preserved by pure render (`edit.js:491-523` already works; the panels' stale "only when an event is selected" header comments are not the behavior).
- **R-E7 — raw-JSON mode unchanged** (untouched by this review).
- **R-E8 — keyboard/a11y ≥ today.** Every interactive row element stays a TreeGrid roving-tabindex focusable (label cell + menu-trigger cell); the chevron is non-focusable; no custom key handlers are added; the ARIA wiring (`aria-level`/`-posinset`/`-setsize`/`-expanded`) is still emitted by TreeGrid.

**R-E5 buried-field watchlist** (every field must remain reachable/editable — a naive flatten could silently drop these):
- **Song:** metadata `title`/`composer` (`MetadataEditor`); per-song note-name language; `defaults.tempo.bpm`; `defaults.timeSignature.beats`/`beatType`; `defaults.tempo.beatUnit` (advanced); `defaults.rightHand`/`leftHand` handConfig `clef`/`octaveShift`/`alters`-map (`HandConfigEditor`, advanced).
- **Section:** `name`; per-section overrides `tempo`/`timeSignature`/`rightHand`/`leftHand` (`ContextEditor` → `HandConfigEditor`, advanced) — distinct from song defaults.
- **Measure:** `name`; `barlineStart`/`barlineEnd` (advanced); standalone `annotations` `text`/`placement`/`staff` (`AnnotationList` → `AnnotationEditor`, advanced).
- **Event/Note:** `type`; `duration`; chord `pitches` `step`/`octave`/`alter` (`PitchList` → `PitchEditor`, when `type === "note"`); `dots`; `dynamic`; the four spans `tie`/`slur`/`crescendo`/`decrescendo` (advanced); event `annotations` `text`/`placement` (advanced).

### 6.2 Test strategy

Two test surfaces both touch the redesign.

**Unit suite (`src/editor/__tests__/`, ~15 files).** `StructureTree.test.js` is tightly coupled to the old mechanism (its row-finder strips caret glyphs; it seeds the `expandedPaths` + `collapsedOverride` Sets and asserts the dual-Set veto; it looks up per-row icon-button labels). It must be rewritten for the new row shape: caret-strip → plain name (§3.4); dual-Set assertions → single-Set (§4.1); per-row icon-button label lookups → open the row's `DropdownMenu` then click the `MenuItem`. The ARIA-wiring assertions (`aria-level`/`-posinset`/`-setsize`/`-expanded`) **stay** and are the keyboard/a11y anchor for R-E8.

**Important test-harness caveat.** The unit suite maps `@wordpress/components` to a hand-written DOM-honest mock (`test/mocks/wordpress-components.js`) that has **no** `DropdownMenu`/`Dropdown`/`Navigator` export and simulates **none** of TreeGrid's roving-tabindex or DropdownMenu's focus-trap/restore. So jest can prove **structural** outcomes (row inventory, per-row menu `label`, kind-gated menu contents, single-Set toggle, plain-key addressing) with a `DropdownMenu` stub added — but the a11y/keyboard composition (focus trap/restore, roving tabindex reaching the menu trigger) rests on core's shipped pattern plus the Playwright e2e suite, not jest.

**Inspector panel tests** (`NotePanel`/`MeasurePanel`/`SectionPanel`/`SongPanel`, plus `pitches`/`annotations`/`contextControls`/`songModel`): because the R-B3 consolidation is visual-change-independent (§4.3), these **should pass unchanged** — they are the regression net proving the de-dup did not alter behavior. Add direct unit tests for the extracted helpers (`clampInt`/`toBoundedInt`/`setSectionAt`/`setMeasureAt`/`setEventAt`/`omitEmpty`/`omitFalsy`).

**E2e (`specs/editor.spec.js` + `specs/render.spec.js`).** Migration for `editor.spec.js`: placement is inline (§3.1), so the `.wp-block-piano-block-piano__tree` class + "Structure" toggle assertions stay valid; per-row icon-button label lookups → open the row's `DropdownMenu` ("Actions for Section 2") then click the `MenuItem`; the hand-row "Add note" stays a direct button (locator unchanged); the caret-tolerant note-row regex → a plain end-anchored name; the `is-selected` decoration assertion stays valid (§5.2 keeps the class via the recolor floor). `render.spec.js` asserts the published SVG and **must stay green untouched** (R-E1 byte-identical; AC-E1).

**Anchor invariants to pin (one per preserved requirement):** byte-identical publish (`render.spec`, R-E1/AC-E1); per-kind selection→settings (R-E6/AC-E6); field reachability incl. buried fields (R-E5/AC-E5); valid-by-construction (R-E4/AC-E4); raw-JSON unchanged (R-E7/AC-E7); keyboard/roving-tabindex incl. the new `DropdownMenu` trigger inside a `TreeGridCell` (R-E8/AC-E8 — e2e, since the jsdom mock does not exercise real roving tabindex).

## 7. Requirements coverage matrix

Every spec requirement maps to the design element that satisfies it.

| Spec req | Design element | How satisfied |
|---|---|---|
| R-A1 (TreeGrid, no privateApis) | §3.3 | Keep `__experimentalTreeGrid*`; `DropdownMenu`/`moreVertical` stable; no `privateApis`/`lock`/`PrivateListView`. |
| R-A2 (native row menu, per-row label, isDestructive) | §3.3 | One `DropdownMenu` per row, kind-gated contents, `label="Actions for <ordinal>"`, `isDestructive` remove; hand-row lone "Add note" stays a Button. |
| R-A3 (stock disclosure, no glyphs) | §3.4 | Non-focusable stock `<Icon>` chevron replaces `▸`/`▾`; carets removed. |
| R-B1 (single expansion, no veto) | §4.1 | One `expanded` Set, no ancestor test/veto; auto-reveal dropped (seed at mutation site only). |
| R-B2 (index-path strings removed) | §4.2 | Coordinate-derived JSX keys + one `expansionKey()` for expandable rows; selection stays coordinate tuples. |
| R-B3 (inspector de-dup) | §4.3 | Clamps + three splice faces → `songModel.js`; `SongPanel` composes `ContextEditor` (drops the ~60-line fork); one `omitEmpty`/`omitFalsy` in `inspector/emit.js`. |
| R-B4 (meaningful net reduction) | §3.3, §3.4, §4.1–4.4, §5 | Every named mechanism removed (icon rows, carets, dual-Set, index strings, dup helpers, `--pb-tree-depth`, scale-coupled outline); inherent flatten + single Set remain. |
| R-C1 (level-driven indent) | §5.1 | `[aria-level]` SCSS replaces the inline `--pb-tree-depth` var + padding rule. |
| R-C2 (no scale-coupled number; highlight works) | §5.2 | Delete the ÷8 outline + its comment; recolor-only keeps a visible cross-engine highlight. |
| R-C3 (layout-glue only, no fixed rail) | §3.1, §5.3 | Drop the 16em rail; `flex: 0 1 auto; max-width` ceiling + truncation. |
| R-D1 (placement) | §3.1 | Inline (A), restyled; keep the "Structure" toggle. B/C recorded as losers. |
| R-D2 (inspector shape) | §3.2 | Keep kind-gated stacked panels; Navigator rejected (uncontrolled, sync hazard, focus-steal). |
| R-D3 (rationalize action entry points) | §3.3, §4.4 | Row menu = one primary locus per structural action; the NotePanel's own add/remove note stays as the deliberate secondary inspector locus; the view toggle is not an action. |
| R-E1 (byte-identical publish) | §5.2, §4.4, §6 | Highlight stays an editor-only post-render class (`SongCanvas` unchanged); `render.spec` stays green; no SVG/`data-*`/schema/`render.php` change. |
| R-E2 (only existing `@wordpress/*`) | §3.3, §3.4, §6.1 | All components/icons ship in WP; no outside deps. |
| R-E3 (full build/edit + canvas highlight) | §3.3, §5.2, §4.4 | Add/remove/duplicate/rename + select preserved via the row menu + lifted mutators; recolor highlight works. |
| R-E4 (valid by construction) | §4.3 | Splice/omit helpers preserve the conformant-by-construction emit; panel tests are the regression net. |
| R-E5 (no field-reachability regression) | §3.2, §4.3, §6.1 | Stacked panels + leaf editors unchanged in reach; the buried-field watchlist is an explicit anchor. |
| R-E6 (per-kind settings on selection) | §3.2 | Kind-gating preserved by pure render (already working). |
| R-E7 (raw-JSON unchanged) | §4.4, §6 | JSON mode untouched; e2e pins it. |
| R-E8 (keyboard/a11y ≥ today) | §3.3, §3.4, §6 | Every interactive row element stays a TreeGrid roving-tabindex focusable; chevron non-focusable; no custom key handlers; e2e proves the composition. |

ACs map 1:1 to the requirements above (AC-A1 … AC-E8); no AC is left without a deciding design element.

## 8. Out of scope (carried from the spec)

- Adding authoring capability — this review simplifies and re-natives the existing UI only.
- Any change to the published output — song schema, `render.php`, the front-end SVG (incl. `data-*` hooks and the `@font-face` "PB Music" font) are untouched; the §5.2 highlight rewrite leaves them byte-identical.
- Importing or unlocking core's List View (`PrivateListView` / the `privateApis` bundle are forbidden); not registering song nodes as inner blocks.
- Mandating a placement or inspector shape beyond the decisions here (inline + stacked panels are chosen within the spec's envelope).
- A numeric line-count target — R-B4 is judged qualitatively against the removal of the named mechanisms.
- Rewriting the inspector's stock control vocabulary (`PanelBody`/`ToolsPanel`/`SelectControl`/`TextControl`/`NumberControl` are the correct native pattern and are preserved); the inspector work is mechanism de-dup (§4.3), not a control rewrite.

## 9. Open questions / blockers

None. The approved spec and the design research record are complete and internally consistent; all decisions (DD1–DD10 + DD-CSS) are made on source-verified evidence with alternatives recorded. The only discrepancy found while grounding this doc against the branch is cosmetic: the research record occasionally referenced `ContextEditor.js`/`songModel.js` without their `src/editor/` prefix — corrected to the on-branch paths here (and noted in §2.1). It does not change any decision.
