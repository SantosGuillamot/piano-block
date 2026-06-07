# Beam chained eighth notes as a single group instead of in pairs

_Source: GitHub issue [#15](https://github.com/SantosGuillamot/piano-block/issues/15)._

## Goal

When several eighth notes are chained together, the Piano block's sheet-music
rendering should join them under a single beam — as standard music notation
does — instead of always splitting them into separate pairs of two.

## Context

Two reference images were provided with the request. They could not be attached
as files, so they are described here in text. This description is the
authoritative record of what the images showed.

### Image 1 — current rendering ("how it is working right now")

A screenshot of the Piano block's own rendered output: a grand staff (treble +
bass clef) excerpt, with free-text note annotations ("Do") shown above the
treble staff. In the melody, runs of consecutive eighth notes are beamed only
**two-by-two**: each beam connects at most two eighth notes, and longer runs of
chained eighth notes are broken into several separate two-note beam groups.
Where a run has a leftover eighth note that doesn't fall into a pair, that note
renders with an individual flag instead of being joined into the group. The
net visual effect is many short, disconnected beams rather than one continuous
beam over the chained notes.

### Image 2 — conventional rendering ("how it is usually displayed")

A reference excerpt of conventionally engraved sheet music (a beginner piano
method-style staff with solfège labels such as "mi", "fa", "sol", "do"). Here,
consecutive ("chained") eighth notes are beamed together as a **single group** —
one beam spans the whole run of eighth notes that belong together, rather than
breaking the run into pairs.

## Difference to resolve

- **Current:** eighth notes are grouped into beams of at most two.
- **Desired:** eighth notes that are chained together are joined under a single
  beam spanning the group, matching how standard notation displays them.

## Assumptions / directions to explore (open)

- The renderer currently appears to beam eighth notes only in pairs of two,
  regardless of how many are chained together.

_These are the requester's current understanding, recorded as directions to
explore — not requirements. Later phases should either satisfy the stated
intent or surface evidence that a premise is inaccurate; they should not
silently substitute a different goal._
