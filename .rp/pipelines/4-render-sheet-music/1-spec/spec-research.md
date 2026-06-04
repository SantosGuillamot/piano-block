# Spec Research: Render the Piano block's song as visual sheet music (grand staff)

> Source prompt (copied verbatim from `0-prompt/prompt.md`):

## Goal

When a Piano block contains a song, a reader sees it rendered as readable piano sheet music — a grand staff showing both hands as pentagrams with their notes — instead of the raw stored data. The author sees the same rendering live in the editor while building the block. (Today the block only stores/echoes the song; this turns that data into notation people can actually read.)

## Constraints

- The notation must be rendered by us, **without depending on any existing music-notation library** (e.g. VexFlow, abcjs, OpenSheetMusicDisplay, Verovio). A standalone *asset* such as an open-licensed music font is acceptable — that is not a "library" in this sense.

## Context

- Builds directly on #2, which defines and stores the song as a custom, dependency-free JSON document (grand staff: `defaults` + `chunks[]` → `measures[]` → `rightHand[]`/`leftHand[]` events, covering clefs, key-signature-like alterations, time signature, tempo, durations, dynamics, ties, slurs, chord symbols, barlines). #2 deliberately leaves rendering out of scope; this issue is that rendering step and takes that JSON as its input. (#2 is still in progress, so the schema may still shift.)
- The owner has a concrete target look in mind: a normal printed piano score — two clefs braced together, key & time signatures, beamed notes over sustained chords, ties, dynamics, a tempo marking, measure numbers.
- This direction was explored up front with several independent design passes; the notes below capture where they pointed, but they are starting points, not decisions.

## Assumptions / directions to explore

*(all open — confirm, refine, or overturn in later phases)*

- **Substrate:** inline **SVG** looks like the strongest fit (vector, scalable, themeable via `currentColor`, accessible). Canvas, HTML/CSS, and Unicode music symbols seem weaker, but worth a sanity check.
- **Glyphs:** suggest a music **font** for the ornate glyphs (clefs, noteheads, accidentals, rests, flags) plus simple SVG shapes for geometry (staff/ledger lines, stems, beams, ties). **Bravura** (SIL OFL) is a *suggested* font, **not a requirement** — hand-drawn SVG glyph paths (zero external assets) are a legitimate alternative.
- **One shared renderer:** prefer a single, framework-free rendering "engine" reused by both editor and frontend rather than two implementations that can drift apart — this looks like the main risk to manage.
- **Where it renders:** leaning toward rendering on the client on the frontend (song JSON staying the single source of truth) via the WordPress Interactivity API, with the editor calling the same engine for its preview. A server-side (PHP) renderer is a credible alternative to weigh (trade-offs: no-JS/SEO vs. duplicated logic).
- **Engine internals worth investigating:** a staff-space coordinate system; mapping a pitch to a staff position via its diatonic step relative to the clef (ledger lines falling out naturally); both hands sharing one time grid per measure so they align vertically; horizontal spacing proportional to note duration; beaming grouped by the meter's beat unit (e.g. 12/8 → groups of three eighths); wrapping measures into stacked systems.
- **Coverage:** aim to eventually render what a normal score shows — clefs, key/time signatures, noteheads/stems/flags/beams, dotted notes, rests, accidentals (incl. doubles), chords, ties, slurs, dynamics, chord symbols, repeat/final barlines, tempo text, measure numbers. A sensible first slice could be a single staff with basic notes, then grow.
- **Scope / future:** static notation is the focus here. Interactive features the block may eventually want — a moving playhead, per-note highlighting synced to audio, playback — are out of scope for now, but the design shouldn't preclude them.
- **Testability:** because #2's authoring UI is a separate concern, a simple way to load a sample song (a default example, and/or a raw-JSON field in the editor) would let this rendering be exercised on its own.

## Q&A

**Q1 (scope/coverage).** The stored format can express a wide range of notation: clefs, key-signature-like accidentals, time signature, tempo marking, noteheads/stems/flags, beams, dotted notes, rests, per-note accidentals (incl. doubles), chords, ties, slurs, dynamics, chord symbols, repeat/double/final barlines, multi-octave shifts, and measure numbers. For **this issue** specifically, what is the target coverage of the deliverable — render everything the format can express now, or ship a defined first slice now and grow the rest in follow-up issues?

