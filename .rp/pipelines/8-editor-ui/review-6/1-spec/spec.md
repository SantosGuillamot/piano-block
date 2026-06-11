# Review 6 Spec — Simplify the editor UI with Gutenberg-native components and styles

_Spec for review 6 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Standalone: a reader with this file and the code on branch `worktree-8-editor-ui` has everything needed. Later phases (design, plan, code, docs) work from this spec._

## Overview

The Piano block ships a working visual editor for sheet music. Today it is laid out, inside the block's edit area, as a flex row: a custom **structure tree** (Section → Measure → Right/Left hand → Note) on the left beside a read-only **sheet-music canvas** on the right, with per-kind **settings panels** in the block's inspector (right sidebar). A toolbar toggle switches the whole block to a raw-JSON textarea. The author can fully build and edit a song — sections, measures, notes/rests/chords, durations, dots, dynamics, ties, slurs, annotations, barlines, renames, duplications — and see a live canvas preview, with the selected event highlighted on the canvas.

The owner's verdict on the current state: _"The UI starts to feel better. However, the implementation looks overly complex."_ Review 6 is **not** about adding capability. It is about making the editor UI **simpler, more native to the WordPress editor, and built out of Gutenberg's own parts** instead of bespoke ones, with a meaningful net reduction in editor-UI code — while preserving every existing authoring capability and leaving the published output byte-identical.

The current editor UI is roughly 3,300 lines of JS plus custom SCSS. Much of it is hand-rolled mechanism rather than feature:

- **`src/editor/StructureTree.js` (542 lines)** — a custom tree built on `@wordpress/components`' `__experimentalTreeGrid`. It hand-rolls: index-path string addressing for row flattening (`s0/m1/rightHand/e2`), a two-Set expansion regime (`expandedPaths` + `collapsedOverride`) with selection-ancestor auto-reveal/veto logic, text-glyph disclosure carets (`▸`/`▾`) concatenated into the row label, an inline `--pb-tree-depth` CSS variable for indentation, and always-on per-row icon `Button`s for remove / duplicate / add-measure / add-note.
- **`src/style.scss` (editor block region)** — a bespoke `&__workspace` flex row, a fixed-width `&__tree` rail (16em), the `--pb-tree-depth` → `padding-left` indent rule, the `&__canvas` layout, and an `.is-selected` highlight that recolors the selected event's SVG ink and draws a hairline outline **whose width is coupled to the notation's `SP_PX = 8` scale constant by a divide-by-8 comment**. These styles do not match how the editor styles its own UI.
- **Inspector panels in `src/editor/inspector/`** — `SongPanel`, `SectionPanel`, `MeasurePanel`, `NotePanel`, plus supporting leaf editors (`HandConfigEditor`, `ContextEditor`, `PitchEditor`, `PitchList`, `AnnotationList`, `AnnotationEditor`, `MetadataEditor`). The control vocabulary is already stock and idiomatic (`PanelBody` + `__experimentalToolsPanel`/`ToolsPanelItem` with stock `SelectControl`/`TextControl`/`TextareaControl`/`__experimentalNumberControl` leaves). The complexity here is **duplicated mechanism**, not the controls: `SongPanel` re-copies `ContextEditor`'s draft/projection logic verbatim (~60 lines), `clampInt` is defined identically three times and `toBoundedInt` twice, and each panel hand-writes its own emit-splice + omit-when-empty idiom.

The honest reading of the owner's "reuse the components Gutenberg uses to list blocks" suggestion is that core's own List View is **not importable** for a third-party block (it ships only behind the locked `privateApis` bundle and is coupled to the block-editor store, not data-driven), but core's List View is itself built on `__experimentalTreeGrid` — the **same accessible primitive this block already uses**. So the native path is to keep TreeGrid as the foundation, lean harder on stock pieces around it (native `DropdownMenu` row actions, level-driven indentation, stock disclosure chevrons), and delete the hand-rolled machinery the stock pieces make unnecessary. The structure surface's placement and the inspector's panel shape are left open for the design phase.

The change is strictly editor-side: the song format/schema, `render.php`, and the front-end SVG rendering are unchanged, so a published song renders byte-identically before and after this review.

## Requirements

Requirements use RFC-2119 keywords: **MUST** = hard requirement; **SHOULD** = strong default a design may deviate from only with justification; **MAY** = explicitly allowed latitude. Requirements are grouped; identifiers (R-A1 … R-E8) are stable references for later phases.

### Group A — Native structure/navigation surface

