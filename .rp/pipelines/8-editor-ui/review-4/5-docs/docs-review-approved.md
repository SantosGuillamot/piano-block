# Docs review — review-4 (DT1): APPROVED

**Verdict:** Approved. The docs batch (single task **DT1**) correctly and surgically
fixes the two now-false claims in the README's "Browse and select with the
structure tree" paragraph (§2), with no missed false claims elsewhere and no
over-reach into the review's invisible polish.

**Diff reviewed:** `git diff be8958e..HEAD` — one commit (`c0f0cbc`), one file,
one paragraph: `README.md:29`. No other doc file touched; `docs/song-format.md`
is unmodified, as the plan required.

## Accuracy vs shipped code — verified

- **Open by default.** The rewrite now says the structure tree is "**open by
  default** beside the canvas … whenever the block is selected" and the
  **Structure** toolbar button "**closes and reopens**" it (stays closed while
  you keep working, reopens on the next click). Matches the shipped code:
  `src/edit.js:108` is `const [showTree, setShowTree] = useState(true)`. The old
  "a toolbar button toggles a tree open and closed" framing (which implied the
  tree starts hidden) is gone.
- **Note-only highlight; no section/measure highlight; no scroll.** The rewrite
  states selecting a **note** "also **highlights** the matching note on the
  canvas," while selecting a **section or measure** "opens its panel without
  highlighting anything on the canvas (a section/measure canvas indication is a
  later follow-up)," and the old "**highlights and scrolls to**" clause is
  removed. Matches `src/editor/SongCanvas.js` `decorateSelection`, which
  early-returns unless `selection?.kind !== "event"` (line 97) — only a note
  decorates; section/measure decorate nothing. `grep -rn scrollIntoView src/`
  returns nothing, so the dropped "scrolls to" claim is correct for all
  selections.
- **"Clicking the staff does not select"** is retained verbatim in the rewritten
  paragraph — unchanged and still true.

## Completeness — no other now-false claim left unfixed

Re-scanned the full live `README.md` and `docs/song-format.md` for any other
claim review 4 falsifies (a "hidden/closed by default" precondition, or a
"selecting a section/measure highlights/scrolls the canvas" statement). None
found:

- **README lines 5 / 12 / 19** call the tree a "**toggleable** outline panel" —
  still accurate (the tree can be toggled closed/open; it simply now starts
  open). None of them asserts "hidden/closed by default," so none needed editing,
  and DT1 correctly left them untouched (the diff confirms only line 29 changed).
- **README "selection highlighting" / "highlights the selection" phrasing**
  (lines 5, 12, 19, 49, 205) is a general claim that the canvas highlights the
  selection — still true because the **note** highlight remains; none of these
  asserts that a section/measure specifically highlights, so none is now false.
- **README panel list (lines 37–41)** describes each panel's contents and that
  the Song panel is "always present" — it makes **no** claim about render order
  or most-specific-first, so Req 6 (panel reorder) falsifies nothing here.
- **README contributor section** — line 142 still describes `showTree` as a
  "toggle" (true); line 143 still calls `SongCanvas` "display + highlight only …
  decorates the selection's highlight" (true for notes); the dormant hit-rect
  note (line 160) is untouched by review 4. No edit needed.
- **`docs/song-format.md` line 9** — "the canvas displays the song and
  **highlights the current selection**" stays true because the note highlight
  remains. Correctly left unmodified.

## No drift / no over-reach

DT1 is exactly one paragraph. It does **not** invent docs for the review's
reader-invisible polish: no new prose for row **indentation** (Req 2), button
**theming** (Req 3), the **smaller** note highlight (Req 5), the **collapse fix**
(Req 7), or the **panel order** (Req 6). No new headings, no restructuring. The
rewrite reads in the README's existing register (bolded UI nouns, same voice),
contains no pipeline references, and adds no inline code-symbol documentation.

## Conclusion

The fix is accurate against the shipped code, complete (no missed false claim),
correctly scoped, and free of drift. Approved.
