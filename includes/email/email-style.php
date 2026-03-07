<?php
/**
 * Shared email styles — inline CSS constants for the HTML email wrapper.
 *
 * Returns an associative array of named CSS property strings used by
 * AIOEMP_Email_Service::wrap_html().  Keeping them here makes it easy
 * to tweak the email look-and-feel in one place.
 *
 * @package AIOEMP
 * @since   0.6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

return array(

    /* ── Outer wrapper ─────────────────────────────────────────── */
    'body'       => 'margin:0;padding:0;background-color:#f2edf3;'
                  . 'font-family:Ubuntu,Helvetica,Arial,sans-serif;'
                  . '-webkit-text-size-adjust:100%;',

    'outer_table' => 'background-color:#f2edf3;',

    'outer_td'    => 'padding:24px 16px;',

    /* ── Card ──────────────────────────────────────────────────── */
    'card'       => 'max-width:600px;width:100%;background:#ffffff;'
                  . 'border-radius:8px;overflow:hidden;'
                  . 'box-shadow:0 2px 12px rgba(0,0,0,0.06);',

    /* ── Logo ──────────────────────────────────────────────────── */
    'logo_wrap'  => 'text-align:center;padding:24px 0 16px;',

    'logo_img'   => 'max-width:180px;max-height:60px;height:auto;',

    'header_td'  => 'padding:0 32px;',

    /* ── Body ──────────────────────────────────────────────────── */
    'body_td'    => 'padding:0 32px 32px;color:#343A40;'
                  . 'font-size:15px;line-height:1.7;',

    /* ── Footer ────────────────────────────────────────────────── */
    'footer_td'  => 'padding:20px 32px;background:#f8f9fa;'
                  . 'border-top:1px solid #e8e8e8;text-align:center;'
                  . 'color:#6C757D;font-size:12px;line-height:1.6;',

    'footer_link' => 'color:#6C757D;',

    /* ── CTA button (used inside templates) ────────────────────── */
    'cta_button' => 'display:inline-block;padding:12px 28px;'
                  . 'background:#4B49AC;color:#fff;text-decoration:none;'
                  . 'border-radius:6px;font-weight:600;',
);
