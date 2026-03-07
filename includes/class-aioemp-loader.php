<?php
/**
 * Plugin loader — singleton that wires all hooks, filters, and sub-modules.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Loader {

    /**
     * Singleton instance.
     *
     * @var self|null
     */
    private static ?self $instance = null;

    /**
     * Registered actions.
     *
     * @var array{ hook: string, component: object|null, callback: string, priority: int, accepted_args: int }[]
     */
    private array $actions = array();

    /**
     * Registered filters.
     *
     * @var array{ hook: string, component: object|null, callback: string, priority: int, accepted_args: int }[]
     */
    private array $filters = array();

    /*--------------------------------------------------------------
     * Singleton
     *------------------------------------------------------------*/

    /**
     * Get the singleton instance.
     *
     * @return self
     */
    public static function get_instance(): self {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Private constructor — use get_instance().
     */
    private function __construct() {
        $this->load_dependencies();
        $this->define_admin_hooks();
        $this->define_public_hooks();
        $this->define_rest_hooks();
    }

    /*--------------------------------------------------------------
     * Dependency loading
     *------------------------------------------------------------*/

    /**
     * Require all class files.
     */
    private function load_dependencies(): void {
        // Admin
        require_once AIOEMP_PLUGIN_DIR . 'admin/class-aioemp-admin.php';

        // Public
        require_once AIOEMP_PLUGIN_DIR . 'public/class-aioemp-public.php';

        // Shortcodes
        require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-shortcodes.php';

        // Models
        // (loaded as needed by controllers & services)

        // Services
        // (loaded as needed by controllers)

        // REST API controllers
        // Controllers are registered via rest_api_init — loaded on demand.
    }

    /*--------------------------------------------------------------
     * Hook registration helpers
     *------------------------------------------------------------*/

    /**
     * Register an action hook.
     *
     * @param string      $hook          WordPress hook name.
     * @param object|null $component     Object instance (null for functions).
     * @param string      $callback      Method / function name.
     * @param int         $priority      Hook priority.
     * @param int         $accepted_args Number of accepted arguments.
     */
    public function add_action( string $hook, ?object $component, string $callback, int $priority = 10, int $accepted_args = 1 ): void {
        $this->actions[] = compact( 'hook', 'component', 'callback', 'priority', 'accepted_args' );
    }

    /**
     * Register a filter hook.
     *
     * @param string      $hook          WordPress hook name.
     * @param object|null $component     Object instance (null for functions).
     * @param string      $callback      Method / function name.
     * @param int         $priority      Hook priority.
     * @param int         $accepted_args Number of accepted arguments.
     */
    public function add_filter( string $hook, ?object $component, string $callback, int $priority = 10, int $accepted_args = 1 ): void {
        $this->filters[] = compact( 'hook', 'component', 'callback', 'priority', 'accepted_args' );
    }

    /*--------------------------------------------------------------
     * Hook definition (admin / public / REST)
     *------------------------------------------------------------*/

    /**
     * Register admin-side hooks.
     */
    private function define_admin_hooks(): void {
        $admin = new AIOEMP_Admin();

        $this->add_action( 'admin_menu', $admin, 'register_admin_menu' );
        $this->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_styles' );
        $this->add_action( 'admin_enqueue_scripts', $admin, 'enqueue_scripts' );
    }

    /**
     * Register public-facing hooks.
     */
    private function define_public_hooks(): void {
        $public = new AIOEMP_Public();

        $this->add_action( 'wp_enqueue_scripts', $public, 'enqueue_styles' );
        $this->add_action( 'wp_enqueue_scripts', $public, 'enqueue_scripts' );

        // Shortcodes.
        $shortcodes = new AIOEMP_Shortcodes();
        $this->add_action( 'init', $shortcodes, 'register' );

        // Redirect AIOEMP-role users to the dashboard on standard WP login.
        $this->add_filter( 'login_redirect', $public, 'aioemp_login_redirect', 10, 3 );

        // Virtual ticket page endpoint.
        require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-ticket-endpoint.php';
        $ticket = new AIOEMP_Ticket_Endpoint();
        $ticket->register();

        // Virtual password-setup page endpoint.
        require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-password-setup-endpoint.php';
        $password_setup = new AIOEMP_Password_Setup_Endpoint();
        $password_setup->register();
    }

    /**
     * Register REST API hooks.
     */
    private function define_rest_hooks(): void {
        $this->add_action( 'rest_api_init', null, 'aioemp_register_rest_routes' );
    }

    /*--------------------------------------------------------------
     * Run
     *------------------------------------------------------------*/

    /**
     * Attach all registered hooks to WordPress.
     */
    public function run(): void {
        foreach ( $this->filters as $hook ) {
            $callable = $this->make_callable( $hook );
            add_filter( $hook['hook'], $callable, $hook['priority'], $hook['accepted_args'] );
        }

        foreach ( $this->actions as $hook ) {
            $callable = $this->make_callable( $hook );
            add_action( $hook['hook'], $callable, $hook['priority'], $hook['accepted_args'] );
        }
    }

    /**
     * Build a callable from a hook definition.
     *
     * @param array $hook Hook definition array.
     * @return callable
     */
    private function make_callable( array $hook ): callable {
        if ( null !== $hook['component'] ) {
            return array( $hook['component'], $hook['callback'] );
        }
        return $hook['callback'];
    }
}

/*--------------------------------------------------------------
 * REST route registration callback (called on rest_api_init)
 *------------------------------------------------------------*/

/**
 * Register all AIOEMP REST API routes.
 *
 * Individual controller files are loaded here so they are
 * only parsed when the REST API is actually initialised.
 *
 * @since 0.1.0
 */
function aioemp_register_rest_routes(): void {
    // Events CRUD.
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-events-controller.php';
    ( new AIOEMP_Events_Controller() )->register_routes();

    // Attenders (Candidates) CRUD — nested under events.
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-attenders-controller.php';
    ( new AIOEMP_Attenders_Controller() )->register_routes();

    // Seatmaps CRUD.
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-seatmaps-controller.php';
    ( new AIOEMP_Seatmaps_Controller() )->register_routes();

    // Seatmap background-image upload.
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-seatmap-upload-controller.php';
    ( new AIOEMP_Seatmap_Upload_Controller() )->register_routes();

    // Seating (assign / unassign / swap / block / unblock / finalize).
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-seating-controller.php';
    ( new AIOEMP_Seating_Controller() )->register_routes();

    // Locking (acquire / heartbeat / release / takeover).
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-locking-controller.php';
    ( new AIOEMP_Locking_Controller() )->register_routes();

    // Settings (read / update / logo upload).
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-settings-controller.php';
    ( new AIOEMP_Settings_Controller() )->register_routes();

    // Users (roles / create / search / assign).
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-users-controller.php';
    ( new AIOEMP_Users_Controller() )->register_routes();

    // Profile (current user get / update).
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-profile-controller.php';
    ( new AIOEMP_Profile_Controller() )->register_routes();

    // Attendance (check-in / check-out / logs / export).
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-attendance-controller.php';
    ( new AIOEMP_Attendance_Controller() )->register_routes();

    // Email templates (CRUD / preview).
    require_once AIOEMP_PLUGIN_DIR . 'includes/rest-api/class-aioemp-email-templates-controller.php';
    ( new AIOEMP_Email_Templates_Controller() )->register_routes();
}
