# Prompt: Remove measure numbers from the notation

_Source: GitHub issue #25 — https://github.com/SantosGuillamot/piano-block/issues/25_

## Goal

Measure numbers are no longer displayed in the Piano block's rendered notation.
Today the notation labels measures with a number; the desired outcome is a score
that renders without any measure-number labels.

## Context

This concerns the Piano block's rendered grand-staff sheet music (treble + bass
staves).

A screenshot of the current rendering was provided with the request. It is
described here so this prompt is self-contained (the image itself was pasted
into the chat and is not stored alongside this file). The screenshot shows a
short piece rendered across three lines (systems) of the grand staff:

- Each line after the first begins with a small measure number printed just
  above the staff at the left end of the line — a **3** at the start of the
  second line and a **5** at the start of the third line. (The first line, which
  starts at measure 1, shows no number.)
- These line-start numbers are the measure-number labels the request refers to.

The desired outcome is that these measure-number labels do not appear at all in
the rendered notation.
