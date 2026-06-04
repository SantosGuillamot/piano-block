# Spec: Crescendo and decrescendo (gradual dynamics, note to note)

## Overview

The Piano block stores a song as a custom JSON document modelling a grand staff
(a right-hand part and a left-hand part) and renders it on the front end as
visual sheet music drawn in SVG. Today the only loudness marking a song can carry
is a per-note **point dynamic** (one fixed level such as `p`, `mf`, `ff`, drawn as
text near the staff). There is no way to express a *gradual* change in loudness —
a **crescendo** (growing louder) or a **decrescendo** (growing softer) — that
unfolds across a run of notes.

This feature lets an author express a **gradual-dynamic span** in the song JSON:
a crescendo, and a distinct decrescendo, each running from a start note to a later
end note within a single hand, and the renderer draws that span on the grand staff
as a **hairpin wedge** (`<` for a crescendo, `>` for a decrescendo). This is a
**notation/rendering feature only**: the marking is expressible in the data and
visible in the rendered notation, exactly like every existing marking. It does not
affect how the song sounds — there is no audio engine in the block, and giving the
marking any effect on loudness is explicitly deferred.

## Requirements

Terminology: **MUST** = required for this feature; **SHOULD** = strongly
recommended, the owner may defer; **MAY** = optional / future. A
**gradual-dynamic span** is a crescendo or a decrescendo running from a start note
to a later end note within one hand. A **point dynamic** is the existing per-note
fixed loudness marking (`pp | p | mp | mf | f | ff | sf | sfz`). A **hairpin** is
the graphic form of a gradual dynamic: two straight lines meeting at a shared
vertex — an opening wedge `<` for a crescendo, a closing wedge `>` for a
decrescendo.

### Authoring (expressing the marking in the song JSON)

1. **MUST** — An author can express a gradual-dynamic span that runs from a start
   note to a later end note within a single hand's event stream (the right-hand or
   the left-hand part), specified independently per hand. A span connects a start
   note to a *later* end note in the same hand.
2. **MUST** — The author chooses the direction. A crescendo (growing louder) and a
   decrescendo (growing softer) are two distinct markings, and the direction is
   intrinsic author-supplied data. The direction must not be inferred from point
   dynamics or anything else: the same surrounding point dynamics can bracket
   either direction, so it cannot be derived.
3. **MUST** — The marking follows the song format's additive-growth rules: it is
   optional, so an existing song that uses no gradual dynamics stays valid and
   renders exactly as before; an unknown or misspelled optional field name is
   silently ignored rather than rejected; and any closed set of allowed values for
   the new marking is validated strictly, so a value outside that set is a
   conformance error. This mirrors how the existing `tie`, `slur`, and `dynamic`
   markings already behave.
4. **MUST** — A gradual-dynamic span is independent of, and additive to, the
   existing per-note point dynamic. It does not replace or require point dynamics.
   An author may place point dynamics at a span's start and/or end (the common
   "from `p` gradually to `f`" reading), but the span must be valid and render with
   a point dynamic at one end, at both ends, or at neither.
5. **SHOULD** — Authoring remains raw, hand-written JSON. No visual authoring
   surface (palette, click-to-add, drag) is introduced for gradual dynamics,
   consistent with how every other marking is authored today.

### Rendering (showing the marking in the sheet music)

6. **MUST** — The renderer draws a gradual-dynamic span on the rendered grand-staff
   SVG, spanning horizontally from the start note's position to the end note's
   position, and visually distinguishes a crescendo from a decrescendo.
7. **MUST** — The required rendered form is the hairpin wedge: an opening wedge `<`
   (vertex on the left, opening toward the right) for a crescendo, and a closing
   wedge `>` (open mouth on the left, closing toward a vertex on the right) for a
   decrescendo. A hairpin is correct notation for a span of any length, so the
   hairpin form alone is a complete and correct rendering of this feature.
8. **SHOULD / MAY** — A text form for long spans (the words `cresc.` / `dim.`
   followed by a dashed continuation line) is a recommended polish but is not
   required for correctness. If it is included, the form (hairpin vs. text) is the
   author's choice, not auto-selected by span length. Whether to include the text
   form at all is **OQ-1** (below), to be resolved before or during Design.
9. **MUST** — A span renders correctly when it crosses one or more barlines within
   a single rendered system (line of music): it is drawn continuously across the
   intervening measures, exactly as ties and slurs are today.
