# Spec research — Issue #7: crescendo and decrescendo (note to note)

> Phase-1 running record. Driven by `spec-analyst` via Q&A with `spec-researcher`.
> Goal (from phase-0 prompt): a song can express **crescendo** and **decrescendo**
> — gradual volume changes spanning from one note to another — reflected in the
> **rendered sheet music**. Constraint: **notation / rendering only**; audio and
> playback loudness are explicitly out of scope.

## Ground truth from the phase-0 prompt

- A crescendo grows louder; a decrescendo grows softer; each spans a run of notes
  (note to note), not a single fixed point.
- Today each note carries at most a single fixed `dynamic` (one of
  `pp | p | mp | mf | f | ff | sf | sfz`).
- The outcome wanted: express a *gradual* change across a span of notes, shown in
  the notation the block renders.
- Out of scope (binding): making it actually change how the song *sounds* (audio).

## Codebase facts gathered before Q&A (analyst pre-read)

- **Song format** is a bespoke, dependency-free JSON document (not MusicXML/ABC/MIDI),
  modelling a grand staff (right hand + left hand). Authored by hand as raw JSON;
  no visual editor yet; front end renders an SVG grand staff.
- **Events** (`measure.rightHand[]` / `measure.leftHand[]`) carry: `type`, `duration`,
  `dots?`, `pitches?`, `dynamic?`, `chordSymbol?`, `tie?`, `slur?`. Existing span-like
  markers `tie` and `slur` are event-level `start | stop` enums.
- **Dynamics today** (`event.dynamic`) are a per-event point marking, rendered as text
  below the hand's staff (`collectEventTexts` → `kind: "dynamic"`).
- **Existing span machinery** (directly analogous to a hairpin): `tie`/`slur` use
  `matchSpans` (stack-based start/stop pairing, dangling-safe) projected per hand across
  the whole hand (`projectMarker` / `recordSpanMarkers` / `resolveAllSpans`), then drawn
  as Béziers, clipped at system edges for cross-system spans.
- **Ottava brackets** are another span analogue: a horizontal dashed bracket+label drawn
  above/below the staff, restated per wrapped system, spanning a run of notes.
- **Format growth rule:** additive, no `version` field; new fields are optional; unknown
  optional fields are silently ignored; closed enums are validated strictly.
- **Schema** is data-driven (`schema.js`), validated by a small JSON-Schema-subset walker.
- **Out-of-scope note already in docs:** "How a stored pitch resolves to a sounding pitch"
  is explicitly forward-looking; there is no audio in v1.

## Status

**FINALIZED.** Four Q&A rounds completed (Q1 notation domain; Q2 exact existing span
machinery + edge-case behavior; Q3 which rendered forms to require; Q4 direction,
dynamic-span edge cases, audio boundary). The consolidated **Requirements specification**
(R0–R5 + Open Questions) is at the bottom of this file. Open questions that affect scope
but belong to Design/owner are recorded there as OQ-1..OQ-4 (not blockers).

## Q&A log

(Questions sent to `spec-researcher` one at a time; answers recorded as they arrive.)

### Q1 — What is a crescendo/decrescendo as a notation marking (domain)?

**Findings (grounded in MuseScore, Soundslice, Dorico, Wikipedia, Andrew Downes):**

- A crescendo (gradually louder) / decrescendo (a.k.a. diminuendo, gradually softer)
  is a **gradual dynamic**: a volume change spread incrementally over a **span**, as
  opposed to the **point/immediate dynamics** (pp..sfz) the block already has, which
  mark a single instant. It is inherently a *spanning* marking.
- **Two standard written forms** (equivalent in meaning):
  1. **Hairpin** (the graphic): a long thin wedge of two straight lines meeting at a
     point — `<` (crescendo) or `>` (decrescendo). The default form for **shorter**
     spans (up to a few bars).
  2. **Text**: the words `cresc.` / `dim.` (or `decresc.`), conventionally followed by a
     **dashed continuation line** (`cresc. - - - -`) for **longer** spans (typically
     4+ measures), because over a long span a drawn hairpin's lines get too near-parallel
     to read.
- **Hairpin geometry / orientation:** an open/closing **angle** (a wedge — vertex on one
  end, open mouth on the other), NOT a curve.
  - **Crescendo** = "open hairpin": closed point on the LEFT, opening rightward → `<`.
  - **Decrescendo** = "closed hairpin": open mouth on the LEFT, closing rightward → `>`.
  - Aperture/angle are engraving niceties; the invariant is "two lines from a shared
    point, opening toward louder."
