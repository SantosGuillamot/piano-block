# Code plan — Support arpeggios with direction (issue #28)

This is the ordered, dispatchable implementation plan for the arpeggio feature.
The design doc (`2-design-doc/design-doc.md`) is authoritative; this plan turns it
into self-contained tasks. Each task block is dispatched verbatim to a fresh
code-writer.

## Conventions every task must honor

- **TDD.** Write the failing unit test(s) the task names first, then the
  implementation, then make them pass. Test commands: `npm run test:unit` (Jest),
  `npm run test:e2e` (Playwright/wp-env). Lint/format: `npm run lint` /
  `npm run check` (biome). Run `npm run test:unit` after every task that touches
  `src/` and leave it green.
- **No internal-workflow references in shipped code.** Shipped code, comments,
  and docs must NEVER reference this pipeline or its artifacts — no "design §",
  "AC#", "R#", "T#", "spec", "review N", "code-plan", etc. The `Traces to` lines
  below are for this plan only and must not appear anywhere in code or comments.
  Write comments that read like the surrounding house style (see the existing
  doc-comments in each file).
- **Match surrounding style.** Mirror the nearest existing pattern named in each
  task (the doc cites the precedent for every change). Match comment density,
  naming, tabs-for-indentation, and `__()` i18n wrapping already in the file.
- **Real paths.** The editor save-path file is `src/edit.js` (there is **no**
  `src/editor/edit.js`). Do **not** edit `src/edit.js`, `src/song/validate.js`,
  `src/notation/glyphs.js`, the music font, or any save/commit/serialize path —
  the "never blocks saving" contract is held by the existing topology and the
  generic `edit.js` help text already states it verbatim; adding an
  arpeggio-specific gate or help edit is the one way to break the requirement.
- **Closed enum, one vocabulary.** The field is `arpeggio` with exactly
  `["up", "down", "nondirectional"]`, in that order, everywhere it appears
  (schema, option list, tests), so nothing can drift.

## Task dependency overview

- T1 (schema enum + schema/validator unit tests) — foundation; no deps.
- T2 (`ARPEGGIO` option list) — deps T1.
- T3 (`NotePanel` control + reset-all) — deps T2.
- T4 (constants) — no deps (parallelizable with T1–T3).
- T5 (`wigglePathD` helper + unit test) — no deps (parallelizable).
- T6 (layout `note.arpeggio` record) — deps T4.
- T7 (`renderArpeggio` + `renderNote` call + svg tests) — deps T4, T5, T6.
- T8 (combined-markings unit test, AC7) — deps T6, T7.
- T9 (e2e specs) — deps T1, T3, T6, T7.

---

### T1 — Declare the `arpeggio` enum on the event schema (+ schema & validator unit tests)

- **Goal.** Add the single closed-enum field declaration that makes the format
  accept and validate `arpeggio`, with zero validator code — and cover both the
  schema-shape and the validator-behavior at the unit tier.
- **Files.**
  - `src/song/schema.js` (modify)
  - `src/song/__tests__/schema.test.js` (modify)
  - `src/song/__tests__/validate.test.js` (modify — the validator-behavior unit
    tests; the validator **source** `src/song/validate.js` stays untouched)
