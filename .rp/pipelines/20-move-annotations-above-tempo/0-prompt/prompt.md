# Move annotations above the tempo marking

## Goal

The vertical stack of markings rendered with the sheet music should read, from top to bottom: **annotations → tempo → octaveShift**. Today the annotations sit below the tempo; they should move above it, so the resulting top-to-bottom order is annotations, then tempo, then octaveShift.

## Constraints

- The new order must apply to **both the left and right hands**.
- **Do not change the horizontal spacing or layout** — this is a vertical reorder of the markings only.

## Notes for the pipeline

- This prompt captures the owner's intent. Requirements, design, and implementation details are intentionally left out — later phases research the codebase and produce them.
- Issue reference: SantosGuillamot/piano-block#20.
