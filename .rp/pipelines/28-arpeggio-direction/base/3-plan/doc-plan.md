# Doc plan — Support arpeggios with direction (issue #28)

This is the documentation plan for the arpeggio feature. It describes **what**
docs change, **where**, and for **whom**, so that a fresh doc-writer can execute
each task after the code ships. It does not prescribe prose to copy; each task
tells the writer to verify content against the **actually-shipped** code and
rendered behavior (the design doc and code plan are the implementation's intent,
not the final word — read the merged `src/` and the rendered output before
writing).

The feature, as it will ship: an **optional per-chord `arpeggio` field** on the
event object, a closed enum with exactly three values `up` / `down` /
`nondirectional`. **Absence = not arpeggiated** (there is no "off" value). When
present it renders as a **vertical wavy line to the left of the chord's
noteheads**, outside any accidentals, spanning the chord's full height, with an
**arrowhead** showing direction (top for `up`, bottom for `down`, none for
`nondirectional`). The visual editor exposes it as a select in the **Note
details** disclosure with options **None / Up / Down / Nondirectional**.
Validation is **closed-enum and non-blocking** (an out-of-vocabulary value is
flagged informationally and never blocks saving), and the value **round-trips
verbatim**. It is **notation only — no sound**. It is a new member of the existing
family of per-event markings (`dynamic`, `tie`, `slur`, `crescendo`,
`decrescendo`, annotations) and must be documented the same way they are.

## Documentation surfaces (the only two shipped docs)

- **`docs/song-format.md`** — the canonical song-format reference. This is the
  primary home of the new field: its shape, its values, its rendered meaning, its
  validation behavior, and its appearance in the annotated example. Mirror exactly
  how `dynamic` (a single-value point enum, the closest analogue) and the
  gradual-dynamics spans are documented.
- **`README.md`** — the project overview. Touches that mention the *set* of
  per-event markings (the Note-details disclosure list, the closed-enum
  vocabulary lists, the additive-growth narrative, the forthcoming/notation-
  coverage prose) must include the arpeggio so the README's marking inventory
  stays complete and accurate.

There is **no** changelog / `readme.txt` in this repo; do not create one.

## Authoring rules every task must honor

- **No internal-workflow references in shipped docs.** Per the repo's `AGENTS.md`,
  shipped docs must NEVER reference this pipeline or its artifacts — no "spec",
  "design §", "design doc", "code plan", "AC#", "R#", "T#", "review N", etc. The
  `Traces to` lines below are for **this plan file only** and must not appear in
  any shipped doc. Write in the docs' existing standalone voice.
- **Verify against shipped behavior, not this plan.** Before writing, read the
  merged source (`src/song/schema.js` for the exact enum and order;
  `src/editor/songModel.js` + `src/editor/inspector/NotePanel.js` for the exact
  control labels and option text; `src/notation/layout.js` / `src/notation/svg.js`
  for the rendered form) and, where practical, look at the actual rendered output.
  If shipped behavior differs from this plan's description, **document what
  shipped** and flag the discrepancy in your final message.
- **Match the surrounding doc style.** Mirror the nearest existing passage named in
  each task — heading style, sentence rhythm, the per-field bullet pattern
  (Optional/additive · what it means · front-end consumption · stored/round-trips/
  validates), table formatting, and JSON example style (valid JSON, no comments in
  the copy-pasteable example block).
- **Keep examples valid.** Every JSON snippet must be valid against the shipped
  schema. The big annotated example must remain copy-pasteable and conformant
  after the arpeggio is added to it.
- **One vocabulary, one order.** Use exactly `up`, `down`, `nondirectional`, in
  that order, everywhere. Editor control options are **None / Up / Down /
  Nondirectional** (title-case labels; "None" is the empty/remove choice).

## Task dependency overview

- D1 (song-format reference: the `arpeggio` field — shape, values, rendered
  meaning, validation, dedicated section) — foundation; no deps.
- D2 (song-format reference: add `arpeggio` to the annotated example + the
  additive-growth / closed-enum mentions) — deps D1.
- D3 (README: Note-details list, closed-enum lists, additive-growth, notation-
  coverage prose) — deps D1.

