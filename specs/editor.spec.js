/**
 * Editor end-to-end tests for the Piano block.
 *
 * These tests drive the real built block in the editor via wp-env and verify
 * its authoring + persistence behavior. The CANVAS-FIRST visual editor is the
 * DEFAULT surface: a freshly inserted block shows a sheet-music canvas — seeded
 * with an empty grand staff so it is ready for notes without any raw JSON — that
 * the author reads while editing through the sidebar. The canvas is display +
 * highlight only: it does NOT hit-test, so clicking it never changes the
 * selection. Selection is driven by the left **structure tree** (toggled from the
 * block toolbar's "Structure" button and rendered left of the canvas inside the
 * block, NOT in Gutenberg's global List View). Selecting a tree row reveals the
 * block's settings sidebar panels (the always-present Song panel plus the
 * Note/Measure/Section panels bound to the selection) and highlights the matching
 * group on the canvas; song- and event-level settings are edited there, not on
 * the canvas. A non-empty-but-invalid song shows an invalid state that routes to
 * the raw JSON editor.
 *
 * Authoring no longer happens with on-canvas add buttons. The structure tree
 * navigates Section → Measure → {Right hand, Left hand} → Note. Each row mirrors
 * core's List View row: a select-only label cell (with a non-focusable stock
 * chevron beside it that drives expansion) and an actions cell holding a single
 * `DropdownMenu` of the row's add/remove/duplicate actions (hand groups host a
 * direct "Add note" button instead). Because the label is select-only, drilling
 * into the tree expands through the chevron, not the label; an empty measure's
 * first note is seeded from its hand group's "Add note" (the canvas add-grid is
 * gone). Once an event is selected, the Note panel's contextual "Add note"
 * inserts a sibling in the same hand (inferred from the selection) and "Remove
 * note" deletes it; sections and measures are renamed via the "Section
 * name"/"Measure name" fields in their inspector panels. The Song panel's "Note
 * language" selector converts the whole song between English and Spanish
 * spellings and stores the choice in an additive `language` field.
 *
 * The raw `Song (JSON)` textarea is reached by switching the block into JSON
 * mode from the block toolbar; in that mode the raw string persists
 * unconditionally — conformant input shows no error and is stored verbatim,
 * non-conformant input is flagged by a visible error notice yet is STILL stored
 * unchanged, and a stored song round-trips faithfully across save/reload
 * including HTML-significant characters.
 *
 * Prerequisites (run from the worktree root):
 *   1. npm install        — installs the toolchain (Playwright via @wordpress/scripts)
 *   2. npm run build       — compiles src/ → build/ so wp-env serves the real block
 *   3. npm run env:start   — boots wp-env (Docker); the tests target the tests site
 *   4. npm run test:e2e    — runs this spec
 *
 * The block plugin is activated and posts are cleaned up via requestUtils.
 */

import { expect, test } from "@wordpress/e2e-test-utils-playwright";

// The label of the raw-JSON field (src/edit.js) — used to locate the
// TextareaControl on the block canvas by its accessible label once the block is
// switched into JSON mode.
const SONG_FIELD_LABEL = "Song (JSON)";

// A small conformant song — exercises the required `sections` shape with one
// note so the stored value is non-trivial yet passes validation.
const CONFORMANT_SONG = JSON.stringify(
	{
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "C", octave: 4 }],
							},
						],
					},
				],
			},
		],
	},
	null,
	2,
);

// A conformant song whose pitch is spelled with a Spanish note name (`do`).
// The editor edits each song in the note-name system it is already written in
// and never rewrites an untouched pitch, so an unrelated edit must leave the
// spelling intact.
const SPANISH_SONG = JSON.stringify(
	{
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "do", octave: 4 }],
							},
						],
					},
				],
			},
		],
	},
	null,
	2,
);

// A conformant song carrying an explicit `language` field, used to prove the
// additive field round-trips through JSON mode unchanged and never blocks
// saving (AC11/AC13/AC14). Its pitch is already Spanish-spelled, matching the
// stored `language`.
const LANGUAGE_TAGGED_SONG = JSON.stringify(
	{
		language: "spanish",
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "quarter",
								pitches: [{ step: "do", octave: 4 }],
							},
						],
					},
				],
			},
		],
	},
	null,
	2,
);

// A conformant song whose note's `text` deliberately carries HTML-significant
// characters (a double quote, `<`, `>`, and `&`) so the save→reload round-trip
// exercises the block-delimiter-comment escaping. A note's annotation `text` is
// free text, so this stays conformant.
const ROUND_TRIP_SONG = JSON.stringify(
	{
		metadata: { title: 'A "quoted" <title> & more' },
		sections: [
			{
				measures: [
					{
						rightHand: [
							{
								type: "note",
								duration: "half",
								annotations: [{ text: 'C7 & <alt> "sus"', placement: "above" }],
								pitches: [{ step: "C", octave: 4 }],
							},
						],
					},
				],
			},
		],
	},
	null,
	2,
);

// Not parseable as JSON at all — a parse failure IS a conformance error.
const INVALID_JSON = "{ not json";

// Valid JSON but non-conformant — `quaver` is not in the closed duration enum,
// so the validator flags it.
const NON_CONFORMANT_JSON = JSON.stringify({
	sections: [
		{ measures: [{ rightHand: [{ type: "note", duration: "quaver" }] }] },
	],
});

/** Locate the single Piano block's raw-JSON field on the editor canvas. */
function songField(editor) {
	return editor.canvas.getByLabel(SONG_FIELD_LABEL);
}

/**
 * The block's non-blocking JSON-mode validation error region: a `Notice` with
 * `status="error"` rendered beneath the textarea (src/edit.js). The editor
 * shows unrelated notices, so this is scoped to the error-status notice on the
 * block canvas rather than a blanket negative on all notices.
 */
function errorNotice(editor) {
	return editor.canvas.locator(".components-notice.is-error");
}

/**
 * The canvas-first editor's single interactive surface on the canvas: the
 * `.wp-block-piano-block-piano__canvas` container into which the notation core
 * mounts the working song's `<svg>` — the staff the author both reads and edits
 * on (src/editor/SongCanvas.js). Present whenever the song is empty-then-seeded
 * or conformant; absent in the invalid state.
 */
function canvasContainer(editor) {
	return editor.canvas.locator(".wp-block-piano-block-piano__canvas");
}

