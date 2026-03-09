/**
 * AIOEMP Users module.
 *
 * Standalone page for managing AIOEMP user roles and creating new
 * WordPress users.  Replaces the user-management section that was
 * previously embedded inside the Settings module.
 *
 * @package AIOEMP
 * @since   0.4.0
 */
(function ($) {
    'use strict';

    const rest = window.aioemp_api;

    /* ------------------------------------------------------------------ *
     * Data cache
     * ------------------------------------------------------------------ */
    let roles = [];
    let users = [];

    /* ------------------------------------------------------------------ *
     * Render
     * ------------------------------------------------------------------ */

    /**
     * Main entry — called by the SPA router.
     *
     * @param {jQuery} $el Container element.
     */
    function render($el) {
        $el.html(buildSkeleton());
        loadRolesAndUsers();
    }

    function buildSkeleton() {
        return (
            '<div class="aioemp-users">' +

            /* ---- User Management card ---- */
            '<div class="aioemp-card" id="aioemp-users-card">' +
                '<h3 class="aioemp-card__title">User Management</h3>' +
                '<p class="aioemp-help" style="margin-bottom:12px">Assign AIOEMP roles to WordPress users. Administrators automatically have full access.</p>' +

                /* Action buttons row */
                '<div class="aioemp-user-actions-row">' +
                    '<div class="aioemp-user-search-wrap">' +
                        '<input type="text" id="aioemp-user-search" class="aioemp-input" placeholder="Search existing users by name or email…" autocomplete="off">' +
                        '<div id="aioemp-user-search-results" class="aioemp-user-search-results" style="display:none"></div>' +
                    '</div>' +
                    '<button type="button" class="aioemp-btn aioemp-btn--primary" id="aioemp-create-user-btn">' +
                        '<span class="dashicons dashicons-plus-alt2"></span> Create New User' +
                    '</button>' +
                '</div>' +

                /* Users table */
                '<div id="aioemp-users-table-wrap">' +
                    '<p class="aioemp-help">Loading users…</p>' +
                '</div>' +
            '</div>' +

            '</div>'
        );
    }

    /* ------------------------------------------------------------------ *
     * Load
     * ------------------------------------------------------------------ */

    /**
     * Load available roles and current AIOEMP user list.
     */
    function loadRolesAndUsers() {
        Promise.all([
            rest.get('users/roles'),
            rest.get('users'),
        ]).then(function (results) {
            roles = results[0];
            users = results[1];
            renderUsersTable();
            bindEvents();
        }).catch(function () {
            $('#aioemp-users-table-wrap').html(
                '<p class="aioemp-help" style="color:var(--aioemp-danger)">Failed to load user data.</p>'
            );
        });
    }

    /* ------------------------------------------------------------------ *
     * Users table
     * ------------------------------------------------------------------ */

    function renderUsersTable() {
        var $wrap = $('#aioemp-users-table-wrap');

        if (!users.length) {
            $wrap.html('<p class="aioemp-help">No users with AIOEMP roles yet. Use the search above to add users or create a new one.</p>');
            return;
        }

        var html = '<table class="aioemp-users-table">' +
            '<thead><tr>' +
                '<th></th>' +
                '<th>User</th>' +
                '<th>Email</th>' +
                '<th>AIOEMP Roles</th>' +
                '<th>Actions</th>' +
            '</tr></thead><tbody>';

        for (var i = 0; i < users.length; i++) {
            html += renderUserRow(users[i]);
        }

        html += '</tbody></table>';
        $wrap.html(html);
    }

    function renderUserRow(u) {
        var roleLabels = [];
        if (u.is_admin) {
            roleLabels.push('<span class="aioemp-role-badge aioemp-role-badge--admin">Administrator</span>');
        }
        for (var r = 0; r < u.aioemp_roles.length; r++) {
            var roleDef = roles.find(function (rd) { return rd.slug === u.aioemp_roles[r]; });
            if (roleDef) {
                roleLabels.push('<span class="aioemp-role-badge">' + escHtml(roleDef.label) + '</span>');
            }
        }
        if (!roleLabels.length) {
            roleLabels.push('<span class="aioemp-help">—</span>');
        }

        var actions = '';
        if (u.is_admin) {
            actions = '<span class="aioemp-help" title="Administrators always have full access">Built-in</span>';
        } else {
            actions =
                '<button type="button" class="aioemp-btn aioemp-btn--small aioemp-btn--outline aioemp-user-edit-btn" data-user-id="' + u.id + '" title="Edit roles">' +
                    '<span class="dashicons dashicons-edit"></span>' +
                '</button>' +
                '<button type="button" class="aioemp-btn aioemp-btn--small aioemp-btn--danger aioemp-user-remove-btn" data-user-id="' + u.id + '" title="Remove all AIOEMP roles">' +
                    '<span class="dashicons dashicons-no-alt"></span>' +
                '</button>';
        }

        return '<tr data-user-id="' + u.id + '">' +
            '<td><img src="' + escHtml(u.avatar_url) + '" class="aioemp-user-avatar" alt=""></td>' +
            '<td>' + escHtml(u.display_name) + ' <small class="aioemp-help">(' + escHtml(u.user_login) + ')</small></td>' +
            '<td>' + escHtml(u.user_email) + '</td>' +
            '<td class="aioemp-user-roles-cell">' + roleLabels.join(' ') + '</td>' +
            '<td class="aioemp-user-actions-cell">' + actions + '</td>' +
        '</tr>';
    }

    /* ------------------------------------------------------------------ *
     * Events
     * ------------------------------------------------------------------ */

    function bindEvents() {
        // Debounced search.
        var searchTimer = null;
        $('#aioemp-user-search').off('input').on('input', function () {
            var q = $(this).val().trim();
            clearTimeout(searchTimer);
            if (q.length < 2) {
                $('#aioemp-user-search-results').hide().empty();
                return;
            }
            searchTimer = setTimeout(function () { searchUsers(q); }, 300);
        });

        // Close search results on outside click.
        $(document).off('click.aioemp-user-search').on('click.aioemp-user-search', function (e) {
            if (!$(e.target).closest('.aioemp-user-search-wrap').length) {
                $('#aioemp-user-search-results').hide();
            }
        });

        // Edit button.
        $(document).off('click.aioemp-user-edit', '.aioemp-user-edit-btn').on('click.aioemp-user-edit', '.aioemp-user-edit-btn', function () {
            var userId = parseInt($(this).data('user-id'), 10);
            showRoleEditor(userId);
        });

        // Remove button.
        $(document).off('click.aioemp-user-remove', '.aioemp-user-remove-btn').on('click.aioemp-user-remove', '.aioemp-user-remove-btn', function () {
            var userId = parseInt($(this).data('user-id'), 10);
            var user = users.find(function (u) { return u.id === userId; });
            if (!user) return;
            if (!confirm('Remove all AIOEMP roles from ' + user.display_name + '?')) return;
            removeUser(userId);
        });

        // Create new user button.
        $('#aioemp-create-user-btn').off('click').on('click', function () {
            showCreateUserModal();
        });
    }

    /* ------------------------------------------------------------------ *
     * Search existing WP users
     * ------------------------------------------------------------------ */

    function searchUsers(q) {
        rest.get('users/search?q=' + encodeURIComponent(q)).then(function (results) {
            var $dropdown = $('#aioemp-user-search-results');
            if (!results.length) {
                $dropdown.html('<div class="aioemp-user-search-item aioemp-help">No users found.</div>').show();
                return;
            }
            var html = '';
            for (var i = 0; i < results.length; i++) {
                var u = results[i];
                html +=
                    '<div class="aioemp-user-search-item" data-user-id="' + u.id + '" ' +
                         'data-display-name="' + escHtml(u.display_name) + '" ' +
                         'data-user-email="' + escHtml(u.user_email) + '" ' +
                         'data-user-login="' + escHtml(u.user_login) + '" ' +
                         'data-avatar-url="' + escHtml(u.avatar_url) + '">' +
                        '<img src="' + escHtml(u.avatar_url) + '" class="aioemp-user-avatar" alt="">' +
                        '<div>' +
                            '<strong>' + escHtml(u.display_name) + '</strong>' +
                            ' <small>(' + escHtml(u.user_login) + ')</small>' +
                            '<br><small>' + escHtml(u.user_email) + '</small>' +
                        '</div>' +
                    '</div>';
            }
            $dropdown.html(html).show();

            // Click to select user → show role editor modal.
            $dropdown.find('.aioemp-user-search-item').off('click').on('click', function () {
                var uid = parseInt($(this).data('user-id'), 10);
                var displayName = $(this).data('display-name');
                var existingUser = users.find(function (u) { return u.id === uid; });
                $dropdown.hide();
                $('#aioemp-user-search').val('');

                if (existingUser) {
                    showRoleEditor(uid);
                    return;
                }

                // New user — show role editor with empty roles.
                showRoleEditor(uid, {
                    id: uid,
                    display_name: displayName,
                    user_email: $(this).data('user-email'),
                    user_login: $(this).data('user-login'),
                    avatar_url: $(this).data('avatar-url'),
                    aioemp_roles: [],
                    is_admin: false,
                });
            });
        });
    }

    /* ------------------------------------------------------------------ *
     * Role editor modal
     * ------------------------------------------------------------------ */

    function showRoleEditor(userId, newUserData) {
        var user = newUserData || users.find(function (u) { return u.id === userId; });
        if (!user) return;

        var currentRoles = user.aioemp_roles || [];

        var html =
            '<div class="aioemp-role-editor-overlay" id="aioemp-role-editor">' +
                '<div class="aioemp-role-editor">' +
                    '<h4>' + escHtml(user.display_name) + ' — Assign Roles</h4>' +
                    '<div class="aioemp-role-checkboxes">';

        for (var i = 0; i < roles.length; i++) {
            var r = roles[i];
            var checked = currentRoles.indexOf(r.slug) >= 0 ? ' checked' : '';
            var capsDesc = r.caps.join(', ');
            html +=
                '<label class="aioemp-role-checkbox-label">' +
                    '<input type="checkbox" name="aioemp_role" value="' + escHtml(r.slug) + '"' + checked + '>' +
                    ' <strong>' + escHtml(r.label) + '</strong>' +
                    '<br><small class="aioemp-help">' + escHtml(capsDesc) + '</small>' +
                '</label>';
        }

        html +=
                    '</div>' +
                    '<div class="aioemp-role-editor__actions">' +
                        '<button type="button" class="aioemp-btn aioemp-btn--primary" id="aioemp-role-save-btn">Save Roles</button>' +
                        '<button type="button" class="aioemp-btn aioemp-btn--outline" id="aioemp-role-cancel-btn">Cancel</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        $('body').append(html);

        // Cancel.
        $('#aioemp-role-cancel-btn, .aioemp-role-editor-overlay').on('click', function (e) {
            if (e.target === this) $('#aioemp-role-editor').remove();
        });

        // Save.
        $('#aioemp-role-save-btn').on('click', function () {
            var selectedRoles = [];
            $('#aioemp-role-editor input[name="aioemp_role"]:checked').each(function () {
                selectedRoles.push($(this).val());
            });
            saveUserRoles(userId, selectedRoles);
        });
    }

    function saveUserRoles(userId, selectedRoles) {
        var $btn = $('#aioemp-role-save-btn');
        $btn.prop('disabled', true).text('Saving…');

        rest.put('users/' + userId, { roles: selectedRoles }).then(function (updatedUser) {
            $('#aioemp-role-editor').remove();

            // Update local cache.
            var idx = users.findIndex(function (u) { return u.id === userId; });
            if (idx >= 0) {
                if (updatedUser.aioemp_roles.length === 0 && !updatedUser.is_admin) {
                    users.splice(idx, 1);
                } else {
                    users[idx] = updatedUser;
                }
            } else if (updatedUser.aioemp_roles.length > 0) {
                users.push(updatedUser);
            }

            renderUsersTable();
            bindEvents();
        }).catch(function (err) {
            $btn.prop('disabled', false).text('Save Roles');
            alert((err && err.message) ? err.message : 'Failed to save roles.');
        });
    }

    function removeUser(userId) {
        rest.del('users/' + userId).then(function () {
            users = users.filter(function (u) { return u.id !== userId; });
            renderUsersTable();
            bindEvents();
        }).catch(function (err) {
            alert((err && err.message) ? err.message : 'Failed to remove user roles.');
        });
    }

    /* ------------------------------------------------------------------ *
     * Create new WP user modal
     * ------------------------------------------------------------------ */

    function showCreateUserModal() {
        var html =
            '<div class="aioemp-role-editor-overlay" id="aioemp-create-user-modal">' +
                '<div class="aioemp-role-editor aioemp-create-user-form">' +
                    '<h4>Create New User</h4>' +

                    '<div class="aioemp-form-group">' +
                        '<label class="aioemp-label" for="aioemp-new-username">Username <span class="aioemp-required">*</span></label>' +
                        '<input type="text" id="aioemp-new-username" class="aioemp-input" placeholder="username" autocomplete="off">' +
                    '</div>' +

                    '<div class="aioemp-form-group">' +
                        '<label class="aioemp-label" for="aioemp-new-email">Email <span class="aioemp-required">*</span></label>' +
                        '<input type="email" id="aioemp-new-email" class="aioemp-input" placeholder="user@example.com" autocomplete="off">' +
                    '</div>' +

                    '<div class="aioemp-form-group">' +
                        '<label class="aioemp-label" for="aioemp-new-display-name">Display Name</label>' +
                        '<input type="text" id="aioemp-new-display-name" class="aioemp-input" placeholder="Full name (optional)" autocomplete="off">' +
                    '</div>' +

                    '<div class="aioemp-form-group">' +
                        '<label class="aioemp-label" for="aioemp-new-password">Password <span class="aioemp-required">*</span></label>' +
                        '<div class="aioemp-password-wrap">' +
                            '<input type="password" id="aioemp-new-password" class="aioemp-input" placeholder="Min. 6 characters" autocomplete="new-password">' +
                            '<button type="button" class="aioemp-btn aioemp-btn--small aioemp-btn--outline" id="aioemp-toggle-pw" title="Show / hide password">' +
                                '<span class="dashicons dashicons-visibility"></span>' +
                            '</button>' +
                        '</div>' +
                    '</div>' +

                    /* Role checkboxes */
                    '<div class="aioemp-form-group">' +
                        '<label class="aioemp-label">AIOEMP Roles</label>' +
                        '<div class="aioemp-role-checkboxes" id="aioemp-new-user-roles">';

        for (var i = 0; i < roles.length; i++) {
            var r = roles[i];
            var capsDesc = r.caps.join(', ');
            html +=
                '<label class="aioemp-role-checkbox-label">' +
                    '<input type="checkbox" name="aioemp_new_role" value="' + escHtml(r.slug) + '">' +
                    ' <strong>' + escHtml(r.label) + '</strong>' +
                    '<br><small class="aioemp-help">' + escHtml(capsDesc) + '</small>' +
                '</label>';
        }

        html +=
                        '</div>' +
                    '</div>' +

                    '<p class="aioemp-create-user-note aioemp-help">' +
                        '<span class="dashicons dashicons-info-outline"></span> ' +
                        'The default WordPress welcome email will <strong>not</strong> be sent.' +
                    '</p>' +

                    '<div class="aioemp-role-editor__actions">' +
                        '<button type="button" class="aioemp-btn aioemp-btn--primary" id="aioemp-create-user-save">' +
                            '<span class="dashicons dashicons-plus-alt2"></span> Create User' +
                        '</button>' +
                        '<button type="button" class="aioemp-btn aioemp-btn--outline" id="aioemp-create-user-cancel">Cancel</button>' +
                    '</div>' +
                    '<p class="aioemp-create-user-error" id="aioemp-create-user-error" style="display:none"></p>' +
                '</div>' +
            '</div>';

        $('body').append(html);

        // Toggle password visibility.
        $('#aioemp-toggle-pw').on('click', function () {
            var $input = $('#aioemp-new-password');
            var isPassword = $input.attr('type') === 'password';
            $input.attr('type', isPassword ? 'text' : 'password');
            $(this).find('.dashicons')
                .toggleClass('dashicons-visibility', !isPassword)
                .toggleClass('dashicons-hidden', isPassword);
        });

        // Cancel.
        $('#aioemp-create-user-cancel, #aioemp-create-user-modal').on('click', function (e) {
            if (e.target === this) $('#aioemp-create-user-modal').remove();
        });

        // Prevent closing when clicking inside the form.
        $('.aioemp-create-user-form').on('click', function (e) {
            e.stopPropagation();
        });

        // Save.
        $('#aioemp-create-user-save').on('click', function () {
            createUser();
        });
    }

    function createUser() {
        var $btn   = $('#aioemp-create-user-save');
        var $error = $('#aioemp-create-user-error');
        $error.hide();

        var username    = $('#aioemp-new-username').val().trim();
        var email       = $('#aioemp-new-email').val().trim();
        var displayName = $('#aioemp-new-display-name').val().trim();
        var password    = $('#aioemp-new-password').val();

        // Client-side validation.
        if (!username || username.length < 2) {
            showCreateError('Username must be at least 2 characters.');
            return;
        }
        if (!email || email.indexOf('@') < 1) {
            showCreateError('Please provide a valid email address.');
            return;
        }
        if (!password || password.length < 6) {
            showCreateError('Password must be at least 6 characters.');
            return;
        }

        var selectedRoles = [];
        $('#aioemp-new-user-roles input[name="aioemp_new_role"]:checked').each(function () {
            selectedRoles.push($(this).val());
        });

        $btn.prop('disabled', true).find('.dashicons').removeClass('dashicons-plus-alt2').addClass('dashicons-update spin');

        rest.post('users/create', {
            user_login:   username,
            user_email:   email,
            display_name: displayName || username,
            user_pass:    password,
            roles:        selectedRoles,
        }).then(function (newUser) {
            $('#aioemp-create-user-modal').remove();
            users.push(newUser);
            renderUsersTable();
            bindEvents();
        }).catch(function (err) {
            $btn.prop('disabled', false).find('.dashicons').removeClass('dashicons-update spin').addClass('dashicons-plus-alt2');
            showCreateError((err && err.message) ? err.message : 'Failed to create user.');
        });
    }

    function showCreateError(msg) {
        $('#aioemp-create-user-error').text(msg).show();
    }

    /* ------------------------------------------------------------------ *
     * Utility
     * ------------------------------------------------------------------ */

    var escHtml = window.aioemp_esc;

    /* ------------------------------------------------------------------ *
     * Expose to SPA router
     * ------------------------------------------------------------------ */
    window.aioemp_users = { render: render };

})(jQuery);
