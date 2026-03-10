#!/usr/bin/env php
<?php
/**
 * Seed random candidates for an event.
 *
 * Usage (via WP-CLI on the server):
 *   wp eval-file seed-candidates.php <event_id> [count] [email] [status]
 *
 * Examples:
 *   wp eval-file seed-candidates.php 7 1000 galenau0721@gmail.com
 *   wp eval-file seed-candidates.php 7 500 galenau0721@gmail.com accepted_onsite
 *   wp eval-file seed-candidates.php 7              # 1000 candidates, random emails, registered
 *
 * Arguments (positional):
 *   event_id   Required. The event ID to add candidates to.
 *   count      Number of candidates to create (default 1000).
 *   email      Email address for all candidates (default: random per candidate).
 *   status     Status for all candidates (default: registered).
 *
 * @package AIOEMP
 */

if ( ! defined( 'ABSPATH' ) ) {
    echo "This script must be run via WP-CLI: wp eval-file seed-candidates.php 7 1000 galenau0721@gmail.com\n";
    exit( 1 );
}

// Parse positional CLI args ($args is provided by WP-CLI eval-file).
$event_id = isset( $args[0] ) ? absint( $args[0] ) : 0;
$count    = isset( $args[1] ) ? absint( $args[1] ) : 1000;
$email    = isset( $args[2] ) ? sanitize_email( $args[2] ) : '';
$status   = isset( $args[3] ) ? sanitize_text_field( $args[3] ) : 'registered';

if ( ! $event_id ) {
    WP_CLI::error( 'Usage: wp eval-file seed-candidates.php <event_id> [count] [email] [status]' );
}

// Verify event exists.
global $wpdb;
$table = $wpdb->prefix . 'aioemp_events';
$event = $wpdb->get_row( $wpdb->prepare( "SELECT id FROM {$table} WHERE id = %d", $event_id ) );
if ( ! $event ) {
    WP_CLI::error( "Event ID {$event_id} not found." );
}

// Lists for random name generation.
$first_names = array(
    'James','John','Robert','Michael','David','William','Richard','Joseph','Thomas','Charles',
    'Christopher','Daniel','Matthew','Anthony','Mark','Donald','Steven','Paul','Andrew','Joshua',
    'Mary','Patricia','Jennifer','Linda','Barbara','Elizabeth','Susan','Jessica','Sarah','Karen',
    'Emma','Olivia','Ava','Isabella','Sophia','Mia','Charlotte','Amelia','Harper','Evelyn',
    'Alexander','Benjamin','Samuel','Henry','Sebastian','Jack','Aiden','Owen','Lucas','Ethan',
    'Oliver','Liam','Noah','Mason','Logan','Elijah','Chloe','Grace','Lily','Zoe',
);

$last_names = array(
    'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
    'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
    'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
    'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
    'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
);

$titles = array( '', '', '', 'Mr', 'Ms', 'Dr', 'Prof' );

$companies = array(
    'Acme Corp','Globex','Initech','Umbrella Inc','Stark Industries',
    'Wayne Enterprises','Oscorp','LexCorp','Cyberdyne','Soylent',
    'Wonka Industries','Tyrell Corp','Aperture Science','Massive Dynamic',
    'Hooli','Pied Piper','Aviato','WOZZ','TechVentures','InnovateCo',
);

$valid_statuses = array( 'registered', 'accepted_onsite', 'accepted_online', 'rejected' );
if ( ! in_array( $status, $valid_statuses, true ) ) {
    WP_CLI::error( "Invalid status: {$status}. Must be one of: " . implode( ', ', $valid_statuses ) );
}

$attender_table = $wpdb->prefix . 'aioemp_attender';
$batch_size     = 100;
$inserted       = 0;

WP_CLI::log( "Seeding {$count} candidates for event #{$event_id}..." );

$progress = WP_CLI\Utils\make_progress_bar( 'Inserting candidates', $count );

for ( $i = 0; $i < $count; $i++ ) {
    $first = $first_names[ array_rand( $first_names ) ];
    $last  = $last_names[ array_rand( $last_names ) ];
    $title_val = $titles[ array_rand( $titles ) ];
    $company   = $companies[ array_rand( $companies ) ];
    $cand_email = $email ?: strtolower( $first . '.' . $last . rand( 1, 9999 ) . '@example.com' );

    // Generate unique QR hash.
    $qr_hash = hash( 'sha256', wp_generate_uuid4() . wp_generate_password( 32, true, true ) );

    $result = $wpdb->insert( $attender_table, array(
        'event_id'       => $event_id,
        'title'          => $title_val ?: null,
        'first_name'     => $first,
        'last_name'      => $last,
        'company'        => $company,
        'email'          => $cand_email,
        'qrcode_hash'    => $qr_hash,
        'status'         => $status,
        'created_at_gmt' => current_time( 'mysql', true ),
    ) );

    if ( $result ) {
        $inserted++;
    }

    $progress->tick();
}

$progress->finish();

WP_CLI::success( "Inserted {$inserted} / {$count} candidates for event #{$event_id}." );
