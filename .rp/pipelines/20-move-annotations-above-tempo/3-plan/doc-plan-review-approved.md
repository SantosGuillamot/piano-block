# Doc plan review — APPROVED (iteration 1)

**Verdict:** APPROVED. The doc plan (`3-plan/doc-plan.md`) is complete, correct, and
self-contained. It covers every site that describes the old above-the-top-staff
marking order and updates all of them to the new top→bottom order
**annotations → tempo → octaveShift**, satisfying R9 / AC10 with no orphans and no
scope creep.

---

## What I reviewed

- Approved spec (`1-spec/spec.md`) — R9, AC10.
- Approved design doc (`2-design-doc/design-doc.md`) — §6 (doc-update sweep), D3.
- Approved code plan (`3-plan/code-plan.md`) — its R9/AC10 deferral (lines 177–180).
- The doc plan under review (`3-plan/doc-plan.md`).

I did not rubber-stamp: I independently opened each flagged site in the worktree
and ran my own repo-wide sweeps for old-order language.

## R9 / AC10 completeness — the crux (independently verified)

I confirmed each of the three doc-comment sites genuinely describes the **old**
order in the current worktree, and that the doc plan updates each:

- **M1 — `src/notation/layout.js:2850-2852`** (`topMarginLayout` JSDoc). Verified
  it reads "the above-RH note lane **nearest the staff, then an above-staff ottava,
  then the tempo at the very top**", with a trailing "**(and the tempo)**"
  parenthetical at `:2852`. This is the old innermost→outermost order. Task D1
  rewrites it to ottava → tempo → above-RH lane and drops the parenthetical.
  Correctly leaves the deep-stack sentence (`:2853-2856`) and the `@param`/`@return`
  tags (`:2858-2863`) — the latter is a return-shape list, not an order claim.
- **M2 — `src/notation/layout.js:1866`** (call-site comment). Verified it reads
  "(the above-RH note stack, an above-staff ottava, the tempo) stacked over the
  ledger zone" — old innermost→outermost order. Task D2 rewrites the list to
  ottava → tempo → above-RH note stack and leaves the order-agnostic surrounding
  sentences.
- **M3 — `src/notation/layout.js:2947`** (tempo-emit inline comment). Verified it
  reads "`// Topmost lane, above the note zone.`" on the line above
  `y: band.tempoLaneY` (`:2948`). False under the new order (tempo becomes the
  **middle** lane). Task D3 rewrites it to "middle lane, above the ottava, below
  the above-RH annotation lane."

**Line numbers:** M1, M2, M3 all match the current worktree exactly (the doc plan
re-verified them and noted M1's JSDoc spans `:2848-2856` with the order sentence at
`:2850-2852`). No drift.

### Independent repo-wide sweep for missed sites

I ran my own searches (not just the design doc's list) across `src/`, `docs/`,
`README.md`, and all markdown, excluding `node_modules`, `.rp/`, `dist/`:

- A broad order-language grep (`topmost`, `nearest the staff`, `very top`,
  `stacked above/over`, etc.) surfaced **only** M1, M2, M3 as order-bearing. Every
  other hit describes per-note/per-band growth direction, the inner ledger zone,
  or below-staff hugging — none assert the inter-lane order.
- `src/notation/constants.js:100` ("…and above the topmost lane") and `:106`
  ("(chord / ottava / tempo)") are correctly classified as order-agnostic: `:100`
  is generic (there is still a topmost lane, now annotations) and `:106` is an
  unordered glyph-example list. Leaving them is right; editing them would be scope
  creep.
- `src/notation/svg.js:1091-1092` (and the `renderSystemTexts` doc) is an unordered
  enumeration of text **kinds** (tempo / measure number / ottava) — no vertical
  order. Correctly left.
- Markdown inventory: `README.md`, `AGENTS.md`, `.rp.md`, `docs/song-format.md`.
  I grepped each for `tempo|ottava|octaveShift|annotation`. None describe the
  above-the-top-staff inter-lane stack order; they cover the JSON song format,
  validation/escaping, and above/below placement semantics (all unchanged).
  `docs/song-format.md:136` describes above/below ottava placement, not lane order.
- **No changelog file exists** in the repo (confirmed by `find`), so there is no
  changelog entry to update.

**Conclusion:** M1, M2, M3 are exhaustive. AC10 is satisfied iff all three are
updated, and Tasks D1–D3 update exactly those three.

## No orphans, no double-edits (boundary with the code plan)

- The code plan (lines 177–180) explicitly defers all three R9 doc-comment updates
  to this doc plan, and the doc plan claims and owns exactly M1, M2, M3. No gap.
- The in-block comment at `layout.js:2887-2888` ("the stack grows UP …") is
  order-agnostic (internal growth direction, AC3) and travels with the annotations
  block when code-plan Task 3 moves it. The doc plan correctly does **not** edit it.
- The test comment at `layout.test.js:2064-2065` describes the old order but lives
  in **test code**; the doc plan correctly attributes its update to code-plan
  Task 2, not to itself. I verified this comment exists and does describe the old
  order — so it is genuinely owned, not orphaned, by the code plan. No site is
  double-edited.

## Task self-containment and ordering

- Each task (D1–D4) has all required fields: Goal, Audience, Files, Sections-scope,
  Depends on, Traces to, Acceptance. Each names a concrete file + line range and a
  grep-based acceptance check a fresh doc-writer can execute without further
  context.
- D1, D2, D3 are correctly independent (non-overlapping locations in the same file)
  and may run in any order/parallel.
- D4 (AC10 closure sweep) correctly `Depends on: D1, D2, D3` and runs last,
  re-grepping for residual old-order language and confirming no order-agnostic site
  was touched. Its grep checks are concrete and aligned with the actual offending
  strings ("very top", "nearest the staff", "Topmost lane").

## Minor, non-blocking observations (no fix required)

- D4's closure-sweep grep set is well-chosen but not exhaustive of every phrasing;
  this is acceptable because D1–D3 each carry their own grep-based acceptance check,
  and my independent broad sweep already confirms the three sites are the complete
  set. No change needed.

## Decision

**APPROVED.** R9/AC10 coverage is complete and independently verified; tasks are
self-contained with correct fields; ordering and the code-plan boundary are sound;
nothing is orphaned or double-edited.
