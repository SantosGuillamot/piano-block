# Prompt — Render the Piano block's song as visual sheet music (grand staff)

> Source: GitHub issue [#4](https://github.com/SantosGuillamot/piano-block/issues/4) — "Render the Piano block's song as visual sheet music (grand staff)". This file is the self-contained input for the pipeline; agents should not need to reach back to the issue.

## Goal

When a Piano block contains a song, a reader sees it rendered as readable piano sheet music — a grand staff showing both hands as pentagrams with their notes — instead of the raw stored data. The author sees the same rendering live in the editor while building the block. (Today the block only stores/echoes the song; this turns that data into notation people can actually read.)

## Constraints

- The notation must be rendered by us, **without depending on any existing music-notation library** (e.g. VexFlow, abcjs, OpenSheetMusicDisplay, Verovio). A standalone *asset* such as an open-licensed music font is acceptable — that is not a "library" in this sense.

## Context

- Builds directly on #2, which defines and stores the song as a custom, dependency-free JSON document (grand staff: `defaults` + `chunks[]` → `measures[]` → `rightHand[]`/`leftHand[]` events, covering clefs, key-signature-like alterations, time signature, tempo, durations, dynamics, ties, slurs, chord symbols, barlines). #2 deliberately leaves rendering out of scope; this issue is that rendering step and takes that JSON as its input. (#2 is still in progress, so the schema may still shift.)
- The owner has a concrete target look in mind: a normal printed piano score — two clefs braced together, key & time signatures, beamed notes over sustained chords, ties, dynamics, a tempo marking, measure numbers.
- This direction was explored up front with several independent design passes; the notes below capture where they pointed, but they are starting points, not decisions.

## Assumptions / directions to explore

*(all open — confirm, refine, or overturn in later phases)*

- **Substrate:** inline **SVG** looks like the strongest fit (vector, scalable, themeable via `currentColor`, accessible). Canvas, HTML/CSS, and Unicode music symbols seem weaker, but worth a sanity check.
- **Glyphs:** suggest a music **font** for the ornate glyphs (clefs, noteheads, accidentals, rests, flags) plus simple SVG shapes for geometry (staff/ledger lines, stems, beams, ties). **Bravura** (SIL OFL) is a *suggested* font, **not a requirement** — hand-drawn SVG glyph paths (zero external assets) are a legitimate alternative.
- **One shared renderer:** prefer a single, framework-free rendering "engine" reused by both editor and frontend rather than two implementations that can drift apart — this looks like the main risk to manage.
- **Where it renders:** leaning toward rendering on the client on the frontend (song JSON staying the single source of truth) via the WordPress Interactivity API, with the editor calling the same engine for its preview. A server-side (PHP) renderer is a credible alternative to weigh (trade-offs: no-JS/SEO vs. duplicated logic).
- **Engine internals worth investigating:** a staff-space coordinate system; mapping a pitch to a staff position via its diatonic step relative to the clef (ledger lines falling out naturally); both hands sharing one time grid per measure so they align vertically; horizontal spacing proportional to note duration; beaming grouped by the meter's beat unit (e.g. 12/8 → groups of three eighths); wrapping measures into stacked systems.
- **Coverage:** aim to eventually render what a normal score shows — clefs, key/time signatures, noteheads/stems/flags/beams, dotted notes, rests, accidentals (incl. doubles), chords, ties, slurs, dynamics, chord symbols, repeat/final barlines, tempo text, measure numbers. A sensible first slice could be a single staff with basic notes, then grow.
- **Scope / future:** static notation is the focus here. Interactive features the block may eventually want — a moving playhead, per-note highlighting synced to audio, playback — are out of scope for now, but the design shouldn't preclude them.
- **Testability:** because #2's authoring UI is a separate concern, a simple way to load a sample song (a default example, and/or a raw-JSON field in the editor) would let this rendering be exercised on its own.
