# Design Doc: Store song information in the Piano block

_Technical design for GitHub issue #2 (pipeline `2-store-song-information`). Synthesizes the approved spec (`1-spec/spec.md`, requirements 1–14, AC1–AC10) and the settled design Q&A into a standalone architecture & data-model reference. This document is self-contained — it does not require the research file._

## 1. Summary

The Piano block (`piano-block/piano`) is a dynamic, server-rendered WordPress block scaffolded in issue #1 (`save: null`; front-end output produced by `src/render.php`). This feature gives it the ability to **store a complete piano song as structured data** in a single block attribute named `song`.

The work has three parts:

1. **Storage & format** — a single `song` block attribute (a `string`) and a **custom, dependency-free JSON format** owned by this project that models a grand staff (right hand + left hand) in enough detail to represent real piano scores: notes, chords, rests, durations, accidentals, clefs, time signatures, tempo, dynamics, chord symbols, ties, slurs, repeats, octave shifts, and metadata.
2. **Authoring** — a minimal raw-JSON field in the block editor that lets an author paste/edit the `song` JSON directly and **validates conformance** to the format, surfacing a clear, **non-blocking** error.
3. **Front end** — `render.php` emits the stored song content as an **escaped string**, outputting nothing when empty.

Explicitly **out of scope** (deferred to future issues): a visual notation authoring UI, audio playback, front-end notation rendering, render-time validation, blocking persistence of invalid input, musical-timing validation, richer notation elements (articulations, ornaments, pedal, fingering, tuplets, voltas, multiple voices, lyrics), a schema `version` field/migrations, and import/export of standard formats (MusicXML / ABC / MIDI). The intended v1 author is someone comfortable editing JSON directly, since the only authoring affordance is a raw-JSON field.

## 2. Architecture overview

```
                     ┌──────────────────────────── Editor (JS) ────────────────────────────┐
                     │                                                                       │
  Author types  ───► │  TextareaControl (raw JSON)                                           │
   raw text          │        │                                                              │
                     │        ├─► setAttributes({ song: rawText })  ── ALWAYS (unconditional) │
                     │        │                                                              │
                     │        └─► validate(rawText)  ── pure side-computation                 │
                     │                 │   (JSON.parse → schema-as-data walk)                 │
                     │                 └─► Notice (error)  ── shown only on non-empty + invalid│
                     └───────────────────────────────────┬───────────────────────────────────┘
                                                          │
                              song attribute (string) ────┘  serialized into the
                                                              block-delimiter comment
                                                              <!-- wp:piano-block/piano {"song":"…"} -->
                                                          │
                     ┌────────────────────────────────────┴──────────────────────────────────┐
                     │  render.php (PHP, server-rendered)                                      │
                     │     $song = $attributes['song'] ?? '';                                  │
                     │     '' === trim($song)  ?  output nothing  :  <pre>esc_html($song)</pre> │
                     └─────────────────────────────────────────────────────────────────────────┘
```

Three components, each with a single responsibility:

- **The format** — a JSON document shape (Sections 3–5) plus a declarative **schema-as-data** definition (Section 7) that is the single source of truth for "what is conformant."
- **The editor** (`src/edit.js` + a small validator module) — binds a textarea to the `song` attribute, stores raw text unconditionally, and validates non-empty input against the schema, showing a non-blocking error notice (Section 6).
- **`render.php`** — a verbatim, escaped passthrough of the stored string inside a `<pre>`, emitting nothing when empty (Section 8).

The block remains a **dynamic block** (`save: null`, server-rendered via `render.php`), building on the issue-#1 scaffold: WordPress 6.9+, PHP 7.4+, built with `@wordpress/scripts`, `apiVersion` 3, linted with Biome, source under `src/` (requirement 14).

## 3. Data model: the `song` JSON document

The stored song is a JSON document. Its expected shape (when conformant) is:

```
song := { metadata?, defaults?, sections }
```

- **`sections`** is the only **required** top-level member — an array of **section** objects. A song's musical content lives entirely in `sections`.
- **`metadata`** (optional) holds bibliographic data: `title` and `composer` (both optional free-text strings). Requirement 4.9.
- **`defaults`** (optional) holds the **song-wide context** that every section inherits: `tempo`, `timeSignature`, and per-hand context (`rightHand`, `leftHand`). It is the single **inheritance root**.

A minimal conformant song is therefore:

```json
{ "sections": [ { "measures": [] } ] }
```

`metadata` and `defaults` are both optional and may be omitted. (This "minimal but present" song is distinct from the **empty state** — *no song at all* — which is the empty string `""`; see Section 5.)

### 3.1 Sections — units of constant context

A **section** is a run of music over which the musical context (tempo, time signature, per-hand clef / default accidentals / octave shift) is **constant**. A context change starts a new section. This mirrors how musicians read a score, where tempo/clef/key/time changes occur at measure or rehearsal-section boundaries — never mid-beat.

```
section := {
  tempo?,            // overrides defaults.tempo for this section
  timeSignature?,    // overrides defaults.timeSignature
  rightHand?,        // handConfig — overrides defaults.rightHand
  leftHand?,         // handConfig — overrides defaults.leftHand
  measures           // required — array of measure objects
}
```

Every override field is optional; a section provides only what changes relative to `defaults`. A section with no overrides simply uses `defaults`.

> **Naming note.** The illustrative draft in the prompt called these "chunks." This design renames them **`sections`** — "chunk" is engineering jargon with no musical meaning, whereas a raw-JSON author benefits from a self-describing word that names the concept (rehearsal sections / rehearsal letters in notation practice). `song.sections[0]` reads naturally.

**Mid-song changes (requirement 4.6) are realized by sections.** "Change only the right-hand clef at bar 9" is expressed as a new section whose `rightHand` is `{ "clef": "bass" }`, with everything else inherited. There is **no inline change-event mechanism** — context that is inherently measure/section-scoped (clef, key, time signature) is never promoted to the event timeline (which would be musically wrong, since a clef change does not "sound").

### 3.2 Measures — the grand-staff pairing

A **measure** is one bar. It pairs the two hands' event streams and carries optional barlines:

