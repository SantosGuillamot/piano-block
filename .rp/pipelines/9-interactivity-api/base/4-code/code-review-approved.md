# Code Review — APPROVED (batch T1–T7)

Issue #9 — move the Piano block's frontend JS to the WordPress Interactivity API.
Reviewed the diff `1c6f14c..HEAD` (pipeline-artifact commits under `.rp/pipelines/...`
ignored). The actual code/test change set is exactly the planned manifest:
`package.json`, `src/block.json`, `src/render.php`, `piano-block.php`, `src/view.js`,
`specs/render.spec.js`.

Verdict: **APPROVED.** All tasks match their plan blocks and the governing design
decisions, every spec AC is satisfied by the shipped code, the frozen fence is intact,
and the build/unit/e2e verifications were reproduced independently (not trusted from the
writers' reports).

---

## Frozen fence — intact

`git diff --name-only 1c6f14c..HEAD` (excluding `.rp/`) returns exactly the 6 manifest
files. A targeted diff over `src/notation/*`, `src/song/*` (incl. `accessibleName.js`,
`validate.js`), `src/index.js`, `src/edit.js`, `src/editor/*`, and `specs/editor.spec.js`
returns **empty** — no frozen file is modified. The editor e2e suite passing unchanged
(below) corroborates this at runtime.

## Plan-fidelity (load-bearing pieces)

- **T1 (`package.json`)** — `build` and `start` carry `--experimental-modules`;
  `test:unit` / `test:e2e` unchanged; no dependency added. ✔
- **T2 (`block.json`)** — `viewScript` dropped; `viewScriptModule: "file:./view.js"` and
  `supports: { interactivity: true }` (boolean form) added; everything else unchanged. ✔
- **T3 (`render.php`, route B)** — keeps the `'' === trim($song)` early return; computes
  the accessible name in PHP via `piano_block_accessible_name()` (guarded with
  `function_exists`); `json_decode`s **only** to read `metadata` (no render gate, R6
  stays client-side); seeds `wp_interactivity_data_wp_context([ 'song'=>$song raw,
  'accessibleName'=>$name ])`; emits a single **childless** wrapper with
  `data-wp-interactive="piano-block/piano"`, `data-wp-init="callbacks.init"`,
  `get_block_wrapper_attributes()`; the hand-rolled `str_replace('<','&lt;',…)` and the
  inert `<script>` carrier are both gone. The `<?php … ?>` closes before the single
  `<div …></div>` line (iAPI PHP-mode discipline honored). ✔
- **PHP accessible-name mirror (T3 / D13)** — cross-checked byte-for-byte against the
  frozen `src/song/accessibleName.js`. All four branches reproduce identically:
  title+composer → `sprintf( _x('%1$s by %2$s','sheet music label','piano-block'), … )`;
  title-only → `$title` **verbatim, no wrapper**; composer-only →
  `sprintf( _x('Piano sheet music by %s', …), … )`; neither → `__('Piano sheet music',
  'piano-block')`. Trim-to-empty semantics match
  (`is_string(...) ? trim(...) : ''` ≡ JS `typeof === "string" ? .trim() : ""`); the
  `/* translators: */` comments are present. ✔
- **T4 (`piano-block.php`)** — only the dead `wp_set_script_translations(
  'piano-block-piano-view-script', … )` call (and its doc-comment sentence) removed;
  `register_block_type( __DIR__ . '/build' )` and the `init` hook unchanged; no
  `load_plugin_textdomain`, no `wp_register_script_module`. Repo grep for
  `piano-block-piano-view-script` returns nothing. ✔
- **T5 (`view.js`)** — `store('piano-block/piano', { callbacks: { init() {…} } })`,
  callbacks-only (no `state`, no `actions`). `init` reads `container` from
  `getElement().ref` and `{ song, accessibleName }` from `getContext()`; validates once
  (`validateSong(raw).length > 0` → return); defensive `try { JSON.parse } catch
  { return }` double-guard; `draw` closes over the cached parse + context name and calls
  only frozen core (`buildLayoutModel` / `availableWidthInSp` / `renderInto`) — no
  re-validate/re-parse on redraw; `drawWhenFontReady(draw)` first (unconditional initial
  draw) before `observeResize`; returns `() => observer?.disconnect()`.
  `observeResize` is a module-level helper reused verbatim with the single
  `return observer` (and `undefined` on the no-`ResizeObserver` path) addition; its
  `frame`/`observer` are per-call locals. **No module-level mutable per-instance state**
  — the only module-level construct is the single `store()` registration. Imports are
  `@wordpress/interactivity` + relative `./notation/*` / `./song/*` only:
  `@wordpress/dom-ready` and `accessibleNameFor` (→ `@wordpress/i18n`) are gone from the
  module graph. ✔
- **T6 (AC8 rework)** — the carrier-`<script>` locator is replaced by parsing the
  wrapper's `data-wp-context='…'` value (anchored on
  `data-wp-interactive="piano-block/piano"`, sliced to the next `'`, which is the true
  close because JSON_HEX_APOS escapes any in-payload `'`). Escape asserts: value
  **contains** `<\/script` and `<!--`, **not** literal `</script>` / `<!--` /
  `'`. Byte-exact round-trip: `JSON.parse(JSON.parse(attrValue).song)` deep-equals
  `JSON.parse(HOSTILE_SONG)`, and `ctx.accessibleName === \`${HOSTILE_TITLE} by A.
  Composer\``. The (a)/(b)/(c) render-inert-no-XSS asserts are unchanged; the stale (b)/(d)
  comments are corrected to route B. ✔
