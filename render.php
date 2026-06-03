<?php
/**
 * Server-rendered output for the Piano block (dynamic block).
 *
 * Exposed variables: $attributes (array), $content (string), $block (WP_Block).
 *
 * @see https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/#render
 */
?>
<p <?php echo get_block_wrapper_attributes(); ?>>
	<?php esc_html_e( 'Piano block — front-end placeholder', 'piano-block' ); ?>
</p>
