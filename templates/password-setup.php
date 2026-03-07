<?php
/**
 * Template: Password Setup Page
 *
 * Rendered by AIOEMP_Password_Setup_Endpoint for new users
 * who received a setup link via email.
 *
 * Follows the same layout as the login form.
 *
 * Available variables:
 *   $user          WP_User  The user setting their password.
 *   $token         string   The raw token.
 *   $error         string   Error message (empty if none).
 *   $success       bool     Whether the password was set successfully.
 *   $logo_url      string   Uploaded logo URL (empty if not set).
 *   $nonce_action  string   Nonce action name.
 *   $honeypot      string   Honeypot input name.
 *   $display_name  string   User display name.
 *
 * @package AIOEMP
 * @since   0.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo( 'charset' ); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo esc_html__( 'Set Up Your Password', 'aioemp' ); ?> — <?php bloginfo( 'name' ); ?></title>
    <meta name="robots" content="noindex, nofollow">
    <?php wp_enqueue_style( 'aioemp-public', AIOEMP_PLUGIN_URL . 'public/css/aioemp-public.css', array(), AIOEMP_VERSION ); ?>
    <?php wp_head(); ?>
</head>
<body class="aioemp-setup-password-page">

<style id="aioemp-setup-critical">
.aioemp-login-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    min-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    z-index: 2147483647 !important;
    background: #f0f2f5 !important;
    overflow-y: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    box-sizing: border-box !important;
    padding: 24px 16px !important;
    margin: 0 !important;
    transform: none !important;
    filter: none !important;
    isolation: isolate;
}
html, body {
    overflow: hidden !important;
    margin: 0 !important;
    padding: 0 !important;
}
</style>

<div class="aioemp-login-overlay">
    <div class="aioemp-login-wrap">
        <div class="aioemp-login-box">

            <?php // Logo ?>
            <div class="aioemp-login-logo">
                <?php if ( ! empty( $logo_url ) ) : ?>
                    <img src="<?php echo esc_url( $logo_url ); ?>"
                         alt="<?php esc_attr_e( 'Logo', 'aioemp' ); ?>"
                         class="aioemp-login-logo__img">
                <?php else : ?>
                    <div class="aioemp-login-logo__placeholder">
                        <span class="aioemp-login-logo__icon">&#128197;</span>
                    </div>
                <?php endif; ?>
            </div>

            <?php if ( $success ) : ?>

                <?php // ── Success panel ── ?>
                <div class="aioemp-setup-success">
                    <div class="aioemp-setup-success__icon">&#10003;</div>
                    <h2 class="aioemp-login-title"><?php esc_html_e( 'Password Set Successfully', 'aioemp' ); ?></h2>
                    <p class="aioemp-login-subtitle">
                        <?php esc_html_e( 'Your password has been set. You can now sign in with your new password.', 'aioemp' ); ?>
                    </p>
                    <a href="<?php echo esc_url( wp_login_url() ); ?>" class="aioemp-login-submit" style="display:inline-block;text-align:center;text-decoration:none;">
                        <?php esc_html_e( 'Sign In', 'aioemp' ); ?>
                    </a>
                </div>

            <?php else : ?>

                <?php // ── Password setup form ── ?>
                <h2 class="aioemp-login-title"><?php esc_html_e( 'Set Up Your Password', 'aioemp' ); ?></h2>
                <p class="aioemp-login-subtitle">
                    <?php
                    printf(
                        /* translators: %s: user display name */
                        esc_html__( 'Welcome, %s! Please create a password for your account.', 'aioemp' ),
                        '<strong>' . esc_html( $display_name ) . '</strong>'
                    );
                    ?>
                </p>

                <?php if ( ! empty( $error ) ) : ?>
                    <div class="aioemp-login-error" role="alert">
                        <?php echo esc_html( $error ); ?>
                    </div>
                <?php endif; ?>

                <form method="post" class="aioemp-login-form" autocomplete="off" novalidate>

                    <?php wp_nonce_field( $nonce_action, '_aioemp_setup_nonce' ); ?>

                    <?php // Honeypot ?>
                    <div aria-hidden="true" style="position:absolute;left:-9999px;top:-9999px;height:0;width:0;overflow:hidden;">
                        <label for="<?php echo esc_attr( $honeypot ); ?>"><?php esc_html_e( 'Leave this empty', 'aioemp' ); ?></label>
                        <input type="text"
                               name="<?php echo esc_attr( $honeypot ); ?>"
                               id="<?php echo esc_attr( $honeypot ); ?>"
                               value=""
                               tabindex="-1"
                               autocomplete="off">
                    </div>

                    <div class="aioemp-login-field">
                        <label for="aioemp_new_pwd"><?php esc_html_e( 'New Password', 'aioemp' ); ?></label>
                        <div class="aioemp-login-password-wrap">
                            <input type="password"
                                   name="password"
                                   id="aioemp_new_pwd"
                                   autocomplete="new-password"
                                   minlength="8"
                                   required>
                            <button type="button"
                                    class="aioemp-login-password-toggle"
                                    aria-label="<?php esc_attr_e( 'Show password', 'aioemp' ); ?>">
                                <span class="aioemp-eye-icon">&#128065;</span>
                            </button>
                        </div>
                        <p class="aioemp-login-help"><?php esc_html_e( 'Minimum 8 characters', 'aioemp' ); ?></p>
                    </div>

                    <div class="aioemp-login-field">
                        <label for="aioemp_confirm_pwd"><?php esc_html_e( 'Confirm Password', 'aioemp' ); ?></label>
                        <div class="aioemp-login-password-wrap">
                            <input type="password"
                                   name="password_confirm"
                                   id="aioemp_confirm_pwd"
                                   autocomplete="new-password"
                                   minlength="8"
                                   required>
                            <button type="button"
                                    class="aioemp-login-password-toggle"
                                    aria-label="<?php esc_attr_e( 'Show password', 'aioemp' ); ?>">
                                <span class="aioemp-eye-icon">&#128065;</span>
                            </button>
                        </div>
                    </div>

                    <button type="submit" class="aioemp-login-submit">
                        <?php esc_html_e( 'Set Password', 'aioemp' ); ?>
                    </button>

                </form>

            <?php endif; ?>

        </div>
    </div>
</div>

<script>
(function () {
    // Password visibility toggles.
    var wraps = document.querySelectorAll('.aioemp-login-password-wrap');
    wraps.forEach(function (wrap) {
        var btn = wrap.querySelector('.aioemp-login-password-toggle');
        var input = wrap.querySelector('input');
        if (btn && input) {
            btn.addEventListener('click', function () {
                var isPwd = input.type === 'password';
                input.type = isPwd ? 'text' : 'password';
            });
        }
    });
})();
</script>

<?php wp_footer(); ?>
</body>
</html>
