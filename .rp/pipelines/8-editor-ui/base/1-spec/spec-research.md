# Spec Research: Editor UI for editing the song

In the editor, the Piano block should offer a friendly UI for editing the song, so authors don't have to hand-write JSON. Editing the raw JSON directly remains available as an alternative for those who want it.

Constraints:

- Use only libraries that WordPress already provides (e.g. the `@wordpress/*` packages already available to blocks); don't pull in outside dependencies.

## Q&A

### Q1. How ambitious should the friendly UI be for this first version?

The song model is deep (sections → measures → per-hand events → pitches, plus dynamics, ties, slurs, hairpins, barlines, clefs, and annotations). Should the friendly UI aim to cover the entire model, or focus on a core subset for v1 (with raw JSON remaining the way to reach everything else)?

**A1: Full model coverage.** The friendly UI can create and edit every part of the song model — nothing requires dropping to raw JSON to be reachable.

### Q2. How should the friendly UI and raw JSON editing coexist?

The issue keeps raw JSON editing "as an option." How does the author choose between the friendly UI and raw JSON — one mode at a time (a toggle), both present and synced simultaneously, or visual-by-default with JSON opened on demand?

**A2 (initial): "1 or 3, I don't fully understand the difference."** Option 2 (both visible and synced at once) is ruled out. Clarification needed between option 1 (co-equal toggle) and option 3 (visual-primary, JSON as escape hatch). See Q2b.

### Q2b. Equal peers, or visual-primary with JSON tucked away?

Both 1 and 3 show one surface at a time. The difference is framing/prominence: option 1 = visual and JSON are co-equal views you toggle between; option 3 = visual is the default home you always land in, and raw JSON is a secondary "Edit as JSON" affordance you open on demand.

**A2b: Leave exact prominence to design.** Spec-level intent: the visual UI is the friendly default and raw JSON editing stays available. The precise placement/prominence (toggle vs. escape hatch, canvas vs. sidebar vs. modal) is deferred to the design phase. Both modes operate on the same single song; they are not shown/edited simultaneously side by side (option 2 ruled out).

### Q3. Should the visual editor show a live preview of the rendered sheet music as you edit?

Today only the front end renders the song as SVG sheet music; the editor shows just the raw-JSON field (no notation). A "friendly" editor could show the rendered notation live as you edit. Is a live notation preview in the editor in scope for this version?

**A3: Yes, live notation preview.** The visual editor shows the rendered sheet music (reusing the block's existing SVG rendering) and updates it live as the author edits.

### Q4. What should the visual editor do when the stored song is invalid JSON or non-conformant?

Today the raw string is stored unconditionally even when invalid, and the front end renders nothing for a non-renderable song. With a visual editor + raw-JSON option, an author could put the song into an invalid/non-conformant state via raw editing (or by pasting). When the author then turns to the visual editor, what should happen — e.g. the visual editor refuses to load and points them to fix it in raw mode, it loads whatever it can, or something else?

**A4: Empty song is the only special case.** Empty/whitespace is "no song" → the visual editor starts fresh. Any non-empty song that is invalid JSON or non-conformant cannot be edited visually: the visual editor requires a valid, conformant song to operate, and directs the author to fix it in raw JSON (surfacing the validation errors) before visual editing resumes. (No best-effort partial loading.)

### Q5. Who is the target author for the friendly UI?

This shapes how guided/friendly the UI must be and the vocabulary it uses (e.g. note-name system, how much music-theory knowledge to assume). Who do you picture authoring songs with this editor?

**A5: Musically literate authors.** People who read sheet music / know music theory (note names, durations, clefs, dynamics). The UI can use standard musical vocabulary without heavy explanation.

### Q6. How strict should the visual editor be about what it produces?

Today's raw field stores anything and shows informational (structural-only) validation; it never checks musical timing (a measure whose durations don't fill the time signature still saves). For the visual editor, which philosophy fits?

**A6: Conformant by construction.** The visual editor's controls only let the author produce schema-conformant songs (enum dropdowns, valid note names, bounded numbers). No musical-correctness checks — like today, it does not verify that a measure's durations fill its time signature.

### Q7. Beyond editing field values, should the visual editor support adding, removing, and reordering items across the hierarchy?

E.g. add/remove/reorder sections, measures, events (notes/rests) within a hand, and pitches within a chord. "Full coverage" suggests yes, but I want to confirm reordering/restructuring (not just editing existing values) is in scope.

**A7: Yes, full add/remove/reorder.** The editor supports adding, removing, and reordering at every level (sections, measures, notes/rests, pitches in a chord), plus editing values — consistent with full model coverage.

### Q8. Is this strictly an editor-authoring feature, leaving the format, server, and front-end rendering unchanged?

I want to confirm the boundary: the visual editor reads/writes the same single `song` string attribute in the existing song format; the song schema, the server render (`render.php`), and the front-end SVG rendering are unchanged; and the existing raw-JSON field's behavior (stores unconditionally, informational validation) is preserved as the raw option.

**A8: Yes, editor-only.** Visual editor reads/writes the same `song` string in the existing format. Schema, `render.php`, and front-end rendering are unchanged. The raw-JSON field keeps today's behavior (stores unconditionally, informational validation).

### Q9. How faithful must a round-trip through the visual editor be to the author's raw JSON?

When a song authored in raw JSON is edited via the visual editor and written back, the editor would serialize the structured model it understands. This can change incidental details of the raw text. Which fidelity bar do you want?

**A9: Owner delegated the decision to the orchestrator → "Preserve meaning, not formatting."** The round-trip must preserve all musical content the song format defines — including the note-name system the author used (e.g. Spanish `do` stays `do`, not silently converted to `C`). Incidental raw-text details (whitespace, key ordering, and any unknown/extra keys the permissive schema ignores) need not be preserved. Rationale: pragmatic fit for a structured, conformant-by-construction editor; preserving unknown keys or exact text would over-constrain the implementation for little author-visible benefit, given the format is additive and unknown keys are rare.

