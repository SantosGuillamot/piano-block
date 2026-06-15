# Spec Review

## Verdict: approved

## Summary

The revision genuinely resolves all four items from the prior rejection, and a fresh adversarial pass surfaces no new blocking problem. The spec remains complete, internally consistent, WHAT-not-HOW, and keeps the WordPress Interactivity API as a constraint (Requirement 12) rather than a design. I re-verified feasibility against the codebase: `view.js:94` and `SongCanvas.js:120` both call the same `renderInto(container, model, { accessibleName })`; `noteNames.js` `stepInSystem` produces the bare step from `step` alone (no accidental, no octave); the schema's `event.type` enum is only `["note","rest"]` and a `note` requires non-empty `pitches`; `render.php` emits nothing for an empty/whitespace song; and there are two independent sources of a sharp/flat (per-note `pitch.alter` and the per-hand `handConfig.alters` map, `docs/song-format.md:417`).

How the prior issues were addressed:

- **Issue 1 (weakened byte-identical bar) — resolved.** AC10 (lines 136–141) now states the strong, machine-checkable guarantee in Given-When-Then form: with names not requested, the frontend output is byte-identical to today's output, and the editor canvas renders byte-identical to the names-off frontend. The fuzzy "unchanged from today" wording is gone; the criterion now asserts string equality and explicitly disallows added/removed/changed markup when names are off.
- **Issue 2 (AC10 conflated two guarantees) — resolved.** The two guarantees are split: AC10 carries the default-off / editor-equivalence byte-identity (and now asserts the *equivalence* between the two surfaces, not merely each separately), and AC11 (lines 143–146) carries the standing editor-scope guarantee ("no toggle, no names on the editor canvas, ever," including when another block has names on).
- **Minor note A (AC3 alter-source ambiguity) — resolved.** AC3 (line 102) now states the name is the bare step whether the sharp comes from `pitch.alter` or from the inherited `handConfig.alters` map, with the visible glyph unaffected.
- **Minor note B (AC2/AC6 overlap) — resolved.** AC2 (line 94) and AC6 (line 119) now cross-reference each other, making the single-cycle restoration vs. N-cycle no-drift distinction explicit.

The spec also reads cleanly on its own merits: per-instance independence (Req 6 / AC4), default-OFF (Req 3 / AC1), system-follows-song (Req 4 / AC3), coverage across both staves / chords / ties / rests with every conformant note nameable (Req 5), reversibility/idempotency (Req 7 / AC6), translatable label (Req 8 / AC8), resize survival (Req 9 / AC7), legibility as the observable bar with placement deferred to design (Req 10 / AC13, Out of Scope), and the three gating states each have an AC (AC9 no-nameable-notes, AC12 empty/invalid). All acceptance criteria are testable.

## One correction to make in the design/code phase (non-blocking — does not affect any requirement)

The spec describes the byte-identical guarantee as "a string-equality guarantee an existing unit test enforces" (Constraint 13, line 68) and "the existing editor-canvas / frontend SVG string-equality is preserved" (AC10 parenthetical, line 140). On inspection, the guarantee is real and documented (`README.md:179`, `README.md:231`) and holds **by construction** — the editor canvas and the frontend call the identical shared `renderInto` in `svg.js`, exercised by `src/notation/__tests__/svg.test.js`. But there is **no** test that renders both surfaces and string-compares their SVG output; no test file imports both `SongCanvas` and the frontend path, and `svg.test.js` / `layout.test.js` contain no cross-surface equality assertion. (This overstated framing originated in the prior review and was carried into the revision.)

This is not a flaw in the requirement. The observable bar AC10 sets — the two outputs must be byte-identical — is correct and testable regardless of whether such a test exists today; if anything the revision now *invites* that test to be written, which is good. The only fix needed is factual: the design/code phase should not go hunting for a pre-existing two-surface string-equality test (there isn't one). Either add such a test as part of this feature (a natural way to pin AC10), or rely on the shared-`renderInto` construction plus the default-off parameter. No spec change is required to approve.
