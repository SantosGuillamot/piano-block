/**
 * Jest configuration for the unit suite.
 *
 * Builds on the `@wordpress/scripts` unit config (its preset, Babel transform
 * and reporters) and only adds a module mapping: the build externalizes every
 * `@wordpress/*` package (WordPress provides them at runtime), so they are not
 * installed in `node_modules` and Jest cannot resolve them. The editor's
 * modules import only from `@wordpress/*`; this maps the ones the unit tests
 * exercise to lightweight local mocks so the pure logic can be tested in
 * isolation, without adding any runtime dependency.
 */
const path = require("node:path");
const baseConfig = require("@wordpress/scripts/config/jest-unit.config.js");

module.exports = {
	...baseConfig,
	moduleNameMapper: {
		...baseConfig.moduleNameMapper,
		"^@wordpress/i18n$": path.join(__dirname, "test/mocks/wordpress-i18n.js"),
		"^@wordpress/components$": path.join(
			__dirname,
			"test/mocks/wordpress-components.js",
		),
		"^@wordpress/block-editor$": path.join(
			__dirname,
			"test/mocks/wordpress-block-editor.js",
		),
	},
};
