# Fix octaveShift marking placement for left and right hands

_Source: GitHub issue [#13](https://github.com/SantosGuillamot/piano-block/issues/13)._

## Goal

Each hand's `octaveShift` ottava marking (e.g. "8va") renders correctly relative to
*that hand's own staff*, and appears consistently across every system/line it spans.

## Context

Reported with a screenshot. A left-hand `octaveShift` of +1 draws an "8va" dashed
bracket above the treble/right-hand (top) staff, while the affected notes are on the
bass/left-hand (bottom) staff — so the bracket sits over the wrong staff.

Screenshot description (the asset itself was not attached to the issue): a grand staff
at ♩ = 90. A single "8va" dashed bracket spans the full system width above the top
(treble / right-hand) staff. The `octaveShift` that produced it was set on the **left
hand**, whose notes live on the bottom (bass) staff, so the marking is visually
detached from the notes it applies to.

The owner also observed that a **right-hand** `octaveShift` may not appear on the first
line/system, only on subsequent ones.

## Assumptions / directions to explore

_(Open — confirm or revise with your own research; do not treat as ground truth.)_

- A left-hand `octaveShift` should render above the left-hand (bottom) staff, not above
  the right-hand (top) staff.
- The right-hand `octaveShift` may have a separate bug: not shown on the first line,
  only on later lines — confirm whether this reproduces and fix it if real.
