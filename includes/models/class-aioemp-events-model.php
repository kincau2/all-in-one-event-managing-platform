<?php
/**
 * Events model — data access for the aioemp_events table.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Events_Model extends AIOEMP_Model {

    protected string $table_short = 'events';

    /**
     * Allowed status values.
     */
    public const STATUSES = array( 'draft', 'published', 'closed' );

    /**
     * Allowed venue_mode values.
     */
    public const VENUE_MODES = array( 'onsite', 'online', 'mixed' );

    /**
     * Insert a new event.
     *
     * @param array $data Associative array of column => value.
     * @return int|false  Inserted row ID or false on failure.
     */
    public function create( array $data ) {
        $defaults = array(
            'status'         => 'draft',
            'created_at_gmt' => $this->now_gmt(),
        );
        $data = wp_parse_args( $data, $defaults );

        $result = $this->db->insert( $this->table, $data );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * Update an event.
     *
     * @param int   $id   Event ID.
     * @param array $data Columns to update.
     * @return bool
     */
    public function update( int $id, array $data ): bool {
        $result = $this->db->update( $this->table, $data, array( 'id' => $id ) );
        return false !== $result;
    }

    /**
     * List events with optional filters and pagination.
     *
     * @param array $args {
     *     @type string $status   Filter by status.
     *     @type string $search   Keyword search on title.
     *     @type int    $per_page Results per page (default 20).
     *     @type int    $page     Page number (1-based).
     * }
     * @return object{ items: object[], total: int }
     */
    public function list( array $args = array() ): object {
        $defaults = array(
            'status'   => '',
            'search'   => '',
            'per_page' => 20,
            'page'     => 1,
        );
        $args = wp_parse_args( $args, $defaults );

        $where  = array( '1=1' );
        $values = array();

        if ( '' !== $args['status'] && in_array( $args['status'], self::STATUSES, true ) ) {
            $where[]  = 'status = %s';
            $values[] = $args['status'];
        }

        if ( '' !== $args['search'] ) {
            $where[]  = 'title LIKE %s';
            $values[] = '%' . $this->db->esc_like( $args['search'] ) . '%';
        }

        $where_clause = implode( ' AND ', $where );

        // Total count.
        $count_sql = "SELECT COUNT(*) FROM {$this->table} WHERE {$where_clause}";
        if ( ! empty( $values ) ) {
            $count_sql = $this->db->prepare( $count_sql, ...$values );
        }
        $total = (int) $this->db->get_var( $count_sql );

        // Paginated results.
        $per_page = max( 1, (int) $args['per_page'] );
        $page     = max( 1, (int) $args['page'] );
        $offset   = ( $page - 1 ) * $per_page;

        $query = "SELECT * FROM {$this->table} WHERE {$where_clause} ORDER BY created_at_gmt DESC LIMIT %d OFFSET %d";
        $query_values = array_merge( $values, array( $per_page, $offset ) );
        $items = $this->db->get_results(
            $this->db->prepare( $query, ...$query_values )
        );

        return (object) array(
            'items' => $items ?: array(),
            'total' => $total,
        );
    }
}
