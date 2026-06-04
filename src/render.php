<?php
/**
 * Server-rendered output for the Piano block (dynamic block).
 *
 * Emits a lightweight container that carries the stored song to the frontend; the
 * `viewScript` (`view.js`) draws the sheet music in the browser. The raw `song`
 * string is placed verbatim inside an INERT `application/json` <script> (never
 * executed, read as plain text by `view.js`), so PHP performs NO parsing,
 * validation, or re-serialization — `view.js` owns the render-or-nothing decision.
 *
 * Script-breakout escaping: inside a raw-text <script> element the HTML parser
 * scans for the ETAGO sequence `</` (and the comment-open `<!--`) regardless of JSON
 * quoting, so a song carrying a literal `</script>` or `<!--` (e.g. in a chordSymbol
 * or metadata.title) could break out of the element. We escape the leading `<` of
 * every such sequence as the JSON unicode escape `<` (a blanket `<` -> `<`
 * is the simplest valid form). `<` is a legal JSON escape for `<`, so
 * `JSON.parse` decodes it back to the EXACT author bytes while the HTML parser never
 * sees a literal `</` or `<!--`. We deliberately do NOT use esc_html/htmlspecialchars
 * (raw-text <script> does not decode HTML entities, so `&lt;` would break JSON.parse)
 * and NOT `<\/` / `<\!--` (`\!` is invalid JSON and would throw on a conformant song).
 *
 * When `song` is empty, unset, or whitespace-only, the block outputs nothing at all
 * (no container) — the "no song" state.
 *
 * Exposed variables: $attributes (array), $content (string), $block (WP_Block).
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#render
 */

$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';

if ( '' === trim( $song ) ) {
	return; // Empty / no song -> output nothing meaningful (no container).
}

// Neutralize both ETAGO (`</`) and comment-open (`<!--`) breakout sequences at once
// by escaping every `<` to the 6-character JSON unicode escape; JSON.parse restores
// the exact author bytes on the frontend.
$escaped_song = str_replace( '<', '\u003C', $song );
?>
<div <?php echo get_block_wrapper_attributes(); ?>><script type="application/json" class="wp-block-piano-block-piano__song"><?php echo $escaped_song; ?></script></div>
