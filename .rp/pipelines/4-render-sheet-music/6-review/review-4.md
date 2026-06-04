# Phase 6 — Review 4 of PR #6

**PR:** [#6 — Render the Piano block's song as sheet music (grand staff)](https://github.com/SantosGuillamot/piano-block/pull/6)
**Branch:** `worktree-4-render-sheet-music` · **Issue:** #4 · **Reviewer:** owner
**Builds on:** review-1 … review-3. Two spacing refinements.

## Findings

**R4-1 — Move a measure's opening notes further left, reserving room only for an accidental if the note has one.**
- **Where:** `src/notation/layout.js` packing + system walk; `BARLINE_POST_PAD`.
- **Cause:** review-2 left a fixed ~1.4 sp gap after every barline, so opening notes sat too far right whether or not they had an accidental.
- **Fix:** reduced the post-bar gap (`BARLINE_POST_PAD` 1.4 → 0.8) so a plain opening note hugs the measure's left edge, and added an **accidental-conditional leading inset** (`ACCIDENTAL_LEAD_EXTRA`): when the opening note of either hand actually draws an accidental (`firstColumnHasAccidental`, via `resolveAccidental`), the note shifts right just enough for the accidental glyph to occupy the freed space. A whole-measure single note (which is centered) needs no inset. The two leading insets (this one + the review-2 section-change reserve) are now tracked separately so the accidental room applies even to a system's first measure, where the section reserve does not.
- **Verified:** a sharp-opening measure insets its note by exactly the accidental room; the same measure without the sharp hugs the barline.

**R4-2 — Move the dynamics (mf / p) a bit lower.**
- **Where:** `src/notation/svg.js` › `renderHandText`.
- **Cause:** dynamics were at Y = 2 below the staff bottom, so the bold-italic glyphs rose across the staff's bottom line.
- **Fix:** set the dynamic baseline to Y = 3.5, so the glyphs sit fully **below** the staff (in the gap between the hands).

## Resolution

| ID | Owner's point | Location | Status |
|----|---------------|----------|--------|
| R4-1 | Opening notes left; accidental room only when present | `layout.js` walk + `BARLINE_POST_PAD` / `ACCIDENTAL_LEAD_EXTRA` | ✅ Fixed |
| R4-2 | Dynamics a bit lower | `svg.js renderHandText` | ✅ Fixed |

**Verification:** 265 unit tests pass (2 added: accidental-conditional opening inset, dynamics below the staff), `npm run build` + Biome clean. A headless render confirms plain opening notes hug the left, a sharp-opening measure leaves room for just the accidental, and the dynamics sit clearly below the staff.
