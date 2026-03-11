<?php
/**
 * Email Templates REST controller.
 *
 * GET  /aioemp/v1/email-templates          — list all templates
 * GET  /aioemp/v1/email-templates/<type>   — get one template + its placeholders
 * PUT  /aioemp/v1/email-templates/<type>   — update a template
 * POST /aioemp/v1/email-templates/<type>/reset — reset to default
 * POST /aioemp/v1/email-templates/<type>/preview — send a test email
 *
 * All endpoints require manage_settings capability.
 *
 * @package AIOEMP
 * @since   0.5.0
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

require_once __DIR__ . '/class-aioemp-rest-controller.php';
require_once AIOEMP_PLUGIN_DIR . 'includes/services/class-aioemp-email-service.php';

class AIOEMP_Email_Templates_Controller extends AIOEMP_REST_Controller {

    protected string $rest_base = 'email-templates';

    /*--------------------------------------------------------------
     * Route registration
     *------------------------------------------------------------*/

    public function register_routes(): void {

        // GET /email-templates — list all templates.
        register_rest_route( $this->namespace, '/' . $this->rest_base, array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'list_templates' ),
                'permission_callback' => array( $this, 'templates_permissions' ),
            ),
        ) );

        // GET + PUT /email-templates/<type>
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<type>[a-z_]+)', array(
            array(
                'methods'             => \WP_REST_Server::READABLE,
                'callback'            => array( $this, 'get_template' ),
                'permission_callback' => array( $this, 'templates_permissions' ),
                'args'                => array(
                    'type' => array(
                        'type'              => 'string',
                        'required'          => true,
                        'sanitize_callback' => 'sanitize_text_field',
                    ),
                ),
            ),
            array(
                'methods'             => \WP_REST_Server::EDITABLE,
                'callback'            => array( $this, 'update_template' ),
                'permission_callback' => array( $this, 'templates_permissions' ),
                'args'                => array(
                    'type'    => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
                    'subject' => array( 'type' => 'string', 'required' => true ),
                    'body'    => array( 'type' => 'string', 'required' => true ),
                ),
            ),
        ) );

        // POST /email-templates/<type>/reset
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<type>[a-z_]+)/reset', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'reset_template' ),
                'permission_callback' => array( $this, 'templates_permissions' ),
                'args'                => array(
                    'type' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
                ),
            ),
        ) );

        // POST /email-templates/<type>/preview
        register_rest_route( $this->namespace, '/' . $this->rest_base . '/(?P<type>[a-z_]+)/preview', array(
            array(
                'methods'             => \WP_REST_Server::CREATABLE,
                'callback'            => array( $this, 'send_preview' ),
                'permission_callback' => array( $this, 'templates_permissions' ),
                'args'                => array(
                    'type' => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ),
                    'to'   => array( 'type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_email' ),
                ),
            ),
        ) );
    }

    /*--------------------------------------------------------------
     * Permissions
     *------------------------------------------------------------*/

    public function templates_permissions(): bool|\WP_Error {
        return $this->check_permission( AIOEMP_Security::CAPS['manage_settings'] );
    }

    /*--------------------------------------------------------------
     * Callbacks
     *------------------------------------------------------------*/

    /**
     * Extract and sanitize the optional ?lang query parameter.
     */
    private function get_locale( \WP_REST_Request $request ): ?string {
        $lang = $request->get_param( 'lang' );
        if ( empty( $lang ) ) {
            return null;
        }
        $lang = preg_replace( '/[^a-zA-Z0-9_\-]/', '', $lang );
        return $lang ?: null;
    }

    /**
     * GET /email-templates — list all templates with labels and placeholders.
     */
    public function list_templates( \WP_REST_Request $request ): \WP_REST_Response {
        $locale    = $this->get_locale( $request );
        $templates = AIOEMP_Email_Service::get_all( $locale );
        $result    = array();

        foreach ( $templates as $type => $tpl ) {
            $item = array(
                'type'         => $type,
                'label'        => AIOEMP_Email_Service::TEMPLATE_LABELS[ $type ] ?? $type,
                'subject'      => $tpl['subject'],
                'body'         => $tpl['body'],
                'placeholders' => AIOEMP_Email_Service::get_placeholders( $type ),
            );
            if ( $locale ) {
                $item['has_custom'] = AIOEMP_Email_Service::has_locale_template( $type, $locale );
            }
            $result[] = $item;
        }

        return $this->success( $result );
    }

    /**
     * GET /email-templates/<type> — get a single template.
     */
    public function get_template( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $type   = $request->get_param( 'type' );
        $locale = $this->get_locale( $request );

        if ( ! in_array( $type, AIOEMP_Email_Service::TEMPLATE_TYPES, true ) ) {
            return $this->error( 'invalid_type', __( 'Unknown email template type.', 'aioemp' ), 404 );
        }

        $tpl  = AIOEMP_Email_Service::get( $type, $locale );
        $data = array(
            'type'         => $type,
            'label'        => AIOEMP_Email_Service::TEMPLATE_LABELS[ $type ] ?? $type,
            'subject'      => $tpl['subject'],
            'body'         => $tpl['body'],
            'placeholders' => AIOEMP_Email_Service::get_placeholders( $type ),
        );
        if ( $locale ) {
            $data['has_custom'] = AIOEMP_Email_Service::has_locale_template( $type, $locale );
        }

        return $this->success( $data );
    }

    /**
     * PUT /email-templates/<type> — update a template's subject and body.
     */
    public function update_template( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $type    = $request->get_param( 'type' );
        $subject = $request->get_param( 'subject' );
        $body    = $request->get_param( 'body' );
        $locale  = $this->get_locale( $request );

        if ( ! in_array( $type, AIOEMP_Email_Service::TEMPLATE_TYPES, true ) ) {
            return $this->error( 'invalid_type', __( 'Unknown email template type.', 'aioemp' ), 404 );
        }

        if ( empty( $subject ) ) {
            return $this->error( 'empty_subject', __( 'Email subject cannot be empty.', 'aioemp' ) );
        }
        if ( empty( $body ) ) {
            return $this->error( 'empty_body', __( 'Email body cannot be empty.', 'aioemp' ) );
        }

        AIOEMP_Email_Service::update_template( $type, $subject, $body, $locale );

        $tpl = AIOEMP_Email_Service::get( $type, $locale );

        return $this->success( array(
            'type'         => $type,
            'label'        => AIOEMP_Email_Service::TEMPLATE_LABELS[ $type ] ?? $type,
            'subject'      => $tpl['subject'],
            'body'         => $tpl['body'],
            'placeholders' => AIOEMP_Email_Service::get_placeholders( $type ),
        ) );
    }

    /**
     * POST /email-templates/<type>/reset — reset a template to its default.
     */
    public function reset_template( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $type   = $request->get_param( 'type' );
        $locale = $this->get_locale( $request );

        if ( ! in_array( $type, AIOEMP_Email_Service::TEMPLATE_TYPES, true ) ) {
            return $this->error( 'invalid_type', __( 'Unknown email template type.', 'aioemp' ), 404 );
        }

        AIOEMP_Email_Service::reset_template( $type, $locale );

        $tpl = AIOEMP_Email_Service::get( $type, $locale );

        return $this->success( array(
            'type'         => $type,
            'label'        => AIOEMP_Email_Service::TEMPLATE_LABELS[ $type ] ?? $type,
            'subject'      => $tpl['subject'],
            'body'         => $tpl['body'],
            'placeholders' => AIOEMP_Email_Service::get_placeholders( $type ),
        ) );
    }

    /**
     * POST /email-templates/<type>/preview — send a test/preview email.
     *
     * Populates all placeholders with sample data so the admin can
     * see how the final email will look.
     */
    public function send_preview( \WP_REST_Request $request ): \WP_REST_Response|\WP_Error {
        $type = $request->get_param( 'type' );
        $to   = sanitize_email( $request->get_param( 'to' ) );

        if ( ! in_array( $type, AIOEMP_Email_Service::TEMPLATE_TYPES, true ) ) {
            return $this->error( 'invalid_type', __( 'Unknown email template type.', 'aioemp' ), 404 );
        }

        if ( ! is_email( $to ) ) {
            return $this->error( 'invalid_email', __( 'Please provide a valid email address.', 'aioemp' ) );
        }

        // Build sample data for placeholders.
        $sample = self::get_sample_variables( $type );
        $locale = $this->get_locale( $request );

        $sent = AIOEMP_Email_Service::send( $type, $to, $sample, $locale );

        if ( ! $sent ) {
            return $this->error( 'send_failed', __( 'Failed to send the preview email. Check your server\'s mail configuration.', 'aioemp' ), 500 );
        }

        return $this->success( array( 'sent' => true, 'to' => $to ) );
    }

    /*--------------------------------------------------------------
     * Helpers
     *------------------------------------------------------------*/

    /**
     * Generate sample placeholder values for preview emails.
     *
     * @param string $type Template type.
     * @return array<string, string>
     */
    private static function get_sample_variables( string $type ): array {
        $common = array(
            'first_name'     => 'John',
            'last_name'      => 'Smith',
            'full_name'      => 'John Smith',
            'email'          => 'john.smith@example.com',
            'event_title'    => 'Annual Gala Dinner 2026',
            'event_date'     => '15 March 2026, 7:00 PM',
            'event_location' => 'Grand Ballroom, The Peninsula Hong Kong',
            'ticket_url'     => home_url( 'e-ticket/a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678' ),
            'qr_code_url'    => home_url( 'e-ticket/a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678' ),
            'seat_label'     => 'A-08',
            'online_url'     => 'https://zoom.us/j/123456789',
        );

        $user_specific = array(
            'display_name' => 'Jane Doe',
            'user_login'   => 'jane.doe',
            'user_email'   => 'jane.doe@example.com',
            'setup_url'    => home_url( 'setup-password/preview-sample-token' ),
            'role_name'    => 'AIOEMP Event Manager',
        );

        return array_merge( $common, $user_specific );
    }
}
