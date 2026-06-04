# Design Doc Review — Issue #4 (Render song as sheet music) — APPROVED

**Verdict: APPROVED** (iteration 3). The single blocking defect from iterations 1 and 2 —
the `<script>`-breakout escape token — is now correct, and the rest of the design (verified
complete across all 12 ACs by the two prior reviews) is undisturbed.

---

## Primary check (byte-level) — the escape token

The replacement-target token is now the correct literal six-character JSON escape —
backslash, `u`, `0`, `0`, `3`, `C` (i.e. `<`) — at every spot, verified at the byte
level (each `u003C` is immediately preceded by a `0x5C` backslash; zero bare `u003C`):

- **§2.2** (lines 148–150): "the **JSON unicode escape `<`**", "replace `</` →
  `</`", "`<!--` → `<!--`", "A blanket `<` → `<`", "`<` is a legal JSON
  escape for `<`".
- **§4 data-flow diagram** (line 340): "(breakout-escaped: `</` → `</`, `<!--` →
  `<!--` via `<`)".
- **§8 test note** (line 769): "the `<` escape round-trips".
- **§10 open-item 2** (lines 833–834): "the JSON unicode escape `<`: replace `</` →
  `</` and `<!--` → `<!--` (a blanket `<` → `<` …)".

**No remaining no-ops.** The file contains 13 occurrences of `<` (all backslash-prefixed)
and the iteration-2 collapse is gone — there is no `` `<` ``→`` `<` `` no-op anywhere. The five
remaining bare-`` `<` `` code spans are all legitimate: they denote the literal less-than
character on the *input/source* side of a real transform (`<` → `<`) or describe what
`<` *decodes to* — none is a replace-with-self.

**Input-sequence literals correctly preserved.** The bytes being matched/replaced *from* keep
their literal less-than character: `` `</` `` (§2.2, §4, §10), `` `<!--` `` (§2.2, §4, §8, §10),
and the cited-wrong forms `<\/` / `<\!--` / `` `\!` `` (§2.2 line 153, §8 line 769, §10 line 835)
all still read with a literal `<`, exactly as they must.

**Round-trip prose is now true** (re-verified end-to-end with the doc's as-written transform):
emitting a conformant song whose `metadata.title` is `danger </script> and <!-- comment`,
applying the blanket `<` → `<`, yields `…"danger </script> and <!-- comment"…`
— contains no literal `</` and no literal `<!--`, `JSON.parse` decodes back to the exact author
bytes, and the cited-wrong `<\!--` form genuinely throws "Bad escaped character in JSON". So the
`<` escape neutralizes the ETAGO/comment-open sequences inside the raw-text script while
round-tripping losslessly — satisfying AC1/AC2 and the AC8/req-9 "never errors on conformant
input" guarantee.

## Secondary check — regression / coherence

The revision (commit `33e5737`, "Correct escape token to < in design doc") is a clean
7-insertion / 7-deletion diff confined to exactly the four escape-token spots named above
(§2.2, §4 diagram, §8 test note, §10 open-item 2). Every hunk converts a bare `<` token to
`<` only at the replacement-target position; no source literal, cited-wrong form, or any
other prose moved. The doc remains internally consistent, and the rest of the design — already
verified complete (all 12 ACs, no scope creep) and sound (plain `viewScript` on pinned
@wordpress/scripts 32.3.0, inline-SVG substrate, hybrid Bravura/OFL glyph strategy with rename +
`OFL.txt`, pitch→Y math, the "never use `timeSignature` for positioning" AC8/AC9 rule,
`validateSong` reuse gate, `textContent`/`createElementNS` XSS posture, accessibility templates)
by iterations 1 and 2 — is untouched and unaffected by this revision.

## Bottom line

The escape token is correct at the byte level, the transforms are real (not no-ops), the
round-trip is verified true, and the regression pass is clean. The design clears the bar.
