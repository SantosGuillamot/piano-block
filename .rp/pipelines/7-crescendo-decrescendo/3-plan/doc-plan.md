# Doc Plan: Crescendo and decrescendo (gradual dynamics, note to note)

## Overview

This feature adds a **gradual-dynamic span** to the Piano block's song format: a
crescendo (growing louder) or a decrescendo (growing softer) that runs from a start
note to a later end note within a single hand, authored as two new optional per-event
JSON fields (`crescendo` and `decrescendo`, each `"start" | "stop"`, mirroring the
existing `tie`/`slur`), and rendered on the grand-staff SVG as a **hairpin wedge**
(`<` for a crescendo, `>` for a decrescendo). It is a notation/rendering feature only
— it does not affect how the song sounds; there is still no audio engine, and audio
remains explicitly out of scope. The documentation work updates the project's two
existing doc surfaces — the canonical author reference `docs/song-format.md` and the
top-level `README.md` — so that the format reference, the contributor narrative, and
the forthcoming/scope framing all reflect the shipped fields and are honest about the
v1 limitations. No new doc files are created; we extend the same surfaces the song-JSON
storage and grand-staff rendering features already established.

These are the only two documentation files in the repository (`AGENTS.md` and `.rp/…`
are excluded — see below); there is no changelog, no inline narrative doc, and no
separate examples file, so every surface that mentions dynamics, ties/slurs, the closed
vocabularies, additive growth, or the out-of-scope set lives in these two files and is
covered by a task here. Note that the annotated example is described by **two parallel
enumerations** — the example's own intro sentence in `docs/song-format.md` and a
"it touches …" callout in `README.md` that links to the same example — and Task 3 owns
**both** so they stay consistent after the example is extended.

### Conventions every task must follow

- **Match the real, shipped code.** The doc-writer executes these tasks in phase 5 by
  reading the actual implementation (`src/song/schema.js`, the renderer under
  `src/notation/`) and the existing prose around each edit. Field names, allowed
  values, and example syntax must be copied from what shipped, not invented here.
- **Mirror the existing `tie`/`slur` documentation style.** The new fields are
  byte-for-byte symmetric with `tie`/`slur`; document them the same way, in the same
  places, with the same level of detail — do not introduce a new documentation pattern.
- **Use the real event JSON shape.** In this format a note's pitches live in a
  `pitches` array on the event (e.g. `{ "type": "note", "duration": "quarter",
  "crescendo": "start", "pitches": [ { "step": "C", "octave": 4 } ] }`). Author-facing
  examples must use that real shape (the same way the existing example carries `tie`),
  not any flattened `step`/`octave`-on-the-event shorthand.
- **No pipeline references in shipped docs.** Per `AGENTS.md`, shipped docs must read as
  a standalone project: do **not** cite the internal pipeline, its phases, or its
  artifacts (no "AC#", "Req#", "T#", "design §", "review N", "spec", "design doc",
  "code plan") anywhere in `README.md` or `docs/song-format.md`. Those references in
  this plan are for the doc-writer's orientation only.
