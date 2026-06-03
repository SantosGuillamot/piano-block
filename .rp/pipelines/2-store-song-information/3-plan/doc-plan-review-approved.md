# Doc plan review — APPROVED

**Verdict: APPROVED.** `3-plan/doc-plan.md` (commit 4258bf8, tasks D1–D4) meets the bar. It is complete for a v1 raw-JSON author and a contributor, drift-resistant, self-contained, correctly ordered, pitched at the right altitude, and matched to the right audiences. No genuine gap, drift risk, out-of-scope promise, or wrong-audience problem found.

Reviewer: `doc-plan-reviewer` (fresh, single-task adversarial). Inputs read: `3-plan/doc-plan.md`, `1-spec/spec.md` (reqs 1–14, AC1–AC10, Out of Scope), `2-design-doc/design-doc.md`, `3-plan/code-plan.md` (tasks 1–9, shipping `src/song/schema.js`, `src/song/validate.js`, `src/block.json`, `src/edit.js`, `src/render.php`, `specs/*`), and the existing scaffold (`README.md`, `src/*`, `piano-block.php`).

## What I checked, adversarially

### Completeness — passes
- **Author-facing format reference (D1)** is the centerpiece and covers everything an author needs to hand-write JSON: top-level shape + minimal-vs-empty distinction, `metadata`, `defaults`/`sections` constant-context model, `measures` grand-staff pairing, `tempo`/`timeSignature` (incl. the deliberate `beatUnit` word vs `beatType` number asymmetry), `handConfig` (clef/alters/octaveShift) with inheritance/override + the `alters`-replaces-wholesale rule, `event` (type/duration/dots/pitches/dynamic/chordSymbol/tie/slur incl. the free-text exception and the note→pitches conditional), `pitch`, both note-name systems + case-insensitivity + equivalence, barlines/repeats, accidental/octave resolution (framed as forward-looking), additive growth / no `version`, and the verbatim annotated example. AC5, AC9, AC10 specifics are explicitly required (lines 54, 50, 38/63).
- **Author how-to (D2)** covers insert → raw-JSON field → informational non-blocking validation → escaped text front-end output → empty state — the workflow the reference does not.
- **Contributor notes (D3)** cover where the code lives, the string-attribute storage rationale, the schema-as-data + zero-dependency walker design (and the no-`ajv` swap trigger), the lenient-unknown / closed-enum policy, the additive-growth rule, the render contract, and the test commands.
- **README (D2+D3+D4)** is updated for shipped song storage, file layout, scripts, cross-links, and a final consistency pass.
- The coverage check (lines 188–194) traces each deliverable to spec reqs/ACs and design sections; I re-derived the mapping and found no missing requirement. The 4.1–4.9 sub-numbering is consistent with the design's §11 traceability table and the code plan.

### Out-of-scope discipline — passes (this is a strength)
The plan repeatedly forbids presenting audio, notation rendering, a visual authoring UI, a `version` field, or import/export as present behavior, and explicitly permits naming them only as *future / not-yet-supported* to avoid misleading authors (lines 16, 52, 64, 85, 94, 148, 151, 159, 185). D2 §5 and D4 §1 both require the "v1 shows the song as text, not notation/audio" framing with "no overclaim" acceptance gates.

### Drift-resistance & correctness — passes (this is a strength)
- Docs run **after** the code phase, and every task is told to document the **shipped** behavior, verifying field names/enums/ranges against `src/song/schema.js` and the walker special-cases in `src/song/validate.js` (lines 8–9, 32, 61, 79, 93, 112, 127–128).
- **Single source of truth respected:** `src/song/schema.js` is canonical; docs link to it and must not transcribe a divergent copy (lines 9, 17, 116, 128, 181, 183). The "intentionally NOT a separate doc task" section (179–186) explicitly rejects a second hand-maintained schema copy and validator API docs.
- Each task's Acceptance is a concrete code-verification gate: D1 diffs the field list against the schema and runs the example through `validateSong`; D2 matches `src/edit.js`/`src/render.php`; D3 verifies file paths/scripts exist in the tree/`package.json`; D4 is a cross-doc + code consistency sweep.

### Self-contained & ordered — passes
Every task has Goal / Audience / Files / Sections-scope / Depends on / Traces to / Acceptance. Order D1→D2→D3→D4 is coherent: D1 is the foundational canonical reference; D2 and D3 build on it for the two audiences; D4 integrates and consistency-checks last. The dependency summary (170–177) matches the per-task `Depends on` lines.

### Right altitude — passes
Not over-documenting: no function-by-function validator API (the validator is internal; contributors read the commented source), no duplicated schema in prose, the annotated example authored once and reproduced once. Not under-documenting the author-facing format: D1 is exhaustive on the field model and example-led.

### Audience fit — passes
D1/D2 → content authors (raw-JSON, example-led, no internals jargon, with contributor detail kept out — line 14). D3 → contributors. D4 → both (top-of-README framing + navigation). The "Conventions" section (12–19) enforces audience-first writing.

## Candidate objections considered and dismissed (nits, not blockers)
- **D1/D2 both target authors** → bounded as reference-vs-how-to (Diátaxis); D2 is told to link to D1, not restate field tables (77, 88, 96). Not redundant.
- **D3's optional `docs/song-format-internals.md`** → guarded by "prefer one home; do not split" (110, 130) and reconciled by D4. Not ambiguous.
- **README touched by D2/D3/D4** → explicit "reconcile, don't repeat" instruction (149) and D4-last sequencing handle overlap.
- **D2 "validates as you type"** → accurate to design §6.3 (`useMemo` recompute on every change) and code plan Task 5.
- **D1 §6 describing `beatType` as "integer ∈ {1,2,4,8,16,32}"** while the schema declares it as an `enum` of those integers → faithful for an author-facing description, and D1 must verify against the shipped schema anyway. Not a contradiction.

None rises to a genuine gap, drift risk, out-of-scope promise, or wrong-audience defect. Approved.