/** The rendered sheet-music `<svg>` mounted inside the canvas container. */
function canvasSvg(editor) {
	return canvasContainer(editor).locator("svg");
}

/**
 * The note groups the notation core emits on the canvas — each a `<g>` carrying
 * `data-kind="note"` (src/notation/svg.js). Display + highlight only: a click no
 * longer resolves to a selection (the canvas does not hit-test); the group only
 * carries the `is-selected` decoration when the matching note is selected via the
 * structure tree.
 */
function noteGroups(editor) {
	return editor.canvas.locator('[data-kind="note"]');
}

/**
 * Open the block settings sidebar (the document/block "Settings" panel) and
 * return the page-level region the block's `InspectorControls` render into. The
 * sidebar lives on the main page, NOT in the `editor.canvas` iframe, so its
 * controls are located on `page` rather than `editor.canvas`.
 */
async function openSettingsSidebar(editor, page) {
	await editor.openDocumentSettingsSidebar();
	return page.getByRole("region", { name: "Editor settings" });
}

/**
 * A sidebar inspector panel located by its `PanelBody` title. The block's
 * always-present panel is "Song"; "Note"/"Measure"/"Section" are gated by the
 * selection's kind — each rendered as a `PanelBody` whose title toggles the
 * panel, so it surfaces as a button with that accessible name in the settings
 * region (src/editor/inspector/*). (The structure browser is no longer a sidebar
 * panel; it is the left structure tree on the canvas.)
 */
function inspectorPanel(sidebar, title) {
	return sidebar.getByRole("button", { name: title, exact: true });
}

/**
 * The Song panel's metadata Title field, in the settings sidebar. The `title`
 * lives in the always-present Song panel (src/editor/inspector/SongPanel.js →
 * MetadataEditor), reached on `page`, distinct from any canvas locator.
 */
function titleField(sidebar) {
	return sidebar.getByLabel("Title", { exact: true });
}

/**
 * The Song panel's "Note language" select (src/editor/inspector/SongPanel.js).
 * A `SelectControl` whose accessible name is its label; changing it runs
 * `mapSong` and commits, converting every pitch spelling and storing the
 * `language` field.
 */
function languageSelect(sidebar) {
	return sidebar.getByLabel("Note language", { exact: true });
}

/**
 * Assert the left structure tree is already open. The tree is the selection
 * surface and is now open by default the first time the block is selected
 * (src/edit.js `showTree` defaults to `true`); the block toolbar's "Structure"
 * button still closes and reopens it. Tests no longer toggle it on before drilling
 * in — they just confirm it is present, which also pins AC1's open-by-default.
 */
async function assertStructureTreeOpen(editor) {
	await expect(structureTree(editor)).toBeVisible();
}

/**
 * The structure tree's root container on the canvas: the
 * `.wp-block-piano-block-piano__tree` element the `StructureTree` renders into,
 * left of the canvas inside the block (src/editor/StructureTree.js). The tree
 * lives on the editor canvas iframe, so it is located on `editor.canvas`. Present
 * by default (the tree is open on insert) until the "Structure" toggle closes it.
 */
function structureTree(editor) {
	return editor.canvas.locator(".wp-block-piano-block-piano__tree");
}

/**
 * A structure-tree label row's select button, by the 1-based ordinal/hand name
 * its label carries ("Section N" / "Measure M" / "Right hand" / a note's pitch).
 * The redesigned row's label is plain text — the disclosure chevron is a
 * non-focusable sibling `<span>`, not part of the label — so the row is matched
 * by its EXACT visible name (src/editor/StructureTree.js). The exact match never
 * collides with the row's own controls: the actions `DropdownMenu` trigger is
 * named "Actions for Section 1" (so "Section 1" exact misses it) and the
 * hand-row "Add note" button spells its target lowercase ("Add note to Right
 * hand of …"), so the capitalized "Right hand" exact name misses that too.
 *
 * After S5 the label is SELECT-AND-REVEAL for section and measure rows: clicking
 * it always drives the kind-tagged selection AND expands the row when it is
 * currently collapsed (but never collapses — collapse stays on the chevron and
 * ArrowLeft). Note rows remain select-only (notes are leaves with no children to
 * reveal). The hand-group row is the exception: it is non-selecting, so its
 * label/button click toggles expansion only.
 * Scoped to the tree container.
 *
 * @param {Object} editor The Playwright editor fixture.
 * @param {string} name   The row's exact label (e.g. "Section 1", "C").
 */
function treeRow(editor, name) {
	return structureTree(editor).getByRole("button", { name, exact: true });
}

/**
 * The non-focusable disclosure chevron for the structure-tree row whose label is
 * `name`: the sibling `.wp-block-piano-block-piano__tree-expander` span inside
 * the same row (src/editor/StructureTree.js `TreeExpander`). It is `aria-hidden`
 * with no role/tabIndex — a pointer-only affordance — so it is located by its
 * stable class scoped to the row that holds the matching label button, not by a
 * role. `TreeGridRow` renders each row as a `<tr>`, so the chevron is found via
 * the row element that `has` the label button.
 *
 * @param {Object} editor The Playwright editor fixture.
 * @param {string} name   The row's exact label (e.g. "Section 1").
 */
function rowChevron(editor, name) {
	return structureTree(editor)
		.locator("tr")
		.filter({ has: treeRow(editor, name) })
		.locator(".wp-block-piano-block-piano__tree-expander");
}

/**
 * Expand a structure-tree row by clicking its disclosure chevron, revealing its
 * children. Idempotent: reads the row's aria-expanded attribute and clicks the
 * chevron only when the row is not already open. If the row is already expanded
 * this is a no-op — re-calling it cannot accidentally collapse an open row (the
 * chevron is a pure toggle, so clicking an already-open row would collapse it).
 * Use raw rowChevron(...).click() when you specifically need to collapse a row.
 *
 * @param {Object} editor The Playwright editor fixture.
 * @param {string} name   The row's exact label to expand (e.g. "Section 1").
 */
