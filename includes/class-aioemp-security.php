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
        'access_plugin'      => 'aioemp_access_plugin',
        'view_events'        => 'aioemp_view_events',
        'manage_events'      => 'aioemp_manage_events',
        'view_candidates'    => 'aioemp_view_candidates',
        'manage_candidates'  => 'aioemp_manage_candidates',
        'view_attendance'    => 'aioemp_view_attendance',
        'manage_attendance'  => 'aioemp_manage_attendance',
        'manage_seating'     => 'aioemp_manage_seating',
        'view_seatmaps'      => 'aioemp_view_seatmaps',
        'manage_seatmaps'    => 'aioemp_manage_seatmaps',
        'manage_settings'    => 'aioemp_manage_settings',
        'scan_attendance'    => 'aioemp_scan_attendance',
        'view_reports'       => 'aioemp_view_reports',
    );

    /**
     * Human-readable labels for each capability key.
     */
    public const CAP_LABELS = array(
        'access_plugin'     => 'Access Plugin',
        'view_events'       => 'View Events',
        'manage_events'     => 'Manage Events',
        'view_candidates'   => 'View Candidates',
        'manage_candidates' => 'Manage Candidates',
        'view_attendance'   => 'View Attendance',
        'manage_attendance' => 'Manage Attendance',
        'manage_seating'    => 'Manage Seating',
        'view_seatmaps'     => 'View Seatmaps',
        'manage_seatmaps'   => 'Manage Seatmaps',
        'manage_settings'   => 'Manage Settings',
        'scan_attendance'   => 'Scan Attendance',
        'view_reports'      => 'View Reports',
    );

    /**
     * Custom AIOEMP roles and the capability keys each one receives.
     *
     * Keys   = role slug (prefixed with 'aioemp_').
     * Values = array of keys from self::CAPS.
     *
     * @var array<string, array{label: string, caps: string[]}>
     */
    public const ROLES = array(
        'aioemp_admin' => array(
            'label' => 'AIOEMP Admin',
            'caps'  => array(
                'access_plugin', 'view_events', 'manage_events',
                'view_candidates', 'manage_candidates',
                'view_attendance', 'manage_attendance',
                'manage_seating',
                'view_seatmaps', 'manage_seatmaps', 'manage_settings',
                'scan_attendance', 'view_reports',
            ),
        ),
        'aioemp_event_manager' => array(
            'label' => 'AIOEMP Event Manager',
            'caps'  => array(
                'access_plugin', 'view_events', 'manage_events',
                'view_candidates', 'manage_candidates',
                'view_attendance', 'manage_attendance',
                'manage_seating',
                'view_seatmaps', 'scan_attendance', 'view_reports',
            ),
        ),
        'aioemp_seating_coordinator' => array(
            'label' => 'AIOEMP Seating Coordinator',
            'caps'  => array(
                'access_plugin', 'view_events',
                'view_candidates',
                'manage_seating',
            ),
        ),
        'aioemp_seatmap_designer' => array(
            'label' => 'AIOEMP Seatmap Designer',
            'caps'  => array(
                'access_plugin', 'view_seatmaps', 'manage_seatmaps',
            ),
        ),
        'aioemp_scanner' => array(
            'label' => 'AIOEMP Scanner Operator',
            'caps'  => array(
                'access_plugin', 'view_events', 'scan_attendance',
            ),
        ),
    );

    /**
     * WordPress roles that receive ALL custom capabilities on activation.
     *
     * @var string[]
     */
    private const ADMIN_ROLES = array( 'administrator' );

    /**
     * Register custom AIOEMP roles and grant all capabilities to admin roles.
     *
     * Called once during plugin activation.
     */
    public static function grant_capabilities(): void {
        // 1. Register (or re-register) custom AIOEMP roles.
        self::register_roles();

        // 2. Grant every capability to WP administrator(s).
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
     * Create (or update) all custom AIOEMP roles.
     *
     * Uses remove_role + add_role to ensure the capability set is always
     * in sync with the ROLES constant — safe to call repeatedly.
     */
    public static function register_roles(): void {
        foreach ( self::ROLES as $slug => $def ) {
            // Build the WP capabilities array for this role.
            $wp_caps = array( 'read' => true ); // every role needs 'read'
            foreach ( $def['caps'] as $key ) {
                if ( isset( self::CAPS[ $key ] ) ) {
                    $wp_caps[ self::CAPS[ $key ] ] = true;
                }
            }

            // Remove first so cap changes are picked up on re-activation.
            remove_role( $slug );
            add_role( $slug, $def['label'], $wp_caps );
        }
    }

    /**
     * Remove all custom capabilities from every role and delete custom roles.
     *
     * Called during plugin deactivation.
     */
    public static function revoke_capabilities(): void {
        global $wp_roles;

        if ( ! isset( $wp_roles ) ) {
            $wp_roles = new WP_Roles(); // @codingStandardsIgnoreLine
        }

        // Remove custom caps from all built-in WP roles.
        foreach ( $wp_roles->roles as $role_slug => $role_details ) {
            $role = get_role( $role_slug );
            if ( null === $role ) {
                continue;
            }
            foreach ( self::CAPS as $cap ) {
                $role->remove_cap( $cap );
            }
        }

        // Remove custom AIOEMP roles entirely.
        foreach ( array_keys( self::ROLES ) as $slug ) {
            remove_role( $slug );
        }
    }

    /**
     * Get the list of AIOEMP role slugs assigned to a given user.
     *
     * @param int $user_id WordPress user ID.
     * @return string[]
     */
    public static function get_user_aioemp_roles( int $user_id ): array {
        $user = get_userdata( $user_id );
        if ( ! $user ) {
            return array();
        }
        return array_values( array_intersect( $user->roles, array_keys( self::ROLES ) ) );
    }

    /**
     * Sync a user's AIOEMP roles to the given set.
     *
     * Adds missing roles and removes ones no longer in the set.
     * Only touches AIOEMP roles — leaves WP core roles untouched.
     *
     * @param int      $user_id WordPress user ID.
     * @param string[] $new_roles Array of AIOEMP role slugs to assign.
     * @return bool
     */
    public static function sync_user_aioemp_roles( int $user_id, array $new_roles ): bool {
        $user = get_userdata( $user_id );
        if ( ! $user ) {
            return false;
        }

        // Validate that all requested roles are valid AIOEMP roles.
        $valid_roles = array_intersect( $new_roles, array_keys( self::ROLES ) );

        $current = self::get_user_aioemp_roles( $user_id );

        // Remove roles no longer wanted.
        foreach ( array_diff( $current, $valid_roles ) as $slug ) {
            $user->remove_role( $slug );
        }

        // Add new roles.
        foreach ( array_diff( $valid_roles, $current ) as $slug ) {
            $user->add_role( $slug );
        }

        return true;
    }

    /**
     * Remove all AIOEMP roles from a user.
     *
     * @param int $user_id WordPress user ID.
     * @return bool
     */
    public static function remove_all_aioemp_roles( int $user_id ): bool {
        $user = get_userdata( $user_id );
        if ( ! $user ) {
            return false;
        }
        foreach ( array_keys( self::ROLES ) as $slug ) {
            $user->remove_role( $slug );
        }
        return true;
    }

    /**
     * Get the AIOEMP capabilities the current user holds.
     *
     * Returns an associative array of cap_key => bool for use in JS.
     *
     * @return array<string, bool>
     */
    public static function get_current_user_caps(): array {
        $result = array();
        foreach ( self::CAPS as $key => $wp_cap ) {
            $result[ $key ] = current_user_can( $wp_cap );
        }
        return $result;
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
