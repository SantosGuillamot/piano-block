# Docs review — REJECTED (iteration 1)

**Pipeline:** `4-render-sheet-music` (issue #4 — render the Piano block's song as visual sheet music).
**Batch reviewed:** full docs batch D1–D4 (commits `744c6fa` D1, `185dbff` D2, `982297d` D3, `2251215` D4).
**Base ref:** `trunk`. Diff: `git diff trunk...HEAD -- README.md docs/song-format.md src/block.json`.

**Verdict: REJECTED.** One blocking accuracy defect in **D3**. D1, D2, and D4 pass and are not re-dispatched. Re-dispatch **D3 only**.

---

## Flagged tasks

### D3 — README "For contributors" render-contract paragraph: the `<` escape is mistyped as a bare `<`

**File:** `README.md:162` (the "Render contract — a container carrying an inert JSON `<script>`" subsection, second paragraph — the script-breakout-escape explanation).

**What's wrong (factually false against the shipped code).** The paragraph must document the script-breakout escape that `render.php` performs, which is replacing every `<` with the **literal 6-character JSON unicode escape `<`**. The README instead writes the *result/replacement* value as a **bare less-than character `<`** in two inline-code spans, so it reads as "escapes `<` to `<`" — a no-op that is both nonsensical and contradicts the code.

The shipped code is unambiguous:
- `src/render.php:39` — `$escaped_song = str_replace( '<', '<', $song );` (the replacement is the string `<`).
- `src/render.php:15–17` (comment) — "escape the leading `<` of every such sequence as the JSON unicode escape `<` … `<` is a legal JSON escape for `<`".
- `specs/render.spec.js:502–503` — asserts the emitted output contains `\\u003C/script>` and `\\u003C!--` (i.e. the literal `<`).

The two wrong spans on `README.md:162` (both name the **result** of the escape, which must be `<`, not `<`):
1. "…replaces every `` `<` `` in the song with the JSON unicode escape `` `<` ``…" — the **second** code span (the escape value) must be `` `<` ``. (The first span, "every `` `<` `` in the song", is correct — it names the source character being replaced.)
2. "Escaping the leading `` `<` `` as `` `<` ``…" — the **second** code span (the result) must be `` `<` ``. (The first span, the leading `<` being escaped, is correct.)

Two other inline-code uses on the same line are **correct and must stay as-is**: the prose `` `&lt;` `` (intentionally showing the WRONG output `esc_html`/`htmlspecialchars` would produce — an HTML entity that survives literally and breaks `JSON.parse`), and `` `<\/` `` / `` `<\!--` `` (the rejected alternative escape forms). Do not touch those.

**What the Acceptance requires (doc-plan D3, lines 234 and 205–206):** "the `<` escape (and why `esc_html` is wrong) — with no remaining 'verbatim escaped `<pre>` passthrough' claim." The "why `esc_html` is wrong", the ETAGO/`<!--` rationale, the `<\!--`-is-invalid-JSON note, and the lossless round-trip are all present and correct; only the escape *value itself* is mistyped. Fix: change the two result-naming code spans from `` `<` `` to `` `<` `` so the doc states the escape the code actually emits.

**Scope of the fix:** a two-character correction within `README.md:162`. No other part of D3 (file-layout table, tests paragraph, "exercising the renderer" note, the no-library/own-engine framing, the font/OFL attribution) needs changing — those were verified accurate (see below).

---

## What was verified and PASSED (not re-dispatched)

### D1 — README user-facing sections (`744c6fa`)
- **Status blockquote** (`README.md:5`), **"What the block does today"** (`:13`, `:15`), **"### 4. What the front end shows"** (`:45–55`), **"Forthcoming"** (`:170–176`), and the **"Building & installing" success sentence** (`:93`) all now describe the frontend rendering a conformant song as a braced grand-staff SVG drawn by the plugin's own code. No remaining "as escaped text" / "as text in a `<pre>`" / "v1 does not render musical notation" framing.
- The three display states are stated (`:51–53`): conformant → sheet music; empty/whitespace → nothing; non-renderable → nothing, **no raw-JSON echo and no error message**.
- The editor is correctly described as unchanged (raw-JSON field + non-blocking validation, no in-editor preview).
- "Visual notation rendering" was removed from "Forthcoming"; audio playback, visual authoring UI, and richer notation elements remain.
- **Scope-guard sweep clean:** no in-editor preview, no notation library (states "no third-party notation library"), no theme-adaptive color, no audio/playback/interactivity claimed present, and the title/composer guard is explicitly honored (`:55` — "no visible title or composer heading … `metadata` is used only to label the notation for assistive technology"), matching `src/view.js:57–81`.

### D2 — docs/song-format.md intro framing (`185dbff`)
- The full `git diff trunk...HEAD -- docs/song-format.md` touches **only** the "Intro and mental model" paragraph (line 9). Every format-spec section ("Top-level shape", "metadata", "defaults and sections", "measures", "tempo and timeSignature", "Per-hand context", "Events", "Pitches", "Note-name systems", "Barlines and repeats", "Additive growth", "Annotated example song") is **byte-identical to trunk**. No format definition, field, value, range, inheritance rule, or the annotated example was altered.
- The new intro correctly distinguishes the editor (still no visual notation *editor* — raw JSON by hand) from the frontend (now renders notation), and audio is still correctly future work.
- The cross-reference link `../README.md#4-what-the-front-end-shows` resolves to D1's renamed heading `### 4. What the front end shows` (GitHub slug `4-what-the-front-end-shows`).

### D3 — the rest of "For contributors" (`982297d`) — PASSES apart from the flagged escape typo
- **File-layout table** (`README.md:112–123`): `src/render.php` row = container + inert JSON `<script>`, no `<pre>` (matches `render.php`); added rows for `src/view.js`, `src/notation/` (layout.js/svg.js/glyphs.js/constants.js + the bundled `pb-music.woff2` and `OFL.txt`, "subsetted, renamed Bravura under SIL OFL 1.1"), `src/notation/__tests__/`, and `src/song/normalizeStep.js`. All files exist on disk and match.
- **Render-contract paragraph** (`:160–162`): container + inert JSON `<script>` transport, PHP does no validation (frontend owns render-or-nothing), empty/whitespace → nothing (no wrapper), and the "why `esc_html` is wrong" rationale — all correct against `render.php`. (The escape-value typo is the sole defect; see flagged section.)
- **Tests paragraph** (`:166`): SVG-based frontend behavior (conformant → `<svg role="img">` grand staff, raw JSON not shown; empty → nothing; non-renderable → nothing, no raw echo/no error; hostile text inert via SVG `textContent`) plus the new `src/notation/__tests__/` unit suite and unchanged editor tests — matches `specs/render.spec.js` and the `__tests__/` layout.
- **"Exercising the renderer" note** (`:164`): present, links to `docs/song-format.md#annotated-example-song`.
- Renderer described as the plugin's **own** code, explicitly **not** a third-party notation library, with the font as a bundled **asset** — no per-function/symbol-level API transcription.

### D4 — src/block.json description (`2251215`)
- `description` (`src/block.json:9`) now states the block "renders it as piano sheet music on the frontend. Audio playback is future work." Visual notation is no longer called future work; audio still is. Only the `description` value changed (the `viewScript` line was added by code task T10, `cd7c332`, not by this doc commit). `block.json` is valid JSON.

---

## Cross-cutting checks
- **Stale-claims sweep:** every entry in the doc-plan "Stale claims inventory" is fixed. The only remaining "verbatim"/`<pre>` mentions are legitimate (the "stored verbatim" author-text guarantee at `README.md:142` and `song-format.md:232`, and the contrastive "no `<pre>`" / "old `<pre>` escaping" in the render-contract context).
- **No false / scope-guard-violating claims** introduced (no in-editor preview, no library, no no-JS guarantee, no theme color, no visible title/composer heading, no raw-JSON echo/error, no audio/interactivity-as-present).
- **Song format unchanged** (D2 verified byte-identical outside the intro).
- **Links/anchors resolve** (README internal anchors and the song-format cross-reference all map to existing headings).
- **No collateral damage:** D1/D3 edited disjoint README sections; only `README.md`, `docs/song-format.md`, `src/block.json` changed in these four commits.
- **`npm run check` is clean** (`biome check --write .` → "Checked 22 files … No fixes applied").
- **`src/block.json` is valid JSON** (parsed successfully).

---

**Re-dispatch:** D3 only — correct the two result-naming inline-code spans on `README.md:162` from `` `<` `` to `` `<` `` so the documented escape matches `render.php` (`str_replace( '<', '<', $song )`). Leave the intentional `` `&lt;` `` and `` `<\/` `` / `` `<\!--` `` spans untouched.