- **R-A1 (MUST).** The structure/navigation surface (Section → Measure → hand → Note) is built on stock `@wordpress/*` components — `__experimentalTreeGrid` together with its `TreeGridRow` / `TreeGridCell` / `TreeGridItem` (the same accessible primitive core's own List View is built on). It MUST NOT depend on `PrivateListView`, the `@wordpress/block-editor` `privateApis` bundle, or any `lock()`-gated / `__dangerousOptInToUnstableAPIsOnlyForCoreModules`-gated export — these throw for plugin modules and are contractually documented to break on the next WordPress release. Public `__experimental*` exports remain allowed (the project already ships several).

- **R-A2 (MUST).** Per-row actions (remove / duplicate / add) use a native menu pattern — a row `DropdownMenu` / ellipsis (e.g. `icon={ moreVertical }` from `@wordpress/icons`, with `MenuGroup` / `MenuItem`, all stable) — NOT always-on per-row icon-`Button` rows. The menu contents MAY differ by row kind (a section row, a measure row, and a note row expose different actions). Each ellipsis trigger MUST carry a per-row accessible name (e.g. via `DropdownMenu`'s `label` prop, reusing the ordinal labels the code already computes, such as "Actions for Section 2"). Destructive items (remove) SHOULD be marked `isDestructive`.

- **R-A3 (MUST).** The interactive disclosure cue for sighted users is a stock affordance, not a hand-built text glyph. The `▸` / `▾` characters concatenated into the row label `Button` are removed; if the tree remains collapsible, disclosure is shown with a stock chevron (e.g. a `Button` with a `@wordpress/icons` chevron such as `chevronRightSmall` / `chevronDownSmall`). If the design makes the tree fully-expanded / non-collapsible, the carets are simply removed and no disclosure affordance is required.

### Group B — Simplify the implementation (net code reduction)

- **R-B1 (MUST).** The dual-Set expansion regime (`expandedPaths` + `collapsedOverride`) and the selection-ancestor auto-reveal / veto logic are eliminated in favor of a single expansion model (e.g. one expanded-Set with one toggle). Auto-reveal-on-select is a product choice the design MAY keep or drop; if kept, it MUST collapse to a trivial "add the selection's ancestor keys to the single Set," not a second disjoint veto Set.

- **R-B2 (SHOULD).** The index-path string addressing scheme (`s0/m1/rightHand/e2`) is removed in favor of plain React keys and direct coordinate handlers. (SHOULD rather than MUST because the exact replacement form follows from the expansion model chosen for R-B1; these strings exist today only to key the two Sets.)

- **R-B3 (MUST).** Inspector mechanism is de-duplicated (this is visual-change-independent — no control or layout change is required to satisfy it): the draft/projection logic duplicated between `ContextEditor` and `SongPanel`, the repeated `clampInt` (3×) and `toBoundedInt` (2×) helpers, and the per-panel emit-splice + omit-when-empty idioms are consolidated into shared helpers (for example: clamp helpers living once in `songModel.js`; a single splice-into-song-at-coordinates helper; a single omit-when-empty helper).

- **R-B4 (MUST).** The review achieves a **meaningful net reduction in editor-UI code**, accomplished by removing the hand-rolled mechanism named in R-A2, R-A3, R-B1, R-B2, R-B3, and R-C1/R-C2 — not by reskinning. No numeric line-count quota is set; the reduction is judged qualitatively against whether the named mechanisms are gone. The following work is **inherent** and MAY remain — its presence is NOT a failure to simplify:
  - the recursive flatten of the song into an ordered list of `TreeGridRow`s, each carrying its `level` / `positionInSet` / `setSize` (TreeGrid renders a flat caller-ordered table and does not flatten nested children itself);
  - app-owned expansion state in some single form (TreeGrid delegates expansion entirely to the caller and stores none).

### Group C — Eliminate / reduce custom CSS

- **R-C1 (MUST).** The bespoke `--pb-tree-depth` CSS variable and its `padding-left` indent rule are eliminated; indentation derives from the tree's own level (`aria-level` / the row's `level`) or from package styling.

- **R-C2 (MUST).** The scale-coupled selected-event highlight in `style.scss` — the hairline outline whose width is coupled to `SP_PX = 8` by a divide-by-8 comment — is eliminated or replaced so that NO scale-coupled magic number remains in the SCSS, while the on-canvas selected-event highlight keeps working (see R-E3). The replacement MUST NOT change the emitted / front-end SVG or its `data-*` hooks (see R-E1) — the highlight remains an editor-only post-render decoration.

- **R-C3 (MUST).** Remaining editor CSS is reduced to layout-glue that visually belongs in the editor: no bespoke component styling and no fixed-width bespoke rail that fights native editor chrome. (The `@font-face` "PB Music" declaration at the top of `style.scss` is front-end notation, not editor chrome, and is explicitly OUT OF SCOPE — it is not editor CSS.)

### Group D — Surface placement & inspector shape (latitude with guardrails)

- **R-D1 (MAY).** The structure surface's placement is OPEN. All of these are stock-feasible: inline in the block edit area (the status-quo location, restyled); an `InspectorControls` panel in the right sidebar; or a toolbar-launched popover from a `BlockControls` button as a **secondary** launcher. Guardrails: if placed in `InspectorControls`, the design MUST account for the fixed ~280px sidebar width (a four-level-deep tree with indentation plus a per-row ellipsis can cramp deep note rows); a toolbar popover MUST NOT be the **sole** home of a surface the author returns to constantly. The overall split of surfaces (structure / canvas / inspector) MAY change if it yields a simpler, more native editor.

- **R-D2 (MAY).** The inspector panel **shape** is OPEN. The design MAY keep the kind-gated stacked panels, or explore a `Navigator` / `useNavigator` drill-down (stable and importable). This spec does NOT mandate `Navigator`. If a drill-down is chosen, the design MUST keep the structure-surface selection and the `Navigator` route in sync (two navigation models that must always agree). The falsifiable wins (R-B3, R-E5, R-E6) hold regardless of the shape chosen.

- **R-D3 (SHOULD).** Action entry points are rationalized. The current duplication sprawl — add / remove scattered across tree rows AND multiple inspector panels — is reduced to one primary locus per action, with at most a deliberate secondary entry point. (SHOULD rather than MUST because multiple native loci are idiomatic in the block editor; the requirement is "no redundant sprawl," not "exactly one place.")

### Group E — Preserved capabilities & invariants (MUST, non-negotiable)

- **R-E1 (MUST).** The change is editor-side only: the song schema, `render.php`, and the front-end SVG are unchanged, so a published song renders **byte-identically** before and after. In particular, the selection-highlight rewrite (R-C2) MUST NOT alter the emitted SVG or its `data-*` selection hooks (`data-measure` / `data-hand` / `data-event-index`); the highlight stays an editor-only post-render decoration applied by the canvas component, never by the front-end view.

- **R-E2 (MUST).** Only `@wordpress/*` packages that WordPress already provides are used; NO outside runtime dependencies are added.

- **R-E3 (MUST).** Full visual build/edit is preserved: the author can select any section, measure, or note; add, remove, and duplicate sections, measures, and notes; rename sections and measures; see the live canvas preview update on every edit; and see the selected-event highlight on the canvas.

- **R-E4 (MUST).** Valid-by-construction is preserved: visual editing can only produce schema-conformant songs. This includes the required-field constraints (a tempo needs `bpm`; a time signature needs both `beats` and `beatType`) and the omit-when-empty round-trip behavior.

- **R-E5 (MUST).** No field-reachability regression. Every field reachable in the inspector today remains reachable, including the ones buried in leaf editors that a naive flatten could silently drop:
  - **Song:** metadata `title` / `composer` (in `MetadataEditor`); per-song note-name language; `defaults.tempo.bpm`; `defaults.timeSignature.beats` / `beatType`; `defaults.tempo.beatUnit` (advanced); `defaults.rightHand` / `defaults.leftHand` handConfig `clef` / `octaveShift` / `alters`-map (in `HandConfigEditor`, advanced).
  - **Section:** section `name`; per-section overrides `tempo` / `timeSignature` / `rightHand` / `leftHand` (in `ContextEditor` → `HandConfigEditor`, advanced) — these overrides are distinct from song defaults and reachable only on a section.
  - **Measure:** measure `name`; `barlineStart` / `barlineEnd` (advanced); measure standalone `annotations` `text` / `placement` / `staff` (in `AnnotationList` → `AnnotationEditor`, advanced).
  - **Event/Note:** `type`; `duration`; chord `pitches` `step` / `octave` / `alter` (in `PitchList` → `PitchEditor`, when `type === "note"`); `dots`; `dynamic`; the four spans `tie` / `slur` / `crescendo` / `decrescendo` (advanced); event `annotations` `text` / `placement` (advanced).

- **R-E6 (MUST).** Each selectable node kind reaches its own settings when selected — selecting a section row reaches section settings, a measure row reaches measure settings, an event reaches note settings — with the Song panel always available, independent of any event selection. This is a working invariant today (verified against `edit.js`'s kind-gating; the panels' "only when an event is selected" header comments are stale); it is a PRESERVE-DON'T-REGRESS invariant, not a gap to fix.

- **R-E7 (MUST).** Raw-JSON mode behind the toolbar toggle, with its non-blocking validation, is unchanged in behavior.

- **R-E8 (MUST).** Keyboard operability and accessibility are at least as good as today's TreeGrid-based tree. Staying on TreeGrid preserves this by construction (the current code adds zero custom keyboard handlers — all navigation is TreeGrid's roving tabindex: Up/Down between rows, Left/Right to collapse/expand and move to parent, Home/End). The one thing the redesign MUST preserve: every interactive row element — the row label, the new `DropdownMenu` trigger, and any chevron expander — stays wrapped in `TreeGridCell` / `TreeGridItem` so it remains in TreeGrid's roving tabindex.

