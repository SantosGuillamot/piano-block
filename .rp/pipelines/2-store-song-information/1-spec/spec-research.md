# Spec Research: Store song information in the Piano block

# Store song information in the Piano block

_This is the phase-0 prompt for pipeline `2-store-song-information`, derived from GitHub issue #2 of `SantosGuillamot/piano-block`. It is the self-contained brief for the agents running the later phases (Spec, Design doc, Plan, Code, Docs) — they should not need to consult the original issue. The text below is the issue verbatim._

_Status of each section: **Goal**, **Constraints**, and **Context** state what the issue asks for. **Assumptions / directions to explore**, **Example / guidance**, and **Format contract** capture a prior assisted design discussion and are explicitly illustrative and open — starting points to confirm or refine during Spec and Design, not fixed requirements. Agents should do their own research and decide the format in those phases._

---

## Goal

The Piano block defines and persists a complete piano song as structured data in a single block attribute, covering both hands of a grand staff (a right-hand and a left-hand pentagram). The song is captured in the editor and stored on the block.

## Constraints

- Store the song as a **custom, dependency-free JSON** document in a **single block attribute** (`song`) — no external notation format (MusicXML/ABC/MIDI), no music libraries, no nested innerBlocks.
- Model a **grand staff**: right-hand and left-hand pentagrams that stay time-aligned.
- **Start minimal and grow additively** — no schema `version` field; new capabilities arrive as optional fields.
- The format must **not preclude future audio playback** (retain pitch / octave / duration / tempo precision).
- **Frontend rendering is out of scope.** `render.php` simply outputs the stored `song` JSON as a string (stringified) — no notation drawing. The authoring UI (editor input controls) and audio are also out of scope: this issue establishes the storage attribute and its format.

## Context

- Builds on #1 (the scaffold: dynamic block, `save: null`, data read by `render.php`).
- An assisted design discussion explored three storage approaches — (A) a custom JSON we own, (B) an existing notation format + rendering/audio library such as ABC + abcjs, (C) WordPress-native innerBlocks — and selected **A** for full control, zero dependencies, and best fit with the dynamic / `save:null` block.

## Assumptions / directions to explore

*(open — to be confirmed or refined in Spec & Design)*

- **Shape:** `song → { metadata, defaults, chunks[] }`; each **chunk** is a section with constant context, `chunk → measures[] → { rightHand[], leftHand[] }` of note/rest events.
- **Chunks** model mid-song changes: a different tempo, clef, time signature or default alteration starts a new chunk.
- **Per-hand config** under `rightHand`/`leftHand` (clef + default `alters`, later per-hand dynamics), set in `defaults` and overridable per chunk.
- **Events:** `type` note/rest, `duration` (+`dots`), `pitches[]` (a chord = several), per-note `alter`; plus `dynamic`, `chordSymbol`, and `tie`/`slur` as `start`/`stop`; repeats via measure `barline`.
- **Note names** accept both English letters (`C…B`) and Spanish solfège (`do…si`), treated as equivalent.
- Covers the requested elements (notes; flats/sharps per note and per staff line; clef; time signature; dynamics; chord symbols; ties and slurs; repeat barlines) plus durations, rests, octave, tempo and metadata. Richer notation (articulations, ornaments, pedal, fingering, tuplets, voltas, polyphony…) is deferred to additive extensions.

## Example / guidance

*(draft format from the design discussion — illustrative, not binding)*

Annotated value of the `song` attribute — two chunks (B changes tempo and the right-hand alterations), with a chord, an accidental, a dynamic, a chord symbol, a slur, a tie across the chunk boundary, and a repeat barline:

