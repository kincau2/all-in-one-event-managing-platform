<?php
/**
 * Default email template — Application Rejected.
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
    'subject' => 'Registration Update — {{event_title}}',
    'body'    =>
        '<p>Dear {{full_name}},</p>' .
        '<p>Thank you for your interest in <strong>{{event_title}}</strong>.</p>' .
        '<p>After careful review, we regret to inform you that we are unable to ' .
        'accommodate your registration at this time.</p>' .
        '<p>We appreciate your understanding and hope to welcome you to future events.</p>' .
        '<p>Best regards,<br>{{company_name}}</p>',
);
