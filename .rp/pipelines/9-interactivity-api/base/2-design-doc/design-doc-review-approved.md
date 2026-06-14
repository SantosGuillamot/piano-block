# Design Doc Review — APPROVED

**Issue #9** — Move the Piano block's frontend JS to the Interactivity API.
**Verdict: APPROVED.** The design is sound, complete, spec-aligned, and stays inside the
scope fence. Below is the approval rationale and the list of load-bearing claims I
independently verified against the real codebase and the WordPress Interactivity API
reference (rather than trusting the doc).

---

## Load-bearing claims independently verified

### 1. D4 — server-side accessible-name pivot (the load-bearing fork). VERIFIED.

- **The `@wordpress/i18n`-in-module build blocker is real.** `src/song/accessibleName.js:7`
  does `import { __, _x, sprintf } from "@wordpress/i18n"`, and `src/view.js:25` imports
  `accessibleNameFor` from it — so `@wordpress/i18n` is pulled transitively into the view
  module graph. The iAPI reference's hard rule 1 and the module-externalization allowlist
  (only `@wordpress/interactivity`, `-router`, `-a11y` are externalized as script modules)
  confirm any other `@wordpress/*` script in a module is a hard build error. The blocker is
  not hypothetical.
- **The PHP mirror reproduces the four branches byte-identically.** I cross-checked
  `accessibleName.js` against the D13 helper:
  - title+composer → `sprintf( _x( '%1$s by %2$s', 'sheet music label', 'piano-block' ), title, composer )` — identical text, `_x` context, text domain, and `%1$s/%2$s` placeholder order.
  - title-only → the author's `title` **verbatim, no wrapper** — preserved (the subtle branch).
  - composer-only → `_x( 'Piano sheet music by %s', 'sheet music label', 'piano-block' )` — identical.
  - neither → `__( 'Piano sheet music', 'piano-block' )` — identical.
  Both trim with the empty-after-trim-counts-as-absent rule. No `languages/` directory exists
  (verified: `ls languages` → absent), so PHP `_x`/`__`/`sprintf` with no `.mo` files emit
  English verbatim, exactly as the JS path. The e2e-pinned `"Example by A. Composer"`
  (`render.spec.js:166`) and hostile `"${HOSTILE_TITLE} by A. Composer"` (`render.spec.js:670`,
  with `HOSTILE_TITLE = Pwn </script><!-- <script>alert("xss")</script>` and composer
  `A. Composer`) both come out identical from the PHP branch.
- **Scope fence respected.** `accessibleName.js` is imported by BOTH `src/edit.js:39` (editor)
  AND `src/view.js:25` (frontend). D4 removes only the `view.js` usage; the PHP helper is a
  *parallel* implementation, and `accessibleName.js` stays frozen and still serves the editor.
  This is exactly "a parallel mirror, not an edit to `accessibleName.js`" — the scope rule holds.

### 2. D2 — the `--experimental-modules` build-flag requirement. VERIFIED as plausible and surfaced.

The iAPI reference hard rule 1 confirms `supports.interactivity: true` alone does NOT build the
view module — `viewScriptModule` is the field that does. The doc's claim that on wp-scripts
32.3.0 the module pass is additionally gated behind `--experimental-modules` is consistent with
that toolchain's two-pass design and is backed by the researcher's in-repo build experiments.
The design correctly flags this as the one place the spec's "no bundler changes" note is
imprecise and surfaces it as an explicit `package.json` change (D2/D26) — not a silent
assumption. `register_block_type( __DIR__ . '/build' )` is unchanged and no
`wp_register_script_module()` is added (hard rule 1 / R10 / AC14). Sound.

### 3. The imperative-SVG carve-out reconciliation safety. VERIFIED for first draw AND resize redraws.

- `renderInto` (`svg.js:275-279`) ends in `container.replaceChildren(svg)` — appends
  already-built `createElementNS` nodes, **not** `innerHTML`, so it does not trip the iAPI rule
  banning `innerHTML`/`addEventListener`/`classList`/`style` writes (hard rule 11). The
  accessible name and all free text are set via `setText` → `node.textContent` (`svg.js:97-100`,
  `:255`), so hostile bytes stay inert — no XSS.
- The reconciliation argument is internally consistent with the iAPI model: route B emits a
  **childless** wrapper → `toVdom` snapshots empty children → zero child directives means nothing
  in the subtree is reactive → `hydrate()` runs once → `data-wp-init` (post-commit, runs once on
  mount per the directives reference) fires after hydrate → `replaceChildren` injects DOM Preact
  does not track. The repeated-resize case is covered by the same proof (hydrate-once, no
  re-render path, raw DOM `ResizeObserver` independent of Preact). The standing guard ("safe
  precisely because there are no child directives; a future child directive must re-examine
  reconciliation, with `data-wp-ignore` as the escape hatch") is correctly carried (D11/D18).
  The `data-wp-init` cleanup contract (return a function → `useEffect` teardown) matches the
  directives reference ("Runs once on mount. … May return a cleanup function"). Sound.

### 4. Route-B transport escape-safety (R5/AC8) and the trim parity gap. VERIFIED.

- The server-rendering reference confirms `wp_interactivity_data_wp_context()` "prints the
  `data-wp-context` attribute with correct escaping" and warns against hand-writing it (which
  "skips escaping"). The design's reliance on the core encoder (JSON_HEX_TAG | JSON_HEX_APOS |
  JSON_HEX_QUOT | JSON_HEX_AMP) as a *superset* of today's single-char `<`→`<` escape is
  the correct, stronger guarantee. Single-quote-wrapping + JSON_HEX_APOS makes the first `'`
  after the opener the true attribute close → breakout-safe, and `<` is a legal JSON escape
  so `JSON.parse` round-trips byte-exact. This satisfies AC8's breakout-safety + exact-round-trip
  requirement.
