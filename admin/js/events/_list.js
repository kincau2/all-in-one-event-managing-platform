/**
 * AIOEMP Events — Events List Page
 *
 * Renders the events listing table with search, filter, pagination, and delete.
 *
 * @package AIOEMP
 * @since   0.3.0
 */
(function ($, ctx) {
    'use strict';

    var api = ctx.api;
    var esc = ctx.esc;
    var userCan = window.aioemp_userCan;

    var listState = { page: 1, status: '', search: '' };
    var $wrap, $pagination;
    var PER_PAGE = ctx.PER_PAGE;

    function listSkeleton() {
        return (
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Events</h3>' +
                    (userCan('manage_events')
                        ? '<button id="evt-btn-new" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                              '<span class="dashicons dashicons-plus-alt2"></span> New Event' +
                          '</button>'
                        : '') +
                '</div>' +
                '<div class="aioemp-toolbar">' +
                    '<input id="evt-search" class="aioemp-input aioemp-input--sm" type="text" placeholder="Search events…" style="max-width:260px">' +
                    '<select id="evt-filter-status" class="aioemp-select aioemp-select--sm" style="max-width:160px">' +
                        '<option value="">All statuses</option>' +
                        '<option value="draft">Draft</option>' +
                        '<option value="published">Published</option>' +
                        '<option value="closed">Closed</option>' +
                    '</select>' +
                '</div>' +
                '<div id="evt-list-wrap">' +
                    '<p class="aioemp-loading">Loading…</p>' +
                '</div>' +
                '<div id="evt-pagination" class="aioemp-pagination"></div>' +
            '</div>'
        );
    }

    function renderEventTable(rows) {
        if (!rows.length) {
            return '<p class="aioemp-empty">No events yet. Click <strong>New Event</strong> to create one.</p>';
        }

        var html =
            '<table class="aioemp-table">' +
                '<thead><tr>' +
                    '<th>Title</th>' +
                    '<th>Status</th>' +
                    '<th>Venue</th>' +
                    '<th>Start</th>' +
                    '<th>Capacity</th>' +
                    (userCan('manage_events') ? '<th style="width:60px">Actions</th>' : '') +
                '</tr></thead><tbody>';

        rows.forEach(function (r) {
            html +=
                '<tr data-id="' + r.id + '">' +
                    '<td class="evt-cell-title"><a href="#event/' + r.id + '" class="evt-link-title">' + esc(r.title || 'Untitled') + '</a></td>' +
                    '<td>' + ctx.statusBadge(r.status) + '</td>' +
                    '<td>' + ctx.venueBadge(r.venue_mode) + '</td>' +
                    '<td>' + ctx.fmtDate(r.start_date_gmt) + '</td>' +
                    '<td>' + (r.capacity ? esc(String(r.capacity)) : '—') + '</td>' +
                    (userCan('manage_events')
                        ? '<td>' +
                              '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--danger evt-act-del" title="Delete">' +
                                  '<span class="dashicons dashicons-trash"></span>' +
                              '</button>' +
                          '</td>'
                        : '') +
                '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    function loadEventList() {
        $wrap.html('<p class="aioemp-loading">Loading…</p>');
        var qs = '?page=' + listState.page + '&per_page=' + PER_PAGE;
        if (listState.status) qs += '&status=' + encodeURIComponent(listState.status);
        if (listState.search) qs += '&search=' + encodeURIComponent(listState.search);

        api.request('events' + qs)
            .then(function (items) {
                var arr = Array.isArray(items) ? items : (items.data || []);
                $wrap.html(renderEventTable(arr));
                if (arr.length >= PER_PAGE) {
                    $pagination.html(
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline evt-page-prev"' +
                        (listState.page <= 1 ? ' disabled' : '') + '>← Prev</button> ' +
                        '<span class="aioemp-pagination__info">Page ' + listState.page + '</span> ' +
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline evt-page-next">Next →</button>'
                    );
                } else if (listState.page > 1) {
                    $pagination.html(
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline evt-page-prev">← Prev</button> ' +
                        '<span class="aioemp-pagination__info">Page ' + listState.page + '</span>'
                    );
                } else {
                    $pagination.empty();
                }
            })
            .catch(function () {
                $wrap.html('<p class="aioemp-error">Failed to load events.</p>');
            });
    }

    function deleteEvent(id) {
        if (!confirm('Delete this event? This cannot be undone.')) return;
        api.del('events/' + id)
            .then(function () { loadEventList(); })
            .catch(function (err) {
                alert('Failed to delete: ' + (err.message || 'Unknown error'));
            });
    }

    function renderEventsList($el) {
        $el.html(listSkeleton());
        $wrap = $('#evt-list-wrap');
        $pagination = $('#evt-pagination');

        listState = { page: 1, status: '', search: '' };

        $el.on('click', '#evt-btn-new', function () {
            ctx.showEventForm(null);
        });

        var searchTimer;
        $el.on('input', '#evt-search', function () {
            clearTimeout(searchTimer);
            var val = $(this).val();
            searchTimer = setTimeout(function () {
                listState.search = val;
                listState.page = 1;
                loadEventList();
            }, 300);
        });

        $el.on('change', '#evt-filter-status', function () {
            listState.status = $(this).val();
            listState.page = 1;
            loadEventList();
        });

        $el.on('click', '.evt-act-del', function () {
            var id = $(this).closest('tr').data('id');
            deleteEvent(id);
        });
        $el.on('click', '.evt-page-prev', function () {
            if (listState.page > 1) {
                listState.page--;
                loadEventList();
            }
        });
        $el.on('click', '.evt-page-next', function () {
            listState.page++;
            loadEventList();
        });

        loadEventList();
    }

    /* ── Register on context ── */
    ctx.renderEventsList = renderEventsList;

})(jQuery, window.AIOEMP_Events);
