# Design doc review — APPROVED

Pipeline: `27-beamed-note-stems` (phase 2 — Design doc)
Reviewed: `.rp/pipelines/27-beamed-note-stems/2-design-doc/design-doc.md`
Against: `.rp/pipelines/27-beamed-note-stems/1-spec/spec.md`
Iteration: 1 (no prior rejections)

## Verdict

**Approved.** The design is complete, sound, and aligned with the spec. Every
load-bearing factual claim was independently verified against the code, and the
chosen approach satisfies all six requirements and the acceptance criteria
without scope creep.

## What was verified against the code

1. **`beamGeometry` structure (R1 insertion point).** Confirmed at
   `src/notation/layout.js:505-575`: direction computed once at line 512;
   exactly four independent readers of raw member X — stems map (529-533),
   primary beam (540-541), secondary-beam loop (546), stub loop (565-568,
   `stubLen = NOTEHEAD_RX * 1.5`). None chains off another, so the doc's
   conclusion that the offset must reach all four (and that shifting the input
   once is the clean way to do it) is correct. `NOTEHEAD_RX` is already used
   inside the function, so no import change — confirmed.

2. **Emit layer is a verbatim passthrough (R1/R2).** Confirmed at
   `src/notation/svg.js:813-836`: stems drawn as `line(stem.x, …)` and segments
   as `rect(segment.x1, top, Math.abs(segment.x2 - segment.x1), …)`. All
   arithmetic is vertical (`beamY + offset ± inset`); the width term is
   shift-invariant. `renderBeam` is called only from the emit loop
   (svg.js:671), matching the single-consumer claim.

3. **Standalone rule parity (R3).** Confirmed `renderStem` and the flag both
   compute `note.x + (direction === "up" ? NOTEHEAD_RX : -NOTEHEAD_RX)`
   (svg.js:785, 801) — the identical rule and constant the design applies to
   the beamed path.

4. **Single call site (R4).** Confirmed `beamGeometry` is invoked exactly once,
   at layout.js:1558 inside `layoutHand`. The shift-the-input approach copies
   members via `map` + spread, so nothing upstream is mutated.

5. **Rigid-translation argument (R2).** Confirmed `beamY` derives from
   `headYFor` (steps + `STEM_LENGTH`) only; no X enters any Y computation, so
   beam Y, flatness, and segment lengths are unchanged under a uniform X shift.

6. **Test plan (R6).** Confirmed the `beamGeometry` describe block at
   `src/notation/__tests__/layout.test.js:512-547` matches the doc exactly:
   three tests, all stem-up; the single breaking assertion is
   `expect(geo.beams[0]).toMatchObject({ level: 1, x1: 0, x2: 4 })` at line
   524 (members at x 0 and 4 — exactly the fixture R6.1 names). The
   secondary-beam and stub tests assert levels/existence only, so extending
   them with per-kind X assertions is additive and uses the per-kind
   expectations R6.2 mandates (never the first/last-stem rule). The proposed
   stem-down fixture (`topStep: 6, bottomStep: 6`) was checked against
   `stemDirectionForChord` (layout.js:262-275): steps 6 with `MIDDLE_LINE = 4`
   give `farthestAbove`, yielding `"down"` — the fixture works as claimed.

7. **Scope (R5, AC8).** Changes are confined to `src/notation/layout.js` and
   `src/notation/__tests__/layout.test.js`; `svg.js` is untouched (the spec
   requires the emit layer to keep drawing X verbatim, which it already does).
   Both optional items (overflow assertion, `svg.test.js` DOM test) are
   declined with reasoning consistent with the spec's "not required" markers.

## Judgement on the design choices

- **Shift-the-input over four scattered edits** is the right call: one
  definition plus one map, future X readers inherit the offset, and R2 falls
  out as a rigid translation rather than needing per-segment reasoning.
- **Routing `beamY` through `shiftedMembers`** is harmless (Y ignores X) and
  the doc correctly labels it cosmetic rather than load-bearing.
- **Declining both optional tests** is justified: the slack-margin numbers
  (≈0.83 sp trailing, 1.5 sp system edge vs. a 0.6 sp shift) hold up, and the
  emit layer is a verified passthrough, so a DOM test would duplicate the unit
  coverage.

## Minor notes (non-blocking)

- The doc cites the emit-loop read at svg.js:670; the `renderBeam(beam)` call
  is at svg.js:671. One-line drift, immaterial to the design.
- Single-member beam groups (if they ever occurred) would produce a shifted
  stem and no beams under the `members.length >= 2` guard — which is exactly
  the standalone-consistent behavior, so no gap there.

No changes requested.
