/**
 * The always-present **Song** inspector panel.
 *
 * Rendered inside `InspectorControls` regardless of selection, this is the
 * song-level settings panel: the song's optional `metadata` (title/composer) and
 * its `defaults` context. The common context fields — the tempo bpm and the time
 * signature — are visible directly; the uncommon ones — the tempo's `beatUnit`
 * and each hand's `handConfig` — hide behind a `ToolsPanel` so the panel stays
 * shallow but reaches the whole `defaults` model (Req 5, 7, 8; AC5, AC10).
 *
 * The panel is a pure controlled component: it holds no song state and emits the
 * next whole working `song` through `onChange` (the parent commits it). It reuses
 * the existing constrained leaf editors — `MetadataEditor`, `HandConfigEditor` —
 * and reproduces only `ContextEditor`'s small draft/projection for the two
 * required-field sub-objects (`tempo`, `timeSignature`), so each is emitted only
 * when complete and never half-filled. Composing the leaf controls directly is
 * what lets the panel split `defaults` into a common set and a disclosed set
 * without changing `ContextEditor`'s monolithic emit contract.
 *
 * Every control is one of the bounded leaf editors or a closed-vocabulary select,
 * so the panel is conformant by construction.
 */
import {
	__experimentalNumberControl as NumberControl,
	PanelBody,
	SelectControl,
	__experimentalToolsPanel as ToolsPanel,
	__experimentalToolsPanelItem as ToolsPanelItem,
} from "@wordpress/components";
import { useState } from "@wordpress/element";
import { __ } from "@wordpress/i18n";
import { HandConfigEditor } from "../HandConfigEditor.js";
import { MetadataEditor } from "../MetadataEditor.js";
import { BEAT_TYPES, BEATS_MIN, DURATIONS } from "../songModel.js";
import { emitBlock } from "./emit.js";

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
 * Rebuild `defaults` from a single member edit, omitting any member that has no
 * set fields so the emitted context carries only what the author has set, then
 * emit the next whole `song` (dropping `defaults` when it empties).
 *
 * @param {Object}   song     The current song object.
 * @param {Object}   context  The current `defaults` context.
 * @param {string}   key      The member being set (`tempo`, `rightHand`, …).
 * @param {?Object}  value    The member's next value, or empty to drop it.
 * @param {Function} onChange Receives the next song object.
 */
function emitContextMember(song, context, key, value, onChange) {
	const next = { ...context };
	if (value && Object.keys(value).length > 0) {
		next[key] = value;
	} else {
		delete next[key];
	}
	emitBlock(song, "defaults", next, onChange);
}

/**
 * The always-present Song-level settings panel.
 *
 * @param {Object}              props
 * @param {Object}              props.song     The current working song object.
 * @param {"english"|"spanish"} props.system   The per-song note-name system.
 * @param {Function}            props.onChange Receives the next working song.
 * @return {Object} The rendered Song panel.
 */
export function SongPanel({ song, system: _system, onChange }) {
	const context = song.defaults ?? {};

	// Local drafts for the two sub-objects with required fields, so a half-filled
	// value survives between field edits without being emitted. Each draft seeds
	// from whatever `defaults` already carries — mirroring `ContextEditor`.
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
		emitContextMember(song, context, "tempo", projectTempo(draft), onChange);
	};

	/** Apply a time-signature edit to the draft and emit only its conformant form. */
	const editTimeSignature = (patch) => {
		const draft = { ...timeDraft, ...patch };
		setTimeDraft(draft);
		emitContextMember(
			song,
			context,
			"timeSignature",
			projectTimeSignature(draft),
			onChange,
		);
	};

	return (
		<PanelBody title={__("Song", "piano-block")} initialOpen>
			<MetadataEditor
				metadata={song.metadata}
				onChange={(metadata) => emitBlock(song, "metadata", metadata, onChange)}
			/>

			<NumberControl
				label={__("Tempo (BPM)", "piano-block")}
				value={Number.isFinite(tempoDraft.bpm) ? tempoDraft.bpm : ""}
				min={1}
				step={1}
				onChange={(value) => editTempo({ bpm: toBoundedInt(value, 1) })}
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
					emitBlock(song, "defaults", next, onChange);
				}}
			>
				<ToolsPanelItem
					label={__("Beat unit", "piano-block")}
					hasValue={() => Boolean(context.tempo?.beatUnit)}
					onDeselect={() => editTempo({ beatUnit: undefined })}
				>
					<SelectControl
						label={__("Beat unit", "piano-block")}
						value={tempoDraft.beatUnit ?? ""}
						options={[
							{ label: __("—", "piano-block"), value: "" },
							...DURATIONS,
						]}
						onChange={(value) =>
							editTempo({ beatUnit: value === "" ? undefined : value })
						}
						__nextHasNoMarginBottom
					/>
				</ToolsPanelItem>

				<ToolsPanelItem
					label={__("Right hand", "piano-block")}
					hasValue={() =>
						Boolean(context.rightHand) &&
						Object.keys(context.rightHand).length > 0
					}
					onDeselect={() =>
						emitContextMember(song, context, "rightHand", {}, onChange)
					}
				>
					<HandConfigEditor
						label={__("Right hand", "piano-block")}
						handConfig={context.rightHand ?? {}}
						onChange={(value) =>
							emitContextMember(song, context, "rightHand", value, onChange)
						}
					/>
				</ToolsPanelItem>

				<ToolsPanelItem
					label={__("Left hand", "piano-block")}
					hasValue={() =>
						Boolean(context.leftHand) &&
						Object.keys(context.leftHand).length > 0
					}
					onDeselect={() =>
						emitContextMember(song, context, "leftHand", {}, onChange)
					}
				>
					<HandConfigEditor
						label={__("Left hand", "piano-block")}
						handConfig={context.leftHand ?? {}}
						onChange={(value) =>
							emitContextMember(song, context, "leftHand", value, onChange)
						}
					/>
				</ToolsPanelItem>
			</ToolsPanel>
		</PanelBody>
	);
}