```json
{
  "metadata": { "title": "Example", "composer": "" },
  "defaults": {
    "tempo": { "bpm": 96, "beatUnit": "quarter" },
    "timeSignature": { "beats": 4, "beatType": 4 },
    "rightHand": { "clef": "treble" },
    "leftHand": { "clef": "bass" }
  },
  "chunks": [
    {
      "id": "A",
      "measures": [
        {
          "barlineEnd": "repeat-end",
          "rightHand": [
            { "type": "note", "duration": "quarter", "dynamic": "mf", "chordSymbol": "C",
              "pitches": [ { "step": "do", "octave": 5 } ] },
            { "type": "note", "duration": "eighth", "slur": "start",
              "pitches": [ { "step": "re", "octave": 5 } ] },
            { "type": "note", "duration": "eighth", "slur": "stop",
              "pitches": [ { "step": "mi", "octave": 5 } ] },
            { "type": "note", "duration": "half", "tie": "start",
              "pitches": [ { "step": "sol", "octave": 5 } ] }
          ],
          "leftHand": [
            { "type": "note", "duration": "half",
              "pitches": [ { "step": "do", "octave": 3 }, { "step": "sol", "octave": 3 } ] },
            { "type": "note", "duration": "half",
              "pitches": [ { "step": "sol", "octave": 3 } ] }
          ]
        }
      ]
    },
    {
      "id": "B",
      "tempo": { "bpm": 120 },
      "rightHand": { "alters": { "F": 1 } },
      "measures": [
        {
          "rightHand": [
            { "type": "note", "duration": "quarter", "tie": "stop",
              "pitches": [ { "step": "G", "octave": 5 } ] },
            { "type": "note", "duration": "quarter",
              "pitches": [ { "step": "F", "octave": 5 } ] },
            { "type": "rest", "duration": "half" }
          ],
          "leftHand": [
            { "type": "note", "duration": "whole",
              "pitches": [ { "step": "G", "octave": 2 } ] }
          ]
        }
      ]
    }
  ]
}
```

*Notes on the example:* `step` accepts both English letters (`C, D, E, F, G, A, B`) and Spanish solfège (`do, re, mi, fa, sol, la, si`), equivalent (do=C, re=D, mi=E, fa=F, sol=G, la=A, si=B) — chunk A uses solfège and chunk B uses letters to show both; the `sol5 → G5` tie is valid because they are the same pitch. In chunk B, `"rightHand": { "alters": { "F": 1 } }` makes every right-hand `F` sound sharp without per-note marking (its `clef` is inherited from `defaults`); a per-note `alter` overrides `alters`.

