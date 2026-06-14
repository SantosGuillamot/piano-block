# Review 1: Rework the editor UI toward a Gutenberg-native, canvas-first design

_Review 1 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). This is a self-contained prompt: the later phases of this review work from it and from the current code on the branch — not from the base pipeline's artifacts._

## Context: what exists today

The Piano block stores one song as a JSON string (the block's `song` attribute) and renders it as grand-staff sheet music. The editor-UI feature added a visual editor so authors don't have to hand-write JSON, with raw-JSON editing kept available behind a mode switch.

The shipped visual editor is an **on-canvas drill-down editor**: the block canvas hosts nested controls that walk the song hierarchy one level at a time (song → section → measure → event → pitch), with a separate **read-only** live preview of the rendered sheet music beside the controls. Every part of the model — metadata, tempo / time-signature / clef context, sections, measures, events, dynamics, ties / slurs, annotations, pitches — is edited through these nested panels. The rendered staff is display-only: you cannot select or act on a note in it.

## The problem

This direction feels too complex, and it does not lean on the tools the Gutenberg editor already provides. It is also unclear how it scales to large songs: reaching a given note means walking deep nested panels, and the rendered music — the thing authors actually read — plays no part in editing.

## Goal

Rework the editor toward a Gutenberg-native, canvas-first experience:

- **Rely mainly on the canvas** — the rendered notes, measures, etc. — as the primary surface.
- Be able to **select a note directly in the canvas** (the rendered staff).
- **Move the song, section, measure, and note settings into the block settings** (the right-hand inspector sidebar).
- When a note is selected, be able to **edit the settings of the measure and the section it lives in** from the block settings.
- **Hide the non-common settings** by default, with a way to reveal and edit them when wanted (progressive disclosure).
- **Keep a way to add notes from the canvas.**

## Constraint carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no outside dependencies.
