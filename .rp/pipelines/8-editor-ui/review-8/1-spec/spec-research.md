# Review 8 — Spec research

Running record of the requirements Q&A between `spec-analyst-r8` and `spec-researcher-r8`
for review-8 of the Piano Block editor-UI feature (issue #8, PR #22).

This review layers a fixed set of 20 numbered findings (Must-fix 1–5, Should-do 6–20)
plus Optional items on top of the already-merged editor-UI feature. The owner's scope
decision is **address everything (Must-fix + Should-do + Optional)** while respecting the
review's "Explicitly fine as-is (do not change)" list. The full input is the review prompt:
`.rp/pipelines/8-editor-ui/review-8/0-prompt/prompt.md`.

The review prompt is already highly prescriptive (it names files, lines, and the intended
fix for each finding). This phase therefore does **not** re-derive the findings; it resolves
the genuine open questions the spec must answer — primarily the testable boundary of each
finding, the verification strategy that keeps "tests green" incompatible with "real
component broken," render-output parity, and which Optional items are in vs. deferred.

---

## Pre-Q&A observations from the live tree (analyst)

- `src/block.json:17` wires `"style": "file:./style-index.css"` (the built output of
  `src/style.scss`) and has **no** `editorStyle` key — confirms item 3's premise. Note the
  prompt's item-3 phrasing ("`block.json:17` wires only `"style"`") matches; the literal
  value is `style-index.css` (wp-scripts' build name for `style.scss`), not `style.scss`.
- `src/index.js:4` imports `./style.scss` (single stylesheet today) — confirms item 3.
- `src/editor/accessibleName.js:1-10` docblock references `SongPreview` (the result is
  "passed to `SongPreview`") — but the live preview component is `SongCanvas`; confirms the
  stale-comment finding (item 18) and the verbatim duplication of `view.js` (item 9).
- `README.md:143` says "(no new runtime dependency)" and `README.md:179` says "ajv would be
  the editor bundle's first runtime dependency" — both now false because `package.json:31-33`
  adds `@wordpress/icons` as a real (bundled) runtime dependency (item 5). The prompt flags
  only line 143; line 179's "first runtime dependency" phrasing is a candidate sub-fix.
- `src/editor/StructureTree.js:569` renders `<TreeGrid label={…}>` with no
  `onExpandRow`/`onCollapseRow` and no `aria-label`; each `TreeGridRow` already has an
  `expansionKey(...)` in scope but carries no `data-*` attribute (items 1, 2).
- `resolveSelection` compat branch is at `selection.js:144-156`, its docs at `:120-124`
  (line numbers shifted slightly from the prompt's `:144-153`/`:120-125`) — item 10.

---

## Q&A log

### Researcher's opening scan (live-coordinate confirmation of the 20 findings)

The researcher confirmed nearly every finding against the live tree, with corrected
coordinates (the prompt warned lines would shift). Load-bearing confirmations:

- **Paths:** `edit.js` is `src/edit.js` (not `src/editor/edit.js`); panels in
  `src/editor/inspector/`. `block.json:17` = `"style": "file:./style-index.css"`, no
  `editorStyle`; `editorScript` = `file:./index.js`.
- **Item 1/2:** `StructureTree.js:569` = `<TreeGrid label={…}>`, no expand/collapse
  callbacks; mock (`wordpress-components.js:445-458`) maps `label`→`aria-label` and
  swallows the callbacks. Hand-group label button (`:412-419`) toggles expansion;
  section/measure labels are select-only.
- **Item 4:** zero `__next40pxDefaultSize` anywhere; `__nextHasNoMarginBottom` IS passed
  to NumberControl in ContextEditor (`:143` bpm, `:166` beats), HandConfigEditor
  (`:123,141,152,168`), PitchEditor (`:66,77,88`), NotePanel dots (`:188`). edit.js
  TextareaControl `:528-538` lacks `__nextHasNoMarginBottom`.
- **Item 5:** `@wordpress/icons ^10.32.0` is the first runtime dep. The false claim is at
  `README.md:143`; **also** a second interactive/hit-rect doc reference at `README.md:148`,
  a "now-dormant interactive hit-rect" section at `README.md:158-160`, and a test mention
  at `README.md:201` — all relevant to item 8's doc cleanup. (Analyst note: `README.md:179`
  also says "ajv would be the editor bundle's first runtime dependency," now stale.)
- **Item 6:** edit.js does not import `set*At`; inline rebuilds at onAddNote `:211-216`,
  onAddMeasure `:271-274`, onRemoveMeasure `:285-288`, onRemoveNote (empty-hand drop rule)
  `:311-324`, onDuplicateMeasure `:360-362`, onDuplicateNote `:384-389`, insertMeasureAt
  `:442-444`, insertNoteAt `:475-480`.
- **Item 8:** `interactive` fully live in svg.js (renderSvg `:283-311`, threaded through
  renderSystem/Measure/Hand/Note/Rest, hitRect `:250-260`, `HIT_RECT_WIDTH_SP` `:64`) +
  `HIT_RECT_VERTICAL_MARGIN_SP` constants.js`:34`. ~15 refs in svg.test.js. No production
  caller passes it (SongCanvas.js`:163`, view.js`:134` both omit).
- **Item 9:** `accessibleNameFor` duplicated verbatim: `accessibleName.js:27-51` ≡
  `view.js:56-80`. SongCanvas.js `:37-77` + `:176-201` duplicates view.js's
  NARROW_CONTAINER_PX/NARROW_SP_PX/availableWidthInSp/drawWhenFontReady/observeResize.
- **Item 10:** only untagged `setSelection` is `edit.js:218` (onAddNote). selection.js
  compat block `:144-156` (defaulting) + docs `:120-125`.
- **Item 12:** `MetadataEditor.withField` (`:23-31`) lacks the trim that `omitFalsy`
  (`emit.js:49-58`) has. `emitBlock` (`emit.js:69-71`), `emitMember`
  (`ContextEditor.js:58-60`). `ContextEditor.js:45` imports `./inspector/emit.js`
  (crosses the inspector boundary).
- **Item 15:** `NONE_OPTION` declared in NotePanel.js`:63` and MeasurePanel.js`:37`;
  `{label:"—",value:""}` idiom in ContextEditor.js`:150,173` and HandConfigEditor.js`:119`.
  `ALTER_KEY_OPTIONS` (HandConfigEditor.js`:37-40`) rebuilds `noteNameOptions("english")`
  (noteNames.js`:114-117`).
- **Item 16:** `icon="plus"` in ListControls.js`:26`; `icon="trash"` in PitchList.js`:48`,
  AnnotationList.js`:61`, HandConfigEditor.js`:171`. StructureTree already uses element
  icons.
- **Item 17:** `#007cba` ×3 at style.scss`:142-144`; `__canvas` `:114-120`; `__song-input`
  hook at edit.js`:537`; stale comments at style.scss`:33-36`.
- **Item 20:** revealAncestors trio at edit.js`:220-224, 399-403, 490-494`; inline
  event-key at StructureTree.js`:443` (`${handKey}e${eventIndex}`); selection.js owns
  `expansionKey` (`:40-49`).
- **Optional real-icons:** `wordpress-icons.js` mock currently exports plain STRINGS
  (`"plus"` etc.); `jest.config.js` is the two-project config (unit + real-icons) with the
  React-dedup mapper and the string-sentinel icons mock.
- **Optional hand-vocab:** StructureTree.js already defines `const HANDS =
  ["rightHand","leftHand"]` (`:64`); songModel.js `STAVES` at `:95-98`.

### Q1 — Verification strategy for items 1, 2, 16 (where the real-contract assertion must live)

**Answer (researcher, evidence-backed against published Gutenberg source — note
`@wordpress/components` is externalized, NOT in node_modules, so the contract was read
from `packages/components/src/tree-grid/`):**

**(a) Real TreeGrid contract.** `TreeGrid`'s declared props are exactly
`children`, `onExpandRow`, `onCollapseRow`, `onFocusRow`, `applicationAriaLabel` —
all three callbacks default to `() => {}` (silent no-op). Everything else, including
`label`, spreads via `...props` onto `<table role="treegrid">`, so `label` becomes a
meaningless DOM attribute, NOT an accessible name. Two real ways to name the tree:
`applicationAriaLabel` (→ `aria-label` on the `role="application"` wrapper `<div>`) or a
raw `aria-label` spread onto the `<table>`. The review prescribes `aria-label` on the
table — valid. (`applicationAriaLabel` is arguably the more semantically intended prop;
flag as a design-phase choice, not a spec ambiguity. Spec pins `aria-label` to match the
review.)

**(b) Expand/collapse mechanism — the review paraphrased the arg shape; corrected:**
On the first column, ArrowRight on a collapsed row calls `onExpandRow(activeRow)` and
ArrowLeft on an expanded row calls `onCollapseRow(activeRow)` — the **DOM `<tr>` element
is the SOLE argument** (NOT `onExpandRow(event, rowId)`). The component finds the active
row via `activeElement.closest('[role="row"]')` and decides expanded-vs-collapsed by
reading `aria-expanded` / `data-expanded` off that row. `aria-expanded` is already emitted
today (`TreeGridRow` renders it; StructureTree passes `isExpanded` on section/measure/hand
rows at `:181,286,403`), so the arrow branch WILL fire once the callbacks are wired — the
only missing piece is the two callbacks. `TreeGridRow` also spreads its unknown props onto
the `<tr>`, so a `data-*` attribute (e.g. `data-expansion-key={sectionKey}`) lands on the
row; the handler reads `activeRow.getAttribute('data-expansion-key')` and routes to the
existing `onToggleExpanded(key)`. This is exactly the core List View `data-block` pattern.
Leaf (note) rows have no `isExpanded`, so the branch never fires for them — matches the
model (only section/measure/hand are in the `expanded` Set).

**(c) e2e capability — the e2e is the ONLY viable home for the real keyboard path.**
The Playwright e2e (`specs/editor.spec.js`, ~1075 lines) runs against a REAL WordPress via
wp-env with REAL `@wordpress/components` (`@wordpress/e2e-test-utils-playwright`). It WOULD
catch a broken keyboard path if it drove arrow keys, but today every expansion goes through
`expandRow(name)` → chevron `.click()` (`:332-334`, called `:477-478, :539-541, :588, :681,
:769`); zero `press`/`Arrow*`/`keyboard` usage anywhere. So **nothing exercises keyboard
expand/collapse on either surface today.** The jsdom unit suite CANNOT prove the real
component invokes the callbacks on arrow press — the TreeGrid mock renders a bare `<table>`
with no roving-tabindex/arrow model. jsdom can only assert (i) the callbacks are passed,
and (ii) the handler maps a synthetic `<tr>`'s `data-*` → the right key. Proving "arrow keys
actually expand/collapse" requires an **e2e test** driving ArrowRight/ArrowLeft on a focused
row and asserting children appear/disappear. The treegrid accessible name (item 2) is also
best asserted in e2e via `getByRole("treegrid", { name: "Song structure" })` — fails today
(dead `label` attribute), passes once `aria-label` is set.

**(d) realIcons mechanics (items 16 + Optional lighten-it).** `jest.config.js` is a
two-project config sharing one base (React-dedup `moduleNameMapper`, the i18n/components/
block-editor mocks, structured-clone setup). The **unit** project maps `@wordpress/icons`
→ `test/mocks/wordpress-icons.js` (string sentinels) and ignores the realIcons test. The
**real-icons** project DROPS the icons mapping (resolves the genuine installed
`@wordpress/icons` — it IS installed) and runs ONLY `StructureTree.realIcons.test.js` (264
lines), still mocking `@wordpress/components`. Invariant guarded: an icon passed to an
icon-bearing component is a REAL element, not a Dashicon-slug STRING. Root cause it caught:
a review-6 `icon="plus"` slug routed through `Icon`→`<Dashicon>`, needs the dashicons
stylesheet absent in the canvas iframe → rendered as an empty square; the whole unit suite
stayed green because the string-sentinel mock makes a string and an element
indistinguishable. The realIcons test un-maps icons + dedups React so `isValidElement(plus)`
is true, locally re-mocks `Icon`/`Button`/`DropdownMenu` to render `icon` via an
element-rendering `Icon` (mirroring the real `cloneElement(icon)`), and asserts the hand-row
Add-note button contains a real inline `<svg>` (GREEN for `icon={plus}`, RED for
`icon="plus"`).

**Optional lighten-it tension (encode as a constraint):** the cheaper replacement —
`wordpress-icons.js` exports NON-string sentinels + one regular-suite assertion that no
icon-bearing component received a string `icon` — keeps the net only if the sentinel is
something a string path could not produce AND the assertion fails RED on a reintroduced
string `icon`. It proves the PROP is non-string; the realIcons test proves the icon RENDERS
as `<svg>`. Recommendation: the spec REQUIRES a string-icon guard that stays RED-on-
regression; the form (keep realIcons as-is OR adopt the lightened non-string-sentinel
assertion) is implementer's choice provided that guarantee holds and the icons-mock change
doesn't let it silently pass.

**Resolved acceptance boundaries (items 1, 2, 16):**
- **Item 1:** (prod) `StructureTree` passes `onExpandRow`/`onCollapseRow` that read a stable
  `data-*` expansion key off the focused `<tr>` and route to `onToggleExpanded`; each
  expandable `TreeGridRow` carries that `data-*` key. (test) An e2e test drives
  ArrowRight/ArrowLeft on a focused section/measure/hand row and asserts the children
  appear/disappear (the real keyboard path, not the chevron). (mock) The TreeGrid mock must
  not swallow the callbacks in a way that lets a no-callback regression pass unit tests.
- **Item 2:** (prod) `StructureTree` passes `aria-label={__("Song structure", …)}` (drops
  the dead `label`). (test) e2e asserts the tree by role+name. (mock) the components mock
  STOPS mapping `label`→`aria-label`, so the unit surface matches the real prop surface and
  any test relying on the old translation breaks (correctly).
- **Item 16:** all icon-bearing components (`ListControls` plus, the three `trash` buttons,
  and StructureTree's existing element icons) use `@wordpress/icons` ELEMENTS; a string-icon
  guard remains and is RED-on-regression — realIcons test as-is OR the lightened
  non-string-sentinel assertion (implementer's choice, guarantee must hold).

**Q1-follow-up refinements (researcher, with sources):**

- **`@wordpress/components` is genuinely NOT in node_modules** (externalized; only
  genuinely-bundled deps install — `@wordpress/icons`, `element`, `i18n`,
  `e2e-test-utils-playwright`, `scripts`). The mock header
  (`test/mocks/wordpress-components.js:1-10`) states this. The contract was read from
  published Gutenberg source (`packages/components/src/tree-grid/index.tsx`), which is what
  the externalized runtime ships.
- **Expand/collapse signature is `onExpandRow(activeRow)` / `onCollapseRow(activeRow)` — a
  single DOM `<tr>` argument**, NOT `(event, rowId)`. The component finds the row via
  `activeElement.closest('[role="row"]')` and branches on the row's `aria-expanded` /
  `data-expanded`. Production maps row→node by reading a `data-*` off the `<tr>` (core List
  View's `data-block` pattern). `expansionKey()` (selection.js`:40-49`) is the stable
  per-row string already shared by tree + edit.js; the keyboard handler must reach the SAME
  `onToggleExpanded(key)` the chevron pointer-click reaches (StructureTree.js`:188,293,410`)
  — keyboard and pointer are ONE expansion path. Leaf (note) rows have no `isExpanded`, so
  the branch never fires for them (matches the model).
- **e2e harness CONFIRMED real:** `playwright.config.js` extends
  `@wordpress/scripts/config/playwright.config.js` (boots wp-env, logs into admin);
  `.wp-env.json` = `{ core: null, phpVersion: "8.3", plugins: ["."] }`; `package.json:15`
  `test:e2e` = `wp-scripts test-playwright`. The editor canvas iframe renders the genuine
  TreeGrid with its real roving-tabindex/arrow model, so a new Playwright test CAN
  `keyboard.press('ArrowRight'/'ArrowLeft')` and observe expansion through the real model.
  `expandRow` (`:332-334`) currently clicks the chevron class; zero arrow-key usage exists.
  **Caveat:** the e2e needs a running wp-env (Docker) and may not run in every gate — so
  the spec REQUIRES the e2e arrow-key test to EXIST (the review explicitly asks for "a test
  that exercises the real path"), while the always-run guardrails (jsdom prop-presence +
  mapping unit + mock de-translation) make a silent regression impossible even if e2e is
  skipped.
- **CRITICAL item-16 coverage gap:** the hand-row Add-note button the realIcons test
  targets is ALREADY FIXED (`StructureTree.js:427` uses `icon={plus}` element). The FOUR
  remaining slug strings are all in LEAF editors the realIcons test never mounts:
  `ListControls.js:26` (`icon="plus"`), `HandConfigEditor.js:171`, `AnnotationList.js:61`,
  `PitchList.js:47` (`icon="trash"`). So the existing realIcons guard would NOT have caught
  item 16's actual targets. This makes the lightened, **project-wide** non-string-sentinel
  guard strictly stronger for item 16 than the StructureTree-only realIcons test. The cheap
  guard fails RED today against all four live slug strings and passes once they become
  element imports — exactly the fails-before/passes-after property. Encode: the guard must
  cover ALL icon-bearing components (not just StructureTree); deleting the two-project/
  React-dedup infra is acceptable only if that project-wide RED-on-regression guarantee is
  preserved.

### Q2 — Render-output parity for items 8 (delete dead `interactive`) and 9 (extract mirrored helpers)

**Answer (researcher, evidence-backed):**

**Item 8 — purely additive + dead, strong existing pin (no new pin required).**
- `interactive` is threaded purely as a routing arg (renderSvg → renderSystem → renderMeasure
  → renderHand → renderNote/renderRest) and consumed at exactly two guarded leaves:
  renderNote (`svg.js:764-775`) and renderRest (`svg.js:911-922`), each doing
  `if (interactive) { g.appendChild(hitRect(...)); }` as the FIRST child BEFORE any ink.
  With `interactive` off (the only value any production caller uses — SongCanvas.js`:163`,
  view.js`:134` both omit it), the branch is skipped → the group is byte-identical to a
  flagless render. `hitRect` (`svg.js:250-260`) builds a standalone
  `<rect fill="transparent" data-hit="">` called only from those two guarded branches.
  Deleting the flag, the two `if`s, `hitRect`, `HIT_RECT_WIDTH_SP` (`svg.js:64`), and
  `HIT_RECT_VERTICAL_MARGIN_SP` (`constants.js:34`) cannot change any non-interactive output.
- **Existing pins that survive the deletion:** the non-interactive structural blocks in
  `svg.test.js` (`:69-984` — root/accessibility, per-event text, four-band routing,
  standalone notes, text safety, structure) render `renderSvg(model)` with NO flag and pin
  geometry/attributes/order; they stay green unchanged. The front-end byte-identity guard at
  `render.spec.js:528-529` asserts `svg.locator("[data-hit]").toHaveCount(0)` — the direct
  front-end pin. The interactive-FEATURE tests (the describe at `svg.test.js:986`+ — first-
  child rect, count, dimensions) are the ~15 refs deleted WITH the feature.
- **Requirement:** keep the non-interactive structural svg.test.js blocks green; keep the
  render.spec.js `[data-hit]`-count-0 guard; keep at least one "flagless render emits no
  `data-hit`" assertion (re-pointed at the now-flagless API, e.g. fold the existing
  `svg.test.js:988-996` default-no-hit-rect assertion forward). **Caveat:** there is NO
  literal full-document golden/snapshot (`toMatchSnapshot`/`outerHTML`) — the pin is
  attribute/structure assertions + the unique-`data-hit`-marker count, which is strong
  enough for an additive deletion. Flag to design if belt-and-suspenders is wanted.

**Item 9 — extract only the safely-shareable helpers; do NOT force-unify the ResizeObserver.**
- `accessibleNameFor` is byte-identical between `accessibleName.js:27-51` and `view.js:56-80`
  (its `trimmedString` helper too, and the same i18n imports). SAFE to extract verbatim to
  `src/song/accessibleName.js`; both entries import it.
- `NARROW_CONTAINER_PX` (480) and `NARROW_SP_PX` (7) are identical in both, both derive
  `SP_PX` from the shared `notation/constants.js`. SAFE.
- **Divergence #1 — `availableWidthInSp`:** editor uses `container?.clientWidth ?? 0`
  (optional chaining — tolerates a null React ref); view.js uses `container.clientWidth ?? 0`
  (no `?`). Behaviorally equivalent for a real element. **Canonical: keep the optional-
  chaining form** (`container?.clientWidth`) — a strict superset, safe for both callers, and
  it only affects a null-container path the front end never hits, so front-end output is
  unchanged.
- **Divergence #2 — `drawWhenFontReady`:** identical code; view.js has 2 extra comment lines.
  Comment-only; pick either.
- **Divergence #3 (load-bearing) — `observeResize` is NOT a single shareable function.**
  view.js (`:180-191`) builds a rAF-debounced ResizeObserver whose callback calls `draw()`
  directly and never disconnects (page lives for the document's life). SongCanvas (`:184-201`)
  builds the same rAF-debounce but its callback calls `setMeasuredWidth(...)` (React state →
  re-runs the draw effect) and RETURNS a cleanup that `cancelAnimationFrame` +
  `observer.disconnect()` (React unmount). The CONSUMPTION (imperative draw vs React state)
  and LIFECYCLE (forever vs cleanup-on-unmount) genuinely differ. **Requirement:** item 9's
  `src/notation/dom.js` homes `availableWidthInSp` + `drawWhenFontReady` only (keep it
  **React-free** — both are plain functions, so `dom.js` must NOT import `@wordpress/element`,
  to avoid dragging React into the front-end bundle); each surface's ResizeObserver wiring
  stays per-surface (the design phase may optionally extract a tiny rAF-debounce primitive,
  but NOT a single `observeResize(container, draw)` both call). The prompt's "~90 lines" is
  realistic for accessibleNameFor + availableWidthInSp + drawWhenFontReady; the observers
  legitimately stay.
- **Boundary/cycle/PHP:** Both `view.js` and the editor already legitimately import from
  `notation/` and `song/` today, so the new homes (`src/song/accessibleName.js`,
  `src/notation/dom.js`) cross no boundary. NO cycle — nothing in `src/song/`/`src/notation/`
  imports from `editor/` or `view.js` (only doc-comment mentions). The "editor can't import
  view.js" rule is a **documented convention, NOT lint- or test-enforced** (no `.eslintrc`,
  no biome `no-restricted-imports`, no committed boundary test — T15's audit was manual). The
  extraction RESPECTS the convention by moving shared code DOWN into the already-shared trees
  (the prescribed fix) rather than importing view.js. **`render.php` has ZERO JS/SVG surface**
  — it emits only the wrapper `<div>` + the inert `application/json` `<script>` with the raw
  song string; `view.js` owns the entire client-side render. So items 8 and 9 have no PHP
  surface; the byte-identity guarantee is purely about the client-side `view.js` SVG draw.
- **Parity pin for item 9:** the front-end assertions in `render.spec.js` — accessible name
  (`:500-501`) and structure (`:510-524`) — stay green; they prove the front end renders
  identically after switching to the shared modules.

### Q3 — Item-3 CSS split (build naming + boundary) and Optional-items triage

**Part A — item 3 (researcher, with sources):**
- **wp-scripts naming convention CONFIRMED** (its README §"Working with CSS",
  `node_modules/@wordpress/scripts/README.md:709-722`, + live `build/`): a CSS import whose
  filename STARTS WITH `style.` (`style.scss`) → extracted to `style-[entry].css` (here
  `build/style-index.css`, "front-end AND editor"); EVERY OTHER imported CSS → `[entry].css`
  (here `build/index.css`, "editor only"). Live `build/` today has only `style-index.css`
  (+ `-rtl`) and NO `index.css` because only `style.scss` is imported. Adding
  `import "./editor.scss";` to `index.js` will additionally emit `build/index.css` (+ `-rtl`).
- **block.json wiring CONFIRMED:** KEEP `"style": "file:./style-index.css"` (line 17 is
  already correct — the prompt's "wires only `style`" is accurate; its `file:./style.scss`
  phrasing is loose, the live compiled value `style-index.css` is right), ADD
  `"editorStyle": "file:./index.css"`. `index.js:4` adds `import "./editor.scss";` beside the
  existing `import "./style.scss";`.
- **The split (clean boundary, confirmed):**
  - **STAYS in `style.scss`** (front-end + shared): the top-level `@font-face { "PB Music" }`
    (`:16-22` — the front-end font asset, webpack emits the woff2 from its `url()`), and the
    pre-existing wrapper rules on `.wp-block-piano-block-piano` itself — `border: 1px dashed
    #767676; padding: 1em; color: #767676;` (`:25-27`).
  - **MOVES to `editor.scss`** (editor-only): everything SCSS-nested inside the
    `.wp-block-piano-block-piano { … }` parent from `&__workspace` onward (`:42-146`):
    `&__workspace`, `&__tree` (incl. the `[role="gridcell"]` flex, the `@for $i` aria-level
    indent, `&-expander`, `&-label`), `&__canvas`, `&__canvas-svg` (incl. `.is-selected`).
  - **Nesting mechanic:** the moved children must be re-parented under their own
    `.wp-block-piano-block-piano { __workspace {…} __tree {…} … }` block in `editor.scss`,
    leaving `style.scss` = `@font-face` + `.wp-block-piano-block-piano { border; padding;
    color; }`. Item-17 changes (`#007cba`→`var(--wp-admin-theme-color, #007cba)`, trim
    `__canvas` to `flex:1 1 auto; min-width:0`, drop `__song-input`, delete the stale comments
    at `:29-37`) all happen to the MOVED rules in their new `editor.scss` home — they don't
    affect the split boundary.
  - **No front-end dependency on the moved rules:** `.is-selected` is editor-only (SongCanvas
    adds it post-render; view.js never sets it — stated at `style.scss:140-141`); the
    `__workspace`/`__tree`/`__canvas` classes are emitted only by the editor (edit.js/
    SongCanvas), never by render.php/view.js. Moving them removes dead CSS from the front-end
    bundle with zero front-end visual change — the ~80%-of-the-new-stylesheet win.
- **Iframe / editorStyle reaches the canvas CONFIRMED:** `apiVersion: 3` ⇒ the editor IS
  iframed; block.json `editorStyle` is "enqueued only in the editor" and (registered via
  block.json) loads INSIDE the iframe canvas. EMPIRICAL PROOF: the editor CSS currently ships
  via `style` and already works in-canvas today (tree indents, selection recolors); since
  `style` reaches the iframe, `editorStyle` (same block.json mechanism) does too. The review's
  "Works in the iframed editor (apiVersion 3)" is correct; no new front-end risk (the
  front-end bundle simply loses CSS it never used).

**Part B — Optional-items triage (researcher verdicts; owner asked to "address everything incl. Optional"):**
- **Lighten real-icons infra → IN (conditional).** Deletes ~360 lines (264-line realIcons
  test + two-project/React-dedup jest config). CONDITION: the replacement (non-string-sentinel
  icons mock + a project-wide "no string icon across ALL icon-bearing components" assertion)
  must be RED-on-regression and cover ListControls/PitchList/AnnotationList/HandConfigEditor
  (not just StructureTree). If that guarantee can't be cheaply preserved, DEFER deleting the
  realIcons test.
- **Unify hand vocabulary (HANDS/STAVES) → IN (low risk).** One exported `HANDS` (ordered
  keys + translator-wrapped labels) from songModel.js backs StructureTree's `HANDS` key array
  (`:64`, labels `:382-385`), ContextEditor's restated labels/keys (`:182,189,230,241`), and
  `STAVES`'s `{label,value}` options (`:95-98`). Design caveat: the unified export must serve
  three shapes (iteration-order array, `{label,value}` options, key+label) — e.g. an ordered
  `[{key,label}]` the select derives `{label,value}` from. Internal only, no behavior change.
- **HandConfigEditor label sprintf → IN (low risk).** `:96` raw-concats
  `` `${label} ${field}` `` (not reorderable for translators); switch to sprintf templates.
  Test-touch flag: controls are located by aria-label, so changing the composed string may
  require updating e2e/unit locators.
- **Spacing via Flex/HStack → IN-as-polish (lowest priority; safe to DEFER if scope tightens).**
  Pure cosmetic; touches several components; no behavior/test risk.
- **ToolsPanel-nested-in-PanelBody → DEFER (design judgment).** The review says "Works as-is —
  design judgment." Restructuring the inspector (ToolsPanel as its own group) is a real UX
  change, risks the e2e panel-location assertions and edit.js's most-specific-first panel
  gating (`:592-619`). DEFER unless the owner specifically wants the inspector restructured.
- **Unused/test-only exports → IN (per-symbol care; "unused" means unused in PRODUCTION):**
  - `newRest` (songModel.js`:200`): production-dead, only songModel.test.js. Delete export +
    its test (or keep if a test still asserts it).
  - `BPM_MIN_EXCLUSIVE` (songModel.js`:120`): production-unused (ContextEditor hardcodes
    `min={1}` at `:140`), only songModel.test.js. **EXPLICIT DECISION NEEDED — interacts with
    item 4.** `BPM_MIN_EXCLUSIVE = 0` is an EXCLUSIVE bound (bpm > 0) while NumberControl `min`
    is INCLUSIVE, so `min={1}` is correct and the constant does NOT map cleanly to `min`.
    **Decision: DELETE the constant + its test** (recommended by both researcher and analyst;
    the control's `min={1}` + bounded-int clamp already enforces the bound). Do NOT wire
    `min={BPM_MIN_EXCLUSIVE}` (=0, wrong).
  - `toNumber` (songModel.js`:149`): the FUNCTION is live (`toBoundedInt` calls it `:167`);
    only the EXPORT is test-only. Drop the `export` keyword (keep the function) — NOT a delete.
  - `serializeSong` export: the FUNCTION is used internally by `commitSong`
    (serializeSong.js`:41`); only the EXPORT is test-only. Drop the export (keep the function).
  - `measureCoords` export (selection.js`:67`): the FUNCTION is used internally by
    `globalMeasureNumber` (`:92`); only the EXPORT is test-only. Drop the export (keep it).
  - unused `ToggleControl` mock (wordpress-components.js`:262-275`) and
    `__experimentalTreeGridItem`/`TreeGridItem` mock (`:510-528`, exported `:551`): both dead
    (no production component, no test). Safe to delete (and their `module.exports` entries).
  - **Spec caveat for ALL test-only exports:** "remove the export" means EITHER delete the test
    that imports it OR keep the export (it exists to BE tested). Don't blanket-delete an export
    a test still imports without updating the test, or the suite goes red. Decide per-symbol.
- **Dashed-placeholder-border follow-up → DEFER (explicitly out of scope).** The review scopes
  it out ("note it but do not necessarily fix it here"). Item-3 interaction: the dashed border
  (`style.scss:25`) STAYS in style.scss regardless of the split; item 3 neither creates nor
  worsens it (pre-existing). No decision forced. DEFER to a follow-up issue (touching front-end
  wrapper CSS would also risk the wrapper's "byte-identical front end" expectation).

### Q4 — README/doc scope, item-6 empty-hand rule, and prior-review-wins conflicts

**1. Complete README/doc-edit set (items 5 + 18 + item-8 doc tail) — README.md ONLY:**
- `README.md:143` "no new runtime dependency" → REWORD to acknowledge `@wordpress/icons` as a
  bundled `@wordpress/*` runtime dependency (item 5).
- `README.md:179` "ajv would be the editor bundle's **first** runtime dependency" → REWORD (not
  delete): drop/soften "first" (now false — `@wordpress/icons` holds that title), keep the
  validator's zero-dependency / schema-as-data narrative. Required for internal consistency
  once item 5 admits the icons dep (otherwise two passages contradict). (Analyst-found,
  researcher-confirmed.)
- `README.md:148` (file-layout `src/notation/` row) → drop the "opt-in `interactive` flag …
  hit-rect" clause; keep the "byte-identical front end" point (now unconditional — no flag).
- `README.md:158-160` the entire "### The now-dormant `interactive` hit-rect" SECTION →
  DELETE entirely (item 8 removes the feature it documents).
- `README.md:201` (Tests paragraph) → drop the interactive-hit-rect test clause.
- **Leave (false positives):** `README.md:205` "interactive piano experience" (future audio,
  unrelated to the SVG flag); `README.md:152` "zero-dependency validator" (still true — the
  icons dep is the editor bundle, not the validator).
- **`docs/song-format.md` and all other docs: CLEAN** — grep for interactive/hit-rect/
  `@wordpress/icons`/runtime-dependency/ajv across `docs/` returned nothing. README is the only
  doc surface.

**2. Item 6 empty-hand rule (the one behavioral subtlety) — confirmed:**
- The rule (edit.js`:311-318`, onRemoveNote): after `removeAt(measure[hand], eventIndex)`, if
  `nextEvents.length > 0` set `[hand]: nextEvents`; ELSE destructure the hand key OUT
  (`const { [hand]: _dropped, ...restMeasure } = measure`) so the emptied hand key is
  **DELETED** from the measure (`measure.rightHand === undefined`, NOT `=== []`). (Analyst
  independently corroborated by reading edit.js:302-325.)
- **Scope: the rule belongs ONLY in the remove path, and that is complete.** The grow mutators
  (onAddNote `:210`, insertNoteAt `:474`, onDuplicateNote `:383`) only lengthen a hand; the
  NotePanel edits go through `setEventAt` (REPLACE in place, NotePanel.js`:104`) — note↔rest
  switch is a replace, not a removal — so length is unchanged. Removal is the only op that can
  empty a hand. The prompt's `updateHandEvents(song, coords, fn)` encodes this exactly: `fn`
  returning empty/`null` drops the key; grow callers' `fn` always returns a non-empty array.
- **Pinned by `Edit.test.js:505`** ("onRemoveNote … drops the emptied hand …") asserting
  `persisted.sections[0].measures[0].rightHand` is `toBeUndefined()`. **Acceptance criterion:**
  removing the last event in a hand yields that hand key ABSENT (`undefined`), never `[]`;
  removing a non-last event yields the trimmed array; `Edit.test.js:505` stays green unchanged.

**3. Fix↔prior-win interactions — FOUR "must not regress" guardrails (rest orthogonal):**
- **Items 1 + 2 REINFORCE the "TreeGrid keyboard model + accessibility parity" win** (they
  restore what was actually broken). The new e2e keyboard-expand + treegrid-accessible-name
  tests are the pins that make the win real. No conflict.
- **Guardrail A (items 1 + 20 ↔ single expansion Set + coordinate keys):** item 1's keyboard
  handler must route to the SAME `onToggleExpanded(key)` against the SAME single `expanded`
  Set, using the SAME `expansionKey()` coordinate keys — no parallel state, no second Set.
  Item 20's extracted `ancestorKeys`/event-key helpers must produce BYTE-IDENTICAL key strings
  (`s0`, `s0m1`, `s0m1rightHand`, `s0m1rightHande0`) so Set membership, React keys, and edit.js
  reveal seeds still agree. (Pinned by expansionKey unit tests + tree-expansion e2e.)
- **Guardrail B (item 7 ↔ select-only labels + DropdownMenu roving-tabindex):** the extracted
  `RowActionsMenu` must (a) forward `toggleProps={{ ref, tabIndex, onFocus }}` from the
  TreeGridCell render-prop to the DropdownMenu toggle (roving-tabindex — on the "fine as-is"
  list), and (b) keep the label cell select-only (label Button drives `onSelect`; chevron is
  the `aria-hidden` pointer-only expander). The DropdownMenu mock (wordpress-components.js
  `:371`) returns null unless `children` is a render FUNCTION — the extracted component MUST
  keep render-function children or the toggle vanishes. (Pinned by StructureTree unit tests +
  realIcons toggle test.)
- **Guardrail C (item 17 ↔ [aria-level] indent + recolor-only highlight):** the
  `@for $i … [aria-level="#{$i}"] … padding-inline-start` indent rule must survive the move to
  editor.scss VERBATIM (only its file changes); `.is-selected` must stay recolor-only
  (fill/stroke color only — changing the color VALUE to `var(--wp-admin-theme-color, #007cba)`
  is item 17 and is fine; no layout/size/transform), so no layout shift and the front-end SVG
  stays byte-identical (view.js never sets `.is-selected`). (Pinned by the SVG selection test +
  front-end byte-identity.)
- **Guardrail D (item 17 + item 4 ↔ raw-JSON mode untouched):** removing the unused
  `__song-input` class hook and adding `__next40pxDefaultSize`/`__nextHasNoMarginBottom` to the
  JSON-mode TextareaControl are presentational only — the raw-JSON round-trip (raw string
  persists verbatim, invalid JSON still saves, error Notice shows) must stay green.

---

## Resolved requirements (standalone summary)

Scope decision (owner): address **all** Must-fix (1–5), Should-do (6–20), and the Optional
items that triage as IN below, while respecting the "Explicitly fine as-is (do not change)"
list. Two Optional items are explicitly DEFERRED. The hard global constraints: a published
song renders **byte-identically** (front-end SVG, render.php, schema all unchanged); only
`@wordpress/*` deps; prior-review wins preserved (four guardrails A–D above); and **"tests
green" must remain incompatible with "real component broken"** for items 1, 2, 16.

**Must-fix:**
- **R1 (item 1) — keyboard expand/collapse.** `StructureTree` passes
  `onExpandRow`/`onCollapseRow` that read a stable `data-*` expansion key off the focused
  `<tr>` (single DOM-element arg: `onExpandRow(activeRow)`) and route to the existing
  `onToggleExpanded(key)` against the one `expanded` Set; each expandable `TreeGridRow` carries
  that `data-*` key. Verify: a NEW e2e test drives ArrowRight/ArrowLeft on a focused
  section/measure/hand row and asserts children appear/disappear (the real keyboard path, not
  the chevron); jsdom asserts the callbacks are passed + the row carries the key + a pure
  `<tr>`→key mapping unit. (Guardrail A.)
- **R2 (item 2) — accessible name.** `StructureTree` passes `aria-label={__("Song structure",
  …)}` (drop the dead `label`). The components mock STOPS mapping `label`→`aria-label`. Verify:
  e2e `getByRole("treegrid", { name: "Song structure" })`.
- **R3 (item 3) — editor-only CSS off the front end.** Add `import "./editor.scss";` to
  index.js; move the nested `__workspace`/`__tree`/`__canvas`/`.is-selected` rules to
  `editor.scss` (re-parented under their own `.wp-block-piano-block-piano {…}`); KEEP
  `@font-face` + the wrapper `border/padding/color` in `style.scss`. block.json: KEEP
  `"style": "file:./style-index.css"`, ADD `"editorStyle": "file:./index.css"`. Front-end
  render unchanged (moved classes never appear on the front end).
- **R4 (item 4) — control props.** Add `__next40pxDefaultSize` to every Button/SelectControl/
  TextControl/NumberControl/TextareaControl; add `__nextHasNoMarginBottom` to the
  edit.js TextareaControl; REMOVE the bogus `__nextHasNoMarginBottom` from every NumberControl
  (ContextEditor/HandConfigEditor/PitchEditor/NotePanel).
- **R5 (item 5) — README dependency claim.** Reword `README.md:143` (and `:179`'s "first"
  framing) to acknowledge `@wordpress/icons` as a bundled `@wordpress/*` runtime dep; keep the
  dep itself.

**Should-do (behavior-preserving reuse/simplification):**
- **R6 (item 6)** — import `setSectionAt`/`setMeasureAt`/`setEventAt` in edit.js to replace the
  8 inline two-level rebuilds; add `updateHandEvents(song, coords, fn)` encoding the empty-hand
  rule (fn → empty/`null` drops the hand key) ONCE. Invariant pinned by `Edit.test.js:505`
  (empty hand → key `undefined`, never `[]`).
- **R7 (item 7)** — extract one `RowActionsMenu({ cellProps, label, onDuplicate, onAddBefore,
  onAddAfter, onRemove })` replacing the three copies; optionally fold the repeated
  chevron+label cell. Guardrail B (toggleProps roving-tabindex + select-only label +
  render-function children).
- **R8 (item 8)** — delete the dead `interactive` flag, `hitRect`, `HIT_RECT_WIDTH_SP`,
  `HIT_RECT_VERTICAL_MARGIN_SP` and the ~15 feature tests. Purely additive + dead. Pinned by
  the non-interactive svg.test.js structural blocks (stay green) + `render.spec.js:528-529`
  `[data-hit]`-count-0 guard; keep one "flagless render emits no `data-hit`" assertion.
- **R9 (item 9)** — extract `accessibleNameFor` → `src/song/accessibleName.js` (verbatim) and
  `availableWidthInSp` + `drawWhenFontReady` → `src/notation/dom.js` (React-free; keep the
  defensive `container?.clientWidth`); both entries import. Do NOT unify `observeResize`
  (consumption + lifecycle differ). Pinned by `render.spec.js` front-end name (`:500-501`) +
  structure (`:510-524`).
- **R10 (item 10)** — add `kind: "event"` at edit.js`:218`; delete the compat defaulting block
  (selection.js`:144-156`), its docs (`:120-125`), and the compat test (selection.test.js).
- **R11 (item 11)** — drop the second parse in the `accessibleName` memo (reuse `working`);
  reduce `isInvalid` accordingly.
- **R12 (item 12)** — replace `MetadataEditor.withField` with `omitFalsy`; inline `emitBlock`
  and `emitMember`; move `emit.js` → `src/editor/emit.js` (update the 2 importers:
  `ContextEditor.js:45` prod + `emit.test.js`).
- **R13 (item 13)** — collapse the duplicated annotations drop-key wrappers
  (NotePanel/MeasurePanel) to one-liners via the omit helpers; one onDeselect idiom.
- **R14 (item 14)** — HandConfigEditor uses `replaceAt`/`removeAt`/`insertAt` (drop local
  `replaceRow`).
- **R15 (item 15)** — one exported `NONE_OPTION` from songModel.js; `ALTER_KEY_OPTIONS` reuses
  `noteNameOptions("english")`.
- **R16 (item 16)** — all icon-bearing components use `@wordpress/icons` ELEMENTS (`plus`,
  `trash`); drop the redundant `label` in `AddButton`; add `isDestructive` to remove buttons.
  A string-icon guard remains RED-on-regression and covers ALL icon-bearing components.
- **R17 (item 17)** — `#007cba` → `var(--wp-admin-theme-color, #007cba)` (×3); trim `__canvas`
  to `flex:1 1 auto; min-width:0`; delete the unused `__song-input` hook + stale comments. All
  in the moved editor.scss. Guardrails C + D.
- **R18 (item 18)** — fix stale comments (NotePanel/MeasurePanel/SectionPanel/selection.js/
  accessibleName.js + the StructureTree docblock's false keyboard claims); strip
  pipeline-provenance tags (`KD 14`, `T6`, `AC3`…).
- **R19 (item 19)** — remove the `heading` prop + the two raw `<h3>`s in ContextEditor.
- **R20 (item 20)** — extract `ancestorKeys(coords)` (+ the inline event-key) into selection.js.
  Guardrail A (byte-identical key strings).

**Optional — triage:**
- IN: lighten real-icons infra (CONDITIONAL on the project-wide RED-on-regression string-icon
  guard); unify hand vocabulary into one `HANDS` export; HandConfigEditor label sprintf;
  unused/test-only export cleanup (per-symbol: DELETE `newRest` + its test; **DELETE
  `BPM_MIN_EXCLUSIVE`** + its test — do not wire it into the inclusive `min`; drop the EXPORT
  keyword on `toNumber`/`serializeSong`/`measureCoords` keeping the functions; delete the dead
  `ToggleControl` + `__experimentalTreeGridItem` mocks).
- IN-as-polish (lowest priority, safe to defer if scope tightens): spacing via Flex/HStack.
- **DEFER:** ToolsPanel-nested-in-PanelBody (design judgment; risks panel-location/gating);
  dashed-placeholder-border (review-scoped out; no item-3 interaction forces it).

**Open decision resolved in this phase:** `BPM_MIN_EXCLUSIVE` → DELETE (not wire) because it is
an exclusive bound (0) that does not map to NumberControl's inclusive `min` (correctly `1`).

**Verification meta-rule (items 1, 2, 16):** the real-contract assertion lives where a passing
test cannot coexist with the production bug — e2e (real WP/components via wp-env) for the item-1
keyboard path and item-2 accessible name, PLUS the mock de-translation of `label`; a project-wide
non-string-icon guard (or the existing realIcons test, extended) for item 16. The e2e tests must
EXIST (review requires "a test that exercises the real path"); the always-run jsdom guardrails
(prop-presence, mapping unit, mock de-translation, non-string-icon assertion) prevent a silent
regression even if e2e is skipped in a gate without Docker.
