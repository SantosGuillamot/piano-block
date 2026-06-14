# Doc Plan Review — REJECTED (iteration 1)

**Verdict:** REJECTED
**Reviewed:** `doc-plan.md` (DOC1–DOC7) against `spec.md`, `design-doc.md`, `code-plan.md` (T1–T7), and the real repo docs (`README.md`, `docs/song-format.md`, `AGENTS.md`, `specs/render.spec.js`, `package.json`, `src/block.json`).

The plan is well-structured, drift-conscious, and correct on most boundaries: the README section anchoring (DOC1–DOC4) is line-accurate and non-overlapping, the version-floor and dependency-invariant guards (DOC7) target real lines (README L92, L122), the song-format.md/AGENTS.md guard (DOC6) correctly verifies the cross-link anchors stay stable, and the doc/code boundary is right for the symbol-level docblocks (render.php top comment, view.js top comment, piano-block.php docblock → code phase T3/T5/T4) and the AC8 in-test comments (→ code phase T6).

But it has **one material completeness gap** that defeats the plan's stated purpose ("catch EVERY place the migration creates doc drift"), plus two smaller drift-resistance fixes. The first issue is sufficient on its own to reject.

---

## Issue 1 (blocking) — Stale `<script>`-carrier / `viewScript` narrative comments in `render.spec.js` fall in NO task (neither the code phase nor this doc plan)

**What's wrong.** DOC5 corrects exactly one stale test comment — the AC7-wrapper note at `specs/render.spec.js` ~L554–555 — and both DOC5 and the plan's "Out of scope" section assert this is the **only** remaining stale comment (T6 handles the AC8 ones; "the one stale AC7-wrapper comment … is DOC5 below"). That is factually wrong. Independently grepping `render.spec.js` for `viewScript|inert|<script>|application/json|carrier|ETAGO|interactive flag` surfaces **three more clusters of stale route-A narrative** that the code phase's T6 does **not** touch (T6 is scoped to "the AC8 test only," roughly L627–697) and that **no DOC task covers**:

1. **The file-level header doc-comment (lines ~1–24)** — not inside any test, so T6 never reaches it:
   - L6: "the client-side notation the **`viewScript`** (`view.js`) draws from the song the server-rendered container carries"
   - L12: "the wrapper may exist with **the inert JSON `<script>` inside**, but no SVG"
   - L23–24: "the old `esc_html(<pre>)` guarantee now lives in **the `render.php` ETAGO escape** + the SVG `textContent` emit"
   These describe route A (classic `viewScript`, inert `<script>` carrier, hand-rolled ETAGO/`<` escape) as current behavior — exactly the facts the migration invalidates.

2. **The AC1/AC2/AC12 test (`test(...)` at L483–540), inside it:**
   - L528: "`view.js` renders without the **`interactive` flag**, so the front-end SVG stays byte-identical" (route-A framing of how the script runs)
   - L534: "A successful render replaces **the inert JSON `<script>` carrier** with the SVG, so it is no longer in the DOM"
   This is a *different test* from the AC8 test T6 edits and from the AC7 test DOC5 edits, so it is uncovered.

3. **The AC11 test (`test(...)` in the "hostile free text in a note renders inert" describe at L869–920), inside it:**
   - L912–914: "no live (executable) `<script>` exists **beyond the inert JSON carrier**"
   - L917: the locator `.${BLOCK_CLASS} script:not([type="application/json"])` — the assertion still *passes* under route B (there is no `application/json` carrier, so the negation still selects all scripts → count 0), but the **comment explaining why it is written that way** is now false (there is no carrier to be "beyond"). Note: code-plan T6 explicitly fixes this exact pattern for the *AC8* copy (L658), which proves the pattern is in-scope drift — but the *AC11* copy is left stale by both plans.

**Why it matters.** These are precisely the narrative/non-symbol test comments the plan itself assigns to the doc phase (the same rationale that justifies DOC5: "the one comment the code phase does not touch … is DOC5 below"). Leaving them stale means a contributor reading `render.spec.js` after the migration is told the block still uses a `viewScript`, still emits an inert `<script>` carrier, and still relies on a `render.php` ETAGO escape — all dropped by route B. The plan's own DOC7 carrier-residue sweep does **not** catch them either: DOC7's grep targets `README.md docs/song-format.md AGENTS.md` only, never `specs/render.spec.js`. So this drift survives the entire doc batch. It also contradicts DOC5's explicit acceptance claim that `grep -n "inert" specs/render.spec.js` "returns nothing once the code phase's T6 edits and this DOC5 edit are both in" — it will **not**, because of clusters 1–3 above.

