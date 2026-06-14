# Review 6 — Doc Plan Review (APPROVED)

_Adversarial review of `3-plan/doc-plan.md` for review 6 of the Piano block
editor-UI feature (issue #8, PR #22), by doc-plan-reviewer-r6. Inputs: the
approved `1-spec/spec.md`, `2-design-doc/design-doc.md`,
`2-design-doc/design-doc-review-approved.md`, the approved `3-plan/code-plan.md`
(T1–T7), the doc plan under review, and the live repo docs on branch
`worktree-8-editor-ui` (`README.md`, `docs/song-format.md`, `AGENTS.md`,
`.rp.md`). Lenses: coverage, drift-resistance, self-containment, proportionality._

## Verdict

**APPROVED.** The plan's central thesis — review 6 is mechanism-only, so it
falsifies exactly **one** live doc claim and warrants exactly **one** minimal
contributor-facing edit (D1) — is correct and I verified it by sweeping the
repo's docs against everything T1–T7 ship. Every "no edit" exclusion holds against
the actual README/`docs/song-format.md` text, D1's acceptance is asserted against
the shipped code rather than the plan's predictions, and D1 is self-contained and
proportional. This review's failure mode (under-scoping, which sank review 5's doc
plan once) is specifically absent here.

## Coverage — I swept every doc against what T1–T7 ship

**Doc inventory (verified on-branch).** The only markdown docs outside `.rp/`,
`node_modules/`, and `.claude/` are `README.md` (210 lines), `docs/song-format.md`
(535), `AGENTS.md` (5), and `.rp.md` (101). I grepped all four for every mechanism
review 6 touches — `expand`/`collapse`/`index-path`/`expanded-path`; `caret`/
`glyph`/`chevron`/`▸`/`▾`/`disclosure`; `icon button`/`per-row`/`always-on`/
`ellipsis`/`dropdown`/`menu`/`kebab`; `depth`/`rail`/`16em`/`indent`/`pb-tree`;
`outline`/`hairline`/`highlight`/`SP_PX`/`recolor`.

