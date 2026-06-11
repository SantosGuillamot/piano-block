# Review 6 — Spec Research

_Running record of the spec-phase Q&A for **review 6** of the Piano block editor-UI
feature (issue #8, PR #22). Driven by spec-analyst-r6 in dialogue with
spec-researcher-r6. Input: `0-prompt/prompt.md` plus the current code on branch
`worktree-8-editor-ui`. Output feeds the spec-writer (this file is NOT the spec)._

## 1. Intent in one line

The editor UI direction is right, but the implementation is **overly complex and
non-native**. Review 6 must make the structure/navigation surface and the inspector
**simpler and built out of Gutenberg's own parts**, with custom CSS eliminated or
drastically reduced and a meaningful net reduction in editor-UI code — while
preserving every existing authoring capability and leaving the song schema,
`render.php`, and the front-end SVG byte-identical.

## 2. Current-state facts (from the code on the branch)

Established by reading the source directly:

- **Runtime target:** WordPress **6.9+** (`piano-block.php` "Requires at least: 6.9";
  `.wp-env.json` `"core": null` = latest stable). The block uses only `@wordpress/*`
  packages, resolved at runtime via `window.wp.*` externals (wp-scripts /
  DependencyExtractionWebpackPlugin). No outside runtime deps.
- **Editor layout** (`src/edit.js`, 529 lines): a thin mode container. Visual mode
  shows a flex-row **workspace** = left `StructureTree` + right `SongCanvas`, with
  per-kind inspector panels in `InspectorControls`. JSON mode is a `TextareaControl`
  with non-blocking validation. `edit.js` is the single owner of `working` + `commit`
  and hosts ALL structural mutators (add/remove/duplicate section/measure/note),
  the selection state, and three UI Sets (`showTree`, `expandedPaths`,
  `collapsedOverride`).
- **`src/editor/StructureTree.js` (542 lines):** custom tree on
  `__experimentalTreeGrid` (+ `TreeGridRow/Cell/Item`). Hand-rolls: index-path row
  flattening (`s0/m1/rightHand/e2`), a two-Set expansion regime
  (`expandedPaths` + `collapsedOverride` with auto-reveal-ancestors), text-glyph
  carets (`▸`/`▾`), inline `--pb-tree-depth` CSS var for indent, always-on per-row
  icon `Button`s (remove/duplicate/add-measure/add-note). Hand-group rows are
  organizational/non-selectable.
- **`src/style.scss` (editor block, lines 24-115):** bespoke `&__workspace` flex
  row, fixed-width `&__tree` rail (16em), the `--pb-tree-depth` → `padding-left`
  indent rule, `&__canvas`/`&__canvas-svg` layout, and a `.is-selected` highlight
  that recolors the selected event's SVG ink and draws a hairline outline whose
  width is **coupled to `SP_PX = 8` by a divide-by-8 comment** (the prompt's
  "scale-coupled magic number"). (The `@font-face` for "PB Music" at the top is
  front-end notation, NOT editor chrome — out of scope.)
- **Inspector** (`src/editor/inspector/`): `SongPanel` (284 lines: metadata, note
  language, tempo, time sig, advanced ToolsPanel for beatUnit + hand configs, Add
  section button), `SectionPanel` (146), `MeasurePanel` (172), `NotePanel` (292:
  type/duration/pitches + advanced ToolsPanel for dots/dynamic/4 spans/annotations
  + add/remove note buttons). Supporting leaf editors: `HandConfigEditor`,
  `ContextEditor`, `PitchEditor`, `PitchList`, `AnnotationList`, `AnnotationEditor`,
  `MetadataEditor`. Panels render most-specific-first (Note→Measure→Section→Song),
  gated by selection kind; Song is always present.
- **Selection model** (`src/editor/selection.js`): kind-tagged
  `{ kind: "section"|"measure"|"event", sectionIndex, measureIndex?, hand?,
  eventIndex? }`, resolved against the live working object each render (stale →
  null). The canvas `decorateSelection` only highlights `"event"` selections
  (section/measure get no canvas indication today). The SVG emit tags measures with
  a 1-based GLOBAL `data-measure` and notes with `data-hand`/`data-event-index`;
  `selection.js` maps section/measure indices ↔ global measure number.
- **Total editor UI:** ~3,300 lines JS + the custom SCSS. The prompt's stated goal
  is a meaningful NET REDUCTION.
- **Experimental imports already in use:** `__experimentalTreeGrid*`,
  `__experimentalNumberControl`, `__experimentalToolsPanel(Item)`. So the project
  already ships `__experimental` `@wordpress/components` APIs.

## 3. Hard constraints carried into the spec (from prompt §"Constraints carried over")

- Only `@wordpress/*` packages WordPress already provides; **no outside deps**.
- Any private/experimental Gutenberg component the design commits to MUST be verified
  importable + stable enough to ship, WITH a stock-component fallback.
- Editor-side only: **song schema, `render.php`, and front-end SVG unchanged** — a
  published song renders byte-identically before and after. (This pins what the
  highlight rewrite may NOT touch: the emitted SVG / `data-*` hooks.)

## 4. Capabilities that MUST keep working (from prompt §"What must keep working")

Carried verbatim-in-spirit; these become preservation requirements:
- Full visual build/edit: select any section/measure/note; add/remove/duplicate
  sections, measures, notes; rename sections/measures; edit ALL per-kind settings
  (tempo, time sig, clefs, accidentals/octave shifts, pitches, durations, dots,
  dynamics, ties, slurs, annotations, barlines); live canvas preview; selected-event
  highlight on the canvas.
- **Valid by construction** — visual editing can only produce schema-conformant songs.
- **Raw-JSON mode** behind the toolbar toggle, non-blocking validation, unchanged.
- **Keyboard operability / accessibility** at least as good as today's TreeGrid tree.

## 5. Established feasibility findings

### F1 — List View is NOT reusable; the native path is TreeGrid + DropdownMenu (from A1)

Decisive, cited answer from the researcher:

- **No importable List View for a third-party block in WP 6.9.** There is no public
  `<ListView>` and no `__experimentalListView` in `@wordpress/block-editor`'s public
  barrel. List View ships only as `PrivateListView` inside the **locked `privateApis`
  bundle** (`packages/block-editor/src/private-apis.js`). The old
  `__experimentalListView` export was removed years ago. Related nav pieces
  (`BlockQuickNavigation`, `OffCanvasEditor`, `useListViewPanelState`) are private-only too.
- **It is store-coupled, not data-driven.** `list-view/index.js` derives its tree
  exclusively from the block-editor store (`useSelect(blockEditorStore)`,
  `useListViewClientIds(rootClientId)` walking the registered block tree by
  clientId). No prop feeds it arbitrary data; even its `blocks` prop is resolved as
  block objects against the store. Our song nodes are NOT registered blocks, so it
  could not render them without registering each node as a real inner block — heavier,
  not simpler (the opposite of the goal).
- **The `privateApis` door is bolted shut for plugins.** `@wordpress/private-apis`
  gates `__dangerousOptInToUnstableAPIsOnlyForCoreModules` on (a) a hardcoded
  allowlist of ~43 core `@wordpress/*` module names (a plugin name throws) and (b) an
  exact consent string that itself says private features "are not for use in themes or
  plugins and doing so will break in the next version of WordPress." So unlocking is
  contractually forbidden AND breaks on the next WP release. **The spec MUST forbid
  depending on `PrivateListView`/`privateApis`** — this is stricter than the
  `__experimental*` imports the code already ships (those are public, just
  unstable-named; `privateApis` are genuinely sealed).
- **The honest resolution of the owner's suggestion:** core's own List View is itself
  built on `__experimentalTreeGrid` (`list-view/index.js` line 14:
  `import { __experimentalTreeGrid as TreeGrid }`). The Piano block **already uses the
  exact same accessible primitive**. So "reuse the components Gutenberg uses to list
  blocks" most faithfully means **keep TreeGrid and lean harder on stock pieces around
  it** (not import an unobtainable ListView). The owner's intent is satisfiable in
  spirit — same TreeGrid foundation, native action menus, package-driven styling — but
  not by importing the List View component.

**Importable building blocks + stability (from `@wordpress/components` barrel on trunk):**
| Component | Status | Role in the native path |
|---|---|---|
| `__experimentalTreeGrid` + `TreeGridRow/Cell/Item` | `__experimental` (public, in use) | The tree foundation. Gives `role="treegrid"`, roving tabindex, Up/Down rows, Left/Right collapse/expand FOR FREE — should absorb the hand-rolled keyboard model. Some flatten-to-rows is inherent to its API. |
| `DropdownMenu` (+ `MenuGroup`/`MenuItem`) | **stable** | Native per-row ellipsis/kebab for remove/duplicate/add — replaces the always-on icon-Button rows. |
| `__experimentalItemGroup`/`__experimentalItem` | `__experimental` | Lighter flat-list styling, but NO tree semantics / expand-collapse — TreeGrid still better for a 4-level hierarchy. |
| `NavigableMenu` | stable | Lower-level keyboard nav; not a tree. |
| `Composite` | stable | Ariakit primitive; rebuilding treegrid semantics yourself is not simpler. |
| `Navigator`/`useNavigator` | **stable** (recently stabilized from `__experimentalNavigator`) | Relevant to INSPECTOR drill-down simplification, not the tree. |

- **Native indentation:** TreeGrid emits `aria-level`; core styles indent off the
  row level via the package's own SCSS. We can't import that CSS, but we can derive
  indentation from `aria-level`/`level` instead of the bespoke `--pb-tree-depth` var,
  shrinking the SCSS.

### F2 — Sizing the "simplify" claim: what is inherent vs. removable (from A2)

Verified against `packages/components/src/tree-grid/index.tsx` (trunk) + the worktree
code. This lets the spec name what disappears as testable outcomes without
over-promising:

- **KEEP — inherent to TreeGrid (do NOT demand removal):**
  - The recursive flatten of sections→measures→hands→notes into an ordered
    `TreeGridRow[]` with each row's `level`/`positionInSet`/`setSize`. TreeGrid
    renders a `<table>`/`<tbody>` and EXPECTS a flat caller-ordered row list; it does
    NOT accept nested children and flatten internally. The flatten loop survives any
    TreeGrid design.
  - App-owned expansion state in SOME form. TreeGrid delegates expansion entirely to
    the caller (`onExpandRow`/`onCollapseRow`/`onFocusRow` default to no-ops; it reads
    each row's `aria-expanded`/`data-expanded` for keyboard nav but stores nothing).
    The app must feed `isExpanded` per row.
  - The keyboard model — it comes FREE and unchanged from `role="treegrid"`.

- **REMOVE — self-inflicted, testable "what disappears" outcomes:**
  - **The dual-Set expansion regime.** Today `edit.js` holds TWO Sets
    (`expandedPaths` + `collapsedOverride`) plus `StructureTree`'s
    `isSelectionAncestor` auto-reveal/veto logic (~40 lines of branching) — a
    two-disjoint-regimes machine implementing "auto-reveal the selected branch but let
    a manual collapse stick." A **single expanded-Set** (one `useState(new Set())`, one
    toggle) is the natural, sufficient shape — exactly what core's List View does.
    Auto-reveal-on-select is a PRODUCT CHOICE, not a TreeGrid obligation; if kept it
    collapses to a one-liner ("on select, add the selection's ancestor keys to the
    single Set"). Spec-safe outcome: *the dual-Set regime + selection-ancestor
    auto-reveal/veto are eliminated in favor of a single expansion Set.*
  - **The index-path STRING addressing** (`s0/m1/rightHand/e2`). These strings exist
    only to key the two Sets; with a single Set / simplified expansion they can
    collapse to plain React `key`s + direct coordinate handlers. Removable as a
    consequence of the expansion simplification (not a TreeGrid requirement).
  - **The `▸`/`▾` text-glyph carets.** TreeGrid renders NO disclosure caret; the
    glyphs are 100% hand-drawn and concatenated into the label `Button` text. BUT they
    are currently the ONLY visual disclosure cue for sighted users — so the correct
    outcome is *replace the hand-built text-glyph carets with a STOCK disclosure
    affordance* (e.g. a `Button` with a `@wordpress/icons` chevron —
    `chevronRightSmall`/`chevronDownSmall`, importable + stable — as core's List View
    does), NOT "delete the disclosure." (If the redesign makes the tree
    fully-expanded/non-collapsible, the carets just disappear — separate interaction
    decision.)
  - **The always-on per-row icon-Button rows** → one native `DropdownMenu` (per F1).
  - **The `--pb-tree-depth` CSS var** → level-driven indentation (per F1).

- **F2 caveat for the keyboard/accessibility requirement:** "keyboard operability ≥
  today" is **preserved by construction** by staying on TreeGrid — the current code
  adds ZERO keyboard handlers (grep of `StructureTree.js` + `edit.js` for
  `onKeyDown`/`keydown`/`event.key`/`preventDefault`/arrow handling = no matches; all
  nav is TreeGrid's roving-tabindex: Up/Down rows, Left/Right collapse-expand + move
  to parent, Home/End). The ONE thing the redesign must preserve: every interactive
  row element — the label AND the new `DropdownMenu` trigger AND any chevron expander —
  must stay wrapped in `TreeGridCell`/`TreeGridItem` so it stays in the roving
  tabindex (today the action Buttons are in `TreeGridItem`; the DropdownMenu trigger
  must be wrapped the same way).

### F3 — Row actions (DropdownMenu) + surface placement (from A3)

**Row actions — `DropdownMenu` per row is core's OWN blessed pattern:**
- **No focus conflict with TreeGrid.** Core's List View row
  (`list-view/block.js`) renders its per-block actions menu INSIDE a `TreeGridCell`
  whose child is a render-prop forwarding `ref`/`tabIndex`/`onFocus` to the trigger
  (a `DropdownMenu` with `icon={ moreVertical }`). TreeGrid owns the roving tabindex
  via that wiring; the DropdownMenu's popover focus management (open on Enter/Space/
  click, trap while open, Escape restores focus to the trigger) operates inside the
  single focusable. The popover portals, but only the transient panel — the trigger
  stays in the row, so arrow-nav is unbroken. **This is the exact shipped accessible
  pattern.** Requirement: wrap the trigger so it receives TreeGrid's
  `ref`/`tabIndex`/`onFocus` (`TreeGridItem` when a cell has multiple focusables, a
  `TreeGridCell` render-prop when one). Today's action Buttons already use
  `TreeGridItem`, so swapping to a single DropdownMenu is a like-for-like wrapping
  change.
- **Context-dependent per-row menus — no blocker.** Each row renders its own
  `<DropdownMenu controls={...}>` (or with `MenuGroup`/`MenuItem` children) — all
  STABLE. Per-kind contents are just props. **A11y:** the ellipsis trigger needs a
  per-row accessible name via `DropdownMenu`'s `label` prop (e.g. "Actions for Section
  2") — the same `sprintf` ordinals today's icon-button labels compute carry straight
  over. Use `icon={ moreVertical }` (`@wordpress/icons`, stable); destructive items
  get `isDestructive` on the `MenuItem`.
- **Action locus — core uses MULTIPLE; spec should ALLOW, not require, a single
  one.** In the block editor a block's actions live in several native loci at once
  (List View row ellipsis, the block toolbar `BlockControls`, the options dropdown) —
  "Duplicate/Remove" deliberately appear in more than one surface. So: **require** the
  structure surface's per-row actions to use a native menu/ellipsis pattern (kills the
  always-on icon rows); **allow** additional entry points in the inspector/toolbar
  where they aid discoverability; but the current **duplication sprawl** (add/remove
  scattered across tree rows AND multiple inspector panels) should be **rationalized
  to one primary locus per action with at most a deliberate secondary**, so "simplify"
  stays honest.

