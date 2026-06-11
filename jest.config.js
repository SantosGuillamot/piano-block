/**
 * Jest configuration for the unit suite.
 *
 * Builds on the `@wordpress/scripts` unit config (its preset, Babel transform
 * and reporters) and adds three things. First, a module mapping: the build
 * externalizes every `@wordpress/*` package (WordPress provides them at
 * runtime), so they are not installed in `node_modules` and Jest cannot resolve
 * them. The editor's modules import only from `@wordpress/*`; this maps the ones
 * the unit tests exercise to lightweight local mocks so the pure logic can be
 * tested in isolation, without adding any runtime dependency. Second, a setup
 * file that polyfills the standard `structuredClone` global into the jsdom
 * environment (which omits it), so helpers that deep-copy with it are reachable
 * in unit tests — a test-only shim, never bundled, that adds no dependency.
 *
 * Third — and the reason this is a two-project config — a React-dedup
 * `moduleNameMapper` that resolves all six React entrypoints (react,
 * react/jsx-runtime, react/jsx-dev-runtime, react-dom, react-dom/client,
 * scheduler) to the single top-level copy. `@wordpress/icons` nests its own
 * React 18.3.1 while the top level is 19.x; the icon SVGs compile to that
 * nested `react/jsx-runtime`, and React 18 vs 19 tag elements with *different*
 * `$$typeof` Symbols — so without deduping React to one copy,
 * `isValidElement(realPlusIcon)` is `false` and a real icon element cannot
 * render under the top-level React. The dedup is a HARD PREREQUISITE for the
 * real-icon guard (`StructureTree.realIcons.test.js`), and the WHOLE six-module
 * set is required: a partial mapping (e.g. `react` only) throws
 * `Cannot read properties of undefined (reading 'ReactCurrentDispatcher')`. It
 * is a test-only mapping — no runtime dependency is added.
 *
 * Two projects share that config and differ only in how `@wordpress/icons`
 * resolves:
 *   - **unit** — every suite *except* the real-icon guard. `@wordpress/icons`
 *     maps to the string-sentinel mock (the icons are passed straight through to
 *     `<Icon>`/`<DropdownMenu>` and never inspected), so the pure logic is
 *     tested without the real SVG package.
 *   - **real-icons** — *only* `StructureTree.realIcons.test.js`. The
 *     `@wordpress/icons` mapping is DROPPED so the specifier resolves to the
 *     genuine installed package and its icon exports are real SVG elements. This
 *     is the only reliable un-mapping recipe: `jest.requireActual` against the
 *     still-mapped specifier resolves back through the mapper to the string
 *     sentinel. With the dedup above, the real `plus` element renders a real
 *     inline `<svg>` — the canary that catches a string-`icon` regression.
 */
const path = require("node:path");
const baseConfig = require("@wordpress/scripts/config/jest-unit.config.js");

/** The real-icon guard, run in its own project against the real `@wordpress/icons`. */
const REAL_ICONS_TEST = "StructureTree.realIcons.test.js";

/**
 * Resolve all six React entrypoints to the single top-level copy, so a real
 * `@wordpress/icons` element (built by the package's nested React 18) is a valid
 * element under the test runner's React. Test-only; adds no runtime dependency.
 * The whole set is required — a partial mapping crashes (see the file header).
 */
const reactDedupMapper = {
	"^react$": require.resolve("react"),
	"^react/jsx-runtime$": require.resolve("react/jsx-runtime"),
	"^react/jsx-dev-runtime$": require.resolve("react/jsx-dev-runtime"),
	"^react-dom$": require.resolve("react-dom"),
	"^react-dom/client$": require.resolve("react-dom/client"),
	"^scheduler$": require.resolve("scheduler"),
};

/** The local mocks for the externalized `@wordpress/*` packages the tests exercise (icons handled per-project). */
const wordpressMocks = {
	"^@wordpress/i18n$": path.join(__dirname, "test/mocks/wordpress-i18n.js"),
	"^@wordpress/components$": path.join(
		__dirname,
		"test/mocks/wordpress-components.js",
	),
	"^@wordpress/block-editor$": path.join(
		__dirname,
		"test/mocks/wordpress-block-editor.js",
	),
};

/** The string-sentinel `@wordpress/icons` mock, used by every project but the real-icon guard. */
const iconsMock = {
	"^@wordpress/icons$": path.join(__dirname, "test/mocks/wordpress-icons.js"),
};

const setupFiles = [
	...(baseConfig.setupFiles ?? []),
	path.join(__dirname, "test/setup/structured-clone.js"),
];

// `reporters` is a top-level-only Jest option; the rest of the base config is
// per-project, so it is split out and the projects spread the remainder.
const { reporters, ...projectBase } = baseConfig;

module.exports = {
	reporters,
	projects: [
		{
			...projectBase,
			displayName: "unit",
			rootDir: __dirname,
			// Everything but the real-icon guard, which runs against the string mock.
			testPathIgnorePatterns: [
				...(baseConfig.testPathIgnorePatterns ?? ["/node_modules/"]),
				REAL_ICONS_TEST,
			],
			moduleNameMapper: {
				...baseConfig.moduleNameMapper,
				...reactDedupMapper,
				...wordpressMocks,
				...iconsMock,
			},
			setupFiles,
		},
		{
			...projectBase,
			displayName: "real-icons",
			rootDir: __dirname,
			// Only the canary, against the real `@wordpress/icons` (its mapping is dropped).
			testMatch: [`**/${REAL_ICONS_TEST}`],
			moduleNameMapper: {
				...baseConfig.moduleNameMapper,
				...reactDedupMapper,
				...wordpressMocks,
			},
			setupFiles,
		},
	],
};
