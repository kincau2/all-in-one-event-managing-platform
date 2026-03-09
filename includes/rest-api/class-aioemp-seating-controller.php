<?php
/**
 * Seating REST controller — seat assignment & blocking endpoints.
 *
 * All routes are nested under /events/<event_id>/seating/:
 *
 * GET    /events/<id>/seating              — list assignments + blocked
 * POST   /events/<id>/seating/assign       — assign seat to candidate
 * POST   /events/<id>/seating/unassign     — unassign a seat
 * POST   /events/<id>/seating/assign-batch — batch assign seats to candidates
 * POST   /events/<id>/seating/swap         — swap two occupied seats
 * POST   /events/<id>/seating/block        — block a seat
 * POST   /events/<id>/seating/unblock      — unblock a seat
 * POST   /events/<id>/seating/finalize     — explicitly finalize snapshot
 * GET    /events/<id>/seating/log/seat/<seat_key>       — seat history
 * GET    /events/<id>/seating/log/attender/<attender_id> — candidate seating history
 *
 * @package AIOEMP
 * @since   0.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-events-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-seat-assignment-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-blocked-seat-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-seat-assignment-log-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-attender-model.php';

class AIOEMP_Seating_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'events';

    private AIOEMP_Events_Model             $events;
    private AIOEMP_Seat_Assignment_Model    $assignments;
    private AIOEMP_Blocked_Seat_Model       $blocked;
    private AIOEMP_Seat_Assignment_Log_Model $seat_log;
    private AIOEMP_Attender_Model           $attenders;

    public function __construct() {
        $this->events      = new AIOEMP_Events_Model();
        $this->assignments = new AIOEMP_Seat_Assignment_Model();
        $this->blocked     = new AIOEMP_Blocked_Seat_Model();
        $this->seat_log    = new AIOEMP_Seat_Assignment_Log_Model();
        $this->attenders   = new AIOEMP_Attender_Model();
    }

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {
        $event_id_arg = array(
            'type'              => 'integer',
            'required'          => true,
            'sanitize_callback' => 'absint',
        );

        // GET /events/<id>/seating — overview (assignments + blocked + counts).
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating', array(
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => array( $this, 'get_seating' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array( 'event_id' => $event_id_arg ),
        ) );

        // POST /events/<id>/seating/assign
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/assign', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'assign_seat' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id'    => $event_id_arg,
                'attender_id' => array( 'type' => 'integer', 'required' => true, 'sanitize_callback' => 'absint' ),
                'seat_key'    => array( 'type' => 'string',  'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
                'seat_label'  => array( 'type' => 'string',  'required' => false, 'sanitize_callback' => 'sanitize_text_field' ),
            ),
        ) );

        // POST /events/<id>/seating/unassign
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/unassign', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'unassign_seat' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id' => $event_id_arg,
                'seat_key' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            ),
        ) );

        // POST /events/<id>/seating/backfill-labels
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/backfill-labels', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'backfill_labels' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id' => $event_id_arg,
                'labels'   => array(
                    'type'     => 'object',
                    'required' => true,
                ),
            ),
        ) );

        // POST /events/<id>/seating/assign-batch
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/assign-batch', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'assign_batch' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id' => $event_id_arg,
                'pairs'    => array(
                    'type'     => 'array',
                    'required' => true,
                    'items'    => array(
                        'type'       => 'object',
                        'properties' => array(
                            'attender_id' => array( 'type' => 'integer', 'required' => true ),
                            'seat_key'    => array( 'type' => 'string',  'required' => true ),
                        ),
                    ),
                ),
            ),
        ) );

        // POST /events/<id>/seating/swap
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/swap', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'swap_seats' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id'  => $event_id_arg,
                'seat_key1' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
                'seat_key2' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            ),
        ) );

        // POST /events/<id>/seating/block
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/block', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'block_seat' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id' => $event_id_arg,
                'seat_key' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            ),
        ) );

        // POST /events/<id>/seating/unblock
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/unblock', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'unblock_seat' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id' => $event_id_arg,
                'seat_key' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            ),
        ) );

        // POST /events/<id>/seating/block-batch
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/block-batch', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'block_batch' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id'  => $event_id_arg,
                'seat_keys' => array(
                    'type'     => 'array',
                    'required' => true,
                    'items'    => array( 'type' => 'string' ),
                    'sanitize_callback' => function ( $v ) {
                        return array_map( 'sanitize_text_field', (array) $v );
                    },
                ),
            ),
        ) );

        // POST /events/<id>/seating/unblock-batch
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/unblock-batch', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'unblock_batch' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id'  => $event_id_arg,
                'seat_keys' => array(
                    'type'     => 'array',
                    'required' => true,
                    'items'    => array( 'type' => 'string' ),
                    'sanitize_callback' => function ( $v ) {
                        return array_map( 'sanitize_text_field', (array) $v );
                    },
                ),
            ),
        ) );

        // POST /events/<id>/seating/unassign-batch
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/unassign-batch', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'unassign_batch' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id'  => $event_id_arg,
                'seat_keys' => array(
                    'type'     => 'array',
                    'required' => true,
                    'items'    => array( 'type' => 'string' ),
                    'sanitize_callback' => function ( $v ) {
                        return array_map( 'sanitize_text_field', (array) $v );
                    },
                ),
            ),
        ) );

        // POST /events/<id>/seating/finalize
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/finalize', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'finalize' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array( 'event_id' => $event_id_arg ),
        ) );

        // GET /events/<id>/seating/log/seat/<seat_key> — history for a specific seat.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/log/seat/(?P<seat_key>[a-f0-9\-]+)', array(
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => array( $this, 'get_seat_log' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id' => $event_id_arg,
                'seat_key' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
            ),
        ) );

        // GET /events/<id>/seating/log/attender/<attender_id> — history for a candidate.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>[\d]+)/seating/log/attender/(?P<attender_id>[\d]+)', array(
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => array( $this, 'get_attender_log' ),
            'permission_callback' => array( $this, 'permissions' ),
            'args'                => array(
                'event_id'    => $event_id_arg,
                'attender_id' => array( 'type' => 'integer', 'required' => true, 'sanitize_callback' => 'absint' ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_seating'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    /**
     * GET /events/<id>/seating — list assignments + blocked seats + counts.
     */
    public function get_seating( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $event    = $this->events->find( $event_id );

        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $assignments = $this->assignments->list_for_event( $event_id );
        $blocked     = $this->blocked->list_for_event( $event_id );

        return $this->success( array(
            'assignments'     => $assignments,
            'blocked'         => $blocked,
            'total_assigned'  => count( $assignments ),
            'total_blocked'   => count( $blocked ),
            'is_finalized'    => ! empty( $event->seatmap_finalized_at_gmt ),
        ) );
    }

    /**
     * POST /events/<id>/seating/backfill-labels — update NULL seat_labels.
     */
    public function backfill_labels( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $labels   = $request->get_param( 'labels' );

        if ( ! is_array( $labels ) || empty( $labels ) ) {
            return $this->error( 'invalid_labels', __( 'Labels map is required.', 'aioemp' ), 400 );
        }

        $updated = $this->assignments->backfill_labels( $event_id, $labels );

        return $this->success( array(
            'updated' => $updated,
        ) );
    }

    /**
     * POST /events/<id>/seating/assign — assign seat to candidate.
     */
    public function assign_seat( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id    = absint( $request->get_param( 'event_id' ) );
        $attender_id = absint( $request->get_param( 'attender_id' ) );
        $seat_key    = sanitize_text_field( $request->get_param( 'seat_key' ) );

        // Validate event exists and has snapshot.
        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }
        if ( empty( $event->seatmap_layout_snapshot ) ) {
            return $this->error( 'no_snapshot', __( 'Event has no seatmap snapshot.', 'aioemp' ) );
        }

        // Validate seat_key exists in snapshot.
        if ( ! $this->seat_exists_in_snapshot( $event->seatmap_layout_snapshot, $seat_key ) ) {
            return $this->error( 'invalid_seat', __( 'Seat key does not exist in the seatmap.', 'aioemp' ) );
        }

        // Validate candidate belongs to this event.
        $attender = $this->attenders->find( $attender_id );
        if ( ! $attender || (int) $attender->event_id !== $event_id ) {
            return $this->error( 'attender_not_found', __( 'Candidate not found for this event.', 'aioemp' ), 404 );
        }

        // Check seat is not blocked.
        if ( $this->blocked->is_blocked( $event_id, $seat_key ) ) {
            return $this->error( 'seat_blocked', __( 'This seat is blocked.', 'aioemp' ) );
        }

        // Check seat is not already assigned.
        if ( $this->assignments->find_by_seat( $event_id, $seat_key ) ) {
            return $this->error( 'seat_taken', __( 'This seat is already assigned.', 'aioemp' ) );
        }

        // Check candidate doesn't already have a seat.
        $existing = $this->assignments->find_by_attender( $event_id, $attender_id );
        if ( $existing ) {
            return $this->error(
                'attender_has_seat',
                /* translators: %s: seat key */
                sprintf( __( 'This candidate is already assigned to seat %s. Unassign first.', 'aioemp' ), $existing->seat_key )
            );
        }

        // Auto-finalize on first assignment.
        $this->maybe_finalize( $event_id, $event );

        // Assign.
        $user_id    = get_current_user_id();
        $seat_label = sanitize_text_field( $request->get_param( 'seat_label' ) ?? '' );
        $id = $this->assignments->assign( $event_id, $attender_id, $seat_key, $user_id, $seat_label );
        if ( false === $id ) {
            return $this->error( 'assign_failed', __( 'Could not assign seat. It may already be taken.', 'aioemp' ), 500 );
        }

        // Sync checked_in flag: if the attender is already checked in (latest
        // attendance scan = IN), mark the new seat assignment as checked_in too.
        require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-attendance-model.php';
        $att_model = new AIOEMP_Attendance_Model();
        $latest    = $att_model->get_latest( $event_id, $attender_id );
        if ( $latest && 'IN' === $latest->type ) {
            $GLOBALS['wpdb']->update(
                $GLOBALS['wpdb']->prefix . 'aioemp_seat_assignment',
                array( 'checked_in' => 1 ),
                array( 'id' => $id )
            );
        }

        // Log.
        $this->seat_log->log( $event_id, $attender_id, null, $seat_key, 'assign', $user_id );

        return $this->success( array(
            'id'          => $id,
            'seat_key'    => $seat_key,
            'seat_label'  => $seat_label,
            'attender_id' => $attender_id,
        ), 201 );
    }

    /**
     * POST /events/<id>/seating/unassign — free a seat.
     */
    public function unassign_seat( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $seat_key = sanitize_text_field( $request->get_param( 'seat_key' ) );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $assignment = $this->assignments->find_by_seat( $event_id, $seat_key );
        if ( ! $assignment ) {
            return $this->error( 'not_assigned', __( 'This seat is not assigned.', 'aioemp' ) );
        }

        $ok = $this->assignments->unassign( $event_id, $seat_key );
        if ( ! $ok ) {
            return $this->error( 'unassign_failed', __( 'Could not unassign seat.', 'aioemp' ), 500 );
        }

        $this->seat_log->log( $event_id, (int) $assignment->attender_id, $seat_key, null, 'unassign', get_current_user_id() );

        return $this->success( array( 'unassigned' => true, 'seat_key' => $seat_key ) );
    }

    /**
     * POST /events/<id>/seating/swap — swap two assigned seats.
     */
    public function swap_seats( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id  = absint( $request->get_param( 'event_id' ) );
        $seat_key1 = sanitize_text_field( $request->get_param( 'seat_key1' ) );
        $seat_key2 = sanitize_text_field( $request->get_param( 'seat_key2' ) );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $a1 = $this->assignments->find_by_seat( $event_id, $seat_key1 );
        $a2 = $this->assignments->find_by_seat( $event_id, $seat_key2 );
        if ( ! $a1 || ! $a2 ) {
            return $this->error( 'swap_requires_both', __( 'Both seats must be assigned to swap.', 'aioemp' ) );
        }

        $ok = $this->assignments->swap( $event_id, $seat_key1, $seat_key2 );
        if ( ! $ok ) {
            return $this->error( 'swap_failed', __( 'Could not swap seats.', 'aioemp' ), 500 );
        }

        $user_id = get_current_user_id();
        $this->seat_log->log( $event_id, (int) $a1->attender_id, $seat_key1, $seat_key2, 'swap', $user_id );
        $this->seat_log->log( $event_id, (int) $a2->attender_id, $seat_key2, $seat_key1, 'swap', $user_id );

        return $this->success( array( 'swapped' => true ) );
    }

    /**
     * POST /events/<id>/seating/block — block a seat.
     */
    public function block_seat( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $seat_key = sanitize_text_field( $request->get_param( 'seat_key' ) );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }
        if ( empty( $event->seatmap_layout_snapshot ) ) {
            return $this->error( 'no_snapshot', __( 'Event has no seatmap snapshot.', 'aioemp' ) );
        }

        // Validate seat_key exists in snapshot.
        if ( ! $this->seat_exists_in_snapshot( $event->seatmap_layout_snapshot, $seat_key ) ) {
            return $this->error( 'invalid_seat', __( 'Seat key does not exist in the seatmap.', 'aioemp' ) );
        }

        // Cannot block if assigned.
        if ( $this->assignments->find_by_seat( $event_id, $seat_key ) ) {
            return $this->error( 'seat_assigned', __( 'Cannot block an assigned seat. Unassign it first.', 'aioemp' ) );
        }

        // Already blocked?
        if ( $this->blocked->is_blocked( $event_id, $seat_key ) ) {
            return $this->error( 'already_blocked', __( 'Seat is already blocked.', 'aioemp' ) );
        }

        $user_id = get_current_user_id();
        $id = $this->blocked->block( $event_id, $seat_key, $user_id );
        if ( false === $id ) {
            return $this->error( 'block_failed', __( 'Could not block seat.', 'aioemp' ), 500 );
        }

        $this->seat_log->log( $event_id, null, null, $seat_key, 'block', $user_id );

        return $this->success( array( 'blocked' => true, 'seat_key' => $seat_key ), 201 );
    }

    /**
     * POST /events/<id>/seating/unblock — unblock a seat.
     */
    public function unblock_seat( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $seat_key = sanitize_text_field( $request->get_param( 'seat_key' ) );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( ! $this->blocked->is_blocked( $event_id, $seat_key ) ) {
            return $this->error( 'not_blocked', __( 'Seat is not blocked.', 'aioemp' ) );
        }

        $ok = $this->blocked->unblock( $event_id, $seat_key );
        if ( ! $ok ) {
            return $this->error( 'unblock_failed', __( 'Could not unblock seat.', 'aioemp' ), 500 );
        }

        $this->seat_log->log( $event_id, null, $seat_key, null, 'unblock', get_current_user_id() );

        return $this->success( array( 'unblocked' => true, 'seat_key' => $seat_key ) );
    }

    /**
     * POST /events/<id>/seating/assign-batch — batch assign seats to candidates.
     *
     * Accepts { pairs: [ { attender_id, seat_key }, … ] }.
     * Handles unassign-old + assign-new per candidate in a single DB transaction.
     */
    public function assign_batch( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $pairs    = (array) $request->get_param( 'pairs' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }
        if ( empty( $event->seatmap_layout_snapshot ) ) {
            return $this->error( 'no_snapshot', __( 'Event has no seatmap snapshot.', 'aioemp' ) );
        }
        if ( empty( $pairs ) ) {
            return $this->error( 'empty_pairs', __( 'No assignment pairs provided.', 'aioemp' ) );
        }

        // Validate all seat keys and attenders up front.
        foreach ( $pairs as $pair ) {
            $seat_key    = sanitize_text_field( $pair['seat_key'] ?? '' );
            $attender_id = absint( $pair['attender_id'] ?? 0 );

            if ( ! $seat_key || ! $attender_id ) {
                return $this->error( 'invalid_pair', __( 'Each pair must have attender_id and seat_key.', 'aioemp' ) );
            }
            if ( ! $this->seat_exists_in_snapshot( $event->seatmap_layout_snapshot, $seat_key ) ) {
                return $this->error( 'invalid_seat', sprintf( __( 'Seat key %s does not exist.', 'aioemp' ), $seat_key ) );
            }
            if ( $this->blocked->is_blocked( $event_id, $seat_key ) ) {
                return $this->error( 'seat_blocked', sprintf( __( 'Seat %s is blocked.', 'aioemp' ), $seat_key ) );
            }

            $attender = $this->attenders->find( $attender_id );
            if ( ! $attender || (int) $attender->event_id !== $event_id ) {
                return $this->error( 'attender_not_found', sprintf( __( 'Candidate %d not found for this event.', 'aioemp' ), $attender_id ), 404 );
            }
        }

        // Sanitize pairs for the model.
        $clean_pairs = array_map( function ( $p ) {
            return array(
                'attender_id' => absint( $p['attender_id'] ),
                'seat_key'    => sanitize_text_field( $p['seat_key'] ),
                'seat_label'  => sanitize_text_field( $p['seat_label'] ?? '' ),
            );
        }, $pairs );

        // Auto-finalize on first assignment.
        $this->maybe_finalize( $event_id, $event );

        $user_id = get_current_user_id();
        $result  = $this->assignments->assign_batch( $event_id, $clean_pairs, $user_id );

        // Log each assignment and unassignment.
        foreach ( $result['unassigned'] as $un ) {
            $this->seat_log->log( $event_id, $un['attender_id'], $un['old_seat_key'], null, 'unassign', $user_id );
        }
        foreach ( $result['assigned'] as $a ) {
            $this->seat_log->log( $event_id, $a['attender_id'], null, $a['seat_key'], 'assign', $user_id );
        }

        return $this->success( $result, 201 );
    }

    /**
     * POST /events/<id>/seating/block-batch — block multiple seats in one call.
     */
    public function block_batch( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id  = absint( $request->get_param( 'event_id' ) );
        $seat_keys = (array) $request->get_param( 'seat_keys' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }
        if ( empty( $event->seatmap_layout_snapshot ) ) {
            return $this->error( 'no_snapshot', __( 'Event has no seatmap snapshot.', 'aioemp' ) );
        }
        if ( empty( $seat_keys ) ) {
            return $this->error( 'empty_seat_keys', __( 'No seat keys provided.', 'aioemp' ) );
        }

        // Validate all seat keys exist in the snapshot.
        foreach ( $seat_keys as $key ) {
            if ( ! $this->seat_exists_in_snapshot( $event->seatmap_layout_snapshot, $key ) ) {
                return $this->error( 'invalid_seat', sprintf( __( 'Seat key %s does not exist.', 'aioemp' ), $key ) );
            }
        }

        // Filter out any assigned seats.
        $clean_keys = array();
        foreach ( $seat_keys as $key ) {
            if ( ! $this->assignments->find_by_seat( $event_id, $key ) ) {
                $clean_keys[] = $key;
            }
        }

        $user_id = get_current_user_id();
        $result  = $this->blocked->block_batch( $event_id, $clean_keys, $user_id );

        // Log each blocked seat.
        foreach ( $result['blocked'] as $key ) {
            $this->seat_log->log( $event_id, null, null, $key, 'block', $user_id );
        }

        return $this->success( $result, 201 );
    }

    /**
     * POST /events/<id>/seating/unblock-batch — unblock multiple seats in one call.
     */
    public function unblock_batch( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id  = absint( $request->get_param( 'event_id' ) );
        $seat_keys = (array) $request->get_param( 'seat_keys' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }
        if ( empty( $seat_keys ) ) {
            return $this->error( 'empty_seat_keys', __( 'No seat keys provided.', 'aioemp' ) );
        }

        $user_id = get_current_user_id();
        $result  = $this->blocked->unblock_batch( $event_id, $seat_keys );

        // Log each unblocked seat.
        foreach ( $result['unblocked'] as $key ) {
            $this->seat_log->log( $event_id, null, $key, null, 'unblock', $user_id );
        }

        return $this->success( $result );
    }

    /**
     * POST /events/<id>/seating/unassign-batch — unassign multiple seats in one call.
     */
    public function unassign_batch( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id  = absint( $request->get_param( 'event_id' ) );
        $seat_keys = (array) $request->get_param( 'seat_keys' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }
        if ( empty( $seat_keys ) ) {
            return $this->error( 'empty_seat_keys', __( 'No seat keys provided.', 'aioemp' ) );
        }

        $user_id = get_current_user_id();
        $result  = $this->assignments->unassign_batch( $event_id, $seat_keys );

        // Log each unassigned seat.
        foreach ( $result['unassigned'] as $item ) {
            $this->seat_log->log( $event_id, $item['attender_id'], $item['seat_key'], null, 'unassign', $user_id );
        }

        return $this->success( $result );
    }

    /**
     * POST /events/<id>/seating/finalize — explicitly freeze the snapshot.
     */
    public function finalize( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $event    = $this->events->find( $event_id );

        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( ! empty( $event->seatmap_finalized_at_gmt ) ) {
            return $this->success( array( 'already_finalized' => true ) );
        }

        if ( empty( $event->seatmap_layout_snapshot ) ) {
            return $this->error( 'no_snapshot', __( 'Event has no seatmap snapshot to finalize.', 'aioemp' ) );
        }

        $this->events->update( $event_id, array(
            'seatmap_finalized_at_gmt' => current_time( 'mysql', true ),
        ) );

        return $this->success( array( 'finalized' => true ) );
    }

    /**
     * GET /events/<id>/seating/log/seat/<seat_key> — history for a specific seat.
     */
    public function get_seat_log( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $seat_key = sanitize_text_field( $request->get_param( 'seat_key' ) );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $entries = $this->seat_log->list_for_seat( $event_id, $seat_key );

        return $this->success( array(
            'seat_key' => $seat_key,
            'entries'  => $entries,
        ) );
    }

    /**
     * GET /events/<id>/seating/log/attender/<attender_id> — history for a candidate.
     */
    public function get_attender_log( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id    = absint( $request->get_param( 'event_id' ) );
        $attender_id = absint( $request->get_param( 'attender_id' ) );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $attender = $this->attenders->find( $attender_id );
        if ( ! $attender || (int) $attender->event_id !== $event_id ) {
            return $this->error( 'attender_not_found', __( 'Candidate not found for this event.', 'aioemp' ), 404 );
        }

        $entries = $this->seat_log->list_for_attender( $event_id, $attender_id );

        return $this->success( array(
            'attender_id' => $attender_id,
            'entries'     => $entries,
        ) );
    }

    /*--------------------------------------------------------------
     * Helpers
     *------------------------------------------------------------*/

    /**
     * Verify a seat_key exists within the event's seatmap snapshot.
     *
     * @param string $snapshot_json The seatmap_layout_snapshot JSON string.
     * @param string $seat_key      The seat key to look for.
     * @return bool
     */
    private function seat_exists_in_snapshot( string $snapshot_json, string $seat_key ): bool {
        $layout = json_decode( $snapshot_json );
        if ( ! $layout ) {
            return false;
        }

        // If compiled seats are present (legacy snapshots), check them.
        if ( isset( $layout->compiled->seats ) && is_array( $layout->compiled->seats ) ) {
            foreach ( $layout->compiled->seats as $seat ) {
                $seat = is_array( $seat ) ? (object) $seat : $seat;
                if ( isset( $seat->seat_key ) && $seat->seat_key === $seat_key ) {
                    return true;
                }
            }
            return false;
        }

        // Modern architecture: compiled data is NOT stored (compiled client-side).
        // Validate the key is a well-formed UUID v4 — the client has already
        // verified the key belongs to a compiled seat before sending.
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $seat_key
        );
    }

    /**
     * Auto-finalize the seatmap snapshot on first assignment.
     *
     * @param int    $event_id Event ID.
     * @param object $event    Event row.
     */
    private function maybe_finalize( int $event_id, object $event ): void {
        if ( ! empty( $event->seatmap_finalized_at_gmt ) ) {
            return; // Already finalized.
        }

        // Check if this is the first assignment.
        $count = $this->assignments->count_for_event( $event_id );
        if ( $count > 0 ) {
            return; // Already has assignments — was finalized earlier or this is a race.
        }

        // Finalize now.
        $this->events->update( $event_id, array(
            'seatmap_finalized_at_gmt' => current_time( 'mysql', true ),
        ) );
    }
}
