<?php
/**
 * Attendance REST controller.
 *
 * POST /aioemp/v1/events/{event_id}/resolve-ticket  — resolve QR hash to candidate
 * POST /aioemp/v1/events/{event_id}/checkin          — record check-in/out
 * GET  /aioemp/v1/events/{event_id}/attendance        — list attendance logs
 * GET  /aioemp/v1/events/{event_id}/attendance/stats  — check-in stats
 * GET  /aioemp/v1/events/{event_id}/attendance/export — CSV export
 *
 * @package AIOEMP
 * @since   0.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-attendance-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-attender-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-events-model.php';

class AIOEMP_Attendance_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'events';

    private AIOEMP_Attendance_Model $attendance;
    private AIOEMP_Attender_Model   $attender;
    private AIOEMP_Events_Model     $events;

    public function __construct() {
        $this->attendance = new AIOEMP_Attendance_Model();
        $this->attender   = new AIOEMP_Attender_Model();
        $this->events     = new AIOEMP_Events_Model();
    }

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {

        // POST resolve-ticket — resolve QR hash to candidate info.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>\d+)/resolve-ticket', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'resolve_ticket' ),
            'permission_callback' => array( $this, 'scan_permissions' ),
            'args'                => array(
                'event_id' => array( 'type' => 'integer', 'required' => true ),
                'hash'     => array( 'type' => 'string',  'required' => true ),
            ),
        ) );

        // POST checkin — record a check-in or check-out.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>\d+)/checkin', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'record_checkin' ),
            'permission_callback' => array( $this, 'scan_permissions' ),
            'args'                => array(
                'event_id'    => array( 'type' => 'integer', 'required' => true ),
                'attender_id' => array( 'type' => 'integer', 'required' => true ),
                'type'        => array( 'type' => 'string',  'required' => true, 'enum' => array( 'IN', 'OUT' ) ),
                'force'       => array( 'type' => 'boolean', 'default'  => false ),
                'device_id'   => array( 'type' => 'string',  'default'  => '' ),
            ),
        ) );

        // GET attendance logs.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>\d+)/attendance', array(
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => array( $this, 'list_attendance' ),
            'permission_callback' => array( $this, 'view_permissions' ),
            'args'                => array(
                'event_id' => array( 'type' => 'integer', 'required' => true ),
                'page'     => array( 'type' => 'integer', 'default'  => 1 ),
                'per_page' => array( 'type' => 'integer', 'default'  => 50 ),
                'search'   => array( 'type' => 'string',  'default'  => '' ),
            ),
        ) );

        // GET attendance stats.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>\d+)/attendance/stats', array(
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => array( $this, 'attendance_stats' ),
            'permission_callback' => array( $this, 'view_permissions' ),
            'args'                => array(
                'event_id' => array( 'type' => 'integer', 'required' => true ),
            ),
        ) );

        // GET attendance export (CSV).
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<event_id>\d+)/attendance/export', array(
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => array( $this, 'export_attendance' ),
            'permission_callback' => array( $this, 'view_permissions' ),
            'args'                => array(
                'event_id' => array( 'type' => 'integer', 'required' => true ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function scan_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['scan_attendance'] );
    }

    public function view_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['view_attendance'] );
    }

    /*--------------------------------------------------------------
     * POST resolve-ticket
     *------------------------------------------------------------*/

    public function resolve_ticket( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = $this->int_param( $request, 'event_id' );
        $hash     = sanitize_text_field( $request->get_param( 'hash' ) ?? '' );

        // Validate event exists.
        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( '' === $hash ) {
            return $this->error( 'hash_required', __( 'QR hash is required.', 'aioemp' ), 400 );
        }

        // Find attender by hash.
        $attender = $this->attender->find_by_qr_hash( $hash );

        if ( ! $attender ) {
            return $this->error( 'ticket_not_found', __( 'No ticket found for this QR code.', 'aioemp' ), 404 );
        }

        // Ensure attender belongs to this event.
        if ( (int) $attender->event_id !== $event_id ) {
            return $this->error( 'wrong_event', __( 'This ticket does not belong to this event.', 'aioemp' ), 400 );
        }

        // Get latest attendance record.
        $latest = $this->attendance->get_latest( $event_id, (int) $attender->id );

        // Get seat assignment if any.
        $seat_label = null;
        $checked_in = false;
        $seat_table = $GLOBALS['wpdb']->prefix . 'aioemp_seat_assignment';
        $seat = $GLOBALS['wpdb']->get_row(
            $GLOBALS['wpdb']->prepare(
                "SELECT seat_key, checked_in FROM {$seat_table} WHERE event_id = %d AND attender_id = %d",
                $event_id,
                (int) $attender->id
            )
        );
        if ( $seat ) {
            $seat_label = $seat->seat_key;
            $checked_in = (bool) $seat->checked_in;
        }

        return $this->success( array(
            'attender_id'   => (int) $attender->id,
            'first_name'    => $attender->first_name,
            'last_name'     => $attender->last_name,
            'email'         => $attender->email,
            'company'       => $attender->company,
            'status'        => $attender->status,
            'seat_label'    => $seat_label,
            'checked_in'    => $checked_in,
            'last_scan'     => $latest ? array(
                'type'       => $latest->type,
                'scanned_at' => $latest->scanned_at_gmt,
            ) : null,
        ) );
    }

    /*--------------------------------------------------------------
     * POST checkin
     *------------------------------------------------------------*/

    public function record_checkin( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id    = $this->int_param( $request, 'event_id' );
        $attender_id = $this->int_param( $request, 'attender_id' );
        $type        = strtoupper( sanitize_text_field( $request->get_param( 'type' ) ?? '' ) );
        $force       = (bool) $request->get_param( 'force' );
        $device_id   = sanitize_text_field( $request->get_param( 'device_id' ) ?? '' );

        // Validate type.
        if ( ! in_array( $type, AIOEMP_Attendance_Model::TYPES, true ) ) {
            return $this->error( 'invalid_type', __( 'Type must be IN or OUT.', 'aioemp' ), 400 );
        }

        // Validate event exists.
        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        // Validate attender exists and belongs to event.
        $attender = $this->attender->find( $attender_id );
        if ( ! $attender || (int) $attender->event_id !== $event_id ) {
            return $this->error( 'attender_not_found', __( 'Attendee not found for this event.', 'aioemp' ), 404 );
        }

        // Check candidate status — only accepted candidates can check in.
        $accepted_statuses = array( 'accepted_onsite', 'accepted_online' );
        if ( ! in_array( $attender->status, $accepted_statuses, true ) ) {
            return $this->error(
                'not_accepted',
                __( 'This attendee has not been accepted. Current status: ', 'aioemp' ) . $attender->status,
                400
            );
        }

        // Sequence validation (unless force override).
        $latest = $this->attendance->get_latest( $event_id, $attender_id );

        if ( ! $force ) {
            if ( 'IN' === $type && $latest && 'IN' === $latest->type ) {
                return $this->error(
                    'already_checked_in',
                    __( 'This attendee is already checked in. Use force=true to override.', 'aioemp' ),
                    409
                );
            }
            if ( 'OUT' === $type && ( ! $latest || 'OUT' === $latest->type ) ) {
                return $this->error(
                    'not_checked_in',
                    __( 'This attendee is not currently checked in. Use force=true to override.', 'aioemp' ),
                    409
                );
            }
        }

        // Record the scan.
        $record_data = array(
            'event_id'    => $event_id,
            'attender_id' => $attender_id,
            'type'        => $type,
            'scanned_by'  => get_current_user_id(),
        );
        if ( '' !== $device_id ) {
            $record_data['device_id'] = substr( $device_id, 0, 64 );
        }
        $record_id = $this->attendance->record( $record_data );

        if ( ! $record_id ) {
            return $this->error( 'record_failed', __( 'Failed to record attendance.', 'aioemp' ), 500 );
        }

        // Update checked_in flag on seat_assignment (denormalized cache).
        $checked_in_val = ( 'IN' === $type ) ? 1 : 0;
        $GLOBALS['wpdb']->update(
            $GLOBALS['wpdb']->prefix . 'aioemp_seat_assignment',
            array( 'checked_in' => $checked_in_val ),
            array( 'event_id' => $event_id, 'attender_id' => $attender_id )
        );

        // Log to event log.
        require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-event-log-model.php';
        $log = new AIOEMP_Event_Log_Model();
        $log->log(
            $event_id,
            'attendance_' . strtolower( $type ),
            $latest ? $latest->type : null,
            $type,
            get_current_user_id()
        );

        return $this->success( array(
            'record_id'   => $record_id,
            'type'        => $type,
            'attender_id' => $attender_id,
            'first_name'  => $attender->first_name,
            'last_name'   => $attender->last_name,
            'email'       => $attender->email,
            'forced'      => $force,
            'message'     => 'IN' === $type
                ? __( 'Checked in successfully.', 'aioemp' )
                : __( 'Checked out successfully.', 'aioemp' ),
        ), 201 );
    }

    /*--------------------------------------------------------------
     * GET attendance logs
     *------------------------------------------------------------*/

    public function list_attendance( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = $this->int_param( $request, 'event_id' );
        $page     = max( 1, absint( $request->get_param( 'page' ) ?: 1 ) );
        $per_page = min( max( absint( $request->get_param( 'per_page' ) ?: 50 ), 1 ), 100 );
        $search   = sanitize_text_field( $request->get_param( 'search' ) ?? '' );

        $result = $this->attendance->list_for_event( $event_id, array(
            'per_page' => $per_page,
            'page'     => $page,
            'search'   => $search,
        ) );

        $response = $this->success( $result->items );
        return $this->add_pagination_headers( $response, $result->total, $per_page );
    }

    /*--------------------------------------------------------------
     * GET attendance stats
     *------------------------------------------------------------*/

    public function attendance_stats( \WP_REST_Request $request ): \WP_REST_Response {
        $event_id = $this->int_param( $request, 'event_id' );

        $counts    = $this->attendance->count_for_event( $event_id );
        $att_model = $this->attender;
        $status_counts = $att_model->count_by_status( $event_id );

        return $this->success( array(
            'checked_in'       => $counts['checked_in'],
            'total_scans'      => $counts['total_scans'],
            'total_candidates' => $status_counts['total'],
            'accepted_onsite'  => $status_counts['accepted_onsite'],
            'accepted_online'  => $status_counts['accepted_online'],
        ) );
    }

    /*--------------------------------------------------------------
     * GET attendance export (CSV)
     *------------------------------------------------------------*/

    public function export_attendance( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = $this->int_param( $request, 'event_id' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $rows = $this->attendance->export_for_event( $event_id );

        // Build CSV string.
        $output = fopen( 'php://temp', 'r+' );
        fputcsv( $output, array( 'Scan ID', 'Type', 'Scanned At (GMT)', 'First Name', 'Last Name', 'Email', 'Company', 'Status', 'Scanned By', 'Device' ) );
        foreach ( $rows as $row ) {
            fputcsv( $output, array(
                $row->id,
                $row->type,
                $row->scanned_at_gmt,
                $row->first_name,
                $row->last_name,
                $row->email,
                $row->company,
                $row->attender_status,
                $row->scanned_by_name ?: '—',
                $row->device_id ?: '—',
            ) );
        }
        rewind( $output );
        $csv = stream_get_contents( $output );
        fclose( $output );

        return $this->success( array(
            'filename' => 'attendance-event-' . $event_id . '.csv',
            'csv'      => $csv,
        ) );
    }
}
