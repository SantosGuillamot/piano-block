# Review 4: Polish the structure tree — defaults, indentation, theming, highlight, panel order, collapse

_Review 4 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/`, `review-1/`, `review-2/`, or `review-3/` artifact folders._

## Context: what exists today

Review 3 made a **left structure tree** (Section → Measure → Right/Left hand → Note, on `@wordpress/components`' `__experimentalTreeGrid`) the way the author navigates and selects the song. The tree lives in a toggleable panel beside the canvas; the canvas is display + highlight only (selecting a tree node highlights the matching element on the canvas and opens its settings in the right inspector). The tree offers add / remove / duplicate at each level and rename for sections/measures.

## The problems / goals

This review polishes that tree and the surrounding selection UX. All changes are editor-side; the song format, server render, and front-end SVG rendering stay unchanged.

1. **Open the structure tree by default when the block is selected** (today it starts closed / requires toggling on).
2. **Show the hierarchy with indentation** — sections, measures, and notes should be visually indented so the parent/child relationship is clear.
3. **Style the add / remove / duplicate controls with the theme/WordPress button styles** — right now they appear completely white (unstyled); they should use the standard editor button styling.
4. **Remove the canvas highlight for a selected section or measure** — it looks weird right now; drop it for now (the note highlight stays).
5. **Reduce the selected-note highlight border** — it is currently far too large/heavy.
6. **Reorder the block-settings panels** so that, when a note is selected, they appear most-specific first: **Note → Measure → Section → Song**.
7. **Fix the flaky collapse** — expanding/collapsing tree nodes sometimes doesn't work.

## Constraint carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no outside dependencies. The change stays editor-side; the song format/schema, `render.php`, and the front-end SVG rendering are unchanged.
