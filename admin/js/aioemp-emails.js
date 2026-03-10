/**
 * AIOEMP Email Templates module.
 *
 * Renders the Email Templates page inside the SPA shell.
 * Lists all editable email templates with subject / body editor,
 * placeholder reference, reset-to-default, and preview (send test).
 *
 * @package AIOEMP
 * @since   0.5.0
 */
(function ($) {
    'use strict';

    const rest = window.aioemp_api;
    const modal = window.aioemp_modal;

    /* ------------------------------------------------------------------ *
     * State
     * ------------------------------------------------------------------ */
    let templates  = {};   // { type: { subject, body, label, placeholders } }
    let activeType = null; // currently edited template type

    /* ------------------------------------------------------------------ *
     * Render — called by the SPA router
     * ------------------------------------------------------------------ */
    function render($el) {
        $el.html(buildSkeleton());
        loadTemplates();
    }

    /* ------------------------------------------------------------------ *
     * Skeleton HTML
     * ------------------------------------------------------------------ */
    function buildSkeleton() {
        return (
            '<div class="aioemp-emails">' +
                '<div class="aioemp-emails__layout">' +

                    /* ── Left: template list ── */
                    '<div class="aioemp-emails__sidebar">' +
                        '<div class="aioemp-card">' +
                            '<h3 class="aioemp-card__title">Templates</h3>' +
                            '<ul class="aioemp-emails__list" id="aioemp-email-list"></ul>' +
                        '</div>' +
                    '</div>' +

                    /* ── Right: editor panel ── */
                    '<div class="aioemp-emails__editor" id="aioemp-email-editor">' +
                        '<div class="aioemp-card">' +
                            '<p class="aioemp-help" style="text-align:center;padding:32px 0;">' +
                                '<span class="dashicons dashicons-email-alt" style="font-size:48px;width:48px;height:48px;color:#ccc;display:block;margin:0 auto 12px;"></span>' +
                                'Select a template to edit' +
                            '</p>' +
                        '</div>' +
                    '</div>' +

                '</div>' +
            '</div>'
        );
    }

    /* ------------------------------------------------------------------ *
     * Load templates from REST API
     * ------------------------------------------------------------------ */
    function loadTemplates() {
        rest.get('email-templates').then(function (data) {
            templates = {};
            data.forEach(function (t) {
                templates[t.type] = t;
            });
            renderList();
        }).catch(function (err) {
            showToast('Failed to load email templates.', 'error');
            console.error('[AIOEMP Emails]', err);
        });
    }

    /* ------------------------------------------------------------------ *
     * Template list
     * ------------------------------------------------------------------ */
    function renderList() {
        var $list = $('#aioemp-email-list');
        $list.empty();

        var types = Object.keys(templates);
        types.forEach(function (type) {
            var t = templates[type];
            var activeClass = type === activeType ? ' is-active' : '';
            $list.append(
                '<li class="aioemp-emails__item' + activeClass + '" data-type="' + type + '">' +
                    '<span class="dashicons dashicons-email"></span>' +
                    '<span class="aioemp-emails__item-label">' + escHtml(t.label) + '</span>' +
                '</li>'
            );
        });

        // Click handler.
        $list.off('click', '.aioemp-emails__item').on('click', '.aioemp-emails__item', function () {
            var type = $(this).data('type');
            activeType = type;
            $list.find('.aioemp-emails__item').removeClass('is-active');
            $(this).addClass('is-active');
            renderEditor(type);
        });
    }

    /* ------------------------------------------------------------------ *
     * Template editor
     * ------------------------------------------------------------------ */
    function renderEditor(type) {
        var t = templates[type];
        if (!t) return;

        // Tear down any existing TinyMCE instance first.
        destroyBodyEditor();

        var placeholderChips = t.placeholders.map(function (p) {
            return '<span class="aioemp-emails__placeholder" data-placeholder="' + escAttr(p) + '" title="Click to insert">' + escHtml(p) + '</span>';
        }).join(' ');

        var html =
            '<div class="aioemp-card">' +
                '<div class="aioemp-emails__editor-header">' +
                    '<h3 class="aioemp-card__title">' + escHtml(t.label) + '</h3>' +
                    '<div class="aioemp-emails__editor-actions">' +
                        '<button type="button" class="aioemp-btn aioemp-btn--outline aioemp-btn--sm" id="aioemp-email-reset">' +
                            '<span class="dashicons dashicons-image-rotate"></span> Reset to Default' +
                        '</button>' +
                        '<button type="button" class="aioemp-btn aioemp-btn--outline aioemp-btn--sm" id="aioemp-email-preview">' +
                            '<span class="dashicons dashicons-visibility"></span> Send Test' +
                        '</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* Subject */
            '<div class="aioemp-card">' +
                '<div class="aioemp-form-group">' +
                    '<label class="aioemp-label" for="aioemp-email-subject">Subject Line</label>' +
                    '<input type="text" id="aioemp-email-subject" class="aioemp-input" value="' + escAttr(t.subject) + '">' +
                '</div>' +
            '</div>' +

            /* Body */
            '<div class="aioemp-card">' +
                '<div class="aioemp-form-group">' +
                    '<label class="aioemp-label">Email Body (HTML)</label>' +
                    '<div id="aioemp-email-body-wrap">' +
                        '<textarea id="aioemp-email-body" class="aioemp-input" rows="16">' + escHtml(t.body) + '</textarea>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            /* Placeholders reference */
            '<div class="aioemp-card">' +
                '<h4 class="aioemp-card__title" style="font-size:13px;">Available Placeholders</h4>' +
                '<p class="aioemp-help" style="margin-bottom:8px;">Click a placeholder to insert it at the cursor position in the body editor.</p>' +
                '<div class="aioemp-emails__placeholders">' + placeholderChips + '</div>' +
            '</div>' +

            /* Save button */
            '<div class="aioemp-emails__save-bar">' +
                '<button type="button" class="aioemp-btn aioemp-btn--primary" id="aioemp-email-save">' +
                    '<span class="dashicons dashicons-saved"></span> Save Template' +
                '</button>' +
            '</div>';

        $('#aioemp-email-editor').html(html);

        // Initialize TinyMCE on the body textarea.
        initBodyEditor(t.body);

        // Bind events.
        bindEditorEvents(type);
    }

    /* ------------------------------------------------------------------ *
     * TinyMCE initialisation helper
     * ------------------------------------------------------------------ */
    function destroyBodyEditor() {
        if (window.tinymce && tinymce.get('aioemp-email-body')) {
            tinymce.get('aioemp-email-body').remove();
        }
        // Also tear down any quicktags instance.
        if (window.QTags && QTags.instances['aioemp-email-body']) {
            delete QTags.instances['aioemp-email-body'];
        }
    }

    function initBodyEditor(content) {
        destroyBodyEditor();

        // wp.editor.initialize provides visual + text tabs out of the box.
        if (window.wp && wp.editor && typeof wp.editor.initialize === 'function') {
            wp.editor.initialize('aioemp-email-body', {
                tinymce: {
                    wpautop: false,
                    toolbar1: 'formatselect,bold,italic,underline,strikethrough,|,bullist,numlist,|,link,unlink,|,alignleft,aligncenter,alignright,|,forecolor,|,undo,redo,|,code',
                    toolbar2: '',
                    height: 350,
                    content_css: false,
                    valid_elements: '*[*]',
                    extended_valid_elements: '*[*]',
                    verify_html: false,
                    cleanup: false,
                },
                quicktags: true,
                mediaButtons: false,
            });
        }
    }

    /**
     * Get the current body content from either TinyMCE or the plain textarea.
     */
    function getBodyContent() {
        if (window.tinymce && tinymce.get('aioemp-email-body')) {
            // Ensure visual editor content is synced.
            tinymce.get('aioemp-email-body').save();
        }
        return $('#aioemp-email-body').val();
    }

    /* ------------------------------------------------------------------ *
     * Editor event handlers
     * ------------------------------------------------------------------ */
    function bindEditorEvents(type) {
        // Insert placeholder at cursor position (works with TinyMCE or plain textarea).
        $(document).off('click.aioemp-ph').on('click.aioemp-ph', '.aioemp-emails__placeholder', function () {
            var ph = $(this).data('placeholder');

            // If TinyMCE visual editor is active, insert there.
            var ed = window.tinymce && tinymce.get('aioemp-email-body');
            if (ed && !ed.isHidden()) {
                ed.insertContent(ph);
                ed.focus();
                return;
            }

            // Fallback: insert into plain textarea.
            var $ta = $('#aioemp-email-body');
            var ta  = $ta[0];
            if (!ta) return;

            var start = ta.selectionStart;
            var end   = ta.selectionEnd;
            var val   = ta.value;
            ta.value  = val.substring(0, start) + ph + val.substring(end);
            ta.selectionStart = ta.selectionEnd = start + ph.length;
            $ta.trigger('focus');
        });

        // Save template.
        $('#aioemp-email-save').off('click').on('click', function () {
            saveTemplate(type);
        });

        // Reset to default.
        $('#aioemp-email-reset').off('click').on('click', function () {
            modal.confirm('Reset this template to the default? Any customisations will be lost.', { title: 'Reset Template', variant: 'warning', confirmText: 'Reset' })
                .then(function (ok) {
                    if (!ok) return;
                    resetTemplate(type);
                });
        });

        // Send test email.
        $('#aioemp-email-preview').off('click').on('click', function () {
            promptPreview(type);
        });
    }

    /* ------------------------------------------------------------------ *
     * API actions
     * ------------------------------------------------------------------ */

    function saveTemplate(type) {
        var subject = $('#aioemp-email-subject').val();
        var body    = getBodyContent();

        var $btn = $('#aioemp-email-save');
        $btn.prop('disabled', true).html('<span class="dashicons dashicons-update spin"></span> Saving…');

        rest.put('email-templates/' + type, { subject: subject, body: body })
            .then(function (data) {
                // Update local cache.
                templates[type].subject = data.subject;
                templates[type].body    = data.body;
                showToast('Template saved successfully.');
            })
            .catch(function (err) {
                showToast(err.message || 'Failed to save template.', 'error');
            })
            .finally(function () {
                $btn.prop('disabled', false).html('<span class="dashicons dashicons-saved"></span> Save Template');
            });
    }

    function resetTemplate(type) {
        rest.post('email-templates/' + type + '/reset', {})
            .then(function (data) {
                templates[type].subject = data.subject;
                templates[type].body    = data.body;
                renderEditor(type);
                showToast('Template reset to default.');
            })
            .catch(function (err) {
                showToast(err.message || 'Failed to reset template.', 'error');
            });
    }

    function promptPreview(type) {
        var email = prompt('Send a test email to:', '');
        if (!email || !email.trim()) return;

        var $btn = $('#aioemp-email-preview');
        $btn.prop('disabled', true).html('<span class="dashicons dashicons-update spin"></span> Sending…');

        rest.post('email-templates/' + type + '/preview', { to: email.trim() })
            .then(function () {
                showToast('Test email sent to ' + email.trim());
            })
            .catch(function (err) {
                showToast(err.message || 'Failed to send test email.', 'error');
            })
            .finally(function () {
                $btn.prop('disabled', false).html('<span class="dashicons dashicons-visibility"></span> Send Test');
            });
    }

    /* ------------------------------------------------------------------ *
     * Toast notifications (reuse pattern from other modules)
     * ------------------------------------------------------------------ */
    function showToast(msg, type) {
        type = type || 'success';
        var cls = type === 'error' ? 'aioemp-toast--error' : 'aioemp-toast--success';
        var $toast = $('<div class="aioemp-toast ' + cls + '">' + escHtml(msg) + '</div>');
        $('body').append($toast);
        setTimeout(function () { $toast.addClass('is-visible'); }, 10);
        setTimeout(function () {
            $toast.removeClass('is-visible');
            setTimeout(function () { $toast.remove(); }, 300);
        }, 3500);
    }

    /* ------------------------------------------------------------------ *
     * Utility
     * ------------------------------------------------------------------ */
    var escHtml = window.aioemp_esc;

    function escAttr(s) {
        return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    /* ------------------------------------------------------------------ *
     * Expose to SPA router
     * ------------------------------------------------------------------ */
    window.aioemp_emails = { render: render };

})(jQuery);
