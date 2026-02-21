<?php
/**
 * Plugin Name:       All-in-One Event Managing Platform
 * Plugin URI:        
 * Description:       All-in-one event managing platform with registration, QR check-in, seatmap builder, and admin dashboard.
 * Version:           0.1.0
 * Author:            Louis Au
 * Author URI:        
 * License:           GPL-2.0+
 * License URI:       http://www.gnu.org/licenses/gpl-2.0.txt
 * Text Domain:       aioemp
 * Domain Path:       /languages
 *
 * @package           AIOEMP
 * @since             0.1.0
 */

// If this file is called directly, abort.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/*--------------------------------------------------------------
 * Constants
 *------------------------------------------------------------*/
define( 'AIOEMP_VERSION', '0.1.0' );
define( 'AIOEMP_DB_VERSION', '1.1.0' );
define( 'AIOEMP_PLUGIN_FILE', __FILE__ );
define( 'AIOEMP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'AIOEMP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'AIOEMP_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/*--------------------------------------------------------------
 * Autoload includes
 *------------------------------------------------------------*/
require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-loader.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-security.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-activator.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/class-aioemp-deactivator.php';

/*--------------------------------------------------------------
 * Activation & Deactivation hooks
 *------------------------------------------------------------*/
register_activation_hook( __FILE__, array( 'AIOEMP_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'AIOEMP_Deactivator', 'deactivate' ) );

/*--------------------------------------------------------------
 * Boot the plugin
 *------------------------------------------------------------*/
/**
 * Returns the singleton plugin loader instance.
 *
 * @since  0.1.0
 * @return AIOEMP_Loader
 */
function aioemp(): AIOEMP_Loader {
    return AIOEMP_Loader::get_instance();
}

// Kick off.
aioemp()->run();