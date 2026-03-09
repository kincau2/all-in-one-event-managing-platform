<?php
/**
 * Template: Login Form
 *
 * Rendered by the [aioemp_login] shortcode.
 * Themes can override this by placing a copy at: aioemp/login-form.php
 *
 * Available variables (extracted by the shortcode handler):
 *   $nonce_action  string  Nonce action name.
 *   $nonce_field   string  Nonce field name.
 *   $honeypot      string  Honeypot input name.
 *   $error         string  Error message (empty if none).
 *   $username      string  Previously submitted username (for repopulation).
 *   $logo_url      string  Uploaded logo URL (empty if not set).
 *
 * @package AIOEMP
 * @since   0.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}
?>
<?php // Critical overlay styles inlined to guarantee they apply regardless of
      // theme transforms/stacking contexts or late enqueue timing. ?>
<style id="aioemp-login-overlay-critical">
.aioemp-login-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;  /* override .is-layout-constrained > :where(...) */
    min-width: 100vw !important;
    height: 100vh !important;
    max-height: 100vh !important;
    z-index: 2147483647 !important; /* max int32 — beats everything */
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
}
</style>
<div class="aioemp-login-overlay">
    <div class="aioemp-login-wrap">
        <div class="aioemp-login-box">

            <?php // Logo — shared between both panels ?>
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

            <?php // ── Panel 1: Sign In ───────────────────────── ?>
            <div id="aioemp-panel-login">

                <h2 class="aioemp-login-title"><?php esc_html_e( 'Sign In', 'aioemp' ); ?></h2>

                <?php if ( ! empty( $error ) ) : ?>
                    <div class="aioemp-login-error" role="alert">
                        <?php echo esc_html( $error ); ?>
                    </div>
                <?php endif; ?>

                <form method="post" class="aioemp-login-form" autocomplete="on" novalidate>

                    <?php wp_nonce_field( $nonce_action, $nonce_field ); ?>

                    <?php // Honeypot — hidden from real users, bots fill it in. ?>
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
                        <label for="aioemp_log"><?php esc_html_e( 'Username or Email', 'aioemp' ); ?></label>
                        <input type="text"
                               name="aioemp_log"
                               id="aioemp_log"
                               value="<?php echo esc_attr( $username ); ?>"
                               autocomplete="username"
                               required>
                    </div>

                    <div class="aioemp-login-field">
                        <label for="aioemp_pwd"><?php esc_html_e( 'Password', 'aioemp' ); ?></label>
                        <div class="aioemp-login-password-wrap">
                            <input type="password"
                                   name="aioemp_pwd"
                                   id="aioemp_pwd"
                                   autocomplete="current-password"
                                   required>
                            <button type="button"
                                    class="aioemp-login-password-toggle"
                                    aria-label="<?php esc_attr_e( 'Show password', 'aioemp' ); ?>"
                                    data-show="<?php esc_attr_e( 'Show', 'aioemp' ); ?>"
                                    data-hide="<?php esc_attr_e( 'Hide', 'aioemp' ); ?>">
                                <span class="aioemp-eye-icon">&#128065;</span>
                            </button>
                        </div>
                    </div>

                    <div class="aioemp-login-options">
                        <label class="aioemp-login-remember">
                            <input type="checkbox" name="aioemp_remember" value="1">
                            <?php esc_html_e( 'Remember me', 'aioemp' ); ?>
                        </label>
                        <?php // Forgot-password link hidden until backend reset endpoint is implemented. ?>
                        <!-- <a href="#" id="aioemp-forgot-link" class="aioemp-login-forgot">
                            <?php esc_html_e( 'Forgot password?', 'aioemp' ); ?>
                        </a> -->
                    </div>

                    <button type="submit" class="aioemp-login-submit">
                        <?php esc_html_e( 'Sign In', 'aioemp' ); ?>
                    </button>

                </form>

            </div><?php // end #aioemp-panel-login ?>

            <?php // ── Panel 2: Forgot Password (hidden by default) ── ?>
            <div id="aioemp-panel-forgotpw" hidden>

                <h2 class="aioemp-login-title"><?php esc_html_e( 'Reset Password', 'aioemp' ); ?></h2>
                <p class="aioemp-login-subtitle">
                    <?php esc_html_e( 'Enter your email address and we&rsquo;ll send you a reset link.', 'aioemp' ); ?>
                </p>

                <div id="aioemp-forgotpw-body">
                    <div class="aioemp-login-field">
                        <label for="aioemp_reset_email"><?php esc_html_e( 'Email Address', 'aioemp' ); ?></label>
                        <input type="email"
                               id="aioemp_reset_email"
                               name="aioemp_reset_email"
                               autocomplete="email"
                               placeholder="<?php esc_attr_e( 'you@example.com', 'aioemp' ); ?>">
                    </div>

                    <button type="button" id="aioemp-forgotpw-submit" class="aioemp-login-submit">
                        <?php esc_html_e( 'Send Reset Link', 'aioemp' ); ?>
                    </button>

                    <div class="aioemp-forgotpw-footer">
                        <a href="#" id="aioemp-back-link" class="aioemp-back-link">
                            &larr; <?php esc_html_e( 'Back to Sign In', 'aioemp' ); ?>
                        </a>
                    </div>
                </div>

            </div><?php // end #aioemp-panel-forgotpw ?>

        </div>
    </div>