10. **MUST** — Placement is legible and does not collide with notes or staff lines.
    The exact placement lane (between the two staves, the strict grand-staff
    convention, vs. below each hand's staff, matching where point dynamics already
    sit) is a Design decision and is not pinned by this spec; see **OQ-4**. Per-hand
    placement consistent with the existing point dynamic is an acceptable simplification.
11. **MUST** — Drawing a gradual-dynamic span does not alter or regress the
    rendering of any existing marking (point dynamics, ties, slurs, ottava brackets,
    beams, chords, accidentals, barlines, tempo, measure numbers).

### Edge cases (each must have a defined, testable outcome — never a crash)

12. **MUST** — Robust, never-throws matching. A dangling start (a start with no
    matching end), a dangling stop (an end with no matching start), or a double
    start (a second start opened while one is already open) is handled best-effort
    and must not throw or corrupt the rest of the render; the unmatched marker is
    simply not drawn. This matches the existing tie/slur behavior.
13. **MUST** — A span endpoint that lands on a rest or an otherwise unplaceable note
    must not throw; the span is best-effort not drawn, as ties and slurs behave today.
14. **MUST** — Overlapping or nesting two same-kind spans within one hand is out of
    scope and undefined. At most one gradual-dynamic span of a given kind is open at
    a time per hand; supplying overlapping same-kind spans must not crash (the output
    for such input is unspecified beyond not crashing).
15. **MUST** — A gradual-dynamic span applies to a single hand. The strict
    grand-staff convention (one marking between the staves governing both hands) is
    a noted future refinement and is not required here; per-hand is an accepted,
    documented simplification.
16. **SHOULD** — Messa di voce (a crescendo immediately followed by a decrescendo,
    `< >`) is expressible as two adjacent spans rather than a dedicated combined
    marking. Whether the shared "hinge" note (one note being both the end of the `<`
    and the start of the `>`) is perfectly expressible depends on the data shape and
    is recorded as **OQ-2**.
17. **Out of scope** — A true single-note one-directional span is degenerate (a
    hairpin shows change *across* notes; one note has no horizontal extent) and is
    out of scope.
18. **MUST** — A degenerate near-zero-width span — a *two-note* span whose start and
    end notes land at near-identical horizontal positions, producing a near-zero-width
    wedge — must not throw. Its visual output is unspecified beyond not crashing (this
    is distinct from the single-note case in Requirement 17, which is out of scope
    entirely). This mirrors the overlapping-spans treatment in Requirement 14: the
    input is tolerated without a crash, but no particular rendered shape is guaranteed.
19. **MUST** — A span whose start note and end note fall on two different rendered
    systems (the start on one line, the end on the next) must not throw and must not
    corrupt any other marking; at minimum the within-system portion of the span is
    drawn. The full split rendering (a hairpin split across the system break with an
    open mouth on the continuation) is **not** required by this spec and is left to
    Design; see **OQ-3**.
20. **MUST** — Validation matches the rendering split. The validator accepts any
    structurally and value-valid use of the new marking even when its start/end
    pairing is dangling or unbalanced — pairing is resolved best-effort at render
    time and is not a conformance check — and the validator rejects a value outside
    the marking's allowed set. This mirrors how `tie`/`slur` are validated today.

## Out of Scope

The following are explicitly excluded from this feature:

- **Audio / playback loudness** — any effect on how the song *sounds*. There is no
  audio engine anywhere in the block; the marking is notation/graphics only, like
  every existing marking. (Binding constraint from the original request.)
- **A visual authoring UI** for gradual dynamics (palette, click-to-add, drag).
  Authoring stays raw, hand-written JSON.
- **Visual playhead / audio-synced note highlighting, MIDI export, and numeric
  velocity values** — all previously declared deferrals.
- **Overlapping same-kind spans in one hand** (Requirement 14).
- **True single-note one-directional spans** (Requirement 17).
- **A dedicated messa-di-voce primitive** — messa di voce is handled, where
  possible, as two adjacent spans (Requirement 16).
- **The text form (`cresc.` / `dim.` with a dashed line)** unless the owner opts in
  via OQ-1; the hairpin form alone fully satisfies the goal.

## Acceptance Criteria

- **AC1** — Given a song JSON authored with a crescendo over a run of two or more
  notes in one hand and a separate decrescendo over a run of two or more notes,
  when the song is validated, then it validates with no errors. (Reqs 1, 2, 20)
