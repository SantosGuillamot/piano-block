# Docs review — APPROVED (phase 5, issue #20)

**Batch under review:** documentation tasks D1 (235502b), D2 (30ff177), D3 (1de27a9), plus D4 (verification-only, no commit).
**Base ref:** `ded15f4`. Diff reviewed: `git diff ded15f4 HEAD`.
**Rejection iteration:** N=1 (n/a — approved).

## Verdict

**APPROVED.** All three order-bearing doc-comments (M1, M2, M3) now accurately
describe the new top-to-bottom order **annotations → tempo → octaveShift** and are
consistent with the shipped code in `topMarginLayout` / `buildSystemTexts`. R9 is
fully satisfied and AC10 holds (no doc anywhere still states the old order). No
scope creep: only the three comment sites in `src/notation/layout.js` changed;
production logic and tests are untouched and remain below the base ref.

## Code is the source of truth — verified, not trusted

`topMarginLayout` (`src/notation/layout.js:2865-2910`) reserves lanes in source
order **[ottava, tempo, annotations]**:

- ottava block — guard `systemHasRightOttavaAbove` (`:2885-2889`)
- tempo block — guard `systemHasTempo` (`:2890-2894`)
- annotations block — guard `aboveRHCount > 0` (`:2895-2901`)

`at(dist) = topMargin − dist` (`:2903`), so by the invariant *reserved later ⇒
larger `d` ⇒ smaller Y ⇒ higher on the page*:

- ottava (reserved first) → largest Y → **nearest the staff**
- tempo (reserved second) → **middle lane**
- annotations (reserved last) → smallest Y → **topmost lane**

Visual top→bottom: **annotations → tempo → octaveShift** — the target order.

## Per-task findings

### D1 — M1: `topMarginLayout` JSDoc order sentence (`layout.js:2850-2852`)
- New text: "an above-staff ottava nearest the staff, then the tempo, then the
  above-RH note lane at the very top — so when there is nothing above the staff the
  margin drops close to it." **Accurate** vs. source order `[ottava, tempo,
  annotations]`.
- The old-order "(and the tempo)" parenthetical (which assumed the tempo was
  outermost) is **removed**.
- The deep-stack sentence (`:2853-2856`) and the `@param`/`@return` tags
  (`:2858-2863`) are **unchanged** and remain true (annotations reserved last still
  account the full stack on top — line `:2899`).
- **No defect.**

### D2 — M2: call-site comment parenthetical (`layout.js:1866`)
- New text: "(an above-staff ottava, the tempo, the above-RH note stack) stacked
  over the ledger zone" — innermost→outermost in the **new** order. **Accurate.**
- Surrounding sentences (`:1865`, `:1867-1869`) are order-agnostic and unchanged.
- **No defect.**

### D3 — M3: tempo-emit inline comment (`layout.js:2947`)
- New text: "// Middle lane: above the ottava, below the above-RH annotation lane."
  Tempo is reserved second (the middle lane); this is **accurate** and corrects the
  former false "Topmost lane" claim.
- The adjacent `x:` comment (`:2944-2946`, horizontal) is unchanged.
- **No defect.**

## R9 / AC10 closure — independent re-sweep (did not trust D4's report)

Re-ran order-language greps across `src/`, `docs/`, `README.md` (excluding
`node_modules`):

- `grep -rni "topmost|nearest the staff|very top|innermost|outermost|hug"`
- `grep -rni "tempo.*ottava|ottava.*annotation|above the ottava|below the ottava"`

No documentation site anywhere still asserts the old order. Every order-agnostic
site flagged by the design/plan is correctly **left unchanged** and is genuinely
order-agnostic:

- `constants.js:100` (`ABOVE_STAFF_PAD`, "above the topmost lane") — generic; a
  topmost lane still exists (now annotations). No old-order claim.
- `constants.js:106` (`TEXT_LANE_GAP`, "(chord / ottava / tempo)") — unordered
  example list of glyphs using the gap, not a top-to-bottom claim.
- `layout.js:2703/2707` (`systemHasTempo` JSDoc) — says *which* texts need a lane;
  no order claim.
- `layout.js:2869` (inner-zone comment) — describes the zone below all lanes.
- `layout.js:2897` ("the stack grows UP") — annotation stack's internal growth
  direction (AC3), not inter-lane order.
- `docs/song-format.md`, `README.md` — JSON format / above-below placement; no
  inter-lane order asserted.

**AC10 satisfied:** the only three doc sites that ever described the inter-lane
order (M1, M2, M3) now all describe **annotations → tempo → octaveShift**.

## Scope / isolation

- `git diff ded15f4 HEAD --stat` → only `src/notation/layout.js` (5 insertions,
  5 deletions) — exactly the M1 (2 lines), M2 (1 line), M3 (1 line) edits.
- No diff in `src/notation/constants.js`, `src/notation/svg.js`,
  `src/notation/__tests__/`, `docs/`, or `README.md`.
- The production reorder and test edits are below the base ref (e.g. the deep-stack
  test comment at `layout.test.js:2130` was introduced by `code-writer-t1` in
  commit `24bd467`, at/below `ded15f4`) and correctly do **not** appear in this
  batch. That test comment describes the pre-change baseline for a TDD assertion and
  lives in test code — out of R9/AC10 scope; not a defect.
- No production logic and no tests were modified by the docs batch.

## Prose quality

All three comments are clear, correct, and unambiguous for a future maintainer.
M3's rewrite in particular removes a now-false claim and replaces it with a precise
positional description ("above the ottava, below the above-RH annotation lane").
