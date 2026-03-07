<?php
/**
 * Template: Password Setup Error Page
 *
 * Displayed when a password-setup token is invalid, expired, or already used.
 *
 * Available variables:
 *   $message   string  Error message.
 *   $logo_url  string  Uploaded logo URL (empty if not set).
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
    <title><?php echo esc_html__( 'Password Setup', 'aioemp' ); ?> — <?php bloginfo( 'name' ); ?></title>
    <meta name="robots" content="noindex, nofollow">
    <?php wp_enqueue_style( 'aioemp-public', AIOEMP_PLUGIN_URL . 'public/css/aioemp-public.css', array(), AIOEMP_VERSION ); ?>
    <?php wp_head(); ?>
</head>
<body class="aioemp-setup-password-error-page">

<style id="aioemp-setup-error-critical">
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

            <div class="aioemp-setup-error">
                <div class="aioemp-setup-error__icon">&#9888;</div>
                <h2 class="aioemp-login-title"><?php esc_html_e( 'Link Unavailable', 'aioemp' ); ?></h2>
                <p class="aioemp-login-subtitle">
                    <?php echo esc_html( $message ); ?>
                </p>
                <a href="<?php echo esc_url( wp_login_url() ); ?>" class="aioemp-login-submit" style="display:inline-block;text-align:center;text-decoration:none;margin-top:16px;">
                    <?php esc_html_e( 'Go to Sign In', 'aioemp' ); ?>
                </a>
            </div>

        </div>
    </div>
</div>

<?php wp_footer(); ?>
</body>
</html>
