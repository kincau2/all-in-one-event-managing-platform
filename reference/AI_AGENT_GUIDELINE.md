# AIOEMP — AI Agent Development Guideline

**All-in-One Event Managing Platform (AIOEMP)**
Version 1.6 | 11 Mar 2026

---

> **Purpose of this document:** This is the single source of truth for any AI agent working on the AIOEMP WordPress plugin. Read this document **in full** before writing any code. All implementation decisions must conform to the rules, schemas, flows, and security requirements described below.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack & Constraints](#2-technology-stack--constraints)
3. [Security Requirements (Penetration-Test Ready)](#3-security-requirements-penetration-test-ready)
4. [Database Schema](#4-database-schema)
5. [Plugin Architecture & File Structure](#5-plugin-architecture--file-structure)
6. [Admin Dashboard (SPA Shell)](#6-admin-dashboard-spa-shell)
7. [Events Module](#7-events-module)
8. [Candidates / Attenders Module](#8-candidates--attenders-module)
9. [Attendance & Check-In Module](#9-attendance--check-in-module)
10. [Seatmap Templates & Parametric Builder](#10-seatmap-templates--parametric-builder)
11. [Event Seatmap Snapshot & Seating Allocation](#11-event-seatmap-snapshot--seating-allocation)
12. [Editor Locking (WP-Style Exclusive Edit)](#12-editor-locking-wp-style-exclusive-edit)
13. [Users & Role Management Module](#13-users--role-management-module)
14. [Public Frontend (Login, Ticket Page)](#14-public-frontend-login-ticket-page)
15. [Public Registration & External REST API](#15-public-registration--external-rest-api)
16. [Email & Communications](#16-email--communications)
17. [Settings Module](#17-settings-module)
18. [Non-Functional & Compliance Requirements](#18-non-functional--compliance-requirements)
19. [Build Milestones (Recommended Order)](#19-build-milestones-recommended-order)
20. [Reference Documents](#20-reference-documents)
21. [Implementation Progress (as of 11 Mar 2026)](#21-implementation-progress-as-of-11-mar-2026)

---

## 1. Project Overview

AIOEMP is a **custom WordPress plugin** that provides an all-in-one platform for event management, including:

- **Event CRUD** with draft/published/closed lifecycle.
- **Candidate (attender) registration** — public-facing, no login required, duplicate emails allowed.
- **QR-based check-in/out** with a confirm step, sequence validation, force-override, and append-only attendance log.
- **Parametric seatmap builder** for creating reusable seatmap templates.
- **Per-event seatmap snapshots** with seat assignment, blocking, swapping — including denormalised `checked_in` flag and purple seat colouring for checked-in attendees.
- **WP-style editor locking** (one editor at a time) for seatmaps and events.
- **Custom AIOEMP roles & capabilities** with fine-grained access control (Admin, Event Manager, Seating Coordinator, Seatmap Designer, Scanner Operator).
- **User management dashboard** — create WP users, assign/remove AIOEMP roles, profile editing.
- **Login shortcode** (`[aioemp_login]`) — standalone login form with CSRF, honeypot, rate limiting.
- **Virtual ticket page** (`/e-ticket/{hash}`) — public attendee ticket display with QR code, event info, seat label.
- **Admin SPA dashboard** within wp-admin with capability-gated navigation.
- **Email automation** for acknowledgement, status changes, and QR delivery _(not yet implemented)_.
- **Public registration form** (shortcode/block) and **external REST API** for third-party sites _(not yet implemented)_.

---

## 2. Technology Stack & Constraints

| Layer | Technology |
|---|---|
| CMS | WordPress (latest stable) |
| Frontend (public) | Elementor-based pages, client-provided design/mockups |
| Admin Dashboard | SPA-style shell inside wp-admin (client-side routing, AJAX/REST) |
| Seatmap Builder | Konva.js + React (react-konva) — preferred rendering stack |
| State Management | Zustand 5 + Immer |
| Schema Validation | Zod (layout schema) |
| IDs | Custom `generateUUID()` using `crypto.randomUUID()` (stable primitive/seat IDs) |
| QR Scanning | html5-qrcode vendor library (camera) + HID scanner (keyboard input) |
| Backend | PHP (WordPress plugin API, custom REST endpoints) |
| Database | WordPress $wpdb with custom tables (prefixed `aioemp_`) |
| Email | WordPress `wp_mail()` with configurable templates |

### Key Constraints

- **Do NOT use** external JS frameworks for the admin shell beyond what is needed — keep it lightweight.
- **All dates/times** stored as GMT/UTC in the database (`_gmt` suffix columns).
- **All JSON** stored as LONGTEXT in MySQL; validate with Zod on the client and PHP schema checks on the server.
- The seatmap builder is a **reusable library** with two packages: `@aioemp/seatmap-core` (headless logic) and `@aioemp/seatmap-editor` (UI).

---

## 3. Security Requirements (Penetration-Test Ready)

> **CRITICAL:** This project will undergo a professional penetration test. Every feature must be implemented following **industry-standard security practices**. Security is not an afterthought — it must be built into every layer from day one.

### 3.1 General Principles

- **Defence in depth:** Never rely on a single security control. Layer multiple protections (capability checks + nonce + input validation + output escaping).
- **Least privilege:** Grant only the minimum capabilities needed. Use custom capabilities where appropriate.
- **Fail secure:** On any error or unexpected state, deny access rather than granting it.
- **No security through obscurity:** Assume attackers have full knowledge of the codebase.

### 3.2 Authentication, Authorization & Custom Roles

- **Every** admin REST endpoint and AJAX handler must verify the user is authenticated (`is_user_logged_in()`) and has the required capability (`current_user_can()`).
- **Server-side enforcement is mandatory.** Never trust client-side UI state to control access. Even if a button is hidden in the UI, the server must independently verify permissions.

#### Custom Capabilities (13 total)

All capabilities are defined in `AIOEMP_Security::CAPS`:

| Key | WP Capability String | Purpose |
|---|---|---|
| `access_plugin` | `aioemp_access_plugin` | Access the admin dashboard (min capability for menu visibility) |
| `view_events` | `aioemp_view_events` | View events list and event detail pages |
| `manage_events` | `aioemp_manage_events` | Create, edit, delete events |
| `view_candidates` | `aioemp_view_candidates` | View candidates tab |
| `manage_candidates` | `aioemp_manage_candidates` | Create, edit, delete, bulk-status candidates |
| `view_attendance` | `aioemp_view_attendance` | View attendance logs and stats |
| `manage_attendance` | `aioemp_manage_attendance` | (Reserved for future write-level attendance operations) |
| `manage_seating` | `aioemp_manage_seating` | Seat assign/unassign/swap/block in the seating tab |
| `view_seatmaps` | `aioemp_view_seatmaps` | View seatmap templates list |
| `manage_seatmaps` | `aioemp_manage_seatmaps` | Create/edit/delete seatmap templates |
| `manage_settings` | `aioemp_manage_settings` | Plugin settings, user/role management |
| `scan_attendance` | `aioemp_scan_attendance` | QR scanner check-in/out operations |
| `view_reports` | `aioemp_view_reports` | (Reserved for future reporting features) |

#### Custom AIOEMP Roles (5 roles)

Defined in `AIOEMP_Security::ROLES`. Created/updated on plugin activation via `register_roles()`:

| Role Slug | Display Name | Capabilities |
|---|---|---|
| `aioemp_admin` | AIOEMP Admin | All 13 capabilities |
| `aioemp_event_manager` | AIOEMP Event Manager | access_plugin, view/manage events, view/manage candidates, view/manage attendance, manage_seating, view_seatmaps, view_reports |
| `aioemp_seating_coordinator` | AIOEMP Seating Coordinator | access_plugin, view_events, view_candidates, manage_seating, view_seatmaps |
| `aioemp_seatmap_designer` | AIOEMP Seatmap Designer | access_plugin, view/manage seatmaps |
| `aioemp_scanner` | AIOEMP Scanner Operator | access_plugin, view_events, scan_attendance |

WordPress `administrator` role automatically receives all 13 AIOEMP capabilities on activation.

#### Frontend Capability Gating

- `user_caps` is passed to the JS SPA via `wp_localize_script()` and exposed as `window.aioemp.user_caps`.
- The `window.aioemp_userCan(key)` helper checks capabilities client-side — used to show/hide sidebar nav items, tabs, and action buttons.
- **Client-side gating is UI-only** — the server independently enforces permissions on every API call.

### 3.3 Nonce Validation

- **Every** state-changing request (POST, PUT, DELETE) must include and validate a WordPress nonce.
- Use `wp_create_nonce()` / `wp_verify_nonce()` for AJAX, or the REST API `WP_REST_Request` permission callbacks.
- Nonces must be scoped to specific actions (e.g., `aioemp_save_event_{id}`), not generic.

### 3.4 Input Validation & Sanitization

- **Validate ALL inputs server-side** — type, length, format, allowed values. Never trust client input.
- Use **strict allowlist validation** for enum fields (status, venue_mode, type, etc.).
- Enforce **maximum field lengths** matching the database column sizes.
- Use WordPress sanitization functions: `sanitize_text_field()`, `sanitize_email()`, `absint()`, `wp_kses()`, etc.
- For JSON payloads: decode, validate against a schema, reject if malformed.
- **Reject unexpected fields** — do not blindly pass user input to database queries.

### 3.5 Output Escaping (XSS Prevention)

- **Escape all output** rendered in HTML using `esc_html()`, `esc_attr()`, `esc_url()`, `wp_kses_post()`.
- In JavaScript contexts, use `wp_json_encode()` to safely pass data.
- Never use `echo $variable` without escaping. No exceptions.
- For the React/Konva frontend: be aware of `dangerouslySetInnerHTML` — avoid it entirely unless absolutely necessary, and sanitize first.

### 3.6 SQL Injection Prevention

- **Always** use `$wpdb->prepare()` for any query containing user-supplied values.
- Never concatenate user input directly into SQL strings.
- Use parameterized queries exclusively — even for "trusted" admin inputs.
- For `IN (...)` clauses, build the placeholder list programmatically with the correct number of `%s` or `%d` placeholders.

### 3.7 CSRF Protection

- Covered by nonce validation (section 3.3). Ensure all destructive actions are POST-based with nonce verification.
- Public REST API endpoints that are truly public (registration) are exempt from nonce but must have other protections (see section 15).
- The `[aioemp_login]` shortcode uses its own scoped nonce (`aioemp_login_form`) plus a honeypot field.

### 3.8 Rate Limiting & Abuse Prevention

- **Public endpoints** (registration, QR scan API, login form) must implement rate limiting per IP and per event.
- Use WordPress transients or a dedicated mechanism for tracking request counts.
- Return `429 Too Many Requests` when limits are exceeded.
- Log and monitor suspicious patterns (e.g., repeated failed QR scans, mass registration attempts).
- The login form limits to 5 attempts per IP per 5-minute window.

### 3.9 CORS Policy

- For the external registration API: configure a strict CORS allowlist for known frontend origins.
- Do NOT use `Access-Control-Allow-Origin: *` in production.
- CORS is supplementary — always validate server-side regardless of origin headers.

### 3.10 Bot Mitigation

- Public registration endpoints should support **CAPTCHA/Turnstile** verification, with the token verified server-side.
- Make CAPTCHA configurable in plugin settings (provider, site key, secret key).
- The login shortcode includes a **honeypot field** (`aioemp_website_url`) that must remain empty — bots that fill it are silently rejected.

### 3.11 Data Protection & Privacy

- QR tokens/hashes: store as `SHA-256` hex digests (CHAR(64)). Do NOT store raw tokens if possible.
- Avoid logging or exposing PII in error messages, debug output, or REST error responses.
- Implement data handling aligned with Privacy Policy and Personal Information Collection Statement requirements.
- Provide mechanisms for data export and deletion to support privacy compliance.

### 3.12 File Upload Security (Settings — Logo)

- Validate MIME type server-side (not just file extension).
- Restrict to allowed image types only (JPEG, PNG, GIF, WebP, SVG with sanitization).
- Use WordPress media library APIs (`wp_handle_upload()`, `wp_check_filetype()`).
- Sanitize SVG files to remove embedded scripts if SVG is allowed.

### 3.13 Error Handling

- Return **generic error messages** to clients. Never expose stack traces, file paths, database details, or internal logic.
- Log detailed errors server-side using `error_log()` or a dedicated logging mechanism.
- Use appropriate HTTP status codes (400, 401, 403, 404, 429, 500).
- The login form uses generic "Invalid username or password" to prevent username enumeration.

### 3.14 Dependency & Supply Chain Security

- Pin JS dependency versions in `package.json` (use exact versions or lock files).
- Audit dependencies regularly (`npm audit`).
- Minimize third-party PHP dependencies; prefer WordPress core functions.

### 3.15 Security Headers

- Where the plugin controls output (e.g., admin SPA pages), set appropriate headers:
  - `Content-Type` with correct charset.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN` (or use CSP frame-ancestors)
  - `Referrer-Policy: strict-origin-when-cross-origin`
- Support Content Security Policy where feasible.
- Virtual ticket page and login form use `nocache_headers()` to prevent caching of session-dependent pages.

### 3.16 Audit Logging

- All sensitive operations must be logged to `aioemp_event_log` / `aioemp_seat_assignment_log`:
  - Lock acquire/release/takeover.
  - Candidate status changes (individual and bulk).
  - Seat assign/unassign/swap/block.
  - Attendance check-in/out.
  - Admin setting changes.
- Log entries must include: who (user_id), what (action), when (timestamp), previous value, new value.

---

## 4. Database Schema

All custom tables use the WordPress table prefix + `aioemp_`. No WordPress core tables are modified.

### 4.1 Tables Overview

| Table | Purpose |
|---|---|
| `aioemp_events` | Event records with status, capacity, venue mode, seatmap snapshot, lock fields |
| `aioemp_event_meta` | Flexible key-value metadata for events |
| `aioemp_event_log` | Audit log for event-related actions |
| `aioemp_attender` | Candidate/registrant records per event (includes `preferred_language`) |
| `aioemp_attendance` | Append-only check-in/out log |
| `aioemp_seatmap` | Reusable seatmap templates (status, layout JSON, integrity flag, lock fields, timestamps) |
| `aioemp_seatmap_meta` | Flexible key-value metadata for seatmaps |
| `aioemp_seat_assignment` | Current seat-to-candidate assignments per event (includes `checked_in` flag) |
| `aioemp_blocked_seat` | Blocked seats per event |
| `aioemp_seat_assignment_log` | Audit log for seat operations |

### 4.2 Table Definitions

#### aioemp_events

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| title | VARCHAR(255) NOT NULL | |
| description | TEXT NULL | |
| status | VARCHAR(32) NOT NULL | draft / published / closed |
| start_date_gmt | DATETIME NULL | UTC |
| end_date_gmt | DATETIME NULL | UTC |
| capacity | INT UNSIGNED NULL | |
| venue_mode | VARCHAR(32) NULL | onsite / online / mixed |
| location_name | VARCHAR(255) NULL | |
| location_address | TEXT NULL | |
| online_url | VARCHAR(500) NULL | |
| cover_img_url | VARCHAR(500) NULL | |
| seatmap_id | BIGINT UNSIGNED NULL | FK to seatmap template |
| seatmap_layout_snapshot | LONGTEXT NULL | JSON snapshot from template |
| seatmap_finalized_at_gmt | DATETIME NULL | Once set, snapshot is frozen |
| lock_user_id | BIGINT UNSIGNED NULL | WP user ID |
| lock_token | CHAR(36) NULL | UUID v4 |
| lock_expires_at_gmt | DATETIME NULL | Lease expiry |
| lock_updated_at_gmt | DATETIME NULL | Last heartbeat |
| created_by | BIGINT UNSIGNED NULL | WP user ID who created the event |
| created_at_gmt | DATETIME NOT NULL | Default current UTC |

**Indexes:** INDEX(status), INDEX(start_date_gmt), INDEX(lock_expires_at_gmt)

#### aioemp_event_meta

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| event_id | BIGINT UNSIGNED NOT NULL | FK to events |
| meta_key | VARCHAR(191) NOT NULL | 191 for utf8mb4 index |
| meta_value | LONGTEXT NULL | |

**Indexes:** INDEX(event_id, meta_key), INDEX(meta_key)

#### aioemp_event_log

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| event_id | BIGINT UNSIGNED NOT NULL | |
| modified_by | BIGINT UNSIGNED NULL | WP user ID |
| action | VARCHAR(64) NOT NULL | e.g. seat_assign, lock_takeover, attendance_in, attendance_out |
| previous_value | LONGTEXT NULL | JSON |
| new_value | LONGTEXT NULL | JSON |
| created_at_gmt | DATETIME NOT NULL | |

**Indexes:** INDEX(event_id, created_at_gmt), INDEX(action)

#### aioemp_attender

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| event_id | BIGINT UNSIGNED NOT NULL | |
| title | VARCHAR(32) NULL | Mr/Ms/Dr |
| first_name | VARCHAR(100) NULL | |
| last_name | VARCHAR(100) NULL | |
| company | VARCHAR(190) NULL | |
| email | VARCHAR(190) NULL | |
| preferred_language | VARCHAR(10) NULL | Locale code (e.g. `en_US`, `zh_TW`) for multi-language email templates |
| online_url | VARCHAR(500) NULL | Per-candidate online meeting URL (e.g. unique Zoom link) |
| qrcode_hash | CHAR(64) NOT NULL | SHA-256 hex |
| created_at_gmt | DATETIME NOT NULL | Registration timestamp (UTC) |
| status | VARCHAR(32) NOT NULL | Default `'registered'` |

**Indexes:** INDEX(event_id), INDEX(event_id, last_name), INDEX(event_id, email), UNIQUE(qrcode_hash)

> **Note:** Duplicate registrations with the same email for the same event are allowed by design. Do NOT add a UNIQUE(event_id, email) constraint.

#### aioemp_attendance

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| event_id | BIGINT UNSIGNED NOT NULL | |
| attender_id | BIGINT UNSIGNED NOT NULL | |
| type | VARCHAR(8) NOT NULL | "IN" / "OUT" |
| scanned_by | BIGINT UNSIGNED NULL | WP user ID |
| device_id | VARCHAR(64) NULL | Auto-detected device model string (e.g. "iPhone", "Mac / Chrome") |
| scanned_at_gmt | DATETIME NOT NULL | |

**Indexes:** INDEX(event_id, attender_id, scanned_at_gmt), INDEX(event_id, scanned_at_gmt)

> **This table is append-only.** Records are never updated or deleted.

#### aioemp_seatmap

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| title | VARCHAR(255) NOT NULL | |
| status | VARCHAR(32) NOT NULL | Default `'draft'` |
| layout | LONGTEXT NOT NULL | JSON (primitives + compiled seats) |
| integrity_pass | TINYINT(1) NOT NULL DEFAULT 0 | Compile integrity check flag |
| lock_user_id | BIGINT UNSIGNED NULL | |
| lock_token | CHAR(36) NULL | |
| lock_expires_at_gmt | DATETIME NULL | |
| lock_updated_at_gmt | DATETIME NULL | |
| updated_at_gmt | DATETIME NULL | Auto-set on every update |
| created_at_gmt | DATETIME NOT NULL | Creation timestamp (UTC) |

**Indexes:** INDEX(status), INDEX(lock_expires_at_gmt)

#### aioemp_seatmap_meta

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| seatmap_id | BIGINT UNSIGNED NOT NULL | |
| meta_key | VARCHAR(191) NOT NULL | |
| meta_value | LONGTEXT NULL | |

**Indexes:** INDEX(seatmap_id, meta_key), INDEX(meta_key)

#### aioemp_seat_assignment

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| event_id | BIGINT UNSIGNED NOT NULL | |
| attender_id | BIGINT UNSIGNED NOT NULL | |
| seat_key | VARCHAR(64) NOT NULL | Stable seat ID (UUID-like) |
| checked_in | TINYINT(1) NOT NULL DEFAULT 0 | Denormalised check-in flag (synced on every check-in/out API call; `1` = checked in, `0` = not checked in) |
| assigned_by | BIGINT UNSIGNED NULL | WP user ID |
| assigned_at_gmt | DATETIME NOT NULL | |

**Constraints:** UNIQUE(event_id, seat_key), UNIQUE(event_id, attender_id), INDEX(event_id)

> **`checked_in` behaviour:** Updated by the attendance controller on every check-in/out. Preserved (carried across) during seat swap and batch reassignment. Used by the seating tab to colour checked-in seats purple (`#7c3aed`). Also exposed to the candidates tab for an "Attendance" column badge.

#### aioemp_blocked_seat

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| event_id | BIGINT UNSIGNED NOT NULL | |
| seat_key | VARCHAR(64) NOT NULL | |
| blocked_by | BIGINT UNSIGNED NULL | WP user ID |
| blocked_at_gmt | DATETIME NOT NULL | |

**Constraints:** UNIQUE(event_id, seat_key), INDEX(event_id)

#### aioemp_seat_assignment_log

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| event_id | BIGINT UNSIGNED NOT NULL | |
| attender_id | BIGINT UNSIGNED NULL | |
| modified_by | BIGINT UNSIGNED NULL | WP user ID |
| original_seat | VARCHAR(64) NULL | seat_key |
| new_seat | VARCHAR(64) NULL | seat_key |
| reason | VARCHAR(64) NULL | assign/unassign/swap/auto/block/unblock |
| created_at_gmt | DATETIME NOT NULL | |

**Indexes:** INDEX(event_id, created_at_gmt), INDEX(attender_id, created_at_gmt)

### 4.3 Database Installation Rules

- Use `dbDelta()` via WordPress's `$wpdb` for table creation on plugin activation.
- Store a DB version number in `wp_options` (`aioemp_db_version`) and run migrations on version mismatch. Current: `AIOEMP_DB_VERSION = '1.7.0'`.
- **Explicit `ALTER TABLE` migrations** in `AIOEMP_Activator::run_migrations()` handle columns that `dbDelta()` may fail to add on existing tables (e.g., `checked_in`, `integrity_pass`, `description`, `created_by`, `preferred_language`, `online_url`). These run on every `plugins_loaded`, before the version check, to ensure columns exist regardless of how the schema was updated.

> **DB ALERT (v1.7.0):** Added `online_url VARCHAR(500) DEFAULT NULL` column to `aioemp_attender` table (after `preferred_language`). Each candidate now has their own online meeting URL (e.g. unique Zoom link). The event-level `online_url` field remains in the events table schema but has been removed from the event edit form UI — it is no longer used for email sending.

> **DB ALERT (v1.6.0):** Added `preferred_language VARCHAR(10) DEFAULT NULL` column to `aioemp_attender` table (after `email`). Migration auto-runs on `plugins_loaded`. If deploying to an environment where the plugin was already active, the `run_migrations()` method will `ALTER TABLE ADD COLUMN` if missing.
- Use `$wpdb->prefix` for table name prefixing.
- All tables must use `$charset_collate = $wpdb->get_charset_collate()`.

---

## 5. Plugin Architecture & File Structure

Follow WordPress plugin best practices:

```
all-in-one-event-managing-platform/
├── all-in-one-event-managing-platform.php   # Main plugin bootstrap (v0.1.0, DB v1.4.0)
├── deploy.sh                                # SSH deployment pipeline
├── .ai-agent-notes.md                       # Credentials & deployment details (git-ignored)
├── .gitignore
├── reference/                               # Design docs
│   ├── AI_AGENT_GUIDELINE.md               # THIS FILE
│   ├── AIOEMP_Logic_Flow_Notes_v0.2.md
│   ├── Build Parametric Seatmap Builder.md
│   ├── Data base schema.md
│   ├── Editor Locking (WP-style "one editor at a time").md
│   └── Functional Requirements.md
├── templates/                               # Public-facing templates
│   ├── login-form.php                       # Login form template (254 lines)
│   ├── ticket-page.php                      # Virtual ticket page template (297 lines)
│   ├── ticket-error.php                     # Ticket error page template (71 lines)
│   ├── password-setup.php                   # Password setup form + success page (175 lines)
│   └── password-setup-error.php             # Password setup error page (90 lines)
├── includes/
│   ├── class-aioemp-activator.php           # DB installer (dbDelta, 10 tables, explicit migrations) (328 lines)
│   ├── class-aioemp-deactivator.php         # Capability revocation, role removal
│   ├── class-aioemp-loader.php              # Singleton, wires all hooks (249 lines)
│   ├── class-aioemp-security.php            # Capabilities (13), roles (5), nonces, sanitisation, rate limiting (463 lines)
│   ├── class-aioemp-shortcodes.php          # [aioemp_login] shortcode (348 lines)
│   ├── class-aioemp-ticket-endpoint.php     # Virtual /e-ticket/{hash} page (210 lines)
│   ├── class-aioemp-password-setup-endpoint.php # Virtual /setup-password/{token} page (276 lines)
│   ├── rest-api/
│   │   ├── class-aioemp-rest-controller.php       # Abstract base controller (212 lines)
│   │   ├── class-aioemp-events-controller.php     # CRUD /events (536 lines)
│   │   ├── class-aioemp-attenders-controller.php  # Candidates CRUD /events/{id}/attenders (1149 lines)
│   │   ├── class-aioemp-seating-controller.php    # Seating allocation /events/{id}/seating (754 lines)
│   │   ├── class-aioemp-attendance-controller.php # Check-in/out, logs, stats, CSV export (368 lines)
│   │   ├── class-aioemp-seatmaps-controller.php   # CRUD /seatmaps (347 lines)
│   │   ├── class-aioemp-seatmap-upload-controller.php  # BG image upload (157 lines)
│   │   ├── class-aioemp-locking-controller.php    # Lock acquire/heartbeat/release/takeover (178 lines)
│   │   ├── class-aioemp-settings-controller.php   # Settings CRUD + logo upload + available_languages (154 lines)
│   │   ├── class-aioemp-users-controller.php      # User/role management + welcome email (400+ lines)
│   │   ├── class-aioemp-profile-controller.php    # Current user profile (144 lines)
│   │   └── class-aioemp-email-templates-controller.php # Email template CRUD + preview + locale support (293 lines)
│   ├── models/
│   │   ├── class-aioemp-model.php                 # Abstract base model ($wpdb wrapper)
│   │   ├── class-aioemp-events-model.php          # Events CRUD + search/pagination (116 lines)
│   │   ├── class-aioemp-attender-model.php        # Candidates CRUD + QR hash + bulk status (224 lines)
│   │   ├── class-aioemp-attendance-model.php      # Append-only attendance log (237 lines)
│   │   ├── class-aioemp-seat-assignment-model.php # Seat assignments + batch ops + checked_in preservation (322 lines)
│   │   ├── class-aioemp-blocked-seat-model.php    # Blocked seats + batch ops (180 lines)
│   │   ├── class-aioemp-seat-assignment-log-model.php # Seat operation audit trail (140 lines)
│   │   ├── class-aioemp-event-log-model.php       # Append-only event audit log (65 lines)
│   │   └── class-aioemp-seatmap-model.php         # Seatmap CRUD + search/pagination (112 lines)
│   ├── email/                                     # Default email template files (PHP, return array{subject,body})
│   │   ├── accepted-online.php
│   │   ├── accepted-onsite.php
│   │   ├── email-style.php
│   │   ├── new-user-welcome.php
│   │   ├── registration-confirmation.php
│   │   └── rejected.php
│   └── services/
│       ├── class-aioemp-locking-service.php       # Atomic SQL locking (TTL 90s) (322 lines)
│       ├── class-aioemp-settings-service.php      # Single wp_options key, typed defaults, language helpers (279 lines)
│       └── class-aioemp-email-service.php         # Email templates CRUD, locale-aware send, HTML wrapper (531 lines)
├── admin/
│   ├── class-aioemp-admin.php               # Admin hooks, menu entry, script enqueue chain (224 lines)
│   ├── css/aioemp-admin.css                 # Admin styles (CSS custom properties)
│   ├── js/
│   │   ├── aioemp-admin.js                  # Admin SPA shell (jQuery, 290+ lines)
│   │   ├── aioemp-events.js                 # Events module entry + shared context (112 lines)
│   │   ├── aioemp-settings.js               # Settings page JS + language picker/drag-drop (480 lines)
│   │   ├── aioemp-seatmaps.js               # Seatmaps list page JS (252 lines)
│   │   ├── aioemp-users.js                  # Users/role management page JS (515 lines)
│   │   ├── aioemp-profile.js                # Profile settings page JS (257 lines)
│   │   ├── aioemp-emails.js                 # Email templates editor page JS + locale selector (443 lines)
│   │   ├── seatmap-compiler.js              # Browser IIFE of seatmap-core compile (client-side snapshot compilation)
│   │   ├── vendor/
│   │   │   └── html5-qrcode.min.js          # QR scanning vendor library (v2.3.8)
│   │   ├── events/                          # Events sub-modules (loaded sequentially)
│   │   │   ├── _helpers.js                  # Shared utilities: esc, fmtDate, localToGmt, gmtToLocal, badges (91 lines)
│   │   │   ├── _list.js                     # Events list page: table, search, filter, pagination, delete (175 lines)
│   │   │   ├── _form.js                     # Event create/edit form: all fields + seatmap template select (240 lines)
│   │   │   ├── _detail.js                   # Event detail page: header + tab container (5 cap-gated tabs) (185 lines)
│   │   │   ├── _candidates.js               # Candidates tab: list, search, filter, pagination, add/edit modal, bulk status, attendance column, preferred language (1097 lines)
│   │   │   ├── _seating.js                  # Seating tab: full-screen SVG dashboard (1855 lines)
│   │   │   ├── _checkin.js                  # Check-In tab: QR scanner, manual lookup, candidate popup, scan recording (759 lines)
│   │   │   └── _attendance.js               # Attendance Log tab: paginated log table, search, CSV export (243 lines)
│   │   └── seatmap-editor/                  # ← Vite IIFE build output
│   │       ├── seatmap-editor.js            # ~580 KB (React+Konva+Zustand bundle)
│   │       ├── seatmap-editor.js.map        # Source map
│   │       └── seatmap-editor.css           # ~5.8 KB
│   └── views/
│       └── dashboard-shell.php              # Full-screen SPA shell template (121 lines)
├── public/                                  # Public-facing
│   ├── class-aioemp-public.php              # Public hooks, login redirect (77 lines)
│   ├── css/aioemp-public.css                # Public styles (login form, ticket page)
│   └── js/aioemp-public.js                  # Public JS placeholder (6 lines)
├── seatmap-core/                            # @aioemp/seatmap-core (TypeScript library)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts                     # Vitest configuration
│   ├── src/                                 # Source
│   │   ├── index.ts                         # Barrel re-exports
│   │   ├── schema.ts                        # Zod schemas (220 lines)
│   │   ├── types.ts                         # Zod-inferred TypeScript types
│   │   ├── compile-layout.ts                # Orchestrator compiler
│   │   ├── compile-grid.ts                  # Grid block compiler
│   │   ├── compile-arc.ts                   # Arc block compiler (200 lines)
│   │   ├── browser.ts                       # Browser IIFE entry (exposes window.aioemp_compileSnapshot)
│   │   ├── pivot.ts                         # Rotation pivot helpers + visual constants
│   │   ├── seat-key.ts                      # seat_key preservation map
│   │   └── utils.ts                         # Shared utilities (134 lines)
│   ├── tests/                               # Vitest (6 files, 88 tests)
│   │   ├── compile-grid.test.ts
│   │   ├── compile-arc.test.ts
│   │   ├── compile-layout.test.ts
│   │   ├── schema.test.ts
│   │   ├── seat-key.test.ts
│   │   └── utils.test.ts
│   ├── dist/                                # tsup output (ESM + CJS + DTS, git-ignored)
│   └── dist-browser/                        # Browser IIFE build output (git-ignored)
│       └── browser.global.js               # Bundled browser build of browser.ts
└── seatmap-editor/                          # @aioemp/seatmap-editor (React SPA)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts                       # IIFE build → ../admin/js/seatmap-editor/
    ├── tsconfig.node.json                   # Node-specific TS config (Vite)
    └── src/
        ├── main.tsx                         # Entry: window.aioemp_seatmap_editor.mount()
        ├── App.tsx                          # Root: Toolbar + EditorCanvas + InspectorPanel
        ├── store.ts                         # Zustand + Immer store (494 lines)
        ├── api.ts                           # REST wrappers (seatmapApi, lockApi)
        ├── layoutDefaults.ts                # LAYOUT_STYLE_DEFAULTS
        ├── primitiveFactories.ts            # Factory functions for instant-add
        ├── styles.css                       # Editor styles (imported by main.tsx)
        ├── globals.d.ts                     # Window type declarations
        ├── hooks/
        │   ├── useDraftPersistence.ts       # Auto-save to localStorage
        │   ├── useLockHeartbeat.ts          # Lock acquire + heartbeat + release
        │   └── useSave.ts                   # Ctrl+S, auto-save, REST PUT
        └── components/
            ├── EditorCanvas.tsx             # Konva Stage + all interactions (1035 lines)
            ├── InspectorPanel.tsx            # Right sidebar inspector (728 lines)
            ├── PrimitiveRenderer.tsx         # Per-primitive visual renderer (409 lines)
            ├── SeatDots.tsx                  # High-perf seat circles + row labels
            └── Toolbar.tsx                   # Horizontal toolbar (469 lines)
```

### Architecture Rules

- **Separation of concerns:** Controllers handle HTTP (validate input, check permissions, return responses). Models handle DB queries. Services handle business logic.
- **No direct DB queries in controllers.** Always go through models.
- **No business logic in models.** Models are thin data-access wrappers.
- Each REST controller must extend `AIOEMP_REST_Controller` (abstract base class with permission helpers, response helpers, pagination, sanitise helpers).

---

## 6. Admin Dashboard (SPA Shell)

### Entry Point

- WordPress admin menu item: **"Event Manager"**.
- Requires `aioemp_access_plugin` capability to see the menu item.
- Opens a full-screen dashboard page that overlays standard wp-admin content.

### Full-Screen Overlay Behaviour

The SPA shell is rendered as a `position: fixed; inset: 0; z-index: 99999` overlay that completely covers the default WordPress admin chrome (admin bar, left sidebar, content area). A body class `aioemp-active` is added on load to hide WP elements and prevent double-scroll. Users can return to WP via an explicit **"WP Dashboard"** button in the top bar.

### SPA Router

Hash-based client-side routing in `aioemp-admin.js`. Routes registered via `registerRoute(name, title, handler)`.

| Route | Page | Capability Gate |
|---|---|---|
| `#events` | Events list | `view_events` |
| `#event/{id}` | Event detail (tabs) | `view_events` |
| `#seatmaps` | Seatmap templates list | `view_seatmaps` |
| `#seatmap-edit/{id}` | Seatmap editor (React) | `manage_seatmaps` |
| `#users` | User/role management | `manage_settings` |
| `#settings` | Plugin settings | `manage_settings` |
| `#profile` | Profile settings | any logged-in user |

Default route is determined by capability: `events` → `seatmaps` → `users` (first available).

### Sidebar Navigation

Capability-gated sidebar items (rendered server-side in `dashboard-shell.php`):

| Item | Route | Requires |
|---|---|---|
| Events | `#events` | `view_events` |
| Seatmaps | `#seatmaps` | `view_seatmaps` |
| Users | `#users` | `manage_settings` |
| Settings | `#settings` | `manage_settings` |

### Topbar

- Left: sidebar toggle button, page title
- Right: "WP Dashboard" link, user account dropdown (avatar initial + display name)
  - Dropdown: **Profile Settings** (`#profile`), **Logout** (wp_logout_url)

### Design System — Star Admin 2 Pro Reference

**Reference:** <https://demo.bootstrapdash.com/star-admin-2-pro/themes/vertical-boxed/>

All agent-generated UI must follow this colour palette and component style. Do **not** import the Star Admin CSS wholesale — use the CSS custom properties defined in `admin/css/aioemp-admin.css`.

#### Colour Palette (CSS Custom Properties)

| Token | Value | Usage |
|---|---|---|
| `--sa-primary` | `#4B49AC` | Buttons, active nav, links |
| `--sa-primary-lt` | `#7978E9` | Hover states, avatar bg |
| `--sa-info` | `#248AFD` | Info badges, charts |
| `--sa-success` | `#3AC47D` | Success badges, confirmations |
| `--sa-warning` | `#FFC100` | Warning badges |
| `--sa-danger` | `#F5365C` | Error badges, destructive actions |
| `--sa-body-bg` | `#F2EDF3` | Page background |
| `--sa-sidebar-bg` | `#FFFFFF` | Sidebar background |
| `--sa-sidebar-txt` | `#737F8B` | Sidebar inactive text |
| `--sa-sidebar-act` | `#4B49AC` | Sidebar active item text + left border |
| `--sa-card-bg` | `#FFFFFF` | Card backgrounds |
| `--sa-text` | `#343A40` | Body text |
| `--sa-muted` | `#6C757D` | Secondary/disabled text |
| `--sa-border` | `#E8E8E8` | Borders, dividers |
| `--sa-radius` | `6px` | Default border-radius |
| `--sa-shadow` | `0 0 10px rgba(0,0,0,.05)` | Cards, top bar |
| `--sa-shadow-lg` | `0 2px 12px rgba(0,0,0,.08)` | Elevated elements |
| `--sa-font` | Ubuntu, system stack | Typography |
| `--sa-sidebar-w` | `240px` | Sidebar width |
| `--sa-topbar-h` | `60px` | Top bar height |

#### Reusable CSS Classes

| Class | Purpose |
|---|---|
| `.aioemp-card` / `.aioemp-card__title` | Content card with shadow |
| `.aioemp-btn` with `--primary/--info/--success/--warning/--danger/--outline` | Buttons |
| `.aioemp-table` | Compact data table |
| `.aioemp-badge` with `--draft/--published/--closed/--success/--danger/--info` | Status pills |

### Agent Rules for UI

1. **Always** use the CSS custom properties — never hard-code colour hex values.
2. Wrap route content in `.aioemp-card` for consistency.
3. Use `.aioemp-btn--primary` for primary actions, `--danger` for destructive.
4. Update `#aioemp-page-title` via the router when changing routes.
5. All icon usage must use WordPress Dashicons (`dashicons-*` classes).
6. On mobile (≤ 782px) the sidebar slides in/out — toggled by `#aioemp-toggle-sidebar`.

### Security in Admin Shell

- All admin REST calls include the WP nonce (`X-WP-Nonce` header) automatically via the `window.aioemp_api` REST helper.
- Server must verify capability on every request regardless of what the UI shows.
- `window.aioemp.user_caps` provides client-side capability map for UI gating only.

---

## 7. Events Module

### 7.1 Events List Page

- Table columns: title, status (badge), venue mode (badge), start date, capacity, delete button.
- Filters: status, keyword search (300ms debounce). Paginated (20 per page).
- Actions: view (row click → `#event/{id}`), edit, create new, delete.

### 7.2 Create Event

- Fields: title (required), description, status (draft/published/closed), venue mode (onsite/online/mixed), start/end datetime-local, capacity, seatmap template dropdown, location name/address, online URL, cover image URL.
- **Seating mode selection:** Free seating (no seatmap) OR Seatmap-based (select template).
- Seatmap dropdown loads published templates with `integrity_pass` check.
- On save with seatmap-based: **create event seatmap snapshot** from selected template.
- On save with free seating: seating tab is hidden.
- Datetime conversion: `localToGmt()` / `gmtToLocal()` for UTC storage.

### 7.3 Edit Event

#### Critical Rules

- If `seatmap_finalized_at_gmt` is set → **cannot** change seatmap selection or snapshot.
- If any attendance logs exist OR any seat assignments exist → **cannot** change seatmap snapshot.
- Basic fields (time/capacity/venue) remain editable but changes should be logged.

### 7.4 Event Detail Page (Tabs)

Five tabs, each capability-gated:

| Tab | Label | Capability Required | Purpose |
|---|---|---|---|
| Overview | Overview | `view_events` | Event summary, key metrics, candidate statistics |
| Candidates | Candidates | `view_candidates` | List/manage candidates, status changes |
| Attendance Log | Attendance Log | `view_attendance` | Paginated scan log, search, CSV export |
| Check In | Check In | `scan_attendance` | QR scanner, manual lookup, check-in/out |
| Seating | Seating | `manage_seating` | Seat allocation dashboard (seatmap-based events only) |

---

## 8. Candidates / Attenders Module

### 8.1 Candidates List Tab (per event)

- Table columns: checkbox, name, email, company, status badge, **attendance** (check-in badge), registered date, edit/delete actions.
- **Attendance column**: Shows a green "Checked In" badge for candidates with `checked_in = 1` (from LEFT JOIN with `seat_assignment`), red "Not In" for assigned candidates who haven't checked in, or "—" otherwise.
- Search and filters: keyword (name/email/company, 300ms debounce), status dropdown.
- **Bulk actions:** select-all checkbox, bulk status change (Accept On-site, Accept Online, Reject) via `POST /attenders/bulk-status`.
- **Add/Edit modal**: overlay modal form with title (Mr/Ms/Mrs/Dr), first name (required), last name, email, company, preferred language (dropdown from enabled languages), status dropdown.
- **Delete**: confirmation dialog, `DELETE /attenders/{id}`.
- Pagination: prev/next, 20 per page.

### 8.2 Candidate Status Flow

- Statuses: `registered`, `accepted_onsite`, `accepted_online`, `rejected`.
- Status change triggers automated email (locale-aware — uses candidate's `preferred_language` to resolve template).
- QR email is sent to accepted candidates (configurable: send on acceptance vs on registration) _(not yet implemented)_.

### 8.3 Critical Rules

- **Allow duplicate registrations** with the same email for the same event. Do NOT enforce uniqueness on (event_id, email).
- Generate unique QR token/hash per candidate record via SHA-256 of UUID4 + random password.

### 8.4 View Permission Sharing

The attenders list view permission is shared across multiple capabilities so that different roles can access candidate data contextually:
- `view_candidates` — Candidates tab access
- `manage_seating` — Seating tab needs to load candidates for assignment
- `scan_attendance` — Check-In tab needs candidate lookup

Write operations (create, edit, delete, bulk-status) require `manage_candidates`.

---

## 9. Attendance & Check-In Module

> **Status: IMPLEMENTED** (Phase 8). In production since Feb 2026.

### 9.1 Architecture Overview

The attendance system consists of two admin tabs and a REST API:

| Component | File | Purpose |
|---|---|---|
| **Check-In Tab** | `events/_checkin.js` (759 lines) | QR scanner, manual lookup, candidate popup, scan recording |
| **Attendance Log Tab** | `events/_attendance.js` (243 lines) | Paginated log view, search, CSV export |
| **Attendance Controller** | `class-aioemp-attendance-controller.php` (368 lines) | REST endpoints for resolve-ticket, checkin, logs, stats, export |
| **Attendance Model** | `class-aioemp-attendance-model.php` (237 lines) | Data access for append-only attendance table |

### 9.2 Check-In Tab — Scan Workflow

1. Admin opens the **Check In** tab for an event (requires `scan_attendance` capability).
2. Three input methods:
   - **Camera scanner**: Uses html5-qrcode library. Reads QR codes containing `https://domain.com/e-ticket/{64-char-hex-hash}`.
   - **HID hardware scanner**: Outputs to a text input field; on Enter key, processes the scanned value.
   - **Manual search**: Type name/email to search attenders; single match shows popup directly, multiple matches show a selection list.
3. **Hash extraction** (`extractHash()`): Accepts full URL (extracts last 64-char hex path segment) or raw 64-char hex hash.
4. System resolves hash → candidate via `POST /resolve-ticket`, returns candidate info + latest scan + seat + check-in status.
5. **Candidate popup** shows:
   - Status banner: green "CHECKED IN" or red "NOT CHECKED IN" (for accepted candidates).
   - Name, email, company, status badge, seat label badge (resolved from UUID via `buildSeatLabelMap()`).
   - Last scan info (type + timestamp).
   - Action buttons (context-dependent).
6. Admin clicks action button:
   - **Check In** (green): Records `type=IN`.
   - **Check Out** (red): Records `type=OUT`.
   - **Force Check In Again** / **Force Check Out**: Bypasses sequence validation (for edge cases like network glitches, re-entry without checkout, correcting errors).
7. System writes append-only attendance log record and updates `checked_in` flag on `seat_assignment`.

### 9.3 Sequence Validation

- **Normal mode** (force=false):
  - IN after last scan IN → **rejected** (409): "Already checked in."
  - OUT without prior IN (or after last OUT) → **rejected** (409): "Not currently checked in."
- **Force mode** (force=true): Bypasses sequence validation. The `force` flag is logged for audit.
- Only candidates with `accepted_onsite` or `accepted_online` status can check in. Other statuses show a warning and no action buttons.

### 9.4 Seat Label Resolution

The Check-In popup resolves seat UUID keys to human-readable labels:
- `buildSeatLabelMap()` parses the event's seatmap snapshot JSON and calls `window.aioemp_compileSnapshot(layout)` (the browser IIFE build of seatmap-core) to compile compiled seats.
- Maps `seat_key → label` (e.g., `"abc123...def" → "A-08"`).
- Falls back to raw UUID if compilation fails.

> **CRITICAL:** The compile function is `window.aioemp_compileSnapshot()`, NOT `window._aioemp_sc.compile()`. The IIFE build uses `--global-name _aioemp_sc` but the actual function is set explicitly in `browser.ts`.

### 9.5 Device Detection

`detectDeviceModel()` parses `navigator.userAgent` to identify the scanning device:
- iOS: returns "iPhone", "iPad", "iPod"
- Android: extracts model from `Build/` pattern (e.g., "Samsung SM-G998B")
- Desktop: returns "Mac / Chrome", "Windows / Firefox", etc.

Sent as `device_id` in the check-in POST request and stored in the attendance table.

### 9.6 Audio Feedback

`playBeep()` uses Web Audio API to play a short beep tone:
- 880 Hz for valid tickets (success)
- 440 Hz for invalid/rejected tickets (error)

### 9.7 Denormalised `checked_in` Flag

On every check-in/out, the attendance controller updates `seat_assignment.checked_in`:
- `type=IN` → `checked_in = 1`
- `type=OUT` → `checked_in = 0`

This denormalised flag is used by:
- **Seating tab**: Colours checked-in seats purple (`#7c3aed`).
- **Candidates tab**: Shows attendance badge in the list.
- **Resolve-ticket response**: Includes `checked_in` for the popup status banner.

The flag is **preserved** during seat swap and batch reassignment (the model carries it across delete + re-insert).

### 9.8 Attendance Log Tab

- Table columns: Time, Name, Email, Action (IN/OUT badge), Scanned By.
- Scanned By: Shows first_name + last_name from `wp_usermeta` (falls back to `display_name`).
- Search (name/email, 400ms debounce), pagination (50 per page).
- **CSV Export**: Downloads attendance records with columns: Scan ID, Type, Scanned At (GMT), First Name, Last Name, Email, Company, Status, Scanned By, Device.

### 9.9 Stats

Three stat cards shown on both Check-In and Attendance Log tabs:
- **Checked In**: Currently checked-in count (latest scan is type=IN, computed via window function `ROW_NUMBER() OVER ...`).
- **Total Scans**: Total attendance records.
- **Accepted**: Sum of `accepted_onsite` + `accepted_online` candidates.

### 9.10 Recent Scans Feed (Check-In Tab)

- Compact table below the scanner: Time, Name, Action.
- Paginated (20 per page), loaded from `GET /attendance`.
- Refreshes automatically after each scan.

### 9.11 REST API Endpoints

| Method | Route | Permission | Description |
|---|---|---|---|
| POST | `/events/{id}/resolve-ticket` | `scan_attendance` | Resolve QR hash to candidate info + last scan + seat + checked_in |
| POST | `/events/{id}/checkin` | `scan_attendance` | Record check-in/out; body: `{attender_id, type, force, device_id}` |
| GET | `/events/{id}/attendance` | `view_attendance` | Paginated attendance logs; query: `page, per_page, search` |
| GET | `/events/{id}/attendance/stats` | `view_attendance` | `{checked_in, total_scans, total_candidates, accepted_onsite, accepted_online}` |
| GET | `/events/{id}/attendance/export` | `view_attendance` | CSV export (returns JSON with `{filename, csv}`) |

---

## 10. Seatmap Templates & Parametric Builder

### 10.1 Overview

The seatmap builder is a **parametric** editor — admins edit primitives (blocks, arcs), not individual seats. On save, primitives are compiled into a flat seat list.

### 10.2 Layout Data Model (JSON)

```json
{
  "schemaVersion": 1,
  "title": "Cinema Hall A",
  "canvas": { "w": 1600, "h": 900, "unit": "px" },
  "primitives": [],
  "compiled": {
    "seats": [],
    "bounds": { "minX": 0, "minY": 0, "maxX": 0, "maxY": 0 }
  }
}
```

### 10.3 Required Primitive Types

| Type | Purpose |
|---|---|
| `stage` | Stage/screen marker (rect or polygon) |
| `label` | Text label |
| `obstacle` | Non-seat area (rect/polygon) |
| `seatBlockGrid` | Straight rows of seats |
| `seatBlockArc` | Cinema-style curved rows |

Each primitive has: `id` (stable nanoid/uuid), `type`, optional `name`/`label`, optional `transform: { x, y, rotation }`.

### 10.4 Compiled Seat Object

```typescript
type CompiledSeat = {
  seat_key: string;     // stable UUID, used by DB assignment/blocked
  label: string;        // display label (may change)
  section?: string;
  row?: string;
  number?: number;
  x: number;
  y: number;
  rotation?: number;
  meta?: Record<string, any>;
}
```

### 10.5 seat_key Strategy (Critical)

- `seat_key` values are **fully deterministic** — generated from `(primitiveId, logicalRow, logicalSeat)` via a FNV-1a hash, formatted as UUID v4. The same logical seat always produces the same key across every compile, server round-trip, and session.
- No "existing layout" is needed for key preservation. Keys survive recompilation and layout edits as long as the primitive's `id` and seat coordinates are unchanged.
- **Once a layout is snapshotted into an event**, seat_keys must NOT change unless the event seatmap is not finalized.

### 10.6 Primitive Compile Algorithms

- **seatBlockGrid:** Row/col grid with origin, spacing, aisle gaps, row labels (A-01 pattern), L2R/R2L numbering.
- **seatBlockArc:** Curved rows with center, radius, angle range, seats distributed along arc, aisle gap angle adjustments.

### 10.7 UI Editor Requirements

- **Canvas:** Zoom/pan, multi-select primitives, move/rotate with handles, snap-to-grid toggle.
- **Tools palette:** Add Grid/Arc blocks, add Stage/Label/Obstacle, Delete, Duplicate, Undo/Redo.
- **Inspector panel:** Editable params for selected primitive, live recompile preview (debounced 200ms).
- **Performance:** Render seats as lightweight circles in Konva. Seats are NOT individually draggable — selection is per primitive. Target: 2,000+ seats without lag.

### 10.8 Drafts & Save Pipeline

- Keep state in memory (Zustand store).
- Auto-persist draft to `localStorage` key `aioemp_seatmap_draft_<seatmapId>` (debounced 2s). Clear on successful save.
- **Save pipeline:** Validate (Zod) → Compile → PUT to server → server validates lock + schema → store in DB.

### 10.9 Seatmaps List Page

- CRUD: create, edit, duplicate (optional), delete (optional).
- Editor locking is mandatory (see Section 12).

---

## 11. Event Seatmap Snapshot & Seating Allocation

### 11.1 Snapshot Creation

- When creating a seatmap-based event, copy `aioemp_seatmap.layout` → `aioemp_events.seatmap_layout_snapshot`.
- The snapshot is independent of the template — later template edits do not affect it.

### 11.2 Snapshot Freeze Conditions

The snapshot **cannot** change if ANY of these are true:

- `seatmap_finalized_at_gmt` is set.
- Any seat assignments exist for this event.
- Any attendance logs exist for this event.

### 11.3 Seating Tab / Allocation Dashboard (`_seating.js`, 1855 lines)

A full-screen overlay (`position:fixed; inset:0; z-index above SPA shell`) that provides:

**Layout:**
- Left panel: candidate search + paginated list (50 per page, status filter `accepted_onsite` only)
- Main area: SVG seatmap canvas + toolbar + info bar
- Header: back button, event title, stats bar (total/assigned/blocked/available/checked-in)

**Five Modes:**
1. **Assign mode**: Select candidate(s) from panel → click empty seats to mark pending → Confirm Assignment button fires batch assign
2. **Block mode**: Click or drag-select empty seats → Block/Unblock Selected buttons
3. **Swap mode**: Click first assigned seat → confirm dialog shows both candidate names and seat labels → click second assigned seat → atomic swap (requires `confirm()` dialog before execution)
4. **History mode**: Click any seat to open a popup showing its full assignment/block history timeline. Cursor changes to `help`. No drag selection allowed
5. **Unassign mode**: Select assigned seats or candidates → Unassign button (blocked for checked-in candidates)

**SVG Rendering:**
- Seats rendered as `<circle>` elements with `data-key` attributes
- Seat number labels as `<text>` elements
- Row labels from `compiled.rowLabels`
- Decorations: labels (`<text>`), obstacles (`<rect>`) from primitives
- Canvas area with shadow, workspace background (`#e8e8e8`)

**Color Coding:**

| State | Fill Colour | Notes |
|---|---|---|
| Empty | Layout seatFill (`#4B49AC`) | Default seat colour |
| Assigned | `#28a745` (green) | Assigned but not checked in |
| Checked-in | `#7c3aed` (purple) | Assigned AND `checked_in = 1` |
| Blocked | `#dc3545` (red) with ✕ | Blocked seat |
| Pending assignment | `#f59e0b` (amber) | Staged for batch assignment |
| Pending block | `#ff6b6b` | Staged for batch block |
| Selected assigned | `#0ea5e9` (blue) | Selected via drag-select |

**Swap Confirmation:**
Before executing a swap, a `confirm()` dialog is shown with both candidate names and seat labels:
```
Swap seats?

John Smith (Seat A-08)
↔
Jane Doe (Seat B-03)

This action cannot be undone.
```
If cancelled, resets `ss.swapFirst` and shows a toast.

**Interactions:**
- **Zoom**: mouse wheel (centered on pointer), +/- buttons, Fit button, zoom level display
- **Pan**: Space + drag (changes SVG viewBox)
- **Drag selection** (marquee): mousedown on empty area, drag rectangle overlay, on release selects seats within bounds
- **Candidate multi-select**: Shift+click candidates, deselect-all button, selected count display
- **Candidate info popup**: modal with name, email, company, status, seat, registration date, seating history
- **Keyboard shortcuts**: Escape (close overlay / close help modal), Cmd/Ctrl+D (deselect all)
- **Help modal**: keyboard shortcuts table + workflow tutorial

**State Management (`seatingState`):**
- `assignMap`: seat_key → assignment object (for O(1) lookup)
- `attenderMap`: attender_id → seat_key (for reverse lookup)
- `blockedSet`: seat_key → true (for O(1) blocked check)
- `selectedCandidates[]`: array of `{id, name, email}` for multi-select
- `pendingSeats[]`: seat_keys staged for batch assignment
- `pendingBlocks[]`: seat_keys staged for batch block
- `svgScale`, `svgOffsetX/Y`: zoom/pan state
- After each API call, `loadSeatingData()` re-fetches all assignments + blocked seats and re-renders SVG

---

## 12. Editor Locking (WP-Style Exclusive Edit)

### 12.1 Purpose

Only one user can edit a seatmap or event at a time. Locks are DB-backed with automatic expiry.

### 12.2 Constants

- **Lock TTL:** 90 seconds.
- **Heartbeat interval:** 60 seconds.
- All timestamps in UTC.

### 12.3 API Endpoints (4 actions per resource type)

| Action | Purpose |
|---|---|
| `lock_acquire` | Try to get edit lock; returns `locked_by_you` or `locked_by_other` |
| `lock_heartbeat` | Renew lock using `lock_token`; returns `renewed` or `lock_lost` |
| `lock_release` | Release lock (verify ownership by token) |
| `lock_takeover` | Force-steal lock; write audit log entry |

### 12.4 Server Logic Rules

- **Acquire:** Grant only if lock is NULL or expired. Use **atomic SQL UPDATE** with WHERE condition to prevent races.
- **Heartbeat:** Renew only if `lock_user_id == current_user` AND `lock_token` matches.
- **Release:** Clear lock fields only if owner matches.
- **Takeover:** Force-overwrite. Log previous owner info to audit log.

### 12.5 Frontend Behavior

- On editor open → call `lock_acquire`.
- If `locked_by_you` → store `lock_token` in a React `useRef` (in-memory only), start heartbeat, enable editing.
- If `locked_by_other` → show modal: "Currently being edited by {name}. Take over or exit?" Disable editing.
- On heartbeat `lock_lost` → stop heartbeat, disable editing, show modal.
- On page leave → attempt `lock_release`; also try `navigator.sendBeacon()` in `beforeunload`. **Do not rely on unload** — TTL expiry is the primary safety mechanism.

### 12.6 Edge Cases

- Same user, two tabs: most recent lock_token wins; older tab loses on heartbeat.
- Browser crash: lock expires after TTL, another user can acquire.
- All time comparisons: server-side UTC only.

---

## 13. Users & Role Management Module

> **Status: IMPLEMENTED.** Accessible at `#users` in the admin SPA (requires `manage_settings`).

### 13.1 Users Page (`aioemp-users.js`, 515 lines)

- Lists all WP users who hold at least one AIOEMP role (or are administrators).
- Each user row shows: avatar, display name, email, AIOEMP role badges, edit/remove actions.
- **Search existing WP users**: autocomplete search box queries `GET /users/search?q=…`, returns users matching name/email.
- **Assign roles**: select user from search results → choose AIOEMP role(s) → save.
- **Create new user**: modal form with username, email, display name, password, role selection. Skips WP default new-user email.
- **Edit roles**: inline role dropdown per user → `PUT /users/{id}` with new roles array.
- **Remove**: `DELETE /users/{id}` removes all AIOEMP roles (does NOT delete the WP user).
- **Self-edit guard**: Cannot change your own roles.

### 13.2 Profile Page (`aioemp-profile.js`, 257 lines)

- Accessible from topbar dropdown → "Profile Settings" (`#profile`).
- Fields: first name, last name, display name.
- Optional password change (min 8 chars, confirm match).
- Uses `GET/PUT /profile` endpoints.

### 13.3 REST API

| Method | Route | Permission | Description |
|---|---|---|---|
| GET | `/users` | `manage_settings` | List users with AIOEMP roles |
| GET | `/users/search?q=…` | `manage_settings` | Search WP users by name/email |
| GET | `/users/roles` | `manage_settings` | List available AIOEMP role definitions |
| POST | `/users/create` | `manage_settings` | Create new WP user (skip default email) |
| PUT | `/users/{id}` | `manage_settings` | Update AIOEMP roles for a user |
| DELETE | `/users/{id}` | `manage_settings` | Remove all AIOEMP roles from a user |
| GET | `/profile` | any authenticated | Read current user profile |
| PUT | `/profile` | any authenticated | Update name/display/password |

---

## 14. Public Frontend (Login, Ticket Page)

### 14.1 Login Shortcode (`[aioemp_login]`)

**File:** `class-aioemp-shortcodes.php` (348 lines), template: `templates/login-form.php` (254 lines).

Renders a standalone login form on any public page/post. Theme-overridable via `aioemp/login-form.php` in the active theme.

**Security measures:**
1. **CSRF nonce** (`aioemp_login_form`)
2. **Honeypot field** (`aioemp_website_url`) — hidden, must remain empty
3. **IP-based rate limiting** (5 attempts per 5 minutes)
4. **Generic error messages** (no username/password enumeration)
5. **Secure cookie** via `wp_signon()`

**Post-login redirect logic (priority order):**
1. Explicit `redirect` shortcode attribute (if set and same-origin)
2. AIOEMP dashboard (if user has an AIOEMP role and is not admin)
3. WordPress admin dashboard (fallback)

**Standard WP login redirect:** `AIOEMP_Public::aioemp_login_redirect()` hooked to `login_redirect` filter — AIOEMP-role users (non-admin) are redirected to the dashboard even when using the standard `wp-login.php` form.

**Double-render guard:** Static `$rendered` flag prevents the shortcode from rendering twice (e.g., in FSE templates).

### 14.2 Virtual Ticket Page (`/e-ticket/{hash}`)

**File:** `class-aioemp-ticket-endpoint.php` (210 lines), templates: `ticket-page.php` (297 lines), `ticket-error.php` (71 lines).

Public-facing attendee ticket display — no login required.

**Endpoint:** `https://domain.com/e-ticket/{64-char-hex-hash}` (configurable slug via `ticket_page_slug` setting, default: `e-ticket`).

**Implementation:** Uses WP rewrite rules (pretty permalinks) with `?aioemp_ticket=` fallback for plain permalink structures.

**Template renders:**
- Company logo (from settings)
- Event title, date, venue
- Attendee name, email, company
- Seat label (if assigned)
- Check-in status (if scanned)
- QR code (the hash itself)

**Error page:** 404 status for invalid/missing hashes.

**Slug conflict detection:** `has_slug_conflict()` checks if the slug collides with an existing page/post.

---

## 15. Public Registration & External REST API

> **Status: NOT YET IMPLEMENTED.** Planned for Phase 9.

### Flow

1. User opens public registration form (shortcode/block) for an event.
2. Submits personal info (name, email, company, etc.).
3. System creates candidate record (`status=registered`), generates QR token/hash.
4. Shows thank-you confirmation, sends acknowledgement email.
5. If approval workflow enabled: QR sent when accepted. Otherwise: QR sent immediately.

### Security Controls (Mandatory)

- **Do NOT rely on API keys in client-side JavaScript** — treat endpoint as public.
- **Strict input validation**, rate limiting per IP/event, CAPTCHA/Turnstile, CORS allowlist 
- **Safe error handling:** generic errors, no leaking of internals.

---

## 16. Email & Communications

> **Status: IMPLEMENTED** (Phase 10).

### 16.1 Architecture

- **Service class:** `includes/services/class-aioemp-email-service.php` (531 lines)
- **REST controller:** `includes/rest-api/class-aioemp-email-templates-controller.php` (293 lines)
- **Storage:** Main language templates in `wp_options` key `aioemp_email_templates`; other locales stored in `aioemp_email_templates_{locale}` (one wp_option per locale)
- **Admin UI:** `admin/js/aioemp-emails.js` (443 lines) — "Emails" tab in the SPA dashboard
- **Text domain:** `aioemp` — registered via `load_plugin_textdomain()` on `plugins_loaded`
- **Default template files:** `includes/email/*.php` — each returns `array{subject, body}`

### 16.2 Template Types

| Type Key                    | Label                             | Trigger                                      |
|---|---|---|
| `registration_confirmation` | Registration Confirmation         | On public registration _(wired in Phase 9)_  |
| `accepted_onsite`           | Accepted (On-site) with QR Ticket | Status change to `accepted_onsite`            |
| `accepted_online`           | Accepted (Online)                 | Status change to `accepted_online`            |
| `rejected`                  | Application Rejected              | Status change to `rejected`                   |
| `new_user_welcome`          | New User Welcome (Password Setup) | User creation via Users module                |

### 16.3 Placeholder System

Each template has **type-specific placeholders** plus **common placeholders** available to all templates:

**Common (all types):** `{{company_name}}`, `{{company_email}}`, `{{company_tel}}`, `{{company_address}}`, `{{logo_url}}`, `{{site_url}}`

**Type-specific:**
- **registration_confirmation / rejected:** `{{first_name}}`, `{{last_name}}`, `{{full_name}}`, `{{email}}`, `{{event_title}}`, `{{event_date}}`, `{{event_location}}`
- **accepted_onsite:** All of the above plus `{{ticket_url}}`, `{{qr_code_url}}`, `{{seat_label}}`
- **accepted_online:** Common event fields plus `{{online_url}}` (**resolved from the candidate's `online_url` field**, not the event)
- **new_user_welcome:** `{{display_name}}`, `{{user_login}}`, `{{user_email}}`, `{{setup_url}}`, `{{role_name}}`

### 16.4 Email Sending

- Uses `wp_mail()` with HTML content type.
- Wraps body in a responsive HTML email layout with logo, company info footer.
- `From` header set from company email/name in Settings (falls back to WP admin email).
- Placeholders resolved via simple `str_replace()` at send time.
- `<html lang="">` attribute set dynamically from candidate's resolved locale.

### 16.5 Multi-Language Email Support (i18n)

**Locale resolution on send:**
1. If candidate has `preferred_language` and it differs from main language, check if a custom template exists for that locale.
2. If custom locale template exists → use it; otherwise → fall back to main language template.
3. `<html lang="">` attribute is set to the resolved locale (e.g., `zh-TW`, `en-US`).

**Storage strategy:**
- Main language templates: `aioemp_email_templates` (original wp_option key — backward compatible).
- Other locales: `aioemp_email_templates_{safe_locale}` (e.g., `aioemp_email_templates_zh_TW`).
- `option_key_for_locale(?string $locale)` helper resolves the correct key.
- `has_locale_template(string $type, string $locale)` checks if a specific locale has a customised template.

**Admin UI language selector:**
- Language dropdown appears in the email templates sidebar when 2+ languages are enabled.
- Switching language reloads templates for that locale.
- Green dot (●) indicates custom translation exists; hollow dot (○) indicates fallback to main language default.
- Editor header shows current language name.
- Save, reset, and preview all pass `?lang=XX` query param to the REST API.

**REST API locale support:**
- All email template endpoints accept optional `?lang=XX` query parameter.
- When `lang` is provided, templates are read/written from the locale-specific wp_option.
- Preview emails use the specified locale.

### 16.6 REST API Endpoints

| Method | Endpoint                            | Permission        | Description                          |
|--------|-------------------------------------|--------------------|--------------------------------------|
| GET    | `/email-templates`                  | `manage_settings`  | List all templates + labels/placeholders (supports `?lang=XX`) |
| GET    | `/email-templates/{type}`           | `manage_settings`  | Get single template (supports `?lang=XX`)                |
| PUT    | `/email-templates/{type}`           | `manage_settings`  | Update subject & body (supports `?lang=XX`)              |
| POST   | `/email-templates/{type}/reset`     | `manage_settings`  | Reset to default (supports `?lang=XX`)                   |
| POST   | `/email-templates/{type}/preview`   | `manage_settings`  | Send test email (supports `?lang=XX`)                    |

### 16.7 Email Triggers (Automatic)

- **Attender status change (individual):** `update_item()` in Attenders controller — sends locale-aware email matching new status (passes `$attender->preferred_language`).
- **Attender bulk status change:** `bulk_status()` and `batch_process()` in Attenders controller — sends locale-aware email to each affected attender.
- **Attender creation email:** `maybe_send_create_email()` — sends email based on initial status (passes `$attender->preferred_language`).
- **New user creation:** `create_user()` in Users controller — sends welcome email with password setup link.

### 16.8 Password Setup Virtual Endpoint

- **File:** `includes/class-aioemp-password-setup-endpoint.php`
- **URL pattern:** `/setup-password/{64-char-hex-token}`
- **Token security:**
  - Raw token: 32 random bytes → 64-char hex string (sent to user in email URL).
  - Stored token: SHA-256 hash of raw token (stored in `user_meta`).
  - Expiry: 48 hours (`TOKEN_LIFETIME = 172800` seconds).
  - One-time use: token deleted after successful password setup.
- **User meta keys:** `aioemp_password_setup_token`, `aioemp_password_setup_expiry`
- **Form validation:** nonce, honeypot, min 8 chars, confirmation match.
- **Templates:** `templates/password-setup.php` (form + success), `templates/password-setup-error.php` (invalid/expired token).
- **Design:** Matches the login form overlay layout (same branding/logo).

### 16.9 Company Details in Settings

Four new settings fields added to the Settings module:
- `company_name` — text, used in email From header and templates
- `company_email` — email, used in From header (falls back to admin email)
- `company_tel` — phone (regex validated), used in email footer
- `company_address` — textarea, used in email footer

### 16.10 Admin UI — Email Templates Tab

- New sidebar nav item: "Emails" with `dashicons-email-alt`
- Route: `#emails` (requires `manage_settings` capability)
- Two-panel layout: template list (left) + editor (right)
- Language selector dropdown in sidebar (when 2+ languages enabled) — switches template locale
- Editor features: subject input, HTML body textarea, clickable placeholder chips (insert at cursor), save, reset to default, send test email
- Custom translation indicators: green dot (●) = custom translation exists, hollow dot (○) = using main language default

---

## 17. Settings Module

- **Company logo upload** (used in admin shell header, login form, ticket page, email layout).
- **Company details** — `company_name`, `company_email`, `company_tel`, `company_address` (used in email templates and footer).
- **Ticket page slug** (configurable, default: `e-ticket`).
- **Languages** — ordered array of enabled locale codes (first = main language). Configurable via drag-and-drop reorderable list with 19 built-in locales.
- **Email templates** — editable via the Emails admin tab (subject + body with placeholders); per-language customisation via locale selector.
- **Behavior toggles:**
  - Send QR on acceptance vs on registration.
  - Default venue mode.
  - Default capacity.
  - Device naming for scanners.
- **CAPTCHA configuration** (provider, site key, secret key) _(not yet implemented)_.

### 17.1 Language Configuration

**Settings key:** `languages` (array of locale strings, default: `['en_US']`)

**Available locales** (19 built-in, defined in `AIOEMP_Settings_Service::get_available_languages()`):

| Locale | Label |
|---|---|
| `en_US` | English (US) |
| `en_GB` | English (UK) |
| `zh_TW` | 繁體中文 (Traditional Chinese) |
| `zh_CN` | 简体中文 (Simplified Chinese) |
| `ja` | 日本語 (Japanese) |
| `ko` | 한국어 (Korean) |
| `fr_FR` | Français (French) |
| `de_DE` | Deutsch (German) |
| `es_ES` | Español (Spanish) |
| `pt_BR` | Português (Brazilian Portuguese) |
| `it_IT` | Italiano (Italian) |
| `nl_NL` | Nederlands (Dutch) |
| `ru_RU` | Русский (Russian) |
| `ar` | العربية (Arabic) |
| `hi_IN` | हिन्दी (Hindi) |
| `th` | ไทย (Thai) |
| `vi` | Tiếng Việt (Vietnamese) |
| `id_ID` | Bahasa Indonesia |
| `ms_MY` | Bahasa Melayu (Malay) |

**Admin UI:**
- "Languages" card in Settings page with dropdown picker and sortable list.
- HTML5 drag-and-drop reordering (no jQuery UI dependency). First language = main language, shown with "Main" badge.
- Remove button per language (disabled when only 1 language remains).
- Saved as part of the settings PUT payload.

**Helpers:**
- `AIOEMP_Settings_Service::get_main_language()` — returns first element of `languages` array (or `'en_US'`).
- `AIOEMP_Settings_Service::get_available_languages()` — returns locale → label map.
- Settings controller GET response includes `available_languages` for the UI.

---

## 18. Non-Functional & Compliance Requirements

| Requirement | Standard |
|---|---|
| HTML | W3C HTML5 |
| Accessibility | WCAG 2.2 Level AA |
| Network | IPv6-ready |
| Character encoding | ISO/IEC 10646 (Unicode) |
| Privacy | Aligned with Privacy Policy & Personal Information Collection Statement |

### Deliverables

- WordPress website + Elementor pages (per approved design).
- Custom plugin with all modules described above.
- Admin dashboards for events, seats, attendance, QR check-in/out, email workflows.
- Data export in CSV for registration and attendance.

---

## 19. Build Milestones (Recommended Order)

> **Rationale for order:** The seatmap builder and seating allocation are the most technically complex and highest-risk parts of the project. They are prioritised immediately after the foundation so that unknowns (geometry algorithms, seat_key stability, snapshot/freeze logic) are resolved early, while the rest of the system is still flexible.

| Phase | Scope | Status |
|---|---|---|
| 1 | **Foundation:** DB installer (`dbDelta`) + plugin bootstrap + custom capabilities + nonce framework + shared security helper class | **DONE** |
| 2 | **Admin SPA shell + Settings skeleton:** wp-admin menu entry, full-screen SPA shell, left-nav routing, Settings page (logo upload, CAPTCHA config, behaviour toggles) | **DONE** |
| 3 | **`@aioemp/seatmap-core` (headless):** Layout JSON schema (Zod), `compileLayout()` for Grid/Arc primitives, seat_key stability strategy, unit tests for all compile algorithms | **DONE** |
| 4 | **`@aioemp/seatmap-editor` (UI):** Konva + React canvas, Zustand store, inspector panel, undo/redo, draft persistence, save pipeline with lock token; Seatmaps list page (CRUD) | **DONE** |
| 5 | **Editor locking:** `lock_acquire / lock_heartbeat / lock_release / lock_takeover` endpoints (atomic SQL), frontend heartbeat and takeover modal; applied to seatmap editor | **DONE** |
| 6 | **Event seatmap snapshot + Seating allocation:** Create event with seatmap-based mode (snapshot copy), seating tab with SVG overlay, assign/unassign/swap/block actions, `seatmap_finalized_at_gmt` trigger; apply editor locking to event editor | **DONE** |
| 7 | **Core Events + Candidates CRUD:** Events list/create/edit pages, Candidates tab (list, status change, bulk actions, candidate detail), event Overview tab metrics | **DONE** |
| 8 | **Attendance + Users/Roles + Login + Ticket Page:** QR token generation, scan + confirm IN/OUT flow, sequence validation with force override, attendance log tab, CSV export, `checked_in` denormalised flag, device detection, user/role management, login shortcode, virtual ticket page | **DONE** |
| 9 | **Public registration:** Shortcode/block form, CAPTCHA/Turnstile integration, acknowledgement email, external REST registration endpoint with rate limiting and CORS allowlist | NOT STARTED |
| 10 | **Email automation + i18n:** Status-change emails (accept/reject), QR delivery, new user welcome email with password setup link, editable templates UI, company details in settings, virtual password-setup endpoint, multi-language support (text domain, language settings, candidate preferred language, locale-aware email templates with per-language editing UI) | **DONE** |
| 11 | **WooCommerce Ticket Selling** (see §19.7 below for full logic flow) | NOT STARTED |

> **Important:** Security controls are NOT a separate phase — they must be integrated into every phase from the start.

### 19.7 Phase 11 — WooCommerce Ticket Selling (Logic Flow)

> **Status: NOT STARTED.** This section is the design spec for future implementation.

#### Architecture Decision: Dummy Product Approach

Instead of creating a custom WC product type per event, use a **single hidden WC product** as a carrier. Seat availability is owned entirely by AIOEMP's existing locking/assignment logic. WC handles only the cart/checkout/payment flow.

**Trade-off:** WC native analytics and third-party sales analysis plugins will see one product sold many times, which is meaningless for event analytics. A custom sales dashboard (Phase 11.6) is required.

#### 11.1 Event Configuration

- Add `sells_mode` column to `aioemp_events` table: `free` (default) | `woocommerce`
- Event edit form gets a new select field for sells mode
- Gate: `sells_mode = woocommerce` requires `venue_mode` of `onsite` or `mixed` (online-only events don't need seat-based tickets)
- Switching from `woocommerce` → `free` shows a warning: "This will remove all pricing data. Proceed?"
- Add `ticket_hold_minutes` column to `aioemp_events` (INT, default 15, range 5–60) — configurable reservation time limit

#### 11.2 Dummy Product (One-Time Setup)

- On plugin activation (or first time WC mode is used), auto-create a hidden WC simple product:
  - Title: "Event Ticket (AIOEMP)"
  - Price: 0 (overridden at cart time via hook)
  - Catalog visibility: hidden
  - Virtual: yes
  - Stock management: off (AIOEMP handles availability)
- Store the product ID in `wp_options` as `aioemp_wc_product_id`

#### 11.3 Ticket Pricing Tool (Admin — New Tab)

**Tab:** "Ticket Pricing" — visible only when `sells_mode = woocommerce`. Positioned after Candidates tab, before Seating tab.

**Pricing model:** Section-based (maps to compiled seatmap `group` id). Per-seat pricing is impractical for large venues.

**New table `aioemp_ticket_prices`:**

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | Auto-increment |
| event_id | BIGINT FK | |
| section_id | VARCHAR(100) | Maps to seatmap group id |
| price | DECIMAL(10,2) | |
| label | VARCHAR(100) | e.g. "VIP", "Standard", "Balcony" |
| color | VARCHAR(7) | Hex color for seatmap overlay |
| photo_url | VARCHAR(500) | Seat-view photo for customer reference |
| capacity | INT | Optional override — defaults to section seat count |
| created_at_gmt | DATETIME | |

**UI:**
- Render compiled seatmap in read-only mode (reuse SVG renderer from seating tab)
- Sidebar panel: click a section to set price, display label, color overlay, upload seat-view photo
- Sections with no price → greyed out and unavailable for sale
- Summary bar: "12 sections configured · 450 seats available · Price range: $50–$200"

#### 11.4 Frontend Shortcode `[aioemp_tickets]`

**Parameters:** `[aioemp_tickets event_id="123"]`
- No `event_id` → show list of WC-enabled published events
- Event ended or full → "Sold Out" / "Event Ended" state

**Seat selection UI:**
- Interactive seatmap (clickable available seats)
- Color-coded sections by price tier; legend with section label, price, availability count
- Seat states: **Available** (clickable) | **Sold** (greyed, has accepted_onsite attender) | **Reserved** (orange, in someone else's cart)
- On seat click → slide-in panel: section name, seat label, price, seat-view photo
- Attendee fields per seat: First Name\*, Last Name, Email\*, Company, Preferred Language
- Multiple seat selection supported (buying for a group), running total displayed
- "Add to Cart" button

**Add to Cart flow:**
1. REST API call to reserve seat(s) (see §11.5)
2. If reservation succeeds, add dummy product to WC cart via AJAX with `cart_item_data`:
   - `event_id, seat_key, seat_label, section_id, section_label, price, attendee_first_name, attendee_last_name, attendee_email, attendee_company, attendee_preferred_language`
3. Each seat = one cart line item (same product, different meta)
4. Show "Added ✓" or redirect to cart

**WC hooks for cart/order display:**
- `woocommerce_before_calculate_totals` → set price from `cart_item_data['price']`
- `woocommerce_cart_item_name` → display "Event Title — Section — Seat Label"
- `woocommerce_cart_item_thumbnail` → show seat-view photo if available
- `woocommerce_cart_item_removed` → release seat reservation
- `woocommerce_order_item_display_meta_key` → clean up meta key display in emails/admin

#### 11.5 Seat Reservation (Time-Limited Holds)

**New table `aioemp_seat_reservations`:**

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK | Auto-increment |
| event_id | BIGINT FK | |
| seat_key | VARCHAR(100) | |
| session_id | VARCHAR(64) | WC session ID or hashed user identifier |
| cart_item_key | VARCHAR(32) | WC cart item key for cleanup |
| expires_at_gmt | DATETIME | `created_at_gmt + ticket_hold_minutes` |
| created_at_gmt | DATETIME | |

**Reservation logic:**
- On seat selection: INSERT reservation, return countdown to frontend
- Frontend shows countdown timer per seat: "Complete purchase within 12:34"
- Timer hits 0 → auto-remove item from WC cart, release reservation via AJAX

**Expiry cleanup (belt and suspenders):**
1. **WP Cron** — scheduled every 2 minutes: `DELETE FROM aioemp_seat_reservations WHERE expires_at_gmt < NOW()`
2. **Runtime check** — `is_seat_available()` always filters `expires_at_gmt > NOW()`, so expired reservations are ignored even before cron fires
3. **Cart hooks** — `woocommerce_cart_item_removed` and `woocommerce_cart_emptied` → immediately release reservation

#### 11.6 Post-Purchase Flow

**Hook:** `woocommerce_order_status_completed` (also `processing` for digital goods).

For each order line item with `_aioemp_event_id` meta:
1. Create attender with status `accepted_onsite`
2. Generate QR code hash (existing flow)
3. Create seat assignment (seat_key from item meta)
4. Delete seat reservation
5. Send `accepted_onsite` email with ticket/QR
6. Store `order_id` and `order_item_id` on attender record for traceability

**New attender columns:** `order_id` (BIGINT NULL), `order_item_id` (BIGINT NULL) — NULL for free-mode candidates.

**Refund / Cancellation:**
- Hooks: `woocommerce_order_status_cancelled`, `woocommerce_order_status_refunded`
- For each AIOEMP line item: remove seat assignment, update attender status → `rejected` (or new `refunded` status), free seat for resale

#### 11.7 Sales Dashboard (Admin — New Tab)

**Tab:** "Sales" — visible only when `sells_mode = woocommerce`. On event detail page.

**Metrics:**
- Summary cards: Total Revenue, Tickets Sold, Tickets Remaining, Avg. Price
- By section: table — section label, price, sold count, revenue, remaining
- Timeline: sales per day (last 30 days)
- Recent orders: WC order link, date, attendee name, seat, amount

**Data source:** Query attenders where `order_id IS NOT NULL` joined with `wc_orders` for amounts, or query `wc_order_itemmeta` filtered by `_aioemp_event_id`.

#### 11.8 Implementation Sub-Phases

| Sub-Phase | Scope | Dependency |
|---|---|---|
| 11.1 | Event config (`sells_mode`, `ticket_hold_minutes`) + dummy product setup | None |
| 11.2 | Reservation table + WP Cron cleanup | 11.1 |
| 11.3 | Ticket pricing tool (admin tab) | 11.1, existing seatmap renderer |
| 11.4 | Frontend shortcode + seat selection UI | 11.1, 11.2, 11.3 |
| 11.5 | Post-purchase hooks (create attender + assign seat) | 11.4 |
| 11.6 | Sales dashboard | 11.5 |

#### 11.9 Open Design Questions

1. **General Admission** — support sections without assigned seats (standing area, open seating) where tickets are sold by count rather than specific seat?
2. **Single-price mode** — simpler mode where entire event has one flat price (no per-section breakdown)?
3. **Guest checkout** — allow WC guest checkout, or require account creation so attendee has a login to view their ticket?

---

## 20. Reference Documents

The following files in the `reference/` folder are the authoritative sources for this guideline. Consult them for additional detail:

| File | Content |
|---|---|
| `AIOEMP_Logic_Flow_Notes_v0.2.md` | Page-level logic flow, rules, and module specifications |
| `Build Parametric Seatmap Builder.md` | Seatmap builder implementation spec with algorithms, libraries, UI requirements |
| `Data base schema.md` | Complete database table definitions, columns, types, indexes, constraints |
| `Editor Locking (WP-style "one editor at a time").md` | Locking API contract, SQL patterns, frontend behavior, edge cases |
| `Functional Requirements.md` | High-level functional requirements from the client |

### Operational Files (git-ignored, not in reference/)

| File | Content |
|---|---|
| `.ai-agent-notes.md` | **Credentials and deployment instructions** — WP admin login, SSH connection details, server paths. Read this file for deployment procedures. Do NOT commit credentials to git or include them in this guideline. |
| `deploy.sh` | Automated deployment pipeline (build → test → rsync to server). See `.ai-agent-notes.md` for SSH setup details. |

---

## 21. Implementation Progress (as of 11 Mar 2026)

> **CRITICAL: Read this section carefully.** It documents what has been built, what works, and known patterns/pitfalls from previous development sessions.

### 21.1 `@aioemp/seatmap-core` — Detailed Architecture

**Package:** TypeScript library, built with `tsup` (ESM + CJS + DTS). No React dependency.

**Build:** `cd seatmap-core && npm run build` → outputs to `seatmap-core/dist/`

**Test:** `cd seatmap-core && npm run test` → 88 tests across 6 test files

#### Schema (`schema.ts`, 220 lines)

All data structures are defined as **Zod schemas** with TypeScript types inferred via `z.infer<>`:

- **Primitives** — Discriminated union on `type` field:
  - `seatBlockGrid`: origin, rows, cols, seatSpacingX/Y, aisleGaps[], excludedSeats[], section, rowLabel (mode/start/direction), numbering (L2R/R2L), startSeatNumber, rowLabelDisplay (none/left/right/both), seatRadius, transform
  - `seatBlockArc`: center, rowCount, startRadius, radiusStep, radiusRatio, startAngleDeg, endAngleDeg, seatsPerRow, aisleGaps[], excludedSeats[], section, rowLabel, numbering, startSeatNumber, rowLabelDisplay, seatRadius, transform
  - `stage`: width, height (position via transform.x/y; inherits primitiveBase: id, name, label, transform)
  - `label`: text, fontSize, fontColor, fontWeight (position via transform.x/y; inherits primitiveBase)
  - `obstacle`: width, height, color (`#ffcccc`), borderColor (`#cc5555`) (position via transform.x/y; inherits primitiveBase)

- **Compiled output** (`CompiledSchema`):
  - `seats: CompiledSeat[]` — seat_key, label, section, row, number, x, y, radius, rotation, meta
  - `rowLabels: CompiledRowLabel[]` — primitiveId, row, side ('left'|'right'), x, y
  - `bounds: Bounds` — minX, minY, maxX, maxY

- **Layout** (`LayoutSchema`): schemaVersion (literal 1), title, canvas (w/h/unit), seatRadius, style fields (seatFill, seatStroke, seatFont, seatFontWeight, seatFontColor, seatFontSize, rowFontColor, rowFontSize, rowFontWeight, bgColor, bgImage), primitives[], compiled

#### Compile Algorithms

**`compileLayout(layout, existingLayout?)`** — Orchestrator in `compile-layout.ts`:
1. Builds `SeatKeyMap` from existing compiled seats for key preservation
2. Iterates primitives, dispatches to type-specific compilers
3. Aggregates all seats and row labels
4. Computes bounds (AABB)
5. Returns new Layout with updated `compiled` section

**`compileGrid(primitive, keyMap, globalSeatRadius)`** — in `compile-grid.ts`:
- Seat positions: `x = origin.x + col * spacingX + cumulativeGapBefore[col]`, `y = origin.y + row * spacingY`
- Rotation around pivot (center of dotted area), then translation
- Aisle gaps: cumulative px gaps applied per column
- Row labels: Left labels at `origin.x - GRID_PAD - GRID_LBL_W * 0.5`, right labels at `origin.x + seatW + GRID_PAD + GRID_LBL_W * 0.5`

**`compileArc(primitive, keyMap, globalSeatRadius)`** — in `compile-arc.ts` (200 lines):
- Elliptical arc via `radiusRatio` (radiusX = baseRadius * ratio, radiusY = baseRadius)
- Seat positions: polar → cartesian, distributed evenly across `[startAngleDeg, endAngleDeg]` minus gap angles
- Aisle gaps: px→angle conversion via `(gapPx / avgRadius) * (180/π)`

#### Pivot & Visual Constants (`pivot.ts`)

| Constant | Value | Purpose |
|---|---|---|
| `GRID_PAD` | `21` | Pixel padding around seat area in grid dotted rect |
| `GRID_LBL_W` | `24` | Row-label column width |
| `ARC_PAD` | `21` | Radial pixel padding around arc sector |
| `ARC_LBL_ANG` | `33` | Extra angular pixels for row labels in arc |

#### seat_key Generation (`seat-key.ts`)

`deterministicSeatKey(primitiveId, logicalRow, logicalSeat)` — generates a stable UUID v4 string using four independent FNV-1a 32-bit hashes (different seeds) of the input string `"primitiveId:row:seat"`. The same primitive ID + row + seat index always yields the same key.

#### Browser IIFE (`browser.ts`)

Exposes `window.aioemp_compileSnapshot(layout)` — compiles a layout JSON and returns `{ seats, rowLabels, bounds }`. Built via `tsup` with `--global-name _aioemp_sc` but the function is explicitly assigned in `browser.ts`.

> **CRITICAL:** Use `window.aioemp_compileSnapshot()`, NOT `window._aioemp_sc.compile()`. The latter does not exist.

### 21.2 `@aioemp/seatmap-editor` — Detailed Architecture

**Package:** React 18 SPA, built with Vite as IIFE → `admin/js/seatmap-editor/`

**Build:** `cd seatmap-editor && npm run build` → outputs `seatmap-editor.js` (~580 KB) + `seatmap-editor.css` (~5.8 KB)

**Entry point:** `window.aioemp_seatmap_editor.mount(container, { seatmapId, onClose })` — creates React 18 root, renders `<App>`.

#### Store (`store.ts`, 494 lines)

Zustand 5 + Immer middleware. Key design decisions:

- **`initLayout(layout)`**: Always recompiles on load via `compileLayout(layout, layout)`. This ensures compiled seat/label positions match the current algorithm, not stale positions saved in the database.

- **`recompile()`**: Called after every primitive edit. Spread-copies layout as `previousLayout` for seat_key preservation, then calls `compileLayout()`.

- **Undo/Redo**: Snapshot-based (max 50 depth). Full layout snapshots (not diffs).

#### Components

- **`EditorCanvas.tsx`** (1035 lines) — Konva Stage: wheel zoom, pan (middle mouse/Space+drag), block+seat selection, drag-to-create Grid/Arc, move/rotate/resize, arrow keys, Delete/Backspace, Escape
- **`InspectorPanel.tsx`** (728 lines) — Right sidebar: context-dependent inspector per selection type, debounced 200ms
- **`PrimitiveRenderer.tsx`** (409 lines) — Per-primitive visual renderer with rotation handles
- **`SeatDots.tsx`** — Single Konva `<Shape>` custom sceneFunc for all seats
- **`Toolbar.tsx`** (469 lines) — Tool groups, seat count, lock/user warning, save status

#### Hooks

- **`useDraftPersistence`**: localStorage every 2s, clear on save
- **`useLockHeartbeat`**: Acquire/heartbeat 60s/release/sendBeacon
- **`useSave`**: Ctrl+S, auto-save 30s

### 21.3 PHP Backend — Implemented Components

#### Plugin Bootstrap (`all-in-one-event-managing-platform.php`)

Constants: `AIOEMP_VERSION = '0.1.0'`, `AIOEMP_DB_VERSION = '1.7.0'`. Auto-creates tables on every `plugins_loaded` (version check in `AIOEMP_Activator::create_tables()`). Registers text domain `aioemp` via `load_plugin_textdomain()` on `plugins_loaded`.

#### Database (10 tables)

All created via `dbDelta()` in `class-aioemp-activator.php`. Explicit `ALTER TABLE` migrations in `run_migrations()` for: `online_url` on attender (v1.7.0), `preferred_language` (v1.6.0), `checked_in` (v1.4.0), `integrity_pass` (v1.2.0), `status`/`updated_at_gmt` on seatmap (v1.1.0), event columns (v1.3.0).

> **DB ALERT:** v1.7.0 added `online_url` column to `aioemp_attender` (per-candidate Zoom link). v1.6.0 added `preferred_language`. Migrations auto-run on `plugins_loaded`.

#### REST API (namespace: `aioemp/v1`)

| Controller | Endpoints | Status |
|---|---|---|
| `class-aioemp-rest-controller.php` | Abstract base | DONE |
| `class-aioemp-events-controller.php` | GET/POST/PUT/DELETE `/events` | DONE (536 lines) |
| `class-aioemp-attenders-controller.php` | `/events/{id}/attenders` CRUD + counts + bulk-status + CSV import/export + preferred_language + online_url | DONE (1149 lines) |
| `class-aioemp-seating-controller.php` | `/events/{id}/seating` assign/unassign/swap/block + batch + finalize + logs | DONE (754 lines) |
| `class-aioemp-attendance-controller.php` | `/events/{id}/resolve-ticket`, `/checkin`, `/attendance` + stats + export | DONE (368 lines) |
| `class-aioemp-seatmaps-controller.php` | GET/POST/PUT/DELETE `/seatmaps` | DONE (347 lines) |
| `class-aioemp-seatmap-upload-controller.php` | POST/DELETE `/seatmaps/upload-bg` | DONE (157 lines) |
| `class-aioemp-locking-controller.php` | POST `/lock/*` | DONE (178 lines) |
| `class-aioemp-settings-controller.php` | GET/PUT `/settings`, POST `/settings/logo` | DONE (152 lines) |
| `class-aioemp-users-controller.php` | `/users` CRUD + roles + search + create | DONE (353 lines) |
| `class-aioemp-profile-controller.php` | GET/PUT `/profile` | DONE (144 lines) |

#### Services

- **Locking service** (322 lines): Atomic SQL for race-free lock acquisition. TTL 90s.
- **Settings service** (279 lines): Single `wp_options` key, field-level sanitisation, typed defaults, language helpers (`get_main_language()`, `get_available_languages()`).
- **Email service** (531 lines): Email templates CRUD with locale-aware storage, `send()` with locale resolution (candidate's `preferred_language` → falls back to main), dynamic `<html lang>`, HTML email wrapper.

#### Admin Script Enqueue Chain (`class-aioemp-admin.php`, 224 lines)

1. `aioemp-admin` — SPA shell, hash router, REST helper (`window.aioemp_api`)
2. `aioemp-settings` (depends on admin)
3. `aioemp-users` (depends on admin)
4. `aioemp-profile` (depends on admin)
5. `seatmap-compiler` — Browser IIFE build of seatmap-core (`window.aioemp_compileSnapshot`)
6. `aioemp-events` (depends on admin + seatmap-compiler) — creates `window.AIOEMP_Events`
7. `html5-qrcode` — vendor library for camera QR scanning
8. Events sub-modules loaded sequentially: `_helpers` → `_list` → `_form` → `_detail` → `_candidates` → `_seating` → `_checkin` → `_attendance`
9. `aioemp-seatmaps` (depends on admin)
10. `aioemp-seatmap-editor` React bundle (depends on seatmaps)

**Localization**: `wp_localize_script` passes `rest_url`, `nonce`, `user_id`, `version`, `logo_url`, `user_caps` to `window.aioemp`

### 21.4 Events Module — Frontend Architecture

**Frontend:** jQuery-based SPA sub-modules sharing context via `window.AIOEMP_Events`.

The context object (`ctx = window.AIOEMP_Events`) holds:
- `api` — reference to `window.aioemp_api`
- `detailEventId`, `detailEvent` — current event
- `activeTab` — current tab
- `listState`, `candidateState`, `seatingState` — per-tab state

#### Events List (`_list.js`, 175 lines)
- Table: title, status badge, venue mode badge, start date, capacity, delete button
- Search (300ms debounce) + status filter, pagination 20/page

#### Event Form (`_form.js`, 240 lines)
- Create/edit with seatmap dropdown (published + integrity_pass), datetime conversion

#### Event Detail (`_detail.js`, 185 lines)
- Five capability-gated tabs: Overview, Candidates, Attendance Log, Check In, Seating

#### Candidates (`_candidates.js`, 1097 lines)
- Table with attendance column (checked_in badge from seat_assignment JOIN)
- Bulk status, add/edit modal with preferred language field, search/filter/pagination
- Language field fetches and caches enabled languages from Settings API via `getLanguages()`

### 21.5 Seat Assignment Model — `checked_in` Behaviour

The `AIOEMP_Seat_Assignment_Model` (322 lines) preserves the `checked_in` flag during:

- **`swap()`**: Reads `checked_in` from both assignments before delete, re-inserts with original values. Each candidate keeps their own check-in status across the swap.
- **`assign_batch()`**: When a candidate with an existing seat (and check-in) is reassigned, the `checked_in` value is carried over to the new assignment.
- **`list_for_event()`**: Returns `checked_in` in SELECT (JOINs with attender table for names).

### 21.6 Deployment Pipeline

Deployment is handled by `deploy.sh` which runs locally and pushes to the Hostinger server via SSH/rsync. **For credentials and SSH connection details, see `.ai-agent-notes.md`.** The pipeline:

1. **Pre-flight checks**: Scans for 0-byte files (FTP Simple corruption guard), validates critical file sizes
2. **Build core**: `cd seatmap-core && npm run build` (tsup: ESM + CJS + DTS)
3. **Build browser**: Browser IIFE build → `seatmap-compiler.js`
4. **Test**: `npm run test` (88 vitest tests must pass)
5. **Build editor**: `cd seatmap-editor && npm run build` (Vite IIFE → admin/js/seatmap-editor/)
6. **Deploy**: `rsync --delete` to remote server (excludes node_modules, .git, deploy.sh, .ai-agent-notes.md)
7. **Verify**: Checks JS file size matches, no empty files on server

To deploy: `cd <plugin-root> && bash deploy.sh`

### 21.7 Known Issues & Patterns for Future Agents

#### File Persistence Issues (RESOLVED)

Previous sessions experienced `replace_string_in_file` tool silently failing. This was caused by the **FTP Simple VS Code extension** overwriting local files with stale server copies. The workspace has since been disconnected from FTP Simple. If this recurs:
- Workaround: write files via Python scripts or `cat > file << 'EOF' ... EOF`
- Always verify edits with `grep` or `read_file` after writing
- The `deploy.sh` Step 0 corruption guard will catch 0-byte files

#### initLayout Recompile (CRITICAL)

The store's `initLayout()` **must** call `compileLayout()` on every load, not just copy `layout.compiled` from the database (see Section 21.2).

#### Browser IIFE Function Name (CRITICAL)

The browser build uses `--global-name _aioemp_sc` but the actual exported function is `window.aioemp_compileSnapshot` (set explicitly in `browser.ts`). **Do NOT use** `window._aioemp_sc.compile()`.

#### node_modules Management

`seatmap-core` and `seatmap-editor` each have their own `node_modules/`. The editor depends on core via `"@aioemp/seatmap-core": "file:../seatmap-core"`. After cloning:
```bash
cd seatmap-core && npm install && npm run build
cd ../seatmap-editor && npm install && npm run build
```

#### konva Type Definitions

The `konva` package's `lib/Node.d.ts` can become corrupted (0 bytes), causing ~54 TypeScript errors. Fix: `cd seatmap-editor && rm -rf node_modules/konva && npm install konva@9.3.22 --no-save`.

---

## Reminders for the AI Agent

1. **Read this entire document** before starting any implementation work.
2. **Security first.** Every endpoint, every input, every output must follow Section 3. This project will be pen-tested.
3. **Follow the build milestones** in order — foundation and security layer first.
4. **Use `$wpdb->prepare()`** for every database query with user input. No exceptions.
5. **Escape all output.** No raw `echo $var`. Use `esc_html()`, `esc_attr()`, `esc_url()`.
6. **Validate and sanitize all input server-side**, even for admin endpoints.
7. **Atomic SQL operations** for locking — use UPDATE with WHERE conditions to prevent race conditions.
8. **The attendance table is append-only.** Never update or delete records.
9. **Seatmap snapshot is immutable** once finalized or once assignments/attendance exist.
10. **Duplicate email registrations are allowed** by design — do not add uniqueness constraints on (event_id, email).
11. **All timestamps in the database are UTC** (`_gmt` suffix columns).
12. **Read `.ai-agent-notes.md`** for credentials, SSH details, and deployment instructions.
13. **Always run tests before deploying:** `cd seatmap-core && npm run test` (expect 88 passing, 6 files).
14. **Build order matters:** Build seatmap-core FIRST (editor depends on its dist/), then seatmap-editor.
15. **Deploy via:** `cd <plugin-root> && bash deploy.sh` — never manually copy files to server.
16. **initLayout must recompile** — never use raw `layout.compiled` from DB without re-running `compileLayout()`.
17. **Dev site:** https://mediation2026.dev01.online — admin login in `.ai-agent-notes.md`.
18. **Use `window.aioemp_compileSnapshot()`** for browser-side compilation, NOT `window._aioemp_sc.compile()`.
19. **`checked_in` must be preserved** during seat swap and batch reassignment.
20. **Capability check every endpoint** — use `AIOEMP_Security::CAPS` constants, never hardcode capability strings.
21. **`user_caps` is passed to JS** — use `window.aioemp_userCan(key)` for UI gating, but NEVER rely on it for security.
22. **Email templates are locale-aware.** When sending emails, always pass `$attender->preferred_language ?? null` as the 4th argument to `AIOEMP_Email_Service::send()`. The service handles fallback to main language automatically.
23. **DB version is `1.7.0`** — includes `preferred_language` and `online_url` columns on `aioemp_attender`. Migration auto-runs on `plugins_loaded`.
24. **Locale-specific email option keys** follow the pattern `aioemp_email_templates_{locale}`. If adding a plugin uninstall/cleanup routine, remember to delete these options for all enabled locales.
25. **`online_url` is per-candidate, not per-event.** The `{{online_url}}` email placeholder resolves from `$attender->online_url`. The event edit form no longer has an Online URL field. Admin assigns individual Zoom links via CSV export → fill in `online_url` column → CSV import (update mode).
