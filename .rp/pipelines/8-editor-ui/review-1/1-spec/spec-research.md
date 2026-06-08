# Spec Research: Review 1 — Gutenberg-native, canvas-first editor UI

# Review 1: Rework the editor UI toward a Gutenberg-native, canvas-first design

_Review 1 of the Piano block editor-UI feature ([Issue #8](https://github.com/SantosGuillamot/piano-block/issues/8), PR #22). This is a self-contained prompt: the later phases of this review work from it and from the current code on the branch — not from the base pipeline's artifacts._

## Context: what exists today

The Piano block stores one song as a JSON string (the block's `song` attribute) and renders it as grand-staff sheet music. The editor-UI feature added a visual editor so authors don't have to hand-write JSON, with raw-JSON editing kept available behind a mode switch.

The shipped visual editor is an **on-canvas drill-down editor**: the block canvas hosts nested controls that walk the song hierarchy one level at a time (song → section → measure → event → pitch), with a separate **read-only** live preview of the rendered sheet music beside the controls. Every part of the model — metadata, tempo / time-signature / clef context, sections, measures, events, dynamics, ties / slurs, annotations, pitches — is edited through these nested panels. The rendered staff is display-only: you cannot select or act on a note in it.

## The problem

This direction feels too complex, and it does not lean on the tools the Gutenberg editor already provides. It is also unclear how it scales to large songs: reaching a given note means walking deep nested panels, and the rendered music — the thing authors actually read — plays no part in editing.

## Goal

Rework the editor toward a Gutenberg-native, canvas-first experience:

- **Rely mainly on the canvas** — the rendered notes, measures, etc. — as the primary surface.
- Be able to **select a note directly in the canvas** (the rendered staff).
- **Move the song, section, measure, and note settings into the block settings** (the right-hand inspector sidebar).
- When a note is selected, be able to **edit the settings of the measure and the section it lives in** from the block settings.
- **Hide the non-common settings** by default, with a way to reveal and edit them when wanted (progressive disclosure).
- **Keep a way to add notes from the canvas.**

## Constraint carried over

- Use only libraries WordPress already provides (the `@wordpress/*` packages available to blocks); no outside dependencies.

## Q&A

### Q1 — Does raw-JSON editing remain available in the canvas-first redesign?

Today raw-JSON editing lives behind a mode switch as the fallback, and is also where authors are routed to fix a non-conformant song. Should it stay available (alternative/escape hatch) or be removed entirely so the visual editor is the only edit path?

**A:** Keep raw-JSON editing available, with the same mode toggle it has today. (The existing raw-JSON surface and its non-blocking validation behavior are unchanged.)

### Q2 — Does the interactive canvas replace the separate read-only preview?

Today visual mode shows nested editing panels plus a distinct read-only sheet-music preview. In the canvas-first model, should the rendered canvas be the single sheet-music surface (the separate preview pane goes away; the canvas is the live-rendered music you select/edit on), or is a distinct preview pane still wanted alongside an interactive canvas?

**A:** The rendered canvas is the single sheet-music surface. The separate read-only preview pane goes away; the canvas itself is the live-rendered music the author selects and edits on, and it re-renders as settings change.

### Q3 — Full coverage retained, or trim scope?

The current editor covers the entire song model (metadata; context = tempo / time signature / per-hand clef / alters / octave-shift on defaults + per-section; sections; measures incl. barlines + annotations; events incl. note/rest, duration, dots, dynamic, tie, slur, crescendo/decrescendo, annotations; pitches = step/octave/alter). Keep full coverage relocated to canvas + sidebar, or trim some capabilities to raw-JSON-only?

**A:** Keep full coverage. Every part of the song model remains creatable/editable in the visual editor, relocated to the canvas + sidebar.

### Q4 — What is selectable on the canvas?

Are rests selectable like notes? Are whole measures / sections directly selectable, or are measure/section settings only reached through the currently-selected note/rest?

**A:** Rests are treated like notes — selectable the same way ("note" = any event, note or rest). Direct selection of whole measures/sections is a nice-to-have if it's easy, but may be deferred to a follow-up; the primary mechanism is selecting an event and reaching its measure + section settings through the sidebar.

### Q5 — Where do song-level settings live, and what shows with no selection?

Song-level settings (metadata title/composer + the `defaults` context = tempo, time signature, per-hand clef/alters/octave-shift) aren't tied to any one note. Should they always be present in the sidebar (a song-level panel) regardless of what's selected? And what should the sidebar show when nothing is selected?

**A:** Song-level settings are always present in the sidebar (e.g. under a "Song" panel/toggle). When nothing is selected, the sidebar shows only the song settings. (Implied sidebar model: always a Song panel; selecting an event adds that event's + its measure's + its section's panels.)

### Q6 — Structural editing (add / remove / reorder)

The base editor supports add, remove, and reorder at every level — sections, measures, events within a hand, pitches within a chord. With full coverage retained: should all of these stay? And do you picture them on the canvas, in the sidebar, or is placement left to design? (Adding notes is already specified as a canvas action.)

**A:** Add and remove stay (every level). **Reorder is optional** — drop it if it complicates the implementation; it is not a hard requirement. Placement preference is the canvas, but that is a soft preference, not a strong requirement (design may decide).

### Q7 — Common vs. non-common settings (progressive disclosure)

The goal asks to hide non-common settings with a way to reveal them. Do you have a specific split in mind for which settings are "common" (visible by default) vs "advanced" (behind disclosure), or should the requirement be "a small common set is visible by default, everything else behind progressive disclosure" and leave the exact partition to design?

Reference split offered: common = note pitch + duration, song tempo/time-signature/title/composer; advanced = dots, dynamics, tie, slur, crescendo/decrescendo, annotations, barlines, per-section overrides, per-hand clef/alters/octave-shift.

**A:** Leave the exact partition to design. Spec requirement: a small common set is visible by default; everything else is behind progressive disclosure; design fixes the precise split.

### Q8 — Starting a song from empty, and adding-note mechanics

(1) Should the author still be able to build a new song from scratch from an empty block (base had a "start a new song" empty state)? (2) When adding a note, since each measure has right- and left-hand staves, should the author choose which hand it lands on, with other fields defaulted — or leave add mechanics to design?

**A:** (1) A freshly inserted/empty block seeds an **initial minimal song** — the bare minimum (a section, a measure, whatever the schema needs) so the canvas renders an empty grand staff to start adding notes to (rather than a separate "empty-state" screen). (2) The hand is determined by **which staff** the note is added to: a note added to the right-hand staff (pentagram) belongs to the right hand; one added to the left-hand staff belongs to the left hand. No separate hand picker.

### Q9 — Carry-over invariants from the base feature

Do these base behaviors all still hold unchanged in the redesign? (a) **Conformant by construction** — controls can only produce schema-valid songs; (b) **round-trip fidelity** including the note-name system (`do` stays `do`, `C` stays `C`); (c) **editor-only boundary** — song schema, `render.php`, and the front-end SVG render are untouched, and a visually-edited song renders identically to the same song in raw JSON; (d) **WordPress-only dependencies**; (e) raw-JSON field keeps its non-blocking validation; (f) **no** musical-timing/correctness validation.

**A:** All six hold as-is.

### Q10 — Non-empty invalid / non-conformant song

The canvas can't render a non-conformant song. Base behavior (AC8): such a song isn't edited visually — the editor surfaces the validation problem and routes the author to raw JSON to fix it; visual editing resumes once it's valid. Does that carry over unchanged?

**A:** Yes — carries over unchanged.

### Q11 — Large-song scope: usability vs. a performance requirement

The "doesn't scale" concern: is the goal to fix navigation/usability at scale (jump to a note by clicking instead of drilling panels), with raw performance tuning still out of scope as in the base spec — or should this review add a concrete performance/scale acceptance criterion (e.g. responsive at N measures)?

**A:** Raw performance is out of scope. The goal is navigation/usability at scale (click a note to reach it, instead of drilling deep panels); performance tuning for very large songs is not a requirement.

## Research

- **"Block settings (right sidebar)" = `InspectorControls`.** `@wordpress/block-editor` exports `InspectorControls`; panels rendered into it appear in the editor's right-hand block settings sidebar when the block is selected. This is the canonical Gutenberg home for the relocated Song / Section / Measure / Note settings (the prompt's "block settings"). No outside dependency (Req: WP-only).
- **Single source of truth unchanged.** The block persists exactly one thing: the `song` string attribute (`src/block.json`, `src/edit.js`). Note selection and the visual/raw mode flag are editor-only UI state, not persisted. Visual edits serialize back to the `song` string, so visual and raw modes always agree and WordPress block undo/redo works without custom sync (carries over from the base feature; confirmed unchanged in Q9).
- **Reused notation core.** `src/notation/layout.js` (`buildLayoutModel`) + `src/notation/svg.js` (`renderInto`) turn a song object into the grand-staff SVG; the front end (`src/view.js`) and the base editor's preview both call this path. Making the rendered staff *interactive* (click a note to select it) requires hit-testing rendered SVG glyphs back to their model location (section/measure/hand/event index). The notation core today renders for display only; exposing that element→model mapping is the main new capability and a design/feasibility topic. The schema, `render.php`, and front-end render stay untouched (Q9c), so any change here is additive and editor-only.
- **Selectable unit = event (note or rest).** Per Q4, "note" means any event. Measure/section settings are reached through the selected event's sidebar panels; direct measure/section selection is deferrable (follow-up).
- **Empty/seeded song.** A freshly inserted block seeds a minimal conformant song (≥1 section, ≥1 measure) so the canvas renders an empty grand staff to add notes to (Q8) — replacing the base "empty state" screen. Reaching a measure/section that has no events yet relies on first adding an event to it (or the deferred direct selection) — logged as an open question for design.

## Out of Scope

Confirmed with owner:

1. Audio playback (future work; carried from base).
2. Changing the song format / schema.
3. Changing the server render (`render.php`) or the front-end SVG render.
4. Musical-correctness / timing validation (durations needn't fill a measure).
5. Best-effort / partial loading of invalid songs into the visual editor (fix in raw JSON first).
6. Preserving exact raw-text formatting / unknown keys on a visual round-trip (only format-defined musical content, incl. note-name system, is preserved).
7. Performance tuning for very large songs (navigation/usability is the goal, not raw perf).
8. Reordering items — kept only if it does not complicate; may be omitted.
9. Direct selection of whole measures/sections on the canvas — deferred to a follow-up; measure/section settings are reached through the selected note.

## Consolidated Requirements

1. The block editor presents a **canvas-first visual editor** as the default authoring surface; **raw-JSON editing remains available** behind the existing mode toggle, unchanged. (Q1, Q2)
2. The **rendered sheet-music canvas is the single sheet-music surface** — the author selects and edits on it, and it **re-renders live** as the song changes. No separate read-only preview pane. (Q2)
3. The author can **select an event (note or rest) directly on the canvas**. (Q4)
4. Selecting an event surfaces, in the **block settings sidebar** (`InspectorControls`), that event's settings **plus the settings of the measure and section it belongs to**. (Q4, Q5)
5. **Song-level settings** (metadata + `defaults` context: tempo, time signature, per-hand clef/alters/octaveShift) are **always available** in the sidebar (a Song panel), regardless of selection. With **nothing selected**, the sidebar shows **only** the song settings. (Q5)
6. The visual editor retains **full coverage** of the song model — every part creatable/editable: metadata; context (defaults + per-section overrides); sections; measures (barlines, annotations); events (note/rest, duration, dots, dynamic, tie, slur, crescendo, decrescendo, annotations); pitches (step/octave/alter). (Q3)
7. **Adding a note happens on the canvas**; the **hand is determined by which staff** (right- or left-hand pentagram) the note is added to. (Q8)
8. A freshly inserted / empty block **seeds a minimal conformant song** (≥1 section, ≥1 measure) so the canvas renders an empty grand staff to begin adding notes to. (Q8)
9. The author can **add and remove** items at every level (sections, measures, events, pitches). **Reordering is optional** and may be omitted if it complicates implementation. Add/remove placement is **preferably on the canvas** (soft). (Q6)
10. **Non-common settings are hidden by default** with a way to reveal them (progressive disclosure); a small common set is visible by default. Exact partition decided in design. (Q7)
11. **Conformant by construction** — controls can only produce schema-valid songs. (Q9a)
12. **Round-trip fidelity**, including the note-name system (`do` stays `do`, `C` stays `C`). (Q9b)
13. **Editor-only boundary** — song schema, `render.php`, and front-end SVG render untouched; a visually-edited song renders identically to the same song in raw JSON. (Q9c)
14. **WordPress-only dependencies**. (Q9d)
15. Raw-JSON field keeps **non-blocking** validation (saves even when invalid). (Q9e)
16. **No** musical-timing/correctness validation. (Q9f)
17. A **non-empty invalid** song is not edited visually — the editor surfaces the validation problem and routes the author to raw JSON; visual editing resumes once valid. (Q10)