- **Placement** is context-dependent: above the staff with lyrics; **between the two
  staves on a grand-staff (keyboard) instrument** (the conventional home for piano);
  otherwise below. NOTE: a tension to resolve in design — the block today draws its point
  `dynamic` text **below each hand's staff** (svg.js:845-860, fixed y≈3.5), NOT between
  the staves. The spec should require correct, legible notation but **not** pin the exact
  lane (that's a design decision).
- **Relation to existing point dynamics:** very commonly a hairpin/cresc.-text begins
  and/or ends AT a point dynamic ("from `p` to `f` gradually"), with the letters
  anchoring the ends and engravers aligning them. But this is a **convention, not a
  requirement** — a hairpin can appear with a dynamic at one end, both ends, or neither.
  The gradual marking is **conceptually independent** of the point dynamics: it is a
  separate marking drawn between them; it does **not** subsume or replace `event.dynamic`.
- **What it connects:** conceptually a **horizontal time range** (start rhythmic position
  → end rhythmic position). In authoring tools you create it by selecting the notes it
  encompasses, so it is anchored by a **start note and an end note** with the wedge/text
  drawn across the intervening extent. It can cross barlines and (when wrapped) systems —
  exactly like the block's existing ties/slurs and ottava brackets (which already clip to
  system edges). Authoring view = "start note → end note" (note-anchored); rendered view =
  "the horizontal range between them." Both coincide; it lives **within one hand's stream**.
- **Advanced nicety flagged, likely out of scope:** Dorico's "two consecutive same-direction
  hairpins separated by a point dynamic, shown as one continuous hairpin or collapsed to
  `cresc.---`". Recorded as an open question; default OUT of scope unless owner wants it.

**One-line summary:** a crescendo/decrescendo is a gradual-dynamic **span** from a start
note to an end note (within one hand), drawn as a hairpin wedge (`<` crescendo, `>`
decrescendo) or, for long spans, `cresc.`/`dim.` text with a dashed line; conventionally
placed between the grand staff's two staves; commonly anchored at point dynamics but not
requiring them; naturally crossing barlines/systems like existing tie/slur/ottava spans.

### Q2 — Exact, observable behavior of the existing tie/slur span machinery

The new gradual-dynamic span is structurally identical to tie/slur, so this pins the
precedent it would inherit. All behaviors below are render-time best-effort; the
validator checks nothing semantic about pairing. (Cited file:line + tests.)

Pipeline: `projectMarker` (layout.js:1132) → `matchSpans` (layout.js:1102, single-pending-start
depth-1 stack) → `recordSpanMarkers` (layout.js:2110, one entry per event, `anchor: null`
for rest/unplaceable) → `resolveAllSpans` (layout.js:2149, skips a pair if either anchor is
missing) → `buildSpanSpec` (layout.js:2185). Validation: `schema.js:146-147` constrains
`tie`/`slur` to `enum: ["start","stop"]`; `validate.js` is structural/enum-only (header
29-32), no tie/slur special case (263-271).

1. **Per-hand scoping:** YES — matched independently per hand; RH start cannot pair with
   LH stop. `placedEvents = { rightHand, leftHand }` (layout.js:1650), two separate
   `recordSpanMarkers` calls (1827-1840), `resolveAllSpans` loops per hand (2151). Code-guaranteed.
