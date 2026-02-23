<?php
/**
 * Abstract base REST controller.
 *
 * Provides common route namespace, permission checks, response helpers,
 * and pagination utilities shared by every AIOEMP REST endpoint.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

abstract class AIOEMP_REST_Controller {

    /**
     * REST namespace: /wp-json/aioemp/v1/…
     *
     * @var string
     */
    protected string $namespace = 'aioemp/v1';

    /**
     * Route base, e.g. 'events'. Subclasses must set this.
     *
     * @var string
     */
    protected string $rest_base = '';

    /*--------------------------------------------------------------
     * Registration (subclasses implement this)
     *------------------------------------------------------------*/

    /**
     * Register routes for this controller. Called from rest_api_init.
     */
    abstract public function register_routes(): void;

    /*--------------------------------------------------------------
     * Permission helpers
     *------------------------------------------------------------*/

    /**
     * Standard permission check using a custom capability.
     *
     * @param string $capability One of AIOEMP_Security::CAPS.
     * @return bool|\WP_Error
     */
    protected function check_permission( string $capability ) {
        if ( ! is_user_logged_in() ) {
            return new \WP_Error(
                'rest_not_logged_in',
                __( 'You must be logged in.', 'aioemp' ),
                array( 'status' => 401 )
            );
        }

        if ( ! current_user_can( $capability ) ) {
            return new \WP_Error(
                'rest_forbidden',
                __( 'Sorry, you are not allowed to perform this action.', 'aioemp' ),
                array( 'status' => 403 )
            );
        }

        return true;
    }

    /*--------------------------------------------------------------
     * Response helpers
     *------------------------------------------------------------*/

    /**
     * Return a success response.
     *
     * @param mixed $data   Response data.
     * @param int   $status HTTP status code.
     * @return \WP_REST_Response
     */
    protected function success( $data, int $status = 200 ): \WP_REST_Response {
        return new \WP_REST_Response( $data, $status );
    }

    /**
     * Return an error response.
     *
     * @param string $code    Error code.
     * @param string $message Human-readable message (translatable).
     * @param int    $status  HTTP status code.
     * @return \WP_Error
     */
    protected function error( string $code, string $message, int $status = 400 ): \WP_Error {
        return new \WP_Error( $code, $message, array( 'status' => $status ) );
    }

    /*--------------------------------------------------------------
     * File-upload helpers
     *------------------------------------------------------------*/

    /**
     * Allowed image MIME types for uploads.
     */
    protected const ALLOWED_IMAGE_MIMES = array(
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
    );

    /**
     * Validate that an uploaded file is an image within size limits.
     *
     * @param array  $file         Entry from $_FILES (e.g. $request->get_file_params()['key']).
     * @param int    $max_bytes    Maximum allowed file size in bytes.
     * @param array  $allowed_mimes Allowed MIME types (defaults to ALLOWED_IMAGE_MIMES).
     * @return true|\WP_Error  True on success, WP_Error on failure.
     */
    protected function validate_image_upload( array $file, int $max_bytes = 5242880, ?array $allowed_mimes = null ) {
        $allowed = $allowed_mimes ?? static::ALLOWED_IMAGE_MIMES;

        $finfo = finfo_open( FILEINFO_MIME_TYPE );
        $mime  = finfo_file( $finfo, $file['tmp_name'] );
        finfo_close( $finfo );

        if ( ! in_array( $mime, $allowed, true ) ) {
            return $this->error(
                'invalid_mime',
                __( 'File must be an image (JPEG, PNG, GIF, WebP, or SVG).', 'aioemp' )
            );
        }

        if ( $file['size'] > $max_bytes ) {
            $mb = round( $max_bytes / ( 1024 * 1024 ) );
            return $this->error(
                'file_too_large',
                /* translators: %d: maximum megabytes */
                sprintf( __( 'File must be under %d MB.', 'aioemp' ), $mb )
            );
        }

        return true;
    }

    /*--------------------------------------------------------------
     * Pagination helpers
     *------------------------------------------------------------*/

    /**
     * Read page/per_page params from request, enforce limits.
     *
     * @param \WP_REST_Request $request Request object.
     * @return array{ page: int, per_page: int }
     */
    protected function get_pagination_params( \WP_REST_Request $request ): array {
        $page     = max( 1, absint( $request->get_param( 'page' ) ?: 1 ) );
        $per_page = absint( $request->get_param( 'per_page' ) ?: 20 );
        $per_page = min( max( $per_page, 1 ), 100 ); // clamp 1–100

        return array(
            'page'     => $page,
            'per_page' => $per_page,
        );
    }

    /**
     * Add pagination headers (X-WP-Total, X-WP-TotalPages) to a response.
     *
     * @param \WP_REST_Response $response Response object.
     * @param int               $total    Total number of items.
     * @param int               $per_page Items per page.
     * @return \WP_REST_Response
     */
    protected function add_pagination_headers( \WP_REST_Response $response, int $total, int $per_page ): \WP_REST_Response {
        $total_pages = (int) ceil( $total / max( $per_page, 1 ) );

        $response->header( 'X-WP-Total', $total );
        $response->header( 'X-WP-TotalPages', $total_pages );

        return $response;
    }

    /*--------------------------------------------------------------
     * Sanitise helpers (convenience wrappers)
     *------------------------------------------------------------*/

    /**
     * Read and sanitise a text param from a request.
     *
     * @param \WP_REST_Request $request Request object.
     * @param string           $key     Param key.
     * @return string Sanitised value or empty string.
     */
    protected function text_param( \WP_REST_Request $request, string $key ): string {
        $raw = $request->get_param( $key );
        return is_string( $raw ) ? AIOEMP_Security::sanitize_text( $raw ) : '';
    }

    /**
     * Read and sanitise an integer param.
     *
     * @param \WP_REST_Request $request Request object.
     * @param string           $key     Param key.
     * @return int
     */
    protected function int_param( \WP_REST_Request $request, string $key ): int {
        return AIOEMP_Security::absint( $request->get_param( $key ) );
    }
}
