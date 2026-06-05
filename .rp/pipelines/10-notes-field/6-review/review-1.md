# Review 1

Post-PR review round on PR #12 (issue #10, the `notes` annotation feature), worked **assisted** on the pipeline branch `worktree-10-notes-field`.

## Feedback (verbatim)

- Should we change the "notes" property to something different? It can be confused by a music note.
- Right now, the bottom notes overlap with the dynamic. Make it show below it.

## Decisions taken with the owner

- The property is renamed to **`annotations`** (owner's choice among annotations / markings / labels / texts).

## Current behaviour

1. **Naming.** The author-facing property is `notes` (`event.notes`, `measure.notes`), backed by the `eventNote` / `standaloneNote` schema `$defs`, the internal text primitive `kind: "note"`, the model field `standaloneNotes`, and the rendered `data-text="note"`. "note" collides with the musical sense (a notehead/pitch), which the codebase ALSO uses heavily (`data-kind="note"`, `layoutHand`'s internal `notes` of laid-out noteheads). Confusing for authors and contributors alike.

2. **Below-staff overlap.** Dynamics render at local baseline `y = 3.5` below the staff (`svg.js`, `DYNAMIC_SIZE = 2.8`). A below-placement annotation on a hand that has a dynamic dodges to `DYNAMICS_LANE_RESERVE = 4.5` — only **1 sp** below the dynamic's baseline, while each glyph is ~2.8 sp tall. So the integration's dodge cleared the *baselines* but not the glyph *bodies*: the annotation visually overlaps the dynamic.

## Plan

1. **Rename `notes` → `annotations`, applied consistently** and ONLY to the annotation feature (never the musical notehead vocabulary):
   - Schema: `event.annotations` / `measure.annotations`; `$defs` `eventAnnotation` / `standaloneAnnotation`.
   - Renderer/layout: internal `kind: "annotation"`, `data-text="annotation"`, model field `standaloneAnnotations`, helper `collectStandaloneAnnotations`, lane key `annotationAboveRHLaneY`, and related identifiers.
   - Preserved unchanged: `data-kind="note"` (noteheads), `layoutHand`'s internal `notes` (noteheads), pitch/notehead prose.
   - Docs (`docs/song-format.md`, `README.md`) + all unit/e2e tests updated; the one migration line still teaches `chordSymbol` → the new `annotations` shape.
2. **Below annotations sit a full text-lane below the dynamic.** Raise the below-band dynamics dodge so the annotation's top clears the dynamic's body: `DYNAMICS_LANE_RESERVE` 4.5 → **6.9** (= dynamic baseline 3.5 + one `STACK_STEP` of 3.4). This also still clears the hairpin lane (lower edge 3.5). **Tunable next round** if the owner wants it tighter/looser.
3. Update the dodge tests to assert the annotation's baseline is at least one `STACK_STEP` below the dynamic baseline (clears the glyph, not just the baseline). All gates (unit + e2e + Biome + build) green.

## Result

Implemented on the branch (uncommitted pending owner review).

1. **Rename `notes` → `annotations`** applied across schema (`event.annotations`, `measure.annotations`, `$defs` `eventAnnotation`/`standaloneAnnotation`), layout/renderer (`kind: "annotation"`, `data-text="annotation"`, `standaloneAnnotations`, `collectStandaloneAnnotations`, `annotationAboveRHLaneY`, reads `event?.annotations`/`measure?.annotations`), all unit + e2e tests, and docs (`docs/song-format.md` "Annotations" section + migration line + annotated example; `README.md`). Musical notehead vocabulary (`data-kind="note"`, `layoutHand`'s internal `notes`, pitch prose) deliberately preserved.
2. **Below-annotation overlap fixed**: `DYNAMICS_LANE_RESERVE` 4.5 → **6.9** (dynamic baseline 3.5 + one `STACK_STEP` 3.4), so a below-placement annotation sits a full text lane below the dynamic — its top clears the dynamic glyph body. Still clears the hairpin lane (3.5). Tunable.

**Verification (clean):** unit 360/360, Biome clean, build compiles, e2e 18/18. (Note: a stale local mirror `const DYNAMICS_LANE_RESERVE = 4.5` in the layout test was updated to 6.9; two notehead `laidOut` fixtures wrongly caught by the rename were reverted.)

**Tunable for next round:** `DYNAMICS_LANE_RESERVE` (6.9) if the below gap should be tighter/looser.
