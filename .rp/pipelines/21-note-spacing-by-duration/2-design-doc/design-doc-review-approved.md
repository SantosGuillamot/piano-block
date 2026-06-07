# Design doc review — APPROVED

**Issue:** #21 — Space notes horizontally according to their duration
**Target:** `.rp/pipelines/21-note-spacing-by-duration/2-design-doc/design-doc.md`
**Verdict:** APPROVED (singleton terminator). Non-blocking nits noted below; none block.

## Verdict summary

The design doc is sound, complete, internally consistent, aligned with `spec.md`,
and technically feasible against the real code. The TEST-ONLY conclusion is
correct, the three seams (layout / model / DOM) are valid and testable exactly as
described, the matcher policy is robust and invents no pixel ratios, and every
documented fixture trap is real and correctly mitigated. Every load-bearing claim
was independently verified against the live code in the worktree (not merely
against the research artifact).

## Independent verification performed (live code + live runs)

All claims below were checked against the source and, where numeric, re-derived by
running the production path through the Jest/babel harness (a scratch test, since
deleted; the working tree is clean).

**Formula & constants — VERIFIED**
- `advanceFor(Δ) = MIN_ADV + ADV_K·sqrt(max(Δ,0)) + max(extra,0)` at `layout.js:779`.
- Constants in `constants.js`: `MIN_ADV=2.2`, `ADV_K=3.0`, `MAX_STRETCH=1.6`,
  `MEASURE_START_PAD=1.0`, `EMPTY_MEASURE_WIDTH=3.3`, `NOTEHEAD_RX=0.6`.
- `BASE_DUR` (whole 4 / half 2 / quarter 1 / eighth 0.5 / sixteenth 0.25 /
  thirty-second 0.125) and `DOT_MUL` (1 dot ×1.5) confirmed.
- The §2.1 advance table reproduces exactly: 32nd 3.2607 < 16th 3.7000 < eighth
  4.3213 < quarter 5.2000 < dotted-q 5.8742 < half 6.4426 < whole 8.2000.
  eighth:quarter ratio = 1.2033359220 (doc "1.2033"); whole:32nd = 2.5148 ("~2.5:1").

**Column / measure model — VERIFIED**
- The column object is literally `{ onset, x, advance }` with
  `advance = advanceFor(next − onset, { extra: columnExtra[i] ?? 0 })`
  (`layout.js:845-846`); the last column gaps to
  `measureEnd = max(handEnd(right), handEnd(left), 0)` (`layout.js:818, 844`). So
  `columns[i].advance` IS the per-column gap (no X subtraction) — the D-Target
  decision is correct.
- Empty grid short-circuits to `EMPTY_MEASURE_WIDTH`, no columns, no NaN
  (`layout.js:826-835`); `max(delta,0)` guards negative gaps (`layout.js:779`).
- Time-signature-blindness confirmed: `timeSignature` never enters any X/width.

**Justification / model X — VERIFIED**
- `systemScale` (`layout.js:1395-1409`): over-wide → `{advanceScale:1,
  downscaleFactor: avail/content}`; last/empty → `{advanceScale:1,
  downscaleFactor:1}`; else `clamp(avail/content, 1, MAX_STRETCH)`.
- `cx += col.advance * advanceScale` with `leadInset` added UNscaled
  (`layout.js:2024-2041`) — the uniform-scalar + unstretched-lead-in claims hold.
- `buildLayoutModel` calls `measureLayout(…, { trailingPad })` with NO `columnExtra`
  (`layout.js:1757-1759`) → equal eighth gaps stay EXACTLY equal at the model
  level (the §2.3 / D-Justify claim is precisely true).

**AC7 live (the doc's headline integration claim)** — `buildLayoutModel(8×[8,8,q,q],
140)` produced exactly: 2 systems; `advanceScale = [1.023669 (>1, ≤1.6), 1
(ragged last)]`; system-0 eighthGap 4.4236 < quarterGap 5.3231 (ratio
1.2033359220); last-system eighthGap 4.3213 < quarterGap 5.2000 (ratio
1.2033359220 — IDENTICAL); `firstColX === MEASURE_START_PAD === 1.0` in BOTH
systems even at scale 1.0237. Matches the doc verbatim.

**AC10 live** — `buildLayoutModel([8,8,8,8,q,q], 1000)` → note.x =
[1, 5.3213, 9.6426, 13.964, 18.2853, 23.4853]; DOM `cx` (via
`#rightHand-note-${i}` → `[data-notehead]`) === note.x EXACTLY for all six
single-pitch notes (strict `===`, not merely close). eighth gap 4.3213 <
quarter gap 5.2000. The note `<g id="${handKey}-note-${i}">` and `[data-notehead]`
selectors are real (`svg.js:709, 738`); handKey is `rightHand`/`leftHand`.

