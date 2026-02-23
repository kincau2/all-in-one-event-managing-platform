<?php
/**
 * Seatmap background-image upload REST controller.
 *
 * POST   /aioemp/v1/seatmaps/upload-bg — upload a background image
 * DELETE /aioemp/v1/seatmaps/upload-bg — delete a previously uploaded image
 *
 * Files are stored in wp-content/uploads/aioemp/seatmap-bg/ with unique
 * filenames.  The URL is returned so the editor can save it into the
 * layout JSON's bgImage field — no schema migration required.
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';

class AIOEMP_Seatmap_Upload_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'seatmaps';

    /** Subdirectory inside wp-content/uploads/ */
    private const UPLOAD_SUBDIR = 'aioemp/seatmap-bg';

    /** Maximum upload size in bytes (5 MB). */
    private const MAX_SIZE = 5 * 1024 * 1024;

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/upload-bg', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'upload_bg' ),
                'permission_callback' => array( $this, 'upload_permissions' ),
            ),
            array(
                'methods'             => \WP_REST_Server::DELETABLE,
                'callback'            => array( $this, 'delete_bg' ),
                'permission_callback' => array( $this, 'upload_permissions' ),
                'args'                => array(
                    'url' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'esc_url_raw' ),
                ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function upload_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_seatmaps'] );
    }

    /*--------------------------------------------------------------
     * Upload callback
     *------------------------------------------------------------*/

    /**
     * POST /seatmaps/upload-bg — handle background image upload.
     *
     * Expects multipart/form-data with a file field named `bg_image`.
     */
    public function upload_bg( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $files = $request->get_file_params();

        if ( empty( $files['bg_image'] ) ) {
            return $this->error( 'no_file', __( 'No background image file provided.', 'aioemp' ) );
        }

        $file = $files['bg_image'];

        /* ── Validate MIME & size ── */
        $valid = $this->validate_image_upload( $file, self::MAX_SIZE );
        if ( is_wp_error( $valid ) ) {
            return $valid;
        }

        /* ── Ensure upload directory exists ── */
        $upload_dir  = wp_upload_dir();
        $target_dir  = $upload_dir['basedir'] . '/' . self::UPLOAD_SUBDIR;
        $target_url  = $upload_dir['baseurl'] . '/' . self::UPLOAD_SUBDIR;

        if ( ! file_exists( $target_dir ) ) {
            wp_mkdir_p( $target_dir );

            // Protect directory: add index.php and .htaccess.
            file_put_contents( $target_dir . '/index.php', "<?php\n// Silence is golden.\n" );
        }

        /* ── Generate unique filename ── */
        $ext      = pathinfo( $file['name'], PATHINFO_EXTENSION );
        $ext      = strtolower( preg_replace( '/[^a-zA-Z0-9]/', '', $ext ) );
        if ( '' === $ext ) {
            $ext = 'jpg';
        }
        $basename = 'seatmap-bg-' . wp_generate_uuid4() . '.' . $ext;
        $dest     = $target_dir . '/' . $basename;

        /* ── Move file ── */
        if ( ! move_uploaded_file( $file['tmp_name'], $dest ) ) {
            return $this->error( 'move_failed', __( 'Could not save uploaded file.', 'aioemp' ), 500 );
        }

        // Ensure correct file permissions.
        chmod( $dest, 0644 );

        $url = $target_url . '/' . $basename;

        return $this->success( array( 'url' => $url ), 201 );
    }

    /*--------------------------------------------------------------
     * Delete callback
     *------------------------------------------------------------*/

    /**
     * DELETE /seatmaps/upload-bg?url=... — remove a previously uploaded bg image.
     */
    public function delete_bg( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $url = $request->get_param( 'url' );
        if ( empty( $url ) ) {
            return $this->error( 'missing_url', __( 'URL is required.', 'aioemp' ) );
        }

        /* ── Convert URL to local path ── */
        $upload_dir = wp_upload_dir();
        $base_url   = $upload_dir['baseurl'] . '/' . self::UPLOAD_SUBDIR . '/';
        $base_dir   = $upload_dir['basedir'] . '/' . self::UPLOAD_SUBDIR . '/';

        // Safety: only delete files inside our dedicated directory.
        if ( 0 !== strpos( $url, $base_url ) ) {
            return $this->error( 'invalid_url', __( 'URL does not belong to seatmap uploads.', 'aioemp' ) );
        }

        $filename = basename( $url );
        $filepath = $base_dir . $filename;

        // Extra safety: prevent path traversal.
        if ( realpath( dirname( $filepath ) ) !== realpath( $base_dir ) ) {
            return $this->error( 'invalid_path', __( 'Invalid file path.', 'aioemp' ) );
        }

        if ( file_exists( $filepath ) ) {
            unlink( $filepath );
        }

        return $this->success( array( 'deleted' => true ) );
    }
}