- **Changes.**
  - In `schema.js`, on the `event` `$def` `properties` block (around the
    `dynamic` line, `schema.js:162`), add one property line beside `dynamic`:
    `arpeggio: { enum: ["up", "down", "nondirectional"] }`. Do not add it to
    `required`; do not touch the `if`/`then` note-conditional. No other change in
    this file.
  - In `schema.test.js`, mirroring the existing `crescendo`/`decrescendo`
    byte-for-byte enum assertions (`schema.test.js:27-32`), add an assertion that
    `songSchema.$defs.event.properties.arpeggio` equals
    `{ enum: ["up", "down", "nondirectional"] }`.
  - In `validate.test.js`, exercise the validator walking a real song (the
    schema-shape assertion above does **not** do this — different layer, different
    assertion):
    - In the `describe("validateSong — conformant songs")` block
      (`validate.test.js:174`), assert that a song carrying `arpeggio: "up"`
      validates to `[]`, and independently that `arpeggio: "down"` and
      `arpeggio: "nondirectional"` each validate to `[]`. Build the songs with the
      block's existing fixture/helper style; assert `check(...)` (the
      `validate.test.js:150` helper, `validateSong(JSON.stringify(value))`) returns
      `[]`.
    - In the `describe("validateSong — closed-enum errors")` block
      (`validate.test.js:282`), mirror the dynamic/crescendo "flags … with its
      path" precedents (`validate.test.js:307`, `:353`): using the block's local
      `eventSong` helper (`validate.test.js:285`), assert `arpeggio: "sideways"`
      is flagged with its path and value — e.g.
      `result.some((e) => /arpeggio/.test(e) && /sideways/.test(e))` is `true` —
      and that the validator returned messages (an array) rather than throwing
      (the song still parses; the validator never throws).
    - Add `arpeggio: "up"` to one chord of the comprehensive full-song fixture,
      the way `dynamic: "mf"` already rides one chord (`validate.test.js:53`), so
      the conformant full-song case carries the field end-to-end.
- **Depends on.** —
- **Traces to.** R1, R12, R13, AC1, AC2.
- **Acceptance.** New `schema.test.js` assertion passes; the three new
  `validate.test.js` assertions (conformant `up`/`down`/`nondirectional` → `[]`;
  `"sideways"` flagged with path/value while the song still parses; the
  comprehensive fixture carrying `arpeggio: "up"` still validates to `[]`) pass;
  whole `npm run test:unit` stays green. The validator **source** `validate.js`,
  `glyphs.js`, and the font are untouched (only the `validate.test.js` test file
  gains assertions).

---

### T2 — Add the `ARPEGGIO` option list to `songModel.js`

- **Goal.** Provide the editor's presentational option list for the control, with
  a test cross-checking it against the schema so the two cannot drift.
- **Files.**
  - `src/editor/songModel.js` (modify)
  - `src/editor/__tests__/songModel.test.js` (modify)
