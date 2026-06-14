# Review 5: Make tree action buttons visible, move "Add section" to block settings, and genuinely shrink the selected-note highlight

_Review 5 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/` or `review-1..4/` artifact folders._

## Context: what exists today

Review 3 introduced a left **structure tree** (Section → Measure → Right/Left hand → Note) as the editor's selection surface; review 4 polished it (open by default, indentation, panel order, a collapse fix) and reduced the selected-note canvas highlight. Each tree row has per-row action buttons (remove / duplicate / add-measure / add-note) and there is a top-level **"Add section"** button. The selected note is highlighted on the canvas.

## The problems (observed in the editor — described here since later phases can't see the screenshots)

1. **The per-row remove and duplicate buttons are effectively invisible.** In the structure tree, the remove and duplicate controls for sections, measures, and notes render as `@wordpress/components` `Button`s with `variant="tertiary"`, which appear as faint/transparent icons — you can't see them until you hover (a tooltip like "Remove measure 1 of section 1" is the only hint they exist). The per-row **add-measure / add-note** icon buttons have the same problem. (By contrast, the bottom **"Add section"** button uses a visible bordered style.)
2. **The "Add section" button should move to the block settings.** Remove the top-level "Add section" button from the structure tree for now, and let the author add a section from the **block settings** (the right-hand inspector sidebar) instead.
3. **The selected-note highlight is still a large, thick box.** Despite review 4 setting `.is-selected { outline: 1px solid #007cba; outline-offset: 1px }` on the note's SVG `<g>`, the highlight renders on the canvas as a big, heavy blue frame around the note — far from a 1px line. (Likely cause to investigate: an `outline` on a `<g>` inside the notation SVG is drawn in the SVG's user coordinate space and magnified by the staff-space→pixel viewBox scale, so a "1px" outline becomes thick on screen.) It should be a **much smaller, subtle** highlight.

## Goals

- Make the structure tree's per-row **remove / duplicate (and add)** action buttons **clearly visible**, using standard Gutenberg/theme button styling.
- **Remove the tree's "Add section" button** and provide **add-section from the block-settings sidebar** instead.
- Make the **selected-note highlight genuinely small/subtle** — root-cause why the current `outline` renders large and use a highlight that stays thin at the displayed scale.

## Constraint carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no outside dependencies. The change stays editor-side; the song format/schema, `render.php`, and the front-end SVG rendering are unchanged.
