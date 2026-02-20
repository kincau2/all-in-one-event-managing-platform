<?php
/**
 * Locking service — WP-style exclusive edit locks.
 *
 * Handles acquire, heartbeat, release, and takeover for both
 * seatmap and event resources using atomic SQL operations.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Locking_Service {

    /**
     * Lock TTL in seconds.
     */
    public const LOCK_TTL = 90;

    /**
     * Allowed resource types and their corresponding tables.
     *
     * @var array<string, string>
     */
    private const RESOURCE_TABLES = array(
        'seatmap' => 'seatmap',
        'event'   => 'events',
    );

    /**
     * @var \wpdb
     */
    private \wpdb $db;

    public function __construct() {
        global $wpdb;
        $this->db = $wpdb;
    }

    /*--------------------------------------------------------------
     * Public API
     *------------------------------------------------------------*/

    /**
     * Try to acquire a lock on a resource.
     *
     * Uses an atomic UPDATE…WHERE to prevent race conditions.
     *
     * @param string $resource_type 'seatmap' or 'event'.
     * @param int    $resource_id   Row ID.
     * @return array{ status: string, lock_token?: string, expires_in?: int, owner?: array }
     */
    public function acquire( string $resource_type, int $resource_id ): array {
        $table = $this->resolve_table( $resource_type );
        if ( ! $table ) {
            return array( 'status' => 'error', 'message' => 'Invalid resource type.' );
        }

        $user_id   = get_current_user_id();
        $now       = gmdate( 'Y-m-d H:i:s' );
        $new_token = wp_generate_uuid4();
        $expires   = gmdate( 'Y-m-d H:i:s', time() + self::LOCK_TTL );

        // Verify resource exists.
        $exists = $this->db->get_var(
            $this->db->prepare( "SELECT id FROM {$table} WHERE id = %d", $resource_id )
        );
        if ( ! $exists ) {
            return array( 'status' => 'error', 'message' => 'Resource not found.' );
        }

        // Atomic acquire: only succeeds if lock is free or expired.
        $rows_affected = $this->db->query(
            $this->db->prepare(
                "UPDATE {$table}
                 SET lock_user_id       = %d,
                     lock_token         = %s,
                     lock_expires_at_gmt = %s,
                     lock_updated_at_gmt = %s
                 WHERE id = %d
                   AND (lock_expires_at_gmt IS NULL OR lock_expires_at_gmt < %s)",
                $user_id,
                $new_token,
                $expires,
                $now,
                $resource_id,
                $now
            )
        );

        if ( $rows_affected > 0 ) {
            return array(
                'status'     => 'locked_by_you',
                'lock_token' => $new_token,
                'expires_in' => self::LOCK_TTL,
            );
        }

        // Lock is held by someone — check if it's the current user.
        $row = $this->db->get_row(
            $this->db->prepare(
                "SELECT lock_user_id, lock_token, lock_expires_at_gmt FROM {$table} WHERE id = %d",
                $resource_id
            )
        );

        if ( $row && (int) $row->lock_user_id === $user_id ) {
            // Same user — refresh their lock.
            $this->db->update(
                $table,
                array(
                    'lock_token'          => $new_token,
                    'lock_expires_at_gmt' => $expires,
                    'lock_updated_at_gmt' => $now,
                ),
                array( 'id' => $resource_id )
            );
            return array(
                'status'     => 'locked_by_you',
                'lock_token' => $new_token,
                'expires_in' => self::LOCK_TTL,
            );
        }

        // Locked by another user.
        $owner_id   = $row ? (int) $row->lock_user_id : 0;
        $owner_data = get_userdata( $owner_id );

        return array(
            'status' => 'locked_by_other',
            'owner'  => array(
                'user_id'      => $owner_id,
                'display_name' => $owner_data ? $owner_data->display_name : __( 'Unknown', 'aioemp' ),
            ),
            'expires_at_gmt' => $row ? $row->lock_expires_at_gmt : null,
        );
    }

    /**
     * Renew (heartbeat) an existing lock.
     *
     * @param string $resource_type 'seatmap' or 'event'.
     * @param int    $resource_id   Row ID.
     * @param string $lock_token    The token received on acquire.
     * @return array{ status: string, expires_in?: int }
     */
    public function heartbeat( string $resource_type, int $resource_id, string $lock_token ): array {
        $table = $this->resolve_table( $resource_type );
        if ( ! $table ) {
            return array( 'status' => 'error', 'message' => 'Invalid resource type.' );
        }

        $user_id = get_current_user_id();
        $now     = gmdate( 'Y-m-d H:i:s' );
        $expires = gmdate( 'Y-m-d H:i:s', time() + self::LOCK_TTL );

        $rows = $this->db->query(
            $this->db->prepare(
                "UPDATE {$table}
                 SET lock_expires_at_gmt = %s,
                     lock_updated_at_gmt = %s
                 WHERE id = %d
                   AND lock_user_id = %d
                   AND lock_token = %s",
                $expires,
                $now,
                $resource_id,
                $user_id,
                $lock_token
            )
        );

        if ( $rows > 0 ) {
            return array(
                'status'     => 'renewed',
                'expires_in' => self::LOCK_TTL,
            );
        }

        return array( 'status' => 'lock_lost' );
    }

    /**
     * Release a lock.
     *
     * @param string $resource_type 'seatmap' or 'event'.
     * @param int    $resource_id   Row ID.
     * @param string $lock_token    The token received on acquire.
     * @return array{ status: string }
     */
    public function release( string $resource_type, int $resource_id, string $lock_token ): array {
        $table = $this->resolve_table( $resource_type );
        if ( ! $table ) {
            return array( 'status' => 'error', 'message' => 'Invalid resource type.' );
        }

        $user_id = get_current_user_id();

        $rows = $this->db->query(
            $this->db->prepare(
                "UPDATE {$table}
                 SET lock_user_id        = NULL,
                     lock_token          = NULL,
                     lock_expires_at_gmt = NULL,
                     lock_updated_at_gmt = NULL
                 WHERE id = %d
                   AND lock_user_id = %d
                   AND lock_token = %s",
                $resource_id,
                $user_id,
                $lock_token
            )
        );

        return array( 'status' => $rows > 0 ? 'released' : 'noop' );
    }

    /**
     * Force-take over a lock from another user.
     *
     * @param string $resource_type 'seatmap' or 'event'.
     * @param int    $resource_id   Row ID.
     * @return array{ status: string, lock_token?: string, expires_in?: int }
     */
    public function takeover( string $resource_type, int $resource_id ): array {
        $table = $this->resolve_table( $resource_type );
        if ( ! $table ) {
            return array( 'status' => 'error', 'message' => 'Invalid resource type.' );
        }

        $user_id   = get_current_user_id();
        $now       = gmdate( 'Y-m-d H:i:s' );
        $new_token = wp_generate_uuid4();
        $expires   = gmdate( 'Y-m-d H:i:s', time() + self::LOCK_TTL );

        // Read previous lock owner for audit log.
        $previous = $this->db->get_row(
            $this->db->prepare(
                "SELECT lock_user_id, lock_token, lock_expires_at_gmt FROM {$table} WHERE id = %d",
                $resource_id
            )
        );

        if ( ! $previous ) {
            return array( 'status' => 'error', 'message' => 'Resource not found.' );
        }

        // Force overwrite — no WHERE condition on lock ownership.
        $this->db->update(
            $table,
            array(
                'lock_user_id'        => $user_id,
                'lock_token'          => $new_token,
                'lock_expires_at_gmt' => $expires,
                'lock_updated_at_gmt' => $now,
            ),
            array( 'id' => $resource_id )
        );

        // Audit log.
        $this->log_takeover( $resource_type, $resource_id, $previous, $user_id );

        return array(
            'status'     => 'locked_by_you',
            'lock_token' => $new_token,
            'expires_in' => self::LOCK_TTL,
        );
    }

    /*--------------------------------------------------------------
     * Helpers
     *------------------------------------------------------------*/

    /**
     * Resolve a resource type string to its full table name.
     *
     * @param string $type 'seatmap' or 'event'.
     * @return string|null Full table name or null if invalid.
     */
    private function resolve_table( string $type ): ?string {
        if ( ! isset( self::RESOURCE_TABLES[ $type ] ) ) {
            return null;
        }
        return $this->db->prefix . 'aioemp_' . self::RESOURCE_TABLES[ $type ];
    }

    /**
     * Write a lock_takeover entry to the event log.
     *
     * @param string      $resource_type Resource type.
     * @param int         $resource_id   Resource ID.
     * @param object|null $previous      Previous lock row data.
     * @param int         $new_user_id   New lock owner.
     */
    private function log_takeover( string $resource_type, int $resource_id, ?object $previous, int $new_user_id ): void {
        require_once AIOEMP_PLUGIN_DIR . 'includes/models/class-aioemp-event-log-model.php';

        $log = new AIOEMP_Event_Log_Model();

        // For seatmap locks we still write to event_log with event_id = 0
        // and include the resource context in the payload.
        $event_id = 'event' === $resource_type ? $resource_id : 0;

        $prev_data = array(
            'resource_type'     => $resource_type,
            'resource_id'       => $resource_id,
            'lock_user_id'      => $previous ? $previous->lock_user_id : null,
            'lock_expires_at_gmt' => $previous ? $previous->lock_expires_at_gmt : null,
        );

        $new_data = array(
            'resource_type' => $resource_type,
            'resource_id'   => $resource_id,
            'lock_user_id'  => $new_user_id,
        );

        $log->log( $event_id, 'lock_takeover', $prev_data, $new_data, $new_user_id );
    }
}
