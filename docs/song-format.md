# Song JSON format reference

This is the canonical reference for the Piano block's **song format** — the custom JSON document you write to describe a piano song. It covers the full structure, every field, the allowed values and ranges, the two note-name systems, the inheritance rules, and a complete annotated example you can copy and adapt.

## Intro and mental model

A song is a custom, dependency-free JSON document owned by this plugin. It is **not** MusicXML, ABC, or MIDI — it is its own small format, designed to model a **grand staff**: a right-hand part and a left-hand part read together. The JSON you write is the *content* stored in the block's `song` attribute (a single text string).

In v1 you author a song **by hand**, by typing or pasting the JSON directly into the block's raw-JSON field in the editor. There is no visual notation *editor* yet — authoring is still raw JSON by hand — and no audio playback; those are future work. The published **front end**, however, now renders the song as visual notation: a braced grand staff drawn as an SVG. This document describes only what the format supports today. For the end-to-end editor workflow (inserting the block, entering a song, what validation does, and what the front end shows), see [Using the Piano block](../README.md#using-the-piano-block) in the README — its [What the front end shows](../README.md#4-what-the-front-end-shows) section describes the rendered notation.

## Top-level shape

A song is a single JSON object:

```
song := { metadata?, defaults?, sections }
```

- **`sections`** — the only **required** member. An array of section objects; the song's musical content lives here.
- **`metadata`** — optional bibliographic data (title, composer).
- **`defaults`** — optional song-wide context that every section inherits.

The smallest valid song has just an empty section with no measures:

```json
{ "sections": [ { "measures": [] } ] }
```

This **minimal conformant song** is a real, present song document (it just has no music in it yet). It is different from the **empty state** — *no song at all* — which is the field being blank (an empty string `""`). An empty string is not a song document; it is the "no song yet" state, and it is never validated.

## `metadata`

Optional bibliographic data. Both fields are optional free-text strings:

| Field | Type | Notes |
| --- | --- | --- |
| `title` | string | The song's title. |
| `composer` | string | The composer / author. |

```json
{
  "metadata": { "title": "Example", "composer": "A. Composer" },
  "sections": [ { "measures": [] } ]
}
```

## `defaults` and `sections` — the constant-context model

A **section** is a run of music over which the musical context — tempo, time signature, and each hand's clef, default accidentals, and octave shift — stays **constant**. When any of those change, you start a **new section**.

`defaults` holds the song-wide context that every section inherits. A section overrides only the fields that change relative to `defaults`; everything else is inherited. A section with no overrides simply uses `defaults`.

```
section := {
  tempo?,            // overrides defaults.tempo for this section
  timeSignature?,    // overrides defaults.timeSignature
  rightHand?,        // handConfig — overrides defaults.rightHand
  leftHand?,         // handConfig — overrides defaults.leftHand
  measures           // required — array of measure objects
}
```

`measures` is the only required member of a section.

**Mid-song changes are expressed by starting a new section.** There is no inline "change event." To change the tempo, the time signature, a clef, the default accidentals, or the octave shift partway through the song, you begin a new section that sets the changed field(s) — for example, "change only the left-hand clef from bar 9" is a new section whose `leftHand` is `{ "clef": "tenor" }`, with everything else inherited. Clefs, key/accidental context, and time signatures are section-scoped by nature, so they live on the section, never on individual notes.

## `measures` — the grand-staff pairing

A **measure** is one bar. It pairs the two hands' event streams and carries optional barlines:

```
measure := {
  rightHand?,     // array of event objects — the right-hand part for this bar
  leftHand?,      // array of event objects — the left-hand part for this bar
  barlineStart?,  // enum (see "Barlines and repeats") — absent means a regular barline
  barlineEnd?     // enum (see "Barlines and repeats") — absent means a regular barline
}
```

`rightHand` and `leftHand` are arrays of **events** (see below) — the two hands sounding over the same bar. Both are optional, so a measure may carry only one hand, or even none.

**Timing is your responsibility.** The two hands need **not** be time-aligned, and a measure's events need **not** add up to its time signature. There is no musical-timing validation: a bar where the events do not "add up," or where the hands have different total lengths, is still accepted. The format checks structure and field values, not rhythm.

## `tempo` and `timeSignature`

These live in `defaults` and may be overridden per section.

