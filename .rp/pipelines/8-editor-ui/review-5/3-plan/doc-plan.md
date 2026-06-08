# Doc Plan: Review 5 — Visible tree buttons, add-section in block settings, small note highlight

This is a **small editor-side polish pass**. Most of the three code changes are
reader-invisible and need **no** documentation. Only **one** change makes a live
README claim false: the **"Add section" affordance moved off the structure tree
(and out of the Section panel) into the always-present Song panel** in the
block-settings sidebar. That is the sole doc edit.

Honest scope assessment (per item):

- **Tree action buttons `tertiary` → `secondary` (Task 1 / KD1).** Pure styling
  (visible chips vs. near-transparent icons). The README already says the tree
  hosts "add/remove/duplicate" controls and does not claim they are invisible or
  hover-only, so nothing it states becomes false. **No doc edit.**
- **Small note highlight CSS (Task 3 / KD3).** The README describes the canvas as
  showing "selection highlighting" and "highlights the matching note on the
  canvas" — it never characterizes the highlight's *size* (thick box vs. thin
  line), so the thinner highlight does not contradict any sentence. Front-end
  rendering is byte-identical (AC4), so the front-end sections are untouched.
  **No doc edit.**
- **Add-section relocation (Task 2 / KD2).** The README **explicitly** says Add
  section "lives at the bottom of the tree" and that an "Add section /
  Remove section also appears" in the Section panel. Both are now **false**.
  **One doc edit** (Task D1 below).

`docs/song-format.md` needs **no** change: it documents the song *format* and
schema (unchanged this review). Its UI mentions point at the Section/Measure
panel for the `name` field and at the Song panel's Note-language selector —
neither says anything about where "Add section" lives — so nothing in it becomes
false. **No doc edit.**

Single doc task, single working tree.

---

## Task D1 — Update the README so "Add section" is documented in the Song panel, not the tree or Section panel

**Goal.** Correct the README's authoring-workflow prose so it states that **Add
section** is reached from the **block-settings sidebar's always-present Song
panel**, and **remove** the now-false claims that Add section lives at the bottom
of the structure tree and that an Add section button appears in the Section
panel. The author can still add sections; only the affordance's location changed
(Spec Req 2 / AC2; design KD2). Add-measure and per-hand Add-note stay in the
tree and must remain described as tree affordances.

**Audience.** Plugin authors/users reading the end-to-end visual-editor workflow.

**Files.** `README.md` only. (No `docs/song-format.md` change; no inline
code-symbol docs; no pipeline references.)

**Sections-scope.** Inside `## Using the Piano block` (and its line-1 status
summary only if it asserts the location, which it does not — leave it):

1. **`### 2. … → "Add, remove, and duplicate from the tree."` paragraph
   (currently README ~line 33).** This is the load-bearing false claim:
   > "**Add section** lives at the bottom of the tree, **Add measure** on each
   > section row, and per-hand **Add note** on each hand-group row — that per-hand
   > 'Add note' is how you seed the first note of an otherwise empty measure."

   Rewrite so **Add section is no longer described as a tree affordance**: drop
   "Add section lives at the bottom of the tree" and instead say Add section is in
   the **block settings sidebar (the always-present Song panel)**, while keeping
   **Add measure** (each section row) and per-hand **Add note** (each hand-group
   row) exactly as tree affordances, and keeping the "seed the first note"
   clause. Keep this paragraph's surrounding sentences (the "every level" add/
   remove/duplicate framing, Duplicate deep-copy behavior, "Reordering is not
   available") intact — only the **placement of Add section** changes. Be careful
   not to over-claim that *all* add controls left the tree; only Add section did.

2. **`### 2. … → "Configure the selection in the sidebar."` list, the Section
   panel bullet (currently README ~line 39):**
   > "A **Section** panel for a selected section — a **Name** field … and, behind
   > *Advanced*, the section's overrides. A convenience **Add section** /
   > **Remove section** also appears here."

   Remove the **Add section** half: the Section panel now offers only **Remove
   section** (the design removes its Add-section button, keeps Remove-section).
   Keep the Name field and Advanced/overrides description unchanged.

3. **`### 2. … → Song panel paragraph (currently README ~line 41):**
   > "A **Song** panel is **always present** in the sidebar … it holds the song's
   > title and composer and the song-wide musical defaults … When nothing is
   > selected, the sidebar shows just this Song panel."

   Add that the Song panel **also provides the Add section control** — this is the
   single, always-present home for adding a section (reachable even with nothing
   selected, which is the design's rationale for putting it here). Fold this into
   the existing sentence(s) naturally; do not restructure the paragraph.

**Consistency sweep (within `## Using the Piano block` only).** Check the section
intro at README ~line 19 — "run add/remove/duplicate at every level from that
tree" — it remains broadly true for measures/notes and for remove/duplicate of
sections; do **not** rewrite it unless, read literally, it implies *adding a
section* happens in the tree. If a light touch is needed, keep it minimal and
consistent with edits 1–3 (the tree is still where you add/remove/duplicate
measures and notes and remove/duplicate sections; adding a section is in the Song
panel). Do not touch front-end sections (`### 4`), the JSON/raw-mode section
(`### 3`), the format-reference cross-links, or any other heading — none make an
Add-section location claim.

**Depends on.** Nothing (sole doc task). Authored against the live `README.md`;
the implementation tasks (Tasks 1–3 of the code plan) and this doc edit are
independent edits to different files.

**Traces to.** Spec Req 2 / AC2 ("Add section moved to the block settings");
design KD2; code-plan Task 2.

**Acceptance.**
- README no longer says Add section "lives at the bottom of the tree" anywhere,
  and no longer lists an "Add section" button in the **Section** panel bullet
  (Section panel reads as **Remove section** only).
- README's **Song panel** description states that Add section is available there
  (the always-present home), reachable with nothing selected.
- **Add measure** (section rows) and per-hand **Add note** (hand-group rows)
  remain described as **tree** affordances; the "seed the first note" clause is
  preserved; Duplicate / "Reordering is not available" prose is unchanged.
- No other README section changed; `docs/song-format.md` unchanged. No new claims
  about button styling or highlight size were introduced (those changes stay
  undocumented as reader-invisible polish).
- The edit reads in the README's existing voice and density; no broken Markdown
  links or anchors.
</content>
</invoke>
