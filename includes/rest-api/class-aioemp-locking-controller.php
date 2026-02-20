<?php
/**
 * Locking REST controller — acquire / heartbeat / release / takeover.
 *
 * POST /aioemp/v1/lock/acquire
 * POST /aioemp/v1/lock/heartbeat
 * POST /aioemp/v1/lock/release
 * POST /aioemp/v1/lock/takeover
 *
 * All endpoints expect JSON body:
 *   { resource_type: 'seatmap'|'event', resource_id: <int> }
 *   heartbeat + release also require: { lock_token: <string> }
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-locking-service.php';

class AIOEMP_Locking_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'lock';

    private AIOEMP_Locking_Service $service;

    public function __construct() {
        $this->service = new AIOEMP_Locking_Service();
    }

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {
        $common_args = array(
            'resource_type' => array(
                'type'     => 'string',
                'required' => true,
                'enum'     => array( 'seatmap', 'event' ),
            ),
            'resource_id' => array(
                'type'              => 'integer',
                'required'          => true,
                'sanitize_callback' => 'absint',
            ),
        );

        $token_arg = array(
            'lock_token' => array(
                'type'     => 'string',
                'required' => true,
            ),
        );

        // Acquire.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/acquire', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'acquire' ),
            'permission_callback' => array( $this, 'lock_permissions' ),
            'args'                => $common_args,
        ) );

        // Heartbeat.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/heartbeat', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'heartbeat' ),
            'permission_callback' => array( $this, 'lock_permissions' ),
            'args'                => array_merge( $common_args, $token_arg ),
        ) );

        // Release.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/release', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'release' ),
            'permission_callback' => array( $this, 'lock_permissions' ),
            'args'                => array_merge( $common_args, $token_arg ),
        ) );

        // Takeover.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/takeover', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'takeover' ),
            'permission_callback' => array( $this, 'takeover_permissions' ),
            'args'                => $common_args,
        ) );
    }

    /*--------------------------------------------------------------
     * Permission callbacks
     *------------------------------------------------------------*/

    /**
     * Any logged-in user with manage capability for the given resource type.
     */
    public function lock_permissions( \WP_REST_Request $request ): bool|\WP_Error {
        return $this->check_resource_permission( $request );
    }

    /**
     * Takeover requires admin-level capability (manage_settings).
     */
    public function takeover_permissions( \WP_REST_Request $request ): bool|\WP_Error {
        $resource_check = $this->check_resource_permission( $request );
        if ( is_wp_error( $resource_check ) ) {
            return $resource_check;
        }

        // Takeover is a destructive action — require higher privilege.
        return $this->check_permission( AIOEMP_Security::CAPS['manage_settings'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    public function acquire( \WP_REST_Request $request ): \WP_REST_Response {
        $result = $this->service->acquire(
            sanitize_text_field( $request->get_param( 'resource_type' ) ),
            absint( $request->get_param( 'resource_id' ) )
        );
        return $this->success( $result );
    }

    public function heartbeat( \WP_REST_Request $request ): \WP_REST_Response {
        $result = $this->service->heartbeat(
            sanitize_text_field( $request->get_param( 'resource_type' ) ),
            absint( $request->get_param( 'resource_id' ) ),
            sanitize_text_field( $request->get_param( 'lock_token' ) )
        );
        return $this->success( $result );
    }

    public function release( \WP_REST_Request $request ): \WP_REST_Response {
        $result = $this->service->release(
            sanitize_text_field( $request->get_param( 'resource_type' ) ),
            absint( $request->get_param( 'resource_id' ) ),
            sanitize_text_field( $request->get_param( 'lock_token' ) )
        );
        return $this->success( $result );
    }

    public function takeover( \WP_REST_Request $request ): \WP_REST_Response {
        $result = $this->service->takeover(
            sanitize_text_field( $request->get_param( 'resource_type' ) ),
            absint( $request->get_param( 'resource_id' ) )
        );
        return $this->success( $result );
    }

    /*--------------------------------------------------------------
     * Helpers
     *------------------------------------------------------------*/

    /**
     * Determine the required capability based on resource_type param.
     */
    private function check_resource_permission( \WP_REST_Request $request ): bool|\WP_Error {
        $type = sanitize_text_field( $request->get_param( 'resource_type' ) );

        $cap_map = array(
            'seatmap' => AIOEMP_Security::CAPS['manage_seatmaps'],
            'event'   => AIOEMP_Security::CAPS['manage_events'],
        );

        $cap = $cap_map[ $type ] ?? null;
        if ( ! $cap ) {
            return new \WP_Error( 'invalid_resource', __( 'Invalid resource type.', 'aioemp' ), array( 'status' => 400 ) );
        }

        return $this->check_permission( $cap );
    }
}
