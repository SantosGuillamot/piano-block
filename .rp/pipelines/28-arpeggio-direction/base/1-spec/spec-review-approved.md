# Spec review — APPROVED — Issue #28 "Support arpeggios with direction"

**Verdict: APPROVED.** The spec is complete, internally consistent, testable, and
faithful to both the intent and the research. It stays at the WHAT/WHY level and
contains no design/implementation. The few nits below are cosmetic and do not
block; they are recorded for the spec-writer/design phase, not as conditions.

## What I checked

### 1. Alignment with intent
Intent: "Chords … can be marked as arpeggiated, including the direction … and
this is reflected when the music is rendered." The spec delivers exactly this:
an optional per-chord marking (R1), a direction value (R2), and a rendered wavy
line that reflects the marking and its direction (R3). The intent's "e.g. upward
or downward" is illustrative; the spec's inclusion of `nondirectional` is
justified by the research (the commonest real-world roll, render-free once
up/down exist) and does not over-reach the intent — it is still "arpeggios with
direction."

### 2. Alignment with the research / no unjustified scope creep
Every spec requirement traces to a research-consolidated requirement:
- R1/R2 ← research R1/R2 (locked Option B1 vocabulary `up|down|nondirectional`,
  absence = not arpeggiated, no sentinel).
- R3/R4/R6 ← research R3/R4 + render edges A/C.
- R5 ← research R5 (single-pitch).
- R7 ← research's co-occurrence finding (no `oneOf`/`not` in schema).
- R8 ← research R6 (shared notation core).
- R9 ← research R7 (NotePanel SelectControl, None drops the key).
- R10 ← research R8 (rest show-but-inert).
- R11/R12/R13 ← research R9/R10/R11.
- O1–O4 ← research O1–O4.
No requirement appears that the research did not support; nothing in the research's
final requirement list was silently dropped.

### 3. No design/implementation leakage (spec must not design)
The spec stays at WHAT/WHY. It never names functions, files, schema field-internals,
or layout records. The two places that mention mechanism — O4 ("plain SVG
primitives, the same way ties/slurs/hairpins are drawn") and R11 ("raw-JSON
editing") — are *scope/behaviour boundaries* (what is NOT in scope: no font change;
and the round-trip guarantee), not design prescriptions. Acceptable.

### 4. Feasibility sanity-check against the codebase (read-only)
I independently confirmed the load-bearing feasibility claims so the spec is not
promising the impossible:
- **Event model & additive growth:** `src/song/schema.js:145-177` — `dynamic` is a
  single-value point enum on `event`; `tie/slur/crescendo/decrescendo` are
  `start|stop`; `additionalProperties` permissive (`schema.js:9-11`); the **only**
  conditional is "note requires pitches" (`schema.js:174-176`) — it never *forbids*
  a field on a rest, so R13's permissive-context claim holds.
- **Genuinely new ground:** repo-wide grep for `arpegg` finds zero hits outside
  `.rp/` — confirms R1 introduces a new field, no collision.
- **Hand-drawn render precedent (O4, R3):** `svg.js` `renderSpan` (ties/slurs as
  Bézier `<path>`) and `renderHairpin` (`<line>` pairs), with the header note that
  staff lines/stems/beams/ties/slurs "are never glyphs" — confirms the wavy line
  can be drawn without a font change.
- **Left-of-chord geometry (R3/R4):** `layout.js` `stackAccidentals` uses
  `ACCIDENTAL_GAP + column*ACCIDENTAL_COL_STEP` to the left of noteheads, and
  laid-out notes carry `topStep`/`bottomStep` — exactly the geometry R3/R4 require.
- **Authoring primitives (R9/R12):** `songModel.js` `DYNAMICS`/`SPAN_STATES`
  option-lists, `NONE_OPTION = {value:""}`, and `emit.js` `omitFalsy` (deletes the
  key on a blank value) confirm the None-drops-the-key authoring path is real.

### 5. Testability
All 8 acceptance criteria are concrete and checkable: AC1 (round-trip per value),
AC2 (out-of-vocab flagged, non-blocking), AC3 (render placement outside
accidentals, arrowhead position per value), AC4 (editor/front-end parity),
AC5 (single-pitch), AC6 (rest accepted, no render), AC7 (co-occurrence), AC8
(editor control behaviour). Each maps to one or more requirements.

### 6. Internal consistency
R1 ("closed set of three", "no separate off value", absence = not arpeggiated) is
consistent with R12 (three valid values) and AC1/AC2. R10 and R13 agree on rest
behaviour (stored, accepted, render-inert, never an error). R4 and AC3 agree the
line sits outside accidentals.

## Non-blocking nits (for spec-writer/design phase — not conditions of approval)
- **AC2 wording:** "A chord with an arpeggio value of outside the valid set" reads
  as a typo ("value of outside"). Meaning is unambiguous from context; a one-word
  cleanup ("a value outside the valid set") would tidy it.
- **R4 mentions "stem/beams"** but no acceptance criterion exercises stem/beam
  clearance; the research (collision D) deliberately folded stems into the
  accidentals concern as low-risk. Leaving it in R4 as a placement note is fine;
  there is simply no separate AC for it, which is appropriate given the low risk.

These are cosmetic and do not affect completeness, testability, or correctness.

## Conclusion
The spec faithfully captures the locked research, is testable end-to-end, scopes
out audio/grand-staff/accessibility/font-change explicitly, and does not stray into
design. **APPROVED.**
