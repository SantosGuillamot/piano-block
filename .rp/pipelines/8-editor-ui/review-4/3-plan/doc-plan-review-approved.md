# Doc-plan review — Review 4 — APPROVED

**Verdict:** Approved.
**Reviewer:** doc-plan-reviewer (review-4).
**Artifact under review:** `.rp/pipelines/8-editor-ui/review-4/3-plan/doc-plan.md`.

## Summary

The one-task doc plan (DT1 — fix the README §2 "Browse and select with the
structure tree" paragraph) is **complete, drift-resistant, and proportional**. The
key risk for review 4 was **under-scoping** — a deliberately small plan silently
missing a README claim that review 4 falsifies. I scanned the live `README.md` and
`docs/song-format.md` for every "open/closed/toggle/default" and
"highlight/scroll/select" statement and confirmed the plan caught the only two
falsified claims, and that every claim it labels "no change" is genuinely still
true.

## Completeness — no missed falsified claim (verified line-by-line)

**Open-by-default (Req 1 / AC1).**
- `README.md:29` opening sentence ("A **toolbar button (Structure)** toggles a
  **structure tree** open and closed…") — the only place that describes the toggle
  as the *open* mechanism. DT1 targets it. ✓
- Lines 5, 12, 19 call the tree "toggleable" — verified each, and **none** says
  "hidden/closed by default" or "toggle it open"; "toggleable" stays accurate after
  the default flip (the tree is still closeable/reopenable). Correctly left out of
  scope. ✓
- Line 27 ("opens to a visual editor by default… empty grand staff") is about
  editor *mode* + the seeded staff, not the tree's open/closed state — not
  falsified. ✓
- Line 142 (`src/edit.js` "owns the `showTree` toggle…") — `showTree` is still a
  toggle (now defaulting `true`); not falsified. ✓ (Review 4 also adds the T7
  `collapsedOverride` Set, but the row's "expanded-path state" phrasing is
  non-exhaustive architecture prose and is not made *false* — acceptably left.)

**No section/measure highlight + no scroll (Req 4 / AC4).**
- `README.md:29` selection sentence ("**highlights and scrolls to** the matching
  element…") is the **only** place asserting a section/measure highlight and the
  **only** "scrolls to" claim anywhere in `README.md` (grep-confirmed). DT1 limits
  the highlight to notes and removes "scrolls to." ✓
- DT1's removal of "scrolls to" for **all** selections (not just section/measure) is
  correct and well-grounded: code-plan T4 prunes `scrollGroupIntoView` and forbids
  adding scroll to the event branch, so after review 4 **no** selection scrolls the
  canvas. This subtle point (the note also stops being described as scrolling) was
  correctly caught. ✓
- The generic "selection highlighting" / "highlights the current selection" phrasings
  on README lines 5, 12, 19, 49, 205 are **not** falsified: the **note** highlight
  remains, so the generic claim still holds; none of them specifically asserts a
  *section/measure* highlight. Correctly left unedited. ✓

**`docs/song-format.md` — no change (verified).**
- Line 9 ("the canvas displays the song and **highlights the current selection**") —
  generic, true via the surviving note highlight. ✓
- Line 122 ("a free-text label the visual editor shows in the structure tree… edit
  it from the **Section / Measure** inspector panel") — sections/measures still
  appear in the tree and still have inspector panels after the reorder. ✓
- Line 60 (language selector) — untouched by review 4. ✓
- No format/schema/render change this review, so the "no change" finding is correct.

**Panel order (Req 6) — correctly "no change."**
- README lists Note → Measure → Section → Song (lines 37–41) as a **panel
  inventory**, not as a claim that the sidebar order is selection-driven /
  most-specific-first. The new render order coincides with the listed order, so
  nothing stated is now false. ✓

**Invisible polish (Req 2 indentation, Req 3 button theming, Req 5 smaller note
highlight, Req 7 collapse fix) — correctly "no change."** The README never
characterizes row indentation, button chrome, or the highlight's size/weight, and
"sections and measures **expandable and collapsible**" (line 29) stays true after the
collapse bug fix. No invented docs for reader-invisible changes. ✓

## Proportionality

One task, with explicit "no change" findings for `song-format.md` and for the README
panel-order / indentation / theming / collapse / contributor prose. The plan does not
fabricate documentation for reader-invisible polish. A 1-task plan is the right size
here and it is complete.

## Form / drift-resistance

DT1 names the file (`README.md` only), the audience (Piano-block authors), and a tight
section-scope (the §2 "Browse and select with the structure tree" paragraph), with
verbatim before/after sentence anchors, an explicit "do not touch lines 5/12/19/37–41/
contributor section" fence, and a "keep the *clicking the staff does not select* clause
verbatim" instruction. It traces cleanly to Spec Req 1/AC1 + Req 4/AC4, design-doc
KD1/KD4, and code-plan T1/T4. No inline code-symbol documentation, no pipeline
references.

## Conclusion

Approved with no required changes. The plan is honestly scoped, catches both falsified
claims (and the easily-missed "scrolls to" removal), and correctly leaves every
non-falsified claim untouched.