_Answer:_ **Full coverage now.** Render everything the stored format can express in this issue — both hands braced together, clefs, key/time signatures, beamed notes, dotted notes, rests, accidentals (incl. doubles), chords, ties, slurs, dynamics, chord symbols, all barline types, octave shifts, tempo text, and measure numbers. Matches the "normal printed piano score" target look.

**Q2 (editor surface).** Today the editor shows a raw-JSON `TextareaControl` plus a non-blocking validation notice. With live notation now in play, how should the editor present things — keep the raw-JSON field as the authoring input with the rendered notation shown live alongside it, replace the field with the rendered notation (move the JSON input elsewhere, e.g. the Inspector sidebar), or something else?

_Answer:_ **Start with the frontend only.** This issue renders notation on the **frontend** only. The **editor stays as it is today** — keep only the raw-JSON field (and its non-blocking validation notice); no live notation preview in the editor for this issue. (This deliberately narrows the issue's original Goal, which also mentioned a live editor preview; the editor preview is deferred to a future issue. Note this also defers the issue's "one shared renderer reused by both editor and frontend" concern, since only one surface renders here.)

**Q3 (frontend display states).** For a valid, conformant song the rendered notation replaces today's raw-JSON `<pre>` echo on the frontend. Because the editor never blocks saving, the stored `song` can also be (a) empty/whitespace (today the frontend outputs nothing) or (b) present but not renderable as notation — invalid JSON or structurally non-conformant. What should the frontend show in those two cases?

_Answer:_ **Empty → nothing; non-renderable → nothing.** An empty/whitespace song outputs nothing (as today). A present-but-non-renderable song (invalid JSON or non-conformant) also outputs nothing — no raw-JSON echo and no error message shown to readers. The frontend only ever shows rendered notation (for a valid song) or nothing at all. The current raw `<pre>` passthrough is fully removed.

**Q4 (fidelity / success bar).** How should we judge the rendering is "good enough" to call this done? Given the no-library constraint, the realistic spectrum runs from "recognizable as a standard piano score and faithful to the data" up to "professional engraving quality (precise spacing, collision avoidance, beam-slope rules)."

_Answer:_ **Recognizable + data-faithful.** The output must be clearly recognizable as a standard piano grand-staff score and faithfully reflect the song data: correct clefs; every pitch on the correct staff line/space with ledger lines and accidentals; correct durations/dots/rests; chords stacked; and ties, slurs, beams, dynamics, chord symbols, barlines, tempo text, and measure numbers all present and attached to the right events. Spacing must be reasonable and readable, but there is **no** requirement to follow professional engraving rules precisely or to match any specific reference image.

**Q5 (layout for length & width).** A song can have many measures, and the block renders at different widths (full-width, columns, narrow themes, mobile). How should the score lay out across length and width?

_Answer:_ **Wrap into stacked systems.** Measures flow left-to-right and wrap onto multiple stacked grand-staff systems (lines) to fit the available container width, reflowing as the width changes — like a printed score adapting to page width. Must remain usable on narrow/mobile widths.

**Q6 (no-JS / SEO requirement).** This is a requirement that constrains the later design but is not itself a design choice. On the frontend, must the rendered notation be present without client-side JavaScript (i.e. visible with JS disabled and to search-engine crawlers in the initial HTML), or is it acceptable to require JavaScript to render it on the page?

_Answer:_ **JavaScript may be required.** No-JS rendering is not a requirement. It is acceptable for the notation to be produced by client-side JavaScript, so it need not appear with JS disabled or in the raw HTML for crawlers. The design phase is free to render on the client (e.g. Interactivity API) or the server — left open, with no no-JS constraint.

**Q7 (accessibility).** The rendered score is fundamentally a visual graphic. What accessibility level should this issue target for assistive technology (screen readers, etc.)?

