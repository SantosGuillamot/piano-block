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
 * navigates Section → Measure → {Right hand, Left hand} → Note and carries the
 * structural add/remove/duplicate controls at every level; an empty measure's
 * first note is seeded from its hand group's "Add note" (the canvas add-grid is
 * gone). Tree rows carry a leading disclosure caret, so they are located by an
 * accessible/contains name lookup rather than an exact match. Once an event is
 * selected, the Note panel's contextual "Add note" inserts a sibling in the same
 * hand (inferred from the selection) and "Remove note" deletes it; sections and
 * measures are renamed via the "Section name"/"Measure name" fields in their
 * inspector panels. The Song panel's "Note language" selector converts the whole
 * song between English and Spanish spellings and stores the choice in an additive
 * `language` field.
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
 * Expandable rows prefix the label with a disclosure caret glyph (`▸`/`▾`), so an
 * `exact` match would miss them; matching the row by its trailing label with a
 * CASE-SENSITIVE, end-anchored regex both tolerates the caret prefix AND avoids
 * the row's own action buttons. Those buttons spell the ordinal lowercase
 * ("Remove section 1", "Add note to Right hand of measure 1 of section 1"), so a
 * case-sensitive `/…Section 1$/` never matches them, while the capitalized,
 * end-of-name row label does. Clicking a section/measure/note row toggles its
 * expansion and drives the kind-tagged selection; a hand-group row only toggles
 * expansion (it never selects). Scoped to the tree container.
 *
 * @param {Object} editor The Playwright editor fixture.
 * @param {string} name   The row's trailing label (e.g. "Section 1", "C").
 */
function treeRow(editor, name) {
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return structureTree(editor).getByRole("button", {
		name: new RegExp(`${escaped}$`),
	});
}

/**
 * A structure-tree action button, by its precise full label (src/editor/
 * StructureTree.js — e.g. "Add measure to section 1", "Remove section 2",
 * "Duplicate measure 1 of section 1", "Add note to Right hand of measure 1 of
 * section 1"). These labels are unique and verb-prefixed, so they are matched
 * exactly and never collide with a row's caret-prefixed label.
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
		// which is open by default: expand the seeded section then its measure, and
		// click the right hand's "Add note" (the only first-note entry point for an
		// empty measure; it seeds a default RIGHT-hand note).
		await expect(structureTree(editor)).toBeVisible();
		await treeRow(editor, "Section 1").click();
		await treeRow(editor, "Measure 1").click();
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
		await treeRow(editor, "Section 1").click();
		await treeRow(editor, "Measure 1").click();
		await treeRow(editor, "Right hand").click();
		await treeRow(editor, "C").click();
		await expect(inspectorPanel(sidebar, "Note")).toBeVisible();

		// The Note panel's contextual "Add note" inserts a sibling in the selected
		// note's hand (inferred — never prompted). Scoped to the `sidebar` and
		// `exact`, so it never matches the tree's "Add note to Right hand …" action.
		await sidebar.getByRole("button", { name: "Add note", exact: true }).click();

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
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a single-section, single-measure song; the structure tree is open by
		// default, so expand the section so its measures' row controls are reachable.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		await assertStructureTreeOpen(editor);
		await treeRow(editor, "Section 1").click();

		// Add a measure to section 1 → that section now has two measures.
		await treeAction(editor, "Add measure to section 1").click();
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures.length;
			})
			.toBe(2);

		// Duplicate measure 1 of section 1 → a deep copy lands right after it, so
		// that section now has three measures.
		await treeAction(editor, "Duplicate measure 1 of section 1").click();
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures.length;
			})
			.toBe(3);

		// Add a section (the tree's footer "Add section") → the song now has two
		// sections.
		await treeAction(editor, "Add section").click();
		await expect
			.poll(async () => (await storedSongObject(editor)).sections.length)
			.toBe(2);

		// Duplicate section 1 → its deep copy lands right after it, so the song now
		// has three sections.
		await treeAction(editor, "Duplicate section 1").click();
		await expect
			.poll(async () => (await storedSongObject(editor)).sections.length)
			.toBe(3);

		// Remove the third measure of section 1 (the duplicate) → back to two there.
		await treeAction(editor, "Remove measure 3 of section 1").click();
		await expect
			.poll(async () => {
				const parsed = await storedSongObject(editor);
				return parsed.sections[0].measures.length;
			})
			.toBe(2);

		// Remove the third (empty) section → back to two sections.
		await treeAction(editor, "Remove section 3").click();
		await expect
			.poll(async () => (await storedSongObject(editor)).sections.length)
			.toBe(2);
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
		// section), not the Measure/Note panels. (Clicking it also expands the
		// section, surfacing its measure row.) A section selection decorates nothing
		// on the canvas — section/measure are surfaced through the tree and panels.
		await treeRow(editor, "Section 1").click();
		await expect(inspectorPanel(sidebar, "Section")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Measure")).toHaveCount(0);
		await expect(inspectorPanel(sidebar, "Note")).toHaveCount(0);

		// Selecting the MEASURE row reveals Measure + Section (a measure has both),
		// still not the Note panel. A measure selection likewise decorates nothing on
		// the canvas.
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
});