async function expandRow(editor, name) {
	// Idempotent: edit.js seeds s0 + s0m0 expanded on mount, so the seeded
	// first section/measure may already be open. The chevron is a pure toggle,
	// so clicking an open row would COLLAPSE it — only click when collapsed.
	// The row's <tr> carries aria-expanded (real + mock __experimentalTreeGridRow);
	// "true" means already open → no-op.
	const row = structureTree(editor)
		.locator("tr")
		.filter({ has: treeRow(editor, name) });
	if ((await row.getAttribute("aria-expanded")) !== "true") {
		await rowChevron(editor, name).click();
	}
}

/**
 * Open a structure-tree row's actions `DropdownMenu` by its trigger's accessible
 * name (the `label` src/editor/StructureTree.js gives each menu, e.g.
 * "Actions for Section 2", "Actions for Measure 1 of section 1",
 * "Actions for Note 1 of Right hand of measure 1 of section 1") and return the
 * locator for the menu item with the given visible name ("Duplicate", "Add
 * before", "Add after", "Remove").
 *
 * The trigger lives inside the tree, but the real `DropdownMenu` opens its
 * content in a `Popover` that portals out of the tree container (to the editor
 * canvas document) — so the trigger is located inside `structureTree` while the
 * `MenuItem` is queried on `editor.canvas`, scoped to the open `menu` role so it
 * never matches a same-named item in another row's (closed) menu.
 *
 * @param {Object} editor       The Playwright editor fixture.
 * @param {string} actionsLabel The menu trigger's accessible name.
 * @param {string} itemName     The visible name of the menu item to return.
 * @return {import('@playwright/test').Locator} The menu item locator.
 */
async function openRowAction(editor, actionsLabel, itemName) {
	await structureTree(editor)
		.getByRole("button", { name: actionsLabel, exact: true })
		.click();
	return editor.canvas
		.getByRole("menu")
		.getByRole("menuitem", { name: itemName, exact: true });
}

/**
 * A structure-tree direct action button, by its precise full label. After the
 * redesign the per-row add/remove/duplicate controls live in each row's actions
 * `DropdownMenu` (reached via `openRowAction`); the only remaining direct action
 * button is the hand-group "Add note" (src/editor/StructureTree.js — e.g. "Add
 * note to Right hand of measure 1 of section 1"). Its label is unique and
 * verb-prefixed, matched exactly, and never collides with a row's plain label.
 */
function treeAction(editor, name) {
	return structureTree(editor).getByRole("button", { name, exact: true });
}

/**
 * Switch the selected block into JSON mode via the block toolbar's mode-switch
 * button (accessible name "Edit as JSON" while in visual mode). Scoped to the
 * block toolbar, so it never collides with the canvas "Edit as JSON" button the
 * invalid state also shows.
 */
async function switchToJsonMode(editor) {
	await editor.clickBlockToolbarButton("Edit as JSON");
}

/**
 * Switch the selected block back into visual mode via the block toolbar's
 * mode-switch button (accessible name "Visual editor" while in JSON mode).
 */
async function switchToVisualMode(editor) {
	await editor.clickBlockToolbarButton("Visual editor");
}

/**
 * Seed the selected block's raw `song` via JSON mode: switch to JSON, fill the
 * textarea, and blur so the controlled value settles before anything reads it.
 */
async function seedSongViaJson(editor, raw) {
	await switchToJsonMode(editor);
	const field = songField(editor);
	await field.fill(raw);
	await field.blur();
}

/** Read the single Piano block's stored `song` attribute. */
async function storedSong(editor) {
	const blocks = await editor.getBlocks();
	return blocks[0].attributes.song;
}

/** Parse the single Piano block's stored `song` attribute. */
async function storedSongObject(editor) {
	return JSON.parse(await storedSong(editor));
}

