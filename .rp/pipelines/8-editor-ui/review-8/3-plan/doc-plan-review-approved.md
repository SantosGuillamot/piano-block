# Review 8 — Documentation plan review: APPROVED

The documentation plan (`doc-plan.md`) for review-8 is **approved**. It documents exactly the
doc surface that review-8's shipped code changes require — no more, no less — and every claim it
makes about the live docs is accurate and grounded. Verified against the approved spec, design
doc, code plan, and the live repo docs (`README.md`, `docs/song-format.md`, `AGENTS.md`,
`package.json`, `src/block.json`, `src/index.js`).

## Why it passes

### Completeness — every doc-affecting code change is covered

The only live doc surface review-8 moves is `README.md`; the plan establishes this correctly and
covers each affected README surface:

- **R5 dependency claim → D1.** The two phrasings the spec/code-plan target are the *only* two in
  the README: "no new runtime dependency" (line 143) and "ajv would be the editor bundle's
  **first** runtime dependency" (line 179). Grep confirms these are the sole matches. D1 correctly
  (a) drops the "no new runtime dependency" claim, (b) stops calling ajv the "first" dependency,
  (c) **adds** an explicit acknowledgment of `@wordpress/icons` as a bundled `@wordpress/*` runtime
  dependency (the README names it nowhere today — zero grep hits — so an addition, not just a
  deletion, is required), and (d) keeps the validator's zero-dependency / "no `ajv`" / schema-as-
  data narrative intact (it is about the validator, and stays true). The acceptance cross-checks
  `package.json` (`@wordpress/icons ^10.32.0` is present) without editing it.

- **R8 README tail (dead `interactive` hit-rect) → D2.** Grep confirms the three README surfaces
  the plan names are the complete set: the `src/notation/` file-layout clause (line 148), the
  "now-dormant `interactive` hit-rect" `###` section (heading line 158, body line 160), and the
  Tests clause (line 201). D2 removes all three, deletes the `###` heading, and keeps the
  "byte-identical front end" point as an **unconditional** statement (the qualifying "passes **no**
  flag" framing is dropped). No internal anchor links to the dormant heading (verified), so its
  removal breaks no cross-reference. The acceptance cross-checks the shipped `src/notation/svg.js`
  and `constants.js` for the absence of `interactive`/`hitRect`/`HIT_RECT_*`.

- **R3 / R9 / R12 file-layout + build-model reconciliation → D3.** The plan reconciles the build-
  model SCSS bullet (line 131, verified verbatim) and the file-layout rows for the reshaped tree:
  `src/block.json` (140), `src/index.js` (141), `src/style.scss` (145) + a new `src/editor.scss`
  row, the `src/editor/` helper-enumeration prose (143), the new `src/song/accessibleName.js` added
  to the `src/song/` grouping (rows 150-153 today list `normalizeStep.js`/`schema.js`/`validate.js`),
  and `src/notation/dom.js` added to the `src/notation/` row (148). Every cited line number matches
  the live README. The pre-review state the plan assumes is verified: `block.json` wires only
  `"style"` (no `editorStyle`) today; `index.js` imports only `./style.scss`; `src/editor/
  accessibleName.js` and `src/editor/inspector/emit.js` exist today while the post-review
  `src/song/accessibleName.js`, `src/notation/dom.js`, and `src/editor/emit.js` do not yet. The
  acceptance cross-checks the shipped `block.json`/`index.js`/tree paths and the `npm run build`
  artifacts.

- **R1 / R2 keyboard + accessible name → D4 (verify-and-only-if-needed gate).** Correctly posed as
  a verification gate. Grep confirms the README's "Using the Piano block" workflow describes the
  tree as "expandable and collapsible" (line 29) and makes **no** keyboard-specific or accessible-
  name claim, so there is nothing to reconcile — the gate's expected outcome is no edit. D4 also
  correctly notes the `StructureTree` docblock's false "Left/Right works for free" claim is **code**
  (out of scope here).

### Accuracy & groundedness — the no-op gates are justified, not assumed

- **D5 song-format.md gate.** A grep of `docs/song-format.md` for every review-8-relevant term
  (`interactive`, `hit-rect`, `@wordpress/icons`, `runtime dependency`, `editorStyle`,
  `editor.scss`, `emit.js`, `accessibleName`, `notation/dom`, `src/…` paths) returns **zero**
  matches — the author-facing format reference names none of the surfaces review-8 touched. No edit
  is justified.

- **D5 AGENTS.md gate.** `AGENTS.md` (599 bytes) contains only pipeline-hygiene guidance ("keep the
  development workflow out of shipped artifacts"); it has no file-layout table, no architecture or
  dependency claims, and no reference to the `interactive` feature or the CSS/helper layout.
  Verified by reading the file in full. No edit is justified.

### Task quality

Every task carries Goal / Audience / Files / Sections-scope / Depends on / Traces to / Acceptance,
and each Acceptance verifies the doc against the **shipped code** (cross-checking `package.json`,
`block.json`, `index.js`, the `src/` tree, and the build artifacts), not merely the prose.

### Ordering avoids collisions

- **D2 before D3** on the shared `src/notation/` row (148): D2 drops the `interactive` clause, D3
  then adds `dom.js` to that same row — sequenced so both land cleanly in the final row.
- **D1 and D3 are disjoint** on the `src/editor/` row (143): D1 owns the dependency parenthetical;
  D3 only edits the helper-enumeration prose. The plan states this division explicitly.

### Scope discipline

- Code-phase R18 work (in-code docblocks/comments/provenance sweep, including the StructureTree
  keyboard docblock) is correctly **excluded** from the doc plan.
- The song format / `render.php` / front-end behavior (unchanged, byte-identical) is not documented
  as a change; D5 confirms the no-op.
- The deferred Optional items (ToolsPanel-inside-PanelBody; dashed placeholder border) are not
  documented as changes.
- `package.json` is not edited (D1 cross-checks it only).
- The `src/view.js` row (147, "computes the accessible name") is correctly left untouched: after
  R9, `view.js` still *computes* the accessible name (it imports the relocated helper and calls
  it) — the row describes behavior at an altitude that the helper's move does not change.
- The plan's **Traces to** fields are planning-only, and the plan explicitly forbids any pipeline
  reference (`.rp/`, task IDs, `R#`/`O#`, `AC#`, `T#`, "review N") in shipped doc text; since
  review-8's doc work touches only `README.md` (which carries no pipeline tags today), this is a
  guard, not an expected edit.

## Verdict

**APPROVED.** No blocking issues. The plan is complete, accurate, well-scoped, and correctly
ordered; its no-op gates are independently verified against the live docs.
