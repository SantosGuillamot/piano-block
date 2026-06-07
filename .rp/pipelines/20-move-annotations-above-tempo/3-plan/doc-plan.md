# Doc plan — Move annotations above the tempo marking (issue #20)

> Ordered, independently-executable **documentation** tasks derived from the
> approved spec (`1-spec/spec.md`), design doc (`2-design-doc/design-doc.md`,
> esp. §6), and code plan (`3-plan/code-plan.md`). These tasks cover **R9 / AC10
> only** — the documentation that must stay in sync with the new above-the-top-staff
> marking order. The code plan deliberately deferred the three R9 doc-comment
> updates to this doc plan (code-plan.md lines 177–180); they are owned here and
> must not be orphaned.
>
> **Scope reminder (do not exceed):** documentation only. No production logic, no
> test code, no horizontal-layout change. The production reorder and test edits are
> the code plan's Tasks 1–4. All file references are to this worktree.

## The order change these docs must reflect

- **Old (today):** above the top staff, top→bottom = **tempo → octaveShift →
  annotations** (annotations hug the staff; tempo at the very top).
- **New (target):** above the top staff, top→bottom = **annotations → tempo →
  octaveShift** (annotations move to the topmost position; tempo and octaveShift
  keep their relative order, octaveShift now hugging the staff).

After the code change, "reserved later ⇒ higher" makes the annotation lane the
**topmost** lane, the tempo the **middle** lane, and the (right-hand "above")
ottava the lane **nearest the staff**.

## Documentation sweep — what changes and what does not (verified against the worktree)

A full repo sweep (re-run for this plan) confirms the design doc's §6 finding:
**all order-bearing language about the above-the-top-staff stack is confined to
`src/notation/layout.js`**, in exactly three doc-comment sites. Line numbers were
re-verified against the current worktree (the design doc cited some that had
drifted by a few lines):

| ID | Site (verified location) | Old-order text to fix |
|---|---|---|
| **M1** | `src/notation/layout.js:2848-2856` (the `topMarginLayout` JSDoc); the order-bearing sentence is at **`:2850-2852`** | "the above-RH note lane **nearest the staff, then an above-staff ottava, then the tempo at the very top**" + the trailing "**(and the tempo)**" parenthetical at `:2852` |
| **M2** | `src/notation/layout.js:1865-1869` (the `topMarginLayout` call-site comment); the order-bearing parenthetical is at **`:1866`** | "(the above-RH note stack, an above-staff ottava, the tempo) stacked over the ledger zone" — lists innermost→outermost in the **old** order |
| **M3** | `src/notation/layout.js:2947` (the tempo-emit inline comment, on the line above `y: band.tempoLaneY` at `:2948`) | "`// Topmost lane, above the note zone.`" — false under the new order (tempo is now the **middle** lane) |

> Note on line numbers: the design doc (§6 / D3) cited M1 as `2850-2852`, M2 as
> `1866`, M3 as `2947`. In the current worktree the M1 JSDoc block spans
> `2848-2856` with its order sentence at `2850-2852`; M2's order parenthetical is
> at `1866` (within the `1865-1869` comment); M3 is at `2947`. The IDs and the
> substantive content match the design doc exactly.

**Order-agnostic sites that must be LEFT unchanged** (re-verified; each describes
something other than the inter-lane order, so editing them would be scope creep
and could introduce false claims):

- `src/notation/constants.js:99-100` (`ABOVE_STAFF_PAD`): "…and above the topmost
  lane" — generic; there is still a topmost lane (now annotations). No old-order
  claim.
- `src/notation/constants.js:106` (`TEXT_LANE_GAP`): "(chord / ottava / tempo)" —
  an **unordered** example list of glyphs that use the gap, not a top-to-bottom
  claim.
- `src/notation/layout.js:2701-2707` (`systemHasTempo` JSDoc): says **which**
  texts need a lane; no order claim.
- `src/notation/layout.js:2869-2873` (the inner-zone comment): describes the zone
  **below** all three lanes (ledgers + measure number); unchanged.
- `src/notation/layout.js:2887-2888` (the in-block "the stack grows UP …"
  comment): describes the annotation stack's **internal** upward growth (still up
  — AC3), not the inter-lane order. This comment travels **with** the annotations
  block when the code plan's Task 3 moves it; the doc plan does not separately edit
  it.
- `src/notation/svg.js:1091-1092` and `:2135` (layout.js): unordered enumerations
  of the text **kinds** produced (tempo / measure number / ottava); no vertical
  order.
