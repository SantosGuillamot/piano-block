<?php
/**
 * Server-rendered output for the Piano block (dynamic block).
 *
 * Emits the stored song as a verbatim, escaped passthrough: the raw `song`
 * string is output unchanged inside a <pre> via esc_html(), so any markup or
 * script renders as inert text (no XSS) and the author's own whitespace is
 * preserved. Nothing is parsed, validated, or re-serialized. When `song` is
 * empty, unset, or whitespace-only, the block outputs nothing at all.
 *
 * Exposed variables: $attributes (array), $content (string), $block (WP_Block).
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#render
 */

$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';

if ( '' === trim( $song ) ) {
	return; // Empty / no song → output nothing meaningful.
}
?>
<pre <?php echo get_block_wrapper_attributes(); ?>><?php echo esc_html( $song ); ?></pre>
