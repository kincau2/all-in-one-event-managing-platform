<?php
/**
 * Users REST controller — AIOEMP role management + new user creation.
 *
 * GET    /aioemp/v1/users             — list users with AIOEMP roles
 * GET    /aioemp/v1/users/search?q=…  — search WP users
 * GET    /aioemp/v1/users/roles       — list available AIOEMP roles
 * POST   /aioemp/v1/users/create      — create a new WP user (skip default email)
 * PUT    /aioemp/v1/users/<id>        — assign/update AIOEMP roles
 * DELETE /aioemp/v1/users/<id>        — remove all AIOEMP roles
 *
 * All endpoints require manage_settings capability.
 *
 * @package AIOEMP
 * @since   0.4.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-email-service.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-password-setup-endpoint.php';

class AIOEMP_Users_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'users';

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {

        // GET /users — list users with AIOEMP roles.
        register_rest_route( $this->namespace, '/' . $this->rest_base, array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'list_users' ),
                'permission_callback' => array( $this, 'users_permissions' ),
            ),
        ) );

        // GET /users/search?q=…
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/search', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'search_users' ),
                'permission_callback' => array( $this, 'users_permissions' ),
                'args'                => array(
                    'q' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
                ),
            ),
        ) );

        // GET /users/roles
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/roles', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'list_roles' ),
                'permission_callback' => array( $this, 'users_permissions' ),
            ),
        ) );

        // POST /users/create — create a new WP user.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/create', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'create_user' ),
                'permission_callback' => array( $this, 'users_permissions' ),
                'args'                => array(
                    'user_login'   => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_user' ),
                    'user_email'   => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_email' ),
                    'display_name' => array( 'type' => 'string', 'required' => false, 'sanitize_callback' => 'sanitize_text_field' ),
                    'user_pass'    => array( 'type' => 'string', 'required' => true ),
                    'roles'        => array( 'type' => 'array',  'required' => false, 'items' => array( 'type' => 'string' ) ),
                ),
            ),
        ) );

        // PUT + DELETE /users/<id>
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<id>[\d]+)', array(
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_user_roles' ),
                'permission_callback' => array( $this, 'users_permissions' ),
                'args'                => array(
                    'id'    => array( 'type' => 'integer', 'required' => true, 'sanitize_callback' => 'absint' ),
                    'roles' => array( 'type' => 'array',   'required' => true, 'items' => array( 'type' => 'string' ) ),
                ),
            ),
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'remove_user_roles' ),
                'permission_callback' => array( $this, 'users_permissions' ),
                'args'                => array(
                    'id' => array( 'type' => 'integer', 'required' => true, 'sanitize_callback' => 'absint' ),
                ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function users_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_settings'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    /**
     * GET /users/roles — return the available AIOEMP role definitions.
     */
    public function list_roles(): \WP_REST_Response {
        $labels = AIOEMP_Security::CAP_LABELS;
        $roles  = array();
        foreach ( AIOEMP_Security::ROLES as $slug => $def ) {
            $roles[] = array(
                'slug'  => $slug,
                'label' => $def['label'],
                'caps'  => $def['caps'],
                'cap_labels' => array_map(
                    function ( $key ) use ( $labels ) {
                        return $labels[ $key ] ?? $key;
                    },
                    $def['caps']
                ),
            );
        }
        return $this->success( $roles );
    }

    /**
     * GET /users — list WP users who hold at least one AIOEMP role.
     */
    public function list_users(): \WP_REST_Response {
        $aioemp_slugs = array_keys( AIOEMP_Security::ROLES );

        // Also include administrators who have AIOEMP caps.
        $role_queries = array_merge( $aioemp_slugs, array( 'administrator' ) );

        $query = new \WP_User_Query( array(
            'role__in' => $role_queries,
            'orderby'  => 'display_name',
            'order'    => 'ASC',
            'number'   => 200,
        ) );

        $users = array();
        foreach ( $query->get_results() as $user ) {
            $aioemp_roles = AIOEMP_Security::get_user_aioemp_roles( $user->ID );
            $is_admin     = in_array( 'administrator', (array) $user->roles, true );

            if ( empty( $aioemp_roles ) && ! $is_admin ) {
                continue;
            }

            $users[] = $this->format_user( $user, $aioemp_roles, $is_admin );
        }

        return $this->success( $users );
    }

    /**
     * GET /users/search?q=… — search WP users by name or email.
     */
    public function search_users( \WP_REST_Request $request ): \WP_REST_Response {
        $q = sanitize_text_field( $request->get_param( 'q' ) );
        if ( strlen( $q ) < 2 ) {
            return $this->success( array() );
        }

        $query = new \WP_User_Query( array(
            'search'         => '*' . $q . '*',
            'search_columns' => array( 'user_login', 'user_email', 'display_name' ),
            'orderby'        => 'display_name',
            'order'          => 'ASC',
            'number'         => 20,
        ) );

        $results = array();
        foreach ( $query->get_results() as $user ) {
            $results[] = array(
                'id'           => $user->ID,
                'display_name' => $user->display_name,
                'user_email'   => $user->user_email,
                'user_login'   => $user->user_login,
                'avatar_url'   => get_avatar_url( $user->ID, array( 'size' => 48 ) ),
                'wp_roles'     => array_values( (array) $user->roles ),
                'aioemp_roles' => AIOEMP_Security::get_user_aioemp_roles( $user->ID ),
            );
        }

        return $this->success( $results );
    }

    /**
     * POST /users/create — create a new WordPress user.
     *
     * Skips the default WordPress new-user email notification so that
     * AIOEMP can handle its own email templates in a later phase.
     *
     * Body: { user_login, user_email, display_name?, user_pass, roles? }
     */
    public function create_user( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $user_login   = sanitize_user( $request->get_param( 'user_login' ) );
        $user_email   = sanitize_email( $request->get_param( 'user_email' ) );
        $display_name = sanitize_text_field( $request->get_param( 'display_name' ) ?: '' );
        $user_pass    = $request->get_param( 'user_pass' );
        $roles        = $request->get_param( 'roles' ) ?: array();

        // Validation.
        if ( empty( $user_login ) || strlen( $user_login ) < 2 ) {
            return $this->error( 'invalid_login', __( 'Username must be at least 2 characters.', 'aioemp' ), 400 );
        }
        if ( ! is_email( $user_email ) ) {
            return $this->error( 'invalid_email', __( 'Please provide a valid email address.', 'aioemp' ), 400 );
        }
        if ( empty( $user_pass ) || strlen( $user_pass ) < 6 ) {
            return $this->error( 'weak_password', __( 'Password must be at least 6 characters.', 'aioemp' ), 400 );
        }
        if ( username_exists( $user_login ) ) {
            return $this->error( 'login_exists', __( 'This username is already taken.', 'aioemp' ), 409 );
        }
        if ( email_exists( $user_email ) ) {
            return $this->error( 'email_exists', __( 'This email address is already registered.', 'aioemp' ), 409 );
        }

        // Suppress WP default new-user email.
        add_filter( 'wp_send_new_user_notifications', '__return_false' );
        add_filter( 'send_password_change_email', '__return_false' );

        $user_data = array(
            'user_login'   => $user_login,
            'user_email'   => $user_email,
            'user_pass'    => $user_pass,
            'display_name' => $display_name ?: $user_login,
            'role'         => '',  // No default WP role — AIOEMP roles only.
        );

        $user_id = wp_insert_user( $user_data );

        // Remove email suppression filters.
        remove_filter( 'wp_send_new_user_notifications', '__return_false' );
        remove_filter( 'send_password_change_email', '__return_false' );

        if ( is_wp_error( $user_id ) ) {
            return $this->error( 'create_failed', $user_id->get_error_message(), 500 );
        }

        // Assign AIOEMP roles.
        if ( ! empty( $roles ) ) {
            // Validate role slugs first.
            $valid_slugs = array_keys( AIOEMP_Security::ROLES );
            foreach ( $roles as $slug ) {
                if ( ! in_array( $slug, $valid_slugs, true ) ) {
                    return $this->error(
                        'invalid_role',
                        sprintf( __( 'Invalid role: %s', 'aioemp' ), sanitize_text_field( $slug ) ),
                        400
                    );
                }
            }
            AIOEMP_Security::sync_user_aioemp_roles( $user_id, $roles );
        }

        // Send new-user welcome email with password-setup link.
        $this->send_welcome_email( $user_id, $user_email, $display_name ?: $user_login, $roles );

        $user = get_userdata( $user_id );
        return $this->success( $this->format_user(
            $user,
            AIOEMP_Security::get_user_aioemp_roles( $user_id ),
            false
        ), 201 );
    }

    /**
     * PUT /users/<id> — assign/update AIOEMP roles for a user.
     */
    public function update_user_roles( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $user_id = absint( $request->get_param( 'id' ) );
        $roles   = $request->get_param( 'roles' );

        if ( ! get_userdata( $user_id ) ) {
            return $this->error( 'user_not_found', __( 'User not found.', 'aioemp' ), 404 );
        }

        if ( $user_id === get_current_user_id() ) {
            return $this->error( 'cannot_edit_self', __( 'You cannot change your own AIOEMP roles.', 'aioemp' ), 403 );
        }

        if ( ! is_array( $roles ) ) {
            return $this->error( 'invalid_roles', __( 'Roles must be an array.', 'aioemp' ), 400 );
        }

        $valid_slugs = array_keys( AIOEMP_Security::ROLES );
        foreach ( $roles as $slug ) {
            if ( ! in_array( $slug, $valid_slugs, true ) ) {
                return $this->error(
                    'invalid_role',
                    sprintf( __( 'Invalid role: %s', 'aioemp' ), sanitize_text_field( $slug ) ),
                    400
                );
            }
        }

        $ok = AIOEMP_Security::sync_user_aioemp_roles( $user_id, $roles );
        if ( ! $ok ) {
            return $this->error( 'sync_failed', __( 'Failed to update user roles.', 'aioemp' ), 500 );
        }

        $user = get_userdata( $user_id );
        return $this->success( $this->format_user(
            $user,
            AIOEMP_Security::get_user_aioemp_roles( $user_id ),
            in_array( 'administrator', (array) $user->roles, true )
        ) );
    }

    /**
     * DELETE /users/<id> — remove all AIOEMP roles from a user.
     */
    public function remove_user_roles( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $user_id = absint( $request->get_param( 'id' ) );

        if ( ! get_userdata( $user_id ) ) {
            return $this->error( 'user_not_found', __( 'User not found.', 'aioemp' ), 404 );
        }

        if ( $user_id === get_current_user_id() ) {
            return $this->error( 'cannot_edit_self', __( 'You cannot remove your own AIOEMP roles.', 'aioemp' ), 403 );
        }

        AIOEMP_Security::remove_all_aioemp_roles( $user_id );

        return $this->success( array( 'removed' => true ) );
    }

    /*--------------------------------------------------------------
     * Helpers
     *------------------------------------------------------------*/

    /**
     * Format a WP_User into the standard response shape.
     */
    private function format_user( \WP_User $user, array $aioemp_roles, bool $is_admin ): array {
        return array(
            'id'           => $user->ID,
            'display_name' => $user->display_name,
            'user_email'   => $user->user_email,
            'user_login'   => $user->user_login,
            'avatar_url'   => get_avatar_url( $user->ID, array( 'size' => 48 ) ),
            'wp_roles'     => array_values( (array) $user->roles ),
            'aioemp_roles' => $aioemp_roles,
            'is_admin'     => $is_admin,
        );
    }

    /**
     * Send the new-user welcome email with a password-setup link.
     *
     * @param int    $user_id      WP user ID.
     * @param string $email        User email address.
     * @param string $display_name Display name for the greeting.
     * @param array  $roles        AIOEMP role slugs assigned.
     */
    private function send_welcome_email( int $user_id, string $email, string $display_name, array $roles ): void {
        if ( empty( $email ) || ! is_email( $email ) ) {
            return;
        }

        $setup_url  = AIOEMP_Password_Setup_Endpoint::generate_setup_url( $user_id );
        $user       = get_userdata( $user_id );
        $user_login = $user ? $user->user_login : '';

        // Build a human-readable role name.
        $role_labels = array();
        foreach ( $roles as $slug ) {
            if ( isset( AIOEMP_Security::ROLES[ $slug ] ) ) {
                $role_labels[] = AIOEMP_Security::ROLES[ $slug ]['label'];
            }
        }
        $role_name = ! empty( $role_labels ) ? implode( ', ', $role_labels ) : 'User';

        $variables = array(
            'display_name' => $display_name,
            'user_login'   => $user_login,
            'user_email'   => $email,
            'setup_url'    => $setup_url,
            'role_name'    => $role_name,
        );

        AIOEMP_Email_Service::send( 'new_user_welcome', $email, $variables );
    }
}
