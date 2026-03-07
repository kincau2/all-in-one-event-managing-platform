<?php
/**
 * Admin SPA shell template.
 *
 * Full-screen overlay that hides default WP admin chrome.
 * Design reference: Star Admin 2 Pro (vertical-boxed).
 *
 * @package AIOEMP
 * @since   0.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Current user info for top bar.
$current_user = wp_get_current_user();
$display_name = esc_html( $current_user->display_name ?: $current_user->user_login );
$avatar_initial = esc_html( mb_strtoupper( mb_substr( $display_name, 0, 1 ) ) );
?>
<div id="aioemp-app" class="aioemp-app">

    <!-- ============================================================== -->
    <!-- Sidebar                                                        -->
    <!-- ============================================================== -->
    <aside id="aioemp-sidebar" class="aioemp-sidebar">

        <div class="aioemp-sidebar__brand">
            <span class="aioemp-sidebar__brand-icon">
                <span class="dashicons dashicons-calendar-alt"></span>
            </span>
            <span class="aioemp-sidebar__brand-text"><?php echo esc_html__( 'Event Manager', 'aioemp' ); ?></span>
        </div>

        <span class="aioemp-sidebar__section"><?php echo esc_html__( 'Main Menu', 'aioemp' ); ?></span>

        <nav class="aioemp-sidebar__nav" aria-label="<?php echo esc_attr__( 'Event Manager Navigation', 'aioemp' ); ?>">
            <ul class="aioemp-sidebar__menu">
                <?php if ( current_user_can( AIOEMP_Security::CAPS['view_events'] ) ) : ?>
                <li>
                    <a href="#events" class="aioemp-nav-link" data-route="events">
                        <span class="dashicons dashicons-calendar"></span>
                        <?php echo esc_html__( 'Events', 'aioemp' ); ?>
                    </a>
                </li>
                <?php endif; ?>
                <?php if ( current_user_can( AIOEMP_Security::CAPS['view_seatmaps'] ) ) : ?>
                <li>
                    <a href="#seatmaps" class="aioemp-nav-link" data-route="seatmaps">
                        <span class="dashicons dashicons-layout"></span>
                        <?php echo esc_html__( 'Seatmaps', 'aioemp' ); ?>
                    </a>
                </li>
                <?php endif; ?>
                <?php if ( current_user_can( AIOEMP_Security::CAPS['manage_settings'] ) ) : ?>
                <li>
                    <a href="#users" class="aioemp-nav-link" data-route="users">
                        <span class="dashicons dashicons-admin-users"></span>
                        <?php echo esc_html__( 'Users', 'aioemp' ); ?>
                    </a>
                </li>
                <li>
                    <a href="#settings" class="aioemp-nav-link" data-route="settings">
                        <span class="dashicons dashicons-admin-generic"></span>
                        <?php echo esc_html__( 'Settings', 'aioemp' ); ?>
                    </a>
                </li>
                <li>
                    <a href="#emails" class="aioemp-nav-link" data-route="emails">
                        <span class="dashicons dashicons-email-alt"></span>
                        <?php echo esc_html__( 'Emails', 'aioemp' ); ?>
                    </a>
                </li>
                <?php endif; ?>
            </ul>
        </nav>

    </aside>

    <!-- ============================================================== -->
    <!-- Body (topbar + content)                                        -->
    <!-- ============================================================== -->
    <div class="aioemp-body">

        <header class="aioemp-topbar">
            <div class="aioemp-topbar__left">
                <button type="button"
                        class="aioemp-topbar__toggle aioemp-btn--outline"
                        id="aioemp-toggle-sidebar"
                        aria-label="<?php echo esc_attr__( 'Toggle sidebar', 'aioemp' ); ?>">
                    <span class="dashicons dashicons-menu"></span>
                </button>
                <h1 id="aioemp-page-title" class="aioemp-topbar__title"></h1>
            </div>
            <div class="aioemp-topbar__right">
                <a href="<?php echo esc_url( admin_url() ); ?>" class="aioemp-topbar__btn-back">
                    <span class="dashicons dashicons-arrow-left-alt"></span>
                    <?php echo esc_html__( 'WP Dashboard', 'aioemp' ); ?>
                </a>
                <div class="aioemp-topbar__account">
                    <div class="aioemp-topbar__user">
                        <span class="aioemp-topbar__avatar"><?php echo $avatar_initial; // Already escaped. ?></span>
                        <span><?php echo $display_name; // Already escaped. ?></span>
                        <span class="dashicons dashicons-arrow-down-alt2 aioemp-topbar__caret"></span>
                    </div>
                    <div class="aioemp-topbar__dropdown">
                        <a href="#profile" class="aioemp-topbar__dropdown-item">
                            <span class="dashicons dashicons-admin-users"></span>
                            <?php echo esc_html__( 'Profile Settings', 'aioemp' ); ?>
                        </a>
                        <a href="<?php echo esc_url( wp_logout_url( home_url() ) ); ?>" class="aioemp-topbar__dropdown-item aioemp-topbar__dropdown-item--logout">
                            <span class="dashicons dashicons-exit"></span>
                            <?php echo esc_html__( 'Logout', 'aioemp' ); ?>
                        </a>
                    </div>
                </div>
            </div>
        </header>

        <main id="aioemp-content" class="aioemp-content">
            <p><?php echo esc_html__( 'Loading…', 'aioemp' ); ?></p>
        </main>

    </div>
</div>

