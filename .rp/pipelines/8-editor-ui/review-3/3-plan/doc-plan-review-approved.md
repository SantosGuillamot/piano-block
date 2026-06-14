# Doc Plan Review — APPROVED (review-3)

**Verdict:** Approved.
**Reviewer:** doc-plan-reviewer (review-3, re-review after rejection-1).
**Plan under review:** `3-plan/doc-plan.md` (writer fix commit `33ec946`).

This is a re-review of the plan that `doc-plan-review-1-rejected.md` rejected for one
class of defect: **incomplete removal coverage of canvas click-to-select** — two stale
"you select notes on the rendered staff" sentences fell outside every task's
section-scope (B1: README "Forthcoming"; B2: docs/song-format.md "Intro and mental
model"). Everything else in the plan was assessed as approvable. The writer extended
DT1 and DT4 scopes to close both gaps. Both are now resolved, and nothing else changed.

---

## Blocking issues from rejection-1 — both resolved

### B1 — README "Forthcoming" canvas-selection sentence → RESOLVED in DT1
The live stale sentence still exists (`README.md` line 203, under `## Forthcoming`):
"Authoring now happens in a **canvas-first visual editor** — you select and edit notes
on the rendered staff…" DT1 now brings it into scope exactly as prescribed:

- **Sections-scope** (doc-plan.md lines 63–65): adds "The **Forthcoming** section's
  opening 'Authoring now happens in…' sentence (around line 203), which still describes
  a 'canvas-first visual editor — you select and edit notes on the rendered staff.'"
- **Changes** (lines 81–86): reword the Forthcoming opening to the tree-selects /
  canvas-highlights framing, "with **no** claim that you select notes on the staff,"
  leaving the gradual-dynamics / audio-playback content and the rest of the Forthcoming
  list unchanged.
- **Acceptance** (lines 96–100): "No remaining sentence in **Forthcoming** describes
  selecting notes on the canvas/staff," with the rest of the list unchanged.

This is the rejection's B1 fix verbatim (extend DT1's scope, reframe, preserve the rest
of Forthcoming). It is a scope extension to an existing task — no new doc, no new task.

### B2 — docs/song-format.md "Intro and mental model" canvas-selection sentence → RESOLVED in DT4
The live stale sentence still exists (`docs/song-format.md` line 9): "…a
**canvas-first visual editor** — the default authoring surface, where you select and
edit notes directly on the rendered staff…" DT4 now brings it into scope exactly as
prescribed:

- **Sections-scope** (doc-plan.md lines 289–291): adds "The **Intro and mental model**
  paragraph (around line 9), which still says the editor is 'a canvas-first visual
  editor … where you select and edit notes directly on the rendered staff.'"
- **Changes** (lines 307–313): reword "where you select and edit notes directly on the
  rendered staff" to the tree-selects / canvas-highlights split, keeping the rest of the
  paragraph (raw-JSON alternative, no-audio-yet, front-end SVG render, README
  cross-links) intact.
- **Acceptance** (lines 348–351): "The **Intro and mental model** paragraph no longer
  describes the canvas/staff as the selection surface," rest of paragraph intact.

This is the rejection's B2 fix verbatim (extend DT4's scope, reword the Intro, preserve
the rest). DT4 is still the only task touching `docs/song-format.md`.

---

## No-regression check — passes

- **No new tasks / no restructuring.** Still DT1–DT4 with the same titles and the same
  dependency chain (DT1 → DT2 → DT3 → DT4); the task-summary table (lines 365–370) is
  unchanged. The only deltas from the rejected version are the two scope/changes/
  acceptance extensions in DT1 and DT4 — no collateral edits to DT2, DT3, the
  behavior-delta section, or the drift bar.
- **Drift bar intact** (lines 34–44): `name` is "stored + round-trips" but **NOT
  consumed by the front end yet**; reordering remains out of scope; canvas
  click-to-select is "removed, not relocated — do not describe the canvas as a selection
  surface anywhere." Unchanged.
- **Proportional.** Still only `README.md` + `docs/song-format.md`; no new docs, no
  inline code-symbol/API reference (lines 6–7; reaffirmed in out-of-scope, 372–376).
- **Clean section boundaries — no double coverage.** "Forthcoming" appears only inside
  DT1 (lines 48–104); "Intro and mental model" appears only inside DT4 (lines 276–360).
  Neither overlaps DT2 ("Using the Piano block", README ~19–54, which owns the in-scope
  line-31/line-47 canvas-click references — prior N1) or DT3 ("For contributors",
  ~140–199).

The prior review's verified-correct findings (DT3/DT4 line-number citations; `name`
documented like `language`; right-sidebar Structure list removed; reordering deferred)
are carried forward unchanged and were not disturbed by the fix.

---

## Verdict

Both blocking issues closed with the exact prescribed scope extensions; no regression;
the drift-resistance bar holds. **Approved.**
