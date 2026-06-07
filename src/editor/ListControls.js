/**
 * The single reusable control bank every editable list reuses for add, remove
 * and reorder.
 *
 * The editor is built from many lists — sections, measures, events, pitches,
 * annotations — that all need the same affordances: nudge a row up or down, drop
 * a row, and append a new one. Rather than reinvent those buttons per list (and
 * risk inconsistent labels, disabled edges or keyboard behavior), every list
 * renders this one bank. `ListControls` is the per-row trio (move up / move down
 * / remove); `AddButton` is the standalone append affordance, kept separate so a
 * list can place "add" at its end independently of any row's controls.
 *
 * Reordering is keyboard-driven by design — the move buttons are ordinary
 * focusable `Button`s, with no drag-and-drop — so the whole editor stays usable
 * from the keyboard alone.
 *
 * These components hold no business logic. They compute only which buttons are
 * disabled at the list's edges (and when a required minimum forbids removal);
 * the parent owns the song state and passes the handlers that actually mutate
 * it.
 */
import { Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

/**
 * The per-row move/remove control bank.
 *
 * Move-up is disabled on the first row, move-down on the last row, and remove
 * when `canRemove` is false (a caller protects a required minimum — e.g. the
 * last pitch of a note — by passing `canRemove={false}`). Accessible labels
 * default to "Move up" / "Move down" / "Remove" but accept per-call overrides so
 * a more specific phrasing (e.g. "Remove note") can read well in context.
 *
 * @param {Object}   props
 * @param {number}   props.index            This row's position in its list.
 * @param {number}   props.count            The list's length.
 * @param {Function} props.onMoveUp         Called to move this row up one place.
 * @param {Function} props.onMoveDown       Called to move this row down one place.
 * @param {Function} props.onRemove         Called to remove this row.
 * @param {string}   [props.moveUpLabel]    Accessible label for the move-up button.
 * @param {string}   [props.moveDownLabel]  Accessible label for the move-down button.
 * @param {string}   [props.removeLabel]    Accessible label for the remove button.
 * @param {boolean}  [props.canRemove=true] Whether removal is allowed.
 * @return {Object} The rendered control bank.
 */
export function ListControls({
	index,
	count,
	onMoveUp,
	onMoveDown,
	onRemove,
	moveUpLabel = __("Move up", "piano-block"),
	moveDownLabel = __("Move down", "piano-block"),
	removeLabel = __("Remove", "piano-block"),
	canRemove = true,
}) {
	return (
		<>
			<Button
				icon="arrow-up-alt2"
				label={moveUpLabel}
				onClick={onMoveUp}
				disabled={index === 0}
			/>
			<Button
				icon="arrow-down-alt2"
				label={moveDownLabel}
				onClick={onMoveDown}
				disabled={index === count - 1}
			/>
			<Button
				icon="trash"
				label={removeLabel}
				onClick={onRemove}
				disabled={!canRemove}
			/>
		</>
	);
}

/**
 * The standalone "add" affordance a list places at its end to append a new item.
 *
 * @param {Object}   props
 * @param {Function} props.onClick Called to append a new item.
 * @param {string}   props.label   The button's visible and accessible label.
 * @return {Object} The rendered add button.
 */
export function AddButton({ onClick, label }) {
	return (
		<Button variant="secondary" icon="plus" label={label} onClick={onClick}>
			{label}
		</Button>
	);
}
