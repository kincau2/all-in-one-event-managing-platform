<?php
/**
 * Seat Assignment Log model — append-only audit trail for seat operations.
 *
 * Records every assign, unassign, swap, block, and unblock action
 * for a given event. This table is append-only: never update or delete rows.
 *
 * @package AIOEMP
 * @since   0.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Seat_Assignment_Log_Model extends AIOEMP_Model {

    protected string $table_short = 'seat_assignment_log';

    /**
     * Known reason values for seat operations.
     */
    public const REASONS = array( 'assign', 'unassign', 'swap', 'block', 'unblock' );

    /**
     * Append a log entry.
     *
     * @param int         $event_id      Event ID.
     * @param int|null    $attender_id   Attender ID (null for block/unblock).
     * @param string|null $original_seat Previous seat key (null for assign/block).
     * @param string|null $new_seat      New seat key (null for unassign/unblock).
     * @param string      $reason        One of REASONS.
     * @param int         $modified_by   WP user ID who performed the action.
     * @return int|false Inserted row ID or false on failure.
     */
    public function log(
        int $event_id,
        ?int $attender_id,
        ?string $original_seat,
        ?string $new_seat,
        string $reason,
        int $modified_by = 0
    ) {
        $data = array(
            'event_id'       => $event_id,
            'attender_id'    => $attender_id,
            'modified_by'    => $modified_by ?: null,
            'original_seat'  => $original_seat,
            'new_seat'       => $new_seat,
            'reason'         => $reason,
            'created_at_gmt' => $this->now_gmt(),
        );

        $result = $this->db->insert( $this->table, $data );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * List log entries for an event.
     *
     * @param int $event_id Event ID.
     * @param int $limit    Maximum entries (default 100).
     * @return array
     */
    public function list_for_event( int $event_id, int $limit = 100 ): array {
        $rows = $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table} WHERE event_id = %d ORDER BY created_at_gmt DESC LIMIT %d",
                $event_id,
                $limit
            )
        );
        return $rows ?: array();
    }
}
