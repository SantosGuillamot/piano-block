# Prompt: Add more horizontal space at the start of each measure

_Source: GitHub issue #14 — https://github.com/SantosGuillamot/piano-block/issues/14_

## Goal

Each measure should begin with enough horizontal breathing room that the first
note isn't crowded against the barline / start of the measure. Right now the
first notes sit very tight against the measure's left edge, which makes the
rendered sheet music look cramped.

## Context

This concerns the Piano block's rendered grand-staff sheet music (treble + bass
staves).

A screenshot of the current rendering was provided with the request. It is
described here so this prompt is self-contained (the image itself was pasted
into the chat and is not stored alongside this file). The screenshot shows the
left edge of a measure on the grand staff:

- The first notes of the measure — on both the treble (top) and bass (bottom)
  staves — are pressed right up against the left barline at the start of the
  staff, with almost no gap between the start of the measure and the first note.
- Other elements are visible in the capture (a dashed octave / 8va-style line
  above the treble staff with a "Do" solfège label, beamed and slurred notes,
  and a dotted note), but the salient problem is purely the **lack of lead-in
  space before the first note of the measure**.

The desired outcome is more horizontal padding at the beginning of the measure
so the first note has room to breathe, rather than starting flush against the
measure's left edge.