Format contract (JSON Schema, minimal core):

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Piano Block Song",
  "type": "object",
  "required": ["chunks"],
  "properties": {
    "metadata": {
      "type": "object",
      "properties": { "title": { "type": "string" }, "composer": { "type": "string" } }
    },
    "defaults": {
      "type": "object",
      "properties": {
        "tempo": { "$ref": "#/$defs/tempo" },
        "timeSignature": { "$ref": "#/$defs/timeSignature" },
        "rightHand": { "$ref": "#/$defs/handConfig" },
        "leftHand": { "$ref": "#/$defs/handConfig" }
      }
    },
    "chunks": { "type": "array", "items": { "$ref": "#/$defs/chunk" } }
  },
  "$defs": {
    "tempo": {
      "type": "object",
      "required": ["bpm"],
      "properties": {
        "bpm": { "type": "number", "exclusiveMinimum": 0 },
        "beatUnit": { "$ref": "#/$defs/duration" }
      }
    },
    "timeSignature": {
      "type": "object",
      "required": ["beats", "beatType"],
      "properties": {
        "beats": { "type": "integer", "minimum": 1 },
        "beatType": { "type": "integer", "enum": [1, 2, 4, 8, 16, 32] }
      }
    },
    "handConfig": {
      "type": "object",
      "properties": {
        "clef": { "$ref": "#/$defs/clef" },
        "alters": {
          "type": "object",
          "propertyNames": {
            "enum": ["do", "re", "mi", "fa", "sol", "la", "si", "C", "D", "E", "F", "G", "A", "B"]
          },
          "additionalProperties": { "type": "integer", "minimum": -2, "maximum": 2 }
        }
      }
    },
    "chunk": {
      "type": "object",
      "required": ["measures"],
      "properties": {
        "id": { "type": "string" },
        "tempo": { "$ref": "#/$defs/tempo" },
        "timeSignature": { "$ref": "#/$defs/timeSignature" },
        "rightHand": { "$ref": "#/$defs/handConfig" },
        "leftHand": { "$ref": "#/$defs/handConfig" },
        "measures": { "type": "array", "items": { "$ref": "#/$defs/measure" } }
      }
    },
    "measure": {
      "type": "object",
      "properties": {
        "barlineStart": { "$ref": "#/$defs/barline" },
        "barlineEnd": { "$ref": "#/$defs/barline" },
        "rightHand": { "type": "array", "items": { "$ref": "#/$defs/event" } },
        "leftHand": { "type": "array", "items": { "$ref": "#/$defs/event" } }
      }
    },
    "event": {
      "type": "object",
      "required": ["type", "duration"],
      "properties": {
        "type": { "enum": ["note", "rest"] },
        "duration": { "$ref": "#/$defs/duration" },
        "dots": { "type": "integer", "minimum": 0, "maximum": 2 },
        "pitches": { "type": "array", "items": { "$ref": "#/$defs/pitch" } },
        "dynamic": { "enum": ["pp", "p", "mp", "mf", "f", "ff", "sf", "sfz"] },
        "chordSymbol": { "type": "string" },
        "tie": { "enum": ["start", "stop"] },
        "slur": { "enum": ["start", "stop"] }
      },
      "allOf": [
        { "if": { "properties": { "type": { "const": "note" } } },
          "then": { "required": ["pitches"] } }
      ]
    },
    "pitch": {
      "type": "object",
      "required": ["step", "octave"],
      "properties": {
        "step": { "enum": ["do", "re", "mi", "fa", "sol", "la", "si", "C", "D", "E", "F", "G", "A", "B"] },
        "octave": { "type": "integer", "minimum": 0, "maximum": 9 },
        "alter": { "type": "integer", "minimum": -2, "maximum": 2, "default": 0 }
      }
    },
    "duration": { "enum": ["whole", "half", "quarter", "eighth", "sixteenth", "thirty-second"] },
    "clef": { "enum": ["treble", "bass", "alto", "tenor"] },
    "barline": { "enum": ["regular", "repeat-start", "repeat-end", "double", "final"] }
  }
}
```


## Q&A

### Q1 — How does a song's data get onto a block in v1?

Authoring UI (editor input controls) and audio are out of scope, yet the goal says the song is "captured in the editor and stored on the block." For this issue specifically, how should a `song` value come to exist on a block instance — i.e., what is the observable deliverable around populating the attribute?

**A:** Minimal raw-JSON field. The editor provides a simple raw-JSON input (e.g. a textarea / code field) so a user can paste or edit the `song` JSON directly; this is in scope for v1. A rich/visual notation authoring UI remains out of scope.

### Q2 — Should the song data be validated, and where?

Now that the editor exposes a raw-JSON field, malformed, partial, or empty data is a realistic scenario. Should v1 validate the song data, and if so where — in the editor as the user edits, on the front end at render time, both, or not at all?

**A:** Editor-side only. The editor validates the JSON and surfaces errors when it is invalid. The front end (`render.php`) assumes the stored data is well-formed and simply stringifies it — no render-time validation or guarding.

### Q3 — What does the editor's validation actually check?

Given editor-side validation, how deep should the check go: only that the text parses as JSON, or also that it conforms to the song format (required fields, allowed durations/clefs/etc.)?

**A:** Full song-format conformance. The editor validates the parsed data against the entire song format — required fields and allowed values (durations, clefs, dynamics, barlines, note names, etc.) — and flags anything that does not conform. This implies a canonical, machine-checkable definition of the format that the editor checks against; the design phase defines that definition.

### Q4 — What does a freshly inserted block contain, and what does the front end show for it?

A brand-new block has no song yet. What should its initial `song` value be, and what should `render.php` output in that state (given the front end just stringifies whatever is stored)?

**A:** Empty / no song. A new block's `song` starts empty (empty string or unset); the editor field is blank; `render.php` outputs nothing meaningful until the user enters a song. The empty/blank state is a valid "no song yet" state, distinct from a conformant song — full-conformance validation applies to non-empty input.

### Q5 — Confirm the v1 expressive scope (what must be representable)

Distilled from the issue, the format must be able to represent the following in v1. Asked the owner to confirm or adjust (add/remove, or move items between in-scope and deferred). The internal JSON structure and field names are intentionally left to the design phase — this question is only about WHAT must be representable.

Must be representable (v1): notes & rests with durations (whole…thirty-second) and dots; pitch as note name + octave with a per-note accidental (double-flat…double-sharp); chords (several pitches in one event); both note-name systems (English C–B and Spanish do–si) accepted and equivalent; a grand staff (right-hand + left-hand, time-aligned); per-hand context (clef treble/bass/alto/tenor + per-hand default accidentals); mid-song changes to tempo / clef / time signature / default accidentals; time signature and tempo; dynamics (pp…sfz); chord symbols (text); ties and slurs (start/stop); barlines including repeats; metadata (title, composer).

Locked constraints: one block attribute named `song`; custom dependency-free JSON; no external notation format/library; no innerBlocks; no schema `version` field (additive growth); must not preclude future audio (retain pitch/octave/duration/tempo precision).

Deferred: richer notation (articulations, ornaments, pedal, fingering, tuplets, voltas, polyphony/multiple voices per hand, lyrics, …); authoring UI beyond the raw-JSON field; audio playback; front-end notation rendering.

**A:** Broadly aligned with the distilled scope, but the owner raised a candidate addition — representing octave changes applied to a whole chunk, per hand (parallel to the per-chunk clef / default accidentals). See Q6 for the clarification and decision. The consolidated v1 scope is re-confirmed after Q6.

### Q6 — Owner-raised: per-hand octave change per chunk?

The owner asked whether v1 should also represent octave changes applied to a whole chunk, per hand (parallel to per-chunk clef / default accidentals). Clarified two readings and asked which (if any) to include in v1:
(1) a per-hand **default octave** for a chunk — the octave analogue of the per-hand default accidentals (`alters`); a shorthand that resolves to concrete per-note octaves and is overridable per note, so audio precision is unaffected;
(2) an **octave-shift marking** (ottava, 8va/8vb) alongside clef — primarily a notation/display concept; stored as data only since front-end rendering is out of scope.
JSON encoding is left to design; this only decides whether the concept is in the v1 representable scope.

**A:** Octave-shift marking (ottava, 8va/8vb). v1 also represents a per-hand octave-shift marking applied across a chunk (changeable per chunk, alongside clef) — "play an octave higher/lower." It is a notation/display concept (stored data only, since rendering is out of scope); for future audio the sounding octave is the written octave plus the shift, so pitch precision is retained. The per-note `octave` still exists; this marking is additional. Allowed magnitudes/range (e.g. ±1 octave for 8va/8vb vs ±2 for 15ma/15mb) are left to design. Net effect: the v1 per-hand context = clef + default accidentals + octave-shift marking.

### Q7 — How strict is "full conformance"? Does it include musical-timing checks?

"Full song-format conformance" (Q3) could mean structural/field conformance only — required fields present, values from allowed sets (durations, clefs, dynamics, note names, barlines…), correct types/nesting (the kind a JSON Schema expresses), with no duration arithmetic — or it could additionally enforce musical-timing invariants: each measure's events fill its time signature, and/or the two hands stay time-aligned. Asked the owner how strict v1 editor validation must be.

**A:** Structural/field only. v1 editor validation checks structural/field conformance — required fields present, values from allowed sets (durations, clefs, dynamics, note names, barlines…), correct types and nesting (JSON-Schema-style). No duration arithmetic: measure-filling (events summing to the time signature) and right/left-hand time-alignment are the author's responsibility and are deferred. So "time-aligned" in the grand-staff requirement is a representational capability (the format can express aligned hands), not a validated invariant in v1.

### Q8 — On invalid / non-conformant input, what happens to the stored `song`?

Editor-side validation flags non-conformant input, and the front end assumes the stored song is well-formed. So when the user enters invalid JSON in the field, what should happen to the stored `song` attribute in order to preserve that front-end guarantee?

**A:** Store raw text anyway. The editor stores the author's raw input in `song` even when it is non-conformant; the validation error is informational only and does NOT block storage. Consequences: (1) the stored value must be able to hold arbitrary text (effectively a raw string), not a guaranteed-parsed object; (2) the front end may receive non-conformant or even non-JSON content. This consciously relaxes the earlier "front end assumes well-formed" framing (Q2) in favour of simplicity — `render.php` performs no validation and simply outputs the stored text, which MUST be safely escaped on output (security requirement). Net model: editor validation = informational aid only; persistence is unconditional; render = passthrough of the stored text, escaped.

### Q9 — Out-of-scope verification

Surfaced the consolidated out-of-scope list (see the `## Out of Scope` section) and asked the owner whether anything is missing or should move in or out of scope.

