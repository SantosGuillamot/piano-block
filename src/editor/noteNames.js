/**
 * The editor's per-song note-name system: which of the two recognised spellings
 * a song is written in, the seven-name option list for that system's
 * `SelectControl`, the rewrite of a single `step` into that system, the
 * tree-label for an event in that system, and the song-wide conversion that
 * rewrites every pitch and stamps the stored `language`.
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
 *
 * The per-system arrays, inference logic, and `stepInSystem` live in
 * `../song/noteNameSystem.js` so the frontend view can consume the exact same
 * implementation (no duplicate that can drift).
 */
import { __ } from "@wordpress/i18n";
import { SYSTEMS, stepInSystem } from "../song/noteNameSystem.js";

export { inferNoteNameSystem, stepInSystem } from "../song/noteNameSystem.js";

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
 * The structure tree's display label for an event: `"rest"` for a rest, else the
 * event's pitch name(s) in the song's note-name system. Each `pitch.step` is
 * mapped through `stepInSystem` so a stored spelling is shown canonicalized into
 * `system` (an English `C` reads `do` in a Spanish song); a chord's names are
 * space-joined. Pitch name(s) only — octave is intentionally omitted (the
 * C4/C5 ambiguity is deferred).
 *
 * Throw-free: only an explicit rest yields the `"rest"` string; a malformed note
 * with no pitches yields an empty string rather than throwing, since the tree
 * only ever feeds it conformant working-object events.
 *
 * @param {*}                    event  The event (note or rest) to label.
 * @param {"english"|"spanish"} system The song's note-name system.
 * @return {string} The event's tree label.
 */
export function noteLabel(event, system) {
	if (event?.type === "rest") {
		return __("rest", "piano-block");
	}
	return (event?.pitches ?? [])
		.map((pitch) => stepInSystem(pitch?.step, system))
		.join(" ");
}

/**
 * Rewrite a whole song into a target note-name system: every `pitch.step` is
 * mapped through `stepInSystem` (idempotent + canonicalizing) and the root
 * `language` field is stamped to the target so the stored language always agrees
 * with the spellings it produced.
 *
 * Only `pitch.step` is converted. `handConfig.alters` keys stay English-canonical
 * — the visual editor only ever writes English alters keys and the renderer
 * normalizes them, so a Spanish alters key would be both invisible and reverted
 * on the next hand-config edit; rewriting them would fight the editor for no
 * visible benefit. They are copied through unchanged.
 *
 * Builds a new song immutably (the input is never mutated) and tolerates a
 * missing or malformed song by walking defensively — a song with no `sections`
 * returns just the `language` stamp.
 *
 * @param {*}                    song         The parsed song working object.
 * @param {"english"|"spanish"} targetSystem The note-name system to convert to.
 * @return {Object} A new song in `targetSystem`, with `language` set.
 */
export function mapSong(song, targetSystem) {
	const sections = song?.sections;
	const mappedSections = Array.isArray(sections)
		? sections.map((section) => ({
				...section,
				measures: Array.isArray(section?.measures)
					? section.measures.map(mapMeasure(targetSystem))
					: section?.measures,
			}))
		: sections;
	return {
		...song,
		...(Array.isArray(sections) ? { sections: mappedSections } : {}),
		language: targetSystem,
	};
}

/**
 * A measure mapper bound to a target system: rewrites each hand's pitch steps,
 * leaving every other field (annotations, hand config) untouched. Returns a
 * function so `mapSong`'s walk reads as a plain `map`.
 *
 * @param {"english"|"spanish"} targetSystem The note-name system to convert to.
 * @return {(measure: *) => Object} A measure → measure mapper.
 */
function mapMeasure(targetSystem) {
	return (measure) => {
		const next = { ...measure };
		for (const handKey of ["rightHand", "leftHand"]) {
			if (Array.isArray(measure?.[handKey])) {
				next[handKey] = measure[handKey].map(mapEvent(targetSystem));
			}
		}
		return next;
	};
}

/**
 * An event mapper bound to a target system: rewrites a note's `pitches[].step`,
 * leaving rests and every other event field untouched.
 *
 * @param {"english"|"spanish"} targetSystem The note-name system to convert to.
 * @return {(event: *) => Object} An event → event mapper.
 */
function mapEvent(targetSystem) {
	return (event) => {
		if (!Array.isArray(event?.pitches)) {
			return event;
		}
		return {
			...event,
			pitches: event.pitches.map((pitch) => ({
				...pitch,
				step: stepInSystem(pitch?.step, targetSystem),
			})),
		};
	};
}
