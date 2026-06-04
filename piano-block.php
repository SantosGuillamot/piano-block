<?php
/**
 * Plugin Name:       Piano Block
 * Plugin URI:        https://github.com/SantosGuillamot/piano-block
 * Description:        Registers the Piano block — stores a piano song (both hands of a grand staff) as structured JSON.
 * Version:           0.1.0
 * Requires at least: 6.9
 * Requires PHP:      7.4
 * Author:            Mario Santos
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       piano-block
 *
 * @package PianoBlock
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers the Piano block from its compiled block.json metadata and loads the
 * frontend viewScript's translations.
 *
 * The block is built with @wordpress/scripts; run `npm run build` to generate
 * the build/ directory this points at. `wp_set_script_translations()` lets the
 * accessible-label strings in view.js localize (the auto-generated viewScript handle
 * is `piano-block-piano-view-script`); English works without translation files.
 */
function piano_block_register() {
	register_block_type( __DIR__ . '/build' );
	wp_set_script_translations(
		'piano-block-piano-view-script',
		'piano-block',
		__DIR__ . '/languages'
	);
}
add_action( 'init', 'piano_block_register' );
