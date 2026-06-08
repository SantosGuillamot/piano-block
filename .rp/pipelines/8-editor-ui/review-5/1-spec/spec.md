# Spec: Review 5 — Visible tree action buttons, add-section in block settings, and a genuinely small note highlight

## Overview

The Piano block editor uses a left **structure tree** (Section → Measure → Right/Left hand → Note) as its selection surface, with per-row action buttons and a top-level "Add section" button, and it highlights the selected note on the canvas. This review fixes three rough edges that hurt usability:

1. the tree's per-row **remove / duplicate (and add)** action buttons are effectively **invisible** (they use a transparent `tertiary` icon style);
2. the tree's **"Add section"** button should be **removed** and replaced by an add-section control in the **block-settings** sidebar; and
3. the **selected-note highlight** still renders as a **large, thick box** even though review 4 set a 1px outline — because an `outline` on the note's SVG `<g>` is magnified by the notation's staff-space→pixel scale.

Every change is **editor-side**: the song format/schema, the server render (`render.php`), and the front-end SVG rendering are unchanged, and no outside dependency is added.

This document traces to the Requirements and Acceptance Criteria below.

## Requirements

### Visible tree action buttons

1. The structure tree's **per-row action buttons** — **remove** and **duplicate** for sections/measures/notes, and the per-row **add** affordances (add-measure, add-note) — are **clearly visible and discoverable without hovering**, using standard Gutenberg/theme button styling (rather than the near-transparent `tertiary` icon style). Destructive (remove) controls keep their destructive affordance. The exact styling (variant, icon-with-label vs. styled icon, etc.) is a design decision, but the result must be plainly visible against the editor background.

### Add section from the block settings

2. The tree's top-level **"Add section" button is removed**. Adding a section is instead available from the **block-settings sidebar** (the right-hand inspector) — e.g. a control in the always-present Song panel. The author can still add sections; only the affordance's location changes. (The per-row add-measure and add-note affordances stay in the tree.)

### Genuinely small note highlight

3. The **selected-note canvas highlight is a small, subtle indication** — a thin line, not a thick box — at the **displayed** scale. The design must root-cause why the current `outline` on the note `<g>` renders large (the notation SVG scales staff-space units up, magnifying the outline) and use a highlight that stays visually thin at that scale (for example a non-scaling stroke, or an equivalent approach), while still clearly marking the selected note and not affecting layout.

### Boundary and dependencies

4. **Editor-side only.** The song format/schema, `render.php`, and the front-end SVG rendering are unchanged; a published page renders a given song exactly as before. (Note: the selected-note highlight is applied by the editor after rendering; the shared notation renderer's front-end output stays identical.)
5. **WordPress-only dependencies.** Implemented using only `@wordpress/*` packages already available to blocks; no outside runtime dependency.

## Out of Scope

1. A redesigned **section/measure** canvas highlight — still a later follow-up (review 4 removed the old one).
2. **Reordering** tree items — still deferred.
3. Any change to the song format/schema, `render.php`, or the front-end SVG rendering.
4. Audio playback; best-effort loading of invalid songs (still routed to raw JSON); large-song performance tuning — all carried over.

## Acceptance Criteria

### AC1 — Tree action buttons are visible
- **Given** the structure tree with sections, measures, and notes,
- **When** the author views a row,
- **Then** its remove, duplicate, and add buttons are plainly visible (styled, not transparent) without needing to hover, and the remove control still reads as destructive.

### AC2 — Add section moved to the block settings
- **Given** the editor,
- **When** the author looks at the structure tree,
- **Then** there is no "Add section" button in the tree; **and** an add-section control is available in the block-settings sidebar, and using it adds a new section to the song.

### AC3 — Selected-note highlight is small and subtle
- **Given** a note is selected,
- **When** the canvas renders at its normal displayed size,
- **Then** the note's highlight is a thin, subtle indication (not a large thick box), and it does not change the notation's layout.

### AC4 — Front-end rendering unchanged
- **Given** a song saved with this editor,
- **When** the published page is viewed,
- **Then** the front-end sheet-music rendering is identical to before this review.

### AC5 — No outside dependencies
- **Given** the implemented feature,
- **When** its dependencies are inspected,
- **Then** only `@wordpress/*` packages already available to blocks are used.
