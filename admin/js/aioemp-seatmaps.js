/**
 * AIOEMP Seatmaps List Page
 *
 * jQuery module rendered when the user navigates to #seatmaps.
 * Provides CRUD list table (create, rename, duplicate, delete)
 * and launches the React seatmap editor on edit.
 *
 * @package AIOEMP
 * @since   0.1.0
 */
(function ($) {
    'use strict';

    const api = window.aioemp_api;

    /* ── HTML builders ── */

    function skeleton() {
        return (
            '<div class="aioemp-card">' +
                '<div class="aioemp-card__header">' +
                    '<h3 class="aioemp-card__title">Seatmap Templates</h3>' +
                    '<button id="sme-btn-new" class="aioemp-btn aioemp-btn--sm aioemp-btn--primary">' +
                        '<span class="dashicons dashicons-plus-alt2"></span> New Seatmap' +
                    '</button>' +
                '</div>' +
                '<div id="sme-list-wrap">' +
                    '<p class="aioemp-loading">Loading…</p>' +
                '</div>' +
            '</div>'
        );
    }

    function renderTable(rows) {
        if (!rows.length) {
            return '<p class="aioemp-empty">No seatmaps yet. Click <strong>New Seatmap</strong> to create one.</p>';
        }

        var html =
            '<table class="aioemp-table">' +
                '<thead><tr>' +
                    '<th>Name</th>' +
                    '<th>Status</th>' +
                    '<th>Updated</th>' +
                    '<th style="width:180px">Actions</th>' +
                '</tr></thead><tbody>';

        rows.forEach(function (r) {
            var date = r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '—';
            html +=
                '<tr data-id="' + r.id + '">' +
                    '<td class="sme-cell-name">' + esc(r.title || r.name || '') + '</td>' +
                    '<td><span class="aioemp-badge aioemp-badge--' + r.status + '">' + r.status + '</span></td>' +
                    '<td>' + date + '</td>' +
                    '<td>' +
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--primary sme-act-edit" title="Edit layout">' +
                            '<span class="dashicons dashicons-edit"></span>' +
                        '</button> ' +
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--secondary sme-act-dup" title="Duplicate">' +
                            '<span class="dashicons dashicons-admin-page"></span>' +
                        '</button> ' +
                        '<button class="aioemp-btn aioemp-btn--xs aioemp-btn--danger sme-act-del" title="Delete">' +
                            '<span class="dashicons dashicons-trash"></span>' +
                        '</button>' +
                    '</td>' +
                '</tr>';
        });

        html += '</tbody></table>';
        return html;
    }

    function esc(str) {
        var el = document.createElement('span');
        el.textContent = str || '';
        return el.innerHTML;
    }

    /* ── State ── */

    var $wrap;

    function loadList() {
        $wrap.html('<p class="aioemp-loading">Loading…</p>');
        api.get('seatmaps')
            .then(function (res) {
                var items = Array.isArray(res) ? res : (res.data || []);
                $wrap.html(renderTable(items));
            })
            .catch(function () {
                $wrap.html('<p class="aioemp-error">Failed to load seatmaps.</p>');
            });
    }

    /* ── Actions ── */

    function createSeatmap() {
        var name = prompt('Seatmap name:', 'Untitled Seatmap');
        if (!name) return;

        api.post('seatmaps', {
            title: name,
            layout: JSON.stringify({
                schemaVersion: 1,
                canvas: { w: 1200, h: 800 },
                primitives: [],
            }),
        })
        .then(function (res) {
            var id = res.id || (res.data && res.data.id);
            if (id) {
                openEditor(id);
            } else {
                loadList();
            }
        })
        .catch(function (err) {
            alert('Failed to create seatmap: ' + (err.message || 'Unknown error'));
        });
    }

    function duplicateSeatmap(id) {
        api.get('seatmaps/' + id)
            .then(function (res) {
                var data = res.data || res;
                return api.post('seatmaps', {
                    title: (data.title || 'Seatmap') + ' (Copy)',
                    layout: typeof data.layout === 'string'
                        ? data.layout
                        : JSON.stringify(data.layout || {}),
                });
            })
            .then(function () { loadList(); })
            .catch(function (err) {
                alert('Failed to duplicate: ' + (err.message || 'Unknown error'));
            });
    }

    function deleteSeatmap(id) {
        if (!confirm('Delete this seatmap? This cannot be undone.')) return;
        api.del('seatmaps/' + id)
            .then(function () { loadList(); })
            .catch(function (err) {
                alert('Failed to delete: ' + (err.message || 'Unknown error'));
            });
    }

    /* ── Editor bridge ── */

    /**
     * Open the React seatmap editor inside the admin content area.
     */
    function openEditor(seatmapId) {
        var $content = $('#aioemp-content');
        $content.empty();

        // Create a mount point for React
        var $mount = $('<div id="sme-editor-root" style="width:100%;height:100%"></div>');
        $content.append($mount);

        // Hide the topbar title, show editor chrome
        $('#aioemp-page-title').text('Seatmap Editor');

        if (window.aioemp_seatmap_editor && window.aioemp_seatmap_editor.mount) {
            window.aioemp_seatmap_editor.mount($mount[0], {
                seatmapId: parseInt(seatmapId, 10),
                onClose: function () {
                    closeEditor();
                },
            });
        } else {
            console.error('[aioemp-seatmaps] window.aioemp_seatmap_editor is', window.aioemp_seatmap_editor,
                '— Check browser console for script load errors.');
            $mount.html(
                '<div class="aioemp-card">' +
                    '<p>Seatmap editor is not loaded. Check browser console for errors.</p>' +
                '</div>'
            );
        }
    }

    function closeEditor() {
        var $mount = document.getElementById('sme-editor-root');
        if ($mount && window.aioemp_seatmap_editor) {
            window.aioemp_seatmap_editor.unmount($mount);
        }
        // Navigate back to seatmaps list
        location.hash = '#seatmaps';
    }

    /* ── Route handler ── */

    function render($el) {
        $el.html(skeleton());
        $wrap = $('#sme-list-wrap');

        // Create button
        $el.on('click', '#sme-btn-new', createSeatmap);

        // Table actions (delegated)
        $el.on('click', '.sme-act-edit', function () {
            var id = $(this).closest('tr').data('id');
            openEditor(id);
        });
        $el.on('click', '.sme-act-dup', function () {
            var id = $(this).closest('tr').data('id');
            duplicateSeatmap(id);
        });
        $el.on('click', '.sme-act-del', function () {
            var id = $(this).closest('tr').data('id');
            deleteSeatmap(id);
        });

        loadList();
    }

    /* ── Also handle #seatmap-edit/{id} route ── */

    function renderEdit($el) {
        // Extract seatmap ID from hash
        var hash = location.hash.replace('#', '');
        var match = hash.match(/^seatmap-edit\/(\d+)$/);
        if (match) {
            openEditor(match[1]);
        } else {
            location.hash = '#seatmaps';
        }
    }

    /* ── Expose ── */
    window.aioemp_seatmaps = {
        render: render,
        renderEdit: renderEdit,
        openEditor: openEditor,
        closeEditor: closeEditor,
    };

})(jQuery);
