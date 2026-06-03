/**
 * Front-end render end-to-end tests for the Piano block (AC3, AC7, AC8).
 *
 * These tests drive a real WordPress instance via wp-env and verify the
 * server-rendered output produced by `src/render.php` (design §8): an empty
 * block renders nothing meaningful (AC3), a stored song appears verbatim as a
 * string inside a `<pre>` (AC7), and a hostile `song` renders escaped and inert
 * — no XSS (AC8).
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

// A small conformant song used by AC7 — exercises recognizable substrings
// (the "sections" key, a pitch with "step": "C") the test asserts on.
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

// A hostile payload for AC8: a live <script>, plus HTML-significant characters
// (<, >, &, single and double quotes). It is intentionally NOT valid song JSON
// — render.php performs no validation and must pass it through escaped.
const XSS_PAYLOAD = `<script>alert("xss & 'pwn'")</script>`;

/**
 * Insert the Piano block, fill its song field with the given text (when
 * provided), publish the post, and return the published post's id.
 *
 * @param {Object}      utils
 * @param {Object}      utils.admin  Admin fixture.
 * @param {Object}      utils.editor Editor fixture.
 * @param {string|null} song         The raw song text to type, or null to leave blank.
 * @return {Promise<number>} The published post id.
 */
async function publishPostWithSong({ admin, editor }, song) {
	await admin.createNewPost();
	await editor.insertBlock({ name: "piano-block/piano" });

	if (song !== null) {
		const field = editor.canvas.getByLabel("Song (JSON)");
		await field.fill(song);
	}

	return editor.publishPost();
}

test.describe("Piano block — front-end render", () => {
	test.beforeAll(async ({ requestUtils }) => {
		await requestUtils.activatePlugin("piano-block");
	});

	test.beforeEach(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test.afterAll(async ({ requestUtils }) => {
		await requestUtils.deleteAllPosts();
	});

	test("AC3 — an empty block renders nothing meaningful on the front end", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong({ admin, editor }, null);

		// Visit the published post's front end (WordPress redirects ?p=<id> to
		// the permalink).
		await page.goto(`/?p=${postId}`);

		// The block emits no element at all when the song is empty: there must be
		// no <pre> from this block (scoped to its wrapper class).
		await expect(page.locator("pre.wp-block-piano-block-piano")).toHaveCount(0);
		// And, more broadly, the block contributes no <pre> at all to the page —
		// theme-independent confirmation that no (even empty) song element rendered.
		await expect(page.locator("pre")).toHaveCount(0);
	});

	test("AC7 — a stored song appears verbatim as a string inside a <pre>", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong(
			{ admin, editor },
			CONFORMANT_SONG,
		);

		await page.goto(`/?p=${postId}`);

		const songPre = page.locator("pre.wp-block-piano-block-piano");
		await expect(songPre).toBeVisible();

		// The stored song text is rendered verbatim: recognizable substrings of
		// the conformant document are present in the <pre>.
		const rendered = await songPre.innerText();
		expect(rendered).toContain('"sections"');
		expect(rendered).toContain('"step": "C"');

		// The full stored string round-trips into the rendered output.
		expect(rendered).toBe(CONFORMANT_SONG);
	});

	test("AC8 — a hostile song renders escaped and inert (no XSS)", async ({
		admin,
		editor,
		page,
	}) => {
		const postId = await publishPostWithSong({ admin, editor }, XSS_PAYLOAD);

		await page.goto(`/?p=${postId}`);

		// (a) The page's HTML source contains the ESCAPED form of the payload —
		// esc_html() converts <, >, & and quotes to entities — so the literal
		// text is escaped, not interpreted as markup.
		const html = await page.content();
		expect(html).toContain("&lt;script&gt;");
		expect(html).toContain("&lt;/script&gt;");
		expect(html).toContain("xss &amp; ");

		// (b) No live <script> was injected by the block: the payload is inert
		// text inside the <pre>, not an executing element.
		await expect(
			page.locator("pre.wp-block-piano-block-piano script"),
		).toHaveCount(0);

		// The payload survives as visible text content (the escaped entities are
		// decoded back to the literal characters when read as text).
		const songPre = page.locator("pre.wp-block-piano-block-piano");
		await expect(songPre).toContainText("<script>alert(");
	});
});
