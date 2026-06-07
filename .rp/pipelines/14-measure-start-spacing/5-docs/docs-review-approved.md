# Docs Review

## Verdict: approved

## Batch scope

Tasks reviewed:

- **D1 (verify-only):** Verify `README.md`, `docs/song-format.md`, and `AGENTS.md`
  stay accurate after the measure-start lead-in lands. Outcome claimed by the
  writer: no drift, no edits, no commit.
- **D2 (commit `8080f0e`):** Refresh the `ACCIDENTAL_LEAD_EXTRA` doc-comment in
  `src/notation/constants.js` to describe the composed (max) opening behavior.

Base ref diffed against: `4511677` (code-phase tip). Doc-phase HEAD: `8080f0e`.

## Summary

The batch is correct and minimal. The single doc-phase commit (`8080f0e`, D2)
touches only the `ACCIDENTAL_LEAD_EXTRA` doc-comment block in
`src/notation/constants.js`; nothing else changed between the base ref and HEAD.
The refreshed comment accurately describes the shipped
`openingClearance = max(MEASURE_START_PAD, noteAccidentalLead)` composition in
`layout.js`: it drops both now-false clauses (plain note "hugs the boundary";
accidental note "shifts right"), states the max-composition and shared opening
slot, and retains the glyph-occupies-the-slot explanation. The constant's value
(`= 1`), name, and declaration are unchanged, and no other comment or code in
`constants.js` was modified. D1's no-drift conclusion is independently confirmed:
the cited `beat`/left-edge passages name the onset *anchor* (the author's mental
model), not a concrete engraving offset, and no external doc contains a "flush"
or concrete sp/px opening-gap claim that the lead-in would falsify. No
`.rp/`-workflow references appear in any shipped doc/comment. The combined
`layout.test.js` + `svg.test.js` suite passes 265/265, confirming the
comment-only change has no behavioral effect.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Doc-phase diff is scoped to `constants.js` only | `git diff 4511677 HEAD --stat` | PASS — only `src/notation/constants.js` (6 ins, 4 del) |
| Exactly one doc-phase commit (D2); D1 produced none | `git log --oneline 4511677..HEAD` | PASS — single commit `8080f0e` |
| No non-`constants.js` changes in the doc phase | `git diff 4511677 HEAD -- ':!src/notation/constants.js'` | PASS — empty diff |
| D2 comment matches shipped `max()` composition | Read `layout.js:1756-1772`, `:1980-1993` | PASS — `openingClearance = max(MEASURE_START_PAD, noteAccidentalLead)` |
| `ACCIDENTAL_LEAD_EXTRA` value/name/declaration unchanged | Read `constants.js:157` | PASS — `export const ACCIDENTAL_LEAD_EXTRA = 1;` |
| No `.rp/`-workflow leakage in touched doc/comment | `grep -niE "AC[0-9]\|\bT[0-9]\b\|design §\|spec\|Decision D[0-9]\|review [0-9]\|\.rp/\|pipeline" constants.js` | PASS — no matches (exit 1) |
| No "flush"/concrete opening-gap claim in external docs | `grep -rni "flush\|hug\|MEASURE_START_PAD"` + `grep -rniE "[0-9]+(\.[0-9]+)?\s*(sp\|px)"` on `README.md` / `docs/song-format.md` | PASS — no matches |
| Suite sanity (comment-only change is behavior-neutral) | `npm run test:unit -- layout.test.js svg.test.js` | PASS — 265 passed, 265 total |

## Accuracy spot-check

**D2 — concrete claim verified against shipped code.** The refreshed comment
(`constants.js:149-156`) asserts that `ACCIDENTAL_LEAD_EXTRA` "does not stack on
top of the uniform opening lead-in (`MEASURE_START_PAD`) — the two compose by
max(), so they share one opening slot and a plain opening note and an accidental
one land at the SAME opening position." Verified against the shipped layout
logic in `src/notation/layout.js`:

```
1756  const noteAccidentalLead = firstColumnHasAccidental(m)
1757      ? ACCIDENTAL_LEAD_EXTRA
1758      : 0;
1759  const openingClearance = Math.max(MEASURE_START_PAD, noteAccidentalLead);
...
1772  m.contentWidth = ml.width + sectionReserve + openingClearance;
...
1980  const leadInset =
1981      (localIdx > 0 ? (m.sectionReserve ?? 0) : 0) +
1982      (m.openingClearance ?? 0);
1993  let cx = leadInset;
```

With `MEASURE_START_PAD = 1.0` and `ACCIDENTAL_LEAD_EXTRA = 1`, a plain opening
note resolves to `max(1.0, 0) = 1.0` and an accidental opening note resolves to
`max(1.0, 1) = 1.0` — identical opening positions, exactly as the comment
states. The comment's "drawn to the left of the notehead" claim is corroborated
by the design's `note.x − dx` accidental draw path; the glyph rides left of the
head. The comment names `MEASURE_START_PAD` only as a cross-reference and does
not re-document its value, so no duplication of the code-phase-owned constant.

**D1 — no-drift conclusion independently re-verified.**

- `docs/song-format.md:268` — "When `beat` is **absent**, the note anchors
  **near the measure's left edge** (equivalent to `beat: 0`)." This names which
  onset the event anchors to, not a concrete engraving offset; "near" makes no
  flush claim. The lead-in adds uniform breathing room *before* that anchor and
  does not move the author-facing `beat: 0` semantics. No edit needed — confirmed.
- `docs/song-format.md:283` — "anchored at the bar's left edge (no `beat`)."
  Same author-model anchor language; not falsified by the lead-in. No edit
  needed — confirmed.
- `README.md:117` — the `src/notation/` file-map row describes `constants.js` as
  "the shared sp/layout constants" and `layout.js` as "all musical geometry in
  staff-space units." This is a generic descriptor that enumerates no constants
  and pins no values, so adding `MEASURE_START_PAD` introduces no contradiction.
  No edit needed — confirmed.
- A grep across `README.md` and `docs/song-format.md` for "flush", "hug",
  `MEASURE_START_PAD`, and any `N sp` / `N px` opening-gap figure returned zero
  matches, confirming no concrete-gap claim exists for the lead-in to falsify.

## Issues

None.