test.describe("Piano block — editor authoring, persistence and validation", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ admin, requestUtils }) => {
		await requestUtils.deleteAllPosts();
		await admin.createNewPost();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("the canvas-first visual editor is the default surface", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The default surface is the interactive canvas, not the raw textarea.
		await expect(canvasContainer(editor)).toBeVisible();
		await expect(songField(editor)).toHaveCount(0);

		// JSON mode is reachable from the toolbar; switching reveals the textarea.
		await switchToJsonMode(editor);
		await expect(songField(editor)).toBeVisible();
	});

	test("a freshly inserted block seeds an empty staff yet stores nothing", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The block seeds an empty grand staff on the canvas, ready for notes…
		await expect(canvasSvg(editor)).toBeVisible();

		// …yet no song content is stored: the seed is lazy, so the attribute stays
		// the empty default until the first edit commits.
		const blocks = await editor.getBlocks();
		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("piano-block/piano");
		expect(blocks[0].attributes.song).toBe("");

		// In JSON mode the raw field renders blank for the not-yet-persisted song.
		await switchToJsonMode(editor);
		await expect(songField(editor)).toHaveValue("");
	});

	test("the seeded empty measure adds its first note from the structure tree", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The seeded empty song has no on-canvas add affordance — the canvas
		// add-grid is gone. The first note is bootstrapped from the structure tree,
		// which is open by default: expand the seeded section then its measure (via
		// the disclosure chevrons — the label is select-only and no longer expands),
		// which reveals the hand rows, then click the right hand's "Add note" (the
		// only first-note entry point for an empty measure; it seeds a default
		// RIGHT-hand note).
		await expect(structureTree(editor)).toBeVisible();
		await expandRow(editor, "Section 1");
		await expandRow(editor, "Measure 1");
		await treeAction(
			editor,
			"Add note to Right hand of measure 1 of section 1",
		).click();

		// The stored song now carries a right-hand note in that measure (the
		// default hand), and only that hand…
		const parsed = await storedSongObject(editor);
		expect(Array.isArray(parsed.sections)).toBe(true);
		expect(parsed.sections[0].measures[0].rightHand).toHaveLength(1);
		expect(parsed.sections[0].measures[0].rightHand[0].type).toBe("note");
		expect(parsed.sections[0].measures[0].leftHand).toBeUndefined();

		// …and the canvas re-rendered it as a note group.
		await expect(noteGroups(editor).first()).toBeVisible();
	});

	test("clicking a note on the canvas does not change the selection", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant single-note song, return to the canvas.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);

		// With nothing selected, only the always-present panels are shown; the
		// selection-gated panels are absent.
		const sidebar = await openSettingsSidebar(editor, page);
		await expect(inspectorPanel(sidebar, "Song")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Note")).toHaveCount(0);

		// The canvas is display + highlight only — it no longer hit-tests. Clicking a
		// rendered note group must NOT set a selection: no per-level panel appears and
		// no group is marked selected (AC3). Selection comes only from the structure
		// tree (the tree-driven selection is covered by its own test).
		const note = noteGroups(editor).first();
		await note.click();

		await expect(inspectorPanel(sidebar, "Note")).toHaveCount(0);
		await expect(inspectorPanel(sidebar, "Measure")).toHaveCount(0);
		await expect(inspectorPanel(sidebar, "Section")).toHaveCount(0);
		await expect(note).not.toHaveClass(/is-selected/);
	});

	test("the Note panel adds a sibling note in the same hand, then removes it", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed the single right-hand C4 note and select it via the structure tree
		// (open by default).
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);
		// Expand down to the note via the chevrons (the labels are select-only), then
		// SELECT the note row by clicking its (plain) label.
		await expandRow(editor, "Section 1");
		await expandRow(editor, "Measure 1");
		await expandRow(editor, "Right hand");
		await treeRow(editor, "C").click();
		await expect(inspectorPanel(sidebar, "Note")).toBeVisible();

		// The Note panel's contextual "Add note" inserts a sibling in the selected
		// note's hand (inferred — never prompted). Scoped to the `sidebar` and
		// `exact`, so it never matches the tree's "Add note to Right hand …" action.
		await sidebar
			.getByRole("button", { name: "Add note", exact: true })
			.click();

		// A second right-hand note now exists in that same measure/hand, and the
		// canvas re-rendered both note groups.
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures[0].rightHand.length;
			})
			.toBe(2);
		await expect(noteGroups(editor)).toHaveCount(2);

		// The newly added note is auto-selected, so the Note panel's "Remove note"
		// deletes it, returning to a single note.
		await sidebar
			.getByRole("button", { name: "Remove note", exact: true })
			.click();
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures[0].rightHand.length;
			})
			.toBe(1);
	});

	test("the structure tree adds, removes and duplicates sections and measures", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a single-section, single-measure song; the structure tree is open by
		// default. Expand the section (via its chevron — the label is select-only) so
		// its measure rows, and their actions menus, are reachable.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);
		await expandRow(editor, "Section 1");

		// Add a measure via the Section panel's "Add measure" button → that section
		// now has two measures. (The block-menu reshape dropped "Add measure" from the
		// section row menu; the capability re-homed to a SectionPanel sidebar button.
		// Selecting the section row reveals that panel.) Scoped to the `sidebar` and
		// `exact`, mirroring the "Add section" step below, so it never matches the
		// tree's "Add note to …" actions.
		await treeRow(editor, "Section 1").click();
		await expect(inspectorPanel(sidebar, "Section")).toBeVisible();
		await sidebar
			.getByRole("button", { name: "Add measure", exact: true })
			.click();
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures.length;
			})
			.toBe(2);

		// Duplicate measure 1 from its actions menu → a deep copy lands right after
		// it, so that section now has three measures.
		await (
			await openRowAction(
				editor,
				"Actions for Measure 1 of section 1",
				"Duplicate",
			)
		).click();
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures.length;
			})
			.toBe(3);

		// Add a section (the Song panel's "Add section" in the settings sidebar) →
		// the song now has two sections.
		await sidebar
			.getByRole("button", { name: "Add section", exact: true })
			.click();
		await expect
			.poll(async () => (await storedSongObject(editor)).sections.length)
			.toBe(2);

		// Duplicate section 1 from its actions menu → its deep copy lands right after
		// it, so the song now has three sections.
		await (
			await openRowAction(editor, "Actions for Section 1", "Duplicate")
		).click();
		await expect
			.poll(async () => (await storedSongObject(editor)).sections.length)
			.toBe(3);

		// Remove the third measure of section 1 (the duplicate) from its actions menu
		// → back to two there. (Remove is the `isDestructive` menu item.)
		await (
			await openRowAction(
				editor,
				"Actions for Measure 3 of section 1",
				"Remove",
			)
		).click();
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures.length;
			})
			.toBe(2);

		// Remove the third (empty) section from its actions menu → removed immediately
		// (no confirm dialog; removes are immediate and undo-reversible).
		await (
			await openRowAction(editor, "Actions for Section 3", "Remove")
		).click();
		await expect
			.poll(async () => (await storedSongObject(editor)).sections.length)
			.toBe(2);
	});

	test("a measure row's Add before / Add after insert at the right index and auto-select", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed the single-measure song (its one measure carries a right-hand C4 note,
		// so it is identifiable by content regardless of where positional inserts push
		// it). The structure tree is open by default; expand the section so its measure
		// rows and their actions menus are reachable.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);
		await expandRow(editor, "Section 1");

		// The original note-bearing measure is the only one with a `rightHand` — empty
		// `newMeasure()` inserts carry none — so its live index is ordinal-independent.
		const noteMeasureIndex = async () => {
			const parsed = await storedSongObject(editor);
			return parsed.sections[0].measures.findIndex(
				(measure) => measure.rightHand?.length === 1,
			);
		};
		const measureCount = async () =>
			(await storedSongObject(editor)).sections[0].measures.length;

		// "Add before" on the only measure (row "Measure 1", index 0) inserts a fresh
		// empty measure AT index 0, pushing the note-bearing measure to index 1. The
		// menu item is exact, so "Add before" never loosely matches another "Add"
		// control.
		await (
			await openRowAction(
				editor,
				"Actions for Measure 1 of section 1",
				"Add before",
			)
		).click();

		// The measure count grew to two, the new (empty) measure landed at index 0, and
		// the note-bearing original is now at index 1 (the ordinal shift "Add before"
		// causes).
		await expect.poll(measureCount).toBe(2);
		await expect.poll(noteMeasureIndex).toBe(1);

		// The inserted measure is auto-selected: the Measure panel opened on it and its
		// tree row carries `aria-current`. The insert sits at index 0, so its row is the
		// re-derived "Measure 1" (NOT a stale lookup — the note-bearing measure is now
		// "Measure 2").
		await expect(inspectorPanel(sidebar, "Measure")).toBeVisible();
		await expect(treeRow(editor, "Measure 1")).toHaveAttribute(
			"aria-current",
			"true",
		);

		// "Add after" must target the note-bearing measure, whose row is now the
		// RE-DERIVED "Measure 2" (it was "Measure 1" before the insert above). Its
		// actions menu name shifts with it.
		await (
			await openRowAction(
				editor,
				"Actions for Measure 2 of section 1",
				"Add after",
			)
		).click();

		// The count grew to three and the new measure landed one past the note-bearing
		// measure: the note-bearing measure stays at index 1, the fresh measure sits at
		// index 2.
		await expect.poll(measureCount).toBe(3);
		await expect.poll(noteMeasureIndex).toBe(1);

		// The "Add after" insert is auto-selected at index 2 — its re-derived row is
		// "Measure 3" — with the Measure panel still open on it.
		await expect(inspectorPanel(sidebar, "Measure")).toBeVisible();
		await expect(treeRow(editor, "Measure 3")).toHaveAttribute(
			"aria-current",
			"true",
		);
	});

	test("selecting structure-tree rows reveals the right panels", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant single-note song; the structure tree is open by default.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);

		// Selecting the SECTION row reveals the Section panel only (every kind has a
		// section), not the Measure/Note panels. After S5 clicking a collapsed section
		// label selects AND reveals its children — the "clicking the text doesn't reveal
		// anything" regression is fixed. A section selection decorates nothing on the
		// canvas: section/measure are surfaced through the tree and panels.
		await treeRow(editor, "Section 1").click();
		await expect(inspectorPanel(sidebar, "Section")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Measure")).toHaveCount(0);
		await expect(inspectorPanel(sidebar, "Note")).toHaveCount(0);
		// The label click above already expanded Section 1 (select-and-reveal); the
		// measure row is now visible without a separate chevron click.
		await expect(treeRow(editor, "Measure 1")).toBeVisible();

		// Selecting the MEASURE row reveals Measure + Section (a measure has both),
		// still not the Note panel. After S5 a collapsed measure label click also
		// reveals its children (hand rows). A measure selection likewise decorates
		// nothing on the canvas.
		await treeRow(editor, "Measure 1").click();
		await expect(inspectorPanel(sidebar, "Measure")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Section")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Note")).toHaveCount(0);
	});

	test("renaming a section through its panel relabels its structure-tree row", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant song; the tree is open by default. Select its section so
		// the Section panel (with the rename field) appears.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);
		await treeRow(editor, "Section 1").click();

		// The Section panel's "Section name" field renames the section; the name is
		// stored in the additive `name` key and the tree row relabels to it (the
		// positional "Section 1" fallback is gone).
		const name = sidebar.getByLabel("Section name", { exact: true });
		await name.fill("Intro");
		await name.blur();

		await expect
			.poll(async () => (await storedSongObject(editor)).sections[0].name)
			.toBe("Intro");
		await expect(treeRow(editor, "Intro")).toBeVisible();
		await expect(treeRow(editor, "Section 1")).toHaveCount(0);

		// Clearing the field drops the `name` key (no empty-string husk) and the row
		// reverts to its positional label.
		await name.fill("");
		await name.blur();
		await expect
			.poll(async () => (await storedSongObject(editor)).sections[0].name)
			.toBeUndefined();
		await expect(treeRow(editor, "Section 1")).toBeVisible();
	});

	test("the Note-language selector converts pitches and stores the language", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed an English single-`C` song and return to the canvas.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);

		// The selector reads the per-song system: an English-spelled song shows
		// "english" (inference, no stored field yet).
		await expect(languageSelect(sidebar)).toHaveValue("english");

		// Switch to Spanish → every pitch step is rewritten to its Spanish spelling
		// (`C` → `do`) and the choice is stored in the additive `language` field.
		await languageSelect(sidebar).selectOption("spanish");
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return [
					parsed.language,
					parsed.sections[0].measures[0].rightHand[0].pitches[0].step,
				];
			})
			.toEqual(["spanish", "do"]);
		await expect(languageSelect(sidebar)).toHaveValue("spanish");

		// Switch back to English → the round-trip restores the English spelling and
		// language.
		await languageSelect(sidebar).selectOption("english");
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return [
					parsed.language,
					parsed.sections[0].measures[0].rightHand[0].pitches[0].step,
				];
			})
			.toEqual(["english", "C"]);
	});

	test("the Note-language selector infers Spanish for a language-less Spanish song", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a Spanish-spelled song with NO `language` field, return to the canvas.
		await seedSongViaJson(editor, SPANISH_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);

		// With no stored `language`, the selector reflects the inferred system: a
		// `do`-spelled song reads as Spanish.
		await expect(languageSelect(sidebar)).toHaveValue("spanish");
	});

	test("the language field round-trips through JSON mode and never blocks saving", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// A song that already carries `language: "spanish"` is conformant: JSON mode
		// shows no error and stores the exact bytes verbatim — the additive field
		// validates and never blocks saving (AC11/AC13/AC14).
		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(LANGUAGE_TAGGED_SONG);
		await field.blur();
		await expect(errorNotice(editor)).toHaveCount(0);
		expect(await storedSong(editor)).toBe(LANGUAGE_TAGGED_SONG);

		// The stored field survives a round trip to the visual editor and back: it
		// is preserved (the visual editor reads `language` as authoritative) and the
		// raw JSON still parses to the same shape with the field intact.
		await switchToVisualMode(editor);
		await switchToJsonMode(editor);
		const parsed = await storedSongObject(editor);
		expect(parsed.language).toBe("spanish");
	});

	test("a sidebar edit is reflected in the stored song", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant song via JSON, then return to the visual editor.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);

		// Change a field through the sidebar's Song panel (the metadata title).
		const sidebar = await openSettingsSidebar(editor, page);
		const title = titleField(sidebar);
		await title.fill("Moonlight");
		await title.blur();

		// The stored song reflects the change made through the sidebar controls.
		const parsed = await storedSongObject(editor);
		expect(parsed.metadata.title).toBe("Moonlight");
	});

	// S1 real-component proof: the HandConfig controls carry a bare visible label
	// while their accessible name is hand-scoped via aria-label.  This drives the
	// real SelectControl/Button (not just the mock) and confirms the aria-label
	// override lands on the real <select>/<input>/Button in the sidebar DOM.
	//
	// Flow: open the Song panel → expand its "Advanced" tiered panel (which holds
	// the hand configs) → locate the Right-hand Clef control by its accessible
	// name and confirm its visible label is the bare form.
	test("HandConfig controls carry bare visible labels and hand-scoped accessible names (S1 real-component proof)", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);

		// Expand the Song panel's "Advanced" tiered ToolsPanel disclosure so the
		// hand-config controls become reachable in the sidebar DOM.
		const advanced = sidebar.getByRole("region", { name: "Advanced" });
		if (!(await advanced.isVisible())) {
			await sidebar
				.getByRole("button", { name: "Advanced", exact: true })
				.click();
		}

		// The real SelectControl renders a <label> element whose text is the visible
		// label and a <select> whose aria-label carries the accessible name.
		// getByLabel("Right hand clef") resolves via the accessible name (aria-label
		// on the real <select>), proving the aria-label override is present on the
		// real component.
		const clefSelect = sidebar.getByLabel("Right hand clef", { exact: true });
		await expect(clefSelect).toBeVisible();

		// The visible label text is the bare "Clef" — not "Right hand clef".  The
		// <label> element is the sibling of the <select>; locate it by its text.
		const clefLabel = sidebar.locator("label").filter({ hasText: /^Clef$/ });
		await expect(clefLabel).toBeVisible();

		// A label matching the old hand-prefixed text must NOT appear as a visible
		// label element (it lives only on the aria-label attribute, not as text).
		const handPrefixedLabel = sidebar
			.locator("label")
			.filter({ hasText: "Right hand clef" });
		await expect(handPrefixedLabel).toHaveCount(0);
	});

	// S4 real-component proof: the __list-row className CSS hook engages in the
	// sidebar DOM and the trash button is correctly positioned in its row.
	//
	// Flow: open Song panel → expand Advanced → add an alters entry → verify that
	// the alters-row HStack carries the __list-row class in the sidebar (proving
	// the real HStack forwards className to the DOM) and that the trash button is
	// the last child of that row (the CSS rule targets > button:last-child to
	// give it flex: 0 0 auto so it does not collapse or float mid-row).
	test("list-row HStack carries __list-row className and trash button is last child (S4 CSS hook)", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);

		// Expand the Song panel's Advanced tiered disclosure to reach the hand-config controls.
		const advanced = sidebar.getByRole("region", { name: "Advanced" });
		if (!(await advanced.isVisible())) {
			await sidebar
				.getByRole("button", { name: "Advanced", exact: true })
				.click();
		}

		// Add a Right-hand alteration entry so an alters row appears.
		const addAlteration = sidebar.getByRole("button", {
			name: "Right hand add alteration",
			exact: true,
		});
		await addAlteration.click();

		// The alters-row HStack must carry the __list-row class so the top-level
		// editor.scss rule can reach the sidebar DOM. The real HStack forwards
		// className to its wrapper div, so the class lands in the sidebar DOM.
		const listRow = sidebar.locator(".wp-block-piano-block-piano__list-row");
		await expect(listRow).toBeVisible();

		// The trash button must be the last child of the row: the CSS rule
		// > button:last-child gives it flex: 0 0 auto so it stays fixed-size and
		// does not float mid-row when the leading editor is wide.
		const trashButton = listRow.locator("button").last();
		await expect(trashButton).toBeVisible();
		// Confirm the trash is accessible (aria-label from the real Button component).
		await expect(trashButton).toHaveAttribute(
			"aria-label",
			"Right hand remove alteration",
		);
	});

	test("a conformant song shows no error and is stored", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(CONFORMANT_SONG);
		// Blur so the controlled value settles before reading attributes.
		await field.blur();

		// No error notice is shown for conformant input.
		await expect(errorNotice(editor)).toHaveCount(0);

		// The typed text is stored verbatim in the `song` attribute.
		expect(await storedSong(editor)).toBe(CONFORMANT_SONG);
	});

	test("invalid JSON is flagged yet still stored", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(INVALID_JSON);
		await field.blur();

		// A visible error notice appears: a parse failure is a conformance error.
		const notice = errorNotice(editor);
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("JSON");

		// …and the exact non-conformant text is STILL stored — persistence is
		// unconditional.
		expect(await storedSong(editor)).toBe(INVALID_JSON);
	});

	test("non-conformant JSON is flagged yet still stored", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(NON_CONFORMANT_JSON);
		await field.blur();

		// A visible error notice appears, pointing at the offending `duration`.
		const notice = errorNotice(editor);
		await expect(notice).toBeVisible();
		await expect(notice).toContainText("duration");

		// …and the exact non-conformant text is STILL stored.
		expect(await storedSong(editor)).toBe(NON_CONFORMANT_JSON);
	});

	test("a non-empty invalid song routes to the JSON editor", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed an invalid song via JSON, then return to the visual editor.
		await seedSongViaJson(editor, NON_CONFORMANT_JSON);
		await switchToVisualMode(editor);

		// The invalid state takes over: an error message explaining the visual
		// editor can't edit it, and a button to fix it in JSON.
		await expect(errorNotice(editor)).toBeVisible();
		await expect(
			editor.canvas.getByRole("button", { name: "Edit as JSON" }),
		).toBeVisible();

		// The canvas is NOT shown — there is nothing to read or edit.
		await expect(canvasContainer(editor)).toHaveCount(0);

		// And the sidebar's Song-panel Title field is absent — no panels render.
		const sidebar = await openSettingsSidebar(editor, page);
		await expect(titleField(sidebar)).toHaveCount(0);
	});

	test("the canvas renders the sheet music", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant song via JSON, then return to the visual editor.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);

		// The conformant song mounts the rendered sheet music as an <svg> in the
		// interactive canvas on the editor canvas.
		await expect(canvasSvg(editor)).toBeVisible();
	});

	test("a round-trip preserves Spanish note names", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a song spelled with a Spanish note name, then return to visual mode.
		await seedSongViaJson(editor, SPANISH_SONG);
		await switchToVisualMode(editor);

		// Make an UNRELATED edit (the sidebar title) that does not touch the pitch.
		const sidebar = await openSettingsSidebar(editor, page);
		const title = titleField(sidebar);
		await title.fill("Estudio");
		await title.blur();

		// The untouched pitch keeps its Spanish spelling in the stored song.
		const parsed = await storedSongObject(editor);
		expect(parsed.metadata.title).toBe("Estudio");
		expect(parsed.sections[0].measures[0].rightHand[0].pitches[0].step).toBe(
			"do",
		);
	});

	test("a stored song round-trips across save and reload", async ({
		admin,
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		await switchToJsonMode(editor);
		const field = songField(editor);
		await field.fill(ROUND_TRIP_SONG);
		await field.blur();

		// Sanity: the conformant round-trip song shows no error before saving.
		await expect(errorNotice(editor)).toHaveCount(0);

		// Save the post, then capture its id so the editor can be reopened.
		await editor.publishPost();
		const postId = await page.evaluate(() =>
			window.wp.data.select("core/editor").getCurrentPostId(),
		);

		// Reopen the post in the editor — a genuine reload from persisted markup.
		await admin.visitAdminPage("post.php", `post=${postId}&action=edit`);

		// The block reappears with its `song` attribute identical to what was
		// entered — including the HTML-significant characters.
		const blocks = await editor.getBlocks();
		expect(blocks).toHaveLength(1);
		expect(blocks[0].name).toBe("piano-block/piano");
		expect(blocks[0].attributes.song).toBe(ROUND_TRIP_SONG);

		// After reload the block defaults to visual mode; select it so its toolbar
		// is available, switch to JSON, and confirm the textarea is repopulated
		// with the same value.
		await editor.selectBlocks(
			editor.canvas.locator('[data-type="piano-block/piano"]'),
		);
		await switchToJsonMode(editor);
		await expect(songField(editor)).toHaveValue(ROUND_TRIP_SONG);
	});

	// The Section panel's "Remove section" button removes the section immediately
	// (no confirm dialog; removes are immediate and undo-reversible). This test
	// seeds a two-section song, selects a section, clicks the panel button, and
	// polls that `sections.length` dropped by one.
	test("the Section panel Remove section button removes the section immediately", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a two-section song so removing one still leaves a conformant song.
		const TWO_SECTION_SONG = JSON.stringify({
			sections: [
				{
					measures: [
						{
							rightHand: [
								{
									type: "note",
									duration: "quarter",
									pitches: [{ step: "C", octave: 4 }],
								},
							],
						},
					],
				},
				{ measures: [{ rightHand: [{ type: "rest", duration: "whole" }] }] },
			],
		});
		await seedSongViaJson(editor, TWO_SECTION_SONG);
		await switchToVisualMode(editor);

		// Select section 1 so the Section panel appears in the sidebar.
		const sidebar = await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);
		await treeRow(editor, "Section 1").click();
		await expect(inspectorPanel(sidebar, "Section")).toBeVisible();

		// Click the panel's "Remove section" button — the section is removed immediately.
		await sidebar
			.getByRole("button", { name: "Remove section", exact: true })
			.click();

		// No confirm dialog: the remove is immediate. A re-added ConfirmDialog would
		// surface an "OK" button here and re-break this test.
		await expect(page.getByRole("button", { name: "OK" })).toHaveCount(0);

		// The section is removed immediately: sections.length drops from 2 to 1.
		await expect
			.poll(async () => (await storedSongObject(editor)).sections.length)
			.toBe(1);
	});
});