- **Changes.**
  - In `songModel.js`, beside `DYNAMICS` (`songModel.js:53-62`), add an exported
    `ARPEGGIO` list of `{ label, value }` with **title-case `__()`-wrapped
    labels** (matching the word-token lists `DURATIONS`/`CLEFS`/`BARLINES`, NOT
    the bare-symbol `DYNAMICS` style):
    ```js
    export const ARPEGGIO = [
      { label: __("Up", "piano-block"), value: "up" },
      { label: __("Down", "piano-block"), value: "down" },
      { label: __("Nondirectional", "piano-block"), value: "nondirectional" },
    ];
    ```
    Do **not** include the empty/none option in the list; it is prepended at the
    control in T3. Add a brief doc-comment in the house style ("Event
    `arpeggio`: …").
  - In `songModel.test.js`, mirroring the `SPAN_STATES` cross-check
    (`songModel.test.js:100-106`): assert `values(ARPEGGIO)` equals
    `songSchema.$defs.event.properties.arpeggio.enum`. Also add `ARPEGGIO` to the
    "every option carries a non-empty label and a member value" sweep
    (`songModel.test.js:124-135`).
- **Depends on.** T1 (the cross-check reads the schema enum).
- **Traces to.** R9, AC8.
- **Acceptance.** The new cross-check and the extended sweep pass;
  `npm run test:unit` green.

---

### T3 — Add the Arpeggio control to `NotePanel` and wire all three clear paths

- **Goal.** Expose the arpeggio marking in the Note-details inspector as a
  standalone `ToolsPanelItem` (mirror of `dynamic`), and ensure every clear path
  drops the key — including the easy-to-miss reset-all destructure.
- **Files.**
  - `src/editor/inspector/NotePanel.js` (modify)
  - `src/editor/__tests__/NotePanel.test.js` (modify)
- **Changes.**
  - Import `ARPEGGIO` from `../songModel.js` (add it to the existing import
    block, `NotePanel.js:43-54`).
  - Add a standalone `ToolsPanelItem` that is an exact structural mirror of the
    `dynamic` item (`NotePanel.js:192-205`), placed as a sibling **after** the
    dynamic item and **before** the `SPAN_FIELDS.map` (`NotePanel.js:207`):
    - `label={__("Arpeggio", "piano-block")}`
    - `hasValue={() => Boolean(event.arpeggio)}`
    - `onDeselect={() => changeOptional("arpeggio", "")}`
    - inner `SelectControl` with `label={__("Arpeggio", "piano-block")}`,
      `value={event.arpeggio ?? ""}`, `options={[NONE_OPTION, ...ARPEGGIO]}`,
      `onChange={(value) => changeOptional("arpeggio", value)}`, and the same
      `__nextHasNoMarginBottom __next40pxDefaultSize` props the dynamic control
      uses.
  - In the `ToolsPanel` `resetAll` destructure (`NotePanel.js:158-172`), add
    `arpeggio: _arpeggio,` to the destructured optionals (follow the existing
    `_`-prefix convention for intentionally-unused bindings) so reset-all drops
    the key. This one word is required — omitting it silently leaves the value
    behind.
  - **Do not** add any `event.type === "note"` gate around the item — it shows for
    a rest by design (the panel already gates only `PitchList` on type).
  - In `NotePanel.test.js`, add three tests mirroring the existing
    dynamic/tie/rest tests:
    - (a) Setting the arpeggio writes the key and picking "None" drops it —
      mirror "adds a dynamic key when set and drops it when cleared"
      (`NotePanel.test.js:237-251`); assert on
      `calls.at(-1).sections[0].measures[0].rightHand[0].arpeggio`.
    - (b) The Arpeggio control shows for a rest selection — mirror the rest test
      (`NotePanel.test.js:301-318`).
    - (c) **Reset-all clears the arpeggio** — set an arpeggio, trigger the
      ToolsPanel "Reset all", assert the emitted event has no `arpeggio` key. This
      is the high-value regression guard for the destructure edit.
- **Depends on.** T2.
- **Traces to.** R7, R9, R10, AC6, AC8.
- **Acceptance.** All three new `NotePanel.test.js` tests pass; the reset-all
  test fails if `arpeggio: _arpeggio` is omitted (verify by checking it guards the
  bug). `npm run test:unit` green.

---

### T4 — Add the arpeggio sizing/placement constants

- **Goal.** Add the five tuned constants the layout and svg layers read, sized to
  the clearance rules the design fixes.
- **Files.**
  - `src/notation/constants.js` (modify)
  - `src/notation/__tests__/constants.test.js` (modify only if that file asserts
    on the constant block; otherwise no test change — see Acceptance)
- **Changes.** Add a new commented block (e.g. "── Arpeggio (rolled-chord wavy
  line) ──") beside the hairpin block (`constants.js:222-259`), with five
  exported constants. Each gets a house-style doc-comment explaining its role and,
  for the two gaps, the clearance it must satisfy:
  - `ARPEGGIO_AMPLITUDE` — horizontal half-swing of the wiggle (sp).
  - `ARPEGGIO_PERIOD` — vertical wavelength / height of one bump (sp).
  - `ARPEGGIO_GAP` — extra gap placed **outside** the leftmost accidental;
    comment notes it must clear the accidental glyph's half-width (in the spirit
    of `ACCIDENTAL_GAP`), on the order of `>= 0.6` sp.
  - `ARPEGGIO_FIXED_GAP` — fixed left gap when there are no accidentals; comment
    notes it must clear the ledger half-width (`LEDGER_WIDTH / 2 = 1`) plus the
    wiggle's own swing, so `~1.4` sp, and that it is therefore always `> 1`.
  - `ARPEGGIO_ARROW_SIZE` — length/size of the arrowhead strokes (sp).
  - Pick concrete values consistent with the constraints above and the existing
    constant scale; they are tuned, not computed.
- **Depends on.** —
- **Traces to.** R3, R4, R5, R6.
- **Acceptance.** Constants exported and importable. If
  `constants.test.js` enumerates/asserts exported constants, extend it minimally
  so it stays green; otherwise the layout test (T6) is the functional guard that
  `ARPEGGIO_FIXED_GAP >= LEDGER_WIDTH / 2`. `npm run test:unit` green.

---

### T5 — Add the `wigglePathD` pure d-string helper and its unit test

- **Goal.** Implement the new wavy-line path generator as a pure, deterministic
  function, with a direct unit test — independent of any rendering.