**What would fix it.** Expand the test-comment scope so every stale route-A narrative comment in `render.spec.js` that the code phase (T6, AC8 test only) does not touch is owned by a doc task. Concretely, either broaden DOC5 from "only L554–555" to "every stale `viewScript` / inert-`<script>`-carrier / ETAGO narrative comment in `render.spec.js` outside the AC8 test T6 edits — the file header (~L6, L12, L23–24), the AC1/AC2/AC12 test (~L528, L534), the AC7-wrapper note (~L554–555), and the AC11 test (~L912–914, and the comment on the L917 `:not([type="application/json"])` locator)," or add a sibling task. Give it a concrete, verifiable acceptance: after the code phase's T6 and this task land, `grep -niE "viewScript|inert|application/json|carrier|ETAGO|interactive flag" specs/render.spec.js` returns nothing (or only a clearly-historical "previously…" mention), with the route-B facts asserted in their place (song in `data-wp-context`, core-encoder escaping, no carrier, the runtime owns boot). Also correct the false "only L554–555 remains" statement in DOC5 and in the "Out of scope for this doc plan" section.

---

## Issue 2 (drift-resistance) — DOC7's carrier-residue sweep excludes `specs/render.spec.js`, the file with the most surviving residue

**What's wrong.** DOC7 is billed as "a final repo-wide prose sweep" and "no 'inert `<script>` carrier' residue survives in **any** prose doc," but its grep (`grep -rniE "inert (json|application/json)? ?<script>|…|viewScript\b" README.md docs/song-format.md AGENTS.md`) omits `specs/render.spec.js` — the one file that demonstrably still contains `viewScript`, `inert … <script>`, and `application/json` after T6 (see Issue 1). So the "closing sweep" cannot detect the residue Issue 1 is about.

**Why it matters.** Even after Issue 1 is fixed by adding the comments to a doc task, the final guard should still verify them, or the plan has no backstop against a doc-writer missing one of the four clusters. As written, DOC7 gives false assurance.

**What would fix it.** Add `specs/render.spec.js` to DOC7's carrier-residue grep target set (scoped to comments — the route-B facts the song/title fixtures legitimately contain HOSTILE `</script>` literals as *test data*, e.g. L218–219, so the sweep must target comment lines, not string fixtures), and reconcile DOC7's dependency note (it already depends on DOC5; if Issue 1 broadens DOC5, DOC7 should sweep the broadened set).

---

## Issue 3 (minor, drift-resistance) — DOC1's README L13 edit should retire the "lightweight container carrying that song" phrasing explicitly, not just "client reads the song"

**What's wrong.** DOC1's acceptance for README L13 names the "client reads the song" carrier mechanism to retire, but the actual L13 sentence is *"PHP emits a **lightweight container carrying that song** to the front end. On a published page, the block's own **client-side code reads the song** and draws it …"*. The "lightweight container carrying that song … client-side code reads the song" framing is the route-A carrier described in user prose; under route B the song rides in per-instance `data-wp-context` and the Interactivity API runtime (not "the block's own client-side code") owns discovery/boot. DOC1's "Must NOT appear" list (inert `<script>`, application/json, carrier, viewScript, domReady) does not include the softer "container carrying that song / client-side code reads the song" phrasing actually on L13, so a literal-minded doc-writer could leave it.

**Why it matters.** Small, but it is the exact user-facing sentence that most directly states the old transport-and-boot model; leaving it half-edited reintroduces the "PHP carries / client reads" framing DOC1 exists to remove.

**What would fix it.** In DOC1's L13 acceptance, explicitly call out the "lightweight container carrying that song" + "the block's own client-side code reads the song" phrasing as the wording to replace (with the interactive-block / per-instance-context / runtime-hydrates framing), so the must-change target matches the literal text on L13.

---

## Drift independently confirmed as correctly covered (for the rewrite)

So the rewrite keeps what already works:

- README L13 (front-end prose), L76/L84 (what the front end shows) → DOC1 — anchors verified, "drawn in the browser" and "server does no validation" correctly preserved.
- README file-layout rows: block.json L140, render.php L147, view.js L148, accessibleName.js L151 (and the deliberately-untouched piano-block.php L139, notation/ L149) → DOC2 — all line-accurate; the L147/L148 inert-`<script>`/`viewScript`/"computes the accessible name" residue is real and correctly targeted.
- README build model L130 + Scripts L162/L163 (`viewScriptModule`, `--experimental-modules`) → DOC3 — matches code-plan T1/T2 and design D2/D26; the "not needed for test:unit/test:e2e" caveat is correct.
- README render contract L193, escape paragraph L195, "Exercising the renderer" L197, Tests front-end clause L199 → DOC4 — all four spots verified present and stale; route-B transport, core-encoder superset escape, server-computed name, and new AC9 multi-block coverage correctly assigned.
- Version floor stays 6.9 (README L92, L122) and the `@wordpress/interactivity` externalized-not-a-dependency invariant → DOC7 — confirmed against package.json (`dependencies` is only `@wordpress/icons`) and the design's D21.
- song-format.md needs no edit and its cross-links `#using-the-piano-block` / `#4-what-the-front-end-shows` resolve to headings DOC1–DOC4 do not rename; AGENTS.md carries no migration facts → DOC6 — both verified clean.
- Symbol-level docblocks (render.php/view.js top comments, piano-block.php docblock) correctly left to code-phase T3/T5/T4; AC8 in-test comments (~L654–656, ~L672–679) correctly left to code-phase T6.

Fix Issue 1 (and ideally 2 and 3) and the plan is approvable.
