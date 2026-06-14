# Doc Plan — Move the Piano block's frontend JS to the Interactivity API (issue #9)

This plan turns the shipped Interactivity API migration into an ordered set of
documentation tasks a fresh `doc-writer` will execute **after the code lands**, so the
repo's prose docs accurately reflect the new frontend architecture. Each task is a
self-contained block (the doc-writer receives it verbatim): it names the audience, the
exact files and section anchors, what it depends on, what shipped change it traces to,
and how to verify the doc is drift-free.

## Orientation (read once before starting)

The migration moved the Piano block's frontend from a standalone classic `viewScript`
(`src/view.js` booting on `domReady`, reading the song from an inert
`<script type="application/json">` carrier nested in the wrapper) to the WordPress
**Interactivity API**:

- `src/block.json` now declares `"supports": { "interactivity": true }` and
  `"viewScriptModule": "file:./view.js"` (replacing `"viewScript"`).
- `src/render.php` emits a **childless** `<div>` carrying `data-wp-interactive="piano-block/piano"`,
  a per-instance `data-wp-context` (seeded by `wp_interactivity_data_wp_context()`) holding
  the **raw song** and a **server-computed accessible name**, and `data-wp-init="callbacks.init"`.
  The inert `<script>` carrier is **dropped**, and so is the hand-rolled
  `str_replace( '<', '<', … )` escape — the core context encoder now does the escaping
  (a superset: `<`, `>`, `'`, `"`, `&`).
- `src/view.js` is now an ES **script module** registering `store( 'piano-block/piano', { callbacks: { init } } )`.
  A single `data-wp-init` callback owns boot, the validate-once gate, the font-gated first
  draw, and the rAF-debounced resize observer; it reads the song and accessible name from
  per-instance context (`getContext()`) and the container from `getElement().ref`. It imports
  **only** `@wordpress/interactivity` plus relative `./notation/*` / `./song/*` modules — it no
  longer imports `@wordpress/dom-ready` or (via `accessibleNameFor`) `@wordpress/i18n`.
- The accessible name is now **computed on the server** in `render.php` (PHP `__` / `_x` / `sprintf`,
  the same four branches as `accessibleName.js`), so the view module needs no i18n.
- `piano-block.php` dropped the dead `wp_set_script_translations` call; block registration is
  otherwise unchanged.
- `package.json`'s `build` and `start` scripts now carry `--experimental-modules` (the
  toolchain only runs the webpack module pass with that flag on `@wordpress/scripts` 32.3.0).

What did **not** change, and must stay documented as-is:

- **The render-or-nothing decision is still 100% client-side** (the `validateSong` gate). The
  server still does **no validation** and emits no visible SVG. README L84's "the server does no
  validation" stays true (the server now computes only the accessible-name *string*, not a render
  decision — do not overstate this into "the server renders the notation").
- **The WordPress floor stays `6.9`** (the design dissolved the 7.0 module-translation caveat by
  computing i18n in PHP). Do **not** bump any "WordPress 6.9+" statement to 7.0.
- **The notation core, the song format/validator, and `accessibleName.js`** are frozen.
  `accessibleName.js` still serves the **editor** and is the JS authority the new PHP helper
  mirrors — it is no longer called by the front end.
- **The "imperative SVG mount" framing.** The SVG body is still built imperatively
  (`createElementNS` + `container.replaceChildren`); the Interactivity API win is ownership of
  boot/lifecycle/state, not declarative notation rendering. Where the README explains how the
  front end draws, keep this accurate (the store drives *when/with what*; the SVG emit is unchanged).

### Terminology to use (Interactivity API)

Use these exact terms: **interactive block**; **view module** / `viewScriptModule` (not
"viewScript"); **store** (`store('piano-block/piano', …)`); **per-instance context** /
`data-wp-context` / `getContext()`; **`data-wp-interactive`**; **`data-wp-init`** /
**init callback** / `callbacks.init`; **hydrate / hydration**; **Server Directive Processor (SDP)**.
The store namespace is exactly `piano-block/piano`. Do not call the new transport a "carrier"
(that word belonged to the dropped `<script>`). Do not introduce `state` or `actions` buckets in
prose — the store is **callbacks-only** today.