_Answer:_ **Basic text alternative.** The notation graphic carries a concise accessible name/label (e.g. an image role labeled with the song title, or "Piano sheet music" plus title/composer when present) so screen readers announce something meaningful. The detailed notation itself is treated as a graphic. A rich, screen-reader-navigable description of the music is out of scope for this issue.

**Q8 (theming / color).** Should the notation adapt to the surrounding theme — e.g. draw in the inherited text color so it works on both light and dark backgrounds — or is a fixed color (e.g. black) acceptable for this issue?

_Answer:_ **Fixed color is fine.** Rendering the notation in a fixed color (e.g. black) is acceptable for this issue. Theme-adaptive color (e.g. `currentColor`, light/dark adaptation) is not required here.

**Q9 (metadata display).** The format carries optional `metadata.title` and `metadata.composer`. Should the rendered output display these (e.g. a title/composer heading above the score, as a printed score would), or is displaying them out of scope for this issue (the notation only)?

_Answer:_ **Notation only.** Do not display title/composer text in the rendered output for this issue. (They remain available to feed the accessibility label per Q7.) Showing a title/composer heading can be a later enhancement.

## Research

Findings from the current codebase (worktree `worktree-4-render-sheet-music`, branched from `trunk` at the merge of #2 / PR #5):

- **Shipped song format uses `sections[]`, not `chunks[]`.** The issue text (above) predates #2's finalization and says `chunks[]`; the merged format (`docs/song-format.md`, `src/song/schema.js`) is `song := { metadata?, defaults?, sections }`, where `section := { tempo?, timeSignature?, rightHand?, leftHand?, measures }` and `measure := { rightHand?[], leftHand?[], barlineStart?, barlineEnd? }`. A section is "a run of music over which tempo/timeSignature/per-hand clef/alters/octaveShift stay constant"; mid-song changes start a new section. (Source: `docs/song-format.md`.)
- **Format coverage that rendering must consume:** clefs (`treble|bass|alto|tenor`); per-hand `alters` map (key-signature-like default accidentals, note-name → −2..+2); `octaveShift` (−2..+2, ottava); `tempo {bpm, beatUnit?}`; `timeSignature {beats, beatType∈{1,2,4,8,16,32}}`; events `{type: note|rest, duration: whole..thirty-second, dots:0..2, pitches[], dynamic, chordSymbol (free text), tie: start|stop, slur: start|stop}`; pitch `{step (English C–B or Spanish do–si, case-insensitive), octave 0..9, alter −2..+2}`; barlines `regular|repeat-start|repeat-end|double|final`. (Source: `src/song/schema.js`, `docs/song-format.md`.)
- **No musical-timing guarantees.** The validator checks structure/field values only — events need not sum to the time signature, and the two hands need not align in length. A renderer cannot assume bars "add up." (Source: `docs/song-format.md`, `src/song/validate.js` header.)
- **Current block surface.** Block stores a single `song` string attribute (`src/block.json`). Editor (`src/edit.js`) renders a raw-JSON `TextareaControl` plus a non-blocking validation `Notice` (validation never blocks save). Frontend is a **dynamic block** (`src/block.json` `render: file:./render.php`); `src/render.php` echoes the raw `song` string inside a `<pre>` via `esc_html()`, and outputs nothing when the song is empty/whitespace. There is no `viewScript`/Interactivity API wiring yet. (Source: `src/block.json`, `src/edit.js`, `src/render.php`.)
- **Validator is reusable.** `validateSong(rawString)` (`src/song/validate.js`) parses + validates and returns human-readable errors (`[]` when conformant); schema-as-data lives in `src/song/schema.js`. Empty string `""` is the "no song" state and is never validated. (Source: `src/song/validate.js`, `src/edit.js`.)
- **Tooling/constraints.** Build is `@wordpress/scripts` (`package.json`); no music-notation dependency is present, consistent with the no-library constraint. Biome for lint/format. Existing e2e specs under `specs/` (`editor.spec.js`, `render.spec.js`) use Playwright. WP target from project memory: WP 6.9+, PHP 7.4+.

## Out of Scope

Collected from the Q&A (to confirm in step 4):

1. **Editor live preview / notation in the editor.** The editor keeps only today's raw-JSON field + validation notice. No in-editor rendering this issue (Q2).
2. **The "one shared renderer reused by editor and frontend" concern.** Moot here because only the frontend renders (Q2).
3. **Showing raw JSON or an error on the frontend** for non-renderable songs — the frontend shows notation or nothing (Q3). The current raw `<pre>` passthrough is removed.
4. **Professional engraving quality** — precise optical spacing, collision avoidance, beam-slope/stem rules, matching a specific reference score (Q4).
5. **No-JS / SSR rendering guarantee** — not required; notation may rely on client-side JavaScript (Q6).
6. **Rich, screen-reader-navigable description** of the music — only a basic accessible label is in scope (Q7).
7. **Theme-adaptive color** (`currentColor` / light-dark adaptation) — a fixed color is acceptable (Q8).
8. **Displaying `metadata.title` / `metadata.composer`** as visible text/heading — notation only (Q9).
9. **Authoring/UX beyond today** — no visual note-input UI, no changes to how songs are entered (still raw JSON in the editor).
10. **Audio, playback, moving playhead, per-note highlighting, and any interactivity** — explicitly deferred by the issue; static notation only (design should not preclude them, but they are not built here).

## Consolidated Requirements

1. On the **frontend**, when a Piano block's stored song is **conformant** to the song format, the block renders it as visual piano sheet music — a braced **grand staff** (right-hand staff above left-hand staff) — in place of the raw stored data. The current raw-JSON `<pre>` passthrough is removed.
2. The rendering covers the **full set of notation the stored format can express**: per-hand clefs (`treble`/`bass`/`alto`/`tenor`); key-signature-like default accidentals (per-hand `alters`); time signature; tempo marking (bpm + optional beat unit) as text; noteheads, stems, flags, and **beams**; dotted notes (1–2 dots); rests; per-note accidentals including doubles (−2..+2); chords (multiple pitches in one event, stacked); ties; slurs; dynamics (`pp`…`sfz`); chord symbols (free text); barlines (`regular`/`repeat-start`/`repeat-end`/`double`/`final`); octave shifts / ottava (±2); and measure numbers.
3. The rendering reflects **multiple sections** and **mid-song changes**: when a new section changes tempo, time signature, a hand's clef, its default accidentals, or its octave shift, the change is shown at that section boundary.
4. Each pitch is placed on the **correct staff line/space** for the active clef, with **ledger lines** as needed; accidentals are shown correctly, distinguishing per-hand default accidentals from per-note overrides.
5. The two hands are **vertically aligned per measure** (a shared per-measure time grid), and the music is recognizable as a standard piano score with reasonable, readable horizontal spacing. (Bar: "recognizable + data-faithful"; no engraving-grade requirement.)
6. The score **wraps into multiple stacked grand-staff systems** to fit the container width and reflows responsively; it remains usable at narrow/mobile widths.
7. **Frontend display states:** an empty/whitespace song renders nothing; a present-but-non-renderable song (invalid JSON or non-conformant) renders nothing — no raw echo and no reader-facing error. Only a conformant song renders notation.
8. **Robustness:** the renderer renders any conformant song best-effort and never errors. It does **not** assume a measure's events sum to the time signature or that the two hands have equal length, and it still draws the braced two-staff grand staff when a measure has only one hand or an empty hand.
9. **No music-notation library** (VexFlow, abcjs, OpenSheetMusicDisplay, Verovio, etc.) is used; the rendering engine is the project's own code. A standalone open-licensed *asset* (e.g. a music font) is permitted.
10. The notation **may rely on client-side JavaScript** on the frontend (no-JS / SSR rendering is not required).
11. The **editor is unchanged** for this issue: it keeps the raw-JSON authoring field and its non-blocking validation notice; there is no in-editor notation preview.
12. **Accessibility:** the rendered notation carries a concise accessible label (e.g. an image-role graphic labeled with the song's title, or "Piano sheet music" plus title/composer when present).
13. **Color:** the notation may be drawn in a fixed color; theme-adaptive color is not required.
14. The design must **not preclude** later interactive features (moving playhead, per-note highlighting, playback), but builds none of them here.
