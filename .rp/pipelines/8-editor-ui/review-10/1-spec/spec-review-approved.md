# Spec review — APPROVED (review-10)

**Verdict:** APPROVED
**Spec under review:** `1-spec/spec.md`
**Reviewer:** spec-reviewer

The spec is complete, internally consistent, faithful to the intent, and testable. It captures every actionable finding from `0-prompt/prompt.md`, places every deferred/rejected/preserved item correctly in Out of Scope, soundly justifies the `NumberControl` reversal against the real component contract, and keeps "tests green" from masking "real component broken" by routing non-unit-assertable fixes to e2e. I verified the spec's load-bearing claims against the live branch tree before approving.

## What I scrutinized and confirmed

### 1. Faithful + complete scope
Every actionable finding in the intent maps to a requirement, and every deferral/reject/preserved-win is correctly placed:

- Top priority 1 (tree collapse) → **R-TREE**; Top priority 2 (list-row layout) → **R-LR1/2/3**; Top priority 3 (`NumberControl` prop) → **R-NUM** (rejected with rationale).
- P1 deletes → **R-DEL**; P1 focus → **R-FOCUS**; P1 canvas framing → **R-DOCS** (with click-to-select correctly rejected).
- P2 JSON Notice → **R-JSON**; P2 `InvalidState` → **R-INVALID**; P2 `?? undefined` → **R-NOOP**; P2 docs (canvas / `style.scss` / `songModel` CRITICAL block) → **R-DOCS**.
- The four deferrals (13-mutator refactor, canvas highlight, list-row Stage 2, nearest-survivor focus) → **R-FOLLOWUP** (file, implement none).
- The six optional/partial P2s (toolbar labels, scattered add-affordances, hand-group-as-text, curried mappers, `globalMeasureNumber` alloc, `ContextEditor resetAll`) → Out of Scope, explicitly not gates.
- The five rejects and the preserved prior-review wins → Out of Scope, "do NOT undo / do NOT touch."

Nothing actionable is silently dropped; nothing rejected is silently re-introduced.

### 2. The `NumberControl` reversal is sound and justified
The spec leaves all 7 sites omitting `__nextHasNoMarginBottom` and records the real-contract mechanism, not a bare assertion: `__nextHasNoMarginBottom` is a `BaseControl` deprecation flag; `NumberControl` does not destructure it and renders `InputControl` with no `BaseControl` of its own; **`InputControl` hardcodes `__nextHasNoMarginBottom={true}` on its own `BaseControl`**, so `NumberControl` is margin-free by construction and the prop has nothing to suppress. Cross-checked against Gutenberg issue #73848, which lists the siblings that correctly DO set it (`SelectControl`/`TextControl`/`TextareaControl`) and deliberately excludes `NumberControl`/`InputControl`. The spec also correctly separates this from the visible list-row symptoms (a layout issue fixed independently by R-LR1/2/3). I confirmed all 7 sites on the live tree: `PitchEditor.js:69,80`, the two in `ContextEditor.js` (bpm + beats), `HandConfigEditor.js:142,178`, `NotePanel.js:179` — 7 total, all omitting the prop, every sibling control setting it.

### 3. Acceptance criteria are testable and honest (no false-green)
- **R-LR1 (alignment)** is correctly flagged not-unit-assertable: the `HStack` mock swallows `alignment` (`test/mocks/wordpress-components.js:206`). Routed to e2e/real-render; the spec explicitly forbids a unit test that would falsely "prove" it.
- **R-LR2 (min-width)** is correctly flagged unit-assertable: the mock spreads `...rest` onto the `<input>`, so the inline `min-width` reaches the DOM.
- **R-FOCUS** is correctly flagged not-unit-assertable: the `TreeGridCell` mock calls its render-prop child with `{}` (`test/mocks/wordpress-components.js:539-544`), so `cellProps.ref` is `undefined` under jest and any ref-based `.focus()` is inert. Routed to `specs/editor.spec.js` (which I confirmed exists, with `treeRow(...).focus()` + `keyboard.press(...)`); jest is limited to the structural precondition (`aria-current`). Zero `toHaveFocus`/`activeElement` assertions exist in the jest suite, so the e2e split is well-founded.
- **R-INVALID** correctly calls out the `VStack`/`__experimentalVStack` mock addition as a prerequisite (confirmed absent from the mock today), preventing an import failure under jest.
- The cross-cutting acceptance criterion (#11) explicitly forbids relying on `FlexItem`/`FlexBlock` this run (confirmed absent from the mock) and ties off the e2e/mock obligations.

### 4. Internal consistency
The delete policy (drop all dialogs, rely on native undo, recoverability grounded in `setAttributes` → editor undo history) and the focus split (add/dup focuses the new row; remove focuses the `tabIndex={-1}` treegrid host; survivor-math deferred) are coherent and do not contradict each other or any preserved win. The exact test deltas the spec names are accurate on the live tree: `StructureTree.test.js:388-397` (`calls.toggle` `[]`→`["s0"]`, stale comment at `:393`), the two cancel-path deletions (`SectionPanel.test.js:279`, `StructureTree.test.js:481`), the dropped OK clicks (`SectionPanel.test.js:259/275`, `StructureTree.test.js:474`, `Edit.test.js:463`), and `Edit.test.js:309` (`toBe(errors[0])`).

## Non-blocking note for the design/code phase (not a rejection ground)
R-DEL removes `pendingRemoveSection`, its setter, and the root `ConfirmDialog` from `StructureTree.js`. The component's class-level docstring (`StructureTree.js:21-33`) currently documents that `pendingRemoveSection` state and the "section Remove captures the index … a single `ConfirmDialog` at the tree root gates the actual removal" flow. After R-DEL lands, that docstring describes deleted code. R-DEL's implementation list and R-DOCS's enumerated corrections do not call this out explicitly. This is not a spec defect that could ship broken behavior or mislead the implementer about scope — anyone deleting the state it documents would update it — but the implementing phase should refresh that docstring (e.g. "section Remove fires immediately, like measure/note") when it removes the state, so the file's own documentation stays truthful.
