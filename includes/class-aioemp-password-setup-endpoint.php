<?php
/**
 * Virtual password-setup page — public endpoint for new AIOEMP users.
 *
 * Registers a rewrite rule so that /setup-password/{token} renders a
 * branded password-setup page matching the login form design.
 *
 * Tokens are stored in user meta with an expiry (48 hours).
 *
 * @package AIOEMP
 * @since   0.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Password_Setup_Endpoint {

    /**
     * Default slug for the password-setup page.
     */
    public const DEFAULT_SLUG = 'setup-password';

    /**
     * Query var registered with WP.
     */
    public const QUERY_VAR = 'aioemp_setup_password';

    /**
     * User meta key for the setup token.
     */
    public const TOKEN_META_KEY = 'aioemp_password_setup_token';

    /**
     * User meta key for the token expiry.
     */
    public const EXPIRY_META_KEY = 'aioemp_password_setup_expiry';

    /**
     * Token lifetime in seconds (48 hours).
     */
    public const TOKEN_LIFETIME = 172800; // 48 * 60 * 60

    /**
     * Register hooks.
     */
    public function register(): void {
        add_action( 'init', array( $this, 'add_rewrite_rules' ) );
        add_filter( 'query_vars', array( $this, 'register_query_vars' ) );
        add_action( 'template_redirect', array( $this, 'handle_request' ) );
    }

    /**
     * Get the current slug.
     *
     * @return string
     */
    public static function get_slug(): string {
        return self::DEFAULT_SLUG;
    }

    /**
     * Generate a password-setup URL for a user.
     *
     * Creates a token and stores it in user meta with an expiry.
     *
     * @param int $user_id WP user ID.
     * @return string Full URL for password setup.
     */
    public static function generate_setup_url( int $user_id ): string {
        // Generate a secure random token.
        $token  = bin2hex( random_bytes( 32 ) ); // 64-char hex
        $expiry = time() + self::TOKEN_LIFETIME;

        // Hash the token for storage (don't store raw tokens).
        $hashed = hash( 'sha256', $token );

        update_user_meta( $user_id, self::TOKEN_META_KEY, $hashed );
        update_user_meta( $user_id, self::EXPIRY_META_KEY, $expiry );

        $slug = self::get_slug();
        if ( get_option( 'permalink_structure' ) ) {
            return home_url( $slug . '/' . $token );
        }
        return add_query_arg( self::QUERY_VAR, $token, home_url( '/' ) );
    }

    /**
     * Register the rewrite rule for pretty permalinks.
     */
    public function add_rewrite_rules(): void {
        $slug = self::get_slug();
        add_rewrite_rule(
            '^' . preg_quote( $slug, '/' ) . '/([a-f0-9]{64})/?$',
            'index.php?' . self::QUERY_VAR . '=$matches[1]',
            'top'
        );
    }

    /**
     * Register our query var.
     *
     * @param array $vars Existing query vars.
     * @return array
     */
    public function register_query_vars( array $vars ): array {
        $vars[] = self::QUERY_VAR;
        return $vars;
    }

    /**
     * Handle the password-setup request.
     */
    public function handle_request(): void {
        $token = get_query_var( self::QUERY_VAR );

        if ( empty( $token ) ) {
            return;
        }

        // Sanitize — must be 64-char hex.
        $token = sanitize_text_field( $token );
        if ( ! preg_match( '/^[a-f0-9]{64}$/', $token ) ) {
            $this->render_error( __( 'Invalid password setup link.', 'aioemp' ) );
            return;
        }

        // Hash the incoming token for comparison.
        $hashed = hash( 'sha256', $token );

        // Find the user with this token.
        $users = get_users( array(
            'meta_key'   => self::TOKEN_META_KEY,
            'meta_value' => $hashed,
            'number'     => 1,
        ) );

        if ( empty( $users ) ) {
            $this->render_error( __( 'This password setup link is invalid or has already been used.', 'aioemp' ) );
            return;
        }

        $user   = $users[0];
        $expiry = (int) get_user_meta( $user->ID, self::EXPIRY_META_KEY, true );

        if ( time() > $expiry ) {
            // Clean up expired token.
            delete_user_meta( $user->ID, self::TOKEN_META_KEY );
            delete_user_meta( $user->ID, self::EXPIRY_META_KEY );
            $this->render_error( __( 'This password setup link has expired. Please contact your administrator for a new link.', 'aioemp' ) );
            return;
        }

        // Handle form submission.
        $error   = '';
        $success = false;

        if ( 'POST' === $_SERVER['REQUEST_METHOD'] ) {
            $error   = $this->process_password_setup( $user, $token );
            $success = empty( $error );
        }

        // Render the form.
        $this->render_form( $user, $token, $error, $success );
    }

    /**
     * Process the password setup form submission.
     *
     * @param \WP_User $user  The user setting their password.
     * @param string   $token The raw token (for nonce context).
     * @return string Error message or empty string on success.
     */
    private function process_password_setup( \WP_User $user, string $token ): string {
        // Verify nonce.
        if ( ! isset( $_POST['_aioemp_setup_nonce'] ) ||
             ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_aioemp_setup_nonce'] ) ), 'aioemp_password_setup_' . $user->ID ) ) {
            return __( 'Security check failed. Please try again.', 'aioemp' );
        }

        // Honeypot check.
        if ( ! empty( $_POST['aioemp_website_url'] ) ) {
            return __( 'Security check failed.', 'aioemp' );
        }

        $password = isset( $_POST['password'] ) ? $_POST['password'] : '';
        $confirm  = isset( $_POST['password_confirm'] ) ? $_POST['password_confirm'] : '';

        if ( empty( $password ) ) {
            return __( 'Please enter a password.', 'aioemp' );
        }

        if ( strlen( $password ) < 8 ) {
            return __( 'Password must be at least 8 characters.', 'aioemp' );
        }

        if ( $password !== $confirm ) {
            return __( 'Passwords do not match.', 'aioemp' );
        }

        // Update the password.
        wp_set_password( $password, $user->ID );

        // Clean up the token — one-time use.
        delete_user_meta( $user->ID, self::TOKEN_META_KEY );
        delete_user_meta( $user->ID, self::EXPIRY_META_KEY );

        return '';
    }

    /**
     * Render the password setup form.
     *
     * @param \WP_User $user    The user.
     * @param string   $token   The raw token.
     * @param string   $error   Error message.
     * @param bool     $success Whether the password was set successfully.
     */
    private function render_form( \WP_User $user, string $token, string $error, bool $success ): void {
        nocache_headers();

        require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';
        $logo_url     = AIOEMP_Settings_Service::get( 'logo_url' );
        $nonce_action = 'aioemp_password_setup_' . $user->ID;
        $honeypot     = 'aioemp_website_url';
        $display_name = $user->display_name ?: $user->user_login;

        include AIOEMP_PLUGIN_DIR . 'templates/password-setup.php';
        exit;
    }

    /**
     * Render an error page.
     *
     * @param string $message Error message.
     */
    private function render_error( string $message ): void {
        nocache_headers();
        status_header( 404 );

        require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';
        $logo_url = AIOEMP_Settings_Service::get( 'logo_url' );

        include AIOEMP_PLUGIN_DIR . 'templates/password-setup-error.php';
        exit;
    }

    /**
     * Check if the slug conflicts with an existing page/post.
     *
     * @param string $slug Slug to check.
     * @return bool
     */
    public static function has_slug_conflict( string $slug = '' ): bool {
        if ( empty( $slug ) ) {
            $slug = self::get_slug();
        }

        $page = get_page_by_path( $slug );
        if ( $page ) {
            return true;
        }

        global $wpdb;
        $exists = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT ID FROM {$wpdb->posts} WHERE post_name = %s AND post_status IN ('publish','draft','pending') LIMIT 1",
                $slug
            )
        );

        return (bool) $exists;
    }
}
