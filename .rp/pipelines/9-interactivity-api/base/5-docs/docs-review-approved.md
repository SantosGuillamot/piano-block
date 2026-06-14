# Docs review — APPROVED (DOC1–DOC7)

**Verdict:** APPROVED. The full documentation batch for the Interactivity API migration
(issue #9) is accurate against the shipped code, complete against the doc plan,
drift-resistant, and respects the doc/code boundary. No issues that impair accuracy,
completeness, drift-resistance, or the doc/code boundary were found.

Diff base: `1c6f14c`. Doc-phase changes: `README.md` (DOC1–DOC4, commits 2878497 /
83516cf / d90696a / d5e8108) and `specs/render.spec.js` comments (DOC5, commit 05063c3).
`docs/song-format.md` and `AGENTS.md` are unchanged (DOC6/DOC7 verify-only), confirmed
genuinely clean below.

## Accuracy vs shipped code (cross-checked, not trusted)

Read the source of truth — `src/block.json`, `src/render.php`, `src/view.js`,
`piano-block.php`, `package.json`, `build/view.asset.php`, `specs/render.spec.js` — and
matched every doc claim:

- **Registration (DOC1/DOC2/DOC3).** `block.json` ships `"supports": { "interactivity": true }`
  and `"viewScriptModule": "file:./view.js"` (no `viewScript`). README L13 ("interactive
  block"), L141 (block.json row: `supports.interactivity` + `viewScriptModule` + "interactive
  block"), and L131 (build model) all match. No bare `viewScript` survives anywhere in the
  README (`grep -niE "viewScript([^M]|$)" README.md` → none).
- **Route-B render.php (DOC2/DOC4).** `render.php` emits a single childless
  `<div data-wp-interactive="piano-block/piano" … data-wp-init="callbacks.init" …></div>`,
  seeds `{ song (raw), accessibleName }` via `wp_interactivity_data_wp_context()`, keeps the
  `'' === trim($song)` early return, and `json_decode`s only for `metadata` (never gating).
  README L148 (render.php row) and L194 (render contract) describe exactly this — childless
  wrapper, raw song + server-computed name in per-instance `data-wp-context`, `data-wp-init`
  boot, no validation/`<pre>`, decode "only to read `metadata.title`/`metadata.composer` …
  a label, never a render gate." No carrier `<script>` / hand-rolled escape claimed as current.
- **Escape-safety (DOC4).** README L196 states escape-safety is now the **core context
  encoder** — `wp_json_encode(…, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP)`
  escaping `<`, `>`, `'`, `"`, `&` — a **superset** of the old single-char escape, with the
  byte-exact `JSON.parse` round-trip guarantee preserved and the old `str_replace` mentioned
  only historically ("Previously …"). Matches `render.php`'s top doc comment and the design.
- **Callbacks-only store + view module (DOC2/DOC3).** `view.js` registers
  `store('piano-block/piano', { callbacks: { init } })`, reads `{ song, accessibleName }`
  from `getContext()` and the container from `getElement().ref`, validates once, builds the
  draw closure, font-gates the first draw, attaches the rAF-debounced one-way `ResizeObserver`,
  and returns a disconnect cleanup. README L149 describes this faithfully. No `state`/`actions`
  store buckets are introduced in prose (the only "actions" hit in README is the editor `⋮`
  menu, unrelated).
- **`--experimental-modules` + externalized-only dependency (DOC3/DOC7).** `package.json`
  carries `--experimental-modules` on `build` and `start`; `build/view.asset.php` declares
  `'dependencies' => array('@wordpress/interactivity'), … 'type' => 'module'`. README L131
  matches exactly — only-dependency `@wordpress/interactivity` (a module id, not a `wp-`
  handle), WordPress-provided and **not** a `package.json` dependency, module pass opt-in on
  `@wordpress/scripts` 32.3.0, "No entry file discovered" / nothing hydrates without the flag.
  L163/L164 (Scripts) reflect the flag. The flag is **not** claimed for `test:unit`/`test:e2e`.
- **Server accessible-name PHP mirror, front end no longer computes it (DOC2/DOC4).**
  `render.php`'s `piano_block_accessible_name()` mirrors the four branches; `view.js` imports
  **only** `@wordpress/interactivity` + relative `./notation/*` / `./song/*` (no
  `accessibleName.js`, no `@wordpress/i18n`, no `@wordpress/dom-ready`). README L149 ("reads
  the … name from per-instance context (the front end no longer computes the name)") and L152
  (accessibleName.js row: "Used by the editor (`SongCanvas`) … the JS authority the
  `render.php` PHP helper mirrors … now reads the name from context, computed in PHP") match.
  The `dom.js` row (L150) correctly still reads "used by both `SongCanvas` and `view.js`"
  (still true — `view.js` imports `availableWidthInSp` / `drawWhenFontReady`).
- **Multi-block isolation (DOC4).** README L200 documents the two-blocks-on-one-page case with
  per-instance SVG/notation/accessible name and no cross-talk — matches the AC9 test (commit
  2564964) and `ISOLATION_SONG_A`/`_B` fixtures.
- **WP floor stays 6.9.** `piano-block.php` "Requires at least: 6.9"; README L92/L122 read 6.9;
  no 7.0 bump anywhere.

## No overstatement of the server's role (drift-resistance)

- README L84 keeps "the server does no validation" and "it is the **front end** that decides
  whether to render" while correctly noting only the **accessible-name string** is
  server-computed ("a name the server computes and passes to the page"). L76 keeps "drawn
  entirely in the browser." The render-or-nothing gate stays client-side in prose. No claim
  that the server renders or validates the notation. Matches `render.php` (decode never gates)
  and `view.js` (`validateSong` gate).

## Completeness vs the doc plan + reproduced residue greps

All run from the worktree root; every one came back as the plan demanded:

- **DOC4 spot grep** — `grep -niE "inert <script>|application/json|carrier|ETAGO" README.md` → **none**.
- **DOC7 version floor** — `grep -niE "7\.0|requires at least: 7|wordpress 7" README.md docs/song-format.md` → **none**.
- **DOC7 carrier residue (repo-wide)** —
  `grep -rniE "inert (json|application/json)? ?<script>|wp-block-piano-block-piano__song|str_replace\(.*u003C|viewScript\b" README.md docs/song-format.md AGENTS.md specs/render.spec.js` → **none**.
- **DOC6 song-format.md frontend-mechanism** —
  `grep -niE "viewScript|view\.js|carrier|data-wp|interactiv|transport|<script|application/json" docs/song-format.md` → **none**.
- **DOC5 / DOC7 comment-residue backstop** —
  `grep -niE "viewScript|inert|application/json|carrier|ETAGO|interactive flag" specs/render.spec.js`
  returns only legitimate matches, each classified:
  - L20 — file header; "renders inert text" + the **historical** reframing "the old
    `esc_html(<pre>)` guarantee now lives in the **core context encoder's** escape" (route-B,
    correct — DOC5 #1).
  - L436, L579, L770, L1028 — the word "inert" used descriptively about rendered SVG text,
    never route-A residue.
  - L735, L763–766 — **inside the AC8 test body** (code-phase T6 territory). The (b) comment
    reads "route B emits a childless wrapper with NO carrier `<script>` at all"; the
    `:not([type="application/json"])` is the unchanged assertion locator. Correct route-B
    language; not stale; not DOC5's to touch.
  - L991, L1037, L1041 — the AC11 `describe`/locator comment + unchanged assertion. The
    comment now reads "Route B emits a childless wrapper with no carrier `<script>` at all, so
    the `:not([type="application/json"])` filter excludes nothing real — it simply selects
    every script in the block (none)." Exactly DOC5 #4: no longer implies a carrier exists;
    assertion line untouched.

  No stale route-A **comment outside** the AC8/AC9 bodies survives.

## Doc/code boundary

- **DOC5 is comment-only.** `git show 05063c3 -- specs/render.spec.js` is entirely `//` and
  `/* */` lines — the file header, the `INVALID_JSON_SONG` and `HOSTILE_SONG` fixture-`const`
  comments, the AC1/AC2/AC12 test comments (incl. the prescribed reason "the publish-time
  render path is unchanged," replacing the stale "without the `interactive` flag"), the AC7
  test comment, and the AC11 test comment. **No** assertion, **no** fixture string DATA (the
  `HOSTILE_TITLE`/`HOSTILE_CHORD`/`HOSTILE_FREE_TEXT` literals, `INVALID_JSON_SONG`,
  `WHITESPACE_SONG`), and **no** `test(...)` body logic changed. It did not enter the AC8 test
  body or the new AC9 test — those came from the two code-writer commits (632e40f, 2564964).
- All six DOC5 clusters from the plan are addressed: file header (#1), AC1/AC2/AC12 (#2), AC7
  (#3), AC11 (#4), and the `INVALID_JSON_SONG` + `HOSTILE_SONG` fixture comments (#5).
- No source code, no frozen file, and no AC8/AC9 test body was edited by the doc phase.

## Verify-only legitimacy (DOC6/DOC7)

`git diff 1c6f14c..HEAD --stat -- docs/song-format.md AGENTS.md` is empty — both files are
genuinely unchanged. `song-format.md` references the front end only as rendering the song as
an SVG and not consuming `language`/`name` yet (still true post-migration), and carries no
frontend-mechanism statement (grep above → none), so it genuinely needed no edit. `AGENTS.md`
is pipeline-hygiene guidance with no migration facts. Verify-only (no edit) was correct for both.

## Conclusion

DOC1–DOC5 made correct, accurate, in-scope edits; DOC6/DOC7 verify-only was correct. The docs
match the shipped code exactly, every acceptance is satisfied, all residue greps are clean, no
prose overstates what moved to the server, and the doc/code boundary held. **APPROVED.**