### Documentation surface (what exists, what is in/out of scope)

- **`README.md`** (root) — the **only** doc with material drift; carries the frontend-architecture
  prose, the file-layout table, the build model, the scripts list, the render contract, and the
  test summary. Most tasks below target it (non-overlapping sections).
- **`docs/song-format.md`** — author-facing **format** reference. It says only that the front end
  "renders the song as visual notation … an SVG" and that `language` / `name` are "not consumed by
  the front end yet"; it documents **no** frontend mechanism (no viewScript / carrier / transport).
  The migration does not change the song format or the front end's render-or-nothing behavior, so
  **song-format.md needs no changes** — verified in DOC6 below (a guard task), not edited.
- **`AGENTS.md`** — pipeline-hygiene guidance only; no migration facts. **Out of scope.**
- **`specs/render.spec.js`** narrative comments — the stale AC8 comments (~654–656 and ~672–679)
  are corrected by the **code phase** (code-plan T6, which edits that test). The one comment the
  code phase does **not** touch — the AC7-wrapper narrative at ~554–555 — is DOC5 below.
- **Symbol-level / docblock comments** written alongside the code (the `render.php` top doc comment,
  the `view.js` top doc comment, the `piano-block.php` function docblock) are the **code phase's**
  job (code-plan T3/T4/T5) — **out of scope** for this doc plan.

---

## DOC1 — README: front-end architecture prose (Interactivity API)

- **Task ID:** DOC1
- **Goal:** The README's narrative description of how the block reaches and renders on the
  front end describes the Interactivity API mechanism (interactive block, per-instance
  context, store-driven boot) instead of the old "PHP carries the song / client reads it"
  framing, without overstating what moved to the server.