- **`AGENTS.md` / `.rp.md`** carry **zero** UI-mechanism mentions (grep empty).
  `AGENTS.md` is workflow guidance ("keep `.rp/` references out of shipped
  artifacts"); `.rp.md` is pipeline scaffolding. Correctly unlisted.
- **`docs/song-format.md`** documents the format/schema (untouched this review).
  Its three UI mentions are at `:9` (the visual-editor framing — tree beside
  canvas, settings in sidebar, canvas displays+highlights), `:60` (the note-name
  selector), and `:122` (section/measure `name` shows in the tree, edited "from
  the Section / Measure inspector panel"). I confirmed each: the tree, the names,
  the Name fields, the note-language selector, and the canvas highlight all
  survive review 6 (T1–T7 change none of them at the altitude this doc describes).
  The plan's "no edit" call here is correct.

**The single falsified claim (D1) is real and the only one.** README `:142`
literally reads "It owns the **`showTree` toggle and expanded-path state** for
the tree" — I confirmed the phrase is present verbatim at that line. T4 removes
the index-path string addressing (`s0/m1/rightHand/e2`) and the dual-`Set`
regime; T5 collapses `edit.js` to one `expanded` Set (T5's grep acceptance: no
`expandedPaths`/`collapsedOverride`/`onToggleCollapsedOverride`). So
"expanded-path state" names a mechanism that no longer exists — a live README
claim review 6 falsifies. D1 targets exactly this phrase. Correct.

**Every "no edit" exclusion verified against the actual text — none is a
review-5-style under-scope.** I checked each mechanism review 6 removes against
what the README literally says, because the brief flags under-scoping as the
review-5 doc-plan rejection cause:

- **Row actions (always-on icon buttons → `DropdownMenu`, T4).** The README
  **never** characterizes the row-action widget — `grep -iE "icon.?button|kebab|
  ellipsis|always.?on"` over `README.md` returns **nothing**. The action-locus
  claims at `:33` ("add, remove, and duplicate controls for measures and notes …
  remove and duplicate for sections … Add measure is on each section row"), `:143`
  (the `src/editor/` row's "hosts add/remove/duplicate for measures and notes and
  remove/duplicate for sections … plus the per-hand 'Add note'"), and `:201` (the
  Tests paragraph's "tree-driven add/remove/duplicate/rename of measures and notes
  and remove/duplicate/rename of sections") all describe **which row hosts which
  action**, and review 6 keeps every action on its same row (only the widget chrome
  changes — code-plan T4). So each stays literally true. This is the key contrast
  with review 5: there, `:143`/`:201` *did* carry a falsified Add-section **locus**
  claim (Add-section moved off the tree), which is why review-5's doc-plan reviewer
  blocked on exactly those two lines. Review 6 moves **no** action between rows, so
  the same two lines are genuinely safe. The plan addresses both `:143` and `:201`
  explicitly and rules them out for the right reason — it did not silently exclude
  them under a "no other heading" blanket (the precise mistake review 5 made).
- **Hand-row "Add note" stays a direct `Button` (T4 change #5/#9).** `:29`/`:33`/
  `:143` keep saying the hand-group rows host "Add note" — still a direct labeled
  Button, so true.
- **Disclosure: text caret → non-focusable chevron; label becomes select-only
  (DD4, T4).** README `:29` says rows are "expandable and collapsible" and hand
  rows "expand a measure's two event lists." I confirmed the README **never**
  attributes expansion to clicking the label (`grep -iE "click.*(row|label|
  section|measure)"` finds no such claim) and never names the disclosure widget.
  After T4 section/measure rows stay expandable (via the chevron) and the hand-row
  label still toggles (design §3.3), so both sentences stay true; the select-only
  label change is a mechanism the README does not describe. No edit.
- **Selected-event highlight: hairline outline → recolor-only (T6).** The README's
  highlight claims (`:5`/`:12`/`:19`/`:29`/`:49`/`:205`) say the canvas "highlights
  the selection" / has "selection highlighting" — none states the highlight's
  size, weight, or style. I disambiguated every "outline" occurrence: all six are
  "toggleable **outline** panel" / "Note **outline**" (the tree-as-hierarchical-
  list sense), **never** the CSS `outline` the highlight used — so T6's outline
  removal falsifies no README "outline" claim. The recolor survives, the emitted
  SVG is byte-identical (R-E1), so the front-end sections stay accurate. No edit.
- **CSS reduction: `--pb-tree-depth`, the 16em rail, level-driven indent (T6).**
  The README never describes row indentation, rail width, or any editor-CSS detail;
  `:145` calls `style.scss` "Placeholder styling (editor + front end)" — still
  accurate. No edit.
- **Inspector de-dup: shared clamp/splice/omit; SongPanel composes ContextEditor
  (T1/T2).** The README describes panels by the fields they expose, not their
  internal helper factoring; field reachability is preserved (R-E5). No edit.
- **`src/editor/` file-layout row `:143` survives in full.** T4 keeps
  `__experimentalTreeGrid`, the inline `__workspace` wrapper, the same action-locus
  story, and `SongCanvas` "display + highlight only" — every clause in the row
  stays true. No edit. (The plan correctly contrasts this with `:142`'s
  "expanded-path state," which is the one phrase that *does* fall.)
- **Toolbar "Structure" toggle / inline placement (DD1, T4/T7); raw-JSON / front
  end / format / validator / dormant hit-rect.** All untouched at README altitude.
  No edit.

## Drift-resistance

D1's acceptance is asserted against the **shipped** code, not the plan's
predicted identifiers. The "Depends on" and "Acceptance" sections instruct the
writer to author against the delivered `src/edit.js` (after T5), confirm via T5's
own grep acceptance that `edit.js` holds exactly one `expanded` Set with no
`expandedPaths`/`collapsedOverride`, and "Write the wording to match whatever the
shipped code actually names that state, not the plan's predicted identifier" —
with the explicit fallback "If the delivered code diverges from the plan's
predicted shape, the README follows the code." This survives small code-phase
deviations (e.g. a renamed Set or a different key-derivation detail). The
acceptance also pins the rest of the `:142` row **byte-unchanged** and bounds the
edit to the single phrase, so the task cannot quietly broaden.

## Self-containment

D1 carries Goal / Audience / Files / Sections-scope / Depends on / Traces to /
Acceptance and is executable by a fresh doc-writer without reading any other task
(it is the sole task). The target phrase is quoted verbatim, the scope is the one
phrase within the `:142` row, and the preserve-list enumerates the row's other
clauses to leave intact — I confirmed every one of those clauses ("structural
mutators," "TextareaControl," "kind-tagged selection," "the canvas no longer
produces selection," "tree and the sidebar share one mutation path") is present
verbatim at `:142`. The "Changes" guidance is concrete (replace "expanded-path
state" with single-`Set` wording; do not reintroduce "path"/"index-path"/"dual"/
plural-`Set`; keep "`showTree` toggle" verbatim; keep it in the row's dense
register; do not expand into a coordinate-keys sentence).

## Proportionality

No make-work. The plan ships exactly one minimal phrase-level edit for the one
falsified claim, a single working tree, and a thorough, source-grounded
"checked-and-found-no-edit" ledger that prevents both over-scoping (inventing docs
for reader-invisible mechanism) and under-scoping (the ledger names every
falsifiable claim and why it survives). The line-5 status summary and the
`## Forthcoming` list are correctly left alone — I confirmed line 5's only
"toggle" hit is "**toggleable** outline panel" (the show/hide tree, which survives
via `showTree`), not an expansion-state claim, so it needs no edit.

## Minor observations (non-blocking — no action required)

- **Line-number drift.** D1 cites `README.md:142`/`:143`/`:145` etc., which match
  the current branch (I confirmed `:142` holds the target phrase). The "Sections-
  scope" anchors the edit to "the `src/edit.js` row of the `### File layout`
  table … only the '`showTree` toggle and expanded-path state' phrase," so even if
  earlier doc tasks shifted line numbers, the by-content anchor keeps the writer
  on target. No change needed.
- **D1 lands after the whole code phase (T1–T7).** That is the right ordering: D1
  must read the shipped `edit.js`, and the plan already states "Depends on:
  Nothing (sole doc task). Authored against the SHIPPED `src/edit.js`." Fine as-is.

---

**VERDICT: APPROVED.** No blocking issues. The doc plan correctly scopes review 6
to a single phrase-level README edit (D1), every "no edit" exclusion is verified
true against the live docs, the acceptance follows the shipped code, and the
review-5 under-scoping failure mode is specifically and correctly avoided.
