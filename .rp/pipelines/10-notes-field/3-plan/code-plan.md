# Code Plan: Free-text `notes` annotations placeable above or below either staff

## Overview

The Piano Block stores a song as JSON and renders it as grand-staff sheet music (SVG). Today the only free-form annotation is a single per-event `chordSymbol` string that always renders above the right-hand staff. This work replaces `chordSymbol` with one general **notes** capability: a note holds free `text` plus an explicit `placement` (`above` / `below`), attaching in two modes — **per-event** (`event.notes`, inheriting the event's staff + horizontal column) and **standalone** (`measure.notes`, carrying an explicit `staff` and optional `beat` horizontal anchor). All four grand-staff positions (above/below each staff) become reachable, with notes stacking outward and a flexing inter-staff gap / bottom margin. `chordSymbol` is removed as a clean break: legacy songs that still carry it stay valid but stop rendering, with no auto-migration.

The work is sequenced so each layer lands with its tests before the next depends on it **and the unit suite stays green after every task**: (1) schema data-model swap, (2) add `NOTE_SIZE` + the four new constants while keeping `CHORD_SYMBOL_SIZE` as a temporary alias (so existing importers keep resolving), (3) the `chordSymbol` token removal / `note`-vocabulary rename across code + tests + docs — which switches the `layout.js`/`svg.js` size imports to `NOTE_SIZE` first, then deletes the alias last so no import is ever left dangling, (4) per-event `notes` collection in layout, (5) standalone `notes` collection + beat→X interpolation in layout (X stored measure-relative, so the over-content clamp uses the relative right edge `scaledContent`, not the absolute `measureRightX`), (6) the four-band geometry with the PAIR A flex + dynamics dodge, (7) per-event emit with band Y + observability attributes, (8) standalone emit with raw band Y + `data-staff` (emitting the relative X with no `measure.x` subtraction), (9) end-to-end coverage. The validator (`src/song/validate.js`) is intentionally **not changed** — every new rule is expressible declaratively in the schema.

This plan is standalone; it names exact repo paths and the design's constants, formulas, and function/anchor names. The Code phase dispatches one fresh `code-writer` per task, sequentially, sharing one working tree, using TDD. Documentation **content** for the new `notes` feature (the full field docs and the migration line) is authored in the later Docs phase via `doc-plan.md`; this plan only removes the `chordSymbol` **token** from `docs/` where the spec's clean-break acceptance criterion requires it (Task 3).

### Conventions for every task

- **Tests live under** `src/**/__tests__/*.test.js` (Jest via `npm run test:unit` / `wp-scripts test-unit-js`) and `specs/*.spec.js` (Playwright via `npm run test:e2e`). Unit tests assert the layout model (plain data) and the emitted jsdom DOM directly; e2e tests assert the rendered SVG on a real page. Follow the existing patterns in those files.
- **Lint/format:** Biome (`npm run check`). Keep imports sorted as the files already are.
- **Geometry stays in `layout.js`; `svg.js` stays math-free** (it only consumes already-computed sp values and maps symbolic values to glyph names). Do not introduce layout arithmetic into `svg.js`.
- **All Y in staff-space (sp);** Y grows downward, so "above" = smaller Y, "below" = larger Y.

---

## Tasks

### Task 1: Schema — add `eventNote` / `standaloneNote` `$defs`; swap `event.chordSymbol` → `event.notes`; add `measure.notes`

- **Goal:** Make the new data model conformant and the old `chordSymbol` property undeclared, with zero validator changes.
- **Files:**
  - `src/song/schema.js`
  - `src/song/__tests__/validate.test.js`
- **Changes:**
  - In `src/song/schema.js`, add two new entries to `$defs` exactly as the design specifies (enums inline, matching the file's "publishable verbatim" convention):
    - `eventNote`: `{ type: "object", required: ["text", "placement"], properties: { text: { type: "string" }, placement: { enum: ["above", "below"] } } }`.
    - `standaloneNote`: `{ type: "object", required: ["text", "placement", "staff"], properties: { text: { type: "string" }, placement: { enum: ["above", "below"] }, staff: { enum: ["rightHand", "leftHand"] }, beat: { type: "number", minimum: 0 } } }`.
  - **Do NOT add `staff` or `beat` to `eventNote`.** Their absence from `eventNote` is load-bearing: it makes a stray `staff`/`beat` on a per-event note an *unknown* key (permissively ignored) rather than a validation error.
  - In the `event` `$def` `properties` (currently line ~145), **delete** `chordSymbol: { type: "string" }` and **add** `notes: { type: "array", items: { $ref: "#/$defs/eventNote" } }`. Leave the existing `if`/`then` block on `event` (and its `biome-ignore` comment on the `then` line) untouched.
  - In the `measure` `$def` `properties` (currently lines ~72–84), **add** `notes: { type: "array", items: { $ref: "#/$defs/standaloneNote" } }`. No existing `notes` key on `measure`, so no collision.
  - In `src/song/__tests__/validate.test.js`, retarget the existing `chordSymbol: "C"` usage in the comprehensive valid song (lines ~24 comment and ~53) onto a valid `notes` array (e.g. `notes: [{ text: "C", placement: "above" }]`), and reword the line-24 comment from `chordSymbol` to `notes`. Add the new validation cases listed under Acceptance.
- **Depends on:** none
- **Traces to:** Spec requirements 1, 2, 3, 4, 9, 10, 11, 12, 13; design "Schema additions" + Decision "Two `$defs` for the two attachment modes; `beat` validated declaratively". Spec ACs: data-model validity, `text: ""` valid, missing `text`/`placement` errors, `placement`/`staff` enum errors, `staff` required on standalone, stray-field ignored, `beat: -1` error, `beat: 0/0.5/99` valid, per-element error path.
- **Acceptance:**
  - An `event` with `notes: [{ text: "C", placement: "above" }]` validates as valid.
  - A `type: "rest"` event with `notes: [{ text: "pedal", placement: "below" }]` validates as valid.
  - An `event` with no `notes` key, and an `event`/`measure` with `notes: []`, all validate as valid.
  - A `measure` with `notes: [{ text: "rit.", placement: "above", staff: "rightHand" }]` validates as valid; both `staff: "leftHand"` and `staff: "rightHand"` are valid.
  - A note with `text: ""` is valid; a note with no `text` field fails, with an error path pointing at that note element.
  - A note with `placement` omitted fails; a note with `placement: "middle"` (or any value outside `above|below`) fails.
  - A standalone note with `staff` omitted fails; with an invalid `staff` value fails.
  - A per-event note carrying a stray `staff` or `beat` field is valid and the stray field is ignored (no error).
  - A standalone note with `beat: -1` fails; with `beat: 0`, `beat: 0.5`, and `beat: 99` each is valid.
  - For a `notes` array whose second element has a bad `placement`, the reported error path identifies that element and field (matches `…notes[1].placement`).
  - The whole `validate.test.js` suite passes (`npm run test:unit`), with no `chordSymbol` token remaining in that file.

### Task 2: Constants — add `NOTE_SIZE` (keeping `CHORD_SYMBOL_SIZE` as a temporary alias); add the four new note constants

- **Goal:** Provide the renamed size constant and the new geometry constants the layout/emit work consumes, before any consumer references them — **without breaking the existing importers** (`layout.js:33`, `svg.js:32`), so the unit suite stays green after this task.
- **Files:**
  - `src/notation/constants.js`
- **Changes:**
  - Add a new export `NOTE_SIZE = 2.8` (in the "Text sizes / vertical gaps" region, JSDoc describing note-annotation text size — free author text). Then **keep `CHORD_SYMBOL_SIZE` as a temporary alias of `NOTE_SIZE`** — `export const CHORD_SYMBOL_SIZE = NOTE_SIZE;` — so the existing importers (`layout.js:33` / `layout.js:2279`, `svg.js:32` / `svg.js:867`) keep resolving and the suite stays green. **Do NOT delete `CHORD_SYMBOL_SIZE` in this task.** The alias is removed in Task 3, *after* `layout.js` and `svg.js` have switched their imports to `NOTE_SIZE`; Task 3's existing token-removal grep already enforces that the alias is gone by the end of Task 3.
    - Rationale (build-green-at-each-step): `@wordpress/scripts` (Babel + CJS interop) resolves a missing named import to `undefined` rather than throwing at load, so deleting `CHORD_SYMBOL_SIZE` here while `layout.js`/`svg.js` still import it would make `topMarginLayout` compute `topExtent = d + undefined = NaN` and `renderHandText` emit `font-size: undefined` — turning the layout/svg unit suites red between Task 2 and Task 3. The alias keeps both names live for exactly the Task 2 → Task 3 window.
    - When rewording the old JSDoc: move the description onto `NOTE_SIZE`; the alias line may carry a one-line JSDoc noting it is a deprecated temporary alias removed in the clean-break task.
  - Add the following new exported constants (in the "Text sizes / vertical gaps" region, with JSDoc matching the file's style), using the design's recommended starting values within the documented ranges:
    - `NOTE_GAP_STAFF = 1` — clearance (sp) between a staff line and the nearest note baseline (range ~0.6–1.0; start at 1).
    - `MID_GAP = 1.2` — clearance (sp) between the below-RH and above-LH sub-bands inside the inter-staff gap when both are present (range ~1.0–1.2).
    - `DYNAMICS_LANE_RESERVE = 4.5` — the dynamics-glyph-box depth (sp) a below-RH/below-LH note dodges past when its hand has dynamics; it is the `baseOffset` for a below band whose hand has dynamics and feeds BOTH the per-note baseline and the gap/bottom-margin flex.
    - `NOTE_CLAMP_INSET = 1` — horizontal back-off (sp) from the trailing barline for over-content `beat` clamping.
  - Leave `TEXT_LANE_GAP = 0.6` as-is; its JSDoc may be lightly extended to note it is also reused as the per-note stack gap (one step = `NOTE_SIZE + TEXT_LANE_GAP` = 3.4 sp). Do not change its value. Note: `TEXT_LANE_GAP`'s JSDoc currently mentions "chord" — Task 3 rewords that prose to remove the `chordSymbol`/`chord` token where required.
- **Depends on:** none (can land before or after Task 1; placed second so the rename + new constants exist before any layout/svg consumer)
- **Traces to:** Design "New constants (`src/notation/constants.js`)"; Decisions PAIR A and the X-anchoring clamp. Spec requirements 14, 17, 20 (geometry inputs).
- **Acceptance:**
  - `NOTE_SIZE` is exported with value `2.8` (a unit test importing `NOTE_SIZE` resolves to `2.8`).
  - `CHORD_SYMBOL_SIZE` is **still exported** and equals `NOTE_SIZE` (`2.8`) — the temporary alias keeps the existing importers working; it is removed in Task 3.
  - `NOTE_GAP_STAFF`, `MID_GAP`, `DYNAMICS_LANE_RESERVE`, `NOTE_CLAMP_INSET` are each exported numbers with the values above.
  - The **full unit suite** passes (`npm run test:unit`) — because the alias preserves `CHORD_SYMBOL_SIZE`, `layout.js`/`svg.js` still resolve their imports and nothing goes red. (No dangling import is left at the end of this task.)
  - `npm run check` reports no lint/format issues for `constants.js`.

### Task 3: Clean break — remove every remaining `chordSymbol`/`chord-symbol`/`CHORD_SYMBOL` token across code, tests, and docs; rename the `note` vocabulary; keep behaviors valid via retargeting

- **Goal:** Eliminate the `chordSymbol` token everywhere it remains — including switching the `layout.js`/`svg.js` size imports from the `CHORD_SYMBOL_SIZE` alias to `NOTE_SIZE` and then **deleting the temporary alias from `constants.js`** — and replace the chord-lane vocabulary with the `note` vocabulary, while preserving the two locked behaviors (above-RH free-text rendering, XSS-inert verbatim text) by retargeting (not deleting) their tests onto `notes`. Because Task 2 left the alias in place, the tree is green entering this task; this task's edits must keep it green at completion (the alias is removed only once every importer has been switched to `NOTE_SIZE`, so no dangling import is ever left).
- **Files:**
  - `src/notation/constants.js`
  - `src/notation/layout.js`
  - `src/notation/svg.js`
  - `src/render.php`
  - `src/notation/__tests__/layout.test.js`
  - `src/notation/__tests__/svg.test.js`
  - `specs/render.spec.js`
  - `specs/editor.spec.js`
  - `docs/song-format.md`
  - `README.md`
- **Changes:** (this is a transitional rename; the full four-band model arrives in Task 6. The above-RH single-lane behavior is preserved 1:1 here so nothing regresses mid-sequence.)
  - **Ordering (keep the suite green):** first switch the two importers (`layout.js`, `svg.js`) from `CHORD_SYMBOL_SIZE` to `NOTE_SIZE`, **then** delete the `CHORD_SYMBOL_SIZE` alias from `constants.js`. Doing the alias deletion last means no module ever imports a name that does not exist, so the suite never goes red mid-task. The end-of-task grep below proves the alias is gone.
  - **`src/notation/constants.js`:**
    - Delete the temporary `CHORD_SYMBOL_SIZE` alias added in Task 2 (and its JSDoc line). After this, `NOTE_SIZE` is the only size export. Do this **after** the `layout.js`/`svg.js` import switches below, so no importer is left dangling at any intermediate point.
  - **`src/notation/layout.js`:**
    - Update the import from `./constants.js` (line ~33): replace `CHORD_SYMBOL_SIZE` with `NOTE_SIZE`, and update its use at `layout.js:2279` (`topExtent = d + NOTE_SIZE`).
    - In `collectEventTexts` (currently ~1550–1557): change the `chordSymbol` read to loop `event.notes`. For each element of `event.notes`, when `typeof el?.text === "string" && el.text.length > 0`, push `{ kind: "note", x, text: el.text, placement: el.placement }`. Keep the existing `dynamic` push. Reword its JSDoc to describe per-event `notes` (drop the `chordSymbol` token and the `@param {{ dynamic?: string, chordSymbol?: string }}` annotation → `{{ dynamic?: string, notes?: object[] }}`). For this transitional task it is acceptable that all four placements share the single above-RH chord lane (Task 6 replaces lane selection); the `placement` field is carried on the primitive now so Task 6/7 can route it.
    - Rename `systemHasChordSymbols` → a note-presence predicate (e.g. `systemHasNotesAboveRH` or, to minimize churn before Task 6 generalizes it, `systemHasNotes`) that scans both hands' `event.notes` for any element with non-empty `text` (currently it scans RH `chordSymbol` only). For this task, keep its single use in `topMarginLayout` driving the above-RH lane reservation so the transitional behavior matches today's above-RH rendering; Task 6 supersedes it with per-band predicates.
    - In `topMarginLayout` (currently ~2260–2300): rename the local `chordD`/`chordSymbolY` returned key to `noteAboveRHLaneY` (or keep a single above-RH lane key) and replace `CHORD_SYMBOL_SIZE` with `NOTE_SIZE`. Update the `band` assembly in `buildLayoutModel` (currently `chordSymbolY: top.chordSymbolY` at ~1700) to the renamed key. Update the JSDoc return type accordingly.
    - Remove every remaining `chordSymbol` / `chord symbol` token in comments/JSDoc in this file (e.g. the `collectEventTexts` doc, the `buildLayoutModel` doc that lists "chord symbols", the `topMarginLayout` doc).
  - **`src/notation/svg.js`:**
    - Update the import (line ~32): replace `CHORD_SYMBOL_SIZE` with `NOTE_SIZE`, and update its use at `svg.js:867` (`"font-size": NOTE_SIZE`).
    - In `renderMeasure` (currently ~469–506): the `chordDyR`/`chordDyL` locals read `band.chordSymbolY`; rename them to read the renamed band key (the above-RH lane Y) and pass them through to `renderHand` as before. (Task 6/7 generalize this to the four-band conversion; for this transitional task keep the single above-RH lane wiring.)
    - In `renderHand` (currently ~514) and `renderHandText` (currently ~845–872): rename the `chordDy` parameter/usage as needed; change the emit branch so a `text.kind === "note"` element emits the `<text>` with `"data-text": "note"` (was `"chord-symbol"`), `"font-size": NOTE_SIZE`, `"text-anchor": "middle"`, no `font-style`/`font-weight`, written via `setText`. Keep the dynamic branch unchanged. For this transitional task the note Y may remain the single above-RH lane Y (the `chordDy ?? -5` fallback) — Task 7 adds `data-placement` and the four-band Y.
    - Reword the file header comment (line ~8) and the `renderHand`/`renderHandText` JSDoc to drop the `chordSymbol`/"chord symbol" tokens (use "author free text" / "note").
  - **`src/render.php`:** reword the comment on line ~13 that names `chordSymbol` as the script-breakout example to name `notes` (or "a note's text"). The escaping logic is field-agnostic and stays unchanged.
  - **`src/notation/__tests__/layout.test.js`:** retarget the `chordSymbol: "C"` fixture (line ~844) onto `notes: [{ text: "C", placement: "above" }]`. Update the assertion at line ~1314 (`t.kind === "chordSymbol" && t.text === "C"`) to `t.kind === "note" && t.text === "C"`. Update the band-lane assertions at lines ~1487–1488 and ~1530 (`band.chordSymbolY`) to the renamed above-RH lane key. Keep the relative ordering assertions (`ottavaAboveLaneY < noteAboveRHLaneY < rightStaffTopY`, and null-when-absent) intact against the renamed key.
  - **`src/notation/__tests__/svg.test.js`:** retarget the `chordSymbol: "C"` fixture (line ~29) onto `notes: [{ text: "C", placement: "above" }]`; retarget the XSS fixture (line ~119) onto `notes: [{ text: "<script>alert(1)</script>", placement: "above" }]`; change the selector at line ~134 from `[data-text="chord-symbol"]` to `[data-text="note"]`. The inert-text assertions stay (no `<script>`/`<foreignObject>`, `textContent` exact, zero children).
  - **`specs/render.spec.js`:** retarget the `chordSymbol: "C"` fixture (line ~73) and the `chordSymbol: HOSTILE_CHORD` fixture (line ~230) onto per-event `notes` with `placement: "above"`; change the selectors at lines ~343 and ~478 from `[data-text="chord-symbol"]` to `[data-text="note"]`; reword the comments at lines ~48, ~215, ~341 that name `chordSymbol`.
  - **`specs/editor.spec.js`:** retarget the `ROUND_TRIP_SONG` `chordSymbol: 'C7 & <alt> "sus"'` (line ~66) onto `notes: [{ text: 'C7 & <alt> "sus"', placement: "above" }]`, and reword the comment at lines ~51–54 (drop the `chordSymbol` token; the round-trip exercises a note's free text).
  - **`docs/song-format.md`:** remove every `chordSymbol` token — the `event :=` schema line (~167), the bullet (~178), and the two JSON examples (~183, ~298). Replace with a `notes?` entry consistent with the new model (a brief placeholder is acceptable here; the full field documentation and the migration line are authored in the Docs phase). The hard requirement for THIS task is only that **no `chordSymbol` token remains** in the file.
  - **`README.md`:** reword the line (~162) that uses `chordSymbol` as the breakout example (use "a note's text" / `notes`).
  - After all edits, `grep -rn "chordSymbol\|chord-symbol\|CHORD_SYMBOL" src/ specs/ docs/ README.md` must return **zero** matches.
- **Depends on:** Task 1 (schema), Task 2 (`NOTE_SIZE` added + `CHORD_SYMBOL_SIZE` alias present so the tree is green entering this task)
- **Traces to:** Spec requirements 5, 6, 7, 8 (partial: token removal + legacy-valid-non-rendering; the migration line content is Docs phase), 18, 19; design Decision "Remove `chordSymbol` as a clean break; rename to `note` vocabulary; reuse safety paths". Spec ACs: no `chordSymbol` token anywhere; legacy `chordSymbol` valid + non-rendering; verbatim `Gm7`; hostile text inert; `text: ""` renders nothing.
- **Acceptance:**
  - `grep -rn "chordSymbol\|chord-symbol\|CHORD_SYMBOL"` across `src/`, `specs/`, `docs/`, `README.md` returns no matches — including no `CHORD_SYMBOL_SIZE` alias remaining in `constants.js`.
  - No module imports `CHORD_SYMBOL_SIZE`: `layout.js` and `svg.js` both import and use `NOTE_SIZE` only; nothing resolves to `undefined`.
  - The full unit suite passes (`npm run test:unit`): the retargeted layout/svg tests pass against the `note` vocabulary, and the size constant resolves (no `NaN` topExtent / no `font-size: undefined`).
  - A per-event note with `text: "Gm7"` produces a rendered `<text data-text="note">` whose `textContent` is exactly `Gm7`.
  - A per-event note with `text: "<script>alert(1)</script>"` renders as inert text: no `<script>`/`<foreignObject>` node, `textContent` equals the literal string, zero child nodes.
  - A per-event note with `text: ""` produces no text node.
  - A song that still carries a legacy `event.chordSymbol: "C"` validates as valid (unknown key) and renders no annotation from it (no `<text data-text="note">` is produced for that legacy key).
  - `npm run check` passes (Biome) for the edited source files.

### Task 4: Layout — broaden per-event `notes` collection to carry `placement` for all four routings

- **Goal:** Ensure `collectEventTexts` emits one note primitive per `event.notes` element with its `placement`, so the band model (Task 6) and emit (Task 7) can route each note to the correct band. (Task 3 already introduced the loop transitionally; this task finalizes the contract and locks it with tests independent of band geometry.)
- **Files:**
  - `src/notation/layout.js`
  - `src/notation/__tests__/layout.test.js`
- **Changes:**
  - Confirm/finalize `collectEventTexts` so that for an event with `notes: [{text, placement}, …]` it pushes one `{ kind: "note", x, text, placement }` per element whose `text` is a non-empty string, preserving array order (array order = stacking order, consumed later). Elements with empty/absent `text` push nothing. The same routine runs for both notes and rests (it is already called in the rest branch and both note branches of `layoutHand`), so a `rest` event's `notes` are collected identically.
  - Do not yet bucket by placement or compute Y — that is Task 6/7. This task only guarantees the primitive list is complete and ordered, on both hands and on rests.
- **Depends on:** Task 3
- **Traces to:** Spec requirements 1, 2, 20; design "Note primitive (layout → emit)" + Decision "Uniform outward stacking" (per-event group key `(event, placement)`). Spec ACs: rest carrying `notes` renders in the below band; an event with both above + below notes; N same-placement notes at N distinct positions.
- **Acceptance:**
  - For an event with `notes: [{ text: "C", placement: "above" }, { text: "pedal", placement: "below" }]`, the hand's `texts` collection contains two `{ kind: "note" }` primitives — one with `placement: "above"`, one with `placement: "below"`, both at the event's column X.
  - For an event with three `notes` of the same `placement`, the `texts` collection contains three `{ kind: "note" }` primitives in array order, all at the event's column X.
  - For a `rest` event with `notes: [{ text: "pedal", placement: "below" }]`, the `texts` collection contains a `{ kind: "note", placement: "below" }` primitive at the rest's column X.
  - A note element with `text: ""` produces no primitive.
  - Existing layout tests still pass (`npm run test:unit`).

### Task 5: Layout — `collectStandaloneNotes` + beat→X interpolation into `measureModel.standaloneNotes`

- **Goal:** Resolve `measure.notes` into a measure-level `standaloneNotes` collection with each note's horizontal X computed by interpolating its `beat` onset over the justified column grid (with the over-content clamp), carrying `text`, `placement`, `staff`, and a raw-`beat` group key for stacking.
- **Files:**
  - `src/notation/layout.js`
  - `src/notation/__tests__/layout.test.js`
- **Changes:**
  - Add a new pure helper `collectStandaloneNotes(measureNotes, ctx)` (or inline at the measure-walk site) that runs at the measure-walk inside `buildLayoutModel` (currently ~1753–1855), where `columnX`, `ml.columns`, `ml.measureEnd`, `leadInset`, `scaledContent`, and `advanceScale` are all in scope. For each element of `measure.notes` with a non-empty string `text`, produce `{ kind: "note", x, text, placement, staff }` **plus the raw-`beat` group key** (see the grouping bullet below).
  - **Coordinate frame (load-bearing — fixes the frame mismatch flagged in review 1).** The X stored on every standalone primitive MUST be **measure-relative** — the same frame as `columnX` (`layout.js:1404` JSDoc: "Onset → relative X within the measure"; `cx` starts at `leadInset`) and the same frame the per-event `texts` carry. This is so Task 8 can emit the node directly under `<g data-measure transform="translate(measure.x 0)">` with **no** `measure.x` subtraction (matching the per-event `texts` convention, not the barline convention). Do **NOT** use `measureRightX` in the clamp: `measureRightX = x + scaledContent` (`layout.js:1804`) is **absolute / system-coordinate** (it adds the measure's absolute `x`), so mixing it with the relative `columnX`/`leadInset` terms inside one `min(...)` is a frame error — for any non-first measure (`x > 0`) the relative `beatToX(...)` is always far below `measureRightX − NOTE_CLAMP_INSET`, so the clamp would silently never fire and an over-content `beat` would not be reined in. The correct measure-relative right edge is `scaledContent` (which equals `measureRightX − x`, i.e. the measure's content width from its own left origin), since the relative grid runs `leadInset … leadInset + scaledGrid = scaledContent`.
  - **X resolution** (per the X-anchoring decision, all terms in the measure-relative frame):
    - A no-`beat` note is treated as `beat: 0`, which maps to the measure's content-left edge (`leadInset`).
    - For a `beat` value, interpolate over the *scaled* relative `columnX` grid: find the bracketing onsets `[t_i, t_next]` in the sorted onset grid where `t_i ≤ beat < t_next`; `x(beat) = lerp(columnX(t_i), nextX, (beat − t_i) / (t_next − t_i))`. The last column extends to `scaledContent` (the relative content right edge); guard the span denominator with `|| 1` to stay NaN-safe. (Use the same scaled relative column X positions the per-event notes use, so a standalone `beat` that coincides with an event column lands at that event's X.)
    - **Over-content clamp (measure-relative both sides):** `x = min( beatToX(min(beat, measureEnd)), scaledContent − NOTE_CLAMP_INSET )` so an over-content `beat` (e.g. 99) is reined in to `scaledContent − NOTE_CLAMP_INSET` — strictly inside the measure content, one `NOTE_CLAMP_INSET` back from the trailing barline (whose relative X is `scaledContent`), never straddling it. Both terms of the `min(...)` are now in the relative frame, so the clamp actually fires for every measure (including non-first measures), and the stored X needs no later translate correction.
  - Push the resolved records onto a new `measureModel.standaloneNotes` array (parallel to `barlines`/`inline`), added to the `measureModels.push({ … })` object (currently ~1842–1851). Name it `standaloneNotes` (NOT `notes`) to avoid colliding with `layoutHand`'s internal `notes` (laid-out noteheads).
  - Do not compute Y here — band Y is Task 6/7. The standalone primitive carries `x`, `text`, `placement`, `staff`, **and a raw-`beat` group key** (see next bullet).
  - **Store the raw-`beat` group key on each record (load-bearing — fixes the Task 5 ↔ Task 8 contradiction flagged in review 2).** Grouping for stacking is by the **raw** `beat` (pre-interpolation), per the design's stacking decision: the standalone group key is `(staff, placement, raw beat ?? "noBeat")`. Resolved-X / array order alone is **insufficient** here and must NOT be relied on: two distinct over-content beats clamp to the *same* resolved X (e.g. `beat: 50` and `beat: 99` both clamp to `scaledContent − NOTE_CLAMP_INSET`), so the raw beat cannot be reconstructed from the stored X, and grouping by epsilon-rounded resolved X is the alternative the design explicitly rejected (design Decision "Uniform outward stacking", alternative 2). Therefore each `standaloneNotes` record MUST carry the raw beat group key directly, so Task 8 can compute its `(staff, placement, raw beat ?? "noBeat")` group **from the record alone, with no re-read of `measure.notes`**. Store it in whichever of these equivalent forms is convenient:
    - carry the raw `beat` as-is (e.g. `beat: el.beat`, with `undefined`/absent meaning the `"noBeat"` group), OR
    - store a precomputed `group` string key (e.g. `` group: `${staff}|${placement}|${beat ?? "noBeat"}` ``), OR
    - precompute and store `stackIndex` (the note's `k` within its `(staff, placement, raw beat ?? "noBeat")` group, in array order) so Task 8 reads `k` directly.
    Whichever form is chosen, the contract is: two notes that share `(staff, placement, raw beat ?? "noBeat")` resolve to the same group (and stack as `k = 0, 1, …` in array order), while `beat: 2` and `beat: 2.0001` (same `staff`/`placement`) resolve to **different** groups (no equality after float comparison — they are distinct raw beats, hence distinct groups). The grouping must use the raw `beat`, never the resolved X.
- **Depends on:** Task 4
- **Traces to:** Spec requirements 17, 20; design Decision "Per-event X from the event column; standalone X by interpolated beat onset with an over-content clamp" + the `standaloneNotes` naming note + Decision "Uniform outward stacking, grouped per (band, anchor)" (standalone group key = `(staff, placement, raw beat ?? "noBeat")`, grouped by the **raw** beat pre-interpolation). Spec ACs: `beat: 2` further right than `beat: 0`; no-`beat` ≈ `beat: 0` and left of `beat: 2`; over-content `beat: 99` still renders within the system's horizontal bounds; N same-`(staff, placement, beat)` standalone notes stack at distinct positions.
- **Acceptance:**
  - For a measure with `notes: [{ text: "a", placement: "above", staff: "rightHand", beat: 0 }, { text: "b", placement: "above", staff: "rightHand", beat: 2 }]`, `measureModel.standaloneNotes` contains two records and the `beat: 2` record's X is strictly greater than the `beat: 0` record's X.
  - For a standalone note with no `beat` and another with `beat: 0` in the same measure, both resolve to (at/near) the same X, and both are to the left of a `beat: 2` note in the same measure.
  - For a standalone note with `beat: 99` in a measure whose content ends well before that, the resolved (measure-relative) X equals `scaledContent − NOTE_CLAMP_INSET` (≤ `scaledContent`, the relative trailing-barline X) and is within the measure's content extent (does not straddle or exceed the trailing barline). This holds for a non-first measure (one with `x > 0`) too: the clamp fires because both terms are in the measure-relative frame.
  - The stored X on every `standaloneNotes` record is measure-relative (same frame as `columnX`): a `beat: 0` standalone note in a non-first measure has X ≈ `leadInset` (not offset by the measure's absolute `x`), so Task 8 can emit it under `<g data-measure>` with no `measure.x` subtraction.
  - Each `standaloneNotes` record carries `kind: "note"`, `text`, `placement`, `staff`, **and a raw-`beat` group key** (the raw `beat` carried as-is, or a precomputed `group`/`stackIndex` derived from `(staff, placement, raw beat ?? "noBeat")`) — sufficient for Task 8 to compute the note's `(staff, placement, raw beat ?? "noBeat")` group from the record alone, with no re-read of `measure.notes`.
  - The stored grouping field uses the **raw** `beat`, not the resolved X: two standalone notes with the same `(staff, placement, raw beat)` — e.g. both `staff: "rightHand", placement: "above", beat: 2` — resolve to the **same** group (stacking as `k = 0, 1` in array order), while a `beat: 2` note and a `beat: 2.0001` note (same `staff`/`placement`) resolve to **different** groups. (Counter-check that the field is not derived from resolved X: two over-content notes — e.g. `beat: 50` and `beat: 99`, same `staff`/`placement` — clamp to the same resolved X yet remain in **different** groups.)
  - A standalone note with `text: ""` produces no record.
  - Existing layout tests still pass (`npm run test:unit`).

### Task 6: Layout — four placement bands with the PAIR A flex (inter-staff gap + bottom margin) and the dynamics dodge

- **Goal:** Compute, per system, the Y anchors for all four bands (above-RH, below-RH, above-LH, below-LH) and the per-note stacked baselines, with the inter-staff gap and bottom margin flexing to exactly the reserved stack heights (collapsing to today's base values when empty), and below-RH/below-LH notes dodging past the dynamics row only when their hand has dynamics.
- **Files:**
  - `src/notation/layout.js`
  - `src/notation/__tests__/layout.test.js`
- **Changes:**
  - **Occupancy scan (per system, before `lhTopY` is set).** Add per-band presence + per-band system-wide MAX stack counts by scanning both hands' `event.notes` and the measure-level `measure.notes`, bucketed into the four bands by `(staff, placement)`:
    - above-RH ← RH `event.notes` with `placement:"above"` + standalone `staff:"rightHand", placement:"above"`.
    - below-RH ← RH `event.notes` with `placement:"below"` + standalone `staff:"rightHand", placement:"below"`.
    - above-LH ← LH `event.notes` with `placement:"above"` + standalone `staff:"leftHand", placement:"above"`.
    - below-LH ← LH `event.notes` with `placement:"below"` + standalone `staff:"leftHand", placement:"below"`.
    - For each band compute `n` = the system-wide MAX number of same-placement notes at any single anchor (per the stacking decision: per-event anchor = `(event, placement)`; standalone anchor = `(staff, placement, raw beat ?? "noBeat")`).
  - **Dynamics-presence per hand (per system).** Add a cheap per-hand `.some(...)` predicate (mirroring the shape of the superseded `systemHasChordSymbols`) detecting whether any event in this system's measures for that hand carries a `dynamic`. Use it to choose `baseOffset`.
  - **Replace `systemHasChordSymbols`** with the per-band presence predicates (or one parameterized helper that scans both hands' `event.notes` + `measure.notes` by `(staff, placement)`). The above-RH presence drives the `topMarginLayout` above-RH lane (renamed from the chord lane in Task 3) — feed it the above-RH stack count so the lane reserves height for the stack, not just one line.
  - **Stack arithmetic (use the design's exact formulas, with the new constants):**
    ```
    STACK_STEP = NOTE_SIZE + TEXT_LANE_GAP            // 3.4 sp, baseline-to-baseline
    DESCENT    = 0.22 * NOTE_SIZE                      // ≈ 0.62 sp
    baseOffset(hand, "below") = hand_has_dynamics ? DYNAMICS_LANE_RESERVE : NOTE_GAP_STAFF
    belowRH_stack = baseOffset(RH,"below") + (nBelowRH - 1) * STACK_STEP + DESCENT   // 0 when nBelowRH == 0
    belowLH_stack = baseOffset(LH,"below") + (nBelowLH - 1) * STACK_STEP + DESCENT   // 0 when nBelowLH == 0
    aboveLH_stack = NOTE_GAP_STAFF          + (nAboveLH - 1) * STACK_STEP + DESCENT  // 0 when nAboveLH == 0; grows up; no dynamics dodge
    effectiveInterStaffGap = max(
        INTRA_STAFF_GAP,                              // base 8 sp — collapse target when empty
        belowRH_stack + aboveLH_stack + (both_present ? MID_GAP : 0)
    )
    ```
    Guard each `*_stack` so it is `0` (not negative) when its band count is `0`, so absent bands contribute nothing and the gap collapses to `INTRA_STAFF_GAP`.
  - **Pipeline reorder (the one structural change):** compute the occupancy scan + `effectiveInterStaffGap` **before** `lhTopY` is set (currently `const lhTopY = rhBottomY + INTRA_STAFF_GAP;` at ~1684). Replace `INTRA_STAFF_GAP` there with `effectiveInterStaffGap`. `lhBottomY` and `systemHeight` then cascade unchanged. `INTRA_STAFF_GAP` has exactly one consumer (this `lhTopY`), so no other site changes.
  - **Flexed bottom margin:** replace `const bottomMargin = SYSTEM_BOTTOM_MARGIN + ledgerBottomExtent(members);` (~1682) with `bottomMargin = max(SYSTEM_BOTTOM_MARGIN + ledgerBottomExtent(members), belowLH_stack + ledgerBottomExtent(members))`.
  - **Band anchors on `band`.** Add the four band anchors (system coordinates) plus the per-note stacking step so emit (Tasks 7/8) can place each note. Per the design's per-note baselines:
    ```
    aboveRH note #k baseline = (above-RH lane Y from topMarginLayout) − k * STACK_STEP   // grows up
    belowRH note #k baseline = rightStaffBottomY + baseOffset(RH,"below") + k * STACK_STEP // grows down
    aboveLH note #k baseline = leftStaffTopY     − NOTE_GAP_STAFF        − k * STACK_STEP  // grows up
    belowLH note #k baseline = leftStaffBottomY  + baseOffset(LH,"below") + k * STACK_STEP // grows down
    ```
    Expose on `band` whatever the emit needs to compute note #k's Y for each band: the four base anchors (above-RH lane Y, `rightStaffBottomY + baseOffset(RH,"below")`, `leftStaffTopY − NOTE_GAP_STAFF`, `leftStaffBottomY + baseOffset(LH,"below")`), the `STACK_STEP`, and per-band growth direction (up for above-*, down for below-*). Keep the existing `rightStaffTopY/BottomY`, `leftStaffTopY/BottomY` anchors — barlines/ledgers/spans derive from them and follow the flex automatically.
  - Update the `band` object literal (~1688–1701) and `topMarginLayout` return/consumers accordingly. Update `buildLayoutModel`'s JSDoc list of texts to say "notes" instead of "chord symbols".
- **Depends on:** Task 4, Task 5
- **Traces to:** Spec requirements 14, 20; design Decision "Four placement bands with an always-flexing inter-staff gap and bottom margin (PAIR A)" + Decision "Uniform outward stacking". Spec ACs: each of the four band placements lands in the correct vertical band; below-RH + above-LH coexist and stay distinguishable; N same-placement notes at distinct positions.
- **Acceptance:**
  - With no inter-staff or below-LH notes present, `band.leftStaffTopY − band.rightStaffBottomY === INTRA_STAFF_GAP` (8 sp) and `bottomMargin` equals today's base (`SYSTEM_BOTTOM_MARGIN + ledgerBottomExtent`) — i.e. the flex collapses to the base values, so existing geometry tests for note-free systems are unchanged.
  - With one below-RH note and one above-LH note present (no dynamics), `band.leftStaffTopY − band.rightStaffBottomY > INTRA_STAFF_GAP` (the gap flexes to fit the 1+1 case) and the invariant `band.leftStaffTopY > band.rightStaffBottomY` still holds.
  - With a below-RH note present and the RH having a dynamic in the system, the furthest below-RH note baseline (`rightStaffBottomY + belowRH_stack − DESCENT`) is strictly above `leftStaffTopY` (a dodged below-RH note never reaches the LH staff).
  - With below-LH notes present, `bottomMargin ≥ belowLH_stack + ledgerBottomExtent` (the bottom margin flexes to hold the below-LH stack).
  - For each of the four bands, the model exposes the data needed to compute note #0 (hugging its staff at the band base offset) and note #k (stacked one `STACK_STEP` further outward), with above-* growing toward smaller Y and below-* toward larger Y.
  - The renamed above-RH lane preserves the existing relative ordering against ottava/tempo lanes (the retargeted ordering test from Task 3 still passes).
  - Existing layout tests pass (`npm run test:unit`).

### Task 7: Emit — per-event note `<text>` at the band Y with `data-text="note"` + `data-placement` (staff via enclosing `data-hand`)

- **Goal:** Emit each per-event note inside its hand's `<g data-hand>` at the correct band Y (local-frame conversion), carrying the observability attributes, with same-placement notes stacked at distinct Ys.
- **Files:**
  - `src/notation/svg.js`
  - `src/notation/__tests__/svg.test.js`
- **Changes:**
  - In `renderMeasure` (~469–506): replace the single `chordDyR`/`chordDyL` (above-RH only) wiring (now renamed in Task 3) with the **four-band local-frame conversions** for per-event notes. Per-event notes live inside `<g data-hand transform="translate(0 staffBottomY)">`, so their `y` is the **local-frame conversion** `bandY − staffBottomY`:
    - RH `placement:"above"` → `(above-RH band Y for note #k) − rightStaffBottomY`.
    - RH `placement:"below"` → `(below-RH band Y for note #k) − rightStaffBottomY`.
    - LH `placement:"above"` → `(above-LH band Y for note #k) − leftStaffBottomY`.
    - LH `placement:"below"` → `(below-LH band Y for note #k) − leftStaffBottomY`.
    Pass the band anchors (or a small per-hand conversion helper, analogous to the old `chordDy`) into `renderHand`/`renderHandText` so the emit selects the band by `(handKey, placement)` and stacks by the note's index k within its `(event, placement)` group.
  - In `renderHand` (~514): when iterating `hand.texts`, for each `kind:"note"` element determine its band from `handKey` + `text.placement`, compute its stacked k (its index among same-placement notes at the same event/anchor — preserve `collectEventTexts` array order from Task 4), and pass the resolved local-frame Y to `renderHandText`.
  - In `renderHandText` (~845–872): for `kind:"note"`, emit `<text x=… y=resolvedLocalY fill=INK font-size=NOTE_SIZE text-anchor="middle" data-text="note" data-placement={text.placement}>` written via `setText`. No `font-style`/`font-weight`. Staff is observable from the enclosing `<g data-hand>` (do NOT add `data-staff` on per-event notes).
  - Update JSDoc to drop any remaining chord-lane language and describe the four-band per-event emit.
- **Depends on:** Task 6
- **Traces to:** Spec requirements 14, 15, 16, 18, 19, 20; design Decision "`data-text="note"` + `data-placement` + staff discriminator" + the two-coordinate-frames detail (per-event uses `bandY − staffBottomY`). Spec ACs: per-event above-RH / below-RH / above-LH / below-LH placement; placement + staff observable; per-event text shares the event's column; event with both above + below notes; N same-placement notes at distinct Ys; rest carrying a below note renders anchored to the rest's column.
- **Acceptance:**
  - A per-event note on a RH event with `placement:"above"` emits `<text data-text="note" data-placement="above">` inside `<g data-hand="rightHand">`, positioned above the RH staff top line (smaller Y than the RH top line in system coordinates).
  - A per-event note on a RH event with `placement:"below"` sits in the inter-staff gap (below the RH bottom line, above the LH top line).
  - A per-event note on a **LH** event with `placement:"above"` sits in the inter-staff gap (below the RH bottom line, above the LH top line), inside `<g data-hand="leftHand">`.
  - A per-event note on a **LH** event with `placement:"below"` sits below the LH bottom line.
  - Each per-event note's `data-placement` is observable on the node; its staff is observable from the enclosing `data-hand`.
  - A per-event note's X equals its event's notehead column X (same horizontal column).
  - An event carrying both an above note and a below note emits two `<text data-text="note">` nodes — one in the above band, one in the below band — both at the event's column X.
  - An event/anchor carrying N same-placement notes emits N `<text>` nodes at N distinct Ys (none lost, none at an identical Y).
  - A `rest` event carrying `notes:[{text:"pedal",placement:"below"}]` emits a below-band `<text data-text="note">` at the rest's column X.
  - `npm run test:unit` passes; `npm run check` passes.

### Task 8: Emit — standalone note `<text>` at the raw band Y with `data-text="note"` + `data-staff` + `data-placement`

- **Goal:** Emit each measure-level standalone note directly under `<g data-measure>` (no hand group) at the **raw** band anchor Y (system coordinates, no local-frame subtraction), carrying `data-staff` for observability, with same-anchor same-placement notes stacked.
- **Files:**
  - `src/notation/svg.js`
  - `src/notation/__tests__/svg.test.js`
- **Changes:**
  - In `renderMeasure` (~469–506): after rendering both hands' primitives, iterate `measure.standaloneNotes` (from Task 5). For each, select the band by `(staff, placement)` and compute note #k's **raw band anchor Y in system coordinates** (per Task 6's band anchors) — these notes live under `<g data-measure transform="translate(measure.x 0)">`, which has **no Y translate**, so the Y is NOT run through the `bandY − staffBottomY` conversion (applying the per-event conversion here would misplace the node). Stack k by the note's index within its `(staff, placement, raw beat ?? "noBeat")` group, computed **from the Task 5 record's stored raw-`beat` group key alone** — do NOT re-read `measure.notes` and do NOT derive the group from the resolved X (two over-content beats clamp to the same X). If Task 5 stored the raw `beat`, build the group key `` `${staff}|${placement}|${beat ?? "noBeat"}` `` and assign k as the running index within each group in array order; if Task 5 stored a precomputed `group` key or `stackIndex`, read it directly.
  - Emit each as `<text x={standalone.x} y={rawBandY} fill=INK font-size=NOTE_SIZE text-anchor="middle" data-text="note" data-staff={standalone.staff} data-placement={standalone.placement}>` written via `setText`. The node is a direct child of the `<g data-measure>` group (not inside any `<g data-hand>`). **X is used as-is:** `standalone.x` is already measure-relative (Task 5 stores it in the `columnX` frame), and `<g data-measure transform="translate(measure.x 0)">` applies the `measure.x` translate — so do **NOT** subtract `measure.x` here (that is the barline/inline convention for absolute-stored X; standalone notes follow the per-event `texts` convention of relative-stored X with no subtraction).
  - Add a small helper (e.g. `renderStandaloneNote(note, band)`) or inline it in `renderMeasure`; keep `svg.js` math-free by reading the band anchors + step from the model.
- **Depends on:** Task 6, Task 7
- **Traces to:** Spec requirements 14, 15, 17, 18, 19, 20; design Decision "`data-text="note"` + `data-placement` + staff discriminator" + the two-coordinate-frames detail (standalone uses the raw band anchor Y) + "Two coordinate frames (a load-bearing emit detail)". Spec ACs: standalone above-RH / below-RH / above-LH / below-LH placement; placement + staff observable; below-RH vs above-LH distinguishable via staff discriminator; `beat`-ordered X; over-content `beat` still renders; per-event + standalone in same measure both render.
- **Acceptance:**
  - A standalone note with `staff:"rightHand", placement:"above"` emits `<text data-text="note" data-staff="rightHand" data-placement="above">` (a direct child of `<g data-measure>`, not inside a `<g data-hand>`), positioned above the RH staff top line.
  - A standalone note with `staff:"rightHand", placement:"below"` sits in the inter-staff gap (below the RH bottom line, above the LH top line).
  - A standalone note with `staff:"leftHand", placement:"above"` sits in the inter-staff gap (above the LH top line).
  - A standalone note with `staff:"leftHand", placement:"below"` sits below the LH bottom line.
  - Each standalone note's `data-staff` and `data-placement` are observable on the node.
  - A below-RH per-event/standalone note and an above-LH note in the same measure both render and remain distinguishable by their staff discriminator (`data-hand` vs `data-staff`) despite sharing the inter-staff band.
  - Two standalone notes with `beat:0` and `beat:2` emit two nodes, the `beat:2` node further right than the `beat:0` node (the relative-X ordering survives the `measure.x` translate, so it holds in non-first measures too).
  - A standalone note with `beat:99` emits a `<text>` node within the measure's content bounds — its measure-relative `x` ≤ `scaledContent − NOTE_CLAMP_INSET`, so after the `measure.x` translate the absolute X stays inside the measure (≤ the trailing barline's absolute X, `measureRightX − NOTE_CLAMP_INSET`), within the system's horizontal bounds.
  - A measure containing both a per-event note and a standalone note emits both nodes.
  - N standalone notes of the same `(staff, placement, raw beat)` — grouped via the Task 5 record's stored raw-`beat` group key, not the resolved X — emit N nodes at N distinct Ys (none lost, none at an identical Y), stacked in array order.
  - Two over-content standalone notes that clamp to the same X but carry **different** raw beats (e.g. same `staff`/`placement` with `beat:50` and `beat:99`) are treated as **different** groups: both emit at note #0 of their respective groups (not stacked onto one another), confirming the group derives from the stored raw `beat`, not the resolved X.
  - `npm run test:unit` passes; `npm run check` passes.

### Task 9: End-to-end coverage — `notes` rendering, placement/staff observability, safety, and coexistence on a real page

- **Goal:** Lock the spec's observable rendering behavior end-to-end on a rendered page (Playwright), covering all four bands across both attachment modes, free-text/XSS safety, and coexistence — extending the retargeted e2e fixtures from Task 3.
- **Files:**
  - `specs/render.spec.js`
  - (optionally) `specs/editor.spec.js` if a round-trip assertion needs extension
- **Changes:**
  - Extend the comprehensive render fixture (or add a focused fixture) so a single rendered song exercises: a per-event note in each of the four bands; a standalone note in each of the four bands (`{staff, placement}` × 2); a `beat:0` vs `beat:2` ordering pair; an over-content `beat:99`; an event with both an above and a below note; a below-RH note and an above-LH note coexisting; a per-event note + a standalone note in the same measure; and hostile text (`<script>…`, `'C7 & <alt> "sus"'`).
  - Assert via attribute-qualified selectors (consistent with existing specs): `[data-text="note"]` for note text nodes; `[data-placement="above"]`/`[data-placement="below"]`; `[data-staff="rightHand"]`/`[data-staff="leftHand"]` for standalone; staff via enclosing `[data-hand]` for per-event. Assert ordering (beat-X), distinct Ys for stacked notes, no `<script>`/`<foreignObject>` for hostile text, and verbatim `textContent`.
  - Keep the existing AC1/AC2/AC7 assertions intact; the retargeted `[data-text="note"]` selectors from Task 3 should already be in place.
- **Depends on:** Task 7, Task 8
- **Traces to:** Spec requirements 14–20; all "Rendering — position and anchoring" and "Rendering — free text, safety, and coexistence" acceptance criteria, verified end-to-end.
- **Acceptance:**
  - The e2e suite (`npm run test:e2e`) renders the fixture and asserts: a `[data-text="note"]` node exists in each of the four bands for both attachment modes (per-event via `[data-hand]` + `[data-placement]`, standalone via `[data-staff]` + `[data-placement]`).
  - A below-RH note and an above-LH note are both present and distinguishable by staff discriminator.
  - A standalone `beat:2` note renders further right than a `beat:0` note; a `beat:99` note still renders within the system's horizontal bounds.
  - Hostile text renders as inert literal `textContent` with no `<script>`/`<foreignObject>` node produced.
  - A measure with both a per-event note and a standalone note renders both; an event with both an above and a below note renders both.
  - The full unit suite (`npm run test:unit`) and `npm run check` remain green.

---

## Coverage map (spec requirement / AC → task)

- **Requirements 1–4** (data model: `event.notes` of `eventNote`; `measure.notes` of `standaloneNote`; one concept, two modes; optional + empty valid) → **Task 1**.
- **Requirements 5–7** (clean break, no dual support, token gone everywhere, legacy valid + non-rendering) → **Task 1** (schema removal) + **Task 3** (token removal across code/tests/docs; legacy non-render).
- **Requirement 8** (migration docs line) → token removal in `docs/` is in **Task 3**; the migration-line *content* is authored in the Docs phase (`doc-plan.md`), out of this code plan's scope per the pipeline split.
- **Requirements 9–13** (validation: `text` required/string, `""` valid; `placement` required enum; `staff` required enum on standalone; `beat ≥ 0` number; stray field ignored; per-element error path) → **Task 1** (declarative schema; validator unchanged).
- **Requirement 14** (all four bands renderable in the correct vertical band) → **Task 6** (band geometry) + **Task 7** (per-event emit) + **Task 8** (standalone emit), verified in **Task 9**.
- **Requirement 15** (placement + staff observable on the node) → **Task 7** (`data-placement` + `data-hand`) + **Task 8** (`data-placement` + `data-staff`), verified in **Task 9**.
- **Requirement 16** (per-event note in the event's horizontal column) → **Task 4** (column X on the primitive) + **Task 7** (emit at column X).
- **Requirement 17** (standalone `beat` anchoring; higher beat further right; no-`beat` near left edge) → **Task 5** (beat→X interpolation + clamp) + **Task 8** (emit), verified in **Task 9**.
- **Requirement 18** (text renders verbatim) → **Task 3** (retargeted verbatim behavior) + **Tasks 7/8** (emit via `setText`).
- **Requirement 19** (XSS-inert) → **Task 3** (retargeted safety tests; `setText` + `render.php` escaping unchanged), verified in **Task 9**.
- **Requirement 20** (coexistence: above+below per event; N same-placement at distinct Ys; per-event + standalone) → **Task 6** (stacking + flex) + **Tasks 7/8** (stacked emit), verified in **Task 9**.

## Open questions

None. Every spec design hand-off (vertical offsets/lane gaps, font size/family/weight, collision precision, over-content clamp X, one-vs-two inter-staff lanes, ordering vs tempo/ottava, the new band machinery, the discriminator attribute names) is resolved in the design doc and carried into the tasks above. The constant starting values (`NOTE_GAP_STAFF`, `MID_GAP`, `DYNAMICS_LANE_RESERVE`, `NOTE_CLAMP_INSET`) are given as design ranges; this plan fixes concrete starting values in Task 2 within those ranges. Because every band/height assertion in the tests is relative, existence-only, or `toBeCloseTo` against the model's own anchors, later visual tuning of those constants will not break the tests.

Review-1 resolutions (no new behavior introduced): (a) the constants size-rename is split so the suite stays green after every task — Task 2 *adds* `NOTE_SIZE` and keeps `CHORD_SYMBOL_SIZE` as a temporary alias; Task 3 switches the `layout.js`/`svg.js` importers to `NOTE_SIZE` first and deletes the alias last, with the token-removal grep proving it is gone (no intermediate task leaves a dangling import / red suite). (b) the Task 5 over-content clamp is restated entirely in the **measure-relative** frame — `x = min( beatToX(min(beat, measureEnd)), scaledContent − NOTE_CLAMP_INSET )` — because `measureRightX = x + scaledContent` (`layout.js:1804`) is absolute and would make the clamp never fire (or double-translate at emit) for non-first measures; the relative right edge `scaledContent` (= `measureRightX − x`) keeps both terms in one frame, the clamp fires for every measure, and Task 8 emits the stored relative X under `<g data-measure>` with no `measure.x` subtraction (matching the per-event `texts` convention). The design's intent (over-content clamps to the measure end minus an inset) is preserved exactly, and the `beat:99` in-bounds and `beat:0`/`beat:2` ordering acceptance criteria remain satisfiable.

Review-2 resolution (no new behavior introduced): each `measureModel.standaloneNotes` record now carries the **raw-`beat` group key** (the raw `beat` as-is, or a precomputed `group`/`stackIndex` for `(staff, placement, raw beat ?? "noBeat")`), so Task 8 can compute every standalone note's stack group from the record alone — no re-read of `measure.notes`, no design-rejected resolved-X grouping. This removes the prior Task 5 ↔ Task 8 contradiction: Task 5's record-shape wording and its closed acceptance list now include the group field, the insufficient "array order alone" escape hatch is dropped (array order is only valid *within* a raw-beat group), and Task 5's acceptance asserts the field exists and that two same-`(staff, placement, raw beat)` notes share a group while `beat: 2` vs `beat: 2.0001` (and the two over-content beats `beat: 50` vs `beat: 99` that clamp to one X) do not. This matches the design's "group by the **raw** beat (pre-interpolation)" stacking decision (design Decision "Uniform outward stacking, grouped per (band, anchor)").
