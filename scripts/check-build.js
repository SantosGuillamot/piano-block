/**
 * Build-payload guard: asserts that `build/block.json` — the keystone output
 * that `register_block_type(__DIR__ . '/build')` loads — is present before the
 * plugin archive is created. Checking `block.json` specifically (rather than
 * "is the directory non-empty?") ensures a partial build that left only
 * `build/fonts/*.woff2` on disk is still caught and rejected.
 *
 * Stage 2 of the plugin-zip chain; run via `node scripts/check-build.js`.
 */

const { existsSync } = require( 'node:fs' );
const { join } = require( 'node:path' );

/**
 * Check whether the keystone build output exists under `cwd`.
 *
 * Factored as a pure function so unit tests can exercise the decision logic
 * without spawning a child process or calling `process.exit`.
 *
 * @param {string} cwd The directory to resolve `build/block.json` from.
 * @return {{ ok: boolean, message: string }} Result object. `ok` is `true` when
 *   `build/block.json` exists; `message` is the actionable error string when
 *   `ok` is `false`, or an empty string when `ok` is `true`.
 */
function checkBuild( cwd ) {
	const target = join( cwd, 'build', 'block.json' );
	if ( existsSync( target ) ) {
		return { ok: true, message: '' };
	}
	return {
		ok: false,
		message: 'build/block.json not found — run `npm run build` first.',
	};
}

module.exports = { checkBuild };

// CLI entry point: map the pure result to stderr + exit code. Only runs when
// this file is executed directly (not when imported by tests).
if ( require.main === module ) {
	const result = checkBuild( process.cwd() );
	if ( ! result.ok ) {
		process.stderr.write( result.message + '\n' );
		process.exit( 1 );
	}
}
