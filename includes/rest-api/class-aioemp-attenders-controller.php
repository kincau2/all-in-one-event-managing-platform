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
require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-seat-assignment-model.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-email-service.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-ticket-endpoint.php';

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
                'permission_callback' => array( $this, 'view_permission' ),
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
                'permission_callback' => array( $this, 'view_permission' ),
            ),
        ) );

        // Bulk status change (DB only — no email).
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

        // Bulk delete.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/bulk-delete', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'bulk_delete' ),
                'permission_callback' => array( $this, 'manage_permission' ),
                'args'                => array(
                    'ids' => array(
                        'type'     => 'array',
                        'required' => true,
                        'items'    => array( 'type' => 'integer' ),
                    ),
                ),
            ),
        ) );

        // Bulk resend email (one at a time from JS, but endpoint handles a small batch).
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/bulk-resend', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'bulk_resend' ),
                'permission_callback' => array( $this, 'manage_permission' ),
                'args'                => array(
                    'ids' => array(
                        'type'     => 'array',
                        'required' => true,
                        'items'    => array( 'type' => 'integer' ),
                    ),
                ),
            ),
        ) );

        // Batch process — update status + send emails for a small batch.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/batch-process', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'batch_process' ),
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
                'permission_callback' => array( $this, 'view_permission' ),
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

        // Resend email for a single candidate.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)/resend-email', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'resend_email' ),
            'permission_callback' => array( $this, 'manage_permission' ),
        ) );

        // CSV export — download all candidates as CSV.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/export-csv', array(
            'methods'             => \WP_REST_Server::READABLE,
            'callback'            => array( $this, 'export_csv' ),
            'permission_callback' => array( $this, 'manage_permission' ),
        ) );

        // CSV import — upload CSV to create or update candidates.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/import-csv', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'import_csv' ),
            'permission_callback' => array( $this, 'manage_permission' ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    /**
     * Read-only access: list, get, counts.
     *
     * Granted to users with view_candidates (Candidates tab),
     * manage_seating (Seating tab loads candidates), or
     * scan_attendance (Check In tab looks up candidates).
     */
    public function view_permission(): bool|\WP_Error {
        if (
            current_user_can( AIOEMP_Security::CAPS['view_candidates'] ) ||
            current_user_can( AIOEMP_Security::CAPS['manage_seating'] ) ||
            current_user_can( AIOEMP_Security::CAPS['scan_attendance'] )
        ) {
            return true;
        }
        return $this->check_permission( AIOEMP_Security::CAPS['view_candidates'] );
    }

    /**
     * Write access: create, update, delete, bulk.
     */
    public function manage_permission(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_candidates'] );
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

        // Venue-mode guard on status at creation.
        if ( isset( $data['status'] ) ) {
            $event = $this->events->find( $event_id );
            if ( $event ) {
                $venue_err = $this->validate_status_venue_mode( $data['status'], $event );
                if ( $venue_err ) {
                    return $venue_err;
                }
            }
        }

        $id = $this->model->create( $data );
        if ( false === $id ) {
            return $this->error( 'create_failed', __( 'Could not create candidate.', 'aioemp' ), 500 );
        }

        // Audit log.
        $this->log->log( $event_id, 'attender_created', array(), $data, get_current_user_id() );

        $attender = $this->model->find( $id );

        // Send email for newly-created candidate.
        $this->maybe_send_create_email( $attender, $event_id );

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

        // Venue-mode guard on status changes.
        if ( isset( $data['status'] ) ) {
            $event = $this->events->find( $event_id );
            if ( $event ) {
                $venue_err = $this->validate_status_venue_mode( $data['status'], $event );
                if ( $venue_err ) {
                    return $venue_err;
                }
            }
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

        $updated_attender = $this->model->find( $id );

        // Send status change email if status was changed.
        if ( isset( $data['status'] ) && $data['status'] !== ( $previous['status'] ?? '' ) ) {
            $this->maybe_send_status_email( $updated_attender, $data['status'], $event_id );
        }

        return $this->success( $updated_attender );
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
     * POST /events/<event_id>/attenders/bulk-status — bulk status change (DB only, no email).
     */
    public function bulk_status( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id   = absint( $request->get_param( 'event_id' ) );
        $ids        = $request->get_param( 'ids' );
        $new_status = $this->text_param( $request, 'status' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( ! in_array( $new_status, AIOEMP_Attender_Model::STATUSES, true ) ) {
            return $this->error( 'invalid_status', __( 'Invalid status value.', 'aioemp' ) );
        }

        // Venue-mode guard.
        $venue_err = $this->validate_status_venue_mode( $new_status, $event );
        if ( $venue_err ) {
            return $venue_err;
        }

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return $this->error( 'no_ids', __( 'No candidates selected.', 'aioemp' ) );
        }

        $updated = $this->model->bulk_update_status( $event_id, $ids, $new_status );

        // Audit log.
        $this->log->log( $event_id, 'attender_bulk_status', array( 'ids' => $ids ), array( 'status' => $new_status, 'updated' => $updated ), get_current_user_id() );

        return $this->success( array( 'updated' => $updated ) );
    }

    /**
     * POST /events/<event_id>/attenders/batch-process — update status + send email
     * for a small batch of candidates (≤ 5 at a time, driven by the JS progress bar).
     */
    public function batch_process( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id   = absint( $request->get_param( 'event_id' ) );
        $ids        = $request->get_param( 'ids' );
        $new_status = $this->text_param( $request, 'status' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( ! in_array( $new_status, AIOEMP_Attender_Model::STATUSES, true ) ) {
            return $this->error( 'invalid_status', __( 'Invalid status value.', 'aioemp' ) );
        }

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return $this->error( 'no_ids', __( 'No candidates in batch.', 'aioemp' ) );
        }

        // Venue-mode guard.
        $venue_err = $this->validate_status_venue_mode( $new_status, $event );
        if ( $venue_err ) {
            return $venue_err;
        }

        // Cap per call — respect the configured batch size (max 50).
        $batch_limit = (int) AIOEMP_Settings_Service::get( 'email_batch_size' );
        $batch_limit = max( 1, min( $batch_limit, 50 ) );
        $ids = array_slice( $ids, 0, $batch_limit );

        // Update status in DB.
        $updated = $this->model->bulk_update_status( $event_id, $ids, $new_status );

        // Send emails one by one with a small pause.
        $sent   = 0;
        $failed = array();
        $has_template = isset( self::STATUS_EMAIL_MAP[ $new_status ] );

        if ( $updated > 0 && $has_template ) {
            foreach ( $ids as $att_id ) {
                $att = $this->model->find( absint( $att_id ) );
                if ( ! $att ) {
                    continue;
                }
                $email = $att->email ?? '';
                if ( empty( $email ) || ! is_email( $email ) ) {
                    continue;
                }

                $template_type = self::STATUS_EMAIL_MAP[ $new_status ];
                $variables     = $this->build_email_variables( $att, $event, $template_type );
                $ok            = AIOEMP_Email_Service::send( $template_type, $email, $variables, $att->preferred_language ?? null );

                if ( $ok ) {
                    $sent++;
                } else {
                    $failed[] = $att_id;
                }
            }
        }

        return $this->success( array(
            'updated' => $updated,
            'sent'    => $sent,
            'failed'  => $failed,
        ) );
    }

    /**
     * POST /events/<event_id>/attenders/bulk-delete — delete multiple candidates.
     */
    public function bulk_delete( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $ids      = $request->get_param( 'ids' );

        if ( ! $this->events->find( $event_id ) ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return $this->error( 'no_ids', __( 'No candidates selected.', 'aioemp' ) );
        }

        $deleted = $this->model->bulk_delete( $event_id, $ids );

        // Audit log.
        $this->log->log( $event_id, 'attender_bulk_delete', array( 'ids' => $ids ), array( 'deleted' => $deleted ), get_current_user_id() );

        return $this->success( array( 'deleted' => $deleted ) );
    }

    /**
     * POST /events/<event_id>/attenders/bulk-resend — resend emails for a small batch.
     */
    public function bulk_resend( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $ids      = $request->get_param( 'ids' );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        if ( ! is_array( $ids ) || empty( $ids ) ) {
            return $this->error( 'no_ids', __( 'No candidates selected.', 'aioemp' ) );
        }

        // Cap at 10 per call.
        $ids = array_slice( $ids, 0, 10 );

        $sent    = 0;
        $skipped = 0;
        $failed  = array();

        foreach ( $ids as $att_id ) {
            $att = $this->model->find( absint( $att_id ) );
            if ( ! $att || (int) ( $att->event_id ?? 0 ) !== $event_id ) {
                $skipped++;
                continue;
            }

            $status = $att->status ?? '';
            if ( ! isset( self::CREATE_EMAIL_MAP[ $status ] ) ) {
                $skipped++;
                continue;
            }

            $email = $att->email ?? '';
            if ( empty( $email ) || ! is_email( $email ) ) {
                $skipped++;
                continue;
            }

            $template_type = self::CREATE_EMAIL_MAP[ $status ];
            $variables     = $this->build_email_variables( $att, $event, $template_type );
            $ok            = AIOEMP_Email_Service::send( $template_type, $email, $variables, $att->preferred_language ?? null );

            if ( $ok ) {
                $sent++;
            } else {
                $failed[] = $att_id;
            }
        }

        return $this->success( array(
            'sent'    => $sent,
            'skipped' => $skipped,
            'failed'  => $failed,
        ) );
    }

    /*--------------------------------------------------------------
     * Data extraction & validation
     *------------------------------------------------------------*/

    /**
     * Validate that the requested status is compatible with the event's venue_mode.
     *
     * @param string $status  Candidate status being set.
     * @param object $event   Event record.
     * @return \WP_Error|null  Error if invalid, null if OK.
     */
    private function validate_status_venue_mode( string $status, object $event ): ?\WP_Error {
        $mode = $event->venue_mode ?? 'mixed';

        if ( $mode === 'onsite' && $status === 'accepted_online' ) {
            return $this->error(
                'venue_mode_mismatch',
                __( 'Cannot set status to "Accepted Online" — this is an on-site event.', 'aioemp' )
            );
        }

        if ( $mode === 'online' && $status === 'accepted_onsite' ) {
            return $this->error(
                'venue_mode_mismatch',
                __( 'Cannot set status to "Accepted On-site" — this is an online event.', 'aioemp' )
            );
        }

        return null;
    }

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

        // Preferred language.
        $lang = $request->get_param( 'preferred_language' );
        if ( null !== $lang ) {
            $data['preferred_language'] = preg_replace( '/[^a-zA-Z0-9_\-]/', '', (string) $lang );
        }

        // Online URL (per-candidate Zoom link).
        $online_url = $request->get_param( 'online_url' );
        if ( null !== $online_url ) {
            $data['online_url'] = esc_url_raw( (string) $online_url );
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
            'first_name'         => array( 'type' => 'string' ),
            'last_name'          => array( 'type' => 'string' ),
            'email'              => array( 'type' => 'string' ),
            'title'              => array( 'type' => 'string' ),
            'company'            => array( 'type' => 'string' ),
            'preferred_language' => array( 'type' => 'string' ),
            'online_url'         => array( 'type' => 'string' ),
            'status'     => array(
                'type' => 'string',
                'enum' => AIOEMP_Attender_Model::STATUSES,
            ),
        );
    }

    /*--------------------------------------------------------------
     * Email notification helpers
     *------------------------------------------------------------*/

    /**
     * Map attender status → email template type (for status *changes*).
     */
    private const STATUS_EMAIL_MAP = array(
        'accepted_onsite' => 'accepted_onsite',
        'accepted_online' => 'accepted_online',
        'rejected'        => 'rejected',
    );

    /**
     * Map attender status → email template type (for resend / newly-created).
     * Includes 'registered' → registration_confirmation.
     */
    private const CREATE_EMAIL_MAP = array(
        'registered'       => 'registration_confirmation',
        'accepted_onsite'  => 'accepted_onsite',
        'accepted_online'  => 'accepted_online',
        'rejected'         => 'rejected',
    );

    /**
     * POST /events/<id>/attenders/<id>/resend-email
     *
     * Resend the email that corresponds to the candidate's current status.
     */
    public function resend_email( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id    = absint( $request->get_param( 'event_id' ) );
        $attender_id = absint( $request->get_param( 'id' ) );

        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $attender = $this->model->find( $attender_id );
        if ( ! $attender || (int) ( $attender->event_id ?? 0 ) !== $event_id ) {
            return $this->error( 'attender_not_found', __( 'Candidate not found.', 'aioemp' ), 404 );
        }

        $status = $attender->status ?? '';
        if ( ! isset( self::CREATE_EMAIL_MAP[ $status ] ) ) {
            return $this->error( 'no_template', __( 'No email template for this candidate status.', 'aioemp' ) );
        }

        $email = $attender->email ?? '';
        if ( empty( $email ) || ! is_email( $email ) ) {
            return $this->error( 'invalid_email', __( 'Candidate has no valid email address.', 'aioemp' ) );
        }

        $template_type = self::CREATE_EMAIL_MAP[ $status ];
        $variables     = $this->build_email_variables( $attender, $event, $template_type );
        $sent          = AIOEMP_Email_Service::send( $template_type, $email, $variables, $attender->preferred_language ?? null );

        if ( ! $sent ) {
            return $this->error( 'send_failed', __( 'Failed to send email.', 'aioemp' ), 500 );
        }

        return $this->success( array(
            'sent'     => true,
            'template' => $template_type,
            'to'       => $email,
        ) );
    }

    /**
     * Send an email for a newly-created candidate.
     *
     * @param object|null $attender Attender record.
     * @param int         $event_id Event ID.
     */
    private function maybe_send_create_email( ?object $attender, int $event_id ): void {
        if ( ! $attender ) {
            return;
        }

        $status = $attender->status ?? 'registered';

        if ( ! isset( self::CREATE_EMAIL_MAP[ $status ] ) ) {
            return;
        }

        $email = $attender->email ?? '';
        if ( empty( $email ) || ! is_email( $email ) ) {
            error_log( '[AIOEMP] Skipping create email: no valid email for attender #' . ( $attender->id ?? '?' ) );
            return;
        }

        $template_type = self::CREATE_EMAIL_MAP[ $status ];
        $event = $this->events->find( $event_id );
        if ( ! $event ) {
            error_log( '[AIOEMP] Skipping create email: event #' . $event_id . ' not found' );
            return;
        }

        $variables = $this->build_email_variables( $attender, $event, $template_type );

        error_log( '[AIOEMP] Sending ' . $template_type . ' email to ' . $email . ' (attender #' . $attender->id . ')' );
        $sent = AIOEMP_Email_Service::send( $template_type, $email, $variables, $attender->preferred_language ?? null );
        if ( ! $sent ) {
            error_log( '[AIOEMP] FAILED to send ' . $template_type . ' email to ' . $email );
        }
    }

    /**
     * Send a status-change email for an attender, if a matching template exists.
     *
     * @param object $attender   Attender record (after update).
     * @param string $new_status The new status value.
     * @param int    $event_id   Event ID.
     * @return void
     */
    private function maybe_send_status_email( object $attender, string $new_status, int $event_id, ?object $event = null ): void {
        if ( ! isset( self::STATUS_EMAIL_MAP[ $new_status ] ) ) {
            return;
        }

        $email = $attender->email ?? '';
        if ( empty( $email ) || ! is_email( $email ) ) {
            return;
        }

        $template_type = self::STATUS_EMAIL_MAP[ $new_status ];
        if ( ! $event ) {
            $event = $this->events->find( $event_id );
        }
        if ( ! $event ) {
            return;
        }

        $variables = $this->build_email_variables( $attender, $event, $template_type );

        AIOEMP_Email_Service::send( $template_type, $email, $variables, $attender->preferred_language ?? null );
    }

    /**
     * Build the placeholder variables array for an email template.
     *
     * @param object $attender      Attender record.
     * @param object $event         Event record.
     * @param string $template_type Email template type.
     * @return array<string, string>
     */
    private function build_email_variables( object $attender, object $event, string $template_type ): array {
        $variables = array(
            'first_name'     => $attender->first_name ?? '',
            'last_name'      => $attender->last_name ?? '',
            'full_name'      => trim( ( $attender->first_name ?? '' ) . ' ' . ( $attender->last_name ?? '' ) ),
            'email'          => $attender->email ?? '',
            'event_title'    => $event->title ?? '',
            'event_date'     => AIOEMP_Email_Service::format_date( $event->start_date_gmt ?? null ),
            'event_location' => AIOEMP_Email_Service::get_event_location( $event ),
        );

        // Onsite-specific variables.
        if ( 'accepted_onsite' === $template_type ) {
            $qr_hash    = $attender->qrcode_hash ?? '';
            $ticket_url = $qr_hash ? AIOEMP_Ticket_Endpoint::get_ticket_url( $qr_hash ) : '';

            // Look up seat assignment for an assigned seat label.
            $seat_label = '';
            $seat_line  = '';
            $seat_model = new AIOEMP_Seat_Assignment_Model();
            $assignment = $seat_model->find_by_attender( (int) $event->id, (int) $attender->id );
            if ( $assignment && ! empty( $assignment->seat_key ) ) {
                $seat_label = ! empty( $assignment->seat_label ) ? $assignment->seat_label : $assignment->seat_key;
                $seat_line  = '<br><strong>Seat:</strong> ' . esc_html( $seat_label );
            }

            // QR code image — full <img> tag so the placeholder is clean in editors.
            $qr_code_image = '';
            if ( $ticket_url ) {
                $qr_src        = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' . rawurlencode( $ticket_url );
                $qr_code_image = '<img src="' . esc_url( $qr_src ) . '" alt="QR Code" width="200" height="200" style="display:block;margin:0 auto 16px;" />';
            }

            $variables['ticket_url']    = $ticket_url;
            $variables['qr_code_url']   = $ticket_url;
            $variables['qr_code_image'] = $qr_code_image;
            $variables['seat_label']    = $seat_label;
            $variables['seat_line']     = $seat_line;
        }

        // Online-specific variables.
        if ( 'accepted_online' === $template_type ) {
            $variables['online_url'] = $attender->online_url ?? '';
        }

        return $variables;
    }

    /*--------------------------------------------------------------
     * CSV Export / Import
     *------------------------------------------------------------*/

    /**
     * CSV column headers used for export (no status — status is not managed via CSV).
     */
    private const CSV_COLUMNS = array( 'id', 'title', 'first_name', 'last_name', 'email', 'company', 'preferred_language', 'online_url' );

    /**
     * GET /events/<event_id>/attenders/export-csv — download candidates as CSV.
     *
     * Supports optional filters:
     *  - ids    : comma-separated attender IDs (export only selected)
     *  - status : filter by status
     *  - search : filter by name/email search term
     * If no filters are provided, all candidates are exported.
     */
    public function export_csv( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $event    = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        // Build query args from optional filters.
        $args = array(
            'per_page' => 100000,
            'page'     => 1,
        );

        $ids_raw = $this->text_param( $request, 'ids' );
        if ( $ids_raw ) {
            $args['ids'] = array_filter( array_map( 'absint', explode( ',', $ids_raw ) ) );
        }

        $status = $this->text_param( $request, 'status' );
        if ( $status ) {
            $args['status'] = $status;
        }

        $search = $this->text_param( $request, 'search' );
        if ( $search ) {
            $args['search'] = $search;
        }

        $result = $this->model->list_for_event( $event_id, $args );

        $handle = fopen( 'php://temp', 'r+' );
        fputcsv( $handle, self::CSV_COLUMNS );

        foreach ( $result->items as $row ) {
            $line = array();
            foreach ( self::CSV_COLUMNS as $col ) {
                $line[] = $row->$col ?? '';
            }
            fputcsv( $handle, $line );
        }

        rewind( $handle );
        $csv = stream_get_contents( $handle );
        fclose( $handle );

        $response = new \WP_REST_Response( $csv );
        $response->header( 'Content-Type', 'text/csv; charset=utf-8' );
        $response->header( 'Content-Disposition', 'attachment; filename="candidates-event-' . $event_id . '.csv"' );
        return $response;
    }

    /**
     * POST /events/<event_id>/attenders/import-csv — import candidates from CSV.
     *
     * Accepts multipart form: file (CSV), mode ('new' or 'update').
     * - new:    ignore id column, create all rows as new candidates. Returns created_ids.
     * - update: match rows by id within this event; unmatched IDs are skipped (not created).
     */
    public function import_csv( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $event_id = absint( $request->get_param( 'event_id' ) );
        $event    = $this->events->find( $event_id );
        if ( ! $event ) {
            return $this->error( 'event_not_found', __( 'Event not found.', 'aioemp' ), 404 );
        }

        $mode = $this->text_param( $request, 'mode' );
        if ( ! in_array( $mode, array( 'new', 'update' ), true ) ) {
            return $this->error( 'invalid_mode', __( 'Mode must be "new" or "update".', 'aioemp' ) );
        }

        $files = $request->get_file_params();
        if ( empty( $files['file'] ) || empty( $files['file']['tmp_name'] ) ) {
            return $this->error( 'no_file', __( 'No CSV file uploaded.', 'aioemp' ) );
        }

        $file = $files['file'];

        // Validate MIME type — allow text/csv and related.
        $finfo = finfo_open( FILEINFO_MIME_TYPE );
        $mime  = finfo_file( $finfo, $file['tmp_name'] );
        finfo_close( $finfo );

        $allowed_mimes = array( 'text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel' );
        if ( ! in_array( $mime, $allowed_mimes, true ) ) {
            return $this->error( 'invalid_mime', __( 'File must be a CSV.', 'aioemp' ) );
        }

        // 5 MB limit.
        if ( $file['size'] > 5 * 1024 * 1024 ) {
            return $this->error( 'file_too_large', __( 'CSV file must be under 5 MB.', 'aioemp' ) );
        }

        $handle = fopen( $file['tmp_name'], 'r' );
        if ( ! $handle ) {
            return $this->error( 'open_failed', __( 'Could not read CSV file.', 'aioemp' ), 500 );
        }

        // Read & validate header row.
        $header = fgetcsv( $handle );
        if ( ! $header ) {
            fclose( $handle );
            return $this->error( 'empty_csv', __( 'CSV file is empty.', 'aioemp' ) );
        }

        // Normalize header (trim, lowercase).
        $header = array_map( function ( $h ) {
            return strtolower( trim( $h ) );
        }, $header );

        // Must contain at least first_name or last_name.
        if ( ! in_array( 'first_name', $header, true ) && ! in_array( 'last_name', $header, true ) ) {
            fclose( $handle );
            return $this->error( 'missing_name_column', __( 'CSV must contain a first_name or last_name column.', 'aioemp' ) );
        }

        // New mode must NOT contain an id column (prevents accidental re-import).
        if ( $mode === 'new' && in_array( 'id', $header, true ) ) {
            fclose( $handle );
            return $this->error( 'id_column_not_allowed', __( 'CSV must not contain an ID column when adding new candidates. Remove the ID column and try again.', 'aioemp' ) );
        }

        $allowed_fields = array( 'title', 'first_name', 'last_name', 'email', 'company', 'status', 'preferred_language', 'online_url' );
        $id_col_index   = array_search( 'id', $header, true );

        $created     = 0;
        $updated     = 0;
        $skipped     = 0;
        $errors      = array();
        $created_ids = array();
        $row_num     = 1; // 1 = header, data starts at 2.

        while ( ( $row = fgetcsv( $handle ) ) !== false ) {
            $row_num++;

            // Skip empty rows.
            if ( empty( array_filter( $row, function ( $v ) { return trim( $v ) !== ''; } ) ) ) {
                continue;
            }

            // Map row to associative array using header.
            $record = array();
            foreach ( $header as $i => $col ) {
                $record[ $col ] = isset( $row[ $i ] ) ? trim( $row[ $i ] ) : '';
            }

            // Build data for insert/update.
            $data = array();
            foreach ( $allowed_fields as $field ) {
                if ( isset( $record[ $field ] ) && $record[ $field ] !== '' ) {
                    if ( $field === 'email' ) {
                        $data[ $field ] = sanitize_email( $record[ $field ] );
                    } elseif ( $field === 'status' ) {
                        if ( in_array( $record[ $field ], AIOEMP_Attender_Model::STATUSES, true ) ) {
                            $data[ $field ] = $record[ $field ];
                        }
                    } elseif ( $field === 'preferred_language' ) {
                        $data[ $field ] = preg_replace( '/[^a-zA-Z0-9_\\-]/', '', $record[ $field ] );
                    } elseif ( $field === 'online_url' ) {
                        $data[ $field ] = esc_url_raw( $record[ $field ] );
                    } elseif ( $field === 'title' ) {
                        $data[ $field ] = AIOEMP_Security::sanitize_text( $record[ $field ] );
                    } else {
                        $data[ $field ] = AIOEMP_Security::sanitize_text( $record[ $field ] );
                    }
                }
            }

            // Must have a name.
            if ( empty( $data['first_name'] ) && empty( $data['last_name'] ) ) {
                $skipped++;
                $errors[] = sprintf( 'Row %d: missing name, skipped.', $row_num );
                continue;
            }

            // Update mode: match by ID — unmatched rows are skipped (not created).
            if ( $mode === 'update' ) {
                if ( $id_col_index === false || empty( $record['id'] ) ) {
                    $skipped++;
                    $errors[] = sprintf( 'Row %d: no ID provided, skipped.', $row_num );
                    continue;
                }

                $existing_id = absint( $record['id'] );
                $existing    = $this->model->find( $existing_id );

                if ( $existing && (int) $existing->event_id === $event_id ) {
                    $this->model->update( $existing_id, $data );
                    $updated++;
                } else {
                    $skipped++;
                    $errors[] = sprintf( 'Row %d: Candidate ID %d not found in this event.', $row_num, $existing_id );
                }
                continue;
            }

            // New mode: create candidate.
            $data['event_id'] = $event_id;
            $id = $this->model->create( $data );
            if ( $id ) {
                $created++;
                $created_ids[] = (int) $id;
            } else {
                $skipped++;
                $errors[] = sprintf( 'Row %d: insert failed.', $row_num );
            }
        }

        fclose( $handle );

        $result = array(
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors'  => array_slice( $errors, 0, 50 ), // cap error list
        );

        // In 'new' mode, return created IDs so the frontend can trigger registration emails.
        if ( $mode === 'new' && ! empty( $created_ids ) ) {
            $result['created_ids'] = $created_ids;
        }

        return $this->success( $result );
    }
}