- **Files.**
  - `src/notation/svg.js` (modify — add the helper near the other `<path>`/path
    builders, e.g. by `renderSpan`)
  - `src/notation/__tests__/svg.test.js` (modify — add a `describe("wigglePathD")`
    block) **OR** `src/notation/__tests__/layout.test.js` if the helper is
    exported from layout. Recommended: keep it in `svg.js` and export it for the
    test (mirror how svg.js already structures small helpers); test it in
    `svg.test.js`.
- **Changes.**
  - Implement `wigglePathD(x, topY, bottomY, amplitude, period) → string`: a pure
    SVG `d`-string builder. Walk from `bottomY` up to `topY` in half-period steps,
    emitting a chain of quadratic (`Q`) bumps whose control point alternates
    left/right of `x` (`x - amplitude` / `x + amplitude`) each step, so the line
    reads as a vertical wiggle. Derive the bump count from the span height:
    `n = max(1, round((bottomY - topY) / (period / 2)))`. Start the path with an
    `M` at `(x, bottomY)`; the only division is by `n` (always `>= 1`), so there
    is no divide-by-zero. Return the `d` string. Add a house-style doc-comment.
  - Export `wigglePathD` so the test can import it (named export, like other
    testable helpers).
  - Unit-test it as a pure function (mirror the direct `stackAccidentals` unit
    test, `layout.test.js:667-696`): assert `n = max(1, round(height/(period/2)))`
    for a representative height; assert the `n = 1` clamp when `topY == bottomY`
    (height 0) and that it does not throw / has no `NaN`; assert the path begins at
    `bottomY` and reaches `topY`; assert "a taller span yields more `Q` segments"
    (count `Q` tokens for a tall vs. short span).
- **Depends on.** —
- **Traces to.** R3, R5, R6.
- **Acceptance.** `wigglePathD` unit tests pass; the function is pure (same input
  → same output) and never divides by zero. `npm run test:unit` green.

---

### T6 — Compute the `note.arpeggio` layout record

- **Goal.** Build the per-note arpeggio geometry record in the layout layer,
  beside the accidental/ledger/dot records, so the svg layer reads one field and
  rests stay inert structurally.
- **Files.**
  - `src/notation/layout.js` (modify)
  - `src/notation/__tests__/layout.test.js` (modify)
- **Changes.**
  - Import the needed constants (`ARPEGGIO_GAP`, `ARPEGGIO_FIXED_GAP`) into the
    `constants` import block in `layout.js` (`layout.js:22-…`).
  - In `layoutHand`, in the per-note push (the `notes.push({...})` at
    `layout.js:1542-1560`, where `accidentals`, `topStep`, `bottomStep` are
    already in scope), set a `note.arpeggio` record **only when** `event.arpeggio`
    is truthy (the chord already has `positions.length > 0` here, since the rest
    branch and the empty-positions branch returned earlier at
    `layout.js:1482-1500`). Compute:
    - `dx = accidentals.length ? Math.max(...accidentals.map((a) => a.dx)) + ARPEGGIO_GAP : ARPEGGIO_FIXED_GAP`
    - `topY = staffStepToY(topStep)` (the highest notehead → smallest Y)
    - `bottomY = staffStepToY(bottomStep)` (the lowest notehead → largest Y)
    - `direction = event.arpeggio` (straight passthrough)
    - i.e. `arpeggio: { dx, topY, bottomY, direction }` — add it as a property of
      the pushed note object (or assign right after the push). When
      `event.arpeggio` is absent, the note must have **no** `arpeggio` key
      (`undefined`/omitted), not a falsy record.
  - Optional (design-permitted): if you factor the dx rule into an
    `arpeggioDx(accidentals)` helper, export and unit-test it directly; otherwise
    inline it and let the `buildLayoutModel` assertions cover it.
  - In `layout.test.js`, via `buildLayoutModel` (mirror the `buildLayoutModel`
    integration assertions already in the file): assert an arpeggiated note
    carries `note.arpeggio = { dx, topY, bottomY, direction }`; `dx` is strictly
    greater than `Math.max(...acc.dx)` when accidentals are present; `dx >=
    LEDGER_WIDTH / 2` when there are no accidentals; a single-pitch arpeggiated
    note gives `topY === bottomY` and does not throw; a non-arpeggiated note has
    **no** `note.arpeggio`; a **rest** with `arpeggio` set is absent from `notes`
    entirely (it lands in `rests`, never gets an arpeggio record).
