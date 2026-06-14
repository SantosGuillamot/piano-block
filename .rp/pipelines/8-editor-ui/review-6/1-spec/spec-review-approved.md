# Review 6 Spec Review — APPROVED

_Adversarial review of `1-spec/spec.md` for review 6 of the Piano block editor-UI
feature (issue #8, PR #22), by spec-reviewer-r6. Inputs reviewed: `0-prompt/prompt.md`,
`1-spec/spec-research.md`, `1-spec/spec.md`, and the source on branch
`worktree-8-editor-ui` (`src/editor/`, `src/edit.js`, `src/style.scss`,
`src/notation/svg.js`, `src/view.js`)._

## Verdict

**APPROVED.** The spec is traceable, testable, feasible, complete on the preservation
invariants, and standalone-readable. Every claim it makes about the current code was
verified against the source and holds. The latitude the prompt reserved for the design
phase (surface placement, inspector shape) is preserved as `MAY` and not pre-decided.

## What I verified against the code (claims confirmed)

- **`StructureTree.js` (542 lines)** — confirmed the hand-rolled machinery the spec
  names: index-path string addressing (`s${i}`, `s${i}/m${j}`, `…/${hand}`,
  `…/e${k}`); the two-Set expansion regime driven by `expandedPaths` +
  `collapsedOverride` with `isSelectionAncestor` auto-reveal/veto (lines 79-156); the
  `▸`/`▾` text-glyph caret concatenated into each label `Button` (`caret()`, lines
  65-67, used at 199/302/402); the inline `--pb-tree-depth` style on every label
  (lines 190/289/397/452); and the always-on per-row icon `Button`s for
  remove/duplicate/add wrapped in `TreeGridItem` (lines 206-251, 309-352, 408-419,
  472-527). The trigger-in-`TreeGridItem` detail R-A2/R-E8 leans on is real.
- **`edit.js`** — confirmed the dual-Set ownership (`expandedPaths` +
  `collapsedOverride`, lines 109-110, `showTree` 108) and, decisively, the per-kind
  panel gating R-E6 rests on (lines 491-523): `event` → Note+Measure+Section+Song;
  `event||measure` → Measure; any non-null selection → Section; Song always. This
  matches R-E6's "already correct today — preserve, don't fix" framing exactly; the
  research's earlier "gap" was correctly retracted.
- **`style.scss` (editor region, lines 24-115)** — confirmed `&__workspace` flex row,
  the fixed-width `&__tree` rail (`width: 16em`), the `--pb-tree-depth → padding-left`
  indent rule (lines 64-66), and the `.is-selected` highlight whose `outline: 0.125px`
  is coupled to `SP_PX = 8` by the divide-by-8 comment (lines 105-112). The
  `@font-face "PB Music"` (lines 16-22) is front-end notation — correctly scoped OUT
  by R-C3/Out-of-Scope.
- **Inspector de-duplication (R-B3) — every duplication claim is true:**
  - `clampInt` is defined **3×** — `HandConfigEditor.js:196`, `PitchEditor.js:98`,
    `inspector/NotePanel.js:73`.
  - `toBoundedInt` is defined **2×** — `ContextEditor.js:63`, `inspector/SongPanel.js:60`.
  - `SongPanel` re-copies `ContextEditor`'s draft/projection logic **verbatim**:
    `toNumber`/`toBoundedInt`/`projectTempo`/`projectTimeSignature` are byte-identical
    between the two files; `SongPanel` also reproduces the whole
    `tempoDraft`/`timeDraft` `useState` + `editTempo`/`editTimeSignature` block. The
    only diff is the emit target (`emitContextMember` → `emitBlock(song,"defaults",…)`
    vs `emitMember` → `onChange`), exactly as the spec states.
  - The omit-when-empty idiom is re-inlined across `emit.js:emitBlock`,
    `ContextEditor.js:emitMember`, and `SongPanel.js:emitContextMember` — consolidation
    target is real.
- **Byte-identical-publish invariant (R-E1/R-C2) is coherent and isolatable:** the
  `is-selected` highlight is applied **editor-side only** by
  `SongCanvas.decorateSelection` via `classList.add("is-selected")` after each draw;
  `view.js` never references `is-selected`. The `data-measure`/`data-hand`/
  `data-event-index` hooks are emitted by `src/notation/svg.js` (shared renderer), not
  by the editor decoration. So the highlight rewrite can be confined to CSS + the
  editor canvas component without touching the emitted SVG — the constraint is
  satisfiable as written.
- **No forbidden imports today:** grep of `src/` for `privateApis` / `ListView` /
  `__dangerousOptIn` / `lock(` found only the benign `emitBlock(song, "defaults", …)`
  substring matches — no private-API usage exists, so R-A1's prohibition is a clean
  forward constraint, not a removal.
- **Runtime-deps model:** `@wordpress/*` runtime packages are not in `node_modules`
  (only `@wordpress/scripts`/`env`/e2e are dev deps); they resolve via `window.wp.*`
  externals, consistent with the research's "DependencyExtractionWebpackPlugin"
  account and with the project already shipping `__experimentalTreeGrid`/
  `__experimentalToolsPanel`/`__experimentalNumberControl`. The spec's reliance on
  stable `DropdownMenu` + `@wordpress/icons` (`moreVertical`, chevrons) is the same
  externals path and is well-founded; the spec phrases the specific icon/component
  names as examples ("e.g.", "such as"), not hard mandates, so a design substitution
  stays in-spec.

## Review-lens checklist

- **Traceability.** Every requirement carries an inline finding/prompt reference
  (F1-F4, prompt §). Nothing is invented. Placement (R-D1) and inspector shape (R-D2)
  are left OPEN as `MAY`, honoring the prompt's "the spec does not pick a placement or
  panel shape." R-A1's private-API prohibition correctly tightens beyond the prompt
  based on F1's decisive finding (List View is private + store-coupled).
- **Testability.** Each AC is objectively checkable: AC-A1 by import inspection;
  AC-B1/B2/B3/B4 by source inspection of named, now-confirmed mechanisms; AC-C1/C2/C3
  by reading `style.scss`; AC-E1 by a byte diff of `render.php` output + SVG; AC-E5 by
  walking the enumerated field map; AC-E6 by the four selection→panel cases. A
  code-phase reviewer can verify each without judgment calls beyond R-B4's explicitly
  qualitative "meaningful net reduction" (which the spec deliberately leaves
  un-quota'd, per the prompt).
- **Preservation invariants — complete.** All five from the prompt's "What must keep
  working" are present and mapped: full visual editing (R-E3), byte-identical publish
  (R-E1), valid-by-construction (R-E4), raw-JSON mode (R-E7), keyboard/accessibility
  parity (R-E8). The buried-field watchlist (R-E5) matches the source field-by-field
  (pitch step/octave/alter, annotation text/placement/staff, handConfig
  clef/octaveShift/alters, section-level overrides distinct from song defaults, tempo
  beatUnit, barlines, dots, dynamic, the four spans, names, note language).
- **Feasibility.** The spec demands nothing the research showed impossible. It forbids
  the unobtainable (PrivateListView/privateApis), pins to the already-shipped TreeGrid
  primitive, and uses stable `DropdownMenu`. R-D2's `Navigator` option is correctly
  `MAY`, not mandated, with the selection↔route sync risk flagged.
- **Standalone readability.** The Overview restates the current state, the honest
  resolution of the owner's List-View suggestion, and the constraint envelope; a
  reader with spec.md + the branch has enough to design from.

## Non-blocking observations (no fix required; recorded for later phases)

These do not affect any requirement or AC and do NOT gate approval:

1. **The "~3,300 lines" figure** (Overview, carried verbatim from the prompt) is
   approximate context, not a requirement. The measured `src/editor/` + `src/edit.js`
   JS total is ~8,508 lines *including tests*; excluding tests it is smaller. Because
   R-B4 sets no numeric quota and judges reduction qualitatively against the named
   mechanisms, the approximate figure is harmless — the later phases should not treat
   "3,300" as a baseline to subtract from.
2. **`ContextEditor.js` lives at `src/editor/`**, not `src/editor/inspector/`. The
   spec never asserts a path, so nothing is wrong; noted only so the code phase looks
   in the right place when consolidating the duplicated draft/projection logic.
3. **R-B3's example helper homes** ("clamp helpers living once in `songModel.js`; a
   single splice-into-song-at-coordinates helper; a single omit-when-empty helper")
   are illustrative; the existing `inspector/emit.js:emitBlock` is the natural seam for
   the omit-empty consolidation. The spec's "for example" phrasing already leaves this
   to design — no change needed.

## Verdict line

**APPROVED.**
