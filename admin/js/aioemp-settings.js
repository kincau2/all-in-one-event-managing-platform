/**
 * AIOEMP Settings module.
 *
 * Renders the Settings page inside the SPA shell and handles
 * load / save / logo-upload via the REST API.
 *
 * @package AIOEMP
 * @since   0.1.0
 */
(function ($) {
    'use strict';

    const api = window.aioemp || {};
    const rest = window.aioemp_api;

    /* ------------------------------------------------------------------ *
     * Data cache
     * ------------------------------------------------------------------ */
    let settings = {};

    /* ------------------------------------------------------------------ *
     * Render
     * ------------------------------------------------------------------ */

    /**
     * Main entry — called by the SPA router.
     *
     * @param {jQuery} $el Container element.
     */
    function render($el) {
        $el.html(buildSkeleton());
        loadSettings($el);
    }

    function buildSkeleton() {
        return (
            '<div class="aioemp-settings">' +

            /* ---- Branding card ---- */
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">Branding</h3>' +
                '<div class="aioemp-form-group">' +
                    '<label class="aioemp-label">Company Logo</label>' +
                    '<div class="aioemp-logo-preview" id="aioemp-logo-preview"></div>' +
                    '<div class="aioemp-logo-actions">' +
                        '<label class="aioemp-btn aioemp-btn--outline" id="aioemp-logo-upload-btn">' +
                            '<span class="dashicons dashicons-upload"></span> Upload Logo' +
                            '<input type="file" id="aioemp-logo-input" accept="image/*" style="display:none">' +
                        '</label>' +
                        '<button type="button" class="aioemp-btn aioemp-btn--outline" id="aioemp-logo-remove-btn" style="display:none">' +
                            '<span class="dashicons dashicons-trash"></span> Remove' +
                        '</button>' +
                    '</div>' +
                    '<p class="aioemp-help">JPEG, PNG, GIF, WebP, or SVG. Max 2 MB.</p>' +
                '</div>' +
            '</div>' +

            /* ---- Company Details card ---- */
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">Company Details</h3>' +
                '<p class="aioemp-help" style="margin-bottom:12px;">Used in email templates and public-facing pages.</p>' +
                '<div class="aioemp-form-row">' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-company-name">Company Name</label>' +
                        '<input type="text" id="aioemp-company-name" class="aioemp-input" placeholder="Your Company Ltd.">' +
                    '</div>' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-company-email">Email Address</label>' +
                        '<input type="email" id="aioemp-company-email" class="aioemp-input" placeholder="info@example.com">' +
                    '</div>' +
                '</div>' +
                '<div class="aioemp-form-row">' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-company-tel">Telephone</label>' +
                        '<input type="text" id="aioemp-company-tel" class="aioemp-input" placeholder="+852 1234 5678">' +
                    '</div>' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-company-address">Address</label>' +
                        '<textarea id="aioemp-company-address" class="aioemp-input" rows="2" placeholder="123 Main St, City, Country"></textarea>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* ---- CAPTCHA card ---- */
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">CAPTCHA / Bot Protection</h3>' +
                '<div class="aioemp-form-group">' +
                    '<label class="aioemp-label" for="aioemp-captcha-provider">Provider</label>' +
                    '<select id="aioemp-captcha-provider" class="aioemp-select">' +
                        '<option value="none">None</option>' +
                        '<option value="recaptcha_v2">Google reCAPTCHA v2</option>' +
                        '<option value="recaptcha_v3">Google reCAPTCHA v3</option>' +
                        '<option value="turnstile">Cloudflare Turnstile</option>' +
                    '</select>' +
                '</div>' +
                '<div id="aioemp-captcha-keys" style="display:none">' +
                    '<div class="aioemp-form-row">' +
                        '<div class="aioemp-form-group aioemp-form-group--half">' +
                            '<label class="aioemp-label" for="aioemp-captcha-site-key">Site Key</label>' +
                            '<input type="text" id="aioemp-captcha-site-key" class="aioemp-input" placeholder="Site key">' +
                        '</div>' +
                        '<div class="aioemp-form-group aioemp-form-group--half">' +
                            '<label class="aioemp-label" for="aioemp-captcha-secret-key">Secret Key</label>' +
                            '<input type="password" id="aioemp-captcha-secret-key" class="aioemp-input" placeholder="Secret key">' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* ---- Behaviour card ---- */
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">Behaviour</h3>' +
                '<div class="aioemp-form-row">' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-default-venue-mode">Default Venue Mode</label>' +
                        '<select id="aioemp-default-venue-mode" class="aioemp-select">' +
                            '<option value="onsite">Onsite</option>' +
                            '<option value="online">Online</option>' +
                            '<option value="mixed">Mixed</option>' +
                        '</select>' +
                    '</div>' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-default-capacity">Default Capacity</label>' +
                        '<input type="number" id="aioemp-default-capacity" class="aioemp-input" min="1" max="100000">' +
                    '</div>' +
                '</div>' +
                '<div class="aioemp-form-row">' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-email-batch-size">Email Batch Size</label>' +
                        '<input type="number" id="aioemp-email-batch-size" class="aioemp-input" min="1" max="50" placeholder="1">' +
                        '<p class="aioemp-help">Number of emails sent per cycle when bulk-processing candidates (1–50).</p>' +
                    '</div>' +
                    '<div class="aioemp-form-group aioemp-form-group--half">' +
                        '<label class="aioemp-label" for="aioemp-email-batch-wait">Wait Between Cycles (ms)</label>' +
                        '<input type="number" id="aioemp-email-batch-wait" class="aioemp-input" min="0" max="60000" step="100" placeholder="0">' +
                        '<p class="aioemp-help">Milliseconds to pause between each batch cycle (0–60000).</p>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* ---- Ticket / Check-In card ---- */
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">Ticket &amp; Check-In</h3>' +
                '<div class="aioemp-form-group">' +
                    '<label class="aioemp-label" for="aioemp-ticket-slug">Ticket Page Slug</label>' +
                    '<input type="text" id="aioemp-ticket-slug" class="aioemp-input" placeholder="e-ticket" style="max-width:300px">' +
                    '<p class="aioemp-help">The URL path for the public ticket page. Example: <code>yourdomain.com/<strong>e-ticket</strong>/&lt;hash&gt;</code></p>' +
                    '<div id="aioemp-ticket-slug-conflict" style="display:none" class="aioemp-form-error">' +
                        '<span class="dashicons dashicons-warning"></span> This slug conflicts with an existing page. Choose a different one.' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* ---- Save bar ---- */
            '<div class="aioemp-settings__actions">' +
                '<button type="button" class="aioemp-btn aioemp-btn--primary" id="aioemp-settings-save">' +
                    '<span class="dashicons dashicons-saved"></span> Save Settings' +
                '</button>' +
                '<span class="aioemp-settings__status" id="aioemp-settings-status"></span>' +
            '</div>' +

            '</div>'
        );
    }

    /* ------------------------------------------------------------------ *
     * Load
     * ------------------------------------------------------------------ */

    function loadSettings($el) {
        rest.get('settings').then(function (data) {
            settings = data;
            populateForm(data);
            bindEvents($el);
        }).catch(function () {
            $el.find('#aioemp-settings-status')
                .text('Failed to load settings.')
                .addClass('aioemp-settings__status--error');
        });
    }

    function populateForm(data) {
        // Logo.
        renderLogoPreview(data.logo_url);
        if (data.logo_url) {
            $('#aioemp-logo-remove-btn').show();
        }

        // CAPTCHA.
        $('#aioemp-captcha-provider').val(data.captcha_provider);
        toggleCaptchaKeys(data.captcha_provider);
        $('#aioemp-captcha-site-key').val(data.captcha_site_key);
        $('#aioemp-captcha-secret-key').val(''); // never pre-fill real secret
        if (data.captcha_secret_key && data.captcha_secret_key !== '') {
            $('#aioemp-captcha-secret-key').attr('placeholder', data.captcha_secret_key); // shows masked ••••
        }

        // Company details.
        $('#aioemp-company-name').val(data.company_name || '');
        $('#aioemp-company-email').val(data.company_email || '');
        $('#aioemp-company-tel').val(data.company_tel || '');
        $('#aioemp-company-address').val(data.company_address || '');

        // Behaviour.
        $('#aioemp-default-venue-mode').val(data.default_venue_mode);
        $('#aioemp-default-capacity').val(data.default_capacity);
        $('#aioemp-email-batch-size').val(data.email_batch_size || 1);
        $('#aioemp-email-batch-wait').val(data.email_batch_wait_ms || 0);

        // Ticket.
        $('#aioemp-ticket-slug').val(data.ticket_page_slug || 'e-ticket');
    }

    function renderLogoPreview(url) {
        const $preview = $('#aioemp-logo-preview');
        if (url) {
            $preview.html('<img src="' + escHtml(url) + '" alt="Logo" class="aioemp-logo-preview__img">');
        } else {
            $preview.html(
                '<div class="aioemp-logo-preview__placeholder">' +
                    '<span class="dashicons dashicons-format-image"></span>' +
                    '<span>No logo uploaded</span>' +
                '</div>'
            );
        }
    }

    function toggleCaptchaKeys(provider) {
        if (provider && provider !== 'none') {
            $('#aioemp-captcha-keys').slideDown(200);
        } else {
            $('#aioemp-captcha-keys').slideUp(200);
        }
    }

    /* ------------------------------------------------------------------ *
     * Events
     * ------------------------------------------------------------------ */

    function bindEvents($el) {
        // CAPTCHA provider change.
        $('#aioemp-captcha-provider').off('change').on('change', function () {
            toggleCaptchaKeys($(this).val());
        });

        // Logo upload.
        $('#aioemp-logo-input').off('change').on('change', function () {
            var fileInput = this;
            if (!fileInput.files || !fileInput.files[0]) return;
            uploadLogo(fileInput.files[0]);
        });

        // Logo remove.
        $('#aioemp-logo-remove-btn').off('click').on('click', function () {
            removeLogo();
        });

        // Save.
        $('#aioemp-settings-save').off('click').on('click', function () {
            saveSettings();
        });
    }

    /* ------------------------------------------------------------------ *
     * Save
     * ------------------------------------------------------------------ */

    function saveSettings() {
        var $btn    = $('#aioemp-settings-save');
        var $status = $('#aioemp-settings-status');
        $btn.prop('disabled', true);
        $status.text('Saving…').removeClass('aioemp-settings__status--error aioemp-settings__status--ok');

        var payload = {
            company_name:       $.trim($('#aioemp-company-name').val()),
            company_email:      $.trim($('#aioemp-company-email').val()),
            company_tel:        $.trim($('#aioemp-company-tel').val()),
            company_address:    $.trim($('#aioemp-company-address').val()),
            captcha_provider:   $('#aioemp-captcha-provider').val(),
            captcha_site_key:   $('#aioemp-captcha-site-key').val(),
            default_venue_mode: $('#aioemp-default-venue-mode').val(),
            default_capacity:   parseInt($('#aioemp-default-capacity').val(), 10) || 100,
            email_batch_size:   parseInt($('#aioemp-email-batch-size').val(), 10) || 1,
            email_batch_wait_ms: parseInt($('#aioemp-email-batch-wait').val(), 10) || 0,
            ticket_page_slug:   $.trim($('#aioemp-ticket-slug').val()) || 'e-ticket',
        };

        // Only include secret key if user actually typed a new one.
        var secretVal = $('#aioemp-captcha-secret-key').val();
        if (secretVal && secretVal.length > 0) {
            payload.captcha_secret_key = secretVal;
        }

        rest.put('settings', payload).then(function (data) {
            settings = data;
            $status.text('Settings saved.').addClass('aioemp-settings__status--ok');
            // Update secret placeholder.
            if (data.captcha_secret_key && data.captcha_secret_key !== '') {
                $('#aioemp-captcha-secret-key').val('').attr('placeholder', data.captcha_secret_key);
            }
            setTimeout(function () { $status.text(''); }, 3000);
        }).catch(function (err) {
            var msg = (err && err.message) ? err.message : 'Save failed.';
            $status.text(msg).addClass('aioemp-settings__status--error');
        }).finally(function () {
            $btn.prop('disabled', false);
        });
    }

    /* ------------------------------------------------------------------ *
     * Logo upload
     * ------------------------------------------------------------------ */

    function uploadLogo(file) {
        var $status = $('#aioemp-settings-status');
        $status.text('Uploading…').removeClass('aioemp-settings__status--error aioemp-settings__status--ok');

        var fd = new FormData();
        fd.append('logo', file);

        var cfg = window.aioemp || {};
        fetch(cfg.rest_url + 'settings/logo', {
            method: 'POST',
            headers: { 'X-WP-Nonce': cfg.nonce },
            credentials: 'same-origin',
            body: fd, // Do NOT set Content-Type — browser sets multipart boundary.
        })
        .then(function (res) {
            if (!res.ok) return res.json().then(function (e) { return Promise.reject(e); });
            return res.json();
        })
        .then(function (data) {
            renderLogoPreview(data.url);
            $('#aioemp-logo-remove-btn').show();
            $status.text('Logo uploaded.').addClass('aioemp-settings__status--ok');
            setTimeout(function () { $status.text(''); }, 3000);
        })
        .catch(function (err) {
            var msg = (err && err.message) ? err.message : 'Upload failed.';
            $status.text(msg).addClass('aioemp-settings__status--error');
        });
    }

    function removeLogo() {
        rest.put('settings', { logo_attachment_id: 0, logo_url: '' }).then(function () {
            renderLogoPreview('');
            $('#aioemp-logo-remove-btn').hide();
        });
    }

    /* ------------------------------------------------------------------ *
     * Utility
     * ------------------------------------------------------------------ */

    var escHtml = window.aioemp_esc;

    /* ------------------------------------------------------------------ *
     * Expose to SPA router
     * ------------------------------------------------------------------ */
    window.aioemp_settings = { render: render };

})(jQuery);