- **Depends on.** T4.
- **Traces to.** R3, R4, R5, R6, R10, AC3, AC5, AC6.
- **Acceptance.** All new `layout.test.js` assertions pass; the dx-clearance
  assertions encode the placement rule. `npm run test:unit` green.

---

### T7 — Render the arpeggio in `renderNote` (`renderArpeggio`) and its svg tests

- **Goal.** Emit the wavy line + optional arrowhead inside the note group, as a
  nested `data-arpeggio` group, reading only the layout record.
- **Files.**
  - `src/notation/svg.js` (modify)
  - `src/notation/__tests__/svg.test.js` (modify)
- **Changes.**
  - Import `STEM_THICKNESS` (already imported) and the arpeggio constants
    (`ARPEGGIO_AMPLITUDE`, `ARPEGGIO_PERIOD`, `ARPEGGIO_ARROW_SIZE`) into the
    `constants` import block in `svg.js` (`svg.js:28-44`).
  - Add `renderArpeggio(arp, noteX) → <g data-arpeggio>`:
    - Wrapper group `el("g", { "data-arpeggio": arp.direction })`.
    - Compute the wiggle's x as `noteX - arp.dx`. Build the path `d` with
      `wigglePathD(x, arp.topY, arp.bottomY, ARPEGGIO_AMPLITUDE, ARPEGGIO_PERIOD)`
      and emit it as a `<path>` with `{ d, fill: "none", stroke: INK,
      "stroke-width": STEM_THICKNESS, "data-arpeggio-wiggle": "" }` (same stroke
      attributes as `renderSpan`, `svg.js:984-989`). Append to the wrapper. The
      wiggle is **always** present.
    - Arrowhead: branch on `arp.direction`, mirroring how `renderHairpin` branches
      on the span `kind` (`svg.js:1018`). For `up`, draw a "^" at the top end
      (`arp.topY`); for `down`, draw a "v" at the bottom end (`arp.bottomY`); for
      `nondirectional`, **no** arrowhead. Build the arrowhead as a nested
      `el("g", { "data-arpeggio-arrow": "" })` containing a **pair of `<line>`
      strokes** (use the existing `line(...)` helper at `STEM_THICKNESS`,
      `ARPEGGIO_ARROW_SIZE` for the stroke length), matching the two-`<line>`
      hairpin precedent. Append the arrow group only for `up`/`down`.
    - Return the wrapper group.
  - In `renderNote` (`svg.js:704-768`), near the accidental loop
    (`svg.js:748-756`), add the single guarded call:
    `if (note.arpeggio) g.appendChild(renderArpeggio(note.arpeggio, note.x));`
    Drawing inside the note `<g>` gives the arpeggio the group's
    `data-hand`/`data-event-index` stamping for free — no event threading.
  - In `svg.test.js`, mirror the `data-*` querySelector assertions
    (`svg.test.js:136, 310-314`): render via the same `renderInto`/`renderSvg`
    harness the file already uses, then assert:
    - `up` ⇒ `[data-arpeggio="up"]` exists and contains `[data-arpeggio-arrow]`,
      and the arrow is near `topY` (smaller Y);
    - `down` ⇒ `[data-arpeggio="down"]` exists with `[data-arpeggio-arrow]` near
      `bottomY` (larger Y);
    - `nondirectional` ⇒ `[data-arpeggio="nondirectional"]` exists but
      `[data-arpeggio-arrow]` is **absent**;
    - the wiggle is a `<path>` — `[data-arpeggio-wiggle]` `tagName.toLowerCase()
      === "path"`;
    - a **rest** with `arpeggio` set ⇒ **no** `[data-arpeggio]` node anywhere.
- **Depends on.** T4, T5, T6.
- **Traces to.** R2, R3, R5, R6, R8, AC3, AC4, AC5, AC6.
- **Acceptance.** All new `svg.test.js` assertions pass; the rest case produces no
  `[data-arpeggio]` node; `nondirectional` has no arrow. `npm run test:unit`
  green.

