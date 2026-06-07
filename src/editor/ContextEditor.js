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
 */
import {
	__experimentalNumberControl as NumberControl,
	SelectControl,
} from "@wordpress/components";
import { useState } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { HandConfigEditor } from "./HandConfigEditor.js";
import { BEAT_TYPES, BEATS_MIN, DURATIONS } from "./songModel.js";

/**
 * Emit a context object rebuilt from a single member edit, omitting any member
 * that has no set fields so the emitted context carries only what the author has
 * actually set.
 *
 * @param {Object}   context  The current context object.
 * @param {string}   key      The member being set (`tempo`, `timeSignature`, …).
 * @param {?Object}  value    The member's next value, or `undefined`/empty to drop it.
 * @param {Function} onChange Receives the rebuilt context object.
 */
function emitMember(context, key, value, onChange) {
	const next = { ...context };
	if (value && Object.keys(value).length > 0) {
		next[key] = value;
	} else {
		delete next[key];
	}
	onChange(next);
}

/** Parse a numeric-input string to a finite number, or `null` when empty/invalid. */
function toNumber(raw) {
	if (raw === "" || raw === null || raw === undefined) {
		return null;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : null;
}

/** Parse a numeric-input string to an integer ≥ `min`, or `null` when empty. */
function toBoundedInt(raw, min) {
	const parsed = toNumber(raw);
	if (parsed === null) {
		return null;
	}
	return Math.max(min, Math.round(parsed));
}

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
 * @param {Object}   props
 * @param {Object}   [props.context={}] The current context object.
 * @param {Function} props.onChange     Receives the next context object.
 * @param {string}   [props.heading]    An optional heading for the group.
 * @return {Object} The rendered context editor.
 */
export function ContextEditor({ context = {}, onChange, heading }) {
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
		emitMember(context, "tempo", projectTempo(draft), onChange);
	};

	/** Apply a time-signature edit to the draft and emit only its conformant form. */
	const editTimeSignature = (patch) => {
		const draft = { ...timeDraft, ...patch };
		setTimeDraft(draft);
		emitMember(context, "timeSignature", projectTimeSignature(draft), onChange);
	};

	return (
		<>
			{heading ? <h3>{heading}</h3> : null}

			<NumberControl
				label={__("Tempo (BPM)", "piano-block")}
				value={Number.isFinite(tempoDraft.bpm) ? tempoDraft.bpm : ""}
				min={1}
				step={1}
				onChange={(value) => editTempo({ bpm: toBoundedInt(value, 1) })}
				__nextHasNoMarginBottom
			/>
			<SelectControl
				label={__("Beat unit", "piano-block")}
				value={tempoDraft.beatUnit ?? ""}
				options={[{ label: __("—", "piano-block"), value: "" }, ...DURATIONS]}
				onChange={(value) =>
					editTempo({ beatUnit: value === "" ? undefined : value })
				}
				__nextHasNoMarginBottom
			/>

			<NumberControl
				label={__("Beats per measure", "piano-block")}
				value={Number.isInteger(timeDraft.beats) ? timeDraft.beats : ""}
				min={BEATS_MIN}
				step={1}
				onChange={(value) =>
					editTimeSignature({ beats: toBoundedInt(value, BEATS_MIN) })
				}
				__nextHasNoMarginBottom
			/>
			<SelectControl
				label={__("Beat type", "piano-block")}
				value={timeDraft.beatType ?? ""}
				options={[{ label: __("—", "piano-block"), value: "" }, ...BEAT_TYPES]}
				onChange={(value) =>
					editTimeSignature({ beatType: value === "" ? null : value })
				}
				__nextHasNoMarginBottom
			/>

			<HandConfigEditor
				label={__("Right hand", "piano-block")}
				handConfig={context.rightHand ?? {}}
				onChange={(value) => emitMember(context, "rightHand", value, onChange)}
			/>
			<HandConfigEditor
				label={__("Left hand", "piano-block")}
				handConfig={context.leftHand ?? {}}
				onChange={(value) => emitMember(context, "leftHand", value, onChange)}
			/>
		</>
	);
}