```
tempo := { bpm, beatUnit? }
  bpm       : number greater than 0   (beats per minute; required when tempo is present)
  beatUnit? : a duration word         (the note value the bpm counts — e.g. quarter)

timeSignature := { beats, beatType }
  beats    : integer >= 1                   (the upper numeral)
  beatType : integer, one of {1,2,4,8,16,32} (the lower numeral / denominator)
```

- `tempo.bpm` is **required** whenever `tempo` is present, and must be a number **greater than 0**.
- `tempo.beatUnit` is optional; it is one of the duration words `whole | half | quarter | eighth | sixteenth | thirty-second` (the same set used for an event's `duration`).
- `timeSignature.beats` and `timeSignature.beatType` are **both required** whenever `timeSignature` is present.

**A deliberate asymmetry — do not "correct" it.** The tempo's `beatUnit` is a **duration word** (`"quarter"`), because a metronome mark names a note value ("♩ = 120"). The time signature's `beatType` is a **number** (`4`), because notation writes "4/4" with a numeric bottom. Both are correct domain conventions; they are intentionally different.

```json
{
  "defaults": {
    "tempo": { "bpm": 120, "beatUnit": "quarter" },
    "timeSignature": { "beats": 4, "beatType": 4 }
  },
  "sections": [ { "measures": [] } ]
}
```

## Per-hand context (`handConfig`)

One object shape, **`handConfig`**, expresses a hand's context. It is used in four positions: `defaults.rightHand`, `defaults.leftHand`, `section.rightHand`, and `section.leftHand`. All three fields are optional:

```
handConfig := {
  clef?,         // enum: treble | bass | alto | tenor
  alters?,       // map: note name -> integer alteration (-2..+2) — per-hand default accidentals
  octaveShift?   // signed integer (-2..+2) — the ottava marking
}
```

- **`clef`** — a closed enum: `treble`, `bass`, `alto`, `tenor`.
- **`alters`** — the per-hand **default accidentals**, a key-signature-like mechanism: "every named note in this hand/section is altered by this amount, unless a per-note `alter` overrides it." Keys are note names (English or Spanish, case-insensitive — see "Note-name systems"); values are integer alterations in **−2..+2** (double-flat … double-sharp). For example `{ "F": 1 }` means every F sounds sharp without a per-note mark.
- **`octaveShift`** — the per-hand **ottava marking** ("play an octave higher/lower"), as a signed integer count of octaves in **−2..+2**:
  - `+1` = 8va (one octave up), `−1` = 8vb (one octave down)
  - `+2` = 15ma (two octaves up), `−2` = 15mb (two octaves down)
  - `0` or absent = no shift

### Inheritance and override rules

- **Each field inherits independently.** A section that sets only `clef` keeps the inherited `alters` and `octaveShift`. Each of `clef`, `alters`, and `octaveShift` resolves to the section value if present, otherwise the `defaults` value, otherwise the documented fallback below.
- **But the `alters` map replaces wholesale.** When a section provides `alters`, that map is the section's **complete** set of default accidentals — it is *not* merged key-by-key with `defaults.alters`. This mirrors a key change, which supersedes the prior key signature entirely. To clear the inherited defaults for a section (have no default accidentals), set `"alters": {}` explicitly.
- **Fallbacks** (none of these fields is required): `clef` absent → no forced default; `alters` absent → no default accidentals; `octaveShift` absent → `0`.

```json
{
  "defaults": {
    "rightHand": { "clef": "treble" },
    "leftHand":  { "clef": "bass", "alters": { "B": -1 } }
  },
  "sections": [
    {
      "rightHand": { "alters": { "F": 1 } },
      "measures": []
    }
  ]
}
```

In that section the right hand's `clef` is still `treble` (inherited), while its `alters` is exactly `{ "F": 1 }` (replaced, not merged).

## Events

Each hand array (`measure.rightHand[]`, `measure.leftHand[]`) is a list of **event** objects — the time-bearing leaves of the format:

```
event := {
  type,           // required — enum: note | rest
  duration,       // required — enum: whole | half | quarter | eighth | sixteenth | thirty-second
  dots?,          // integer 0..2  (un-dotted | single dot | double dot)
  pitches?,       // array of pitch objects — required & non-empty for a note; omitted for a rest
  dynamic?,       // enum: pp | p | mp | mf | f | ff | sf | sfz
  chordSymbol?,   // free-text string (e.g. "C", "Gm7")
  tie?,           // enum: start | stop
  slur?,          // enum: start | stop
  crescendo?,     // enum: start | stop
  decrescendo?    // enum: start | stop
}
```

- **`type`** (required) — `note` or `rest`.
- **`duration`** (required) — one of `whole | half | quarter | eighth | sixteenth | thirty-second`.
- **`dots`** — an integer **0..2**: `0`/absent for un-dotted, `1` for a single dot, `2` for a double dot.
- **`pitches`** — an array of pitch objects. This is **the one conditional in the format**: a `note` **must** carry a non-empty `pitches` array; a `rest` omits it. A **chord** is simply several pitches in one event; a single note is a one-element `pitches`.
- **`dynamic`** — one of `pp | p | mp | mf | f | ff | sf | sfz`.
- **`chordSymbol`** — **free text** (an open vocabulary — the deliberate exception to the format's otherwise-closed enums), for example `"C"` or `"Gm7"`.
- **`tie`** and **`slur`** — event-level `start | stop` markers.
- **`crescendo`** and **`decrescendo`** — event-level `start | stop` markers for a gradual-dynamic span (a crescendo grows louder, a decrescendo grows softer). You put `"start"` on the note where the span begins and `"stop"` on the note where it ends. **The direction is intrinsic to which field you use:** a crescendo and a decrescendo are two distinct markings, and the direction is never inferred from the surrounding `dynamic` values — to write a decrescendo you mark `decrescendo`, regardless of whether any point dynamics happen to fall around it.
  - **A span is independent of, and additive to, the per-note `dynamic`.** The `dynamic` field places a fixed point dynamic on a single note; a crescendo/decrescendo span describes a gradual change over a run of notes. The two are unrelated mechanisms: a point dynamic may sit at a span's start, at its end, at both, or at neither, and **no point dynamic is required** for a span. For example, a span may begin at a `"p"` note and end at an `"f"` note, or carry no point dynamics at all.
  - **The two fields are independent, and a single note may carry both at once.** Marking `crescendo: "stop"` and `decrescendo: "start"` on the same note expresses a *messa-di-voce hinge*: a crescendo span ends and a decrescendo span begins on that shared note, so the music swells and then recedes (`<>`) across the two adjacent spans.

```json
{ "type": "note", "duration": "half", "dots": 1, "dynamic": "mf",
  "chordSymbol": "C", "slur": "start", "tie": "start",
  "pitches": [
    { "step": "C", "octave": 5 },
    { "step": "E", "octave": 5 },
    { "step": "G", "octave": 5 }
  ] }
```

```json
{ "type": "rest", "duration": "quarter" }
```

## Gradual dynamics (crescendo and decrescendo spans)

The per-note `dynamic` is a **point dynamic** — a single fixed level on one note. A **gradual-dynamic span** is the other kind of loudness marking: a change that unfolds *across a run of notes*. A **crescendo** grows louder, a **decrescendo** grows softer.

A span runs from a **start note** to a *later* **end note within a single hand** — the right-hand stream or the left-hand stream, never across the two. You author it with the `crescendo` / `decrescendo` markers from the [Events](#events) section: put `"start"` on the first note and `"stop"` on the last. Each hand is marked independently; a span in one hand has no bearing on the other.

**The rendered form is a hairpin wedge** on the grand staff: an opening wedge `<` for a crescendo and a closing wedge `>` for a decrescendo. The wedge spans horizontally from the start note's position to the end note's position, so the two directions are drawn distinctly — `<` widens toward the louder end, `>` narrows toward the softer end. If a span crosses one or more barlines within a single line of music, it is drawn as **one continuous wedge** across them, the same way a tie or slur is.

**Placement.** Each wedge is drawn **per hand, below that hand's own staff** — the same below-staff region where that hand's point dynamics already sit.

**Notation only — no sound.** Like every marking in this format, a gradual-dynamic span is visual notation; it has **no effect on how the song sounds**. There is no audio engine in the block, and the marking carries no loudness behavior — it only draws the wedge.

### What v1 does and does not do

This is what the gradual-dynamic span renders today. Be aware of these limits so you do not expect more than is drawn:

- **Hairpin form only.** Only the wedge (`<` / `>`) is drawn. The alternative `cresc.` / `dim.` text-with-a-dashed-line form is not part of this version.
- **Per-hand, below each hand's staff.** The wedge sits below the marked hand's staff. Drawing a single wedge *between* the two staves (the strict grand-staff convention) is a possible future refinement, not what is drawn today.
- **Cross-line spans draw only their first line.** If a span's start note and its end note fall on two different rendered lines (the start wraps onto one line and the end onto the next), only the portion on the **start line** is drawn; the continuation onto the next line is not drawn in this version. The marking is still accepted and never breaks the rest of the rendering — only the carried-over piece is omitted.
- **Overlapping same-kind spans are undefined.** Opening a second crescendo (or a second decrescendo) in one hand before the first has stopped is tolerated — it will not break the render — but the result is not defined, so do not rely on it. At most one span of a given kind should be open per hand at a time.
- **A single-note span is not expressible.** A span needs a start note and a *different, later* end note; a hairpin shows change *across* notes, and one note has no horizontal extent. There is no way to mark a one-note crescendo or decrescendo.

For where the rendered wedge appears in the published sheet music, see [What the front end shows](../README.md#4-what-the-front-end-shows) in the README.

## Pitches

A **pitch** is a single sounding note name with its octave and optional accidental:

```
pitch := {
  step,     // required — a note name (English letter or Spanish solfège); see "Note-name systems"
  octave,   // required — integer 0..9 (scientific-pitch-notation octave number)
  alter?    // integer -2..+2  (double-flat ... double-sharp)
}
```

- **`step`** (required) — a recognised note name (see the next section).
- **`octave`** (required) — an integer **0..9**, the scientific-pitch-notation octave number (middle C is C4).
- **`alter`** — the per-note accidental, an integer **−2..+2** (`−2` double-flat, `−1` flat, `0` natural, `+1` sharp, `+2` double-sharp). When present it **overrides** the section's `alters` default for that note name.

```json
{ "step": "F", "octave": 2, "alter": 1 }
```

## Note-name systems (English and Spanish) and case

Two equivalent note-name systems are accepted, and you may **mix them within one song**:

- **English letters:** `C  D  E  F  G  A  B`
- **Spanish solfège:** `do  re  mi  fa  sol  la  si`

The equivalence is:

| English | C | D | E | F | G | A | B |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Spanish | do | re | mi | fa | sol | la | si |

No Spanish word collides with an English letter, so accepting both is unambiguous.

**Case is ignored.** Note names are accepted **case-insensitively**: `C` and `c`, or `do`, `Do`, and `DO`, are all valid and equivalent. The same case-insensitive rule applies to `alters` map keys. The **recommended canonical spellings** are **uppercase English** (`C`, `F`) and **lowercase solfège** (`do`, `sol`); other casing is accepted, but the canonical form reads best.

Whatever you type is **stored verbatim** — the format never rewrites your text. Case-insensitivity governs only whether a name is *recognised*, not how it is stored.

A name outside the two vocabularies — for example `"H"` or `"doh"` — is a conformance error.

## Barlines and repeats

Barlines delimit **measures**, so they live on the `measure` object as `barlineStart` and `barlineEnd`, each a closed enum:

```
barline := regular | repeat-start | repeat-end | double | final
```

Both are optional; **absent means a regular barline**. A repeated passage is `barlineStart: "repeat-start"` (`|:`) on the first measure and `barlineEnd: "repeat-end"` (`:|`) on the last. Use `final` for the closing barline of the piece and `double` for a sectional double bar.

```json
{ "barlineStart": "repeat-start", "barlineEnd": "repeat-end", "rightHand": [] }
```

## How a stored pitch resolves to a sounding pitch

This section is **forward-looking** — it describes how the stored data is *intended* to combine into a concrete sounding pitch for future audio. There is no audio in v1; this is the model, not behavior you can hear today.

- **Effective alteration** for a note = the note's own `alter` if present, otherwise the section's effective `alters` entry for that note name if present, otherwise `0` (natural). (A per-note `alter` overrides the per-hand/section default.)
- **Sounding octave** = the pitch's `octave` plus the section's effective `octaveShift`.

So a pitch's sounding result is its note name plus its effective alteration, played in the octave `octave + octaveShift`.

## Additive growth (no `version` field)

The format **has no `version` field**. It starts minimal and grows by adding **optional** fields to existing objects. A song you write today stays valid as the format grows, because new fields are optional and older songs simply omit them.

Two consequences you can observe as an author:

- **Unknown fields are ignored.** A misspelled *optional* field — for example `dynmic` instead of `dynamic` — is silently dropped from meaning, not flagged as an error. The value you typed is still stored, but it carries no meaning. (Double-check your spelling of optional fields; a typo will not warn you.)
- **A misspelled enumerated value *is* an error.** The closed vocabularies — durations, clefs, dynamics, barlines, `tie`/`slur`, event `type`, `beatType` — are checked strictly. A value like `"quaver"` for a duration, `"treble-clef"` for a clef, or `"mezzo"` for a dynamic is a conformance error.

## Annotated example song

The following is a **complete, copy-pasteable example** — valid song JSON (no comments) you can paste straight into the block's song field and adapt.

It exercises a broad spread of elements: notes and rests in both hands, a three-pitch chord, a dotted duration, a per-note accidental, mixed English and Spanish note names, per-hand clef / default accidentals / octave shift, a Section 2 mid-song tempo / time-signature / clef / accidental change, dynamics, a free-text chord symbol, a tie, a crescendo span and a separate decrescendo span that meet on a shared messa-di-voce hinge note (carrying both `crescendo: "stop"` and `decrescendo: "start"`), repeat and final barlines, and title/composer metadata.

```json
{
  "metadata": {
    "title": "Example",
    "composer": "A. Composer"
  },
  "defaults": {
    "tempo": { "bpm": 120, "beatUnit": "quarter" },
    "timeSignature": { "beats": 4, "beatType": 4 },
    "rightHand": { "clef": "treble" },
    "leftHand":  { "clef": "bass", "alters": { "B": -1 } }
  },

  "sections": [
    {
      "measures": [
        {
          "barlineStart": "repeat-start",
          "rightHand": [
            {
              "type": "note",
              "duration": "half",
              "dots": 1,
              "dynamic": "mf",
              "chordSymbol": "C",
              "tie": "start",
              "pitches": [
                { "step": "C", "octave": 5 },
                { "step": "E", "octave": 5 },
                { "step": "G", "octave": 5 }
              ]
            },
            { "type": "rest", "duration": "quarter" }
          ],
          "leftHand": [
            { "type": "note", "duration": "quarter",
              "pitches": [ { "step": "do", "octave": 3 } ] },
            { "type": "note", "duration": "quarter",
              "pitches": [ { "step": "sol", "octave": 3 } ] },
            { "type": "note", "duration": "half",
              "pitches": [ { "step": "si", "octave": 2 } ] }
          ]
        },
        {
          "barlineEnd": "repeat-end",
          "rightHand": [
            { "type": "note", "duration": "whole", "tie": "stop",
              "pitches": [ { "step": "G", "octave": 5 } ] }
          ],
          "leftHand": [
            { "type": "note", "duration": "whole",
              "pitches": [ { "step": "si", "octave": 2, "alter": 1 } ] }
          ]
        }
      ]
    },
    {
      "tempo": { "bpm": 90, "beatUnit": "quarter" },
      "timeSignature": { "beats": 3, "beatType": 4 },
      "rightHand": {
        "octaveShift": 1,
        "alters": { "F": 1, "C": 1 }
      },
      "leftHand": {
        "clef": "tenor",
        "alters": {}
      },
      "measures": [
        {
          "barlineEnd": "final",
          "rightHand": [
            { "type": "note", "duration": "quarter", "dynamic": "p",
              "crescendo": "start",
              "pitches": [ { "step": "F", "octave": 5 } ] },
            { "type": "note", "duration": "quarter",
              "crescendo": "stop", "decrescendo": "start",
              "pitches": [ { "step": "la", "octave": 5 } ] },
            { "type": "note", "duration": "quarter", "decrescendo": "stop",
              "pitches": [ { "step": "C", "octave": 6 } ] }
          ],
          "leftHand": [
            { "type": "note", "duration": "half", "dots": 1,
              "pitches": [ { "step": "C", "octave": 3 } ] }
          ]
        }
      ]
    }
  ]
}
```

Note that this song is **not** required to be timing-balanced. In Section 1's first measure the two hands happen to total four beats each in 4/4, but a song whose bars or hands did not add up would still be valid — there is no timing validation.
