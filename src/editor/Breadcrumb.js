/**
 * The breadcrumb trail tying the drill-down editors together — "Song / Section 2
 * / Measure 3" rendered as a row of buttons that jump back up the navigation
 * stack.
 *
 * The structural editor is a stack of views (song → section → measure → event),
 * and this trail is how the author walks back up it. It is deliberately
 * pure/presentational: it owns no navigation state and does not know how deep the
 * stack is — it simply renders one button per `trail` entry and calls
 * `onNavigate(level)` with the entry's index when clicked. The SongEditor owns
 * the navigation stack: it builds the `trail` labels and, on `onNavigate`,
 * truncates the stack to that level.
 *
 * The last entry is the current view, so it is rendered non-interactive (a plain
 * span) — there is nowhere to navigate when you are already there.
 */

/**
 * Render the navigation trail.
 *
 * @param {Object}   props
 * @param {string[]} props.trail      The ordered crumb labels, root first; the
 *                                    last is the current view.
 * @param {Function} props.onNavigate Called with a crumb's level (its index in
 *                                    `trail`) when an earlier crumb is clicked.
 * @return {Object} The rendered breadcrumb.
 */
export function Breadcrumb({ trail, onNavigate }) {
	return (
		<nav>
			{trail.map((label, level) => {
				const isCurrent = level === trail.length - 1;
				return (
					// Crumbs have no stable identity beyond their position, so the level
					// is the key; the trail is short and rebuilt on every navigation.
					<span key={level}>
						{level > 0 ? " / " : null}
						{isCurrent ? (
							<span aria-current="page">{label}</span>
						) : (
							<button type="button" onClick={() => onNavigate?.(level)}>
								{label}
							</button>
						)}
					</span>
				);
			})}
		</nav>
	);
}
