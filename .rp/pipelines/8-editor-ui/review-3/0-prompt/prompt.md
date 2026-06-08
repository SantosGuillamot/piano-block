# Review 3: A left-sidebar structure tree (Section → Measure → Note) as the selection surface

_Review 3 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). Self-contained: later phases work from this prompt and the current code on the branch — not from the `base/`, `review-1/`, or `review-2/` artifact folders._

## Context: what exists today

The editor is canvas-first. Review 2 tried to make notes selectable directly on the rendered staff (clicking a note), backed by a right-hand inspector sidebar (Song / Note / Measure / Section panels), a right-sidebar Structure list (sections → measures), and a song-level note-language selector. The rendered canvas shows the sheet music and highlights the current selection; raw-JSON editing remains behind a toolbar toggle.

## The problem

Selecting notes **directly on the canvas still doesn't work well** — clicking notes on the rendered staff is unreliable and feels difficult. Rather than keep fighting canvas hit-testing, this review takes a **different approach to selection**.

## Goal

Add a **structure tree in a sidebar to the LEFT of the canvas** and make it the primary way to navigate and select the song — instead of clicking on the canvas. The model is like Gutenberg's **List View** for blocks and inner blocks:

- The tree shows the song hierarchy: **Section → Measures → Notes** (three levels).
- Sections and measures can be **expanded / collapsed**.
- At each level the author can **add, remove, and duplicate** items (sections, measures, notes) easily.
- The author **selects a section, measure, or note in the tree** (not on the canvas).
- Selecting a node **highlights** the corresponding section / measure / note **on the canvas** (the canvas is display + highlight only — selection no longer happens by clicking the staff).
- When something is selected, the editor **shows its settings** so the author can configure it.

## Constraint carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no outside dependencies. The change stays editor-side; the front-end render is unchanged.
