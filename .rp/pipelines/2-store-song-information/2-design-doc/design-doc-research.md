# Design Research: Store song information in the Piano block

_Running record of the design Q&A for pipeline `2-store-song-information` (GitHub issue #2). Driven by `design-doc-analyst`. Each topic is settled one at a time: question → evidence → decision → rationale. The separate `design-doc-writer` will compose `design-doc.md` from these decisions._

> **Process note.** The Q&A was intended to be answered by a `design-doc-researcher` teammate, but that teammate was unresponsive for the duration of this phase (the team lead was notified). To avoid stalling the pipeline, `design-doc-analyst` conducted the investigation directly, grounded in: the approved spec, the illustrative prompt, the live scaffold under `src/`, and established WordPress block-editor + Western-music-notation domain knowledge. **Evidence basis is labelled per topic.** Load-bearing WordPress facts that could be checked in-repo were checked; facts that depend on the installed `@wordpress/*` runtime could **not** be empirically re-verified here because the worktree has **no `node_modules`** (`npm install` not run) — these are flagged as "general WP knowledge, not re-verified in-worktree" and should be confirmed by the Code phase (e.g. via `npm run build` + a `wp-env` smoke test) or by `design-doc-reviewer`.

## Inputs

- **Spec**: `.rp/pipelines/2-store-song-information/1-spec/spec.md` — authoritative requirements (1–14) and acceptance criteria (AC1–AC10). Approved as written.
- **Prompt**: `.rp/pipelines/2-store-song-information/0-prompt/prompt.md` — includes an ILLUSTRATIVE / NON-BINDING draft JSON + JSON Schema. We decide the actual design.
- **Scaffold**: `src/block.json` (apiVersion 3, dynamic block, `render: file:./render.php`, no attributes yet), `src/render.php` (placeholder `<p>` via `get_block_wrapper_attributes()`), `src/edit.js` (placeholder paragraph, no controls), `src/index.js` (`registerBlockType` with `edit` only, no `save`), `piano-block.php` (registers from `build/`; WP 6.9+, PHP 7.4+).

## Scope guardrails (settled in Spec — NOT re-opened here)

- One block attribute named `song`; custom dependency-free JSON; no MusicXML/ABC/MIDI; no music libraries; no innerBlocks.
- Editor validation = FULL structural/field conformance, informational only, never blocks persistence; raw input stored even when non-conformant.
- New block starts empty; conformance applies to non-empty input only.
- `render.php` = passthrough of stored text, escaped; no validation; nothing meaningful for the empty state.
- No schema `version` field — format grows additively via optional fields.
- Musical-timing validation (measure-filling, hand alignment) is OUT — author's responsibility in v1.
- Design-deferred items this phase must resolve: exact JSON structure/field names; `song` attribute typing for raw input; octave-shift magnitude range; note-name case handling/normalization; render output formatting (compact vs pretty) + wrapping element.

## Design topics (settled one at a time)

1. Top-level `song` JSON structure + additive-growth approach.
2. Per-hand context model (clef, default accidentals, octave-shift marking + range).
3. Event/pitch model (notes, rests, chords, durations+dots, per-note accidental, note-name systems + case handling, dynamics, chordSymbol, tie/slur, barlines).
4. `song` block-attribute typing (raw non-conformant persistence, empty default).
5. Editor-side conformance validation approach + error surfacing (single source of truth).
6. `render.php` serialization, escaping, empty-state output, wrapping element + formatting.

---

## Topic 1 — Top-level `song` structure, sectioning mechanism, additive growth

**Question.** What is the concrete top-level shape of the `song` document, and what mechanism represents mid-song changes to tempo / clef / time-signature / per-hand default-accidentals / per-hand octave-shift (req 3, 4.5–4.7)? How does the format stay additive with no `version` field (req 5)? Specifically: (1) the sectioning mechanism — sections array vs flat measures with per-measure overrides vs inline change-events; (2) public field naming ("chunk" vs "sections"); (3) metadata + defaults placement; (4) how additive growth works and whether conformance is strict (reject unknown fields) or lenient (ignore them).

**Evidence basis.** Spec req 3, 4, 5, 6, 10; prompt's illustrative `{ metadata, defaults, chunks[] }`; Western-music-notation domain knowledge (how scores change context); JSON-data-modeling and JSON-Schema knowledge. No WP runtime facts here, so nothing needs in-worktree verification for this topic.

### Investigation

**(1) Sectioning mechanism — three candidates evaluated.**

- **(A) Top-level sections array** (the prompt's "chunks"). The song is `sections[]`; each section optionally overrides context (tempo / timeSignature / per-hand clef + alters + octaveShift) and carries its own `measures[]`. Context is constant within a section; a change starts a new section.
- **(B) Flat `measures[]` with per-measure context overrides.** One measures stream; any measure may carry optional `tempo` / `timeSignature` / per-hand-context fields that take effect from that measure onward (sticky until the next override).
- **(C) Inline context-change events.** Context changes are encoded as special "events" interleaved in each hand's event array (e.g. `{ "type": "tempo", "bpm": 120 }` between notes).

Evaluation against the spec's axes:

| Axis | (A) Sections array | (B) Flat measures + overrides | (C) Inline change-events |
|---|---|---|---|
| **Faithfulness to scores** | High — tempo/clef/key/time changes in real scores occur at *measure or rehearsal-section boundaries*, never mid-beat; a "section of constant context" matches how musicians read a score (rehearsal letters/sections). | High for the boundary itself, but scatters context across the measure list rather than grouping it. | **Low** — promotes inherently *measure-level/section-level* context (clef, key, time signature) to the *event* timeline, which is musically wrong: a clef change is not an event that "sounds." |
| **Keeps two hands time-aligned** | **Cleanest** — alignment is expressed *per measure* (`measure.rightHand[]` ∥ `measure.leftHand[]`), and measures are grouped under sections. The grand-staff pairing lives in exactly one place (the measure). | Same per-measure pairing — fine. | **Worst** — context events live *inside one hand's* stream, so a tempo/time change is asymmetrically attached to one hand; keeping both hands consistent becomes the author's bookkeeping. |
| **JSON simplicity** | Moderate nesting (`song → sections[] → measures[] → {rightHand[],leftHand[]} → events[]`), but each level is a clean, named concept. | Flatter (one less level), but every context-carrying measure mixes "notes" with "context override" keys, muddying the measure object. | Flattest structurally, but each hand array becomes a *heterogeneous* list (notes, rests, AND context events) — the hardest to read and to validate. |
| **Conformance validation (JSON-Schema-style)** | **Easiest** — homogeneous arrays at every level: `sections` are sections, `measures` are measures, hand arrays are events. Each `$def` has one shape. | Medium — a measure is "events + optional context keys"; still one object shape, validatable. | **Hardest** — a hand array item is a *union* (note \| rest \| tempo-change \| clef-change \| …); JSON-Schema unions (`oneOf` + discriminant) are the most error-prone and verbose to express and to report errors against. |
| **Additive growth** | Best — new context dimensions are new optional keys on the section/hand-config; new event kinds are new optional keys on the event; new structural concepts are new optional keys on section/measure. Nothing forces a breaking change. | Good, but adding a context dimension means another optional key on the already-mixed measure object. | Poor — every new context kind widens the event union, and every consumer that switches on event `type` must handle the new member. |

**Conclusion (1):** Adopt **(A) the top-level sections array.** It is the most faithful to how piano scores actually segment context, keeps the grand-staff time-alignment in a single clean per-measure pairing, and yields the simplest homogeneous arrays — which directly makes the editor's structural/field conformance check (Topic 5) simplest. (C) is rejected as musically and structurally wrong for context that is inherently measure/section scoped; (B) is a viable flatter alternative but muddies the measure object and offers no decisive win, while (A) matches the prompt's already-vetted illustration and the musician's mental model.

**(2) Public field name — "chunk" vs "sections".** "Chunk" is engineering jargon with no musical meaning; an author hand-editing JSON (the only v1 authoring affordance, req 7) benefits from a word that names the concept. In notation practice these are *sections* (rehearsal sections / rehearsal letters). Conceptual precedent (NOT adopting these formats): MusicXML attaches context changes to `<measure>` via an `<attributes>`/`<direction>` element and groups with `<part>`; ABC uses inline header fields mid-tune; MIDI uses meta-events on a timeline. None uses "chunk." **Decision:** name the array **`sections`**, each element a **section** object. This is self-describing and reads naturally (`song.sections[0]`).

**(3) Metadata + defaults placement.** Two clean options: (i) top-level `metadata` + `defaults` + `sections[]` (the prompt's split), or (ii) fold song-wide context into an implicit first section.

- Option (ii) conflates two different ideas: *song-wide defaults that every section inherits* vs *the context of the first musical section*. It also makes "the song's default time signature" positional (buried in `sections[0]`), which is fragile for a hand-editor and for additive growth.
- Option (i) gives a clean inheritance story: `defaults` holds song-wide tempo / timeSignature / per-hand context; each `section` inherits and may override any of them; a `section` with no overrides simply uses `defaults`. Metadata (title, composer) is orthogonal bibliographic data and belongs in its own `metadata` object.

For req 10 (a song can be minimal) this also works: a minimal song is `{ "sections": [ { "measures": [ … ] } ] }` with `metadata`/`defaults` omitted (both optional). **Decision:** keep the **top-level `metadata` + `defaults` + `sections[]`** split; `defaults` is the single inheritance root, sections override it, events/measures are the leaves.

**(4) Additive growth without a `version` field, and strict-vs-lenient conformance.** The additive promise (req 5) means future capabilities (articulations, pedal, per-hand dynamics, voltas, tuplets, multiple voices) arrive as **new optional fields** on existing objects (event / section / measure / handConfig / pitch). For that promise to hold, **a song authored against today's format must remain conformant after the format grows** — which it does, because new fields are optional and old songs simply omit them.

The pivotal sub-decision is whether conformance **rejects unknown fields** (JSON-Schema `additionalProperties: false`) or **ignores them** (lenient). Tension:
- *Strict (reject unknown)* gives the author a helpful "you mistyped `dynmic`" signal and keeps songs clean.
- *Lenient (ignore unknown)* preserves forward-compatibility: a song that uses a field from a *future* version of the format would still validate under an older validator — important precisely because there is **no `version` field** to gate on.

The decisive consideration: the spec explicitly frames validation as an **informational aid that never blocks persistence** (req 9, AC6) and explicitly *not* a musical-timing gate (AC10) — i.e. the format leans permissive. Rejecting unknown fields would, the day we add an optional field, retroactively mark older validators as flagging newer-but-valid songs. Since the whole point of "no version field, additive growth" is that the format set only ever *grows*, **a forward-compatible validator should not hard-fail on unknown properties.** A middle path captures both benefits: **disallow unknown properties at the value level but surface them as a *warning/notice*, not a conformance failure** — however, the spec's validation model is binary (conformant → no error; non-conformant → clear error) and informational-only, so adding a third "warning" tier is scope creep.

**Decision:** conformance is **lenient on unknown object properties at the top/section/measure/handConfig/event/pitch levels — unknown properties are ignored, not errors** (JSON-Schema `additionalProperties` left permissive, i.e. *not* `false`). What IS strictly checked: required fields present, and every *recognised* field's value drawn from its allowed set / correct type / correct nesting (Topic 3 and Topic 5 define these). This honours the additive-growth promise and the "informational, permissive, never-blocks" stance, at the documented cost of not catching a misspelled optional key (an acceptable trade for a raw-JSON v1; the author still sees their literal text persisted and rendered). Enumerated *values* (durations, clefs, dynamics, barlines, note names) remain **closed** — a typo'd duration `"quaver"` IS a conformance error — because those enums are the format's vocabulary, not additive extension points.

### DECISIONS (analyst)

- **D1.1 — Top-level shape = `{ metadata?, defaults?, sections }`.** `sections` is the only required top-level member; `metadata` and `defaults` are optional. A minimal conformant song is `{ "sections": [ { "measures": [...] } ] }`. (Realizes req 3 grand-staff container + req 10 minimal song; ties to Topic 4's empty-state, where *no song at all* is the empty string, distinct from a minimal-but-present song.)
- **D1.2 — Sectioning mechanism = a top-level `sections[]` array of constant-context sections** (candidate A), each optionally overriding context and carrying `measures[]`; each measure pairs `rightHand[]` ∥ `leftHand[]` event arrays. Rejected: inline context-change events (C — musically/structurally wrong, hardest to validate) and flat measures-with-overrides (B — viable but muddies the measure object with no decisive gain). Rationale: faithful to score segmentation, cleanest hand alignment, simplest homogeneous arrays for conformance checking.
- **D1.3 — Public field name = `sections` / "section"** (not "chunk"). Self-describing for the raw-JSON author; matches the musical concept; "chunk" was engineering jargon in the illustrative prompt only.
- **D1.4 — `metadata` (title, composer) and `defaults` (song-wide tempo / timeSignature / per-hand context) are top-level siblings of `sections`; `defaults` is the single inheritance root that each section overrides.** Not folded into an implicit first section (which would make song-wide defaults positional and conflate defaults with first-section context). Inheritance: a field resolves to the section's value if present, else `defaults`, else the format's documented fallback.
- **D1.5 — Additive growth via new OPTIONAL fields on existing objects; no `version` field** (req 5). Old songs stay conformant because new fields are optional and omitted. The format set only grows.
- **D1.6 — Conformance is LENIENT on unknown object properties (ignored, not errors) but CLOSED on enumerated values.** `additionalProperties` is left permissive at every object level (forward-compatible: an older validator won't hard-fail a song using a future optional field, which matters because there is no `version` to gate on); but recognised fields are strictly type/enum/nesting-checked, and value enums (durations, clefs, dynamics, barlines, note names) are closed so typos in the format's vocabulary are caught. Trade-off recorded: a misspelled *optional* key is silently ignored rather than flagged — acceptable for raw-JSON v1 and consistent with the spec's informational-only, never-blocking, permissive validation stance (req 9, AC6, AC10).
- **D1.7 — `tempo` and `timeSignature` object shapes** (live in `defaults` and overridable per section, realizing the per-section tempo/time-signature changes of req 4.6):
  - `tempo` = `{ bpm, beatUnit? }` — `bpm` a number > 0 (beats per minute, required when `tempo` is present); `beatUnit` a **duration word** from the duration enum (`quarter`, `eighth`, …), optional (the note value the bpm counts, i.e. the "♩" in ♩=120). (req 4.7 "tempo (beats-per-minute + beat unit).")
  - `timeSignature` = `{ beats, beatType }` — `beats` an integer ≥ 1 (the upper numeral); `beatType` an **integer** in {1, 2, 4, 8, 16, 32} (the lower numeral / denominator, the conventional way a time-signature bottom number is written). (req 4.7 "time signature (beats + beat unit).")
  - *Deliberate asymmetry:* the time-signature denominator is an **integer** (notation writes "4/4" with a numeric bottom), whereas the tempo beat unit is a **duration word** (a metronome mark names a note value, "♩=120"). The spec's shared phrase "beat unit" is satisfied by both — they are the two correct domain conventions — and the distinction is documented so it is not mistaken for an inconsistency. Matches the prompt's illustrative `timeSignature.beatType` (int) vs `tempo.beatUnit` (duration).

**Traceability:** req 3 → D1.1/D1.2; req 4.6 (mid-song changes) → D1.2 (per-section overrides) + D1.7 + Topic 2; req 4.7 (time signature + tempo) → D1.7; req 5 (additive, no version) → D1.5/D1.6; req 10 (minimal/empty) → D1.1/D1.4.

## Topic 2 — Per-hand context model (clef, default accidentals, octave-shift) + inheritance

**Question.** Field names and structure for the per-hand context (req 4.5): clef, per-hand default accidentals, and the per-hand octave-shift marking (ottava). What is the octave-shift magnitude range/encoding (design-deferred; req 4.5, 4.6, 6)? What are the inheritance/override semantics between `defaults` and a `section`?

**Evidence basis.** Spec req 4.5, 4.6, 6; prompt's `handConfig` (`clef` + `alters` map) and per-chunk override example (`"rightHand": { "alters": { "F": 1 } }` with clef inherited); Western-notation domain knowledge (key signatures, ottava lines); req 6 audio-determinism constraint. No WP runtime facts; nothing to verify in-worktree.

### Investigation

**(a) The `handConfig` object — fields.** Per-hand context is one object shape, `handConfig`, used at `defaults.rightHand`, `defaults.leftHand`, and `section.rightHand`, `section.leftHand`. Its three v1 fields map 1:1 to req 4.5:
- `clef` — enum `treble | bass | alto | tenor` (req 4.5 names exactly these four).
- `alters` — the per-hand **default accidentals**: a map from note name → alteration. This is a *key-signature-like* mechanism ("every F in this hand/section sounds sharp without a per-note mark"). Keys are note names (English or Spanish, per Topic 3); values are integer alterations in **−2..+2** (double-flat … double-sharp), matching the per-note accidental range (req 4.2). The prompt's `{ "F": 1 }` is exactly this.
- the **octave-shift marking** — see (b) for name + encoding.

All three are optional; a `handConfig` may set any subset (a hand with only a clef is `{ "clef": "bass" }`).

**(b) Octave-shift — name, encoding, range.** The spec (req 4.5 + spec Q6) fixes the *concept*: a per-hand ottava marking ("play an octave higher/lower," e.g. 8va/8vb), stored as data (rendering is out of scope), and for future audio the **sounding octave = written `pitch.octave` + the shift** (req 6 determinism).

- *Encoding choice:* a **signed integer count of octaves** rather than a notation token string (`"8va"`). Rationale: (i) it combines deterministically and trivially with `pitch.octave` for audio (req 6) — `sounding = octave + shift` — whereas a `"8va"`/`"15mb"` token would need a lookup table to become a number; (ii) it is symmetric and closed (an integer range is a clean JSON-Schema check); (iii) it is additive-friendly (widening the range later is non-breaking). Field name: **`octaveShift`** (clear, camelCase consistent with the rest of the format).
- *Range:* allowed integer values **−2 … +2, excluding 0-as-noise** (0 ≡ "no shift," which is equivalently expressed by omitting the field; we allow 0 but treat it as no shift). The realistic piano ottava set is: `+1` = 8va (one octave up), `−1` = 8vb / 8va bassa (one octave down), `+2` = 15ma (two up), `−2` = 15mb (two down). 22ma (±3) is vanishingly rare on piano and is **deferred** (additively re-openable by widening the range — req 5). So the design-deferred "octave-shift magnitude range" is resolved to **integer −2..+2**.
- *Semantic note for audio (req 6):* the marking is *additional* to the per-note `octave`, which always exists; the two combine deterministically. This is recorded so the format documents the two as combinable for future audio (the spec's req-6 intent).

**(c) Inheritance / override semantics (`defaults` ⇄ `section`).** From D1.4, `defaults` is the inheritance root and a section overrides it. Two questions: (1) at what granularity does a section's `handConfig` merge, and (2) does the `alters` *map* merge or replace?

- *(1) handConfig fields inherit independently (shallow per-field merge).* The prompt's own example is decisive: section B sets `"rightHand": { "alters": { "F": 1 } }` and the annotation says "its `clef` is inherited from `defaults`." So a section providing one field of a hand's config does **not** wipe the others — `clef`, `alters`, `octaveShift` each resolve to (section value if present, else `defaults` value, else fallback). This is the least surprising rule for a hand-editor and keeps sections terse (you write only what changes).
- *(2) the `alters` map REPLACES wholesale when a section provides it.* `alters` models the *set of default accidentals in force* — the analogue of a key signature region. A key change supersedes the prior key signature entirely; it does not "add accidentals to" the previous key. So if a section provides `alters`, that map is the section's complete default-accidental set (not merged key-by-key with `defaults.alters`). This is predictable ("the section's `alters` is exactly what's shown") and avoids the confusing partial-merge question "does setting `{F:1}` keep an inherited `{B:-1}`?" — answer: no, the section's map stands alone. A section that wants *no* default accidentals while `defaults` had some sets `"alters": {}` explicitly.
- *Fallbacks when neither `defaults` nor `section` specifies:* `clef` has no universal default (treble for the right hand and bass for the left is the *conventional* grand-staff pairing, but the format does not force it — a song may omit clef entirely and a future consumer picks a sensible default); `alters` absent ≡ no default accidentals (empty); `octaveShift` absent ≡ 0 (no shift). These are documented fallbacks, not required fields.

**(d) Does this realize mid-song changes (req 4.6)?** Yes — a new `section` with a changed `clef` / `alters` / `octaveShift` (and/or `tempo` / `timeSignature`, Topic 1) *is* the mid-song change. Because sections override per field, "change only the right-hand clef at bar 9" = a new section whose `rightHand` is `{ "clef": "bass" }`, everything else inherited.

### DECISIONS (analyst)

- **D2.1 — One `handConfig` object shape**, used at `defaults.rightHand` / `defaults.leftHand` / `section.rightHand` / `section.leftHand`, with three optional v1 fields: `clef`, `alters`, `octaveShift`. (Realizes req 4.5 per-hand context; reused by Topic 1's `defaults`/`section` inheritance.)
- **D2.2 — `clef`** = closed enum `treble | bass | alto | tenor` (req 4.5).
- **D2.3 — `alters`** = a map (object) from **note name → integer alteration in −2..+2** (double-flat … double-sharp), modeling per-hand default accidentals ("every named note in this hand/section is altered by this amount unless a per-note `alter` overrides it"). Keys accept both English and Spanish note names (Topic 3) and are case-handled per Topic 3. Realizes req 4.5 "per-hand default accidentals" and the prompt's `alters` shorthand.
- **D2.4 — Octave-shift = field `octaveShift`, a signed integer in −2..+2** (`+1` 8va, `−1` 8vb, `+2` 15ma, `−2` 15mb; `0`/absent = no shift). Resolves the design-deferred magnitude range. Chosen over a notation-token string because an integer combines deterministically with `pitch.octave` for future audio (req 6: `sounding octave = octave + octaveShift`), validates as a simple closed integer range, and widens additively (22ma/±3 deferred per req 5).
- **D2.5 — Inheritance: handConfig fields inherit INDEPENDENTLY (shallow per-field merge); a section providing one field keeps the others from `defaults`.** Decisive precedent: the prompt's section B sets only `alters` and inherits `clef`. (Realizes req 4.6 terse mid-song overrides.)
- **D2.6 — The `alters` MAP replaces wholesale when a section provides it** (it is that section's complete default-accidental set, like a key-signature region — not merged key-by-key with `defaults.alters`). A section wanting none sets `"alters": {}`. Rationale: predictable "what you see is the section's full set," matches how a key change supersedes the prior key signature.
- **D2.7 — Documented fallbacks (not required fields):** `clef` absent → no forced default (treble/bass is conventional but not mandated); `alters` absent → empty (no default accidentals); `octaveShift` absent → 0. Keeps a minimal song valid (req 10) and the format permissive (D1.6).

**Traceability:** req 4.5 → D2.1–D2.4; req 4.6 → D2.5; req 6 (audio determinism) → D2.4; req 10 (minimal) → D2.7.

## Topic 3 — Event & pitch model, note-name systems, case handling, barlines

**Question.** The event structure (note/rest, duration + dots, chords via multiple pitches), the pitch structure (note name + octave + per-note accidental), the two note-name systems (English C–B + Spanish do–si) and their case handling/normalization (design-deferred), and the placement of dynamics, chord symbols, ties/slurs, and barlines incl. repeats (req 4.1–4.4, 4.8; AC5, AC9; design-deferred case handling).

**Evidence basis.** Spec req 4.1–4.4, 4.8, 6; AC5, AC9; prompt's `event` / `pitch` / `duration` / `barline` `$defs`; Western-notation domain knowledge (durations, dots, ties vs slurs, key/accidental resolution, barlines/repeats, English-letter vs Romance-solfège naming); the spec's permissive/informational validation stance (D1.6). No WP runtime facts; nothing to verify in-worktree.

### Investigation

**(a) Time-bearing leaf = the `event`.** Each hand array (`measure.rightHand[]`, `measure.leftHand[]`) is a homogeneous list of `event` objects (D1.2). v1 `event` fields:
- `type` — closed enum `note | rest` (req 4.1). Required.
- `duration` — closed enum `whole | half | quarter | eighth | sixteenth | thirty-second` (req 4.1, exactly these six). Required.
- `dots` — integer **0..2** (un-dotted, single, double dot). Optional, default 0. Range 0–2: single and double dots are standard; triple dots are vanishingly rare and deferred (additively re-openable). (req 4.1 "dotted durations.")
- `pitches` — array of `pitch` objects; **a chord is simply several pitches in one event** (req 4.3). Required & non-empty for a `note`; absent (or ignored) for a `rest`.
- `dynamic` — closed enum `pp | p | mp | mf | f | ff | sf | sfz` (req 4.8, exactly these eight). Optional.
- `chordSymbol` — **free-text string** (req 4.8). Optional. (Free text by spec — no enum.)
- `tie` — enum `start | stop` (req 4.8). Optional.
- `slur` — enum `start | stop` (req 4.8). Optional.

*Note vs rest rule:* a `note` MUST carry a non-empty `pitches`; a `rest` carries none. This is the one conditional in the data model (how the validator expresses it is Topic 5; the data rule is fixed here). *Ties/slurs are event-level start/stop markers*, not per-pitch — a documented v1 simplification (per-pitch ties within a chord are deferred, additive); it satisfies req 4.8 / AC5 which call for tie & slur as start/stop, and keeps the event flat.

**(b) `pitch` object** (req 4.2):
- `step` — the note name (English letter or Spanish solfège). Required. (Naming & case in (c).)
- `octave` — integer **0..9** (scientific-pitch-notation octave number). Required. Range 0–9 generously covers the piano (≈ A0–C8) and beyond without precluding audio (req 6); not narrowed to the piano keyboard because the format is a general song document and over-tight bounds would falsely flag transposed/extended material.
- `alter` — per-note accidental, integer **−2..+2** (double-flat … double-sharp), optional, default 0 (req 4.2). When present it **overrides** the section's `alters` default for that note (see (d)).

**(c) Note-name systems + case handling (resolves the design-deferred item).** Two equivalent systems, mixable within one song (req 4.4, AC9):
- English letters: `C D E F G A B`.
- Spanish solfège: `do re mi fa sol la si`.
- Documented equivalence (for future audio, AC9): **do=C, re=D, mi=E, fa=F, sol=G, la=A, si=B**.

No token collides across systems (no Spanish word equals an English letter), so accepting both is unambiguous. The open sub-decision is **case**:
- *Conventional case* is uppercase English (`C`) and lowercase solfège (`do`). The prompt's enum lists exactly those 13 forms (`do…si`, `C…B`) — i.e. case-*sensitive*.
- *But* the spec's validation is **informational, permissive, never-blocking** (req 9, AC6, AC10) and the raw input is **stored verbatim** (we never rewrite the author's JSON — Topic 4). Rejecting `c` or `Do` as a *structural error* would be surprising for an obviously-valid note and out of step with that stance.

**Decision: case-INSENSITIVE acceptance.** The validator accepts any case for a recognised note name — `C`/`c`, `do`/`Do`/`DO` all conform. Critically, "normalization" here means **only** (i) the validator folds case when checking membership in the note-name vocabulary, and (ii) the documented equivalence maps any accepted spelling to a canonical pitch class for future audio. It does **NOT** mean rewriting the stored JSON — req 9/AC6 require the author's literal text to persist unchanged. The **canonical forms** the format documents are uppercase English / lowercase solfège; non-canonical case is accepted but the docs recommend the canonical spelling. (This same case-insensitive vocabulary applies to the `alters` map keys, D2.3.) Net: AC9 is satisfied (both systems accepted, equivalence documented) and the deferred "case handling/normalization" question is resolved to *accept-any-case, store-verbatim, canonical-forms-documented, no stored rewriting*.

**(d) Accidental resolution (audio determinism, req 6).** For a given note, the **effective alteration** = (the note's own `alter` if present) else (the section's effective `alters` entry for that note name if present) else 0 (natural). The per-note `alter` overrides the per-hand/section default — exactly the prompt's stated rule ("a per-note `alter` overrides `alters`"). This is documented so the format yields a concrete sounding pitch deterministically (req 6): `sounding pitch = pitch-class(step) + effective alteration, in octave (octave + section.octaveShift)`.

**(e) Barlines incl. repeats — placement.** Barlines delimit **measures**, not events. So they live on the `measure` object as `barlineStart` and `barlineEnd`, each a closed enum **`regular | repeat-start | repeat-end | double | final`** (the prompt's set; covers req 4.8 "barlines including repeats"). A repeated passage is `barlineStart: "repeat-start"` (|:) … `barlineEnd: "repeat-end"` (:|) on the bounding measures. Both optional; absent ≡ a regular barline. Putting barlines on the measure (not the event stream) keeps the two hands' event arrays purely musical events and matches notation (a barline spans the staff, both hands).

**(f) Why these enums are CLOSED while objects are open.** Per D1.6, value enums are the format's *vocabulary* and are closed (a typo'd `"quaver"` duration, `"treble-clef"` clef, `"mezzo"` dynamic, or `"repeat"` barline IS a conformance error — caught and surfaced), whereas object property sets stay open for additive growth. `chordSymbol` is the deliberate exception: it is free text by spec (chord symbols are an open vocabulary like `C`, `Gm7`, `F♯dim`), so it is an unconstrained string.

### DECISIONS (analyst)

- **D3.1 — `event` object fields:** `type` (`note|rest`, required), `duration` (6-value enum, required), `dots` (int 0..2, optional default 0), `pitches` (array of `pitch`; required non-empty for `note`, omitted for `rest`), `dynamic` (8-value enum, optional), `chordSymbol` (free-text string, optional), `tie` (`start|stop`, optional), `slur` (`start|stop`, optional). (req 4.1, 4.3, 4.8; AC5.)
- **D3.2 — A chord is several `pitch` entries in one event's `pitches`** (req 4.3). A single note is a one-element `pitches`.
- **D3.3 — `note` requires non-empty `pitches`; `rest` has none.** The sole data-model conditional (validator expression deferred to Topic 5).
- **D3.4 — Ties & slurs are EVENT-level `start|stop` markers** (not per-pitch). Documented v1 simplification; per-pitch chord ties deferred (additive). (req 4.8, AC5.)
- **D3.5 — `pitch` object:** `step` (note name, required), `octave` (int 0..9, required), `alter` (int −2..+2, optional default 0). (req 4.2.) Octave range 0–9 covers piano and beyond without precluding audio (req 6).
- **D3.6 — Two note-name systems, mixable, equivalent:** English `C D E F G A B` and Spanish solfège `do re mi fa sol la si`, with documented equivalence do=C … si=B for future audio. (req 4.4, AC9.)
- **D3.7 — Note names are CASE-INSENSITIVE on validation; stored verbatim; canonical forms documented (uppercase English / lowercase solfège).** Resolves the design-deferred case-handling question. "Normalization" = validator case-folds for vocabulary membership + documented equivalence for audio; it never rewrites stored JSON (req 9/AC6). Same case-insensitive vocabulary governs `alters` keys (D2.3). (req 4.4, AC9; honours req 9/AC6.)
- **D3.8 — Accidental resolution rule (req 6 determinism):** effective alteration = per-note `alter` if present, else section `alters` for that note name, else 0; sounding octave = `octave` + section `octaveShift`. Documented so the format is audio-deterministic.
- **D3.9 — Barlines live on the `measure` as `barlineStart`/`barlineEnd`**, each closed enum `regular | repeat-start | repeat-end | double | final`; both optional (absent ≡ regular). Repeats: `repeat-start` … `repeat-end`. (req 4.8.)
- **D3.10 — Closed value enums (duration, clef, dynamic, barline, tie/slur, type) vs open object property sets** (per D1.6); `chordSymbol` is the deliberate free-text exception (req 4.8). Typos in the closed vocabularies ARE conformance errors.

**Traceability:** req 4.1 → D3.1; req 4.2 → D3.5; req 4.3 → D3.2; req 4.4/AC9 → D3.6/D3.7; req 4.8 → D3.1/D3.4/D3.9; req 6 → D3.5/D3.8; req 9/AC6 (verbatim storage) → D3.7.

## Topic 4 — `song` block-attribute typing (raw non-conformant persistence, empty default)

**Question.** How is the `song` block attribute declared in `block.json` so it persists the author's RAW input even when non-conformant (req 9, AC6) and starts empty (req 10, AC2)? What `type`, `source`, and `default`?

**Evidence basis.** Spec req 1, 9, 10; AC1, AC2, AC6. Scaffold: `src/block.json` currently declares **no** `attributes`; the block is dynamic (`save: null` — `src/index.js` registers with `edit` only; `src/block.json` has `"render": "file:./render.php"`). General WordPress Block API knowledge for attribute typing/serialization. **Verification status:** the block.json `attributes` shape (type/default) is a static schema fact (high confidence); the *runtime round-trip* (value persists into the block-delimiter comment and reappears on reload) is general WP-block knowledge that **could not be empirically re-verified in-worktree** (no `node_modules`; no running WP) — flagged for the Code phase to confirm via `npm run build` + `wp-env` (this is exactly AC1).

### Investigation

**The decisive constraint.** AC6 requires that when the author enters content that **"is not valid JSON or does not conform to the song format,"** the entered content **"is still stored in `song`."** That means `song` must be able to hold an arbitrary, possibly-non-JSON, possibly-non-conformant **string of text** — the literal textarea contents. A WordPress block attribute typed as `object` (or `array`) can only hold a parsed JSON value; it categorically **cannot** store text that is not valid JSON. Therefore:

> **`song` must be typed as `string`.** It stores the author's raw input verbatim — the exact characters typed — independent of whether that string parses as JSON or conforms to the song format.

This is forced by req 9 + AC6, and it cleanly resolves the spec's design-deferred "how the `song` attribute is typed so it can hold raw (possibly non-conformant) input": a **string**. The structured song document (Topics 1–3) is therefore the *expected content* of that string (its JSON, when conformant), **not** the attribute's declared type. The editor parses the string to validate it (Topic 5) but never substitutes the parsed object for the stored string.

**Serialization for a dynamic block.** With `save: null` and no `source` on the attribute, WordPress serializes block attributes as JSON into the block's HTML-comment delimiter: `<!-- wp:piano-block/piano {"song":"…escaped JSON string…"} -->`. The block serializer handles JSON string-escaping of the value, so storing a string (even one containing quotes, braces, `<`, `&`) round-trips faithfully (AC1). No `source` is used — `source` is for parsing values out of saved *markup*, but a dynamic block saves no markup, so the attribute lives in the delimiter comment and is delivered to `render.php` as `$attributes['song']` (a PHP string). This is the standard dynamic-block attribute path.

**Empty default (req 10, AC2).** Declare **`"default": ""`** (empty string). A freshly inserted block then has `song === ""` — the editor field (bound to the attribute, Topic 5) renders blank, and nothing is stored as song content. The **empty string is the canonical "no song yet" sentinel**, distinct from a present song (even a minimal one, D1.1). The render (Topic 6) keys off this: empty string → output nothing meaningful (AC3). Conformance validation applies only to non-empty input (req 10) — the empty string is never "non-conformant."

**Why not a richer typing.** Alternatives considered and rejected: (a) `type: object` with the parsed song — rejected, cannot store invalid JSON (violates AC6) and would force the editor to block/discard non-conformant input (violates req 9); (b) two attributes (a `string` raw + an `object` parsed) — rejected, redundant, risks divergence, and the spec mandates a *single* attribute named `song` (req 1); (c) `type: string` with a non-empty default (a starter template) — rejected, violates AC2 ("the raw-JSON field is blank and no song content is stored"). The single `string` attribute defaulting to `""` is the minimal declaration that satisfies req 1, 9, 10 and AC1, AC2, AC6 simultaneously.

### DECISIONS (analyst)

- **D4.1 — `song` is a single block attribute of `type: "string"`** declared in `src/block.json` `attributes` (req 1). It stores the author's RAW textarea input verbatim — arbitrary text, regardless of JSON validity or format conformance. This resolves the design-deferred attribute typing: **a string** (the structured song document of Topics 1–3 is the string's expected *content*, not the attribute's type).
- **D4.2 — No `source` on the attribute.** As a dynamic block (`save: null`), `song` serializes into the block-delimiter comment as JSON and is delivered to `render.php` as `$attributes['song']` (string). (req 1; AC1 round-trip — flagged for Code-phase wp-env confirmation.)
- **D4.3 — `"default": ""` (empty string)** → a freshly inserted block has `song === ""`, the field is blank, no song content stored (req 10, AC2). The empty string is the canonical "no song" sentinel, distinct from a present (even minimal) song; conformance applies only to non-empty input.
- **D4.4 — Single attribute only** (no parallel raw/parsed attributes); rejected richer typings (object, dual attributes, non-empty default) each violate one of req 1 / req 9 / AC2 / AC6. The lone `string` + `""` default is the minimal declaration satisfying all of req 1, 9, 10 and AC1, AC2, AC6.

**Traceability:** req 1 (single `song` attribute) → D4.1/D4.4; req 9 + AC6 (store raw non-conformant) → D4.1; req 10 + AC2 (empty default) → D4.3; AC1 (persist/round-trip) → D4.2 (Code-phase verifies).

## Topic 5 — Editor-side conformance validation approach + error surfacing

**Question.** How is FULL structural/field conformance defined (single source of truth) and performed in the editor, and how is a clear error surfaced WITHOUT blocking persistence (req 8, 9; AC4, AC6, AC10)? Structural/field only, no musical-timing. What validator: a bundled JSON-Schema-validator dependency vs hand-written checks? Where/how does the error appear, and which WP editor components?

**Evidence basis.** Spec req 7, 8, 9, 10; AC2, AC4, AC5, AC6, AC9, AC10; the constraint that the *song format* (not editor tooling) is what must be dependency-free (req 2); the live scaffold (`src/edit.js` is a JSX placeholder using `@wordpress/block-editor` + `@wordpress/i18n` imports — so the editor build already consumes `@wordpress/*` packages); the project's demonstrated zero-runtime-dependency ethos (`package.json` has no runtime deps; everything is WP externals + Biome). **Verification status:** the architecture (string→parse→schema-check→Notice, non-blocking) rests on standard React/WP-data-flow + `@wordpress/components` knowledge; the specific components (`TextareaControl`, `Notice`, `PlainText`) and their props are **general WP knowledge, not re-verified in-worktree** (no `node_modules`) — Code phase/`design-doc-reviewer` should confirm component names/props against the installed `@wordpress/components`/`@wordpress/block-editor` versions.

### Investigation

**(a) Single source of truth — what defines "conformance."** The spec frames the check as "the level of checking a JSON Schema expresses" and notes it "implies a canonical, machine-checkable definition of the format." The format from Topics 1–3 is **small and closed**: ~6 object shapes (`song`, `metadata`, `defaults`/`handConfig`, `section`, `measure`, `event`, `pitch`) + a handful of closed value enums + a few integer ranges + one `note`→`pitches` conditional. Three ways to make it machine-checkable:

| Option | Single source of truth | Dependency | Fit |
|---|---|---|---|
| **(i) Real JSON Schema (draft 2020-12) + a JSON-Schema validator lib (e.g. `ajv`)** | the schema doc | **adds `ajv`** (~100KB+ bundled into the editor script) | Maximally faithful to "canonical machine-checkable definition"; but pulls a non-trivial runtime dependency into the editor, against the project's zero-dep ethos. |
| **(ii) A declarative schema-as-data object (the JSON-Schema subset the format uses) as the source of truth + a small purpose-built validator that interprets that subset** | the schema-as-data object | **none** | Keeps a single declarative, machine-readable definition AND zero dependencies; the validator only implements the keyword subset actually used (`type`, `required`, `properties`, `items`, `enum`, `$ref`/`$defs`, integer `minimum`/`maximum`, permissive `additionalProperties`, one `if/then`). |
| **(iii) Hand-written imperative validator only; schema documented in prose/JSON Schema in the design doc** | validator code + doc | none | Simplest code, but the "single source of truth" splits between the doc and the code (drift risk) and there is no runnable canonical schema. |

**Decision: (ii) — a declarative schema-as-data object is the single source of truth, interpreted by a small purpose-built validator; no third-party validator dependency.** Rationale:
- *Honors the spec's "canonical machine-checkable definition"* — the schema object IS that definition, in code, and doubles as documentation (it can be published verbatim in the design doc / README).
- *Honors the project's zero-runtime-dependency identity* — the scaffold added nothing beyond WP externals + Biome; bundling `ajv` would be the first runtime dependency, and the *song format* dependency-free mandate (req 2) sets the tone even though it technically governs the format, not tooling.
- *Bounded effort* — because the schema uses only a small, known keyword subset, the validator is a small recursive walk (estimated ~100–150 lines), not a general JSON-Schema engine. The note→pitches conditional (D3.3) is a single special case.
- *Errors are first-class* — a purpose-built walker can produce **human-readable, path-pointed messages** ("`sections[0].measures[1].rightHand[0].duration`: `quaver` is not an allowed duration") tuned for the raw-JSON author, rather than a generic validator's terse output.

`ajv` + a literal JSON Schema (option i) is recorded as the considered alternative; **swap trigger:** if the format later grows enough that the hand-rolled walker becomes a maintenance burden (many conditionals, cross-references), adopting `ajv` + the same schema (now consumed by `ajv` instead of the hand walker) is a low-cost, localized change because the schema-as-data is already the source of truth.

**(b) What the validator checks (req 8 + AC10).** Conformance for **non-empty** input (empty string is the "no song" state, never validated — D4.3, req 10):
1. **Valid JSON first** — the string must `JSON.parse` without throwing; a parse failure IS a conformance error (AC6: "not valid JSON *or* does not conform").
2. **Structural/field conformance** against the schema (Topics 1–3): required fields present (`sections`; per-object requireds like event `type`+`duration`, pitch `step`+`octave`); recognised fields' values in their **closed enums** (durations, clefs, dynamics, barlines, tie/slur, type, beatType) — note names checked **case-insensitively** (D3.7); correct **types** and **nesting** (arrays where arrays are required, objects where objects are required); **integer ranges** (octave 0–9, `alter`/`alters` −2..+2, `dots` 0–2, `octaveShift` −2..+2, tempo `bpm` > 0, timeSignature `beats` ≥ 1); the **`note`→non-empty `pitches`** conditional (D3.3); **unknown object properties IGNORED** (D1.6 leniency).
3. **Explicitly NOT checked (AC10):** measure-duration arithmetic (events summing to the time signature) and right/left-hand time-alignment — these are the author's responsibility in v1; a structurally-conformant but musically-unbalanced song is **accepted**.

**(c) Non-blocking persistence (req 9, AC6).** The data flow makes persistence unconditional:
1. On every change to the field, the edit component calls `setAttributes({ song: rawText })` — **always**, before/independent of validation. The raw string is what persists (Topic 4).
2. Validation is a **pure, presentational side-computation** on the current `song` string: parse + schema-check → produce zero-or-more error messages.
3. The errors are rendered as a visible notice; they **never** gate `setAttributes`, never clear the field, never substitute a parsed value. So a non-conformant song is both flagged AND stored (AC6), and validation is informational-only (req 9).

**(d) Error surfacing — components & placement (req 8 "clear, visible error").** The block's only interaction is the raw-JSON field, so the **edit component renders it on the block canvas**: a labeled multi-line text field plus, beneath it, an error notice shown only when validation fails on non-empty input.
- *Field:* `TextareaControl` from `@wordpress/components` (accessible, labeled, simplest correct control for multi-line raw text) — or `PlainText` from `@wordpress/block-editor` for a chrome-less code-like field. Recommend `TextareaControl` (label + help affordances; monospace via a class). 
- *Error:* a `Notice` from `@wordpress/components` with `status="error"`, `isDismissible={false}`, rendered only when there are validation errors and the field is non-empty. The message is a clear, human-readable summary (the first error with its JSON path, or a short list). Using an **error-status** Notice satisfies req 8's "clear, visible error" while remaining non-blocking (a Notice is presentational; it does not prevent saving). (A `warning` status would also be defensible given informational-only semantics, but req 8 says "error," so error-status it is, with the non-blocking behavior coming from the data flow in (c), not from the notice severity.)
- *States:* empty field → no notice (req 10/AC2); conformant → no notice (AC4); non-conformant/invalid-JSON → the error notice (AC6). 
- *Placement choice:* block **canvas** (primary, discoverable for the "edit JSON directly" v1 use) over the inspector sidebar; sidebar is recorded as a viable alternative. i18n: all user-facing strings (label, help, error templates) wrapped via `@wordpress/i18n` `__()` (consistent with the scaffold's `src/edit.js`).

**(e) Validation flow (summary).** `onChange(text)` → `setAttributes({ song: text })` (always) → if `text` is empty: clear errors → else: `try { JSON.parse(text) } catch → [invalid-JSON error]`, else run schema-validator → set the resulting error list → render `Notice` iff non-empty list. (Debouncing the validation for very large inputs is an optional perf nicety, not required — Out of Scope perf.)

### DECISIONS (analyst)

- **D5.1 — The format's single source of truth is a DECLARATIVE schema-as-data object** (the JSON-Schema subset the format uses: `type`/`required`/`properties`/`items`/`enum`/`$ref`+`$defs`/integer `minimum`/`maximum`/permissive `additionalProperties`/one `if/then`), held in `src/`. It is both the machine-checkable definition the spec calls for and publishable documentation. (req 8.)
- **D5.2 — Validation is performed by a SMALL purpose-built validator that interprets D5.1's schema; NO third-party validator dependency** (no `ajv`). Rationale: the format is small/closed → a bounded recursive walk; honors the project's zero-runtime-dependency ethos (the *song format* dependency-free mandate, req 2, sets the tone); enables human-readable, path-pointed error messages for the raw-JSON author. **Considered alternative:** real JSON Schema + `ajv` (option i) — rejected for bundle weight/dep; **swap is low-cost later** because the schema-as-data is already the source of truth.
- **D5.3 — Conformance = valid JSON THEN structural/field check.** Invalid JSON is itself a conformance error (AC6). Structural/field check = required fields, closed-enum membership (note names case-insensitive per D3.7), types, nesting, integer ranges (octave 0–9; `alter`/`alters`/`octaveShift` −2..+2; `dots` 0–2; tempo `bpm`>0; timeSignature `beats`≥1, `beatType`∈{1,2,4,8,16,32}), and the `note`→non-empty-`pitches` conditional (D3.3). Unknown object properties are ignored (D1.6). (req 8.)
- **D5.4 — NO musical-timing validation** (no measure-duration arithmetic, no hand time-alignment) — a structurally-conformant but unbalanced song is accepted (AC10).
- **D5.5 — Persistence is unconditional and validation is presentational only.** `setAttributes({ song: rawText })` fires on every change, independent of validity; the validator's output never gates saving, clears the field, or substitutes a parsed value. (req 9, AC6.)
- **D5.6 — Error surfaced as a non-dismissible error-status `Notice` (`@wordpress/components`) beneath the field, on the block canvas**, shown only for non-empty, non-conformant input; the field is a `TextareaControl` (alt: `PlainText`). No notice for empty (AC2) or conformant (AC4) input. All strings i18n-wrapped via `@wordpress/i18n`. **(Component names/props are general WP knowledge — Code phase to confirm against installed package versions.)** Placement on canvas chosen over sidebar (primary v1 interaction); sidebar recorded as alternative. (req 8.)
- **D5.7 — Validation applies only to non-empty input; the empty string is never non-conformant** (req 10, AC2) — consistent with D4.3.

**Traceability:** req 7 (raw-JSON field) → D5.6; req 8 (full structural/field conformance + clear error) → D5.1/D5.2/D5.3/D5.6; req 9 + AC6 (informational, never blocks, raw stored) → D5.5; AC4 (conformant → no error) → D5.3/D5.6; AC10 (no timing checks) → D5.4; AC9 (both note systems) → D5.3 (case-insensitive enums, D3.7); req 10/AC2 (empty) → D5.7.

## Topic 6 — `render.php` serialization, escaping, empty-state output, wrapping element

**Question.** How does `render.php` serialize the stored content to a string and escape it safely (req 11–13; AC7, AC8)? What does it output for the empty state (req 12, AC3)? What is the render output formatting (compact vs pretty) and wrapping element (design-deferred)?

**Evidence basis.** Spec req 11, 12, 13; AC3, AC7, AC8; the live `src/render.php` (current body: `<p <?php echo get_block_wrapper_attributes(); ?>> … esc_html_e( … ) … </p>`); Topic 4's decision that `song` is a **string** attribute; established WordPress output-escaping semantics (`esc_html()`, `get_block_wrapper_attributes()`). **Verification status:** `esc_html()` escaping behavior and `get_block_wrapper_attributes()` returning a pre-escaped attribute string are well-established core-WP facts (high confidence), but were **not empirically re-verified in-worktree** (no running WP) — the AC8 XSS check and AC3/AC7 output should be confirmed by the Code phase via `wp-env` (a `song` containing `<script>`/`<`/`&`/quotes renders escaped; an empty block renders nothing).

### Investigation

**(a) "Serialize the stored content to a string" is trivial because the stored content IS a string.** Per Topic 4, `song` is a `string` attribute holding the author's raw text verbatim. So `render.php` does **not** re-serialize or re-encode anything — it reads `$attributes['song']` (already a string) and outputs it. Crucially, it must **NOT** run `wp_json_encode()` / `json_decode()` on it: re-encoding would transform the author's literal text (re-escaping, reordering, or — for non-JSON input — failing), violating req 11's "outputs **whatever is stored**" and the passthrough model. The output is the stored string, full stop.

This also **resolves the design-deferred "compact vs pretty" formatting question: neither — verbatim passthrough.** Because the stored value is raw text (Topic 4), its formatting is exactly whatever the author typed (their own indentation/newlines or single-line). `render.php` does not pretty-print, minify, or reflow it. There is no formatting decision to make at render time; the author's text is emitted as-is (escaped).

**(b) Escaping — the security decision (req 13, AC8).** The stored string is arbitrary author input and may contain HTML-significant characters (`<`, `>`, `&`, `"`, `'`) or script (`<script>…`). It is emitted as a **text node** inside the wrapper element, so the correct, sufficient WordPress escaper is **`esc_html()`**: it converts `&`, `<`, `>`, `"`, `'` to HTML entities, so any markup or script in the stored content renders as inert visible text and **cannot execute** (no XSS) — satisfying AC8. The value is passed through `esc_html()` immediately before echoing.
- *Do not double-escape the wrapper:* `get_block_wrapper_attributes()` returns an **already-escaped** attribute string and is echoed directly into the opening tag (NOT wrapped in `esc_attr()` — that would double-escape; same rule the scaffold already follows).
- *Why `esc_html` and not `wp_kses`/raw:* the requirement is to output the content as a *string* (text), not as sanitized HTML — there is no intent to allow any markup through, so `esc_html` (escape everything) is both the simplest and the safest choice. `wp_kses_post` (allow some tags) would be wrong (the song is text, not rich HTML) and riskier.

**(c) Wrapping element (resolves the design-deferred wrapping element).** The content is (when conformant) multi-line JSON text, and even when non-conformant it is free text. The most fitting semantic wrapper for emitting preformatted, whitespace-significant text is **`<pre>`**, carrying the standard block wrapper attributes via `get_block_wrapper_attributes()`. `<pre>` preserves the author's newlines/indentation so the emitted song reads as the text it is.
- Recommended shape: `<pre <?php echo get_block_wrapper_attributes(); ?>><?php echo esc_html( $song ); ?></pre>`.
- *Alternatives:* a `<div>` (loses whitespace semantics) or the scaffold's `<p>` (semantically wrong for multi-line preformatted text). An inner `<code>` inside `<pre>` (`<pre><code>…</code></pre>`) is a defensible semantic refinement but adds nothing functional; recorded as optional. **Decision: `<pre>` with the wrapper attributes** (single element, whitespace-preserving, minimal).

**(d) Empty state (req 12, AC3).** When `song` is empty — the default `""` (Topic 4 D4.3), or the key is absent on an older instance — `render.php` outputs **nothing**: no wrapper element, no content. This most literally satisfies req 12 ("nothing meaningful") and AC3 ("no song content is output").
- *Reading safely:* `$song = $attributes['song'] ?? '';` (null-coalesce to avoid a PHP 8 "Undefined array key" warning under `WP_DEBUG` if the attribute is unset — the same `WP_DEBUG`-cleanliness discipline the scaffold design established). Then treat **empty as `'' === trim( (string) $song )`** so a whitespace-only value is also "nothing meaningful." On empty → early return / emit nothing (no `<pre>`).
- *Alternative considered:* emit an empty `<pre>` wrapper for styling consistency — rejected for AC3 clarity ("no song content is output" reads most cleanly as *no element at all*). Recorded as the alternative if a future need for a consistent empty wrapper arises.

**(e) No render-time validation (req 11, Out of Scope).** `render.php` performs **no** parsing, validation, or well-formedness check — it treats `song` purely as opaque text. Non-conformant or non-JSON content is output the same way (escaped). The only branch is the empty check in (d). This keeps render a pure, safe passthrough and matches the spec's "performs no validation … outputs whatever is stored."

**(f) Resulting `render.php` body (illustrative, for the writer/Code phase).**
```php
<?php
/**
 * Server-rendered output for the Piano block (dynamic block).
 * Outputs the stored song (raw text) escaped; nothing when empty. No validation.
 *
 * Exposed: $attributes (array), $content (string), $block (WP_Block).
 */
$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';
if ( '' === trim( $song ) ) {
	return; // Empty/no song → output nothing meaningful (req 12, AC3).
}
?>
<pre <?php echo get_block_wrapper_attributes(); ?>><?php echo esc_html( $song ); ?></pre>
```
(Illustrative only — the Design doc / Code phase finalizes exact form; the load-bearing decisions are D6.1–D6.5.)

### DECISIONS (analyst)

- **D6.1 — `render.php` outputs the stored `song` string verbatim (passthrough); NO re-serialization/`wp_json_encode`/`json_decode`.** Because `song` is already a string (Topic 4), "serialize to a string" is satisfied by emitting it as-is. (req 11, AC7.)
- **D6.2 — Resolves design-deferred formatting: VERBATIM, neither compact nor pretty.** The author's own text/whitespace is emitted unchanged; render never reflows it. (Consequence of Topic 4 raw-text storage.)
- **D6.3 — Escape with `esc_html( $song )`** when echoing (text-node context) → HTML-significant chars and `<script>` become inert entities, no XSS (req 13, AC8). Echo `get_block_wrapper_attributes()` directly into the tag, NOT via `esc_attr()` (avoid double-escaping). `esc_html` (escape-all) chosen over `wp_kses*` (the song is text, not rich HTML).
- **D6.4 — Wrapping element = `<pre>` carrying `get_block_wrapper_attributes()`** (resolves the design-deferred wrapping element); whitespace-preserving and fitting for multi-line JSON/text. Alternatives `<div>`/`<p>` (lose whitespace semantics) and an inner `<code>` (optional) recorded. Single element, minimal.
- **D6.5 — Empty state outputs NOTHING** (no wrapper, no content) when `song` is empty/unset/whitespace-only — read safely as `$attributes['song'] ?? ''` then `'' === trim(...)` (also `WP_DEBUG`-clean). (req 12, AC3.) Alternative (empty wrapper) recorded and rejected for AC3 clarity.
- **D6.6 — No render-time validation or well-formedness handling** — `song` is opaque text; non-conformant/non-JSON content is emitted (escaped) identically; the only branch is the empty check. (req 11; Out of Scope render validation.)

**Traceability:** req 11 (output stored content as string, no validation) → D6.1/D6.6; req 12 + AC3 (empty → nothing) → D6.5; req 13 + AC8 (escaped, no XSS) → D6.3; AC7 (front end contains the stored song serialized) → D6.1/D6.4; design-deferred formatting → D6.2; design-deferred wrapping element → D6.4.

---

## Design Q&A complete

All six design topics are settled with evidence and D-numbered decisions, each traced to a spec requirement / acceptance criterion / explicitly-deferred item. The decisions form a coherent whole:

- **Data model (Topics 1–3):** `song` is a JSON document `{ metadata?, defaults?, sections }`; `sections[]` of constant-context sections (clean grand-staff time-alignment, simplest conformance), each overriding `defaults` per field, containing `measures[]` that pair `rightHand[]` ∥ `leftHand[]` event arrays; events are note/rest + duration(+dots) + pitches(chord) + dynamic/chordSymbol/tie/slur; pitches are step + octave + per-note alter; per-hand context = clef + `alters` (default accidentals) + integer `octaveShift` (−2..+2); barlines on measures; English + Spanish note names, case-insensitive on validation, stored verbatim; additive growth via optional fields with leniency on unknown properties but closed value enums.
- **WordPress mechanics (Topics 4–6):** `song` is a single `string` block attribute defaulting to `""` (stores raw, possibly-non-conformant input; empty by default); the editor stores raw text unconditionally and validates non-empty input against a declarative schema-as-data (single source of truth) via a small purpose-built validator (no `ajv` dependency), surfacing a non-blocking error-status `Notice` beneath a `TextareaControl` on the block canvas; `render.php` is a safe verbatim passthrough — `esc_html( $song )` inside a `<pre>` wrapper, nothing when empty, no validation.

**Resolution of the spec's design-deferred items:**
- exact JSON structure & field names → Topics 1–3 (D1.1–D1.4, D2.1–D2.7, D3.1–D3.10);
- how `song` is typed to hold raw (possibly non-conformant) input → Topic 4 (D4.1: a `string`);
- octave-shift magnitude range → Topic 2 (D2.4: integer −2..+2);
- note-name case handling / normalization → Topic 3 (D3.7: case-insensitive accept, store verbatim, canonical forms documented);
- render output formatting (compact vs pretty) + wrapping element → Topic 6 (D6.2 verbatim; D6.4 `<pre>`).

**Format-additivity (req 5)** is preserved end-to-end: no `version` field; future capabilities are optional fields; the validator is lenient on unknown properties.

**Caveats for `design-doc-writer` / `design-doc-reviewer` / Code phase:** WordPress-runtime claims (attribute round-trip into the block-delimiter comment; `@wordpress/components` `TextareaControl`/`Notice` names+props; `esc_html`/`get_block_wrapper_attributes` behavior) are stated from established WP knowledge but were **not empirically re-verified in this worktree** (no `node_modules`, no running WP). They should be confirmed in the Code phase via `npm run build` + `wp-env` against the acceptance criteria — specifically AC1 (round-trip), AC3 (empty renders nothing), AC8 (XSS escaping). This research was conducted solely by `design-doc-analyst` because `design-doc-researcher` was unresponsive throughout the phase (team lead notified).
