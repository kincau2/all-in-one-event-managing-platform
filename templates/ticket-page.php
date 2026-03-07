<?php
/**
 * Template: Ticket Page
 *
 * Public-facing ticket display for attendees who scan/click a QR code URL.
 * Rendered by AIOEMP_Ticket_Endpoint::handle_ticket_request().
 *
 * Available variables:
 *   $attender    object   Attender record (id, first_name, last_name, email, status, qrcode_hash, …)
 *   $event       object   Event record (id, title, start_date_gmt, venue, …)
 *   $seat_label   string|null  Seat key (e.g. "A-12") or null if no seat assigned.
 *   $latest_scan  object|null  Latest attendance record (type, scanned_at_gmt) or null.
 *   $logo_url     string   Logo URL from plugin settings (may be empty).
 *   $qr_code_url  string   QR code image URL (may be empty).
 *
 * @package AIOEMP
 * @since   0.8.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Format event date.
$event_date_display = '';
if ( ! empty( $event->start_date_gmt ) ) {
    $event_date_display = wp_date(
        get_option( 'date_format' ) . ' ' . get_option( 'time_format' ),
        strtotime( $event->start_date_gmt )
    );
}

// Check-in status.
$is_checked_in = $latest_scan && 'IN' === $latest_scan->type;
$status_label  = $is_checked_in ? __( 'Checked In', 'aioemp' ) : __( 'Not Checked In', 'aioemp' );
$status_class  = $is_checked_in ? 'aioemp-ticket__status--in' : 'aioemp-ticket__status--out';

// Attendee name.
$attendee_name = trim( ( $attender->first_name ?? '' ) . ' ' . ( $attender->last_name ?? '' ) );
if ( empty( $attendee_name ) ) {
    $attendee_name = $attender->email ?? __( 'Attendee', 'aioemp' );
}

// Candidate status badge.
$candidate_status = $attender->status ?? 'pending';

// Human-readable status labels.
$status_labels_map = array(
    'registered'       => __( 'Registered', 'aioemp' ),
    'pending'          => __( 'Pending', 'aioemp' ),
    'accepted_onsite'  => __( 'Accepted (On-site)', 'aioemp' ),
    'accepted_online'  => __( 'Accepted (Online)', 'aioemp' ),
    'rejected'         => __( 'Rejected', 'aioemp' ),
    'cancelled'        => __( 'Cancelled', 'aioemp' ),
);
$candidate_status_label = $status_labels_map[ $candidate_status ] ?? ucfirst( str_replace( '_', ' ', $candidate_status ) );

// CSS class safe status key (strip compound to first word for badge class).
$candidate_status_class = explode( '_', $candidate_status )[0];
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title><?php
        /* translators: %s: event title */
        printf( esc_html__( 'Ticket — %s', 'aioemp' ), esc_html( $event->title ?? '' ) );
    ?></title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
                         Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
            background: #f0f2f5;
            color: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px 16px;
        }

        .aioemp-ticket-wrapper {
            width: 100%;
            max-width: 420px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .aioemp-ticket-wrapper__logo {
            max-width: 160px;
            max-height: 70px;
            margin-bottom: 20px;
            object-fit: contain;
        }

        .aioemp-ticket {
            width: 100%;
            max-width: 420px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
            overflow: hidden;
        }

        /* Header */
        .aioemp-ticket__header {
            background: #4b49ac;
            color: #fff;
            padding: 24px 24px 20px;
            text-align: center;
        }
        .aioemp-ticket__event-title {
            font-size: 20px;
            font-weight: 600;
            line-height: 1.3;
            margin-bottom: 4px;
        }
        .aioemp-ticket__event-date {
            font-size: 14px;
            opacity: 0.85;
        }

        /* Status badge */
        .aioemp-ticket__status-bar {
            display: flex;
            justify-content: center;
            padding: 12px 24px;
            border-bottom: 1px solid #eee;
        }
        .aioemp-ticket__status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .aioemp-ticket__status--in {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .aioemp-ticket__status--out {
            background: #fff3e0;
            color: #e65100;
        }
        .aioemp-ticket__status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: currentColor;
        }

        /* Body */
        .aioemp-ticket__body {
            padding: 24px;
        }
        .aioemp-ticket__row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding: 12px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        .aioemp-ticket__row:last-child {
            border-bottom: 0;
        }
        .aioemp-ticket__label {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #888;
            flex-shrink: 0;
            margin-right: 16px;
        }
        .aioemp-ticket__value {
            font-size: 15px;
            font-weight: 500;
            color: #333;
            text-align: right;
            word-break: break-word;
        }

        /* Candidate status badge (accepted / pending / rejected) */
        .aioemp-ticket__candidate-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: capitalize;
        }
        .aioemp-ticket__candidate-badge--accepted {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .aioemp-ticket__candidate-badge--pending {
            background: #fff3e0;
            color: #e65100;
        }
        .aioemp-ticket__candidate-badge--rejected {
            background: #ffebee;
            color: #c62828;
        }

        /* QR Code */
        .aioemp-ticket__qr {
            text-align: center;
            padding: 20px 24px 16px;
        }
        .aioemp-ticket__qr img {
            display: block;
            margin: 0 auto;
            width: 180px;
            height: 180px;
            border-radius: 8px;
        }
        .aioemp-ticket__qr-hint {
            margin-top: 8px;
            font-size: 12px;
            color: #888;
        }

        /* Footer */
        .aioemp-ticket__footer {
            text-align: center;
            padding: 16px 24px 20px;
            border-top: 1px dashed #ddd;
            color: #aaa;
            font-size: 12px;
        }

        /* Responsive */
        @media (max-width: 480px) {
            body { padding: 16px 12px; }
            .aioemp-ticket__header { padding: 20px 16px 16px; }
            .aioemp-ticket__body { padding: 16px; }
            .aioemp-ticket__event-title { font-size: 18px; }
        }
    </style>
</head>
<body>
    <div class="aioemp-ticket-wrapper">

        <?php if ( ! empty( $logo_url ) ) : ?>
            <img src="<?php echo esc_url( $logo_url ); ?>"
                 alt="<?php esc_attr_e( 'Logo', 'aioemp' ); ?>"
                 class="aioemp-ticket-wrapper__logo">
        <?php endif; ?>

    <div class="aioemp-ticket">

        <!-- Header -->
        <div class="aioemp-ticket__header">
            <div class="aioemp-ticket__event-title">
                <?php echo esc_html( $event->title ?? __( 'Event', 'aioemp' ) ); ?>
            </div>
            <?php if ( $event_date_display ) : ?>
                <div class="aioemp-ticket__event-date">
                    <?php echo esc_html( $event_date_display ); ?>
                </div>
            <?php endif; ?>
        </div>

        <!-- Check-in status -->
        <div class="aioemp-ticket__status-bar">
            <span class="aioemp-ticket__status <?php echo esc_attr( $status_class ); ?>">
                <span class="aioemp-ticket__status-dot"></span>
                <?php echo esc_html( $status_label ); ?>
            </span>
        </div>

        <!-- QR Code -->
        <?php if ( ! empty( $qr_code_url ) ) : ?>
            <div class="aioemp-ticket__qr">
                <img src="<?php echo esc_url( $qr_code_url ); ?>"
                     alt="<?php esc_attr_e( 'QR Code', 'aioemp' ); ?>">
                <div class="aioemp-ticket__qr-hint">
                    <?php esc_html_e( 'Present this QR code at the entrance', 'aioemp' ); ?>
                </div>
            </div>
        <?php endif; ?>

        <!-- Ticket details -->
        <div class="aioemp-ticket__body">
            <div class="aioemp-ticket__row">
                <span class="aioemp-ticket__label"><?php esc_html_e( 'Name', 'aioemp' ); ?></span>
                <span class="aioemp-ticket__value"><?php echo esc_html( $attendee_name ); ?></span>
            </div>

            <?php if ( ! empty( $attender->email ) ) : ?>
                <div class="aioemp-ticket__row">
                    <span class="aioemp-ticket__label"><?php esc_html_e( 'Email', 'aioemp' ); ?></span>
                    <span class="aioemp-ticket__value"><?php echo esc_html( $attender->email ); ?></span>
                </div>
            <?php endif; ?>

            <div class="aioemp-ticket__row">
                <span class="aioemp-ticket__label"><?php esc_html_e( 'Status', 'aioemp' ); ?></span>
                <span class="aioemp-ticket__value">
                    <span class="aioemp-ticket__candidate-badge aioemp-ticket__candidate-badge--<?php echo esc_attr( $candidate_status_class ); ?>">
                        <?php echo esc_html( $candidate_status_label ); ?>
                    </span>
                </span>
            </div>

            <?php if ( $is_checked_in && ! empty( $seat_label ) ) : ?>
                <div class="aioemp-ticket__row">
                    <span class="aioemp-ticket__label"><?php esc_html_e( 'Seat', 'aioemp' ); ?></span>
                    <span class="aioemp-ticket__value" style="font-family: monospace; font-size: 16px; font-weight: 700;">
                        <?php echo esc_html( $seat_label ); ?>
                    </span>
                </div>
            <?php endif; ?>

            <?php if ( ! empty( $event->venue ) ) : ?>
                <div class="aioemp-ticket__row">
                    <span class="aioemp-ticket__label"><?php esc_html_e( 'Venue', 'aioemp' ); ?></span>
                    <span class="aioemp-ticket__value"><?php echo esc_html( $event->venue ); ?></span>
                </div>
            <?php endif; ?>

            <?php if ( $latest_scan ) : ?>
                <div class="aioemp-ticket__row">
                    <span class="aioemp-ticket__label"><?php esc_html_e( 'Last Scan', 'aioemp' ); ?></span>
                    <span class="aioemp-ticket__value">
                        <?php echo esc_html(
                            wp_date(
                                get_option( 'date_format' ) . ' ' . get_option( 'time_format' ),
                                strtotime( $latest_scan->scanned_at_gmt )
                            )
                        ); ?>
                    </span>
                </div>
            <?php endif; ?>
        </div>

        <!-- Footer -->
        <div class="aioemp-ticket__footer">
            <?php echo esc_html( get_bloginfo( 'name' ) ); ?>
        </div>

    </div><!-- .aioemp-ticket -->
    </div><!-- .aioemp-ticket-wrapper -->
</body>
</html>
