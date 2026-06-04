# Spec: Free-text "notes" annotations placeable above or below either staff

## Overview

The Piano Block stores a song as JSON and renders it as grand-staff sheet music. Today the only free-form annotation an author can attach to a note is a single per-event `chordSymbol` string, which always renders above the right-hand staff. This is too narrow: authors need to attach richer annotations (a chord symbol, the word "pedal", a rehearsal label, "rit.", etc.) and control where each one appears on the grand staff, including below a staff and on the left-hand staff — none of which the chord-symbol field can express.

This feature replaces `chordSymbol` with one general **notes** capability. A note holds free text and an explicit placement (above or below a staff). Notes can attach in two modes: **per-event** (tied to a specific note/event, inheriting that event's staff and horizontal position) and **standalone** (not tied to a single event, attached at the measure level with an explicit staff and optional horizontal anchor). All four grand-staff positions — above and below each of the two staves — become reachable. `chordSymbol` is removed as a clean break: legacy songs that still carry it remain valid but the annotation simply stops rendering, with no auto-migration.

## Requirements

### Data model

1. An `event` (a note/rest in a measure's `rightHand` or `leftHand` array) may carry an optional `notes` array. Each per-event note element has the shape `{ text, placement }`. The staff a per-event note belongs to is **implicit** — it is the hand whose array the event lives in; there is no `staff` field on a per-event note.
2. A `measure` may carry an optional `notes` array of **standalone** notes (annotations not tied to a single event). Each standalone note element has the shape `{ text, placement, staff, beat? }`, where `staff` is required (there is no hand array to imply it) and `beat` is an optional horizontal anchor.
3. `notes` is one concept with two attachment modes. The two modes share the `notes` key and the `text` + `placement` fields; they differ only in that a standalone note additionally carries `staff` (required) and `beat` (optional).
4. `notes` is optional on both `event` and `measure`; an absent `notes` and an empty `notes: []` are both valid.

### `chordSymbol` removal (clean break)

5. The `chordSymbol` field is removed. There must be no state in which both `chordSymbol` and `notes` are supported simultaneously; `chordSymbol` is fully superseded by `notes`.
6. No `chordSymbol` token remains anywhere in `src/`, `specs/`, or `docs/` (including code, tests, schema, documentation, README, and source comments).
7. A song that still carries a legacy `chordSymbol` remains **valid** (it is treated as an unknown optional key and silently ignored, consistent with the format's permissive handling of unknown fields). The legacy `chordSymbol` annotation does **not** render. There is no auto-migration, no validator rejection, and no warning.
8. Documentation includes one explanatory line telling authors how to rewrite a legacy `chordSymbol: "C"` as `notes: [{ "text": "C", "placement": "above" }]`.

### Validation

9. `text` is required on every note (per-event and standalone) and must be a string. An empty string `""` is **valid** (it renders nothing).
10. `placement` is required on every note and must be one of the enum values `"above"` or `"below"`. There is no default. Omitting `placement`, or supplying any other value, is a validation error.
11. `staff` is required on every standalone note and must be one of the enum values `"rightHand"` or `"leftHand"`. Omitting `staff` on a standalone note, or supplying any other value, is a validation error. A `staff` value placed on a per-event note is ignored (not an error).
12. `beat` is optional on a standalone note and must be a number `≥ 0` (quarter-beats; fractional values are allowed). A negative `beat` is a validation error. `beat` values of `0`, `0.5`, and large values that exceed the measure's musical content are all valid — there is no musical-timing validation. A `beat` value placed on a per-event note is ignored (not an error).
13. Validation errors for a note element are reported with a path that pinpoints the offending element and field (e.g. `sections[0].measures[0].notes[1].placement`).

### Rendering

14. All four grand-staff positions — above and below the right-hand staff, and above and below the left-hand staff — can be rendered, for both per-event and standalone notes. Each rendered note appears in the correct vertical **band** relative to the named staff lines:
    - **above the right-hand staff**: above the right-hand staff's top line.
    - **below the right-hand staff** (the inter-staff gap, under the right hand): between the right-hand staff's bottom line and the left-hand staff's top line.
    - **above the left-hand staff** (the inter-staff gap, over the left hand): between the right-hand staff's bottom line and the left-hand staff's top line.
    - **below the left-hand staff**: below the left-hand staff's bottom line.
15. A note's placement (above/below) is observable on the rendered node, and the staff it belongs to is observable from the rendered node (so a reader can distinguish, for example, below-right-hand from above-left-hand even though they share a vertical band).
16. A per-event note's text is horizontally aligned with its event — it sits in the same horizontal column as that event's notehead.
17. A standalone note with a `beat` renders at that beat's horizontal onset; a higher `beat` renders further right than a lower one. A standalone note without a `beat` renders near the measure's left edge.
18. A note's `text` renders verbatim as the rendered node's text content (e.g. `"Gm7"` renders as the literal text `Gm7`).
19. Author free text is XSS-inert: a note's `text` is never interpreted as executable code or markup in any render path. Hostile input (for example `"<script>alert(1)</script>"` or `'C7 & <alt> "sus"'`) renders as inert literal text with no executable or markup node produced. This guarantee is carried over unchanged from `chordSymbol`.
20. Notes coexist:
    - An event carrying both an above note and a below note renders both (the chord-symbol-above plus pedal-below case).
    - Multiple notes sharing the same placement at one anchor all render, each at a distinct vertical position, with none lost and none overlapping at an identical position.
    - A per-event note and a standalone note in the same measure both render.

## Out of Scope

- **Spanning annotations.** v1 supports point annotations only. Spanning brackets or extension lines (e.g. a pedal line with start and end, or a `rit. ——` extension) are a documented non-goal, addable later.
- **Section-level and song-level standalone notes.** v1 attaches standalone notes only at the measure level. There are no section-level or song-level note slots; these can be added additively later.
- **A "between staves" / centered placement value.** v1's placement axis is only `above | below`. The inter-staff gap is already reachable via `{ staff: "leftHand", placement: "above" }` or `{ staff: "rightHand", placement: "below" }`, so no dedicated centered placement value is introduced.
- **Auto-migration of legacy `chordSymbol`.** No code rewrites, translates, or migrates existing `chordSymbol` data; the only accommodation is one documentation line.
- **Musical-timing validation of `beat`.** A `beat` is not checked against the measure's time signature or content; out-of-range beats are valid and handled best-effort at render time.

The following are deliberately deferred to the **design phase** (this spec fixes the observable behavior; it does not fix the geometry or internal structure):

- Exact vertical offsets and lane-gap sizes; font size, family, and weight.
- Collision-avoidance precision beyond "distinct positions, no overlap."
- The horizontal clamp behavior for a `beat` that exceeds the measure's content (this spec requires only that such a note still renders within the system, best-effort).
- Whether below-right-hand and above-left-hand share a single inter-staff lane or use two; vertical ordering of notes relative to other above-staff occupants (tempo, ottava); and the new below-staff / inter-staff lane machinery itself.
- The exact attribute name(s) used to make placement and staff observable on the rendered node.

## Acceptance Criteria

### Data model and `chordSymbol` removal

- Given an `event` with `notes: [{ "text": "C", "placement": "above" }]`, when the song is validated, then it is valid.
- Given a `type: "rest"` event with `notes: [{ "text": "pedal", "placement": "below" }]`, when the song is validated, then it is valid (a `notes` array is carried by note and rest events alike).
- Given an `event` with no `notes` key, when the song is validated, then it is valid.
- Given an `event` (or `measure`) with `notes: []`, when the song is validated, then it is valid.
- Given a `measure` with `notes: [{ "text": "rit.", "placement": "above", "staff": "rightHand" }]`, when the song is validated, then it is valid.
- Given the project source, when `src/`, `specs/`, and `docs/` are searched, then no `chordSymbol` token is present anywhere.
- Given a song that still contains a legacy `chordSymbol: "C"` on an event, when the song is validated, then it is valid (the key is silently ignored), and when the song is rendered, then no annotation from that `chordSymbol` appears.
- Given the documentation, when an author looks up how to migrate, then there is a line showing that `chordSymbol: "C"` should be rewritten as `notes: [{ "text": "C", "placement": "above" }]`.

### Validation rules

- Given a note with `text: ""`, when validated, then it is valid, and when rendered, then it produces no visible text.
- Given a note with no `text` field, when validated, then validation fails with an error pointing at that note element.
- Given a note with `placement` omitted, when validated, then validation fails.
- Given a note with `placement: "middle"` (any value outside `above|below`), when validated, then validation fails.
- Given a standalone note (on a measure) with `staff` omitted, when validated, then validation fails.
- Given a standalone note with `staff: "leftHand"` and `staff: "rightHand"` respectively, when validated, then both are valid.
- Given a standalone note with an invalid `staff` value, when validated, then validation fails.
- Given a per-event note (on an event) that includes a stray `staff` or `beat` field, when validated, then it is valid and the stray field is ignored.
- Given a standalone note with `beat: -1`, when validated, then validation fails.
- Given standalone notes with `beat: 0`, `beat: 0.5`, and `beat: 99` respectively, when validated, then all are valid.
- Given a `notes` array whose second element has a bad `placement`, when validated, then the reported error path identifies that element and field (e.g. `…notes[1].placement`).

### Rendering — position and anchoring

- Given a per-event note on a right-hand event with `placement: "above"`, when rendered, then its text node sits above the right-hand staff's top line.
- Given a per-event note on a right-hand event with `placement: "below"`, when rendered, then its text node sits in the inter-staff gap (below the right-hand staff's bottom line and above the left-hand staff's top line).
- Given a per-event note on a **left-hand** event with `placement: "above"`, when rendered, then its text node sits in the inter-staff gap (below the right-hand staff's bottom line and above the left-hand staff's top line).
- Given a per-event note on a **left-hand** event with `placement: "below"`, when rendered, then its text node sits below the left-hand staff's bottom line.
- Given a standalone note with `staff: "rightHand"` and `placement: "above"`, when rendered, then its text node sits above the right-hand staff's top line.
- Given a standalone note with `staff: "rightHand"` and `placement: "below"`, when rendered, then its text node sits in the inter-staff gap (below the right-hand staff's bottom line and above the left-hand staff's top line).
- Given a standalone note with `staff: "leftHand"` and `placement: "above"`, when rendered, then its text node sits in the inter-staff gap (above the left-hand staff's top line).
- Given a standalone note with `staff: "leftHand"` and `placement: "below"`, when rendered, then its text node sits below the left-hand staff's bottom line.
- Given any rendered note, when its node is inspected, then both its placement (above/below) and its staff are observable from the node.
- Given a per-event note, when rendered, then its text occupies the same horizontal column as its event's notehead.
- Given two standalone notes in the same measure with `beat: 0` and `beat: 2`, when rendered, then the `beat: 2` note is positioned further right than the `beat: 0` note.
- Given a standalone note with no `beat` and another standalone note with `beat: 0` in the same measure, when rendered, then the no-`beat` note renders at (or near) the same horizontal position as the `beat: 0` note, and both render in the left portion of the measure (to the left of a `beat: 2` note in the same measure).
- Given a standalone note with a `beat` larger than the measure's musical content (e.g. `beat: 99`), when rendered, then a text node still appears within the system's horizontal bounds (the exact clamped horizontal position is design-defined).

### Rendering — free text, safety, and coexistence

- Given a note with `text: "Gm7"`, when rendered, then a text node appears whose content is exactly `Gm7`.
- Given a note with `text: "<script>alert(1)</script>"`, when rendered, then it appears as inert literal text and no executable or markup node is produced.
- Given a note with `text: 'C7 & <alt> "sus"'`, when rendered, then it appears verbatim as inert literal text.
- Given an event carrying both an above note and a below note, when rendered, then both render — one in the above band and one in the below band, both aligned to the event's horizontal column.
- Given a below-right-hand note and an above-left-hand note in the same measure (both occupying the shared inter-staff band), when rendered, then both render and each node's staff is observable, so the two remain distinguishable even though they share the inter-staff band.
- Given an anchor with N notes of the same placement, when rendered, then N text nodes render at N distinct vertical positions with none lost and none overlapping at an identical position.
- Given a measure containing both a per-event note and a standalone note, when rendered, then both render.
- Given a `rest` event carrying `notes: [{ "text": "pedal", "placement": "below" }]`, when rendered, then the note renders in the below band anchored to the rest's horizontal column.
