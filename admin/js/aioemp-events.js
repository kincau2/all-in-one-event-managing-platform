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

    /**
     * Navigate to a hash route, forcing hashchange even when
     * the target is the same as the current hash.
     */
    function goToHash(target) {
        var full = target.charAt(0) === '#' ? target : '#' + target;
        if (location.hash === full) {
            // Hash is already the same — trigger navigation manually.
            $(window).trigger('hashchange');
        } else {
            location.hash = full;
        }
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
                    '<th style="width:60px">Actions</th>' +
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

        var backLabel = eventId ? 'Back to Event' : 'Back to Events';

        var formHtml =
            '<button type="button" class="aioemp-topbar__btn-back evt-form-back" style="display:inline-flex;margin-bottom:12px;background:none;border:none;cursor:pointer">' +
                '<span class="dashicons dashicons-arrow-left-alt2"></span> ' + backLabel +
            '</button>' +
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
        // Track which seatmaps pass integrity for save-time validation.
        var integrityMap = {};

        // Load seatmaps into dropdown.
        api.get('seatmaps')
            .then(function (res) {
                var items = Array.isArray(res) ? res : (res.data || []);
                var $sel = $('#evt-f-seatmap');
                items.forEach(function (sm) {
                    integrityMap[sm.id] = !!sm.integrity_pass;
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

            // Enforce seatmap integrity check.
            if (body.seatmap_id && integrityMap[body.seatmap_id] === false) {
                $msg.text('Selected seatmap does not pass integrity check. Choose another or fix the seatmap first.')
                    .addClass('aioemp-form-status--err');
                btn.prop('disabled', false);
                return;
            }

            var promise = eventId
                ? api.put('events/' + eventId, body)
                : api.post('events', body);

            promise
                .then(function (res) {
                    $msg.text('Saved!').addClass('aioemp-form-status--ok');
                    btn.prop('disabled', false);

                    // Stay on the edit form so the user can save again.
                    // Update eventId for subsequent saves (covers create → first save).
                    if (!eventId) {
                        eventId = res.id || (res.data && res.data.id);
                    }

                    // Clear the status message after 3s.
                    setTimeout(function () {
                        $msg.text('').removeClass('aioemp-form-status--ok');
                    }, 3000);
                })
                .catch(function (err) {
                    $msg.text(err.message || 'Save failed.').addClass('aioemp-form-status--err');
                    btn.prop('disabled', false);
                });
        });

        // Cancel.
        $('#evt-f-cancel').on('click', function () {
            goToHash(eventId ? 'event/' + eventId : 'events');
        });

        // Back button.
        $('.evt-form-back').on('click', function () {
            goToHash(eventId ? 'event/' + eventId : 'events');
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
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Event Information</h3>' +
                    '<button id="evt-detail-edit" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                        '<span class="dashicons dashicons-edit"></span> Edit' +
                    '</button>' +
                '</div>' +
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

    /* ── Seating Tab ── */

    var seatingState = {
        assignments: [],        // { seat_key, attender_id, first_name, last_name, email, attender_status }
        blocked: [],            // { seat_key }
        seats: [],              // compiled seats from snapshot
        selectedCandidate: null,// single attender obj (first selected) for assign mode
        selectedCandidates: [], // array of selected attender objects (multi-select with SHIFT)
        pendingSeats: [],       // seat_keys marked for batch assignment (not yet confirmed)
        selectedSeat: null,     // seat_key currently highlighted
        isFinalized: false,
        assignMap: {},          // seat_key → assignment obj
        blockedSet: {},         // seat_key → true
        attenderMap: {},        // attender_id → seat_key
        svgScale: 1,
        svgOffsetX: 0,
        svgOffsetY: 0,
        mode: 'assign',        // 'assign' | 'block' | 'swap'
        swapFirst: null,        // seat_key for swap source
    };

    function renderSeatingTab($tc) {
        var d = detailEvent;

        if (!d.seatmap_layout_snapshot) {
            $tc.html(
                '<div class="aioemp-card">' +
                    '<h3 class="aioemp-card__title">Seating Allocation</h3>' +
                    '<p class="aioemp-empty">No seatmap assigned to this event. Edit the event and select a seatmap template.</p>' +
                '</div>'
            );
            return;
        }

        var snapshot;
        try {
            snapshot = typeof d.seatmap_layout_snapshot === 'string'
                ? JSON.parse(d.seatmap_layout_snapshot)
                : d.seatmap_layout_snapshot;
        } catch (e) {
            $tc.html('<div class="aioemp-card"><p class="aioemp-error">Invalid seatmap snapshot data.</p></div>');
            return;
        }

        // Compile primitives → seats + bounds on the client side.
        // The DB only stores raw primitives to keep payloads small.
        var compiled = window.aioemp_compileSnapshot
            ? window.aioemp_compileSnapshot(snapshot)
            : (snapshot.compiled || null);
        if (compiled) {
            snapshot.compiled = compiled;
        }

        var seats = (snapshot.compiled && snapshot.compiled.seats) || [];
        if (!seats.length) {
            $tc.html('<div class="aioemp-card"><p class="aioemp-empty">Seatmap snapshot has no seats.</p></div>');
            return;
        }

        seatingState.seats = seats;

        // Show a placeholder in the tab content.
        $tc.html('<p class="aioemp-loading">Opening seating tool…</p>');

        // Create full-screen overlay.
        $('.aioemp-seating-fullscreen').remove();

        var $overlay = $(
            '<div class="aioemp-seating-fullscreen">' +
                '<div class="aioemp-seating-fullscreen__header">' +
                    '<button class="aioemp-topbar__btn-back aioemp-seating-fullscreen__back">' +
                        '<span class="dashicons dashicons-arrow-left-alt2"></span> Back to Event' +
                    '</button>' +
                    '<h2 class="aioemp-seating-fullscreen__title">' + esc(d.title) + ' — Seating Allocation</h2>' +
                '</div>' +
                '<div class="aioemp-seating-fullscreen__body">' +
                    '<div class="aioemp-seating-dashboard">' +
                        /* Left panel: candidate search + list (full-height) */
                        '<div class="aioemp-seating-sidebar">' +
                            '<div class="aioemp-card aioemp-seating-sidebar__card aioemp-seating-sidebar__card--cands">' +
                                '<div class="aioemp-seating-cand-header">' +
                                    '<div><h4 class="aioemp-card__title" style="margin:0">Candidates</h4>' +
                                    '<span id="seat-selected-count" class="aioemp-selected-count" style="display:none"></span></div>' +
                                    '<button id="seat-deselect-all" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" style="display:none">Unselect all</button>' +
                                '</div>' +
                                '<input id="seat-cand-search" class="aioemp-input aioemp-input--sm" type="text" placeholder="Search name or email…">' +
                                '<div id="seat-cand-list" class="aioemp-seating-cand-list">' +
                                    '<p class="aioemp-loading">Loading…</p>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        /* Main seatmap canvas */
                        '<div class="aioemp-seating-main">' +
                            '<div class="aioemp-seating-toolbar">' +
                                '<div class="aioemp-seating-modes">' +
                                    '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--primary seat-mode-btn is-active" data-mode="assign">' +
                                        '<span class="dashicons dashicons-admin-users"></span> Assign' +
                                    '</button>' +
                                    '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline seat-mode-btn" data-mode="block">' +
                                        '<span class="dashicons dashicons-lock"></span> Block' +
                                    '</button>' +
                                    '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline seat-mode-btn" data-mode="swap">' +
                                        '<span class="dashicons dashicons-randomize"></span> Swap' +
                                    '</button>' +
                                '</div>' +
                                /* Seat stats in toolbar */
                                '<div id="seat-stats" class="aioemp-seating-stats-bar"></div>' +
                                '<span id="seat-pending-info" class="aioemp-pending-info" style="display:none"></span>' +
                                '<button id="seat-confirm-assign" class="aioemp-btn aioemp-btn--xs aioemp-btn--success" style="display:none"><span class="dashicons dashicons-yes"></span> Confirm Assignment</button>' +
                                '<div class="aioemp-seating-zoom">' +
                                    '<button id="seat-zoom-out" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" title="Zoom out">−</button>' +
                                    '<span id="seat-zoom-level">100%</span>' +
                                    '<button id="seat-zoom-in" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" title="Zoom in">+</button>' +
                                    '<button id="seat-zoom-fit" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" title="Fit to view">Fit</button>' +
                                '</div>' +
                                '<div class="aioemp-seating-legend">' +
                                    '<span class="aioemp-legend-item"><span class="aioemp-legend-dot aioemp-legend-dot--empty"></span> Empty</span>' +
                                    '<span class="aioemp-legend-item"><span class="aioemp-legend-dot aioemp-legend-dot--assigned"></span> Assigned</span>' +
                                    '<span class="aioemp-legend-item"><span class="aioemp-legend-dot aioemp-legend-dot--blocked"></span> Blocked</span>' +
                                    '<span class="aioemp-legend-item"><span class="aioemp-legend-dot aioemp-legend-dot--pending"></span> Pending</span>' +
                                '</div>' +
                            '</div>' +
                            '<div id="seat-canvas-wrap" class="aioemp-seating-canvas-wrap">' +
                                '<svg id="seat-svg" class="aioemp-seating-svg"></svg>' +
                            '</div>' +
                            '<div id="seat-info-bar" class="aioemp-seating-info-bar"></div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
            '</div>'
        );

        $('body').append($overlay);

        // Back button — close overlay.
        $overlay.on('click', '.aioemp-seating-fullscreen__back', function () {
            cleanupSeatingOverlay();
        });

        // Close with Escape key.
        $(document).on('keydown.seatingOverlay', function (e) {
            if (e.key === 'Escape' && !e.target.closest('.aioemp-modal-overlay')) {
                cleanupSeatingOverlay();
            }
        });

        function cleanupSeatingOverlay() {
            $overlay.remove();
            $(document).off('keydown.seatingOverlay');
            $(document).off('keydown.seatingPan keyup.seatingPan');
            // Re-render the tab content with a simple placeholder.
            activeTab = 'overview';
            var $tabs = $('#evt-detail-wrap .aioemp-tab');
            $tabs.removeClass('is-active');
            $tabs.filter('[data-tab="overview"]').addClass('is-active');
            renderTabContent();
        }

        // Load seating data.
        loadSeatingData(snapshot);
        loadCandidateList('');

        // Bind events on the overlay.
        bindSeatingEvents($overlay, snapshot);
    }

    function loadSeatingData(snapshot) {
        api.get('events/' + detailEventId + '/seating')
            .then(function (res) {
                seatingState.assignments = res.assignments || [];
                seatingState.blocked = res.blocked || [];
                seatingState.isFinalized = !!res.is_finalized;

                // Build lookup maps.
                seatingState.assignMap = {};
                seatingState.attenderMap = {};
                (res.assignments || []).forEach(function (a) {
                    seatingState.assignMap[a.seat_key] = a;
                    seatingState.attenderMap[a.attender_id] = a.seat_key;
                });
                seatingState.blockedSet = {};
                (res.blocked || []).forEach(function (b) {
                    seatingState.blockedSet[b.seat_key] = true;
                });

                renderSeatmap(snapshot);
                updateSeatStats();
                // Refresh candidate list so badges stay in sync.
                loadCandidateList($('#seat-cand-search').val() || '');
            })
            .catch(function () {
                $('#seat-canvas-wrap').html('<p class="aioemp-error">Failed to load seating data.</p>');
            });
    }

    function renderSeatmap(snapshot) {
        var seats = seatingState.seats;
        var bounds = snapshot.compiled && snapshot.compiled.bounds;
        var style = snapshot.style || snapshot;
        var seatRadius = snapshot.seatRadius || style.seatRadius || 10;
        var seatFill   = style.seatFill || '#4B49AC';
        var bgColor    = style.bgColor || '#ffffff';

        // Store seat style for pending highlight revert.
        seatingState.seatFill = seatFill;
        seatingState.seatStroke = style.seatStroke || '#3a389a';

        // Use canvas dimensions as the primary area; fall back to bounds.
        var canvasW = (snapshot.canvas && snapshot.canvas.w) || 0;
        var canvasH = (snapshot.canvas && snapshot.canvas.h) || 0;

        var minX, minY, maxX, maxY;
        if (canvasW && canvasH) {
            // Canvas defines the white drawing area (matches editor).
            // Pad slightly so the gray workspace is visible around it.
            var cPad = 40;
            minX = -cPad;
            minY = -cPad;
            maxX = canvasW + cPad;
            maxY = canvasH + cPad;
        } else if (bounds) {
            minX = bounds.minX; minY = bounds.minY;
            maxX = bounds.maxX; maxY = bounds.maxY;
        } else {
            minX = Infinity; minY = Infinity; maxX = -Infinity; maxY = -Infinity;
            seats.forEach(function (s) {
                var r = s.radius || seatRadius;
                if (s.x - r < minX) minX = s.x - r;
                if (s.y - r < minY) minY = s.y - r;
                if (s.x + r > maxX) maxX = s.x + r;
                if (s.y + r > maxY) maxY = s.y + r;
            });
        }

        var pad = seatRadius * 3;
        minX -= pad; minY -= pad; maxX += pad; maxY += pad;
        var vbW = maxX - minX;
        var vbH = maxY - minY;

        var $svg = $('#seat-svg');
        $svg.attr({
            viewBox: minX + ' ' + minY + ' ' + vbW + ' ' + vbH,
            preserveAspectRatio: 'xMidYMid meet',
        });
        $svg.data('vb', { minX: minX, minY: minY, w: vbW, h: vbH });

        // Gray workspace background (matches editor's #e8e8e8).
        var svgHtml = '<rect x="' + minX + '" y="' + minY + '" width="' + vbW + '" height="' + vbH + '" fill="#e8e8e8"/>';

        // Canvas area — white rectangle at (0,0) matching the editor's canvas.
        if (canvasW && canvasH) {
            svgHtml += '<rect x="0" y="0" width="' + canvasW + '" height="' + canvasH +
                       '" fill="' + esc(bgColor) + '" rx="0" filter="url(#canvasShadow)"/>' +
                       '<defs><filter id="canvasShadow" x="-2%" y="-2%" width="104%" height="104%">' +
                       '<feDropShadow dx="2" dy="2" stdDeviation="4" flood-opacity="0.08"/></filter></defs>';
        } else {
            svgHtml += '<rect x="' + (minX + pad) + '" y="' + (minY + pad) + '" width="' + (vbW - pad * 2) + '" height="' + (vbH - pad * 2) + '" fill="' + esc(bgColor) + '"/>';
        }

        // Draw stages (from primitives).
        if (snapshot.primitives) {
            snapshot.primitives.forEach(function (p) {
                if (p.type === 'stage') {
                    var tx = (p.transform && p.transform.x) || 0;
                    var ty = (p.transform && p.transform.y) || 0;
                    var pw = p.width || 100;
                    var ph = p.height || 40;
                    var rot = (p.transform && p.transform.rotation) || 0;
                    var transformAttr = rot ? ' transform="rotate(' + rot + ',' + (tx + pw / 2) + ',' + (ty + ph / 2) + ')"' : '';
                    // Stage with styling matching the seatmap editor.
                    svgHtml += '<rect x="' + tx + '" y="' + ty + '" width="' + pw + '" height="' + ph +
                               '" fill="#e0e0e0" stroke="#999" stroke-width="1" rx="4"' + transformAttr + '/>';
                    if (p.label) {
                        svgHtml += '<text x="' + (tx + pw / 2) + '" y="' + (ty + ph / 2) +
                                   '" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" fill="#444"' +
                                   transformAttr + '>' + esc(p.label) + '</text>';
                    }
                }
                if (p.type === 'label') {
                    var ltx = (p.transform && p.transform.x) || 0;
                    var lty = (p.transform && p.transform.y) || 0;
                    svgHtml += '<text x="' + ltx + '" y="' + lty + '" font-size="' + (p.fontSize || 14) +
                               '" fill="' + esc(p.fontColor || '#333') + '" font-weight="' + (p.fontWeight || 'normal') + '">' +
                               esc(p.text || '') + '</text>';
                }
                if (p.type === 'obstacle') {
                    var otx = (p.transform && p.transform.x) || 0;
                    var oty = (p.transform && p.transform.y) || 0;
                    svgHtml += '<rect x="' + otx + '" y="' + oty + '" width="' + (p.width || 40) + '" height="' + (p.height || 40) +
                               '" fill="' + esc(p.color || '#ffcccc') + '" stroke="' + esc(p.borderColor || '#cc5555') + '" stroke-width="1" rx="2"/>';
                }
            });
        }

        // Draw row labels from compiled.
        if (snapshot.compiled && snapshot.compiled.rowLabels) {
            snapshot.compiled.rowLabels.forEach(function (rl) {
                var rlFontSize  = style.rowFontSize  || 11;
                var rlFontColor = style.rowFontColor || '#666666';
                svgHtml += '<text x="' + rl.x + '" y="' + rl.y +
                           '" text-anchor="middle" dominant-baseline="central" font-size="' + rlFontSize +
                           '" fill="' + esc(rlFontColor) + '" font-weight="' + (style.rowFontWeight || 'bold') +
                           '" class="seat-row-label">' + esc(rl.row || '') + '</text>';
            });
        }

        // Draw seats.
        seats.forEach(function (s) {
            var r = s.radius || seatRadius;
            var key = s.seat_key;
            var assignment = seatingState.assignMap[key];
            var isBlocked  = seatingState.blockedSet[key];
            var isPending  = (seatingState.pendingSeats || []).indexOf(key) >= 0;

            var fill, stroke, strokeW, cursor;
            if (isPending) {
                fill = '#f59e0b'; stroke = '#ff9800'; strokeW = 3; cursor = 'pointer';
            } else if (isBlocked) {
                fill = '#dc3545'; stroke = '#a71d2a'; strokeW = 1.5; cursor = 'pointer';
            } else if (assignment) {
                fill = '#28a745'; stroke = '#1e7e34'; strokeW = 1.5; cursor = 'pointer';
            } else {
                fill = seatFill; stroke = style.seatStroke || '#3a389a'; strokeW = 1; cursor = 'pointer';
            }

            svgHtml += '<circle cx="' + s.x + '" cy="' + s.y + '" r="' + r +
                       '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + strokeW +
                       '" class="seat-dot" data-key="' + esc(key) + '" style="cursor:' + cursor + '"/>';

            // Seat label (number only — row label is shown separately).
            var label = s.number || '';
            if (label && r >= 8) {
                var fontSize = style.seatFontSize || 0;
                if (fontSize <= 0) fontSize = Math.max(6, r * 0.85);
                svgHtml += '<text x="' + s.x + '" y="' + s.y +
                           '" text-anchor="middle" dominant-baseline="central" font-size="' + fontSize +
                           '" fill="' + esc(style.seatFontColor || '#ffffff') + '" font-weight="' + (style.seatFontWeight || 'bold') +
                           '" pointer-events="none" class="seat-label-text">' + esc(label) + '</text>';
            }

            // Small icon overlays for assigned/blocked.
            if (assignment) {
                // Tiny user icon indicator.
                svgHtml += '<text x="' + s.x + '" y="' + (s.y + r + 8) +
                           '" text-anchor="middle" font-size="8" fill="#1e7e34" pointer-events="none" class="seat-assign-icon">●</text>';
            }
            if (isBlocked) {
                svgHtml += '<text x="' + s.x + '" y="' + s.y +
                           '" text-anchor="middle" dominant-baseline="central" font-size="' + (r * 1.2) +
                           '" fill="#fff" pointer-events="none" font-weight="bold">✕</text>';
            }
        });

        $svg[0].innerHTML = svgHtml;
    }

    function updateSeatStats() {
        var total = seatingState.seats.length;
        var assigned = seatingState.assignments.length;
        var blocked = seatingState.blocked.length;
        var available = total - assigned - blocked;

        $('#seat-stats').html(
            '<span class="aioemp-stat-pill"><strong>' + total + '</strong> Total</span>' +
            '<span class="aioemp-stat-pill aioemp-stat-pill--assigned"><strong>' + assigned + '</strong> Assigned</span>' +
            '<span class="aioemp-stat-pill aioemp-stat-pill--blocked"><strong>' + blocked + '</strong> Blocked</span>' +
            '<span class="aioemp-stat-pill aioemp-stat-pill--available"><strong>' + available + '</strong> Available</span>'
        );
    }

    function loadCandidateList(searchTerm) {
        var qs = '?per_page=50';
        if (searchTerm) qs += '&search=' + encodeURIComponent(searchTerm);
        // Only show accepted candidates (onsite/online) for seating assignment.
        // Actually show all candidates so admin can assign anyone.

        api.get('events/' + detailEventId + '/attenders' + qs)
            .then(function (items) {
                var arr = Array.isArray(items) ? items : (items.data || []);
                renderCandidateListForSeating(arr);
            })
            .catch(function () {
                $('#seat-cand-list').html('<p class="aioemp-error">Failed to load candidates.</p>');
            });
    }

    function renderCandidateListForSeating(candidates) {
        if (!candidates.length) {
            $('#seat-cand-list').html('<p class="aioemp-empty" style="padding:8px 0">No candidates found.</p>');
            return;
        }

        var selIds = {};
        (seatingState.selectedCandidates || []).forEach(function (c) { selIds[c.id] = true; });

        var html = '';
        candidates.forEach(function (c) {
            var name = ((c.title ? c.title + ' ' : '') + (c.first_name || '') + ' ' + (c.last_name || '')).trim() || '(unnamed)';
            var hasSeat = seatingState.attenderMap[c.id];
            var cls = 'aioemp-seating-cand-item';
            if (hasSeat) cls += ' is-assigned';
            if (selIds[c.id]) cls += ' is-selected';

            html += '<div class="' + cls + '" data-cand-id="' + c.id + '">' +
                '<div class="aioemp-seating-cand-name">' + esc(name) + '</div>' +
                '<div class="aioemp-seating-cand-meta">' + esc(c.email || '') +
                    (hasSeat ? ' <span class="aioemp-badge aioemp-badge--success" style="font-size:10px">' + esc(seatLabel(hasSeat)) + '</span>' : '') +
                '</div>' +
            '</div>';
        });
        $('#seat-cand-list').html(html);
    }

    function bindSeatingEvents($tc, snapshot) {
        // Mode switching.
        $tc.on('click', '.seat-mode-btn', function () {
            seatingState.mode = $(this).data('mode');
            seatingState.swapFirst = null;
            // Clear pending seats when leaving assign mode.
            if (seatingState.pendingSeats && seatingState.pendingSeats.length) {
                seatingState.pendingSeats = [];
                updatePendingUI();
                renderSeatmap(snapshot);
            }
            $tc.find('.seat-mode-btn').removeClass('is-active aioemp-btn--primary').addClass('aioemp-btn--outline');
            $(this).addClass('is-active aioemp-btn--primary').removeClass('aioemp-btn--outline');
            updateInfoBar();
        });

        // Candidate search.
        var searchTimer;
        $tc.on('input', '#seat-cand-search', function () {
            clearTimeout(searchTimer);
            var val = $(this).val();
            searchTimer = setTimeout(function () { loadCandidateList(val); }, 300);
        });

        // Select candidate (click = single; Shift+click = multi-toggle).
        $tc.on('click', '.aioemp-seating-cand-item', function (e) {
            var candId = parseInt($(this).data('cand-id'), 10);
            var $item = $(this);
            var name = $item.find('.aioemp-seating-cand-name').text();
            var email = $item.find('.aioemp-seating-cand-meta').text().split(' ')[0];
            var candidate = { id: candId, name: name, email: email };

            if (!seatingState.selectedCandidates) seatingState.selectedCandidates = [];

            if (e.shiftKey) {
                // Toggle this candidate in the multi-select array.
                var idx = -1;
                for (var i = 0; i < seatingState.selectedCandidates.length; i++) {
                    if (seatingState.selectedCandidates[i].id === candId) { idx = i; break; }
                }
                if (idx >= 0) {
                    seatingState.selectedCandidates.splice(idx, 1);
                    $item.removeClass('is-selected');
                } else {
                    seatingState.selectedCandidates.push(candidate);
                    $item.addClass('is-selected');
                }
            } else {
                // Single-click: if already the only selection, deselect.
                if (seatingState.selectedCandidates.length === 1 && seatingState.selectedCandidates[0].id === candId) {
                    seatingState.selectedCandidates = [];
                    $tc.find('.aioemp-seating-cand-item').removeClass('is-selected');
                } else {
                    seatingState.selectedCandidates = [candidate];
                    $tc.find('.aioemp-seating-cand-item').removeClass('is-selected');
                    $item.addClass('is-selected');
                }
            }

            // Keep legacy single-select reference for assign mode (first selected).
            seatingState.selectedCandidate = seatingState.selectedCandidates.length
                ? seatingState.selectedCandidates[0]
                : null;

            // Show / hide "Unselect all" button.
            if (seatingState.selectedCandidates.length > 0) {
                $('#seat-deselect-all').show();
            } else {
                $('#seat-deselect-all').hide();
            }
            updateSelectedCount();
            // Trim excess pending seats if candidates were removed.
            trimPendingSeats();
            updatePendingUI();
            updateInfoBar();
        });

        // Unselect all candidates.
        $tc.on('click', '#seat-deselect-all', function (e) {
            e.stopPropagation();
            clearPendingState();
            renderSeatmap(snapshot);
            updateInfoBar();
        });

        // Confirm batch assignment.
        $tc.on('click', '#seat-confirm-assign', function () {
            doBatchAssign(snapshot);
        });

        // Click on seat.
        $tc.on('click', '.seat-dot', function () {
            var seatKey = $(this).data('key');
            handleSeatClick(seatKey, snapshot);
        });

        // Zoom controls — zoom toward viewport center.
        $tc.on('click', '#seat-zoom-in', function () {
            zoomAtCenter(0.2);
        });
        $tc.on('click', '#seat-zoom-out', function () {
            zoomAtCenter(-0.2);
        });
        $tc.on('click', '#seat-zoom-fit', function () {
            fitToView();
        });

        // Mouse wheel zoom on the canvas — zoom toward cursor.
        $('#seat-canvas-wrap').on('wheel', function (e) {
            e.preventDefault();
            var delta = e.originalEvent.deltaY < 0 ? 0.1 : -0.1;
            zoomAtPoint(delta, e.originalEvent.clientX, e.originalEvent.clientY);
        });

        /* ── Space + Drag Pan ──
         * Hold Space, then left-drag to pan the SVG viewport.
         * Mirrors the seatmap editor's Konva-based panning. */
        var panState = { active: false, spaceDown: false, startX: 0, startY: 0, startVBx: 0, startVBy: 0 };

        $(document).on('keydown.seatingPan', function (e) {
            if (e.code === 'Space' && !e.repeat && !$(e.target).is('input,textarea,select')) {
                e.preventDefault();
                panState.spaceDown = true;
                $('#seat-canvas-wrap').addClass('is-panning');
            }
        });
        $(document).on('keyup.seatingPan', function (e) {
            if (e.code === 'Space') {
                panState.spaceDown = false;
                panState.active = false;
                $('#seat-canvas-wrap').removeClass('is-panning');
            }
        });

        $('#seat-canvas-wrap').on('mousedown.seatingPan', function (e) {
            if (!panState.spaceDown) return;
            e.preventDefault();
            panState.active = true;
            panState.startX = e.clientX;
            panState.startY = e.clientY;

            var $svg = $('#seat-svg');
            var vbStr = ($svg.attr('viewBox') || '0 0 100 100').split(/[\s,]+/);
            panState.startVBx = parseFloat(vbStr[0]);
            panState.startVBy = parseFloat(vbStr[1]);
        });

        $(document).on('mousemove.seatingPan', function (e) {
            if (!panState.active) return;
            e.preventDefault();

            var $svg = $('#seat-svg');
            var $wrap = $('#seat-canvas-wrap');
            var wrapW = $wrap.width();
            var wrapH = $wrap.height();

            var vbStr = ($svg.attr('viewBox') || '0 0 100 100').split(/[\s,]+/);
            var vbW = parseFloat(vbStr[2]);
            var vbH = parseFloat(vbStr[3]);

            // Convert pixel delta to viewBox units.
            var dx = (e.clientX - panState.startX) * (vbW / wrapW);
            var dy = (e.clientY - panState.startY) * (vbH / wrapH);

            var newVBx = panState.startVBx - dx;
            var newVBy = panState.startVBy - dy;

            $svg.attr('viewBox', newVBx + ' ' + newVBy + ' ' + vbW + ' ' + vbH);
        });

        $(document).on('mouseup.seatingPan', function () {
            panState.active = false;
        });

        updateInfoBar();
    }

    function handleSeatClick(seatKey, snapshot) {
        var isAssigned = !!seatingState.assignMap[seatKey];
        var isBlocked  = !!seatingState.blockedSet[seatKey];

        switch (seatingState.mode) {
            case 'assign':
                if (isBlocked) {
                    showSeatToast('This seat is blocked. Switch to Block mode to unblock.', 'warn');
                    return;
                }
                if (isAssigned) {
                    // Show context: who is assigned, offer unassign.
                    var a = seatingState.assignMap[seatKey];
                    var aName = ((a.first_name || '') + ' ' + (a.last_name || '')).trim() || '(unnamed)';
                    if (confirm('Seat ' + seatLabel(seatKey) + ' is assigned to ' + aName + '.\n\nUnassign this seat?')) {
                        doUnassign(seatKey, snapshot);
                    }
                    return;
                }
                // Empty seat — mark as pending for batch assignment.
                if (!seatingState.selectedCandidates || !seatingState.selectedCandidates.length) {
                    showSeatToast('Select a candidate from the left panel first.', 'info');
                    return;
                }
                togglePendingSeat(seatKey);
                break;

            case 'block':
                if (isAssigned) {
                    showSeatToast('Cannot block an assigned seat. Unassign it first.', 'warn');
                    return;
                }
                if (isBlocked) {
                    doUnblock(seatKey, snapshot);
                } else {
                    doBlock(seatKey, snapshot);
                }
                break;

            case 'swap':
                if (!isAssigned) {
                    showSeatToast('Swap requires two assigned seats. Click an assigned seat.', 'info');
                    return;
                }
                if (!seatingState.swapFirst) {
                    seatingState.swapFirst = seatKey;
                    highlightSeat(seatKey, true);
                    showSeatToast('First seat selected: ' + seatLabel(seatKey) + '. Now click the second seat.', 'info');
                } else {
                    if (seatingState.swapFirst === seatKey) {
                        seatingState.swapFirst = null;
                        highlightSeat(seatKey, false);
                        showSeatToast('Swap cancelled.', 'info');
                        return;
                    }
                    doSwap(seatingState.swapFirst, seatKey, snapshot);
                    seatingState.swapFirst = null;
                }
                break;
        }
    }

    function seatLabel(key) {
        for (var i = 0; i < seatingState.seats.length; i++) {
            if (seatingState.seats[i].seat_key === key) {
                var s = seatingState.seats[i];
                return (s.row || '') + (s.number || '') || key.substring(0, 8);
            }
        }
        return key.substring(0, 8);
    }

    function doAssign(seatKey, attenderId, snapshot) {
        api.post('events/' + detailEventId + '/seating/assign', {
            attender_id: attenderId,
            seat_key: seatKey,
        })
        .then(function () {
            showSeatToast('Seat assigned!', 'ok');
            clearPendingState();
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Assignment failed.', 'err');
        });
    }

    function doUnassign(seatKey, snapshot) {
        api.post('events/' + detailEventId + '/seating/unassign', {
            seat_key: seatKey,
        })
        .then(function () {
            showSeatToast('Seat unassigned.', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Unassign failed.', 'err');
        });
    }

    function doBlock(seatKey, snapshot) {
        api.post('events/' + detailEventId + '/seating/block', {
            seat_key: seatKey,
        })
        .then(function () {
            showSeatToast('Seat blocked.', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Block failed.', 'err');
        });
    }

    function doUnblock(seatKey, snapshot) {
        api.post('events/' + detailEventId + '/seating/unblock', {
            seat_key: seatKey,
        })
        .then(function () {
            showSeatToast('Seat unblocked.', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Unblock failed.', 'err');
        });
    }

    function doSwap(key1, key2, snapshot) {
        api.post('events/' + detailEventId + '/seating/swap', {
            seat_key1: key1,
            seat_key2: key2,
        })
        .then(function () {
            showSeatToast('Seats swapped!', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Swap failed.', 'err');
        });
    }

    function highlightSeat(seatKey, on) {
        var $dot = $('.seat-dot[data-key="' + seatKey + '"]');
        if (on) {
            $dot.attr('stroke', '#ff9800').attr('stroke-width', '3');
        } else {
            // Will be re-rendered on next data load.
            $dot.attr('stroke', '#1e7e34').attr('stroke-width', '1.5');
        }
    }

    function updateInfoBar() {
        var msg = '';
        switch (seatingState.mode) {
            case 'assign':
                if (seatingState.selectedCandidates && seatingState.selectedCandidates.length > 0) {
                    var pLen = (seatingState.pendingSeats || []).length;
                    var cLen = seatingState.selectedCandidates.length;
                    var remaining = cLen - pLen;
                    if (remaining > 0) {
                        msg = 'Click <strong>' + remaining + '</strong> empty seat(s) to mark for <strong>' + cLen + '</strong> candidate(s). Click an assigned seat to unassign.';
                    } else {
                        msg = 'All <strong>' + cLen + '</strong> seat(s) marked. Click <strong>Confirm Assignment</strong> to assign.';
                    }
                } else {
                    msg = 'Select candidate(s) from the left panel, then click empty seats to assign.';
                }
                break;
            case 'block':
                msg = 'Click an empty seat to block it. Click a blocked seat to unblock.';
                break;
            case 'swap':
                if (seatingState.swapFirst) {
                    msg = 'First seat selected: <strong>' + seatLabel(seatingState.swapFirst) + '</strong>. Click the second assigned seat to swap.';
                } else {
                    msg = 'Click the first assigned seat to begin swap.';
                }
                break;
        }
        $('#seat-info-bar').html(msg);
    }

    function showSeatToast(message, type) {
        var cls = type === 'ok' ? 'aioemp-form-status--ok' : type === 'err' ? 'aioemp-form-status--err' : '';
        var $bar = $('#seat-info-bar');
        $bar.html('<span class="' + cls + '">' + esc(message) + '</span>');
        if (type === 'ok' || type === 'info') {
            setTimeout(function () { updateInfoBar(); }, 2500);
        } else if (type === 'err') {
            setTimeout(function () { updateInfoBar(); }, 4000);
        }
    }

    /* ── Multi-seat assignment helpers ── */

    /**
     * Toggle a seat in the pending assignment list.
     */
    function togglePendingSeat(seatKey) {
        if (!seatingState.pendingSeats) seatingState.pendingSeats = [];
        var idx = seatingState.pendingSeats.indexOf(seatKey);
        if (idx >= 0) {
            // Remove from pending.
            seatingState.pendingSeats.splice(idx, 1);
            highlightSeatPending(seatKey, false);
        } else {
            // Check limit — cannot select more seats than candidates.
            var max = seatingState.selectedCandidates.length;
            if (seatingState.pendingSeats.length >= max) {
                showSeatToast('You have already selected ' + max + ' seat(s). Deselect a seat to choose another.', 'warn');
                return;
            }
            seatingState.pendingSeats.push(seatKey);
            highlightSeatPending(seatKey, true);
        }
        updatePendingUI();
        updateInfoBar();
    }

    /**
     * Visually mark/unmark a seat dot as pending (orange).
     */
    function highlightSeatPending(seatKey, on) {
        var $dot = $('.seat-dot[data-key="' + seatKey + '"]');
        if (on) {
            $dot.attr({ fill: '#f59e0b', stroke: '#ff9800', 'stroke-width': '3' });
        } else {
            $dot.attr({
                fill: seatingState.seatFill || '#4B49AC',
                stroke: seatingState.seatStroke || '#3a389a',
                'stroke-width': '1',
            });
        }
    }

    /**
     * Update the pending-info text and confirm button visibility in the toolbar.
     */
    function updatePendingUI() {
        var pending = seatingState.pendingSeats || [];
        var total = (seatingState.selectedCandidates || []).length;
        if (pending.length > 0) {
            var labels = pending.map(function (k) { return seatLabel(k); }).join(', ');
            $('#seat-pending-info').html(
                '<strong>' + pending.length + '/' + total + '</strong> seat(s): ' + esc(labels)
            ).show();
            // Show confirm only when all seats are selected.
            if (pending.length === total) {
                $('#seat-confirm-assign').show();
            } else {
                $('#seat-confirm-assign').hide();
            }
        } else {
            $('#seat-pending-info').html('').hide();
            $('#seat-confirm-assign').hide();
        }
    }

    /**
     * Trim pending seats if their count exceeds the number of selected candidates
     * (e.g. when a candidate is deselected).
     */
    function trimPendingSeats() {
        if (!seatingState.pendingSeats) seatingState.pendingSeats = [];
        var max = (seatingState.selectedCandidates || []).length;
        while (seatingState.pendingSeats.length > max) {
            var removed = seatingState.pendingSeats.pop();
            highlightSeatPending(removed, false);
        }
        // If no candidates, clear all pending.
        if (max === 0 && seatingState.pendingSeats.length) {
            seatingState.pendingSeats.forEach(function (k) { highlightSeatPending(k, false); });
            seatingState.pendingSeats = [];
        }
    }

    /**
     * Batch-assign pending seats to selected candidates.
     * candidates[0] → pendingSeats[0], candidates[1] → pendingSeats[1], …
     */
    function doBatchAssign(snapshot) {
        var pending = seatingState.pendingSeats || [];
        var candidates = seatingState.selectedCandidates || [];
        if (!pending.length || !candidates.length) return;

        var pairs = [];
        for (var i = 0; i < Math.min(pending.length, candidates.length); i++) {
            pairs.push({ attender_id: candidates[i].id, seat_key: pending[i] });
        }

        // Disable confirm button while processing.
        $('#seat-confirm-assign').prop('disabled', true).text('Assigning…');

        // Sequential API calls.
        var chain = Promise.resolve();
        var failCount = 0;
        pairs.forEach(function (pair) {
            chain = chain.then(function () {
                return api.post('events/' + detailEventId + '/seating/assign', pair)
                    .catch(function () { failCount++; });
            });
        });

        chain.then(function () {
            if (failCount > 0) {
                showSeatToast((pairs.length - failCount) + ' assigned, ' + failCount + ' failed.', 'err');
            } else {
                showSeatToast(pairs.length + ' seat(s) assigned!', 'ok');
            }
            clearPendingState();
            loadSeatingData(snapshot);
        });
    }

    /**
     * Clear all pending/selection state and reset UI.
     */
    function clearPendingState() {
        seatingState.pendingSeats = [];
        seatingState.selectedCandidates = [];
        seatingState.selectedCandidate = null;
        $('.aioemp-seating-cand-item').removeClass('is-selected');
        $('#seat-deselect-all').hide();
        updateSelectedCount();
        updatePendingUI();
    }

    /**
     * Show "N selected" count below the Candidates heading.
     */
    function updateSelectedCount() {
        var n = (seatingState.selectedCandidates || []).length;
        if (n > 0) {
            $('#seat-selected-count').text(n + ' selected').show();
        } else {
            $('#seat-selected-count').hide();
        }
    }

    /**
     * Zoom toward a specific screen point (mouse cursor).
     * Converts the screen point to SVG coordinates, scales the viewBox,
     * then re-centres so the SVG point under the cursor stays fixed.
     */
    function zoomAtPoint(delta, clientX, clientY) {
        var $svg = $('#seat-svg');
        var vb = $svg.data('vb');
        if (!vb) return;

        var oldScale = seatingState.svgScale;
        var newScale = Math.max(0.2, Math.min(5, oldScale + delta));
        if (newScale === oldScale) return;
        seatingState.svgScale = newScale;

        // Current viewBox.
        var vbStr = ($svg.attr('viewBox') || '0 0 100 100').split(/[\s,]+/);
        var vbX = parseFloat(vbStr[0]);
        var vbY = parseFloat(vbStr[1]);
        var vbW = parseFloat(vbStr[2]);
        var vbH = parseFloat(vbStr[3]);

        // New viewBox dimensions.
        var newW = vb.w / newScale;
        var newH = vb.h / newScale;

        // Screen position of cursor relative to the SVG element.
        var svgEl = $svg[0];
        var rect = svgEl.getBoundingClientRect();
        var fracX = (clientX - rect.left) / rect.width;
        var fracY = (clientY - rect.top) / rect.height;

        // SVG coordinate under cursor.
        var svgX = vbX + fracX * vbW;
        var svgY = vbY + fracY * vbH;

        // Keep svgX/svgY at the same fractional position in the new viewBox.
        var newVBx = svgX - fracX * newW;
        var newVBy = svgY - fracY * newH;

        $svg.attr('viewBox', newVBx + ' ' + newVBy + ' ' + newW + ' ' + newH);
        $('#seat-zoom-level').text(Math.round(newScale * 100) + '%');
    }

    /**
     * Zoom toward the center of the current viewport (for +/- buttons).
     */
    function zoomAtCenter(delta) {
        var $svg = $('#seat-svg');
        var svgEl = $svg[0];
        if (!svgEl) return;
        var rect = svgEl.getBoundingClientRect();
        zoomAtPoint(delta, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    function fitToView() {
        var $svg = $('#seat-svg');
        var vb = $svg.data('vb');
        if (!vb) return;

        seatingState.svgScale = 1;
        $svg.attr('viewBox', vb.minX + ' ' + vb.minY + ' ' + vb.w + ' ' + vb.h);
        $('#seat-zoom-level').text('100%');
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
