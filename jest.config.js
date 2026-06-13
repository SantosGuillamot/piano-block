/**
 * Jest configuration for the unit suite.
 *
 * Builds on the `@wordpress/scripts` unit config (its preset, Babel transform
 * and reporters) and adds two things. First, a module mapping: the build
 * externalizes every `@wordpress/*` package (WordPress provides them at
 * runtime), so they are not installed in `node_modules` and Jest cannot resolve
 * them. The editor's modules import only from `@wordpress/*`; this maps the ones
 * the unit tests exercise to lightweight local mocks so the pure logic can be
 * tested in isolation, without adding any runtime dependency. Second, a setup
 * file that polyfills the standard `structuredClone` global into the jsdom
 * environment (which omits it), so helpers that deep-copy with it are reachable
 * in unit tests — a test-only shim, never bundled, that adds no dependency.
 *
 * The `@wordpress/icons` mock exports element sentinels (inert `<svg>` nodes
 * built with `createElement`). The components mock renders element icons through
 * `Icon` (which `cloneElement`s a valid element) and renders nothing for a
 * non-element — so a string `icon` prop produces no marked DOM node. The
 * project-wide string-icon guard in `icons.test.js` mounts every icon-bearing
 * component and asserts the sentinel marker is present, going RED if any
 * component receives a string icon.
 */
const path = require("node:path");
const baseConfig = require("@wordpress/scripts/config/jest-unit.config.js");

/** The local mocks for the externalized `@wordpress/*` packages the tests exercise. */
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
	"^@wordpress/icons$": path.join(__dirname, "test/mocks/wordpress-icons.js"),
};

const setupFiles = [
	...(baseConfig.setupFiles ?? []),
	path.join(__dirname, "test/setup/structured-clone.js"),
];

module.exports = {
	...baseConfig,
	moduleNameMapper: {
		...baseConfig.moduleNameMapper,
		...wordpressMocks,
	},
	setupFiles,
};
