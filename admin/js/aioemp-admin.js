/**
 * AIOEMP Admin SPA — entry point.
 *
 * Minimal client-side router + REST helper.
 * Relies on `aioemp` global set by wp_localize_script().
 *
 * Design reference : Star Admin 2 Pro (vertical-boxed)
 * Layout           : Full-screen overlay — hides WP admin chrome
 *
 * @package AIOEMP
 * @since   0.1.0
 */
(function ($) {
    'use strict';

    /* Global config injected by PHP --------------------------------------- */
    const cfg = window.aioemp || {};

    /* --------------------------------------------------------------------- *
     * REST helper
     * --------------------------------------------------------------------- */
    const api = {
        /**
         * Make an authenticated REST request.
         *
         * @param {string} endpoint  Relative to aioemp/v1/ (e.g. 'events').
         * @param {object} options   Fetch options override.
         * @returns {Promise<object>}
         */
        request(endpoint, options = {}) {
            const url = cfg.rest_url + endpoint;
            const defaults = {
                headers: {
                    'Content-Type': 'application/json',
                    'X-WP-Nonce': cfg.nonce,
                },
                credentials: 'same-origin',
            };
            const merged = { ...defaults, ...options, headers: { ...defaults.headers, ...(options.headers || {}) } };
            return fetch(url, merged).then(res => {
                if (!res.ok) {
                    return res.json().then(err => Promise.reject(err));
                }
                return res.json();
            });
        },
        get(endpoint) { return this.request(endpoint); },
        /** GET that returns { data, headers } so callers can read pagination headers. */
        getWithHeaders(endpoint) {
            const url = cfg.rest_url + endpoint;
            const opts = {
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': cfg.nonce },
                credentials: 'same-origin',
            };
            return fetch(url, opts).then(res => {
                if (!res.ok) return res.json().then(err => Promise.reject(err));
                return res.json().then(data => ({
                    data: data,
                    total: parseInt(res.headers.get('X-WP-Total') || '0', 10),
                    totalPages: parseInt(res.headers.get('X-WP-TotalPages') || '0', 10),
                }));
            });
        },
        post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
        put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
        del(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
        /** Build a full REST URL for a given endpoint (for native fetch usage). */
        buildUrl(endpoint) { return cfg.rest_url + endpoint; },
    };

    // Expose for other modules.
    window.aioemp_api = api;
    window.aioemp_rest_nonce = cfg.nonce;

    /**
     * Shared HTML-escape utility — use instead of per-module copies.
     */
    window.aioemp_esc = function (str) {
        var el = document.createElement('span');
        el.textContent = str == null ? '' : String(str);
        return el.innerHTML;
    };

    /* --------------------------------------------------------------------- *
     * Custom modal popups (replaces native confirm / alert)
     * --------------------------------------------------------------------- */
    window.aioemp_modal = (function () {
        var esc = window.aioemp_esc;

        function buildOverlay() {
            var $overlay = $('<div class="aioemp-popup-overlay"></div>');
            $('body').append($overlay);
            // Animate in.
            requestAnimationFrame(function () { $overlay.addClass('is-visible'); });
            return $overlay;
        }

        function removeOverlay($overlay) {
            $overlay.removeClass('is-visible');
            setTimeout(function () { $overlay.remove(); }, 200);
        }

        /**
         * Show an alert popup (informational).
         * @param {string} message  Plain-text or pre-escaped HTML message.
         * @param {object} [opts]   { title, variant: 'info'|'success'|'warning'|'danger' }
         * @returns {Promise<void>}
         */
        function showAlert(message, opts) {
            opts = opts || {};
            var variant = opts.variant || 'info';
            var title   = opts.title   || 'Notice';
            var icon    = iconForVariant(variant);

            return new Promise(function (resolve) {
                var $overlay = buildOverlay();
                var $popup = $(
                    '<div class="aioemp-popup aioemp-popup--' + variant + '">' +
                        '<div class="aioemp-popup__icon">' + icon + '</div>' +
                        '<h3 class="aioemp-popup__title">' + esc(title) + '</h3>' +
                        '<div class="aioemp-popup__message">' + esc(message) + '</div>' +
                        '<div class="aioemp-popup__actions">' +
                            '<button class="aioemp-btn aioemp-btn--primary aioemp-popup__btn-ok">OK</button>' +
                        '</div>' +
                    '</div>'
                );
                $overlay.append($popup);

                function close() {
                    removeOverlay($overlay);
                    resolve();
                }

                $popup.find('.aioemp-popup__btn-ok').on('click', close);
                $overlay.on('click', function (e) { if (e.target === this) close(); });
                $(document).one('keydown.aioemp-popup', function (e) { if (e.key === 'Escape') close(); });
                $popup.find('.aioemp-popup__btn-ok').focus();
            });
        }

        /**
         * Show a confirm popup.
         * @param {string} message  Plain-text message.
         * @param {object} [opts]   { title, variant, confirmText, cancelText, detail }
         * @returns {Promise<boolean>}  true = confirmed, false = cancelled.
         */
        function showConfirm(message, opts) {
            opts = opts || {};
            var variant     = opts.variant     || 'warning';
            var title       = opts.title       || 'Confirm';
            var confirmText = opts.confirmText || 'Confirm';
            var cancelText  = opts.cancelText  || 'Cancel';
            var detail      = opts.detail      || '';
            var icon        = iconForVariant(variant);
            var btnClass    = variant === 'danger'
                ? 'aioemp-btn--danger'
                : 'aioemp-btn--primary';

            return new Promise(function (resolve) {
                var $overlay = buildOverlay();
                var $popup = $(
                    '<div class="aioemp-popup aioemp-popup--' + variant + '">' +
                        '<div class="aioemp-popup__icon">' + icon + '</div>' +
                        '<h3 class="aioemp-popup__title">' + esc(title) + '</h3>' +
                        '<div class="aioemp-popup__message">' + esc(message) + '</div>' +
                        (detail ? '<div class="aioemp-popup__detail">' + esc(detail) + '</div>' : '') +
                        '<div class="aioemp-popup__actions">' +
                            '<button class="aioemp-btn aioemp-btn--outline aioemp-popup__btn-cancel">' + esc(cancelText) + '</button>' +
                            '<button class="aioemp-btn ' + btnClass + ' aioemp-popup__btn-confirm">' + esc(confirmText) + '</button>' +
                        '</div>' +
                    '</div>'
                );
                $overlay.append($popup);

                var resolved = false;
                function finish(val) {
                    if (resolved) return;
                    resolved = true;
                    $(document).off('keydown.aioemp-popup');
                    removeOverlay($overlay);
                    resolve(val);
                }

                $popup.find('.aioemp-popup__btn-confirm').on('click', function () { finish(true); });
                $popup.find('.aioemp-popup__btn-cancel').on('click', function () { finish(false); });
                $overlay.on('click', function (e) { if (e.target === this) finish(false); });
                $(document).on('keydown.aioemp-popup', function (e) { if (e.key === 'Escape') finish(false); });
                $popup.find('.aioemp-popup__btn-confirm').focus();
            });
        }

        function iconForVariant(v) {
            switch (v) {
                case 'danger':  return '<span class="dashicons dashicons-warning" style="color:var(--sa-danger)"></span>';
                case 'warning': return '<span class="dashicons dashicons-warning" style="color:var(--sa-warning)"></span>';
                case 'success': return '<span class="dashicons dashicons-yes-alt" style="color:var(--sa-success)"></span>';
                default:        return '<span class="dashicons dashicons-info" style="color:var(--sa-info)"></span>';
            }
        }

        return { alert: showAlert, confirm: showConfirm };
    })();

    /* --------------------------------------------------------------------- *
     * Full-screen overlay setup
     * --------------------------------------------------------------------- */
    function initOverlay() {
        // Add body class so CSS can hide WP chrome.
        document.body.classList.add('aioemp-active');

        // Mobile sidebar toggle.
        const $sidebar = $('#aioemp-sidebar');
        $('#aioemp-toggle-sidebar').on('click', function () {
            $sidebar.toggleClass('is-open');
        });

        // Close sidebar on content area click (mobile).
        $('#aioemp-content').on('click', function () {
            $sidebar.removeClass('is-open');
        });
    }

    /* --------------------------------------------------------------------- *
     * Minimal hash-based SPA router
     * --------------------------------------------------------------------- */
    const $content = $('#aioemp-content');
    const $title   = $('#aioemp-page-title');
    const routes   = {};
    const caps     = cfg.user_caps || {};

    /**
     * Check if the current user has a specific AIOEMP capability.
     *
     * @param {string} key  Capability key (e.g. 'manage_events').
     * @returns {boolean}
     */
    function userCan(key) {
        return !!caps[key];
    }

    // Expose for other modules.
    window.aioemp_userCan = userCan;

    /**
     * Register a route handler.
     *
     * @param {string}   name     Route name (matches data-route and #hash).
     * @param {string}   title    Page title shown in topbar.
     * @param {function} handler  Called with ($container) when route activates.
     */
    function registerRoute(name, title, handler) {
        routes[name] = { title, handler };
    }

    function navigate() {
        // Determine the default landing route based on user capabilities.
        let defaultRoute = 'events';
        if (!userCan('view_events') && userCan('view_seatmaps'))  defaultRoute = 'seatmaps';
        if (!userCan('view_events') && !userCan('view_seatmaps') && userCan('manage_settings')) defaultRoute = 'users';

        const hash  = (location.hash || '#' + defaultRoute).replace('#', '');
        const route = routes[hash];

        // Check for dynamic route: seatmap-edit/{id}
        const editMatch = hash.match(/^seatmap-edit\/(\d+)$/);

        // Check for dynamic route: event/{id}
        const eventDetailMatch = hash.match(/^event\/(\d+)$/);

        /* ── Route-level capability guards ── */
        const routeCaps = {
            events:   'view_events',
            seatmaps: 'view_seatmaps',
            users:    'manage_settings',
            settings: 'manage_settings',
            emails:   'manage_settings',
        };

        if (editMatch && !userCan('manage_seatmaps')) {
            location.hash = '#' + defaultRoute;
            return;
        }
        if (eventDetailMatch && !userCan('view_events')) {
            location.hash = '#' + defaultRoute;
            return;
        }
        if (routeCaps[hash] && !userCan(routeCaps[hash])) {
            location.hash = '#' + defaultRoute;
            return;
        }

        // Update active nav link.
        $('.aioemp-nav-link').removeClass('is-active');
        if (editMatch) {
            $(`.aioemp-nav-link[data-route="seatmaps"]`).addClass('is-active');
        } else if (eventDetailMatch) {
            $(`.aioemp-nav-link[data-route="events"]`).addClass('is-active');
        } else {
            $(`.aioemp-nav-link[data-route="${hash}"]`).addClass('is-active');
        }

        if (editMatch) {
            $title.text('Seatmap Editor');
            $content.empty();
            if (window.aioemp_seatmaps && window.aioemp_seatmaps.renderEdit) {
                window.aioemp_seatmaps.renderEdit($content);
            }
        } else if (eventDetailMatch) {
            $title.text('Event Detail');
            $content.empty();
            if (window.aioemp_events && window.aioemp_events.renderDetail) {
                window.aioemp_events.renderDetail($content);
            }
        } else if (route) {
            $title.text(route.title);
            $content.empty();
            route.handler($content);
        } else {
            $title.text('Not Found');
            $content.html('<div class="aioemp-card"><p>Page not found.</p></div>');
        }
    }

    $(window).on('hashchange', navigate);

    /* --------------------------------------------------------------------- *
     * Placeholder route handlers (replaced per-module in later phases)
     * --------------------------------------------------------------------- */
    registerRoute('events', 'Events', function ($el) {
        if (window.aioemp_events && window.aioemp_events.render) {
            window.aioemp_events.render($el);
        } else {
            $el.html(
                '<div class="aioemp-card">' +
                    '<h3 class="aioemp-card__title">Events</h3>' +
                    '<p>Events module is loading…</p>' +
                '</div>'
            );
        }
    });

    registerRoute('seatmaps', 'Seatmaps', function ($el) {
        if (window.aioemp_seatmaps && window.aioemp_seatmaps.render) {
            window.aioemp_seatmaps.render($el);
        } else {
            $el.html(
                '<div class="aioemp-card">' +
                    '<h3 class="aioemp-card__title">Seatmap Templates</h3>' +
                    '<p>Seatmaps module is loading…</p>' +
                '</div>'
            );
        }
    });

    registerRoute('users', 'Users', function ($el) {
        if (window.aioemp_users && window.aioemp_users.render) {
            window.aioemp_users.render($el);
        } else {
            $el.html(
                '<div class="aioemp-card">' +
                    '<h3 class="aioemp-card__title">Users</h3>' +
                    '<p>Users module is loading…</p>' +
                '</div>'
            );
        }
    });

    registerRoute('settings', 'Settings', function ($el) {
        if (window.aioemp_settings && window.aioemp_settings.render) {
            window.aioemp_settings.render($el);
        } else {
            $el.html(
                '<div class="aioemp-card">' +
                    '<h3 class="aioemp-card__title">Settings</h3>' +
                    '<p>Settings module is loading…</p>' +
                '</div>'
            );
        }
    });

    registerRoute('emails', 'Email Templates', function ($el) {
        if (window.aioemp_emails && window.aioemp_emails.render) {
            window.aioemp_emails.render($el);
        } else {
            $el.html(
                '<div class="aioemp-card">' +
                    '<h3 class="aioemp-card__title">Email Templates</h3>' +
                    '<p>Emails module is loading…</p>' +
                '</div>'
            );
        }
    });

    registerRoute('profile', 'Profile Settings', function ($el) {
        if (window.aioemp_profile && window.aioemp_profile.render) {
            window.aioemp_profile.render($el);
        } else {
            $el.html(
                '<div class="aioemp-card">' +
                    '<h3 class="aioemp-card__title">Profile Settings</h3>' +
                    '<p>Profile module is loading…</p>' +
                '</div>'
            );
        }
    });

    /* Boot ---------------------------------------------------------------- */
    $(document).ready(function () {
        initOverlay();

        // Sidebar brand icon — always use the default calendar dashicon.
        // (Company logo is only used on public pages / emails.)

        navigate();
    });

})(jQuery);
