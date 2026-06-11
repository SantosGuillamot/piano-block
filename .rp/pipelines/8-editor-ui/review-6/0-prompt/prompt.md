# Review 6: Simplify the editor UI by leaning on Gutenberg's own components and styles

_Review 6 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/` or `review-1..5/` artifact folders._

## Owner verdict

> The UI starts to feel better. However, the implementation looks overly complex.

This review is **not** about adding capability. It is about making the editor UI **simpler, more native to the WordPress editor, and built out of Gutenberg's own parts** instead of bespoke ones.

## Context: what exists today

The visual editor (all under `src/editor/`, with `src/edit.js` as the visual/raw-JSON mode container) is laid out as a flex row inside the block: a **left structure tree** beside a **read-only sheet-music canvas**, with per-kind settings panels in the block's inspector (right sidebar). Concretely:

- **`src/editor/StructureTree.js` (~540 lines)** — a custom tree (Section → Measure → Right/Left hand → Note) hand-built on `@wordpress/components`' `__experimentalTreeGrid`. It hand-rolls: index-path row flattening, a two-Set expansion regime (`expandedPaths` + `collapsedOverride` with auto-reveal-ancestors logic), text-glyph carets (`▸`/`▾`), an inline `--pb-tree-depth` CSS variable for indentation, and per-row icon `Button`s for **remove / duplicate / add measure / add note**.
- **Custom CSS in `src/style.scss`** — the workspace flex row, the fixed-width tree rail, the depth-indentation rule, and a selected-note highlight that recolors the note's SVG ink and draws a hairline outline whose width is **coupled to the notation's `SP_PX` scale constant by a divide-by-8 comment**. These styles are bespoke and don't match how the editor styles its own UI.
- **Inspector panels in `src/editor/inspector/`** — `SongPanel` (~280 lines: metadata, tempo, time signature, note-name language, hand/clef config, Add section), `SectionPanel`, `MeasurePanel`, `NotePanel` (~290 lines), plus supporting editors (`HandConfigEditor`, `ContextEditor`, `PitchEditor`, `PitchList`, `AnnotationList`, `AnnotationEditor`, `MetadataEditor`). Selection in the tree decides which panels show.
- In total the editor UI is **~3,300 lines of JS plus the custom SCSS**, much of it mechanism (flattening, expansion regimes, selection plumbing, custom button rows) rather than feature.

It works — the author can build a full song (sections, measures, notes/rests/chords, dynamics, ties, slurs, annotations, renames, duplications) and sees a live preview. Raw-JSON editing stays behind the toolbar's "Edit as JSON" toggle.

## The problems (the owner's feedback, verbatim in spirit)

1. **The left sidebar is a custom implementation, and so are its remove / add / duplicate buttons.** Gutenberg already has a well-known UI for exactly this shape of problem: the **List View** — the component stack the editor uses to list blocks and inner blocks in its sidebar (rows with icons, native indentation, expand/collapse, selection states, an ellipsis/dropdown for per-item actions, drag handles). The owner explicitly suggests **reusing the same components Gutenberg uses to list blocks and inner blocks, even if we place that surface somewhere other than the editor's global sidebar**.
2. **The custom styles don't fit the editor.** Bespoke rails, indentation variables, and scale-coupled hairlines look and feel foreign next to native editor chrome. The UI should get its look from Gutenberg packages/styles, not from our SCSS.
3. **The implementation is overly complex relative to what it does.** The owner wants the implementation actively **simplified** — fewer hand-rolled mechanisms, less code — not just reskinned.
4. **The block-settings panels are included in the rethink.** The inspector panel structure (Song/Section/Measure/Note panels and their many sub-editors) should also be explored for simplification.

## Goals

- **Rebuild the structure/navigation surface out of the components Gutenberg itself uses** to list blocks and inner blocks (the List View stack), or — if research shows those exact components cannot be reused for non-block data — the closest stock `@wordpress/components`/`@wordpress/block-editor` equivalents, styled by the packages themselves. Per-item actions (remove / duplicate / add) should use native patterns (e.g. a row's `DropdownMenu`/ellipsis or toolbar conventions), not hand-built always-on icon rows.
- **Eliminate or drastically reduce the custom CSS.** What little remains must be layout-glue that visually belongs in the editor; no bespoke component styling, no scale-coupled magic numbers in SCSS if avoidable.
- **Simplify the implementation.** Replace hand-rolled mechanisms (row flattening, dual expansion Sets, depth CSS variables, custom carets) with what the reused components already provide. A meaningful net reduction in editor-UI code is an explicit goal.
- **Explore simplifying the block-settings (inspector) panels** — fewer/flatter panels, stock controls, progressive disclosure — and let the structure surface and inspector share one coherent, Gutenberg-native model.
- **Nothing about the current UI is assumed right.** The split of surfaces (tree left, canvas right, settings in the inspector), the interaction model, where the structure list lives, and what each panel contains can all change if it yields a simpler, more native editor. The owner's placement note is the only soft anchor: the block-list-style surface need not live in the editor's global sidebar — it can be placed where it serves the block best.

## What must keep working (capability, not surface)

- The author can still **fully build and edit a song visually**: select any section/measure/note; add/remove/duplicate sections, measures, and notes; rename sections/measures; edit all per-kind settings (tempo, time signature, clefs, accidentals/octave shifts, pitches, durations, dots, dynamics, ties, slurs, annotations, barlines); see the live canvas preview update; selected-event highlight on the canvas.
- **Valid by construction** — visual editing can only produce schema-conformant songs.
- **Raw-JSON mode** behind the toolbar toggle, with its non-blocking validation, unchanged in behavior.
- **Keyboard operability / accessibility** at least as good as today's TreeGrid-based tree.

## Constraints carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); **no outside dependencies**. If a Gutenberg component is private/experimental, research must verify it is actually importable and stable enough to ship before the design commits to it — with a stock-component fallback otherwise.
- The change stays editor-side: the **song format/schema, `render.php`, and the front-end SVG rendering are unchanged** — a published song renders byte-identically before and after this review.
