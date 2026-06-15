# Doc plan review — APPROVED

**Feature:** Support arpeggios with direction (issue #28)
**Artifact reviewed:** `.rp/pipelines/28-arpeggio-direction/base/3-plan/doc-plan.md`
**Verdict:** APPROVE (no rejections; this is the first review)

The documentation plan is complete, accurate to the shipped behavior described
by the spec/design/code-plan, drift-resistant, correctly scoped to the real doc
surfaces, well-shaped per task, and free of workflow leakage. Details below.

## What I verified

I read all four inputs (spec, design doc, code plan, doc plan) and surveyed the
real shipped docs read-only (`docs/song-format.md`, `README.md`), plus
`AGENTS.md` and a sweep for any other doc surface that enumerates per-event
markings.

### 1. Correct surfaces — every named section/anchor exists; none invented; none omitted

- **The two-doc claim is correct.** A repo-wide markdown sweep (excluding
  `node_modules`, `.rp/`, `.git/`, `build/`) returns only `docs/song-format.md`,
  `README.md`, `AGENTS.md`, and `.rp.md`. Of these, only `song-format.md` and
  `README.md` are user-facing format docs that enumerate per-event markings; a
  `grep -i crescendo` across markdown hits exactly those two. `AGENTS.md` is the
  contributor/workflow guidance file and `.rp.md` is a pipeline file — neither is
  a marking-vocabulary surface, and the plan correctly leaves both untouched.
- **No changelog / `readme.txt`.** Confirmed absent; the plan correctly says so
  and forbids creating one.
- **Every D1/D2 anchor exists in `song-format.md`:** `Events` (L200),
  `Gradual dynamics (crescendo and decrescendo spans)` (L334) — the cited model
  for the new dedicated section, `Additive growth (no version field)` (L422),
  `Annotated example song` (L432). The cited precedents are real: the `event :=`
  shape lists `dynamic`/`tie`/`slur`/`crescendo`/`decrescendo` (L205–216); the
  prose field list (L219–228); the "Notation only — no sound" paragraph (L344);
  the `language` field's "Stored, round-trips, and validates" bullet (L62); the
  closed-enum bullet listing durations/clefs/dynamics/barlines/tie/slur/
  crescendo/decrescendo/type/beatType (L429); `dynamic: "mf"` riding one chord of
  the annotated example (L461).
- **Every D3 anchor exists in `README.md`:** the Note-details disclosure bullet
  listing "dots, dynamic, tie, slur, crescendo/decrescendo, and annotations"
  (L37); the closed-enum bullet in "The song format and validator" (L220); the
  "Additive growth" paragraph with the crescendo/decrescendo worked example and
  the `language`/`name` "latest additions" (L223); the "Forthcoming"
  notation-coverage prose "already covers a broad spread of markings, including
  gradual dynamics" (L235).
- **"What the front end shows" handled correctly.** The plan flags it
  "(Check, do not assume) … likely needs no change." Verified: that section
  (L74–86) describes *whether* the front end renders (three display cases), not a
  marking inventory, so it correctly needs no edit. The README `File layout`
  table and `Tests` paragraph likewise do not enumerate markings as a vocabulary
  and the feature adds no new file, so leaving them untouched is correct and the
  plan does so.

### 2. Completeness — every user-facing aspect is documented

Cross-checked the plan's coverage against the spec's R1–R13 / O1 / AC1–AC8 and
against how the sibling markings (`dynamic`, ties, slurs, gradual dynamics) are
already documented:

- Field exists / optional / per-chord (R1) — D1 (Events shape + field list +
  dedicated section).
- Three values `up`/`down`/`nondirectional`, one order (R2) — D1, enforced by the
  "one vocabulary, one order" authoring rule.
- Absence = not arpeggiated, no "off" value (R1) — D1 explicitly.
- Rendered form: wavy line left of noteheads, outside accidentals, clear of stem,
  full height, arrowhead per direction (R3, R4, R6) — D1 dedicated section.
- Single-pitch (R5) and tall-chord (R6) behavior — D1.
- Rest: settable, accepted, inert (R10, R13) — D1 rest bullet.
- Combines with every other marking (R7) — D1 independence note + D2 example.
- Editor control None/Up/Down/Nondirectional in Note details (R9, AC8) — D3.
- Closed-enum, non-blocking validation (R12) — D1 validation bullet + D2/D3
  closed-enum lists.
- Verbatim round-trip (R11) — D1 + D2.
- Notation only — no sound (O1) — D1 + D3 forthcoming framing.

The coverage map (plan L251–269) is faithful and traceable.

**Adversarial gap I specifically probed — editor rest behavior (R10):** the spec
says the arpeggio control is *shown for a rest* in the editor. The existing docs
do **not** document that any sibling control (dynamic/tie/slur) shows for rests —
the README Note-details bullet (L37) just lists the controls; rest behavior is
documented only at the format/render level (e.g. a rest may carry `annotations`,
L224). The plan matches that: D1 documents the format-level rest behavior
(settable, no rendered effect) and D3 adds arpeggio to the control list without a
bespoke "shows for rests" note. Adding such a note would *introduce* documentation
no sibling has — an inconsistency. The plan correctly avoids it. Non-finding.

### 3. Accuracy to shipped behavior

- Validation framing is correct: an out-of-vocabulary `arpeggio` value is a
  *closed-enum* error that **is** flagged informationally (distinct from a
  misspelled optional *field*, which is silently ignored), and never blocks
  saving — matching the design doc's walker analysis and the `language` field's
  documented stance. D1 models the validation bullet on `language` (L62), which is
  the right precedent.
- Arrowhead semantics (top for `up`, bottom for `down`, none for
  `nondirectional`) match spec R3/AC3 and the design doc.
- Verified the code has not yet shipped (`grep` of `schema.js` shows `dynamic` at
  L162, `crescendo`/`decrescendo` at L169–170, no `arpeggio`), so the plan's
  instruction to verify against the *merged* source after code ships is the
  correct posture.

### 4. Drift-resistance

Strong. The plan's "Authoring rules" (L42–64) and every task's Sections-scope
direct the writer to read the merged `src/` (`schema.js` for the enum/order,
`songModel.js` + `NotePanel.js` for the control labels, `layout.js`/`svg.js` for
the rendered form) and the actual rendered output, to "document what shipped" and
flag any discrepancy. D1's acceptance requires the render claims be "verified by
reading svg.js/layout.js and/or the rendered output"; D3 requires verifying the
control's location and "Arpeggio" label against the shipped `NotePanel.js`. The
plan is explicit that the design doc and code plan are intent, not the final word.

### 5. Task-block shape

D1, D2, D3 each carry the full self-contained shape: Goal, Audience, Files,
Sections-scope (with concrete file paths and named section anchors), Depends on,
Traces to (each annotated "plan-file only — do not write in the doc"), and
Acceptance (each ending with the no-workflow-references check). The dependency
order (D1 → D2, D1 → D3, keep closed-enum lists in sync) is sound and the
final-gate checklist (L274–285) enforces JSON validity, list consistency between
the two docs, and the `git diff --name-only` scope (only `song-format.md` and
`README.md`).

### 6. No workflow leakage

The plan forbids "spec", "design §", "design doc", "code plan", "AC#", "R#",
"T#", "review N" in shipped docs (L42–46), cites the repo's `AGENTS.md`
verbatim-in-spirit (confirmed: `AGENTS.md` L5 mandates exactly this), confines
`Traces to` to the plan file, repeats the warning in the coverage-map note
(L271–272), and bakes a "no internal-workflow references" check into every task's
acceptance and the final gate.

## Conclusion

No completeness gaps, no invented or omitted surfaces, no inaccuracies versus the
shipped behavior, robust drift-resistance, complete task-block shape, and no
workflow leakage. Approved as-is.