## Out of Scope

- **Adding authoring capability.** Review 6 simplifies and re-natives the existing UI; it does not add new song-editing features.
- **Any change to the published output.** The song schema, `render.php`, and the front-end SVG (including its `data-*` hooks and the `@font-face` "PB Music" notation font) are not editor chrome and are not touched. R-C2's highlight rewrite is constrained to leave them byte-identical.
- **Importing or unlocking core's List View.** `PrivateListView` and the `privateApis` bundle are forbidden (R-A1); this review does not attempt to register song nodes as real inner blocks to make List View consume them (that would be heavier, not simpler).
- **Mandating a specific surface placement or inspector shape.** The spec sets the constraint envelope (R-D1, R-D2); the design phase chooses within it. It does not pre-decide inline-vs-sidebar-vs-toolbar, nor stacked-panels-vs-`Navigator`.
- **A numeric line-count target.** R-B4 requires a meaningful net reduction judged qualitatively against the removal of named mechanisms, not a quota.
- **Rewriting the inspector's stock control vocabulary.** `PanelBody` / `ToolsPanel` / `SelectControl` / `TextControl` / `NumberControl` are already the correct native pattern and are preserved; the inspector work is mechanism de-duplication (R-B3), not a control rewrite.

## Acceptance Criteria

Written as Given/When/Then scenarios over the delivered branch. AC identifiers map to the requirement they verify.

