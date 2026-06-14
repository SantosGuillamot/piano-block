<?php
/**
 * Server-rendered output for the Piano block (dynamic block, route B).
 *
 * Emits a single childless `data-wp-interactive` wrapper that seeds the raw song
 * string and a server-computed accessible name into per-instance `data-wp-context`.
 * The view module (`view.js`, registered as a `viewScriptModule`) reads song and
 * accessibleName from context, validates the song client-side, and draws the SVG.
 *
 * Context transport (route B): `wp_interactivity_data_wp_context()` encodes the
 * context object via `wp_json_encode( …, JSON_HEX_TAG | JSON_HEX_APOS |
 * JSON_HEX_QUOT | JSON_HEX_AMP )` — a superset of the old hand-rolled `<` escape —
 * so no manual escaping of the song string is needed here. The inert `<script>`
 * carrier and `str_replace( '<', '<', $song )` are both gone.
 *
 * Accessible name: computed here by `piano_block_accessible_name()`, a faithful
 * PHP mirror of `src/song/accessibleName.js`'s four branches (same text domain
 * `'piano-block'`, same `_x` context `'sheet music label'`, same placeholder
 * syntax). The JSON decode performed here is only to read `metadata.title` /
 * `metadata.composer`; it does NOT gate rendering — the render-or-nothing
 * decision stays 100% client-side (R6).
 *
 * When `song` is empty, unset, or whitespace-only, the block outputs nothing at
 * all (no wrapper) — the "no song" state (R6/AC6).
 *
 * Exposed variables: $attributes (array), $content (string), $block (WP_Block).
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#render
 */

if ( ! function_exists( 'piano_block_accessible_name' ) ) {
	/**
	 * Server-side mirror of `src/song/accessibleName.js`'s four-branch logic.
	 *
	 * A metadata string counts only when non-empty after trim. The non-author
	 * strings are i18n-wrapped; the title-only case is the author's own text and
	 * is passed through verbatim with no wrapper.
	 *
	 * @param array $metadata Decoded `metadata` object from the song JSON, or [].
	 * @return string The accessible name for the `<svg>` element's `<title>`.
	 */
	function piano_block_accessible_name( $metadata ) {
		$title    = is_string( $metadata['title'] ?? null ) ? trim( $metadata['title'] ) : '';
		$composer = is_string( $metadata['composer'] ?? null ) ? trim( $metadata['composer'] ) : '';

		if ( '' !== $title && '' !== $composer ) {
			/* translators: 1: song title, 2: composer name. */
			return sprintf( _x( '%1$s by %2$s', 'sheet music label', 'piano-block' ), $title, $composer );
		}
		if ( '' !== $title ) {
			return $title; // Author's own title — no wrapper (verbatim branch).
		}
		if ( '' !== $composer ) {
			/* translators: %s: composer name. */
			return sprintf( _x( 'Piano sheet music by %s', 'sheet music label', 'piano-block' ), $composer );
		}
		return __( 'Piano sheet music', 'piano-block' );
	}
}

$song = isset( $attributes['song'] ) ? (string) $attributes['song'] : '';

if ( '' === trim( $song ) ) {
	return; // Empty / no song -> output nothing (no wrapper).
}

// Decode only to read metadata for the accessible name; never gates rendering.
$decoded    = json_decode( $song, true );
$metadata   = is_array( $decoded ) && isset( $decoded['metadata'] ) && is_array( $decoded['metadata'] ) ? $decoded['metadata'] : array();
$accessible_name = piano_block_accessible_name( $metadata );

$context = array(
	'song'          => $song,
	'accessibleName' => $accessible_name,
);
?>
<div data-wp-interactive="piano-block/piano" <?php echo wp_interactivity_data_wp_context( $context ); ?> data-wp-init="callbacks.init" <?php echo get_block_wrapper_attributes(); ?>></div>
