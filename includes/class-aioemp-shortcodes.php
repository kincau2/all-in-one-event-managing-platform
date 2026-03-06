<?php
/**
 * Shortcode registrations for the public-facing side.
 *
 * Currently provides:
 *   [aioemp_login]  — a standalone login form.
 *
 * @package AIOEMP
 * @since   0.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class AIOEMP_Shortcodes {

    /*--------------------------------------------------------------
     * Constants
     *------------------------------------------------------------*/

    /** Nonce action used by the login form. */
    private const LOGIN_NONCE_ACTION = 'aioemp_login_form';

    /** Nonce field name. */
    private const LOGIN_NONCE_FIELD = '_aioemp_login_nonce';

    /** Honeypot field name (must remain empty). */
    private const HONEYPOT_FIELD = 'aioemp_website_url';

    /** Rate-limit: max login attempts per IP within the window. */
    private const LOGIN_MAX_ATTEMPTS = 5;

    /** Rate-limit window in seconds. */
    private const LOGIN_WINDOW_SEC = 300; // 5 minutes

    /*--------------------------------------------------------------
     * Bootstrap
     *------------------------------------------------------------*/

    /**
     * Register all shortcodes.
     *
     * Called from the loader on the `init` hook.
     */
    public function register(): void {
        add_shortcode( 'aioemp_login', array( $this, 'render_login' ) );
    }

    /*--------------------------------------------------------------
     * [aioemp_login] shortcode
     *------------------------------------------------------------*/

    /**
     * Render the login form or process its submission.
     *
     * Attributes:
     *   redirect  — URL to redirect to after login (default: AIOEMP dashboard).
     *
     * @param array|string $atts Shortcode attributes.
     * @return string HTML output.
     */
    public function render_login( $atts = array() ): string {
        // Guard against double-render (e.g. shortcode placed twice in page content,
        // or FSE template running the_content() more than once).
        static $rendered = false;
        if ( $rendered ) {
            return '';
        }
        $rendered = true;

        // Login pages must never be cached — nonces and session state change
        // per request.  Tell WordPress, any proxy, and the browser not to cache.
        if ( ! headers_sent() ) {
            nocache_headers();
        }

        $atts = shortcode_atts( array(
            'redirect' => '',
        ), $atts, 'aioemp_login' );

        // Already logged in.
        if ( is_user_logged_in() ) {
            $current_user = wp_get_current_user();
            // AIOEMP-role users are sent straight to the dashboard — no box shown.
            if ( $this->user_has_aioemp_role( $current_user ) ) {
                wp_safe_redirect( admin_url( 'admin.php?page=aioemp-dashboard' ) );
                exit;
            }
            // Other WP users (subscribers, etc.) see the logged-in message.
            return $this->render_already_logged_in();
        }

        $error   = '';
        $username = '';

        // ── Handle form submission ──────────────────────────────
        if ( 'POST' === $_SERVER['REQUEST_METHOD'] && isset( $_POST[ self::LOGIN_NONCE_FIELD ] ) ) {
            $result = $this->process_login( $atts['redirect'] );

            if ( is_wp_error( $result ) ) {
                $error    = $result->get_error_message();
                $username = isset( $_POST['aioemp_log'] )
                    ? sanitize_user( wp_unslash( $_POST['aioemp_log'] ) )
                    : '';
            }
            // If process_login() succeeded it called wp_safe_redirect + exit,
            // so we only reach here on failure.
        }

        // ── Resolve logo URL from plugin settings ──────────────
        require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';
        $logo_url = AIOEMP_Settings_Service::get( 'logo_url' );

        // ── Render the form ─────────────────────────────────────
        return $this->load_template( 'login-form', array(
            'nonce_action' => self::LOGIN_NONCE_ACTION,
            'nonce_field'  => self::LOGIN_NONCE_FIELD,
            'honeypot'     => self::HONEYPOT_FIELD,
            'error'        => $error,
            'username'     => $username,
            'logo_url'     => $logo_url ? esc_url( $logo_url ) : '',
        ) );
    }

    /*--------------------------------------------------------------
     * Login processing (security-hardened)
     *------------------------------------------------------------*/

    /**
     * Validate and authenticate the login form submission.
     *
     * Security measures applied:
     *   1. Nonce verification (CSRF protection).
     *   2. Honeypot field (bot filtering).
     *   3. IP-based rate limiting (brute-force protection).
     *   4. Input sanitisation.
     *   5. Generic error message (no username/password enumeration).
     *   6. Secure cookie via wp_signon().
     *
     * @param string $redirect Custom redirect URL (optional).
     * @return true|\WP_Error  True is never returned — a successful login
     *                         redirects and exits.  WP_Error on failure.
     */
    private function process_login( string $redirect = '' ) {
        // 1. CSRF — verify nonce.
        if (
            ! isset( $_POST[ self::LOGIN_NONCE_FIELD ] ) ||
            ! wp_verify_nonce(
                sanitize_text_field( wp_unslash( $_POST[ self::LOGIN_NONCE_FIELD ] ) ),
                self::LOGIN_NONCE_ACTION
            )
        ) {
            return new \WP_Error( 'nonce_fail', __( 'Security check failed. Please try again.', 'aioemp' ) );
        }

        // 2. Honeypot — if filled, silently reject (likely a bot).
        if ( ! empty( $_POST[ self::HONEYPOT_FIELD ] ) ) {
            // Return a generic error so bots don't know they were caught.
            return new \WP_Error( 'invalid', __( 'Invalid username or password.', 'aioemp' ) );
        }

        // 3. Rate limiting.
        $ip  = AIOEMP_Security::get_client_ip();
        $key = 'login_' . $ip;

        if ( ! AIOEMP_Security::rate_limit_check( $key, self::LOGIN_MAX_ATTEMPTS, self::LOGIN_WINDOW_SEC ) ) {
            return new \WP_Error(
                'rate_limited',
                __( 'Too many login attempts. Please try again in a few minutes.', 'aioemp' )
            );
        }

        // 4. Sanitise inputs.
        $username = isset( $_POST['aioemp_log'] )
            ? sanitize_user( wp_unslash( $_POST['aioemp_log'] ) )
            : '';
        $password = isset( $_POST['aioemp_pwd'] )
            ? wp_unslash( $_POST['aioemp_pwd'] ) // Do NOT sanitize passwords.
            : '';
        $remember = ! empty( $_POST['aioemp_remember'] );

        if ( '' === $username || '' === $password ) {
            return new \WP_Error( 'empty', __( 'Please enter your username and password.', 'aioemp' ) );
        }

        // 5. Authenticate.
        $creds = array(
            'user_login'    => $username,
            'user_password' => $password,
            'remember'      => $remember,
        );

        $user = wp_signon( $creds, is_ssl() );

        if ( is_wp_error( $user ) ) {
            // Generic message — never reveal whether username or password was wrong.
            return new \WP_Error( 'invalid', __( 'Invalid username or password.', 'aioemp' ) );
        }

        // 6. Set current user so subsequent calls work.
        wp_set_current_user( $user->ID );

        // 7. Determine redirect URL.
        $redirect_url = $this->resolve_redirect( $user, $redirect );

        // 8. Safe redirect + exit.
        wp_safe_redirect( $redirect_url );
        exit;
    }

    /*--------------------------------------------------------------
     * Redirect logic
     *------------------------------------------------------------*/

    /**
     * Determine where to send the user after login.
     *
     * Priority:
     *   1. Explicit `redirect` shortcode attribute (if set & same-host).
     *   2. AIOEMP dashboard (if user has any AIOEMP role and is NOT admin).
     *   3. WordPress admin dashboard (fallback).
     *
     * @param \WP_User $user     The authenticated user.
     * @param string   $redirect Shortcode-supplied redirect URL.
     * @return string  Safe redirect URL.
     */
    private function resolve_redirect( \WP_User $user, string $redirect ): string {
        // Honour explicit redirect if provided and same-origin.
        if ( '' !== $redirect ) {
            $redirect = esc_url_raw( $redirect );
            if ( wp_validate_redirect( $redirect, false ) ) {
                return $redirect;
            }
        }

        // AIOEMP-role users → dashboard.
        if ( $this->user_has_aioemp_role( $user ) && ! in_array( 'administrator', $user->roles, true ) ) {
            return admin_url( 'admin.php?page=aioemp-dashboard' );
        }

        return admin_url();
    }

    /**
     * Check whether a user holds any AIOEMP custom role.
     *
     * @param \WP_User $user The user to check.
     * @return bool
     */
    private function user_has_aioemp_role( \WP_User $user ): bool {
        $aioemp_roles = array_keys( AIOEMP_Security::ROLES );
        return ! empty( array_intersect( $user->roles, $aioemp_roles ) );
    }

    /*--------------------------------------------------------------
     * Logged-in message
     *------------------------------------------------------------*/

    /**
     * Render a brief "already logged in" block.
     *
     * @return string
     */
    private function render_already_logged_in(): string {
        $user = wp_get_current_user();
        $name = esc_html( $user->display_name ?: $user->user_login );

        $dashboard_url = current_user_can( AIOEMP_Security::CAPS['access_plugin'] )
            ? admin_url( 'admin.php?page=aioemp-dashboard' )
            : admin_url();

        require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-settings-service.php';
        $logo_url = AIOEMP_Settings_Service::get( 'logo_url' );

        ob_start();
        ?>
        <div class="aioemp-login-overlay">
            <div class="aioemp-login-wrap">
            <div class="aioemp-login-box">
                <div class="aioemp-login-logo">
                    <?php if ( $logo_url ) : ?>
                        <img src="<?php echo esc_url( $logo_url ); ?>" alt="<?php esc_attr_e( 'Logo', 'aioemp' ); ?>" class="aioemp-login-logo__img">
                    <?php else : ?>
                        <div class="aioemp-login-logo__placeholder">
                            <span class="aioemp-login-logo__icon">&#128197;</span>
                        </div>
                    <?php endif; ?>
                </div>
                <p class="aioemp-login-info">
                    <?php
                    printf(
                        /* translators: %s: user display name */
                        esc_html__( 'You are logged in as %s.', 'aioemp' ),
                        '<strong>' . $name . '</strong>'
                    );
                    ?>
                </p>
                <p class="aioemp-login-links">
                    <a href="<?php echo esc_url( $dashboard_url ); ?>"><?php esc_html_e( 'Go to Dashboard', 'aioemp' ); ?></a>
                    &nbsp;|&nbsp;
                    <a href="<?php echo esc_url( wp_logout_url( get_permalink() ) ); ?>"><?php esc_html_e( 'Log out', 'aioemp' ); ?></a>
                </p>
            </div>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    /*--------------------------------------------------------------
     * Template loader
     *------------------------------------------------------------*/

    /**
     * Load a template file from the templates/ directory and
     * return its output as a string.
     *
     * Variables in $args are extracted into the template scope.
     * Theme override: themes can place templates in
     * `aioemp/template-name.php` to customise output.
     *
     * @param string $template Template name (without .php).
     * @param array  $args     Variables to pass to the template.
     * @return string Rendered HTML.
     */
    private function load_template( string $template, array $args = array() ): string {
        // Allow theme override (standard WP plugin practice).
        $theme_file = locate_template( 'aioemp/' . $template . '.php' );
        $file       = $theme_file
            ? $theme_file
            : AIOEMP_PLUGIN_DIR . 'templates/' . $template . '.php';

        if ( ! file_exists( $file ) ) {
            return '<!-- aioemp: template "' . esc_html( $template ) . '" not found -->';
        }

        // Make our public CSS available.
        wp_enqueue_style( 'aioemp-public' );

        ob_start();
        // phpcs:ignore WordPress.PHP.DontExtract.extract_extract
        extract( $args, EXTR_SKIP );
        include $file;
        return ob_get_clean();
    }
}