---

### D1 — Document the `arpeggio` field in the song-format reference

- **Goal.** Make the song-format reference fully describe the new optional
  per-chord `arpeggio` field: where it lives on the event, its three values and
  their rendered meaning, its placement, its single-pitch / rest / tall-chord
  behavior, its validation (closed-enum, non-blocking), and its verbatim
  round-trip — at the same depth and in the same voice as the existing `dynamic`
  field and the gradual-dynamics section.
- **Audience.** Song authors (people writing or hand-editing the song JSON, in raw
  mode or reading the reference to understand the format).
- **Files.**
  - `docs/song-format.md` (modify)
- **Sections-scope.**
  - **`Events` section (the `event :=` shape + field list, around the current
    `dynamic` / `tie` / `slur` / `crescendo` / `decrescendo` lines).** Add
    `arpeggio?` to the `event :=` pseudo-shape comment block with a one-line
    gloss (e.g. `// enum: up | down | nondirectional — rolled-chord wavy line`),
    placed beside `dynamic` (it is a point enum, like `dynamic`, not a start/stop
    span). Add a corresponding bullet to the prose field list describing
    `arpeggio` as an optional per-chord marking whose value is one of the three,
    with **absence meaning not arpeggiated** (no "off" value) — written in the
    same register as the existing `dynamic` bullet.
  - **A dedicated subsection for the marking (new), modeled on the
    "Gradual dynamics (crescendo and decrescendo spans)" section.** Add a focused
    section (suggested title in the docs' own voice, e.g. "Arpeggios (rolled
    chords)") that explains, verified against the shipped render:
    - **What it is** — a chord marked to be rolled (notes sounded in quick
      succession) rather than struck together; one optional field on a single
      event, independent of every other marking (so it combines freely with
      `tie`, `slur`, `dynamic`, `dots`, `crescendo`/`decrescendo`, annotations).
    - **The three values and their rendered meaning** — `up` (rolls bottom-to-top,
      arrowhead at the **top**), `down` (rolls top-to-bottom, arrowhead at the
      **bottom**), `nondirectional` (a plain wavy line, **no** arrowhead). Confirm
      the arrowhead end and the no-arrow case against the actual rendered SVG.
    - **Rendered form / placement** — a vertical wavy line to the **left** of the
      chord's noteheads, drawn **outside** (further left than) any accidentals on
      that chord and clear of the stem, spanning the chord's full vertical extent
      (lowest to highest notehead).
    - **Single-pitch chords** — accepted; renders a short wavy line over the one
      notehead; not an error.
    - **Tall chords** — the wavy line spans the full distance between lowest and
      highest noteheads, however tall.
    - **Rests** — a value may be set on a rest and is accepted (not an error), but
      it has **no rendered effect** on a rest (no noteheads to attach to). State
      this the way the docs already note "front end does not consume / no rendered
      effect" cases.
    - **Notation only — no sound** — like every marking in the format, it is visual
      notation with no audio effect (mirror the "Notation only — no sound"
      paragraph in the gradual-dynamics section).
    - **Stored, round-trips, and validates** — stored verbatim, survives raw-JSON
      editing unchanged; validation accepts the three values; an out-of-vocabulary
      value (e.g. `"sideways"`) is flagged **informationally only** and **never
      blocks saving** (mirror the `language` field's closing bullet and the
      never-blocking stance).
    - **A small valid JSON example** showing a chord event carrying
      `"arpeggio": "up"` alongside its `pitches` (and, ideally, one other marking
      to show independence), in the docs' existing snippet style.
  - **Cross-reference** — wherever the reference points authors to the rendered
    output (e.g. the README's "What the front end shows"), keep the existing link
    style; do not invent new cross-refs beyond what the surrounding text already
    does.
- **Depends on.** —
- **Traces to.** R1, R2, R3, R4, R5, R6, R7, R10, R11, R12, R13, AC1, AC2, AC3,
  AC5, AC6, AC7. *(plan-file only — do not write these in the doc.)*
- **Acceptance.**
  - The `Events` shape and field list both include `arpeggio` with the three
    values and the "absence = not arpeggiated" rule, beside `dynamic`.
  - A dedicated arpeggio section exists covering: the three values + arrowhead
    semantics, left-of-noteheads-outside-accidentals placement, full-height span,
    single-pitch behavior, tall-chord behavior, rest inertness, notation-only/
    no-sound, and stored/round-trips/non-blocking validation — each accurate to
    the shipped render (verified by reading `svg.js`/`layout.js` and/or the
    rendered output).
  - The included JSON example is valid against the shipped schema.
  - No internal-workflow references anywhere in the added text.

---

### D2 — Add `arpeggio` to the annotated example and the additive-growth / closed-enum mentions in the song-format reference

- **Goal.** Make the reference's own worked example exercise the new field, and
  make the format-wide narrative (additive growth, closed-enum vocabulary) name
  `arpeggio` so the reference's inventory of markings is complete and internally
  consistent.
- **Audience.** Song authors using the annotated example as a starting template,
  and authors reading the format-wide rules.
- **Files.**
  - `docs/song-format.md` (modify)
- **Sections-scope.**
  - **`Annotated example song`** — add `"arpeggio": "up"` (or `"down"`) to **one
    chord** in the example, the same way `"dynamic": "mf"` already rides one chord,
    and add a few words to the example's introductory sentence (the list of what
    the example "exercises") noting it now includes an arpeggiated chord. Keep the
    example valid, copy-pasteable JSON (no comments inside the JSON block). Pick a
    chord with multiple pitches so the rendered wavy line is meaningful.
  - **`Additive growth (no version field)`** — in the closed-enum / "misspelled
    enumerated value *is* an error" bullet, add `arpeggio` to the enumerated list
    of closed vocabularies (currently durations, clefs, dynamics, barlines,
    tie/slur, crescendo/decrescendo, event type, beatType). Optionally note the
    `arpeggio` field as one of the latest additive optional fields if the prose
    lists recent additions (mirror how `language` / `name` are mentioned), but only
    if it reads naturally in the existing sentence — do not force it.
