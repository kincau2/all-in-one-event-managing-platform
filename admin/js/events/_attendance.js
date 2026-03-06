/**
 * AIOEMP Events — Attendance Tab
 *
 * Displays paginated attendance logs with search and CSV export.
 *
 * @package AIOEMP
 * @since   0.8.0
 */
(function ($, ctx) {
    'use strict';

    var api     = ctx.api;
    var esc     = ctx.esc;
    var userCan = window.aioemp_userCan;

    var PER_PAGE = 50;

    /* ── State ── */

    var attState = { page: 1, search: '' };

    /* ================================================================
     * renderAttendanceTab
     * ================================================================ */

    function renderAttendanceTab($tc) {
        attState = { page: 1, search: '' };

        var html =
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Attendance Log</h3>' +
                    '<button id="att-export-csv" class="aioemp-btn aioemp-btn--sm aioemp-btn--outline">' +
                        '<span class="dashicons dashicons-download"></span> Export CSV' +
                    '</button>' +
                '</div>' +

                /* Stats summary */
                '<div class="aioemp-attendance__stats" id="att-stats">' +
                    '<span class="aioemp-attendance__stat">' +
                        'Checked In: <strong id="att-stat-in">—</strong>' +
                    '</span>' +
                    '<span class="aioemp-attendance__stat">' +
                        'Total Scans: <strong id="att-stat-total">—</strong>' +
                    '</span>' +
                    '<span class="aioemp-attendance__stat">' +
                        'Accepted: <strong id="att-stat-accepted">—</strong>' +
                    '</span>' +
                '</div>' +

                /* Search */
                '<div class="aioemp-toolbar">' +
                    '<input id="att-search" class="aioemp-input aioemp-input--sm" type="text" ' +
                        'placeholder="Search name, email…" style="max-width:280px">' +
                '</div>' +

                /* Table */
                '<div id="att-list-wrap">' +
                    '<p class="aioemp-loading">Loading…</p>' +
                '</div>' +

                /* Pagination */
                '<div id="att-pagination" class="aioemp-pagination"></div>' +
            '</div>';

        $tc.html(html);

        loadStats();
        loadAttendance();
        bindAttEvents($tc);
    }

    /* ── Stats ── */

    function loadStats() {
        api.get('events/' + ctx.detailEventId + '/attendance/stats')
            .then(function (data) {
                $('#att-stat-in').text(data.checked_in ?? 0);
                $('#att-stat-total').text(data.total_scans ?? 0);
                var accepted = (data.accepted_onsite || 0) + (data.accepted_online || 0);
                $('#att-stat-accepted').text(accepted);
            })
            .catch(function () {
                $('#att-stat-in, #att-stat-total, #att-stat-accepted').text('?');
            });
    }

    /* ── Load attendance list ── */

    function loadAttendance() {
        var $wrap = $('#att-list-wrap');
        var $pag  = $('#att-pagination');
        $wrap.html('<p class="aioemp-loading">Loading…</p>');

        var qs = '?page=' + attState.page + '&per_page=' + PER_PAGE;
        if (attState.search) qs += '&search=' + encodeURIComponent(attState.search);

        api.get('events/' + ctx.detailEventId + '/attendance' + qs)
            .then(function (items) {
                var arr = Array.isArray(items) ? items : (items.data || []);
                $wrap.html(renderTable(arr));
                renderPagination($pag, arr.length);
            })
            .catch(function () {
                $wrap.html('<p class="aioemp-error">Failed to load attendance records.</p>');
                $pag.empty();
            });
    }

    /* ── Render table ── */

    function renderTable(rows) {
        if (!rows.length) {
            return '<p class="aioemp-empty">No attendance records found.</p>';
        }

        var html =
            '<table class="aioemp-table">' +
                '<thead><tr>' +
                    '<th>Time</th>' +
                    '<th>Name</th>' +
                    '<th>Email</th>' +
                    '<th>Action</th>' +
                    '<th>Scanned By</th>' +
                '</tr></thead>' +
                '<tbody>';

        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var name = ((r.first_name || '') + ' ' + (r.last_name || '')).trim() || '—';
            var typeClass = r.type === 'IN' ? 'success' : 'danger';
            var scannedAt = r.scanned_at_gmt ? formatDateTime(r.scanned_at_gmt) : '—';
            var scannedBy = r.scanned_by_name || '—';

            html +=
                '<tr>' +
                    '<td>' + esc(scannedAt) + '</td>' +
                    '<td>' + esc(name) + '</td>' +
                    '<td>' + esc(r.email || '—') + '</td>' +
                    '<td><span class="aioemp-badge aioemp-badge--' + typeClass + '">' + esc(r.type) + '</span></td>' +
                    '<td>' + esc(scannedBy) + '</td>' +
                '</tr>';
        }

        html += '</tbody></table>';
        return html;
    }

    /* ── Pagination ── */

    function renderPagination($pag, count) {
        if (count < PER_PAGE && attState.page <= 1) {
            $pag.empty();
            return;
        }

        var html =
            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline att-page-prev"' +
                (attState.page <= 1 ? ' disabled' : '') + '>← Prev</button> ' +
            '<span class="aioemp-pagination__info">Page ' + attState.page + '</span> ' +
            (count >= PER_PAGE
                ? '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline att-page-next">Next →</button>'
                : '');
        $pag.html(html);
    }

    /* ── Event handlers ── */

    function bindAttEvents($tc) {
        var timer;

        // Remove any previously bound attendance events to prevent duplicates.
        $tc.off('.attTab');

        // Debounced search.
        $tc.on('input.attTab', '#att-search', function () {
            clearTimeout(timer);
            timer = setTimeout(function () {
                attState.search = $.trim($('#att-search').val());
                attState.page = 1;
                loadAttendance();
            }, 400);
        });

        // Pagination.
        $tc.on('click.attTab', '.att-page-prev', function () {
            if (attState.page > 1) {
                attState.page--;
                loadAttendance();
            }
        });
        $tc.on('click.attTab', '.att-page-next', function () {
            attState.page++;
            loadAttendance();
        });

        // CSV export.
        $tc.on('click.attTab', '#att-export-csv', function () {
            var $btn = $(this);
            $btn.prop('disabled', true).find('.dashicons').removeClass('dashicons-download').addClass('dashicons-update');

            api.get('events/' + ctx.detailEventId + '/attendance/export')
                .then(function (data) {
                    downloadCSV(data.filename || 'attendance.csv', data.csv || '');
                    $btn.prop('disabled', false).find('.dashicons').removeClass('dashicons-update').addClass('dashicons-download');
                })
                .catch(function (err) {
                    alert('Export failed: ' + (err.message || 'Unknown error'));
                    $btn.prop('disabled', false).find('.dashicons').removeClass('dashicons-update').addClass('dashicons-download');
                });
        });
    }

    /* ── Utility ── */

    function formatDateTime(gmtStr) {
        if (!gmtStr) return '—';
        try {
            var d = new Date(gmtStr + (gmtStr.indexOf('Z') < 0 ? 'Z' : ''));
            return d.toLocaleString();
        } catch (e) {
            return gmtStr;
        }
    }

    function downloadCSV(filename, csvContent) {
        var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        var url  = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /* ── Register on context ── */
    ctx.renderAttendanceTab = renderAttendanceTab;

})(jQuery, window.AIOEMP_Events);
