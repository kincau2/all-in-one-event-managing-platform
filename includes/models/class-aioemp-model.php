<?php
/**
 * Base model class — thin data-access wrapper around $wpdb.
 *
 * All model classes extend this to inherit the table name helper
 * and the $wpdb reference.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

abstract class AIOEMP_Model {

    /**
     * @var \wpdb WordPress database object.
     */
    protected \wpdb $db;

    /**
     * Full table name including WP prefix + aioemp_ prefix.
     *
     * @var string
     */
    protected string $table;

    /**
     * Short table name (without the prefix), e.g. 'events'.
     * Must be set by each child class.
     *
     * @var string
     */
    protected string $table_short = '';

    public function __construct() {
        global $wpdb;
        $this->db    = $wpdb;
        $this->table = $wpdb->prefix . 'aioemp_' . $this->table_short;
    }

    /**
     * Get a single row by primary key.
     *
     * @param int $id Row ID.
     * @return object|null
     */
    public function find( int $id ): ?object {
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $row = $this->db->get_row(
            $this->db->prepare( "SELECT * FROM {$this->table} WHERE id = %d", $id )
        );
        return $row ?: null;
    }

    /**
     * Delete a row by primary key.
     *
     * @param int $id Row ID.
     * @return bool
     */
    public function delete( int $id ): bool {
        $result = $this->db->delete( $this->table, array( 'id' => $id ), array( '%d' ) );
        return false !== $result;
    }

    /**
     * Get the current UTC datetime string.
     *
     * @return string  Y-m-d H:i:s in GMT.
     */
    protected function now_gmt(): string {
        return gmdate( 'Y-m-d H:i:s' );
    }
}
