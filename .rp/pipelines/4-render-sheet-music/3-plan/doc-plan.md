# Doc Plan: Render the Piano block's song as visual sheet music (grand staff)

> Issue #4. This plan lists the documentation TASKS to run **after the code ships**
> (phase 4). The docs phase dispatches ONE fresh doc-writer per task, in order,
> each committing before the next. Every task below is self-contained: a doc-writer
> with only that task block, the shipped code, and the repo can complete it.
>
> **What the shipped feature changes for readers (the through-line every task
> serves).** The Piano block's FRONTEND now turns a conformant stored song into
> readable piano sheet music — a braced grand staff drawn as inline SVG by the
> plugin's own client-side rendering engine (no third-party notation library) —
> instead of echoing the raw JSON inside a `<pre>`. The EDITOR is unchanged
> (raw-JSON field + non-blocking validation notice; no in-editor preview). Display
> states: a conformant song renders SVG notation; an empty/whitespace song renders
> nothing; a present-but-non-renderable song (invalid JSON or non-conformant)
> renders nothing — no raw echo, no error message. The renderer ships a bundled,
> **renamed** subset of the Bravura music font under the SIL OFL 1.1 (`OFL.txt`),
> plus a small accessible label on the SVG.
>
> **Hard scope guards (do NOT document these — they are explicitly out of scope or
> not built; asserting them would be a false claim against the shipped code):**
> - No in-editor notation / live preview (the editor is untouched).
> - No third-party music-notation library (VexFlow / abcjs / OSMD / Verovio). The
>   engine is the project's own code; the font is a permitted *asset*, not a library.
> - No no-JS / server-side-rendering guarantee (rendering is client-side JS; notation
>   need not appear with JS disabled or in the initial crawler HTML).
> - No theme-adaptive color (the notation may use a fixed color).
> - No visible `metadata.title` / `metadata.composer` heading on the score (they feed
>   only the accessibility label).
> - No raw-JSON echo or error message on the frontend for non-renderable songs.
> - No audio, playback, playhead, per-note highlighting, or interactivity.
> - No change to the song format, the validator, or the format's vocabulary.
> - Do NOT duplicate symbol-level renderer API detail that belongs inline in the code
>   (e.g. exhaustive function signatures of `layout.js`); keep contributor docs at the
>   narrative/orientation altitude.
>
> **Existing docs (the only doc files in the repo — verified):** `README.md` and
> `docs/song-format.md`. There is NO CHANGELOG, CONTRIBUTING, or ARCHITECTURE file;
> this plan does not create one (the README's "For contributors" section is the
> contributor home). `src/block.json`'s `description` is user-facing metadata shown
> in the inserter and is treated as a doc surface here.

---

## Stale claims inventory (the concrete edits these tasks must land)

Recorded once so doc-writers can find every stale statement; each is assigned to a
task below.

- **README.md**
  - Status blockquote (≈ line 5): "rendered on the front end as escaped text"; "does
    **not** yet draw musical notation"; "notation rendering remain future work". → D1
  - "What the block does today" (≈ lines 13, 15): front-end HTML "renders the stored
    song **as escaped text** inside a `<pre>`"; "There is no playable keyboard, audio,
    or visual notation yet — v1 stores and shows the song *as text*". → D1
  - "Using the Piano block" → "### 4. What the front end shows (v1)" (≈ lines 45–54):
    the whole subsection describes the `<pre>` text echo and "v1 does not render
    musical notation". → D1
  - "For contributors" → "File layout" table (≈ lines 112, 116): `src/render.php` row
    ("the escaped, verbatim `song` passthrough"); `specs/` row (`render.spec.js`
    "front-end render + escaping"); add rows for the new `src/notation/*`,
    `src/view.js`. → D3
  - "For contributors" → "The song format and validator" → "**Render contract —
    verbatim escaped passthrough**" paragraph (≈ line 153): describes `<pre>` +
    `esc_html()` passthrough as the render contract. → D3
  - "For contributors" → "Tests" paragraph (≈ line 155): "a stored song renders
    verbatim in a `<pre>`; a hostile payload renders escaped and inert". → D3
  - "Forthcoming" (≈ lines 159–168): "**Visual notation rendering**" bullet listed as
    NOT part of v1 / future work — must be removed from the not-yet list (it has
    landed). → D1
- **docs/song-format.md**
  - "Intro and mental model" (≈ line 9): "There is no visual notation editor and no
    audio playback yet — those are future work"; and the cross-reference to README
    "[Using the Piano block] … what the front end shows". → D2
