/**
 * AIOEMP Events — Event Detail Page
 *
 * Shows a single event with tabs (Overview, Candidates, Attendance, Seating).
 * Delegates each tab to its own module.
 *
 * @package AIOEMP
 * @since   0.3.0
 */
(function ($, ctx) {
    'use strict';

    var api = ctx.api;
    var esc = ctx.esc;
    var userCan = window.aioemp_userCan;

    function showEventDetail(eventId) {
        ctx.detailEventId = eventId;
        var $content = $('#aioemp-content');
        $content.empty();
        $('#aioemp-page-title').text('Event Detail');

        $content.html(
            '<div id="evt-detail-wrap">' +
                '<p class="aioemp-loading">Loading…</p>' +
            '</div>'
        );

        api.get('events/' + eventId)
            .then(function (data) {
                ctx.detailEvent = data;
                renderDetail($('#evt-detail-wrap'));
            })
            .catch(function () {
                $('#evt-detail-wrap').html('<p class="aioemp-error">Failed to load event.</p>');
            });
    }

    function renderDetail($el) {
        var d = ctx.detailEvent;

        var hasSeatmap = d.seatmap_id || d.seatmap_layout_snapshot;

        var html =
            '<div class="aioemp-detail-header">' +
                '<div class="aioemp-detail-header__left">' +
                    '<a href="#events" class="aioemp-topbar__btn-back">' +
                        '<span class="dashicons dashicons-arrow-left-alt2"></span> Back to Events' +
                    '</a>' +
                    '<h2 class="aioemp-detail-title">' + esc(d.title) + '</h2>' +
                    '<div class="aioemp-detail-meta">' +
                        ctx.statusBadge(d.status) + ' ' +
                        ctx.venueBadge(d.venue_mode) +
                        (d.start_date_gmt ? ' &middot; ' + ctx.fmtDateTime(d.start_date_gmt) : '') +
                        (d.capacity ? ' &middot; Capacity: ' + esc(String(d.capacity)) : '') +
                    '</div>' +
                '</div>' +
                '<div class="aioemp-detail-header__right">' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-tabs">' +
                '<button class="aioemp-tab' + (ctx.activeTab === 'overview' ? ' is-active' : '') + '" data-tab="overview">Overview</button>' +
                (userCan('view_candidates') ? '<button class="aioemp-tab' + (ctx.activeTab === 'candidates' ? ' is-active' : '') + '" data-tab="candidates">Candidates</button>' : '') +
                (userCan('view_attendance') ? '<button class="aioemp-tab' + (ctx.activeTab === 'attendance' ? ' is-active' : '') + '" data-tab="attendance">Attendance Log</button>' : '') +
                (userCan('scan_attendance') ? '<button class="aioemp-tab' + (ctx.activeTab === 'checkin' ? ' is-active' : '') + '" data-tab="checkin">Check In</button>' : '') +
                (hasSeatmap && userCan('manage_seating') ? '<button class="aioemp-tab' + (ctx.activeTab === 'seating' ? ' is-active' : '') + '" data-tab="seating">Seating</button>' : '') +
            '</div>' +

            '<div id="evt-tab-content" class="aioemp-tab-content"></div>';

        $el.html(html);

        $el.on('click', '.aioemp-tab', function () {
            ctx.activeTab = $(this).data('tab');
            $el.find('.aioemp-tab').removeClass('is-active');
            $(this).addClass('is-active');
            ctx.renderTabContent();
        });

        $el.on('click', '#evt-detail-edit', function () {
            ctx.showEventForm(ctx.detailEventId);
        });

        ctx.renderTabContent();
    }

    function renderTabContent() {
        var $tc = $('#evt-tab-content');
        $tc.empty();

        switch (ctx.activeTab) {
            case 'overview':
                renderOverviewTab($tc);
                break;
            case 'candidates':
                if (userCan('view_candidates')) ctx.renderCandidatesTab($tc);
                break;
            case 'attendance':
                if (userCan('view_attendance')) ctx.renderAttendanceTab($tc);
                break;
            case 'checkin':
                if (userCan('scan_attendance')) ctx.renderCheckInTab($tc);
                break;
            case 'seating':
                if (userCan('manage_seating')) ctx.renderSeatingTab($tc);
                break;
        }
    }

    /* ── Overview Tab ── */

    function renderOverviewTab($tc) {
        var d = ctx.detailEvent;
        var html =
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Event Information</h3>' +
                    (userCan('manage_events')
                        ? '<button id="evt-detail-edit" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                              '<span class="dashicons dashicons-edit"></span> Edit' +
                          '</button>'
                        : '') +
                '</div>' +
                '<div class="aioemp-detail-grid">' +
                    detailRow('Title', d.title) +
                    detailRow('Description', d.description || '(none)') +
                    detailRow('Status', ctx.statusBadge(d.status)) +
                    detailRow('Venue Mode', ctx.venueBadge(d.venue_mode)) +
                    detailRow('Start', ctx.fmtDateTime(d.start_date_gmt)) +
                    detailRow('End', ctx.fmtDateTime(d.end_date_gmt)) +
                    detailRow('Capacity', d.capacity || '—') +
                    detailRow('Location', (d.location_name || '') + (d.location_address ? ' — ' + d.location_address : '') || '—') +
                    detailRow('Online URL', d.online_url ? '<a href="' + esc(d.online_url) + '" target="_blank">' + esc(d.online_url) + '</a>' : '—') +
                    detailRow('Seatmap', d.seatmap_id ? 'Template #' + d.seatmap_id : 'Free seating') +
                    detailRow('Created', ctx.fmtDateTime(d.created_at_gmt)) +
                '</div>' +
            '</div>' +

            '<div class="aioemp-card" id="evt-overview-stats">' +
                '<h3 class="aioemp-card__title">Candidate Statistics</h3>' +
                '<p class="aioemp-loading">Loading…</p>' +
            '</div>';

        $tc.html(html);

        api.get('events/' + ctx.detailEventId + '/attenders/counts')
            .then(function (counts) {
                var statsHtml =
                    '<div class="aioemp-stat-cards">' +
                        statCard('Total', counts.total || 0, 'primary') +
                        statCard('Registered', counts.registered || 0, 'info') +
                        statCard('Accepted (On-site)', counts.accepted_onsite || 0, 'success') +
                        statCard('Accepted (Online)', counts.accepted_online || 0, 'success') +
                        statCard('Rejected', counts.rejected || 0, 'danger') +
                    '</div>';
                $('#evt-overview-stats').html(
                    '<h3 class="aioemp-card__title">Candidate Statistics</h3>' + statsHtml
                );
            })
            .catch(function () {
                $('#evt-overview-stats .aioemp-loading').text('Failed to load stats.');
            });
    }

    function detailRow(label, value) {
        return '<div class="aioemp-detail-row">' +
            '<span class="aioemp-detail-row__label">' + esc(label) + '</span>' +
            '<span class="aioemp-detail-row__value">' + value + '</span>' +
        '</div>';
    }

    function statCard(label, value, color) {
        return '<div class="aioemp-stat-card aioemp-stat-card--' + color + '">' +
            '<div class="aioemp-stat-card__value">' + value + '</div>' +
            '<div class="aioemp-stat-card__label">' + esc(label) + '</div>' +
        '</div>';
    }

    /* ── Register on context ── */
    ctx.showEventDetail = showEventDetail;
    ctx.renderTabContent = renderTabContent;

})(jQuery, window.AIOEMP_Events);
