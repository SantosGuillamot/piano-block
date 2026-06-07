/**
 * The editor's per-song note-name system: which of the two recognised spellings
 * a song is written in, the seven-name option list for that system's
 * `SelectControl`, and the rewrite of a single `step` into that system.
 *
 * The format accepts two equivalent spelling systems for the same seven pitches
 * — English letters (`C D E F G A B`) and Spanish solfège (`do re mi fa sol la
 * si`). A song picks one implicitly by how its pitches are spelled, and the
 * editor must keep editing in that same system rather than forcing a single one
 * on every author. So this module infers the song's system from its existing
 * pitches and offers that system's spellings.
 *
 * Existing spellings are preserved verbatim in the working object: nothing here
 * rewrites a `step` until the author edits that pitch, at which point the pitch
 * editor (`PitchEditor`) maps the chosen letter through `stepInSystem` so the
 * stored spelling stays in the per-song system.
 *
 * The recognised vocabulary and the `step → canonical English letter` mapping
 * are NOT redefined here — `normalizeStep`/`isNoteName` remain the single
 * source. This module only adds the *display* ordering each system stores into
 * `step`, mapped to the same canonical letters `normalizeStep` yields.
 */
import { isNoteName, normalizeStep } from "../song/normalizeStep.js";

/**
 * The two ordered seven-name systems, keyed by system name. Each entry is the
 * display spelling stored into a pitch's `step`, ordered C…B. The index of a
 * spelling matches its canonical letter's index in `CANONICAL_LETTERS`, so a
 * step canonicalized by `normalizeStep` maps straight to the other system's
 * spelling at the same index.
 */
const SYSTEMS = {
	english: ["C", "D", "E", "F", "G", "A", "B"],
	spanish: ["do", "re", "mi", "fa", "sol", "la", "si"],
};

/** Canonical UPPERCASE English letters in the systems' shared order. */
const CANONICAL_LETTERS = SYSTEMS.english;

/**
 * The Spanish-system spellings, lowercased — the discriminator for
 * `inferNoteNameSystem`. A pitch whose `step` lowercases to one of these tells
 * us the song is written in the Spanish system.
 */
const SPANISH_TOKENS = new Set(SYSTEMS.spanish);

/**
 * Yield every pitch `step` in a parsed song, walking sections → measures → each
 * hand's events → pitches. Tolerates a missing or malformed song by yielding
 * nothing.
 *
 * @param {*} song The parsed song working object.
 * @yield {string} Each pitch's raw `step` value, in document order.
 */
function* stepsOf(song) {
	const sections = song?.sections;
	if (!Array.isArray(sections)) {
		return;
	}
	for (const section of sections) {
		const measures = section?.measures;
		if (!Array.isArray(measures)) {
			continue;
		}
		for (const measure of measures) {
			for (const hand of [measure?.rightHand, measure?.leftHand]) {
				if (!Array.isArray(hand)) {
					continue;
				}
				for (const event of hand) {
					const pitches = event?.pitches;
					if (!Array.isArray(pitches)) {
						continue;
					}
					for (const pitch of pitches) {
						yield pitch?.step;
					}
				}
			}
		}
	}
}

/**
 * Resolve which note-name system a parsed song is written in.
 *
 * The rule, kept deliberately simple: Spanish if the song uses any
 * Spanish-system spelling, else English. A song with no pitches — and a
 * brand-new song — is English by default.
 *
 * @param {*} song The parsed song working object.
 * @return {"english"|"spanish"} The song's note-name system.
 */
export function inferNoteNameSystem(song) {
	for (const step of stepsOf(song)) {
		if (typeof step === "string" && SPANISH_TOKENS.has(step.toLowerCase())) {
			return "spanish";
		}
	}
	return "english";
}

/**
 * The seven-name `SelectControl` option list for a system. Each option's
 * `value` is the exact display spelling stored into a pitch's `step`; the names
 * are short enough that the spelling is its own label.
 *
 * @param {"english"|"spanish"} system The note-name system.
 * @return {{ label: string, value: string }[]} The ordered C…B options.
 */
export function noteNameOptions(system) {
	const names = SYSTEMS[system] ?? SYSTEMS.english;
	return names.map((name) => ({ label: name, value: name }));
}

/**
 * Rewrite an existing `step` into a system's spelling: canonicalize it to its
 * English letter, then look up that letter's spelling in the requested system.
 * Idempotent — a step already in the system maps back to itself. An
 * unrecognised step falls back to the system's first name.
 *
 * Used by the pitch editor when an author edits a pitch, so the stored spelling
 * stays in the per-song system.
 *
 * @param {*}                    step   The existing `step` spelling.
 * @param {"english"|"spanish"} system The target note-name system.
 * @return {string} The `step`'s spelling in `system`.
 */
export function stepInSystem(step, system) {
	const names = SYSTEMS[system] ?? SYSTEMS.english;
	const letter = isNoteName(step) ? normalizeStep(step) : null;
	const index = letter ? CANONICAL_LETTERS.indexOf(letter) : -1;
	return index === -1 ? names[0] : names[index];
}
