# Design Doc Review — Issue #4 (Render song as sheet music) — REJECTED (iteration 2)

**Verdict: REJECTED.** The revision (commit `68493ba`) correctly identified the fix
direction from iteration 1 — abandon the invalid-JSON `<\!--` ETAGO escape in favor of
escaping the leading `<` of every breakout sequence — and the surrounding *reasoning* in
§2.2 is now sound (it explicitly contrasts against the invalid `\!`, and it explains that
the escape decodes back to the exact author bytes). **The regression pass is clean:** the
revision diff touched only the four escape locations the iteration-1 review named (§2.2,
the §4 diagram, the §8 test note, §10 open-item 2); the rest of the design — architecture,
SVG substrate, hybrid/Bravura glyph strategy, pitch→Y math, the union-grid/AC8 rule,
`validateSong` gate, all 12 AC coverage — is untouched and still holds.

It is rejected for **one concrete, blocking defect introduced by the revision itself**: the
chosen escape token is written as a bare `<` everywhere instead of the six-character JSON
unicode escape `<` it is supposed to be. As committed, the doc therefore prescribes a
**no-op transform** ("replace `</` → `</`") and asserts a **falsehood** ("`<` is a legal
JSON escape for `<`"), which would leave the literal `</script>` / `<!--` breakout
sequences intact in the emitted `<script>` — the same class of AC1/AC2/AC8 failure
iteration 1 was meant to close, by a different mechanism. The fix is a pure find-and-replace.

---

## Required changes

### 1. (BLOCKING) The escape token is a bare `<`, not `<` — the prescribed transform is a no-op.

**Where (all four locations the iteration-1 review named, plus the cross-reference):**
- §2.2, lines 148–151: "the **JSON unicode escape `<`**", "replace `</` → `</`",
  "`<!--` → `<!--`", "A blanket `<` → `<`", "`<` is a legal JSON escape for `<`".
- §4 data-flow diagram, line 340: "(breakout-escaped: `</` → `</`, `<!--` → `<!--` via `<`)".
- §8 test note, line 769: "the `<` escape round-trips".
- §10 open-item 2, lines 833–834: "the JSON unicode escape `<`: replace `</` → `</` and
  `<!--` → `<!--` (a blanket `<` → `<` …)".

**Spec tie:** AC1 / AC2 (a conformant song must render notation), AC8 / req 9 ("robust to
any conformant song and never errors on conformant input").

**The defect (verified at the byte level).** The code spans that should read `` `<` ``
literally contain a single `<` character. Byte-dumping the file, the span after "JSON
unicode escape " is `60 3c 60` = `` ` ``, `<` (U+003C), `` ` `` — a backtick-wrapped bare
less-than, **not** the six bytes `<`. The whole document contains **zero** occurrences
of the text `<` and **11** occurrences of the code span `` `<` ``. (For contrast, line
153 still correctly stores literal backslashes — `` `<\/` ``, `` `<\!--` ``, `` `\!` `` —
so the file faithfully preserves backslashes where intended; the `<` token simply
got collapsed to the character it denotes in every spot.) The same collapse is visible in
the revision's own git diff: the added lines read "replace `</` → `</`" and "via `<`".

**The consequence is a real AC violation, not cosmetic.** Read literally, the doc now
prescribes:
- "replace `</` → `</`" and "a blanket `<` → `<`" — these are **no-ops** (replace a
  string with itself); applying them changes nothing, so the emitted
  `<script type="application/json">` still contains the literal `</` / `<!--` bytes.
- "`<` is a legal JSON escape for `<`" — **false**; a bare `<` is an ordinary character,
  not an escape.

An implementer following §2.2 / §10 verbatim would ship a transform that does nothing, and
a conformant song whose `chordSymbol` or `metadata.title` contains a literal `</script>`
would break out of the `<script>` element (or a literal `<!--` would open an HTML comment),
corrupting the JSON the browser hands to `view.js`, tripping the `validateSong` gate, and
rendering nothing for a conformant song — contradicting AC1/AC2 and the AC8/req-9 "never
errors on conformant input" guarantee. This is the same failure class iteration 1 closed,
reintroduced by the token collapse.

**This is a design-phase defect, not a plan/code slip,** because the doc states the wrong
(no-op) transform as the *authoritative, prescribed* answer in all four normative spots and
§10/§8 hand that exact transform to the plan/test phases. The intended escape is correct —
verified end-to-end below — but the doc as committed does not state it.

**The intended transform is correct (so the fix is purely the token, nothing else).**
I verified the *intended* `<` escape round-trips and neutralizes both breakout
sequences, by simulating `render.php` emitting a conformant song that contains both literals
and `JSON.parse`-ing it client-side:

```
author title:   danger </script> and <!-- comment
emitted <script> body (blanket < → <):
  {"metadata":{"title":"danger </script> and <!-- comment"},"sections":[]}
emitted contains literal "</" ?    false
emitted contains literal "<!--" ?  false
JSON.parse(emitted) → succeeds; parsed title === author title → true
(and the old "<\!--" form throws: "Bad escaped character in JSON")
```

So `<` is a legal JSON escape for `<` that decodes to the exact author byte, while the
HTML parser never sees a literal `</` or `<!--`. The reasoning the doc *intends* is right;
only the literal token is wrong.

**Required fix.** Replace the bare `<` escape token with the six-character text `<`
in every spot it denotes the escape (NOT the spots where `<` is a literal source byte being
matched). Concretely, the four locations should read:

- §2.2: "the **JSON unicode escape `<`**", "replace `</` → `</`", "`<!--` →
  `<!--`", "A blanket `<` → `<`", "`<` is a legal JSON escape for `<`".
- §4 diagram: "(breakout-escaped: `</` → `</`, `<!--` → `<!--` via `<`)".
- §8 test note: "the `<` escape round-trips".
- §10 open-item 2: "the JSON unicode escape `<`: replace `</` → `</` and `<!--`
  → `<!--` (a blanket `<` → `<` …)".

Leave the *source* `<` / `</` / `<!--` byte references (the things being matched/replaced
*from*) as literal `<` — only the replacement *target* token is the `<` escape. After
the edit, sanity-check the file actually contains the six bytes `<` (e.g. it should no
longer say "replace `</` → `</`"). The escaped-uppercase `<` is equally valid if
preferred for legibility; lowercase `<` matches what `JSON.stringify`-style emitters
produce and is fine.

---

## What is sound (verified — do not change again in the revision)

- **The fix direction is correct.** Escaping the leading `<` of every breakout sequence
  (a blanket `<` → `<`) is a correct, idiomatic, JSON-legal solution that neutralizes
  both `</` (ETAGO) and `<!--` (comment-open) and round-trips to the exact author bytes —
  verified above. Only the literal token needs repair.
- **The iteration-1 root cause is gone from the prose.** §2.2 now explicitly calls out the
  old `<\!--` form as wrong ("`\!` is not a valid JSON escape, so `JSON.parse` would
  throw"), and the doc no longer prescribes `<\!--` as the transform. (`<\/` / `<\!--`
  remain only as the named-and-rejected wrong forms — appropriate.)
- **`<!--` is now covered alongside `</script>`** in §2.2, the §8 test note (a literal
  `<!--` round-tripping while the song stays conformant and still renders), and §10
  open-item 2 — closing the iteration-1 ask to test both sequences.
- **Regression pass clean.** The revision diff is confined to the four escape locations;
  nothing else in the design moved. The architecture (client-side plain `viewScript`, no
  `--experimental-modules` on pinned 32.3.0), inline-SVG substrate, hybrid Bravura/OFL
  glyph strategy with rename + `OFL.txt`, the pitch→Y formula, the "never use
  `timeSignature` for positioning" AC8/AC9 rule, the `validateSong` reuse gate, the
  `textContent`/`createElementNS` XSS posture, accessibility templates, and full 12-AC
  coverage are all exactly as iteration 1 verified them — no new contradictions introduced.

## Non-blocking notes (optional; do not gate approval)

- The research file (`design-doc-research.md`, Q10) still records the old `<\!--` form in
  its running log. That is the historical Q&A record, not the design under review, so it
  does not gate this approval — but the plan phase should follow `design-doc.md` (once
  fixed), not the stale research note, for the escape.

---

## Bottom line

Replace the bare `<` escape token with the literal six-character `<` in §2.2, the §4
diagram, the §8 test note, and §10 open-item 2 (only at the replacement-target spots), then
confirm the file actually contains `<`. The intended design is correct and everything
else clears the bar; this is the single remaining required change.