- **Faithful scope — document only what v1 ships.** Document the hairpin form only. Do
  **not** document a `cresc.`/`dim.` text form, between-staves placement, audio/playback
  loudness, a visual authoring UI, or full cross-system split rendering — these are
  deferred or out of scope. Be explicit about the v1 limitations (see Task 2's scope).

## Tasks

### Task 1: Document the `crescendo` / `decrescendo` event fields in the song format reference

- **Goal:** Make the two new optional per-event fields a first-class, discoverable part
  of the canonical field reference, documented exactly the way `tie`/`slur` already are,
  so an author can express a crescendo or a decrescendo (and a messa-di-voce hinge)
  correctly by reading this doc alone.
- **Audience:** Song authors writing raw song JSON by hand.
- **Files to change:** `docs/song-format.md` (update — the "Events" section, currently
  around the event grammar block and its field bullet list; the section already
  documents `dynamic`, `tie`, and `slur`).
- **Sections / scope:**
  - Add `crescendo` and `decrescendo` to the event grammar block (the `event := { … }`
    listing) alongside the existing `tie?` / `slur?` entries, with the same comment
    style, showing each as an optional `start | stop` enum field.
  - Add a field bullet (mirroring the existing `tie`/`slur` bullet) explaining that
    these are event-level `start | stop` markers and that **direction is intrinsic to
    which field is used** — a crescendo and a decrescendo are two distinct markings and
    the direction is never inferred from surrounding point dynamics.
  - Clarify the relationship to the existing point `dynamic`: a gradual-dynamic span is
    independent of and additive to the per-note `dynamic`; a point dynamic may sit at a
    span's start, its end, both, or neither, and is not required.
  - Note that the two fields are independent, and that a single note may carry **both**
    at once (`crescendo: "stop"` together with `decrescendo: "start"`) to express the
    messa-di-voce hinge between two adjacent spans.
- **Depends on:** none
- **Traces to:** Spec requirements 1, 2, 4, 16 (authoring a per-hand directional span,
  author-chosen direction, independence from point dynamics, messa di voce as two
  spans); acceptance criteria AC1, AC7; code task that adds the `crescendo`/`decrescendo`
  enum fields to the schema.
- **Acceptance:**
  - A reader can identify both new field names, that each is optional, and that each
    takes only the values `start` and `stop`, copied from the shipped schema.
  - The doc states that direction is chosen by which field carries the marker and is
    never inferred from point dynamics.
  - The doc states that a span and a point dynamic are independent — a point dynamic at
    a span's start/end/both/neither is all valid.
  - The doc shows or describes that one note may carry both fields to form a
    messa-di-voce hinge.
  - The two fields are presented in the same place and style as the existing `tie`/`slur`
    documentation (no new, divergent pattern).
  - No pipeline/process references appear in the added text.

### Task 2: Add a gradual-dynamics explanation with the v1 scope limits to the song format reference

- **Goal:** Give authors a short conceptual section that explains what a gradual-dynamic
  span *is* and how it renders, and that is honest about the v1 limitations so the docs
  do not overpromise.
- **Audience:** Song authors.
- **Files to change:** `docs/song-format.md` (update — add a focused subsection near the
  event/marking documentation; the existing "Intro and mental model" mentions only the
  per-note point dynamic, so this is where the gradual form is introduced).
- **Sections / scope:**
  - Define a gradual-dynamic span: a crescendo or decrescendo running from a start note
    to a *later* end note **within a single hand** (specified independently per hand),
    expressed with the start/stop markers from Task 1.
  - Describe the rendered form: a hairpin wedge drawn on the grand staff — an opening
    wedge `<` for a crescendo and a closing wedge `>` for a decrescendo — spanning from
    the start note's horizontal position to the end note's, and continuous across any
    barlines it crosses within a line of music.
  - State the **placement**: the wedge is drawn per hand, below that hand's own staff (in
    the same below-staff region where the point dynamics already sit). (Do not assert
    exact offsets/aperture values — those are tuning constants the doc-writer should not
    pin.)
  - State the **v1 limitations** plainly:
    - Hairpin form only — the `cresc.`/`dim.` text-with-dashed-line form is not part of
      v1.
    - Per-hand placement below each hand's staff (the strict between-staves grand-staff
      convention is a possible future refinement, not v1).
    - A span whose start and end fall on two different rendered lines (systems) draws
      only the portion on the start line; the continuation onto the next line is not
      drawn in v1.
    - Overlapping/nesting two same-kind spans in one hand is undefined (tolerated without
      breaking, but no defined result), and a true single-note one-directional span is
      not expressible.
  - Reaffirm that this is **notation only** — it has no effect on how the song sounds
    (there is no audio engine), keeping the existing audio-out-of-scope framing.
  - Optionally cross-link to the README's front-end rendering section the way the
    existing format doc already cross-links, so an author knows where the rendered
    output is described.
- **Depends on:** Task 1
- **Traces to:** Spec requirements 6, 7, 9, 10, 14, 15, 17, 19 and the Out-of-Scope list
  (hairpin rendering, per-hand below-staff placement, cross-barline continuity,
  cross-system start-portion-only limit, undefined overlaps, single-note out of scope,
  audio out of scope); acceptance criteria AC3, AC4, AC9; the renderer code tasks
  (hairpin builder, cross-system clip, `renderHairpin`).
- **Acceptance:**
  - A reader understands what a gradual-dynamic span is, that it lives within one hand,
    and that it renders as a `<` (crescendo) or `>` (decrescendo) hairpin distinct from
    one another.
  - The doc states the hairpin-only limitation (no `cresc.`/`dim.` text form in v1).
  - The doc states the per-hand below-staff placement.
  - The doc states the cross-system behavior honestly: only the start-line portion is
    drawn in v1.
  - The doc states that overlapping same-kind spans are undefined and that a single-note
    span is not expressible.
  - The doc preserves the framing that the marking is notation/visual only and does not
    affect playback (no audio engine).
  - No `cresc.`/`dim.` text form, between-staves placement, or audio behavior is
    documented as a v1 capability.
  - No pipeline/process references appear in the added text.

