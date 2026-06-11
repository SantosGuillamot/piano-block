# Docs Review

## Verdict: approved

## Batch scope

Tasks reviewed:

- **Doc Task 1: Verify the user-facing docs carry no stale measure-number reference**
  (`3-plan/doc-plan.md`) — the single verification task; the doc-writer concluded a
  no-op and made no commits, so `ebdf334..HEAD` is an empty doc diff.

## Summary

The doc-writer's no-op is correct. An independent end-to-end sweep of every shipped,
user-facing documentation surface (`README.md`, `docs/song-format.md`,
`src/block.json`, `package.json`) finds no statement, example, or implication that
the rendered notation prints a measure-number label at the start of wrapped lines (or
anywhere). Every "measure" reference in the docs is about the song format's bar /
`measures` structure (the `measure` object, barlines, measure-level annotations) — the
format and `song` attribute that the spec explicitly leaves out of scope and that the
docs correctly leave untouched. The elements the docs DO claim the notation shows
(tempo marks, ottava brackets, dynamics) all still ship in `src/notation/svg.js`, so
removing the label weakened nothing. No internal-pipeline / `.rp/` reference exists in
any shipped doc. The doc plan's single surface-verification task is genuinely
satisfied and no documented surface is left stale; the batch is approved.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Doc diff is genuinely empty (no-op) | `git diff --stat ebdf334..HEAD` | Pass — no files changed; HEAD is `ebdf334` |
| No measure-number-label reference in shipped docs | `grep -rniE 'measure[ _-]?number\|number label\|line[ -]?start' README.md docs/ src/block.json package.json` | Pass — only false positives on `barlineStart` (substring "lineStart"); no measure-number-label prose |
| Every "measure" reference is the format's bar concept, not the label | `grep -rniE 'measure' README.md docs/song-format.md` | Pass — all 30+ hits concern `measures`/`measure` object, barlines, measure-level annotations; none the rendered line-start number |
| Tempo still ships (doc claims it present) | Read `svg.js` `renderTempo` / `renderSystemTexts` | Pass — `renderSystemTexts` (svg.js:1093) emits tempos; `renderTempo` at :1111 |
| Ottava still ships (doc claims it present) | Read `svg.js` `renderOttava` | Pass — `renderSystemTexts` emits ottavas; `renderOttava` at :1135 |
| Dynamics still ship (doc claims it present) | Read `svg.js` `renderHandText` dynamic branch | Pass — `data-text="dynamic"` node emitted at svg.js:1058-1071 |
| No measure-number node emitted | `grep -rn 'measure-number' src/` + read `renderSystemTexts` | Pass — no `data-text="measure-number"` anywhere; consumer emits only tempos + ottavas |
| `MEASURE_NUMBER_SIZE` fully removed | `grep -rn 'MEASURE_NUMBER_SIZE' src/` | Pass — zero references; `svg.js` import list (svg.js:28-44) does not include it |
| No pipeline/`.rp/` reference in shipped docs (AGENTS.md) | `grep -rniE '\.rp/\|design-doc\|doc-plan\|acceptance criteri\|spec\.md\|pipeline' README.md docs/ src/block.json package.json` | Pass — no matches |

(The host project enumerates no automated doc gates; README + `docs/` are
human-reviewed markdown. The accuracy spot-check below is therefore the gate.)

## Accuracy spot-check

Doc Task 1 is a verification/no-op task spanning the whole shipped doc surface, so the
spot-check verifies concrete claims on both directions of the criterion — that the
label is absent and that the elements the docs assert as present still ship.

1. **No measure-number-label claim exists (the removal target).** README's
   "What the front end shows" (README.md:46-57) enumerates what the score draws — "the
   staves, clefs, notes, rests, and accidentals" — and never mentions a
   measure-number label. README "Forthcoming" (README.md:168-176) lists gradual
   dynamics and future work, no measure-number reference. `docs/song-format.md`'s
   intro/front-end pointer (song-format.md:9) and the gradual-dynamics "where it
   appears" note (song-format.md:317) point at the README's render narrative and name
   no measure-number label. A regex sweep for `measure[ _-]?number` / `number label`
   across all four user-facing surfaces returns only `barlineStart` false positives.
   The claim "the docs carry no stale measure-number reference" is verified true.

2. **The elements the docs claim ARE present still ship.** The docs assert the
   rendered notation shows tempo marks, ottava brackets, and dynamics
   (README.md:170, song-format.md:131-136 ottava placement, song-format.md:295-317
   gradual dynamics). Verified against the shipped code: `renderSystemTexts(texts)`
   (`src/notation/svg.js:1093-1108`) emits `texts.tempos` via `renderTempo`
   (svg.js:1111, `data-text="tempo"`) and `texts.ottavas` via `renderOttava`
   (svg.js:1135, `data-text="ottava"`), and `renderHandText` emits the
   `data-text="dynamic"` node (svg.js:1058-1071). None of these was removed; the
   docs' description of the rendered notation remains accurate.

3. **The removed label leaves no shipped node and no dead constant.**
   `renderSystemTexts` emits only tempos and ottavas — there is no
   `data-text="measure-number"` branch (a repo grep for `measure-number` in `src/`
   returns nothing), and `MEASURE_NUMBER_SIZE` is absent from the `svg.js` import list
   (svg.js:28-44) and from the whole `src/` tree. So the rendered output the docs
   describe matches the post-removal reality: the label the docs never promised is
   indeed gone.

4. **Out-of-scope surfaces correctly untouched.** The song-format field reference
   (the `measure` object at song-format.md:67-85, `barlineStart`/`barlineEnd` at
   :360-371), the `song` attribute (README.md:111, :142), and the editor-UI
   description (README.md:26-43) are unchanged — exactly as the spec's Out-of-Scope
   and Doc Task 1's "do NOT touch" constraint require.

## Issues

None.
