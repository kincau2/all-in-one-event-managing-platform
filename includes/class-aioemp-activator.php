<?php
/**
 * Plugin activation handler.
 *
 * Creates all custom database tables via dbDelta and grants
 * custom capabilities to admin roles.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Activator {

    /**
     * Run on plugin activation.
     */
    public static function activate(): void {
        self::create_tables();
        AIOEMP_Security::grant_capabilities();

        // Flush rewrite rules so REST endpoints are available immediately.
        flush_rewrite_rules( false );
    }

    /**
     * Create / update all custom tables using dbDelta.
     *
     * We store a DB version in wp_options so that future plugin updates
     * can run migrations when the schema changes.
     */
    public static function create_tables(): void {
        global $wpdb;

        $prefix = $wpdb->prefix . 'aioemp_';

        // Always check for missing columns regardless of version.
        // This fixes cases where dbDelta silently fails to add columns.
        self::run_migrations( $wpdb, $prefix );

        $installed_version = get_option( 'aioemp_db_version', '0' );

        if ( version_compare( $installed_version, AIOEMP_DB_VERSION, '>=' ) ) {
            return; // Already up-to-date.
        }

        $charset_collate = $wpdb->get_charset_collate();
        $prefix          = $wpdb->prefix . 'aioemp_';

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        /*--------------------------------------------------------------
         * 1. aioemp_events
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}events (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            title varchar(255) NOT NULL,
            description text DEFAULT NULL,
            status varchar(32) NOT NULL DEFAULT 'draft',
            start_date_gmt datetime DEFAULT NULL,
            end_date_gmt datetime DEFAULT NULL,
            capacity int unsigned DEFAULT NULL,
            venue_mode varchar(32) DEFAULT NULL,
            location_name varchar(255) DEFAULT NULL,
            location_address text DEFAULT NULL,
            online_url varchar(500) DEFAULT NULL,
            cover_img_url varchar(500) DEFAULT NULL,
            seatmap_id bigint(20) unsigned DEFAULT NULL,
            seatmap_layout_snapshot longtext DEFAULT NULL,
            seatmap_finalized_at_gmt datetime DEFAULT NULL,
            lock_user_id bigint(20) unsigned DEFAULT NULL,
            lock_token char(36) DEFAULT NULL,
            lock_expires_at_gmt datetime DEFAULT NULL,
            lock_updated_at_gmt datetime DEFAULT NULL,
            created_by bigint(20) unsigned DEFAULT NULL,
            created_at_gmt datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY idx_status (status),
            KEY idx_start_date_gmt (start_date_gmt),
            KEY idx_lock_expires (lock_expires_at_gmt)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 2. aioemp_event_meta
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}event_meta (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id bigint(20) unsigned NOT NULL,
            meta_key varchar(191) NOT NULL,
            meta_value longtext DEFAULT NULL,
            PRIMARY KEY  (id),
            KEY idx_event_meta (event_id,meta_key),
            KEY idx_meta_key (meta_key)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 3. aioemp_event_log
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}event_log (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id bigint(20) unsigned NOT NULL,
            modified_by bigint(20) unsigned DEFAULT NULL,
            action varchar(64) NOT NULL,
            previous_value longtext DEFAULT NULL,
            new_value longtext DEFAULT NULL,
            created_at_gmt datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY idx_event_log_time (event_id,created_at_gmt),
            KEY idx_action (action)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 4. aioemp_attender
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}attender (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id bigint(20) unsigned NOT NULL,
            title varchar(32) DEFAULT NULL,
            first_name varchar(100) DEFAULT NULL,
            last_name varchar(100) DEFAULT NULL,
            company varchar(190) DEFAULT NULL,
            email varchar(190) DEFAULT NULL,
            qrcode_hash char(64) NOT NULL,
            created_at_gmt datetime NOT NULL,
            status varchar(32) NOT NULL DEFAULT 'registered',
            PRIMARY KEY  (id),
            UNIQUE KEY uq_qrcode_hash (qrcode_hash),
            KEY idx_event_id (event_id),
            KEY idx_event_lastname (event_id,last_name),
            KEY idx_event_email (event_id,email)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 5. aioemp_attendance
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}attendance (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id bigint(20) unsigned NOT NULL,
            attender_id bigint(20) unsigned NOT NULL,
            type varchar(8) NOT NULL,
            scanned_by bigint(20) unsigned DEFAULT NULL,
            device_id varchar(64) DEFAULT NULL,
            scanned_at_gmt datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY idx_attendance_attender (event_id,attender_id,scanned_at_gmt),
            KEY idx_attendance_time (event_id,scanned_at_gmt)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 6. aioemp_seatmap
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}seatmap (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            title varchar(255) NOT NULL,
            status varchar(32) NOT NULL DEFAULT 'draft',
            layout longtext NOT NULL,
            integrity_pass tinyint(1) NOT NULL DEFAULT 0,
            lock_user_id bigint(20) unsigned DEFAULT NULL,
            lock_token char(36) DEFAULT NULL,
            lock_expires_at_gmt datetime DEFAULT NULL,
            lock_updated_at_gmt datetime DEFAULT NULL,
            updated_at_gmt datetime DEFAULT NULL,
            created_at_gmt datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY idx_seatmap_status (status),
            KEY idx_seatmap_lock (lock_expires_at_gmt)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 7. aioemp_seatmap_meta
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}seatmap_meta (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            seatmap_id bigint(20) unsigned NOT NULL,
            meta_key varchar(191) NOT NULL,
            meta_value longtext DEFAULT NULL,
            PRIMARY KEY  (id),
            KEY idx_seatmap_meta (seatmap_id,meta_key),
            KEY idx_seatmap_meta_key (meta_key)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 8. aioemp_seat_assignment
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}seat_assignment (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id bigint(20) unsigned NOT NULL,
            attender_id bigint(20) unsigned NOT NULL,
            seat_key varchar(64) NOT NULL,
            assigned_by bigint(20) unsigned DEFAULT NULL,
            assigned_at_gmt datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uq_event_seat (event_id,seat_key),
            UNIQUE KEY uq_event_attender (event_id,attender_id),
            KEY idx_seat_event (event_id)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 9. aioemp_blocked_seat
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}blocked_seat (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id bigint(20) unsigned NOT NULL,
            seat_key varchar(64) NOT NULL,
            blocked_by bigint(20) unsigned DEFAULT NULL,
            blocked_at_gmt datetime NOT NULL,
            PRIMARY KEY  (id),
            UNIQUE KEY uq_blocked_event_seat (event_id,seat_key),
            KEY idx_blocked_event (event_id)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * 10. aioemp_seat_assignment_log
         *------------------------------------------------------------*/
        $sql[] = "CREATE TABLE {$prefix}seat_assignment_log (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            event_id bigint(20) unsigned NOT NULL,
            attender_id bigint(20) unsigned DEFAULT NULL,
            modified_by bigint(20) unsigned DEFAULT NULL,
            original_seat varchar(64) DEFAULT NULL,
            new_seat varchar(64) DEFAULT NULL,
            reason varchar(64) DEFAULT NULL,
            created_at_gmt datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY idx_seat_log_event (event_id,created_at_gmt),
            KEY idx_seat_log_attender (attender_id,created_at_gmt)
        ) $charset_collate;";

        /*--------------------------------------------------------------
         * Execute dbDelta
         *------------------------------------------------------------*/
        foreach ( $sql as $query ) {
            dbDelta( $query );
        }

        /*--------------------------------------------------------------
         * Explicit migrations for columns dbDelta may miss on existing tables.
         * dbDelta can fail to ADD columns with NOT NULL DEFAULT to tables
         * that already have rows.
         *------------------------------------------------------------*/
        self::run_migrations( $wpdb, $prefix );

        update_option( 'aioemp_db_version', AIOEMP_DB_VERSION );
    }

    /**
     * Run explicit ALTER TABLE migrations for schema changes
     * that dbDelta may not handle reliably.
     */
    private static function run_migrations( $wpdb, string $prefix ): void {
        // ── Seatmap table migrations ──
        $table = $prefix . 'seatmap';

        // Skip if table doesn't exist yet (fresh install — dbDelta will create it).
        $exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
        if ( $exists ) {
            // v1.1.0 — add status column.
            $col = $wpdb->get_results( "SHOW COLUMNS FROM `{$table}` LIKE 'status'" );
            if ( empty( $col ) ) {
                $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `status` varchar(32) NOT NULL DEFAULT 'draft' AFTER `title`" );
            }

            // v1.1.0 — add updated_at_gmt column.
            $col = $wpdb->get_results( "SHOW COLUMNS FROM `{$table}` LIKE 'updated_at_gmt'" );
            if ( empty( $col ) ) {
                $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `updated_at_gmt` datetime DEFAULT NULL AFTER `lock_updated_at_gmt`" );
            }

            // v1.2.0 — add integrity_pass column.
            $col = $wpdb->get_results( "SHOW COLUMNS FROM `{$table}` LIKE 'integrity_pass'" );
            if ( empty( $col ) ) {
                $wpdb->query( "ALTER TABLE `{$table}` ADD COLUMN `integrity_pass` tinyint(1) NOT NULL DEFAULT 0 AFTER `layout`" );
            }
        }

        // ── Events table migrations (v1.3.0) ──
        $events_table = $prefix . 'events';
        $exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $events_table ) );
        if ( $exists ) {
            $new_cols = array(
                'description'      => "ADD COLUMN `description` text DEFAULT NULL AFTER `title`",
                'location_name'    => "ADD COLUMN `location_name` varchar(255) DEFAULT NULL AFTER `venue_mode`",
                'location_address' => "ADD COLUMN `location_address` text DEFAULT NULL AFTER `location_name`",
                'online_url'       => "ADD COLUMN `online_url` varchar(500) DEFAULT NULL AFTER `location_address`",
                'cover_img_url'    => "ADD COLUMN `cover_img_url` varchar(500) DEFAULT NULL AFTER `online_url`",
                'seatmap_id'       => "ADD COLUMN `seatmap_id` bigint(20) unsigned DEFAULT NULL AFTER `cover_img_url`",
                'created_by'       => "ADD COLUMN `created_by` bigint(20) unsigned DEFAULT NULL AFTER `lock_updated_at_gmt`",
            );
            foreach ( $new_cols as $col_name => $alter_sql ) {
                $col = $wpdb->get_results( "SHOW COLUMNS FROM `{$events_table}` LIKE '{$col_name}'" );
                if ( empty( $col ) ) {
                    $wpdb->query( "ALTER TABLE `{$events_table}` {$alter_sql}" );
                }
            }
        }
    }
}
