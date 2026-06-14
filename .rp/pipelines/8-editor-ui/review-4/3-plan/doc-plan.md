# Doc plan: Review 4 — Structure-tree polish

Review 4 is a small editor-side polish pass (defaults, indentation, button
theming, highlight trimming, panel order, collapse fix). It changes **no** song
format/schema, **no** `render.php`, and **no** front-end render — so
`docs/song-format.md` needs **no change** (confirmed below), and the user-facing
README needs edits in exactly **one paragraph**, because most of the review's
items are reader-invisible polish.

Two of the seven code changes touch a claim the README currently makes; the rest
do not surface in the docs at all. Honest scope: **one doc task**, plus an
explicit "no change" finding for `song-format.md` and for the README's panel,
indentation, theming, and collapse prose.

## What was checked and found to need NO doc edit

- **Req 5 (smaller note highlight)** — reader-invisible polish; the README never
  characterizes the highlight's size/weight. No edit.
- **Req 2 (indentation)** / **Req 3 (button theming)** — purely visual chrome;
  the README does not describe row indentation or button styling. No edit.
- **Req 7 (collapse fix)** — a bug fix; the README's "sections and measures
  **expandable and collapsible**" (line 29) stays true. No edit.
- **Req 6 (panel order)** — the README lists the panels (Note → Measure →
  Section → Song, lines 37–41) but makes **no claim** that the order is
  selection-driven/most-specific-first, so nothing it states is now false. The
  listed order already happens to match the new order. No mandatory edit.
- **`docs/song-format.md`** — no schema/format/render change this review; its
  one relevant sentence ("the canvas displays the song and highlights the current
  selection", line 9) stays true because the **note** highlight remains. No edit.
- **README contributor section** (file-layout table, lines 142–143; the
  now-dormant hit-rect note, line 158–160) — internal/architectural prose that
  review 4 does not falsify (`showTree` is still a toggle; `SongCanvas` still
  "decorates the selection's highlight" — true for notes). No edit.

The only review-4 changes that touch a user-facing claim are **Req 1 (open by
default)** and **Req 4 (no section/measure canvas highlight)** — and both land in
the same README paragraph (the "Browse and select with the structure tree"
paragraph, line 29). They are therefore handled as one task.

---

## DT1 — Fix the structure-tree "Browse and select" paragraph (open-by-default + removed section/measure highlight/scroll)

**Goal.** Correct the two now-false claims in the README's "Browse and select
with the structure tree" paragraph so it reflects review 4:
1. the structure tree is **open by default** when the block is selected (the
   toolbar button now **closes and reopens** it, rather than being the thing that
   opens it);
2. selecting a **section or measure** no longer **highlights or scrolls to**
   anything on the canvas — only a **note** highlights, and the scroll-to behavior
   is gone for all selections.

**Audience.** Authors using the Piano block (the "Using the Piano block"
workflow reader).

**Files.** `README.md` only.

**Sections-scope.**
- **Primary:** the **"Browse and select with the structure tree"** paragraph
  under §2 "Build the song in the visual editor" — currently `README.md:29`. Two
  sentences in it change:
  - The opening sentence, currently:
    "A **toolbar button (Structure)** toggles a **structure tree** open and closed
    beside the canvas (to its left)." — reword so the tree is described as **open
    by default** beside the canvas when the block is selected, with the **toolbar
    button (Structure)** **closing and reopening** it (it stays closed while you
    keep working, and reopens on the next click). Do **not** claim it must be
    toggled on to appear.
  - The selection sentence, currently:
    "**Selecting** a section, measure, or note row in the tree opens its settings
    in the **block settings sidebar** and **highlights and scrolls to** the
    matching element on the canvas; the canvas reflects the selection but
    **clicking the staff does not select**." — change the highlight clause so that
    **only selecting a note** highlights the matching note on the canvas; selecting
    a **section or measure** opens its sidebar panel but **does not** highlight (or
    scroll to) anything on the canvas (a section/measure indication is intended as a
    later follow-up). **Remove the "scrolls to" claim** — review 4 (code-plan T4)
    removes the scroll-into-view behavior along with the section/measure highlight,
    so no selection scrolls the canvas now. Keep the "**clicking the staff does not
    select**" clause verbatim — it is unchanged and still true.
- **Do NOT touch** lines 5, 12, 19 just because they call the tree "toggleable":
  that adjective is **still accurate** (the tree can be toggled closed/open) and
  none of them claims "hidden/closed by default," so they need no edit. Editing
  them is out of scope; keep the change surgical to the §2 workflow paragraph,
  which is the only place that describes the toggle as the open mechanism and the
  only place that asserts the section/measure highlight-and-scroll.
- Match the README's existing voice and **bold-term density** in the rewritten
  sentences (the surrounding prose bolds key UI nouns); do not add new headings or
  restructure the paragraph.

**Depends on.** Nothing.

**Traces to.** Spec Req 1 / AC1 (open by default, still toggleable) and Req 4 /
AC4 (no section/measure canvas highlight). Code-plan T1 (open-by-default flip) and
T4 (remove section/measure highlight **and** prune the scroll-into-view helper).
Design-doc KD1 and KD4.

**Acceptance.**
- The §2 "Browse and select with the structure tree" paragraph states the tree is
  **open by default** when the block is selected and that the **Structure** toolbar
  button **closes and reopens** it (no longer says the button is what makes the tree
  appear / that the tree starts hidden).
- That paragraph states that **only a note** selection highlights the canvas, and
  that selecting a **section or measure** highlights **nothing** on the canvas;
  the **"scrolls to"** claim is **removed** for all selections.
- The "**clicking the staff does not select**" clause is retained unchanged.
- No other README line is altered (lines 5/12/19 "toggleable", the panel list at
  37–41, and the contributor section are left as-is); `docs/song-format.md` is
  **not** modified.
- The rewritten sentences read in the README's existing register (bolded UI
  nouns, no new structure).

---

## Out of doc scope (no task)

- `docs/song-format.md` — unchanged this review (no format/schema/render change).
- README §2 panel list / order prose, the indentation, button-theming, and
  smaller-note-highlight visual polish, the collapse-bug fix, and the contributor
  file-layout/architecture notes — none asserts a claim review 4 falsifies, so
  none is edited.
