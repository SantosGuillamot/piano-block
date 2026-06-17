import fs from "node:fs";
import path from "node:path";

import validateSong from "../validate.js";

const SONG_PATH = path.join(process.cwd(), "songs", "la-vie-en-rose.json");
const SPANISH_NOTE_NAMES = new Set(["do", "re", "mi", "fa", "sol", "la", "si"]);

const collectInvalidPitchSteps = (song) => {
	const invalidSteps = [];

	for (const [sectionIndex, section] of (song.sections ?? []).entries()) {
		for (const [measureIndex, measure] of (section.measures ?? []).entries()) {
			for (const hand of ["rightHand", "leftHand"]) {
				for (const [eventIndex, event] of (measure[hand] ?? []).entries()) {
					for (const [pitchIndex, pitch] of (event.pitches ?? []).entries()) {
						if (!SPANISH_NOTE_NAMES.has(pitch.step)) {
							invalidSteps.push(
								`sections[${sectionIndex}].measures[${measureIndex}].${hand}[${eventIndex}].pitches[${pitchIndex}].step: ${pitch.step}`,
							);
						}
					}
				}
			}
		}
	}

	return invalidSteps;
};

const collectInvalidAlterKeys = (song) => {
	const invalidKeys = [];
	const checkAlters = (alters, pathName) => {
		for (const key of Object.keys(alters ?? {})) {
			if (!SPANISH_NOTE_NAMES.has(key)) {
				invalidKeys.push(`${pathName}.${key}`);
			}
		}
	};

	checkAlters(song.defaults?.rightHand?.alters, "defaults.rightHand.alters");
	checkAlters(song.defaults?.leftHand?.alters, "defaults.leftHand.alters");

	for (const [sectionIndex, section] of (song.sections ?? []).entries()) {
		checkAlters(section.rightHand?.alters, `sections[${sectionIndex}].rightHand.alters`);
		checkAlters(section.leftHand?.alters, `sections[${sectionIndex}].leftHand.alters`);
	}

	return invalidKeys;
};

describe("La Vie en Rose song fixture", () => {
	it("is valid JSON, schema-conformant, and uses Spanish note names", () => {
		const raw = fs.readFileSync(SONG_PATH, "utf8");
		let parsed;

		expect(() => {
			parsed = JSON.parse(raw);
		}).not.toThrow();

		expect(validateSong(raw)).toEqual([]);
		expect(parsed.language).toBe("spanish");
		expect(parsed.metadata.title).toBe("La Vie en Rose");
		expect(parsed.metadata).not.toHaveProperty("composer");
		expect(collectInvalidPitchSteps(parsed)).toEqual([]);
		expect(collectInvalidAlterKeys(parsed)).toEqual([]);
	});
});
