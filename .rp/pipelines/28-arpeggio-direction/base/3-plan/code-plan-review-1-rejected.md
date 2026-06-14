# Code plan review — REJECTED (rejection 1)

Issue #28 "Support arpeggios with direction". Reviewed
`3-plan/code-plan.md` against `1-spec/spec.md`, `2-design-doc/design-doc.md`,
and the real codebase (read-only).

**Verdict: REJECT.** One concrete, actionable completeness gap. The plan is
otherwise strong — feasibility, ordering, and most coverage are sound (details
below) — but a design-named behavioral test that traces to AC1/AC2/R12/R13 has
been dropped, so those acceptance criteria lose their unit-tier coverage. Fix
the one finding and re-submit.

---

## Blocking finding

### F1 — `validate.test.js` unit tests are dropped (AC1/AC2/R12/R13 lose unit-tier coverage)

The design doc's test strategy explicitly names **seven** unit-test files. The
code plan covers six of them and omits one entirely:
`src/song/__tests__/validate.test.js`. The string `validate.test` never appears
in `code-plan.md` (only `validate.js` source, in the "do not edit" lines).

The design requires (design-doc.md:485-491):

> **`src/song/__tests__/validate.test.js`** — (a) in "conformant songs," a song
> carrying `arpeggio: "up"` (and `down`, `nondirectional`) validates to `[]`;
> (b) in "closed-enum errors," `arpeggio: "sideways"` is flagged with its path
> and value while the song still parses (the validator returns messages, never
> throws). Also add `arpeggio: "up"` to one chord of the comprehensive
> full-song fixture, the way `dynamic: "mf"` already rides it.

Why this is not redundant and must not be dropped:

- **T1 only touches `schema.test.js`**, which asserts the *schema object shape*
  (`properties.arpeggio` equals the enum literal). That is a declaration check.
  It does **not** exercise the validator walking a real song and producing `[]`
  for a good value or an informational, path-pointed message for `"sideways"`.
  Different layer, different assertion.
