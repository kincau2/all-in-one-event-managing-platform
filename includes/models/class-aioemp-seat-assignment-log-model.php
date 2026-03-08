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

    /**
     * List log entries for a specific seat within an event.
     *
     * Matches rows where the seat_key appears as either original_seat or new_seat.
     * JOINs with attenders table to include candidate names.
     *
     * @param int    $event_id Event ID.
     * @param string $seat_key Seat key to look up.
     * @param int    $limit    Maximum entries (default 100).
     * @return array
     */
    public function list_for_seat( int $event_id, string $seat_key, int $limit = 100 ): array {
        $attender_table = $this->db->prefix . 'aioemp_attender';
        $users_table    = $this->db->users;
        $usermeta_table = $this->db->usermeta;

        $rows = $this->db->get_results(
            $this->db->prepare(
                "SELECT l.*, a.first_name, a.last_name, a.email AS attender_email,
                        COALESCE(
                            NULLIF(TRIM(CONCAT_WS(' ', fm.meta_value, lm.meta_value)), ''),
                            u.user_email,
                            u.display_name
                        ) AS modified_by_name
                 FROM {$this->table} l
                 LEFT JOIN {$attender_table} a ON a.id = l.attender_id
                 LEFT JOIN {$users_table} u ON u.ID = l.modified_by
                 LEFT JOIN {$usermeta_table} fm ON fm.user_id = l.modified_by AND fm.meta_key = 'first_name'
                 LEFT JOIN {$usermeta_table} lm ON lm.user_id = l.modified_by AND lm.meta_key = 'last_name'
                 WHERE l.event_id = %d
                   AND (l.original_seat = %s OR l.new_seat = %s)
                 ORDER BY l.created_at_gmt DESC
                 LIMIT %d",
                $event_id,
                $seat_key,
                $seat_key,
                $limit
            )
        );
        return $rows ?: array();
    }

    /**
     * List log entries for a specific attender within an event.
     *
     * @param int $event_id    Event ID.
     * @param int $attender_id Attender ID.
     * @param int $limit       Maximum entries (default 100).
     * @return array
     */
    public function list_for_attender( int $event_id, int $attender_id, int $limit = 100 ): array {
        $users_table    = $this->db->users;
        $usermeta_table = $this->db->usermeta;

        $rows = $this->db->get_results(
            $this->db->prepare(
                "SELECT l.*,
                        COALESCE(
                            NULLIF(TRIM(CONCAT_WS(' ', fm.meta_value, lm.meta_value)), ''),
                            u.user_email,
                            u.display_name
                        ) AS modified_by_name
                 FROM {$this->table} l
                 LEFT JOIN {$users_table} u ON u.ID = l.modified_by
                 LEFT JOIN {$usermeta_table} fm ON fm.user_id = l.modified_by AND fm.meta_key = 'first_name'
                 LEFT JOIN {$usermeta_table} lm ON lm.user_id = l.modified_by AND lm.meta_key = 'last_name'
                 WHERE l.event_id = %d AND l.attender_id = %d
                 ORDER BY l.created_at_gmt DESC
                 LIMIT %d",
                $event_id,
                $attender_id,
                $limit
            )
        );
        return $rows ?: array();
    }
}
