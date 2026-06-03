/**
 * Playwright configuration for the Piano block end-to-end tests.
 *
 * Extends the base config shipped by `@wordpress/scripts` so the
 * WordPress-specific globals are inherited: the `baseURL` (from `WP_BASE_URL`,
 * defaulting to the wp-env tests site), the `globalSetup` that logs in and
 * persists the admin storage state, the artifacts/output paths, and the
 * `webServer` that boots wp-env. Credentials are read by the e2e utils from
 * `WP_USERNAME` / `WP_PASSWORD` (default `admin` / `password`, matching
 * wp-env) — nothing is hardcoded here.
 *
 * The specs live in the root-level `./specs` folder (Playwright's default
 * `*.spec.js` glob), which the base config already targets; it is re-asserted
 * here so this project's intent is explicit.
 */

const baseConfig = require("@wordpress/scripts/config/playwright.config.js");

module.exports = {
	...baseConfig,
	testDir: "./specs",
};
