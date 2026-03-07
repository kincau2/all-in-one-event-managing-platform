<?php
/**
 * Default email template — Accepted (Online).
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
    'subject' => 'You\'re Accepted (Online) — {{event_title}}',
    'body'    =>
        '<p>Dear {{full_name}},</p>' .
        '<p>Your registration for <strong>{{event_title}}</strong> has been ' .
        '<strong>accepted</strong> for online attendance.</p>' .
        '<p><strong>Date:</strong> {{event_date}}<br>' .
        '<strong>Join Online:</strong> <a href="{{online_url}}">{{online_url}}</a></p>' .
        '<p>You will receive further instructions closer to the event date.</p>' .
        '<p>Best regards,<br>{{company_name}}</p>',
);