### Task 3: Extend the annotated example song with crescendo, decrescendo, and a messa-di-voce hinge

- **Goal:** Give authors a copy-pasteable, valid example that exercises the new fields —
  a crescendo over a run of notes, a separate decrescendo over a run of notes, and a
  messa-di-voce hinge note carrying both — so they can see the real JSON shape in
  context and adapt it.
- **Audience:** Song authors.
- **Files to change:**
  - `docs/song-format.md` (update — the "Annotated example song" section: the example
    JSON block and its introductory sentence listing what it exercises).
  - `README.md` (update — the "Exercising the renderer" callout in the "The song format
    and validator" subsection: a blockquote that links to the same annotated example and
    independently enumerates what it "touches"). This is the README twin of the example's
    intro sentence; extending the example in `docs/song-format.md` makes this callout's
    list incomplete, so both enumerations must move together.
- **Sections / scope:**
  - Add to the existing example (or a clearly-scoped extension of it) a crescendo span
    spanning two or more notes in one hand and a separate decrescendo span spanning two
    or more notes, using the real `crescendo`/`decrescendo` `start`/`stop` markers on
    events that carry their pitches in the `pitches` array (matching how the example
    already carries `tie: "start"` / `tie: "stop"`).
  - Include a messa-di-voce hinge note that carries both `crescendo: "stop"` and
    `decrescendo: "start"`, demonstrating two adjacent spans sharing a note.
  - Keep the example **valid and copy-pasteable** (no comments inside the JSON), so it
    still validates and renders if pasted into the block.
  - Update the introductory sentence in `docs/song-format.md` that enumerates what the
    example exercises so it mentions the crescendo, the decrescendo, and the messa di
    voce, consistent with how that sentence already lists the tie, dynamics, etc.
  - Update the README "Exercising the renderer" callout's parallel "it touches …"
    enumeration the same way, so the README's description of the linked example stays
    consistent with the extended example (it should mention the crescendo, the
    decrescendo, and/or the messa-di-voce gradual dynamics). Match the callout's existing
    list style; do not duplicate field-level detail (the README continues to defer that
    to the format reference).
  - Preserve the existing note that the example is not required to be timing-balanced.
- **Depends on:** Task 1
- **Traces to:** Spec requirements 1, 2, 4, 16; acceptance criteria AC1, AC3, AC7; the
  schema and renderer code tasks. The validate-layer tests for AC1 mirror exactly this
  kind of "a crescendo span plus a separate decrescendo span" song. The README
  "Exercising the renderer" callout update traces to the same requirements/criteria —
  keeping the README's description of the linked example consistent with the extended
  example so the two parallel enumerations do not drift.
- **Acceptance:**
  - The example contains at least one crescendo span over two or more notes and at least
    one separate decrescendo span over two or more notes.
  - The example includes a single note carrying both `crescendo: "stop"` and
    `decrescendo: "start"` (the messa-di-voce hinge).
  - The new markers appear on events whose pitches are in the `pitches` array, matching
    the real format and the rest of the example (no flattened-event shorthand).
  - The example remains valid, comment-free JSON that an author can paste directly into
    the block.
  - The `docs/song-format.md` introductory sentence listing what the example exercises is
    updated to include the gradual dynamics.
  - The README "Exercising the renderer" callout's "it touches …" enumeration is updated
    so it stays consistent with the extended example — it mentions the gradual dynamics
    (crescendo/decrescendo/messa di voce) rather than under-describing the example it
    links to. The two enumerations of the same example (README callout and
    `docs/song-format.md` intro sentence) agree.
  - No pipeline/process references appear in the added text.

### Task 4: Update the closed-vocabulary / additive-growth notes in the song format reference

- **Goal:** Keep the format reference's conformance rules accurate: the new fields are
  optional (so older songs stay valid), their misspelled field names are silently
  ignored, and their values are validated against a closed `start | stop` set.
- **Audience:** Song authors (with an eye to conformance behavior).
- **Files to change:** `docs/song-format.md` (update — the "Additive growth (no
  `version` field)" section, which lists the closed enumerated vocabularies and the
  unknown-field-ignored / closed-enum rules).
