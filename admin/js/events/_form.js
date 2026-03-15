/**
 * AIOEMP Events — Event Create / Edit Form
 *
 * Full-page form for creating or editing a single event.
 *
 * @package AIOEMP
 * @since   0.3.0
 */
(function ($, ctx) {
    'use strict';

    var api = ctx.api;
    var esc = ctx.esc;
    var userCan = window.aioemp_userCan;

    function showEventForm(eventId) {
        /* Gate: only users with manage_events can access the form */
        if (!userCan('manage_events')) {
            ctx.goToHash(eventId ? 'event/' + eventId : 'events');
            return;
        }

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
                    '<input id="evt-f-start" class="aioemp-input" type="datetime-local" value="' + ctx.gmtToLocal(data.start_date_gmt) + '">' +
                '</div>' +
                '<div class="aioemp-form-group aioemp-form-group--half">' +
                    '<label class="aioemp-label">End Date/Time</label>' +
                    '<input id="evt-f-end" class="aioemp-input" type="datetime-local" value="' + ctx.gmtToLocal(data.end_date_gmt) + '">' +
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
        var integrityMap = {};

        api.get('seatmaps?status=publish')
            .then(function (res) {
                var items = Array.isArray(res) ? res : (res.data || []);
                var $sel = $('#evt-f-seatmap');
                items.forEach(function (sm) {
                    integrityMap[sm.id] = !!sm.integrity_pass;
                    if (sm.integrity_pass) {
                        var selected = eventId && sm.id == $('#evt-f-seatmap').data('current-id') ? ' selected' : '';
                        $sel.append('<option value="' + sm.id + '"' + selected + '>' + esc(sm.title) + '</option>');
                    }
                });
            })
            .catch(function () {});

        if (eventId) {
            api.get('events/' + eventId).then(function (data) {
                if (data.seatmap_id) {
                    $('#evt-f-seatmap').data('current-id', data.seatmap_id);
                    $('#evt-f-seatmap').val(data.seatmap_id);
                }
            }).catch(function () {});
        }

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
                start_date_gmt:   ctx.localToGmt($('#evt-f-start').val()),
                end_date_gmt:     ctx.localToGmt($('#evt-f-end').val()),
                capacity:         parseInt($('#evt-f-capacity').val(), 10) || null,
                location_name:    $('#evt-f-loc-name').val().trim(),
                location_address: $('#evt-f-loc-addr').val().trim(),
                cover_img_url:    $('#evt-f-cover').val().trim(),
                seatmap_id:       $('#evt-f-seatmap').val() || '',
            };

            if (!body.title) {
                $msg.text('Title is required.').addClass('aioemp-form-status--err');
                btn.prop('disabled', false);
                return;
            }

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
                    if (!eventId) {
                        eventId = res.id || (res.data && res.data.id);
                    }
                    setTimeout(function () {
                        $msg.text('').removeClass('aioemp-form-status--ok');
                    }, 3000);
                })
                .catch(function (err) {
                    $msg.text(err.message || 'Save failed.').addClass('aioemp-form-status--err');
                    btn.prop('disabled', false);
                });
        });

        $('#evt-f-cancel').on('click', function () {
            ctx.goToHash(eventId ? 'event/' + eventId : 'events');
        });

        $('.evt-form-back').on('click', function () {
            ctx.goToHash(eventId ? 'event/' + eventId : 'events');
        });
    }

    /* ── Register on context ── */
    ctx.showEventForm = showEventForm;

})(jQuery, window.AIOEMP_Events);
