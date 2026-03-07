<?php
/**
 * Email service — stores editable email templates and sends branded HTML emails.
 *
 * Templates are stored in wp_options as serialised arrays under the key
 * `aioemp_email_templates`. Each template type has a subject and body
 * with placeholder tokens that are resolved at send time.
 *
 * @package AIOEMP
 * @since   0.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';

class AIOEMP_Email_Service {

    /**
     * wp_options key for email templates.
     */
    public const OPTION_KEY = 'aioemp_email_templates';

    /**
     * Available template types.
     */
    public const TEMPLATE_TYPES = array(
        'registration_confirmation',
        'accepted_onsite',
        'accepted_online',
        'rejected',
        'new_user_welcome',
    );

    /**
     * Human-readable labels for template types.
     */
    public const TEMPLATE_LABELS = array(
        'registration_confirmation' => 'Registration Confirmation',
        'accepted_onsite'           => 'Accepted (On-site) with QR Ticket',
        'accepted_online'           => 'Accepted (Online)',
        'rejected'                  => 'Application Rejected',
        'new_user_welcome'          => 'New User Welcome (Password Setup)',
    );

    /**
     * Available placeholders per template type.
     *
     * Common placeholders available to ALL types:
     *   {{company_name}}, {{company_email}}, {{company_tel}},
     *   {{company_address}}, {{logo_url}}, {{site_url}}
     *
     * Type-specific extras are merged on top.
     */
    public const TEMPLATE_PLACEHOLDERS = array(
        'registration_confirmation' => array(
            '{{first_name}}',
            '{{last_name}}',
            '{{full_name}}',
            '{{email}}',
            '{{event_title}}',
            '{{event_date}}',
            '{{event_location}}',
        ),
        'accepted_onsite' => array(
            '{{first_name}}',
            '{{last_name}}',
            '{{full_name}}',
            '{{email}}',
            '{{event_title}}',
            '{{event_date}}',
            '{{event_location}}',
            '{{ticket_url}}',
            '{{qr_code_url}}',
            '{{qr_code_image}}',
            '{{seat_label}}',
            '{{seat_line}}',
        ),
        'accepted_online' => array(
            '{{first_name}}',
            '{{last_name}}',
            '{{full_name}}',
            '{{email}}',
            '{{event_title}}',
            '{{event_date}}',
            '{{online_url}}',
        ),
        'rejected' => array(
            '{{first_name}}',
            '{{last_name}}',
            '{{full_name}}',
            '{{email}}',
            '{{event_title}}',
            '{{event_date}}',
        ),
        'new_user_welcome' => array(
            '{{display_name}}',
            '{{user_login}}',
            '{{user_email}}',
            '{{setup_url}}',
            '{{role_name}}',
        ),
    );

    /**
     * Common placeholders added to every template type.
     */
    private const COMMON_PLACEHOLDERS = array(
        '{{company_name}}',
        '{{company_email}}',
        '{{company_tel}}',
        '{{company_address}}',
        '{{logo_url}}',
        '{{site_url}}',
    );

    /*--------------------------------------------------------------
     * Default templates
     *------------------------------------------------------------*/

    /**
     * Directory containing default template files.
     */
    private const EMAIL_DIR = AIOEMP_PLUGIN_DIR . 'includes/email/';

    /**
     * Map template type → filename (without .php).
     */
    private const TEMPLATE_FILES = array(
        'registration_confirmation' => 'registration-confirmation',
        'accepted_onsite'           => 'accepted-onsite',
        'accepted_online'           => 'accepted-online',
        'rejected'                  => 'rejected',
        'new_user_welcome'          => 'new-user-welcome',
    );

    /**
     * Get default templates — loaded from individual PHP files under
     * includes/email/.  Each file returns array{ subject, body }.
     *
     * @return array<string, array{subject: string, body: string}>
     */
    public static function get_defaults(): array {
        $defaults = array();

        foreach ( self::TEMPLATE_FILES as $type => $filename ) {
            $path = self::EMAIL_DIR . $filename . '.php';
            if ( file_exists( $path ) ) {
                $defaults[ $type ] = include $path;
            } else {
                // Fallback so the system never breaks.
                error_log( '[AIOEMP] Missing email template file: ' . $path );
                $defaults[ $type ] = array(
                    'subject' => '(missing template: ' . $type . ')',
                    'body'    => '<p>Template file not found.</p>',
                );
            }
        }

        return $defaults;
    }

    /*--------------------------------------------------------------
     * CRUD
     *------------------------------------------------------------*/

    /**
     * Get all templates, merged with defaults.
     *
     * @return array<string, array{subject: string, body: string}>
     */
    public static function get_all(): array {
        $stored = get_option( self::OPTION_KEY, array() );
        if ( ! is_array( $stored ) ) {
            $stored = array();
        }
        $defaults = self::get_defaults();
        $merged   = array();

        foreach ( self::TEMPLATE_TYPES as $type ) {
            $merged[ $type ] = array(
                'subject' => isset( $stored[ $type ]['subject'] )
                    ? $stored[ $type ]['subject']
                    : $defaults[ $type ]['subject'],
                'body'    => isset( $stored[ $type ]['body'] )
                    ? $stored[ $type ]['body']
                    : $defaults[ $type ]['body'],
            );
        }

        return $merged;
    }

    /**
     * Get a single template.
     *
     * @param string $type Template type key.
     * @return array{subject: string, body: string}|null
     */
    public static function get( string $type ): ?array {
        if ( ! in_array( $type, self::TEMPLATE_TYPES, true ) ) {
            return null;
        }
        $all = self::get_all();
        return $all[ $type ] ?? null;
    }

    /**
     * Update a single template.
     *
     * @param string $type    Template type key.
     * @param string $subject Email subject line.
     * @param string $body    Email body (HTML).
     * @return bool
     */
    public static function update_template( string $type, string $subject, string $body ): bool {
        if ( ! in_array( $type, self::TEMPLATE_TYPES, true ) ) {
            return false;
        }

        $all = self::get_all();
        $all[ $type ] = array(
            'subject' => sanitize_text_field( $subject ),
            'body'    => wp_kses_post( $body ),
        );

        return update_option( self::OPTION_KEY, $all );
    }

    /**
     * Reset a template to its default.
     *
     * @param string $type Template type key.
     * @return bool
     */
    public static function reset_template( string $type ): bool {
        if ( ! in_array( $type, self::TEMPLATE_TYPES, true ) ) {
            return false;
        }

        $all      = self::get_all();
        $defaults = self::get_defaults();

        $all[ $type ] = $defaults[ $type ];

        return update_option( self::OPTION_KEY, $all );
    }

    /**
     * Get available placeholders for a template type (including common ones).
     *
     * @param string $type Template type key.
     * @return string[]
     */
    public static function get_placeholders( string $type ): array {
        $specific = self::TEMPLATE_PLACEHOLDERS[ $type ] ?? array();
        return array_merge( $specific, self::COMMON_PLACEHOLDERS );
    }

    /*--------------------------------------------------------------
     * Sending
     *------------------------------------------------------------*/

    /**
     * Send an email using a stored template.
     *
     * @param string $type       Template type key.
     * @param string $to         Recipient email.
     * @param array  $variables  Key-value pairs for placeholder resolution.
     *                           Keys should NOT include {{ }} braces.
     * @return bool Whether the email was sent successfully.
     */
    public static function send( string $type, string $to, array $variables ): bool {
        $template = self::get( $type );
        if ( ! $template ) {
            error_log( '[AIOEMP] Email send failed: unknown template type "' . $type . '"' );
            return false;
        }

        // Merge common variables from settings.
        $settings = AIOEMP_Settings_Service::get_all();
        $common   = array(
            'company_name'    => $settings['company_name'] ?? '',
            'company_email'   => $settings['company_email'] ?? '',
            'company_tel'     => $settings['company_tel'] ?? '',
            'company_address' => $settings['company_address'] ?? '',
            'logo_url'        => $settings['logo_url'] ?? '',
            'site_url'        => home_url(),
        );

        $all_vars = array_merge( $common, $variables );

        // Resolve placeholders in subject and body.
        $subject = self::resolve_placeholders( $template['subject'], $all_vars );
        $body    = self::resolve_placeholders( $template['body'], $all_vars );

        // Wrap in HTML email layout.
        $html = self::wrap_html( $body, $settings );

        // Set content type to HTML.
        $headers = array(
            'Content-Type: text/html; charset=UTF-8',
        );

        // Add From header if company email is set.
        $from_name  = $settings['company_name'] ?: get_bloginfo( 'name' );
        $from_email = $settings['company_email'] ?: get_option( 'admin_email' );
        if ( $from_email ) {
            $headers[] = 'From: ' . $from_name . ' <' . $from_email . '>';
        }

        $sent = wp_mail( $to, $subject, $html, $headers );

        if ( ! $sent ) {
            error_log( '[AIOEMP] wp_mail failed for template "' . $type . '" to "' . $to . '"' );
        }

        return $sent;
    }

    /*--------------------------------------------------------------
     * Placeholder resolution
     *------------------------------------------------------------*/

    /**
     * Replace {{key}} placeholders with values.
     *
     * @param string $text      Text with placeholders.
     * @param array  $variables Key-value pairs (keys without braces).
     * @return string
     */
    private static function resolve_placeholders( string $text, array $variables ): string {
        foreach ( $variables as $key => $value ) {
            $text = str_replace( '{{' . $key . '}}', (string) $value, $text );
        }
        return $text;
    }

    /*--------------------------------------------------------------
     * HTML email wrapper
     *------------------------------------------------------------*/

    /**
     * Cached email styles (loaded once per request).
     *
     * @var array|null
     */
    private static ?array $styles = null;

    /**
     * Load shared email styles from email-style.php.
     *
     * @return array
     */
    private static function get_styles(): array {
        if ( null === self::$styles ) {
            $path = self::EMAIL_DIR . 'email-style.php';
            self::$styles = file_exists( $path ) ? (array) include $path : array();
        }
        return self::$styles;
    }

    /**
     * Wrap email body content in a responsive HTML email layout.
     *
     * @param string $body_html The email body content (already HTML).
     * @param array  $settings  Settings array for logo, company info.
     * @return string Full HTML email.
     */
    private static function wrap_html( string $body_html, array $settings ): string {
        $s = self::get_styles();

        $logo_url        = esc_url( $settings['logo_url'] ?? '' );
        $company_name    = esc_html( $settings['company_name'] ?? '' );
        $company_email   = esc_html( $settings['company_email'] ?? '' );
        $company_tel     = esc_html( $settings['company_tel'] ?? '' );
        $company_address = nl2br( esc_html( $settings['company_address'] ?? '' ) );

        $logo_block = '';
        if ( $logo_url ) {
            $logo_block = '<div style="' . ( $s['logo_wrap'] ?? '' ) . '">' .
                '<img src="' . $logo_url . '" alt="' . $company_name . '" style="' . ( $s['logo_img'] ?? '' ) . '">' .
                '</div>';
        }

        $footer_parts = array();
        if ( $company_name ) {
            $footer_parts[] = '<strong>' . $company_name . '</strong>';
        }
        if ( $company_address ) {
            $footer_parts[] = $company_address;
        }
        $contact = array();
        if ( $company_tel ) {
            $contact[] = $company_tel;
        }
        if ( $company_email ) {
            $contact[] = '<a href="mailto:' . $company_email . '" style="' . ( $s['footer_link'] ?? '' ) . '">' . $company_email . '</a>';
        }
        if ( ! empty( $contact ) ) {
            $footer_parts[] = implode( ' &bull; ', $contact );
        }

        $footer_html = implode( '<br>', $footer_parts );

        return '<!DOCTYPE html>' .
            '<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' .
            '<title>Email</title></head><body style="' . ( $s['body'] ?? '' ) . '">' .
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="' . ( $s['outer_table'] ?? '' ) . '">' .
            '<tr><td align="center" style="' . ( $s['outer_td'] ?? '' ) . '">' .
            '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="' . ( $s['card'] ?? '' ) . '">' .
            // Header / Logo
            '<tr><td style="' . ( $s['header_td'] ?? '' ) . '">' . $logo_block . '</td></tr>' .
            // Body
            '<tr><td style="' . ( $s['body_td'] ?? '' ) . '">' .
            $body_html .
            '</td></tr>' .
            // Footer
            '<tr><td style="' . ( $s['footer_td'] ?? '' ) . '">' .
            $footer_html .
            '</td></tr>' .
            '</table>' .
            '</td></tr></table></body></html>';
    }

    /*--------------------------------------------------------------
     * Utility
     *------------------------------------------------------------*/

    /**
     * Delete all stored email templates (used on uninstall).
     */
    public static function delete(): void {
        delete_option( self::OPTION_KEY );
    }

    /**
     * Format a date for display in emails (readable format).
     *
     * @param string|null $date_gmt Date in GMT.
     * @return string
     */
    public static function format_date( ?string $date_gmt ): string {
        if ( empty( $date_gmt ) ) {
            return 'TBA';
        }
        // Convert GMT to local time using WP timezone.
        $timestamp = strtotime( $date_gmt );
        if ( false === $timestamp ) {
            return $date_gmt;
        }
        return wp_date( 'j F Y, g:i A', $timestamp );
    }

    /**
     * Build an event location string from event data.
     *
     * @param object $event Event record from DB.
     * @return string
     */
    public static function get_event_location( object $event ): string {
        $parts = array();
        if ( ! empty( $event->location_name ) ) {
            $parts[] = $event->location_name;
        }
        if ( ! empty( $event->location_address ) ) {
            $parts[] = $event->location_address;
        }
        return ! empty( $parts ) ? implode( ', ', $parts ) : 'TBA';
    }
}