---

### T8 — Combined-markings unit test (arpeggio + tie + dots + dynamic)

- **Goal.** Prove the arpeggio renders together with other per-event markings,
  each in its own region, with the arpeggio left of the accidentals — the
  easy-to-forget independence case.
- **Files.**
  - `src/notation/__tests__/svg.test.js` (modify) and/or
    `src/notation/__tests__/layout.test.js` (modify)
- **Changes.** Add one explicit test on a chord that carries `arpeggio` together
  with `tie`, `dots`, and `dynamic` (use a chord with at least one accidental so
  the left-of-accidentals claim is testable). Assert: each marking's `data-*`
  node is present (`[data-arpeggio]`, the tie/span node, `[data-dot]`, the dynamic
  text node) and the arpeggio's x (`noteX - dx`) sits to the **left** of the
  leftmost accidental (`noteX - max(acc.dx)`), i.e. `dx > max(acc.dx)`. Mirror the
  existing multi-`data-*` assertion style in the file.
- **Depends on.** T6, T7.
- **Traces to.** R7, AC7.
- **Acceptance.** The combined-markings test passes; `npm run test:unit` green.

---

### T9 — End-to-end specs (front-end render, editor authoring, never-blocks/round-trip)

- **Goal.** Cover what unit tests cannot — the real two-surface render and the
  save-path topology — with three thin clones of existing e2e tests.
- **Files.**
  - `specs/render.spec.js` (modify)
  - `specs/editor.spec.js` (modify)
- **Changes.**
  - **Front-end render (`render.spec.js`).** Mirror the existing
    `publishPostWithSong` + `blockSvg` data-locator tests (`render.spec.js:470-`,
    `:484-501`). Publish a post whose song has `arpeggio: "up"` on a chord; assert
    the published `blockSvg` contains `[data-arpeggio="up"]` and
    `[data-arpeggio-arrow]`. Also assert a `nondirectional` arpeggio renders
    `[data-arpeggio="nondirectional"]` with **no** `[data-arpeggio-arrow]`.
  - **Editor authoring (`editor.spec.js`).** Mirror the existing visual-control
    authoring tests (the dynamic/clef/language tests, e.g. the `getByLabel(...)`
    pattern at `editor.spec.js:254`, `:976`). Select a note, set the "Arpeggio"
    `SelectControl` (`getByLabel("Arpeggio")`) to "Up", assert the stored song
    carries `arpeggio: "up"` and the canvas SVG shows `[data-arpeggio="up"]`; then
    set it to "None" and assert the `arpeggio` key is gone from the stored song.
  - **Never-blocks / round-trip (`editor.spec.js`).** Clone the existing
    "the language field round-trips through JSON mode and never blocks saving"
    test (`editor.spec.js:901`). With a raw `arpeggio: "sideways"` typed in JSON
    mode: assert the song still saves (the "never blocks" half) and that a **valid**
    `arpeggio` value round-trips through JSON mode unchanged.
- **Depends on.** T1, T3, T6, T7.
- **Traces to.** R8, R11, R12, R13, AC1, AC2, AC4, AC8.
- **Acceptance.** `npm run test:e2e` passes for the three new specs (they need
  `wp-env`; run the e2e suite to confirm). The never-blocks test saves the
  `"sideways"` value without being gated.

---

## Final gate (last task to run)

After T1–T9, run `npm run lint` and `npm run check` (biome) and fix any
formatting/lint issues, then a full `npm run test:unit`. Confirm the untouched-set
holds: `git diff --name-only` shows changes only in `src/song/schema.js`,
`src/song/__tests__/schema.test.js`, `src/song/__tests__/validate.test.js`,
`src/editor/songModel.js`, `src/editor/inspector/NotePanel.js`,
`src/notation/constants.js`, `src/notation/layout.js`, `src/notation/svg.js`,
their `__tests__`, and `specs/` — and **nothing** in `src/edit.js`,
`src/song/validate.js` (the validator **source** — note this is distinct from the
allowed `src/song/__tests__/validate.test.js` test file),
`src/notation/glyphs.js`, or the font.
