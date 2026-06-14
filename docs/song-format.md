# Song JSON format reference

This is the canonical reference for the Piano block's **song format** — the custom JSON document you write to describe a piano song. It covers the full structure, every field, the allowed values and ranges, the two note-name systems, the inheritance rules, and a complete annotated example you can copy and adapt.

## Intro and mental model

A song is a custom, dependency-free JSON document owned by this plugin. It is **not** MusicXML, ABC, or MIDI — it is its own small format, designed to model a **grand staff**: a right-hand part and a left-hand part read together. The JSON you write is the *content* stored in the block's `song` attribute (a single text string).

The block has a **visual editor** — the default authoring surface, where you navigate and select the song through a structure tree beside the canvas and edit settings in the block sidebar; the canvas displays the song and highlights the current selection — and **raw JSON** is also available as an alternative, by typing or pasting the JSON directly into the block's raw-JSON field. Both modes produce the **same song**, and this document is the reference for the **format** they produce; what you read here applies whichever mode you author in. There is no audio playback yet; that is still future work. The published **front end** renders the song as visual notation: a braced grand staff drawn as an SVG. This document describes only what the format supports today. For the end-to-end editor workflow (inserting the block, entering a song, what validation does, and what the front end shows), see [Using the Piano block](../README.md#using-the-piano-block) in the README — its [What the front end shows](../README.md#4-what-the-front-end-shows) section describes the rendered notation.

## Top-level shape

A song is a single JSON object:

```
song := { metadata?, defaults?, language?, sections }
```