// A conformant two-section song with two measures per section so every level of
// the tree hierarchy (section → measure → hand → note) is reachable and each
// expandable row carries a unique `data-expansion-key`.
const KEYBOARD_EXPAND_SONG = JSON.stringify({
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "C", octave: 4 }],
						},
					],
					leftHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "G", octave: 3 }],
						},
					],
				},
			],
		},
	],
});

test.describe("Piano block — structure tree keyboard expand/collapse and accessible name", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ admin, requestUtils }) => {
		await requestUtils.deleteAllPosts();
		await admin.createNewPost();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("the structure tree resolves by accessible name", async ({ editor }) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The TreeGrid carries aria-label="Song structure" (StructureTree.js). It must
		// be locatable by that name, which is the real-browser contract for screen
		// readers and ARIA tooling.
		await expect(
			structureTree(editor).getByRole("treegrid", { name: "Song structure" }),
		).toBeVisible();
	});

	test("ArrowRight/ArrowLeft on a section row expands and collapses its measures", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a song that has a section with one measure; the structure tree is open
		// by default. The section row must be present and collapsed (measure rows hidden)
		// before the keyboard drive begins.
		await seedSongViaJson(editor, KEYBOARD_EXPAND_SONG);
		await switchToVisualMode(editor);
		await assertStructureTreeOpen(editor);

		// edit.js seeds s0 expanded on mount; collapse it so this test can drive the
		// keyboard expand from a known-collapsed section row.
		await rowChevron(editor, "Section 1").click();

		// The section row carries data-expansion-key="s0". Confirm that measure rows
		// are NOT yet visible — the tree starts collapsed at the section level.
		const sectionRow = structureTree(editor).locator(
			"tr[data-expansion-key='s0']",
		);
		await expect(sectionRow).toBeVisible();
		await expect(treeRow(editor, "Measure 1")).toHaveCount(0);

		// Focus the section row's select button (the label cell) so keyboard events
		// route through it and the TreeGrid's onExpandRow fires on ArrowRight.
		await treeRow(editor, "Section 1").focus();

		// ArrowRight → TreeGrid fires onExpandRow on the focused row → the shared
		// handler reads data-expansion-key="s0" and calls onToggleExpanded("s0") →
		// the section's children (measure rows) become visible.
		await page.keyboard.press("ArrowRight");
		await expect(treeRow(editor, "Measure 1")).toBeVisible();

		// ArrowLeft → TreeGrid fires onCollapseRow → the handler toggles "s0" back
		// off → the measure rows disappear.
		await page.keyboard.press("ArrowLeft");
		await expect(treeRow(editor, "Measure 1")).toHaveCount(0);
	});

	test("ArrowRight/ArrowLeft on a measure row expands and collapses its hand rows", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed and open the tree; expand down to the measure level via the disclosure
		// chevrons (pointer path) so the measure row is in focus range.
		await seedSongViaJson(editor, KEYBOARD_EXPAND_SONG);
		await switchToVisualMode(editor);
		await assertStructureTreeOpen(editor);
		await expandRow(editor, "Section 1");

		// edit.js seeds s0m0 expanded on mount; collapse the measure so this test can
		// drive the keyboard expand from a known-collapsed measure row (the section
		// stays expanded so the measure row is visible to receive focus).
		await rowChevron(editor, "Measure 1").click();

		// The measure row carries data-expansion-key="s0m0". Hand rows are hidden.
		const measureRow = structureTree(editor).locator(
			"tr[data-expansion-key='s0m0']",
		);
		await expect(measureRow).toBeVisible();
		await expect(treeRow(editor, "Right hand")).toHaveCount(0);

		// Focus the measure row's select button and press ArrowRight to expand.
		await treeRow(editor, "Measure 1").focus();
		await page.keyboard.press("ArrowRight");
		await expect(treeRow(editor, "Right hand")).toBeVisible();

		// ArrowLeft collapses: the hand rows disappear.
		await page.keyboard.press("ArrowLeft");
		await expect(treeRow(editor, "Right hand")).toHaveCount(0);
	});

	test("ArrowRight/ArrowLeft on a hand row expands and collapses its note rows", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed and open the tree; expand down to the hand level via the disclosure
		// chevrons so the hand row is in focus range.
		await seedSongViaJson(editor, KEYBOARD_EXPAND_SONG);
		await switchToVisualMode(editor);
		await assertStructureTreeOpen(editor);
		await expandRow(editor, "Section 1");
		await expandRow(editor, "Measure 1");

		// The Right hand row carries data-expansion-key="s0m0rightHand". Note rows
		// are hidden until the hand row is expanded.
		const handRow = structureTree(editor).locator(
			"tr[data-expansion-key='s0m0rightHand']",
		);
		await expect(handRow).toBeVisible();
		await expect(treeRow(editor, "C")).toHaveCount(0);

		// The hand-row label is its toggle button — focus it and press ArrowRight.
		await treeRow(editor, "Right hand").focus();
		await page.keyboard.press("ArrowRight");
		await expect(treeRow(editor, "C")).toBeVisible();

		// ArrowLeft collapses: the note row disappears.
		await page.keyboard.press("ArrowLeft");
		await expect(treeRow(editor, "C")).toHaveCount(0);
	});
});

