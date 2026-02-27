/**
 * AIOEMP Events — Seating Tab
 *
 * Full-screen seating allocation tool: SVG seatmap rendering,
 * assign / block / swap modes, multi-select drag, zoom & pan,
 * candidate list & search, batch operations, info popups.
 *
 * @package AIOEMP
 * @since   0.3.0
 */
(function ($, ctx) {
    'use strict';

    var api = ctx.api;
    var esc = ctx.esc;
    var ss  = ctx.seatingState;

    function renderSeatingTab($tc) {
        var d = ctx.detailEvent;

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

        ss.seats = seats;

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
                    '<div id="seat-stats" class="aioemp-seating-stats-bar"></div>' +
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
                                '<select id="seat-cand-filter" class="aioemp-input aioemp-input--sm aioemp-seating-cand-filter-select">' +
                                    '<option value="all">All</option>' +
                                    '<option value="unassigned">Unassigned</option>' +
                                    '<option value="assigned">Assigned</option>' +
                                    '<option value="checkedin" disabled>Checked In</option>' +
                                '</select>' +
                                '<input id="seat-cand-search" class="aioemp-input aioemp-input--sm" type="text" placeholder="Search name or email…">' +
                                '<div id="seat-cand-list" class="aioemp-seating-cand-list">' +
                                    '<p class="aioemp-loading">Loading…</p>' +
                                '</div>' +
                                '<div id="seat-cand-pagination" class="aioemp-seating-cand-pagination"></div>' +
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
                                    '<button id="seat-help-btn" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" title="Keyboard Shortcuts & Help">' +
                                        '<span class="dashicons dashicons-editor-help"></span>' +
                                    '</button>' +
                                '</div>' +
                                '<span class="aioemp-toolbar-spacer"></span>' +
                                '<span id="seat-pending-info" class="aioemp-pending-info" style="display:none"></span>' +
                                '<button id="seat-confirm-assign" class="aioemp-btn aioemp-btn--xs aioemp-btn--success" style="display:none"><span class="dashicons dashicons-yes"></span> Confirm Assignment</button>' +
                                '<button id="seat-unassign-selected" class="aioemp-btn aioemp-btn--xs aioemp-btn--danger" style="display:none"><span class="dashicons dashicons-no"></span> Unassign Selected</button>' +
                                '<span id="seat-block-info" class="aioemp-pending-info" style="display:none"></span>' +
                                '<button id="seat-confirm-block" class="aioemp-btn aioemp-btn--xs aioemp-btn--danger" style="display:none"><span class="dashicons dashicons-lock"></span> Block Selected</button>' +
                                '<button id="seat-confirm-unblock" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" style="display:none"><span class="dashicons dashicons-unlock" style=" height: 14px; width: 14px; font-size: 14px; "></span> Unblock Selected</button>' +
                                '<div class="aioemp-seating-zoom">' +
                                    '<button id="seat-zoom-out" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" title="Zoom out">−</button>' +
                                    '<span id="seat-zoom-level">100%</span>' +
                                    '<button id="seat-zoom-in" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" title="Zoom in">+</button>' +
                                    '<button id="seat-zoom-fit" class="aioemp-btn aioemp-btn--xs aioemp-btn--outline" title="Fit to view">Fit</button>' +
                                '</div>' +
                                '<div class="aioemp-seating-legend">' +
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

        // Close with Escape key + Cmd/Ctrl+D deselect all.
        $(document).on('keydown.seatingOverlay', function (e) {
            if (e.key === 'Escape') {
                // Close help modal first if open, otherwise close overlay
                // (but not if a different modal like candidate-info is open).
                if ($('.aioemp-help-modal-overlay').length) {
                    $('.aioemp-help-modal-overlay').remove();
                } else if (!e.target.closest('.aioemp-modal-overlay')) {
                    cleanupSeatingOverlay();
                }
            }
            // Cmd/Ctrl + D — deselect all.
            if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                clearPendingState();
                renderSeatmap(snapshot);
                updateInfoBar();
            }
        });

        function cleanupSeatingOverlay() {
            $overlay.remove();
            $(document).off('keydown.seatingOverlay');
            $(document).off('keydown.seatingPan keyup.seatingPan');
            $(document).off('mousemove.dragSelect mouseup.dragSelect');
            ctx.activeTab = 'overview';
            var $tabs = $('#evt-detail-wrap .aioemp-tab');
            $tabs.removeClass('is-active');
            $tabs.filter('[data-tab="overview"]').addClass('is-active');
            ctx.renderTabContent();
        }

        // Load seating data.
        loadSeatingData(snapshot);
        loadCandidateList('');

        // Bind events on the overlay.
        bindSeatingEvents($overlay, snapshot);
    }

    /* ── Data Loading ── */

    function loadSeatingData(snapshot) {
        api.get('events/' + ctx.detailEventId + '/seating')
            .then(function (res) {
                ss.assignments = res.assignments || [];
                ss.blocked = res.blocked || [];
                ss.isFinalized = !!res.is_finalized;

                // Build lookup maps.
                ss.assignMap = {};
                ss.attenderMap = {};
                (res.assignments || []).forEach(function (a) {
                    ss.assignMap[a.seat_key] = a;
                    ss.attenderMap[a.attender_id] = a.seat_key;
                });
                ss.blockedSet = {};
                (res.blocked || []).forEach(function (b) {
                    ss.blockedSet[b.seat_key] = true;
                });

                renderSeatmap(snapshot);
                updateSeatStats();
                renderCandidateListForSeating();
            })
            .catch(function () {
                $('#seat-canvas-wrap').html('<p class="aioemp-error">Failed to load seating data.</p>');
            });
    }

    /* ── SVG Rendering ── */

    function renderSeatmap(snapshot) {
        var seats = ss.seats;
        var bounds = snapshot.compiled && snapshot.compiled.bounds;
        var style = snapshot.style || snapshot;
        var seatRadius = snapshot.seatRadius || style.seatRadius || 10;
        var seatFill   = style.seatFill || '#4B49AC';
        var bgColor    = style.bgColor || '#ffffff';

        // Store seat style for pending highlight revert.
        ss.seatFill = seatFill;
        ss.seatStroke = style.seatStroke || '#3a389a';

        var canvasW = (snapshot.canvas && snapshot.canvas.w) || 0;
        var canvasH = (snapshot.canvas && snapshot.canvas.h) || 0;

        var minX, minY, maxX, maxY;
        if (canvasW && canvasH) {
            var cPad = 40;
            minX = -cPad; minY = -cPad;
            maxX = canvasW + cPad; maxY = canvasH + cPad;
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

        // Gray workspace background.
        var svgHtml = '<rect x="' + minX + '" y="' + minY + '" width="' + vbW + '" height="' + vbH + '" fill="#e8e8e8"/>';

        // Canvas area.
        if (canvasW && canvasH) {
            svgHtml += '<rect x="0" y="0" width="' + canvasW + '" height="' + canvasH +
                       '" fill="' + esc(bgColor) + '" rx="0" filter="url(#canvasShadow)"/>' +
                       '<defs><filter id="canvasShadow" x="-2%" y="-2%" width="104%" height="104%">' +
                       '<feDropShadow dx="2" dy="2" stdDeviation="4" flood-opacity="0.08"/></filter></defs>';
        } else {
            svgHtml += '<rect x="' + (minX + pad) + '" y="' + (minY + pad) + '" width="' + (vbW - pad * 2) + '" height="' + (vbH - pad * 2) + '" fill="' + esc(bgColor) + '"/>';
        }

        // Draw stages.
        if (snapshot.primitives) {
            snapshot.primitives.forEach(function (p) {
                if (p.type === 'stage') {
                    var tx = (p.transform && p.transform.x) || 0;
                    var ty = (p.transform && p.transform.y) || 0;
                    var pw = p.width || 100;
                    var ph = p.height || 40;
                    var rot = (p.transform && p.transform.rotation) || 0;
                    var transformAttr = rot ? ' transform="rotate(' + rot + ',' + (tx + pw / 2) + ',' + (ty + ph / 2) + ')"' : '';
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
                    var lRot = (p.transform && p.transform.rotation) || 0;
                    var lTransform = lRot ? ' transform="rotate(' + lRot + ',' + ltx + ',' + lty + ')"' : '';
                    svgHtml += '<text x="' + ltx + '" y="' + lty + '" font-size="' + (p.fontSize || 14) +
                               '" fill="' + esc(p.fontColor || '#333') + '" font-weight="' + (p.fontWeight || 'normal') + '"' +
                               lTransform + '>' +
                               esc(p.text || '') + '</text>';
                }
                if (p.type === 'obstacle') {
                    var otx = (p.transform && p.transform.x) || 0;
                    var oty = (p.transform && p.transform.y) || 0;
                    var ow = p.width || 40;
                    var oh = p.height || 40;
                    var oRot = (p.transform && p.transform.rotation) || 0;
                    var oTransform = oRot ? ' transform="rotate(' + oRot + ',' + (otx + ow / 2) + ',' + (oty + oh / 2) + ')"' : '';
                    var oRx = (typeof p.borderRadius === 'number') ? p.borderRadius : 2;
                    svgHtml += '<rect x="' + otx + '" y="' + oty + '" width="' + ow + '" height="' + oh +
                               '" fill="' + esc(p.color || '#ffcccc') + '" stroke="' + esc(p.borderColor || '#cc5555') + '" stroke-width="1" rx="' + oRx + '"' + oTransform + '/>';
                }
            });
        }

        // Draw row labels.
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
            var assignment = ss.assignMap[key];
            var isBlocked  = ss.blockedSet[key];
            var isPending  = (ss.pendingSeats || []).indexOf(key) >= 0;
            var isPendingBlock = (ss.pendingBlocks || []).indexOf(key) >= 0;

            var isSelectedAssigned = false;
            if (assignment && ss.selectedCandidates && ss.selectedCandidates.length) {
                var aId = parseInt(assignment.attender_id, 10);
                for (var si = 0; si < ss.selectedCandidates.length; si++) {
                    if (ss.selectedCandidates[si].id === aId) { isSelectedAssigned = true; break; }
                }
            }

            var fill, stroke, strokeW, cursor;
            var hasSystemColor = true;
            if (isPending) {
                fill = '#f59e0b'; stroke = '#ff9800'; strokeW = 3; cursor = 'pointer';
            } else if (isPendingBlock) {
                fill = '#ff6b6b'; stroke = '#e74c3c'; strokeW = 3; cursor = 'pointer';
            } else if (isSelectedAssigned) {
                fill = '#0ea5e9'; stroke = '#0284c7'; strokeW = 3; cursor = 'pointer';
            } else if (isBlocked) {
                fill = '#dc3545'; stroke = '#a71d2a'; strokeW = 1.5; cursor = 'pointer';
            } else if (assignment) {
                fill = '#28a745'; stroke = '#1e7e34'; strokeW = 1.5; cursor = 'pointer';
            } else {
                fill = seatFill; stroke = style.seatStroke || '#3a389a'; strokeW = 1; cursor = 'pointer';
                hasSystemColor = false;
            }

            svgHtml += '<circle cx="' + s.x + '" cy="' + s.y + '" r="' + r +
                       '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + strokeW +
                       '" class="seat-dot" data-key="' + esc(key) + '" style="cursor:' + cursor + '"/>';

            var label = s.number || '';
            if (label && r >= 8) {
                var fontSize = style.seatFontSize || 0;
                if (fontSize <= 0) fontSize = Math.max(6, r * 0.85);
                var labelColor = hasSystemColor ? '#ffffff' : (style.seatFontColor || '#ffffff');
                svgHtml += '<text x="' + s.x + '" y="' + s.y +
                           '" text-anchor="middle" dominant-baseline="central" font-size="' + fontSize +
                           '" fill="' + esc(labelColor) + '" font-weight="' + (style.seatFontWeight || 'bold') +
                           '" pointer-events="none" class="seat-label-text">' + esc(label) + '</text>';
            }

            if (isBlocked) {
                svgHtml += '<text x="' + s.x + '" y="' + s.y +
                           '" text-anchor="middle" dominant-baseline="central" font-size="' + (r * 1.2) +
                           '" fill="#fff" pointer-events="none" font-weight="bold">✕</text>';
            }
        });

        $svg[0].innerHTML = svgHtml;
    }

    /* ── Stats Bar ── */

    function updateSeatStats() {
        var total = ss.seats.length;
        var assigned = ss.assignments.length;
        var blocked = ss.blocked.length;
        var available = total - assigned - blocked;

        $('#seat-stats').html(
            '<span class="aioemp-stat-pill"><strong>' + total + '</strong> Total</span>' +
            '<span class="aioemp-stat-pill aioemp-stat-pill--assigned"><strong>' + assigned + '</strong> Assigned</span>' +
            '<span class="aioemp-stat-pill aioemp-stat-pill--blocked"><strong>' + blocked + '</strong> Blocked</span>' +
            '<span class="aioemp-stat-pill aioemp-stat-pill--available"><strong>' + available + '</strong> Available</span>'
        );
    }

    /* ── Candidate List ── */

    function loadCandidateList(searchTerm, page) {
        if (typeof page === 'number') ss.candPage = page;
        var pg = ss.candPage || 1;
        var pp = ss.candPerPage || 50;
        var qs = '?page=' + pg + '&per_page=' + pp + '&status=accepted_onsite';
        if (searchTerm) qs += '&search=' + encodeURIComponent(searchTerm);

        api.getWithHeaders('events/' + ctx.detailEventId + '/attenders' + qs)
            .then(function (resp) {
                var arr = Array.isArray(resp.data) ? resp.data : (resp.data && resp.data.data ? resp.data.data : []);
                ss.allCandidates = arr;
                ss.candTotal = resp.total || arr.length;
                ss.candTotalPages = resp.totalPages || 1;
                renderCandidateListForSeating();
                renderCandidatePagination();
            })
            .catch(function () {
                $('#seat-cand-list').html('<p class="aioemp-error">Failed to load candidates.</p>');
                $('#seat-cand-pagination').empty();
            });
    }

    function fetchSelectedCandidatesFull() {
        var ids = (ss.selectedCandidates || []).map(function (c) { return c.id; });
        if (!ids.length) return;
        api.get('events/' + ctx.detailEventId + '/attenders?ids=' + ids.join(','))
            .then(function (arr) {
                var data = Array.isArray(arr) ? arr : (arr && arr.data ? arr.data : []);
                ss.allCandidates = data;
                renderCandidateListForSeating();
                $('#seat-cand-pagination').empty();
            });
    }

    function renderCandidatePagination() {
        var pg = ss.candPage;
        var tp = ss.candTotalPages;
        var total = ss.candTotal;
        var $pag = $('#seat-cand-pagination');

        if (tp <= 1) { $pag.empty(); return; }

        var html = '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline seat-cand-page-prev"' +
            (pg <= 1 ? ' disabled' : '') + '>← Prev</button>' +
            '<span class="aioemp-pagination__info">Page ' + pg + ' / ' + tp +
            ' <span style="opacity:.6">(' + total + ' total)</span></span>' +
            '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--outline seat-cand-page-next"' +
            (pg >= tp ? ' disabled' : '') + '>Next →</button>';

        $pag.html(html);
    }

    function renderCandidateListForSeating() {
        var candidates = ss.allCandidates || [];

        if (ss.seatmapSelectedView) {
            var fullMap = {};
            (ss.allCandidates || []).forEach(function (c) { fullMap[c.id] = c; });
            candidates = (ss.selectedCandidates || []).map(function (sc) {
                if (fullMap[sc.id]) return fullMap[sc.id];
                var parts = (sc.name || '').split(' ');
                return { id: sc.id, first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '', email: sc.email || '' };
            });
        } else {
            var filter = ss.candidateFilter || 'all';
            if (filter === 'assigned') {
                candidates = candidates.filter(function (c) { return !!ss.attenderMap[c.id]; });
            } else if (filter === 'unassigned') {
                candidates = candidates.filter(function (c) { return !ss.attenderMap[c.id]; });
            }
        }

        if (!candidates.length) {
            $('#seat-cand-list').html('<p class="aioemp-empty" style="padding:8px 0">No candidates found.</p>');
            return;
        }

        var selIds = {};
        (ss.selectedCandidates || []).forEach(function (c) { selIds[c.id] = true; });

        var html = '';
        candidates.forEach(function (c) {
            var name = ((c.title ? c.title + ' ' : '') + (c.first_name || '') + ' ' + (c.last_name || '')).trim() || '(unnamed)';
            var hasSeat = ss.attenderMap[c.id];
            var cls = 'aioemp-seating-cand-item';
            if (selIds[c.id]) cls += ' is-selected';

            html += '<div class="' + cls + '" data-cand-id="' + c.id + '">' +
                '<div class="aioemp-seating-cand-row">' +
                    '<div class="aioemp-seating-cand-text">' +
                        '<div class="aioemp-seating-cand-name">' + esc(name) + '</div>' +
                        '<div class="aioemp-seating-cand-meta">' + esc(c.email || '') +
                            (hasSeat ? ' <span class="aioemp-badge aioemp-badge--success" style="font-size:10px">' + esc(seatLabel(hasSeat)) + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                    '<button type="button" class="aioemp-cand-info-btn" data-cand-id="' + c.id + '" title="View details">' +
                        '<span class="dashicons dashicons-info-outline"></span>' +
                    '</button>' +
                '</div>' +
            '</div>';
        });
        $('#seat-cand-list').html(html);
    }

    /* ── Event Bindings ── */

    function bindSeatingEvents($tc, snapshot) {
        // Mode switching — clear ALL selection state to avoid mixed toolbar buttons.
        $tc.on('click', '.seat-mode-btn', function () {
            var newMode = $(this).data('mode');
            if (newMode === ss.mode) return; // already active
            ss.mode = newMode;
            ss.swapFirst = null;
            clearPendingState();
            renderSeatmap(snapshot);
            $tc.find('.seat-mode-btn').removeClass('is-active aioemp-btn--primary').addClass('aioemp-btn--outline');
            $(this).addClass('is-active aioemp-btn--primary').removeClass('aioemp-btn--outline');
            updateInfoBar();
        });

        // Candidate filter dropdown.
        $tc.on('change', '#seat-cand-filter', function () {
            ss.candidateFilter = $(this).val();
            ss.candPage = 1;
            renderCandidateListForSeating();
            renderCandidatePagination();
        });

        // Candidate search.
        var searchTimer;
        $tc.on('input', '#seat-cand-search', function () {
            clearTimeout(searchTimer);
            var val = $(this).val();
            ss.candPage = 1;
            searchTimer = setTimeout(function () { loadCandidateList(val, 1); }, 300);
        });

        // Candidate pagination.
        $tc.on('click', '.seat-cand-page-prev', function () {
            if (ss.candPage > 1) {
                loadCandidateList($('#seat-cand-search').val() || '', ss.candPage - 1);
            }
        });
        $tc.on('click', '.seat-cand-page-next', function () {
            if (ss.candPage < ss.candTotalPages) {
                loadCandidateList($('#seat-cand-search').val() || '', ss.candPage + 1);
            }
        });

        // Select candidate (click = single; Shift+click = multi-toggle).
        // Bug fix: if in block mode with pending blocks, switch to assign mode first.
        $tc.on('click', '.aioemp-seating-cand-item', function (e) {
            // If in block/swap mode, switch to assign mode and clear block state.
            if (ss.mode !== 'assign') {
                // Clear pending blocks/seats visually.
                (ss.pendingBlocks || []).forEach(function (k) { highlightSeatPendingBlock(k, false); });
                (ss.pendingSeats || []).forEach(function (k) { highlightSeatPending(k, false); });
                ss.pendingBlocks = [];
                ss.pendingSeats = [];
                ss.swapFirst = null;
                ss.mode = 'assign';
                $tc.find('.seat-mode-btn').removeClass('is-active aioemp-btn--primary').addClass('aioemp-btn--outline');
                $tc.find('.seat-mode-btn[data-mode="assign"]').addClass('is-active aioemp-btn--primary').removeClass('aioemp-btn--outline');
                updateBlockUI();
                updatePendingUI();
            }

            var candId = parseInt($(this).data('cand-id'), 10);
            var $item = $(this);
            var name = $item.find('.aioemp-seating-cand-name').text();
            var email = $item.find('.aioemp-seating-cand-meta').text().split(' ')[0];
            var candidate = { id: candId, name: name, email: email };

            if (!ss.selectedCandidates) ss.selectedCandidates = [];

            if (e.shiftKey) {
                var idx = -1;
                for (var i = 0; i < ss.selectedCandidates.length; i++) {
                    if (ss.selectedCandidates[i].id === candId) { idx = i; break; }
                }
                if (idx >= 0) {
                    ss.selectedCandidates.splice(idx, 1);
                    $item.removeClass('is-selected');
                } else {
                    ss.selectedCandidates.push(candidate);
                    $item.addClass('is-selected');
                }
            } else {
                if (ss.selectedCandidates.length === 1 && ss.selectedCandidates[0].id === candId) {
                    ss.selectedCandidates = [];
                    $tc.find('.aioemp-seating-cand-item').removeClass('is-selected');
                } else {
                    ss.selectedCandidates = [candidate];
                    $tc.find('.aioemp-seating-cand-item').removeClass('is-selected');
                    $item.addClass('is-selected');
                }
            }

            ss.selectedCandidate = ss.selectedCandidates.length ? ss.selectedCandidates[0] : null;

            if (ss.selectedCandidates.length > 0) {
                $('#seat-deselect-all').show();
            } else {
                $('#seat-deselect-all').hide();
            }
            if (ss.seatmapSelectedView) {
                ss.seatmapSelectedView = false;
                loadCandidateList($('#seat-cand-search').val() || '');
            }
            updateSelectedCount();
            updateUnassignBtn();
            trimPendingSeats();
            updatePendingUI();
            updateInfoBar();
            updateSelectionHighlights();
        });

        // Info badge click.
        $tc.on('click', '.aioemp-cand-info-btn', function (e) {
            e.stopPropagation();
            var candId = parseInt($(this).data('cand-id'), 10);
            showCandidateInfoPopup(candId);
        });

        // Unselect all candidates.
        $tc.on('click', '#seat-deselect-all', function (e) {
            e.stopPropagation();
            clearPendingState();
            renderSeatmap(snapshot);
            updateInfoBar();
        });

        // Help button — show shortcuts & tutorial modal.
        $tc.on('click', '#seat-help-btn', function () {
            showHelpModal();
        });

        // Confirm batch assignment.
        $tc.on('click', '#seat-confirm-assign', function () {
            doBatchAssign(snapshot);
        });

        // Unassign all selected candidates that have seats.
        $tc.on('click', '#seat-unassign-selected', function () {
            doBatchUnassign(snapshot);
        });

        // Block all pending block seats.
        $tc.on('click', '#seat-confirm-block', function () {
            doBatchBlock(snapshot);
        });

        // Unblock all pending block seats.
        $tc.on('click', '#seat-confirm-unblock', function () {
            doBatchUnblock(snapshot);
        });

        // Click on seat.
        $tc.on('click', '.seat-dot', function (e) {
            var seatKey = $(this).data('key');
            handleSeatClick(seatKey, snapshot, e);
        });

        // Zoom controls.
        $tc.on('click', '#seat-zoom-in', function () { zoomAtCenter(0.2); });
        $tc.on('click', '#seat-zoom-out', function () { zoomAtCenter(-0.2); });
        $tc.on('click', '#seat-zoom-fit', function () { fitToView(); });

        // Mouse wheel zoom.
        $('#seat-canvas-wrap').on('wheel', function (e) {
            e.preventDefault();
            var delta = e.originalEvent.deltaY < 0 ? 0.1 : -0.1;
            zoomAtPoint(delta, e.originalEvent.clientX, e.originalEvent.clientY);
        });

        /* ── Space + Drag Pan ── */
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

            var dx = (e.clientX - panState.startX) * (vbW / wrapW);
            var dy = (e.clientY - panState.startY) * (vbH / wrapH);

            var newVBx = panState.startVBx - dx;
            var newVBy = panState.startVBy - dy;

            $svg.attr('viewBox', newVBx + ' ' + newVBy + ' ' + vbW + ' ' + vbH);
        });

        $(document).on('mouseup.seatingPan', function () {
            panState.active = false;
        });

        /* ── Drag Selection (marquee) ── */
        var dragSel = { active: false, startX: 0, startY: 0 };

        $('#seat-canvas-wrap').on('mousedown.dragSelect', function (e) {
            if (panState.spaceDown || e.button !== 0) return;
            if ($(e.target).hasClass('seat-dot')) return;
            if (ss.mode !== 'assign' && ss.mode !== 'block') return;

            dragSel.active = true;
            var offset = $('#seat-canvas-wrap').offset();
            dragSel.startX = e.clientX - offset.left;
            dragSel.startY = e.clientY - offset.top;

            if (!$('#seat-drag-rect').length) {
                $('#seat-canvas-wrap').append('<div id="seat-drag-rect" class="aioemp-drag-rect"></div>');
            }
            $('#seat-drag-rect').css({ left: dragSel.startX, top: dragSel.startY, width: 0, height: 0 }).show();
        });

        $(document).on('mousemove.dragSelect', function (e) {
            if (!dragSel.active) return;
            e.preventDefault();
            var offset = $('#seat-canvas-wrap').offset();
            var curX = e.clientX - offset.left;
            var curY = e.clientY - offset.top;
            var x = Math.min(dragSel.startX, curX);
            var y = Math.min(dragSel.startY, curY);
            var w = Math.abs(curX - dragSel.startX);
            var h = Math.abs(curY - dragSel.startY);
            $('#seat-drag-rect').css({ left: x, top: y, width: w, height: h });
        });

        $(document).on('mouseup.dragSelect', function (e) {
            if (!dragSel.active) return;
            dragSel.active = false;
            var $rect = $('#seat-drag-rect');
            var rLeft = parseFloat($rect.css('left'));
            var rTop = parseFloat($rect.css('top'));
            var rW = parseFloat($rect.css('width'));
            var rH = parseFloat($rect.css('height'));
            $rect.hide();

            if (rW < 5 && rH < 5) return;

            var wrapOffset = $('#seat-canvas-wrap').offset();
            var rectScreen = {
                left: wrapOffset.left + rLeft,
                top: wrapOffset.top + rTop,
                right: wrapOffset.left + rLeft + rW,
                bottom: wrapOffset.top + rTop + rH,
            };

            var seatsInRect = [];
            $('.seat-dot').each(function () {
                var bbox = this.getBoundingClientRect();
                var cx = (bbox.left + bbox.right) / 2;
                var cy = (bbox.top + bbox.bottom) / 2;
                if (cx >= rectScreen.left && cx <= rectScreen.right &&
                    cy >= rectScreen.top && cy <= rectScreen.bottom) {
                    seatsInRect.push($(this).data('key'));
                }
            });

            if (!seatsInRect.length) return;

            if (ss.mode === 'assign') {
                if (!e.shiftKey) {
                    clearPendingState();
                }
                var addedAny = false;
                seatsInRect.forEach(function (key) {
                    var assignment = ss.assignMap[key];
                    if (assignment) {
                        var candId = parseInt(assignment.attender_id, 10);
                        var found = false;
                        (ss.selectedCandidates || []).forEach(function (c) {
                            if (c.id === candId) found = true;
                        });
                        if (!found) {
                            selectCandidateById(candId, true);
                            addedAny = true;
                        }
                    }
                });
                if (addedAny) {
                    updateSelectedCount();
                    updateUnassignBtn();
                    updatePendingUI();
                    updateInfoBar();
                    updateSelectionHighlights();
                    renderCandidateListForSeating();
                    fetchSelectedCandidatesFull();
                }
            } else if (ss.mode === 'block') {
                if (!ss.pendingBlocks) ss.pendingBlocks = [];
                seatsInRect.forEach(function (key) {
                    if (ss.assignMap[key]) return;
                    if (ss.pendingBlocks.indexOf(key) < 0) {
                        ss.pendingBlocks.push(key);
                        highlightSeatPendingBlock(key, true);
                    }
                });
                updateBlockUI();
                updateInfoBar();
            }
        });

        updateInfoBar();
    }

    /* ── Seat Click Handler ── */

    function handleSeatClick(seatKey, snapshot, e) {
        var isAssigned = !!ss.assignMap[seatKey];
        var isBlocked  = !!ss.blockedSet[seatKey];
        var shiftKey = e && e.shiftKey;

        switch (ss.mode) {
            case 'assign':
                if (isBlocked) {
                    showSeatToast('This seat is blocked. Switch to Block mode to unblock.', 'warn');
                    return;
                }
                if (isAssigned) {
                    var a = ss.assignMap[seatKey];
                    var candId = parseInt(a.attender_id, 10);
                    if (shiftKey) {
                        selectCandidateById(candId, true);
                    } else {
                        selectCandidateById(candId, false);
                    }
                    return;
                }
                if (!ss.selectedCandidates || !ss.selectedCandidates.length) {
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
                if (!ss.swapFirst) {
                    ss.swapFirst = seatKey;
                    highlightSeat(seatKey, true);
                    showSeatToast('First seat selected: ' + seatLabel(seatKey) + '. Now click the second seat.', 'info');
                } else {
                    if (ss.swapFirst === seatKey) {
                        ss.swapFirst = null;
                        highlightSeat(seatKey, false);
                        showSeatToast('Swap cancelled.', 'info');
                        return;
                    }
                    doSwap(ss.swapFirst, seatKey, snapshot);
                    ss.swapFirst = null;
                }
                break;
        }
    }

    /* ── Helpers ── */

    function seatLabel(key) {
        for (var i = 0; i < ss.seats.length; i++) {
            if (ss.seats[i].seat_key === key) {
                var s = ss.seats[i];
                return (s.row || '') + (s.number || '') || key.substring(0, 8);
            }
        }
        return key.substring(0, 8);
    }

    /* ── Candidate Info Popup ── */

    function showCandidateInfoPopup(candId) {
        var cand = null;
        (ss.allCandidates || []).forEach(function (c) {
            if (c.id === candId) cand = c;
        });

        if (cand) {
            renderCandInfoPopup(cand);
        } else {
            api.get('events/' + ctx.detailEventId + '/attenders/' + candId)
                .then(function (resp) {
                    var data = resp && resp.data ? resp.data : resp;
                    if (data) renderCandInfoPopup(data);
                })
                .catch(function () {
                    showSeatToast('Could not load candidate details.', 'err');
                });
        }
    }

    function renderCandInfoPopup(c) {
        $('.aioemp-cand-info-overlay').remove();

        var name = ((c.title ? c.title + ' ' : '') + (c.first_name || '') + ' ' + (c.last_name || '')).trim() || '(unnamed)';
        var seatKey = ss.attenderMap[c.id];
        var seatText = seatKey ? seatLabel(seatKey) : '—';

        var statusMap = {
            'registered': 'Registered',
            'accepted_onsite': 'Accepted (On-site)',
            'accepted_online': 'Accepted (Online)',
            'rejected': 'Rejected',
        };
        var statusText = statusMap[c.status] || c.status || '—';

        var statusCls = '';
        if (c.status === 'accepted_onsite' || c.status === 'accepted_online') statusCls = 'aioemp-badge--success';
        else if (c.status === 'rejected') statusCls = 'aioemp-badge--danger';
        else statusCls = 'aioemp-badge--info';

        var html =
            '<div class="aioemp-cand-info-overlay">' +
                '<div class="aioemp-cand-info-popup">' +
                    '<div class="aioemp-cand-info-header">' +
                        '<h4>Candidate Details</h4>' +
                        '<button type="button" class="aioemp-cand-info-close">&times;</button>' +
                    '</div>' +
                    '<div class="aioemp-cand-info-body">' +
                        '<table class="aioemp-cand-info-table">' +
                            '<tr><th>Name</th><td>' + esc(name) + '</td></tr>' +
                            '<tr><th>Email</th><td>' + esc(c.email || '—') + '</td></tr>' +
                            '<tr><th>Company</th><td>' + esc(c.company || '—') + '</td></tr>' +
                            '<tr><th>Status</th><td><span class="aioemp-badge ' + statusCls + '">' + esc(statusText) + '</span></td></tr>' +
                            '<tr><th>Seat</th><td>' + (seatKey ? '<span class="aioemp-badge aioemp-badge--success">' + esc(seatText) + '</span>' : '—') + '</td></tr>' +
                            '<tr><th>Registered</th><td>' + esc(c.created_at_gmt || '—') + '</td></tr>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
            '</div>';

        $('body').append(html);

        $('.aioemp-cand-info-overlay').on('click', function (e) {
            if ($(e.target).hasClass('aioemp-cand-info-overlay') || $(e.target).hasClass('aioemp-cand-info-close')) {
                $('.aioemp-cand-info-overlay').remove();
            }
        });
    }

    /* ── Single Seat Operations ── */

    function doAssign(seatKey, attenderId, snapshot) {
        api.post('events/' + ctx.detailEventId + '/seating/assign', {
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
        api.post('events/' + ctx.detailEventId + '/seating/unassign', { seat_key: seatKey })
        .then(function () {
            showSeatToast('Seat unassigned.', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Unassign failed.', 'err');
        });
    }

    function doBlock(seatKey, snapshot) {
        api.post('events/' + ctx.detailEventId + '/seating/block', { seat_key: seatKey })
        .then(function () {
            showSeatToast('Seat blocked.', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Block failed.', 'err');
        });
    }

    function doUnblock(seatKey, snapshot) {
        api.post('events/' + ctx.detailEventId + '/seating/unblock', { seat_key: seatKey })
        .then(function () {
            showSeatToast('Seat unblocked.', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Unblock failed.', 'err');
        });
    }

    function doSwap(key1, key2, snapshot) {
        api.post('events/' + ctx.detailEventId + '/seating/swap', { seat_key1: key1, seat_key2: key2 })
        .then(function () {
            showSeatToast('Seats swapped!', 'ok');
            loadSeatingData(snapshot);
        })
        .catch(function (err) {
            showSeatToast(err.message || 'Swap failed.', 'err');
        });
    }

    /* ── Highlight Helpers ── */

    function highlightSeat(seatKey, on) {
        var $dot = $('.seat-dot[data-key="' + seatKey + '"]');
        if (on) {
            $dot.attr('stroke', '#ff9800').attr('stroke-width', '3');
        } else {
            $dot.attr('stroke', '#1e7e34').attr('stroke-width', '1.5');
        }
    }

    function highlightSeatPending(seatKey, on) {
        var $dot = $('.seat-dot[data-key="' + seatKey + '"]');
        if (on) {
            $dot.attr({ fill: '#f59e0b', stroke: '#ff9800', 'stroke-width': '3' });
        } else {
            $dot.attr({
                fill: ss.seatFill || '#4B49AC',
                stroke: ss.seatStroke || '#3a389a',
                'stroke-width': '1',
            });
        }
    }

    function highlightSeatPendingBlock(seatKey, on) {
        var $dot = $('.seat-dot[data-key="' + seatKey + '"]');
        if (on) {
            $dot.attr({ fill: '#ff6b6b', stroke: '#e74c3c', 'stroke-width': '3' });
        } else {
            $dot.attr({
                fill: ss.seatFill || '#4B49AC',
                stroke: ss.seatStroke || '#3a389a',
                'stroke-width': '1',
            });
        }
    }

    function highlightSeatSelection(seatKey, on) {
        var $dot = $('.seat-dot[data-key="' + seatKey + '"]');
        var $label = $dot.next('.seat-label-text');
        if (on) {
            $dot.attr({ fill: '#0ea5e9', stroke: '#0284c7', 'stroke-width': '3' });
            $label.attr('fill', '#ffffff');
        } else {
            $dot.attr({ fill: '#28a745', stroke: '#1e7e34', 'stroke-width': '1.5' });
            $label.attr('fill', '#ffffff');
        }
    }

    function updateSelectionHighlights() {
        $('.seat-dot[data-selected-highlight="1"]').each(function () {
            var k = $(this).data('key');
            highlightSeatSelection(k, false);
            $(this).removeAttr('data-selected-highlight');
        });
        (ss.selectedCandidates || []).forEach(function (c) {
            var seatKey = ss.attenderMap[c.id];
            if (seatKey) {
                highlightSeatSelection(seatKey, true);
                $('.seat-dot[data-key="' + seatKey + '"]').attr('data-selected-highlight', '1');
            }
        });
    }

    /* ── Info Bar & Toast ── */

    function updateInfoBar() {
        var msg = '';
        switch (ss.mode) {
            case 'assign':
                if (ss.selectedCandidates && ss.selectedCandidates.length > 0) {
                    var pLen = (ss.pendingSeats || []).length;
                    var cLen = ss.selectedCandidates.length;
                    var remaining = cLen - pLen;
                    if (remaining > 0) {
                        msg = 'Click <strong>' + remaining + '</strong> empty seat(s) to mark for <strong>' + cLen + '</strong> candidate(s). Click an assigned seat to select its candidate.';
                    } else {
                        msg = 'All <strong>' + cLen + '</strong> seat(s) marked. Click <strong>Confirm Assignment</strong> to assign.';
                    }
                } else {
                    msg = 'Select candidate(s) from the left panel, or click assigned seats to select candidates.';
                }
                break;
            case 'block':
                if (ss.pendingBlocks && ss.pendingBlocks.length) {
                    var hasEmpty = false, hasBlocked = false;
                    ss.pendingBlocks.forEach(function (k) {
                        if (ss.blockedSet[k]) { hasBlocked = true; } else { hasEmpty = true; }
                    });
                    if (hasEmpty && hasBlocked) {
                        msg = '<strong>' + ss.pendingBlocks.length + '</strong> seat(s) selected (mixed). Use <strong>Block</strong> or <strong>Unblock</strong> buttons. Drag to select more.';
                    } else if (hasBlocked) {
                        msg = '<strong>' + ss.pendingBlocks.length + '</strong> blocked seat(s) selected. Click <strong>Unblock Selected</strong>. Drag to select more.';
                    } else {
                        msg = '<strong>' + ss.pendingBlocks.length + '</strong> seat(s) selected. Click <strong>Block Selected</strong>. Drag to select more.';
                    }
                } else {
                    msg = 'Click an empty seat to block it. Click a blocked seat to unblock. Drag to select multiple seats.';
                }
                break;
            case 'swap':
                if (ss.swapFirst) {
                    msg = 'First seat selected: <strong>' + seatLabel(ss.swapFirst) + '</strong>. Click the second assigned seat to swap.';
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

    /* ── Block Selection UI ── */

    function updateBlockUI() {
        var pending = ss.pendingBlocks || [];
        if (pending.length > 0) {
            var labels = pending.map(function (k) { return seatLabel(k); }).join(', ');
            $('#seat-block-info').html(
                '<strong>' + pending.length + '</strong> seat(s): ' + esc(labels)
            ).show();

            var hasEmpty = false, hasBlocked = false;
            pending.forEach(function (k) {
                if (ss.blockedSet[k]) { hasBlocked = true; } else { hasEmpty = true; }
            });

            if (hasEmpty && hasBlocked) {
                $('#seat-confirm-block').show();
                $('#seat-confirm-unblock').show();
            } else if (hasBlocked) {
                $('#seat-confirm-block').hide();
                $('#seat-confirm-unblock').show();
            } else {
                $('#seat-confirm-block').show();
                $('#seat-confirm-unblock').hide();
            }
        } else {
            $('#seat-block-info').html('').hide();
            $('#seat-confirm-block').hide();
            $('#seat-confirm-unblock').hide();
        }
    }

    /* ── Batch Operations ── */

    function doBatchBlock(snapshot) {
        var pending = ss.pendingBlocks || [];
        var toBlock = pending.filter(function (k) { return !ss.blockedSet[k]; });
        if (!toBlock.length) return;

        $('#seat-confirm-block').prop('disabled', true).text('Blocking…');

        api.post('events/' + ctx.detailEventId + '/seating/block-batch', { seat_keys: toBlock })
            .then(function (res) {
                $('#seat-confirm-block')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-lock"></span> Block Selected');
                var blocked = (res.blocked || []).length;
                var failed = (res.failed || []).length;
                if (failed > 0) {
                    showSeatToast(blocked + ' blocked, ' + failed + ' failed.', 'err');
                } else {
                    showSeatToast(blocked + ' seat(s) blocked!', 'ok');
                }
                ss.pendingBlocks = [];
                updateBlockUI();
                loadSeatingData(snapshot);
            })
            .catch(function (err) {
                $('#seat-confirm-block')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-lock"></span> Block Selected');
                showSeatToast(err.message || 'Block failed.', 'err');
            });
    }

    function doBatchUnblock(snapshot) {
        var pending = ss.pendingBlocks || [];
        var toUnblock = pending.filter(function (k) { return !!ss.blockedSet[k]; });
        if (!toUnblock.length) return;

        $('#seat-confirm-unblock').prop('disabled', true).text('Unblocking…');

        api.post('events/' + ctx.detailEventId + '/seating/unblock-batch', { seat_keys: toUnblock })
            .then(function (res) {
                $('#seat-confirm-unblock')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-unlock" style=" height: 14px; width: 14px; font-size: 14px; "></span> Unblock Selected');
                var unblocked = (res.unblocked || []).length;
                var failed = (res.failed || []).length;
                if (failed > 0) {
                    showSeatToast(unblocked + ' unblocked, ' + failed + ' failed.', 'err');
                } else {
                    showSeatToast(unblocked + ' seat(s) unblocked!', 'ok');
                }
                ss.pendingBlocks = [];
                updateBlockUI();
                loadSeatingData(snapshot);
            })
            .catch(function (err) {
                $('#seat-confirm-unblock')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-unlock" style=" height: 14px; width: 14px; font-size: 14px; "></span> Unblock Selected');
                showSeatToast(err.message || 'Unblock failed.', 'err');
            });
    }

    /* ── Multi-seat Assignment Helpers ── */

    function togglePendingSeat(seatKey) {
        if (!ss.pendingSeats) ss.pendingSeats = [];
        var idx = ss.pendingSeats.indexOf(seatKey);
        if (idx >= 0) {
            ss.pendingSeats.splice(idx, 1);
            highlightSeatPending(seatKey, false);
        } else {
            var max = ss.selectedCandidates.length;
            if (ss.pendingSeats.length >= max) {
                showSeatToast('You have already selected ' + max + ' seat(s). Deselect a seat to choose another.', 'warn');
                return;
            }
            ss.pendingSeats.push(seatKey);
            highlightSeatPending(seatKey, true);
        }
        updatePendingUI();
        updateInfoBar();
    }

    function updatePendingUI() {
        var pending = ss.pendingSeats || [];
        var total = (ss.selectedCandidates || []).length;
        if (pending.length > 0) {
            var labels = pending.map(function (k) { return seatLabel(k); }).join(', ');
            $('#seat-pending-info').html(
                '<strong>' + pending.length + '/' + total + '</strong> seat(s): ' + esc(labels)
            ).show();
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

    function trimPendingSeats() {
        if (!ss.pendingSeats) ss.pendingSeats = [];
        var max = (ss.selectedCandidates || []).length;
        while (ss.pendingSeats.length > max) {
            var removed = ss.pendingSeats.pop();
            highlightSeatPending(removed, false);
        }
        if (max === 0 && ss.pendingSeats.length) {
            ss.pendingSeats.forEach(function (k) { highlightSeatPending(k, false); });
            ss.pendingSeats = [];
        }
    }

    function doBatchAssign(snapshot) {
        var pending = ss.pendingSeats || [];
        var candidates = ss.selectedCandidates || [];
        if (!pending.length || !candidates.length) return;

        var pairs = [];
        for (var i = 0; i < Math.min(pending.length, candidates.length); i++) {
            pairs.push({ attender_id: candidates[i].id, seat_key: pending[i] });
        }

        $('#seat-confirm-assign').prop('disabled', true).text('Assigning…');

        api.post('events/' + ctx.detailEventId + '/seating/assign-batch', { pairs: pairs })
            .then(function (resp) {
                var data = resp && resp.data ? resp.data : resp;
                var assigned = (data.assigned || []).length;
                var failed   = (data.failed || []).length;

                $('#seat-confirm-assign')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-yes"></span> Confirm Assignment');

                if (failed > 0) {
                    showSeatToast(assigned + ' assigned, ' + failed + ' failed.', 'err');
                } else {
                    showSeatToast(assigned + ' seat(s) assigned!', 'ok');
                }
                clearPendingState();
                loadSeatingData(snapshot);
            })
            .catch(function () {
                $('#seat-confirm-assign')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-yes"></span> Confirm Assignment');
                showSeatToast('Batch assign failed.', 'err');
            });
    }

    function showHelpModal() {
        // Remove any existing help modal.
        $('.aioemp-help-modal-overlay').remove();

        var isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        var modKey = isMac ? '⌘' : 'Ctrl';

        var shortcuts = [
            [modKey + ' + D', 'Deselect all seats & candidates'],
            ['Space + drag', 'Pan canvas'],
            ['Scroll wheel', 'Zoom in / out'],
            ['Escape', 'Close seating tool'],
            ['Click seat', 'Assign / Block / Swap (per mode)'],
            ['Drag select', 'Select multiple seats'],
            ['Shift + click', 'Multi-select candidates'],
        ];

        var rows = '';
        for (var i = 0; i < shortcuts.length; i++) {
            rows += '<tr style="border-bottom:1px solid #eee">' +
                '<td style="padding:5px 12px 5px 0;font-family:monospace;font-weight:600;white-space:nowrap">' + shortcuts[i][0] + '</td>' +
                '<td style="padding:5px 0;color:#555">' + shortcuts[i][1] + '</td>' +
                '</tr>';
        }

        var tutorialHtml =
            '<h4 style="margin:18px 0 8px;font-size:14px;font-weight:600">How to use</h4>' +
            '<ol style="margin:0;padding-left:20px;font-size:13px;color:#555;line-height:1.7">' +
                '<li><strong>Assign mode:</strong> Select candidate(s) from the left panel, then click empty seats to mark them. Click <em>Confirm Assignment</em> to save.</li>' +
                '<li><strong>Block mode:</strong> Drag-select or click seats to mark them blocked. Click <em>Block Selected</em> to confirm. Click a blocked seat to unblock.</li>' +
                '<li><strong>Swap mode:</strong> Click an assigned seat as source, then click another assigned seat to swap the two candidates.</li>' +
            '</ol>';

        var $modal = $(
            '<div class="aioemp-help-modal-overlay" style="position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center">' +
                '<div style="background:#fff;border-radius:10px;padding:24px 32px;min-width:340px;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,0.25);position:relative">' +
                    '<button class="aioemp-help-modal-close" style="position:absolute;top:10px;right:14px;background:none;border:none;font-size:20px;cursor:pointer;color:#666;line-height:1">&times;</button>' +
                    '<h3 style="margin:0 0 16px;font-size:16px;font-weight:600">Keyboard Shortcuts</h3>' +
                    '<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>' + rows + '</tbody></table>' +
                    tutorialHtml +
                '</div>' +
            '</div>'
        );

        $('body').append($modal);

        // Close on backdrop click.
        $modal.on('click', function (e) {
            if ($(e.target).hasClass('aioemp-help-modal-overlay')) $modal.remove();
        });
        // Close on × button.
        $modal.on('click', '.aioemp-help-modal-close', function () { $modal.remove(); });
    }

    function clearPendingState() {
        (ss.pendingSeats || []).forEach(function (k) { highlightSeatPending(k, false); });
        (ss.pendingBlocks || []).forEach(function (k) { highlightSeatPendingBlock(k, false); });
        ss.pendingSeats = [];
        ss.pendingBlocks = [];
        ss.selectedCandidates = [];
        ss.selectedCandidate = null;
        ss.seatmapSelectedView = false;
        $('.aioemp-seating-cand-item').removeClass('is-selected');
        $('#seat-deselect-all').hide();
        updateSelectionHighlights();
        updateSelectedCount();
        updateUnassignBtn();
        updatePendingUI();
        updateBlockUI();
        loadCandidateList($('#seat-cand-search').val() || '');
    }

    function selectCandidateById(candId, additive) {
        if (!ss.selectedCandidates) ss.selectedCandidates = [];

        var candidate = null;
        (ss.allCandidates || []).forEach(function (c) {
            if (c.id === candId) {
                var name = ((c.title ? c.title + ' ' : '') + (c.first_name || '') + ' ' + (c.last_name || '')).trim() || '(unnamed)';
                candidate = { id: c.id, name: name, email: c.email || '' };
            }
        });
        if (!candidate) {
            for (var k in ss.assignMap) {
                var a = ss.assignMap[k];
                if (parseInt(a.attender_id, 10) === candId) {
                    candidate = {
                        id: candId,
                        name: ((a.first_name || '') + ' ' + (a.last_name || '')).trim() || '(unnamed)',
                        email: a.email || '',
                    };
                    break;
                }
            }
        }
        if (!candidate) return;

        if (additive) {
            var idx = -1;
            for (var i = 0; i < ss.selectedCandidates.length; i++) {
                if (ss.selectedCandidates[i].id === candId) { idx = i; break; }
            }
            if (idx >= 0) {
                ss.selectedCandidates.splice(idx, 1);
            } else {
                ss.selectedCandidates.push(candidate);
            }
        } else {
            clearPendingState();
            if (ss.selectedCandidates.length === 1 && ss.selectedCandidates[0].id === candId) {
                ss.selectedCandidates = [];
            } else {
                ss.selectedCandidates = [candidate];
            }
        }

        ss.selectedCandidate = ss.selectedCandidates.length ? ss.selectedCandidates[0] : null;

        ss.seatmapSelectedView = ss.selectedCandidates.length > 0;

        if (ss.selectedCandidates.length > 0) {
            $('#seat-deselect-all').show();
        } else {
            $('#seat-deselect-all').hide();
        }
        updateSelectedCount();
        updateUnassignBtn();
        updatePendingUI();
        updateInfoBar();
        updateSelectionHighlights();
        renderCandidateListForSeating();
        if (ss.seatmapSelectedView) {
            fetchSelectedCandidatesFull();
        } else {
            loadCandidateList($('#seat-cand-search').val() || '');
        }
    }

    function updateUnassignBtn() {
        var hasSeated = false;
        (ss.selectedCandidates || []).forEach(function (c) {
            if (ss.attenderMap[c.id]) hasSeated = true;
        });
        if (hasSeated) {
            $('#seat-unassign-selected').show();
        } else {
            $('#seat-unassign-selected').hide();
        }
    }

    function doBatchUnassign(snapshot) {
        var toUnassign = [];
        (ss.selectedCandidates || []).forEach(function (c) {
            var seatKey = ss.attenderMap[c.id];
            if (seatKey) toUnassign.push(seatKey);
        });
        if (!toUnassign.length) return;

        $('#seat-unassign-selected').prop('disabled', true).text('Unassigning…');

        api.post('events/' + ctx.detailEventId + '/seating/unassign-batch', { seat_keys: toUnassign })
            .then(function (resp) {
                var data = resp && resp.data ? resp.data : resp;
                var unassigned = (data.unassigned || []).length;
                var failed = (data.failed || []).length;

                $('#seat-unassign-selected')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-no"></span> Unassign Selected');
                if (failed > 0) {
                    showSeatToast(unassigned + ' unassigned, ' + failed + ' failed.', 'err');
                } else {
                    showSeatToast(unassigned + ' seat(s) unassigned.', 'ok');
                }
                clearPendingState();
                loadSeatingData(snapshot);
            })
            .catch(function () {
                $('#seat-unassign-selected')
                    .prop('disabled', false)
                    .html('<span class="dashicons dashicons-no"></span> Unassign Selected');
                showSeatToast('Batch unassign failed.', 'err');
            });
    }

    function updateSelectedCount() {
        var n = (ss.selectedCandidates || []).length;
        if (n > 0) {
            $('#seat-selected-count').text(n + ' selected').show();
        } else {
            $('#seat-selected-count').hide();
        }
    }

    /* ── Zoom ── */

    function zoomAtPoint(delta, clientX, clientY) {
        var $svg = $('#seat-svg');
        var vb = $svg.data('vb');
        if (!vb) return;

        var oldScale = ss.svgScale;
        var newScale = Math.max(0.2, Math.min(5, oldScale + delta));
        if (newScale === oldScale) return;
        ss.svgScale = newScale;

        var vbStr = ($svg.attr('viewBox') || '0 0 100 100').split(/[\s,]+/);
        var vbX = parseFloat(vbStr[0]);
        var vbY = parseFloat(vbStr[1]);
        var vbW = parseFloat(vbStr[2]);
        var vbH = parseFloat(vbStr[3]);

        var newW = vb.w / newScale;
        var newH = vb.h / newScale;

        var svgEl = $svg[0];
        var rect = svgEl.getBoundingClientRect();
        var fracX = (clientX - rect.left) / rect.width;
        var fracY = (clientY - rect.top) / rect.height;

        var svgX = vbX + fracX * vbW;
        var svgY = vbY + fracY * vbH;

        var newVBx = svgX - fracX * newW;
        var newVBy = svgY - fracY * newH;

        $svg.attr('viewBox', newVBx + ' ' + newVBy + ' ' + newW + ' ' + newH);
        $('#seat-zoom-level').text(Math.round(newScale * 100) + '%');
    }

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

        ss.svgScale = 1;
        $svg.attr('viewBox', vb.minX + ' ' + vb.minY + ' ' + vb.w + ' ' + vb.h);
        $('#seat-zoom-level').text('100%');
    }

    /* ── Register on context ── */
    ctx.renderSeatingTab = renderSeatingTab;

})(jQuery, window.AIOEMP_Events);
