<?php
/**
 * Settings service — reads/writes plugin options from wp_options.
 *
 * All AIOEMP settings are stored as a single serialised array under
 * the option key `aioemp_settings`. This avoids option-table bloat
 * and provides a clean get/set API.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Settings_Service {

    /**
     * wp_options key.
     */
    public const OPTION_KEY = 'aioemp_settings';

    /**
     * Default settings — used for missing keys and on first install.
     *
     * @var array<string, mixed>
     */
    private const DEFAULTS = array(
        // Branding.
        'logo_attachment_id' => 0,
        'logo_url'           => '',

        // Company details — used in emails and public pages.
        'company_name'       => '',
        'company_email'      => '',
        'company_tel'        => '',
        'company_address'    => '',

        // CAPTCHA / Turnstile.
        'captcha_provider'   => 'none', // none | recaptcha_v2 | recaptcha_v3 | turnstile
        'captcha_site_key'   => '',
        'captcha_secret_key' => '',

        // Behaviour toggles.
        'default_venue_mode' => 'onsite', // onsite | online | mixed
        'default_capacity'   => 100,

        // Ticket / check-in.
        'ticket_page_slug'   => 'e-ticket',
    );

    /**
     * Allowed captcha providers.
     */
    public const CAPTCHA_PROVIDERS = array( 'none', 'recaptcha_v2', 'recaptcha_v3', 'turnstile' );

    /**
     * Allowed venue modes.
     */
    public const VENUE_MODES = array( 'onsite', 'online', 'mixed' );

    /*--------------------------------------------------------------
     * Read
     *------------------------------------------------------------*/

    /**
     * Get all settings, merged with defaults.
     *
     * @return array<string, mixed>
     */
    public static function get_all(): array {
        $stored = get_option( self::OPTION_KEY, array() );
        if ( ! is_array( $stored ) ) {
            $stored = array();
        }
        return wp_parse_args( $stored, self::DEFAULTS );
    }

    /**
     * Get a single setting.
     *
     * @param string $key Setting key.
     * @return mixed
     */
    public static function get( string $key ) {
        $all = self::get_all();
        return $all[ $key ] ?? ( self::DEFAULTS[ $key ] ?? null );
    }

    /*--------------------------------------------------------------
     * Write
     *------------------------------------------------------------*/

    /**
     * Update multiple settings at once.
     *
     * Only keys that exist in DEFAULTS are accepted — unknown keys
     * are silently discarded (defence against injection).
     *
     * @param array<string, mixed> $data Key-value pairs.
     * @return bool Whether the update succeeded.
     */
    public static function update( array $data ): bool {
        $current  = self::get_all();
        $allowed  = array_keys( self::DEFAULTS );
        $sanitised = array();

        foreach ( $data as $key => $value ) {
            if ( ! in_array( $key, $allowed, true ) ) {
                continue; // Reject unknown keys.
            }
            $sanitised[ $key ] = self::sanitize_field( $key, $value );
        }

        if ( empty( $sanitised ) ) {
            return false;
        }

        $merged = array_merge( $current, $sanitised );

        return update_option( self::OPTION_KEY, $merged );
    }

    /*--------------------------------------------------------------
     * Field-level sanitisation
     *------------------------------------------------------------*/

    /**
     * Sanitise a single field value based on its key.
     *
     * @param string $key   Setting key.
     * @param mixed  $value Raw value.
     * @return mixed Sanitised value.
     */
    private static function sanitize_field( string $key, $value ) {
        switch ( $key ) {
            case 'logo_attachment_id':
                return absint( $value );

            case 'logo_url':
                return esc_url_raw( (string) $value );

            case 'company_name':
                return sanitize_text_field( (string) $value );

            case 'company_email':
                $email = sanitize_email( (string) $value );
                return is_email( $email ) ? $email : '';

            case 'company_tel':
                // Allow digits, spaces, +, -, (, ) only.
                return preg_replace( '/[^\d\s\+\-\(\)]/', '', (string) $value );

            case 'company_address':
                return sanitize_textarea_field( (string) $value );

            case 'captcha_provider':
                return in_array( $value, self::CAPTCHA_PROVIDERS, true ) ? $value : 'none';

            case 'captcha_site_key':
            case 'captcha_secret_key':
                // Alphanumeric + dashes + underscores only — typical for API keys.
                return preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $value );

            case 'default_venue_mode':
                return in_array( $value, self::VENUE_MODES, true ) ? $value : 'onsite';

            case 'default_capacity':
                $int = absint( $value );
                return max( 1, min( $int, 100000 ) ); // Clamp 1–100 000.

            case 'ticket_page_slug':
                $slug = sanitize_title( (string) $value );
                return '' !== $slug ? $slug : 'e-ticket';

            default:
                return sanitize_text_field( (string) $value );
        }
    }

    /*--------------------------------------------------------------
     * Utility
     *------------------------------------------------------------*/

    /**
     * Delete all plugin settings (used on uninstall).
     */
    public static function delete(): void {
        delete_option( self::OPTION_KEY );
    }

    /**
     * Return settings safe for exposure to the admin JS client.
     *
     * Secrets (captcha_secret_key) are NEVER sent to the browser.
     *
     * @return array<string, mixed>
     */
    public static function get_public(): array {
        $all = self::get_all();

        // Mask the secret key — only show that it's set or not.
        $all['captcha_secret_key'] = '' !== $all['captcha_secret_key'] ? '••••••••' : '';

        return $all;
    }
}
