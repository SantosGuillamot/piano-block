# Intent

Issue: https://github.com/SantosGuillamot/piano-block/issues/27

## Title

Attach stems of beamed notes to the side of the notehead instead of the middle

## Goal

Beamed (concatenated) notes render their stems attached to the side of the notehead — left or right, like standalone notes do — rather than passing through the middle of the notehead.

## Context

In the current rendering, standalone quarter/eighth notes have their stem correctly attached at the edge of the notehead, while notes joined by a beam have the stem centered through the middle of the notehead, which is inconsistent and not how standard music engraving works.

The owner provided a screenshot of the rendered sheet music illustrating the inconsistency (the image itself is not available as a file; this is its content described): two staves of rendered music. Standalone eighth notes with flags and quarter notes show their stem meeting the notehead at its edge (left or right side). In contrast, pairs of notes connected by a horizontal beam show each stem entering the notehead at its horizontal center, visibly passing through the middle of the oval notehead instead of touching its side.
