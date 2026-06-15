# Code plan review — APPROVED (review iteration 2)

Issue #28 "Support arpeggios with direction". Re-reviewed the REVISED
`3-plan/code-plan.md` against `1-spec/spec.md`, `2-design-doc/design-doc.md`,
the prior rejection (`code-plan-review-1-rejected.md`), and the real codebase
(read-only).

**Verdict: APPROVE.** The single blocking finding F1 from rejection 1 is fully
resolved, and a fresh adversarial pass turned up no new gaps, no ordering
breaks, and no workflow leakage.

---

## F1 — RESOLVED (the bar to clear)

The prior rejection's only blocking finding: the design-named
`src/song/__tests__/validate.test.js` unit tests (validator-behavior, unit
tier) were dropped, costing AC1/AC2/R12/R13 their unit-tier coverage. The
revision fixes this completely, folded into **T1** (the natural home — both live
under `src/song/__tests__/`, T1 is the schema foundation with no deps).

Verified point by point:

1. **The test file is now in T1's Files** — `src/song/__tests__/validate.test.js
   (modify)` (plan:56-57), with the explicit note that the validator **source**
   `src/song/validate.js` stays untouched. Correct distinction: a test file is
   not the validator source.
2. **Conformant `up`/`down`/`nondirectional` → `[]`** is specified in the
   `describe("validateSong — conformant songs")` block, asserted via the `check`
   helper (plan:71-77). Verified against the real file:
   - `check` is defined at `validate.test.js:150` as
     `validateSong(JSON.stringify(value))` — exactly as the plan cites.
   - The conformant `describe` opens at `validate.test.js:174` — exact match.
3. **`arpeggio: "sideways"` flagged with path/value, validator returns messages
   (never throws)** is specified in the `describe("validateSong — closed-enum
   errors")` block, mirroring the dynamic/crescendo "flags … with its path"
   precedents, with the concrete assertion
   `result.some((e) => /arpeggio/.test(e) && /sideways/.test(e))` (plan:78-85).
   Verified:
   - The closed-enum `describe` opens at `validate.test.js:282`; its local
     `eventSong` helper is at `validate.test.js:285` — both exact.
   - The dynamic precedent "flags a typo'd dynamic with its path" is at
     `validate.test.js:307`, and the crescendo precedent "flags a `crescendo`
     value outside the allowed set with its path and allowed values" is at
     `validate.test.js:353` — both exact. The `arpeggio: "sideways"` test mirrors
     these one-for-one.
4. **`arpeggio: "up"` ridden on the comprehensive fixture** the way
   `dynamic: "mf"` already does (plan:86-88). Verified: the comprehensive song's
   opening 3-pitch C-major chord carries `dynamic: "mf"` at `validate.test.js:53`
   (the chord spans lines 49-62). "Ride `arpeggio: "up"` on one chord" is a real,
   accurate instruction.
5. **Tracing** — T1's `Traces to` now reads `R1, R12, R13, AC1, AC2`
   (plan:90), restoring the unit-tier evidence for AC1 ("validates without
   error") and AC2 ("flagged informationally … does not block saving") that the
   prior plan left to schema-shape + e2e only.
6. **Final-gate file list** now explicitly lists
   `src/song/__tests__/schema.test.js` AND
   `src/song/__tests__/validate.test.js` as allowed changed files
   (plan:406-407), while explicitly forbidding the validator **source**
   `src/song/validate.js` with a parenthetical that calls out the distinction
   ("note this is distinct from the allowed
   `src/song/__tests__/validate.test.js` test file", plan:410-412). This is the
   precise allow-test/forbid-source split the rejection required.

F1 is closed.

---

## Full adversarial re-pass — PASS

### Completeness (R1–R13 / AC1–AC8)
The coverage map is now complete. With T1's added validate-behavior tests:
- **R12 / R13** gain their previously-missing unit tier (T1 validate.test) on
  top of T1-schema and the T9 e2e never-blocks/round-trip.
- **AC1 / AC2** now have validator-behavior unit coverage (accept three values →
  `[]`; flag `"sideways"` informationally with its path; fixture rides the
  field), in addition to schema-shape (T1) and e2e (T9).
- All other requirements retain the coverage the prior review already verified:
  R1 (T1,T3) · R2 (T7) · R3 (T4,T5,T6,T7) · R4 (T6) · R5 (T5,T6,T7) ·
  R6 (T5,T6) · R7 (T3,T8) · R8 (T7,T9) · R9 (T2,T3) · R10 (T3,T6) · R11 (T9).
  AC3–AC8 covered by the layout/svg/panel/e2e tasks as mapped.

### Feasibility — independently re-verified the anchors F1/T1–T3 rely on
- **schema.js** — `dynamic` enum at `schema.js:162`; the span enums
  `tie`/`slur`/`crescendo`/`decrescendo` at `schema.js:167-170`; the single
  `if`/`then` note-conditional starts at `schema.js:174`. So T1's
  "add `arpeggio: { enum: [...] }` beside the `dynamic` line, not in `required`,
  not in the `if`/`then`" is exactly placeable.
- **validate.test.js** — `check`@150, conformant block@174, closed-enum
  block@282, `eventSong`@285, dynamic precedent@307, crescendo precedent@353,
  comprehensive fixture's `dynamic: "mf"` chord@53 — every cited line is accurate
  (see F1 above).
- **songModel.js** — `DYNAMICS` (bare-value style) at `songModel.js:53-62`;
  `BARLINES`/`CLEFS` use `__()`-wrapped title-case (e.g. `BARLINES`@65-71). T2
  correctly chooses the title-case `__()` style for `ARPEGGIO` (matching word
  tokens, not the symbol-only `DYNAMICS`). `NONE_OPTION` exported@112.
- **NotePanel.js** — the `resetAll` destructure lists exactly
  `dots/dynamic/tie/slur/crescendo/decrescendo/annotations` with `_`-prefixed
  unused bindings (`NotePanel.js:161-170`), so T3's `arpeggio: _arpeggio,` slots
  in exactly. The `dynamic` `ToolsPanelItem` is at `NotePanel.js:192-205`; the
  `SPAN_FIELDS.map` begins at `NotePanel.js:207`; T3 places the arpeggio item
  between them as a structural mirror — the inner `SelectControl` shape
  (`value={event.dynamic ?? ""}`, `options={[NONE_OPTION, ...DYNAMICS]}`, the two
  `__next…` props) matches what T3 specifies for arpeggio.
- The deeper constants/layout/svg/e2e anchors (T4–T9) were verified in depth by
  rejection 1's PASS section and the revision did not touch those tasks; their
  feasibility still holds.

### Dependency ordering — acyclic and runnable
T1 (no deps; foundation) → T2 → T3; T4 (no deps); T5 (no deps); T6←T4;
T7←{T4,T5,T6}; T8←{T6,T7}; T9←{T1,T3,T6,T7}. Folding the validate-behavior tests
into T1 adds no new dependency and introduces no cycle — `validate.test.js`
imports only the already-built validator and the schema T1 itself touches.
Topologically orderable by fresh code-writers on one shared tree; shared
test-file edits remain additive.

### TDD / task-block shape — present
T1 keeps Goal / Files / Changes / Depends on / Traces to / Acceptance. The new
validate-behavior work is named test-first, and the Acceptance clause
(plan:91-97) enumerates the three new assertions (conformant trio → `[]`;
`"sideways"` flagged with path/value while the song still parses; comprehensive
fixture carrying `arpeggio: "up"` still → `[]`) and reaffirms the untouched
validator source / `glyphs.js` / font.

### No internal-workflow leakage — clean
The conventions block (plan:15-18) forbids `design §` / `AC#` / `R#` / `T#` /
`spec` / `review N` / `code-plan` references in shipped code and comments, and
states the `Traces to` lines are plan-only. The revision confines all tracing to
the plan; nothing leaks into the test descriptions or code it prescribes.

### Untouched-set discipline — correct
The plan still forbids touching `src/edit.js`, the validator **source**
`src/song/validate.js`, `src/notation/glyphs.js`, the music font, and any
save/commit/serialize/gate path, enforced by the final-gate
`git diff --name-only` check — now with the one corrected nuance that the
`validate.test.js` *test* file is allowed while the `validate.js` *source* stays
forbidden.

---

## Summary

The revision is surgical: it folds the dropped `validate.test.js` unit tests
into T1 (conformant `up`/`down`/`nondirectional` → `[]`; `"sideways"` flagged
informationally with its path while the song still parses; `arpeggio: "up"`
ridden on the comprehensive fixture), retraces T1 to R1/R12/R13/AC1/AC2, and
updates the final-gate file list to allow the test while forbidding the source.
Every cited line number is accurate against the real codebase. No new gaps, no
ordering breaks, no workflow leakage. The plan is complete, feasible, acyclic,
TDD-shaped, and leakage-free.

**APPROVED.**
