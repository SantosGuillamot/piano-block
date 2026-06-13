/**
 * The leaf editor for a `context` object — the shared shape used both for a
 * song's `defaults` and for any per-section override. A context groups four
 * optional, independently present/absent members: `tempo`, `timeSignature`, and
 * the `rightHand` / `leftHand` configs.
 *
 * The control's whole job is to stay conformant by construction while letting
 * each member be set or left absent. It enforces the two sub-objects that have
 * required fields:
 *   - `tempo` requires `bpm`, so the control emits `tempo` only when `bpm` is
 *     present and drops the whole key when the author clears `bpm`.
 *   - `timeSignature` requires both `beats` and `beatType`, so the control emits
 *     it only when both are set — never a half-filled (non-conformant) one.
 * Each hand config is omitted when it has no set fields, so an untouched
 * override stays absent (supporting the overrides model and a clean round-trip).
 *
 * Because `tempo` and `timeSignature` are emitted only when complete, the author
 * must be able to fill them one field at a time without the half-filled value
 * vanishing. The control therefore keeps a small local *draft* for those two
 * sub-objects: the draft is what the fields display, while only the conformant
 * (complete) projection of the draft is ever emitted upward. The hand configs
 * carry no required fields, so they need no draft and emit straight through.
 *
 * Two visible arrangements share that one draft/projection/emit core, chosen by
 * the `layout` prop so both the Section panel and the Song panel can compose this
 * editor instead of forking its logic:
 *   - `"flat"` (default) renders every member in order — bpm, beat unit, beats,
 *     beat type, both hand configs — used by the Section panel inside its own
 *     coarse "Section overrides" disclosure.
 *   - `"tiered"` keeps the common tempo bpm / beats / beat type directly visible
 *     and tucks `beatUnit` and each hand config into an `Advanced` `ToolsPanel` as
 *     separate, individually deselectable items — reproducing the Song panel's
 *     layout, where each advanced member has its own `hasValue`/`onDeselect` and a
 *     `resetAll` clears them together.
 */
import {
	__experimentalNumberControl as NumberControl,
	SelectControl,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
} from "@wordpress/components";
import { useState } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { omitEmpty } from "./emit.js";
import { HandConfigEditor } from "./HandConfigEditor.js";
import {
	BEAT_TYPES,
	BEATS_MIN,
	DURATIONS,
	HANDS,
	NONE_OPTION,
	toBoundedInt,
} from "./songModel.js";

/** Key → label lookup derived from HANDS, so labels stay in sync with the canonical list. */
const HAND_LABEL = Object.fromEntries(HANDS.map((h) => [h.key, h.label]));

/** The conformant `tempo` projection of a draft, or `undefined` when no bpm. */
function projectTempo(draft) {
	if (draft.bpm === null || draft.bpm === undefined) {
		return undefined;
	}
	const tempo = { bpm: draft.bpm };
	if (draft.beatUnit) {
		tempo.beatUnit = draft.beatUnit;
	}
	return tempo;
}

/** The conformant `timeSignature` projection, or `undefined` when incomplete. */
function projectTimeSignature(draft) {
	if (
		draft.beats === null ||
		draft.beats === undefined ||
		draft.beatType === null ||
		draft.beatType === undefined
	) {
		return undefined;
	}
	return { beats: draft.beats, beatType: draft.beatType };
}

/**
 * Edit a `context` object's optional members.
 *
 * @param {Object}            props
 * @param {Object}            [props.context={}]    The current context object.
 * @param {Function}          props.onChange        Receives the next context object.
 * @param {"flat"|"tiered"}   [props.layout="flat"] How the members are arranged:
 *                                                  all in order (`flat`), or common
 *                                                  fields visible with the rest under
 *                                                  an `Advanced` disclosure (`tiered`).
 * @return {Object} The rendered context editor.
 */
