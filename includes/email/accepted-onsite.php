<?php
/**
 * Default email template — Accepted (On-site) with QR Ticket.
 *
 * Returns an array with 'subject' and 'body' keys.
 * Body uses {{placeholder}} tokens resolved at send time.
 *
 * @package AIOEMP
 * @since   0.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

return array(
    'subject' => 'You\'re Accepted — {{event_title}}',
    'body'    =>
        '<p>Dear {{full_name}},</p>' .
        '<p>Great news! Your registration for <strong>{{event_title}}</strong> has been ' .
        '<strong>accepted</strong> for on-site attendance.</p>' .
        '<p><strong>Date:</strong> {{event_date}}<br>' .
        '<strong>Location:</strong> {{event_location}} </p>' .
        '<p>Please present the QR code below at the venue for check-in:</p>' .
        '<p style="text-align:center;">' .
        '{{qr_code_image}}' .
        '</p>' .
        '<p style="text-align:center;">' .
        '<a href="{{ticket_url}}" style="display:inline-block;padding:12px 28px;' .
        'background:#4B49AC;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">' .
        'View Your Ticket</a></p>' .
        '<p>Best regards,<br>{{company_name}}</p>',
);
