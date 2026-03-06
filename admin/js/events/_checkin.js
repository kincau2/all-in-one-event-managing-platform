/**
 * AIOEMP Events — Check-In Tab
 *
 * In-browser QR / barcode scanner for live attendance check-in / check-out.
 * Input methods:
 *   1. Camera scanner (html5-qrcode)
 *   2. HID hardware scanner (keyboard input via hidden text field)
 *   3. Manual search (name/email/hash lookup)
 *
 * The QR code contains a URL like https://domain.com/e-ticket/{hash}.
 * The scanner extracts the 64-char SHA-256 hash from the URL tail,
 * resolves it via the REST API, and presents a candidate popup for
 * confirmation before recording the check-in or check-out.
 *
 * Depends on: html5-qrcode vendor library (global Html5Qrcode class).
 *
 * @package AIOEMP
 * @since   0.8.0
 */
(function ($, ctx) {
    'use strict';

    var api     = ctx.api;
    var esc     = ctx.esc;
    var userCan = window.aioemp_userCan;

    /* ── Hash extraction helper ── */

    /**
     * Extract a 64-char hex hash from a QR code value.
     * Accepts:
     *   - Full URL:  https://domain.com/e-ticket/abc123…def
     *   - Raw hash:  abc123…def  (64 hex chars)
     *
     * @param {string} raw  Scanned value.
     * @return {string|null}  The hash (lowercase) or null.
     */
    function extractHash(raw) {
        if (!raw) return null;
        raw = raw.trim();
        // Try extracting from URL — last path segment that is 64 hex chars.
        var urlMatch = raw.match(/\/([a-f0-9]{64})\/?(?:\?.*)?$/i);
        if (urlMatch) return urlMatch[1].toLowerCase();
        // Try raw 64-char hex.
        var plainMatch = raw.match(/^([a-f0-9]{64})$/i);
        if (plainMatch) return plainMatch[1].toLowerCase();
        return null;
    }

    /* ── State ── */

    var scanner       = null;   // Html5Qrcode instance.
    var isCameraOn    = false;
    var scanDebounce  = null;   // timer to prevent rapid-fire scans.
    var recentPage    = 1;
    var RECENT_PER_PAGE = 20;
    var seatKeyToLabel = {};     // seat_key UUID → human label (e.g. "A-08")

    /**
     * Detect a short device model string from navigator.userAgent.
     */
    function detectDeviceModel() {
        try {
            var ua = navigator.userAgent || '';
            // iOS: iPhone, iPad, iPod
            var iosMatch = ua.match(/(iPhone|iPad|iPod)/i);
            if (iosMatch) return iosMatch[1];
            // Android device model: "Build/xxx" preceded by device name
            var androidMatch = ua.match(/;\s*([^;)]+)\s*Build\//i);
            if (androidMatch) return androidMatch[1].trim().substring(0, 50);
            // Desktop: extract browser + OS
            var parts = [];
            if (/Mac/i.test(ua)) parts.push('Mac');
            else if (/Windows/i.test(ua)) parts.push('Windows');
            else if (/Linux/i.test(ua)) parts.push('Linux');
            if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) parts.push('Chrome');
            else if (/Edg/i.test(ua)) parts.push('Edge');
            else if (/Firefox/i.test(ua)) parts.push('Firefox');
            else if (/Safari/i.test(ua)) parts.push('Safari');
            return parts.length ? parts.join(' / ') : 'Unknown';
        } catch (e) {
            return 'Unknown';
        }
    }

    /* ================================================================
     * renderCheckInTab — main entry point
     * ================================================================ */

    function renderCheckInTab($tc) {
        var html =
            '<div class="aioemp-checkin">' +

                /* ── Stats bar ── */
                '<div class="aioemp-checkin__stats" id="checkin-stats">' +
                    '<div class="aioemp-stat-card aioemp-stat-card--success">' +
                        '<div class="aioemp-stat-card__value" id="stat-checked-in">—</div>' +
                        '<div class="aioemp-stat-card__label">Checked In</div>' +
                    '</div>' +
                    '<div class="aioemp-stat-card aioemp-stat-card--info">' +
                        '<div class="aioemp-stat-card__value" id="stat-total-scans">—</div>' +
                        '<div class="aioemp-stat-card__label">Total Scans</div>' +
                    '</div>' +
                    '<div class="aioemp-stat-card aioemp-stat-card--primary">' +
                        '<div class="aioemp-stat-card__value" id="stat-accepted">—</div>' +
                        '<div class="aioemp-stat-card__label">Accepted</div>' +
                    '</div>' +
                '</div>' +

                /* ── Scanner section ── */
                '<div class="aioemp-card aioemp-checkin__scanner-card">' +
                    '<div class="aioemp-card__header">' +
                        '<h3 class="aioemp-card__title">' +
                            '<span class="dashicons dashicons-camera"></span> Scanner' +
                        '</h3>' +
                        '<div class="aioemp-checkin__scanner-controls">' +
                            '<button id="checkin-camera-toggle" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                                '<span class="dashicons dashicons-video-alt2"></span> Start Camera' +
                            '</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="aioemp-checkin__scanner-body">' +

                        /* Camera viewfinder */
                        '<div id="checkin-camera-container" class="aioemp-checkin__camera" style="display:none">' +
                            '<div id="checkin-camera-reader"></div>' +
                        '</div>' +

                        /* HID scanner / Manual input */
                        '<div class="aioemp-checkin__manual">' +
                            '<label class="aioemp-checkin__manual-label">Scan barcode or enter ticket hash / name / email:</label>' +
                            '<div class="aioemp-checkin__manual-row">' +
                                '<input type="text" id="checkin-manual-input" ' +
                                    'class="aioemp-input" ' +
                                    'placeholder="Scan or type here…" ' +
                                    'autocomplete="off" autofocus>' +
                                '<button id="checkin-manual-go" class="aioemp-btn aioemp-btn--primary">' +
                                    '<span class="dashicons dashicons-search"></span> Lookup' +
                                '</button>' +
                            '</div>' +
                        '</div>' +

                    '</div>' +
                '</div>' +

                /* ── Candidate popup (hidden by default) ── */
                '<div id="checkin-popup" class="aioemp-checkin__popup" style="display:none"></div>' +

                /* ── Recent scans feed ── */
                '<div class="aioemp-card aioemp-checkin__recent-card">' +
                    '<h3 class="aioemp-card__title">Recent Scans</h3>' +
                    '<div id="checkin-recent-feed" class="aioemp-checkin__recent-feed">' +
                        '<p class="aioemp-loading">Loading…</p>' +
                    '</div>' +
                    '<div id="checkin-recent-pagination" class="aioemp-pagination"></div>' +
                '</div>' +

            '</div>';

        $tc.html(html);

        // Load stats.
        loadStats();

        // Compile seatmap snapshot for seat label lookup.
        buildSeatLabelMap();

        // Load recent scans from API.
        recentPage = 1;
        loadRecentScans();

        // Bind events.
        bindEvents($tc);
    }

    /* ── Stats loader ── */

    function loadStats() {
        api.get('events/' + ctx.detailEventId + '/attendance/stats')
            .then(function (data) {
                $('#stat-checked-in').text(data.checked_in ?? 0);
                $('#stat-total-scans').text(data.total_scans ?? 0);
                var accepted = (data.accepted_onsite || 0) + (data.accepted_online || 0);
                $('#stat-accepted').text(accepted);
            })
            .catch(function () {
                $('#stat-checked-in, #stat-total-scans, #stat-accepted').text('?');
            });
    }

    /* ── Build seat label map from seatmap snapshot ── */

    function buildSeatLabelMap() {
        seatKeyToLabel = {};
        try {
            var snapshot = ctx.detailEvent && ctx.detailEvent.seatmap_layout_snapshot;
            if (!snapshot) return;
            var layout = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
            if (typeof window.aioemp_compileSnapshot !== 'function') return;
            var result = window.aioemp_compileSnapshot(layout);
            var seats = result && result.seats ? result.seats : [];
            for (var i = 0; i < seats.length; i++) {
                if (seats[i].seat_key && seats[i].label) {
                    seatKeyToLabel[seats[i].seat_key] = seats[i].label;
                }
            }
        } catch (e) {
            // Silently ignore — labels will fall back to seat_key.
        }
    }

    /**
     * Resolve a seat_key UUID to a human-readable label.
     */
    function seatLabel(seatKey) {
        if (!seatKey) return null;
        return seatKeyToLabel[seatKey] || seatKey;
    }

    /* ── Event binding ── */

    function bindEvents($tc) {
        // Remove any previously bound check-in events to prevent duplicates.
        $tc.off('.checkinTab');

        // Camera toggle.
        $tc.on('click.checkinTab', '#checkin-camera-toggle', function () {
            if (isCameraOn) {
                stopCamera();
            } else {
                startCamera();
            }
        });

        // Manual input — Enter key.
        $tc.on('keydown.checkinTab', '#checkin-manual-input', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                processManualInput();
            }
        });

        // Manual input — Lookup button.
        $tc.on('click.checkinTab', '#checkin-manual-go', function () {
            processManualInput();
        });

        // Popup actions (delegated).
        $tc.on('click.checkinTab', '#checkin-popup .checkin-action-in', function () {
            var id = $(this).data('id');
            recordScan(id, 'IN', false);
        });
        $tc.on('click.checkinTab', '#checkin-popup .checkin-action-out', function () {
            var id = $(this).data('id');
            recordScan(id, 'OUT', false);
        });
        $tc.on('click.checkinTab', '#checkin-popup .checkin-action-force-in', function () {
            var id = $(this).data('id');
            recordScan(id, 'IN', true);
        });
        $tc.on('click.checkinTab', '#checkin-popup .checkin-action-force-out', function () {
            var id = $(this).data('id');
            recordScan(id, 'OUT', true);
        });
        $tc.on('click.checkinTab', '#checkin-popup .checkin-popup-close', function () {
            hidePopup();
        });

        // Recent scans pagination.
        $tc.on('click.checkinTab', '.recent-page-prev', function () {
            if (recentPage > 1) { recentPage--; loadRecentScans(); }
        });
        $tc.on('click.checkinTab', '.recent-page-next', function () {
            recentPage++;
            loadRecentScans();
        });
    }

    /* ================================================================
     * CAMERA SCANNER
     * ================================================================ */

    function startCamera() {
        var $container = $('#checkin-camera-container');
        var $btn = $('#checkin-camera-toggle');

        if (typeof Html5Qrcode === 'undefined') {
            showFlash('error', 'Camera library not loaded. Please reload the page.');
            return;
        }

        $container.show();
        $btn.html('<span class="dashicons dashicons-no"></span> Stop Camera')
            .removeClass('aioemp-btn--primary').addClass('aioemp-btn--danger');

        scanner = new Html5Qrcode('checkin-camera-reader');

        scanner.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0,
            },
            onScanSuccess,
            function () { /* ignore scan failure */ }
        ).then(function () {
            isCameraOn = true;
        }).catch(function (err) {
            showFlash('error', 'Camera error: ' + (err.message || err));
            stopCamera();
        });
    }

    function stopCamera() {
        var $container = $('#checkin-camera-container');
        var $btn = $('#checkin-camera-toggle');

        if (scanner && isCameraOn) {
            scanner.stop()
                .then(function () { scanner.clear(); })
                .catch(function () { /* ignore */ });
        }
        scanner    = null;
        isCameraOn = false;

        $container.hide();
        $btn.html('<span class="dashicons dashicons-video-alt2"></span> Start Camera')
            .removeClass('aioemp-btn--danger').addClass('aioemp-btn--primary');
    }

    /**
     * Callback when a QR code is successfully decoded.
     *
     * @param {string} decodedText  Raw decoded text from QR.
     */
    function onScanSuccess(decodedText) {
        // Debounce — prevent processing the same code within 2s.
        if (scanDebounce) return;
        scanDebounce = setTimeout(function () { scanDebounce = null; }, 2000);

        var hash = extractHash(decodedText);
        if (!hash) {
            showFlash('warning', 'Unrecognised QR format.');
            return;
        }

        resolveTicket(hash);
    }

    /* ================================================================
     * MANUAL INPUT
     * ================================================================ */

    function processManualInput() {
        var $input = $('#checkin-manual-input');
        var raw    = $.trim($input.val());
        if (!raw) return;

        // Try extracting a hash first.
        var hash = extractHash(raw);
        if (hash) {
            $input.val('');
            resolveTicket(hash);
            return;
        }

        // Fallback: search by name/email via the attenders endpoint.
        searchAttenders(raw);
        $input.val('');
    }

    /* ================================================================
     * RESOLVE TICKET — call REST API
     * ================================================================ */

    function resolveTicket(hash) {
        showFlash('info', 'Resolving ticket…');

        api.post('events/' + ctx.detailEventId + '/resolve-ticket', { hash: hash })
            .then(function (data) {
                clearFlash();
                showPopup(data);
            })
            .catch(function (err) {
                showFlash('error', err.message || 'Ticket not found.');
            });
    }

    /* ================================================================
     * SEARCH ATTENDERS (manual fallback)
     * ================================================================ */

    function searchAttenders(query) {
        showFlash('info', 'Searching…');

        api.get('events/' + ctx.detailEventId + '/attenders?search=' + encodeURIComponent(query) + '&per_page=5')
            .then(function (items) {
                var arr = Array.isArray(items) ? items : (items.data || []);
                clearFlash();
                if (!arr.length) {
                    showFlash('warning', 'No attendees found for "' + esc(query) + '".');
                    return;
                }
                if (arr.length === 1) {
                    // Single result — show popup directly.
                    showPopupFromAttender(arr[0]);
                    return;
                }
                // Multiple results — show selection list.
                showSearchResults(arr);
            })
            .catch(function (err) {
                showFlash('error', err.message || 'Search failed.');
            });
    }

    function showSearchResults(arr) {
        var html =
            '<div class="aioemp-card aioemp-checkin__search-results">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Search Results</h3>' +
                    '<button class="aioemp-btn aioemp-btn--sm aioemp-btn--outline checkin-popup-close">×</button>' +
                '</div>' +
                '<div class="aioemp-checkin__search-list">';

        for (var i = 0; i < arr.length; i++) {
            var a = arr[i];
            html +=
                '<div class="aioemp-checkin__search-item" data-hash="' + esc(a.qrcode_hash || '') + '">' +
                    '<div class="aioemp-checkin__search-name">' + esc(a.first_name || '') + ' ' + esc(a.last_name || '') + '</div>' +
                    '<div class="aioemp-checkin__search-email">' + esc(a.email || '') + '</div>' +
                    '<span class="aioemp-badge aioemp-badge--' + badgeColor(a.status) + '">' + esc(a.status || '') + '</span>' +
                '</div>';
        }

        html += '</div></div>';

        var $popup = $('#checkin-popup');
        $popup.html(html).show();

        $popup.on('click', '.aioemp-checkin__search-item', function () {
            var hash = $(this).data('hash');
            if (hash) {
                $popup.hide();
                resolveTicket(hash);
            }
        });
    }

    function showPopupFromAttender(att) {
        // Re-resolve via hash if available, so we get latest scan info.
        if (att.qrcode_hash) {
            resolveTicket(att.qrcode_hash);
            return;
        }
        // Fallback — construct popup directly from list data (no last_scan info).
        showPopup({
            attender_id: att.id,
            first_name: att.first_name,
            last_name: att.last_name,
            email: att.email,
            company: att.company,
            status: att.status,
            seat_label: null,
            last_scan: null,
        });
    }

    /* ================================================================
     * CANDIDATE POPUP
     * ================================================================ */

    function showPopup(data) {
        var name  = esc((data.first_name || '') + ' ' + (data.last_name || '')).trim() || esc(data.email || 'Unknown');
        var isIn  = data.last_scan && data.last_scan.type === 'IN';
        var isAccepted = data.status && (data.status.indexOf('accepted') === 0);

        // Resolve seat label from seat_key.
        var displaySeat = data.seat_label ? seatLabel(data.seat_label) : null;

        // Determine check-in status.
        var checkinStatusHtml = '';
        if (isAccepted) {
            if (isIn || data.checked_in) {
                checkinStatusHtml =
                    '<div class="aioemp-checkin__status-banner aioemp-checkin__status-banner--in">' +
                        '<span class="dashicons dashicons-yes-alt"></span> CHECKED IN' +
                    '</div>';
            } else {
                checkinStatusHtml =
                    '<div class="aioemp-checkin__status-banner aioemp-checkin__status-banner--out">' +
                        '<span class="dashicons dashicons-marker"></span> NOT CHECKED IN' +
                    '</div>';
            }
        }

        var html =
            '<div class="aioemp-card aioemp-checkin__candidate-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Attendee Found</h3>' +
                    '<button class="aioemp-btn aioemp-btn--sm aioemp-btn--outline checkin-popup-close">×</button>' +
                '</div>' +
                checkinStatusHtml +
                '<div class="aioemp-checkin__candidate-info">' +
                    '<div class="aioemp-checkin__candidate-name">' + name + '</div>' +
                    (data.email ? '<div class="aioemp-checkin__candidate-email">' + esc(data.email) + '</div>' : '') +
                    (data.company ? '<div class="aioemp-checkin__candidate-company">' + esc(data.company) + '</div>' : '') +
                    '<div class="aioemp-checkin__candidate-meta">' +
                        '<span class="aioemp-badge aioemp-badge--' + badgeColor(data.status) + '">' + esc(data.status || '') + '</span>' +
                        (displaySeat ? ' <span class="aioemp-badge aioemp-badge--info">Seat: ' + esc(displaySeat) + '</span>' : '') +
                    '</div>' +
                    (data.last_scan
                        ? '<div class="aioemp-checkin__candidate-scan">' +
                              'Last scan: <strong>' + esc(data.last_scan.type) + '</strong> at ' + esc(data.last_scan.scanned_at) +
                          '</div>'
                        : '<div class="aioemp-checkin__candidate-scan">No previous scans</div>'
                    ) +
                '</div>';

        // Action buttons.
        if (!isAccepted) {
            html +=
                '<div class="aioemp-checkin__candidate-actions">' +
                    '<p class="aioemp-checkin__candidate-warning">' +
                        '<span class="dashicons dashicons-warning"></span> ' +
                        'This attendee has not been accepted (status: ' + esc(data.status) + '). Check-in is not allowed.' +
                    '</p>' +
                '</div>';
        } else if (isIn) {
            // Already checked in — primary action is CHECK OUT.
            html +=
                '<div class="aioemp-checkin__candidate-actions">' +
                    '<button class="aioemp-btn aioemp-btn--danger checkin-action-out" data-id="' + data.attender_id + '">' +
                        '<span class="dashicons dashicons-migrate"></span> Check Out' +
                    '</button>' +
                    '<button class="aioemp-btn aioemp-btn--outline aioemp-btn--sm checkin-action-force-in" data-id="' + data.attender_id + '">' +
                        'Force Check In Again' +
                    '</button>' +
                '</div>';
        } else {
            // Not checked in — primary action is CHECK IN.
            html +=
                '<div class="aioemp-checkin__candidate-actions">' +
                    '<button class="aioemp-btn aioemp-btn--success checkin-action-in" data-id="' + data.attender_id + '">' +
                        '<span class="dashicons dashicons-yes-alt"></span> Check In' +
                    '</button>' +
                    (data.last_scan
                        ? '<button class="aioemp-btn aioemp-btn--outline aioemp-btn--sm checkin-action-force-out" data-id="' + data.attender_id + '">' +
                              'Force Check Out' +
                          '</button>'
                        : '') +
                '</div>';
        }

        html += '</div>';

        $('#checkin-popup').html(html).show();

        // Play a sound / beep (optional).
        playBeep(isAccepted ? 'success' : 'error');
    }

    function hidePopup() {
        $('#checkin-popup').hide().empty();
    }

    /* ================================================================
     * RECORD SCAN
     * ================================================================ */

    function recordScan(attenderId, type, force) {
        var $popup = $('#checkin-popup');
        var $btns  = $popup.find('.aioemp-btn');
        $btns.prop('disabled', true);

        api.post('events/' + ctx.detailEventId + '/checkin', {
            attender_id: attenderId,
            type: type,
            force: force,
            device_id: detectDeviceModel(),
        })
        .then(function (data) {
            hidePopup();
            showFlash('success', data.message || (type === 'IN' ? 'Checked in!' : 'Checked out!'));
            addRecentScan(data);
            loadStats();

            // Refocus manual input.
            $('#checkin-manual-input').focus();
        })
        .catch(function (err) {
            $btns.prop('disabled', false);
            showFlash('error', err.message || 'Check-in failed.');
        });
    }

    /* ================================================================
     * RECENT SCANS FEED — loaded from attendance API
     * ================================================================ */

    function loadRecentScans() {
        var $feed = $('#checkin-recent-feed');
        var $pag  = $('#checkin-recent-pagination');
        $feed.html('<p class="aioemp-loading">Loading…</p>');

        var qs = '?page=' + recentPage + '&per_page=' + RECENT_PER_PAGE;

        api.get('events/' + ctx.detailEventId + '/attendance' + qs)
            .then(function (items) {
                var arr = Array.isArray(items) ? items : (items.data || []);
                renderRecentFeed(arr);
                renderRecentPagination($pag, arr.length);
            })
            .catch(function () {
                $feed.html('<p class="aioemp-error">Failed to load recent scans.</p>');
                $pag.empty();
            });
    }

    function addRecentScan(data) {
        // After recording a scan, reload the feed from API to stay in sync.
        recentPage = 1;
        loadRecentScans();
    }

    function renderRecentFeed(rows) {
        var $feed = $('#checkin-recent-feed');
        if (!rows.length) {
            $feed.html('<p class="aioemp-empty">No scans yet.</p>');
            return;
        }

        var html = '<table class="aioemp-table aioemp-table--compact">' +
                       '<thead><tr><th>Time</th><th>Name</th><th>Action</th></tr></thead>' +
                       '<tbody>';
        for (var i = 0; i < rows.length; i++) {
            var s = rows[i];
            var name = ((s.first_name || '') + ' ' + (s.last_name || '')).trim() || s.email || 'Unknown';
            var typeClass = s.type === 'IN' ? 'success' : 'danger';
            var timeStr = s.scanned_at_gmt ? formatScanTime(s.scanned_at_gmt) : '—';
            html +=
                '<tr>' +
                    '<td>' + esc(timeStr) + '</td>' +
                    '<td>' + esc(name) + '</td>' +
                    '<td><span class="aioemp-badge aioemp-badge--' + typeClass + '">' +
                        esc(s.type) +
                    '</span></td>' +
                '</tr>';
        }
        html += '</tbody></table>';
        $feed.html(html);
    }

    function renderRecentPagination($pag, count) {
        if (count < RECENT_PER_PAGE && recentPage <= 1) {
            $pag.empty();
            return;
        }
        var html =
            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline recent-page-prev"' +
                (recentPage <= 1 ? ' disabled' : '') + '>← Prev</button> ' +
            '<span class="aioemp-pagination__info">Page ' + recentPage + '</span> ' +
            (count >= RECENT_PER_PAGE
                ? '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline recent-page-next">Next →</button>'
                : '');
        $pag.html(html);
    }

    function formatScanTime(gmtStr) {
        if (!gmtStr) return '—';
        try {
            var d = new Date(gmtStr + (gmtStr.indexOf('Z') < 0 ? 'Z' : ''));
            return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) {
            return gmtStr;
        }
    }

    /* ================================================================
     * FLASH MESSAGES
     * ================================================================ */

    function showFlash(type, msg) {
        var iconMap = { success: 'yes-alt', error: 'dismiss', warning: 'warning', info: 'info' };
        var classMap = { success: 'success', error: 'danger', warning: 'warning', info: 'info' };
        var $container = $('.aioemp-checkin__scanner-body');

        // Remove existing flash.
        $container.find('.aioemp-checkin__flash').remove();

        var flash =
            '<div class="aioemp-checkin__flash aioemp-checkin__flash--' + (classMap[type] || 'info') + '">' +
                '<span class="dashicons dashicons-' + (iconMap[type] || 'info') + '"></span> ' +
                esc(msg) +
            '</div>';
        $container.prepend(flash);

        // Auto-remove after 5s (except errors).
        if (type !== 'error') {
            setTimeout(function () {
                $container.find('.aioemp-checkin__flash').fadeOut(300, function () { $(this).remove(); });
            }, 5000);
        }
    }

    function clearFlash() {
        $('.aioemp-checkin__flash').remove();
    }

    /* ================================================================
     * UTILITY HELPERS
     * ================================================================ */

    function badgeColor(status) {
        if (!status) return 'secondary';
        if (status.indexOf('accepted') === 0) return 'success';
        if (status === 'rejected') return 'danger';
        if (status === 'registered') return 'info';
        return 'secondary';
    }

    /**
     * Simple beep using Web Audio API.
     *
     * @param {string} tone  'success' or 'error'.
     */
    function playBeep(tone) {
        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            var actx = new AudioCtx();
            var osc  = actx.createOscillator();
            var gain = actx.createGain();
            osc.connect(gain);
            gain.connect(actx.destination);
            osc.frequency.value = tone === 'success' ? 880 : 440;
            gain.gain.value = 0.15;
            osc.start();
            osc.stop(actx.currentTime + 0.15);
        } catch (e) { /* ignore */ }
    }

    /* ── Clean up camera when leaving tab ── */

    var origRenderTabContent = ctx.renderTabContent;
    ctx.renderTabContent = function () {
        // If the camera is running and we're leaving the Check-In tab, stop it.
        if (isCameraOn && ctx.activeTab !== 'checkin') {
            stopCamera();
        }
        origRenderTabContent.apply(this, arguments);
    };

    /* ── Register on context ── */
    ctx.renderCheckInTab = renderCheckInTab;

})(jQuery, window.AIOEMP_Events);
