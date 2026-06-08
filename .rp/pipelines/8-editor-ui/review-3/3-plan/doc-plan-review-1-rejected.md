# Doc Plan Review 1 — REJECTED (review-3)

**Verdict:** Rejected.
**Reviewer:** doc-plan-reviewer (review-3).
**Plan under review:** `3-plan/doc-plan.md`.

The plan is strong overall: it correctly frames the tree as the navigate/select
surface, the canvas as display + highlight only, documents `name` exactly like
`language` (stored + round-trips, **not** consumed by the front end), keeps
reordering out of scope, removes the right-sidebar Structure list, is proportional
(README + song-format.md only), invents no docs and no inline code-symbol
reference, and orders its tasks for sequential single-tree edits. The DT3/DT4
line-number citations check out against the live files (`section :=` ~71, `measure
:=` ~89, `language` subsection ~48–62, song-format Additive growth at 400; README
file-layout ~140–142, `interactive` hit-rect ~156–158, Additive growth ~191, Tests
~199).

It is rejected for **one class of defect: incomplete removal coverage of canvas
click-to-select**, which directly violates the plan's own drift-resistance bar
(doc-plan.md lines 42–44: "Canvas click-to-select is removed, not relocated — do
not describe the canvas as a selection surface anywhere") and the review-3 brief's
removal-coverage requirement. Two existing docs that **claim the canvas/staff is the
selection surface** fall outside every task's section-scope and would survive the
plan unchanged.

---

## Blocking issues (must fix)

### B1 — README "Forthcoming" still says you select notes on the canvas; no task covers it
**Task:** DT1 (or add an explicit micro-task).
`README.md` line 203 (the **Forthcoming** section, `## Forthcoming` at line 201)
reads:

> "Authoring now happens in a **canvas-first visual editor** — you select and edit
> notes on the rendered staff, with their settings in the **block settings
> sidebar** …"

This is exactly the canvas-click-to-select framing that review-3 removes (the staff
is described as the selection surface). But no task's section-scope includes
"Forthcoming":
- DT1 = Status blurb + "What the block does today" (lines 5, 7–15).
- DT2 = "Using the Piano block" (lines 19–54).
- DT3 = "For contributors" (lines ~140–199).
- "Forthcoming" (lines 201–208) is **uncovered**.

**Fix:** Bring the Forthcoming "Authoring now happens in…" sentence into scope —
cleanest as an added bullet in DT1's section-scope and acceptance (it is the same
status/overview-altitude reframing DT1 already owns), or a small dedicated task.
Reframe it to "authoring happens through a structure tree beside the canvas; the
canvas is the live render with selection highlighting," with **no** claim that you
select notes on the staff. Leave the gradual-dynamics / audio-playback content in
that paragraph and the rest of the Forthcoming list unchanged. Add an acceptance
bullet: "No remaining sentence in Forthcoming describes selecting notes on the
canvas/staff."

### B2 — docs/song-format.md Intro still says you select notes on the rendered staff; DT4 excludes it
**Task:** DT4.
`docs/song-format.md` line 9 (the **Intro and mental model** paragraph) reads:

> "The block now has a **canvas-first visual editor** — the default authoring
> surface, where you select and edit notes directly on the rendered staff with
> their settings in the block sidebar …"

This is the same canvas-as-selection-surface claim. DT4 is the **only** task that
touches `docs/song-format.md`, and its section-scope (doc-plan.md lines 274–288)
is explicitly limited to the `section :=` / `measure :=` shape blocks, the new
`name` subsection, and the Additive-growth note. The Intro paragraph (line 9) is
**out of every task's scope**, so this claim would survive unchanged — a doc left
asserting front-of-house behavior the front end no longer has, in violation of the
drift-resistance bar.

**Fix:** Add the Intro paragraph (song-format.md line 9) to DT4's section-scope and
changes. Reword "where you select and edit notes directly on the rendered staff" to
the tree-selects / canvas-highlights split (e.g. "…where you navigate and select the
song through a structure tree beside the canvas and edit settings in the block
sidebar; the canvas displays the song and highlights the selection"). Keep the rest
of that paragraph (raw-JSON alternative, no-audio-yet, front-end-renders-as-SVG, the
cross-links to the README workflow and "What the front end shows") intact. Add an
acceptance bullet: "The Intro no longer describes the canvas/staff as the selection
surface."

---

## Non-blocking notes (optional; not gating approval)

- **N1 (DT2 cross-check, no change required):** README line 31 ("Select a note (or
  rest) by clicking it on the staff (… tab to it and press Enter or Space)") and the
  line-47 "editing surface" phrasing both fall inside DT2's "Using the Piano block"
  scope and are explicitly called out for rewrite (doc-plan.md lines 122–130,
  154–162). Covered — listed only to confirm the in-scope canvas-click references are
  accounted for.
- **N2 (DT4 link target):** When DT2 links the rename affordance to the
  song-format `#name` anchor and DT4 creates it, make sure the README's existing
  `language` cross-link idiom is mirrored (`docs/song-format.md` line 60 links the
  README's `#2-build-the-song-in-the-visual-editor`); keep the new `name` links
  pointing at stable, existing README anchors so DT2/DT4 do not introduce a dangling
  anchor. Already implied by DT4's "Depends on DT2/DT3 … make the anchor real and
  matching"; restated for emphasis.

---

## Tasks to fix
- **DT1** — extend scope to the README "Forthcoming" canvas-selection sentence (B1).
- **DT4** — extend scope to the song-format.md Intro canvas-selection sentence (B2).

Re-submit with B1 and B2 closed (both are small scope extensions to existing
tasks, not new docs). Everything else in the plan is approvable as written.