**Surface placement — all three stock-feasible; none a non-starter:**
- **Option A — Keep inline in the block's edit area (status-quo location, restyled).**
  FEASIBLE, lowest risk. TreeGrid renders fine in block content; the only change is
  dropping the bespoke flex rail / `--pb-tree-depth` for level-driven indentation +
  package styles. Good when the surface wants horizontal room beside the canvas. The
  safe default.
- **Option B — Move the tree into `InspectorControls` (right sidebar) as a panel
  (structure + settings share one sidebar).** FEASIBLE — nothing breaks putting
  TreeGrid in a `PanelBody`; core stacks tall scrollable panels there. Two tradeoffs
  to flag: (i) **width** — the settings sidebar is a fixed ~280px column, so a
  4-level-deep tree with indent + per-row ellipsis gets cramped and deep note rows may
  truncate; (ii) **scroll** — a long song makes a tall tree; the sidebar scrolls
  natively (or `__experimentalScrollable` with `maxHeight` for independent scroll, but
  plain sidebar scroll is simpler/stock). Most "native" (satisfies the owner's "even
  if somewhere other than the global sidebar" hint) but NOT at parity with the wide
  inline rail.
- **Option C — Toolbar `Dropdown`/popover from a `BlockControls` button.** FEASIBLE as
  a secondary launcher (core reaches List View from a toolbar button), AWKWARD as the
  sole home — a popover is transient/space-limited for a surface returned to
  constantly. Reasonable complement, weak as the only locus.
- **Alternative interaction model — `Navigator`/`useNavigator` (stable, ex-
  `__experimental`):** a drill-down stack (push/pop screens, built-in back) for
  "tap section → its measures → its notes" instead of an expand-in-place tree. Fully
  stock; a credible "lighter than a tree" option especially in the narrow sidebar —
  but a MODEL CHANGE that REPLACES TreeGrid, not a restyle. Flagged because it's the
  most likely native idea the design phase might reach for.

**Bottom line for the spec:** keep placement OPEN (as the prompt wants); bless inline
(A) and sidebar (B) as primary candidates; note B inherits the ~280px width tradeoff;
treat toolbar (C) as a secondary launcher not a sole home; optionally mention
`Navigator` drill-down as a stock alternative model.

### F4 — Inspector simplification: controls native, mechanism duplicated, fields to preserve (from A4, cross-checked against the source)

**Native baseline to PRESERVE (do NOT rewrite):** the inspector's control vocabulary
is entirely stock and idiomatic — `PanelBody` + `__experimentalToolsPanel`/
`ToolsPanelItem` (public/importable; the CORRECT native progressive-disclosure
pattern core blocks use) with `hasValue`/`onDeselect`/`resetAll`, and stock
`SelectControl`/`TextControl`/`TextareaControl`/`__experimentalNumberControl` leaves.
Nothing anti-native here (unlike the tree). The spec's rewrite target is NOT the
controls. (`NumberControl` is still `__experimental` but already shipped with no stable
replacement — keep it.)

**The real reduction lever — duplicated MECHANISM (visual-change-independent),
confirmed by reading the source myself:**
- **(a) `SongPanel` re-copies ALL of `ContextEditor`'s draft/projection logic
  verbatim.** `SongPanel` `toNumber`/`toBoundedInt`/`projectTempo`/
  `projectTimeSignature` are byte-identical to `ContextEditor`'s; the only diff is
  `emitContextMember` → `emitBlock(song,"defaults",…)` vs `emitMember` → `onChange`.
  SongPanel also reproduces the whole `tempoDraft`/`timeDraft` `useState` +
  `editTempo`/`editTimeSignature` block. ~60 duplicated lines. SongPanel's own header
  admits it ("reproduces only ContextEditor's small draft/projection"). It was forked
  to split `defaults` into common-visible + advanced-disclosed without changing
  ContextEditor's monolithic emit — a real constraint, solvable by giving
  ContextEditor a layout/disclosure prop instead of copying it (then SongPanel
  composes ContextEditor over `defaults` the way SectionPanel composes it over
  overrides).
- **(b) `clampInt` defined identically 3×** (`NotePanel`, `PitchEditor`,
  `HandConfigEditor`) + `toBoundedInt` 2× (`SongPanel`, `ContextEditor`). Pure helpers
  that belong once in `songModel.js` (which already houses the array helpers +
  vocabularies).
- **(c) Per-panel emit/splice chains:** `NotePanel.emitEvent`
  (section→measures→hand→event), `MeasurePanel.emitMeasure` (section→measures),
  `SectionPanel.emitSection` (sections) are three hand-written variants of "splice a
  node back into the song at coords"; the omit-when-empty rule is re-inlined ~9 times
  (`emitBlock`/`emitMember`/`emitContextMember`/`changeOptional`/`changeName`×2/
  `changeBarline`/`buildHandConfig`/…). A shared `setAtPath` splice helper + one
  `omitEmpty` helper absorb most of it. (`ListControls.AddButton` is now just a thin
  `Button` wrapper — minor.)

  Spec-safe outcome: *the duplicated draft/projection logic (ContextEditor copied into
  SongPanel), the repeated clamp helpers, and the per-panel emit-splice + omit-empty
  idioms are consolidated into shared helpers.* This is the SPINE of the inspector
  requirement — a real reduction in the ~1,200 inspector lines with NO control change
  and NO UI change (lowest-risk, most defensible "simplify the implementation").

**Navigator for the inspector — shippable but NOT auto-simpler; leave panel-shape
OPEN.** `Navigator`/`useNavigator` is stable/importable, but switching the four
kind-gated stacked panels to a push/pop drill-down is a MODEL change: it removes the
kind-gating render logic but ADDS navigation state, screen wiring, back-affordances,
and a new burden to keep the structure-tree selection and the Navigator route in sync
(two nav models that must agree) — plausibly nicer in the narrow sidebar but not a
guaranteed line reduction and carries integration risk. **Recommendation: the spec
should NOT require Navigator.** Leave panel-shape open (stacked panels OR Navigator,
design's choice) and require the falsifiable wins regardless of shape: de-duplication
(above), stock controls (already met), and no field-reachability regression (below).

**Full reachable-field map — the preservation clause MUST enumerate these; several are
BURIED in leaf editors a naive flatten could silently drop:**
- *Song* (`SongPanel`, always): metadata `title`/`composer` (buried in
  `MetadataEditor`); per-song `note language`; `defaults.tempo.bpm`,
  `defaults.timeSignature.beats`/`beatType` (visible); `defaults.tempo.beatUnit`
  (Advanced); `defaults.rightHand`/`leftHand` handConfig `clef`/`octaveShift`/`alters`
  map (buried in `HandConfigEditor`, under Advanced).
- *Section* (`SectionPanel`): section `name`; per-section overrides
  `tempo`/`timeSignature`/`rightHand`/`leftHand` (buried in `ContextEditor` →
  `HandConfigEditor`, under Advanced) — these OVERRIDES are distinct from song defaults
  and reachable only here.
- *Measure* (`MeasurePanel`): measure `name`; `barlineStart`/`barlineEnd` (Advanced);
  measure standalone `annotations` `text`/`placement`/`staff` (buried in
  `AnnotationList` → `AnnotationEditor`, Advanced).
- *Event/Note* (`NotePanel`): `type`, `duration` (visible); chord `pitches`
  `step`/`octave`/`alter` (buried in `PitchList` → `PitchEditor`, when type=note);
  `dots`, `dynamic`, four spans `tie`/`slur`/`crescendo`/`decrescendo` (Advanced);
  event `annotations` `text`/`placement` (buried in `AnnotationList` →
  `AnnotationEditor`, Advanced).
- **Buried-field watchlist for the preservation clause:** pitch `step`/`octave`/
  `alter`; annotation `text`/`placement`/`staff`; handConfig `clef`/`octaveShift`/
  `alters`-map; SECTION OVERRIDE tempo/timeSignature/hand-configs (distinct from song
  defaults); tempo `beatUnit`; and the required-field constraints (tempo needs `bpm`;
  timeSignature needs both `beats`+`beatType`) — i.e. valid-by-construction must hold.

**Per-kind reachability — already CORRECT today (preserve-don't-regress, NOT a gap).**
_(Corrected: an earlier A4 caveat claimed section/measure settings were only reachable
via an event selection, based on stale panel HEADER COMMENTS. Re-verified against the
actual gating in `edit.js` lines 491-523 — the comments are out of date; the real
behavior is per-kind correct.)_ The panels gate on `resolvedSelection.kind`:
- `kind === "event"` → NotePanel + MeasurePanel + SectionPanel + SongPanel
- `kind === "measure"` → MeasurePanel + SectionPanel + SongPanel
  (MeasurePanel's condition is `kind === "event" || kind === "measure"`)
- `kind === "section"` → SectionPanel + SongPanel
  (`{resolvedSelection && <SectionPanel/>}` — any non-null selection shows it)
- nothing selected → SongPanel only

And `resolveSelection` (`selection.js` 116-162) resolves each kind to the right live
object. So selecting a section row already reaches section settings and a measure row
already reaches measure settings — INDEPENDENT of any event selection. This is a
working invariant to PRESERVE, not a defect to fix. The honest requirement: *each
selectable node kind (section/measure/event) reaches its own settings when selected,
with Song always available* (E6).

## 6. Open feasibility questions (driving the Q&A)

All foundational feasibility facts the requirements depend on are now established
(F1-F4). No open questions remain. Requirements complete — see §8.

## 7. Q&A log

### Q1 — List View reusability for non-block data — ANSWERED (see F1)

List View is not reusable (private + store-coupled); native path is TreeGrid +
DropdownMenu + level-driven indentation; spec must forbid `privateApis`. Full detail
in §5 F1.

### Q2 — Sizing the "simplify" claim: TreeGrid free vs. hand-rolled — ANSWERED (see F2)

Flatten + app-owned expansion + keyboard are inherent (keep). Dual-Set regime,
index-path strings, text-glyph carets, always-on icon rows, depth CSS var are
self-inflicted (remove/replace with stock). Keyboard preserved by construction.
Full detail in §5 F2.

### Q3 — DropdownMenu row actions + structure-surface placement — ANSWERED (see F3)

DropdownMenu-in-TreeGrid is core's own pattern (no focus conflict); per-row
context menus fine with per-row `label`; allow (don't require) a single action locus
but rationalize the duplication sprawl; inline/sidebar/toolbar all feasible (sidebar
~280px width tradeoff, toolbar secondary-only); Navigator drill-down a stock
alternative model. Full detail in §5 F3.

### Q4 — Inspector-panel simplification feasibility — ANSWERED (see F4)

Controls + ToolsPanel disclosure are the good native baseline (preserve). The real
lever is the duplicated emit/projection/splice/clamp/omit mechanism (SongPanel copies
ContextEditor verbatim; `clampInt` 3×; per-panel splice chains) — consolidate into
shared helpers, visual-change-independent. Navigator is shippable but a model change
with sync risk — leave panel-shape open, don't mandate it. Full reachable-field map +
buried-field watchlist captured. Per-kind selection→settings reachability already
works today (a follow-up correction confirmed it against `edit.js`; the earlier "gap"
caveat was wrong) — it's a preserve-don't-regress invariant, not a fix. Full detail in
§5 F4.

## 8. Requirements for review 6 (complete)

Derived from the prompt's goals + the established feasibility findings (F1-F4). Each
is an OUTCOME the spec-writer turns into spec requirements/ACs; phrased to be testable
without pre-deciding the design. "MUST" = hard requirement; "SHOULD" = strong default
the design may deviate from with justification; "MAY" = explicitly allowed latitude.

### R-group A — Native structure/navigation surface

- **A1 (MUST).** The structure/navigation surface (Section → Measure → hand → Note)
  is built on stock `@wordpress/*` components — `__experimentalTreeGrid` + its
  `TreeGridRow`/`TreeGridCell`/`TreeGridItem` (the same accessible primitive core's
  own List View is built on). It MUST NOT depend on `PrivateListView` or any
  `@wordpress/*` `privateApis`/`lock()`-gated export (those throw for plugin modules
  and break on the next WP release — F1). `__experimental*` PUBLIC exports remain
  allowed (already shipped).
- **A2 (MUST).** Per-row actions (remove / duplicate / add) use a native menu pattern —
  a row `DropdownMenu`/ellipsis (`icon={moreVertical}`, `MenuGroup`/`MenuItem`, all
  stable) — NOT always-on per-row icon-Button rows. The menu contents are
  context-dependent per row kind; each ellipsis trigger carries a per-row accessible
  name via `DropdownMenu`'s `label` (reusing the ordinal labels the code already
  computes). The trigger MUST live inside a `TreeGridCell`/`TreeGridItem` render-prop
  so it stays in TreeGrid's roving tabindex (F2/F3).
- **A3 (MUST).** The hand-built `▸`/`▾` text-glyph carets are replaced by a stock
  disclosure affordance (e.g. a `@wordpress/icons` chevron Button), not a glyph
  concatenated into the label — preserving the sighted disclosure cue (F2). (If the
  design makes the tree non-collapsible, the carets are simply removed instead.)

### R-group B — Simplify the implementation (net code reduction)

- **B1 (MUST).** The dual-Set expansion regime (`expandedPaths` +
  `collapsedOverride`) and the selection-ancestor auto-reveal/veto logic are
  eliminated in favor of a single expansion model (e.g. one expanded-Set). Any
  auto-reveal-on-select kept is a trivial "add the selection's ancestors to the one
  Set," not a second veto Set (F2).
- **B2 (SHOULD).** The index-path STRING addressing scheme (`s0/m1/rightHand/e2`)
  collapses to plain React keys + direct coordinate handlers as a consequence of B1
  (it exists only to key the two Sets — F2). _(SHOULD, because its exact form follows
  from the chosen expansion design.)_
- **B3 (MUST).** A meaningful NET REDUCTION in editor-UI code, achieved by removing
  hand-rolled mechanism — not by reskinning. INHERENT work that MAY remain (do not
  demand its removal): the flatten of the song into an ordered `TreeGridRow[]` with
  `level`/`positionInSet`/`setSize`, and app-owned expansion state in some form (F2).
- **B4 (MUST).** Inspector mechanism de-duplication (visual-change-independent):
  the draft/projection logic duplicated between `ContextEditor` and `SongPanel`, the
  repeated `clampInt`/`toBoundedInt` helpers (3×/2×), and the per-panel emit-splice +
  omit-empty idioms are consolidated into shared helpers (e.g. clamp helpers in
  `songModel.js`; one `setAtPath` splice; one `omitEmpty`) (F4).

### R-group C — Eliminate / reduce custom CSS

- **C1 (MUST).** The bespoke `--pb-tree-depth` CSS variable + its `padding-left`
  indent rule are eliminated; indentation derives from the tree's own level
  (`aria-level`/`level`) or package styling (F1/F2).
- **C2 (MUST).** The scale-coupled selected-event highlight in `style.scss` (the
  hairline whose width is coupled to `SP_PX=8` by a divide-by-8 comment) is
  eliminated or replaced so NO scale-coupled magic number remains in SCSS, while the
  on-canvas selected-event highlight keeps working (D2). The replacement MUST NOT
  change the emitted/front-end SVG (see E1).
- **C3 (MUST).** Remaining editor CSS is reduced to layout-glue that visually belongs
  in the editor; no bespoke component styling, no fixed-width bespoke rail that fights
  native chrome. (The `@font-face` "PB Music" declaration is front-end notation, NOT
  editor chrome — explicitly OUT OF SCOPE.)

### R-group D — Surface placement & inspector shape (latitude, with guardrails)

- **D1 (MAY).** The structure surface's placement is OPEN: inline in the block edit
  area (A), an `InspectorControls` panel (B), or a toolbar-launched popover as a
  SECONDARY launcher (C) — all stock-feasible (F3). If placed in `InspectorControls`,
  the design MUST account for the ~280px sidebar width (deep note rows can cramp). The
  toolbar popover MUST NOT be the SOLE home of a surface the author returns to
  constantly. The split of surfaces (tree/canvas/inspector) MAY change.
- **D2 (MAY).** The inspector panel SHAPE is OPEN: keep the kind-gated stacked panels
  OR explore a `Navigator` drill-down (stable, importable) — but the spec does NOT
  mandate Navigator; if chosen, the design MUST keep the structure-selection and the
  Navigator route in sync (F4). The falsifiable wins (B4, E5, E6) hold regardless of
  shape.
- **D3 (SHOULD).** Action entry points are RATIONALIZED: the current duplication
  sprawl (add/remove scattered across tree rows AND multiple inspector panels) reduces
  to one primary locus per action with at most a deliberate secondary (F3). _(SHOULD —
  multiple native loci are idiomatic; the requirement is "no redundant sprawl," not
  "exactly one place.")_

### R-group E — Preserved capabilities & invariants (MUST, non-negotiable)

- **E1 (MUST).** Editor-side only: the song schema, `render.php`, and the front-end
  SVG are unchanged — a published song renders BYTE-IDENTICALLY before and after. The
  selection-highlight rewrite MUST NOT alter the emitted SVG or its `data-*` hooks
  (`data-measure`/`data-hand`/`data-event-index`) — the highlight stays an
  editor-only post-render decoration (prompt constraint; D2).
- **E2 (MUST).** Only `@wordpress/*` packages WordPress already provides; NO outside
  runtime dependencies (prompt constraint; F1).
- **E3 (MUST).** Full visual build/edit preserved: select any section/measure/note;
  add/remove/duplicate sections, measures, notes; rename sections/measures; live
  canvas preview updates; selected-EVENT highlight on the canvas.
- **E4 (MUST).** Valid-by-construction — visual editing can only produce
  schema-conformant songs (incl. tempo needs `bpm`; timeSignature needs both
  `beats`+`beatType`; omit-when-empty round-trips) (E4 of prompt; F4).
- **E5 (MUST).** No field-reachability regression. Every field in the F4 map remains
  reachable, including the BURIED ones: pitch `step`/`octave`/`alter`; annotation
  `text`/`placement`/`staff`; handConfig `clef`/`octaveShift`/`alters`-map; SECTION
  OVERRIDE tempo/timeSignature/hand-configs (distinct from song defaults); tempo
  `beatUnit`; barlines; dots; dynamic; the four spans; names; note language (F4).
- **E6 (MUST).** Each selectable node kind reaches its own settings when selected —
  selecting a section row reaches section settings, a measure row reaches measure
  settings, an event reaches note settings — with Song always available, independent
  of any event selection. This already works correctly today (verified against
  `edit.js`'s kind-gating; the panels' "only when an event is selected" header
  comments are stale), so E6 is a PRESERVE-DON'T-REGRESS invariant, not a gap to fix
  (F4).
- **E7 (MUST).** Raw-JSON mode behind the toolbar toggle, with its non-blocking
  validation, unchanged in behavior (prompt).
- **E8 (MUST).** Keyboard operability / accessibility at least as good as today's
  TreeGrid tree — preserved BY CONSTRUCTION by staying on TreeGrid (the current code
  adds zero keyboard handlers), provided every interactive row element stays inside
  `TreeGridCell`/`TreeGridItem` (A2 caveat; F2).

### Non-goals / explicit latitude (so later phases don't over-build)

- Nothing about the current UI is assumed right; the interaction model, surface split,
  structure-list location, and panel contents MAY all change if it yields a simpler,
  more native editor (prompt §Goals).
- The spec does NOT pick a placement (D1) or a panel shape (D2); it requires the
  outcomes, not the design.
- A line-count TARGET is intentionally NOT fixed — B3 requires a "meaningful net
  reduction" achieved by removing the named mechanisms, judged qualitatively, not a
  numeric quota.

## 9. Blockers

None. All inputs (the self-contained prompt + the current branch code) were present
and consistent; every feasibility fact the requirements depend on was established
(F1-F4). Requirements complete.
