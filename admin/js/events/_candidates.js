/**
 * AIOEMP Events — Candidates Tab
 *
 * Manages the Candidates tab: list, search, filter, pagination,
 * bulk status changes, and the add/edit candidate modal form.
 *
 * @package AIOEMP
 * @since   0.3.0
 */
(function ($, ctx) {
    'use strict';

    var api = ctx.api;
    var esc = ctx.esc;
    var userCan = window.aioemp_userCan;
    var canManage = function () { return userCan('manage_candidates'); };
    var modal = window.aioemp_modal;

    function renderCandidatesTab($tc) {
        // Remove all previously-bound .cand handlers to avoid stacking.
        $tc.off('.cand');

        ctx.candidateState = { page: 1, status: '', search: '', perPage: 20 };

        var vm = (ctx.detailEvent && ctx.detailEvent.venue_mode) || 'mixed';

        var html =
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Candidates <span id="cand-total-count" class="aioemp-help" style="font-weight:normal;font-size:13px"></span></h3>' +
                    (canManage()
                        ? '<div style="display:flex;gap:6px;align-items:center">' +
                              '<button id="cand-btn-export" class="aioemp-btn aioemp-btn--sm aioemp-btn--outline" title="Export CSV">' +
                                  '<span class="dashicons dashicons-download"></span> Export' +
                              '</button>' +
                              '<button id="cand-btn-import" class="aioemp-btn aioemp-btn--sm aioemp-btn--outline" title="Import CSV">' +
                                  '<span class="dashicons dashicons-upload"></span> Import' +
                              '</button>' +
                              '<button id="cand-btn-new" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                                  '<span class="dashicons dashicons-plus-alt2"></span> Add Candidate' +
                              '</button>' +
                          '</div>'
                        : '') +
                '</div>' +
                '<div class="aioemp-toolbar">' +
                    '<input id="cand-search" class="aioemp-input aioemp-input--sm" type="text" placeholder="Search name, email…" style="max-width:240px">' +
                    '<select id="cand-filter-status" class="aioemp-select aioemp-select--sm" style="max-width:180px">' +
                        '<option value="">All statuses</option>' +
                        '<option value="registered">Registered</option>' +
                        '<option value="accepted_onsite">Accepted (On-site)</option>' +
                        '<option value="accepted_online">Accepted (Online)</option>' +
                        '<option value="rejected">Rejected</option>' +
                    '</select>' +
                    '<select id="cand-per-page" class="aioemp-select aioemp-select--sm" style="max-width:110px">' +
                        '<option value="20">20 / page</option>' +
                        '<option value="50">50 / page</option>' +
                        '<option value="100">100 / page</option>' +
                    '</select>' +
                    (canManage()
                        ? '<div class="aioemp-toolbar__bulk" id="cand-bulk-wrap" style="display:none">' +
                              '<select id="cand-bulk-action" class="aioemp-select aioemp-select--sm" style="max-width:200px">' +
                                  '<option value="">Bulk Actions…</option>' +
                                  (vm !== 'online' ? '<option value="accepted_onsite">Accept (On-site)</option>' : '') +
                                  (vm !== 'onsite' ? '<option value="accepted_online">Accept (Online)</option>' : '') +
                                  '<option value="rejected">Reject</option>' +
                                  '<option value="__resend_email">Resend Email</option>' +
                                  '<option value="__delete">Delete</option>' +
                              '</select>' +
                              '<button id="cand-bulk-apply" class="aioemp-btn aioemp-btn--xs aioemp-btn--primary">Apply</button>' +
                          '</div>'
                        : '') +
                '</div>' +
                '<div id="cand-list-wrap">' +
                    '<p class="aioemp-loading">Loading…</p>' +
                '</div>' +
                '<div id="cand-pagination" class="aioemp-pagination"></div>' +
            '</div>';

        $tc.html(html);

        var $cWrap = $('#cand-list-wrap');
        var $cPag  = $('#cand-pagination');

        function loadCandidates() {
            $cWrap.html('<p class="aioemp-loading">Loading…</p>');
            var pp = ctx.candidateState.perPage;
            var qs = '?page=' + ctx.candidateState.page + '&per_page=' + pp;
            if (ctx.candidateState.status) qs += '&status=' + encodeURIComponent(ctx.candidateState.status);
            if (ctx.candidateState.search) qs += '&search=' + encodeURIComponent(ctx.candidateState.search);

            api.getWithHeaders('events/' + ctx.detailEventId + '/attenders' + qs)
                .then(function (res) {
                    var arr = Array.isArray(res.data) ? res.data : (res.data && res.data.data ? res.data.data : []);
                    var total = res.total || 0;
                    var totalPages = res.totalPages || 0;

                    // Update total count display.
                    $('#cand-total-count').text('(' + total + ')');

                    $cWrap.html(renderCandidateTable(arr));
                    // Pagination.
                    if (totalPages > 1) {
                        $cPag.html(
                            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline cand-page-prev"' +
                            (ctx.candidateState.page <= 1 ? ' disabled' : '') + '>← Prev</button> ' +
                            '<span class="aioemp-pagination__info">Page ' +
                                '<input type="number" class="cand-page-input" value="' + ctx.candidateState.page + '" min="1" max="' + totalPages + '" style="width:52px;text-align:center;padding:2px 4px;margin:0 2px;border:1px solid #ccc;border-radius:4px;font-size:13px;">' +
                                ' of ' + totalPages +
                            '</span> ' +
                            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline cand-page-next"' +
                            (ctx.candidateState.page >= totalPages ? ' disabled' : '') + '>Next →</button>'
                        );
                    } else {
                        $cPag.empty();
                    }
                })
                .catch(function () {
                    $cWrap.html('<p class="aioemp-error">Failed to load candidates.</p>');
                });
        }

        function renderCandidateTable(rows) {
            if (!rows.length) {
                return '<p class="aioemp-empty">No candidates yet. Click <strong>Add Candidate</strong> to add one.</p>';
            }

            var html =
                '<table class="aioemp-table">' +
                    '<thead><tr>' +
                        (canManage() ? '<th style="width:40px"><input type="checkbox" id="cand-select-all"></th>' : '') +
                        '<th style="width:60px">ID</th>' +
                        '<th>Name</th>' +
                        '<th>Email</th>' +
                        '<th>Company</th>' +
                        '<th>Status</th>' +
                        '<th>Attendance</th>' +
                        '<th>Seat</th>' +
                        '<th>Registered</th>' +
                        (canManage() ? '<th style="width:140px">Actions</th>' : '') +
                    '</tr></thead><tbody>';

            rows.forEach(function (r) {
                var name = ((r.title ? r.title + ' ' : '') + (r.first_name || '') + ' ' + (r.last_name || '')).trim();
                // Attendance column.
                var attCell;
                if (r.status === 'accepted_onsite') {
                    if (r.checked_in === '1' || r.checked_in === 1 || r.checked_in === true) {
                        attCell = '<span class="aioemp-badge aioemp-badge--success">Checked In</span>';
                    } else {
                        attCell = '<span class="aioemp-badge aioemp-badge--draft">Not Checked In</span>';
                    }
                } else {
                    attCell = '<span class="aioemp-badge aioemp-badge--draft">Not Applicable</span>';
                }

                // Seat column.
                var seatCell;
                if (r.status === 'accepted_onsite') {
                    seatCell = r.seat_label || r.seat_key || '<span class="aioemp-badge aioemp-badge--draft">No Seat</span>';
                } else {
                    seatCell = '<span class="aioemp-badge aioemp-badge--draft">Not Applicable</span>';
                }
                html +=
                    '<tr data-id="' + r.id + '">' +
                        (canManage() ? '<td><input type="checkbox" class="cand-check" value="' + r.id + '"></td>' : '') +
                        '<td>' + r.id + '</td>' +
                        '<td>' + esc(name || '(unnamed)') + '</td>' +
                        '<td>' + esc(r.email || '—') + '</td>' +
                        '<td>' + esc(r.company || '—') + '</td>' +
                        '<td>' + candidateStatusBadge(r.status) + '</td>' +
                        '<td>' + attCell + '</td>' +
                        '<td>' + seatCell + '</td>' +
                        '<td>' + ctx.fmtDate(r.created_at_gmt) + '</td>' +
                        (canManage()
                            ? '<td style="white-space:nowrap">' +
                                  '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--secondary cand-act-edit" title="Edit">' +
                                      '<span class="dashicons dashicons-edit"></span>' +
                                  '</button> ' +
                                  '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline cand-act-resend" title="Resend Email">' +
                                      '<span class="dashicons dashicons-email-alt"></span>' +
                                  '</button> ' +
                                  '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--danger cand-act-del" title="Delete">' +
                                      '<span class="dashicons dashicons-trash"></span>' +
                                  '</button>' +
                              '</td>'
                            : '') +
                    '</tr>';
            });

            html += '</tbody></table>';
            return html;
        }

        function candidateStatusBadge(status) {
            var map = {
                registered:       'info',
                accepted_onsite:  'success',
                accepted_online:  'success',
                rejected:         'danger',
            };
            var cls = map[status] || 'draft';
            var label = (status || 'unknown').replace(/_/g, ' ');
            return '<span class="aioemp-badge aioemp-badge--' + cls + '">' + esc(label) + '</span>';
        }

        // Search.
        var searchTimer;
        $tc.on('input.cand', '#cand-search', function () {
            clearTimeout(searchTimer);
            var val = $(this).val();
            searchTimer = setTimeout(function () {
                ctx.candidateState.search = val;
                ctx.candidateState.page = 1;
                loadCandidates();
            }, 300);
        });

        // Filter.
        $tc.on('change.cand', '#cand-filter-status', function () {
            ctx.candidateState.status = $(this).val();
            ctx.candidateState.page = 1;
            loadCandidates();
        });

        // Per-page.
        $tc.on('change.cand', '#cand-per-page', function () {
            ctx.candidateState.perPage = parseInt($(this).val(), 10) || 20;
            ctx.candidateState.page = 1;
            loadCandidates();
        });

        // Pagination.
        $tc.on('click.cand', '.cand-page-prev', function () {
            if (ctx.candidateState.page > 1) {
                ctx.candidateState.page--;
                loadCandidates();
            }
        });
        $tc.on('click.cand', '.cand-page-next', function () {
            ctx.candidateState.page++;
            loadCandidates();
        });
        $tc.on('change.cand', '.cand-page-input', function () {
            var val = parseInt($(this).val(), 10);
            if (val >= 1) {
                ctx.candidateState.page = val;
                loadCandidates();
            }
        });

        // Select all / show bulk bar.
        $tc.on('change.cand', '#cand-select-all', function () {
            var checked = $(this).prop('checked');
            $tc.find('.cand-check').prop('checked', checked);
            toggleBulkBar();
        });
        $tc.on('change.cand', '.cand-check', function () {
            toggleBulkBar();
        });

        function toggleBulkBar() {
            var selected = $tc.find('.cand-check:checked').length;
            $('#cand-bulk-wrap').toggle(selected > 0);
        }

        // Bulk action apply — dispatch based on action type.
        $tc.on('click.cand', '#cand-bulk-apply', function () {
            var action = $('#cand-bulk-action').val();
            if (!action) { modal.alert('Select a bulk action first.', { title: 'No Action', variant: 'warning' }); return; }

            var ids = [];
            $tc.find('.cand-check:checked').each(function () {
                ids.push(parseInt($(this).val(), 10));
            });

            if (!ids.length) { modal.alert('No candidates selected.', { title: 'No Selection', variant: 'warning' }); return; }

            if (action === '__delete') {
                modal.confirm('Delete ' + ids.length + ' candidate(s)? This cannot be undone.', { title: 'Bulk Delete', variant: 'danger', confirmText: 'Delete' })
                    .then(function (ok) { if (ok) runBulkDelete(ids); });
            } else if (action === '__resend_email') {
                modal.confirm('Resend email to ' + ids.length + ' candidate(s)?', { title: 'Resend Emails', variant: 'info', confirmText: 'Send' })
                    .then(function (ok) { if (ok) runBulkResend(ids); });
            } else {
                modal.confirm('Change ' + ids.length + ' candidate(s) to "' + action.replace(/_/g, ' ') + '"?', { title: 'Bulk Status Change', variant: 'warning', confirmText: 'Change' })
                    .then(function (ok) { if (ok) runBatchProcess(ids, action); });
            }
        });

        /**
         * Bulk delete — single API call, no progress bar needed.
         */
        function runBulkDelete(ids) {
            api.post('events/' + ctx.detailEventId + '/attenders/bulk-delete', { ids: ids })
                .then(function (res) {
                    modal.alert('Deleted ' + (res.deleted || 0) + ' candidate(s).', { title: 'Deleted', variant: 'success' });
                    loadCandidates();
                })
                .catch(function (err) {
                    modal.alert(err.message || 'Bulk delete failed.', { title: 'Error', variant: 'danger' });
                });
        }

        /**
         * Bulk resend email — one at a time with progress bar.
         */
        function runBulkResend(allIds) {
            var total     = allIds.length;
            var processed = 0;
            var totalSent = 0;
            var totalSkipped = 0;
            var totalFailed  = [];

            // Build progress modal.
            var $overlay = $('<div class="aioemp-modal-overlay"></div>');
            var $modal   = $(
                '<div class="aioemp-modal" style="max-width:480px">' +
                    '<div class="aioemp-modal__header">' +
                        '<h3>Resending Emails</h3>' +
                    '</div>' +
                    '<div class="aioemp-modal__body">' +
                        '<p class="batch-status-text">Sending 1 of ' + total + '…</p>' +
                        '<div class="aioemp-progress">' +
                            '<div class="aioemp-progress__bar" style="width:0%"></div>' +
                        '</div>' +
                        '<p class="batch-detail-text" style="font-size:13px;color:#666;">0 / ' + total + ' processed</p>' +
                    '</div>' +
                '</div>'
            );
            $overlay.append($modal);
            $('body').append($overlay);

            var $bar    = $modal.find('.aioemp-progress__bar');
            var $status = $modal.find('.batch-status-text');
            var $detail = $modal.find('.batch-detail-text');

            function sendNext(index) {
                if (index >= total) {
                    // Done — show summary.
                    $bar.css('width', '100%');
                    $status.text('Complete!');

                    var summary = totalSent + ' email(s) sent.';
                    if (totalSkipped > 0) summary += ' ' + totalSkipped + ' skipped (no template).';
                    if (totalFailed.length > 0) summary += ' ' + totalFailed.length + ' failed.';
                    $detail.text(summary);

                    var $closeBtn = $('<button class="button button-primary" style="margin-top:12px;">Close</button>');
                    $closeBtn.on('click', function () { $overlay.remove(); loadCandidates(); });
                    $modal.find('.aioemp-modal__body').append($closeBtn);
                    $overlay.on('click', function (e) {
                        if ($(e.target).hasClass('aioemp-modal-overlay')) { $overlay.remove(); loadCandidates(); }
                    });
                    return;
                }

                $status.text('Sending ' + (index + 1) + ' of ' + total + '…');

                api.post('events/' + ctx.detailEventId + '/attenders/bulk-resend', {
                    ids: [allIds[index]],
                })
                .then(function (res) {
                    processed++;
                    totalSent    += (res.sent || 0);
                    totalSkipped += (res.skipped || 0);
                    if (res.failed && res.failed.length) totalFailed = totalFailed.concat(res.failed);

                    var pct = Math.round((processed / total) * 100);
                    $bar.css('width', pct + '%');
                    $detail.text(processed + ' / ' + total + ' processed');
                    sendNext(index + 1);
                })
                .catch(function () {
                    processed++;
                    totalFailed.push(allIds[index]);
                    var pct = Math.round((processed / total) * 100);
                    $bar.css('width', pct + '%');
                    $detail.text(processed + ' / ' + total + ' processed');
                    sendNext(index + 1);
                });
            }

            sendNext(0);
        }

        /**
         * Process candidates one at a time with a progress modal.
         * Each call updates DB status AND sends the email atomically.
         */
        function runBatchProcess(allIds, status) {
            // Load settings for batch size & wait time.
            api.get('settings').then(function (cfg) {
                var batchSize = Math.max(1, parseInt(cfg.email_batch_size, 10) || 1);
                var waitMs    = Math.max(0, parseInt(cfg.email_batch_wait_ms, 10) || 0);
                _runBatchProcessWithConfig(allIds, status, batchSize, waitMs);
            }).catch(function () {
                // Fallback: 1 at a time, no wait.
                _runBatchProcessWithConfig(allIds, status, 1, 0);
            });
        }

        function _runBatchProcessWithConfig(allIds, status, batchSize, waitMs) {
            var total      = allIds.length;
            var processed  = 0;
            var totalSent  = 0;
            var totalFailed = [];

            // Build progress modal.
            var $overlay = $('<div class="aioemp-modal-overlay"></div>');
            var $modal   = $(
                '<div class="aioemp-modal" style="max-width:480px">' +
                    '<div class="aioemp-modal__header">' +
                        '<h3>Processing Candidates</h3>' +
                    '</div>' +
                    '<div class="aioemp-modal__body">' +
                        '<p class="batch-status-text">Processing 1 of ' + total + '…</p>' +
                        '<div class="aioemp-progress">' +
                            '<div class="aioemp-progress__bar" style="width:0%"></div>' +
                        '</div>' +
                        '<p class="batch-detail-text" style="font-size:13px;color:#666;">0 / ' + total + ' candidates processed</p>' +
                        '<p class="batch-config-text" style="font-size:12px;color:#999;">Batch size: ' + batchSize + ' · Wait: ' + waitMs + 'ms</p>' +
                    '</div>' +
                '</div>'
            );
            $overlay.append($modal);
            $('body').append($overlay);

            var $bar    = $modal.find('.aioemp-progress__bar');
            var $status = $modal.find('.batch-status-text');
            var $detail = $modal.find('.batch-detail-text');

            function processBatch(index) {
                if (index >= total) {
                    // Done — show summary.
                    $bar.css('width', '100%');
                    $status.text('Complete!');

                    var summary = processed + ' candidate(s) updated.';
                    if (totalSent > 0) {
                        summary += ' ' + totalSent + ' email(s) sent.';
                    }
                    if (totalFailed.length > 0) {
                        summary += ' ' + totalFailed.length + ' email(s) failed.';
                    }
                    $detail.text(summary);

                    // Show failure notice if any emails failed.
                    if (totalFailed.length > 0) {
                        var $notice = $(
                            '<div style="margin-top:12px;padding:10px 14px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;font-size:13px;color:#78350f;">' +
                                '<strong>Some emails could not be sent.</strong><br>' +
                                'This is often caused by SMTP sending limits — your mail server may restrict how many emails can be sent in a short period. ' +
                                'Try reducing the <strong>Email Batch Size</strong> and increasing <strong>Wait Between Cycles</strong> in ' +
                                '<a href="#settings" style="color:#b45309;font-weight:600;">Settings</a>.' +
                            '</div>'
                        );
                        $notice.find('a').on('click', function () {
                            $overlay.remove();
                            location.hash = '#settings';
                        });
                        $modal.find('.aioemp-modal__body').append($notice);
                    }

                    // Add close button.
                    var $closeBtn = $('<button class="button button-primary" style="margin-top:12px;">Close</button>');
                    $closeBtn.on('click', function () {
                        $overlay.remove();
                        loadCandidates();
                    });
                    $modal.find('.aioemp-modal__body').append($closeBtn);

                    $overlay.on('click', function (e) {
                        if ($(e.target).hasClass('aioemp-modal-overlay')) {
                            $overlay.remove();
                            loadCandidates();
                        }
                    });
                    return;
                }

                var chunk = allIds.slice(index, index + batchSize);
                $status.text('Processing ' + Math.min(index + batchSize, total) + ' of ' + total + '…');

                api.post('events/' + ctx.detailEventId + '/attenders/batch-process', {
                    ids: chunk,
                    status: status,
                })
                .then(function (res) {
                    processed += (res.updated || 0);
                    totalSent += (res.sent || 0);
                    if (res.failed && res.failed.length) {
                        totalFailed = totalFailed.concat(res.failed);
                    }

                    var pct = Math.round((processed / total) * 100);
                    $bar.css('width', pct + '%');
                    $detail.text(processed + ' / ' + total + ' candidates processed');

                    if (index + batchSize < total && waitMs > 0) {
                        setTimeout(function () { processBatch(index + batchSize); }, waitMs);
                    } else {
                        processBatch(index + batchSize);
                    }
                })
                .catch(function (err) {
                    $detail.text('Error at batch ' + (index + 1) + ': ' + (err.message || 'Unknown') + '. Continuing…');
                    if (waitMs > 0) {
                        setTimeout(function () { processBatch(index + batchSize); }, waitMs);
                    } else {
                        processBatch(index + batchSize);
                    }
                });
            }

            processBatch(0);
        }

        // Add candidate.
        $tc.on('click.cand', '#cand-btn-new', function () {
            showCandidateForm(null);
        });

        // Edit candidate.
        $tc.on('click.cand', '.cand-act-edit', function () {
            var id = $(this).closest('tr').data('id');
            showCandidateForm(id);
        });

        // Delete candidate.
        $tc.on('click.cand', '.cand-act-del', function () {
            var id = $(this).closest('tr').data('id');
            modal.confirm('Delete this candidate? This cannot be undone.', { title: 'Delete Candidate', variant: 'danger', confirmText: 'Delete' })
                .then(function (ok) {
                    if (!ok) return;
                    api.del('events/' + ctx.detailEventId + '/attenders/' + id)
                        .then(function () { loadCandidates(); })
                        .catch(function (err) {
                            modal.alert(err.message || 'Delete failed.', { title: 'Error', variant: 'danger' });
                        });
                });
        });

        // Resend email for candidate.
        $tc.on('click.cand', '.cand-act-resend', function () {
            var $btn = $(this);
            var id   = $btn.closest('tr').data('id');
            modal.confirm('Resend email to this candidate based on their current status?', { title: 'Resend Email', variant: 'info', confirmText: 'Send' })
                .then(function (ok) {
                    if (!ok) return;
                    $btn.prop('disabled', true);
                    api.post('events/' + ctx.detailEventId + '/attenders/' + id + '/resend-email', {})
                        .then(function (res) {
                            var data = res && res.data ? res.data : res;
                            modal.alert('Email sent to ' + (data.to || 'candidate') + ' (' + (data.template || '').replace(/_/g, ' ') + ')', { title: 'Email Sent', variant: 'success' });
                        })
                        .catch(function (err) {
                            modal.alert(err.message || 'Failed to send email.', { title: 'Error', variant: 'danger' });
                        })
                        .finally(function () {
                            $btn.prop('disabled', false);
                        });
                });
        });

        // Export CSV.
        $tc.on('click.cand', '#cand-btn-export', function () {
            var $btn = $(this);
            $btn.prop('disabled', true).text('Exporting…');

            // Build the REST URL manually for a direct download.
            var url = ctx.api.buildUrl('events/' + ctx.detailEventId + '/attenders/export-csv');
            // Use fetch with auth headers so nonce is sent.
            fetch(url, {
                headers: { 'X-WP-Nonce': window.aioemp_rest_nonce }
            })
            .then(function (res) {
                if (!res.ok) throw new Error('Export failed');
                return res.json();
            })
            .then(function (csv) {
                var blob = new Blob([csv], { type: 'text/csv' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'candidates-event-' + ctx.detailEventId + '.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            })
            .catch(function (err) {
                modal.alert(err.message || 'Export failed.', { title: 'Error', variant: 'danger' });
            })
            .finally(function () {
                $btn.prop('disabled', false).html('<span class="dashicons dashicons-download"></span> Export');
            });
        });

        // Import CSV — open modal.
        $tc.on('click.cand', '#cand-btn-import', function () {
            showImportModal();
        });

        function showImportModal() {
            $('.aioemp-modal-overlay').remove();

            var $overlay = $(
                '<div class="aioemp-modal-overlay">' +
                    '<div class="aioemp-modal" style="max-width:520px">' +
                        '<div class="aioemp-modal__header">' +
                            '<h3>Import Candidates from CSV</h3>' +
                            '<button class="aioemp-modal__close">&times;</button>' +
                        '</div>' +
                        '<div class="aioemp-modal__body">' +
                            '<div class="aioemp-form-group" style="margin-bottom:16px;">' +
                                '<label class="aioemp-label">Import Mode</label>' +
                                '<select id="import-mode" class="aioemp-select">' +
                                    '<option value="new">Add as New Candidates</option>' +
                                    '<option value="update">Update Existing (match by ID)</option>' +
                                '</select>' +
                                '<p class="aioemp-help" style="margin-top:4px;">' +
                                    '<strong>New:</strong> All rows are created as new candidates and registration emails are sent.<br>' +
                                    '<strong>Update:</strong> Rows are matched by ID — unmatched IDs are skipped.' +
                                '</p>' +
                            '</div>' +
                            '<div class="aioemp-form-group" style="margin-bottom:16px;">' +
                                '<label class="aioemp-label">CSV File</label>' +
                                '<input type="file" id="import-file" accept=".csv,text/csv" class="aioemp-input">' +
                            '</div>' +
                            '<p style="font-size:13px;color:#666;margin-bottom:12px;">' +
                                'Columns: <code>title, first_name, last_name, email, company</code><br>' +
                                'Update mode also requires an <code>id</code> column. New mode must <strong>not</strong> include <code>id</code>.' +
                            '</p>' +
                            '<div class="aioemp-form-actions" style="display:flex;gap:8px;align-items:center;">' +
                                '<button id="import-submit" class="aioemp-btn aioemp-btn--primary" disabled>' +
                                    '<span class="dashicons dashicons-upload"></span> Import' +
                                '</button>' +
                                '<button id="import-template" class="aioemp-btn aioemp-btn--outline">' +
                                    '<span class="dashicons dashicons-media-spreadsheet"></span> Download Template' +
                                '</button>' +
                                '<span id="import-status" class="aioemp-form-status"></span>' +
                            '</div>' +
                            '<div id="import-result" style="display:none;margin-top:14px;"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );

            $('body').append($overlay);

            // Close handlers.
            $overlay.on('click', '.aioemp-modal__close', function () { $overlay.remove(); });
            $overlay.on('click', function (e) {
                if ($(e.target).hasClass('aioemp-modal-overlay')) { $overlay.remove(); }
            });

            // Enable submit when file selected.
            $overlay.on('change', '#import-file', function () {
                $('#import-submit').prop('disabled', !this.files.length);
            });

            // Download template — adapts columns based on selected mode.
            $overlay.on('click', '#import-template', function () {
                var m = $('#import-mode').val();
                var header, sample;
                if (m === 'update') {
                    header = 'id,title,first_name,last_name,email,company\n';
                    sample = '123,Mr,John,Doe,john@example.com,Acme Inc\n';
                } else {
                    header = 'title,first_name,last_name,email,company\n';
                    sample = 'Mr,John,Doe,john@example.com,Acme Inc\n';
                }
                var blob = new Blob([header + sample], { type: 'text/csv' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'candidate-import-template.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
            });

            // Submit import.
            $overlay.on('click', '#import-submit', function () {
                var $btn    = $(this);
                var $status = $('#import-status');
                var $result = $('#import-result');
                var file    = $('#import-file')[0].files[0];
                var mode    = $('#import-mode').val();

                if (!file) return;

                $btn.prop('disabled', true);
                $status.text('Validating…').removeClass('aioemp-form-status--ok aioemp-form-status--err');

                // Frontend guard: reject CSV with ID column in "new" mode.
                if (mode === 'new') {
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        var firstLine = (e.target.result || '').split(/\r?\n/)[0];
                        var cols = firstLine.toLowerCase().split(',').map(function (c) { return c.trim().replace(/^"|"$/g, ''); });
                        if (cols.indexOf('id') !== -1) {
                            $status.text('CSV must not contain an ID column when adding new candidates. Remove the ID column and try again.').addClass('aioemp-form-status--err');
                            $btn.prop('disabled', false);
                            return;
                        }
                        doImportUpload(file, mode, $btn, $status, $result, $overlay);
                    };
                    reader.readAsText(file.slice(0, 4096));
                    return;
                }

                doImportUpload(file, mode, $btn, $status, $result, $overlay);
            });
        }

        function doImportUpload(file, mode, $btn, $status, $result, $overlay) {
                $status.text('Uploading…').removeClass('aioemp-form-status--ok aioemp-form-status--err');

                var formData = new FormData();
                formData.append('file', file);
                formData.append('mode', mode);

                var url = ctx.api.buildUrl('events/' + ctx.detailEventId + '/attenders/import-csv');

                fetch(url, {
                    method: 'POST',
                    headers: { 'X-WP-Nonce': window.aioemp_rest_nonce },
                    body: formData,
                })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (data.code) {
                        // WP_Error response.
                        throw new Error(data.message || 'Import failed.');
                    }

                    var d = data.data || data;

                    $status.text('Done!').addClass('aioemp-form-status--ok');

                    var hasWarnings = d.errors && d.errors.length;
                    var bgColor   = hasWarnings ? '#fff8e1' : '#f0fdf4';
                    var borderClr = hasWarnings ? '#f59e0b' : '#22c55e';
                    var textClr   = hasWarnings ? '#78350f' : '#166534';

                    var html = '<div style="padding:10px 14px;background:' + bgColor + ';border-left:4px solid ' + borderClr + ';border-radius:4px;font-size:13px;color:' + textClr + ';">';
                    html += '<strong>Import complete.</strong><br>';
                    html += 'Created: ' + (d.created || 0) + ' · Updated: ' + (d.updated || 0) + ' · Skipped: ' + (d.skipped || 0);
                    if (hasWarnings) {
                        html += '<br><br><strong>Warnings:</strong><br>';
                        html += d.errors.map(function (e) { return esc(e); }).join('<br>');
                    }
                    html += '</div>';
                    $result.html(html).show();

                    // Refresh list behind.
                    loadCandidates();

                    // New-mode: send registration emails if candidates were created.
                    if (mode === 'new' && d.created_ids && d.created_ids.length) {
                        $overlay.remove();
                        runImportEmailBatch(d.created_ids);
                    }
                })
                .catch(function (err) {
                    $status.text(err.message || 'Import failed.').addClass('aioemp-form-status--err');
                    $btn.prop('disabled', false);
                });
        }

        /**
         * After a new-mode import, send registration emails for all created candidates.
         * Uses the same progress-bar modal as batch-process, calling bulk-resend.
         */
        function runImportEmailBatch(createdIds) {
            // Load settings for batch size & wait time, then run.
            api.get('settings').then(function (cfg) {
                var batchSize = Math.max(1, parseInt(cfg.email_batch_size, 10) || 1);
                var waitMs    = Math.max(0, parseInt(cfg.email_batch_wait_ms, 10) || 0);
                _runImportEmailBatchWithConfig(createdIds, batchSize, waitMs);
            }).catch(function () {
                _runImportEmailBatchWithConfig(createdIds, 1, 0);
            });
        }

        function _runImportEmailBatchWithConfig(allIds, batchSize, waitMs) {
            var total      = allIds.length;
            var processed  = 0;
            var totalSent  = 0;
            var totalFailed = [];

            var $overlay = $('<div class="aioemp-modal-overlay"></div>');
            var $modal   = $(
                '<div class="aioemp-modal" style="max-width:480px">' +
                    '<div class="aioemp-modal__header">' +
                        '<h3>Sending Registration Emails</h3>' +
                    '</div>' +
                    '<div class="aioemp-modal__body">' +
                        '<p class="batch-status-text">Sending 1 of ' + total + '…</p>' +
                        '<div class="aioemp-progress">' +
                            '<div class="aioemp-progress__bar" style="width:0%"></div>' +
                        '</div>' +
                        '<p class="batch-detail-text" style="font-size:13px;color:#666;">0 / ' + total + ' emails sent</p>' +
                        '<p class="batch-config-text" style="font-size:12px;color:#999;">Batch size: ' + batchSize + ' · Wait: ' + waitMs + 'ms</p>' +
                    '</div>' +
                '</div>'
            );
            $overlay.append($modal);
            $('body').append($overlay);

            var $bar    = $modal.find('.aioemp-progress__bar');
            var $status = $modal.find('.batch-status-text');
            var $detail = $modal.find('.batch-detail-text');

            function processBatch(index) {
                if (index >= total) {
                    $bar.css('width', '100%');
                    $status.text('Complete!');

                    var summary = totalSent + ' email(s) sent.';
                    if (totalFailed.length > 0) {
                        summary += ' ' + totalFailed.length + ' email(s) failed.';
                    }
                    $detail.text(summary);

                    if (totalFailed.length > 0) {
                        var $notice = $(
                            '<div style="margin-top:12px;padding:10px 14px;background:#fff8e1;border-left:4px solid #f59e0b;border-radius:4px;font-size:13px;color:#78350f;">' +
                                '<strong>Some emails could not be sent.</strong><br>' +
                                'This is often caused by SMTP sending limits. ' +
                                'Try reducing the <strong>Email Batch Size</strong> and increasing <strong>Wait Between Cycles</strong> in ' +
                                '<a href="#settings" style="color:#b45309;font-weight:600;">Settings</a>.' +
                            '</div>'
                        );
                        $notice.find('a').on('click', function () {
                            $overlay.remove();
                            location.hash = '#settings';
                        });
                        $modal.find('.aioemp-modal__body').append($notice);
                    }

                    var $closeBtn = $('<button class="button button-primary" style="margin-top:12px;">Close</button>');
                    $closeBtn.on('click', function () {
                        $overlay.remove();
                        loadCandidates();
                    });
                    $modal.find('.aioemp-modal__body').append($closeBtn);

                    $overlay.on('click', function (e) {
                        if ($(e.target).hasClass('aioemp-modal-overlay')) {
                            $overlay.remove();
                            loadCandidates();
                        }
                    });
                    return;
                }

                var chunk = allIds.slice(index, index + batchSize);
                $status.text('Sending ' + Math.min(index + batchSize, total) + ' of ' + total + '…');

                api.post('events/' + ctx.detailEventId + '/attenders/bulk-resend', { ids: chunk })
                .then(function (res) {
                    var r = res.data || res;
                    processed += chunk.length;
                    totalSent += (r.sent || 0);
                    if (r.failed && r.failed.length) {
                        totalFailed = totalFailed.concat(r.failed);
                    }

                    var pct = Math.round((processed / total) * 100);
                    $bar.css('width', pct + '%');
                    $detail.text(totalSent + ' / ' + total + ' emails sent');

                    if (index + batchSize < total && waitMs > 0) {
                        setTimeout(function () { processBatch(index + batchSize); }, waitMs);
                    } else {
                        processBatch(index + batchSize);
                    }
                })
                .catch(function () {
                    processed += chunk.length;
                    $detail.text('Error at batch ' + (index + 1) + '. Continuing…');
                    if (waitMs > 0) {
                        setTimeout(function () { processBatch(index + batchSize); }, waitMs);
                    } else {
                        processBatch(index + batchSize);
                    }
                });
            }

            processBatch(0);
        }

        loadCandidates();
    }

    /* ── Candidate Add/Edit Form (modal overlay) ── */

    function showCandidateForm(candidateId) {
        // Remove any existing modal.
        $('.aioemp-modal-overlay').remove();

        var overlay = $(
            '<div class="aioemp-modal-overlay">' +
                '<div class="aioemp-modal">' +
                    '<div class="aioemp-modal__header">' +
                        '<h3>' + (candidateId ? 'Edit Candidate' : 'Add Candidate') + '</h3>' +
                        '<button class="aioemp-modal__close">&times;</button>' +
                    '</div>' +
                    '<div class="aioemp-modal__body" id="cand-modal-body">' +
                        (candidateId ? '<p class="aioemp-loading">Loading…</p>' : buildCandidateFields({})) +
                    '</div>' +
                '</div>' +
            '</div>'
        );

        $('body').append(overlay);

        // Close.
        overlay.on('click', '.aioemp-modal__close', function () { overlay.remove(); });
        overlay.on('click', function (e) {
            if ($(e.target).hasClass('aioemp-modal-overlay')) overlay.remove();
        });

        if (candidateId) {
            api.get('events/' + ctx.detailEventId + '/attenders/' + candidateId)
                .then(function (data) {
                    $('#cand-modal-body').html(buildCandidateFields(data));
                    bindCandidateFormEvents(overlay, candidateId);
                })
                .catch(function (err) {
                    console.error('Failed to load candidate', candidateId, err);
                    var msg = (err && err.message) ? err.message : 'Unknown error';
                    $('#cand-modal-body').html('<p class="aioemp-error">Failed to load candidate: ' + ctx.esc(msg) + '</p>');
                });
        } else {
            bindCandidateFormEvents(overlay, null);
        }
    }

    function buildCandidateFields(data) {
        var vm = (ctx.detailEvent && ctx.detailEvent.venue_mode) || 'mixed';
        var presetTitles = ['', 'Mr', 'Ms', 'Mrs', 'Dr'];
        var titleVal = data.title || '';
        var isFreeText = titleVal !== '' && presetTitles.indexOf(titleVal) === -1;
        return (
            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Title</label>' +
                    '<select id="cand-f-title" class="aioemp-select">' +
                        '<option value="">(none)</option>' +
                        '<option value="Mr"' + (titleVal === 'Mr' ? ' selected' : '') + '>Mr</option>' +
                        '<option value="Ms"' + (titleVal === 'Ms' ? ' selected' : '') + '>Ms</option>' +
                        '<option value="Mrs"' + (titleVal === 'Mrs' ? ' selected' : '') + '>Mrs</option>' +
                        '<option value="Dr"' + (titleVal === 'Dr' ? ' selected' : '') + '>Dr</option>' +
                        '<option value="__freetext"' + (isFreeText ? ' selected' : '') + '>Free text</option>' +
                    '</select>' +
                    '<input id="cand-f-title-text" class="aioemp-input" type="text" placeholder="Enter custom title" value="' + esc(isFreeText ? titleVal : '') + '" style="margin-top:6px;' + (isFreeText ? '' : 'display:none;') + '">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Status</label>' +
                    '<select id="cand-f-status" class="aioemp-select">' +
                        '<option value="registered"' + (data.status === 'registered' || !data.status ? ' selected' : '') + '>Registered</option>' +
                        (vm !== 'online' ? '<option value="accepted_onsite"' + (data.status === 'accepted_onsite' ? ' selected' : '') + '>Accepted (On-site)</option>' : '') +
                        (vm !== 'onsite' ? '<option value="accepted_online"' + (data.status === 'accepted_online' ? ' selected' : '') + '>Accepted (Online)</option>' : '') +
                        '<option value="rejected"' + (data.status === 'rejected' ? ' selected' : '') + '>Rejected</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">First Name *</label>' +
                    '<input id="cand-f-fname" class="aioemp-input" type="text" value="' + esc(data.first_name || '') + '">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Last Name</label>' +
                    '<input id="cand-f-lname" class="aioemp-input" type="text" value="' + esc(data.last_name || '') + '">' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Email</label>' +
                    '<input id="cand-f-email" class="aioemp-input" type="email" value="' + esc(data.email || '') + '">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Company</label>' +
                    '<input id="cand-f-company" class="aioemp-input" type="text" value="' + esc(data.company || '') + '">' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-actions">' +
                '<button id="cand-f-save" class="aioemp-btn aioemp-btn--primary">' +
                    (data.id ? 'Update' : 'Add Candidate') +
                '</button>' +
                '<button id="cand-f-cancel" class="aioemp-btn aioemp-btn--outline">Cancel</button>' +
                '<span id="cand-f-msg" class="aioemp-form-status"></span>' +
            '</div>'
        );
    }

    function bindCandidateFormEvents(overlay, candidateId) {
        overlay.on('click', '#cand-f-cancel', function () { overlay.remove(); });

        // Toggle free-text title input.
        overlay.on('change', '#cand-f-title', function () {
            var $txt = $('#cand-f-title-text');
            if ($(this).val() === '__freetext') {
                $txt.show().focus();
            } else {
                $txt.hide().val('');
            }
        });

        overlay.on('click', '#cand-f-save', function () {
            var btn = $(this);
            var $msg = $('#cand-f-msg');
            btn.prop('disabled', true);
            $msg.text('Saving…').removeClass('aioemp-form-status--ok aioemp-form-status--err');

            var titleSel = $('#cand-f-title').val();
            var titleVal = titleSel === '__freetext' ? $('#cand-f-title-text').val().trim() : titleSel;

            var body = {
                title:      titleVal,
                first_name: $('#cand-f-fname').val().trim(),
                last_name:  $('#cand-f-lname').val().trim(),
                email:      $('#cand-f-email').val().trim(),
                company:    $('#cand-f-company').val().trim(),
                status:     $('#cand-f-status').val(),
            };

            if (!body.first_name && !body.last_name) {
                $msg.text('Name is required.').addClass('aioemp-form-status--err');
                btn.prop('disabled', false);
                return;
            }

            var promise = candidateId
                ? api.put('events/' + ctx.detailEventId + '/attenders/' + candidateId, body)
                : api.post('events/' + ctx.detailEventId + '/attenders', body);

            promise
                .then(function () {
                    overlay.remove();
                    // Refresh the candidates tab.
                    ctx.renderTabContent();
                })
                .catch(function (err) {
                    $msg.text(err.message || 'Save failed.').addClass('aioemp-form-status--err');
                    btn.prop('disabled', false);
                });
        });
    }

    /* ── Register on context ── */
    ctx.renderCandidatesTab = renderCandidatesTab;

})(jQuery, window.AIOEMP_Events);
