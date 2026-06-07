# Doc Plan Review

## Verdict: rejected

## Summary

The plan is well-proportioned for a sub-staff-space internal rendering refinement,
and most of its reasoning holds up against the live repo: there is genuinely no
CHANGELOG (none anywhere in the tree, none referenced in `README.md`/`AGENTS.md`/`docs/`);
`README.md`'s `src/notation/` file-map row references `constants.js`/`layout.js`
only generically ("the shared sp/layout constants", "all musical geometry in
staff-space units") with no enumerated constant or pinned value; and the
`docs/song-format.md` `beat`/left-edge prose is an author-facing "which onset does
this anchor to" statement that survives the lead-in unchanged (a `beat: 0` / `beat`-absent
standalone annotation still resolves to the same `leadInset` frame — `layout.js:1604,1642` —
which simply grows by `MEASURE_START_PAD`, so the note moves rightward with the first
note while the documented semantic is untouched). The `AGENTS.md` "no `.rp/` references
in shipped docs" constraint is captured, D1's format is executable and verifiable, and the
boundary against the code phase is clean for the three comment sites it names. However, the
plan's central completeness claim is **factually wrong**: it asserts the only doc surfaces
the feature touches are inline comments in `constants.js`/`layout.js` that are "already
fully authored by the code phase," but a third stale narrative doc-comment in
`constants.js` is owned by neither the code plan nor the doc plan, and D1's verification
scope (README + song-format.md only) would not catch it in phase 5. That single gap is
enough to reject.

## Issues

### Issue 1: A stale narrative doc-comment (`ACCIDENTAL_LEAD_EXTRA`, `constants.js:139-145`) is owned by no phase and falls outside D1's scope

**What's wrong:** The `ACCIDENTAL_LEAD_EXTRA` doc-comment currently reads (verbatim,
`constants.js:139-145`):

> "Extra leading room, in sp, reserved at a measure's start when its first note draws an
> accidental — enough for the accidental glyph to sit between the measure boundary and the
> notehead. **With no accidental the opening note hugs the boundary; with one, the note
> shifts right by this much so the accidental occupies the freed space.**"

After this feature both bolded clauses are false:

- "With no accidental the opening note hugs the boundary" — the plain opening note now
  sits at `MEASURE_START_PAD = 1.0` sp, not hugging the boundary. This is exactly the
  "hug" narrative the spec (AC7) and the rest of the feature are scrubbing everywhere else.
- "with one, the note shifts right by this much so the accidental occupies the freed space" —
  under the `max()` composition the design adopts (Decision D3), an accidental-opening note
  lands at the **same** measure-relative position as a plain one (both resolve to
  `max(1.0, 1.0) = 1.0`); it no longer "shifts right by `ACCIDENTAL_LEAD_EXTRA`" relative to
  a boundary-hugging plain note.

This comment is owned by **neither plan**. The code plan references `ACCIDENTAL_LEAD_EXTRA`
only as the `max()` logic input (code-plan T3, line 194) and as a geometry fact in its
Overview — its enumerated comment-hygiene touch points are the new `MEASURE_START_PAD`
comment (T1), `BARLINE_POST_PAD` `:117-122` (T4), and `layout.js:1745-1749`/`:1971-1973`
(T3). The `ACCIDENTAL_LEAD_EXTRA` comment at `:139-145` appears in none of them, and the
design doc never names it as a touch-up either. The doc plan, in turn, explicitly tells
the writer to "Do NOT touch the inline doc-comments in `src/notation/constants.js`
(`MEASURE_START_PAD`, `BARLINE_POST_PAD`)" and confines D1's verification to `README.md`
and `docs/song-format.md`. So this stale comment is in nobody's scope and would ship
out of sync.

The plan's Overview makes a claim that this contradicts: "the only documentation surfaces
the feature actually touches are **inline doc-comments in `src/notation/constants.js` and
`src/notation/layout.js`**, and those are already fully authored by the code phase (code-plan
tasks T1, T3, and T4)." That sweep missed `ACCIDENTAL_LEAD_EXTRA`.

**Where in plan:** Overview (lines 11-21, the "repository-wide sweep" / "already fully
authored by the code phase" claim) and Task D1 Sections-scope (lines 60-64, the
`constants.js` "Do NOT touch" list, which enumerates only `MEASURE_START_PAD` and
`BARLINE_POST_PAD`).

**Suggestion:** Resolve the ownership of the `ACCIDENTAL_LEAD_EXTRA` doc-comment so it is
refreshed before phase 5 ships. Either (a) add a small D1 sub-scope (or a new doc task) that
owns refreshing this `constants.js:139-145` comment so it no longer says the plain opening
note "hugs the boundary" and no longer implies the accidental note shifts right past a
hugging plain note — staying at the what/where level, e.g. "describe `ACCIDENTAL_LEAD_EXTRA`
as the accidental's share of the per-measure opening slot, composed with the lead-in by the
larger-of rule, without claiming the plain opening note hugs the boundary"; or (b) if the
intent is for the code phase to own all `src/notation/` comment hygiene, flag back to the
code-plan-writer that code-plan T4 (or T3) must extend its comment-hygiene scope to include
`constants.js:139-145`, and correct the doc-plan Overview's claim accordingly. Whichever path
is chosen, the Overview's "fully authored by the code phase" sweep statement must be made
accurate.

**Why it matters:** This is the precise failure the doc phase exists to prevent — a piece of
shipped prose that names the affected behavior ("the opening note hugs the boundary") and is
left contradicting the code after phase 4. It is also a self-consistency defect: the feature
is removing "hug" language from test names and the `BARLINE_POST_PAD` comment, yet would
leave the identical "hugs the boundary" claim standing two stanzas away in the same file. As
written, no phase-5 task would even look at this comment, so it would silently ship stale.

### Issue 2: Overview overstates the completeness of its sweep

**What's wrong:** Independent of how Issue 1 is resolved, the Overview's framing
("A repository-wide sweep of the documentation surfaces ... found **no external or narrative
documentation that describes measure-start spacing, names the layout spacing constants, or
pins their numeric values**") is contradicted by `constants.js:139-145`, which is narrative
documentation that describes measure-start spacing for the accidental case and asserts the
plain-note hug. The sweep conclusion needs to be corrected to acknowledge this surface (and
either claim it for a doc task or hand it to the code phase, per Issue 1).

**Where in plan:** Overview, lines 11-16.

**Suggestion:** Revise the sweep statement so it is true after the resolution of Issue 1 —
e.g. enumerate `ACCIDENTAL_LEAD_EXTRA`'s comment as a narrative surface that goes stale and
state explicitly which phase owns its correction.

**Why it matters:** The Overview is the plan's justification for being a single
verify-only task with most surfaces "scoped out." If its foundational sweep claim is
inaccurate, a phase-5 writer (and a future reader) cannot trust the "deliberately scoped out"
reasoning that rests on it.
