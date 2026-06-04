# Docs Review

## Verdict: approved

## Batch scope

Tasks reviewed (all five doc-plan tasks):

- Task 1: Document the `crescendo` / `decrescendo` event fields in the song format reference
- Task 2: Add a gradual-dynamics explanation with the v1 scope limits to the song format reference
- Task 3: Extend the annotated example song with crescendo, decrescendo, and a messa-di-voce hinge (both `docs/song-format.md` and the README "Exercising the renderer" callout)
- Task 4: Update the closed-vocabulary / additive-growth notes in the song format reference
- Task 5: Update the README closed-vocabulary, additive-growth, and forthcoming/scope notes

Files touched: `docs/song-format.md`, `README.md` (diff `cf4a0215efbefe0856f0bd57cf8af65bdcdf9fe2..HEAD`).

## Summary

The batch is accurate, complete, and faithfully scoped. Every concrete claim was
checked against the shipped code (`src/song/schema.js`, `src/song/validate.js`,
`src/notation/layout.js`, `src/notation/svg.js`): the two new fields are documented
exactly as the schema declares them (`{ enum: ["start", "stop"] }`), the validator
behavior described (closed-enum error, misspelled-field silently ignored, no
start/stop pairing check) matches the generic walker, and the rendered behavior
(hairpin `<`/`>`, per-hand below-staff lane, continuous across barlines, start-line
only on cross-system) matches `renderHairpin`, the `recordSpanMarkers` lane Y, and
`clipSpanToStartSystem`. The annotated example was extracted from the doc and run
through the real `validateSong` — it validates with zero errors and genuinely
contains a 2-note crescendo span, a separate 2-note decrescendo span, and a shared
messa-di-voce hinge note carrying both markers, all on `pitches`-array events. The
two parallel enumerations (the `docs/song-format.md` intro sentence and the README
"Exercising the renderer" callout) agree with each other and with the example.
Scope is honest hairpin-only (no `cresc.`/`dim.` text form, between-staves placement,
full cross-system split, audio, or authoring UI presented as a v1 capability), the
audio-out-of-scope framing is preserved, and the still-deferred backlog items remain.
No pipeline/process references appear anywhere in the shipped docs.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Diff scope is exactly the two plan-owned files | `git diff <base>..HEAD --stat` | Pass — only `README.md` and `docs/song-format.md` changed; no scope creep |
| Schema field shape matches docs | Read `src/song/schema.js` L148–149 | Pass — `crescendo: { enum: ["start","stop"] }`, `decrescendo: { enum: ["start","stop"] }` |
| Validator behavior matches docs | Read `src/song/validate.js` L120–128 (enum), L191–198 (permissive props), L180–201 (no pairing check) | Pass — generic enum error, unknown props ignored, no pairing validation |
| Renderer behavior matches docs | Read `src/notation/svg.js` L312–313, L854–876; `src/notation/layout.js` L2135 (laneY), L1869/1891/2327 (cross-system clip) | Pass — `<`/`>` by kind, per-hand below-staff lane, start-system-only clip |
| Annotated example validates + contains required content | Node scratch importing shipped `validateSong`, parsing the JSON block extracted from `docs/song-format.md` | Pass — see Accuracy spot-check (scratch removed after run) |
| Bad enum value is a conformance error | Same scratch, `crescendo: "increase"` | Pass — error `...crescendo: "increase" is not one of the allowed values ["start", "stop"]` |
| Misspelled optional field silently ignored | Same scratch, `cresendo: "start"` | Pass — `[]` |
| Dangling start still validates (no pairing check) | Same scratch, lone `crescendo: "start"` | Pass — `[]` |
| README cross-link anchor target exists | `grep "### 4. What the front end shows" README.md` | Pass — anchor `#4-what-the-front-end-shows` resolves; format matches the pre-existing cross-link at song-format.md L9 |
| No pipeline/process references in added text | `git diff <base>..HEAD` added lines grepped for AC#/Req#/T#/spec/design doc/review N/OQ-#/phase/pipeline | Pass — no matches |

Note: the host project's verification convention enumerates no dedicated documentation
gates, so the accuracy spot-check below (the extracted example run through the shipped
validator) is the sole executable gate, and it passes.

## Accuracy spot-check

The annotated example JSON was extracted verbatim from the `## Annotated example song`
fenced block in `docs/song-format.md` and run through the shipped
`src/song/validate.js`. Results:

