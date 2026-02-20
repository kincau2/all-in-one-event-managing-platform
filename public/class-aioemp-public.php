<?php
/**
 * Public-facing functionality — shortcodes, asset enqueue.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Public {

    /**
     * Enqueue public styles.
     */
    public function enqueue_styles(): void {
        // Only enqueue when our shortcode / block is present (checked later).
        // For now, register so it can be enqueued on demand.
        wp_register_style(
            'aioemp-public',
            AIOEMP_PLUGIN_URL . 'public/css/aioemp-public.css',
            array(),
            AIOEMP_VERSION
        );
    }

    /**
     * Enqueue public scripts.
     */
    public function enqueue_scripts(): void {
        wp_register_script(
            'aioemp-public',
            AIOEMP_PLUGIN_URL . 'public/js/aioemp-public.js',
            array(),
            AIOEMP_VERSION,
            true
        );
    }
}
