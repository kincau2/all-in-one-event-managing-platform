<?php
/**
 * Settings REST controller.
 *
 * GET  /aioemp/v1/settings        — read all settings (secrets masked)
 * PUT  /aioemp/v1/settings        — update settings
 * POST /aioemp/v1/settings/logo   — upload logo via WP media
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';

class AIOEMP_Settings_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'settings';

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {

        // GET + PUT /settings.
        register_rest_route( $this->namespace, '/' . $this->rest_base, array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_settings' ),
                'permission_callback' => array( $this, 'settings_permissions' ),
            ),
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_settings' ),
                'permission_callback' => array( $this, 'settings_permissions' ),
            ),
        ) );

        // POST /settings/logo — file upload.
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/logo', array(
            'methods'             => \WP_REST_Server::CREATABLE,
            'callback'            => array( $this, 'upload_logo' ),
            'permission_callback' => array( $this, 'settings_permissions' ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function settings_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_settings'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    /**
     * GET /settings — return all settings (secret key masked).
     */
    public function get_settings(): \WP_REST_Response {
        return $this->success( AIOEMP_Settings_Service::get_public() );
    }

    /**
     * PUT /settings — update one or more settings.
     */
    public function update_settings( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $body = $request->get_json_params();
        if ( empty( $body ) || ! is_array( $body ) ) {
            return $this->error( 'invalid_body', __( 'Request body must be a JSON object.', 'aioemp' ) );
        }

        // If the masked placeholder is sent back, don't overwrite the real secret.
        if ( isset( $body['captcha_secret_key'] ) && '••••••••' === $body['captcha_secret_key'] ) {
            unset( $body['captcha_secret_key'] );
        }

        $ok = AIOEMP_Settings_Service::update( $body );
        if ( ! $ok ) {
            // update_option returns false when value is unchanged — treat as success.
            // Only truly unexpected failures would hit this, but we still return data.
        }

        return $this->success( AIOEMP_Settings_Service::get_public() );
    }

    /**
     * POST /settings/logo — handle logo upload via WP media library.
     *
     * Expects a multipart/form-data request with a file field named `logo`.
     * The file is side-loaded into WP media library and the attachment ID +
     * URL are stored in settings.
     */
    public function upload_logo( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $files = $request->get_file_params();

        if ( empty( $files['logo'] ) ) {
            return $this->error( 'no_file', __( 'No logo file provided.', 'aioemp' ) );
        }

        $file = $files['logo'];

        // Validate MIME type — images only.
        $allowed = array( 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml' );
        $finfo   = finfo_open( FILEINFO_MIME_TYPE );
        $mime    = finfo_file( $finfo, $file['tmp_name'] );
        finfo_close( $finfo );

        if ( ! in_array( $mime, $allowed, true ) ) {
            return $this->error( 'invalid_mime', __( 'File must be an image (JPEG, PNG, GIF, WebP, or SVG).', 'aioemp' ) );
        }

        // Validate file size — max 2 MB.
        $max_size = 2 * 1024 * 1024;
        if ( $file['size'] > $max_size ) {
            return $this->error( 'file_too_large', __( 'Logo must be under 2 MB.', 'aioemp' ) );
        }

        // Use WordPress media handling.
        if ( ! function_exists( 'wp_handle_upload' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if ( ! function_exists( 'wp_generate_attachment_metadata' ) ) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }
        if ( ! function_exists( 'media_handle_upload' ) ) {
            require_once ABSPATH . 'wp-admin/includes/media.php';
        }

        // media_handle_upload reads from $_FILES by key.
        $attachment_id = media_handle_upload( 'logo', 0 );

        if ( is_wp_error( $attachment_id ) ) {
            return $this->error(
                'upload_failed',
                $attachment_id->get_error_message(),
                500
            );
        }

        $url = wp_get_attachment_url( $attachment_id );

        // Store in settings.
        AIOEMP_Settings_Service::update( array(
            'logo_attachment_id' => $attachment_id,
            'logo_url'           => $url,
        ) );

        return $this->success( array(
            'attachment_id' => $attachment_id,
            'url'           => $url,
        ), 201 );
    }
}