```
measure := {
  rightHand?,     // array of event objects (the right-hand part for this bar)
  leftHand?,      // array of event objects (the left-hand part for this bar)
  barlineStart?,  // enum (see 4.4) — absent ≡ regular
  barlineEnd?     // enum (see 4.4) — absent ≡ regular
}
```

The grand-staff time-alignment lives in **exactly one place**: `measure.rightHand[]` ∥ `measure.leftHand[]` are the two hands sounding over the same bar. This is the cleanest representation of the right-hand/left-hand pairing (requirement 3) and keeps each hand array a homogeneous list of musical events.

> Hands are **not** required to be time-aligned and a measure's events need **not** fill its time signature — see Section 6.2 (validation is structural only, per AC10).

### 3.3 Tempo and time signature

These live in `defaults` and may be overridden per section (requirement 4.6, 4.7):

```
tempo := { bpm, beatUnit? }
  bpm       : number > 0   (beats per minute; required when tempo is present)
  beatUnit? : duration word from the duration enum (quarter, eighth, …)
              — the note value the bpm counts (the "♩" in ♩=120)

timeSignature := { beats, beatType }
  beats    : integer ≥ 1                 (the upper numeral)
  beatType : integer in {1,2,4,8,16,32}  (the lower numeral / denominator)
```

> **A deliberate, documented asymmetry:** the **time-signature denominator is an integer** (notation writes "4/4" with a numeric bottom), whereas the **tempo beat unit is a duration word** (a metronome mark names a note value, "♩=120"). The spec's shared phrase "beat unit" is satisfied by both — they are the two correct domain conventions — so this is **not** an inconsistency to "fix."

## 4. Data model: per-hand context, events, and pitches

### 4.1 `handConfig` — per-hand context

One object shape, **`handConfig`**, expresses a hand's context. It is used in four positions: `defaults.rightHand`, `defaults.leftHand`, `section.rightHand`, `section.leftHand`. Its three v1 fields map 1:1 to requirement 4.5:

```
handConfig := {
  clef?,         // enum: treble | bass | alto | tenor
  alters?,       // map: note name → integer alteration (−2..+2) — per-hand default accidentals
  octaveShift?   // signed integer (−2..+2) — the ottava marking
}
```

All three are optional; a `handConfig` may set any subset (a hand with only a clef is `{ "clef": "bass" }`).

- **`clef`** — a closed enum: `treble`, `bass`, `alto`, `tenor` (requirement 4.5 names exactly these four).
- **`alters`** — the per-hand **default accidentals**, a *key-signature-like* mechanism: "every named note in this hand/section is altered by this amount unless a per-note `alter` overrides it." Keys are note names (English or Spanish, Section 4.4, case-insensitive); values are integer alterations in **−2..+2** (double-flat … double-sharp). E.g. `{ "F": 1 }` means every F sounds sharp without a per-note mark.
- **`octaveShift`** — the per-hand **ottava marking** ("play an octave higher/lower," e.g. 8va / 8vb), encoded as a **signed integer count of octaves** in **−2..+2**:
  - `+1` = 8va (one octave up), `−1` = 8vb / 8va bassa (one octave down)
  - `+2` = 15ma (two up), `−2` = 15mb (two down)
  - `0` or absent = no shift

  An **integer** (not a notation-token string like `"8va"`) is chosen because: (i) it combines deterministically and trivially with `pitch.octave` for future audio — `sounding octave = octave + octaveShift` (requirement 6) — with no lookup table; (ii) it validates as a simple closed integer range; (iii) it widens additively (22ma/±3 is vanishingly rare on piano and is deferred — requirement 5). This resolves the spec's design-deferred "octave-shift magnitude range" to **integer −2..+2**.

#### Inheritance / override semantics (`defaults` ⇄ `section`)

- **`handConfig` fields inherit independently (shallow per-field merge).** A section providing one field of a hand's config does **not** wipe the others: `clef`, `alters`, and `octaveShift` each resolve to *(section value if present, else `defaults` value, else the documented fallback)*. This keeps sections terse — you write only what changes. (Worked example: a section sets `"rightHand": { "alters": { "F": 1 } }`; its `clef` is inherited from `defaults`.)
- **The `alters` map REPLACES wholesale when a section provides it.** It models the *set of default accidentals in force* — the analogue of a key-signature region. A key change supersedes the prior key signature entirely; it does not "add accidentals to" it. So a section's `alters` is its **complete** default-accidental set, not merged key-by-key with `defaults.alters`. A section that wants *no* default accidentals while `defaults` had some sets `"alters": {}` explicitly. This is predictable: "what you see is the section's full set."
- **Documented fallbacks** (not required fields): `clef` absent → no forced default (treble for the right hand and bass for the left is *conventional* but not mandated; a future consumer picks a sensible default); `alters` absent → empty (no default accidentals); `octaveShift` absent → 0. These keep a minimal song valid (requirement 10) and the format permissive.

### 4.2 `event` — the time-bearing leaf

Each hand array (`measure.rightHand[]`, `measure.leftHand[]`) is a homogeneous list of **`event`** objects:

```
event := {
  type,           // required — enum: note | rest
  duration,       // required — enum: whole | half | quarter | eighth | sixteenth | thirty-second
  dots?,          // integer 0..2 (un-dotted | single | double dot); default 0
  pitches?,       // array of pitch objects — required & non-empty for a note; omitted for a rest
  dynamic?,       // enum: pp | p | mp | mf | f | ff | sf | sfz
  chordSymbol?,   // free-text string (open vocabulary, e.g. "C", "Gm7", "F♯dim")
  tie?,           // enum: start | stop
  slur?           // enum: start | stop
}
```

