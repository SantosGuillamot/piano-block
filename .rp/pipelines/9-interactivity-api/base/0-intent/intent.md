# Move the Piano block's frontend JS to the Interactivity API

> Source: [SantosGuillamot/piano-block#9](https://github.com/SantosGuillamot/piano-block/issues/9).
> This file is self-contained; agents do not need to open the source issue.

## Goal

The Piano block's frontend behavior runs on WordPress's Interactivity API instead of a standalone view script. This aligns the block with WordPress's standard frontend architecture and establishes a foundation for future interactive features (e.g. audio playback and note input).

## Constraints

- No dependencies on libraries outside the WordPress ecosystem — use WordPress-provided packages and APIs only.

## Assumptions / directions to explore

- Adopt the Interactivity API as the mechanism for the block's frontend logic. *(Chosen direction, not a hard requirement — later phases may confirm or refine exactly how much of the current logic becomes a store/directives.)*
- The frontend logic currently lives in a standalone `viewScript` (`src/view.js`) that boots on `domReady`, manually queries the block wrapper, validates the song JSON, builds the layout model, mounts the SVG, and reflows via a `ResizeObserver`.
