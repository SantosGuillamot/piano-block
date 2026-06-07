# Code review — APPROVED (#13, Code-phase batch T1–T7)

**Verdict:** APPROVED.
**Diff reviewed:** `git diff 9a37c59..HEAD -- src/` (HEAD = `26defc8`).
**Production changes:** `src/notation/layout.js` only. **Tests:** `src/notation/__tests__/layout.test.js` only.
**Test result:** `npm run test:unit` → **372 passed, 372 total** (6 suites). Baseline was 360; this batch adds 12 (7 `lhAboveTopExtent` unit tests + 5 placement tests).
**Lint:** `npm run lint` (`biome lint .`) → **pass** (exit 0).

This was reviewed adversarially against the spec (R1.1–R1.6, R2.1–R2.3), the design doc
(KD1–KD6, invariants, worked numbers), and the code plan (T1–T7 + cross-cutting acceptance).
The real code was traced and worked examples recomputed independently — not just the task reports.

---

## Scope / faithfulness (all clean)

- Only `src/notation/layout.js` and `src/notation/__tests__/layout.test.js` changed
  (`git diff 9a37c59..HEAD --name-only`). `constants.js`, `svg.js`/`renderOttava`, `ottavaFor`,
  and the song schema are **untouched**.
- **Zero new constants.** No added top-level `const UPPER_CASE`; the new arm reuses
  `DYNAMICS_LANE_RESERVE`, `OTTAVA_SIZE`, `NOTE_GAP_STAFF`, `MID_GAP`, `INTRA_STAFF_GAP`,
  `NOTEHEAD_RX` (all already imported).
- **No remaining `systemHasOttavaAbove` reference** (grep across `src/`: none). It was replaced
  by `systemHasRightOttavaAbove` / `systemHasLeftOttavaAbove`; `topMarginLayout`'s single call now
  uses the RH-only predicate.
- **No `?? ottavaAboveLaneY` fallback** on the LH-above lane (grep: none) — KD6 honored. The
  gate↔run null-consistency is the proven invariant; the LH lane is non-null whenever read.
- Emitted model stays exactly `{ hand, label, placement, x1, x2, y }` — no new fields.

## Bug 1 — per-hand "above" placement (R1.1–R1.6): CORRECT

Traced the gap arm (`layout.js` ~1860–1886), the band field (~1911–1916), the split predicates
(~2697–2702), the `topMarginLayout` repoint (~2872), and the per-hand emit selection (~2956–2960).

Independently recomputed the design's worked geometry by running the actual module:

- **LH +1, G5 high note (6.5 sp), RH point dynamic** (both regions present):
  `rhBelowRegionReach = DYNAMICS_LANE_RESERVE = 6.9`; `lhAboveColumn = max(6.5,0)+1+2.2 = 9.7`;
  `bothRegions → +MID_GAP(1.2)`; new arm = `6.9+1.2+9.7 = 17.8` → gap = 17.8 (beats floor 8 and
  existing arm 0). `lhTopY = 9+17.8 = 26.8`; `ottavaLeftAboveLaneY = 26.8−6.5−1 = 19.3`.
  Glyph top = `19.3−2.2 = 17.1`; RH region bottom = `9+6.9 = 15.9` → clearance **1.2** (= MID_GAP, >0).
  Baseline 19.3 sits 1.0 sp (= NOTE_GAP_STAFF) above the G5 notehead top (20.3). Both no-overlap
  invariants hold strictly. `ottavaAboveLaneY` is **null** (no RH-above shift) — R1.5.
- **Both hands +1:** RH `ottavaAboveLaneY = 4` (top margin), LH `ottavaLeftAboveLaneY = 11.2` (gap);
  RH < LH and `ottavaAboveLaneY < ottavaLeftAboveLaneY − OTTAVA_SIZE` → distinct, non-overlapping
  zones (R1.6).
- **LH-only +1 vs no-shift:** `topMargin` equal (5 = 5); `ottavaAboveLaneY` null → no top-margin
  over-reservation (R1.5).
