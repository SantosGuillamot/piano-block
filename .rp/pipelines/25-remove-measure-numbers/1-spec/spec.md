# Spec: Remove measure numbers from the notation

## Overview

The Piano block renders a piece as grand-staff sheet music (treble + bass). When
a piece is long enough to wrap onto multiple lines (systems), every line after
the first prints a small measure-number label above-left of its first measure —
for example a "3" at the start of the second line and a "5" at the start of the
third. The first line, which begins at measure 1, is left un-numbered. These
line-start labels add visual clutter that the maintainer wants gone.

This feature removes those measure-number labels entirely. After the change, the
rendered notation never displays a measure-number label, for any piece and any
number of lines. The removal is purely a rendering-output change: the song input
format, the block's settings, and all other notation elements (notes, tempo
marks, ottava brackets, dynamics, ties/slurs) are unaffected, except that
removing the label must not visually disturb the elements that share the space
above the staff.

## Requirements

1. **No measure-number label is ever rendered.** The rendered notation must not
   display any measure-number label, for any song and for any number of lines
   (systems). The small numbers that today appear above-left of the first
   measure of each wrapped line after the first (e.g. "3" at the start of line 2,
   "5" at the start of line 3) no longer appear anywhere.

2. **Removal is unconditional and applies everywhere the notation renders.**
   There is no setting, attribute, or mode that re-enables measure numbers. The
   change applies identically to the editor preview and to the saved/front-end
   render (both produce the same notation output).

3. **Other above-staff elements remain correctly placed.** Removing the label
   must not cause any overlap, clipping, shift, or misplacement of other
   above-staff content — specifically tempo marks, ottava (8va/8vb) brackets, and
   high notes / ledger lines. Their behavior is otherwise unchanged.

4. **No leftover whitespace attributable to the removed label.** No empty
   vertical band may remain above a line that previously existed solely to make
   room for the now-absent number. A line's spacing above the staff must not
   depend on whether that line would have shown a measure number. (This does not
   require all lines to share identical top spacing — lines legitimately differ
   for unrelated reasons such as ledger-line extent or the presence of tempo or
   ottava marks above the staff.)

5. **Internal measure indexing is preserved.** The internal per-measure index
   that the renderer attaches to each measure in its output (distinct from the
   visible label) remains present and correct. Only the visible measure-number
   label is removed.

## Out of Scope

- The song input format / schema and the block's `song` attribute are unchanged.
- The editor's input UI is unchanged.
- No "show measure numbers" toggle, setting, or mode is added (none exists
  today).
- Tempo marks, ottava brackets, dynamics, ties/slurs, and all other notation
  elements are unchanged, apart from the non-regression guarantees in
  requirements 3 and 4.
- The internal per-measure index is not removed or renumbered.

## Acceptance Criteria

- **AC1 — Wrapping song shows no labels.** Given a song long enough to wrap onto
  two or more lines, when the notation is rendered, then no measure-number label
  appears at the start of any line (no measure-number text node is emitted for
  any system).

- **AC2 — Single-line song unchanged.** Given a song that fits on a single line,
  when the notation is rendered, then the output is unchanged (it never carried a
  measure-number label).

- **AC3 — Above-staff marks survive on later lines.** Given a wrapping song that
  also has tempo changes and ottava (8va/8vb) brackets on lines after the first,
  when the notation is rendered, then those tempo marks and ottava brackets are
  still present and correctly placed, with no overlap or clipping introduced by
  the removal.

- **AC4 — No reserved whitespace remains.** Given a line that would previously
  have reserved vertical room for a measure number, when its spacing above the
  staff is computed, then that spacing does not depend on the removed-number
  condition (no empty band is left where the number used to be).

- **AC5 — Internal measure index intact.** Given any rendered measure, when the
  output is inspected, then its internal per-measure index is still present and
  correct.

- **AC6 — Clean build with no dead code.** Given the change is applied, when the
  project is built and linted, then it passes, and any code (e.g. the
  measure-number text-size constant) left unused by the removal does not remain
  as dead code.
