# Doc Plan Review

## Verdict: approved

## Summary

The doc plan is correct, complete, and appropriately small for a pure
rendering-output removal. Its central claim — that no shipped, user-facing
documentation describes or depends on the measure-number label — I verified
independently with an end-to-end sweep of every doc surface outside
`node_modules/`, `.git/`, and `.rp/`, and it holds. The sole task is a
drift-guard verification with a named audience, concrete and existing file/section
references, clean traceability to spec requirements and the code plan, and
evaluable, drift-resistant acceptance criteria. It correctly defers all stale
source comments/JSDoc to the code phase (they are code surfaces, owned by code
Task 5), introduces no code work, and honors the project convention that shipped
docs must not reference the internal pipeline or `.rp/` artifacts. No missed
surface and no real defect was found.

## Independent sweep (verification of the plan's coverage claim)

I swept all shipped/user-facing surfaces and confirm none carries a now-stale
reference to the removed measure-number label:

- **`README.md`** — zero matches for "number" anywhere; every "measure" reference
  (line 158) is the song-format `measure`/bar concept. "What the block does today",
  "What the front end shows" (§4), and "Forthcoming" describe the rendered grand
  staff and its elements (tempo, gradual dynamics, etc.) but never the line-start
  number label. The three sections the task names all exist. No stale prose.
- **`docs/song-format.md`** — every "measure" match is the format's bar/`measures`
  structure (barlines, events, measure-level annotations); every "number" match is
  a value type (bpm, octave, beat) or a notation domain convention. No reference to
  a rendered measure-number label. The intro/mental-model and gradual-dynamics
  sections the task names both exist.
- **`src/block.json` / `package.json` descriptions** — neither mentions measure
  numbers (block description is about storing a song and rendering sheet music;
  package description is the plugin scaffold blurb).
- **`specs/editor.spec.js`, `specs/render.spec.js`** — the only "number" hits are
  "the number of stacked systems" (responsive wrapping count, `render.spec.js:17`,
  `:187`) and a `@return {Promise<number>}` JSDoc; "measure" hits are all the bar
  concept / `data-measure` / fixture comments. No measure-number-label assertion or
  reference exists, so the removal disturbs no e2e assertion. Matches the plan.
- **`AGENTS.md`** — contributor/agent guidance; no measure-number reference, and it
  is the source of the very convention (keep `.rp/` workflow references out of
  shipped docs) that Task 1's Constraint enforces.
- **`.rp.md`, `src/notation/OFL.txt`** — pipeline-internal and a third-party font
  license respectively; neither carries notation prose referencing the label.
- **CHANGELOG / readme.txt / CONTRIBUTING / `.github/`** — confirmed absent from the
  repo, as the plan states.
- **Source files** (`layout.js`, `svg.js`, `constants.js`, `layout.test.js`) — the
  only repo-wide "measure number" matches outside `.rp/`. These are code surfaces
  (inline comments / JSDoc / the constant / a test), correctly owned by the code
  plan, not duplicated here.

The plan's "single verification task" shape is justified: the sweep genuinely shows
no user-facing doc references the label, so a recorded no-op guard is the correct
and sufficient doc deliverable.

## Notes (non-blocking, no change required)

- The Overview parenthetical and the final bullet of "Surfaces swept" carry a
  slightly stale cross-phase aside — they describe the three `layout.js` comments at
  `:1417`/`:1712`/`:2135` as possibly falling "outside its current task scope" of
  the code plan, whereas the approved code plan's Task 5 now explicitly owns them.
  This is descriptive prose in a note to the orchestrator, not a doc task, and it
  does not change what any doc-writer executes (Task 1 touches no source comment).
  It is cosmetic and does not warrant rejection; the actual task is clean.
