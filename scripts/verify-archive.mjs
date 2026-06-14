/**
 * End-to-end archive verifier for the `npm run plugin-zip` command.
 *
 * Covers Acceptance Criteria AC1–AC8 from the spec. Run this script from the
 * repo root after `npm install`:
 *
 *   node scripts/verify-archive.js
 *
 * Exit 0  — all checks passed.
 * Exit 1  — one or more checks failed (details printed to stderr/stdout).
 *
 * Dependency-free: only Node.js built-ins and the shell commands already
 * available in the project (npm, unzip). The script is placed under `scripts/`
 * which is auto-excluded from the produced zip, so it does not affect AC5/AC6.
 */

import { execSync, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	rmSync,
	renameSync,
	writeFileSync,
	statSync,
} from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const ZIP = join(ROOT, "piano-block.zip");

let passed = 0;
let failed = 0;
const log = [];

function pass(label) {
	passed++;
	log.push(`  PASS  ${label}`);
}

function fail(label, detail = "") {
	failed++;
	log.push(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}

/**
 * Run a shell command, return { status, stdout, stderr }.
 * Never throws; callers inspect `.status`.
 *
 * @param {string} cmd
 * @return {{ status: number, stdout: string, stderr: string }}
 */
function run(cmd) {
	const result = spawnSync(cmd, {
		shell: true,
		cwd: ROOT,
		encoding: "utf8",
		env: process.env,
	});
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

/**
 * Return the sorted list of entry paths inside a zip, using `unzip -Z1`.
 *
 * @param {string} zipPath
 * @return {string[]}
 */
function listZip(zipPath) {
	const result = run(`unzip -Z1 "${zipPath}"`);
	if (result.status !== 0) {
		throw new Error(`unzip -Z1 failed: ${result.stderr}`);
	}
	return result.stdout
		.trim()
		.split("\n")
		.filter(Boolean)
		.sort();
}

// ---------------------------------------------------------------------------
// AC1 — Invocation / exit 0
// ---------------------------------------------------------------------------
console.log("\nAC1 — Running `npm run plugin-zip` (first run)…");
{
	const r = run("npm run plugin-zip");
	if (r.status === 0) {
		pass("AC1: npm run plugin-zip exits 0");
	} else {
		fail("AC1: npm run plugin-zip exited non-zero", `exit ${r.status}`);
		process.stderr.write(r.stderr);
	}
}

// ---------------------------------------------------------------------------
// AC3 — Artifact location & idempotency
// ---------------------------------------------------------------------------
console.log("\nAC3 — Verifying artifact location and idempotency…");
{
	if (existsSync(ZIP)) {
		pass("AC3a: piano-block.zip exists at repo root after first run");
	} else {
		fail("AC3a: piano-block.zip not found at repo root");
	}

	// Record mtime and entry count before second run.
	const mtimeBefore = existsSync(ZIP) ? statSync(ZIP).mtimeMs : -1;
	const entriesBefore = existsSync(ZIP) ? listZip(ZIP).length : -1;

	// Second run.
	const r2 = run("npm run plugin-zip");
	if (r2.status === 0) {
		pass("AC3b: second npm run plugin-zip exits 0");
	} else {
		fail("AC3b: second npm run plugin-zip exited non-zero", `exit ${r2.status}`);
	}

	const mtimeAfter = existsSync(ZIP) ? statSync(ZIP).mtimeMs : -1;
	const entriesAfter = existsSync(ZIP) ? listZip(ZIP).length : -1;

	if (mtimeAfter > mtimeBefore) {
		pass("AC3c: piano-block.zip mtime advanced (file was overwritten)");
	} else {
		fail("AC3c: piano-block.zip mtime did not advance after second run");
	}

	if (entriesBefore !== -1 && entriesAfter === entriesBefore) {
		pass(`AC3d: entry count stable after overwrite (${entriesAfter} entries)`);
	} else {
		fail(
			"AC3d: entry count changed between runs",
			`before=${entriesBefore} after=${entriesAfter}`,
		);
	}
}

// ---------------------------------------------------------------------------
// AC4 — Single root folder `piano-block/`
// ---------------------------------------------------------------------------
console.log("\nAC4 — Verifying single top-level piano-block/ folder…");
{
	if (!existsSync(ZIP)) {
		fail("AC4: piano-block.zip not found — skipping");
	} else {
		const entries = listZip(ZIP);
		const badEntries = entries.filter((e) => !e.startsWith("piano-block/"));
		if (badEntries.length === 0) {
			pass("AC4: every archive entry is under piano-block/");
		} else {
			fail(
				"AC4: entries found outside piano-block/",
				badEntries.slice(0, 5).join(", "),
			);
		}
	}
}

// ---------------------------------------------------------------------------
// AC5 — Required files present
// ---------------------------------------------------------------------------
console.log("\nAC5 — Verifying required runtime files are present…");
{
	if (!existsSync(ZIP)) {
		fail("AC5: piano-block.zip not found — skipping");
	} else {
		const entries = listZip(ZIP);
		const entrySet = new Set(entries);

		const required = [
			"piano-block/piano-block.php",
			"piano-block/build/block.json",
			"piano-block/build/render.php",
			"piano-block/build/index.js",
			"piano-block/build/view.js",
			"piano-block/build/style-index.css",
			"piano-block/build/index.asset.php",
			"piano-block/build/view.asset.php",
		];

		for (const f of required) {
			if (entrySet.has(f)) {
				pass(`AC5: present — ${f}`);
			} else {
				fail(`AC5: missing — ${f}`);
			}
		}

		// README.md (matched by the `readme.*` glob, case-insensitively).
		const hasReadme = entries.some(
			(e) => e.toLowerCase() === "piano-block/readme.md",
		);
		if (hasReadme) {
			pass("AC5: present — piano-block/README.md");
		} else {
			fail("AC5: missing — piano-block/README.md (readme.* glob)");
		}

		// At least one *.woff2 under piano-block/build/fonts/.
		const hasFont = entries.some(
			(e) =>
				e.startsWith("piano-block/build/fonts/") && e.endsWith(".woff2"),
		);
		if (hasFont) {
			pass("AC5: present — at least one *.woff2 under piano-block/build/fonts/");
		} else {
			fail(
				"AC5: missing — no *.woff2 found under piano-block/build/fonts/",
			);
		}
	}
}

// ---------------------------------------------------------------------------
// AC6 — Excluded files absent
// ---------------------------------------------------------------------------
console.log("\nAC6 — Verifying forbidden files are absent…");
{
	if (!existsSync(ZIP)) {
		fail("AC6: piano-block.zip not found — skipping");
	} else {
		const entries = listZip(ZIP);

		/**
		 * Returns the first entry that matches the predicate, or undefined.
		 *
		 * @param {(e: string) => boolean} predicate
		 * @return {string|undefined}
		 */
		const find = (predicate) => entries.find(predicate);

		const forbiddenChecks = [
			{
				label: "no src/ paths",
				found: find((e) => e.includes("/src/")),
			},
			{
				label: "no node_modules/",
				found: find((e) => e.includes("node_modules/")),
			},
			{
				label: "no package.json",
				found: find((e) => /\/package\.json$/.test(e)),
			},
			{
				label: "no package-lock.json",
				found: find((e) => /\/package-lock\.json$/.test(e)),
			},
			{
				label: "no biome.json",
				found: find((e) => /\/biome\.json$/.test(e)),
			},
			{
				label: "no playwright.config.js",
				found: find((e) => /\/playwright\.config\.js$/.test(e)),
			},
			{
				label: "no .wp-env.json",
				found: find((e) => /\/\.wp-env\.json$/.test(e)),
			},
			{
				label: "no .nvmrc",
				found: find((e) => /\/\.nvmrc$/.test(e)),
			},
			{
				label: "no specs/",
				found: find((e) => e.includes("/specs/")),
			},
			{
				label: "no docs/",
				found: find((e) => e.includes("/docs/")),
			},
			{
				label: "no AGENTS.md",
				found: find((e) => /\/AGENTS\.md$/.test(e)),
			},
			{
				label: "no .rp* files",
				found: find((e) => /\/\.rp/.test(e)),
			},
			{
				label: "no .claude/",
				found: find((e) => e.includes("/.claude/")),
			},
			{
				label: "no scripts/",
				found: find((e) => e.includes("/scripts/")),
			},
			{
				label: "no .gitignore",
				found: find((e) => /\/\.gitignore$/.test(e)),
			},
			{
				label: "no .DS_Store",
				found: find((e) => /\.DS_Store$/.test(e)),
			},
			{
				label: "no .idea/",
				found: find((e) => e.includes("/.idea/")),
			},
			{
				label: "no .vscode/",
				found: find((e) => e.includes("/.vscode/")),
			},
			{
				label: "no *.log",
				found: find((e) => /\.log$/.test(e)),
			},
			{
				label: "no .env* files",
				found: find((e) => /\/\.env/.test(e)),
			},
		];

		for (const { label, found } of forbiddenChecks) {
			if (!found) {
				pass(`AC6: ${label}`);
			} else {
				fail(`AC6: ${label}`, `found: ${found}`);
			}
		}
	}
}

// ---------------------------------------------------------------------------
// AC2 — Build-first / fail-loud (integration)
//
// The plugin-zip chain is: npm run build && node scripts/check-build.js && wp-scripts plugin-zip
// Since `npm run build` always runs first and recreates build/block.json, the
// fail-loud integration test exercises the guard stage directly: temporarily
// hide block.json, run `node scripts/check-build.js && wp-scripts plugin-zip`
// (skipping the build step), and confirm the guard catches the missing file.
// ---------------------------------------------------------------------------
console.log("\nAC2 — Verifying fail-loud when build/block.json is absent…");
{
	const blockJson = join(ROOT, "build", "block.json");
	const blockJsonBackup = join(ROOT, "build", "block.json.bak");
	const zipBefore = existsSync(ZIP) ? statSync(ZIP).mtimeMs : -1;

	// Temporarily hide block.json to simulate a missing/partial build.
	if (existsSync(blockJson)) {
		renameSync(blockJson, blockJsonBackup);
	}

	// Run only the guard + archive stages (skip `npm run build` so block.json
	// stays absent). This is the correct integration surface for the fail-loud
	// check: the guard is the second stage of the three-stage chain and must
	// exit non-zero when its precondition is not met.
	const r = run("node scripts/check-build.js && wp-scripts plugin-zip");

	const zipAfter = existsSync(ZIP) ? statSync(ZIP).mtimeMs : -1;

	// Restore block.json immediately.
	if (existsSync(blockJsonBackup)) {
		renameSync(blockJsonBackup, blockJson);
	}

	if (r.status !== 0) {
		pass(`AC2: guard exits non-zero when build/block.json absent (exit ${r.status})`);
	} else {
		fail("AC2: guard succeeded even without build/block.json");
	}

	// The zip must not have been overwritten (mtime unchanged).
	if (zipAfter === zipBefore) {
		pass("AC2: piano-block.zip was NOT overwritten after failed guard");
	} else {
		fail("AC2: piano-block.zip was overwritten despite missing block.json");
	}

	// Confirm block.json is restored.
	if (existsSync(blockJson)) {
		pass("AC2: build/block.json restored");
	} else {
		fail("AC2: build/block.json NOT restored — tree is broken");
	}
}

// ---------------------------------------------------------------------------
// AC8 — Conditional languages/
// ---------------------------------------------------------------------------
console.log("\nAC8 — Verifying conditional languages/ inclusion…");
{
	const langDir = join(ROOT, "languages");

	// Branch A: languages/ absent — already confirmed by AC5/AC6 checks above.
	// Implicitly re-verified: the zip from AC1-AC6 runs was produced without languages/.
	if (!existsSync(langDir)) {
		pass("AC8a: languages/ absent from working tree (confirmed)");

		const entries = existsSync(ZIP) ? listZip(ZIP) : [];
		const hasLang = entries.some((e) => e.startsWith("piano-block/languages/"));
		if (!hasLang) {
			pass("AC8a: piano-block/languages/ absent from archive when dir not present");
		} else {
			fail("AC8a: piano-block/languages/ unexpectedly present in archive");
		}
	} else {
		fail("AC8a: languages/ already exists in working tree — unexpected");
	}

	// Branch B: create throwaway languages/, re-run, assert inclusion, then clean up.
	mkdirSync(langDir, { recursive: true });
	writeFileSync(join(langDir, "piano-block-en_US.po"), "# placeholder\n");

	const r = run("npm run plugin-zip");
	if (r.status === 0) {
		pass("AC8b: npm run plugin-zip exits 0 with languages/ present");
	} else {
		fail("AC8b: npm run plugin-zip failed with languages/ present", `exit ${r.status}`);
	}

	if (existsSync(ZIP)) {
		const entries = listZip(ZIP);
		const hasLang = entries.some((e) =>
			e.startsWith("piano-block/languages/"),
		);
		if (hasLang) {
			pass("AC8b: piano-block/languages/ present in archive when dir exists");
		} else {
			fail("AC8b: piano-block/languages/ absent from archive despite dir existing");
		}
	} else {
		fail("AC8b: piano-block.zip not found after plugin-zip run");
	}

	// Remove the throwaway languages/ directory.
	rmSync(langDir, { recursive: true, force: true });

	if (!existsSync(langDir)) {
		pass("AC8b: throwaway languages/ removed — tree restored");
	} else {
		fail("AC8b: failed to remove throwaway languages/ directory");
	}
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("\n" + "─".repeat(60));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("─".repeat(60));
for (const line of log) {
	console.log(line);
}
console.log("─".repeat(60));

if (failed > 0) {
	process.exit(1);
}
