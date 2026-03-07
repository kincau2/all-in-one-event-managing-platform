<?php
/**
 * Default email template — New User Welcome (Password Setup).
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
    'subject' => 'Welcome to {{company_name}} — Set Up Your Password',
    'body'    =>
        '<p>Dear {{display_name}},</p>' .
        '<p>An account has been created for you on the <strong>{{company_name}}</strong> ' .
        'event management platform.</p>' .
        '<p><strong>Username:</strong> {{user_login}}<br>' .
        '<strong>Role:</strong> {{role_name}}</p>' .
        '<p>Please click the button below to set your password and get started:</p>' .
        '<p style="text-align:center;">' .
        '<a href="{{setup_url}}" style="display:inline-block;padding:12px 28px;' .
        'background:#4B49AC;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">' .
        'Set Up Your Password</a></p>' .
        '<p>This link will expire in 48 hours. If you did not expect this email, ' .
        'you can safely ignore it.</p>' .
        '<p>Best regards,<br>{{company_name}}</p>',
);
