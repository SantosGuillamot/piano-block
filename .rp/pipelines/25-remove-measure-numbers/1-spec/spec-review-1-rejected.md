# Spec Review

## Verdict: rejected

## Summary

The spec is strong on the substance of the feature: the core removal requirement
(R1/Req1), the non-regression guarantees for above-staff content (Req3), the
no-orphaned-whitespace constraint (Req4), and the internal-index preservation
(Req5) are all accurately grounded in the source, kept at the WHAT level (the
spec correctly avoids leaking implementation names like `showsMeasureNumber` /
`innerZone`), and are testable against real artifacts (`data-text="measure-number"`,
`data-measure`, the per-system top margin). I verified every code reference the
spec relies on. However, Requirement 2 misdescribes the block's rendering
architecture: it asserts an "editor preview" and a "saved/front-end render" as two
notation outputs that must match. Neither exists as stated — the editor renders
only a raw-JSON textarea (no notation), and the block is a dynamic block whose
notation is drawn exclusively client-side on the front end. This is a real
factual error in a normative requirement, so I am rejecting. The fix is small and
localized to Requirement 2 (and the matching sentence in the Overview/AC framing).

## Issues

### Issue 1: Requirement 2 invents an "editor preview" and a "saved render" that do not exist

**What's wrong:** Requirement 2 states: "The change applies identically to the
editor preview and to the saved/front-end render (both produce the same notation
output)." This describes two distinct notation outputs that must agree. In the
actual codebase there is exactly one notation render path, and it is neither of
these:

- The editor (`src/edit.js`, the `editorScript`) renders **only** a
  `TextareaControl` with the raw `song` JSON — it never builds or draws the
  notation. There is no editor preview of the score.
- The block is a **dynamic** block (`src/block.json` declares `"render":
  "file:./render.php"`). `src/render.php` emits only a wrapper `<div>` containing
  the song JSON inside an inert `<script>`; it performs no notation rendering.
  There is no static "saved" SVG.
- The notation is drawn **once**, client-side, on the front end by
  `src/view.js` (`buildLayoutModel` → `renderInto`, view.js:133-134). That is the
  sole path that ever emits the measure-number label.

So "both produce the same notation output" is vacuously about a topology that
isn't there. The premise that there are two render paths to keep in sync is false;
there is one. The same mischaracterization is implied by the Overview ("the
saved/front-end render (both produce the same notation output)") and underpins
AC2's framing.

**Where in spec:** Requirement 2 (lines 28-31); also the Overview's reliance on a
"saved/front-end render" and the spec-research R2 it was lifted from
(spec-research.md:163-165).

**Suggestion:** Reword Requirement 2 to reflect the single render path, e.g.:
"Removal is unconditional — no setting, attribute, or mode re-enables measure
numbers (the block exposes only the `song` attribute; no toggle exists today and
none is added). Because the Piano block renders its notation through a single
client-side path (the front-end `view.js`, which is the only place the notation
is drawn — the editor shows only a raw-JSON field and the dynamic block emits no
static SVG), the removal necessarily applies everywhere the notation can appear."
Drop the "editor preview" and "both produce the same notation output" phrasing, or
replace it with an accurate statement that there is one render path.

**Why it matters:** A normative requirement that names non-existent surfaces will
mislead the design/plan/code phases and any test author. Someone could waste
effort hunting for an editor preview to verify, or write an acceptance check
against a "saved render" that the dynamic block never produces. A spec is the
contract for "what must be true"; a requirement built on a false architectural
premise undermines that contract even when the feature work happens to land in the
one real path.

### Issue 2: AC2 ("output is unchanged") leans on the same false dual-path premise and is weak as written

**What's wrong:** AC2 (lines 70-72) reads: "Given a song that fits on a single
line, when the notation is rendered, then the output is unchanged (it never
carried a measure-number label)." Two problems: (a) "unchanged" is defined
relative to a baseline the spec never pins down, so it is hard to write a crisp
test from — unlike AC1, which asserts a concrete checkable fact (no
`data-text="measure-number"` node); and (b) the "rendered" surface inherits the
Issue 1 confusion about which render path is meant. The genuinely useful assertion
here is simply that a single-system render also emits no measure-number node — the
same positive check as AC1, just for the one-system case.

**Where in spec:** Acceptance Criteria, AC2 (lines 70-72).

**Suggestion:** Restate AC2 as a concrete negative-emission check consistent with
AC1, e.g.: "Given a song that fits on a single system, when the notation is
rendered, then no measure-number node is emitted (as before — a single-system
score never carried one), and no other above-staff element is added or shifted by
the change." This removes the dependence on an unstated baseline and on the render
topology.

**Why it matters:** Acceptance criteria must be specific enough to write tests
from. "Output is unchanged" relative to an undefined baseline is not directly
testable, and once Issue 1 is fixed the criterion should be expressed in terms of
the single real render path. Tightening it keeps the criteria internally
consistent (AC1 and AC2 in the same observable form).