**A:** No — the out-of-scope list is confirmed as-is; nothing missing or mis-scoped. The owner also accepted folding in the safe-output-escaping requirement and leaving the design-deferred details (exact JSON structure/field names, octave-shift magnitude range, note-name case handling, render output formatting) to the design phase, and directed switching the run to autonomous mode from here.

## Research

_Findings from reading the issue-#1 scaffold on the pipeline branch (base `trunk` @ `8c75ec1`). Sources are files in this repo._

- **The block is a dynamic, no-`save` block.** `src/index.js` calls `registerBlockType( metadata.name, { edit: Edit } )` with no `save`, and `src/block.json` declares `"render": "file:./render.php"`. Front-end markup is produced by `render.php` at render time, not stored in post content.
- **`src/block.json` currently declares no `attributes`.** Issue #2 introduces the first one (`song`). For a dynamic block with no `save`, attribute values serialize as JSON into the block's HTML-comment delimiter (e.g. `<!-- wp:piano-block/piano {"song":{…}} -->`), so an object-typed `song` attribute persists there without any `save` markup.
- **`render.php` already receives `$attributes` (array), `$content`, `$block`.** Today it prints a placeholder `<p>`. It can read `$attributes['song']` and output it stringified. Output escaping matters because stored data is echoed to the front end.
- **`src/edit.js` renders only a placeholder paragraph** via `useBlockProps()` — no controls. Authoring UI is out of scope for this issue.
- **Environment / build:** plugin requires WP 6.9+ and PHP 7.4+ (`piano-block.php`); the block is registered from the compiled `build/` directory built with `@wordpress/scripts` (`npm run build`). `block.json` uses `apiVersion: 3`. Lint is Biome; source lives under `src/`.

