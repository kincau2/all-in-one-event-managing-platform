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

    function renderCandidatesTab($tc) {
        // Remove all previously-bound .cand handlers to avoid stacking.
        $tc.off('.cand');

        ctx.candidateState = { page: 1, status: '', search: '' };

        var vm = (ctx.detailEvent && ctx.detailEvent.venue_mode) || 'mixed';

        var html =
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Candidates</h3>' +
                    (canManage()
                        ? '<button id="cand-btn-new" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                              '<span class="dashicons dashicons-plus-alt2"></span> Add Candidate' +
                          '</button>'
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
            var qs = '?page=' + ctx.candidateState.page + '&per_page=' + ctx.PER_PAGE;
            if (ctx.candidateState.status) qs += '&status=' + encodeURIComponent(ctx.candidateState.status);
            if (ctx.candidateState.search) qs += '&search=' + encodeURIComponent(ctx.candidateState.search);

            api.get('events/' + ctx.detailEventId + '/attenders' + qs)
                .then(function (items) {
                    var arr = Array.isArray(items) ? items : (items.data || []);
                    $cWrap.html(renderCandidateTable(arr));
                    // Simple pagination.
                    if (arr.length >= ctx.PER_PAGE || ctx.candidateState.page > 1) {
                        $cPag.html(
                            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline cand-page-prev"' +
                            (ctx.candidateState.page <= 1 ? ' disabled' : '') + '>← Prev</button> ' +
                            '<span class="aioemp-pagination__info">Page ' + ctx.candidateState.page + '</span> ' +
                            (arr.length >= ctx.PER_PAGE
                                ? '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline cand-page-next">Next →</button>'
                                : '')
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
                        '<th>Name</th>' +
                        '<th>Email</th>' +
                        '<th>Company</th>' +
                        '<th>Status</th>' +
                        '<th>Attendance</th>' +
                        '<th>Registered</th>' +
                        (canManage() ? '<th style="width:140px">Actions</th>' : '') +
                    '</tr></thead><tbody>';

            rows.forEach(function (r) {
                var name = ((r.title ? r.title + ' ' : '') + (r.first_name || '') + ' ' + (r.last_name || '')).trim();
                // Attendance column: show check-in badge for accepted_onsite with assignment; "—" otherwise.
                var attCell = '—';
                if (r.status === 'accepted_onsite') {
                    if (r.checked_in === '1' || r.checked_in === 1 || r.checked_in === true) {
                        attCell = '<span class="aioemp-badge aioemp-badge--success">Checked In</span>';
                    } else if (r.checked_in !== null && typeof r.checked_in !== 'undefined') {
                        attCell = '<span class="aioemp-badge aioemp-badge--draft">Not Checked In</span>';
                    } else {
                        attCell = '<span class="aioemp-badge aioemp-badge--draft">No Seat</span>';
                    }
                }
                html +=
                    '<tr data-id="' + r.id + '">' +
                        (canManage() ? '<td><input type="checkbox" class="cand-check" value="' + r.id + '"></td>' : '') +
                        '<td>' + esc(name || '(unnamed)') + '</td>' +
                        '<td>' + esc(r.email || '—') + '</td>' +
                        '<td>' + esc(r.company || '—') + '</td>' +
                        '<td>' + candidateStatusBadge(r.status) + '</td>' +
                        '<td>' + attCell + '</td>' +
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
            if (!action) { alert('Select a bulk action first.'); return; }

            var ids = [];
            $tc.find('.cand-check:checked').each(function () {
                ids.push(parseInt($(this).val(), 10));
            });

            if (!ids.length) { alert('No candidates selected.'); return; }

            if (action === '__delete') {
                if (!confirm('Delete ' + ids.length + ' candidate(s)? This cannot be undone.')) return;
                runBulkDelete(ids);
            } else if (action === '__resend_email') {
                if (!confirm('Resend email to ' + ids.length + ' candidate(s)?')) return;
                runBulkResend(ids);
            } else {
                if (!confirm('Change ' + ids.length + ' candidate(s) to "' + action.replace(/_/g, ' ') + '"?')) return;
                runBatchProcess(ids, action);
            }
        });

        /**
         * Bulk delete — single API call, no progress bar needed.
         */
        function runBulkDelete(ids) {
            api.post('events/' + ctx.detailEventId + '/attenders/bulk-delete', { ids: ids })
                .then(function (res) {
                    alert('Deleted ' + (res.deleted || 0) + ' candidate(s).');
                    loadCandidates();
                })
                .catch(function (err) {
                    alert('Bulk delete failed: ' + (err.message || 'Unknown error'));
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
                    '</div>' +
                '</div>'
            );
            $overlay.append($modal);
            $('body').append($overlay);
            // Prevent closing during processing.

            var $bar    = $modal.find('.aioemp-progress__bar');
            var $status = $modal.find('.batch-status-text');
            var $detail = $modal.find('.batch-detail-text');

            function processBatch(index) {
                if (index >= total) {
                    // Done — show summary.
                    var pct = 100;
                    $bar.css('width', pct + '%');
                    $status.text('Complete!');

                    var summary = processed + ' candidate(s) updated.';
                    if (totalSent > 0) {
                        summary += ' ' + totalSent + ' email(s) sent.';
                    }
                    if (totalFailed.length > 0) {
                        summary += ' ' + totalFailed.length + ' email(s) failed.';
                    }
                    $detail.text(summary);

                    // Add close button.
                    var $closeBtn = $('<button class="button button-primary" style="margin-top:12px;">Close</button>');
                    $closeBtn.on('click', function () {
                        $overlay.remove();
                        loadCandidates();
                    });
                    $modal.find('.aioemp-modal__body').append($closeBtn);

                    // Allow overlay click to close.
                    $overlay.on('click', function (e) {
                        if ($(e.target).hasClass('aioemp-modal-overlay')) {
                            $overlay.remove();
                            loadCandidates();
                        }
                    });
                    return;
                }

                $status.text('Processing ' + (index + 1) + ' of ' + total + '…');

                api.post('events/' + ctx.detailEventId + '/attenders/batch-process', {
                    ids: [allIds[index]],
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

                    // Next batch.
                    processBatch(index + 1);
                })
                .catch(function (err) {
                    // On error, still continue with remaining candidates.
                    $detail.text('Error on ' + (index + 1) + ': ' + (err.message || 'Unknown') + '. Continuing…');
                    processBatch(index + 1);
                });
            }

            // Start.
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
            if (!confirm('Delete this candidate? This cannot be undone.')) return;
            api.del('events/' + ctx.detailEventId + '/attenders/' + id)
                .then(function () { loadCandidates(); })
                .catch(function (err) {
                    alert('Delete failed: ' + (err.message || 'Unknown error'));
                });
        });

        // Resend email for candidate.
        $tc.on('click.cand', '.cand-act-resend', function () {
            var $btn = $(this);
            var id   = $btn.closest('tr').data('id');
            if (!confirm('Resend email to this candidate based on their current status?')) return;

            $btn.prop('disabled', true);
            api.post('events/' + ctx.detailEventId + '/attenders/' + id + '/resend-email', {})
                .then(function (res) {
                    var data = res && res.data ? res.data : res;
                    alert('Email sent to ' + (data.to || 'candidate') + ' (' + (data.template || '').replace(/_/g, ' ') + ')');
                })
                .catch(function (err) {
                    alert('Failed to send email: ' + (err.message || 'Unknown error'));
                })
                .finally(function () {
                    $btn.prop('disabled', false);
                });
        });

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
        return (
            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Title</label>' +
                    '<select id="cand-f-title" class="aioemp-select">' +
                        '<option value="">(none)</option>' +
                        '<option value="Mr"' + (data.title === 'Mr' ? ' selected' : '') + '>Mr</option>' +
                        '<option value="Ms"' + (data.title === 'Ms' ? ' selected' : '') + '>Ms</option>' +
                        '<option value="Mrs"' + (data.title === 'Mrs' ? ' selected' : '') + '>Mrs</option>' +
                        '<option value="Dr"' + (data.title === 'Dr' ? ' selected' : '') + '>Dr</option>' +
                    '</select>' +
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

        overlay.on('click', '#cand-f-save', function () {
            var btn = $(this);
            var $msg = $('#cand-f-msg');
            btn.prop('disabled', true);
            $msg.text('Saving…').removeClass('aioemp-form-status--ok aioemp-form-status--err');

            var body = {
                title:      $('#cand-f-title').val(),
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
