# Review 6 — Design-doc Review (APPROVED)

_Adversarial review of `2-design-doc/design-doc.md` for review 6 of the Piano block
editor-UI feature (issue #8, PR #22), by design-doc-reviewer-r6. Inputs: the approved
`1-spec/spec.md`, the design research record `2-design-doc/design-doc-research.md`, the
design doc under review, and the baseline code on branch `worktree-8-editor-ui`
(`src/editor/`, `src/edit.js`, `src/style.scss`). Lenses: completeness, soundness,
fidelity, implementability, preservation._

## Verdict

**APPROVED.** The design doc covers every spec requirement (R-A1 … R-E8) with an accurate
coverage matrix, every load-bearing claim verifies true against the branch, it carries the
research record's decisions without re-opening or contradicting them, and a plan-phase
reader could produce a correct, complete code plan from this doc plus the spec. The two
observations below are non-blocking refinements the writer MAY fold in; neither changes a
decision or blocks the plan phase.

## What I verified against the code (load-bearing claims)

Every claim the review brief flagged was spot-checked at source and holds:

- **TreeGrid renders an unstyled table; the rail is the only box.** `StructureTree.js`
  imports `__experimentalTreeGrid`/`Row`/`Cell`/`Item` (`:43-49`) and wraps the grid in the
  `__tree` div (`:538-539`); `style.scss` gives that div the fixed `width:16em` rail
  (`:52-56`) and the only depth styling. The doc's "remove the rail, the table sizes to its
  widest row, add a max-width ceiling + truncation" is consistent with this and with the
  canvas already self-protecting (`&__canvas { flex:1 1 auto; min-width:0 }`,
  `&__canvas-svg { min-width:280px; overflow-x:auto }`, `:73-86`). The max-width-ceiling
  rationale (flex item default `min-width:auto`; shrink-to-fit table reports a large
  min-content width) is correct flexbox behavior.

- **DropdownMenu via `toggleProps` inside a `TreeGridCell`; `TreeGridItem` is droppable.**
  Today's rows put 3 action `Button`s in `TreeGridItem`s inside one shared second cell
  (sections `:203-251`, measures `:306-352`, notes `:469-529`) — the multi-focusable-per-cell
  pattern `TreeGridItem` exists for. Collapsing 3 buttons to 1 `DropdownMenu` removes the
  need for `TreeGridItem`, so giving the menu its own `TreeGridCell` render-prop (one
  focusable per cell, mirroring core's List View) is sound. Per-row ordinal labels the doc
  reuses for `label="Actions for <ordinal>"` exist at the cited lines (sections `:211-215`,
  measures `:314-322`, notes `:477-487`); the hand-row `addNoteLabel` exists at `:370-379`.

- **The explicit-depth splice requirement — `edit.js` really does feed the same selection
  to multiple panels.** Confirmed exactly: `resolveSelection` returns the full event
  resolution carrying `eventIndex` even for deeper kinds (`selection.js:161-170`), and
  `edit.js` renders Note + Measure + Section panels simultaneously, passing the same
  `resolvedSelection` to all three (`edit.js:491-517`). A "deepest-coord-wins" splice would
  let `SectionPanel`/`MeasurePanel` mis-splice at the event coord. The doc's three typed
  faces (`setSectionAt`/`setMeasureAt`/`setEventAt`), each destructuring only its own coords
  over one private `replaceAt`-down-the-path core, structurally prevent the mis-dispatch.
  This is the single most important correctness point in the doc and it is right. The three
  current emit-splice chains it consolidates are confirmed: `NotePanel.emitEvent`
  (`:119-128`), `MeasurePanel.emitMeasure` (`:64-71`), `SectionPanel.emitSection` (`:72-77`).

- **Recolor-only highlight suffices cross-engine.** `style.scss:101-103` are the
  scale-INDEPENDENT recolor lines (color only — `fill`/`stroke` carry no length); `:111-112`
  are the scale-COUPLED hairline (`outline:0.125px`/`outline-offset:0.25px`), and the
  comment at `:105-110` both ties them to `SP_PX=8` by the ÷8 reasoning AND notes the outline
  "may no-op on Safari for a `<g>`, hence the recolor floor above." So the recolor is already
  the cross-engine cue and the outline is a secondary embellishment that one major engine
  drops — dropping it is not a regression. The highlight stays an editor-only post-render
  class: `SongCanvas.decorateSelection` adds `is-selected` (`SongCanvas.js:118`), `view.js`
  never sets it, and the selection hooks `data-measure`/`data-hand`/`data-event-index`
  (`selection.js:185-186`) are untouched — so R-E1's byte-identical publish holds. The doc's
  "`filter: drop-shadow` is also scale-coupled" argument (blur → `feGaussianBlur stdDeviation`
  resolved in the scaled `<g>`'s user space) is correct.

- **`[aria-level]` SCSS replaces the depth var.** `TreeGridRow` carries `level={1..4}` at
  each kind (`:180/:279/:387/:443`); the mock confirms `level`→`aria-level`
  (`test/mocks/wordpress-components.js:382`), so the real component emits it. The inline
  `--pb-tree-depth` set in JS (`:190/:289/:397/:452`) and consumed at `style.scss:64-66`
  is therefore replaceable by an attribute-keyed rule with zero JS injection — core's idiom.

Additional checks: the inspector duplication is byte-for-byte as claimed —
`toNumber`/`toBoundedInt`/`projectTempo`/`projectTimeSignature` are identical between
`SongPanel.js:51-91` and `ContextEditor.js:54-94`, and the `tempoDraft`/`timeDraft`
`useState` + `editTempo`/`editTimeSignature` blocks match (`SongPanel.js:130-159` ⟷
`ContextEditor.js:109-132`); `clampInt` is defined three times (`NotePanel.js:73`,
`PitchEditor.js:98`, `HandConfigEditor.js:196`); `emitBlock` lives in `inspector/emit.js`
and the omit-when-empty body recurs across the panels as the doc lists. The test mock has
TreeGrid stand-ins but NO `DropdownMenu`/`MenuGroup`/`MenuItem`/`Navigator` export
(`test/mocks/wordpress-components.js:437-440`), exactly matching the doc's test-harness
caveat. The e2e spec is coupled to the caret regex (`editor.spec.js:280`), the `__tree`
class + "Structure" toggle (`:262-274`), and the `is-selected` assertion (`:206/:455`), as
the test-strategy section states.

## Completeness

The §7 coverage matrix maps all 22 requirements (R-A1 … R-E8) to design elements, and I
checked each mapping against the actual decision text — all accurate. The Group E
preservation invariants each have a concrete preservation argument in §6.1, and the R-E5
buried-field watchlist in §6.1 reproduces the spec's field map faithfully (metadata,
note-language, defaults tempo/timeSignature/beatUnit, hand configs, section overrides,
measure name/barlines/annotations, event type/duration/pitches/dots/dynamic/spans/
annotations). The "ACs map 1:1 to the requirements" closing claim is borne out by the
matrix.

## Fidelity to the research record

The doc carries DD1–DD10 + DD-CSS without re-opening any of them: inline placement (DD1),
keep stacked panels / no Navigator (DD2), mirror core's List View row (DD3), non-focusable
chevron + select-only label (DD4), single expansion Set with auto-reveal dropped (DD5),
coordinate-derived keys (DD6), the consolidation homes (DD7), recolor-only highlight (DD8),
the post-redesign shapes (DD9), and the CSS rework (DD-CSS). The one discrepancy it flags
(§2.1, §9) — the research record sometimes dropped the `src/editor/` prefix on
`ContextEditor.js`/`songModel.js` — is cosmetic and correctly resolved to on-branch paths;
I confirmed those files live at `src/editor/`.

## Observations (non-blocking — MAY address)

1. **The SongPanel-composes-ContextEditor de-dup (§4.3) is harder than "a disclosure/layout
   prop" reads, and the doc could say so more plainly.** `SectionPanel` composes
   `ContextEditor` by wrapping the WHOLE editor in one coarse all-or-nothing
   `ToolsPanelItem` ("Section overrides", `SectionPanel.js:124-134`). `SongPanel`'s layout is
   finer-grained: the common tempo/time fields are directly visible, while `beatUnit` and
   each hand config are SEPARATE `ToolsPanelItem`s inside an `Advanced` `ToolsPanel`, each
   with its own `hasValue`/`onDeselect`, plus a `resetAll` (`SongPanel.js:204-277`) — and the
   SongPanel tests pin exactly this split (e.g. `SongPanel.test.js:269-272` asserts the note
   language is NOT inside `Advanced` while `beatUnit` is). So the "disclosure/layout prop"
   the doc hands `ContextEditor` is not the same coarse wrap `SectionPanel` uses; it must let
   `ContextEditor` render its members in two tiers (common-visible vs per-member
   advanced-disclosed) and emit per-member. The doc DOES name the constraint ("the code phase
   must preserve `SongPanel`'s current visible layout … through that prop") and DOES point at
   the SongPanel tests as the unchanged-behavior regression net, which is why this is not a
   blocker — a plan-phase reader has the constraint and the guardrail. But the framing "drops
   the ~60-line fork" undersells the new prop machinery this needs; a sentence acknowledging
   that the prop must reproduce SongPanel's per-member common/advanced tiering (not
   SectionPanel's coarse wrap) would make the implementability fully honest. Note this does
   not threaten R-B4: the tree-side removals (carets, dual-Set, index strings, icon rows,
   `--pb-tree-depth`, scale outline) are large and unambiguous, so the net reduction holds
   even if this one de-dup nets close to neutral.

2. **The `aria-current` selection-state cue on the label is not explicitly called out as
   preserved.** Today the selected row's label `Button` carries `aria-current="true"`
   (`StructureTree.js:193/292/454`), and a unit test pins it (`StructureTree.test.js:491-499`).
   The doc says the label becomes "select-only" (§3.3/§3.4) and keeps the ARIA wiring, which
   implies `aria-current` survives, but it never names it. Since R-E8 is "a11y ≥ today" and a
   test pins this attribute, a one-line note that the select-only label retains its
   `aria-current` selected-state marker would close the gap. Carryable as-is (it follows from
   "the label Button stays, select-only" plus the unchanged ARIA-wiring assertions the doc
   already says stay), so non-blocking.

## Soundness / preservation summary

The R-E invariants are preserved by construction: byte-identical publish (highlight stays an
editor-only post-render class; no SVG/`data-*`/schema/`render.php` touch), full capability
(row menu + lifted mutators + recolor highlight), valid-by-construction (splice/omit helpers
keep the conformant emit; panel tests are the net), raw-JSON untouched, and keyboard parity
(every interactive row element stays a TreeGrid roving-tabindex focusable; chevron
non-focusable; no custom key handlers; ARIA wiring still emitted by TreeGrid). The explicit-
depth splice is the one place a naive consolidation would corrupt the song, and the doc gets
it right.

---

**VERDICT: APPROVED.** No blocking issues. Two optional refinements for the writer: (1)
state plainly that the `ContextEditor` "disclosure/layout prop" must reproduce SongPanel's
per-member common-visible/advanced-disclosed tiering (not SectionPanel's coarse all-or-
nothing wrap), so the implementability of the §4.3 de-dup is fully honest; (2) name
`aria-current` as a preserved selected-state cue on the now-select-only label under R-E8.
Neither changes a decision; the plan phase can proceed on this doc as written.
