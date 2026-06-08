# Review 2: Fix canvas selection, contextual add/remove, sidebar structure management, and a note-language toggle

_Review 2 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). This is a self-contained prompt: the later phases of this review work from it and from the current code on the branch — not from the `base/` or `review-1/` artifacts. The branch has just been rebased onto the latest `trunk`._

## Context: what exists today

Review 1 made the editor **canvas-first**: the rendered grand-staff is the single interactive surface, the author selects a note/rest on it, and that note's settings — plus its measure's and section's — are edited in the block's right-hand inspector sidebar (an always-present "Song" panel, and "Note"/"Measure"/"Section" panels shown when a note is selected). Uncommon settings sit behind progressive disclosure. Notes and measures are added via affordances drawn on the canvas. Raw-JSON editing remains behind a toolbar toggle. The song format, server render, and front-end SVG rendering are unchanged; the editor reuses the notation core untouched.

## The problems

1. **Selection doesn't actually work.** In practice the author cannot select notes on the canvas — clicking a note on the rendered staff does not select it. (The end-to-end tests for this never ran against a live editor, so the regression was not caught.)
2. **The add/remove affordances are unclear and visually plain.** The on-canvas add buttons (for notes, measures, etc.) look "weird" and are all plain white, and the model is awkward. They should be **contextual to the current selection** and **structure management should move into the sidebar**:
   - With a note selected, offer **add note** / **remove note** directly — the editor already knows which hand (right/left staff) the note belongs to, so the author should not have to choose a hand.
   - **Manage measures and sections from the sidebar.** The author should be able to **see all the sections and measures** in one place and **easily add or remove** them, as well as edit their settings — rather than reaching them only through a selected note.
3. **No explicit note-language choice.** The author should be able to **choose the note-name language at the song level — Spanish or English — and have the notes shown in the chosen language.** (Today the note-name system is inferred from the song's existing pitches rather than chosen explicitly.)

## Goal

Make canvas note selection actually work; replace the plain on-canvas add buttons with selection-contextual add/remove-note controls (hand inferred from the selection); provide a sidebar way to browse, add, remove, and edit all sections and measures; and add a song-level Spanish/English note-language option that drives how note names are shown.

## Constraint carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no outside dependencies. The song format/schema, server render, and front-end SVG rendering stay unchanged (editor-only).
