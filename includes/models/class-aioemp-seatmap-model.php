<?php
/**
 * Seatmap model — data access for the aioemp_seatmap table.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Seatmap_Model extends AIOEMP_Model {

    protected string $table_short = 'seatmap';

    /**
     * Insert a new seatmap.
     *
     * @param array $data Associative array of column => value.
     * @return int|false  Inserted row ID or false on failure.
     */
    public function create( array $data ) {
        $defaults = array(
            'layout'         => '{}',
            'created_at_gmt' => $this->now_gmt(),
        );
        $data = wp_parse_args( $data, $defaults );

        $result = $this->db->insert( $this->table, $data );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * Update a seatmap.
     *
     * @param int   $id   Seatmap ID.
     * @param array $data Columns to update.
     * @return bool
     */
    public function update( int $id, array $data ): bool {
        $result = $this->db->update( $this->table, $data, array( 'id' => $id ) );
        return false !== $result;
    }

    /**
     * List seatmaps with optional search and pagination.
     *
     * @param array $args {
     *     @type string $search   Keyword search on title.
     *     @type int    $per_page Results per page (default 20).
     *     @type int    $page     Page number (1-based).
     * }
     * @return object{ items: object[], total: int }
     */
    public function list( array $args = array() ): object {
        $defaults = array(
            'search'   => '',
            'per_page' => 20,
            'page'     => 1,
        );
        $args = wp_parse_args( $args, $defaults );

        $where  = array( '1=1' );
        $values = array();

        if ( '' !== $args['search'] ) {
            $where[]  = 'title LIKE %s';
            $values[] = '%' . $this->db->esc_like( $args['search'] ) . '%';
        }

        $where_clause = implode( ' AND ', $where );

        $count_sql = "SELECT COUNT(*) FROM {$this->table} WHERE {$where_clause}";
        if ( ! empty( $values ) ) {
            $count_sql = $this->db->prepare( $count_sql, ...$values );
        }
        $total = (int) $this->db->get_var( $count_sql );

        $per_page = max( 1, (int) $args['per_page'] );
        $page     = max( 1, (int) $args['page'] );
        $offset   = ( $page - 1 ) * $per_page;

        $query = "SELECT id, title, lock_user_id, lock_expires_at_gmt, created_at_gmt FROM {$this->table} WHERE {$where_clause} ORDER BY created_at_gmt DESC LIMIT %d OFFSET %d";
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
