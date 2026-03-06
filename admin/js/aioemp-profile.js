/**
 * AIOEMP Profile module.
 *
 * Renders the Profile Settings page inside the SPA shell
 * and handles load / save via the REST API.
 *
 * @package AIOEMP
 * @since   0.1.0
 */
(function ($) {
    'use strict';

    const rest = window.aioemp_api;

    /* ------------------------------------------------------------------ *
     * Render
     * ------------------------------------------------------------------ */

    function render($el) {
        $el.html(
            '<div class="aioemp-profile">' +
                '<div class="aioemp-card">' +
                    '<div id="aioemp-profile-msg"></div>' +
                    '<div class="aioemp-profile__header">' +
                        '<span class="aioemp-profile__avatar" id="aioemp-profile-avatar"></span>' +
                        '<div class="aioemp-profile__meta">' +
                            '<h3 id="aioemp-profile-display"></h3>' +
                            '<p id="aioemp-profile-email"></p>' +
                        '</div>' +
                    '</div>' +
                    '<form id="aioemp-profile-form" class="aioemp-profile__form" autocomplete="off">' +
                        '<div class="aioemp-profile__row">' +
                            '<div class="aioemp-profile__field">' +
                                '<label for="aioemp-prof-fname">First Name</label>' +
                                '<input type="text" id="aioemp-prof-fname" class="aioemp-input" />' +
                            '</div>' +
                            '<div class="aioemp-profile__field">' +
                                '<label for="aioemp-prof-lname">Last Name</label>' +
                                '<input type="text" id="aioemp-prof-lname" class="aioemp-input" />' +
                            '</div>' +
                        '</div>' +
                        '<div class="aioemp-profile__field">' +
                            '<label for="aioemp-prof-display">Display Name</label>' +
                            '<input type="text" id="aioemp-prof-display" class="aioemp-input" />' +
                        '</div>' +
                        '<hr class="aioemp-profile__separator" />' +
                        '<p class="aioemp-profile__pw-hint">Leave blank to keep your current password.</p>' +
                        '<div class="aioemp-profile__row">' +
                            '<div class="aioemp-profile__field">' +
                                '<label for="aioemp-prof-pw">New Password</label>' +
                                '<div class="aioemp-pw-wrap">' +
                                    '<input type="password" id="aioemp-prof-pw" class="aioemp-input" autocomplete="new-password" />' +
                                    '<button type="button" class="aioemp-pw-toggle" aria-label="Show password" tabindex="-1" data-target="aioemp-prof-pw">' +
                                        '<span class="dashicons dashicons-visibility"></span>' +
                                    '</button>' +
                                '</div>' +
                                '<div class="aioemp-pw-strength" id="aioemp-pw-strength" aria-live="polite">' +
                                    '<div class="aioemp-pw-strength__bar">' +
                                        '<span></span><span></span><span></span><span></span>' +
                                    '</div>' +
                                    '<span class="aioemp-pw-strength__label" id="aioemp-pw-strength-label"></span>' +
                                '</div>' +
                            '</div>' +
                            '<div class="aioemp-profile__field">' +
                                '<label for="aioemp-prof-pw2">Confirm Password</label>' +
                                '<div class="aioemp-pw-wrap">' +
                                    '<input type="password" id="aioemp-prof-pw2" class="aioemp-input" autocomplete="new-password" />' +
                                    '<button type="button" class="aioemp-pw-toggle" aria-label="Show password" tabindex="-1" data-target="aioemp-prof-pw2">' +
                                        '<span class="dashicons dashicons-visibility"></span>' +
                                    '</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                        '<div class="aioemp-profile__actions">' +
                            '<button type="submit" class="aioemp-btn aioemp-btn--primary" id="aioemp-prof-save">Save Changes</button>' +
                        '</div>' +
                    '</form>' +
                '</div>' +
            '</div>'
        );

        loadProfile();
        $('#aioemp-profile-form').on('submit', saveProfile);

        // Password strength meter.
        $('#aioemp-prof-pw').on('input', function () {
            updateStrength($(this).val());
        });

        // Show/hide password toggle.
        $el.on('click', '.aioemp-pw-toggle', function () {
            var target = $(this).data('target');
            var $input = $('#' + target);
            var $icon  = $(this).find('.dashicons');
            if ($input.attr('type') === 'password') {
                $input.attr('type', 'text');
                $icon.removeClass('dashicons-visibility').addClass('dashicons-hidden');
                $(this).attr('aria-label', 'Hide password');
            } else {
                $input.attr('type', 'password');
                $icon.removeClass('dashicons-hidden').addClass('dashicons-visibility');
                $(this).attr('aria-label', 'Show password');
            }
        });
    }

    /* ------------------------------------------------------------------ *
     * Password strength
     * ------------------------------------------------------------------ */

    var STRENGTH_LEVELS = [
        { label: 'Too short', cls: 'is-weak',   segments: 1 },
        { label: 'Weak',      cls: 'is-weak',   segments: 1 },
        { label: 'Fair',      cls: 'is-fair',   segments: 2 },
        { label: 'Good',      cls: 'is-good',   segments: 3 },
        { label: 'Strong',    cls: 'is-strong', segments: 4 },
    ];

    function scorePassword(pw) {
        if (!pw || pw.length === 0) return -1; // hidden
        if (pw.length < 8)          return 0;  // Too short

        var score = 0;
        if (pw.length >= 12)         score++;
        if (/[A-Z]/.test(pw))        score++;
        if (/[a-z]/.test(pw))        score++;
        if (/[0-9]/.test(pw))        score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;

        // map 0–5 → 1–4
        return Math.min(4, Math.max(1, Math.ceil(score / 5 * 4)));
    }

    function updateStrength(pw) {
        var $wrap  = $('#aioemp-pw-strength');
        var $segs  = $wrap.find('.aioemp-pw-strength__bar span');
        var $label = $('#aioemp-pw-strength-label');
        var idx    = scorePassword(pw);

        if (idx === -1) {
            $wrap.attr('class', 'aioemp-pw-strength');
            $segs.removeClass('is-filled');
            $label.text('');
            return;
        }

        var level = STRENGTH_LEVELS[idx];
        $wrap.attr('class', 'aioemp-pw-strength is-visible ' + level.cls);
        $label.text(level.label);
        $segs.each(function (i) {
            $(this).toggleClass('is-filled', i < level.segments);
        });
    }

    /* ------------------------------------------------------------------ *
     * Load profile data
     * ------------------------------------------------------------------ */

    function loadProfile() {
        rest.get('profile').then(function (data) {
            $('#aioemp-prof-fname').val(data.first_name || '');
            $('#aioemp-prof-lname').val(data.last_name || '');
            $('#aioemp-prof-display').val(data.display_name || '');
            $('#aioemp-profile-email').text(data.email || '');
            $('#aioemp-profile-display').text(data.display_name || data.email || '');

            var initial = (data.display_name || data.email || '?').charAt(0).toUpperCase();
            $('#aioemp-profile-avatar').text(initial);
        }).catch(function () {
            showMsg('error', 'Failed to load profile.');
        });
    }

    /* ------------------------------------------------------------------ *
     * Save profile
     * ------------------------------------------------------------------ */

    function saveProfile(e) {
        e.preventDefault();

        var pw  = $('#aioemp-prof-pw').val();
        var pw2 = $('#aioemp-prof-pw2').val();

        if (pw && pw.length < 8) {
            showMsg('error', 'Password must be at least 8 characters.');
            return;
        }

        if (pw && pw !== pw2) {
            showMsg('error', 'Passwords do not match.');
            return;
        }

        var payload = {
            first_name:   $('#aioemp-prof-fname').val(),
            last_name:    $('#aioemp-prof-lname').val(),
            display_name: $('#aioemp-prof-display').val(),
        };

        if (pw) {
            payload.password         = pw;
            payload.password_confirm = pw2;
        }

        var $btn = $('#aioemp-prof-save');
        $btn.prop('disabled', true).text('Saving…');

        rest.put('profile', payload).then(function (data) {
            showMsg('success', data.message || 'Profile updated successfully.');

            // Update header avatar + name in the topbar.
            var newName = data.display_name || '';
            if (newName) {
                $('.aioemp-topbar__user span').not('.aioemp-topbar__avatar, .aioemp-topbar__caret').text(newName);
                var newInitial = newName.charAt(0).toUpperCase();
                $('.aioemp-topbar__avatar').text(newInitial);
                $('#aioemp-profile-display').text(newName);
                $('#aioemp-profile-avatar').text(newInitial);
            }

            // Clear password fields.
            $('#aioemp-prof-pw, #aioemp-prof-pw2').val('');
            updateStrength('');
            $btn.prop('disabled', false).text('Save Changes');
        }).catch(function (err) {
            var msg = 'Failed to update profile.';
            if (err && err.message) {
                msg = err.message;
            }
            showMsg('error', msg);
            $btn.prop('disabled', false).text('Save Changes');
        });
    }

    /* ------------------------------------------------------------------ *
     * Message helper
     * ------------------------------------------------------------------ */

    function showMsg(type, text) {
        var $msg = $('#aioemp-profile-msg');
        $msg.attr('class', 'aioemp-profile__msg aioemp-profile__msg--' + type)
            .text(text)
            .show();

        if (type === 'success') {
            setTimeout(function () { $msg.fadeOut(300); }, 4000);
        }
    }

    /* ------------------------------------------------------------------ *
     * Expose
     * ------------------------------------------------------------------ */

    window.aioemp_profile = { render: render };

})(jQuery);