## Research

Findings from exploring the codebase at the start of this phase:

- **Current editor** — `src/edit.js` renders a single `TextareaControl` (label "Song (JSON)") on the block canvas. The author edits the song document as raw text; the raw string persists unconditionally on every change via `setAttributes({ song })`, even when invalid. Validation (`src/song/validate.js`) is a pure presentational side-computation that surfaces a non-blocking `Notice`; it never blocks saving, clears the field, or substitutes a parsed value.
- **Block attributes** — `src/block.json` declares exactly one attribute: `song` (`type: "string"`, default `""`). The block is dynamic / server-rendered (`render.php`); the stored song string is rendered as SVG sheet music on the front end by the block's own client code.
- **Song model is deep and nested** — `src/song/schema.js` (canonical machine-readable schema; human reference in `docs/song-format.md`):
  - top level: `metadata` (title, composer), `defaults` (a shared "context"), `sections[]`
  - context: `tempo` (bpm, beatUnit), `timeSignature` (beats, beatType), `rightHand`/`leftHand` `handConfig` (clef, alters map, octaveShift)
  - section: context overrides + `measures[]`
  - measure: `rightHand[]`/`leftHand[]` event arrays, `barlineStart`/`barlineEnd`, `annotations[]` (standalone, staff-anchored)
  - event: `type` (note/rest), `duration`, `dots`, `pitches[]`, `dynamic` (pp…sfz), `annotations[]` (event-anchored), `tie`, `slur`, `crescendo`, `decrescendo`
  - pitch: `step` (note name), `octave` (0–9), `alter` (−2..+2)
  - note names matched case-insensitively across two systems: English (C D E F G A B) + Spanish (do re mi fa sol la si)
- **Constraint** — issue requires using only `@wordpress/*` packages already available to blocks; no outside dependencies. Existing editor already uses `@wordpress/block-editor`, `@wordpress/components`, `@wordpress/element`, `@wordpress/i18n`.
- **Tests** — e2e Playwright specs in `specs/` (`editor.spec.js`, `render.spec.js`); unit tests (Jest) under `src/**/__tests__`.
- **Convention** — `AGENTS.md`: pipeline artifacts under `.rp/` must never be referenced from shipped source or user-facing docs.

## Out of Scope

Confirmed with the owner (Q&A step 4):

1. **Audio playback** — already future work for the plugin; not part of this feature.
2. **Changing the song format / schema** — the song model (`src/song/schema.js`) stays as-is.
3. **Changing the server render (`render.php`) or the front-end SVG rendering** — the published-page output is unchanged.
4. **Musical-correctness / timing validation** — no checking that a measure's event durations fill its time signature (matches today's behavior).
5. **Best-effort / partial loading of invalid songs** into the visual editor — a non-empty invalid/non-conformant song must be fixed in raw JSON first.
6. **Preserving exact raw-text formatting or unknown/extra keys** on a visual round-trip — only format-defined musical content (incl. the note-name system used) is preserved; whitespace, key order, and permissively-ignored unknown keys may change.
7. **Performance optimization for very large songs** — the live preview should be responsive for typical songs, but large-song tuning is not a goal.

## Consolidated Requirements

1. The Piano block's editor offers a **visual (friendly) UI** for authoring the song, so authors don't have to hand-write JSON.
2. The visual UI provides **full coverage** of the song model — it can create and edit every part: `metadata` (title, composer); `defaults` and per-section context (`tempo`, `timeSignature`, per-hand `clef`/`alters`/`octaveShift`); `sections`; `measures` (incl. `barlineStart`/`barlineEnd` and standalone staff annotations); `events` (note/rest, `duration`, `dots`, `dynamic`, `tie`, `slur`, `crescendo`, `decrescendo`, event annotations); and `pitches` (`step`, `octave`, `alter`).
3. The visual UI supports **adding, removing, and reordering** items at every level (sections; measures; events within a hand; pitches within a chord), in addition to editing existing values.
4. **Raw JSON editing remains available** as an alternative. The visual UI is the friendly default; raw JSON stays reachable. The exact placement/prominence and switch mechanism are a design decision. The two are not edited simultaneously side by side.
5. The visual editor and the raw JSON operate on the **same single song** — the block's existing `song` string attribute in the existing format. Switching surfaces reflects the current song.
6. The visual editor requires a **valid, conformant song** to operate. Empty/whitespace is "no song" → the visual editor starts fresh (begin a new song). A non-empty song that is invalid JSON or non-conformant cannot be edited visually; the editor surfaces the problem(s) and directs the author to fix it in raw JSON; visual editing resumes once the song is valid.
7. The visual editor is **conformant by construction**: its controls only allow producing schema-conformant songs (constrained choices for enumerated fields, valid note names, in-range numbers). It performs no musical-correctness/timing checks.
8. The editor shows a **live preview** of the rendered sheet music, reusing the block's existing SVG rendering, updating as the author edits a valid song.
9. **Round-trip fidelity**: editing a song through the visual editor preserves all musical content the format defines, including the note-name system used (English vs Spanish, e.g. `do` stays `do`). Incidental raw-text details need not be preserved.
10. Target authors are **musically literate**; the UI may use standard musical vocabulary (note names, durations, clefs, dynamics) without heavy explanation.
11. **WordPress-only dependencies**: implemented using only `@wordpress/*` packages already available to blocks; no outside dependencies.
12. **Editor-only scope**: the song format/schema, server render, and front-end rendering are unchanged; the existing raw-JSON field's behavior (stores unconditionally, informational validation) is preserved as the raw option.