- The AC8 rework matches the spec's single authorized exception. The current transport sub-check
  (`render.spec.js:680-696`) literally locates the carrier `<script>` and slices its payload —
  exactly what D15a reworks to parse the `data-wp-context` attribute instead. The render/inert/
  no-XSS assertions (a)–(c) at `:646-670` are genuinely independent of the carrier and hold under
  route B (including (b) at `:657-659`, which counts non-`application/json` scripts and still gets
  0 — there are no scripts at all under route B).
- The D15 PHP-`trim()`-vs-JS-`.trim()` Unicode-whitespace gap is honestly surfaced, correctly
  scoped as "no e2e impact" (every pinned fixture uses ASCII spaces only — confirmed against the
  `COMPREHENSIVE_SONG`/`HOSTILE_SONG` fixtures), and routed to the documentation phase. Accepting
  and documenting it rather than over-engineering a Unicode-aware regex is the right call.

---

## Completeness, spec-alignment, and scope

- **All 26 decisions (D1–D26) carried with rationale, trade-offs, and rejected alternatives.**
  The consolidated trade-offs section and the per-decision "Rejected:" notes make the reasoning
  auditable.
- **Full traceability.** The Requirements→decisions table maps every R1–R13 and every AC
  (AC1/2/12, AC3, AC5, AC6, AC7, AC8, AC9, AC10, AC11, AC13, AC14, AC15) to design decisions.
  I spot-checked the hard ones: AC5 (resize → more `g[data-system]`) traces to D17/D18 via the
  frozen `availableWidthInSp` (`dom.js:25-30`, single 480px breakpoint, zero-width tolerant,
  re-evaluated per draw — verified); AC9 (multi-block isolation) traces to D19/D20 with a concrete
  new two-block test; AC8 transport to D15a.
- **The spec's i18n caveat is *dissolved*, not deferred (D21), with sound reasoning** — because
  D4 moves all i18n to PHP and the module imports no `@wordpress/i18n`, there are zero module
  strings, so `wp_set_script_module_translations` (a 7.0 API) is moot and the 6.9 floor holds via
  just-in-time PHP gettext. The task explicitly permits dissolving the caveat IF the reasoning is
  sound; it is. R9 string-correctness is satisfied independently via the PHP path.
- **R6 (client-side gate) is preserved (D14).** `render.php` `json_decode`s the song *only* to
  read `metadata` for the name; it never gates rendering. A malformed song yields a harmless,
  never-shown PHP label while the client `validateSong` remains the sole render-or-nothing gate.
  No server-side validation is introduced. The validate-once + cached-parse + redraw-from-cache
  contract (D16) is preserved and structurally enforced by the empty-deps `data-wp-init`.
- **Scope fence intact.** No FROZEN module is edited: the notation core, validator, and
  `accessibleName.js` are called, not changed; the editor and its e2e suite are untouched. The PHP
  helper is a parallel mirror. The imperative SVG mount is preserved as the authorized carve-out,
  not converted to directives.
- **Hard-rule-4 reconciliation handled correctly (D5).** The design justifies why "seed every
  reactive value, even empty" does not force extra seeding here: no directive binds state→DOM
  (the SVG is the carve-out), so SDP has nothing to pre-render, and `render.php` only emits the
  wrapper for a non-empty song, so `song` + `accessibleName` are always present when the wrapper
  exists. This is the correct reading of the rule's purpose.

---

## Minor, non-blocking observations (for the code/doc phases — not rejection-worthy)

1. **A second stale test comment.** The design flags the stale carrier-comment at
   `render.spec.js:554-555` (D7/Q7) as a doc-phase note. There is an analogous stale comment at
   `render.spec.js:654-656` inside the AC8 test — "the only `<script>` inside the wrapper is the
   inert application/json data carrier" — which is also false under route B (no carrier exists).
   The *assertion* at `:657-659` still passes, so this is purely a comment drift in the same
   category the design already acknowledges; the documentation phase should sweep AC8's comments
   too, not just `:554-555`. Non-blocking.
2. **D13 helper placement is left as an either/or** (`piano-block.php` vs `function_exists`-guarded
   in `render.php`). This is an acceptable implementation-author choice; the design notes both and
   the contract is identical either way.

Neither observation impairs soundness, completeness, spec-alignment, or scope. The design is
implementation-ready: a plan/code author has the exact `block.json`, `render.php`, `view.js`,
`piano-block.php`, and `package.json` shapes, the PHP helper, the store shape, the carve-out
safety argument, the AC8 rework, and the new AC9 test outline.

**APPROVED.**
