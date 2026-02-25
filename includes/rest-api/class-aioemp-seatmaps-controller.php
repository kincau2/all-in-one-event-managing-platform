<?php
/**
 * Seatmap REST controller — CRUD endpoints for seatmaps.
 *
 * POST   /aioemp/v1/seatmaps          — create
 * GET    /aioemp/v1/seatmaps           — list
 * GET    /aioemp/v1/seatmaps/<id>      — read (includes layout)
 * PUT    /aioemp/v1/seatmaps/<id>      — update
 * DELETE /aioemp/v1/seatmaps/<id>      — delete
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-seatmap-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-event-log-model.php';

class AIOEMP_Seatmaps_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'seatmaps';

    private AIOEMP_Seatmap_Model    $model;
    private AIOEMP_Event_Log_Model  $log;

    public function __construct() {
        $this->model = new AIOEMP_Seatmap_Model();
        $this->log   = new AIOEMP_Event_Log_Model();
    }

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {
        // Collection.
        register_rest_route( $this->namespace, '/' . $this->rest_base, array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'list_items' ),
                'permission_callback' => array( $this, 'manage_permissions' ),
                'args'                => $this->get_collection_params(),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_item' ),
                'permission_callback' => array( $this, 'manage_permissions' ),
                'args'                => array(
                    'title' => array( 'type' => 'string', 'required' => true ),
                ),
            ),
        ) );

        // Single item.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_item' ),
                'permission_callback' => array( $this, 'manage_permissions' ),
                'args'                => array(
                    'id' => array( 'type' => 'integer', 'required' => true, 'sanitize_callback' => 'absint' ),
                ),
            ),
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_item' ),
                'permission_callback' => array( $this, 'manage_permissions' ),
                'args'                => array(
                    'id' => array( 'type' => 'integer', 'required' => true, 'sanitize_callback' => 'absint' ),
                ),
            ),
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'delete_item' ),
                'permission_callback' => array( $this, 'manage_permissions' ),
                'args'                => array(
                    'id' => array( 'type' => 'integer', 'required' => true, 'sanitize_callback' => 'absint' ),
                ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function manage_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_seatmaps'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    /**
     * GET /seatmaps — paginated list (excludes heavy layout column).
     */
    public function list_items( \WP_REST_Request $request ): \WP_REST_Response {
        $pagination = $this->get_pagination_params( $request );

        $result = $this->model->list( array(
            'search'   => $this->text_param( $request, 'search' ),
            'per_page' => $pagination['per_page'],
            'page'     => $pagination['page'],
        ) );

        $response = $this->success( $result->items );
        return $this->add_pagination_headers( $response, $result->total, $pagination['per_page'] );
    }

    /**
     * POST /seatmaps — create a seatmap.
     */
    public function create_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $title = $this->text_param( $request, 'title' );
        if ( '' === $title ) {
            return $this->error( 'missing_title', __( 'Seatmap title is required.', 'aioemp' ) );
        }

        $data = array( 'title' => $title );

        // Accept optional layout JSON on create (for imports / duplicates).
        $layout = $request->get_param( 'layout' );
        if ( null !== $layout ) {
            $decoded = AIOEMP_Security::decode_json( $layout );
            if ( is_wp_error( $decoded ) ) {
                return $this->error( 'invalid_layout', __( 'layout must be valid JSON.', 'aioemp' ) );
            }
            $data['layout'] = wp_json_encode( $decoded );

            // Server-side seat integrity check.
            $data['integrity_pass'] = self::check_seat_integrity( $decoded ) ? 1 : 0;
        }

        $id = $this->model->create( $data );
        if ( false === $id ) {
            return $this->error( 'create_failed', __( 'Could not create seatmap.', 'aioemp' ), 500 );
        }

        $this->log->log( 0, 'seatmap_created', array(), array( 'seatmap_id' => $id, 'title' => $title ), get_current_user_id() );

        return $this->success( $this->model->find( $id ), 201 );
    }

    /**
     * GET /seatmaps/<id> — single seatmap INCLUDING layout.
     */
    public function get_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $id   = absint( $request->get_param( 'id' ) );
        $item = $this->model->find( $id );

        if ( ! $item ) {
            return $this->error( 'not_found', __( 'Seatmap not found.', 'aioemp' ), 404 );
        }

        return $this->success( $item );
    }

    /**
     * PUT /seatmaps/<id> — update seatmap (title and/or layout).
     */
    public function update_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $id   = absint( $request->get_param( 'id' ) );
        $item = $this->model->find( $id );

        if ( ! $item ) {
            return $this->error( 'not_found', __( 'Seatmap not found.', 'aioemp' ), 404 );
        }

        $data = array();

        $title = $this->text_param( $request, 'title' );
        if ( '' !== $title ) {
            $data['title'] = $title;
        }

        $layout = $request->get_param( 'layout' );
        if ( null !== $layout ) {
            $decoded = AIOEMP_Security::decode_json( $layout );
            if ( is_wp_error( $decoded ) ) {
                return $this->error( 'invalid_layout', __( 'layout must be valid JSON.', 'aioemp' ) );
            }
            $data['layout'] = wp_json_encode( $decoded );

            // Server-side seat integrity check.
            $data['integrity_pass'] = self::check_seat_integrity( $decoded ) ? 1 : 0;
        }

        if ( empty( $data ) ) {
            return $this->error( 'no_changes', __( 'No valid fields to update.', 'aioemp' ) );
        }

        $previous = (array) $item;

        $ok = $this->model->update( $id, $data );
        if ( ! $ok ) {
            return $this->error( 'update_failed', __( 'Could not update seatmap.', 'aioemp' ), 500 );
        }

        $this->log->log( 0, 'seatmap_updated', $previous, $data, get_current_user_id() );

        return $this->success( $this->model->find( $id ) );
    }

    /**
     * DELETE /seatmaps/<id> — delete a seatmap.
     */
    public function delete_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $id   = absint( $request->get_param( 'id' ) );
        $item = $this->model->find( $id );

        if ( ! $item ) {
            return $this->error( 'not_found', __( 'Seatmap not found.', 'aioemp' ), 404 );
        }

        $ok = $this->model->delete( $id );
        if ( ! $ok ) {
            return $this->error( 'delete_failed', __( 'Could not delete seatmap.', 'aioemp' ), 500 );
        }

        $this->log->log( 0, 'seatmap_deleted', (array) $item, array(), get_current_user_id() );

        return $this->success( array( 'deleted' => true ) );
    }

    /*--------------------------------------------------------------
     * Schema
     *------------------------------------------------------------*/

    private function get_collection_params(): array {
        return array(
            'page'     => array( 'type' => 'integer', 'default' => 1, 'minimum' => 1, 'sanitize_callback' => 'absint' ),
            'per_page' => array( 'type' => 'integer', 'default' => 20, 'minimum' => 1, 'maximum' => 100, 'sanitize_callback' => 'absint' ),
            'search'   => array( 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ),
        );
    }

    /*--------------------------------------------------------------
     * Seat integrity check
     *
     * Mirrors the client-side logic: scan compiled seats for
     * duplicate row+number pairs regardless of section.
     * Returns true when no duplicates are found (pass).
     *------------------------------------------------------------*/

    /**
     * Check seat integrity of a decoded layout object.
     *
     * @param object|array $layout Decoded layout JSON.
     * @return bool True if integrity passes (no duplicate row+number pairs).
     */
    public static function check_seat_integrity( $layout ): bool {
        $layout = is_array( $layout ) ? (object) $layout : $layout;

        if ( ! isset( $layout->compiled->seats ) || ! is_array( $layout->compiled->seats ) ) {
            // No compiled seats — passes by default (empty layout).
            return true;
        }

        $seen = array();
        foreach ( $layout->compiled->seats as $seat ) {
            $seat = is_array( $seat ) ? (object) $seat : $seat;

            $row    = isset( $seat->row )    ? (string) $seat->row    : '';
            $number = isset( $seat->number ) ? (string) $seat->number : '';

            // Skip seats with no row or number (non-addressable).
            if ( '' === $row && '' === $number ) {
                continue;
            }

            $key = $row . '||' . $number;
            if ( isset( $seen[ $key ] ) ) {
                return false; // Duplicate found.
            }
            $seen[ $key ] = true;
        }

        return true;
    }
}
