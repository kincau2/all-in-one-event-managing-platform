<?php
/**
 * Template: Ticket Error Page
 *
 * Shown when a QR hash is invalid or no matching attender is found.
 *
 * Available variables:
 *   $message  string  Error message.
 *
 * @package AIOEMP
 * @since   0.8.0
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
    <meta name="robots" content="noindex, nofollow">
    <title><?php esc_html_e( 'Ticket Not Found', 'aioemp' ); ?></title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
                         Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
            background: #f0f2f5;
            color: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px 16px;
        }
        .aioemp-ticket-error {
            width: 100%;
            max-width: 400px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
            text-align: center;
            padding: 48px 32px;
        }
        .aioemp-ticket-error__icon {
            font-size: 48px;
            margin-bottom: 16px;
        }
        .aioemp-ticket-error__title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #333;
        }
        .aioemp-ticket-error__message {
            font-size: 15px;
            color: #888;
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="aioemp-ticket-error">
        <div class="aioemp-ticket-error__icon">&#9888;&#65039;</div>
        <h1 class="aioemp-ticket-error__title"><?php esc_html_e( 'Ticket Not Found', 'aioemp' ); ?></h1>
        <p class="aioemp-ticket-error__message"><?php echo esc_html( $message ); ?></p>
    </div>
</body>
</html>