- `validateSong(example)` → `[]` (zero errors). The example is valid, comment-free,
  copy-pasteable JSON.
- Right-hand event stream confirmed programmatically: `note F5 crescendo:start` →
  `note la5 crescendo:stop decrescendo:start` → `note C6 decrescendo:stop`. That is a
  2-note crescendo span (F5→la5) and a separate 2-note decrescendo span (la5→C6), each
  ≥2 notes, sharing the la5 messa-di-voce hinge note that carries **both**
  `crescendo: "stop"` and `decrescendo: "start"` (exactly one such hinge note).
- All three marker-bearing events use the real `pitches`-array shape (`type: "note"`
  with a non-empty `pitches[]`); none use a flattened `step`/`octave`-on-the-event
  shorthand. This matches `docs/song-format.md` L182 and the schema's `pitches`
  requirement for notes.
- Closed-enum behavior (Task 4 / Task 5 claim): mutating the example to
  `crescendo: "increase"` yields the documented conformance error
  `sections[1].measures[0].rightHand[0].crescendo: "increase" is not one of the allowed values ["start", "stop"]`.
- Silent-ignore behavior (Task 4 claim): mutating to `cresendo: "start"` (the exact
  typo the doc cites at L304-region) yields `[]`.
- No-pairing-check behavior (Task 4 claim): a lone `crescendo: "start"` with the stop
  removed yields `[]`.

Per-task additional spot-checks:

- **Task 1** — `docs/song-format.md` L170–171 grammar block and L182 bullet name both
  fields as optional `start | stop`; matches `schema.js` L148–149 verbatim. The
  direction-is-intrinsic and both-markers-on-one-note (hinge) claims match the design's
  two-independent-fields decision and the schema (two separate enum fields).
- **Task 2** — L206 "opening wedge `<` for a crescendo and a closing wedge `>`" and L208
  per-hand below-staff placement match `renderHairpin` (svg.js L854–876, `<` vertex-left
  vs `>` vertex-right) and the carried lane Y `staffBottomY + HAIRPIN_LANE_DY`
  (layout.js L2135). L218 "cross-line spans draw only their first line" matches
  `clipSpanToStartSystem` (layout.js L2327) clipping to the start system's `staffEndX`.
- **Task 3** — verified by the extraction run above; the cross-link
  `../README.md#4-what-the-front-end-shows` (L222) resolves to README L45.
- **Task 4** — L294 closed-vocabulary list now names `crescendo`/`decrescendo`; L296
  span-pairing-not-checked note matches the validator (no pairing logic anywhere in
  `validate.js`).
- **Task 5** — README L155 closed-enum list includes the two fields; L158 additive-growth
  paragraph uses them as a shipped worked example; L170/L172 keep audio out of scope as
  notation-only with no sonic effect; L173–174 retain the visual-authoring-UI and
  richer-notation backlog items.

## Drift sweep

The doc plan states `docs/song-format.md` and `README.md` are the only two
documentation surfaces in the repository (AGENTS.md and `.rp/` excluded). The diff
touches exactly those two files. No other surface is left with stale gradual-dynamics
references, and the shipped public surface (`crescendo`/`decrescendo` schema fields and
the hairpin rendering) is documented by Tasks 1–5. No undocumented public surface was
introduced.

## Scope and convention compliance

- **Hairpin-only scope preserved.** The `cresc.`/`dim.` text form (song-format.md L216)
  and between-staves placement (L217) are explicitly framed as *not in this version* /
  future refinements, never as v1 capabilities. The cross-system continuation is
  documented as not-drawn-in-this-version (L218). No audio or authoring-UI capability is
  promised.
- **Style mirrors `tie`/`slur`.** The new fields appear in the same grammar block, the
  same bullet list, and the same closed-vocabulary/additive-growth sections as
  `tie`/`slur`, with the same wording pattern — no divergent documentation pattern.
- **README defers field detail.** The README points to `docs/song-format.md` for field
  detail (README L170) and does not duplicate the field reference; the "Exercising the
  renderer" callout enumerates the example at a high level without field-level detail.
- **No pipeline/process references.** No AC#/Req#/T#/"spec"/"design doc"/"review N"/
  phase names appear in the added or edited text, satisfying AGENTS.md.

## Issues

None.
