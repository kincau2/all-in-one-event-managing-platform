<?php
/**
 * Event log model — data access for the aioemp_event_log table.
 *
 * Append-only audit log for event-related actions.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-model.php';

class AIOEMP_Event_Log_Model extends AIOEMP_Model {

    protected string $table_short = 'event_log';

    /**
     * Append a log entry.
     *
     * @param int    $event_id       Related event ID.
     * @param string $action         Action identifier (e.g. 'lock_acquire').
     * @param mixed  $previous_value Previous state (will be JSON-encoded).
     * @param mixed  $new_value      New state (will be JSON-encoded).
     * @param int|null $modified_by  WP user ID, or null for system actions.
     * @return int|false Inserted row ID or false.
     */
    public function log( int $event_id, string $action, $previous_value = null, $new_value = null, ?int $modified_by = null ) {
        if ( null === $modified_by ) {
            $modified_by = get_current_user_id() ?: null;
        }

        $data = array(
            'event_id'       => $event_id,
            'modified_by'    => $modified_by,
            'action'         => sanitize_text_field( $action ),
            'previous_value' => is_null( $previous_value ) ? null : wp_json_encode( $previous_value ),
            'new_value'      => is_null( $new_value ) ? null : wp_json_encode( $new_value ),
            'created_at_gmt' => $this->now_gmt(),
        );

        $formats = array( '%d', '%d', '%s', '%s', '%s', '%s' );

        $result = $this->db->insert( $this->table, $data, $formats );
        return $result ? (int) $this->db->insert_id : false;
    }

    /**
     * Get log entries for an event.
     *
     * @param int $event_id Event ID.
     * @param int $limit    Max rows to return.
     * @return array
     */
    public function get_for_event( int $event_id, int $limit = 100 ): array {
        return $this->db->get_results(
            $this->db->prepare(
                "SELECT * FROM {$this->table} WHERE event_id = %d ORDER BY created_at_gmt DESC LIMIT %d",
                $event_id,
                $limit
            )
        ) ?: array();
    }
}
