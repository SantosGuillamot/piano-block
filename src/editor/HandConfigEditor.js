/**
 * The leaf editor for one hand's `handConfig` — its `clef`, `octaveShift` and
 * the per-note `alters` map.
 *
 * A hand config is optional and every member within it is independently
 * present/absent, so the control emits only the fields the author has set and
 * emits `{}` when nothing is set (which the parent context editor then omits
 * entirely). The numeric inputs clamp to the format's bounds and the selects
 * offer only enum values, so the control is conformant by construction.
 *
 * `alters` is stored as a map (note name → integer alteration), but a map has no
 * stable row order to edit. The control therefore derives ordered rows from the
 * map on each render and writes them back as a fresh map: a row's note name is
 * its key, so a collision (two rows naming the same note) collapses to a single
 * entry — the later row wins — rather than producing a malformed duplicate.
 * Keys are restricted to the seven English letters because `alters` keys are
 * canonicalized case-insensitively by the validator, so a fixed English set is
 * the simplest recognised vocabulary.
 */
import {
	Button,
	__experimentalNumberControl as NumberControl,
	SelectControl,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { AddButton } from "./ListControls.js";
import {
	ALTER_MAX,
	ALTER_MIN,
	CLEFS,
	OCTAVE_SHIFT_MAX,
	OCTAVE_SHIFT_MIN,
} from "./songModel.js";

/** The seven English note letters offered as `alters` keys. */
const ALTER_KEY_OPTIONS = ["C", "D", "E", "F", "G", "A", "B"].map((letter) => ({
	label: letter,
	value: letter,
}));

/** The first English letter not yet used by an alters row, falling back to C. */
function nextUnusedNote(rows) {
	const used = new Set(rows.map((row) => row.note));
	const free = ALTER_KEY_OPTIONS.find((option) => !used.has(option.value));
	return free ? free.value : "C";
}

/**
 * Rebuild the emitted hand config from the set fields, omitting any unset one and
 * emitting `alters` only when at least one row exists. Alters rows fold back into
 * a map keyed by note name, so a duplicate note collapses to one entry.
 *
 * @param {Object}   base  The current hand config (for `clef` / `octaveShift`).
 * @param {Object[]} rows  The ordered alters rows (`{ note, value }`).
 * @return {Object} The next conformant hand-config fragment.
 */
function buildHandConfig(base, rows) {
	const next = {};
	if (base.clef) {
		next.clef = base.clef;
	}
	if (Number.isInteger(base.octaveShift)) {
		next.octaveShift = base.octaveShift;
	}
	if (rows.length > 0) {
		const alters = {};
		for (const row of rows) {
			alters[row.note] = row.value;
		}
		next.alters = alters;
	}
	return next;
}

/**
 * Edit a single hand's `handConfig`.
 *
 * @param {Object}   props
 * @param {Object}   [props.handConfig={}] The current hand config.
 * @param {Function} props.onChange        Receives the next hand-config fragment.
 * @param {string}   props.label           The hand's name (e.g. "Right hand"),
 *                                          used to label its controls.
 * @return {Object} The rendered hand-config editor.
 */
export function HandConfigEditor({ handConfig = {}, onChange, label }) {
	// Derive ordered alters rows from the map on each render.
	const rows = Object.entries(handConfig.alters ?? {}).map(([note, value]) => ({
		note,
		value,
	}));

	// Prefix each control's accessible name with the hand's label so the two
	// hands' identically-purposed controls stay distinguishable (e.g. "Right
	// hand clef"). The label is already an i18n string, so compose, don't wrap.
	const fieldLabel = (field) => (label ? `${label} ${field}` : field);

	/** Emit a hand config rebuilt from a leaf-field change plus the current rows. */
	const emitField = (key, value) => {
		const base = { ...handConfig };
		if (value === undefined) {
			delete base[key];
		} else {
			base[key] = value;
		}
		onChange(buildHandConfig(base, rows));
	};

	/** Emit a hand config rebuilt from the current leaf fields plus new rows. */
	const emitRows = (nextRows) => {
		onChange(buildHandConfig(handConfig, nextRows));
	};

	return (
		<>
			<SelectControl
				label={fieldLabel(__("clef", "piano-block"))}
				value={handConfig.clef ?? ""}
				options={[{ label: __("—", "piano-block"), value: "" }, ...CLEFS]}
				onChange={(value) =>
					emitField("clef", value === "" ? undefined : value)
				}
				__nextHasNoMarginBottom
			/>
			<NumberControl
				label={fieldLabel(__("octave shift", "piano-block"))}
				value={
					Number.isInteger(handConfig.octaveShift) ? handConfig.octaveShift : ""
				}
				min={OCTAVE_SHIFT_MIN}
				max={OCTAVE_SHIFT_MAX}
				step={1}
				onChange={(value) =>
					emitField(
						"octaveShift",
						value === ""
							? undefined
							: clampInt(value, OCTAVE_SHIFT_MIN, OCTAVE_SHIFT_MAX),
					)
				}
				__nextHasNoMarginBottom
			/>
			{rows.map((row, index) => (
				<div key={row.note}>
					<SelectControl
						label={fieldLabel(__("alteration note", "piano-block"))}
						value={row.note}
						options={ALTER_KEY_OPTIONS}
						onChange={(note) =>
							emitRows(replaceRow(rows, index, { ...row, note }))
						}
						__nextHasNoMarginBottom
					/>
					<NumberControl
						label={fieldLabel(__("alteration", "piano-block"))}
						value={row.value}
						min={ALTER_MIN}
						max={ALTER_MAX}
						step={1}
						onChange={(value) =>
							emitRows(
								replaceRow(rows, index, {
									...row,
									value: clampInt(value, ALTER_MIN, ALTER_MAX),
								}),
							)
						}
						__nextHasNoMarginBottom
					/>
					<Button
						icon="trash"
						label={fieldLabel(__("remove alteration", "piano-block"))}
						onClick={() => emitRows(rows.filter((_, i) => i !== index))}
					/>
				</div>
			))}
			<AddButton
				label={fieldLabel(__("add alteration", "piano-block"))}
				onClick={() =>
					emitRows([...rows, { note: nextUnusedNote(rows), value: 0 }])
				}
			/>
		</>
	);
}

/**
 * Coerce a numeric-input string to an integer clamped to `[min, max]`. A
 * non-numeric input clamps to `min`, so the control can never produce an
 * out-of-range value.
 *
 * @param {string} raw The raw field value.
 * @param {number} min The lower bound.
 * @param {number} max The upper bound.
 * @return {number} The clamped integer.
 */
function clampInt(raw, min, max) {
	const parsed = Math.round(Number(raw));
	if (!Number.isFinite(parsed)) {
		return min;
	}
	return Math.min(max, Math.max(min, parsed));
}

/** Return a new rows array with the row at `index` replaced. */
function replaceRow(rows, index, row) {
	const next = rows.slice();
	next[index] = row;
	return next;
}