</div>

<script>
(function () {
    /* ── Password visibility toggle ─────────────────────── */
    var wrap = document.querySelector('.aioemp-login-password-wrap');
    if (wrap) {
        var togBtn = wrap.querySelector('.aioemp-login-password-toggle');
        var pwdInput = wrap.querySelector('input');
        if (togBtn && pwdInput) {
            togBtn.addEventListener('click', function () {
                var isPwd = pwdInput.type === 'password';
                pwdInput.type = isPwd ? 'text' : 'password';
                togBtn.setAttribute('aria-label', isPwd ? togBtn.dataset.hide : togBtn.dataset.show);
            });
        }
    }

    /* ── Panel helpers ──────────────────────────────────── */
    var panelLogin    = document.getElementById('aioemp-panel-login');
    var panelForgot   = document.getElementById('aioemp-panel-forgotpw');
    var forgotLink    = document.getElementById('aioemp-forgot-link');
    var backLink      = document.getElementById('aioemp-back-link');
    var forgotSubmit  = document.getElementById('aioemp-forgotpw-submit');
    var forgotBody    = document.getElementById('aioemp-forgotpw-body');
    var forgotEmail   = document.getElementById('aioemp_reset_email');

    function showPanel(panel, other) {
        if (!panel || !other) return;
        other.hidden = true;
        panel.hidden = false;
    }

    /* Show Forgot Password panel */
    if (forgotLink) {
        forgotLink.addEventListener('click', function (e) {
            e.preventDefault();
            showPanel(panelForgot, panelLogin);
            if (forgotEmail) forgotEmail.focus();
        });
    }

    /* Back to Sign In */
    if (backLink) {
        backLink.addEventListener('click', function (e) {
            e.preventDefault();
            showPanel(panelLogin, panelForgot);
        });
    }

    /* Forgot password submit — placeholder (email sending handled in a later phase) */
    if (forgotSubmit) {
        forgotSubmit.addEventListener('click', function () {
            var email = forgotEmail ? forgotEmail.value.trim() : '';
            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
                forgotEmail.focus();
                forgotEmail.style.borderColor = '#d63638';
                return;
            }
            forgotEmail.style.borderColor = '';
            /* Replace panel body with a success message */
            if (forgotBody) {
                forgotBody.innerHTML =
                    '<div class="aioemp-forgotpw-success" role="status">' +
                    '  <span class="aioemp-forgotpw-success__icon">&#10003;</span>' +
                    '  <p><?php echo esc_js( __( 'If an account with that email exists, a reset link will be sent shortly.', 'aioemp' ) ); ?></p>' +
                    '<a href="#" class="aioemp-back-link" id="aioemp-back-link2">&larr; <?php echo esc_js( __( 'Back to Sign In', 'aioemp' ) ); ?></a>' +
                    '</div>';
                var back2 = document.getElementById('aioemp-back-link2');
                if (back2) {
                    back2.addEventListener('click', function (e) {
                        e.preventDefault();
                        showPanel(panelLogin, panelForgot);
                    });
                }
            }
        });
    }
})();
</script>