- **`type`** (required) and **`duration`** (required) are closed enums. `duration` names exactly the six values in requirement 4.1.
- **`dots`** is an integer **0..2** (single and double dots are standard; triple dots are vanishingly rare and deferred, additively re-openable). Requirement 4.1, "dotted durations."
- **`pitches`** — a chord is simply **several `pitch` entries in one event** (requirement 4.3); a single note is a one-element `pitches`. **The one conditional in the data model:** a `note` MUST carry a non-empty `pitches`; a `rest` carries none.
- **`dynamic`** is the closed eight-value enum of requirement 4.8.
- **`chordSymbol`** is **free text by spec** (requirement 4.8) — chord symbols are an open vocabulary — so it is an unconstrained string, the deliberate exception to the format's otherwise-closed enums.
- **`tie`** and **`slur`** are **event-level** `start | stop` markers (requirement 4.8). Per-pitch ties within a chord are a deferred (additive) refinement; v1 keeps them flat at the event level, which satisfies the spec's "ties and slurs (as start / stop)."

### 4.3 `pitch` — note name + octave + accidental

```
pitch := {
  step,     // required — note name (English letter or Spanish solfège); see 4.4
  octave,   // required — integer 0..9 (scientific-pitch-notation octave number)
  alter?    // integer −2..+2 (double-flat … double-sharp); default 0
}
```

- **`octave`** range **0..9** generously covers the piano (≈ A0–C8) and beyond without precluding audio (requirement 6). It is deliberately **not** narrowed to the piano keyboard — the format is a general song document, and over-tight bounds would falsely flag transposed/extended material.
- **`alter`** is the per-note accidental. When present it **overrides** the section's `alters` default for that note name (see Section 4.5).

### 4.4 Note-name systems and case handling

Two equivalent systems, **mixable within one song** (requirement 4.4, AC9):

- **English letters:** `C  D  E  F  G  A  B`
- **Spanish solfège:** `do  re  mi  fa  sol  la  si`
- **Documented equivalence** (for future audio, AC9): **do=C, re=D, mi=E, fa=F, sol=G, la=A, si=B**.

No token collides across the two systems (no Spanish word equals an English letter), so accepting both is unambiguous.