- **Sections / scope:**
  - Add the two new fields to the list of closed enumerated vocabularies that are checked
    strictly (the list that currently names durations, clefs, dynamics, barlines,
    `tie`/`slur`, `type`, `beatType`), so a value outside `start | stop` is documented as
    a conformance error.
  - Confirm the additive-growth behavior applies: the fields are optional, an existing
    song that uses no gradual dynamics stays valid and unchanged, a misspelled *optional*
    field name (e.g. a typo of `crescendo`) is silently ignored, and start/stop pairing
    is **not** a conformance check (a dangling marker still validates — pairing is
    resolved best-effort at render time, exactly like `tie`/`slur`).
- **Depends on:** Task 1
- **Traces to:** Spec requirement 3, 20; acceptance criteria AC1, AC2, AC5; the schema
  code task (two enum fields, zero new validator logic).
- **Acceptance:**
  - The closed-vocabulary list names the new fields as strictly value-checked
    (`start | stop`), so a reader knows an out-of-set value is a conformance error.
  - The doc conveys that the fields are optional and additive — an existing song without
    them is unaffected.
  - The doc conveys that a misspelled optional field name is silently ignored and that a
    dangling/unbalanced span marker is not a conformance error.
  - The new fields are treated identically to `tie`/`slur` in this section (same rule,
    same wording pattern).
  - No pipeline/process references appear in the added text.

### Task 5: Update the README closed-vocabulary, additive-growth, and forthcoming/scope notes

- **Goal:** Keep the top-level README consistent with the shipped feature: the
  contributor-facing conformance notes list the new fields, the additive-growth backlog
  no longer implies gradual dynamics are unbuilt, and the forthcoming/scope framing still
  correctly excludes audio while reflecting that this notation marking has landed.
- **Audience:** Contributors and readers scanning the project overview.
- **Files to change:** `README.md` (update — the "The song format and validator"
  contributor subsection's conformance-policy bullets and additive-growth paragraph, and
  the "Forthcoming" section). Note: the "Exercising the renderer" callout in this same
  subsection is **owned by Task 3** (it enumerates the annotated example's contents and
  must move with the extended example); this task does not touch that callout.
- **Sections / scope:**
  - In the conformance-policy "Enumerated values are closed" bullet (which lists
    durations, clefs, dynamics, barlines, tie/slur, `type`, `beatType`), add the two new
    fields so the closed-vocabulary list stays complete.
  - In the additive-growth paragraph, ensure the example of "new optional fields on
    existing objects" remains accurate now that `crescendo`/`decrescendo` are real fields
    on `event`; if the out-of-scope/backlog list there names gradual dynamics or similar
    as not-yet-built, reconcile it so it does not contradict the shipped feature. (The
    audio, visual-authoring-UI, and richer-notation backlog items that remain unbuilt
    stay listed.)
  - In "Forthcoming" / the "out of scope" set: **preserve the audio-out-of-scope
    framing** (audio playback is still future work; this marking is notation-only and has
    no sonic effect). Reconcile the "Richer notation elements" item so it does not
    present gradual dynamics as unbuilt — but do not remove the still-deferred items
    (audio, visual authoring UI, and the remaining notation backlog).
  - Optionally note, consistent with how the README already references shipped
    capabilities, that gradual dynamics (crescendo/decrescendo hairpins) are now part of
    the rendered notation, pointing to the format reference for detail rather than
    repeating field-level content (the README defers field detail to
    `docs/song-format.md`).
- **Depends on:** Tasks 1, 2, 4 (README should not contradict the format reference and
  defers field-level detail to it)
- **Traces to:** Spec requirements 3, 11 and the Out-of-Scope list (additive growth,
  no regression to existing markings, audio out of scope); acceptance criteria AC2, AC8;
  the schema and renderer code tasks.
- **Acceptance:**
  - The README's closed-enum list includes the two new fields.
  - The additive-growth and forthcoming/scope text does not present gradual dynamics
    (crescendo/decrescendo) as unbuilt future work.
  - The audio-out-of-scope framing is preserved (audio playback remains listed as not in
    v1; the marking is described as notation-only with no sonic effect).
  - The still-deferred items (audio, visual authoring UI, remaining richer-notation
    backlog) remain present and are not deleted.
  - The README continues to defer field-level detail to `docs/song-format.md` rather than
    duplicating the field reference.
  - No pipeline/process references appear in the added or edited text.
