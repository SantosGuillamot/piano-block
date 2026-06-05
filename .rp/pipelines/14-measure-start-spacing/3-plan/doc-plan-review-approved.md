# Doc Plan Review

## Verdict: approved

## Summary

The revised plan fully resolves the single substantive gap that drove the
iteration-1 rejection, and an independent adversarial re-sweep of the shipped
documentation surfaces turns up no other stale narrative the feature would leave
out of sync. The new Task D2 claims the `ACCIDENTAL_LEAD_EXTRA` doc-comment
(`src/notation/constants.js:139-145`) — the one piece of narrative prose the
larger-of composition falsifies — and scopes it cleanly: it edits only that
comment block, leaves the value/name/code untouched, forbids duplicating T1's
`MEASURE_START_PAD` comment (allowing only a bare cross-reference, mirroring the
existing `BARLINE_POST_PAD` idiom), depends on the code phase landing first, and
honors the `AGENTS.md` no-`.rp/`-references rule, with five evaluable,
drift-resistant acceptance criteria. The Overview's previously-wrong "fully
authored by the code phase" sweep claim is corrected: it now explicitly names the
`ACCIDENTAL_LEAD_EXTRA` comment as the one narrative surface the feature
falsifies, states the code plan does not own it, and assigns it to D2. The code
plan was confirmed to reference `ACCIDENTAL_LEAD_EXTRA` only as the `max()` input
local (T3) and as an Overview geometry fact — it never touches the `:139-145`
doc-comment block — so D2 introduces no duplication or conflict. D1 remains sound:
verify-only, audience-named, traceable, drift-resistant, and the
`docs/song-format.md` `beat`/left-edge author-anchor prose it owns survives the
lead-in unchanged ("near the measure's left edge" is an anchor mental model, not a
flush-boundary claim). The plan stays proportional to a sub-staff-space internal
rendering refinement and invents no documentation the spec does not ask for.

## Issues

None. Both iteration-1 issues are resolved:

- **Iteration-1 Issue 1 (unowned stale `ACCIDENTAL_LEAD_EXTRA` comment)** —
  resolved by new Task D2, which owns refreshing the `constants.js:139-145`
  comment so it no longer claims a plain opening note "hugs the boundary" or that
  an accidental opening note "shifts right" relative to a hugging note, instead
  describing `ACCIDENTAL_LEAD_EXTRA` as the accidental's share of the opening slot
  composed with the uniform lead-in by the larger-of rule. Scope, dependencies,
  no-`.rp/` constraint, value/code immutability, and non-duplication of T1 are all
  pinned, and the acceptance criteria are evaluable and consistent with spec AC3
  and AC7.

- **Iteration-1 Issue 2 (Overview overstated its sweep)** — resolved: the Overview
  no longer asserts the feature's only surfaces are inline comments "already fully
  authored by the code phase." It now enumerates the `ACCIDENTAL_LEAD_EXTRA`
  comment as the one narrative surface that goes stale, states the code phase does
  not own it, and assigns ownership to D2.

Independent re-sweep of non-`.rp/` shipped surfaces (`README.md`,
`docs/song-format.md`, `src/render.php`, `specs/render.spec.js`, and the
`src/notation/` comments) found no other prose that names the affected behavior
and would ship stale: the `README.md`/`src/render.php` matches are the unrelated
script-breakout escape; `specs/render.spec.js`'s "leading reserve carrying BOTH
clefs" describes the clef `RESERVE_PAD`/`[data-reserve]`, not the measure lead-in,
and remains accurate; and `docs/song-format.md`'s `beat`/left-edge passages are
the author-anchor prose D1 already owns and correctly judges drift-free.