- **Depends on.** D1.
- **Traces to.** R7, R11, R12, AC1, AC2, AC7. *(plan-file only.)*
- **Acceptance.**
  - The annotated example contains exactly one chord carrying an `arpeggio` value,
    the whole example is still valid JSON, and its intro sentence mentions the
    arpeggiated chord.
  - The closed-enum list in the additive-growth section includes `arpeggio`.
  - No internal-workflow references; example validates against the shipped schema.

---

### D3 — Update the README's marking inventory to include the arpeggio

- **Goal.** Keep the README accurate wherever it enumerates the per-event markings
  or the editor's Note-details controls, so a reader of the overview learns the
  arpeggio exists, where to set it, and that it is notation-only and
  non-blocking — without duplicating the full field reference (which lives in
  `docs/song-format.md`).
- **Audience.** Block users and contributors reading the project overview (the
  authoring walkthrough, the format/validator overview, and the forthcoming/
  scope narrative).
- **Files.**
  - `README.md` (modify)
- **Sections-scope.**
  - **`Using the Piano block` → the Note panel description (the bullet listing the
    Note-details disclosure contents).** The current bullet lists "dots, dynamic,
    tie, slur, crescendo/decrescendo, and annotations" behind **Note details**. Add
    **arpeggio** to that list so the disclosure inventory is complete. Verify
    against the shipped `NotePanel.js` that the control indeed lives in the Note
    details disclosure and is labeled "Arpeggio".
  - **`The song format and validator` → the closed-enum bullet** (the list
    "durations, clefs, dynamics, barlines, tie/slur, crescendo/decrescendo, type,
    beatType"). Add `arpeggio` to this enumerated-vocabulary list so it matches the
    song-format reference's equivalent list (kept consistent with D2).
  - **`The song format and validator` → "Additive growth" paragraph.** This
    paragraph lists recent additive optional `event` fields (the
    `crescendo`/`decrescendo` worked example; the `language`/`name` "latest
    additions"). Add a brief mention that `arpeggio` is another such additive
    optional `event` field — absent is valid, it is stored and round-trips, and it
    follows the same closed-enum/never-blocking rules — in the paragraph's existing
    voice. Do **not** restate the full field reference here; keep it to the
    additive-pattern point and let `docs/song-format.md` carry the detail.
  - **`Forthcoming` / notation-coverage prose** — the README states the rendered
    notation "already covers a broad spread of markings, including gradual
    dynamics." If it reads naturally, extend that inventory to mention arpeggios as
    now-rendered (so the "what's already drawn" list stays current). Keep the
    "notation only / no sonic effect" framing — the arpeggio, like every marking,
    has no sound. Only touch this if it can be done without awkwardness; the
    primary README edits are the three above.
  - **(Check, do not assume) `What the front end shows`** — this section describes
    *whether* the front end renders, not an exhaustive marking list, so it likely
    needs **no** change. Read it and only edit if it currently enumerates specific
    markings in a way that would now be incomplete.
- **Depends on.** D1 (so the README's brief mentions stay consistent with the full
  reference). Keep the closed-enum list in sync with D2.
- **Traces to.** R7, R9, R12, R13, AC8. *(plan-file only.)*
- **Acceptance.**
  - The Note-details disclosure bullet in the authoring walkthrough lists
    **arpeggio** (verified to match the shipped control's location and label).
  - The closed-enum vocabulary list in the format/validator section includes
    `arpeggio`, consistent with the song-format reference.
  - The additive-growth paragraph notes `arpeggio` as another additive optional
    `event` field, without duplicating the full reference.
  - Any notation-coverage prose that lists rendered markings is either updated to
    include arpeggios or left unchanged because it does not enumerate markings —
    with the choice deliberate, not accidental.
  - No internal-workflow references anywhere in the added text.

---

## Coverage map (requirements/AC → doc task)

| Requirement / AC | Documented in |
| --- | --- |
| R1 optional per-chord field; absence = not arpeggiated | D1 (Events list + dedicated section) |
| R2 direction semantics (up/down/nondirectional) | D1 (dedicated section) |
| R3 rendered form (wavy line left of noteheads, arrowhead) | D1 (dedicated section) |
| R4 placement outside accidentals / clear of stem | D1 (dedicated section) |
| R5 single-pitch chords | D1 (dedicated section) |
| R6 tall chords span full height | D1 (dedicated section) |
| R7 combines with other markings | D1 (independence note) + D2 (example) + D3 (closed-enum list) |
| R8 render parity (editor canvas == front end) | implicit in the docs' single-render-path framing; no new claim needed |
| R9 editor control None/Up/Down/Nondirectional | D3 (Note-details bullet) |
| R10 rest: shown, settable, inert | D1 (rest bullet) |
| R11 verbatim round-trip | D1 (stored/round-trips bullet) + D2 (example) |
| R12 closed-enum, non-blocking validation | D1 (validates bullet) + D2/D3 (closed-enum lists) |
| R13 permissive context | D1 (rest/inert + validation bullets) |
| O1 no audio | D1 (notation-only bullet) + D3 (forthcoming framing) |
| AC1/AC2 valid validate + bad value never blocks | D1 (validation bullet) + D2 (example) |
| AC3/AC5/AC6/AC7 rendered form, single-pitch, rest, combined | D1 + D2 |
| AC8 editor control set/clear/pre-select | D3 (Note-details bullet) |

*(This map is for the plan file only; the R#/AC# tokens must not appear in any
shipped doc.)*

## Final gate (after D1–D3)

- Every JSON snippet in the changed docs is valid against the shipped schema, and
  the annotated example is still copy-pasteable and conformant.
- The closed-enum vocabulary list is identical (modulo wording) between
  `docs/song-format.md` and `README.md`, and both include `arpeggio`.
- The three values and arrowhead semantics, the left-of-noteheads/outside-
  accidentals placement, and the non-blocking validation described in the docs all
  match the **shipped** `src/` behavior and rendered output — not merely this plan.
- `git diff --name-only` shows changes only in `docs/song-format.md` and
  `README.md` (the two shipped docs); no other files touched.
- No shipped doc references the internal pipeline or its artifacts.
