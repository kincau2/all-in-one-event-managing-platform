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
        post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
        put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
        del(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
    };

    // Expose for other modules.
    window.aioemp_api = api;

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
        const hash  = (location.hash || '#events').replace('#', '');
        const route = routes[hash];

        // Check for dynamic route: seatmap-edit/{id}
        const editMatch = hash.match(/^seatmap-edit\/(\d+)$/);

        // Check for dynamic route: event/{id}
        const eventDetailMatch = hash.match(/^event\/(\d+)$/);

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

    /* Boot ---------------------------------------------------------------- */
    $(document).ready(function () {
        initOverlay();

        // Apply saved logo to sidebar brand icon.
        if (cfg.logo_url) {
            var $brand = $('.aioemp-sidebar__brand-icon');
            $brand.html('<img src="' + cfg.logo_url + '" alt="Logo" style="width:100%;height:100%;object-fit:contain;border-radius:inherit;">');
        }

        navigate();
    });

})(jQuery);
