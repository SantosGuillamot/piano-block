# Docs review — Support arpeggios with direction (issue #28) — APPROVED

Batch doc tasks reviewed: **D1, D2, D3**. Base ref **534f800**. Diff scope:
`docs/song-format.md`, `README.md`. Verdict: **APPROVED**.

## What was checked and the evidence

### Accuracy to shipped behavior (verified against `src/`, not the plan)

Every documented claim was cross-checked against the merged code:

- **Field shape + enum + order** — `src/song/schema.js:163` defines
  `arpeggio: { enum: ["up", "down", "nondirectional"] }` placed immediately
  after `dynamic`. The Events `event :=` block puts `arpeggio?` right after
  `dynamic?` with the gloss `// enum: up | down | nondirectional —
  rolled-chord wavy line`, and the prose bullet lists the three values in that
  order with "absence means the chord is not arpeggiated / no off value". Match.
- **Three values + arrowhead semantics** — `src/notation/svg.js` `renderArpeggio`:
  `up` adds an arrowhead at `arp.topY` (top end), `down` at `arp.bottomY`
  (bottom end), `nondirectional` adds none. Doc's bullets match exactly.
- **Placement: left of noteheads, outside accidentals, clear of stem** —
  `src/notation/layout.js:1565` sets the wavy line at `noteX - arp.dx` where
  `dx = accidentals.length ? max(acc.dx) + ARPEGGIO_GAP : ARPEGGIO_FIXED_GAP`
  (`ARPEGGIO_GAP=0.7`, `ARPEGGIO_FIXED_GAP=1.4`, constants.js). So it is left of
  the column and clear past the leftmost accidental. Match.
- **Full-height span** — `topY = staffStepToY(topStep)`, `bottomY =
  staffStepToY(bottomStep)` (layout.js:1570-1571) → lowest-to-highest notehead.
  Match.
- **Single-pitch → short minimal wiggle, directional still adds arrowhead** —
  with one pitch `topStep == bottomStep`, so `wigglePathD` height = 0 → `n =
  max(1, 0) = 1` (one degenerate bump); `renderArpeggio` still draws the
  arrowhead because it only branches on `arp.direction`. Doc matches.
- **Tall chords span full height, no cap** — span is purely topStep→bottomStep;
  no clamp. Match.
- **Rest inertness** — `layoutHand` (layout.js:1484) pushes rests to `rests`
  and returns early; no `arpeggio` record is ever attached to a rest, so it
  draws nothing. Schema still accepts `arpeggio` on a rest event (it is a plain
  optional `event` property). Doc's "accepted, stored, round-trips, no rendered
  effect" matches.
- **Editor control label/location** — `src/editor/inspector/NotePanel.js:209-222`
  renders a `SelectControl` labeled `"Arpeggio"` inside the `"Note details"`
  `ToolsPanel`, options `[NONE_OPTION, ...ARPEGGIO]`; `ARPEGGIO` in
  `songModel.js:65` is `Up / Down / Nondirectional` (None is the empty option).
  README's Note-details bullet lists `arpeggio` between `dynamic` and `tie`,
  matching the panel's render order (Dots, Dynamic, Arpeggio, tie/slur/
  cresc/decresc, Annotations).
- **Notation only / no sound** — accurate; no audio engine in the block.

No drift found.

### Valid JSON / copy-pasteable (verified by running the shipped validator)

Ran every ```json``` block in `docs/song-format.md` through
`src/song/validate.js` (`validateSong`, default export):

- **Annotated example** (the only full-song block) → `validateSong` returns
  `[]`. It now carries `"arpeggio": "up"` on the 3-pitch C-E-G chord; still
  conformant and copy-pasteable.
- **New dedicated-section snippet** (`{ "type": "note", … "arpeggio": "up",
  "dynamic": "mf", "pitches": […C,E,G] }`) is a single-event *fragment* (like
  every other fragment snippet in the doc); wrapped in a `sections` song it
  validates `[]`, and the `arpeggio: "up"` value is accepted.
- Closed-enum confirmed: an `"arpeggio": "sideways"` value is rejected with
  `… is not one of the allowed values ["up", "down", "nondirectional"]`,
  confirming the doc's "out-of-vocabulary value is a conformance error /
  flagged informationally, never blocks saving" claim.

### Completeness (all planned doc changes present)

- **D1** — Events shape gloss ✓, field bullet ✓, dedicated "Arpeggios (rolled
  chords)" section covering three values + arrowhead, placement, full-height
  span, single-pitch, tall-chord, rest, notation-only, stored/round-trips/
  non-blocking ✓, valid JSON example ✓.
- **D2** — annotated example carries one `arpeggio` chord ✓, intro sentence
  mentions "a three-pitch chord that is also arpeggiated (`"arpeggio": "up"`)"
  ✓, closed-enum list includes `arpeggio` ✓.
- **D3** — README Note-details bullet ✓, closed-enum list ✓, additive-growth
  mention (`optional arpeggio field on event … stored and round-trips …`) ✓,
  notation-coverage prose (`arpeggios — rolled chords drawn as a wavy line`) +
  audio-playback bullet updated ✓.

### Consistency

Closed-enum vocabulary lists place `arpeggio` in the same relative position
(after `dynamics`, before `barlines`) in both docs, modulo backtick wording:
- song-format.md: `durations, clefs, dynamics, ` + "`arpeggio`" + `, barlines,
  tie/slur, crescendo/decrescendo, type, beatType`.
- README.md: same sequence.

Intra-doc anchors resolve: `#arpeggios-rolled-chords` → `## Arpeggios (rolled
chords)`; `#additive-growth-no-version-field` → `## Additive growth (no
version field)`.

### No workflow leakage

Grepped both shipped docs and the diff for `spec / design doc / code plan /
AC# / R# / T# / pipeline / radical / review N / traces to / .rp/`. No real
references (only an enum value `nondirectional` falsely matched a broad
pattern). Clean.

### Voice/style

The new Arpeggios section mirrors the gradual-dynamics section's structure
(bolded lead-ins, a near-verbatim "Notation only — no sound" paragraph) and the
`arpeggio` field bullet mirrors the `dynamic` bullet. README additions read in
the surrounding inventory voice.

## Note (not a defect)

`git diff --name-only 534f800..HEAD` over the full range also lists the code
and `.rp/` pipeline files, because the whole feature batch (code + docs) landed
on this branch. The *doc tasks'* own changes are confined to the two shipped
docs (`docs/song-format.md`, `README.md`), which satisfies the doc-plan final
gate. No action needed.

Verdict: **APPROVED.**
