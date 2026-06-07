/**
 * The visual editor's empty state — what the author sees when the block carries
 * no song yet.
 *
 * A brand-new block has an empty `song` string, which is neither conformant nor
 * something the structured editor can edit. Rather than asking the author to type
 * raw JSON, this state offers a single affordance that seeds the minimal
 * conformant song (`newSong()`) — one section with one empty measure — so the
 * block jumps straight from empty to a song the structured editor can take over.
 * The author then begins adding content with the visual controls; no raw JSON is
 * ever required.
 *
 * The seeding is serialized here (`JSON.stringify(newSong())`) and handed up
 * through `onStart`; the parent persists it as the new `song` string.
 */
import { Button } from "@wordpress/components";
import { __ } from "@wordpress/i18n";
import { newSong } from "./songModel.js";

/**
 * Render the empty state.
 *
 * @param {Object}   props
 * @param {Function} props.onStart Called with the serialized minimal song string
 *                                 when the author starts a new song.
 * @return {Object} The rendered empty state.
 */
export function EmptyState({ onStart }) {
	return (
		<div>
			<p>
				{__(
					"This block has no song yet. Start one to begin adding sections, measures and notes.",
					"piano-block",
				)}
			</p>
			<Button
				variant="primary"
				onClick={() => onStart(JSON.stringify(newSong()))}
			>
				{__("Start a new song", "piano-block")}
			</Button>
		</div>
	);
}