2. **Dangling start** (incl. start on the hand's last note): silently dropped, nothing drawn,
   no throw. `matchSpans` never pushes a leftover `pendingStart` (1118-1119). Locked: unit
   test (layout.test.js:1140-1142) + no-throw integration test (1410-1449).
3. **Dangling stop:** silently dropped, nothing drawn, no throw (1110-1116). Locked
   (layout.test.js:1144-1146).
4. **Double start** (start while one pending): earlier start dropped; only the most-recent
   start pairs with the next stop (1107-1109). Locked → `[start,start,stop]` ⇒
   `[{startIndex:1, stopIndex:2}]` (layout.test.js:1148-1157).
5. **Nesting / overlap:** NOT supported for the same kind in one hand (depth-1 stack).
   `start,start,stop,stop` ⇒ exactly ONE span `{1→2}`, the trailing stop dangles → dropped.
   (Consequence of 4+3; no test feeds the literal 4-token sequence.) Tie vs. slur are
   matched in SEPARATE passes (2153), so a tie and a slur CAN overlap/nest freely.
6. **Single-note / start==stop on same event:** not expressible per kind — `projectMarker`
   collapses each event to ONE marker (the enum is `start|stop`). Start+stop on two notes at
   the SAME laid-out X ⇒ a degenerate near-zero-width arc, still DRAWN, no min-length guard
   (2195-2196). **OPEN/flagged:** no test pins the degenerate-width case.
7. **Across barlines / wrapped systems:** draws across measures (markers accumulate across all
   measures before matching); the START's system owns the span (`systemIndex: start.systemIndex`,
   `crossSystem` flag at 2203/2210-2211; pushed to `systems[sp.systemIndex].spans` 1883-1888).
   Across-barline same-system is locked (layout.test.js:1298-1303, 1580-1593). **OPEN/flagged
   CAVEAT:** NO test exercises a span whose endpoints land on DIFFERENT wrapped systems, and
   `renderSpan` (svg.js:823-833) draws a plain `M…Q…` path with **no visible clip logic** —
   so cross-system clipping may be aspirational/under-implemented. The design phase must verify,
   not assume. Directly affects a crescendo that wraps a line.
8. **Anchor on a rest / unplaceable note:** the marker is STILL recorded (matching never
   desyncs — a rest with `tie:"start"` still consumes the pending slot), but the resulting
   span is SKIPPED at draw time if either endpoint anchor is `null` (2113-2133, 2161-2163).
   So "recorded-but-not-drawn." Code-guaranteed.
9. **Validation vs. rendering split:** pairing is PURELY render-time best-effort; the
   validator checks NOTHING about it. A BAD ENUM VALUE *is* a conformance error
   (`tie:"begin"` flagged — validate.test.js:288-298; `dynamic:"mezzo"` flagged —
   validate.test.js:254-264); a misspelled OPTIONAL FIELD NAME is silently ignored
   (song-format.md:259-266). A dangling/double/overlapping pairing is NOT a conformance
   error — the song validates and the renderer best-effort-drops the unmatched marker.

**Inherited-for-free if the new span reuses this machinery:** per-hand scoping, dangling/
double-start tolerance (silent drop, never throw), cross-measure spanning, recorded-but-not-
drawn on a rest anchor, enum-checked-but-pairing-unvalidated. **Two gaps the spec must call
out as edge cases / open design risks:** (a) cross-WRAPPED-SYSTEM clipping (case 7 caveat);
(b) degenerate single-/zero-width span (case 6).

### Q3 — Which rendered notation form(s) must v1 support?

1. **Block scope-narrowing precedent:** The project's *stated* value is incrementalism —
   "A sensible first slice could be a single staff with basic notes, then grow"
   (render-feature prompt .rp/pipelines/4-render-sheet-music/0-prompt/prompt.md:28) and the
   "Additive growth (no version field)" philosophy (song-format.md:259-266). But in *practice*
   the one notation feature shipped (commit a91aae4) landed a broad set at once — ties, slurs,
   dynamics, ottava, beaming, chords, accidentals, repeats, tempo, measure numbers — refined
   over SIX owner review rounds (those rounds polished layout, not the set of notation types).
   Reading: the project ships **one notation feature end-to-end per issue** and tends to render
   the **full convention for that feature** rather than a half-cut, scoping at the feature
   boundary (e.g. "static notation, NO playback"). Deferring a *secondary form* of the same
   marking to grow later is consistent with additive growth **as long as what ships is correct**;
   there is no precedent for shipping a deliberately-incomplete rendering of a marking type.
2. **Is hairpin-only a defensible v1? YES.** Hairpin-only is **correct for any length**, merely
   **less legible / less conventional** past ~4 bars — NOT wrong. The two forms are functionally
   identical in meaning (MuseScore: "anything that refers to hairpins also applies to cresc./dim.
   lines"); a reader does not misread a long hairpin. The switch-to-text convention (Gould,
   "Behind Bars") is a **legibility/polish** rule (long hairpin lines go too near-parallel to
   read), not a correctness rule, kicking in around 4+ measures. So a hairpin is the
   conventionally-**preferred** form for the common short case and a correct-but-less-polished
   form for long spans.
