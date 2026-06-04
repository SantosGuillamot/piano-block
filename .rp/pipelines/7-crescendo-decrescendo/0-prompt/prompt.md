# Prompt: Add crescendo and decrescendo support (note to note)

> This is the phase-0 prompt for the pipeline. It is self-contained: everything
> the later phases need to understand the request is captured here. Treat the
> goal as the owner's desired outcome and the constraint as a binding boundary.
> Beyond these, nothing about the approach is fixed — research and decide the
> requirements, design, and implementation in the appropriate later phases.

## Goal

A song in the Piano block can express **crescendo** and **decrescendo** —
gradual volume changes that span from one note to another — and these are
reflected in the **rendered sheet music**.

Today each note carries (at most) a single fixed dynamic. The outcome wanted
here is the ability to express a *gradual* change in loudness that runs across a
span of notes (a crescendo growing louder, a decrescendo growing softer), shown
in the notation the block renders.

## Constraints

- **Notation / rendering only for now.** Audio and playback loudness are out of
  scope for this work. The crescendo/decrescendo should be expressible in the
  song and shown in the rendered sheet music; making it actually change how the
  song *sounds* is explicitly deferred.
