# Design Doc Review — Issue #4 (Render song as sheet music) — REJECTED (iteration 1)

**Verdict: REJECTED.** The design is otherwise excellent — it covers all 12 acceptance
criteria with no scope creep, and its load-bearing architectural claims hold up under
direct verification against the codebase and toolchain (details in the "What is sound"
section below). It is rejected for **one concrete, correctness-level technical defect**:
the prescribed `</script>`-breakout escape — which the design itself elevates to a
"load-bearing, easily-mis-implemented detail" — produces **invalid JSON** for the
`<!--` half, and would make some *conformant* songs silently render nothing, violating
AC1/AC2 and the AC8/req-9 "never errors on conformant input" guarantee. The fix is
small and well-defined; this is the only required change.

---

## Required changes

### 1. (BLOCKING) The ETAGO escape `<!--` → `<\!--` is invalid JSON and breaks conformant songs.

**Where:** §2.2 ("The correct, JSON-preserving transform is the **ETAGO escape**:
replace `</` → `<\/` and `<!--` → `<\!--`"), repeated in §4's data-flow diagram
(`ETAGO-escaped: </ → <\/ , <!-- → <\!--`) and §10 open-item 2 (same transform,
"**NOT** `esc_html`").

**Spec tie:** AC1 / AC2 (a conformant song must render notation), AC8 / req 9
("robust to any conformant song and never errors on conformant input").

**The defect.** The `</` → `<\/` half is correct: `\/` is a legal JSON string escape
and `JSON.parse` decodes it back to the exact author bytes. The `<!--` → `<\!--` half
is **not**: `\!` is **not a valid JSON escape sequence**, so `JSON.parse` throws
`SyntaxError: Bad escaped character in JSON`. I verified this directly:

```
JSON for { metadata: { title: "x <!-- y" } }  →  escaped per the design:
  {"metadata":{"title":"x <\!-- y"},"sections":[]}
JSON.parse(...) → SyntaxError: Bad escaped character in JSON at position 26
```

**The consequence is a real AC violation, not a cosmetic one.** `render.php` emits the
escaped bytes inside a raw-text `<script type="application/json">`; the browser exposes
them verbatim via `script.textContent` (raw-text content decodes neither HTML entities
nor JS backslash escapes — exactly the design's own correct argument against
`esc_html`). `view.js` then runs `validateSong(raw)`, whose first step is `JSON.parse`.
For a **fully conformant** song whose `chordSymbol` or `metadata.title` contains the
literal `<!--`, that parse fails, `validateSong` returns `["Invalid JSON: …"]`, the gate
trips, and the block **renders nothing** — a conformant song that produces no notation.
That contradicts AC1/AC2 and the AC8/req-9 promise that the renderer "never errors on
conformant input." Traced end-to-end and confirmed.

This is a design-phase defect (not a plan/code slip) because the design states the wrong
transform as the *authoritative, verified-correct* answer in three places, **and** §10
open-item 2 / §8 instruct the plan/test phase to "test a literal `</script>` … in
author free text round-tripping" and to test `<!--` — a test that, written against the
prescribed escape, would itself fail. The error will propagate unless corrected here.

**Required fix.** Replace the `<!--` transform with a JSON-legal one that still defuses
the comment-open sequence. Either of these round-trips to the exact author bytes *and*
leaves no literal `<!--` / `</`, verified:

- `<!--` → `<!--` (escape the `!` as `!`); keep `</` → `<\/`.
- or escape the leading `<` of both sequences: `</` → `</` and `<!--` → `<!--`.

(A blanket `<` → `<` is also valid and simplest, if preferred.) Update §2.2, the
§4 diagram, and §10 open-item 2 consistently, and adjust the §8 / open-item-2 test note
so the round-trip fixture exercises a literal `<!--` (not only `</script>`) and asserts
the conformant song still renders.

---

## What is sound (verified — do not change in the revision)

I checked the load-bearing claims against the actual repo and the installed toolchain,
not just the prose. These all hold:

- **Plain `viewScript` builds with the UNCHANGED `npm run build` (no `--experimental-modules`).**
  VERIFIED in the installed `@wordpress/scripts`: `utils/block-json.js` puts `viewScript`
  in the `scriptFields` set (the standard webpack-entry path that runs unconditionally),
  while `viewScriptModule`/`viewModule` are the `moduleFields` set, and the module
  compilation is the part gated behind `hasExperimentalModulesFlag`
  (`WP_EXPERIMENTAL_MODULES`) in `config/webpack.config.js`. The §2.1 / §9 decision is
  correct.
- **Lockfile pins `@wordpress/scripts` 32.3.0.** VERIFIED (`package-lock.json` →
  `32.3.0`), so the 32.3.0-specific reasoning is valid.
- **Font asset delivery.** VERIFIED: webpack treats `.woff2` as `asset/resource` →
  `fonts/[name].[hash:8][ext]`, and the default (non-experimental) `output.clean`
  keeps `^(fonts|images)/`. The §2.4 "SCSS `url()` → webpack emits to `build/fonts/`"
  approach is consistent with the toolchain (and the hashed filename is why it must go
  through the SCSS `url()` import, as the design says).
- **pitch→Y mapping (§5.2).** Independently re-implemented the formula; all eight cited
  cases match (treble E4→0, G4→2, F5→8, C4→−2, C6→12; bass C4→+10; alto C4→4; tenor
  C4→6), and middle C = C4 = diatonicIndex 28. AC3 placement math is correct.
- **`esc_html` is the wrong tool for raw-text `<script>` content.** Correct reasoning —
  raw-text script content does not decode HTML entities, so entity-escaping would leave
  literal `&lt;` that `JSON.parse` chokes on. (This is precisely why the *escape mechanism*
  has to be a JSON-internal one — and why getting it JSON-legal, per change #1, matters.)
- **`validateSong` reuse as the gate.** VERIFIED: `src/song/validate.js` exports only
  `validateSong(rawString)`, returns `["Invalid JSON: …"]` on parse failure and `[]` on a
  conformant song, never throws — exactly the gate §2.6 relies on. `NOTE_NAMES` is indeed
  private (not exported); the design correctly flags exposing a shared `normalizeStep`
  helper (§6.5 / open-item 3) without changing validation behavior.
- **"Never use `timeSignature` for positioning" (§6.2).** Sound and is the right
  structural mechanism for AC8/AC9: onsets and widths derive only from event durations,
  staves are drawn from measure geometry, so unbalanced/one-hand/empty-hand bars fall out
  without special cases. NaN guards are appropriate given the closed validated vocabulary.
- **Bravura subset + RENAME under SIL OFL 1.1.** Correct: "Bravura" is a Reserved Font
  Name, a subset is a Modified Version that must be renamed, ship `OFL.txt`; OFL/GPL
  bundling is compatible; an asset ≠ a notation library (req 10 / AC10).
- **Editor unchanged (AC11/req 13).** VERIFIED: `edit.js` is independent of `render.php`
  and the new `view.js`/`notation/*`; adding only `viewScript` to `block.json` and keeping
  `editorScript`/`style`/`render` does not touch the editor.
- **All 12 ACs are covered** with no scope creep (frontend-only; no no-JS/SSR guarantee
  added; "recognizable + data-faithful," not engraving-grade; no editor rendering; no
  format/validator changes).

## Non-blocking notes (optional; do not gate approval)

- **N1 (cosmetic).** The existing `style.scss` `.wp-block-piano-block-piano { border:
  1px dashed; padding; color:#767676 }` currently frames the `<pre>`; after the flip it
  will frame the SVG wrapper. Not a spec violation (req 15 permits fixed color), but the
  revision/plan may want to note whether that placeholder frame stays. Surfaced, not
  required.
- **N2.** §7 says use exactly one accessible-name source (`<title>` first child, not also
  `aria-label`). Good — keep it; just ensure the plan doesn't set both.

---

## Bottom line

Fix change #1 (the invalid-JSON `<!--` escape) and the design clears the bar. Everything
else — architecture, substrate, glyph strategy, the engine algorithms, robustness,
accessibility, testing — is well-reasoned, codebase-accurate, and feasible for the plan
and code phases.