export function ContextEditor({ context = {}, onChange, layout = "flat" }) {
	// Local drafts for the two sub-objects that have required fields, so a
	// half-filled value survives between field edits without being emitted. Each
	// draft seeds from whatever the incoming context already carries.
	const [tempoDraft, setTempoDraft] = useState(() => ({
		bpm: null,
		beatUnit: undefined,
		...(context.tempo ?? {}),
	}));
	const [timeDraft, setTimeDraft] = useState(() => ({
		beats: null,
		beatType: null,
		...(context.timeSignature ?? {}),
	}));

	/** Apply a tempo-field edit to the draft and emit only its conformant form. */
	const editTempo = (patch) => {
		const draft = { ...tempoDraft, ...patch };
		setTempoDraft(draft);
		onChange(omitEmpty(context, "tempo", projectTempo(draft)));
	};

	/** Apply a time-signature edit to the draft and emit only its conformant form. */
	const editTimeSignature = (patch) => {
		const draft = { ...timeDraft, ...patch };
		setTimeDraft(draft);
		onChange(omitEmpty(context, "timeSignature", projectTimeSignature(draft)));
	};

	// The individual member controls, defined once and arranged differently per
	// layout so both arrangements share the exact same draft/projection/emit wiring.
	const bpmControl = (
		<NumberControl
			label={__("Tempo (BPM)", "piano-block")}
			value={Number.isFinite(tempoDraft.bpm) ? tempoDraft.bpm : ""}
			min={1}
			step={1}
			onChange={(value) => editTempo({ bpm: toBoundedInt(value, 1) })}
			__next40pxDefaultSize
		/>
	);
	const beatUnitControl = (
		<SelectControl
			label={__("Beat unit", "piano-block")}
			value={tempoDraft.beatUnit ?? ""}
			options={[NONE_OPTION, ...DURATIONS]}
			onChange={(value) =>
				editTempo({ beatUnit: value === "" ? undefined : value })
			}
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
	const beatsControl = (
		<NumberControl
			label={__("Beats per measure", "piano-block")}
			value={Number.isInteger(timeDraft.beats) ? timeDraft.beats : ""}
			min={BEATS_MIN}
			step={1}
			onChange={(value) =>
				editTimeSignature({ beats: toBoundedInt(value, BEATS_MIN) })
			}
			__next40pxDefaultSize
		/>
	);
	const beatTypeControl = (
		<SelectControl
			label={__("Beat type", "piano-block")}
			value={timeDraft.beatType ?? ""}
			options={[NONE_OPTION, ...BEAT_TYPES]}
			onChange={(value) =>
				editTimeSignature({ beatType: value === "" ? null : value })
			}
			__nextHasNoMarginBottom
			__next40pxDefaultSize
		/>
	);
	const rightHandControl = (
		<HandConfigEditor
			label={HAND_LABEL.rightHand}
			handConfig={context.rightHand ?? {}}
			onChange={(value) => onChange(omitEmpty(context, "rightHand", value))}
		/>
	);
	const leftHandControl = (
		<HandConfigEditor
			label={HAND_LABEL.leftHand}
			handConfig={context.leftHand ?? {}}
			onChange={(value) => onChange(omitEmpty(context, "leftHand", value))}
		/>
	);

	if (layout === "tiered") {
		return (
			<>
				{bpmControl}
				{beatsControl}
				{beatTypeControl}

				<ToolsPanel
					label={__("Advanced", "piano-block")}
					resetAll={() => {
						// Reset the disclosed members back to absent: drop beatUnit from
						// the tempo and clear both hand configs in one emission.
						setTempoDraft((draft) => ({ ...draft, beatUnit: undefined }));
						const next = { ...context };
						delete next.rightHand;
						delete next.leftHand;
						if (next.tempo) {
							const tempo = { ...next.tempo };
							delete tempo.beatUnit;
							next.tempo = tempo;
						}
						onChange(next);
					}}
				>
					<ToolsPanelItem
						label={__("Beat unit", "piano-block")}
						hasValue={() => Boolean(context.tempo?.beatUnit)}
						onDeselect={() => editTempo({ beatUnit: undefined })}
					>
						{beatUnitControl}
					</ToolsPanelItem>

					<ToolsPanelItem
						label={HAND_LABEL.rightHand}
						hasValue={() =>
							Boolean(context.rightHand) &&
							Object.keys(context.rightHand).length > 0
						}
						onDeselect={() => onChange(omitEmpty(context, "rightHand", {}))}
					>
						{rightHandControl}
					</ToolsPanelItem>

					<ToolsPanelItem
						label={HAND_LABEL.leftHand}
						hasValue={() =>
							Boolean(context.leftHand) &&
							Object.keys(context.leftHand).length > 0
						}
						onDeselect={() => onChange(omitEmpty(context, "leftHand", {}))}
					>
						{leftHandControl}
					</ToolsPanelItem>
				</ToolsPanel>
			</>
		);
	}

	return (
		<>
			{bpmControl}
			{beatUnitControl}

			{beatsControl}
			{beatTypeControl}

			{rightHandControl}
			{leftHandControl}
		</>
	);
}
