<?php
/**
 * Shared security helpers used across all AIOEMP modules.
 *
 * Provides a central place for capability definitions, nonce helpers,
 * input sanitisation utilities, and rate-limiting so every controller
 * enforces rules consistently.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Security {

    /*--------------------------------------------------------------
     * Custom Capabilities
     *------------------------------------------------------------*/

    /**
     * Map of custom capabilities used by the plugin.
     *
     * @var string[]
     */
    public const CAPS = array(
        'manage_events'   => 'aioemp_manage_events',
        'manage_seatmaps' => 'aioemp_manage_seatmaps',
        'manage_settings' => 'aioemp_manage_settings',
        'scan_attendance' => 'aioemp_scan_attendance',
    );

    /**
     * Roles that receive ALL custom capabilities on activation.
     *
     * @var string[]
     */
    private const ADMIN_ROLES = array( 'administrator' );

    /**
     * Grant all custom capabilities to admin roles.
     *
     * Called once during plugin activation.
     */
    public static function grant_capabilities(): void {
        foreach ( self::ADMIN_ROLES as $role_slug ) {
            $role = get_role( $role_slug );
            if ( null === $role ) {
                continue;
            }
            foreach ( self::CAPS as $cap ) {
                $role->add_cap( $cap );
            }
        }
    }

    /**
     * Remove all custom capabilities from every role.
     *
     * Called during plugin deactivation.
     */
    public static function revoke_capabilities(): void {
        global $wp_roles;

        if ( ! isset( $wp_roles ) ) {
            $wp_roles = new WP_Roles(); // @codingStandardsIgnoreLine
        }

        foreach ( $wp_roles->roles as $role_slug => $role_details ) {
            $role = get_role( $role_slug );
            if ( null === $role ) {
                continue;
            }
            foreach ( self::CAPS as $cap ) {
                $role->remove_cap( $cap );
            }
        }
    }

    /*--------------------------------------------------------------
     * Nonce helpers
     *------------------------------------------------------------*/

    /**
     * Create an action-scoped nonce.
     *
     * @param string     $action   Base action name (e.g. 'save_event').
     * @param int|string $resource Optional resource ID to make the nonce resource-specific.
     * @return string
     */
    public static function create_nonce( string $action, $resource = '' ): string {
        $nonce_action = 'aioemp_' . $action;
        if ( '' !== $resource ) {
            $nonce_action .= '_' . $resource;
        }
        return wp_create_nonce( $nonce_action );
    }

    /**
     * Verify an action-scoped nonce.  Returns false on failure.
     *
     * @param string     $nonce    The nonce value from the request.
     * @param string     $action   Base action name.
     * @param int|string $resource Optional resource ID.
     * @return bool
     */
    public static function verify_nonce( string $nonce, string $action, $resource = '' ): bool {
        $nonce_action = 'aioemp_' . $action;
        if ( '' !== $resource ) {
            $nonce_action .= '_' . $resource;
        }
        return false !== wp_verify_nonce( $nonce, $nonce_action );
    }

    /*--------------------------------------------------------------
     * Capability checks (convenience wrappers)
     *------------------------------------------------------------*/

    /**
     * Check that the current user has a specific AIOEMP capability.
     *
     * @param string $cap_key Key from self::CAPS (e.g. 'manage_events').
     * @return bool
     */
    public static function current_user_can( string $cap_key ): bool {
        if ( ! isset( self::CAPS[ $cap_key ] ) ) {
            return false;
        }
        return current_user_can( self::CAPS[ $cap_key ] );
    }

    /**
     * Abort with WP_Error (for REST) if the user lacks a capability.
     *
     * @param string $cap_key Key from self::CAPS.
     * @return true|\WP_Error
     */
    public static function require_cap( string $cap_key ) {
        if ( self::current_user_can( $cap_key ) ) {
            return true;
        }
        return new WP_Error(
            'aioemp_forbidden',
            __( 'You do not have permission to perform this action.', 'aioemp' ),
            array( 'status' => 403 )
        );
    }

    /*--------------------------------------------------------------
     * Input sanitisation helpers
     *------------------------------------------------------------*/

    /**
     * Sanitise a string and enforce max length.
     *
     * @param mixed $value     Raw input.
     * @param int   $max_length Maximum character length.
     * @return string
     */
    public static function sanitize_text( $value, int $max_length = 255 ): string {
        $clean = sanitize_text_field( (string) $value );
        if ( mb_strlen( $clean ) > $max_length ) {
            $clean = mb_substr( $clean, 0, $max_length );
        }
        return $clean;
    }

    /**
     * Sanitise an email and enforce max length.
     *
     * @param mixed $value     Raw input.
     * @param int   $max_length Maximum character length.
     * @return string Empty string if invalid.
     */
    public static function sanitize_email( $value, int $max_length = 190 ): string {
        $clean = sanitize_email( (string) $value );
        if ( mb_strlen( $clean ) > $max_length ) {
            return '';
        }
        return $clean;
    }

    /**
     * Validate a value against an explicit allowlist.
     *
     * @param mixed    $value   The value to check.
     * @param string[] $allowed Allowed values.
     * @param mixed    $default Default if not in allowlist.
     * @return mixed
     */
    public static function allowlist( $value, array $allowed, $default = null ) {
        return in_array( $value, $allowed, true ) ? $value : $default;
    }

    /**
     * Validate and sanitise a positive integer.
     *
     * @param mixed $value Raw input.
     * @return int 0 if invalid.
     */
    public static function absint( $value ): int {
        return absint( $value );
    }

    /**
     * Decode and basic-validate a JSON string.
     *
     * @param string $json Raw JSON.
     * @return array|null Decoded array, or null on failure.
     */
    public static function decode_json( string $json ): ?array {
        $data = json_decode( $json, true );
        if ( ! is_array( $data ) ) {
            return null;
        }
        return $data;
    }

    /*--------------------------------------------------------------
     * Rate limiting (transient-based)
     *------------------------------------------------------------*/

    /**
     * Check / increment a rate-limit counter.
     *
     * @param string $key        Unique rate-limit key (e.g. "reg_{event_id}_{ip}").
     * @param int    $max_hits   Maximum allowed hits within the window.
     * @param int    $window_sec Window duration in seconds.
     * @return bool  True if the request is ALLOWED; false if rate-limited.
     */
    public static function rate_limit_check( string $key, int $max_hits = 10, int $window_sec = 60 ): bool {
        $transient_key = 'aioemp_rl_' . md5( $key );

        $current = (int) get_transient( $transient_key );

        if ( $current >= $max_hits ) {
            return false; // Rate limited.
        }

        set_transient( $transient_key, $current + 1, $window_sec );
        return true;
    }

    /*--------------------------------------------------------------
     * Output escaping reminder (documentation-only)
     *------------------------------------------------------------*/
    // All output MUST be escaped at the template level using esc_html(),
    // esc_attr(), esc_url(), wp_kses_post(), or wp_json_encode().
    // This class does NOT provide an "echo" wrapper — controllers and
    // views are responsible for escaping at the point of output.

    /*--------------------------------------------------------------
     * Security headers
     *------------------------------------------------------------*/

    /**
     * Send security headers for admin SPA pages.
     *
     * Call from the admin page render callback before any output.
     */
    public static function send_security_headers(): void {
        if ( headers_sent() ) {
            return;
        }
        header( 'X-Content-Type-Options: nosniff' );
        header( 'X-Frame-Options: SAMEORIGIN' );
        header( 'Referrer-Policy: strict-origin-when-cross-origin' );
    }

    /*--------------------------------------------------------------
     * Client IP helper (rate-limiting)
     *------------------------------------------------------------*/

    /**
     * Get the client IP address.
     *
     * @return string
     */
    public static function get_client_ip(): string {
        // Prefer REMOTE_ADDR to avoid spoofing via X-Forwarded-For.
        // If behind a trusted reverse proxy, this should be configured
        // at the server/platform level, not in application code.
        $ip = isset( $_SERVER['REMOTE_ADDR'] ) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
        return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '0.0.0.0';
    }
}
