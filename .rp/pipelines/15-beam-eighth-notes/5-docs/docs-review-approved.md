# Docs Review — APPROVED

_Phase: Docs (phase 5). Adversarial review of the docs batch for GitHub issue
[#15](https://github.com/SantosGuillamot/piano-block/issues/15), "Beam chained
eighth notes as a single group instead of in pairs."_

## Scope reviewed

- **Batch:** doc-plan Task 1 and Task 2, both confined to `src/notation/layout.js`.
- **Implementing commit:** `9753b78` (Reconcile beaming narrative with the grouping unit).
- **Diff reviewed:** `ec4eb7a..HEAD` — one file, **10 insertions / 9 deletions, comments/JSDoc only.**

## Verdict: APPROVED

Both doc-plan tasks meet their acceptance. The change is provably comment-only,
every reworded claim matches the shipped code, no external docs need changing, and
there are no `AGENTS.md` pipeline-reference leaks. Cheap gates pass clean.

## Findings by acceptance item

### Doc Task 1 — `beatGroupLength` JSDoc (review/acceptance gate)

The doc-writer reported this JSDoc needed **no change**, and that judgment is
**correct**. The JSDoc was already accurate at the base ref `ec4eb7a` (it is the
production rewrite from code Task 4) and is untouched by `9753b78` — the diff starts
at the `beamGroups` block (line 402), below `beatGroupLength`. Verified the shipped
JSDoc (`layout.js:366-378`) genuinely satisfies acceptance:

- **No stale "pairs/twos/one beatType unit per beat" claim.** The old wording is
  gone; the prose describes the grouping unit.
- **Simple-metre rule in grouping terms:** "Simple metres group by the HALF-BAR …
  (4/4 → fours, 2/2 → 4+4); small simple metres whose half-bar is under a half-note
  (2/4, 3/4, 2/8) group by the WHOLE BAR instead." Matches spec #3 / design §4.3.
- **Floored at one beat:** "The unit is floored at one notated beat (binds only in
  1/1)." Matches the code's `Math.max(unit, beat)` and design §4.5.
- **Compound unchanged:** "Compound (`beatType ∈ {8,16}` AND `beats % 3 == 0`, e.g.
  6/8, 9/8, 12/8) groups in dotted beats (three `beatType` units)."
- **Absent-ts default:** "an absent time signature defaults to 4/4 grouping," and the
  `@param` says "defaults to 4/4-like grouping when absent." Matches design §4.4.
- **`@return` still "always > 0":** present and correct (`always > 0`).

### Doc Task 2 — `beamGroups` JSDoc + inline/straddle comments, `layoutHand` `@param`

- **`beamGroups` JSDoc (`:401-413`)** now describes the break as "a crossing into a
  new grouping unit (`floor(pos / beatLen)` changes — `beatLen` is the metric group's
  span, which may be wider than one notated beat)" and "consulted ONLY for that
  grouping unit." It points at the **real** mechanism by its **real** variable name
  (`beatLen`, `floor(pos / beatLen)`), both confirmed to exist in code (`:425`,
  `:445-446`).
- **Inline boundary comment (`:455`)** reworded "starts past a beat boundary" →
  "starts in a new grouping unit."
- **Straddle comment (`:467-473`)** reworded "crosses into the next beat" / "its beat
  to the end beat" → "crosses into the next grouping unit" / "its grouping unit to the
  end unit." Accurately describes flush-after-append (matches design §4.6).
- **`layoutHand` `@param … timeSignature` (`:1431`):** "For beam grouping ONLY (never
  for positions)." Already says "grouping" — correctly confirmed accurate and left
  as-is, per the task's own instruction.

### Accuracy against shipped code

Every reworded claim matches the code. The walk is **byte-identical**: filtering the
`ec4eb7a..HEAD` diff to non-comment lines yields **zero** changes — no logic, no
expression, no variable name altered. The named mechanism (`beatLen`,
`floor(pos / beatLen)`) is present verbatim. The "may be wider than one notated beat"
and "metric group's span" claims are exactly what the (unchanged) `beatGroupLength`
returns.

### No code/logic change

Confirmed via the diff: comment/JSDoc lines only. No logic, no expression
(`floor(pos / beatLen)` untouched), no variable name (`beatLen` untouched), and **no
test touched** (`git diff --name-only` lists only `src/notation/layout.js`).

### Survey correctness — "no external docs need changing" holds

- `grep -in "beam" README.md` → **no matches.**
- `grep -in "beam" docs/song-format.md` → **no matches** (file confirmed to exist,
  32 KB — not a missing-file false negative).
- The change adds no public surface (no toggle/mode/config per spec "Out of Scope"),
  so there is nothing to add to the song-format field reference or the README.

### AGENTS.md compliance

`AGENTS.md` forbids referencing the pipeline workflow or its artifacts (`design §X`,
`AC#`, `T#`, "review N", `.rp/`) in shipped code/comments. The diff contains **no**
such references; the reworded prose reads as standalone engine documentation.

## Checks

| Command | Purpose | Result |
|---|---|---|
| `git diff ec4eb7a..HEAD --stat` | Confirm scope | `src/notation/layout.js` only, 10 ins / 9 del |
| `git diff ec4eb7a..HEAD` (non-comment filter) | Confirm comment-only | Zero non-comment lines changed |
| `git diff ec4eb7a..HEAD --name-only` | Confirm no test touched | Only `src/notation/layout.js` |
| `grep -in "beam" README.md` | Survey | No matches |
| `grep -in "beam" docs/song-format.md` | Survey | No matches (file exists) |
| AGENTS.md leak grep on diff | Compliance | No leaks |
| `npm run lint` (biome) | Style gate | Checked 23 files, no fixes applied — PASS |
| `npm run test:unit` | Regression gate | **367 / 367 passed**, 6 suites — PASS |

## Conclusion

The docs batch (doc-plan Tasks 1 and 2) is **APPROVED**. The shipped beaming prose in
`src/notation/layout.js` is accurate, comment-only, house-style-clean, and
`AGENTS.md`-compliant; no external documentation requires changes.
