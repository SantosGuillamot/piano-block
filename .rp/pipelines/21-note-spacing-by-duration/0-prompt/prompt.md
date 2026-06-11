# Space notes horizontally according to their duration

_Source: GitHub issue [#21](https://github.com/SantosGuillamot/piano-block/issues/21)._

## Goal

Notes are spaced horizontally according to their duration, so shorter notes take
up less horizontal space than longer notes — e.g. an eighth note is narrower than
a quarter note. The visual spacing should reflect note length the way standard
music notation does.

## Context

The owner provided a reference image illustrating the desired behavior. The image
shows a passage of music rendered in the project's notation style (each note drawn
with its solfège name — "do", "re", "mi", "fa", "sol", "la" — in a small box on the
staff). In it:

- Shorter notes that are beamed together (eighth notes, joined by a horizontal beam
  beneath them) sit close together and occupy little horizontal space.
- Longer notes (quarter notes) have noticeably more horizontal space around them.

So within the same measure, the horizontal distance a note consumes is proportional
to (or at least ordered by) its duration: an eighth note is narrower than a quarter
note, which in turn would be narrower than a half note, and so on. The overall
effect matches how engraved sheet music distributes notes across a measure.

> Note for downstream phases: the reference image could not be committed as a file
> alongside this prompt; the description above captures what it conveys. If a visual
> reference is needed, request it from the owner.
