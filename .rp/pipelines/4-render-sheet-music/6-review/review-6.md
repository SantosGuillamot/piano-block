# Phase 6 — Review 6 of PR #6

**PR:** [#6 — Render the Piano block's song as sheet music (grand staff)](https://github.com/SantosGuillamot/piano-block/pull/6)
**Branch:** `worktree-4-render-sheet-music` · **Issue:** #4 · **Reviewer:** owner
**Builds on:** review-1 … review-5.

## Findings

**R6-1 — Replace the song example with a clean, comment-free, copy-pasteable version.**
- **Where:** `docs/song-format.md` "Annotated example song" — it was an illustrative **JSONC** block with `//` comments (not directly pasteable into the editor's JSON field).
- **Fix:** replaced it with the owner's provided **clean JSON** (no comments; `jsonc` → `json` fence) and reworded the intro to describe it as a complete, copy-pasteable example rather than a commented listing. Validated the new song with `validateSong` → **0 errors**, and rendered it to confirm it draws correctly (tie to G5, B♯2 in the bass, A5 in section 2).
- **Note:** the owner's version drops the slur and changes a few pitches, so the docs example now **diverges** from the unit/e2e test fixtures (which keep the slur for coverage). Updated the README references that conflated the two (the example is "a broad-coverage example" with "a tie", not the literal test fixture) so nothing claims false equivalence.

**R6-2 — Make the tie and slur lines slightly more curved.**
- **Where:** `src/notation/layout.js` › `buildSpanSpec`.
- **Fix:** deepened the Bézier control-point bulge — tie 0.9 → 1.3, slur 1.6 → 2.1 — so both arc a bit more.

## Resolution

| ID | Owner's point | Location | Status |
|----|---------------|----------|--------|
| R6-1 | Clean, copy-pasteable song example | `docs/song-format.md` (+ README refs) | ✅ Fixed |
| R6-2 | Tie/slur slightly more curved | `layout.js buildSpanSpec` | ✅ Fixed |

**Verification:** the new example passes `validateSong` (0 errors) and renders correctly (headless, real font); the tie reads as a deeper curve. 267 unit tests pass, `npm run build` + Biome clean.
