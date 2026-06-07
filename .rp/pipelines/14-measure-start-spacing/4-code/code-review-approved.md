# Code Review

## Verdict: approved

## Batch scope

Tasks reviewed (all of `code-plan.md`):

- **T1** — Add the `MEASURE_START_PAD` constant and import it into `layout.js`.
- **T2** — Update and add `layout.test.js` assertions to the target lead-in behavior (RED).
- **T3** — Apply the coupled `openingClearance` edit in `buildLayoutModel` (GREEN).
- **T4** — Soften the `BARLINE_POST_PAD` doc-comment in `constants.js`.
- **T5** — Verify `svg.js` / `svg.test.js` require no changes (verify-only).

Base ref diffed against: `62c230b` (plan-complete tip) → current `HEAD`.

## Summary

The batch faithfully executes the design and plan. The lead-in is realized as
`openingClearance = Math.max(MEASURE_START_PAD, noteAccidentalLead)` and folded
into **both** coordinated coordinates — the packing width
(`m.contentWidth`, `layout.js:1772`) and the placement inset
(`leadInset`, `layout.js:1980-1982`) — preserving the both-sites coupling
invariant. The clearance is added outside the `* advanceScale` factor, so it does
not stretch under justification, and it is added unconditionally (uniform on every
measure, including system heads). The dead `m.noteAccidentalLead` field
store/read is fully removed; only the local `const noteAccidentalLead` survives as
the `max()` input. The test suite encodes the target contract (AC1–AC7), the two
new tests (AC5 justify-invariance, AC6 empty measure) are meaningful and not
trivially green, and no `svg` file changed. Both the targeted run (265) and the
full unit suite (362) are green. Approved.

## Checks

| Check | Command | Result |
| ----- | ------- | ------ |
| Both-sites invariant: `openingClearance` in packing (`:1772`) AND placement (`:1982`) | `grep -n "openingClearance" src/notation/layout.js` | Pass — present at `:1759` (def), `:1768` (store), `:1772` (packing sum), `:1982` (leadInset) |
| Dead `m.noteAccidentalLead` field fully removed (only local `const` max-input remains) | `grep -rn "noteAccidentalLead" src/` | Pass — only `:1756`/`:1759` (local const + max input); no `m.noteAccidentalLead` store or read |
| Clearance unscaled by justify (outside `* advanceScale`) | read `layout.js:1980-1997` | Pass — `leadInset` added to `scaledContent` unscaled (`:1988`); `cx = leadInset` (`:1993`) |
| Clearance uniform on every measure incl. heads (only `sectionReserve` gated on `localIdx > 0`) | read `layout.js:1980-1982` | Pass |
| Constant value/placement | `grep -n` in `constants.js` | Pass — `MEASURE_START_PAD = 1.0` at `:79`, in "Horizontal spacing" after `EMPTY_MEASURE_WIDTH` (`:70`), before "System wrapping" divider (`:81`) |
| `BARLINE_POST_PAD` value unchanged, comment softened | read `constants.js:127-132` | Pass — value `0.7`, comment defers breathing room to `MEASURE_START_PAD`, no "sits close to the bar" |
| No "hugs" / `toBeLessThan(NOTEHEAD_RX)` for `notes[0].x` remain | `grep -n` in `layout.test.js` | Pass — none (remaining "hug" matches are unrelated staff-vertical/"huge ratio" comments) |
| Scope: only the 3 intended files changed; no svg edits | `git diff --name-only 62c230b HEAD` | Pass — `layout.test.js`, `constants.js`, `layout.js` only |
| Targeted suite green | `npm run test:unit -- layout.test.js svg.test.js` | Pass — **265 passing** (218 layout + 47 svg) |
| Full unit suite green (no other regression) | `npm run test:unit` | Pass — **362 passing**, 6 suites |
| `constants.test.js` does not pin the touched constants | `grep -n` in `constants.test.js` | Pass — no references; stays green |

## Behavior verification

This is a pure layout-geometry change. Behavior was verified end-to-end through
`buildLayoutModel` (the documented verification surface — Jest via `wp-scripts
test-unit-js`), with the realized geometry values captured directly:

- **AC1 / AC4 (plain opening note).** `right.notes[0].x` and `left.notes[0].x`
  both `= 1.0` (`MEASURE_START_PAD`); still `< m.width / 2` (left of center,
  preserved). Whole-note test asserts both staves.
- **AC2 (barline → first-note gap).** Realized gap `= 1.830` sp on an interior
  measure, `≥` threshold `MEASURE_START_PAD + BARLINE_POST_PAD − NOTEHEAD_RX =
  1.100`.
- **AC3 (accidental opening matches plain).** Plain `notes[0].x = 1.0`, sharp
  `notes[0].x = 1.0` (equal); sharp accidental `dx = 1.2 > 0` (glyph draws left of
  the head). Confirms `max()` composition, not stacking.
- **AC5 (justify invariance).** The narrow build wraps to 6 systems; system 0 is a
  non-last (justified) system whose intra-note advance is stretched (`5.538` vs
  `5.200` in the wide build), yet `notes[0].x` stays exactly `1.0`. A
  packing/placement desync or an inside-scale clearance would have moved this off
  `1.0` — the test genuinely exercises the invariant.
- **AC6 (empty measure safe).** Width `= 4.3` (`= EMPTY_MEASURE_WIDTH +
  MEASURE_START_PAD`), finite, no NaN, zero notes on both hands.
- **AC7 (no regression).** Full unit suite 362 passing; no `svg.js` /
  `svg.test.js` diff; section-first test untouched and green.

T5's verify-only contract is satisfied: `svg.js` and `svg.test.js` are byte-for-byte
unchanged in the net diff and `svg.test.js` reports 47 passing.
