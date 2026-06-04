# Docs review — APPROVED

**Pipeline:** `4-render-sheet-music` (issue #4 — render the Piano block's song as visual sheet music).
**Batch:** full docs batch D1–D4 (D1 `744c6fa`, D2 `185dbff`, D3 `982297d` + D3 fix `5f1aa92`, D4 `2251215`).
**Base ref:** `trunk`. Current tip: `5f1aa92`.

**Verdict: APPROVED.** This clears the N=1 rejection (`docs-review-1-rejected.md`), which flagged D3 only. The single blocking defect has been fixed; no regression.

---

## Clears the N=1 rejection — D3 escape-value fix verified

The N=1 rejection flagged the render-contract paragraph (`README.md:162`) for naming the script-breakout escape's **result** as a bare `<` instead of the literal 6-character JSON unicode escape `\u003C`, in two inline-code spans. The fix commit `5f1aa92` ("Correct render-contract escape token to < in README (doc-writer)") is exactly **+1/-1, README.md only** (confirmed via `git show 5f1aa92 --stat`).

Both result spans on `README.md:162` now read the literal `\u003C`, matching the shipped code `src/render.php:39` (`str_replace( '<', '\u003C', $song )`):

1. "…replaces every `<` in the song with the JSON unicode escape `\u003C` before printing…" — result span now `\u003C`. ✓
2. "Escaping the leading `<` as `<` neutralizes both breakout sequences…" — result span now `\u003C`. ✓

Untouched and still correct, as required:
- The **input** `<` spans ("replaces every `<`", "the leading `<`") name the source character — correct.
- The intentional `&lt;` span (the WRONG output `esc_html`/`htmlspecialchars` would produce, which survives literally and breaks `JSON.parse`) — intact.
- The rejected-alternative `<\/` / `<\!--` forms — intact.
- The `</` (ETAGO) / `<!--` breakout tokens, `</script>`, and the contrastive old-`<pre>` mention — intact.
- The "why `esc_html` is wrong" rationale, the ETAGO/`<!--` reasoning, the invalid-JSON note, and the lossless round-trip framing — all intact (this was the only changed line; the rest of the paragraph is byte-identical to D3's original).

Cross-checked against `src/render.php:11–20` (the same escape rationale in the source comment) and `src/render.php:39` — fully consistent.

---

## No regression from the fix

`git show 5f1aa92 --stat` = `README.md | 2 +-` (1 file changed, 1 insertion, 1 deletion) — the fix touched only the one flagged line. D1's user-facing README sections, D2's `docs/song-format.md`, and D4's `src/block.json` are unchanged from their N=1-approved state (the fix commit does not touch them).

---

## Re-confirmed cross-cutting checks (clean, as at N=1)

- **No stale claims:** every entry in the doc-plan "Stale claims inventory" remains fixed; the only surviving "verbatim"/`<pre>` mentions are legitimate (the "stored verbatim" author-text guarantee and the contrastive "old `<pre>` escaping" in the render-contract context).
- **No false / scope-guard-violating claims:** no in-editor preview, no third-party notation library (README states "no third-party notation library" / own engine), no no-JS/SSR guarantee, no theme-adaptive color, no visible title/composer heading (honored per `src/view.js`), no raw-JSON echo or error message, no audio/interactivity claimed as present.
- **Song format unchanged:** `git diff trunk...HEAD -- docs/song-format.md` touches **only** the "Intro and mental model" paragraph (line 9, D2). Every format-spec section is byte-identical to trunk.
- **Links/anchors resolve:** the song-format cross-references to `../README.md#4-what-the-front-end-shows` and `../README.md#using-the-piano-block` map to existing D1 headings; the README "exercising the renderer" link to `docs/song-format.md#annotated-example-song` resolves.
- **`npm run check` clean:** `biome check --write .` → "Checked 22 files … No fixes applied."
- **`src/block.json` is valid JSON** (parsed successfully) and only its `description` value changed vs trunk (D4).
- **Batch scope clean:** across the four doc commits + the fix, only `README.md`, `docs/song-format.md`, and `src/block.json` changed.

---

**Phase 5 (Docs) is complete and approved.** The N=1 rejection (`docs-review-1-rejected.md`) is retained as iteration history.
