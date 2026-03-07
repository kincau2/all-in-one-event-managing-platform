<?php
/**
 * Virtual ticket page — public endpoint for attendee ticket display.
 *
 * Registers a rewrite rule so that /e-ticket/{hash} (configurable slug)
 * renders a public ticket page without requiring a real WP page/post.
 *
 * @package AIOEMP
 * @since   0.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Ticket_Endpoint {

    /**
     * Default slug for the ticket virtual page.
     */
    public const DEFAULT_SLUG = 'e-ticket';

    /**
     * Query var registered with WP.
     */
    public const QUERY_VAR = 'aioemp_ticket';

    /**
     * Register hooks.
     */
    public function register(): void {
        add_action( 'init', array( $this, 'add_rewrite_rules' ) );
        add_filter( 'query_vars', array( $this, 'register_query_vars' ) );
        add_action( 'template_redirect', array( $this, 'handle_ticket_request' ) );
    }

    /**
     * Get the current ticket page slug from settings.
     *
     * @return string
     */
    public static function get_slug(): string {
        require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';
        $slug = AIOEMP_Settings_Service::get( 'ticket_page_slug' );
        return ! empty( $slug ) ? sanitize_title( $slug ) : self::DEFAULT_SLUG;
    }

    /**
     * Get the full URL for a ticket given a QR hash.
     *
     * @param string $hash QR hash.
     * @return string
     */
    public static function get_ticket_url( string $hash ): string {
        if ( get_option( 'permalink_structure' ) ) {
            return home_url( self::get_slug() . '/' . $hash );
        }
        // Plain permalink fallback.
        return add_query_arg( self::QUERY_VAR, $hash, home_url( '/' ) );
    }

    /**
     * Register the rewrite rule for pretty permalinks.
     */
    public function add_rewrite_rules(): void {
        $slug = self::get_slug();
        add_rewrite_rule(
            '^' . preg_quote( $slug, '/' ) . '/([a-f0-9]{64})/?$',
            'index.php?' . self::QUERY_VAR . '=$matches[1]',
            'top'
        );
    }

    /**
     * Register our query var so WP doesn't discard it.
     *
     * @param array $vars Existing query vars.
     * @return array
     */
    public function register_query_vars( array $vars ): array {
        $vars[] = self::QUERY_VAR;
        return $vars;
    }

    /**
     * Handle the ticket page request.
     */
    public function handle_ticket_request(): void {
        $hash = get_query_var( self::QUERY_VAR );

        if ( empty( $hash ) ) {
            return;
        }

        // Sanitize the hash — must be 64-char hex.
        $hash = sanitize_text_field( $hash );
        if ( ! preg_match( '/^[a-f0-9]{64}$/', $hash ) ) {
            $this->render_error( __( 'Invalid ticket.', 'aioemp' ) );
            return;
        }

        // Resolve ticket.
        require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-attender-model.php';
        $model    = new AIOEMP_Attender_Model();
        $attender = $model->find_by_qr_hash( $hash );

        if ( ! $attender ) {
            $this->render_error( __( 'Ticket not found.', 'aioemp' ) );
            return;
        }

        // Get event info.
        require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-events-model.php';
        $events_model = new AIOEMP_Events_Model();
        $event        = $events_model->find( (int) $attender->event_id );

        // Get seat assignment.
        global $wpdb;
        $seat_table = $wpdb->prefix . 'aioemp_seat_assignment';
        $seat = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT seat_key, seat_label FROM {$seat_table} WHERE event_id = %d AND attender_id = %d",
                (int) $attender->event_id,
                (int) $attender->id
            )
        );

        // Get latest attendance status.
        require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-attendance-model.php';
        $attendance_model = new AIOEMP_Attendance_Model();
        $latest_scan      = $attendance_model->get_latest( (int) $attender->event_id, (int) $attender->id );

        // Get logo.
        require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';
        $logo_url = AIOEMP_Settings_Service::get( 'logo_url' );

        // Resolve human-readable seat label.
        // Suppress raw UUID/hash values — only show if a real label was stored.
        $seat_label_display = null;
        if ( $seat && ! empty( $seat->seat_label ) ) {
            $seat_label_display = $seat->seat_label;
        }

        // Build QR code image URL.
        $qr_hash   = $attender->qrcode_hash ?? '';
        $ticket_url = $qr_hash ? self::get_ticket_url( $qr_hash ) : '';
        $qr_code_url = $ticket_url
            ? 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' . rawurlencode( $ticket_url )
            : '';

        // Load the template.
        $template_data = array(
            'attender'     => $attender,
            'event'        => $event,
            'seat_label'   => $seat_label_display,
            'latest_scan'  => $latest_scan,
            'logo_url'     => $logo_url,
            'qr_code_url'  => $qr_code_url,
        );

        $this->render_template( $template_data );
    }

    /**
     * Render the ticket page.
     *
     * @param array $data Template data.
     */
    private function render_template( array $data ): void {
        // Prevent caching.
        nocache_headers();

        // Extract variables for template.
        $attender     = $data['attender'];
        $event        = $data['event'];
        $seat_label   = $data['seat_label'];
        $latest_scan  = $data['latest_scan'];
        $logo_url     = $data['logo_url'];
        $qr_code_url  = $data['qr_code_url'] ?? '';

        include AIOEMP_PLUGIN_DIR . 'templates/ticket-page.php';
        exit;
    }

    /**
     * Render an error page.
     *
     * @param string $message Error message.
     */
    private function render_error( string $message ): void {
        nocache_headers();
        status_header( 404 );

        include AIOEMP_PLUGIN_DIR . 'templates/ticket-error.php';
        exit;
    }

    /**
     * Check if the current ticket slug conflicts with an existing page/post.
     *
     * @param string $slug Slug to check.
     * @return bool True if conflict exists.
     */
    public static function has_slug_conflict( string $slug = '' ): bool {
        if ( empty( $slug ) ) {
            $slug = self::get_slug();
        }

        $page = get_page_by_path( $slug );
        if ( $page ) {
            return true;
        }

        // Also check posts.
        global $wpdb;
        $exists = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE post_name = %s AND post_status IN ('publish','draft','pending') LIMIT 1",
                $slug
            )
        );

        return (bool) $exists;
    }
}