## Out of Scope

_Confirmed by the owner (Q9): nothing missing or mis-scoped._

- Rich / visual notation authoring UI — anything beyond the single raw-JSON field, which is the only authoring affordance in v1.
- Audio playback / sound generation.
- Front-end notation rendering (drawing staves/notes); `render.php` only outputs the stored content as text.
- Render-time validation or guarding — the front end does not validate; it outputs whatever is stored (escaped).
- Blocking persistence of invalid input — the editor does not prevent saving non-conformant input; validation errors are informational only (Q8).
- Musical-timing validation — measure-filling (events summing to the time signature) and right/left-hand time-alignment; deferred, the author is responsible for timing in v1 (Q7).
- Richer notation elements — articulations, ornaments, pedal, fingering, tuplets, voltas, polyphony / multiple voices per hand, lyrics, etc. (additive future work).
- Schema `version` field and migrations — the format grows additively via optional fields instead.
- Import / export of standard notation formats (MusicXML / ABC / MIDI).
- Performance optimization for very large songs.

## Consolidated Requirements

1. The Piano block stores a complete piano song in a single block attribute named `song`, persisted with the block (consistent with the existing dynamic / no-`save` block, whose attributes serialize into the block delimiter).
2. The song is a custom, dependency-free JSON document — no external notation format (MusicXML / ABC / MIDI), no music libraries, no nested innerBlocks.
3. The format models a grand staff: a right-hand part and a left-hand part that can be expressed time-aligned.
4. The format must be able to represent, in v1:
   1. Notes and rests with durations (whole, half, quarter, eighth, sixteenth, thirty-second) and dotted durations.
   2. Pitch as a note name + octave, with a per-note accidental (double-flat … double-sharp).
   3. Chords (several pitches sounding together in one event).
   4. Note names in both English letters (C–B) and Spanish solfège (do–si), accepted and treated as equivalent, and mixable within a song.
   5. Per-hand context: clef (treble / bass / alto / tenor), per-hand default accidentals (an "alter" applied to a note name), and a per-hand octave-shift marking (ottava, e.g. 8va / 8vb).
   6. Mid-song changes to tempo, clef, time signature, per-hand default accidentals, and per-hand octave-shift.
   7. Time signature (beats + beat unit) and tempo (bpm + beat unit).
   8. Dynamics (pp … sfz), chord symbols (text), ties and slurs (start / stop), and barlines including repeats.
   9. Song metadata: title and composer.
5. The format starts minimal and grows additively: no schema `version` field; new capabilities arrive as optional fields.
6. The format must not preclude future audio playback — it retains pitch, octave, duration, and tempo precision (e.g. the octave-shift marking combines deterministically with the written octave to yield a concrete sounding pitch).
7. The editor provides a minimal raw-JSON input (e.g. a textarea / code field) that lets an author paste or edit the song JSON directly.
8. The editor validates the entered JSON for full structural / field conformance to the song format — required fields present, values drawn from the allowed sets (durations, clefs, dynamics, note names, barlines, …), correct types and nesting (the kind a JSON Schema expresses) — and surfaces a clear error when the input is non-conformant.
9. Editor validation is informational only and does not block persistence: the author's raw input is stored in `song` even when it is non-conformant.
10. A freshly inserted block has no song — `song` starts empty and the editor field is blank; the front end outputs nothing meaningful until a song is entered. Conformance validation applies to non-empty input.
11. The front end (`render.php`) outputs the stored song content serialized as a string; it performs no validation and makes no well-formedness guarantee — it simply outputs whatever is stored.
12. The front-end output must be safely escaped (the stored content is arbitrary author input), so rendering cannot introduce unsafe markup / XSS.
13. The block remains a dynamic block (`save: null`, server-rendered via `render.php`) and builds on the issue-#1 plugin scaffold (WP 6.9+, PHP 7.4+, `@wordpress/scripts` build, `apiVersion` 3, Biome lint, source under `src/`).

_Left to the design phase (not requirements): the exact JSON structure and field names; how the `song` attribute is typed/represented so it can hold raw (possibly non-conformant) input; the octave-shift magnitude range; note-name case handling / normalization; and the render output formatting (compact vs pretty) and wrapping element._