- **Audience:** End users and site builders (the "what the block does" / "what the front end
  shows" readers), with enough accuracy for contributors who skim the intro.
- **Files:** `README.md` (modify).
- **Sections-scope:** Only these prose spots — **(a)** the "What the block does today" bullet at
  **L13** ("It is a **dynamic** (server-rendered) block … the block's own client-side code reads
  the song and draws it …"); **(b)** the "### 4. What the front end shows" section, specifically
  **L76** ("drawn as an SVG by the plugin's own client-side rendering code") and **L84** ("The
  notation is drawn entirely in the browser … the server does no validation …"). Do **not** touch
  the file-layout table, the build model, the scripts list, or the "render contract" / "tests"
  contributor subsections (DOC2–DOC4 own those).
- **Depends on:** (none).
- **Traces to:** Shipped `block.json` (`supports.interactivity` + `viewScriptModule`) and
  `render.php`/`view.js` rewrite; design D1/D8/D11/D12; spec R1/R2; code-plan T2/T3/T5.
- **Acceptance:**
  - L13 no longer implies a bespoke "client reads the song" carrier mechanism. It should say the
    block is an **interactive block**: the server (still dynamic / server-rendered) seeds each
    instance's song into per-instance Interactivity API context, and the WordPress Interactivity
    API hydrates each block on the page and draws the sheet music in the browser. Keep the
    "nothing at all when there is no song" clause (still true — `render.php` early-returns).
  - L76 stays accurate: the notation is still **drawn in the browser** by the plugin's own
    rendering code (no third-party notation library, bundled music font). Drawing-in-the-browser
    must remain — do **not** claim the SVG is server-rendered.
  - L84 keeps "**the server does no validation**" and "the front end decides whether to render"
    (the client-side gate is unchanged). If the accessible-name detail is mentioned here, it may
    note the name is computed server-side, but it must **not** say the server renders or validates
    the notation. The "no visible title/composer heading; metadata only labels the notation for
    assistive technology" point stays true and unchanged.
  - **Must NOT appear** in these spots: "inert `<script>`", "application/json", "carrier",
    "viewScript", "domReady". **Should appear:** "Interactivity API" and the per-instance /
    hydrates idea (in user-appropriate prose — directive attribute names are optional here, they
    belong in the contributor sections).
  - No "WordPress 6.9+" / version statement is altered in this task (DOC7 owns versioning guards).

---

## DOC2 — README: file-layout table rows for the migrated files

- **Task ID:** DOC2
- **Goal:** The contributor file-layout table describes `block.json`, `render.php`, `view.js`,
  and `accessibleName.js` per their shipped Interactivity API roles.
- **Audience:** Plugin contributors / maintainers.
- **Files:** `README.md` (modify).
- **Sections-scope:** Only these rows of the "### File layout" table — `src/block.json` (**L140**),
  `src/render.php` (**L147**), `src/view.js` (**L148**), and `src/song/accessibleName.js`
  (**L151**). Also the `piano-block.php` row (**L139**) **only** to confirm it still reads correctly
  (it says "registers the block from `build/`", which stays true — edit only if it references the
  removed translation call, which it does not). Leave every other table row unchanged — in
  particular the `src/notation/` row (**L149**) still correctly says `dom.js` helpers are "used by
  both `SongCanvas` and `view.js`" (still true); do **not** edit it.
- **Depends on:** (none).
- **Traces to:** Shipped `block.json` (D1), `render.php` route-B rewrite (D4/D12), `view.js` store
  rewrite (D3–D11), `accessibleName.js` now editor-only on the front-end side (D4); code-plan
  T2/T3/T4/T5.
- **Acceptance:**
  - `src/block.json` row (L140): the "wiring" list now names a **`viewScriptModule`** (the
    front-end **view module**) and **`supports.interactivity`** instead of "the editor script …
    and the server render" implying a classic `viewScript`. It must mention the block is registered
    as an **interactive block**. Must **not** say `viewScript`.
  - `src/render.php` row (L147): replace "a block-wrapper `<div>` carrying the raw `song` inside an
    inert `application/json` `<script>`" with the route-B description — a **childless**
    `data-wp-interactive` wrapper that seeds the raw song **and a server-computed accessible name**
    into per-instance `data-wp-context`, with `data-wp-init` wiring the store's boot. Keep "no
    validation, no `<pre>`" (still true). Must **not** mention an inert `<script>` / carrier.
  - `src/view.js` row (L148): replace "The frontend `viewScript` entry: reads the inert JSON
    `<script>` … computes the accessible name …" with: the front-end **view module** that
    registers the `store('piano-block/piano')`; its single `data-wp-init` **init callback** reads
    the song + server-computed accessible name from per-instance context and the container from
    `getElement().ref`, validates once, builds the layout model, mounts the SVG (the authorized
    imperative carve-out), and reflows on resize. It must say the name comes **from context** (the
    front end no longer computes it) and that the module imports **only** `@wordpress/interactivity`
    (+ relative notation/song modules). Must **not** say `viewScript`, "reads the inert JSON
    `<script>`", or "computes the accessible name".
  - `src/song/accessibleName.js` row (L151): it must no longer say "reused by both the editor
    (`SongCanvas`) and the front end (`view.js`)". State that it is the shared accessible-name
    derivation used by the **editor** (`SongCanvas`), and that it is the **JS authority the
    `render.php` PHP helper mirrors** for the front end (the front end now reads the name from
    context, computed in PHP). Must **not** claim `view.js` calls it.
  - Grep guard for this task's rows: after editing, `view.js`/`render.php`/`block.json` rows
    contain none of `viewScript` (as a registration field), "inert", "application/json", "carrier".

---

## DOC3 — README: build model + scripts (`viewScriptModule` and `--experimental-modules`)

- **Task ID:** DOC3
- **Goal:** The contributor build documentation explains that the front-end `view.js` builds as a
  **script module** and that this requires the `--experimental-modules` flag on the build/start
  scripts (on the repo's `@wordpress/scripts` 32.3.0), without implying the flag is needed for
  unit/e2e runs.
- **Audience:** Plugin contributors / maintainers.
- **Files:** `README.md` (modify).
- **Sections-scope:** Only the "### The build model" bullets (**L128–L133**, specifically the
  "JSX + ES modules" bullet at **L130** and, if a new bullet is added, immediately after it) and
  the "### Scripts" list (**L160–L169**, the `npm run build` (**L162**) and `npm run start`
  (**L163**) bullets). Do **not** touch the file-layout table (DOC2), the render-contract / tests
  subsections (DOC4), or the SCSS / Biome bullets.
- **Depends on:** (none).
- **Traces to:** Shipped `package.json` (`--experimental-modules` on `build` and `start`) and
  `block.json` (`viewScriptModule`); design D2/D26; code-plan T1/T2.
- **Acceptance:**
  - The build-model prose explains that the front-end **view module** (`view.js`, declared via
    `viewScriptModule`) is built as a **real ES script module** whose generated
    `view.asset.php` depends only on `@wordpress/interactivity` (script-module id, not a classic
    `wp-` handle), distinct from the classic-script editor bundle. It must state that on this
    toolchain version (`@wordpress/scripts` 32.3.0) the webpack **module pass is opt-in**, so
    `npm run build` / `npm run start` pass **`--experimental-modules`** (equivalently
    `WP_EXPERIMENTAL_MODULES=true`); without it the module pass reports "No entry file discovered"
    and `view.js` is not built (nothing hydrates).
  - The Scripts list's `npm run build` (L162) and `npm run start` (L163) entries reflect the flag
    (either by noting the flag is part of the script, or by mentioning it builds the view module).
  - It must **not** claim the flag is needed for `test:unit` (Jest transforms `src/` directly and
    mocks `@wordpress/*`) or for `test:e2e` (Playwress does not take the flag) — but it **may** note
    that a flagged `npm run build` must run **before** `npm run test:e2e` (the e2e prerequisite
    ordering is otherwise unchanged). Do not edit the `test:unit` / `test:e2e` bullets except to add
    that "build first" note if it improves accuracy.
  - **Must appear:** `viewScriptModule`, `--experimental-modules`, "view module". **Must NOT
    appear** in these spots: any claim that `@wordpress/interactivity` is a `package.json`
    dependency (it is WordPress-provided and externalized — see DOC4/DOC7 for the invariant).

---

## DOC4 — README: render contract + front-end test summary (route-B transport, escape-safety, multi-block)

- **Task ID:** DOC4
- **Goal:** The contributor "render contract" subsection and the front-end portion of the "Tests"
  subsection describe the route-B per-instance `data-wp-context` transport (with core-encoder
  escape-safety), the server-computed accessible name, and the new multi-block isolation coverage —
  replacing the inert-`<script>`-carrier and hand-rolled-`<` story.
- **Audience:** Plugin contributors / maintainers.
- **Files:** `README.md` (modify).
- **Sections-scope:** Within "### The song format and validator": **(a)** the "**Render contract**"
  paragraph at **L193**; **(b)** the "one transformation PHP does make … script-breakout escape"
  paragraph at **L195**; **(c)** the "> **Exercising the renderer.**" blockquote at **L197** (only
  its "the frontend reads it from the inert `<script>`" clause); and **(d)** the front-end coverage
  sentence inside the "**Tests.**" paragraph at **L199** (the "End-to-end tests … and the front end
  across its three display states …" portion). Do **not** touch the "Storage model", "Schema-as-data",
  "Conformance policy", or "Additive growth" paragraphs (the song format is unchanged), and do not
  touch the unit-test (validator / notation) descriptions in L199 except the front-end clause.
- **Depends on:** (none — but if DOC1/DOC2 land first, keep terminology consistent with them).
- **Traces to:** Shipped `render.php` route-B transport + server-computed name + dropped escape
  (D4/D12/D15), the reworked AC8 transport sub-check (D15a, code-plan T6), the new AC9 multi-block
  test (D20, code-plan T7); spec R3/R4/R5/R8, AC8/AC9.
- **Acceptance:**
  - The Render-contract paragraph (L193) no longer describes "a container carrying an inert JSON
    `<script>`". It must describe the **childless** `data-wp-interactive` wrapper that seeds the
    **raw** song **and a server-computed accessible name** into **per-instance `data-wp-context`**,
    read by the view module's store via `getContext()`. It must preserve the still-true contributor
    rules: PHP does **no** validation / parsing-to-gate / re-serialization of the song for rendering
    (the song rides through **raw**; the render-or-nothing decision stays on the front end), and the
    server still emits **nothing** for an empty/whitespace song. It should note the one new server
    computation: PHP decodes the song **only** to read `metadata.title` / `metadata.composer` for the
    accessible name (a label, never a render gate). Heading/title text may be updated away from "a
    container carrying an inert JSON `<script>`".
  - The escape paragraph (L195) no longer describes the hand-rolled `str_replace( '<', '<' )` /
    raw-text-`<script>` / ETAGO reasoning as the *current* mechanism. It must state that escape-safety
    is now provided by the **core context encoder** (`wp_interactivity_data_wp_context()` →
    `wp_json_encode` with `JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP`), a **superset**
    of the old single-character escape (it escapes `<`, `>`, `'`, `"`, `&`). It must preserve the
    **guarantee** (the song cannot break out of its attribute context — no XSS / injected
    `<script>` / `<foreignObject>` — and survives a byte-exact `JSON.parse` round-trip). The old
    mechanism may be mentioned only historically (e.g. "previously …"), not as current behavior. Must
    **not** present `<` / ETAGO / `<\/` as the live escaping.
  - The "Exercising the renderer" blockquote (L197): replace "the frontend reads it from the inert
    `<script>`, validates it, and draws …" with the route-B reality — the front end reads the song
    from its **per-instance context**, validates it (client-side), and draws the grand staff. The
    rest of the blockquote (the example song is a broad-coverage template; paste + view) stays.
  - The Tests front-end clause (L199): the three display states stay (conformant → `<svg role="img">`
    with an accessible name, raw JSON **not** shown; empty/whitespace → nothing; non-renderable →
    nothing, no echo, no error). Update the hostile-text description to route B: the hostile free text
    still renders **inert** (verbatim SVG `textContent`, no XSS) and the song still round-trips to the
    exact author bytes — but now the transport sub-check reads the **`data-wp-context`** attribute
    (escaped by the core encoder), not a `<script>` carrier. Add the **new multi-block isolation**
    coverage: two Piano blocks on one page, each with a different song, render independently — their
    own SVG, notation, and accessible name, with no cross-talk (guarding against shared global state).
    Must **not** describe the front-end transport as a `<script>` carrier or claim per-instance reads
    come from a script body.
  - **Global grep guard for DOC4's spots:** after editing, none of the four edited spots contain
    "inert `<script>`", "application/json", "carrier", "ETAGO", or `<` presented as current
    behavior.

---

## DOC5 — Test-narrative comment: the AC7-wrapper note in `render.spec.js`

- **Task ID:** DOC5
- **Goal:** The non-symbol narrative comment in the AC7 invalid-JSON test — which still describes
  the wrapper as "carrying the inert JSON `<script>`" — is corrected to the route-B reality (a
  childless `data-wp-context` wrapper), so the test prose does not contradict the shipped transport.
- **Audience:** Plugin contributors / maintainers (test readers).
- **Files:** `specs/render.spec.js` (modify — comment text only).
- **Sections-scope:** **Only** the two-line comment at **~L554–555** inside the test
  `"AC7 — an invalid-JSON song renders nothing visible"`:
  `// The wrapper MAY exist (carrying the inert JSON <script>), but the` /
  `// validate gate fails, so NO SVG and no visible notation is drawn.`
  Do **not** change any assertion, any other comment, or any other test. The AC8 comments
  (~L654–656, ~L672–679) are corrected by the **code phase** (code-plan T6) — do **not** touch them
  here (if the code phase has already corrected them, leave them).
- **Depends on:** Code-plan T3 (route-B `render.php`) and T6 (AC8 rework) having landed — so the
  surrounding test reflects route B and this comment is the only remaining stale one. Run this task
  **after** the code phase completes.
- **Traces to:** Design D23/D26 (the flagged stale comment; the AC7 assertion `innerText === ""` is
  unaffected — the childless route-B wrapper still yields empty `innerText`); spec AC7.
- **Acceptance:**
  - The comment no longer says the wrapper carries an inert JSON `<script>`. It must describe the
    route-B wrapper accurately: a **childless** `data-wp-interactive` / `data-wp-context` wrapper may
    exist (or, per the early return, none at all for empty/whitespace), but the **client-side**
    validate gate fails on invalid JSON, so **no SVG and no visible notation** is drawn — which is
    why the test asserts `innerText === ""`. The assertion lines (L556–563) are **unchanged**.
  - The phrase "inert JSON `<script>`" no longer appears anywhere in `render.spec.js`
    (`grep -n "inert" specs/render.spec.js` and `grep -n "application/json" specs/render.spec.js`
    return nothing once the code phase's T6 edits and this DOC5 edit are both in — if T6 left any,
    flag it, but do not edit AC8 here).
  - This is a comment-only change: `npm run test:e2e -- render.spec.js` behavior is identical
    (no assertion touched).

---

## DOC6 — Guard: confirm `docs/song-format.md` and `AGENTS.md` need no changes

- **Task ID:** DOC6
- **Goal:** Verify (and record nothing if clean) that the author-facing song-format reference and
  the agent-guidance file carry no frontend-mechanism statements made stale by the migration, so the
  doc set has no hidden drift outside the README.
- **Audience:** Maintainers (a drift-resistance check, not a content edit).
- **Files:** `docs/song-format.md` (verify only — expected: no edit), `AGENTS.md` (verify only —
  expected: no edit).
- **Sections-scope:** Whole files, read-only. Do **not** edit unless the verification below fails.
- **Depends on:** DOC1–DOC4 (so README anchors the cross-links song-format.md points at; the
  "What the front end shows" / "Using the Piano block" README sections those links target keep their
  IDs).
- **Traces to:** Spec out-of-scope fence (song format / validator unchanged; front-end render-or-
  nothing behavior unchanged); design "frozen modules".
- **Acceptance:**
  - `docs/song-format.md`: confirm it mentions the front end only as "renders the song as visual
    notation … an SVG" and "the front end does not consume `language` / `name` yet" — all of which
    stay **true** after the migration. Confirm it contains **no** `viewScript`, `view.js`,
    `<script>` carrier, `data-wp`, "Interactivity", transport, or escaping statement
    (`grep -niE "viewScript|view\.js|carrier|data-wp|interactiv|transport|<script|application/json" docs/song-format.md`
    returns nothing). Confirm its cross-links to the README anchors `#using-the-piano-block` and
    `#4-what-the-front-end-shows` still resolve (those headings were not renamed by DOC1–DOC4). If
    all hold → **no edit**; report it verified clean.
  - `AGENTS.md`: confirm it contains no migration facts (it is pipeline-hygiene guidance only) →
    **no edit**; report verified clean.
  - If any check fails (e.g. a stale front-end-mechanism phrase is found), make the **minimal**
    correction consistent with DOC1–DOC4's terminology and note it; otherwise leave both files
    untouched.

---

## DOC7 — Cross-cutting drift sweep: version floor + dependency invariant + carrier residue

- **Task ID:** DOC7
- **Goal:** A final repo-wide prose sweep confirming the migration's three highest-risk drift
  points are correct everywhere in the docs: the WordPress floor stays **6.9**, the
  WordPress-only / externalized-`@wordpress/interactivity` dependency invariant is not misstated,
  and no "inert `<script>` carrier" residue survives in any prose doc.
- **Audience:** Maintainers (final verification gate for the doc batch).
- **Files:** `README.md` (verify; fix only residual misses DOC1–DOC4 did not cover),
  `docs/song-format.md` (verify), `AGENTS.md` (verify).
- **Sections-scope:** Cross-cutting — the "Requirements" (**README L88–L99**, the "WordPress 6.9+"
  lines L92) and "Building & installing" (**L114–L122**, the "WordPress 6.9+ / PHP 7.4+" line L122)
  blocks for the version floor; any prose mentioning runtime dependencies for the invariant; and a
  repo-wide grep for carrier residue. This task **fixes only** drift that DOC1–DOC4 did not already
  own (it must not re-edit their spots); its primary output is verification.
- **Depends on:** DOC1, DOC2, DOC3, DOC4, DOC5, DOC6 (this is the closing sweep).
- **Traces to:** Spec R10/AC14 (WordPress-only invariant), the design's "floor stays 6.9" (D21),
  and the route-B transport (D12); the file-change manifest.
- **Acceptance:**
  - **Version floor:** every "WordPress 6.9+" / "Requires at least: 6.9" style statement in the
    README (L92, L122) still reads **6.9** — the migration did **not** raise the floor. Assert no
    doc says the block now requires WordPress 7.0 (`grep -niE "7\.0|requires at least: 7|wordpress 7" README.md docs/song-format.md`
    finds no migration-driven floor bump). If any doc was incorrectly bumped, restore 6.9.
  - **Dependency invariant:** no prose claims `@wordpress/interactivity` (or the Interactivity API
    runtime) is a project dependency that must be installed or registered. Where the runtime is
    mentioned (DOC3's build model), it is described as **WordPress-provided and externalized** by the
    toolchain — not added to `package.json` and not manually registered in `render.php`. The
    `package.json` `dependencies` story in the README (only `@wordpress/icons`) is unchanged.
  - **Carrier residue:** a repo-wide prose grep finds no surviving description of the dropped
    transport as current behavior:
    `grep -rniE "inert (json|application/json)? ?<script>|wp-block-piano-block-piano__song|str_replace\\(.*u003C|viewScript\b" README.md docs/song-format.md AGENTS.md`
    returns nothing (the only legitimate residue is a clearly-historical "previously…" mention, if
    DOC4 kept one). `viewScript` as a registration field must not appear (only `viewScriptModule`).
  - **Terminology consistency:** the README uses "view module" / `viewScriptModule` (not
    "viewScript"), "per-instance context" / `data-wp-context` (not "carrier"), and "interactive
    block" consistently across DOC1–DOC4's edits.
  - If this sweep finds a miss inside a DOC1–DOC4 section, fix it minimally and note which task's
    scope it belonged to (for traceability); otherwise the task is pure verification with no edits.

---

## Task summary and ordering

- **DOC1–DOC4** edit non-overlapping README sections and have **no dependencies** on each other
  (they may run in any order or in parallel); keeping terminology consistent across them is the only
  coupling, which DOC7 verifies. They depend on the **code having shipped** (the doc phase runs after
  the Code phase) but not on a specific code task beyond that.
- **DOC5** edits one test-narrative comment and **depends on code-plan T3 + T6** having landed (so the
  surrounding test is already route-B and only the AC7 comment remains stale).
- **DOC6** is a guard for the two non-README docs and depends on DOC1–DOC4 (README anchors stable).
- **DOC7** is the closing cross-cutting sweep and depends on **all** prior tasks.

Recommended execution order: **DOC1 → DOC2 → DOC3 → DOC4 → DOC5 → DOC6 → DOC7** (DOC1–DOC4 are
parallelizable; DOC5 after the code phase's T6; DOC6 then DOC7 last).

### Coverage against the migration's documented facts

- Interactive block / `supports.interactivity` / `viewScriptModule` registration → DOC1 (prose),
  DOC2 (block.json row), DOC3 (build model).
- Route-B per-instance `data-wp-context` transport + dropped `<script>` carrier → DOC1, DOC2
  (render.php / view.js rows), DOC4 (render contract), DOC5 (test comment), DOC7 (residue sweep).
- Server-computed accessible name (PHP mirror; front end no longer calls `accessibleName.js`) →
  DOC2 (view.js + accessibleName.js rows), DOC4 (render contract).
- Core-encoder escape-safety (superset escape, byte-exact round-trip) → DOC4.
- `--experimental-modules` build flag + module-only `@wordpress/interactivity` dependency → DOC3,
  DOC7 (dependency invariant).
- WordPress floor stays 6.9 → DOC7 (and a guard note in every task).
- New AC9 multi-block isolation coverage → DOC4 (tests summary).
- song-format.md / AGENTS.md unchanged (no drift) → DOC6 (verified, not edited), DOC7 (final sweep).

### Out of scope for this doc plan (handled elsewhere or unchanged)

- Symbol-level / docblock comments authored with the code: the top doc comment of `render.php`
  (code-plan T3), the top doc comment of `view.js` (T5), and the `piano_block_register()` docblock
  in `piano-block.php` (T4) — the **code phase** rewrites these alongside the code.
- The stale AC8 narrative comments in `render.spec.js` (~L654–656, ~L672–679) — corrected by the
  **code phase** (code-plan T6, which edits that test).
- `docs/song-format.md` field reference and `AGENTS.md` content — unchanged by the migration
  (DOC6/DOC7 verify, do not rewrite).
