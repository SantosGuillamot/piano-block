# Design-doc review — review-2 (editor UI): APPROVED

**Verdict:** Approved.
**Reviewer:** design-doc-reviewer (review-2).
**Artifacts reviewed:** `2-design-doc/design-doc.md`, `2-design-doc/design-doc-research.md`,
`1-spec/spec.md`, and the live `src/` code (selection/emit/edit/schema/validate/panels).

The design is complete against the spec, sound on the selection-fix crux, and holds
the format boundary. Every load-bearing claim was checked against the live code and
matched. Approving.

## Coverage — every Requirement and AC is addressed

The doc's own coverage table maps all 19 Requirements and 15 ACs to a decision
(KD1–KD5). I spot-verified the load-bearing ones; none is missing or hand-waved:

- Selection (Req 1–3 / AC1–AC2) → KD1.
- Add/remove note (Req 4–5 / AC3–AC4) → KD2.
- Structure view (Req 6–9 / AC5–AC8) → KD3.
- Language (Req 10–14 / AC9–AC11) → KD4.
- Boundary + carry-overs (Req 15–19 / AC12–AC15) → KD1/KD4 boundary + KD5 audit.

## Selection fix (the crux) — sound and genuinely editor-only

- **Root cause is real, not padded.** Verified against the live code: a note `<g>`'s
  only ink is `<line data-stem>` + `<ellipse data-notehead>` (`svg.js` `renderNote`
  ~`:704`, `renderRest` ~`:844`); the group has no intrinsic hit geometry, and
  `selectionFromTarget` resolves via `target.closest('[data-kind]')`
  (`SongCanvas.js:110`). A gap click lands on staff lines / SVG root (outside any
  `[data-kind]`) → `null` → deselect. Confirmed there is **no** `pointer-events` rule
  in `src/` (grep: zero hits) and `__canvas-actions` is a sibling `<div>`, not an
  overlay — so the gap genuinely *is* the bug, and the ruled-out causes (Gutenberg
  interception, CSS, listener lifecycle) are correctly excluded.
- **The fix addresses that root cause.** A per-event filled-transparent `<rect>` as
  first child of the event `<g>` makes the whole column a pointer target;
  `target.closest('[data-kind]')` walks up from the rect to the `<g>`. The hittability
  detail is correct (`fill:none`/`visibility:hidden` are not hit targets; filled
  transparent is). First-child + no `data-*` is justified: paint order puts the rect
  above the staff lines but under the ink, and the attribute-free rect cannot duplicate
  `selectionQuery`'s `[data-hand][data-event-index]` match (`selection.js:149`), so
  `decorateSelection`/`selectionQuery` need no change and `is-selected` always lands on
  the `<g>`. AC2 still holds: the rect covers only a ~2sp×(4+2N)sp band per event, not
  the inter-measure/reserve/extreme space, so a true empty-space click still returns
  `null`.
- **Editor-only is genuine.** Verified `view.js:134` calls
  `renderInto(container, model, { accessibleName })` — it omits `interactive`, so the
  default-false path emits no rect and the front-end DOM is byte-identical. The
  threading chain (renderSvg → renderSystem → renderMeasure → renderHand →
  renderNote/renderRest) matches the live call graph; `renderSvg` currently
  destructures `{ accessibleName = "" }` (`svg.js:235`), so adding an `interactive`
  param is the same mechanical thread the existing params use. The flag does not leak
  into `view.js`/`render.php` output. The documented unconditional-emit fallback is
  correctly characterized as visual-identity-only (weaker), with the flag path strictly
  stronger.
- **The regression test can actually catch the bug.** Verified the existing unit test
  forces `target = group.firstChild ?? group` (`SongCanvas.test.js:144`) and the
  existing e2e uses bbox-center `noteGroups(editor).first().click()`
  (`editor.spec.js:320`) — both miss the gap, exactly as the doc says. The proposed
  e2e (explicit off-ink `position`) and the proposed unit test (synthetic click whose
  `target` is the hit-rect, not a glyph child) pin the real off-ink signature and are a
  genuine improvement over the false-safe suite.

## Boundary — held

- **Schema changes only for `language`.** Verified `schema.js` is permissive
  (`additionalProperties` not enforced) and the generic enum walker (`validate.js:120`)
  validates a declared `language` enum without a `required` change and without blocking
  raw-JSON saves. No other `src/song` semantics change.
