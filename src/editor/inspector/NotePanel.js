/**
 * The inspector panel for the currently-selected event — a note or a rest.
 *
 * Rendered inside `InspectorControls` only when an event is selected on the
 * canvas, this is the event-level settings panel. An event always carries the
 * two required fields `type` and `duration`, so those are visible directly,
 * alongside a note's chord `pitches`; the optional members — `dots`, `dynamic`,
 * the four spans (`tie`/`slur`/`crescendo`/`decrescendo`) and the event's
 * `annotations` — hide behind a `ToolsPanel` so the panel stays shallow but
 * reaches the whole event model (Req 7, 8, 11; AC7, AC9, AC10).
 *
 * The panel is a pure controlled component: it holds no song state and emits the
 * next whole working `song` through `onChange` (the parent commits it). It edits
 * the resolved selection in place — splicing the next event back through its
 * section → measures → hand path — and reuses the existing constrained leaf
 * editors (`PitchList`, `AnnotationList`) and the `songModel` array helpers, so
 * every emission stays conformant by construction. Removing the event signals up
 * through `onRemoveNote` with the selection's own coords — the parent owns the
 * splice (dropping the hand key when it empties) and clears the now-stale selection,
 * so the note-level remove lives in one place. Adding a note signals up through
 * `onAddNote` with the selection's own coords — the hand is inferred from the
 * selection, never prompted (AC3); the parent inserts the new note right after the
 * selected one and auto-selects it.
 *
 * The one cross-field rule — switching `note`↔`rest` drops/seeds `pitches` — is
 * reproduced from `EventRow.changeType` verbatim rather than imported, since
 * `EventRow` carries the now-removed reorder controls.
 */
import {
	Button,
	__experimentalNumberControl as NumberControl,
	PanelBody,
	SelectControl,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
} from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { AnnotationList } from "../AnnotationList.js";
import { noteNameOptions } from "../noteNames.js";
import { PitchList } from "../PitchList.js";
import {
	clampInt,
	DOTS_MAX,
	DOTS_MIN,
	DURATIONS,
	DYNAMICS,
	EVENT_TYPES,
	NONE_OPTION,
	newPitch,
	SPAN_STATES,
	setEventAt,
} from "../songModel.js";
import { omitFalsy } from "./emit.js";

/** The four span fields and their human-facing labels, disclosed as a group. */
const SPAN_FIELDS = [
	{ key: "tie", label: __("Tie", "piano-block") },
	{ key: "slur", label: __("Slur", "piano-block") },
	{ key: "crescendo", label: __("Crescendo", "piano-block") },
	{ key: "decrescendo", label: __("Decrescendo", "piano-block") },
];

/**
 * The inspector panel for the selected event.
 *
 * @param {Object}              props
 * @param {Object}              props.song      The current working song object.
 * @param {Object}              props.selection The resolved selection — the live
 *                                              event with its `section`/`measure`
 *                                              and `sectionIndex`/`measureIndex`/
 *                                              `hand`/`eventIndex` coords.
 * @param {"english"|"spanish"} props.system    The per-song note-name system.
 * @param {Function}            props.onChange      Receives the next working song.
 * @param {Function}            props.onRemoveNote  Called with the selection's
 *                                                  `(sectionIndex, measureIndex,
 *                                                  hand, eventIndex)` to remove the
 *                                                  selected event; the parent owns
 *                                                  the splice and selection clear.
 * @param {Function}            props.onAddNote     Called with the selection's
 *                                                  `(sectionIndex, measureIndex,
 *                                                  hand)` to add a note in the same
 *                                                  hand.
 * @return {Object} The rendered Note panel.
 */
