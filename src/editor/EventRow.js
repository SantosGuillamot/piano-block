/**
 * One editable row of a hand's event list — the inline controls for a single
 * event plus the affordances to reorder it, remove it, and drill into its
 * details.
 *
 * An event always carries a `type` and a `duration`; everything else is
 * optional. So the two required fields are plain selects, while every optional
 * field follows the same omit-when-unset rule the leaf editors use: `dots` is
 * dropped at 0, and the `dynamic` and the four span selects
 * (`tie`/`slur`/`crescendo`/`decrescendo`) each offer an empty option that
 * drops the key — a chosen value is always one of the schema's enums. The four
 * spans share a compact sub-area to keep the row readable.
 *
 * The one cross-field rule lives here: switching `note`→`rest` drops `pitches`
 * (a rest has none), and switching `rest`→`note` seeds the one pitch a note
 * requires, in the per-song system. Event `annotations` survive the switch in
 * either direction — they are valid on a rest too — and a note's chord and an
 * event's annotations are edited not inline but through the drill-in
 * (`EventEditor`), reached by the drill-in button. The parent owns the event
 * state and re-feeds the emitted value; this component holds none.
 */
import {
	Button,
	__experimentalNumberControl as NumberControl,
	SelectControl,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { ListControls } from "./ListControls.js";
import { noteNameOptions } from "./noteNames.js";
import {
	DOTS_MAX,
	DOTS_MIN,
	DURATIONS,
	DYNAMICS,
	EVENT_TYPES,
	newPitch,
	SPAN_STATES,
} from "./songModel.js";

/** The four span fields and their human-facing labels, edited as a group. */
const SPAN_FIELDS = [
	{ key: "tie", label: __("Tie", "piano-block") },
	{ key: "slur", label: __("Slur", "piano-block") },
	{ key: "crescendo", label: __("Crescendo", "piano-block") },
	{ key: "decrescendo", label: __("Decrescendo", "piano-block") },
];

/** The empty option an optional select offers to unset its field. */
const NONE_OPTION = { label: __("None", "piano-block"), value: "" };

/**
 * Edit a single event inline.
 *
 * @param {Object}              props
 * @param {Object}              props.event      The current event object.
 * @param {"english"|"spanish"} props.system     The per-song note-name system.
 * @param {number}              props.index      This row's position in its list.
 * @param {number}              props.count      The list's length.
 * @param {Function}            props.onChange   Receives the next event.
 * @param {Function}            props.onMoveUp   Called to move this row up.
 * @param {Function}            props.onMoveDown Called to move this row down.
 * @param {Function}            props.onRemove   Called to remove this row.
 * @param {Function}            props.onDrillIn  Called to open the event's detail.
 * @return {Object} The rendered event row.
 */
export function EventRow({
	event,
	system,
	index,
	count,
	onChange,
	onMoveUp,
	onMoveDown,
	onRemove,
	onDrillIn,
}) {
	/**
	 * Emit a `type` change, applying the cross-field rule: a rest has no pitches,
	 * and a note needs the one pitch its invariant requires (in the per-song
	 * system). Event annotations are valid on either, so they pass through.
	 */
	const changeType = (type) => {
		if (type === "rest") {
			const { pitches: _pitches, ...rest } = event;
			onChange({ ...rest, type });
			return;
		}
		const firstName = noteNameOptions(system)[0].value;
		onChange({ ...event, type, pitches: [newPitch(firstName)] });
	};

	/**
	 * Emit a value for an optional field: a falsy value (the empty option, or 0
	 * dots) drops the key, otherwise it is set. The controls only ever offer the
	 * schema's enum values and bounded numbers, so a set value is conformant.
	 */
	const changeOptional = (key, value) => {
		if (value) {
			onChange({ ...event, [key]: value });
			return;
		}
		const { [key]: _dropped, ...rest } = event;
		onChange(rest);
	};

	return (
		<div>
			<SelectControl
				label={__("Event type", "piano-block")}
				value={event.type}
				options={EVENT_TYPES}
				onChange={changeType}
				__nextHasNoMarginBottom
			/>
			<SelectControl
				label={__("Duration", "piano-block")}
				value={event.duration}
				options={DURATIONS}
				onChange={(duration) => onChange({ ...event, duration })}
				__nextHasNoMarginBottom
			/>
			<NumberControl
				label={__("Dots", "piano-block")}
				value={event.dots ?? 0}
				min={DOTS_MIN}
				max={DOTS_MAX}
				step={1}
				onChange={(value) =>
					changeOptional("dots", clampInt(value, DOTS_MIN, DOTS_MAX))
				}
				__nextHasNoMarginBottom
			/>
			<SelectControl
				label={__("Dynamic", "piano-block")}
				value={event.dynamic ?? ""}
				options={[NONE_OPTION, ...DYNAMICS]}
				onChange={(dynamic) => changeOptional("dynamic", dynamic)}
				__nextHasNoMarginBottom
			/>
			{SPAN_FIELDS.map(({ key, label }) => (
				<SelectControl
					key={key}
					label={label}
					value={event[key] ?? ""}
					options={[NONE_OPTION, ...SPAN_STATES]}
					onChange={(value) => changeOptional(key, value)}
					__nextHasNoMarginBottom
				/>
			))}
			<Button
				icon="edit"
				label={__("Edit event details", "piano-block")}
				onClick={onDrillIn}
			/>
			<ListControls
				index={index}
				count={count}
				onMoveUp={onMoveUp}
				onMoveDown={onMoveDown}
				onRemove={onRemove}
				moveUpLabel={__("Move event up", "piano-block")}
				moveDownLabel={__("Move event down", "piano-block")}
				removeLabel={__("Remove event", "piano-block")}
			/>
		</div>
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
