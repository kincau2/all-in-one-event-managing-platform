<?php
/**
 * Seat Assignment model — data access for the aioemp_seat_assignment table.
 *
 * Manages seat ↔ candidate mapping per event.
 * DB constraints:
 *   - UNIQUE(event_id, seat_key)   — one person per seat
 *   - UNIQUE(event_id, attender_id) — one seat per person
 *
 * @package AIOEMP
 * @since   0.3.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Seat_Assignment_Model extends AIOEMP_Model {

    protected string $table_short = 'seat_assignment';

    /**
     * Assign a seat to a candidate.
     *
     * @param int    $event_id    Event ID.
     * @param int    $attender_id Candidate (attender) ID.
     * @param string $seat_key    Stable seat UUID from compiled layout.
     * @param int    $assigned_by WP user ID who made the assignment.
     * @return int|false Inserted row ID or false on failure.
     */
    public function assign( int $event_id, int $attender_id, string $seat_key, int $assigned_by = 0 ) {
        $data = array(
            'event_id'       => $event_id,
            'attender_id'    => $attender_id,
            'seat_key'       => $seat_key,
            'assigned_by'    => $assigned_by ?: null,
            'assigned_at_gmt' => $this->now_gmt(),
        );

        $result = $this->db->insert( $this->table, $data );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * Unassign (remove) a seat assignment.
     *
     * @param int    $event_id Event ID.
     * @param string $seat_key Seat key to free.
     * @return bool
     */
    public function unassign( int $event_id, string $seat_key ): bool {
        $result = $this->db->delete(
            $this->table,
            array( 'event_id' => $event_id, 'seat_key' => $seat_key )
        );
        return false !== $result && $this->db->rows_affected > 0;
    }

    /**
     * Unassign by attender (free a candidate's seat).
     *
     * @param int $event_id    Event ID.
     * @param int $attender_id Attender ID.
     * @return bool
     */
    public function unassign_by_attender( int $event_id, int $attender_id ): bool {
        $result = $this->db->delete(
            $this->table,
            array( 'event_id' => $event_id, 'attender_id' => $attender_id )
        );
        return false !== $result && $this->db->rows_affected > 0;
    }

    /**
     * Get the assignment for a specific seat.
     *
     * @param int    $event_id Event ID.
     * @param string $seat_key Seat key.
     * @return object|null Assignment row or null.
     */
    public function find_by_seat( int $event_id, string $seat_key ): ?object {
        $row = $this->db->get_row(
            $this->db->prepare(
                "SELECT * FROM {$this->table} WHERE event_id = %d AND seat_key = %s",
                $event_id,
                $seat_key
            )
        );
        return $row ?: null;
    }

    /**
     * Get the assignment for a specific candidate.
     *
     * @param int $event_id    Event ID.
     * @param int $attender_id Attender ID.
     * @return object|null Assignment row or null.
     */
    public function find_by_attender( int $event_id, int $attender_id ): ?object {
        $row = $this->db->get_row(
            $this->db->prepare(
                "SELECT * FROM {$this->table} WHERE event_id = %d AND attender_id = %d",
                $event_id,
                $attender_id
            )
        );
        return $row ?: null;
    }

    /**
     * List all seat assignments for an event.
     *
     * Returns assignments joined with attender data so the frontend
     * can display names alongside seat dots.
     *
     * @param int $event_id Event ID.
     * @return array Array of assignment objects.
     */
    public function list_for_event( int $event_id ): array {
        global $wpdb;
        $attender_table = $wpdb->prefix . 'aioemp_attender';

        $rows = $this->db->get_results(
            $this->db->prepare(
                "SELECT sa.*, sa.checked_in, a.first_name, a.last_name, a.email, a.status AS attender_status
                 FROM {$this->table} sa
                 LEFT JOIN {$attender_table} a ON a.id = sa.attender_id
                 WHERE sa.event_id = %d
                 ORDER BY sa.assigned_at_gmt DESC",
                $event_id
            )
        );

        return $rows ?: array();
    }

    /**
     * Count total assignments for an event.
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

    /**
     * Swap two seat assignments within the same event.
     *
     * Temporarily removes both, then re-inserts with swapped keys.
     * Uses a transaction for atomicity.
     *
     * @param int    $event_id  Event ID.
     * @param string $seat_key1 First seat key.
     * @param string $seat_key2 Second seat key.
     * @return bool
     */
    public function swap( int $event_id, string $seat_key1, string $seat_key2 ): bool {
        $a1 = $this->find_by_seat( $event_id, $seat_key1 );
        $a2 = $this->find_by_seat( $event_id, $seat_key2 );

        if ( ! $a1 || ! $a2 ) {
            return false;
        }

        $this->db->query( 'START TRANSACTION' );

        // Preserve checked_in flags before deleting.
        $ci1 = isset( $a1->checked_in ) ? (int) $a1->checked_in : 0;
        $ci2 = isset( $a2->checked_in ) ? (int) $a2->checked_in : 0;

        // Delete both.
        $this->db->delete( $this->table, array( 'id' => $a1->id ) );
        $this->db->delete( $this->table, array( 'id' => $a2->id ) );

        // Re-insert swapped — preserve each candidate's checked_in status.
        $r1 = $this->db->insert( $this->table, array(
            'event_id'        => $event_id,
            'attender_id'     => $a1->attender_id,
            'seat_key'        => $seat_key2,
            'checked_in'      => $ci1,
            'assigned_by'     => get_current_user_id() ?: null,
            'assigned_at_gmt' => $this->now_gmt(),
        ) );

        $r2 = $this->db->insert( $this->table, array(
            'event_id'        => $event_id,
            'attender_id'     => $a2->attender_id,
            'seat_key'        => $seat_key1,
            'checked_in'      => $ci2,
            'assigned_by'     => get_current_user_id() ?: null,
            'assigned_at_gmt' => $this->now_gmt(),
        ) );

        if ( $r1 && $r2 ) {
            $this->db->query( 'COMMIT' );
            return true;
        }

        $this->db->query( 'ROLLBACK' );
        return false;
    }

    /**
     * Batch-assign seats to candidates in a single DB transaction.
     *
     * Each pair is { attender_id, seat_key }.  If the candidate already has a
     * seat the old assignment is removed first (re-assignment).  If the target
     * seat is taken by someone else or blocked the pair is skipped.
     *
     * @param int    $event_id    Event ID.
     * @param array  $pairs       Array of [ 'attender_id' => int, 'seat_key' => string ].
     * @param int    $assigned_by WP user ID.
     * @return array { assigned: array, unassigned: array, skipped: array, failed: array }
     */
    public function assign_batch( int $event_id, array $pairs, int $assigned_by = 0 ): array {
        $result = array(
            'assigned'   => array(),
            'unassigned' => array(),
            'skipped'    => array(),
            'failed'     => array(),
        );

        if ( empty( $pairs ) ) {
            return $result;
        }

        $now = $this->now_gmt();
        $this->db->query( 'START TRANSACTION' );

        foreach ( $pairs as $pair ) {
            $attender_id = (int) $pair['attender_id'];
            $seat_key    = (string) $pair['seat_key'];

            // If the target seat is already taken by someone else, skip.
            $current_holder = $this->find_by_seat( $event_id, $seat_key );
            if ( $current_holder && (int) $current_holder->attender_id !== $attender_id ) {
                $result['skipped'][] = array( 'attender_id' => $attender_id, 'seat_key' => $seat_key, 'reason' => 'seat_taken' );
                continue;
            }

            // If the candidate already sits in the target seat, nothing to do.
            if ( $current_holder && (int) $current_holder->attender_id === $attender_id ) {
                $result['skipped'][] = array( 'attender_id' => $attender_id, 'seat_key' => $seat_key, 'reason' => 'already_assigned' );
                continue;
            }

            // If the candidate already has a different seat, unassign it first.
            $existing = $this->find_by_attender( $event_id, $attender_id );
            $preserve_checked_in = 0;
            if ( $existing ) {
                $preserve_checked_in = isset( $existing->checked_in ) ? (int) $existing->checked_in : 0;
                $this->db->delete( $this->table, array( 'id' => $existing->id ) );
                $result['unassigned'][] = array( 'attender_id' => $attender_id, 'old_seat_key' => $existing->seat_key );
            }

            // Insert new assignment — preserve checked_in if reassigning.
            $ok = $this->db->insert( $this->table, array(
                'event_id'        => $event_id,
                'attender_id'     => $attender_id,
                'seat_key'        => $seat_key,
                'checked_in'      => $preserve_checked_in,
                'assigned_by'     => $assigned_by ?: null,
                'assigned_at_gmt' => $now,
            ) );

            if ( $ok ) {
                $result['assigned'][] = array( 'attender_id' => $attender_id, 'seat_key' => $seat_key );
            } else {
                $result['failed'][] = array( 'attender_id' => $attender_id, 'seat_key' => $seat_key );
            }
        }

        $this->db->query( 'COMMIT' );
        return $result;
    }

    /**
     * Batch-unassign multiple seats in a single DB transaction.
     *
     * @param int   $event_id  Event ID.
     * @param array $seat_keys Array of seat key strings.
     * @return array { unassigned: array, skipped: array, failed: array }
     */
    public function unassign_batch( int $event_id, array $seat_keys ): array {
        $result = array( 'unassigned' => array(), 'skipped' => array(), 'failed' => array() );
        if ( empty( $seat_keys ) ) {
            return $result;
        }

        $this->db->query( 'START TRANSACTION' );

        foreach ( $seat_keys as $seat_key ) {
            $assignment = $this->find_by_seat( $event_id, $seat_key );
            if ( ! $assignment ) {
                $result['skipped'][] = $seat_key;
                continue;
            }

            $ok = $this->db->delete( $this->table, array( 'id' => $assignment->id ) );
            if ( false !== $ok && $this->db->rows_affected > 0 ) {
                $result['unassigned'][] = array(
                    'seat_key'    => $seat_key,
                    'attender_id' => (int) $assignment->attender_id,
                );
            } else {
                $result['failed'][] = $seat_key;
            }
        }

        $this->db->query( 'COMMIT' );
        return $result;
    }
}
