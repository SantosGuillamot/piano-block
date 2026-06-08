# Spec Research: Review 5 — Visible buttons, add-section in settings, small note highlight

The owner gave the requirements directly (3 prompt items, with annotated screenshots) and directed autonomous execution of the whole pipeline. No multi-turn Q&A was run; the orchestrator synthesized the spec.

## Items
1. Tree per-row action buttons (remove/duplicate, and the add affordances) are near-invisible — they use `variant="tertiary"` icon Buttons. Make them clearly visible with standard Gutenberg/theme styling.
2. Remove the tree's top-level "Add section" button; provide add-section from the block-settings sidebar (right inspector) instead — likely the always-present Song panel. Keep per-row add-measure/add-note in the tree.
3. The selected-note highlight still renders as a large thick box despite review 4's `outline: 1px` on the note `<g>`. Strong hypothesis (design to confirm): an `outline` on a `<g>` inside the notation SVG is painted in user space and magnified by the staff-space→pixel viewBox scale, so "1px" becomes thick on screen. Fix: a highlight that stays thin at the displayed scale (e.g. `vector-effect: non-scaling-stroke` on a stroked element, or an equivalent) — still clearly marking the note, no layout impact.

## Boundary
Editor-side only: the song format/schema, `render.php`, and the front-end SVG rendering are unchanged (the highlight is applied by the editor after rendering, and the shared renderer's front-end output stays identical); `@wordpress/*`-only.