- **src/block.json**
  - `description` (≈ line 9): "Visual notation and audio playback are future work." →
    D4

---

## Tasks

### D1 — Update README user-facing sections: frontend now renders sheet music

- **Goal** — Rewrite the README's user-/site-builder-facing narrative so it states
  that the FRONTEND now renders a conformant song as piano sheet music (a braced
  grand staff, drawn as SVG by the plugin's own engine), that the EDITOR is unchanged
  (raw-JSON field + non-blocking validation; no in-editor preview), and that the three
  display states are: conformant → notation; empty/whitespace → nothing;
  present-but-non-renderable → nothing (no raw JSON, no error). Remove every claim that
  the front end shows the song "as escaped text in a `<pre>`" or that notation is
  future work.
- **Audience** — Site builders / end users authoring a Piano block (and anyone reading
  the README top-down to learn what the block does).
- **Files**
  - `README.md`
- **Sections-scope** (only these sections; D3 owns the contributor sections):
  - The top **Status** blockquote.
  - **"What the block does today"**.
  - **"Using the Piano block"** — specifically rewrite **"### 4. What the front end
    shows (v1)"** (its `<pre>`/"as text" framing and the "v1 does not render musical
    notation" expectation); the insert/enter-a-song/validation subsections (§1–§3) are
    accurate and stay as-is except where they cross-reference §4.
  - **"Forthcoming"** — remove the "Visual notation rendering" item from the
    not-yet-built list (audio playback, visual authoring UI, and richer notation
    elements remain).
  - **"Building & installing into an existing site"** — the success-criteria sentence
    that ends "shows that song as escaped text on the front end" must be corrected to
    the new render behavior.
- **Depends on** — none.
- **Traces to** — spec req 1, 7, 8, 13 and AC1, AC6, AC7, AC11; design §1, §2.5; code
  plan T8, T9, T10. Out-of-scope guards: no editor preview, no library, no theme color,
  no title/composer heading, no audio/interactivity.
- **Acceptance**
  - The README states the frontend renders a conformant song as visual piano sheet
    music (a braced grand staff) drawn by the plugin's own code; no remaining sentence
    says the front end shows the song "as escaped text" or "as text" in a `<pre>`.
  - The three frontend display states are described: conformant → sheet music;
    empty/whitespace → nothing; present-but-non-renderable (invalid JSON or
    non-conformant) → nothing, with NO raw-JSON echo and NO error message.
  - It states the EDITOR is unchanged (raw-JSON field + non-blocking validation notice,
    no notation preview in the editor).
  - "Visual notation rendering" no longer appears in "Forthcoming" as not-yet-built;
    audio playback, visual authoring UI, and richer notation elements remain there.
  - The "Building & installing" success sentence reflects rendered notation, not
    escaped text.
  - No claim of an in-editor preview, a notation library, theme-adaptive color, a
    visible title/composer heading, audio, or interactivity is introduced.

---

### D2 — Correct docs/song-format.md's "no visual notation yet" framing and frontend cross-reference

- **Goal** — Fix the song-format reference's stale statements that there is no visual
  notation yet and update its cross-reference so a reader is pointed at the README's
  now-accurate description of what the frontend renders. Do this WITHOUT changing any
  format definition, field, value, range, inheritance rule, or the annotated example —
  the format itself is unchanged by issue #4.
- **Audience** — Song authors (site builders writing the JSON) reading the canonical
  format reference.
- **Files**
  - `docs/song-format.md`
- **Sections-scope**:
  - **"Intro and mental model"** — the sentence "There is no visual notation editor and
    no audio playback yet — those are future work" and the cross-reference line to the
    README. The format-description sentences in the same paragraph (it is its own
    small format, models a grand staff, stored in the `song` attribute) stay.
  - Permitted: the **"How a stored pitch resolves to a sounding pitch"** section's
    "forward-looking … no audio in v1" framing may keep its audio caveat but must not
    claim notation is unrendered; adjust only if it implies the frontend shows no
    notation. Leave audio statements intact.
  - OUT of scope (do not touch): "Top-level shape", "metadata", "defaults and
    sections", "measures", "tempo and timeSignature", "Per-hand context", "Events",
    "Pitches", "Note-name systems", "Barlines and repeats", "Additive growth", and the
    "Annotated example song" — the format is unchanged.
- **Depends on** — D1 (so the README's "what the frontend shows" target exists in its
  updated form before this doc points readers at it).
- **Traces to** — spec "Out of Scope" (no format/storage change) and req 1; design
  §1.1, §2.5 (the format is consumed unchanged). Guard: this issue does NOT change the
  format, the validator, or this document's definitions.
- **Acceptance**
  - The "Intro and mental model" no longer claims "no visual notation … yet"; it
    distinguishes that the EDITOR still has no visual notation editor (authoring is
    still raw JSON by hand) while the FRONTEND now renders the song as notation.
  - The cross-reference still links to the README for the editor workflow / what the
    frontend shows, and that link resolves to a section that now describes rendered
    notation (consistent with D1).
  - Audio is still correctly described as not-yet-implemented.
  - No format definition, field, value, range, inheritance rule, or the annotated
    example is altered (a diff touches only intro/cross-reference framing, not the
    format spec).

---

### D3 — Update README "For contributors" for the notation renderer, render contract, file layout, and tests

- **Goal** — Bring the contributor section in line with the shipped architecture:
  describe the new client-side notation renderer at an orientation altitude (a thin
  `viewScript` entry → a pure layout-model layer → a thin SVG-emit layer, with a
  swappable glyph map and the bundled font), replace the stale "verbatim escaped
  passthrough" render contract with the new `render.php` container + inert JSON
  `<script>` contract (including WHY `<` is escaped as `<` rather than
  `esc_html`), update the File layout table and the Tests paragraph, and tell a
  contributor how to exercise the renderer with the annotated sample song. Keep it
  narrative — do NOT duplicate per-function API detail that lives inline in the code.
- **Audience** — Contributors / maintainers extending or debugging the plugin.
- **Files**
  - `README.md`
- **Sections-scope** (the "For contributors" area only; D1 owns the user-facing
  sections):
  - **"For contributors" → "File layout"** table: correct the `src/render.php` row
    (now a container + inert JSON `<script>`, not a `<pre>` passthrough) and the
    `specs/` row (`render.spec.js` now covers SVG render + the three display states +
    injection safety, not `<pre>` escaping); ADD rows for the new modules
    `src/view.js` (the frontend `viewScript` entry), `src/notation/` (the rendering
    engine: `layout.js` pure layout model, `svg.js` SVG emit, `glyphs.js` glyph map,
    `constants.js`, the bundled `pb-music.woff2` + `OFL.txt`), and note
    `src/song/normalizeStep.js` (the shared note-name helper) if not already present.
  - **"For contributors" → "The song format and validator" → the "Render contract"
    paragraph**: replace "verbatim escaped passthrough" with the new contract —
    `render.php` emits a block wrapper containing an inert `<script
    type="application/json">` that carries the raw song; it still outputs NOTHING for
    an empty/whitespace song; it performs NO validation (the frontend `view.js` owns
    the render-or-nothing decision); document the `<` script-breakout escaping
    and WHY `esc_html`/`htmlspecialchars` is wrong here (raw-text `<script>` does not
    decode entities) — at a contributor-orientation level, not a code transcription.
  - **"For contributors" → "Tests" paragraph**: update the front-end test description
    ("renders verbatim in a `<pre>`; hostile payload renders escaped and inert") to the
    new behavior (conformant → `<svg role="img">` grand staff and the raw JSON is not
    shown; empty → nothing; non-renderable → nothing; hostile text inert via
    `textContent`); add that the pure layout layer has Jest unit tests under
    `src/notation/__tests__/`; note the editor tests are unchanged.
  - Add a short **"exercising the renderer"** note (a new subsection OR a sentence in
    an existing contributor subsection — doc-writer's choice, kept brief): the
    annotated example song in `docs/song-format.md#annotated-example-song` is the
    full-coverage fixture; pasting it into a published Piano block and viewing the post
    renders the grand staff on the frontend.
- **Sections-scope (explicitly NOT in scope here)** — "The build model", "Scripts",
  "Requirements", "Quick start" remain accurate and unchanged except where the File
  layout table or Tests paragraph naturally reference them; do not restate scripts.
- **Depends on** — D1 (shared file; D1 lands the user-facing edits first to avoid
  collisions; D3 edits only the contributor sections).
- **Traces to** — spec req 1, 7, 8, 10, 12 and AC1, AC7, AC10; design §2.2, §2.3, §3,
  §6.8, §8; code plan T1, T4–T8, T9, T11. Guards: no library (own-code engine + font
  asset), no editor change, keep API detail inline in code (orientation only here).
- **Acceptance**
  - The File layout table has accurate rows for `src/render.php` (container + inert
    JSON `<script>`), `src/view.js`, the `src/notation/*` modules (including the
    bundled font + `OFL.txt`), and reflects the updated `specs/render.spec.js` scope;
    no row still describes a `<pre>` passthrough.
  - The "Render contract" paragraph describes the container + inert JSON `<script>`
    transport, that PHP does no validation, that empty/whitespace still outputs
    nothing, and the `<` escape (and why `esc_html` is wrong) — with no remaining
    "verbatim escaped `<pre>` passthrough" claim.
  - The Tests paragraph describes SVG-based frontend behavior (conformant → SVG grand
    staff, raw JSON not shown; non-renderable → nothing; hostile text inert) and the
    new `src/notation/__tests__/` unit tests; no "renders verbatim in a `<pre>`" claim
    remains.
  - The renderer is described as the plugin's OWN code with a bundled music-font asset
    — explicitly NOT a third-party notation library.
  - A contributor can find how to exercise the renderer with the annotated sample song.
  - No per-function/symbol-level API duplication of the notation modules is introduced.

---

### D4 — Update src/block.json description so visual notation is no longer "future work"

- **Goal** — Correct the block's user-facing `description` metadata (shown in the
  inserter / block details) so it no longer says visual notation is future work — the
  frontend now renders the song as sheet music — while keeping audio playback correctly
  described as not-yet-implemented.
- **Audience** — End users browsing the block inserter (the description is surfaced in
  the editor UI), and maintainers reading block metadata.
- **Files**
  - `src/block.json`
- **Sections-scope**:
  - The `"description"` field ONLY. Do NOT change `name`, `title`, `category`, `icon`,
    `keywords`, `textdomain`, `attributes`, `editorScript`, `style`, `render`, or add
    `viewScript` (the `viewScript` wiring is owned by code task T10, not this doc task);
    `version` is not bumped by this doc task.
- **Depends on** — none.
- **Traces to** — spec req 1 and AC1; design §1; the design's "Open items" note that
  `block.json`'s description called notation future work. Guard: audio is still future
  work; do not claim audio or interactivity.
- **Acceptance**
  - `src/block.json`'s `description` no longer states that visual notation is future
    work; it conveys that the block stores a grand-staff song and renders it as piano
    sheet music on the frontend.
  - Audio playback (and any interactivity) is either omitted or still described as
    future/not-yet, not claimed as present.
  - Only the `description` value changed; the JSON remains valid and all other keys are
    untouched.

---

## Coverage check (reader-impacting changes → tasks)

| Change the shipped feature makes for readers | Task |
|---|---|
| Frontend renders a conformant song as a braced grand staff (was `<pre>` text echo) | D1, D3 |
| Empty/whitespace → nothing; non-renderable → nothing (no raw, no error) | D1, D3 |
| Editor unchanged (raw-JSON field + validation; no in-editor preview) | D1 (state), D2 (authoring still raw JSON) |
| "Visual notation rendering" removed from README "Forthcoming" not-yet list | D1 |
| song-format.md "no visual notation yet" framing + frontend cross-reference corrected | D2 |
| New render contract: container + inert JSON `<script>`, `<` escape, PHP no-validate | D3 |
| New renderer modules (`view.js`, `src/notation/*`) in File layout + tests update | D3 |
| Bundled RENAMED Bravura font + SIL OFL 1.1 (`OFL.txt`) license/attribution | D3 |
| How to exercise the renderer with the annotated sample song | D3 |
| `block.json` description no longer calls visual notation "future work" | D4 |

Note on the font/OFL attribution: the SIL OFL 1.1 license text ships as the committed
`src/notation/OFL.txt` beside the renamed font (code task T9), which is the formal
license/attribution surface. D3 surfaces it for readers (the bundled renamed-Bravura
asset under OFL, with `OFL.txt` as the authority) within the contributor section rather
than as a separate task — there is no separate legal/attribution doc file in the repo,
and creating one is not warranted; if the docs phase prefers a dedicated NOTICE/credits
file, that is an additive option, but the committed `OFL.txt` already satisfies the
license-redistribution obligation.

## Sequencing & collision notes

- **Order: D1 → D2 → D3 → D4.** D1 and D3 both edit `README.md` but disjoint sections
  (D1 = user-facing Status / "What the block does today" / "Using the Piano block" §4 /
  "Forthcoming" / install success line; D3 = "For contributors" only); D1 runs first so
  the user-facing target sections exist for D2's cross-reference and so the two
  README tasks never touch the same lines. D2 depends on D1 (cross-reference target).
  D4 is independent and last.
- **No blockers found.** The shipped scope is decision-complete and every reader-facing
  change maps to a checkable doc edit against the existing files. No CHANGELOG/
  CONTRIBUTING/ARCHITECTURE file exists or is created.
