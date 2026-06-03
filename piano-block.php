<?php
/**
 * Plugin Name:       Piano Block
 * Plugin URI:        https://github.com/SantosGuillamot/piano-block
 * Description:        Registers the Piano block — a scaffold for a future interactive piano.
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
 * Registers the Piano block from its compiled block.json metadata.
 *
 * The block is built with @wordpress/scripts; run `npm run build` to generate
 * the build/ directory this points at.
 */
function piano_block_register() {
	register_block_type( __DIR__ . '/build' );
}
add_action( 'init', 'piano_block_register' );
