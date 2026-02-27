<?php
/**
 * Admin-side functionality — menu registration, asset enqueue, SPA shell render.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Admin {

    /**
     * The admin page hook suffix (returned by add_menu_page).
     *
     * @var string
     */
    private string $hook_suffix = '';

    /*--------------------------------------------------------------
     * Menu
     *------------------------------------------------------------*/

    /**
     * Register the top-level admin menu item.
     */
    public function register_admin_menu(): void {
        $this->hook_suffix = add_menu_page(
            __( 'Event Manager', 'aioemp' ),     // Page title
            __( 'Event Manager', 'aioemp' ),     // Menu title
            AIOEMP_Security::CAPS['manage_events'], // Capability
            'aioemp-dashboard',                   // Menu slug
            array( $this, 'render_dashboard' ),   // Render callback
            'dashicons-calendar-alt',             // Icon
            26                                     // Position
        );
    }

    /*--------------------------------------------------------------
     * Dashboard shell renderer
     *------------------------------------------------------------*/

    /**
     * Render the SPA shell container.
     *
     * The actual UI is built in JavaScript — this PHP callback only
     * outputs the mount point div plus security headers.
     */
    public function render_dashboard(): void {
        // Capability re-check (defence in depth).
        if ( ! AIOEMP_Security::current_user_can( 'manage_events' ) ) {
            wp_die(
                esc_html__( 'You do not have permission to access this page.', 'aioemp' ),
                403
            );
        }

        AIOEMP_Security::send_security_headers();

        // Load the PHP view template.
        require_once AIOEMP_PLUGIN_DIR . 'admin/views/dashboard-shell.php';
    }

    /*--------------------------------------------------------------
     * Asset enqueue
     *------------------------------------------------------------*/

    /**
     * Enqueue admin styles (only on our admin page).
     *
     * @param string $hook_suffix The current admin page hook.
     */
    public function enqueue_styles( string $hook_suffix ): void {
        if ( $this->hook_suffix !== $hook_suffix ) {
            return;
        }

        wp_enqueue_style(
            'aioemp-admin',
            AIOEMP_PLUGIN_URL . 'admin/css/aioemp-admin.css',
            array( 'dashicons' ),
            AIOEMP_VERSION
        );
    }

    /**
     * Enqueue admin scripts (only on our admin page).
     *
     * @param string $hook_suffix The current admin page hook.
     */
    public function enqueue_scripts( string $hook_suffix ): void {
        if ( $this->hook_suffix !== $hook_suffix ) {
            return;
        }

        wp_enqueue_script(
            'aioemp-admin',
            AIOEMP_PLUGIN_URL . 'admin/js/aioemp-admin.js',
            array( 'jquery' ),
            AIOEMP_VERSION,
            true
        );

        // Settings module (depends on core admin script).
        wp_enqueue_script(
            'aioemp-settings',
            AIOEMP_PLUGIN_URL . 'admin/js/aioemp-settings.js',
            array( 'jquery', 'aioemp-admin' ),
            AIOEMP_VERSION,
            true
        );

        // Seatmap compiler (IIFE) — compiles layout primitives → seats
        // in the browser. Required by the Events seating tab.
        wp_enqueue_script(
            'aioemp-seatmap-compiler',
            AIOEMP_PLUGIN_URL . 'admin/js/seatmap-compiler.js',
            array(),
            AIOEMP_VERSION,
            true
        );

        // Events module — split into sub-modules under admin/js/events/.
        // 1. Entry file: creates shared context (window.AIOEMP_Events).
        wp_enqueue_script(
            'aioemp-events',
            AIOEMP_PLUGIN_URL . 'admin/js/aioemp-events.js',
            array( 'jquery', 'aioemp-admin', 'aioemp-seatmap-compiler' ),
            AIOEMP_VERSION,
            true
        );

        // 2-7. Sub-modules (each extends ctx).
        $events_modules = array(
            'aioemp-events-helpers'    => 'events/_helpers.js',
            'aioemp-events-list'       => 'events/_list.js',
            'aioemp-events-form'       => 'events/_form.js',
            'aioemp-events-detail'     => 'events/_detail.js',
            'aioemp-events-candidates' => 'events/_candidates.js',
            'aioemp-events-seating'    => 'events/_seating.js',
        );
        $prev_handle = 'aioemp-events';
        foreach ( $events_modules as $handle => $file ) {
            wp_enqueue_script(
                $handle,
                AIOEMP_PLUGIN_URL . 'admin/js/' . $file,
                array( 'jquery', $prev_handle ),
                AIOEMP_VERSION,
                true
            );
            $prev_handle = $handle;
        }

        // Seatmaps list module (depends on core admin script).
        wp_enqueue_script(
            'aioemp-seatmaps',
            AIOEMP_PLUGIN_URL . 'admin/js/aioemp-seatmaps.js',
            array( 'jquery', 'aioemp-admin' ),
            AIOEMP_VERSION,
            true
        );

        // Seatmap editor React bundle (depends on seatmaps list module).
        wp_enqueue_script(
            'aioemp-seatmap-editor',
            AIOEMP_PLUGIN_URL . 'admin/js/seatmap-editor/seatmap-editor.js',
            array( 'aioemp-seatmaps' ),
            AIOEMP_VERSION,
            true
        );

        wp_enqueue_style(
            'aioemp-seatmap-editor',
            AIOEMP_PLUGIN_URL . 'admin/js/seatmap-editor/seatmap-editor.css',
            array( 'aioemp-admin' ),
            AIOEMP_VERSION
        );

        // Localise script with data the SPA shell needs.
        require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';
        $logo_url = AIOEMP_Settings_Service::get( 'logo_url' );

        wp_localize_script( 'aioemp-admin', 'aioemp', array(
            'rest_url' => esc_url_raw( set_url_scheme( rest_url( 'aioemp/v1/' ), 'https' ) ),
            'nonce'    => wp_create_nonce( 'wp_rest' ),
            'user_id'  => get_current_user_id(),
            'version'  => AIOEMP_VERSION,
            'logo_url' => $logo_url ? esc_url( $logo_url ) : '',
        ) );
    }
}