**AC1 / AC4 / AC5 / AC9 live** — AC1 grid `[0,0.5,1,1.5,2,3]`, measureEnd 4,
advances `[4.3213×4, 5.2, 5.2]`; the col3→4 boundary gap is 4.3213 (an eighth
gap), confirming the R-B / D5 trap is real and the doc's "compare cols 0–3 vs the
q→q col 4, not col 3→4" guidance is necessary. AC4 half-rest 6.4426 > eighth-rest
4.3213 (rests are full grid citizens). AC5 chord 5.2000 === single 5.2000, grids
equal. AC9 20 columns, all eighth advance, strictly monotonic X, finite, ts-blind
deep-equal.

**Fixture traps — VERIFIED REAL**
- R-C: `cx = note.x + (head.displaced ? dx*2 : 0)` (`svg.js:730`) — a chord back
  head IS displaced, so single-pitch fixtures for any cx/note.x comparison is
  required; proving AC5 at `measureLayout` (not cx) is correct.
- Pitch requirement: a pitch-less / unresolvable-pitch note returns early without
  pushing to `notes[]` (`layout.js:1471-1474`) — so AC7/AC10 fixtures MUST carry
  pitch objects. (Empirically hit this myself: a string `'C4'` fixture rendered
  zero notes; the repo's `{ step, octave }` shape is required.) `measureLayout`
  ignores pitches, so the same pitch-carrying array works at both layers.

**Existing-coverage claims & conventions — VERIFIED**
- All 381 existing unit tests pass with ZERO source changes (test-only premise
  holds).
- Cited reused cases exist and leave exactly the claimed gaps: empty measure
  (`layout.test.js:841`), over-full no-throw (852 — asserts only not-throw/20
  cols/finite, NOT all-advances-equal nor monotonic-X, so AC9's ordering
  assertions are genuinely additive), under-full ts-blind (866 — 6 eighths), and
  the `systemScale` policy unit at 1796 (capped at MAX_STRETCH).
- The svg.test.js cx idiom (`[data-notehead]` + `getAttribute("cx")` +
  `toBeCloseTo(_, 6)`) exists at 312-317. The feature-grouped describe + trailing
  `(ACn)` precedent (hairpin block, svg.test.js:1004 with `(AC4)/(AC7)/(AC8)`) is
  accurate. All needed imports (`advanceFor`, `eventDuration`, `measureLayout`,
  `systemScale`, `buildLayoutModel`, `MAX_STRETCH`, `MEASURE_START_PAD`,
  `EMPTY_MEASURE_WIDTH`) are already imported in `layout.test.js`.

## Soundness / consistency / spec-alignment

- Matcher policy is robust: ordinal `<`/`>` for orderings, `toBeCloseTo(_,10)` for
  sqrt-irrational sp arithmetic (correctly never `toBe`), `toBeCloseTo(_,6)` for
  DOM cx, `toEqual` for exact grids, and constants referenced by import rather than
  copied literals. This faithfully implements the spec's "ordinal, not invented
  pixel ratios" intent and stays green under a future OQ1/OQ2 constant tune.
- AC8 correctly asserted only at the intrinsic `measureLayout` layer; cross-system
  absolute-gap equality is explicitly NOT asserted (matches spec Out-of-Scope,
  edge B; live system-0 eighthGap 4.4236 ≠ system-1 4.3213 confirms the hazard).
- Per-AC matrix, NEW-vs-REUSE split, file/naming conventions, and Out-of-Scope all
  align with `spec.md` and the codebase.

## Non-blocking nits (do NOT block; for the plan/code phase to consider)

1. **ts-blind fixture notation.** §4 AC9 and §FINAL write the ignored time
   signature as `{timeSignature:{2,4}}` / `{12,8}` shorthand, whereas the repo's
   convention is `{ beats, beatType }` (e.g. `{ beats: 2, beatType: 4 }`,
   layout.test.js:874). Because `timeSignature` is fully ignored, the deep-equal
   result is byte-identical regardless of the property names — purely a doc
   shorthand, not a correctness issue. The plan/code phase should use the repo's
   `{ beats, beatType }` shape for consistency.

2. **AC7 width is wrap-dependent (already flagged as R-E).** Width 140 yielding a
   clean 6+2 split with a mid-range scale (1.0237) was confirmed live, and R-E
   already mitigates by locking the `systemScale` policy separately. No action
   needed; just noting the assertion should follow the doc's guidance to assert
   the SHAPE (non-last>1 & ≤MAX_STRETCH, last===1, ratio preserved) rather than the
   exact 1.0237 scale, which the doc already prescribes.

3. **Fixtures must carry `{ step, octave }` pitch objects** (not string pitches) or
   `buildLayoutModel`/`renderSvg` skip the notes. The doc's D-Fixtures already
   states "fixture events MUST carry pitches"; the plan should make the concrete
   shape explicit so the code phase doesn't trip on it (I did, empirically).

None of these affect the design's correctness or its definition of done. Approved.
