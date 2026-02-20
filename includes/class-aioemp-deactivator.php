<?php
/**
 * Plugin deactivation handler.
 *
 * Revokes custom capabilities. Does NOT drop tables — that would
 * be an uninstall action, not deactivation.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Deactivator {

    /**
     * Run on plugin deactivation.
     */
    public static function deactivate(): void {
        AIOEMP_Security::revoke_capabilities();
        flush_rewrite_rules( false );
    }
}