- **T9's e2e never-blocks test** covers the save-path topology at the
  Playwright/wp-env tier. The design deliberately wants *both* tiers ("the two
  tiers the repo already runs"); the validator's accept/flag behavior on
  `arpeggio` has **no unit test** in the plan as written.
- This is precisely the unit-tier evidence for **AC1** ("validates without
  error") and **AC2** ("flagged informationally during validation but does not
  block saving"), and for **R12/R13**. The design even traces its
  `validate.test.js` item to these. With the task dropped, AC1/AC2 are covered
  only by schema-shape + e2e, never by a unit test of the validator behavior
  the AC is literally about.

The codebase confirms this test belongs and is feasible:
- `src/song/__tests__/validate.test.js` already has a `describe("validateSong —
  conformant songs")` block and a `describe("validateSong — closed-enum
  errors")` block, with an existing precedent test "flags a typo'd dynamic with
  its path" (`validate.test.js:307`) and "flags a `crescendo` value outside the
  allowed set with its path and allowed values" (`validate.test.js:353`) — the
  exact pattern the `arpeggio: "sideways"` test would mirror.
- The comprehensive fixture already carries `dynamic: "mf"`
  (`validate.test.js:53`), so "ride `arpeggio: "up"` on one chord the way
  `dynamic: "mf"` does" is a real, accurate instruction.
- Editing `validate.test.js` does **not** violate the plan's own "do not edit
  `src/song/validate.js`" rule — the *validator source* stays untouched; only
  the *test file* gains assertions. The two are different files. The plan's
  conventions and the "untouched-set" final gate must continue to exclude
  `validate.js` (source) but must allow `validate.test.js`.

**Required fix.** Add a task (or fold into T1, since both live under
`src/song/__tests__/` and T1 is the schema foundation with no deps) that:
1. In the "conformant songs" block, asserts a song carrying `arpeggio: "up"`
   (and independently `down`, `nondirectional`) validates to `[]`.
2. In the "closed-enum errors" block, asserts `arpeggio: "sideways"` is flagged
   with its path/value and the song still parses (validator returns messages,
   never throws) — mirroring the existing dynamic/crescendo "flags … with its
   path" tests.
3. Adds `arpeggio: "up"` to one chord of the comprehensive full-song fixture.
4. Traces to R12, R13, AC1, AC2.

Also add `src/song/__tests__/validate.test.js` to the final-gate "expected
changed files" list (it currently lists only `their __tests__` generically,
which is fine, but the validate test must be explicitly produced by some task,
not left implicit).

---

## Everything else verified PASS (so the re-submit is small)

I checked the plan adversarially against the real code; the rest holds.

### Feasibility — every cited path/symbol exists and the edits make sense
- **T1** `schema.js:162` is the `dynamic` enum line; `tie`/`slur`/`crescendo`/
  `decrescendo` enums sit at 167-170; `schema.test.js:27-33` has the
  crescendo/decrescendo `toEqual({ enum: [...] })` precedent. Adding one
  `arpeggio: { enum: [...] }` property line is correct; not in `required`, not
  in the `if`/`then`. Verified.
- **T2** `songModel.js:53-62` is `DYNAMICS`; `BARLINES`/`CLEFS` use
  `__()`-wrapped title-case labels (the style the plan picks for `ARPEGGIO`,
  correctly NOT the bare-symbol `DYNAMICS` style). `songModel.test.js`
  `SPAN_STATES` cross-check (~100-106) and the "every option …" sweep
  (~124-135) exist. `NONE_OPTION` is exported (`songModel.js:112`). Verified.
- **T3** `NotePanel.js` dynamic item is at 192-205; `resetAll` destructure at
  158-172 (lists `dots/dynamic/tie/slur/crescendo/decrescendo/annotations` with
  `_`-prefix unused bindings — `arpeggio: _arpeggio` slots in exactly); the
  `SPAN_FIELDS.map` starts at 207; `changeOptional` → `omitFalsy` drops the key
  on empty (126-128, emit.js). The panel gates only `PitchList` on
  `event.type === "note"` (148-154), so the item shows for a rest with no new
  gate. `NotePanel.test.js` has the dynamic set/clear test (237-251), the rest
  test (301-318), and a span test (253-). All citations accurate.
- **T4** `constants.js` hairpin block is at 222-259; `ACCIDENTAL_GAP = 1.2`,
  `ACCIDENTAL_COL_STEP = 1.3`, `LEDGER_WIDTH = 2` (so `LEDGER_WIDTH/2 = 1`,
  matching the design's `ARPEGGIO_FIXED_GAP > 1` claim), `NOTEHEAD_RX = 0.6`.
  The T4 hedge ("modify `constants.test.js` only if it asserts on the constant
  block") resolves correctly to **no test change**: `constants.test.js` imports
  specific named constants individually and asserts on them — it does NOT
  enumerate all exports, so new constants neither break it nor are referenced.
  Good call leaving the layout test (T6) as the functional `ARPEGGIO_FIXED_GAP
  >= LEDGER_WIDTH/2` guard.
- **T5** No existing wiggle/zigzag/sine/wavy path generator anywhere in `src/`
  (grep confirms `wigglePathD` is genuinely new). `wigglePathD` takes
  `amplitude`/`period` as params, so it correctly has **no** dependency on T4
  (constants are passed at the T7 call site). `stackAccidentals` direct unit
  test (`layout.test.js:667+`) is a valid "pure helper" precedent. The
  `n = max(1, round(height/(period/2)))` clamp avoids divide-by-zero. Sound.
- **T6** `layout.js` per-note push is at 1542-1560 with `accidentals`,
  `topStep` (= `Math.max(...positions)`), `bottomStep` (= `Math.min`) in scope;
  `stackAccidentals` yields `dx = ACCIDENTAL_GAP + column*ACCIDENTAL_COL_STEP`
  (`layout.js:712`), strictly increasing in column, so `Math.max(...dx)` is the
  true leftmost extent — the design's reasoning checks out. `staffStepToY(s) =
  bottomLineY - s*0.5` (`layout.js:148-150`) with Y growing downward, so
  `topY = staffStepToY(topStep)` is the smaller Y — correct. A rest returns
  early at 1482-1491 (and empty-positions at 1497-1500) before the push, so a
  rest never gets a record — rest inertness falls out structurally, no guard.
  Verified.
- **T7** `renderNote` at 704-768 iterates `ledgers`/`heads`/`accidentals`/
  `dotSpecs` anchored to `note.x`; the accidental loop is at 748-756 — the
  guarded `renderArpeggio` call lands there. `renderSpan` (982-992) emits a
  `<path>` with `fill:"none", stroke:INK, "stroke-width":STEM_THICKNESS,
  "data-span":kind` — the exact attribute set T7 reuses. `renderHairpin`
  (1012-1038) branches on `span.kind` with pairs of `line(...)` at
  `STEM_THICKNESS` — the two-`<line>` arrowhead precedent. `el()`/`line()`/`INK`
  helpers and `STEM_THICKNESS`/`LEDGER_WIDTH` imports all present; the svg.js
  constants import block is at 28-43. Drawing inside the note `<g>` inherits
  `data-hand`/`data-event-index`. `renderSvg`/`renderInto` exported. Verified.
- **T8** Combined-markings (AC7) test is feasible against the existing multi-
  `data-*` querySelector style (`svg.test.js` already does
  `querySelector('[data-…]')`, e.g. ~136, ~310). The "arpeggio left of
  accidentals" claim is testable via `dx > max(acc.dx)`. Sound.
- **T9** `specs/render.spec.js` has `publishPostWithSong` (470) and `blockSvg`
  (484) and `[data-…]` locator tests. `specs/editor.spec.js` has the
  `getByLabel(...)` control pattern (254, 976) and the exact clonable test
  "the language field round-trips through JSON mode and never blocks saving"
  (901-922) — it uses `switchToJsonMode`/`songField`/`field.fill`/
  `errorNotice`/`storedSong`/`switchToVisualMode`/`storedSongObject`, all reused
  by the clone. The save-path file is `src/edit.js` (confirmed: `commitSong`
  import; JSON help text "Validation is informational and never blocks saving."
  at `edit.js:533`; raw `onChange={onChangeSong}` straight to the attribute at
  537). The plan correctly forbids editing it. Verified.

### Untouched-set discipline — correct
The plan repeatedly and correctly forbids touching `src/edit.js`,
`src/song/validate.js`, `src/notation/glyphs.js`, the music font, and any
save/commit/serialize/gate path; the final-gate `git diff --name-only` check
enforces it. (The one nuance is F1: `validate.test.js` is a *test* file and must
be allowed; `validate.js` source stays untouched.)

### Dependency ordering — acyclic and runnable
T1→T2→T3; T4 (no deps); T5 (no deps); T6←T4; T7←{T4,T5,T6}; T8←{T6,T7};
T9←{T1,T3,T6,T7}. No cycles; topologically orderable by fresh code-writers
sharing one tree. Shared test-file edits (svg.test.js across T5/T7/T8,
layout.test.js across T5?/T6) are additive and sequential, so no conflict.

### TDD / task-block shape / no leakage — present
Every behavioral task names its tests and an Acceptance clause; the
acceptance-criteria coverage map is traceable (with the F1 exception). Each task
has Goal/Files/Changes/Depends on/Traces to/Acceptance and is self-contained.
The "No internal-workflow references in shipped code" instruction
(code-plan.md:15-16) matches `AGENTS.md` and explicitly tells writers the
`Traces to` lines must not appear in code/comments. Good.

### Requirement coverage (with F1 noted)
R1 (T1,T3) · R2 (T7) · R3 (T4,T5,T6,T7) · R4 (T6) · R5 (T5,T6,T7) ·
R6 (T5,T6) · R7 (T3,T8) · R8 (T7,T9) · R9 (T2,T3) · R10 (T3,T6) ·
R11 (T9) · R12 (T1,T9 — **missing unit-tier `validate.test.js`, see F1**) ·
R13 (T1,T9 — **same gap**). AC1/AC2 are the ACs that lose unit-tier coverage
under F1; all others are covered.

---

## Summary

Single blocking gap: the design-named `src/song/__tests__/validate.test.js`
unit tests (validator accepts the three values → `[]`; flags `"sideways"`
informationally with its path; rides `arpeggio: "up"` on the comprehensive
fixture) are absent from the plan, dropping unit-tier coverage of AC1/AC2/
R12/R13. Add that test work (fold into T1 or a new task), update the final-gate
file list to include `validate.test.js`, and the plan is approvable.
