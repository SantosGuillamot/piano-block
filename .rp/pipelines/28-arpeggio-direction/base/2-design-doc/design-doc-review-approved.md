# Design doc review — APPROVED

**Doc reviewed:** `2-design-doc/design-doc.md` (Support arpeggios with direction, issue #28)
**Verdict:** APPROVE

The design doc is sound, internally consistent, fully aligned with the spec, and
stays at the design level. Every technical claim that the design rests on was
independently verified against the real code (absolute-path read-only checks).
No blocking issue found.

## What I verified against the code

**Data model / validation (R1, R11, R12, R13; AC1, AC2).**
- `dynamic` is a single-value point enum on the event `$def`
  (`src/song/schema.js:162`) and the spans `tie`/`slur`/`crescendo`/`decrescendo`
  are `start`/`stop` pairs (`schema.js:167-170`). The design's "mirror `dynamic`,
  not a span" classification is correct; adding `arpeggio: { enum: [...] }` beside
  `dynamic` is the right and minimal schema change.
- The validator is a generic walker: `validateValue` flags an out-of-vocabulary
  enum informationally and returns (`src/song/validate.js:120-128`), and
  `validateObject` recurses every *present* declared property
  (`validate.js:191-198`). So the one enum line is genuinely the entire validation
  change — **no `validate.js` edit** — confirmed.
- "Never blocks saving" rests on real save-path topology, confirmed in
  `src/edit.js` (not `src/editor/edit.js` — see note below): raw-JSON mode writes
  the string straight to the attribute (`onChangeSong = (next) =>
  setAttributes({ song: next })`, `edit.js:147`; wired to the JSON
  `TextareaControl.onChange`, `edit.js:537`) bypassing commit; help text says
  "Validation is informational and never blocks saving" (`edit.js:533`); errors
  render as a non-dismissible `<Notice>` (`edit.js:543-551`). Visual edits route
  through `commit → commitSong` (`edit.js:185`), which validates and refuses on
  error (`serializeSong.js:42-50`) — a safety net, not a reachable gate, since the
  dropdown only emits conformant values. Round-trip is verbatim:
  `serializeSong` is a plain `JSON.stringify` (`serializeSong.js:28`) with no
  sort/filter/allowlist. The doc's instruction to **add no blocking anywhere** is
  the correct (and only) way to keep AC2.

**Editor (R9, R10; AC8).**
- `changeOptional` → `omitFalsy` trims a string and `delete`s the key when empty
  (`emit.js:48-57`), so "None" and `onDeselect` both drop the key — confirmed.
- The `dynamic` `ToolsPanelItem` (`NotePanel.js:192-205`) is exactly the structural
  template the doc proposes; a standalone sibling item before the `SPAN_FIELDS.map`
  (`NotePanel.js:207`) is feasible and correct (an arpeggio is a point enum, not a
  start/stop span, so folding into `SPAN_FIELDS` would be wrong).
- **The reset-all hazard is real and correctly identified.** `resetAll`
  destructures a fixed list of optionals and keeps `...kept`
  (`NotePanel.js:158-172`); an `arpeggio` not added to that destructure would be
  retained, defeating reset-all. The doc flags this as the one easy-to-miss edit
  and earmarks a regression test — exactly right.
- Only `PitchList` is gated on `event.type === "note"` (`NotePanel.js:148-154`);
  the `ToolsPanel` and its items render unconditionally, so the control shows for a
  rest with no new code (R10) — confirmed.
- `DYNAMICS` lives at `songModel.js:53`; `DURATIONS`/`CLEFS`/`BARLINES` use
  title-case `__()` labels while `DYNAMICS` uses bare symbols, so the doc's
  i18n-title-case justification for the `ARPEGGIO` labels is accurate.

**Rendering (R3, R4, R5, R6, R7; AC3, AC5, AC7).**
- The per-note `notes.push({...})` block carries `accidentals`, `ledgers`,
  `dotSpecs`, `topStep`, `bottomStep` (`layout.js:1542-1560`) — the exact home for
  `note.arpeggio`. `accidentals` is computed first (`layout.js:1518`), so
  `max(acc.dx)` data is in hand. `stackAccidentals` sets
  `dx = ACCIDENTAL_GAP + column * ACCIDENTAL_COL_STEP` (`layout.js:712`), strictly
  increasing in column, so the `max(acc.dx)` = leftmost-extent claim is correct.
- `staffStepToY(s) = bottomLineY - s*0.5`, Y grows downward (`layout.js:148-150`),
  so `topStep → smallest Y`, `bottomStep → largest Y` — the `topY`/`bottomY`
  mapping is right.
- **Rest inertness falls out structurally:** a rest returns early
  (`layout.js:1482-1491`) before the note-record code, so no guard is needed
  (R10/AC6) — confirmed; `event` is in scope in the `forEach((event, idx) => …)`
  loop (`layout.js:1478`).
- `renderNote` (`svg.js:704-768`) iterates the decoration arrays anchored to
  `note.x` and stamps the `<g>` with `data-hand`/`data-event-index`
  (`svg.js:705-710`); a guarded `renderArpeggio` call by the accidental loop
  (`svg.js:748-756`) fits the family. Accidentals are center-anchored
  (`fontGlyph(acc.glyph, note.x - acc.dx, …)`, `svg.js:751`), ledgers at
  `note.x ± LEDGER_WIDTH/2` (`svg.js:713-717`, `LEDGER_WIDTH = 2`), stem-down at
  `note.x - NOTEHEAD_RX` (`svg.js:786`) — so the doc's `ARPEGGIO_GAP` /
  `ARPEGGIO_FIXED_GAP` clearance reasoning (and the "always left of ledger/stem"
  conclusion) is grounded.
- The primitive idiom is real precedent: `renderSpan` emits
  `el("path", { d, fill:"none", stroke: INK, "stroke-width": STEM_THICKNESS, … })`
  (`svg.js:982-991`) and `renderHairpin` emits a `<g>` of two `<line>`s branching
  on `kind` (`svg.js:1012-1037`) — matching the proposed `<path>` wiggle +
  two-`<line>` arrowhead. `glyphs.js:26-27` confirms ties/slurs/ledgers/barlines
  "are never glyphs in any strategy," so the wiggle is correctly a raw `svg.js`
  primitive with **no font/`glyphs.js` change**.
- Single-pitch (R5/AC5) and tall-chord (R6) edges are handled by
  `n = max(1, round(height / (period/2)))`: height 0 clamps to one bump (no
  division by zero, since the only division is by `n ≥ 1`); a tall chord tiles more
  bumps. Sound.
- The nested DOM hook (`data-arpeggio="up|down|nondirectional"` wrapper >
  `data-arpeggio-wiggle` path + optional `data-arpeggio-arrow` group) matches the
  existing `data-span=kind` value-carrying precedent (`svg.js:989`) and makes the
  per-direction and rest assertions single `querySelector`s. Good.

**Render parity (R8; AC4).** `view.js:34-35,93-94` (front end) and
`SongCanvas.js:32-33,117-120` (editor) import and call the **same**
`buildLayoutModel` → `renderInto`; `SongCanvas.js:5-6` documents it as the same
path. The arpeggio lives in that shared core, so parity is architectural, not a
per-surface test. Confirmed.

**Test strategy.** Every proposed test maps to a real precedent: the
`crescendo`/`decrescendo` enum assertions (`schema.test.js:31-32`), the
`SPAN_STATES` cross-check and option sweep (`songModel.test.js:100-106,124-132`),
and the existing `data-*` querySelector style. The AC→coverage map is complete:
AC1-AC8 each have a unit and/or e2e home, including the explicit combined-markings
(AC7), the reset-all regression (AC8), and the never-blocks e2e (AC2). The
`wigglePathD` pure-function test is well-scoped.

## Scope, level, and workflow hygiene

- **No scope creep.** The change surface (schema +1 line, `ARPEGGIO` list, one
  `ToolsPanelItem` + reset-all word, constants, one layout record, `renderArpeggio`
  + `wigglePathD` + one call) is the minimum to satisfy the spec; out-of-scope
  items (audio, grand-staff, a11y announcement, font change) are honored. The one
  optional polish (floor single-pitch height) is correctly marked optional.
- **Stays design-level.** The doc describes architecture and decisions with
  rationale and rejected alternatives; it does not break work into plan tasks.
- **No internal-workflow leakage.** The doc cites only spec requirement IDs
  (R#) and acceptance criteria (AC#) — the spec's own contract — and contains no
  `.rp/` paths, plan-task IDs, review-note references, or pipeline language,
  consistent with `AGENTS.md`.

## Non-blocking note (for the plan/code phase, not a rejection cause)

- The two-save-path topology is real but lives in `src/edit.js`, whereas the
  design research cited it as `edit.js` (resolving to `src/editor/edit.js`, which
  does not exist). The **design doc itself** describes the save paths in prose
  without an incorrect file:line, so the doc is unaffected; the plan/code phase
  should simply target `src/edit.js` for the (read-only) topology it relies on.
  Likewise the doc's "`schema.js:162` (the `dynamic` line)" means *a new line
  beside* `dynamic`, not literally replacing line 162 — clear from context.

These are pointers for downstream phases, not defects in the design. **Approved.**