- **AC2** — Given an existing song that uses no gradual dynamics, when the feature's
  data additions are present in the format, then that song validates and renders
  exactly as it did before the feature (additive growth introduces no change to it).
  (Reqs 3, 11)
- **AC3** — Given a song with a crescendo span and a decrescendo span, when it is
  rendered, then the SVG shows an opening wedge `<` for the crescendo and a closing
  wedge `>` for the decrescendo, each spanning from its start note's horizontal
  position to its end note's horizontal position, and the two are visibly distinct.
  (Reqs 6, 7)
- **AC4** — Given a span whose start and end fall in different measures of the same
  rendered system, when it is rendered, then it appears as one continuous hairpin
  drawn across the intervening barline(s). (Req 9)
- **AC5** — Given a value outside the new marking's allowed set, when the song is
  validated, then it is reported as a conformance error; and given a misspelled
  optional field name, when the song is validated, then it is silently ignored (not
  an error). (Reqs 3, 20)
- **AC6** — Given each of the following inputs — a dangling start, a dangling stop,
  a double start, a span endpoint on a rest, two overlapping same-kind spans in one
  hand, a degenerate near-zero-width two-note span, and a span whose start and end
  fall on two different rendered systems — when the song is rendered, then rendering
  completes without throwing and without corrupting any other marking. (Reqs 12, 13,
  14, 18, 19)
- **AC7** — Given a point dynamic at a span's start, at its end, at both ends, or at
  neither, when the song is rendered, then the span and any point dynamics both
  render independently in every case. (Req 4)
- **AC8** — Given a song that uses existing markings (point dynamics, ties, slurs,
  ottava brackets, beams, chords, accidentals, barlines, tempo, measure numbers)
  alongside a new gradual-dynamic span, when it is rendered, then all existing
  markings render unchanged. (Req 11)
- **AC9** — Given a span whose start note and end note fall on two *different*
  rendered systems (the start on one line, the end on the next line after a wrap),
  when the song is rendered, then rendering completes without throwing, no other
  marking is corrupted, and the within-system portion of the span is drawn. (The full
  split-across-the-break rendering with an open mouth on the continuation is not
  asserted here; it is left to Design per OQ-3.) (Req 19)
- **AC10** — Given a two-note gradual-dynamic span whose start and end notes land at
  near-identical horizontal positions (a degenerate near-zero-width wedge), when the
  song is rendered, then rendering completes without throwing and no other marking is
  corrupted. (No particular rendered shape for the degenerate span is asserted.)
  (Req 18)

## Open Questions for Design / the owner

These affect scope but are deliberately left unresolved here; they are decided in
Design (or by the owner). They are not blockers for this spec.

- **OQ-1 (owner)** — Does the feature require only the hairpin form, or also the
  `cresc.` / `dim.` text form for long spans? Research found hairpin-only correct
  and sufficient; the text form is low-cost polish and is conventionally
  author-selected. *Default if unanswered: hairpin-only required (Req 7), text
  deferred (Req 8).*
- **OQ-2 (design)** — The data shape for the span: how direction is encoded and how
  the start and end are anchored to notes. This determines whether the
  messa-di-voce hinge (Req 16) and any shared-note case are perfectly expressible.
  The spec requires only that direction be expressible and author-chosen (Req 2)
  and that messa di voce be possible as two spans (Req 16).
- **OQ-3 (design, with code risk)** — How a span renders when it wraps across two
  rendered systems (the start on one line, the end on the next). The convention is
  to split the hairpin, leaving an open mouth on the continuation. The existing
  tie/slur cross-system clipping that this feature would otherwise inherit is
  **unverified and may be under-implemented**, so Design must verify rather than
  assume cross-system handling already works. The spec pins only the non-crash
  MUST-minimum for this case — never throws, no corruption of other markings, and the
  within-system portion drawn (Requirement 19, AC9). It does not mandate a specific
  split rendering for this version; a full split-with-open-mouth on the continuation
  is a SHOULD/MAY left to Design.
- **OQ-4 (design)** — The placement lane: between the two staves (the strict
  grand-staff convention) vs. below each hand's staff (matching where the existing
  point dynamic sits). Per-hand below-staff placement is an accepted simplification
  (Req 10, Req 15); between-staves is the future refinement.