- **T7 (new AC9)** — inserts two blocks with distinct songs (Alpha/X 1 note;
  Beta/Y 3 notes), publishes, asserts two `.wp-block-piano-block-piano` wrappers, two
  `svg[role="img"]`, `nth(0)` name "Alpha by X" / `nth(1)` "Beta by Y", and unequal
  notehead counts (>0 each, `not.toBe`). Genuinely guards the
  `wp_interactivity_state()` global-state regression. ✔

## Spec / AC satisfaction — reproduced verifications

- **Unit (AC15 / R13):** `npm run test:unit` → **699 passed, 22 suites, 0 fail**
  (frozen notation/song/editor core intact).
- **Build (D2/D3, AC14):** flagged `npm run build` exits 0 with two passes (script +
  `[javascript module]`); emits `build/view.js` and
  `build/view.asset.php = array('dependencies' => array('@wordpress/interactivity'),
  …, 'type' => 'module')`. No "Attempted to use WordPress script in a module" error.
- **AC14 invariant:** `@wordpress/interactivity` absent from `package.json` dependencies;
  no `wp_register_script_module` / `wp_enqueue_script_module` in `render.php` or
  `piano-block.php`; `view.js` import scan shows only `@wordpress/interactivity` +
  relative modules.
- **Encoder check (R5/AC8):** ran `wp_interactivity_data_wp_context` over the hostile
  context via wp-env — output is `data-wp-context='…'` (single-quote delimiter) with
  `</script>` → `<\/script>`, `<!--` → `<!--`, `"` → `"`, and no
  literal breakout — exactly the substrings the reworked AC8 asserts.
- **e2e render (AC1/2/3/5/6/7/8/9/10/11/12/13):**
  `npm run test:e2e -- render.spec.js` → **14 passed** (incl. reworked AC8 and new AC9).
- **e2e editor (AC15):** `npm run test:e2e -- editor.spec.js` → **29 passed, 3 skipped**.
  The 3 skips are a pre-existing `test.skip` (keyboard parity, issue #39) in the untouched
  `editor.spec.js`, not a regression.
- **PHP lint:** `php -l src/render.php` and `php -l piano-block.php` → "No syntax errors
  detected".

## Quality

No dead carrier/route-A/`domReady` logic in source (the only `str_replace`/
`application/json`/`replaceChildren` matches are doc comments describing what was removed
or the frozen-`svg.js` carve-out). No `console.*` in `view.js`. The only direct DOM write
is the authorized imperative-SVG carve-out, which lives in the frozen `svg.js`
(`container.replaceChildren(svg)` after `createElementNS` — not `innerHTML`); `view.js`
performs no direct DOM writes. Per-instance isolation has no module-level mutable state.

## Verdict

**APPROVED** — no issues impairing correctness, AC satisfaction, the frozen fence, or
quality. No tasks to re-dispatch.