**AC-A1 — TreeGrid foundation, no private APIs.**
- Given the delivered editor-UI source, When its imports are inspected, Then the structure surface is built on `__experimentalTreeGrid` (+ `TreeGridRow` / `TreeGridCell` / `TreeGridItem`) and there is no import of `PrivateListView`, the `block-editor` `privateApis` bundle, or any `lock()` / `__dangerousOptInToUnstableAPIsOnlyForCoreModules` unlock. (R-A1, R-E2)

**AC-A2 — Native row-action menus.**
- Given a row in the structure surface, When the author opens its actions, Then the actions are presented in a native `DropdownMenu` / ellipsis (not an always-on icon-`Button` row), the menu's contents are appropriate to that row's kind, the trigger has a per-row accessible name, and remove is marked destructive. (R-A2, R-D3)
- Given keyboard-only operation, When the author focuses a row and triggers its action menu, Then the menu opens, traps focus while open, and on close returns focus to the trigger, which is still in the row's tab order. (R-A2, R-E8)

**AC-A3 — Stock disclosure, no text-glyph carets.**
- Given the rendered structure surface, When a sighted author looks at an expandable row, Then any disclosure cue is a stock affordance (e.g. a chevron `Button`) and the `▸` / `▾` characters are not present in the row label; OR, if the tree is non-collapsible, there is no disclosure affordance and the glyphs are absent. (R-A3)

**AC-B1 — Single expansion model.**
- Given the delivered source, When the expansion state is inspected, Then there is a single expansion model (e.g. one expanded-Set) and the `expandedPaths` + `collapsedOverride` dual-Set regime and the selection-ancestor auto-reveal/veto logic are gone. Any auto-reveal-on-select is a one-step "add ancestors to the single Set." (R-B1)

**AC-B2 — Index-path strings removed.**
- Given the delivered source, When row addressing is inspected, Then the `s0/m1/rightHand/e2` index-path string scheme is gone (replaced by plain keys + direct coordinate handlers), OR a justification is recorded for why the chosen expansion design retains an equivalent. (R-B2)

