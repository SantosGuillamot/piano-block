/**
 * Test-only polyfill that exposes `structuredClone` inside the jsdom test
 * environment.
 *
 * The editor's `duplicateAt` helper deep-copies a song fragment with the
 * standard `structuredClone` global. It is universally available in the editor
 * runtime (every browser WordPress supports), so the shipped helper adds no
 * runtime dependency. The jsdom global Jest installs, however, does not carry
 * it, which would make the helper unreachable in unit tests. This shim — a
 * setup file, never bundled, kept under `test/setup/` so Jest's `testMatch`
 * never collects it as a suite — fills only that gap, delegating to Node's
 * built-in `v8.serialize`/`deserialize` (a faithful structured clone for the
 * JSON-safe shapes the song format uses) and installing it only when absent so
 * a runtime that already provides `structuredClone` is left untouched.
 */
const { serialize, deserialize } = require("node:v8");

if (typeof globalThis.structuredClone !== "function") {
	globalThis.structuredClone = (value) => deserialize(serialize(value));
}
