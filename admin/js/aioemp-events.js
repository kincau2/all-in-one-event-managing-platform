/**
 * AIOEMP Events Module
 *
 * jQuery module rendered when the user navigates to #events.
 * Provides: events list, create/edit form, event detail with tabs
 * (Overview, Candidates, Attendance, Seating).
 *
 * @package AIOEMP
 * @since   0.2.0
 */
(function ($) {
    'use strict';

    const api = window.aioemp_api;

    /* ================================================================
     * Helpers
     * ================================================================ */

    function esc(str) {
        var el = document.createElement('span');
        el.textContent = str || '';
        return el.innerHTML;
    }

    function fmtDate(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr + (dateStr.indexOf('Z') === -1 ? 'Z' : ''));
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function fmtDateTime(dateStr) {
        if (!dateStr) return '—';
        var d = new Date(dateStr + (dateStr.indexOf('Z') === -1 ? 'Z' : ''));
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) +
               ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }

    /** Convert local datetime-local input value to GMT string for API */
    function localToGmt(localStr) {
        if (!localStr) return '';
        var d = new Date(localStr);
        if (isNaN(d.getTime())) return '';
        return d.getUTCFullYear() + '-' +
               String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
               String(d.getUTCDate()).padStart(2, '0') + ' ' +
               String(d.getUTCHours()).padStart(2, '0') + ':' +
               String(d.getUTCMinutes()).padStart(2, '0') + ':' +
               String(d.getUTCSeconds()).padStart(2, '0');
    }

    /** Convert GMT datetime from API to local datetime-local input value */
    function gmtToLocal(gmtStr) {
        if (!gmtStr) return '';
        var d = new Date(gmtStr + (gmtStr.indexOf('Z') === -1 ? 'Z' : ''));
        if (isNaN(d.getTime())) return '';
        // Return local datetime-local format: YYYY-MM-DDTHH:mm
        var y  = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, '0');
        var da = String(d.getDate()).padStart(2, '0');
        var h  = String(d.getHours()).padStart(2, '0');
        var mi = String(d.getMinutes()).padStart(2, '0');
        return y + '-' + mo + '-' + da + 'T' + h + ':' + mi;
    }

    function statusBadge(status) {
        return '<span class="aioemp-badge aioemp-badge--' + esc(status || 'draft') + '">' + esc(status || 'draft') + '</span>';
    }

    function venueBadge(mode) {
        if (!mode) return '—';
        var cls = mode === 'onsite' ? 'info' : mode === 'online' ? 'success' : 'warning';
        return '<span class="aioemp-badge aioemp-badge--' + cls + '">' + esc(mode) + '</span>';
    }

    /* ================================================================
     * EVENTS LIST PAGE
     * ================================================================ */

    var listState = { page: 1, status: '', search: '' };

    function listSkeleton() {
        return (
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Events</h3>' +
                    '<button id="evt-btn-new" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                        '<span class="dashicons dashicons-plus-alt2"></span> New Event' +
                    '</button>' +
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
                    '<th style="width:140px">Actions</th>' +
                '</tr></thead><tbody>';

        rows.forEach(function (r) {
            html +=
                '<tr data-id="' + r.id + '">' +
                    '<td class="evt-cell-title"><a href="#event/' + r.id + '" class="evt-link-title">' + esc(r.title || 'Untitled') + '</a></td>' +
                    '<td>' + statusBadge(r.status) + '</td>' +
                    '<td>' + venueBadge(r.venue_mode) + '</td>' +
                    '<td>' + fmtDate(r.start_date_gmt) + '</td>' +
                    '<td>' + (r.capacity ? esc(String(r.capacity)) : '—') + '</td>' +
                    '<td>' +
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--primary evt-act-view" title="View details">' +
                            '<span class="dashicons dashicons-visibility"></span>' +
                        '</button> ' +
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--secondary evt-act-edit" title="Edit">' +
                            '<span class="dashicons dashicons-edit"></span>' +
                        '</button> ' +
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--danger evt-act-del" title="Delete">' +
                            '<span class="dashicons dashicons-trash"></span>' +
                        '</button>' +
                    '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    function renderPagination(total, perPage, page) {
        var pages = Math.ceil(total / perPage);
        if (pages <= 1) return '';
        var html = '';
        for (var i = 1; i <= pages; i++) {
            html += '<button class="aioemp-btn aioemp-btn--xs ' +
                    (i === page ? 'aioemp-btn--primary' : 'aioemp-btn--outline') +
                    ' evt-page-btn" data-page="' + i + '">' + i + '</button> ';
        }
        return html;
    }

    var $wrap, $pagination;
    var PER_PAGE = 20;

    function loadEventList() {
        $wrap.html('<p class="aioemp-loading">Loading…</p>');
        var qs = '?page=' + listState.page + '&per_page=' + PER_PAGE;
        if (listState.status) qs += '&status=' + encodeURIComponent(listState.status);
        if (listState.search) qs += '&search=' + encodeURIComponent(listState.search);

        api.request('events' + qs)
            .then(function (items) {
                // Read total from fetch — need to intercept headers.
                // For simplicity, render what we have.
                var arr = Array.isArray(items) ? items : (items.data || []);
                $wrap.html(renderEventTable(arr));
                // Total is in X-WP-Total header — not accessible with simple fetch.
                // We'll use the item count as heuristic for now.
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

        // Reset filters.
        listState = { page: 1, status: '', search: '' };

        // Events.
        $el.on('click', '#evt-btn-new', function () {
            showEventForm(null);
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

        $el.on('click', '.evt-act-view', function () {
            var id = $(this).closest('tr').data('id');
            location.hash = '#event/' + id;
        });
        $el.on('click', '.evt-act-edit', function () {
            var id = $(this).closest('tr').data('id');
            showEventForm(id);
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

    /* ================================================================
     * EVENT CREATE / EDIT FORM
     * ================================================================ */

    function showEventForm(eventId) {
        var $content = $('#aioemp-content');
        $content.empty();
        $('#aioemp-page-title').text(eventId ? 'Edit Event' : 'New Event');

        var formHtml =
            '<div class="aioemp-card aioemp-event-form" style="max-width:800px">' +
                '<h3 class="aioemp-card__title">' + (eventId ? 'Edit Event' : 'Create New Event') + '</h3>' +
                '<div id="evt-form-body">' +
                    (eventId ? '<p class="aioemp-loading">Loading…</p>' : buildFormFields({})) +
                '</div>' +
            '</div>';

        $content.html(formHtml);

        if (eventId) {
            api.get('events/' + eventId)
                .then(function (data) {
                    $('#evt-form-body').html(buildFormFields(data));
                    bindFormEvents(eventId);
                })
                .catch(function () {
                    $('#evt-form-body').html('<p class="aioemp-error">Failed to load event.</p>');
                });
        } else {
            bindFormEvents(null);
        }
    }

    function buildFormFields(data) {
        return (
            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group" style="flex:1">' +
                    '<label class="aioemp-label">Title *</label>' +
                    '<input id="evt-f-title" class="aioemp-input" type="text" value="' + esc(data.title || '') + '" placeholder="Event title">' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-group">' +
                '<label class="aioemp-label">Description</label>' +
                '<textarea id="evt-f-desc" class="aioemp-input" rows="3" placeholder="Event description">' + esc(data.description || '') + '</textarea>' +
            '</div>' +

            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Status</label>' +
                    '<select id="evt-f-status" class="aioemp-select">' +
                        '<option value="draft"' + (data.status === 'draft' ? ' selected' : '') + '>Draft</option>' +
                        '<option value="published"' + (data.status === 'published' ? ' selected' : '') + '>Published</option>' +
                        '<option value="closed"' + (data.status === 'closed' ? ' selected' : '') + '>Closed</option>' +
                    '</select>' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Venue Mode</label>' +
                    '<select id="evt-f-venue" class="aioemp-select">' +
                        '<option value="">(select)</option>' +
                        '<option value="onsite"' + (data.venue_mode === 'onsite' ? ' selected' : '') + '>On-site</option>' +
                        '<option value="online"' + (data.venue_mode === 'online' ? ' selected' : '') + '>Online</option>' +
                        '<option value="mixed"' + (data.venue_mode === 'mixed' ? ' selected' : '') + '>Mixed</option>' +
                    '</select>' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Start Date/Time</label>' +
                    '<input id="evt-f-start" class="aioemp-input" type="datetime-local" value="' + gmtToLocal(data.start_date_gmt) + '">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">End Date/Time</label>' +
                    '<input id="evt-f-end" class="aioemp-input" type="datetime-local" value="' + gmtToLocal(data.end_date_gmt) + '">' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Capacity</label>' +
                    '<input id="evt-f-capacity" class="aioemp-input" type="number" min="0" value="' + (data.capacity || '') + '" placeholder="Max attendees">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Seatmap Template</label>' +
                    '<select id="evt-f-seatmap" class="aioemp-select">' +
                        '<option value="">Free seating (no seatmap)</option>' +
                    '</select>' +
                    '<p class="aioemp-help">Select a seatmap template to enable seat assignments.</p>' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Location Name</label>' +
                    '<input id="evt-f-loc-name" class="aioemp-input" type="text" value="' + esc(data.location_name || '') + '" placeholder="Venue name">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Location Address</label>' +
                    '<input id="evt-f-loc-addr" class="aioemp-input" type="text" value="' + esc(data.location_address || '') + '" placeholder="Venue address">' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-row">' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Online URL</label>' +
                    '<input id="evt-f-online-url" class="aioemp-input" type="url" value="' + esc(data.online_url || '') + '" placeholder="https://">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">Cover Image URL</label>' +
                    '<input id="evt-f-cover" class="aioemp-input" type="url" value="' + esc(data.cover_img_url || '') + '" placeholder="https://">' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-form-actions">' +
                '<button id="evt-f-save" class="aioemp-btn aioemp-btn--primary">' +
                    '<span class="dashicons dashicons-saved"></span> ' + (data.id ? 'Update Event' : 'Create Event') +
                '</button>' +
                '<button id="evt-f-cancel" class="aioemp-btn aioemp-btn--outline">Cancel</button>' +
                '<span id="evt-f-status-msg" class="aioemp-form-status"></span>' +
            '</div>'
        );
    }

    function bindFormEvents(eventId) {
        // Load seatmaps into dropdown.
        api.get('seatmaps')
            .then(function (res) {
                var items = Array.isArray(res) ? res : (res.data || []);
                var $sel = $('#evt-f-seatmap');
                items.forEach(function (sm) {
                    // Only show seatmaps that pass integrity check.
                    if (sm.integrity_pass) {
                        var selected = eventId && sm.id == $('#evt-f-seatmap').data('current-id') ? ' selected' : '';
                        $sel.append('<option value="' + sm.id + '"' + selected + '>' + esc(sm.title) + '</option>');
                    }
                });
            })
            .catch(function () { /* ignore — dropdown just stays with free seating */ });

        // If editing, load current seatmap_id after API returns.
        if (eventId) {
            api.get('events/' + eventId).then(function (data) {
                if (data.seatmap_id) {
                    $('#evt-f-seatmap').data('current-id', data.seatmap_id);
                    $('#evt-f-seatmap').val(data.seatmap_id);
                }
            }).catch(function () {});
        }

        // Save.
        $('#evt-f-save').on('click', function () {
            var btn = $(this);
            var $msg = $('#evt-f-status-msg');
            btn.prop('disabled', true);
            $msg.text('Saving…').removeClass('aioemp-form-status--ok aioemp-form-status--err');

            var body = {
                title:            $('#evt-f-title').val().trim(),
                description:      $('#evt-f-desc').val().trim(),
                status:           $('#evt-f-status').val(),
                venue_mode:       $('#evt-f-venue').val(),
                start_date_gmt:   localToGmt($('#evt-f-start').val()),
                end_date_gmt:     localToGmt($('#evt-f-end').val()),
                capacity:         parseInt($('#evt-f-capacity').val(), 10) || null,
                location_name:    $('#evt-f-loc-name').val().trim(),
                location_address: $('#evt-f-loc-addr').val().trim(),
                online_url:       $('#evt-f-online-url').val().trim(),
                cover_img_url:    $('#evt-f-cover').val().trim(),
                seatmap_id:       $('#evt-f-seatmap').val() || '',
            };

            if (!body.title) {
                $msg.text('Title is required.').addClass('aioemp-form-status--err');
                btn.prop('disabled', false);
                return;
            }

            var promise = eventId
                ? api.put('events/' + eventId, body)
                : api.post('events', body);

            promise
                .then(function (res) {
                    $msg.text('Saved!').addClass('aioemp-form-status--ok');
                    setTimeout(function () {
                        var newId = res.id || (res.data && res.data.id) || eventId;
                        location.hash = '#event/' + newId;
                    }, 500);
                })
                .catch(function (err) {
                    $msg.text(err.message || 'Save failed.').addClass('aioemp-form-status--err');
                    btn.prop('disabled', false);
                });
        });

        // Cancel.
        $('#evt-f-cancel').on('click', function () {
            location.hash = '#events';
        });
    }

    /* ================================================================
     * EVENT DETAIL PAGE (with tabs)
     * ================================================================ */

    var detailEventId = null;
    var detailEvent   = null;
    var activeTab     = 'overview';

    function showEventDetail(eventId) {
        detailEventId = eventId;
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
                detailEvent = data;
                renderDetail($('#evt-detail-wrap'));
            })
            .catch(function () {
                $('#evt-detail-wrap').html('<p class="aioemp-error">Failed to load event.</p>');
            });
    }

    function renderDetail($el) {
        var d = detailEvent;

        var hasSeatmap = d.seatmap_id || d.seatmap_layout_snapshot;

        var html =
            '<div class="aioemp-detail-header">' +
                '<div class="aioemp-detail-header__left">' +
                    '<a href="#events" class="aioemp-topbar__btn-back">' +
                        '<span class="dashicons dashicons-arrow-left-alt2"></span> Back to Events' +
                    '</a>' +
                    '<h2 class="aioemp-detail-title">' + esc(d.title) + '</h2>' +
                    '<div class="aioemp-detail-meta">' +
                        statusBadge(d.status) + ' ' +
                        venueBadge(d.venue_mode) +
                        (d.start_date_gmt ? ' &middot; ' + fmtDateTime(d.start_date_gmt) : '') +
                        (d.capacity ? ' &middot; Capacity: ' + esc(String(d.capacity)) : '') +
                    '</div>' +
                '</div>' +
                '<div class="aioemp-detail-header__right">' +
                    '<button id="evt-detail-edit" class="aioemp-btn aioemp-btn--sm aioemp-btn--secondary">' +
                        '<span class="dashicons dashicons-edit"></span> Edit' +
                    '</button>' +
                '</div>' +
            '</div>' +

            '<div class="aioemp-tabs">' +
                '<button class="aioemp-tab' + (activeTab === 'overview' ? ' is-active' : '') + '" data-tab="overview">Overview</button>' +
                '<button class="aioemp-tab' + (activeTab === 'candidates' ? ' is-active' : '') + '" data-tab="candidates">Candidates</button>' +
                '<button class="aioemp-tab' + (activeTab === 'attendance' ? ' is-active' : '') + '" data-tab="attendance">Attendance</button>' +
                (hasSeatmap ? '<button class="aioemp-tab' + (activeTab === 'seating' ? ' is-active' : '') + '" data-tab="seating">Seating</button>' : '') +
            '</div>' +

            '<div id="evt-tab-content" class="aioemp-tab-content"></div>';

        $el.html(html);

        // Tab switching.
        $el.on('click', '.aioemp-tab', function () {
            activeTab = $(this).data('tab');
            $el.find('.aioemp-tab').removeClass('is-active');
            $(this).addClass('is-active');
            renderTabContent();
        });

        // Edit button.
        $el.on('click', '#evt-detail-edit', function () {
            showEventForm(detailEventId);
        });

        renderTabContent();
    }

    function renderTabContent() {
        var $tc = $('#evt-tab-content');
        $tc.empty();

        switch (activeTab) {
            case 'overview':
                renderOverviewTab($tc);
                break;
            case 'candidates':
                renderCandidatesTab($tc);
                break;
            case 'attendance':
                renderAttendanceTab($tc);
                break;
            case 'seating':
                renderSeatingTab($tc);
                break;
        }
    }

    /* ── Overview Tab ── */

    function renderOverviewTab($tc) {
        var d = detailEvent;
        var html =
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">Event Information</h3>' +
                '<div class="aioemp-detail-grid">' +
                    detailRow('Title', d.title) +
                    detailRow('Description', d.description || '(none)') +
                    detailRow('Status', statusBadge(d.status)) +
                    detailRow('Venue Mode', venueBadge(d.venue_mode)) +
                    detailRow('Start', fmtDateTime(d.start_date_gmt)) +
                    detailRow('End', fmtDateTime(d.end_date_gmt)) +
                    detailRow('Capacity', d.capacity || '—') +
                    detailRow('Location', (d.location_name || '') + (d.location_address ? ' — ' + d.location_address : '') || '—') +
                    detailRow('Online URL', d.online_url ? '<a href="' + esc(d.online_url) + '" target="_blank">' + esc(d.online_url) + '</a>' : '—') +
                    detailRow('Seatmap', d.seatmap_id ? 'Template #' + d.seatmap_id : 'Free seating') +
                    detailRow('Created', fmtDateTime(d.created_at_gmt)) +
                '</div>' +
            '</div>' +

            '<div class="aioemp-card" id="evt-overview-stats">' +
                '<h3 class="aioemp-card__title">Candidate Statistics</h3>' +
                '<p class="aioemp-loading">Loading…</p>' +
            '</div>';

        $tc.html(html);

        // Load candidate counts.
        api.get('events/' + detailEventId + '/attenders/counts')
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

    /* ── Candidates Tab ── */

    var candidateState = { page: 1, status: '', search: '' };

    function renderCandidatesTab($tc) {
        candidateState = { page: 1, status: '', search: '' };

        var html =
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Candidates</h3>' +
                    '<button id="cand-btn-new" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                        '<span class="dashicons dashicons-plus-alt2"></span> Add Candidate' +
                    '</button>' +
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
                    '<div class="aioemp-toolbar__bulk" id="cand-bulk-wrap" style="display:none">' +
                        '<select id="cand-bulk-action" class="aioemp-select aioemp-select--sm" style="max-width:200px">' +
                            '<option value="">Bulk Actions…</option>' +
                            '<option value="accepted_onsite">Accept (On-site)</option>' +
                            '<option value="accepted_online">Accept (Online)</option>' +
                            '<option value="rejected">Reject</option>' +
                        '</select>' +
                        '<button id="cand-bulk-apply" class="aioemp-btn aioemp-btn--xs aioemp-btn--primary">Apply</button>' +
                    '</div>' +
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
            var qs = '?page=' + candidateState.page + '&per_page=' + PER_PAGE;
            if (candidateState.status) qs += '&status=' + encodeURIComponent(candidateState.status);
            if (candidateState.search) qs += '&search=' + encodeURIComponent(candidateState.search);

            api.get('events/' + detailEventId + '/attenders' + qs)
                .then(function (items) {
                    var arr = Array.isArray(items) ? items : (items.data || []);
                    $cWrap.html(renderCandidateTable(arr));
                    // Simple pagination.
                    if (arr.length >= PER_PAGE || candidateState.page > 1) {
                        $cPag.html(
                            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline cand-page-prev"' +
                            (candidateState.page <= 1 ? ' disabled' : '') + '>← Prev</button> ' +
                            '<span class="aioemp-pagination__info">Page ' + candidateState.page + '</span> ' +
                            (arr.length >= PER_PAGE
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
                        '<th style="width:40px"><input type="checkbox" id="cand-select-all"></th>' +
                        '<th>Name</th>' +
                        '<th>Email</th>' +
                        '<th>Company</th>' +
                        '<th>Status</th>' +
                        '<th>Registered</th>' +
                        '<th style="width:120px">Actions</th>' +
                    '</tr></thead><tbody>';

            rows.forEach(function (r) {
                var name = ((r.title ? r.title + ' ' : '') + (r.first_name || '') + ' ' + (r.last_name || '')).trim();
                html +=
                    '<tr data-id="' + r.id + '">' +
                        '<td><input type="checkbox" class="cand-check" value="' + r.id + '"></td>' +
                        '<td>' + esc(name || '(unnamed)') + '</td>' +
                        '<td>' + esc(r.email || '—') + '</td>' +
                        '<td>' + esc(r.company || '—') + '</td>' +
                        '<td>' + candidateStatusBadge(r.status) + '</td>' +
                        '<td>' + fmtDate(r.created_at_gmt) + '</td>' +
                        '<td>' +
                            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--secondary cand-act-edit" title="Edit">' +
                                '<span class="dashicons dashicons-edit"></span>' +
                            '</button> ' +
                            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--danger cand-act-del" title="Delete">' +
                                '<span class="dashicons dashicons-trash"></span>' +
                            '</button>' +
                        '</td>' +
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
        $tc.on('input', '#cand-search', function () {
            clearTimeout(searchTimer);
            var val = $(this).val();
            searchTimer = setTimeout(function () {
                candidateState.search = val;
                candidateState.page = 1;
                loadCandidates();
            }, 300);
        });

        // Filter.
        $tc.on('change', '#cand-filter-status', function () {
            candidateState.status = $(this).val();
            candidateState.page = 1;
            loadCandidates();
        });

        // Pagination.
        $tc.on('click', '.cand-page-prev', function () {
            if (candidateState.page > 1) {
                candidateState.page--;
                loadCandidates();
            }
        });
        $tc.on('click', '.cand-page-next', function () {
            candidateState.page++;
            loadCandidates();
        });

        // Select all / show bulk bar.
        $tc.on('change', '#cand-select-all', function () {
            var checked = $(this).prop('checked');
            $tc.find('.cand-check').prop('checked', checked);
            toggleBulkBar();
        });
        $tc.on('change', '.cand-check', function () {
            toggleBulkBar();
        });

        function toggleBulkBar() {
            var selected = $tc.find('.cand-check:checked').length;
            $('#cand-bulk-wrap').toggle(selected > 0);
        }

        // Bulk action apply.
        $tc.on('click', '#cand-bulk-apply', function () {
            var action = $('#cand-bulk-action').val();
            if (!action) { alert('Select a bulk action first.'); return; }

            var ids = [];
            $tc.find('.cand-check:checked').each(function () {
                ids.push(parseInt($(this).val(), 10));
            });

            if (!ids.length) { alert('No candidates selected.'); return; }
            if (!confirm('Change ' + ids.length + ' candidate(s) to "' + action.replace(/_/g, ' ') + '"?')) return;

            api.post('events/' + detailEventId + '/attenders/bulk-status', {
                ids: ids,
                status: action,
            })
            .then(function (res) {
                alert('Updated ' + (res.updated || 0) + ' candidate(s).');
                loadCandidates();
            })
            .catch(function (err) {
                alert('Bulk update failed: ' + (err.message || 'Unknown error'));
            });
        });

        // Add candidate.
        $tc.on('click', '#cand-btn-new', function () {
            showCandidateForm(null);
        });

        // Edit candidate.
        $tc.on('click', '.cand-act-edit', function () {
            var id = $(this).closest('tr').data('id');
            showCandidateForm(id);
        });

        // Delete candidate.
        $tc.on('click', '.cand-act-del', function () {
            var id = $(this).closest('tr').data('id');
            if (!confirm('Delete this candidate? This cannot be undone.')) return;
            api.del('events/' + detailEventId + '/attenders/' + id)
                .then(function () { loadCandidates(); })
                .catch(function (err) {
                    alert('Delete failed: ' + (err.message || 'Unknown error'));
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
            api.get('events/' + detailEventId + '/attenders/' + candidateId)
                .then(function (data) {
                    $('#cand-modal-body').html(buildCandidateFields(data));
                    bindCandidateFormEvents(overlay, candidateId);
                })
                .catch(function () {
                    $('#cand-modal-body').html('<p class="aioemp-error">Failed to load candidate.</p>');
                });
        } else {
            bindCandidateFormEvents(overlay, null);
        }
    }

    function buildCandidateFields(data) {
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
                        '<option value="accepted_onsite"' + (data.status === 'accepted_onsite' ? ' selected' : '') + '>Accepted (On-site)</option>' +
                        '<option value="accepted_online"' + (data.status === 'accepted_online' ? ' selected' : '') + '>Accepted (Online)</option>' +
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
                ? api.put('events/' + detailEventId + '/attenders/' + candidateId, body)
                : api.post('events/' + detailEventId + '/attenders', body);

            promise
                .then(function () {
                    overlay.remove();
                    // Refresh the candidates tab.
                    renderTabContent();
                })
                .catch(function (err) {
                    $msg.text(err.message || 'Save failed.').addClass('aioemp-form-status--err');
                    btn.prop('disabled', false);
                });
        });
    }

    /* ── Attendance Tab (placeholder) ── */

    function renderAttendanceTab($tc) {
        $tc.html(
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">Attendance</h3>' +
                '<p>QR scanning and attendance tracking — coming in Phase 8.</p>' +
            '</div>'
        );
    }

    /* ── Seating Tab (placeholder) ── */

    function renderSeatingTab($tc) {
        $tc.html(
            '<div class="aioemp-card">' +
                '<h3 class="aioemp-card__title">Seating Allocation</h3>' +
                '<p>Seat assignment dashboard — coming in Phase 6.</p>' +
            '</div>'
        );
    }

    /* ================================================================
     * ROUTE HANDLERS
     * ================================================================ */

    /**
     * Main events list route (#events).
     */
    function render($el) {
        activeTab = 'overview';
        renderEventsList($el);
    }

    /**
     * Single event detail route (#event/123).
     */
    function renderDetail_route($el) {
        var hash = location.hash.replace('#', '');
        var match = hash.match(/^event\/(\d+)$/);
        if (match) {
            activeTab = 'overview';
            showEventDetail(match[1]);
        } else {
            location.hash = '#events';
        }
    }

    /* ── Expose ── */
    window.aioemp_events = {
        render: render,
        renderDetail: renderDetail_route,
    };

})(jQuery);
