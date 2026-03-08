<?php
/**
 * Events REST controller — CRUD endpoints for events.
 *
 * POST   /aioemp/v1/events          — create
 * GET    /aioemp/v1/events           — list
 * GET    /aioemp/v1/events/<id>      — read
 * PUT    /aioemp/v1/events/<id>      — update
 * DELETE /aioemp/v1/events/<id>      — delete
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-events-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-event-log-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-seatmap-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-seat-assignment-model.php';

class AIOEMP_Events_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'events';

    /**
     * @var AIOEMP_Events_Model
     */
    private AIOEMP_Events_Model $model;

    /**
     * @var AIOEMP_Event_Log_Model
     */
    private AIOEMP_Event_Log_Model $log;

    public function __construct() {
        $this->model = new AIOEMP_Events_Model();
        $this->log   = new AIOEMP_Event_Log_Model();
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
                'permission_callback' => array( $this, 'list_items_permissions' ),
                'args'                => $this->get_collection_params(),
            ),
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_item' ),
                'permission_callback' => array( $this, 'create_item_permissions' ),
                'args'                => $this->get_create_params(),
            ),
        ) );

        // Single-item routes.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_item' ),
                'permission_callback' => array( $this, 'get_item_permissions' ),
                'args'                => array(
                    'id' => array(
                        'type'              => 'integer',
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_item' ),
                'permission_callback' => array( $this, 'update_item_permissions' ),
                'args'                => $this->get_update_params(),
            ),
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'delete_item' ),
                'permission_callback' => array( $this, 'delete_item_permissions' ),
                'args'                => array(
                    'id' => array(
                        'type'              => 'integer',
                        'required'          => true,
                        'sanitize_callback' => 'absint',
                    ),
                ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function list_items_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['view_events'] );
    }

    public function create_item_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_events'] );
    }

    public function get_item_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['view_events'] );
    }

    public function update_item_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_events'] );
    }

    public function delete_item_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_events'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    /**
     * GET /events — list events.
     */
    public function list_items( \WP_REST_Request $request ): \WP_REST_Response {
        $pagination = $this->get_pagination_params( $request );

        $result = $this->model->list( array(
            'status'   => $this->text_param( $request, 'status' ),
            'search'   => $this->text_param( $request, 'search' ),
            'per_page' => $pagination['per_page'],
            'page'     => $pagination['page'],
        ) );

        $response = $this->success( $result->items );
        return $this->add_pagination_headers( $response, $result->total, $pagination['per_page'] );
    }

    /**
     * POST /events — create an event.
     */
    public function create_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $data = $this->extract_event_data( $request );

        if ( is_wp_error( $data ) ) {
            return $data;
        }

        $data['created_by'] = get_current_user_id();

        // Snapshot: copy seatmap layout when seatmap_id is assigned.
        if ( ! empty( $data['seatmap_id'] ) ) {
            $snapshot = $this->copy_seatmap_snapshot( (int) $data['seatmap_id'] );
            if ( is_wp_error( $snapshot ) ) {
                return $snapshot;
            }
            $data['seatmap_layout_snapshot'] = $snapshot;
        }

        $id = $this->model->create( $data );
        if ( false === $id ) {
            return $this->error( 'create_failed', __( 'Could not create event.', 'aioemp' ), 500 );
        }

        // Audit log.
        $this->log->log( $id, 'event_created', array(), $data, get_current_user_id() );

        $event = $this->model->find( $id );
        return $this->success( $event, 201 );
    }

    /**
     * GET /events/<id> — get a single event.
     */
    public function get_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $id    = absint( $request->get_param( 'id' ) );
        $event = $this->model->find( $id );

        if ( ! $event ) {
            return $this->error( 'not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $event = $this->enrich_event( $event );

        return $this->success( $event );
    }

    /**
     * PUT /events/<id> — update an event.
     */
    public function update_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $id    = absint( $request->get_param( 'id' ) );
        $event = $this->model->find( $id );

        if ( ! $event ) {
            return $this->error( 'not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $data = $this->extract_event_data( $request, true );
        if ( is_wp_error( $data ) ) {
            return $data;
        }

        if ( empty( $data ) ) {
            return $this->error( 'no_changes', __( 'No valid fields to update.', 'aioemp' ) );
        }

        // ── Snapshot freeze enforcement ──
        // If seatmap_id is being changed, check freeze conditions.
        if ( array_key_exists( 'seatmap_id', $data ) ) {
            $old_sm = $event->seatmap_id ? (int) $event->seatmap_id : null;
            $new_sm = $data['seatmap_id'] ? (int) $data['seatmap_id'] : null;

            if ( $old_sm !== $new_sm ) {
                $freeze_check = $this->check_snapshot_freeze( $id, $event );
                if ( is_wp_error( $freeze_check ) ) {
                    return $freeze_check;
                }

                // Copy new snapshot or clear it.
                if ( $new_sm ) {
                    $snapshot = $this->copy_seatmap_snapshot( $new_sm );
                    if ( is_wp_error( $snapshot ) ) {
                        return $snapshot;
                    }
                    $data['seatmap_layout_snapshot'] = $snapshot;
                } else {
                    $data['seatmap_layout_snapshot']    = null;
                    $data['seatmap_finalized_at_gmt']   = null;
                }
            }
        }

        $previous = (array) $event;

        $ok = $this->model->update( $id, $data );
        if ( ! $ok ) {
            return $this->error( 'update_failed', __( 'Could not update event.', 'aioemp' ), 500 );
        }

        // Audit log.
        $this->log->log( $id, 'event_updated', $previous, $data, get_current_user_id() );

        return $this->success( $this->model->find( $id ) );
    }

    /**
     * DELETE /events/<id> — delete an event.
     */
    public function delete_item( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $id    = absint( $request->get_param( 'id' ) );
        $event = $this->model->find( $id );

        if ( ! $event ) {
            return $this->error( 'not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $ok = $this->model->delete( $id );
        if ( ! $ok ) {
            return $this->error( 'delete_failed', __( 'Could not delete event.', 'aioemp' ), 500 );
        }

        // Audit log.
        $this->log->log( $id, 'event_deleted', (array) $event, array(), get_current_user_id() );

        return $this->success( array( 'deleted' => true ) );
    }

    /*--------------------------------------------------------------
     * Data extraction & validation
     *------------------------------------------------------------*/

    /**
     * Extract and validate event data from request.
     *
     * @param \WP_REST_Request $request   Request object.
     * @param bool             $is_update If true, all fields are optional.
     * @return array|\WP_Error
     */
    private function extract_event_data( \WP_REST_Request $request, bool $is_update = false ): array|\WP_Error {
        $data = array();

        // Title.
        $title = $this->text_param( $request, 'title' );
        if ( '' !== $title ) {
            $data['title'] = $title;
        } elseif ( ! $is_update ) {
            return $this->error( 'missing_title', __( 'Event title is required.', 'aioemp' ) );
        }

        // Status (optional, defaults handled by model).
        $status = $this->text_param( $request, 'status' );
        if ( '' !== $status ) {
            if ( ! in_array( $status, AIOEMP_Events_Model::STATUSES, true ) ) {
                return $this->error( 'invalid_status', __( 'Invalid status value.', 'aioemp' ) );
            }
            $data['status'] = $status;
        }

        // Venue mode.
        $venue_mode = $this->text_param( $request, 'venue_mode' );
        if ( '' !== $venue_mode ) {
            if ( ! in_array( $venue_mode, AIOEMP_Events_Model::VENUE_MODES, true ) ) {
                return $this->error( 'invalid_venue_mode', __( 'Invalid venue_mode value.', 'aioemp' ) );
            }
            $data['venue_mode'] = $venue_mode;
        }

        // Optional text fields.
        foreach ( array( 'description', 'location_name', 'location_address', 'online_url', 'cover_img_url' ) as $field ) {
            $val = $request->get_param( $field );
            if ( null !== $val ) {
                $data[ $field ] = AIOEMP_Security::sanitize_text( (string) $val );
            }
        }

        // Datetime fields (ISO 8601 / MySQL datetime).
        foreach ( array( 'start_date_gmt', 'end_date_gmt' ) as $dt_field ) {
            $val = $request->get_param( $dt_field );
            if ( null !== $val && '' !== $val ) {
                $sanitized = sanitize_text_field( (string) $val );
                // Validate datetime format.
                if ( ! $this->is_valid_datetime( $sanitized ) ) {
                    return $this->error(
                        'invalid_datetime',
                        /* translators: %s: field name */
                        sprintf( __( 'Invalid datetime format for %s.', 'aioemp' ), $dt_field )
                    );
                }
                $data[ $dt_field ] = $sanitized;
            }
        }

        // Integer fields.
        $capacity = $request->get_param( 'capacity' );
        if ( null !== $capacity ) {
            $data['capacity'] = absint( $capacity );
        }

        // Seatmap ID (nullable).
        $seatmap_id = $request->get_param( 'seatmap_id' );
        if ( null !== $seatmap_id ) {
            if ( '' === $seatmap_id ) {
                $data['seatmap_id'] = null;
            } else {
                $sm_id = absint( $seatmap_id );

                // Verify seatmap passes integrity check before allowing assignment.
                $sm_model = new AIOEMP_Seatmap_Model();
                $seatmap  = $sm_model->find( $sm_id );

                if ( ! $seatmap ) {
                    return $this->error( 'seatmap_not_found', __( 'Seatmap not found.', 'aioemp' ), 404 );
                }
                if ( ( $seatmap->status ?? 'draft' ) !== 'publish' ) {
                    return $this->error(
                        'seatmap_not_published',
                        __( 'This seatmap is still a draft. Please publish it before assigning it to an event.', 'aioemp' )
                    );
                }
                if ( empty( $seatmap->integrity_pass ) ) {
                    return $this->error(
                        'seatmap_integrity_fail',
                        __( 'This seatmap has duplicate seat assignments and cannot be used for an event. Please fix the seatmap first.', 'aioemp' )
                    );
                }

                $data['seatmap_id'] = $sm_id;
            }
        }

        return $data;
    }

    /**
     * Validate a datetime string (Y-m-d H:i:s or ISO 8601).
     *
     * @param string $value Datetime string.
     * @return bool
     */
    private function is_valid_datetime( string $value ): bool {
        // Accept Y-m-d H:i:s or Y-m-dTH:i:s variants.
        $timestamp = strtotime( $value );
        return false !== $timestamp && $timestamp > 0;
    }

    /*--------------------------------------------------------------
     * Schema declarations
     *------------------------------------------------------------*/

    /**
     * Collection params (GET query string).
     */
    private function get_collection_params(): array {
        return array(
            'page'     => array(
                'type'              => 'integer',
                'default'           => 1,
                'minimum'           => 1,
                'sanitize_callback' => 'absint',
            ),
            'per_page' => array(
                'type'              => 'integer',
                'default'           => 20,
                'minimum'           => 1,
                'maximum'           => 100,
                'sanitize_callback' => 'absint',
            ),
            'status'   => array(
                'type'              => 'string',
                'enum'              => AIOEMP_Events_Model::STATUSES,
                'sanitize_callback' => 'sanitize_text_field',
            ),
            'search'   => array(
                'type'              => 'string',
                'sanitize_callback' => 'sanitize_text_field',
            ),
        );
    }

    /**
     * Create params (POST body).
     */
    private function get_create_params(): array {
        return array(
            'title' => array(
                'type'     => 'string',
                'required' => true,
            ),
            'status' => array(
                'type' => 'string',
                'enum' => AIOEMP_Events_Model::STATUSES,
            ),
            'venue_mode' => array(
                'type' => 'string',
                'enum' => AIOEMP_Events_Model::VENUE_MODES,
            ),
        );
    }

    /**
     * Update params (PUT body).
     */
    private function get_update_params(): array {
        return array(
            'id' => array(
                'type'              => 'integer',
                'required'          => true,
                'sanitize_callback' => 'absint',
            ),
        );
    }

    /*--------------------------------------------------------------
     * Snapshot helpers
     *------------------------------------------------------------*/

    /**
     * Enrich an event object with related data (e.g. seatmap_title).
     */
    private function enrich_event( object $event ): object {
        if ( ! empty( $event->seatmap_id ) ) {
            require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-seatmap-model.php';
            $sm = ( new AIOEMP_Seatmap_Model() )->find( (int) $event->seatmap_id );
            $event->seatmap_title = $sm ? ( $sm->title ?? $sm->name ?? '' ) : '';
        } else {
            $event->seatmap_title = '';
        }
        return $event;
    }

    /**
     * Copy a seatmap's layout JSON as the event snapshot.
     *
     * @param int $seatmap_id Seatmap template ID.
     * @return string|\WP_Error Layout JSON string or error.
     */
    private function copy_seatmap_snapshot( int $seatmap_id ): string|\WP_Error {
        $sm_model = new AIOEMP_Seatmap_Model();
        $seatmap  = $sm_model->find( $seatmap_id );

        if ( ! $seatmap ) {
            return $this->error( 'seatmap_not_found', __( 'Seatmap not found.', 'aioemp' ), 404 );
        }
        if ( ( $seatmap->status ?? 'draft' ) !== 'publish' ) {
            return $this->error(
                'seatmap_not_published',
                __( 'This seatmap is still a draft and cannot be used for an event.', 'aioemp' )
            );
        }
        if ( empty( $seatmap->integrity_pass ) ) {
            return $this->error(
                'seatmap_integrity_fail',
                __( 'This seatmap has duplicate seat assignments and cannot be used.', 'aioemp' )
            );
        }

        return $seatmap->layout ?: '{}';
    }

    /**
     * Check snapshot freeze conditions.
     *
     * The snapshot CANNOT change if any of these are true:
     * 1. seatmap_finalized_at_gmt is set
     * 2. Seat assignments exist for this event
     * 3. Attendance logs exist for this event
     *
     * @param int    $event_id Event ID.
     * @param object $event    Event row.
     * @return bool|\WP_Error
     */
    private function check_snapshot_freeze( int $event_id, object $event ): bool|\WP_Error {
        // Condition 1: already finalized.
        if ( ! empty( $event->seatmap_finalized_at_gmt ) ) {
            return $this->error(
                'snapshot_frozen',
                __( 'Cannot change seatmap: the seating layout has been finalized.', 'aioemp' )
            );
        }

        // Condition 2: seat assignments exist.
        $assign_model = new AIOEMP_Seat_Assignment_Model();
        if ( $assign_model->count_for_event( $event_id ) > 0 ) {
            return $this->error(
                'snapshot_frozen',
                __( 'Cannot change seatmap: seat assignments already exist. Remove all assignments first.', 'aioemp' )
            );
        }

        // Condition 3: attendance logs exist.
        global $wpdb;
        $att_table = $wpdb->prefix . 'aioemp_attendance';
        $att_count = (int) $wpdb->get_var(
            $wpdb->prepare( "SELECT COUNT(*) FROM {$att_table} WHERE event_id = %d", $event_id )
        );
        if ( $att_count > 0 ) {
            return $this->error(
                'snapshot_frozen',
                __( 'Cannot change seatmap: attendance records already exist.', 'aioemp' )
            );
        }

        return true;
    }
}
