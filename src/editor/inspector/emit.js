/**
 * Shared emit helpers for the canvas-first inspector panels.
 *
 * Every panel edits one slice of the whole working `song` and emits the whole
 * song back up (the parent runs it through `commitSong`). The two omit rules the
 * panels share live here so they have one home:
 *   - `omitEmpty` — an optional *block* (`metadata`, `defaults`, a section's
 *     overrides, a context member) must clear its key when the author empties it,
 *     so an untouched-then-cleared block leaves no empty husk in the round-trip.
 *   - `omitFalsy` — an optional *scalar* (a name, a barline, a dots count) must
 *     clear its key when the author leaves it blank, where `0` and `""` both
 *     count as "blank" (`0` dots drops the key).
 * `emitBlock` is the song-level convenience that applies `omitEmpty` and calls
 * `onChange`. These are the same rules the old per-panel copies applied; they are
 * lifted here so the panels share one implementation.
 */

/**
 * Return a new object with `key` set to `value` when `value` has at least one own
 * key, else with `key` deleted. The shared omit-when-empty rule for optional
 * object blocks.
 *
 * @param {Object} obj   The source object (not mutated).
 * @param {string} key   The optional key being set.
 * @param {?Object} value The next value, or empty/falsy to drop the key.
 * @return {Object} A new object with the key set or deleted.
 */
export function omitEmpty(obj, key, value) {
	const next = { ...obj };
	if (value && Object.keys(value).length > 0) {
		next[key] = value;
	} else {
		delete next[key];
	}
	return next;
}

/**
 * Return a new object with `key` set to `value` when `value` is truthy (after
 * trimming a string), else with `key` deleted. The shared omit-when-blank rule
 * for optional scalars: a blank name, the empty barline option, or `0` dots all
 * drop the key (`0` and `""` are falsy).
 *
 * @param {Object} obj   The source object (not mutated).
 * @param {string} key   The optional key being set.
 * @param {*}      value The next value, or a blank/falsy value to drop the key.
 * @return {Object} A new object with the key set or deleted.
 */
export function omitFalsy(obj, key, value) {
	const next = { ...obj };
	const kept = typeof value === "string" ? value.trim() : value;
	if (kept) {
		next[key] = value;
	} else {
		delete next[key];
	}
	return next;
}

/**
 * Emit the song with `key` set to `value`, dropping the key when `value` has no
 * set fields so an emptied optional block clears its key.
 *
 * @param {Object}   song     The current song object.
 * @param {string}   key      The optional block being set (`metadata`/`defaults`).
 * @param {Object}   value    The block's next value.
 * @param {Function} onChange Receives the next song object.
 */
export function emitBlock(song, key, value, onChange) {
	onChange(omitEmpty(song, key, value));
}
