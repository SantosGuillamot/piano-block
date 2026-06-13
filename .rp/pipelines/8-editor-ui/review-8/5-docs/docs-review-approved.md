# Review 8 — Docs review (iteration 2): APPROVED

**Verdict:** APPROVED
**Iteration:** N=2 (re-review after the iteration-1 rejection + fix)
**Scope reviewed:** the single accuracy defect from iteration 1 and any ripple, plus a
high-level re-confirmation that the rest (D1–D5, scope discipline) is intact. Verified
against the live `README.md` and the shipped source tree.

## The iteration-1 defect is fixed

**Defect (iteration 1):** `README.md:143` (the `src/editor/` file-layout row) called
`src/editor/emit.js` "the SVG-emit helper" — false. The file is the inspector
omit-helper module and contains no SVG code; the actual SVG-emit layer is
`src/notation/svg.js`.

**Fix commit `0e09083`** ("Correct the emit.js role in the README file layout
(doc-writer)") changes `README.md:143` to read:

> …the invalid-state fallback, **the shared inspector omit helpers (`omitEmpty` /
> `omitFalsy` in `emit.js`)**, and the reused leaf field-editors…

This is now accurate and matches the shipped file:

- `src/editor/emit.js` exports exactly `omitEmpty` and `omitFalsy`; its docblock opens
  "Shared emit helpers for the canvas-first inspector panels." It contains **zero** SVG
  code. The new wording matches the role precisely (and is the wording the iteration-1
  rejection itself proposed).
- The false "SVG-emit helper (`emit.js`)" phrase is gone. Grep of `README.md` for
  "SVG-emit" now returns a **single** hit — `README.md:149`, correctly describing
  `src/notation/svg.js` as "the thin SVG-emit layer that turns the model into an `<svg>`
  DOM tree." The two-conflicting-claims problem is resolved; there is exactly one
  SVG-emit claim and it is true.

## No regression / no ripple

`git diff 3461c0e 0e09083 -- README.md` shows **one line changed** (1 insertion, 1
deletion) — only the `emit.js` clause inside the `src/editor/` row. The fix commit
touches `README.md` only (`--stat`: `README.md | 2 +-`). No other README prose, no
`docs/song-format.md`, no `AGENTS.md`, no source/test files changed. Everything
iteration 1 verified is therefore byte-identical and remains valid:

- **D1 (R5):** no "no new runtime dependency" / ajv-"first" phrasing; `@wordpress/icons`
  acknowledged as a bundled runtime dependency; zero-dependency validator narrative
  intact.
- **D2 (R8):** no dead `interactive` / `hit-rect` references remain.
- **D3 (file-layout accuracy):** the only changed claim is the `emit.js` one, now TRUE;
  the rest of the row (StructureTree, SongCanvas display-only, removed StructureList,
  inspector panels, selection helpers, accessible-name moved to `src/song/`) is
  unchanged and was verified accurate in iteration 1.
- **D4 (R1/R2):** still a correct no-op (no keyboard/accessible-name tree claim added).
- **D5:** `docs/song-format.md` and `AGENTS.md` unchanged.
- **Scope discipline:** no pipeline internals (`.rp/`, task IDs, `R#`/`O#`/`AC#`/`KD`,
  "review N") in shipped README text; song format / front-end behavior described as
  unchanged.

## Summary

The lone blocking accuracy defect is corrected with a precise one-line edit and no
collateral changes. `README.md:143` now describes `src/editor/emit.js` accurately as the
shared inspector omit helpers (`omitEmpty` / `omitFalsy`), the sole SVG-emit claim
correctly belongs to `src/notation/svg.js`, and all previously-approved content is
intact. The documentation is accurate and complete. **APPROVED.**
