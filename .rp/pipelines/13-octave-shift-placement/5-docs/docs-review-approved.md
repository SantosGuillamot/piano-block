# Docs review — APPROVED

**Batch:** Docs phase (phase 5), task DT1 (the only task in the doc plan).
**Diff reviewed:** `git diff 61f60ad..HEAD -- docs/song-format.md` (base `61f60ad` = phase-4 code tip; HEAD `e69de98`).
**Verdict:** APPROVED.

## What shipped

A single commit, `e69de98` "Document octaveShift bracket placement in the song-format reference (doc-writer)". The change is **+2 lines**, in `docs/song-format.md` only (confirmed by `git diff 61f60ad..HEAD --stat`: `1 file changed, 2 insertions(+)`). A `**Placement.**` note was added immediately after the `octaveShift` bullet's sign→label sub-list (now `docs/song-format.md:136`):

> **Placement.** A **positive** shift (8va/15ma) draws its dashed bracket **above the staff of the hand it is set on** — above the right-hand (treble) staff for a right-hand shift, above the left-hand (bass) staff for a left-hand shift — while a **negative** shift (8vb/15mb) draws its bracket **below that hand's staff**. The bracket is restated on every line the shifted passage spans.

The optional README cross-link was not added; the doc-writer judged it unnecessary. This is acceptable — the doc plan marked the cross-link "only if it reads naturally," and the gradual-dynamics Placement note (the cited model) does not itself carry one.

## Accuracy vs. shipped behavior (traced, not trusted)

Every placement claim was verified against `src/notation/layout.js` and `src/notation/svg.js` (ground truth), not the writer's report:

1. **"dashed bracket"** — `renderOttava` (`src/notation/svg.js:1149`) emits an italic `<text>` label plus a `<line>` with `"stroke-dasharray": "0.6 0.4"`. Accurate.
2. **Positive → above that hand's own staff (RH treble / LH bass).** In `buildSystemTexts` (`src/notation/layout.js:2958-2961`), `aboveY` resolves to `band.ottavaAboveLaneY` for `rightHand` (the top-margin lane above the top/treble staff) and `band.ottavaLeftAboveLaneY` for `leftHand` (the inter-staff-gap lane above the bottom/bass staff). The "above" `y` is selected at `layout.js:2984` (`ott.placement === "above" ? aboveY : staffBottomY + 2`). `placement: "above"` ⇔ `octaveShift > 0` (`ottavaFor`, `layout.js:1085`). Accurate and matches R1.1/R1.2.
3. **Negative → below that hand's staff.** `y = staffBottomY + 2` where `staffBottomY` is `band.rightStaffBottomY` (RH) or `band.leftStaffBottomY` (LH) (`layout.js:2956-2957`), and `placement: "below"` ⇔ `octaveShift < 0`. Accurate; matches R1.4.
4. **Sign→label mapping.** `OTTAVA_LABELS = { 1: "8va", 2: "15ma", "-1": "8vb", "-2": "15mb" }` (`layout.js:1064`). The doc's "8va/15ma" (positive) and "8vb/15mb" (negative) match exactly.
5. **RH = treble/top, LH = bass/bottom.** `rightStaffTopY = topMargin` (top of page), `leftStaffTopY = lhTopY = rhBottomY + effectiveInterStaffGap` (below) (`layout.js:1887, 1902-1905`). Independently corroborated by README:47 ("a treble staff for the right hand and a bass staff for the left"). Accurate.
6. **"restated on every line the shifted passage spans."** `buildSystemTexts(members, measureModels, band)` is called once per wrapped system inside `systemRanges.forEach((range, sysIdx) => {...})` (`layout.js:1784, 2116`), each with that system's own measure slice. A run spanning multiple wrapped lines therefore emits one bracket per line. Accurate; matches R2.3 (and consistent with the now-corrected R2.1 per-system emission).

The note correctly describes the **now-correct** behavior the fix produces (left-hand "above" over the bass staff, brackets on every system the run spans). It is descriptive enrichment, not a correction of a prior wrong statement, exactly as DT1 intended.

## Scope discipline

- Diff is docs-only and touches `docs/song-format.md` only (`--stat`: 1 file, +2).
- No change to the `octaveShift` schema, range (`−2..+2`), sign→label mapping, inheritance/override rules, or the forward-looking "sounding octave = octave + octaveShift" model (`song-format.md:131-134, 138-142, 379` untouched). Spec Out-of-Scope honored.

## Standalone-doc hygiene (AGENTS.md)

`git diff 61f60ad..HEAD -- docs/song-format.md` grep for `.rp|pipeline|phase|task|issue|#13|acceptance|bug|fix|spec` returns nothing. The note is phrased as descriptive behavior ("draws its dashed bracket above…"), with no reference to the fix, the issue, the pipeline, phases, task IDs, or acceptance criteria. Compliant with AGENTS.md:5.

## Voice / format consistency

Matches the existing gradual-dynamics **Placement.** note (`song-format.md:303`): same bold lead-in label `**Placement.**`, same descriptive present-tense voice, same "per hand / below that hand's own staff" framing, and the same use of inline bold for the key terms. Sits naturally in the `octaveShift` bullet, parallel to where the hairpin's Placement note sits in its section. Length is ~2 sentences, within the doc plan's "≤ ~2 sentences" guidance.

## Completeness

DT1 is the entire doc plan. The doc-writer chose the additive-note path (a permitted alternative to the documented no-op). The made change is itself correct, warranted, and accurate to shipped behavior, so it stands on its own merits. Nothing in the doc plan is left unaddressed.

## Acceptance criteria (DT1) — all met

- Correctly states per-hand above/below placement and per-line restatement, matching the shipped renderer. ✔ (traced above)
- No change to schema, range, sign→label mapping, inheritance rules, or sounding-octave model — only a placement note added. ✔
- Voice, formatting, and link style match the surrounding reference; no `.rp`/pipeline/issue/phase references. ✔

**Decision: APPROVED.** The Docs phase is complete for issue #13.