// A conformant two-section song used by the R-FOCUS focus-management tests.
// Two sections let us duplicate or remove one and still leave a conformant song.
const FOCUS_SONG = JSON.stringify({
	sections: [
		{
			measures: [
				{
					rightHand: [
						{
							type: "note",
							duration: "quarter",
							pitches: [{ step: "C", octave: 4 }],
						},
					],
				},
			],
		},
		{
			measures: [{ rightHand: [{ type: "rest", duration: "whole" }] }],
		},
	],
});

test.describe("Piano block — R-FOCUS: post-mutation focus management", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ admin, requestUtils }) => {
		await requestUtils.deleteAllPosts();
		await admin.createNewPost();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("after duplicating a section, focus lands on the new section's label button", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });
		await seedSongViaJson(editor, FOCUS_SONG);
		await switchToVisualMode(editor);
		// Open the settings sidebar to ensure the block is selected and the tree is
		// fully interactive; its presence also keeps the block selected across clicks.
		await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);

		// Duplicate Section 1 via its actions DropdownMenu — the new Section 2
		// becomes aria-current and its label button should receive focus.
		const duplicate = await openRowAction(
			editor,
			"Actions for Section 1",
			"Duplicate",
		);
		await duplicate.click();

		// The new section's label button has aria-current and must be focused.
		// After a duplicate the tree has 3 sections; the newly inserted one is
		// Section 2 (the original Section 2 becomes Section 3).
		await expect(treeRow(editor, "Section 2")).toBeFocused();
	});

	test("after adding a section before another, focus lands on the new section's label button", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });
		await seedSongViaJson(editor, FOCUS_SONG);
		await switchToVisualMode(editor);
		await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);

		// Add a section before Section 1 — the new section becomes Section 1 and
		// receives aria-current (and thus focus).
		const addBefore = await openRowAction(
			editor,
			"Actions for Section 1",
			"Add before",
		);
		await addBefore.click();

		await expect(treeRow(editor, "Section 1")).toBeFocused();
	});

	test("after removing a section, focus lands in the tree container, not body", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });
		await seedSongViaJson(editor, FOCUS_SONG);
		await switchToVisualMode(editor);
		await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);

		// Remove Section 2 — the DropdownMenu unmounts, which would normally strand
		// focus at <body>. The anchor focus should land on the tree container instead.
		const remove = await openRowAction(
			editor,
			"Actions for Section 2",
			"Remove",
		);
		await remove.click();

		// After the remove, focus must be inside the tree container (tabIndex=-1
		// anchor), never at <body>.
		await expect(structureTree(editor)).toBeFocused();
	});

	test("after adding a note from the hand group, focus lands on the new note's label button", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });
		await seedSongViaJson(editor, FOCUS_SONG);
		await switchToVisualMode(editor);
		await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);

		// Drill into Section 1 → Measure 1 to reach the hand group's "Add note".
		await expandRow(editor, "Section 1");
		await expandRow(editor, "Measure 1");

		// Click the Right hand's "Add note" direct button — the new note is selected
		// and its label button should receive focus.
		await treeAction(
			editor,
			"Add note to Right hand of measure 1 of section 1",
		).click();

		// The new note row is now visible and its label button is focused.
		// The first note row in the Right hand is the newly added note (right hand
		// already had one note so this is note 2, but the label is pitch-based —
		// use the aria-current flag via the tree-label selector instead of exact name).
		const focusedLabel = structureTree(editor).locator(
			'[aria-current="true"].wp-block-piano-block-piano__tree-label',
		);
		await expect(focusedLabel).toBeFocused();
	});

	test("after removing a note, focus lands in the tree container, not body", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });
		await seedSongViaJson(editor, FOCUS_SONG);
		await switchToVisualMode(editor);
		await openSettingsSidebar(editor, page);
		await assertStructureTreeOpen(editor);

		// Drill into Section 1 → Measure 1 → Right hand to expose the note row.
		await expandRow(editor, "Section 1");
		await expandRow(editor, "Measure 1");
		await expandRow(editor, "Right hand");

		// Remove the note via its actions DropdownMenu.
		const remove = await openRowAction(
			editor,
			"Actions for Note 1 of Right hand of measure 1 of section 1",
			"Remove",
		);
		await remove.click();

		// After the remove the tree container must hold focus (anchor behavior).
		await expect(structureTree(editor)).toBeFocused();
	});
});
