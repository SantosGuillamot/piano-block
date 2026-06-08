/**
 * Editor end-to-end tests for the Piano block.
 *
 * These tests drive the real built block in the editor via wp-env and verify
 * its authoring + persistence behavior. The CANVAS-FIRST visual editor is the
 * DEFAULT surface: a freshly inserted block shows an interactive sheet-music
 * canvas — seeded with an empty grand staff so it is ready for notes without
 * any raw JSON — that the author both reads and edits on. Selecting a note on
 * the canvas reveals the block's settings sidebar panels (the always-present
 * Song panel plus the Note/Measure/Section panels bound to the selection);
 * song- and event-level settings are edited there, not on the canvas. A
 * non-empty-but-invalid song shows an invalid state that routes to the raw
 * JSON editor.
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
 * `data-kind="note"` (src/notation/svg.js). Selectable: a click resolves to a
 * `{ section, measure, hand, event }` selection that reveals the sidebar panels.
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
 * panels are "Song" (always present) and "Note"/"Measure"/"Section" (only when
 * an event is selected) — each rendered as a `PanelBody` whose title toggles the
 * panel, so it surfaces as a button with that accessible name in the settings
 * region (src/editor/inspector/*).
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

	test("adding a note on the canvas stores it in the chosen hand", async ({
		editor,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// The seeded empty song exposes a per-hand add-note affordance per measure.
		// Click the right-hand one for the first (only) measure.
		await editor.canvas
			.getByRole("button", { name: "Add note to right hand in measure 1" })
			.click();

		// The stored song now carries a right-hand event in that measure, and the
		// canvas re-rendered it as a note group.
		const parsed = JSON.parse(await storedSong(editor));
		expect(Array.isArray(parsed.sections)).toBe(true);
		expect(parsed.sections[0].measures[0].rightHand).toHaveLength(1);
		expect(parsed.sections[0].measures[0].rightHand[0].type).toBe("note");
		expect(parsed.sections[0].measures[0].leftHand).toBeUndefined();
		await expect(noteGroups(editor).first()).toBeVisible();
	});

	test("selecting a note reveals the Note, Measure and Section panels", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant single-note song, return to the canvas.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);

		// With nothing selected, only the always-present Song panel is shown.
		const sidebar = await openSettingsSidebar(editor, page);
		await expect(inspectorPanel(sidebar, "Song")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Note")).toHaveCount(0);
		await expect(inspectorPanel(sidebar, "Measure")).toHaveCount(0);
		await expect(inspectorPanel(sidebar, "Section")).toHaveCount(0);

		// Click the rendered note on the staff to select it.
		await noteGroups(editor).first().click();

		// The selection-bound panels appear alongside the Song panel.
		await expect(inspectorPanel(sidebar, "Song")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Note")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Measure")).toBeVisible();
		await expect(inspectorPanel(sidebar, "Section")).toBeVisible();
	});

	test("clicking a note off its ink (in-column gap) still selects it", async ({
		editor,
		page,
	}) => {
		await editor.insertBlock({ name: "piano-block/piano" });

		// Seed a conformant single-note song, return to the canvas, open the sidebar.
		await seedSongViaJson(editor, CONFORMANT_SONG);
		await switchToVisualMode(editor);
		const sidebar = await openSettingsSidebar(editor, page);

		// The single C4 quarter note. Its only ink is a thin stem + a tiny notehead; the
		// rest of the group's bounding box is transparent gap. Click an explicit
		// position in the column but OFF the notehead/stem — the staff-gap a few px above
		// the notehead, i.e. the bbox-center-ish point a plain `.click()` lands on and
		// that fails today (the click passes through to the staff lines, selecting
		// nothing). The editor-only hit-rect makes that empty interior selectable.
		const note = noteGroups(editor).first();
		const box = await note.boundingBox();
		await note.click({
			position: { x: box.width / 2, y: Math.min(6, box.height / 4) },
		});

		// The Note panel populates and the group is marked selected — proving the
		// off-ink, in-column point now resolves to the note.
		await expect(inspectorPanel(sidebar, "Note")).toBeVisible();
		await expect(note).toHaveClass(/is-selected/);
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
		const parsed = JSON.parse(await storedSong(editor));
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
		const parsed = JSON.parse(await storedSong(editor));
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
