<?php
/**
 * Attenders (Candidates) REST controller — CRUD + bulk status.
 *
 * Endpoints are nested under events:
 *   GET    /aioemp/v1/events/<event_id>/attenders              — list
 *   POST   /aioemp/v1/events/<event_id>/attenders              — create
 *   GET    /aioemp/v1/events/<event_id>/attenders/<id>         — read
 *   PUT    /aioemp/v1/events/<event_id>/attenders/<id>         — update
 *   DELETE /aioemp/v1/events/<event_id>/attenders/<id>         — delete
 *   POST   /aioemp/v1/events/<event_id>/attenders/bulk-status  — bulk status
 *   GET    /aioemp/v1/events/<event_id>/attenders/counts       — status counts
 *
 * @package AIOEMP
 * @since   0.2.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-attender-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-events-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-event-log-model.php';

class AIOEMP_Attenders_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'events/(?P<event_id>[\d]+)/attenders';

    /**
     * @var AIOEMP_Attender_Model
     */
    private AIOEMP_Attender_Model $model;

    /**
     * @var AIOEMP_Events_Model
     */
    private AIOEMP_Events_Model $events;

    /**
     * @var AIOEMP_Event_Log_Model
     */
    private AIOEMP_Event_Log_Model $log;

    public function __construct() {
        $this->model  = new AIOEMP_Attender_Model();
        $this->events = new AIOEMP_Events_Model();
        $this->log    = new AIOEMP_Event_Log_Model();
    }

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {
        // Collection routes.
        register_rest_route( $this->namespace, '/' . $this->rest_base, array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'list_items' ),
                'permission_callback' => array( $this, 'manage_permission' ),
                'args'                => $this->get_collection_params(),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_item' ),
                'permission_callback' => array( $this, 'manage_permission' ),
                'args'                => $this->get_create_params(),
            ),
        ) );

        // Status counts.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/counts', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_counts' ),
                'permission_callback' => array( $this, 'manage_permission' ),
            ),
        ) );

        // Bulk status change.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/bulk-status', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'bulk_status' ),
                'permission_callback' => array( $this, 'manage_permission' ),
                'args'                => array(
                    'ids' => array(
                        'type'     => 'array',
                        'required' => true,
                        'items'    => array( 'type' => 'integer' ),
                    ),
                    'status' => array(
                        'type'     => 'string',
                        'required' => true,
                        'enum'     => AIOEMP_Attender_Model::STATUSES,
                    ),
                ),
            ),
        ) );

        // Single-item routes.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_item' ),
                'permission_callback' => array( $this, 'manage_permission' ),
            ),
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_item' ),
                'permission_callback' => array( $this, 'manage_permission' ),
            ),
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'delete_item' ),
                'permission_callback' => array( $this, 'manage_permission' ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function manage_permission(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_events'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    /**
     * GET /events/<event_id>/attenders — list attenders for an event.
     */
    public function list_items( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        if ( ! $this->events->find( $event_id ) ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $pagination = $this->get_pagination_params( $request );

        // Optional ids filter — comma-separated attender IDs.
        $ids_raw = $this->text_param( $request, 'ids' );
        $ids     = $ids_raw ? array_filter( array_map( 'absint', explode( ',', $ids_raw ) ) ) : array();

        $result = $this->model->list_for_event( $event_id, array(
            'status'   => $this->text_param( $request, 'status' ),
            'search'   => $this->text_param( $request, 'search' ),
            'per_page' => $pagination['per_page'],
            'page'     => $pagination['page'],
            'ids'      => $ids,
        ) );

        $response = $this->success( $result->items );
        return $this->add_pagination_headers( $response, $result->total, $pagination['per_page'] );
    }

    /**
     * POST /events/<event_id>/attenders — create an attender.
     */
    public function create_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $event    = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $data = $this->extract_attender_data( $request );
        if ( is_wp_error( $data ) ) {
            return $data;
        }

        $data['event_id'] = $event_id;

        $id = $this->model->create( $data );
        if ( false === $id ) {
            return $this->error( 'create_failed', __( 'Could not create candidate.', 'aioemp' ), 500 );
        }

        // Audit log.
        $this->log->log( $event_id, 'attender_created', array(), $data, get_current_user_id() );

        $attender = $this->model->find( $id );
        return $this->success( $attender, 201 );
    }

    /**
     * GET /events/<event_id>/attenders/<id> — get a single attender.
     */
    public function get_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $id       = absint( $request->get_param( 'id' ) );

        $attender = $this->model->find( $id );
        if ( ! $attender || (int) $attender->event_id !== $event_id ) {
            return $this->error( 'not_found', __( 'Candidate not found.', 'aioemp' ), 404 );
        }

        return $this->success( $attender );
    }

    /**
     * PUT /events/<event_id>/attenders/<id> — update an attender.
     */
    public function update_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $id       = absint( $request->get_param( 'id' ) );

        $attender = $this->model->find( $id );
        if ( ! $attender || (int) $attender->event_id !== $event_id ) {
            return $this->error( 'not_found', __( 'Candidate not found.', 'aioemp' ), 404 );
        }

        $data = $this->extract_attender_data( $request, true );
        if ( is_wp_error( $data ) ) {
            return $data;
        }

        if ( empty( $data ) ) {
            return $this->error( 'no_changes', __( 'No valid fields to update.', 'aioemp' ) );
        }

        $previous = (array) $attender;

        $ok = $this->model->update( $id, $data );
        if ( ! $ok ) {
            return $this->error( 'update_failed', __( 'Could not update candidate.', 'aioemp' ), 500 );
        }

        // Audit log.
        $this->log->log( $event_id, 'attender_updated', $previous, $data, get_current_user_id() );

        return $this->success( $this->model->find( $id ) );
    }

    /**
     * DELETE /events/<event_id>/attenders/<id> — delete an attender.
     */
    public function delete_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $id       = absint( $request->get_param( 'id' ) );

        $attender = $this->model->find( $id );
        if ( ! $attender || (int) $attender->event_id !== $event_id ) {
            return $this->error( 'not_found', __( 'Candidate not found.', 'aioemp' ), 404 );
        }

        $ok = $this->model->delete( $id );
        if ( ! $ok ) {
            return $this->error( 'delete_failed', __( 'Could not delete candidate.', 'aioemp' ), 500 );
        }

        // Audit log.
        $this->log->log( $event_id, 'attender_deleted', (array) $attender, array(), get_current_user_id() );

        return $this->success( array( 'deleted' => true ) );
    }

    /**
     * GET /events/<event_id>/attenders/counts — status counts.
     */
    public function get_counts( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        if ( ! $this->events->find( $event_id ) ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $counts = $this->model->count_by_status( $event_id );
        return $this->success( $counts );
    }

    /**
     * POST /events/<event_id>/attenders/bulk-status — bulk status change.
     */
    public function bulk_status( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id   = absint( $request->get_param( 'event_id' ) );
        $ids        = $request->get_param( 'ids' );
        $new_status = $this->text_param( $request, 'status' );

        if ( ! $this->events->find( $event_id ) ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( ! in_array( $new_status, AIOEMP_Attender_Model::STATUSES, true ) ) {
            return $this->error( 'invalid_status', __( 'Invalid status value.', 'aioemp' ) );
        }

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return $this->error( 'no_ids', __( 'No candidates selected.', 'aioemp' ) );
        }

        $updated = $this->model->bulk_update_status( $event_id, $ids, $new_status );

        // Audit log.
        $this->log->log( $event_id, 'attender_bulk_status', array( 'ids' => $ids ), array( 'status' => $new_status, 'updated' => $updated ), get_current_user_id() );

        return $this->success( array( 'updated' => $updated ) );
    }

    /*--------------------------------------------------------------
     * Data extraction & validation
     *------------------------------------------------------------*/

    /**
     * Extract and validate attender data from request.
     *
     * @param \WP_REST_Request $request   Request object.
     * @param bool             $is_update If true, all fields are optional.
     * @return array|\WP_Error
     */
    private function extract_attender_data( \WP_REST_Request $request, bool $is_update = false ): array|\WP_Error {
        $data = array();

        // Name fields.
        foreach ( array( 'title', 'first_name', 'last_name', 'company' ) as $field ) {
            $val = $request->get_param( $field );
            if ( null !== $val ) {
                $data[ $field ] = AIOEMP_Security::sanitize_text( (string) $val );
            }
        }

        // Email.
        $email = $request->get_param( 'email' );
        if ( null !== $email && '' !== $email ) {
            $email = sanitize_email( $email );
            if ( ! is_email( $email ) ) {
                return $this->error( 'invalid_email', __( 'Invalid email address.', 'aioemp' ) );
            }
            $data['email'] = $email;
        }

        // Status.
        $status = $this->text_param( $request, 'status' );
        if ( '' !== $status ) {
            if ( ! in_array( $status, AIOEMP_Attender_Model::STATUSES, true ) ) {
                return $this->error( 'invalid_status', __( 'Invalid status value.', 'aioemp' ) );
            }
            $data['status'] = $status;
        }

        // On create, require at least first_name or last_name.
        if ( ! $is_update ) {
            $has_name = ! empty( $data['first_name'] ) || ! empty( $data['last_name'] );
            if ( ! $has_name ) {
                return $this->error( 'missing_name', __( 'First name or last name is required.', 'aioemp' ) );
            }
        }

        return $data;
    }

    /*--------------------------------------------------------------
     * Schema declarations
     *------------------------------------------------------------*/

    private function get_collection_params(): array {
        return array(
            'event_id' => array(
                'type'              => 'integer',
                'required'          => true,
                'sanitize_callback' => 'absint',
            ),
            'page' => array(
                'type'    => 'integer',
                'default' => 1,
                'minimum' => 1,
            ),
            'per_page' => array(
                'type'    => 'integer',
                'default' => 20,
                'minimum' => 1,
                'maximum' => 100,
            ),
            'status' => array(
                'type' => 'string',
                'enum' => AIOEMP_Attender_Model::STATUSES,
            ),
            'search' => array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'ids' => array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
                'description'       => 'Comma-separated attender IDs to fetch specific records.',
            ),
        );
    }

    private function get_create_params(): array {
        return array(
            'event_id' => array(
                'type'              => 'integer',
                'required'          => true,
                'sanitize_callback' => 'absint',
            ),
            'first_name' => array( 'type' => 'string' ),
            'last_name'  => array( 'type' => 'string' ),
            'email'      => array( 'type' => 'string' ),
            'title'      => array( 'type' => 'string' ),
            'company'    => array( 'type' => 'string' ),
            'status'     => array(
                'type' => 'string',
                'enum' => AIOEMP_Attender_Model::STATUSES,
            ),
        );
    }
}
