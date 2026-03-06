<?php
/**
 * Profile REST controller.
 *
 * GET  /aioemp/v1/profile  — read current user profile
 * PUT  /aioemp/v1/profile  — update current user profile
 *
 * Any logged-in user with an AIOEMP role can access their own profile.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';

class AIOEMP_Profile_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'profile';

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {
        register_rest_route( $this->namespace, '/' . $this->rest_base, array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_profile' ),
                'permission_callback' => array( $this, 'profile_permissions' ),
            ),
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_profile' ),
                'permission_callback' => array( $this, 'profile_permissions' ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions — any authenticated user
     *------------------------------------------------------------*/

    public function profile_permissions(): bool|\WP_Error {
        if ( ! is_user_logged_in() ) {
            return new \WP_Error(
                'rest_not_logged_in',
                __( 'You must be logged in.', 'aioemp' ),
                array( 'status' => 401 )
            );
        }
        return true;
    }

    /*--------------------------------------------------------------
     * GET /profile
     *------------------------------------------------------------*/

    public function get_profile( \WP_REST_Request $request ): \WP_REST_Response {
        $user = wp_get_current_user();

        return $this->success( array(
            'first_name'   => $user->first_name,
            'last_name'    => $user->last_name,
            'display_name' => $user->display_name,
            'email'        => $user->user_email,
        ) );
    }

    /*--------------------------------------------------------------
     * PUT /profile
     *------------------------------------------------------------*/

    public function update_profile( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $user_id = get_current_user_id();

        $first_name   = sanitize_text_field( $request->get_param( 'first_name' ) ?? '' );
        $last_name    = sanitize_text_field( $request->get_param( 'last_name' ) ?? '' );
        $display_name = sanitize_text_field( $request->get_param( 'display_name' ) ?? '' );
        $password     = $request->get_param( 'password' ) ?? '';
        $password_confirm = $request->get_param( 'password_confirm' ) ?? '';

        // Build update args — only include fields that were sent.
        $userdata = array( 'ID' => $user_id );

        if ( $first_name !== '' ) {
            $userdata['first_name'] = $first_name;
        }

        if ( $last_name !== '' ) {
            $userdata['last_name'] = $last_name;
        }

        if ( $display_name !== '' ) {
            $userdata['display_name'] = $display_name;
        }

        // Password change (optional).
        if ( ! empty( $password ) ) {
            if ( mb_strlen( $password ) < 8 ) {
                return $this->error(
                    'password_too_short',
                    __( 'Password must be at least 8 characters.', 'aioemp' ),
                    422
                );
            }

            if ( $password !== $password_confirm ) {
                return $this->error(
                    'password_mismatch',
                    __( 'Passwords do not match.', 'aioemp' ),
                    422
                );
            }

            $userdata['user_pass'] = $password;
        }

        $result = wp_update_user( $userdata );

        if ( is_wp_error( $result ) ) {
            return $this->error(
                'update_failed',
                $result->get_error_message(),
                500
            );
        }

        // Re-fetch updated user.
        $user = get_userdata( $user_id );

        return $this->success( array(
            'first_name'   => $user->first_name,
            'last_name'    => $user->last_name,
            'display_name' => $user->display_name,
            'email'        => $user->user_email,
            'message'      => __( 'Profile updated successfully.', 'aioemp' ),
        ) );
    }
}