**Case handling (resolves the spec's design-deferred item): case-INSENSITIVE acceptance, stored verbatim.**

- The validator **accepts any case** for a recognised note name — `C`/`c`, `do`/`Do`/`DO` all conform. The same case-insensitive vocabulary governs `alters` map keys.
- **"Normalization" means only** (i) the validator folds case when checking membership in the note-name vocabulary, and (ii) the documented equivalence maps any accepted spelling to a canonical pitch class for future audio. It does **NOT** mean rewriting the stored JSON — requirement 9 / AC6 require the author's literal text to persist unchanged.
- The **canonical forms** the format documents and recommends are **uppercase English / lowercase solfège**; non-canonical case is accepted but the docs recommend the canonical spelling.

This satisfies AC9 (both systems accepted, equivalence documented) and is consistent with the spec's permissive, informational-only, never-rewriting stance.

### 4.5 Barlines and repeats

Barlines delimit **measures**, not events, so they live on the `measure` object as **`barlineStart`** and **`barlineEnd`** (Section 3.2), each a closed enum:

```
barline := regular | repeat-start | repeat-end | double | final
```

A repeated passage is `barlineStart: "repeat-start"` (`|:`) … `barlineEnd: "repeat-end"` (`:|`) on the bounding measures. Both are optional; absent ≡ a regular barline. Putting barlines on the measure (not in the event stream) keeps the hands' event arrays purely musical events and matches notation, where a barline spans the staff (both hands). Covers requirement 4.8, "barlines including repeats."

### 4.6 Accidental resolution (audio determinism, requirement 6)

The format documents how stored data combines into a concrete sounding pitch, so it does **not preclude future audio playback** (requirement 6):

- **Effective alteration** for a note = the note's own `alter` if present, else the section's effective `alters` entry for that note name if present, else `0` (natural). (Per-note `alter` overrides the per-hand/section default.)
- **Sounding octave** = `pitch.octave` + the section's effective `octaveShift`.
- So: `sounding pitch = pitch-class(step) + effective alteration, in octave (octave + octaveShift)`.

This is documentation of intent, not v1 behavior — there is no audio in this issue — but it confirms the model retains the pitch/octave/duration/tempo precision audio will later need.

## 5. Additive growth (no `version` field)

The format **starts minimal and grows additively** (requirement 5): there is **no schema `version` field**. Future capabilities (articulations, pedal, per-hand dynamics, voltas, tuplets, multiple voices, per-pitch ties, octave shift ±3, triple dots, …) arrive as **new optional fields** on existing objects (`event` / `section` / `measure` / `handConfig` / `pitch`). A song authored against today's format stays conformant after the format grows, because new fields are optional and old songs simply omit them. The format set only ever **grows**.

This drives the strict-vs-lenient conformance decision:

- **Lenient on unknown object properties** — unknown properties at every object level are **ignored, not errors** (`additionalProperties` left permissive). This preserves forward-compatibility: an *older* validator will not hard-fail a song that uses a field from a *future* version of the format — which matters precisely because there is **no `version` field** to gate on.
- **Closed on enumerated values** — recognised fields are strictly type/range/nesting-checked, and the value enums (durations, clefs, dynamics, barlines, tie/slur, `type`, `beatType`) are **closed**: a typo'd duration `"quaver"`, clef `"treble-clef"`, dynamic `"mezzo"`, or barline `"repeat"` **IS** a conformance error. These enums are the format's *vocabulary*, not additive extension points.

**Documented trade-off:** a misspelled *optional* property (e.g. `dynmic` instead of `dynamic`) is silently ignored rather than flagged. This is an accepted cost for a raw-JSON v1 — the author still sees their literal text persisted and rendered — and it is consistent with the spec's informational-only, never-blocking, permissive validation stance (requirement 9, AC6, AC10). The alternative (a third "warning" tier for unknown properties) is scope creep: the spec's validation model is binary (conformant → no error; non-conformant → clear error).

## 6. WordPress mechanics

### 6.1 The `song` block attribute (`type: "string"`)

`song` is declared in `src/block.json` as a **single attribute of `type: "string"`** with **`"default": ""`**:

```jsonc
// src/block.json — added to the issue-#1 scaffold
"attributes": {
  "song": { "type": "string", "default": "" }
}
```

**Why a `string` (not `object`/`array`).** AC6 requires that when the author enters content that "is not valid JSON or does not conform to the song format," the entered content "is still stored in `song`." A WordPress attribute typed as `object`/`array` can only hold a *parsed* JSON value — it categorically **cannot** store text that is not valid JSON. So `song` must be a `string`, holding the author's raw textarea input **verbatim** — the exact characters typed, regardless of JSON validity or format conformance. WordPress documents this exact pattern: an object/array attribute may instead be registered as a `string` "and use JSON as the intermediary." The structured song document of Sections 3–4 is therefore the *expected content* of that string (its JSON, when conformant), **not** the attribute's declared type.

This resolves the spec's design-deferred "how the `song` attribute is typed so it can hold raw (possibly non-conformant) input": **a string.**

**No `source`; dynamic-block serialization.** As a dynamic block (`save: null`), the attribute has **no `source`** and is serialized by WordPress as JSON into the block's HTML-comment delimiter:

```html
<!-- wp:piano-block/piano {"song":"…escaped JSON string…"} -->
```

The block serializer handles JSON string-escaping of the value, so a string containing quotes, braces, `<`, or `&` round-trips faithfully (AC1). On the front end the value is delivered to `render.php` as `$attributes['song']` (a PHP string) — the standard dynamic-block attribute path. (`source` is for parsing values out of saved *markup*; a dynamic block saves no markup.)

**Empty default → the "no song" sentinel.** With `"default": ""`, a freshly inserted block has `song === ""`: the editor field renders blank and nothing is stored as song content (requirement 10, AC2). The **empty string is the canonical "no song yet" sentinel**, distinct from a present-but-minimal song (Section 3). Render keys off this (Section 8). Conformance validation applies only to **non-empty** input — the empty string is never "non-conformant."

**Rejected alternatives:** (a) `type: object` with the parsed song — cannot store invalid JSON (violates AC6) and would force the editor to block/discard non-conformant input (violates requirement 9); (b) two attributes (a `string` raw + an `object` parsed) — redundant, risks divergence, and the spec mandates a *single* attribute named `song` (requirement 1); (c) `type: string` with a non-empty starter-template default — violates AC2 ("the raw-JSON field is blank and no song content is stored"). The lone `string` + `""` default is the **minimal** declaration satisfying requirements 1, 9, 10 and AC1, AC2, AC6 simultaneously.

### 6.2 Validation approach (structural/field only)

**Single source of truth: a declarative schema-as-data object + a small purpose-built validator (no third-party dependency).**

The format from Sections 3–4 is small and closed: ~6 object shapes (`song`, `metadata`, `defaults`/`handConfig`, `section`, `measure`, `event`, `pitch`) + a handful of closed value enums + a few integer ranges + one `note`→`pitches` conditional. Three ways to make conformance machine-checkable were considered:

| Option | Single source of truth | Dependency | Verdict |
|---|---|---|---|
| (i) A real JSON Schema (draft 2020-12) + a JSON-Schema validator library (e.g. `ajv`) | the schema doc | **adds `ajv`** (~100KB+ in the editor bundle) | Rejected — pulls a non-trivial runtime dependency into the editor, against the project's zero-dependency ethos. |
| **(ii) A declarative schema-as-data object (the JSON-Schema subset the format uses) + a small purpose-built validator that interprets it** | the schema-as-data object | **none** | **Chosen** — one declarative, machine-readable definition AND zero dependencies. |
| (iii) A hand-written imperative validator only; schema in prose | validator code + doc | none | Rejected — the "single source of truth" splits between doc and code (drift risk); no runnable canonical schema. |

**Decision — option (ii).** A declarative **schema-as-data** object (Section 7) is the single source of truth; a **small, purpose-built, zero-dependency validator** interprets it. Rationale:

- **Honors the spec's "canonical, machine-checkable definition."** The schema object *is* that definition, in code, and doubles as documentation (publishable verbatim in the design doc / README).
- **Honors the project's zero-runtime-dependency identity.** The issue-#1 scaffold added nothing beyond WordPress externals + Biome; bundling `ajv` would be the first runtime dependency. The *song format* dependency-free mandate (requirement 2) sets the tone even though it technically governs the format, not tooling. **No `ajv` / no third-party validator.**
- **Bounded effort.** The schema uses only a small, known keyword subset — `type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, integer `minimum`/`maximum`, permissive `additionalProperties`, and one `if/then` — so the validator is a small recursive walk (roughly ~100–150 lines), not a general JSON-Schema engine.
- **First-class errors.** A purpose-built walker can produce **human-readable, path-pointed messages** ("`sections[0].measures[1].rightHand[0].duration`: `quaver` is not an allowed duration") tuned for the raw-JSON author, rather than a generic library's terse output.

`ajv` + a literal JSON Schema (option i) is recorded as the considered alternative, with a **low-cost swap trigger:** if the format later grows enough that the hand-rolled walker becomes a maintenance burden (many conditionals, cross-references), adopting `ajv` consuming the *same* schema-as-data is a localized change, because the schema is already the source of truth.

**What the validator checks** (for **non-empty** input only — the empty string is the "no song" state, never validated):

1. **Valid JSON first.** The string must `JSON.parse` without throwing; a parse failure **is** a conformance error (AC6: "not valid JSON *or* does not conform").
2. **Structural / field conformance** against the schema: required fields present (`sections`; per-object requireds like event `type`+`duration`, pitch `step`+`octave`); recognised fields' values within their **closed enums** (durations, clefs, dynamics, barlines, tie/slur, `type`, `beatType`) — note names checked **case-insensitively**; correct **types** and **nesting**; **integer ranges** (`octave` 0–9; `alter` / `alters` values / `octaveShift` −2..+2; `dots` 0–2; tempo `bpm` > 0; `timeSignature.beats` ≥ 1; `beatType` ∈ {1,2,4,8,16,32}); the **`note`→non-empty `pitches`** conditional; **unknown object properties IGNORED** (Section 5 leniency).
3. **Explicitly NOT checked (AC10):** **no musical-timing validation** — no measure-duration arithmetic (events need not sum to the time signature) and no right/left-hand time-alignment. A structurally-conformant but musically-unbalanced song is **accepted**. Timing is the author's responsibility in v1.

### 6.3 Non-blocking persistence and error surfacing

**Persistence is unconditional; validation is presentational only** (requirement 9, AC6). The data flow:

1. On **every** change to the field, the edit component calls `setAttributes({ song: rawText })` — always, independent of validity. The **raw string is what persists** (Section 6.1).
2. Validation is a **pure, presentational side-computation** on the current `song` string: parse + schema-check → produce zero-or-more error messages.
3. The errors are rendered as a visible notice; they **never** gate `setAttributes`, never clear the field, and never substitute a parsed value. So a non-conformant song is both flagged **and** stored (AC6), and validation is informational-only (requirement 9).

**Error surfacing — components & placement** (requirement 8, "clear, visible error"). The block's only interaction is the raw-JSON field, so the **edit component renders it on the block canvas**: a labeled multi-line text field plus, beneath it, an error notice shown only when validation fails on non-empty input.

- **Field:** `TextareaControl` from `@wordpress/components` — accessible, labeled (`label` + `help`), the simplest correct control for multi-line raw text (a monospace class can give it a code-like feel). `PlainText` from `@wordpress/block-editor` is a chrome-less alternative recorded.
- **Error:** a `Notice` from `@wordpress/components` with `status="error"`, non-dismissible, rendered only when there are validation errors **and** the field is non-empty. The message is a clear, human-readable summary (the first error with its JSON path, or a short list). Using an **error-status** notice satisfies requirement 8's "clear, visible error" while remaining non-blocking — a `Notice` is presentational and does not prevent saving (the non-blocking behavior comes from the data flow above, not the notice severity).
- **States:** empty field → **no** notice (requirement 10 / AC2); conformant → **no** notice (AC4); non-conformant / invalid-JSON → the **error** notice (AC6).
- **Placement:** the block **canvas** (primary, discoverable for the "edit JSON directly" v1 use), chosen over the inspector sidebar (recorded as a viable alternative).
- **i18n:** all user-facing strings (label, help, error templates) wrapped via `@wordpress/i18n` `__()`, consistent with the issue-#1 `src/edit.js`.

**Validation flow (summary):** `onChange(text)` → `setAttributes({ song: text })` (always) → if `text` is empty: clear errors → else `try { JSON.parse(text) } catch → [invalid-JSON error]`, else run the schema validator → set the resulting error list → render the `Notice` iff the list is non-empty. (Debouncing validation for very large inputs is an optional perf nicety, not required — performance is out of scope.)

## 7. The schema-as-data definition (single source of truth)

The validator interprets the following declarative schema (a JSON-Schema **subset**). It is shown here at design level; the Code phase finalizes the literal object placed in `src/`. It uses only: `type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, integer `minimum`/`maximum`, one `if/then`, and **permissive** `additionalProperties` (unknown properties ignored, per Section 5).

```jsonc
{
  "type": "object",
  "required": ["sections"],
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "title":    { "type": "string" },
        "composer": { "type": "string" }
      }
      // additionalProperties permissive (unknown keys ignored)
    },
    "defaults": { "$ref": "#/$defs/context" },
    "sections": {
      "type": "array",
      "items": { "$ref": "#/$defs/section" }
    }
  },

  "$defs": {
    // Shared by defaults and section: the context fields.
    "context": {
      "type": "object",
      "properties": {
        "tempo":         { "$ref": "#/$defs/tempo" },
        "timeSignature": { "$ref": "#/$defs/timeSignature" },
        "rightHand":     { "$ref": "#/$defs/handConfig" },
        "leftHand":      { "$ref": "#/$defs/handConfig" }
      }
    },

    "section": {
      "type": "object",
      "required": ["measures"],
      "properties": {
        "tempo":         { "$ref": "#/$defs/tempo" },
        "timeSignature": { "$ref": "#/$defs/timeSignature" },
        "rightHand":     { "$ref": "#/$defs/handConfig" },
        "leftHand":      { "$ref": "#/$defs/handConfig" },
        "measures": {
          "type": "array",
          "items": { "$ref": "#/$defs/measure" }
        }
      }
    },

    "measure": {
      "type": "object",
      "properties": {
        "rightHand":    { "type": "array", "items": { "$ref": "#/$defs/event" } },
        "leftHand":     { "type": "array", "items": { "$ref": "#/$defs/event" } },
        "barlineStart": { "enum": ["regular", "repeat-start", "repeat-end", "double", "final"] },
        "barlineEnd":   { "enum": ["regular", "repeat-start", "repeat-end", "double", "final"] }
      }
    },

    "tempo": {
      "type": "object",
      "required": ["bpm"],
      "properties": {
        "bpm":      { "type": "number", "minimum": 0, "exclusiveMinimum": true },
        "beatUnit": { "enum": ["whole", "half", "quarter", "eighth", "sixteenth", "thirty-second"] }
      }
    },

    "timeSignature": {
      "type": "object",
      "required": ["beats", "beatType"],
      "properties": {
        "beats":    { "type": "integer", "minimum": 1 },
        "beatType": { "enum": [1, 2, 4, 8, 16, 32] }
      }
    },

    "handConfig": {
      "type": "object",
      "properties": {
        "clef":        { "enum": ["treble", "bass", "alto", "tenor"] },
        // alters: a map note-name → integer −2..+2 (validated as such by the walker;
        // keys are matched case-insensitively against the note-name vocabulary)
        "alters":      { "type": "object" },
        "octaveShift": { "type": "integer", "minimum": -2, "maximum": 2 }
      }
    },

    "event": {
      "type": "object",
      "required": ["type", "duration"],
      "properties": {
        "type":        { "enum": ["note", "rest"] },
        "duration":    { "enum": ["whole", "half", "quarter", "eighth", "sixteenth", "thirty-second"] },
        "dots":        { "type": "integer", "minimum": 0, "maximum": 2 },
        "pitches":     { "type": "array", "items": { "$ref": "#/$defs/pitch" } },
        "dynamic":     { "enum": ["pp", "p", "mp", "mf", "f", "ff", "sf", "sfz"] },
        "chordSymbol": { "type": "string" },
        "tie":         { "enum": ["start", "stop"] },
        "slur":        { "enum": ["start", "stop"] }
      },
      // The single data-model conditional: a note requires a non-empty pitches array.
      "if":   { "properties": { "type": { "const": "note" } } },
      "then": { "required": ["pitches"] /* + non-empty, enforced by the walker */ }
    },

    "pitch": {
      "type": "object",
      "required": ["step", "octave"],
      "properties": {
        // step: a note name, matched case-insensitively against
        // English C D E F G A B  and  Spanish do re mi fa sol la si.
        "step":   { "type": "string" },
        "octave": { "type": "integer", "minimum": 0, "maximum": 9 },
        "alter":  { "type": "integer", "minimum": -2, "maximum": 2 }
      }
    }
  }
}
```

Two checks the schema keywords cannot fully express, handled by the **walker** as documented special cases:

- **Note names** (`pitch.step` and `alters` keys) are matched **case-insensitively** against the two-system vocabulary (English `C D E F G A B` + Spanish `do re mi fa sol la si`) — a closed enum, but case-folded. A typo like `"H"` or `"doh"` is a conformance error; `"c"` or `"DO"` is accepted.
- **`alters`** is a map whose every value must be an integer in −2..+2 and whose every key must be a recognised note name (case-insensitive).

## 8. Front-end output (`render.php`)

`render.php` is a **safe, verbatim passthrough** of the stored string.

- **Passthrough, no re-serialization (requirement 11, AC7).** Because `song` is already a string (Section 6.1), "serialize the stored content to a string" is satisfied by emitting it as-is. `render.php` **must NOT** run `wp_json_encode()` / `json_decode()` on it — re-encoding would transform the author's literal text (re-escaping, reordering, or, for non-JSON input, failing), violating requirement 11's "outputs **whatever is stored**." This also **resolves the design-deferred "compact vs pretty" formatting question: neither — verbatim passthrough.** The output's formatting is exactly whatever the author typed (their own indentation/newlines, or single-line).
- **Escaping — the security decision (requirement 13, AC8).** The stored string is arbitrary author input and may contain HTML-significant characters (`<`, `>`, `&`, `"`, `'`) or script (`<script>…`). It is emitted as a **text node** inside the wrapper element, so the correct, sufficient WordPress escaper is **`esc_html()`**: it converts `&`, `<`, `>`, `"`, `'` to HTML entities, so any markup or script in the stored content renders as inert visible text and **cannot execute** (no XSS) — satisfying AC8. `esc_html` (escape everything) is both the simplest and the safest choice here, since the intent is to output the content as *text*, not sanitized HTML; `wp_kses_post` (allow some tags) would be wrong and riskier.
- **Wrapping element = `<pre>` (resolves the design-deferred wrapping element).** The content is multi-line preformatted text (JSON when conformant, free text otherwise), so the fitting semantic wrapper is **`<pre>`**, carrying the standard block wrapper attributes via `get_block_wrapper_attributes()`. `<pre>` preserves the author's newlines/indentation so the song reads as the text it is. (`<div>`/`<p>` lose whitespace semantics; an inner `<code>` is a defensible-but-functionally-inert refinement, recorded as optional.) **Do not double-escape the wrapper:** `get_block_wrapper_attributes()` returns an already-escaped attribute string and is echoed directly into the opening tag (NOT wrapped in `esc_attr()`) — the same rule the issue-#1 scaffold already follows.
- **Empty state outputs nothing (requirement 12, AC3).** When `song` is empty — the default `""`, unset on an older instance, or whitespace-only — `render.php` outputs **nothing**: no wrapper element, no content. Read the value safely as `$attributes['song'] ?? ''` (null-coalesce to avoid a PHP 8 "Undefined array key" warning under `WP_DEBUG`), then treat empty as `'' === trim( (string) $song )` so a whitespace-only value is also "nothing meaningful," and early-return. (Emitting an empty `<pre>` for styling consistency was considered and rejected for AC3 clarity — "no song content is output" reads most cleanly as *no element at all*.)
- **No render-time validation (requirement 11, out of scope).** `render.php` performs **no** parsing, validation, or well-formedness check — `song` is opaque text. Non-conformant or non-JSON content is output identically (escaped). The **only** branch is the empty check.

Illustrative shape (the Code phase finalizes the exact form):

```php
<?php
$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';
if ( '' === trim( $song ) ) {
    return; // Empty / no song → output nothing meaningful (req 12, AC3).
}
?>
<pre <?php echo get_block_wrapper_attributes(); ?>><?php echo esc_html( $song ); ?></pre>
```

## 9. Annotated example song

A song that exercises every required element (notes, rests, chords, dotted durations, per-note accidentals, both English and Spanish note names, per-hand clef / default accidentals / octave-shift, mid-song tempo / clef / time-signature / accidental changes, dynamics, chord symbols, ties, slurs, repeat barlines, and title/composer metadata — AC5). This is the **content** of the `song` string; it is stored verbatim as text.

```jsonc
{
  "metadata": {
    "title": "Example",
    "composer": "A. Composer"
  },

  // Song-wide context every section inherits unless it overrides.
  "defaults": {
    "tempo": { "bpm": 120, "beatUnit": "quarter" },   // ♩ = 120
    "timeSignature": { "beats": 4, "beatType": 4 },    // 4/4
    "rightHand": { "clef": "treble" },
    "leftHand":  { "clef": "bass", "alters": { "B": -1 } }  // left hand: every B is flat
  },

  "sections": [
    // ── Section 1 — uses defaults (no overrides) ───────────────────────────
    {
      "measures": [
        {
          "barlineStart": "repeat-start",              // |:  begin a repeated passage
          "rightHand": [
            // Dotted-half C5 chord (C5 + E5 + G5), mezzo-forte, slur + tie start.
            {
              "type": "note",
              "duration": "half",
              "dots": 1,                                // dotted half
              "dynamic": "mf",
              "chordSymbol": "C",                        // free-text chord symbol
              "slur": "start",
              "tie": "start",
              "pitches": [
                { "step": "C", "octave": 5 },
                { "step": "E", "octave": 5 },
                { "step": "G", "octave": 5 }
              ]
            },
            // Quarter rest.
            { "type": "rest", "duration": "quarter" }
          ],
          "leftHand": [
            // Spanish note names; "si" = B, which is flat here via the hand's alters.
            { "type": "note", "duration": "quarter",
              "pitches": [ { "step": "do", "octave": 3 } ] },     // do = C
            { "type": "note", "duration": "quarter",
              "pitches": [ { "step": "sol", "octave": 3 } ] },    // sol = G
            { "type": "note", "duration": "half",
              "pitches": [ { "step": "si", "octave": 2 } ] }      // si = B (→ B♭ via alters)
          ]
        },
        {
          "barlineEnd": "repeat-end",                  // :|  end the repeated passage
          "rightHand": [
            // Tie stop + slur stop on a held C5.
            { "type": "note", "duration": "whole", "tie": "stop", "slur": "stop",
              "pitches": [ { "step": "C", "octave": 5 } ] }
          ],
          "leftHand": [
            // Per-note accidental: F#2 (alter +1) overrides any section default.
            { "type": "note", "duration": "whole",
              "pitches": [ { "step": "F", "octave": 2, "alter": 1 } ] }
          ]
        }
      ]
    },

    // ── Section 2 — MID-SONG CHANGES: new tempo, time signature, clef, alters,
    //    and a right-hand octave shift. Each field overrides defaults; the
    //    left-hand clef (bass) is inherited because leftHand only sets alters. ──
    {
      "tempo": { "bpm": 90, "beatUnit": "quarter" },   // tempo change → ♩ = 90
      "timeSignature": { "beats": 3, "beatType": 4 },  // time-signature change → 3/4
      "rightHand": {
        "clef": "treble",
        "octaveShift": 1,                               // 8va: sounds one octave higher
        "alters": { "F": 1, "C": 1 }                    // section default accidentals: F#, C#
      },
      "leftHand": {
        "alters": {}                                    // clear inherited B♭ for this section
        // clef inherited from defaults (bass)
      },
      "measures": [
        {
          "barlineEnd": "final",                       // final barline ‖
          "rightHand": [
            // F here is F#5 by the section's alters; written octave 5, sounds 6 (8va).
            { "type": "note", "duration": "quarter", "dynamic": "p",
              "pitches": [ { "step": "F", "octave": 5 } ] },
            { "type": "note", "duration": "quarter",
              "pitches": [ { "step": "C", "octave": 6 } ] },     // C#6 (alters), sounds 7
            { "type": "rest", "duration": "quarter" }
          ],
          "leftHand": [
            { "type": "note", "duration": "half", "dots": 1,
              "pitches": [ { "step": "C", "octave": 3 } ] }      // dotted half = 3 beats (fills 3/4)
          ]
        }
      ]
    }
  ]
}
```

What this demonstrates, mapped to AC5: notes & rests (both hands); chords (the opening 3-pitch C-major chord); dotted durations (`dots: 1`); per-note accidentals (`F#2` via `alter`); both note-name systems mixed (English in the right hand, Spanish `do`/`sol`/`si` in the left); per-hand clef, default accidentals (`alters`), and octave shift; mid-song tempo / clef / time-signature / accidental changes (Section 2); dynamics (`mf`, `p`); a free-text chord symbol (`"C"`); ties and slurs (start in section 1, stop in measure 2); repeat barlines (`repeat-start` … `repeat-end`) and a `final` barline; and `metadata` title/composer.

Per AC10 this song is **not** required to be timing-balanced — e.g. the right hand of section 1's first measure (dotted half + quarter rest = 4 beats) and the left hand (quarter + quarter + half = 4 beats) happen to align in 4/4, but a song where they did not would still validate.

## 10. Key trade-offs and rationale

| Decision | Choice | Rationale | Considered alternative |
|---|---|---|---|
| **Sectioning** | A top-level `sections[]` of constant-context sections, each overriding `defaults`, containing `measures[]` that pair `rightHand[]` ∥ `leftHand[]`. | Faithful to how scores segment context (changes at section/measure boundaries, never mid-beat); cleanest grand-staff time-alignment (in one place — the measure); simplest **homogeneous** arrays, which makes conformance checking simplest. | **Inline change-events** (rejected — promotes section-scoped context like clef/key to the event timeline, musically wrong, hardest to validate as a union); **flat measures with per-measure overrides** (viable but muddies the measure object with context keys, no decisive gain). |
| **`song` attribute type** | `type: "string"`, `default: ""`. | A `string` is the only attribute type that can store the author's **raw, possibly-non-JSON** input verbatim (AC6). Empty default is the "no song" sentinel (AC2). | `object`/`array` (cannot hold invalid JSON, would force blocking — violates AC6 + req 9); dual raw/parsed attributes (redundant, divergence risk, violates the single-`song` mandate). |
| **Conformance: unknown properties** | **Lenient** — ignored, not errors. | Forward-compatible: an older validator won't hard-fail a song using a *future* optional field — essential because there is **no `version` field** to gate on. Matches the spec's permissive, informational-only stance. | **Strict** (`additionalProperties: false`) — would catch typo'd optional keys, but the day a new optional field ships, older validators retroactively flag newer-but-valid songs. |
| **Value enums** | **Closed** (durations, clefs, dynamics, barlines, tie/slur, type, beatType). | These are the format's fixed *vocabulary*, not extension points; a typo'd `"quaver"` should be caught. | Open enums — would silently accept meaningless values. |
| **Validator** | A declarative **schema-as-data** + a **small purpose-built, zero-dependency** walker. | Single machine-checkable source of truth that doubles as docs; honors the project's zero-dependency ethos; bounded effort (small closed format); first-class path-pointed errors for the raw-JSON author. | `ajv` + literal JSON Schema — rejected for bundle weight/dependency; **low-cost swap later** since the schema-as-data is already the source of truth. |
| **Octave-shift encoding** | Signed **integer** `octaveShift` (−2..+2). | Combines deterministically with `pitch.octave` for future audio (`sounding = octave + shift`, req 6), no lookup table; simple closed-range validation; widens additively. | Notation-token string (`"8va"`/`"15mb"`) — needs a lookup table to become a number for audio. |
| **Note-name case** | **Case-insensitive** acceptance; stored **verbatim**; canonical forms documented. | Rejecting `c`/`Do` as a structural error would be surprising for an obviously-valid note and out of step with the permissive, never-rewriting stance (req 9/AC6). | Case-sensitive (only `C`/`do`) — surprising and stricter than the spec's permissive posture warrants. |
| **`alters` merge** | A section's `alters` map **replaces** wholesale; other handConfig fields merge per-field. | A key change supersedes the prior key signature entirely; "what you see is the section's full set" is predictable, avoiding confusing partial-merge questions. | Deep key-by-key merge of `alters` — ambiguous ("does `{F:1}` keep an inherited `{B:-1}`?"). |
| **Render** | Verbatim `esc_html($song)` inside `<pre>`; nothing when empty; no validation/re-serialization. | Honors "outputs whatever is stored" (req 11); `esc_html` makes any markup/script inert (no XSS, AC8); `<pre>` preserves the author's whitespace; empty → no element (cleanest reading of AC3). | `wp_json_encode`/`json_decode` round-trip (would mutate or fail on non-JSON — violates req 11); `wp_kses_post` (the song is text, not rich HTML — wrong and riskier); empty `<pre>` wrapper (less clean for AC3). |

## 11. Requirements & acceptance-criteria traceability

| Requirement / AC | Where addressed |
|---|---|
| Req 1 — single `song` attribute that persists | §6.1 (`type: "string"`, single attribute) |
| Req 2 — custom dependency-free JSON; no MusicXML/ABC/MIDI; no libs; no innerBlocks | §3–§5 (own format); §6.2 (zero-dependency validator) |
| Req 3 — grand staff (right + left, time-alignable) | §3.2 (`measure.rightHand[]` ∥ `leftHand[]`) |
| Req 4.1 — notes/rests, durations, dotted | §4.2 (`event`: `type`, `duration`, `dots`) |
| Req 4.2 — pitch = name + octave + accidental (𝄫…𝄪) | §4.3 (`pitch`: `step`, `octave`, `alter`) |
| Req 4.3 — chords | §4.2 (`pitches[]` with >1 entry) |
| Req 4.4 / AC9 — English + Spanish names, equivalent, mixable | §4.4 |
| Req 4.5 — per-hand clef / default accidentals / octave-shift | §4.1 (`handConfig`) |
| Req 4.6 — mid-song tempo/clef/time/accidental/octave changes | §3.1 (sections override per field); §4.1 (inheritance) |
| Req 4.7 — time signature + tempo | §3.3 |
| Req 4.8 — dynamics, chord symbols, ties, slurs, barlines + repeats | §4.2 (dynamic/chordSymbol/tie/slur), §4.5 (barlines) |
| Req 4.9 — metadata: title, composer | §3 (`metadata`) |
| Req 5 — additive growth, no `version` | §5 |
| Req 6 — does not preclude audio (deterministic sounding pitch) | §4.1 (`octaveShift`), §4.6 (resolution) |
| Req 7 — raw-JSON editor field | §6.3 (`TextareaControl`) |
| Req 8 — full structural/field conformance + clear visible error | §6.2 (checks), §6.3 (error `Notice`) |
| Req 9 / AC6 — informational only, never blocks, raw stored even if non-conformant | §6.1, §6.3 |
| Req 10 / AC2 — new block empty; validate only non-empty | §6.1 (`default: ""`), §6.2 (non-empty only) |
| Req 11 / AC7 — render outputs stored string, no validation | §8 (passthrough) |
| Req 12 / AC3 — empty → nothing meaningful | §8 (empty-state early return) |
| Req 13 / AC8 — output escaped, no XSS | §8 (`esc_html`) |
| Req 14 — dynamic block on the issue-#1 scaffold | §2 (platform) |
| AC1 — `song` persists across save/reload | §6.1 (delimiter-comment serialization) — **Code-phase confirms** |
| AC4 — conformant song → no error, stored | §6.2 / §6.3 |
| AC5 — format covers all required elements | §9 (worked example) |
| AC10 — structural-only, no musical-timing | §6.2 (item 3) |

## 12. Verification caveats (to confirm in the Code phase)

This worktree has **no `node_modules`** (`npm install` not run) and **no running WordPress**, so nothing in this design was executed here. The load-bearing WordPress facts below are stated from established WordPress knowledge / official developer documentation, but were **NOT empirically verified in this worktree**. They are **not** guarantees — the **Code phase must confirm** them via `npm run build` + a `wp-env` smoke test:

- **AC1 — attribute round-trip.** That a `song` value actually serializes into the block-delimiter comment and reappears unchanged on reload (the dynamic-block, no-`source` serialization path). To confirm in the Code phase.
- **AC3 — empty renders nothing.** That an empty/whitespace-only `song` produces no element. To confirm in the Code phase.
- **AC8 — XSS escaping.** That a `song` containing `<script>` / `<` / `&` / quotes renders escaped and inert via `esc_html()`, and that `get_block_wrapper_attributes()` returns a pre-escaped string echoed directly (not via `esc_attr()`). The `esc_html()` / `get_block_wrapper_attributes()` behaviors are well-established core-WP facts (high confidence) but should still be exercised. To confirm in the Code phase.
- **`@wordpress/components` API.** The exact prop signatures of the **installed** package version — `TextareaControl` (`label` / `help` / `value` / `onChange` / `rows`) and `Notice` (`status` ∈ `warning|success|error|info`; non-dismissible prop name and `onDismiss`) — should be confirmed against the resolved `@wordpress/components` version. The component **names and general props** are from the official Component Reference; the precise installed-version signatures are to confirm in the Code phase.

These caveats do not affect the data-model or format decisions (Sections 3–5, 7, 9), which are self-contained and independent of the WordPress runtime.
