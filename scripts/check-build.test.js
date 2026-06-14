/**
 * Unit tests for the build-payload guard's pure decision function.
 *
 * Each test constructs a controlled filesystem fixture in a temp directory and
 * passes it as the `cwd` argument — so results are independent of the repo's
 * real `build/` state. `process.exit` is never called because the CLI entry
 * point is guarded behind `process.argv[1] === import.meta.url` and we import
 * only the exported function.
 *
 * The four cases match the design-verified states documented in the guard's
 * module comment and the code plan (full → ok, missing → not ok, empty → not
 * ok, partial → not ok).
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkBuild } from "./check-build.js";

describe("checkBuild", () => {
	let tmp;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "piano-block-check-build-"));
	});

	afterEach(() => {
		rmSync(tmp, { recursive: true, force: true });
	});

	it("returns ok when build/block.json is present (full build)", () => {
		mkdirSync(join(tmp, "build"), { recursive: true });
		writeFileSync(join(tmp, "build", "block.json"), "{}");

		const result = checkBuild(tmp);

		expect(result.ok).toBe(true);
		expect(result.message).toBe("");
	});

	it("returns not ok when build/ directory is missing entirely", () => {
		// tmp has no build/ at all.
		const result = checkBuild(tmp);

		expect(result.ok).toBe(false);
		expect(result.message.length).toBeGreaterThan(0);
	});

	it("returns not ok when build/ exists but is empty", () => {
		mkdirSync(join(tmp, "build"), { recursive: true });

		const result = checkBuild(tmp);

		expect(result.ok).toBe(false);
		expect(result.message.length).toBeGreaterThan(0);
	});

	it("returns not ok when build/ has only a font file but no block.json (partial build)", () => {
		// This is the dangerous case: output.clean keep:[fonts] leaves font
		// files on disk, making the directory non-empty, but block.json is
		// still absent. A naive "non-empty directory" check would wrongly pass.
		mkdirSync(join(tmp, "build", "fonts"), { recursive: true });
		writeFileSync(join(tmp, "build", "fonts", "inter.woff2"), "");

		const result = checkBuild(tmp);

		expect(result.ok).toBe(false);
		expect(result.message.length).toBeGreaterThan(0);
	});
});