- `docs/song-format.md`, `README.md`: describe the JSON song format and
  above/below placement semantics (which are unchanged); neither asserts the
  tempo/ottava/annotation **inter-lane** order. No edit needed.
- `.rp/*` pipeline artifacts (prior issues' specs/designs/plans): historical
  records, explicitly out of R9 scope.

No changelog file exists in the repo, and no other comment, guide, or markdown
describes the above-the-top-staff stack order. The three sites above are
exhaustive: **AC10 is satisfied iff M1, M2, and M3 are all updated.**

---

## Task D1 — Update the `topMarginLayout` doc-comment (M1) to the new order

- **Goal.** Rewrite the order-bearing sentence in the `topMarginLayout` JSDoc so it
  describes the new innermost→outermost order (ottava nearest the staff, then the
  tempo, then the above-RH annotation/note lane at the very top), and remove the
  trailing "(and the tempo)" parenthetical that assumed the tempo was outermost.
- **Audience.** Contributors and maintainers reading/modifying the layout code.
- **Files.** `src/notation/layout.js`.
- **Sections-scope.** The `topMarginLayout` JSDoc block (`:2848-2856`); concretely
  the order sentence at **`:2850-2852`** and its trailing "(and the tempo)"
  parenthetical at `:2852`. **Do not** touch the next sentence (`:2853-2856`, "The
  above-RH lane reserves height for the WHOLE stack … so a deep above-RH stack
  lifts the lanes (and the margin) above it"): it stays true under the new order
  (annotations reserved last still account the full stack on top — AC5). **Do not**
  touch the `@param`/`@return` tags (`:2858-2863`).
- **Change (substance, not exact wording).** Replace
  "…the above-RH note lane nearest the staff, then an above-staff ottava, then the
  tempo at the very top — so when there is nothing above the staff the margin (and
  the tempo) drop close to it." with a sentence whose innermost→outermost order is
  **ottava nearest the staff, then the tempo, then the above-RH note (annotation)
  lane at the very top**, and whose "nothing above the staff" clause no longer
  singles out the tempo as outermost (e.g. "…so when there is nothing above the
  staff the margin drops close to it.").
- **Depends on.** None.
- **Traces to.** R9; AC10 (this is the site the spec explicitly flagged). Supports
  R1/R2 by documenting the new lane order.
- **Acceptance.** The `topMarginLayout` JSDoc no longer states the old order; it
  describes ottava → tempo → above-RH annotation lane (innermost→outermost), i.e.
  the new top→bottom annotations → tempo → octaveShift. The "(and the tempo)"
  parenthetical is gone. The deep-stack sentence and the `@param`/`@return` tags are
  unchanged. `grep -n "very top\|nearest the staff" src/notation/layout.js` no
  longer returns the M1 line with the old ordering.

---

## Task D2 — Update the `topMarginLayout` call-site comment (M2) to the new order

- **Goal.** Rewrite the call-site comment's parenthetical that lists the lanes in
  innermost→outermost (old) order so it lists them in the new order.
- **Audience.** Contributors and maintainers reading the system-layout flow.
- **Files.** `src/notation/layout.js`.
- **Sections-scope.** The comment block above the `topMarginLayout` call
  (`:1865-1869`); concretely the parenthetical at **`:1866`**. Leave the rest of the
  comment (`:1865`, `:1867-1869`: "The top margin flexes to only the text lanes
  actually present … so the staff and tempo drop close to the staff when there is
  nothing above it. Each present lane's baseline Y comes back … the above-RH lane
  reserves the full stack height.") unchanged — it is order-agnostic and stays true.
- **Change (substance, not exact wording).** Replace the list
  "(the above-RH note stack, an above-staff ottava, the tempo) stacked over the
  ledger zone" with the same three lanes in the **new** innermost→outermost order:
  "(an above-staff ottava, the tempo, the above-RH note stack) stacked over the
  ledger zone".
- **Depends on.** None (independent of D1; both are comment edits in the same file
  but in different, non-overlapping locations).
- **Traces to.** R9; AC10 (additional to the spec's flagged site, per design §6 /
  D3). Supports R1/R2.
- **Acceptance.** The call-site comment lists the lanes as **ottava → tempo →
  above-RH note stack** (innermost→outermost). The surrounding sentences are
  unchanged. No old-order list remains at `:1866`.

---

## Task D3 — Update the tempo-emit inline comment (M3) to the new order

- **Goal.** Replace the inline comment that calls the tempo the "Topmost lane" —
  false under the new order — with one stating the tempo is the **middle** lane
  (above the ottava, below the above-RH annotation lane).
- **Audience.** Contributors and maintainers reading the text-emit layer.
- **Files.** `src/notation/layout.js`.
- **Sections-scope.** The single inline comment at **`:2947`**, on the line above
  `y: band.tempoLaneY` (`:2948`) inside the tempo-push in `buildSystemTexts`. Leave
  the adjacent `x:` comment (`:2944-2946`, "The tempo prints at its measure's left
  edge …") unchanged — it is horizontal, not order-bearing.
- **Change (substance, not exact wording).** Replace
  "`// Topmost lane, above the note zone.`" with a comment placing the tempo as the
  **middle** lane, e.g. "`// Middle lane: above the ottava, below the above-RH
  annotation lane.`"
- **Depends on.** None.
- **Traces to.** R9; AC10 (additional to the spec's flagged site, per design §6 /
  D3). Supports R1/R2.
- **Acceptance.** The tempo-emit comment no longer claims the tempo is the topmost
  lane; it describes the tempo as the middle lane (above the ottava, below the
  above-RH annotation lane). `grep -n "Topmost lane" src/notation/layout.js`
  returns nothing.

---

## Task D4 — Verify the documentation sweep is complete (R9 / AC10 closure)

- **Goal.** Confirm that, after D1–D3, **no** documentation anywhere in the repo
  still describes the old above-the-top-staff order, and that no order-agnostic site
  was changed by mistake. This is the AC10 closure check.
- **Audience.** Maintainers (sign-off); also the docs-review phase.
- **Files.** Whole repo (read-only verification); primary focus `src/notation/`,
  `docs/`, `README.md`.
- **Sections-scope.** Verification only — no edits.
- **Checks.**
  - **No old-order language remains.** Re-run the order-language sweep and confirm
    the three former offenders now read in the new order, e.g.:
    - `grep -rn "very top\|nearest the staff\|Topmost lane" src/notation/layout.js`
      no longer returns any line asserting the **old** order (M1's "nearest the
      staff … tempo at the very top" and M3's "Topmost lane" are gone or rephrased).
    - Confirm M2's `:1866` list now reads ottava → tempo → above-RH note stack.
  - **No scope creep.** The order-agnostic sites listed in the sweep above
    (`constants.js:99-100`, `:106`; `layout.js:2701-2707`, `:2869-2873`,
    `:2887-2888`; the kind-enumerations; `docs/song-format.md`; `README.md`) are
    unchanged.
  - **No new docs missed.** A fresh `grep -rni -E "tempo|ottava|annotation"`
    across `src/`, `docs/`, `README.md` (excluding `node_modules`, `.rp/`, `dist/`)
    surfaces no further site that asserts the inter-lane order in the old direction.
- **Depends on.** D1, D2, D3.
- **Traces to.** R9; **AC10** (closure: "No documentation describing the
  above-the-top-staff marking order still references the old order; all such
  documentation describes the new top-to-bottom order").
- **Acceptance.** All three checks pass: the only doc sites that ever described the
  inter-lane order (M1, M2, M3) now describe **annotations → tempo → octaveShift**;
  every order-agnostic site is untouched; no additional old-order site exists. AC10
  is satisfied.

---

## Ordering & rationale

1. **D1, D2, D3** are independent comment edits — they may be done in any order or
   in parallel (all three sit in `src/notation/layout.js` but in distinct,
   non-overlapping locations). Together they convert every old-order doc site to the
   new order, satisfying R9 across all three sites the design identified.
2. **D4** runs last as the AC10 closure check, confirming completeness and no scope
   creep.

## Interaction with the code plan (no overlap, no orphans)

- The code plan's **Task 3** moves the annotations reservation block (and its
  internal "the stack grows UP …" comment at `:2887-2888`) as part of the
  production reorder. That in-block comment is order-agnostic (internal growth
  direction) and is **not** an R9 doc site — this doc plan does not edit it; it
  rides along with the code move. The three R9 doc sites (M1, M2, M3) are **not**
  moved by the code reorder and are owned entirely here.
- The code plan's test-comment edit (the `layout.test.js:2059` block's top→bottom
  description, code-plan Task 2) lives in test code and is owned by the **code
  plan**, not this doc plan.
- Net: M1, M2, M3 are covered exactly once, here; nothing is orphaned and nothing is
  double-edited.