3. **Form choice = author's, not renderer's.** In MuseScore and Dorico, hairpin-vs-text is a
   **deliberate authoring choice** (separate palette items; `<` makes a hairpin specifically),
   NOT auto-selected by span length; Dorico allows per-item override (and dim. vs decresc.).
   Factual implication only: if v1 ever supports BOTH forms, the established convention is
   author-selected form; if v1 ships ONE form, no form-choice need be carried at all. (Not a
   field design — just the convention.)
4. **Rendering-cost asymmetry: none material.** TEXT form (`cresc.`/`dim.` + dashed line) has a
   **near-direct existing precedent** — `renderOttava` (svg.js:934-957) already draws an italic
   label + a dashed `<line>` (`stroke-dasharray "0.6 0.4"`) over a run (derived in
   layout.js:2356-2401); a "cresc. ----" is structurally the same element. HAIRPIN form (`<`/`>`)
   has **no** existing primitive but is just **two straight `<line>`s sharing a vertex** via the
   existing `line(x1,y1,x2,y2,width)` helper (svg.js:104-113) — simpler math than the existing
   Bézier tie/slur or beam geometry. Net: both are cheap; text slightly cheaper (ottava precedent),
   hairpin is the conventionally-preferred default for the common short span.

**Grounding for the requirements call (not a decision):** A hairpin-only v1 is fully defensible
— preferred for short spans, correct (not wrong) for long ones, trivial to render. Adding the
text form is low marginal cost and would polish long crescendos but is not required for
correctness. If both ever coexist, form is author-selected. Sources: MuseScore handbook,
Dorico gradual-dynamics pages, Gould "Behind Bars" (via Quora/Andrew Downes), the render-feature
prompt + git history.

### Q4 — Direction, crescendo-specific edge cases, and the audio boundary

**A. Direction (crescendo vs. decrescendo):**
- **Direction is INHERENT and author-chosen; the data MUST distinguish the two and it is NOT
  derivable.** `<` and `>` are two distinct symbols; direction is intrinsic, not inferred
  (Wikipedia "Dynamics"). It cannot be derived from point dynamics — a hairpin often has a
  dynamic at one end or neither, and the same dynamic pair can bracket either a `<` or a `>`
  (e.g. `< >` between two `p`s). The existing tie/slur precedent does NOT carry a
  direction/kind inside one marker (tie-vs-slur is encoded as two separate fields), so the
  new marking needs a way to express direction that tie/slur lack. (How to model it — a
  direction value vs. two field names — is a **design decision**; the requirement is only
  that direction be expressible and author-chosen.)

**B. Dynamic-span edge cases (notation truth + what the existing machinery does):**
- **Single note:** a true single-note one-directional hairpin is **degenerate** (a hairpin's
  job is to show change ACROSS notes; one note has ~no horizontal extent → near-zero-width
  wedge). The tie/slur one-marker-per-event shape can't put start+stop of one kind on a single
  event anyway. **Spec stance: out of scope / degenerate.** (The meaningful single-note arc is
  messa di voce — see below.)
