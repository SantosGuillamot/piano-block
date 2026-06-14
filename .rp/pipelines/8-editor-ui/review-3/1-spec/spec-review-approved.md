# Spec Review

## Verdict: approved

## Reviewer

Owner (assisted workflow)

## Notes

Review-3 spec approved; owner directed autonomous execution through the whole pipeline (Design → Docs). Scope: replace canvas click-to-select with a toggleable left-of-canvas structure tree (Section → Measure → Right/Left hand → Note) as the selection surface; canvas becomes display + highlight only; add/remove/duplicate at every level (deep-copy duplicate, reorder deferred); editable persisted `name` on sections and measures (a new additive/permissive optional schema property, like `language`); right inspector keeps the settings panels and loses review-2's right-sidebar Structure list. Boundary: schema changes only to add `name`; render.php and front-end SVG unchanged (front end ignores `name`).
