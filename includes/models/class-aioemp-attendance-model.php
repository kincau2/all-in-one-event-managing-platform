<?php
/**
 * Attendance model — data access for the aioemp_attendance table.
 *
 * Append-only log of check-in / check-out scans.
 *
 * @package AIOEMP
 * @since   0.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Attendance_Model extends AIOEMP_Model {

    protected string $table_short = 'attendance';

    /**
     * Allowed type values.
     */
    public const TYPES = array( 'IN', 'OUT' );

    /**
     * Record a check-in or check-out scan.
     *
     * @param array $data {
     *     @type int    $event_id    Event ID.
     *     @type int    $attender_id Attender ID.
     *     @type string $type        "IN" or "OUT".
     *     @type int    $scanned_by  WP user ID of scanner.
     *     @type string $device_id   Optional device identifier.
     * }
     * @return int|false Inserted row ID or false on failure.
     */
    public function record( array $data ) {
        $defaults = array(
            'scanned_at_gmt' => $this->now_gmt(),
            'device_id'      => null,
        );
        $data = wp_parse_args( $data, $defaults );

        $result = $this->db->insert( $this->table, $data );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * Get the latest attendance record for an attender within an event.
     *
     * @param int $event_id    Event ID.
     * @param int $attender_id Attender ID.
     * @return object|null     Latest record or null.
     */
    public function get_latest( int $event_id, int $attender_id ): ?object {
        $row = $this->db->get_row(
            $this->db->prepare(
                "SELECT * FROM {$this->table}
                 WHERE event_id = %d AND attender_id = %d
                 ORDER BY scanned_at_gmt DESC, id DESC
                 LIMIT 1",
                $event_id,
                $attender_id
            )
        );
        return $row ?: null;
    }

    /**
     * Get all attendance records for an attender within an event.
     *
     * @param int $event_id    Event ID.
     * @param int $attender_id Attender ID.
     * @return array
     */
    public function get_for_attender( int $event_id, int $attender_id ): array {
        return $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table}
                 WHERE event_id = %d AND attender_id = %d
                 ORDER BY scanned_at_gmt ASC, id ASC",
                $event_id,
                $attender_id
            )
        ) ?: array();
    }

    /**
     * Get attendance logs for an event with pagination.
     *
     * @param int   $event_id Event ID.
     * @param array $args {
     *     @type int    $per_page  Results per page (default 50).
     *     @type int    $page      Page number (1-based).
     *     @type string $search    Keyword search on attender name/email.
     * }
     * @return object{ items: array, total: int }
     */
    public function list_for_event( int $event_id, array $args = array() ): object {
        global $wpdb;

        $defaults = array(
            'per_page' => 50,
            'page'     => 1,
            'search'   => '',
        );
        $args = wp_parse_args( $args, $defaults );

        $att_table = $wpdb->prefix . 'aioemp_attender';
        $users_table = $wpdb->users;

        $where  = array( 'a.event_id = %d' );
        $values = array( $event_id );

        if ( '' !== $args['search'] ) {
            $like     = '%' . $this->db->esc_like( $args['search'] ) . '%';
            $where[]  = '(att.first_name LIKE %s OR att.last_name LIKE %s OR att.email LIKE %s OR CONCAT(att.first_name, \' \', att.last_name) LIKE %s)';
            $values[] = $like;
            $values[] = $like;
            $values[] = $like;
            $values[] = $like;
        }

        $where_clause = implode( ' AND ', $where );

        // Total count.
        $count_sql = $this->db->prepare(
            "SELECT COUNT(*)
             FROM {$this->table} a
             LEFT JOIN {$att_table} att ON att.id = a.attender_id
             WHERE {$where_clause}",
            ...$values
        );
        $total = (int) $this->db->get_var( $count_sql );

        // Paginated results.
        $per_page = max( 1, (int) $args['per_page'] );
        $page     = max( 1, (int) $args['page'] );
        $offset   = ( $page - 1 ) * $per_page;

        $query_values = array_merge( $values, array( $per_page, $offset ) );
        $items = $this->db->get_results(
            $this->db->prepare(
                "SELECT a.*,
                        att.first_name, att.last_name, att.email, att.company,
                        att.status AS attender_status,
                        COALESCE(
                            NULLIF(TRIM(CONCAT(COALESCE(um_fn.meta_value, ''), ' ', COALESCE(um_ln.meta_value, ''))), ''),
                            u.display_name
                        ) AS scanned_by_name
                 FROM {$this->table} a
                 LEFT JOIN {$att_table} att ON att.id = a.attender_id
                 LEFT JOIN {$users_table} u ON u.ID = a.scanned_by
                 LEFT JOIN {$wpdb->usermeta} um_fn ON um_fn.user_id = a.scanned_by AND um_fn.meta_key = 'first_name'
                 LEFT JOIN {$wpdb->usermeta} um_ln ON um_ln.user_id = a.scanned_by AND um_ln.meta_key = 'last_name'
                 WHERE {$where_clause}
                 ORDER BY a.scanned_at_gmt DESC, a.id DESC
                 LIMIT %d OFFSET %d",
                ...$query_values
            )
        );

        return (object) array(
            'items' => $items ?: array(),
            'total' => $total,
        );
    }

    /**
     * Count checked-in attenders for an event.
     *
     * An attender is "checked in" if their latest scan is type = 'IN'.
     *
     * @param int $event_id Event ID.
     * @return array{ checked_in: int, total_scans: int }
     */
    public function count_for_event( int $event_id ): array {
        // Total scans.
        $total_scans = (int) $this->db->get_var(
            $this->db->prepare(
                "SELECT COUNT(*) FROM {$this->table} WHERE event_id = %d",
                $event_id
            )
        );

        // Currently checked in: attenders whose latest record is type='IN'.
        $checked_in = (int) $this->db->get_var(
            $this->db->prepare(
                "SELECT COUNT(*) FROM (
                    SELECT attender_id,
                           type,
                           ROW_NUMBER() OVER (PARTITION BY attender_id ORDER BY scanned_at_gmt DESC, id DESC) AS rn
                    FROM {$this->table}
                    WHERE event_id = %d
                ) sub
                WHERE sub.rn = 1 AND sub.type = 'IN'",
                $event_id
            )
        );

        return array(
            'checked_in'  => $checked_in,
            'total_scans' => $total_scans,
        );
    }

    /**
     * Get all attendance records for an event (for CSV export).
     *
     * @param int $event_id Event ID.
     * @return array
     */
    public function export_for_event( int $event_id ): array {
        global $wpdb;
        $att_table = $wpdb->prefix . 'aioemp_attender';

        return $this->db->get_results(
            $this->db->prepare(
                "SELECT a.id, a.type, a.scanned_at_gmt, a.device_id,
                        att.first_name, att.last_name, att.email, att.company, att.status AS attender_status,
                        COALESCE(
                            NULLIF(TRIM(CONCAT(COALESCE(um_fn.meta_value, ''), ' ', COALESCE(um_ln.meta_value, ''))), ''),
                            u.display_name
                        ) AS scanned_by_name
                 FROM {$this->table} a
                 LEFT JOIN {$att_table} att ON att.id = a.attender_id
                 LEFT JOIN {$wpdb->users} u ON u.ID = a.scanned_by
                 LEFT JOIN {$wpdb->usermeta} um_fn ON um_fn.user_id = a.scanned_by AND um_fn.meta_key = 'first_name'
                 LEFT JOIN {$wpdb->usermeta} um_ln ON um_ln.user_id = a.scanned_by AND um_ln.meta_key = 'last_name'
                 WHERE a.event_id = %d
                 ORDER BY a.scanned_at_gmt ASC, a.id ASC",
                $event_id
            )
        ) ?: array();
    }
}
