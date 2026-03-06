<?php
/**
 * Attender (Candidate) model — data access for the aioemp_attender table.
 *
 * @package AIOEMP
 * @since   0.2.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Attender_Model extends AIOEMP_Model {

    protected string $table_short = 'attender';

    /**
     * Allowed status values.
     */
    public const STATUSES = array( 'registered', 'accepted_onsite', 'accepted_online', 'rejected' );

    /**
     * Insert a new attender.
     *
     * @param array $data Associative array of column => value.
     * @return int|false  Inserted row ID or false on failure.
     */
    public function create( array $data ) {
        $defaults = array(
            'status'         => 'registered',
            'qrcode_hash'    => self::generate_qr_hash(),
            'created_at_gmt' => $this->now_gmt(),
        );
        $data = wp_parse_args( $data, $defaults );

        $result = $this->db->insert( $this->table, $data );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * Update an attender.
     *
     * @param int   $id   Attender ID.
     * @param array $data Columns to update.
     * @return bool
     */
    public function update( int $id, array $data ): bool {
        $result = $this->db->update( $this->table, $data, array( 'id' => $id ) );
        return false !== $result;
    }

    /**
     * List attenders for an event with optional filters and pagination.
     *
     * @param int   $event_id Event ID.
     * @param array $args {
     *     @type string $status   Filter by status.
     *     @type string $search   Keyword search on name/email/company.
     *     @type int    $per_page Results per page (default 20).
     *     @type int    $page     Page number (1-based).
     * }
     * @return object{ items: object[], total: int }
     */
    public function list_for_event( int $event_id, array $args = array() ): object {
        $defaults = array(
            'status'   => '',
            'search'   => '',
            'per_page' => 20,
            'page'     => 1,
            'ids'      => array(),
        );
        $args = wp_parse_args( $args, $defaults );

        $where  = array( 't.event_id = %d' );
        $values = array( $event_id );

        // Filter by specific IDs (skips pagination when used).
        $ids = array_filter( array_map( 'absint', (array) $args['ids'] ) );
        if ( ! empty( $ids ) ) {
            $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
            $where[]      = "t.id IN ($placeholders)";
            $values       = array_merge( $values, $ids );
        }

        if ( '' !== $args['status'] && in_array( $args['status'], self::STATUSES, true ) ) {
            $where[]  = 't.status = %s';
            $values[] = $args['status'];
        }

        if ( '' !== $args['search'] ) {
            $like     = '%' . $this->db->esc_like( $args['search'] ) . '%';
            $where[]  = '(t.first_name LIKE %s OR t.last_name LIKE %s OR t.email LIKE %s OR t.company LIKE %s)';
            $values[] = $like;
            $values[] = $like;
            $values[] = $like;
            $values[] = $like;
        }

        $where_clause = implode( ' AND ', $where );

        // Total count.
        $count_sql = $this->db->prepare(
            "SELECT COUNT(*) FROM {$this->table} t WHERE {$where_clause}",
            ...$values
        );
        $total = (int) $this->db->get_var( $count_sql );

        // LEFT JOIN seat_assignment to include checked_in flag for candidates.
        $sa_table = $this->db->prefix . 'aioemp_seat_assignment';
        $select   = "SELECT t.*, sa.checked_in";
        $from     = "FROM {$this->table} t LEFT JOIN {$sa_table} sa ON sa.attender_id = t.id AND sa.event_id = t.event_id";

        // When filtering by IDs, skip pagination — return all matches.
        if ( ! empty( $ids ) ) {
            $items = $this->db->get_results(
                $this->db->prepare(
                    "{$select} {$from} WHERE {$where_clause} ORDER BY t.created_at_gmt DESC",
                    ...$values
                )
            );
        } else {
            // Paginated results.
            $per_page = max( 1, (int) $args['per_page'] );
            $page     = max( 1, (int) $args['page'] );
            $offset   = ( $page - 1 ) * $per_page;

            $query_values = array_merge( $values, array( $per_page, $offset ) );
            $items = $this->db->get_results(
                $this->db->prepare(
                    "{$select} {$from} WHERE {$where_clause} ORDER BY t.created_at_gmt DESC LIMIT %d OFFSET %d",
                    ...$query_values
                )
            );
        }

        return (object) array(
            'items' => $items ?: array(),
            'total' => $total,
        );
    }

    /**
     * Count attenders by status for an event.
     *
     * @param int $event_id Event ID.
     * @return array Associative array of status => count.
     */
    public function count_by_status( int $event_id ): array {
        $rows = $this->db->get_results(
            $this->db->prepare(
                "SELECT status, COUNT(*) as cnt FROM {$this->table} WHERE event_id = %d GROUP BY status",
                $event_id
            )
        );

        $counts = array_fill_keys( self::STATUSES, 0 );
        $counts['total'] = 0;
        foreach ( $rows ?: array() as $row ) {
            $counts[ $row->status ] = (int) $row->cnt;
            $counts['total'] += (int) $row->cnt;
        }

        return $counts;
    }

    /**
     * Bulk update status for multiple attender IDs within the same event.
     *
     * @param int    $event_id    Event ID (security: ensures IDs belong to event).
     * @param array  $attender_ids Array of attender IDs.
     * @param string $new_status  New status value.
     * @return int   Number of rows updated.
     */
    public function bulk_update_status( int $event_id, array $attender_ids, string $new_status ): int {
        if ( empty( $attender_ids ) || ! in_array( $new_status, self::STATUSES, true ) ) {
            return 0;
        }

        $ids = array_map( 'absint', $attender_ids );
        $ids = array_filter( $ids );
        if ( empty( $ids ) ) {
            return 0;
        }

        $placeholders = implode( ',', array_fill( 0, count( $ids ), '%d' ) );
        $sql = $this->db->prepare(
            "UPDATE {$this->table} SET status = %s WHERE event_id = %d AND id IN ({$placeholders})",
            $new_status,
            $event_id,
            ...$ids
        );

        $this->db->query( $sql );
        return (int) $this->db->rows_affected;
    }

    /**
     * Find an attender by QR code hash.
     *
     * @param string $hash QR code hash.
     * @return object|null
     */
    public function find_by_qr_hash( string $hash ): ?object {
        $row = $this->db->get_row(
            $this->db->prepare(
                "SELECT * FROM {$this->table} WHERE qrcode_hash = %s",
                $hash
            )
        );
        return $row ?: null;
    }

    /**
     * Generate a unique QR token hash.
     *
     * @return string 64-char hex SHA-256 hash.
     */
    public static function generate_qr_hash(): string {
        return hash( 'sha256', wp_generate_uuid4() . wp_generate_password( 32, true, true ) );
    }
}
