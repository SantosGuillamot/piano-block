# Spec Research: Review 4 — Structure-tree polish

The owner gave the requirements directly (7 prompt items + answers below) and delegated the remaining details to the orchestrator, authorizing autonomous execution of the whole pipeline. No multi-turn Q&A was run.

## Owner answers
- **Item 6 (panel order):** most-specific first → Note → Measure → Section → Song (and the analogous shorter orders for measure/section selections; Song only when nothing is selected).
- **Item 1 (open by default):** yes — open by default when the block is selected, but it can be closed and reopened (the toggle state is respected while working).
- **Item 4 (section/measure highlight):** yes, remove it for now; a better version is a follow-up.

## Orchestrator decisions (delegated items)
- **Item 2 (indentation):** visual indentation of tree rows by depth (section → measure → hand → note) so parent/child nesting is clear.
- **Item 3 (button styling):** the add/remove/duplicate controls use standard `@wordpress/components` `Button` styling (appropriate variant) so they inherit the editor/theme appearance, rather than rendering unstyled/white.
- **Item 5 (note highlight):** reduce the selected-note canvas highlight to a subtle, smaller outline.
- **Item 7 (flaky collapse):** make expand/collapse reliable. Prime suspect (for design/code to confirm): review-3's auto-expand-of-selection-ancestors runs on every render and re-opens a node the author just manually collapsed when it contains the current selection. Fix so a deliberate manual collapse is respected.

## Boundary
All changes are editor-side: the song format/schema, `render.php`, and the front-end SVG rendering are unchanged; `@wordpress/*`-only.