- **`render.php` unchanged.** Verified it treats `song` as an opaque string (escapes
  only `<`, `render.php:39`) and emits it verbatim in the inert `<script>` — zero
  parsing — so `language` rides along with no rendering change. Grep confirms **no**
  `src/` code (incl. `view.js`) reads `language`.
- **Section highlight is derived, no new emit.** The `data-section`-free derivation via
  `measureCoords`/`globalMeasureNumber` (`selection.js:42/68`) keeps even the highlight
  inside the Req 15 boundary. Confirmed.

## Language correctness

- Converting `pitch.step` only is justified and contradiction-free. Verified both
  evidence legs: (i) `HandConfigEditor` writes only English alters keys
  (`ALTER_KEY_OPTIONS = ["C"…"B"]`, `nextUnusedNote` draws from them), so converting
  keys would be reverted on the next hand-config touch; (ii) the renderer normalizes
  alters keys via `normalizeStep`/`normalizeAlters` (`layout.js:590`), so `{do:1}` and
  `{C:1}` render identically — alters keys are an internal English-canonical map, never
  a displayed spelling. Steps-only therefore satisfies AC9 with zero visible drift, and
  a raw-JSON Spanish alters key still validates (`checkAlters` accepts both systems).
- `SYSTEMS` keys are exactly `"english"`/`"spanish"` (`noteNames.js:32`), so
  `language === system` composes directly with `inferNoteNameSystem`/`stepInSystem` —
  no translation layer. Default-by-inference (no `newSong()` stamp) is correct:
  `newSong()` seeds no pitches → infers English; the lazy-seed `song===""` contract is
  pinned by an e2e (`editor.spec.js:261`), which a stamp would break. Round-trip holds
  via the permissive validator.

## Conformance, feasibility, scope

- Every visual edit routes through `commit = commitSong(next, onChangeSong)`, which
  re-validates and refuses non-conformant persistence (`serializeSong.js:40`) — the
  single mutation spine (AC13/Req 16). The new lifted structure handlers and the
  language conversion both build conformant objects via `newX` +
  `insertAt`/`removeAt`/`replaceAt` + `stepInSystem` (all present in `songModel.js` /
  `noteNames.js`).
- Buildable against the live code: the reuse claims check out — `onAddNote`/
  `onAddMeasure` exist and are kept (`edit.js:150/174`), `NotePanel` already has
  "Remove note" and takes `song`+`selection`+`system` (`NotePanel.js`), `SongPanel`
  ignores its `system` prop today (`SongPanel.js:110`), `emitBlock` spreads `{ ...song }`
  (`emit.js:22`), and `StructureList` mirrors the existing `AnnotationList` + `AddButton`
  list pattern (`AnnotationList.js`, `ListControls.js`). The `resolveSelection` change
  to a `kind`-tagged resolver is well-scoped (it currently returns `null` for any
  missing `hand`/`eventIndex`, `selection.js:106-113`, so the discriminant is what makes
  measure/section selections well-formed — the doc's test reconciliation is correct).
- Two code-writers would build the same thing: the emit mechanics (first-child rect,
  no `data-*`, fixed ~2sp width, vertical `[−4−N, 0+N]`, new constant N≈3–4), the
  threading sites, the panel-gating-by-kind, and the derived-highlight helper are all
  specified concretely.
- **Scope is clean.** The out-of-scope scan holds: front end does not consume
  `language`; no reordering; no note-depth listing; mouse-only selection; one-way
  structure→canvas highlight. Nothing spec-owned was smuggled into the design.

## Minor, non-blocking observations (for the plan/code phases, not changes to the doc)

- In very tight adjacent columns two hit-rects can overlap on a gap pixel; last-painted
  (later-sibling) group wins, so an off-ink gap click may resolve to the neighbor. The
  doc already accepts this (visible ink still resolves to its own group); calling it out
  only so the code phase keeps the width conservative (~2sp).
- The hard sequencing constraint (canvas-add-button removal must land *with* the
  Structure-view "Add note", never before) is correctly flagged as a risk — the plan
  must keep KD2 and KD3 in the same change.

These do not affect approval.
