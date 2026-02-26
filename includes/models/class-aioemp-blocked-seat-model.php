<?php
/**
 * Blocked Seat model — data access for the aioemp_blocked_seat table.
 *
 * Manages seats that are blocked (unavailable for assignment) per event.
 * DB constraint: UNIQUE(event_id, seat_key)
 *
 * @package AIOEMP
 * @since   0.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Blocked_Seat_Model extends AIOEMP_Model {

    protected string $table_short = 'blocked_seat';

    /**
     * Block a seat.
     *
     * @param int    $event_id   Event ID.
     * @param string $seat_key   Stable seat UUID.
     * @param int    $blocked_by WP user ID.
     * @return int|false Inserted row ID or false on failure.
     */
    public function block( int $event_id, string $seat_key, int $blocked_by = 0 ) {
        $data = array(
            'event_id'       => $event_id,
            'seat_key'       => $seat_key,
            'blocked_by'     => $blocked_by ?: null,
            'blocked_at_gmt' => $this->now_gmt(),
        );

        $result = $this->db->insert( $this->table, $data );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * Unblock a seat.
     *
     * @param int    $event_id Event ID.
     * @param string $seat_key Seat key to unblock.
     * @return bool
     */
    public function unblock( int $event_id, string $seat_key ): bool {
        $result = $this->db->delete(
            $this->table,
            array( 'event_id' => $event_id, 'seat_key' => $seat_key )
        );
        return false !== $result && $this->db->rows_affected > 0;
    }

    /**
     * Check if a seat is blocked.
     *
     * @param int    $event_id Event ID.
     * @param string $seat_key Seat key.
     * @return bool
     */
    public function is_blocked( int $event_id, string $seat_key ): bool {
        $count = (int) $this->db->get_var(
            $this->db->prepare(
                "SELECT COUNT(*) FROM {$this->table} WHERE event_id = %d AND seat_key = %s",
                $event_id,
                $seat_key
            )
        );
        return $count > 0;
    }

    /**
     * List all blocked seats for an event.
     *
     * @param int $event_id Event ID.
     * @return array Array of blocked seat objects.
     */
    public function list_for_event( int $event_id ): array {
        $rows = $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table} WHERE event_id = %d ORDER BY blocked_at_gmt DESC",
                $event_id
            )
        );
        return $rows ?: array();
    }

    /**
     * Count blocked seats for an event.
     *
     * @param int $event_id Event ID.
     * @return int
     */
    public function count_for_event( int $event_id ): int {
        return (int) $this->db->get_var(
            $this->db->prepare(
                "SELECT COUNT(*) FROM {$this->table} WHERE event_id = %d",
                $event_id
            )
        );
    }
}
