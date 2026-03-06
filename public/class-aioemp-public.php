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
        // Always enqueue on the public side so the login overlay styles are
        // available immediately in <head> — not deferred to wp_footer().
        wp_enqueue_style(
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

    /*--------------------------------------------------------------
     * Login redirect for AIOEMP-role users
     *------------------------------------------------------------*/

    /**
     * Redirect non-administrator AIOEMP-role users to the AIOEMP dashboard
     * after logging in through the standard WordPress login form.
     *
     * Hooked to the `login_redirect` filter (priority 10, 3 args).
     *
     * @param string   $redirect_to           The default redirect URL.
     * @param string   $requested_redirect_to The URL requested by the login form.
     * @param \WP_User|\WP_Error $user        The authenticated user (or error).
     * @return string  Modified redirect URL.
     */
    public function aioemp_login_redirect( string $redirect_to, string $requested_redirect_to, $user ): string {
        // If authentication failed, don't interfere.
        if ( ! ( $user instanceof \WP_User ) ) {
            return $redirect_to;
        }

        // Administrators keep their default redirect.
        if ( in_array( 'administrator', $user->roles, true ) ) {
            return $redirect_to;
        }

        // If the user has an AIOEMP role, redirect to the dashboard.
        $aioemp_roles = array_keys( AIOEMP_Security::ROLES );
        if ( ! empty( array_intersect( $user->roles, $aioemp_roles ) ) ) {
            return admin_url( 'admin.php?page=aioemp-dashboard' );
        }

        return $redirect_to;
    }
}