- **`sections`** — the only **required** member. An array of section objects; the song's musical content lives here.
- **`metadata`** — optional bibliographic data (title, composer).
- **`defaults`** — optional song-wide context that every section inherits.
- **`language`** — optional; the note-name system (`"spanish"` or `"english"`) the song is written in (see [`language`](#language)).

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

## `language`

Optional. It records the **note-name system the song is written in** — `"spanish"` or `"english"` (these exact strings, *not* the ISO codes `es`/`en`). It is the song-level twin of the two [note-name systems](#note-name-systems-english-and-spanish-and-case) you may use for an individual `pitch.step`.

```json
{
  "language": "spanish",
  "sections": [ { "measures": [] } ]
}
```

- **Optional and additive.** Absent is valid — it is one of the format's optional fields (see [Additive growth](#additive-growth-no-version-field)). An older song that omits it stays conformant.
- **What it means.** It is used by the **visual editor** to display note names in the chosen system and to **convert** every note name when you switch systems. The README's [Note names](../README.md#2-build-the-song-in-the-visual-editor) describes that selector. The C↔do equivalence itself is the [note-name systems](#note-name-systems-english-and-spanish-and-case) table; this field just names which side the song is on.
- **Front end does not consume it yet.** The published front end **ignores `language`** — a page renders a song's notes exactly as before regardless of this field, and storing or changing it changes **nothing** about the rendered notation. Consuming it on the front end is future work.
- **Stored, round-trips, and validates.** It is stored verbatim in the `song` JSON and survives raw-JSON editing unchanged. Validation accepts the two values `"spanish"` and `"english"`; an out-of-vocabulary value is flagged informationally only and, like all raw-JSON validation, **never blocks saving** (see [Additive growth](#additive-growth-no-version-field) for the closed-enum rule and the never-blocking stance).

## `defaults` and `sections` — the constant-context model

A **section** is a run of music over which the musical context — tempo, time signature, and each hand's clef, default accidentals, and octave shift — stays **constant**. When any of those change, you start a **new section**.

`defaults` holds the song-wide context that every section inherits. A section overrides only the fields that change relative to `defaults`; everything else is inherited. A section with no overrides simply uses `defaults`.

```
section := {
  name?,             // optional editor-side label; see "name"
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
  name?,          // optional editor-side label; see "name"
  rightHand?,     // array of event objects — the right-hand part for this bar
  leftHand?,      // array of event objects — the left-hand part for this bar
  barlineStart?,  // enum (see "Barlines and repeats") — absent means a regular barline
  barlineEnd?,    // enum (see "Barlines and repeats") — absent means a regular barline
  annotations?          // array of standalone annotation objects (see "Notes (annotations)") — measure-level text
}
```

`rightHand` and `leftHand` are arrays of **events** (see below) — the two hands sounding over the same bar. Both are optional, so a measure may carry only one hand, or even none.

`annotations` is an optional array of **standalone annotations** — free-text annotations placed directly on the bar rather than tied to a single event (for example a tempo word like `"rit."`). It is the standalone half of the `annotations` capability described in [Notes (annotations)](#annotations); a standalone annotation names its own `staff` and may carry an optional `beat` anchor. Absent, or `annotations: []`, means the measure has no measure-level annotations.

**Timing is your responsibility.** The two hands need **not** be time-aligned, and a measure's events need **not** add up to its time signature. There is no musical-timing validation: a bar where the events do not "add up," or where the hands have different total lengths, is still accepted. The format checks structure and field values, not rhythm.

## `name`

Optional. A free-text label a **section** or **measure** may carry. It is the editor-side counterpart of the positional labels the visual editor shows for the song's structure.

```json
{
  "sections": [
    {
      "name": "Verse",
      "measures": [ { "name": "Pickup", "rightHand": [] } ]
    }
  ]
}
```

- **Optional and additive.** Absent is valid — it is one of the format's optional fields (see [Additive growth](#additive-growth-no-version-field)). An older song that omits it stays conformant.
- **What it means.** It is a free-text label the **visual editor** shows in the structure tree for that section or measure. When it is unset, the tree falls back to a positional label (`Section 1`, `Measure 1`). You edit it from the **Section / Measure** inspector panel; the README's [Using the Piano block](../README.md#2-build-the-song-in-the-visual-editor) describes that affordance. It is purely a label — it has no musical meaning.
- **Front end does not consume it yet.** The published front end **ignores `name`** — a page renders the song exactly as before regardless of this field, and storing or changing it changes **nothing** about the rendered notation. Consuming it on the front end is future work.
- **Stored, round-trips, and validates.** It is stored verbatim in the `song` JSON and survives raw-JSON editing unchanged. Validation accepts a string `name`; a non-string value is a type error, but like all raw-JSON validation it is flagged informationally only and, like every check, **never blocks saving** (see [Additive growth](#additive-growth-no-version-field) for the never-blocking stance).

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

  **Placement.** A **positive** shift (8va/15ma) draws its dashed bracket **above the staff of the hand it is set on** — above the right-hand (treble) staff for a right-hand shift, above the left-hand (bass) staff for a left-hand shift — while a **negative** shift (8vb/15mb) draws its bracket **below that hand's staff**. The bracket is restated on every line the shifted passage spans.

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
  arpeggio?,      // enum: up | down | nondirectional — rolled-chord wavy line
  annotations?,         // array of per-event annotation objects (see "Notes (annotations)") — { text, placement }
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
- **`arpeggio`** — an optional per-chord rolled-chord marking, one of `up | down | nondirectional`. It marks the chord on this event to be rolled (its notes sounded bottom-to-top or top-to-bottom rather than struck together), drawn as a wavy line beside the chord. There is **no "off" value**: **absence means the chord is not arpeggiated**. See [Arpeggios (rolled chords)](#arpeggios-rolled-chords) for the full reference.
- **`annotations`** — an optional array of **per-event annotations**: free-text annotations attached to this event, each `{ "text": …, "placement": "above" | "below" }`. They render in the same horizontal column as this event, on the staff of the hand whose array this event lives in. See [Notes (annotations)](#annotations) for the full field reference; per-event annotations are the per-event half of the `annotations` capability. Both a note event and a rest event may carry `annotations`. Absent, or `annotations: []`, means the event has no annotations.
- **`tie`** and **`slur`** — event-level `start | stop` markers.
- **`crescendo`** and **`decrescendo`** — event-level `start | stop` markers for a gradual-dynamic span (a crescendo grows louder, a decrescendo grows softer). You put `"start"` on the note where the span begins and `"stop"` on the note where it ends. **The direction is intrinsic to which field you use:** a crescendo and a decrescendo are two distinct markings, and the direction is never inferred from the surrounding `dynamic` values — to write a decrescendo you mark `decrescendo`, regardless of whether any point dynamics happen to fall around it.
  - **A span is independent of, and additive to, the per-note `dynamic`.** The `dynamic` field places a fixed point dynamic on a single note; a crescendo/decrescendo span describes a gradual change over a run of notes. The two are unrelated mechanisms: a point dynamic may sit at a span's start, at its end, at both, or at neither, and **no point dynamic is required** for a span. For example, a span may begin at a `"p"` note and end at an `"f"` note, or carry no point dynamics at all.
  - **The two fields are independent, and a single note may carry both at once.** Marking `crescendo: "stop"` and `decrescendo: "start"` on the same note expresses a *messa-di-voce hinge*: a crescendo span ends and a decrescendo span begins on that shared note, so the music swells and then recedes (`<>`) across the two adjacent spans.

```json
{ "type": "note", "duration": "half", "dots": 1, "dynamic": "mf",
  "annotations": [{ "text": "C", "placement": "above" }], "slur": "start", "tie": "start",
  "pitches": [
    { "step": "C", "octave": 5 },
    { "step": "E", "octave": 5 },
    { "step": "G", "octave": 5 }
  ] }
```

```json
{ "type": "rest", "duration": "quarter" }
```

A rest may carry `annotations` too — for example a `"pedal"` annotation below the staff:

```json
{ "type": "rest", "duration": "quarter",
  "annotations": [{ "text": "pedal", "placement": "below" }] }
```

## Annotations

An **annotation** is free text drawn around the staves — a chord symbol like `"Gm7"`, the word `"pedal"`, a tempo word like `"rit."`, a rehearsal label, a fingering hint. It is the format's one piece of **open vocabulary**: every other enumerated field is a closed set, but an annotation's `text` is whatever you type, rendered **verbatim**.

`annotations` is **one concept with two attachment modes** — they share the `annotations` key and the `text` + `placement` fields, and differ only in where they attach and what extra fields they carry:

- **Per-event annotations** live on an **event** (`event.annotations`, in a measure's `rightHand`/`leftHand` array). The annotation inherits its event's staff (the hand whose array the event lives in) and its horizontal column, so it lines up directly above or below that event's notehead. A per-event annotation carries only `text` and `placement` — there is no `staff` or `beat` field, because both are implied by the host event.
- **Standalone annotations** live on a **measure** (`measure.annotations`). They are not tied to any single event, so they must name their own `staff`, and may carry an optional `beat` to set their horizontal position within the bar.

Together the two modes can reach all **four grand-staff positions** — above and below each of the two staves:

| Position | Per-event mode (event in…) | Standalone mode (`staff` + `placement`) |
| --- | --- | --- |
| Above the right-hand staff | `rightHand` event, `placement: "above"` | `{ "staff": "rightHand", "placement": "above" }` |
| Below the right-hand staff (the inter-staff gap) | `rightHand` event, `placement: "below"` | `{ "staff": "rightHand", "placement": "below" }` |
| Above the left-hand staff (the inter-staff gap) | `leftHand` event, `placement: "above"` | `{ "staff": "leftHand", "placement": "above" }` |
| Below the left-hand staff | `leftHand` event, `placement: "below"` | `{ "staff": "leftHand", "placement": "below" }` |

The two middle rows both land in the gap **between** the staves — below the right hand and above the left hand share that band — but they remain distinct because each note keeps its own staff. There is no separate "between staves" / centered placement value; you reach the gap with `rightHand` + `below` or `leftHand` + `above`.

### Per-event annotation shape

```
eventAnnotation := {
  text,        // required — free text (any string; "" is valid and renders nothing)
  placement    // required — enum: above | below   (no default)
}
```

- **`text`** (required) — any string. An **empty string `""` is valid**; it simply renders nothing. The text renders **verbatim** — `"Gm7"` draws the literal characters `Gm7`. There is no default; the field must be present.
- **`placement`** (required) — `"above"` or `"below"`, a closed enum. There is **no default**: omitting `placement`, or using any other value, is a conformance error.
- The note's **staff is implicit** — it is the hand whose array the event lives in (an event in `rightHand` annotates the right-hand staff, an event in `leftHand` the left). Do not add a `staff` field to a per-event annotation; if you do, it is silently ignored (an unknown key), not honored.
- The note aligns **horizontally** with its event — it sits in the same column as that event's notehead.

```json
{ "type": "note", "duration": "quarter",
  "pitches": [ { "step": "C", "octave": 4 } ],
  "annotations": [
    { "text": "Cmaj7", "placement": "above" },
    { "text": "1",     "placement": "below" }
  ] }
```

That event carries two per-event annotations: a chord symbol above its staff and a fingering below it, both aligned to the same notehead.

### Standalone annotation shape

```
standaloneAnnotation := {
  text,        // required — free text (any string; "" is valid and renders nothing)
  placement,   // required — enum: above | below   (no default)
  staff,       // required — enum: rightHand | leftHand   (no default)
  beat?        // optional — number >= 0 (quarter-beats); horizontal anchor within the bar
}
```

- **`text`** and **`placement`** behave exactly as in the per-event shape above (required; `""` valid; verbatim; `placement` is `above | below` with no default).
- **`staff`** (required) — `"rightHand"` or `"leftHand"`, a closed enum. Because a standalone annotation is not tied to an event, it has no hand to inherit from, so it **must** say which staff it belongs to. There is no default: omitting `staff`, or using any other value, is a conformance error.
- **`beat`** (optional) — a number **≥ 0** giving the note's horizontal anchor within the bar, measured in **quarter-beats** (a quarter note = `1`, an eighth = `0.5`; a quarter-beat is the same unit the format uses for event durations). Fractional values such as `0.5` are allowed. A **negative `beat` is a conformance error**. When `beat` is **absent**, the note anchors **near the measure's left edge** (equivalent to `beat: 0`); a **larger `beat` moves it rightward**. There is no musical-timing check: a `beat` larger than the bar's actual content (for example `99`) is still valid and is drawn best-effort near the bar's right edge.

```json
{
  "barlineEnd": "regular",
  "rightHand": [
    { "type": "note", "duration": "whole", "pitches": [ { "step": "G", "octave": 4 } ] }
  ],
  "annotations": [
    { "text": "rit.", "placement": "above", "staff": "rightHand" },
    { "text": "ped.", "placement": "below", "staff": "leftHand", "beat": 2 }
  ]
}
```

That measure carries two standalone annotations: `"rit."` above the right-hand staff anchored at the bar's left edge (no `beat`), and `"ped."` below the left-hand staff anchored two quarter-beats in.

### Optional on both, empty arrays allowed

`annotations` is **optional** on both events and measures. Both an **absent** `annotations` and an explicit **empty array `annotations: []`** are valid and mean "no annotations here." You can mix the two modes freely: a single measure may carry both per-event annotations (on its events) and standalone annotations (on the measure), and they all render.

### Migrating a legacy `chordSymbol`

Older songs used a per-event `chordSymbol` string for the chord-symbol-above-the-staff case; that field is gone, replaced by `annotations`. Rewrite each `"chordSymbol": "C"` as a per-event annotation `"annotations": [{ "text": "C", "placement": "above" }]`. A leftover `chordSymbol` is still **valid** — it is an unknown key, so it is silently ignored — but it **no longer renders**, and nothing rewrites it for you: the migration is manual.

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

## Arpeggios (rolled chords)

An **arpeggio** is a *rolled chord* — instead of striking the chord's notes together, you sound them one after another, from the bottom up or the top down. The per-event [`arpeggio`](#events) field marks the chord on that event as rolled and chooses the roll's direction. It is an **optional per-chord marking**: a single value on one note event, not a span across notes (the way `crescendo`/`decrescendo` are), and **absence means the chord is not arpeggiated** — there is no "off" value.

An arpeggio is **independent of every other marking** on its event. A chord may carry an `arpeggio` together with a `dynamic`, a `tie` or `slur`, augmentation `dots`, a `crescendo`/`decrescendo`, and `annotations`, all at once; the arpeggio neither suppresses nor is suppressed by any of them.

**The three values and what they draw:**

- **`up`** — the chord rolls **bottom-to-top** (lowest note first). The wavy line carries an **arrowhead at its top** end.
- **`down`** — the chord rolls **top-to-bottom** (highest note first). The wavy line carries an **arrowhead at its bottom** end.
- **`nondirectional`** — a **plain wavy line with no arrowhead**: a rolled chord whose direction is left unspecified.

The roll direction is intrinsic to the value you choose; it is never inferred from anything else on the event.

**Rendered form and placement.** The arpeggio draws as a **vertical wavy line to the left of the chord's noteheads**, running its **full vertical extent — from the lowest notehead up to the highest**. It is placed **outside any accidentals** (clear to the left of them, never crossing an accidental glyph) and clear of the stem, so the wavy line sits in its own column at the left edge of the chord. A directional value adds the arrowhead at the corresponding end (top for `up`, bottom for `down`); `nondirectional` adds none.

**Single-pitch chords.** An `arpeggio` on a one-note event is **accepted, not an error**. With only one notehead there is no vertical span to roll across, so the wavy line is drawn **short** (a minimal wiggle beside that single notehead). Any directional value still adds its arrowhead.

**Tall chords.** The wavy line **always spans the full height of the chord**, from its lowest to its highest notehead. A chord stretched across many staff steps simply gets a taller wavy line; there is no cap on how far it extends.

**Rests.** An `arpeggio` may be **set on a rest event and is accepted**, but a rest has no chord to roll, so it has **no rendered effect** — nothing is drawn for it. The value is still stored and round-trips; it simply does not draw.

**Notation only — no sound.** Like every marking in this format, an arpeggio is visual notation; it has **no effect on how the song sounds**. There is no audio engine in the block, and the marking carries no playback behavior — it only draws the wavy line.

**Stored, round-trips, and validates.** An `arpeggio` is stored verbatim in the `song` JSON and survives raw-JSON editing unchanged. Validation accepts the three values `"up"`, `"down"`, and `"nondirectional"`; an out-of-vocabulary value such as `"sideways"` is flagged informationally only and, like all raw-JSON validation, **never blocks saving** (see [Additive growth](#additive-growth-no-version-field) for the closed-enum rule and the never-blocking stance).

```json
{ "type": "note", "duration": "quarter", "arpeggio": "up", "dynamic": "mf",
  "pitches": [
    { "step": "C", "octave": 4 },
    { "step": "E", "octave": 4 },
    { "step": "G", "octave": 4 }
  ] }
```

That event is a rolled C-major chord sounded bottom-to-top (arrowhead at the top), carrying a separate `mf` dynamic alongside the arpeggio to show the two markings are independent.

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

The format **has no `version` field**. It starts minimal and grows by adding **optional** fields to existing objects. A song you write today stays valid as the format grows, because new fields are optional and older songs simply omit them. The song-level [`language`](#language) field and the section/measure [`name`](#name) label are the latest such additive options — a song that omits either is still conformant, and the front end reads neither.

Three consequences you can observe as an author:

- **Unknown fields are ignored.** A misspelled *optional* field — for example `dynmic` instead of `dynamic`, or `cresendo` instead of `crescendo` — is silently dropped from meaning, not flagged as an error. The value you typed is still stored, but it carries no meaning. (Double-check your spelling of optional fields; a typo will not warn you.) This is why an older song that uses no gradual dynamics stays valid and unchanged as new optional fields like `crescendo` and `decrescendo` are added: the song simply omits them.
- **A misspelled enumerated value *is* an error.** The closed vocabularies — durations, clefs, dynamics, barlines, `tie`/`slur`, `crescendo`/`decrescendo`, event `type`, `beatType` — are checked strictly. A value like `"quaver"` for a duration, `"treble-clef"` for a clef, `"mezzo"` for a dynamic, or anything other than `"start"` or `"stop"` for `crescendo` or `decrescendo` is a conformance error.
- **Span pairing is not checked.** The start/stop markers that open and close a span — `tie`, `slur`, `crescendo`, and `decrescendo` — are validated only as individual `start | stop` values; their *pairing* is not. A lone `"start"` with no matching `"stop"` (or the reverse) is **not** a conformance error: the song still validates. Pairing is resolved best-effort at render time, so a dangling marker is simply drawn as far as it can be, never rejected.

## Annotated example song

The following is a **complete, copy-pasteable example** — valid song JSON (no comments) you can paste straight into the block's song field and adapt.

It exercises a broad spread of elements: notes and rests in both hands, a three-pitch chord, a dotted duration, a per-note accidental, mixed English and Spanish note names, per-hand clef / default accidentals / octave shift, a Section 2 mid-song tempo / time-signature / clef / accidental change, dynamics, free-text annotations (a per-event chord symbol above and a fingering below, plus a standalone `"rit."` on a measure), a tie, a crescendo span and a separate decrescendo span that meet on a shared messa-di-voce hinge note (carrying both `crescendo: "stop"` and `decrescendo: "start"`), repeat and final barlines, and title/composer metadata.

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
              "annotations": [
                { "text": "C", "placement": "above" },
                { "text": "1", "placement": "below" }
              ],
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
          "annotations": [
            { "text": "rit.", "placement": "above", "staff": "rightHand" }
          ],
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
