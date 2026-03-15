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

        // Email batch processing.
        'email_batch_size'    => 1,    // candidates per API call
        'email_batch_wait_ms' => 0,    // ms to wait between batch cycles

        // Ticket / check-in.
        'ticket_page_slug'   => 'e-ticket',

        // Languages — ordered list of enabled locales (first = main language).
        'languages'          => array( 'en_US' ),
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

            case 'email_batch_size':
                $int = absint( $value );
                return max( 1, min( $int, 50 ) ); // Clamp 1–50.

            case 'email_batch_wait_ms':
                $int = absint( $value );
                return min( $int, 60000 ); // Max 60 seconds.

            case 'ticket_page_slug':
                $slug = sanitize_title( (string) $value );
                return '' !== $slug ? $slug : 'e-ticket';

            case 'languages':
                if ( ! is_array( $value ) ) {
                    return array( 'en_US' );
                }
                // Sanitise each locale: allow only a-z, A-Z, 0-9, underscore, hyphen.
                $clean = array();
                foreach ( $value as $locale ) {
                    $loc = preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $locale );
                    if ( '' !== $loc && ! in_array( $loc, $clean, true ) ) {
                        $clean[] = $loc;
                    }
                }
                return ! empty( $clean ) ? $clean : array( 'en_US' );

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

    /**
     * Built-in language catalogue — label → locale.
     *
     * Provides a curated list of languages for the admin Settings UI.
     * Order: English first, then alphabetical by label.
     *
     * @return array<string, string>  locale => label
     */
    public static function get_available_languages(): array {
        return array(
            'en_US' => 'English (US)',
            'en_GB' => 'English (UK)',
            'zh_TW' => '繁體中文 台灣 (Traditional Chinese — Taiwan)',
            'zh_HK' => '繁體中文 香港 (Traditional Chinese — Hong Kong)',
            'zh_CN' => '简体中文 (Simplified Chinese)',
            'ja'    => '日本語 (Japanese)',
            'ko'    => '한국어 (Korean)',
            'fr_FR' => 'Français (French)',
            'fr_CA' => 'Français du Canada (French — Canada)',
            'de_DE' => 'Deutsch (German)',
            'es_ES' => 'Español (Spanish)',
            'es_MX' => 'Español de México (Spanish — Mexico)',
            'pt_BR' => 'Português do Brasil (Portuguese — Brazil)',
            'pt_PT' => 'Português (Portuguese)',
            'it_IT' => 'Italiano (Italian)',
            'nl_NL' => 'Nederlands (Dutch)',
            'ru_RU' => 'Русский (Russian)',
            'uk'    => 'Українська (Ukrainian)',
            'pl_PL' => 'Polski (Polish)',
            'cs_CZ' => 'Čeština (Czech)',
            'hu_HU' => 'Magyar (Hungarian)',
            'ro_RO' => 'Română (Romanian)',
            'el'    => 'Ελληνικά (Greek)',
            'tr_TR' => 'Türkçe (Turkish)',
            'sv_SE' => 'Svenska (Swedish)',
            'nb_NO' => 'Norsk bokmål (Norwegian)',
            'da_DK' => 'Dansk (Danish)',
            'fi'    => 'Suomi (Finnish)',
            'ar'    => 'العربية (Arabic)',
            'he_IL' => 'עברית (Hebrew)',
            'hi_IN' => 'हिन्दी (Hindi)',
            'th'    => 'ไทย (Thai)',
            'vi'    => 'Tiếng Việt (Vietnamese)',
            'id_ID' => 'Bahasa Indonesia',
            'ms_MY' => 'Bahasa Melayu (Malay)',
        );
    }

    /**
     * Get the main (first) language locale.
     *
     * @return string
     */
    public static function get_main_language(): string {
        $languages = self::get( 'languages' );
        return is_array( $languages ) && ! empty( $languages ) ? $languages[0] : 'en_US';
    }
}