- **Crossing measures / wrapped systems:** nothing crescendo-specific breaks; same as
  tie/slur (markers accumulate across measures before matching). Same UNVERIFIED
  cross-wrapped-system clipping caveat (Q2#7) applies — and a wedge that wraps is actually
  trickier than a Bézier: convention splits it, leaving an open mouth on the continuation
  (Soundslice). Design phase must verify.
- **Overlapping / nesting two same-kind spans in one hand:** not idiomatic for a single line
  (a part has one dynamic trajectory at a time); the depth-1 matcher would **mangle** it
  (`start,start,stop,stop` ⇒ one span + dropped stop). **Spec stance: explicitly out of scope
  / undefined** — "one gradual-dynamic span of a given kind open at a time per hand." (Note: if
  crescendo & decrescendo are modeled as separate fields like tie-vs-slur, a `<` and a `>`
  could overlap, but two `<`s never could — a design detail.)
- **Messa di voce (`< >`):** treat as **two adjacent spans** (crescendo then decrescendo
  abutting), NOT a special combined primitive — Dorico itself treats it as a pair. Sequential
  abutting spans are handled fine by the matcher (no overlap). **FLAG for design:** the hinge —
  one note being both the *stop* of the `<` and the *start* of the `>` — is the one place a
  tie/slur-style one-marker-per-kind-per-event shape pinches (a single field couldn't hold both;
  the `>` would have to start on the NEXT note). Recorded as an open design question; affects
  whether perfect messa di voce is expressible.
- **Per-hand vs. both-hands:** a piano gradual dynamic conventionally governs the WHOLE
  instrument (hence placed BETWEEN the staves). A strict per-hand span is therefore a **known
  simplification** (slightly misrepresents the default reading) — but per-hand independent
  dynamics do occur, and per-hand is **consistent with how the block already treats point
  `dynamic`** (drawn below each hand's staff, not between) and with tie/slur/ottava. **Spec
  stance: per-hand acceptable for v1 as a conscious, documented simplification;** between-staves/
  both-hands placement noted as a future refinement. (Ties to the Q1 placement tension.)

**C. Audio / out-of-scope boundary (verified from the codebase):**
- **No audio/playback/velocity/MIDI/playhead code exists anywhere** in src/, PHP, or docs
  (grep). Only matches are deferral docs (block.json:9; song-format.md:9,250-257; README.md)
  and the cosmetic `"icon": "format-audio"` Dashicon (block.json:8). The existing `dynamic`
  field is purely bold-italic **text** below the staff (svg.js:845-860, layout.js:1550-1557)
  with zero sound effect because no audio engine exists. song-format.md:250-257 frames the
  whole sounding-pitch model as forward-looking ("no audio in v1").
- **Precise boundary:** IN SCOPE = the crescendo/decrescendo is **expressible in the song JSON**
  and **DRAWN in the rendered SVG** sheet music (a notation marking, like existing `dynamic`
  text). EXPLICITLY DEFERRED = any effect on loudness/sound (vacuously satisfied — nothing reads
  dynamics for playback). The marking is text/graphics only, exactly like every existing marking.
- **Already-declared out-of-scope items the spec boundary should match** (README ~169-176;
  render prompt 4-render-sheet-music/0-prompt/prompt.md:29): **audio playback**; **a visual
  authoring UI** (authoring stays hand-written JSON — NO hairpin-drawing UI / palette /
  click-to-add); **richer notation** (articulations, ornaments, pedal, fingering, tuplets,
  voltas, multiple voices, lyrics); a **visual playhead / audio-synced highlighting**; **MIDI/
  velocity export or numeric velocity values**. Plus (recommend) overlapping same-kind spans,
  true single-note one-directional spans, and messa di voce as a dedicated combined marking.

**One-line boundary:** IN SCOPE — author can express a crescendo and a distinct decrescendo as
a gradual-dynamic SPAN in the song JSON, and the renderer DRAWS it on the grand staff (notation
only, no sound), reusing the per-hand span machinery; OUT OF SCOPE — any loudness/audio effect,
a visual authoring UI, a playhead/audio-synced highlight, MIDI/velocity, overlapping same-kind
spans, true single-note one-directional spans, and a dedicated messa-di-voce primitive.

---

# Requirements specification — Issue #7 (crescendo / decrescendo, note to note)

> Derived from the Q&A above. **Notation/rendering only** (binding phase-0 constraint).
> Requirements state the *what* (outcome + testable behavior); they deliberately avoid
> *how* (data-shape, field names, rendering-library/primitive choices) — those belong to
> Design and are recorded as Open Questions where they affect requirements. "MUST" =
> required for this issue; "SHOULD" = strongly recommended, owner may defer; "MAY" =
> optional / future.

## R0 — Scope premise (confirmed against owner intent)

The owner's goal is unchanged and confirmed sound: a song can express a **gradual**
volume change spanning **from one note to another** (a crescendo growing louder, a
decrescendo growing softer), reflected in the **rendered sheet music**, with audio
deferred. Research confirmed this maps cleanly onto the block's existing per-hand,
start/stop span machinery (tie/slur/ottava) and adds a small new rendering primitive.

## R1 — Authoring: expressing a gradual dynamic in the song JSON

- **R1.1 (MUST)** The song format MUST let an author express a **gradual-dynamic span**
  that runs from a **start note to an end note within a single hand's event stream**
  (`measure.rightHand[]` / `measure.leftHand[]`), independently per hand.
- **R1.2 (MUST)** The author MUST be able to **choose the direction**: a **crescendo**
  (growing louder) and a **decrescendo** (growing softer) are two distinct markings.
  Direction is intrinsic author-supplied data — it MUST NOT be inferred from point
  dynamics or anything else (Q4-A).
- **R1.3 (MUST)** The new field(s) MUST follow the format's **additive-growth** rules:
  optional (an existing song with no gradual dynamics stays valid and unchanged), with
  unknown/misspelled optional field names silently ignored, and any **closed enum value**
  validated strictly (a bad value is a conformance error) — mirroring how `tie`/`slur`/
  `dynamic` already behave (Q2#9, song-format.md additive-growth section).
- **R1.4 (MUST)** The gradual-dynamic span MUST be **independent of, and additive to**, the
  existing per-event point `dynamic`. It neither replaces nor requires point dynamics; an
  author MAY place point dynamics at a span's ends (the common `p … <  … f` reading) but
  the span MUST be valid with a dynamic at one end, both, or neither (Q1#3, Q4-A).
- **R1.5 (SHOULD)** Authoring remains **raw hand-written JSON** — no visual UI / palette /
  click-to-add for hairpins (consistent with the block's declared scope; Q4-C).

## R2 — Rendering: showing the marking in the sheet music

- **R2.1 (MUST)** The renderer MUST DRAW a gradual-dynamic span on the rendered grand-staff
  SVG, visually distinguishing crescendo from decrescendo, spanning horizontally from the
  start note's position to the end note's position.
- **R2.2 (MUST)** The default/required rendered form MUST be the **hairpin wedge**: an
  **opening** wedge `<` (point on the left, opening rightward) for a crescendo and a
  **closing** wedge `>` (open on the left, closing rightward) for a decrescendo (Q1#2).
  Hairpin-only is correct notation for any span length (Q3#2), so it is a complete v1.
- **R2.3 (SHOULD/MAY)** The **text form** (`cresc.` / `dim.` with a dashed continuation
  line) for long spans is a recommended polish but **NOT required** for correctness in v1.
  If included, the conventional form choice is **author-selected**, not auto-by-length
  (Q3#3, Q3#4). *(Whether to include it at all is an Open Question for the owner — OQ-1.)*
- **R2.4 (MUST)** A span MUST render correctly when it **crosses barlines** within a system
  (drawn continuously across the intervening measures), exactly as ties/slurs do today
  (Q2#7, Q4-B).
- **R2.5 (MUST)** Placement MUST be legible and not collide with notes/staff lines. The
  **exact lane** (between the staves vs. below a staff) is a **design decision** — the spec
  requires correct, legible placement but does NOT pin the lane (Q1#2, Q4-B6). Per-hand
  placement consistent with the block's existing point `dynamic` (below each staff) is an
  acceptable v1 simplification (R3.4).
- **R2.6 (MUST)** Drawing a gradual-dynamic span MUST NOT alter or regress the rendering of
  any existing marking (point dynamics, ties, slurs, ottava, beams, chords, accidentals,
  barlines, tempo, measure numbers).

## R3 — Edge cases (each MUST have a defined, testable outcome — never a crash)

- **R3.1 (MUST) Robust, never-throws matching.** A **dangling start**, **dangling stop**,
  or **double start** of a gradual-dynamic span MUST be handled best-effort and MUST NOT
  throw or corrupt the rest of the render — the unmatched marker is silently not drawn,
  matching the existing tie/slur behavior (Q2#2-4).
- **R3.2 (MUST) Anchor on a rest / unplaceable note.** A span endpoint that lands on a rest
  or an unplaceable note MUST NOT throw; the span is best-effort not drawn (recorded-but-
  not-drawn), as ties/slurs do today (Q2#8).
- **R3.3 (MUST) Overlapping / nesting same-kind spans in one hand is OUT OF SCOPE /
  undefined.** At most one gradual-dynamic span of a given kind is open at a time per hand;
  overlapping same-kind spans are not supported and MUST NOT crash (the matcher best-effort-
  collapses them). This matches notation practice (a single line has one trajectory) and the
  depth-1 matcher (Q4-B, Q2#5).
- **R3.4 (MUST) Per-hand is an accepted, documented simplification.** A span applies to a
  single hand (like tie/slur). The ideal grand-staff convention (one marking between the
  staves governing both hands) is a noted future refinement, NOT required for v1 (Q4-B6).
- **R3.5 (SHOULD) Messa di voce (`< >`) via two adjacent spans.** A crescendo immediately
  followed by a decrescendo SHOULD be expressible as two adjacent spans, not a dedicated
  combined marking. *(The shared-note "hinge" — one note being both the stop of the `<` and
  the start of the `>` — may not be perfectly expressible depending on the data shape; see
  OQ-2.)*
- **R3.6 (Out of scope) True single-note one-directional span** is degenerate and OUT OF
  SCOPE (Q4-B2). A span connects a start note to a *later* end note.
- **R3.7 (MUST) Validation matches the rendering split.** The validator MUST accept any
  structurally/enum-valid use of the new field even if its pairing is dangling/unbalanced
  (pairing is render-time best-effort, not a conformance check) — and MUST reject a bad
  closed-enum value. Mirrors tie/slur (Q2#9).

## R4 — Out of scope (explicit, binding boundary)

- **Audio / playback loudness** — any effect on how the song *sounds*. There is no audio
  engine in the codebase at all (verified, Q4-C); the marking is **notation/graphics only**,
  like every existing marking. (Binding phase-0 constraint.)
- **A visual authoring UI** for hairpins (palette, click-to-add, drag) — authoring stays
  raw JSON.
- **Visual playhead / audio-synced note highlighting**, MIDI export, numeric velocity
  values — all already-declared deferrals (render prompt + README; Q4-C8).
- **Overlapping same-kind spans**, **true single-note one-directional spans**, and a
  **dedicated messa-di-voce primitive** (handled as two spans).
- **The text form (`cresc.`/`dim.` + dashed line)** is out of scope UNLESS the owner opts in
  (OQ-1); hairpin-only fully satisfies the goal.

## R5 — Acceptance criteria (testable)

1. A song JSON can be authored that expresses a crescendo over a run of ≥2 notes in one
   hand, and a separate decrescendo over a run of ≥2 notes, and it **validates with no
   errors**. (R1.1, R1.2, R3.7)
2. An existing song with no gradual dynamics validates and renders **byte-for-byte
   unchanged** by the feature's data additions (additive growth). (R1.3, R2.6)
3. The rendered SVG shows an **opening wedge `<`** for the crescendo and a **closing wedge
   `>`** for the decrescendo, each spanning from its start note's X to its end note's X,
   visibly distinct from one another. (R2.1, R2.2)
4. A span whose start and end are in **different measures of the same system** renders as one
   continuous hairpin across the barline. (R2.4)
5. A bad enum value for the new field is reported as a **conformance error**; a misspelled
   optional field name is **silently ignored**. (R1.3, R3.7)
6. Each of these inputs renders **without throwing** and without corrupting other markings:
   a dangling start, a dangling stop, a double start, a span endpoint on a rest, and two
   overlapping same-kind spans in one hand. (R3.1, R3.2, R3.3)
7. A point `dynamic` may appear at a span's start and/or end, or at neither, and in all
   cases the span and the point dynamic both render (independently). (R1.4)
8. Existing markings (point dynamics, ties, slurs, ottava, beams, chords, accidentals,
   barlines, tempo, measure numbers) render unchanged alongside the new marking. (R2.6)

## Open questions for Design / the owner (affect requirements scope)

- **OQ-1 (owner):** Does v1 require **only the hairpin**, or also the **`cresc.`/`dim.` text
  form** for long spans? Research: hairpin-only is correct & sufficient; the text form is
  low-cost polish (near-direct ottava precedent) and conventionally author-selected. *Default
  if unanswered: hairpin-only (R2.2), text deferred (R2.3).*
- **OQ-2 (design):** The **data shape** for the span — direction encoding (a direction value
  vs. two separate start/stop field pairs like tie-vs-slur) and start/end anchoring. This is
  a design decision, but it determines whether the **messa-di-voce hinge** (R3.5) and any
  single-note case are expressible. Spec only requires that direction be expressible and
  author-chosen (R1.2) and that messa di voce be possible as two spans (R3.5).
- **OQ-3 (design, with code risk):** **Cross-wrapped-system rendering** of a span. The
  existing tie/slur cross-system clipping is **unverified and possibly under-implemented**
  (`renderSpan` draws a plain path with no visible clip logic; Q2#7, Q4-B). A hairpin that
  wraps is conventionally split with an open mouth on the continuation (Soundslice). Design
  must decide and verify behavior for a span that wraps a line; the spec requires non-crashing,
  legible output but does not mandate a specific split rendering for v1. *(Recommend: at
  minimum render the within-system portion correctly and never crash; full split-with-open-
  mouth is a SHOULD/MAY.)*
- **OQ-4 (design):** **Placement lane** (between the staves — the strict grand-staff
  convention — vs. below each hand's staff, matching the block's existing point `dynamic`).
  Per-hand below-staff is an accepted v1 simplification (R3.4); between-staves is the future
  refinement.