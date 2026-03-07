<?php
/**
 * Default email template — Registration Confirmation.
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
    'subject' => 'Registration Confirmed — {{event_title}}',
    'body'    =>
        '<p>Dear {{full_name}},</p>' .
        '<p>Thank you for registering for <strong>{{event_title}}</strong>.</p>' .
        '<p><strong>Date:</strong> {{event_date}}<br>' .
        '<strong>Location:</strong> {{event_location}}</p>' .
        '<p>We have received your registration and will notify you once your application has been reviewed.</p>' .
        '<p>Best regards,<br>{{company_name}}</p>',
);
