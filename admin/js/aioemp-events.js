/**
 * AIOEMP Events Module — Entry File
 *
 * Creates the shared context object `window.AIOEMP_Events` which every
 * sub-module (helpers, list, form, detail, candidates, seating) extends.
 *
 * The sub-module files are loaded in order AFTER this file and each one
 * attaches its public functions onto `ctx` so other modules can call them.
 *
 * Finally, this file exposes `window.aioemp_events` for the dashboard
 * router (`#events`, `#event/:id`).
 *
 * Load order (PHP enqueue):
 *   1. aioemp-events.js        ← this file (creates ctx)
 *   2. events/_helpers.js
 *   3. events/_list.js
 *   4. events/_form.js
 *   5. events/_detail.js
 *   6. events/_candidates.js
 *   7. events/_seating.js
 *
 * @package AIOEMP
 * @since   0.3.0
 */
(function ($) {
    'use strict';

    /* ── Shared Context ── */
    var ctx = window.AIOEMP_Events = {
        api: window.aioemp_api,

        /* Mutable state — written / read by detail, candidates, seating */
        detailEventId: null,
        detailEvent:   null,
        activeTab:     'overview',

        /* Per-page list state */
        listState: { page: 1, status: '', search: '' },
        PER_PAGE: 20,

        /* Candidates tab state (reset each time the tab is entered) */
        candidateState: { page: 1, status: '', search: '' },

        /* Seating tab state — largest shared object */
        seatingState: {
            assignments: [],
            blocked: [],
            seats: [],
            selectedCandidate: null,
            selectedCandidates: [],
            pendingSeats: [],
            selectedSeat: null,
            isFinalized: false,
            assignMap: {},
            blockedSet: {},
            attenderMap: {},
            svgScale: 1,
            svgOffsetX: 0,
            svgOffsetY: 0,
            mode: 'assign',
            swapFirst: null,
            candidateFilter: 'all',
            seatmapSelectedView: false,
            allCandidates: [],
            pendingBlocks: [],
            candPage: 1,
            candPerPage: 50,
            candTotal: 0,
            candTotalPages: 0,
        },
    };

    /* ── Convenience: expose top-level helper aliases on ctx ──
     * These are set by _helpers.js; we pre-declare them so modules
     * loaded before _helpers.js don't blow up referencing ctx.esc. */
    ctx.esc = function (s) { return s; }; // overridden by _helpers.js

    /* ================================================================
     * ROUTE HANDLERS  (called by dashboard-shell.php router)
     * ================================================================ */

    /**
     * Main events list route (#events).
     */
    function render() {
        ctx.activeTab = 'overview';
        // Delegates to _list.js → ctx.renderEventsList()
        ctx.renderEventsList($('#aioemp-content'));
    }

    /**
     * Single event detail route (#event/123).
     */
    function renderDetail_route() {
        var hash = location.hash.replace('#', '');
        var match = hash.match(/^event\/(\d+)$/);
        if (match) {
            ctx.activeTab = 'overview';
            // Delegates to _detail.js → ctx.showEventDetail()
            ctx.showEventDetail(match[1]);
        } else {
            location.hash = '#events';
        }
    }

    /* ── Expose to dashboard router ── */
    window.aioemp_events = {
        render: render,
        renderDetail: renderDetail_route,
    };

})(jQuery);
