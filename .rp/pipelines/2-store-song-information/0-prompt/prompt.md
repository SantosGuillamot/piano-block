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