- **Below branch unchanged:** still `staffBottomY + 2`, per hand.
- **`lhAboveTopExtent`** mirrors `ledgerTopExtent` up over the LH/bass staff, reading
  `m.ctx.leftHand.clef` (non-blocking note 1 folded in). Verified C5→4.5, G5→6.5, C3→0, rest/empty→0.

## Bug 2 — per-system measure-extent x-span (R2.1–R2.3): CORRECT

Traced `buildSystemTexts` run shape (`run = { shift, firstModel, lastModel, firstHandNotes }`),
the guard `if (ott && run.firstModel)`, and the x-span formula
(`x2 = lastModel.x + width`; `x1 =` first-run-measure-notes min `− NOTEHEAD_RX` else `firstModel.x`).

- A rest-only measure still sets `firstModel`/`lastModel` (shift comes from `ctx`) → bracket
  emitted on rest-only systems (R2.1).
- `x1` keyed to the **first** run-measure's own notes (KD5) — not a global min — so a rest-leading
  sparse run gets `x1 = firstModel.x`, never a tiny window around a later lone note (R2.2).
- `&& ott` half kept → out-of-range shifts (`±3`, `ottavaFor` returns null) are dropped.
- `buildSystemTexts` runs once per wrapped system on its own slice → one bracket per system (R2.3),
  verified by the multi-system test (one `8va` per spanned system; total == system count).

## Test honesty & coverage: GENUINE

- All five spec new-tests assert observed band Ys and ottava `x1`/`x2` with real, non-tautological
  assertions, cross-checked against an independent recompute (numbers match exactly).
- Test #1 uses **`>=`** (not strict `>`) on the glyph-top-vs-`rightStaffBottomY` bound
  (lines 3571, 3575) — per non-blocking note 2.
- The T1 `lhAboveTopExtent` unit test asserts the design's worked numbers (4.5 / 6.5 / 0) and the
  per-measure-clef behavior.
- The test diff is **purely additive** — no existing test line was deleted or weakened.

## Backward-compat / regression: PROVEN INERT

- No-LH-shift fixture: gap stays at `INTRA_STAFF_GAP` floor (8), `ottavaLeftAboveLaneY` null —
  byte-for-byte unchanged. `hasLHOttavaAbove` is false for every existing fixture, so the new arm
  is `rhBelowRegionReach + 0 + 0`, ≤ the existing arm. Full suite green (372/372).
- COMPREHENSIVE_SONG RH-above assertions remain green (RH "above" still selects `ottavaAboveLaneY`).

---

## Non-blocking note (NOT a rejection)

**Biome formatting:** `npx biome check .` reports **2 cosmetic line-width (≤80) reflow** diffs:

1. `src/notation/layout.js:2997` — the `run = { shift, firstModel: null, lastModel: null,
   firstHandNotes: null }` literal; Biome would expand it multi-line. Introduced by **T6** (`d20a8cd`).
2. `src/notation/__tests__/layout.test.js` — the `lhAboveTopExtent` describe block's
   `expect(...).toBe(0)` calls; Biome would reflow them. Introduced by **T1** (`b826b1c`).

Both are **pure whitespace/line-break reflow with zero functional impact** (the code is correct and
all tests pass). A one-line `npm run format` resolves both.

**Why this is non-blocking, not a reject:** the team-lead's decision rule is "blocking only if a
formatting/lint failure would break CI." This repo has **no CI** (`.github/workflows` absent, grep
confirms no tracked CI yml), **no git hooks** (only `.sample`), and **no husky/lint-staged**. The
repo's named lint gate `npm run lint` (`biome lint .`) **passes** (exit 0). `biome check` /
`biome format` are run manually via `--write` scripts, not enforced automatically. So this is a
non-gated cosmetic warning. (Minor correction to T7's report: the nit is not pre-existing — `biome
check` is clean on these two files at base `9a37c59`; the diffs were introduced by T1 and T6 in this
batch. Still cosmetic and non-gating.) Recommend a follow-up `npm run format` for hygiene.

---

**Approved.** Reviewed by code-reviewer.
