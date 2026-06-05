# Prompt

_Source: GitHub issue [#10](https://github.com/SantosGuillamot/piano-block/issues/10) — "Replace per-note `chordSymbol` with a free-text "notes" field placeable above or below either staff". This file is the self-contained phase-0 prompt; later phases work from it, not from the issue._

## Goal

Song authors can attach richer free-form annotations ("notes") to a piece than today's chord-symbol-only label, and control where each note appears relative to the staff:

- The per-note `chordSymbol` is replaced by a general **notes** field that can hold a chord symbol or any other annotation (for example, `"pedal"`).
- A note can be placed either **above** or **below** a pentagram (staff).
- This works for **both pentagrams** — the right-hand staff and the left-hand staff — so an annotation can sit above or below either one.
- Both **per-note** notes (attached to a specific note/event) and **standalone** notes (not tied to a single note) are supported.

## Constraints

- The existing `chordSymbol` field is replaced by the new notes capability, not kept alongside it.

## Assumptions / directions to explore

- Notes are free text (an open vocabulary), as `chordSymbol` is today.
- Placement is expressed per note as a combination of *which staff* (right-hand / left-hand) and *vertical position* (above / below) — exact representation left open.
- Standalone notes attach at a level above an individual note (e.g. per measure or per section) — exact granularity left open.
- Notes render in the sheet music at the chosen position (above or below the relevant staff) — exact rendering left open.
