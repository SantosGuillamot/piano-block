# Spec: Review 4 — Structure-tree polish (defaults, indentation, theming, highlight, panel order, collapse)

## Overview

Review 3 made a left **structure tree** (Section → Measure → Right/Left hand → Note, built on `@wordpress/components`' `__experimentalTreeGrid`) the way the author navigates and selects the Piano block's song: the tree sits in a toggleable panel beside the canvas, the canvas is display + highlight only, selecting a tree node highlights the matching element on the canvas and opens its settings in the right inspector, and the tree supports add / remove / duplicate per level plus rename for sections and measures.

This review is a **polish pass** on that experience. It improves the tree's defaults and legibility, fixes a collapse bug, restyles its action controls, trims two canvas-highlight rough edges, and reorders the settings panels. Every change is **editor-side**: the song format/schema, the server render (`render.php`), and the front-end SVG rendering are unchanged, and no outside dependency is added.

This document traces to the Requirements and Acceptance Criteria below.

## Requirements

### Tree defaults and legibility

1. **Open by default.** When the Piano block is selected, the structure tree panel is **open by default** (today it starts closed / must be toggled on). The existing toggle still **closes and reopens** it, and the chosen state is respected while the author keeps working with the block (closing it does not immediately spring back open).
2. **Indented hierarchy.** Tree rows are **visually indented by depth** — section, then measure, then hand group, then note — so the parent/child relationship is immediately clear.
3. **Theme-styled action controls.** The tree's **add / remove / duplicate** controls use the standard editor button styling (`@wordpress/components` `Button` with an appropriate variant) so they inherit the editor/theme appearance, instead of rendering as unstyled white buttons.

### Selection highlight

4. **No section/measure canvas highlight.** Selecting a **section or a measure** no longer highlights anything on the canvas (the current section/measure highlight is removed for now). The **note** highlight is unaffected. (A better section/measure indication is intended as a later follow-up.)
5. **Smaller note highlight.** The selected-**note** canvas highlight is reduced to a **subtle, smaller outline** (today it is too large/heavy).

### Settings panel order

6. **Most-specific-first panel order.** The block-settings (right inspector) panels are ordered from most specific to least specific based on the current selection:
   - a **note** selected → **Note → Measure → Section → Song**;
   - a **measure** selected → **Measure → Section → Song**;
   - a **section** selected → **Section → Song**;
   - **nothing** selected → **Song** only.

### Collapse reliability

7. **Reliable expand/collapse.** Expanding and collapsing tree nodes works reliably. In particular, **manually collapsing a node is respected even when that node contains the current selection** — it does not immediately re-expand. (The review-3 behavior that auto-reveals the selection's ancestors must not override a deliberate manual collapse.)

### Boundary and dependencies

8. **Editor-side only.** The song format/schema, `render.php`, and the front-end SVG rendering are unchanged; a published page renders a given song exactly as before.
9. **WordPress-only dependencies.** Implemented using only `@wordpress/*` packages already available to blocks; no outside runtime dependency is added.

## Out of Scope

1. A redesigned section/measure canvas indication — Req 4 only **removes** the current one; a better version is a later follow-up.
2. **Reordering** tree items (still deferred from prior reviews).
3. Any change to the song format/schema, `render.php`, or the front-end SVG rendering.
4. Audio playback; best-effort loading of invalid songs (still routed to raw JSON); large-song performance tuning — all carried over.

## Acceptance Criteria

### AC1 — Tree open by default, still toggleable
- **Given** a Piano block is selected in the editor,
- **When** the author views the block,
- **Then** the structure tree panel is open by default; **and** when the author toggles it closed, it stays closed while they continue working, and the toggle reopens it.

### AC2 — Indented hierarchy
- **Given** a song with sections, measures, and notes,
- **When** the author views the structure tree,
- **Then** rows are visually indented by depth so each item's parent/child relationship is clear.

### AC3 — Action controls are theme-styled
- **Given** the tree's add / remove / duplicate controls,
- **When** they are rendered,
- **Then** they use the standard editor button styling (not unstyled white buttons).

### AC4 — No section/measure highlight
- **Given** a section or a measure is selected in the tree,
- **When** the canvas renders,
- **Then** no section/measure highlight is shown on the canvas (the note highlight behavior is unchanged).

### AC5 — Reduced note highlight
- **Given** a note is selected,
- **When** the canvas renders,
- **Then** the note's highlight is a subtle, smaller outline than before.

### AC6 — Most-specific-first panel order
- **Given** a selection,
- **When** the block-settings panels render,
- **Then** they appear most-specific first: Note → Measure → Section → Song for a note; Measure → Section → Song for a measure; Section → Song for a section; Song only when nothing is selected.

### AC7 — Manual collapse is respected
- **Given** a note is selected and its ancestor section/measure rows are expanded,
- **When** the author manually collapses an ancestor that contains the selection,
- **Then** that node stays collapsed (it does not immediately re-expand).

### AC8 — Front-end rendering unchanged
- **Given** a song saved with this editor,
- **When** the published page is viewed,
- **Then** the front-end sheet-music rendering is identical to before this review.

### AC9 — No outside dependencies
- **Given** the implemented feature,
- **When** its dependencies are inspected,
- **Then** only `@wordpress/*` packages already available to blocks are used.