**AC-B3 — Inspector mechanism de-duplicated.**
- Given the delivered inspector source, When helpers are inspected, Then `ContextEditor`'s draft/projection logic is no longer copied into `SongPanel`, `clampInt` / `toBoundedInt` exist once (e.g. in `songModel.js`), and the per-panel emit-splice + omit-when-empty idioms are consolidated into shared helpers. The visible inspector behavior is unchanged by this consolidation. (R-B3)

**AC-B4 — Meaningful net reduction.**
- Given the before/after editor-UI source, When the named mechanisms are reviewed, Then the hand-rolled machinery (always-on icon rows, text-glyph carets, dual-Set expansion, index-path strings, duplicated inspector helpers, `--pb-tree-depth`, scale-coupled highlight) is gone and editor-UI code is meaningfully smaller, with only the inherent flatten + single expansion state remaining. (R-B4)

**AC-C1 — Level-driven indentation.**
- Given `style.scss`, When the editor CSS is inspected, Then `--pb-tree-depth` and its `padding-left` indent rule are gone and indentation derives from the row's level or package styling, while the hierarchy still reads as nested. (R-C1)

**AC-C2 — No scale-coupled magic number; highlight still works.**
- Given `style.scss`, When the selected-event highlight rule is inspected, Then no `SP_PX`-coupled / divide-by-8 magic number remains; And When an event is selected in the editor, Then it is still visibly highlighted on the canvas; And When a song is published, Then the emitted SVG (including `data-measure` / `data-hand` / `data-event-index`) is byte-identical to before. (R-C2, R-E1)

**AC-C3 — Editor CSS is layout-glue only.**
- Given the editor region of `style.scss`, When it is reviewed, Then what remains is layout-glue that belongs in the editor, with no bespoke component styling and no fixed-width rail fighting native chrome; the `@font-face` notation declaration is untouched. (R-C3)

**AC-D1 — Placement within the envelope.**
- Given the delivered placement, When it is reviewed, Then it is one of inline / `InspectorControls` panel / toolbar-secondary, a toolbar popover is not the sole home, and if it is in `InspectorControls` the ~280px width is accounted for (no clipped/unreachable controls on deep note rows). (R-D1)

**AC-D2 — Inspector shape in sync.**
- Given the delivered inspector shape, When the author selects a node in the structure surface, Then the inspector shows that node's settings; if a `Navigator` drill-down was chosen, the structure selection and the `Navigator` route stay in agreement (selecting a node routes the inspector to it, and vice versa). (R-D2, R-E6)

**AC-E1 — Byte-identical publish.**
- Given any song, When it is published before and after the review, Then `render.php`'s output and the front-end SVG are byte-identical and the song schema is unchanged. (R-E1)

**AC-E3 — Full visual build/edit preserved.**
- Given the visual editor, When the author selects, adds, removes, duplicates, and renames sections/measures/notes, Then every one of those operations works, the canvas preview updates live, and the selected event is highlighted on the canvas — at parity with the current branch. (R-E3)

**AC-E4 — Valid by construction.**
- Given visual editing only, When any sequence of edits is performed, Then the resulting song is always schema-conformant (tempo has `bpm`; time signature has both `beats` and `beatType`; empty optionals are omitted on round-trip). (R-E4)

**AC-E5 — No field-reachability regression.**
- Given the delivered inspector, When each field in the Group E (R-E5) field map is sought, Then every one — including the buried pitch `step`/`octave`/`alter`, annotation `text`/`placement`/`staff`, handConfig `clef`/`octaveShift`/`alters`-map, the section-level overrides distinct from song defaults, tempo `beatUnit`, barlines, dots, dynamic, the four spans, names, and note language — is reachable and editable. (R-E5)

**AC-E6 — Per-kind settings on selection.**
- Given a section row is selected, Then section settings are reachable; Given a measure row is selected, Then measure settings are reachable; Given an event is selected, Then note settings are reachable; And in all cases the Song panel is available; And this holds independent of whether any event is selected. (R-E6)

**AC-E7 — Raw-JSON mode unchanged.**
- Given the toolbar "Edit as JSON" toggle, When the author switches to JSON mode and edits, Then behavior — including the non-blocking validation — is unchanged from the current branch. (R-E7)

**AC-E8 — Keyboard parity.**
- Given keyboard-only operation of the structure surface, When the author uses Up/Down, Left/Right, Home/End and Enter/Space, Then navigation and activation are at least as capable as the current TreeGrid tree, and every interactive row element (label, action-menu trigger, expander) is reachable via the roving tabindex. (R-E8)