export function NotePanel({
	song,
	selection,
	system,
	onChange,
	onRemoveNote,
	onAddNote,
}) {
	const { event, sectionIndex, measureIndex, hand, eventIndex } = selection;

	/**
	 * Splice `nextEvent` back into the whole `song` at the selection's event coords
	 * and emit it. `setEventAt` dispatches by this panel's depth (event), never by
	 * which coords are present, so the same resolved selection the parent also feeds
	 * the Measure/Section panels still splices at the right level here.
	 */
	const emitEvent = (nextEvent) => {
		onChange(setEventAt(song, selection, nextEvent));
	};

	/**
	 * Emit a `type` change, applying the cross-field rule from `EventRow`: a rest
	 * has no pitches, and a note needs the one pitch its invariant requires (in
	 * the per-song system). Event annotations are valid on either, so they pass
	 * through.
	 */
	const changeType = (type) => {
		if (type === "rest") {
			const { pitches: _pitches, ...rest } = event;
			emitEvent({ ...rest, type });
			return;
		}
		const firstName = noteNameOptions(system)[0].value;
		emitEvent({ ...event, type, pitches: [newPitch(firstName)] });
	};

	/**
	 * Emit a value for an optional field: a falsy value (the empty option, or 0
	 * dots) drops the key, otherwise it is set. The controls only ever offer the
	 * schema's enum values and bounded numbers, so a set value is conformant.
	 */
	const changeOptional = (key, value) => {
		emitEvent(omitFalsy(event, key, value));
	};

	return (
		<PanelBody title={__("Note", "piano-block")} initialOpen>
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
				onChange={(duration) => emitEvent({ ...event, duration })}
				__nextHasNoMarginBottom
			/>
			{event.type === "note" ? (
				<PitchList
					pitches={event.pitches}
					system={system}
					onChange={(pitches) => emitEvent({ ...event, pitches })}
				/>
			) : null}

			<ToolsPanel
				label={__("Advanced", "piano-block")}
				resetAll={() => {
					// Drop every disclosed optional member in one emission, keeping
					// only the required fields (and a note's pitches).
					const {
						dots: _dots,
						dynamic: _dynamic,
						tie: _tie,
						slur: _slur,
						crescendo: _crescendo,
						decrescendo: _decrescendo,
						annotations: _annotations,
						...kept
					} = event;
					emitEvent(kept);
				}}
			>
				<ToolsPanelItem
					label={__("Dots", "piano-block")}
					hasValue={() => Boolean(event.dots)}
					onDeselect={() => changeOptional("dots", 0)}
				>
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
				</ToolsPanelItem>

				<ToolsPanelItem
					label={__("Dynamic", "piano-block")}
					hasValue={() => Boolean(event.dynamic)}
					onDeselect={() => changeOptional("dynamic", "")}
				>
					<SelectControl
						label={__("Dynamic", "piano-block")}
						value={event.dynamic ?? ""}
						options={[NONE_OPTION, ...DYNAMICS]}
						onChange={(dynamic) => changeOptional("dynamic", dynamic)}
						__nextHasNoMarginBottom
					/>
				</ToolsPanelItem>

				{SPAN_FIELDS.map(({ key, label }) => (
					<ToolsPanelItem
						key={key}
						label={label}
						hasValue={() => Boolean(event[key])}
						onDeselect={() => changeOptional(key, "")}
					>
						<SelectControl
							label={label}
							value={event[key] ?? ""}
							options={[NONE_OPTION, ...SPAN_STATES]}
							onChange={(value) => changeOptional(key, value)}
							__nextHasNoMarginBottom
						/>
					</ToolsPanelItem>
				))}

				<ToolsPanelItem
					label={__("Annotations", "piano-block")}
					hasValue={() => Array.isArray(event.annotations)}
					onDeselect={() => changeOptional("annotations", undefined)}
				>
					<AnnotationList
						annotations={event.annotations}
						kind="event"
						onChange={(annotations) => {
							if (annotations === undefined) {
								const { annotations: _dropped, ...rest } = event;
								emitEvent(rest);
								return;
							}
							emitEvent({ ...event, annotations });
						}}
					/>
				</ToolsPanelItem>
			</ToolsPanel>

			{/* Add a note in the selection's own hand (inferred, never prompted), then
			    Remove the selected note. The parent's `onAddNote` inserts right after
			    the selection and auto-selects the new note (AC3); the parent's
			    `onRemoveNote` owns the splice and clears the now-stale selection. */}
			<Button
				variant="secondary"
				onClick={() => onAddNote?.(sectionIndex, measureIndex, hand)}
			>
				{__("Add note", "piano-block")}
			</Button>
			<Button
				variant="secondary"
				isDestructive
				onClick={() =>
					onRemoveNote?.(sectionIndex, measureIndex, hand, eventIndex)
				}
			>
				{__("Remove note", "piano-block")}
			</Button>
		</PanelBody>
	);
}
