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
	__experimentalHStack as HStack,
	__experimentalNumberControl as NumberControl,
	SelectControl,
} from "@wordpress/components";
import { __, sprintf } from "@wordpress/i18n";
import { trash } from "@wordpress/icons";
import { AddButton } from "./ListControls.js";
import { noteNameOptions } from "./noteNames.js";
import {
	ALTER_MAX,
	ALTER_MIN,
	CLEFS,
	clampInt,
	insertAt,
	NONE_OPTION,
	OCTAVE_SHIFT_MAX,
	OCTAVE_SHIFT_MIN,
	removeAt,
	replaceAt,
} from "./songModel.js";

/** The seven English note letters offered as `alters` keys. */
const ALTER_KEY_OPTIONS = noteNameOptions("english");

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

	// Compose the hand-scoped accessible name (aria-label) for each control so
	// the two hands' identically-purposed controls stay distinguishable to
	// assistive technology (e.g. "Right hand clef"). The visible label is the
	// bare, title-cased field name; fieldLabel composes the aria-label only.
	// The hand label is already an i18n string, so compose via sprintf so
	// translators can reorder the parts.
	const fieldLabel = (field) =>
		label
			? sprintf(
					/* translators: 1: hand label, 2: field name. */
					__("%1$s %2$s", "piano-block"),
					label,
					field,
				)
			: field;

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
				label={__("Clef", "piano-block")}
				aria-label={fieldLabel(__("clef", "piano-block"))}
				value={handConfig.clef ?? ""}
				options={[NONE_OPTION, ...CLEFS]}
				onChange={(value) =>
					emitField("clef", value === "" ? undefined : value)
				}
				__nextHasNoMarginBottom
				__next40pxDefaultSize
			/>
			<NumberControl
				label={__("Octave shift", "piano-block")}
				aria-label={fieldLabel(__("octave shift", "piano-block"))}
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
				__next40pxDefaultSize
			/>
			{rows.map((row, index) => (
				<HStack key={row.note}>
					<SelectControl
						label={__("Alteration note", "piano-block")}
						aria-label={fieldLabel(__("alteration note", "piano-block"))}
						value={row.note}
						options={ALTER_KEY_OPTIONS}
						onChange={(note) =>
							emitRows(replaceAt(rows, index, { ...row, note }))
						}
						__nextHasNoMarginBottom
						__next40pxDefaultSize
					/>
					<NumberControl
						label={__("Alteration", "piano-block")}
						aria-label={fieldLabel(__("alteration", "piano-block"))}
						value={row.value}
						min={ALTER_MIN}
						max={ALTER_MAX}
						step={1}
						onChange={(value) =>
							emitRows(
								replaceAt(rows, index, {
									...row,
									value: clampInt(value, ALTER_MIN, ALTER_MAX),
								}),
							)
						}
						__next40pxDefaultSize
					/>
					<Button
						icon={trash}
						isDestructive
						aria-label={fieldLabel(__("remove alteration", "piano-block"))}
						onClick={() => emitRows(removeAt(rows, index))}
						__next40pxDefaultSize
					/>
				</HStack>
			))}
			<AddButton
				label={__("Add alteration", "piano-block")}
				aria-label={fieldLabel(__("add alteration", "piano-block"))}
				onClick={() =>
					emitRows(
						insertAt(rows, rows.length, {
							note: nextUnusedNote(rows),
							value: 0,
						}),
					)
				}
			/>
		</>
	);
}
