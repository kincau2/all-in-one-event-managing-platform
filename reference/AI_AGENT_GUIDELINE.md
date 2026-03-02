# AIOEMP — AI Agent Development Guideline

**All-in-One Event Managing Platform (AIOEMP)**
Version 1.2 | 28 Feb 2026

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
9. [Attendance Module](#9-attendance-module)
10. [Seatmap Templates & Parametric Builder](#10-seatmap-templates--parametric-builder)
11. [Event Seatmap Snapshot & Seating Allocation](#11-event-seatmap-snapshot--seating-allocation)
12. [Editor Locking (WP-Style Exclusive Edit)](#12-editor-locking-wp-style-exclusive-edit)
13. [Public Registration (Frontend)](#13-public-registration-frontend)
14. [External Registration REST API](#14-external-registration-rest-api)
15. [Email & Communications](#15-email--communications)
16. [Settings Module](#16-settings-module)
17. [Non-Functional & Compliance Requirements](#17-non-functional--compliance-requirements)
18. [Build Milestones (Recommended Order)](#18-build-milestones-recommended-order)
19. [Reference Documents](#19-reference-documents)

---

## 1. Project Overview

AIOEMP is a **custom WordPress plugin** that provides an all-in-one platform for event management, including:

- **Event CRUD** with draft/published/closed lifecycle.
- **Candidate (attender) registration** — public-facing, no login required, duplicate emails allowed.
- **QR-based check-in/out** with a confirm step and append-only attendance log.
- **Parametric seatmap builder** for creating reusable seatmap templates.
- **Per-event seatmap snapshots** with seat assignment, blocking, swapping.
- **WP-style editor locking** (one editor at a time) for seatmaps and events.
- **Email automation** for acknowledgement, status changes, and QR delivery.
- **Admin SPA dashboard** within wp-admin.
- **Public registration form** (shortcode/block) and **external REST API** for third-party sites.

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

### 3.2 Authentication & Authorization

- **Every** admin REST endpoint and AJAX handler must verify the user is authenticated (`is_user_logged_in()`) and has the required capability (`current_user_can()`).
- Use **custom capabilities** (e.g., `aioemp_manage_events`, `aioemp_manage_seatmaps`) mapped to appropriate roles, rather than relying solely on `manage_options`.
- **Server-side enforcement is mandatory.** Never trust client-side UI state to control access. Even if a button is hidden in the UI, the server must independently verify permissions.

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
- Public REST API endpoints that are truly public (registration) are exempt from nonce but must have other protections (see section 14).

### 3.8 Rate Limiting & Abuse Prevention

- **Public endpoints** (registration, QR scan API) must implement rate limiting per IP and per event.
- Use WordPress transients or a dedicated mechanism for tracking request counts.
- Return `429 Too Many Requests` when limits are exceeded.
- Log and monitor suspicious patterns (e.g., repeated failed QR scans, mass registration attempts).

### 3.9 CORS Policy

- For the external registration API: configure a strict CORS allowlist for known frontend origins.
- Do NOT use `Access-Control-Allow-Origin: *` in production.
- CORS is supplementary — always validate server-side regardless of origin headers.

### 3.10 Bot Mitigation

- Public registration endpoints should support **CAPTCHA/Turnstile** verification, with the token verified server-side.
- Make CAPTCHA configurable in plugin settings (provider, site key, secret key).

### 3.11 Data Protection & Privacy

- QR tokens/hashes: store as `SHA-256` hex digests (CHAR(64)). Do NOT store raw tokens if possible.
- Avoid logging or exposing PII in error messages, debug output, or REST error responses.
- Implement data handling aligned with Privacy Policy and Personal Information Collection Statement requirements.
- Provide mechanisms for data export and deletion to support privacy compliance.

### 3.12 File Upload Security (Settings — Logo)

- Validate MIME type server-side (not just file extension).
- Restrict to allowed image types only (JPEG, PNG, SVG with sanitization).
- Use WordPress media library APIs (`wp_handle_upload()`, `wp_check_filetype()`).
- Sanitize SVG files to remove embedded scripts if SVG is allowed.

### 3.13 Error Handling

- Return **generic error messages** to clients. Never expose stack traces, file paths, database details, or internal logic.
- Log detailed errors server-side using `error_log()` or a dedicated logging mechanism.
- Use appropriate HTTP status codes (400, 401, 403, 404, 429, 500).

### 3.14 Dependency & Supply Chain Security

- Pin JS dependency versions in `package.json` (use exact versions or lock files).
- Audit dependencies regularly (`npm audit`).
- Minimize third-party PHP dependencies; prefer WordPress core functions.

### 3.15 Security Headers

- Where the plugin controls output (e.g., admin SPA pages), set appropriate headers:
  - `Content-Type` with correct charset.
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN` (or use CSP frame-ancestors)
- Support Content Security Policy where feasible.

### 3.16 Audit Logging

- All sensitive operations must be logged to `aioemp_event_log` / `aioemp_seat_assignment_log`:
  - Lock acquire/release/takeover.
  - Candidate status changes.
  - Seat assign/unassign/swap/block.
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
| `aioemp_attender` | Candidate/registrant records per event |
| `aioemp_attendance` | Append-only check-in/out log |
| `aioemp_seatmap` | Reusable seatmap templates (status, layout JSON, lock fields, timestamps) |
| `aioemp_seatmap_meta` | Flexible key-value metadata for seatmaps |
| `aioemp_seat_assignment` | Current seat-to-candidate assignments per event |
| `aioemp_blocked_seat` | Blocked seats per event |
| `aioemp_seat_assignment_log` | Audit log for seat operations |

### 4.2 Table Definitions

#### aioemp_events

| Column | Type | Notes |
|---|---|---|
| id | BIGINT UNSIGNED AUTO_INCREMENT PK | |
| title | VARCHAR(255) NOT NULL | |
| status | VARCHAR(32) NOT NULL | draft / published / closed |
| start_date_gmt | DATETIME NULL | UTC |
| end_date_gmt | DATETIME NULL | UTC |
| capacity | INT UNSIGNED NULL | |
| venue_mode | VARCHAR(32) NULL | onsite / online / mixed |
| seatmap_layout_snapshot | LONGTEXT NULL | JSON snapshot from template |
| seatmap_finalized_at_gmt | DATETIME NULL | Once set, snapshot is frozen |
| lock_user_id | BIGINT UNSIGNED NULL | WP user ID |
| lock_token | CHAR(36) NULL | UUID v4 |
| lock_expires_at_gmt | DATETIME NULL | Lease expiry |
| lock_updated_at_gmt | DATETIME NULL | Last heartbeat |
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
| action | VARCHAR(64) NOT NULL | e.g. seat_assign, lock_takeover |
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
| device_id | VARCHAR(64) NULL | Device identifier |
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
| assigned_by | BIGINT UNSIGNED NULL | WP user ID |
| assigned_at_gmt | DATETIME NOT NULL | |

**Constraints:** UNIQUE(event_id, seat_key), UNIQUE(event_id, attender_id), INDEX(event_id)

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
| reason | VARCHAR(64) NULL | assign/unassign/swap/auto |
| created_at_gmt | DATETIME NOT NULL | |

**Indexes:** INDEX(event_id, created_at_gmt), INDEX(attender_id, created_at_gmt)

### 4.3 Database Installation Rules

- Use `dbDelta()` via WordPress's `$wpdb` for table creation on plugin activation.
- Store a DB version number in `wp_options` and run migrations on version mismatch.
- Use `$wpdb->prefix` for table name prefixing.
- All tables must use `$charset_collate = $wpdb->get_charset_collate()`.

---

## 5. Plugin Architecture & File Structure

Follow WordPress plugin best practices:

```
all-in-one-event-managing-platform/
├── all-in-one-event-managing-platform.php   # Main plugin bootstrap (v0.1.0)
├── deploy.sh                                # SSH deployment pipeline (see .ai-agent-notes.md)
├── .ai-agent-notes.md                       # Credentials & deployment details (git-ignored)
├── .gitignore
├── reference/                               # Design docs
│   ├── AI_AGENT_GUIDELINE.md               # THIS FILE
│   ├── AIOEMP_Logic_Flow_Notes_v0.2.md
│   ├── Build Parametric Seatmap Builder.md
│   ├── Data base schema.md
│   ├── Editor Locking (WP-style "one editor at a time").md
│   └── Functional Requirements.md
├── includes/
│   ├── class-aioemp-activator.php           # DB installer (dbDelta, 10 tables)
│   ├── class-aioemp-deactivator.php         # Capability revocation
│   ├── class-aioemp-loader.php              # Singleton, wires all hooks
│   ├── class-aioemp-security.php            # Capabilities, nonces, sanitisation, rate limiting
│   ├── rest-api/
│   │   ├── class-aioemp-rest-controller.php       # Abstract base controller
│   │   ├── class-aioemp-events-controller.php     # CRUD /events (536 lines)
│   │   ├── class-aioemp-attenders-controller.php  # Candidates CRUD /events/{id}/attenders (412 lines)
│   │   ├── class-aioemp-seating-controller.php    # Seating allocation /events/{id}/seating (685 lines)
│   │   ├── class-aioemp-seatmaps-controller.php   # CRUD /seatmaps
│   │   ├── class-aioemp-seatmap-upload-controller.php  # BG image upload
│   │   ├── class-aioemp-locking-controller.php    # Lock acquire/heartbeat/release/takeover
│   │   └── class-aioemp-settings-controller.php   # Settings CRUD + logo upload
│   ├── models/
│   │   ├── class-aioemp-model.php                 # Abstract base model ($wpdb wrapper)
│   │   ├── class-aioemp-events-model.php          # Events CRUD + search/pagination (116 lines)
│   │   ├── class-aioemp-attender-model.php        # Candidates CRUD + QR hash + bulk status (218 lines)
│   │   ├── class-aioemp-seat-assignment-model.php # Seat assignments + batch ops (312 lines)
│   │   ├── class-aioemp-blocked-seat-model.php    # Blocked seats + batch ops (180 lines)
│   │   ├── class-aioemp-seat-assignment-log-model.php # Seat operation audit trail (77 lines)
│   │   ├── class-aioemp-event-log-model.php       # Append-only event audit log (65 lines)
│   │   └── class-aioemp-seatmap-model.php         # Seatmap CRUD + search/pagination
│   └── services/
│       ├── class-aioemp-locking-service.php       # Atomic SQL locking (TTL 90s)
│       └── class-aioemp-settings-service.php      # Single wp_options key, typed defaults
├── admin/
│   ├── class-aioemp-admin.php               # Admin hooks, menu entry, script enqueue chain
│   ├── css/aioemp-admin.css                 # Admin styles (CSS custom properties)
│   ├── js/
│   │   ├── aioemp-admin.js                  # Admin SPA shell (jQuery, 208 lines)
│   │   ├── aioemp-events.js                 # Events module entry + shared context (112 lines)
│   │   ├── aioemp-settings.js               # Settings page JS (325 lines)
│   │   ├── aioemp-seatmaps.js               # Seatmaps list page JS (247 lines)
│   │   ├── seatmap-compiler.js              # Browser IIFE of seatmap-core compile (client-side snapshot compilation)
│   │   ├── events/                          # Events sub-modules (loaded sequentially)
│   │   │   ├── _helpers.js                  # Shared utilities: esc, fmtDate, localToGmt, gmtToLocal, badges
│   │   │   ├── _list.js                     # Events list page: table, search, filter, pagination, delete
│   │   │   ├── _form.js                     # Event create/edit form: all fields + seatmap template select
│   │   │   ├── _detail.js                   # Event detail page: header + tab container (Overview, Candidates, Attendance, Seating)
│   │   │   ├── _candidates.js               # Candidates tab: list, search, filter, pagination, add/edit modal, bulk status, delete
│   │   │   └── _seating.js                  # Seating tab: full-screen SVG dashboard (1606 lines)
│   │   └── seatmap-editor/                  # ← Vite IIFE build output
│   │       ├── seatmap-editor.js            # ~573 KB (React+Konva+Zustand bundle)
│   │       ├── seatmap-editor.js.map        # Source map
│   │       └── seatmap-editor.css           # ~4.5 KB
│   └── views/
│       └── dashboard-shell.php              # Full-screen SPA shell template
├── public/                                  # Public-facing (stub, not yet fully implemented)
│   ├── class-aioemp-public.php              # Public hooks placeholder
│   ├── css/aioemp-public.css                # Public styles placeholder
│   └── js/aioemp-public.js                  # Public JS placeholder
├── seatmap-core/                            # @aioemp/seatmap-core (TypeScript library)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts                     # Vitest configuration
│   ├── src/                                 # Source (see Section 20.2)
│   │   ├── index.ts                         # Barrel re-exports
│   │   ├── schema.ts                        # Zod schemas (220 lines)
│   │   ├── types.ts                         # Zod-inferred TypeScript types
│   │   ├── compile-layout.ts                # Orchestrator compiler
│   │   ├── compile-grid.ts                  # Grid block compiler
│   │   ├── compile-arc.ts                   # Arc block compiler (200 lines)
│   │   ├── browser.ts                       # Browser IIFE entry (exposes compile for seatmap-compiler.js)
│   │   ├── pivot.ts                         # Rotation pivot helpers + visual constants
│   │   ├── seat-key.ts                      # seat_key preservation map
│   │   └── utils.ts                         # Shared utilities (134 lines)
│   ├── tests/                               # Vitest (6 files)
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
- Each REST controller must extend `WP_REST_Controller` or follow its conventions.

---

## 6. Admin Dashboard (SPA Shell)

### Entry Point

- WordPress admin menu item: **"Event Manager"**.
- Opens a full-screen dashboard page that overlays standard wp-admin content.

### Full-Screen Overlay Behaviour

The SPA shell is rendered as a `position: fixed; inset: 0; z-index: 99999` overlay that completely covers the default WordPress admin chrome (admin bar, left sidebar, content area). A body class `aioemp-active` is added on load to hide WP elements and prevent double-scroll. Users can return to WP via an explicit **"WP Dashboard"** button in the top bar.

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
| `.aioemp-badge` with `--draft/--published/--closed` | Status pills |

#### Layout Structure

```
.aioemp-app                 (fixed fullscreen overlay)
├── .aioemp-sidebar          (white, 240px, left)
│   ├── .aioemp-sidebar__brand
│   ├── .aioemp-sidebar__section  (label)
│   └── .aioemp-sidebar__nav > ul.aioemp-sidebar__menu > li > a.aioemp-nav-link
└── .aioemp-body             (flex column)
    ├── .aioemp-topbar       (white, 60px, shadow)
    │   ├── .aioemp-topbar__left  (toggle btn + page title)
    │   └── .aioemp-topbar__right (WP Dashboard btn + user avatar)
    └── .aioemp-content      (scrollable, padded)
```

### Agent Rules for UI

1. **Always** use the CSS custom properties — never hard-code colour hex values.
2. Wrap route content in `.aioemp-card` for consistency.
3. Use `.aioemp-btn--primary` for primary actions, `--danger` for destructive.
4. Update `#aioemp-page-title` via the router when changing routes.
5. All icon usage must use WordPress Dashicons (`dashicons-*` classes).
6. On mobile (≤ 782px) the sidebar slides in/out — toggled by `#aioemp-toggle-sidebar`.

### Security in Admin Shell

- All admin REST calls must include the WP nonce in request headers.
- Server must verify capability on every request regardless of what the UI shows.

---

## 7. Events Module

### 7.1 Events List Page

- Table columns: title, start/end, status, capacity, venue mode, seatmap mode.
- Filters: status, keyword search. Paginated.
- Actions: view, edit, create new.

### 7.2 Create Event

- Fields: title, start/end datetime, capacity, venue address, venue mode (onsite/online/mixed), status.
- **Seating mode selection:** Free seating (no seatmap) OR Seatmap-based (select template).
- On save with seatmap-based: **create event seatmap snapshot** from selected template.
- On save with free seating: seating tab is hidden.

### 7.3 Edit Event

#### Critical Rules

- If `seatmap_finalized_at_gmt` is set → **cannot** change seatmap selection or snapshot.
- If any attendance logs exist OR any seat assignments exist → **cannot** change seatmap snapshot.
- Basic fields (time/capacity/venue) remain editable but changes should be logged.

### 7.4 Event Detail Page (Tabs)

| Tab | Purpose |
|---|---|
| Overview | Event summary, key metrics, pie chart (registered vs checked-in) |
| Candidates | List/manage candidates, status changes, communications |
| Attendance | Scan QR, log check-in/out |
| Seating | Seat allocation dashboard (seatmap-based events only) |

---

## 8. Candidates / Attenders Module

### 8.1 Candidates List Tab (per event)

- Table columns: name, email, company, status, seat label, check-in indicator.
- Search and filters: keyword, status.
- **Bulk actions:** Accept (On-site), Accept (Online), Reject.
- **Row actions:** View, change status, resend emails.

### 8.2 Candidate Status Flow

- Statuses: `registered`, `accepted_onsite`, `accepted_online`, `rejected`.
- Status change triggers automated email.
- QR email is sent to accepted candidates (configurable: send on acceptance vs on registration).

### 8.3 Critical Rules

- **Allow duplicate registrations** with the same email for the same event. Do NOT enforce uniqueness on (event_id, email).
- Generate unique QR token/hash per candidate record.

### 8.4 Candidate Detail Page

- Profile info, seat assignment (if any), attendance history (IN/OUT rows with timestamps).

---

## 9. Attendance Module

### 9.1 Scan Workflow

1. Admin opens Attendance tab for an event.
2. Scanner reads QR token/hash (camera or manual input).
3. System resolves token → candidate; shows popup with candidate details.
4. Admin clicks **Confirm IN** or **Confirm OUT**.
5. System writes an append-only attendance log record.

### 9.2 Validation Rules

- **Prevent invalid sequences:** IN after IN without OUT, OUT without prior IN.
- Allow admin override for edge cases, but **log** the override.

### 9.3 Exports

- CSV export of attendance logs.
- Optional: candidate list with latest IN/OUT status.

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
- **Inspector panel:** Editable params for selected primitive, live recompile preview (debounced 150–300ms).
- **Performance:** Render seats as lightweight circles in Konva. Seats are NOT individually draggable — selection is per primitive. Target: 2,000+ seats without lag.

### 10.8 Drafts & Save Pipeline

- Keep state in memory (Zustand/Redux store).
- Auto-persist draft to `localStorage` key `aioemp_seatmap_draft_<seatmapId>` (debounced 2s). Clear on successful save.
- **Save pipeline:** Validate (Zod) → Compile → POST to server → server validates lock + schema → store in DB.

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

### 11.3 Seating Tab / Allocation Dashboard

- Render the **event snapshot** (not the template).
- Visual states: empty seat (seat icon), assigned seat (user icon), user icon color reflects check-in status.
- **Assign flow:** Search candidate → select → click seat to assign.
- **Actions:** unassign, swap, block/unblock.
- On first seat assignment (or explicit action): set `seatmap_finalized_at_gmt` to freeze the snapshot.

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

## 13. Public Registration (Frontend)

### Flow

1. User opens public registration form (shortcode/block) for an event.
2. Submits personal info (name, email, company, etc.).
3. System creates candidate record (`status=registered`), generates QR token/hash.
4. Shows thank-you confirmation, sends acknowledgement email.
5. If approval workflow enabled: QR sent when accepted. Otherwise: QR sent immediately.

### Rules

- **No login required.**
- **Allow duplicate registrations** with the same email.
- Validate all required fields; show friendly error messages.
- Implement CAPTCHA/Turnstile for bot mitigation (configurable).

---

## 14. External Registration REST API

Provide a public REST endpoint for external websites:

```
POST /wp-json/aioemp/v1/public/events/{event_id}/register
```

### Security Controls (Mandatory)

- **Do NOT rely on API keys in client-side JavaScript** — treat endpoint as public.
- Accept **JSON request bodies only**; return JSON responses with clear success/error codes.
- **Strict input validation:** required fields, type checks, max lengths, sanitization.
- **Rate limiting** per IP and per event with burst control.
- **CAPTCHA/Turnstile** token verification server-side.
- **CORS allowlist** for known frontend origins (still validate server-side).
- **Safe error handling:** generic errors, no leaking of internals.
- **Optional:** Email confirmation (double opt-in) if spam becomes a problem.
- **Audit logging:** log all registrations and suspicious patterns.

---

## 15. Email & Communications

### Email Types

| Email | Trigger |
|---|---|
| Submission acknowledgement | On registration |
| Status change notification | On accept (onsite/online) or reject |
| QR code delivery | On acceptance (configurable) or on registration |
| EDM broadcast | Admin-triggered to filtered registrant lists |

### Rules

- Use `wp_mail()` for all emails.
- Templates must be configurable in admin Settings.
- QR delivery timing is configurable: on acceptance vs on registration.
- All emails must be logged or auditable.

---

## 16. Settings Module

- **Company logo upload** (used in admin shell header).
- **Email template configuration** (acknowledgement, status change, QR).
- **Behavior toggles:**
  - Send QR on acceptance vs on registration.
  - Default venue mode.
  - Default capacity.
  - Device naming for scanners.
- **CAPTCHA configuration** (provider, site key, secret key).

---

## 17. Non-Functional & Compliance Requirements

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

## 18. Build Milestones (Recommended Order)

> **Rationale for order:** The seatmap builder and seating allocation are the most technically complex and highest-risk parts of the project. They are prioritised immediately after the foundation so that unknowns (geometry algorithms, seat_key stability, snapshot/freeze logic) are resolved early, while the rest of the system is still flexible.

| Phase | Scope |
|---|---|
| 1 | **Foundation:** DB installer (`dbDelta`) + plugin bootstrap + custom capabilities + nonce framework + shared security helper class |
| 2 | **Admin SPA shell + Settings skeleton:** wp-admin menu entry, full-screen SPA shell, left-nav routing, Settings page (logo upload, CAPTCHA config, behaviour toggles) |
| 3 | **`@aioemp/seatmap-core` (headless):** Layout JSON schema (Zod), `compileLayout()` for Grid/Arc primitives, seat_key stability strategy, unit tests for all compile algorithms |
| 4 | **`@aioemp/seatmap-editor` (UI):** Konva + React canvas, Zustand store, inspector panel, undo/redo, draft persistence, save pipeline with lock token; Seatmaps list page (CRUD) |
| 5 | **Editor locking:** `lock_acquire / lock_heartbeat / lock_release / lock_takeover` endpoints (atomic SQL), frontend heartbeat and takeover modal; applied to seatmap editor |
| 6 | **Event seatmap snapshot + Seating allocation:** Create event with seatmap-based mode (snapshot copy), seating tab with Konva overlay (assignments + blocked + check-in colours), assign/unassign/swap/block actions, `seatmap_finalized_at_gmt` trigger; apply editor locking to event editor |
| 7 | **Core Events + Candidates CRUD:** Events list/create/edit pages, Candidates tab (list, status change, bulk actions, candidate detail), event Overview tab metrics |
| 8 | **Attendance:** QR token generation, scan + confirm IN/OUT flow, sequence validation, attendance log tab, CSV export |
| 9 | **Public registration:** Shortcode/block form, CAPTCHA/Turnstile integration, acknowledgement email, external REST registration endpoint with rate limiting and CORS allowlist |
| 10 | **Email automation:** Status-change emails (accept/reject), QR delivery (configurable timing), EDM broadcast, configurable email templates in Settings UI |

> **Important:** Security controls are NOT a separate phase — they must be integrated into every phase from the start.

---

## 19. Reference Documents

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

## 20. Implementation Progress (as of 28 Feb 2026)

> **CRITICAL: Read this section carefully.** It documents what has been built, what works, and known patterns/pitfalls from previous development sessions.

### 20.1 Milestone Status

| Phase | Status | Notes |
|---|---|---|
| 1. Foundation | **DONE** | DB installer (10 tables via `dbDelta`), plugin bootstrap, custom capabilities (`aioemp_manage_events`, `aioemp_manage_seatmaps`, `aioemp_manage_settings`, `aioemp_scan_attendance`), security helper class |
| 2. Admin SPA Shell + Settings | **DONE** | Full-screen SPA shell, Star Admin 2 Pro colour palette, Settings page (logo upload, behaviour toggles), CSS custom properties |
| 3. `@aioemp/seatmap-core` | **DONE** | Zod schemas, compile algorithms (Grid, Arc), deterministic seat_key (FNV-1a), row label compilation, 88 vitest tests passing (6 files) |
| 4. `@aioemp/seatmap-editor` | **DONE** | Konva + React 18 canvas, Zustand 5 + Immer store, inspector panel, undo/redo, draft persistence (localStorage), save pipeline with lock token, keyboard shortcuts |
| 5. Editor Locking | **DONE** | Atomic SQL locking (TTL 90s), heartbeat 60s, acquire/release/takeover, sendBeacon on unload, frontend takeover modal |
| 6. Event Seatmap Snapshot + Seating | **DONE** | Snapshot copy on event create/update, snapshot freeze enforcement, full-screen SVG seating dashboard, assign/unassign/swap/block (single + batch), drag-select, zoom/pan, auto-finalize |
| 7. Events + Candidates CRUD | **DONE** | Events list/create/edit/detail pages, Candidates tab (list, search, filter, pagination, add/edit modal, bulk status changes, delete, status counts) |
| 8. Attendance | **NOT STARTED** | |
| 9. Public Registration | **NOT STARTED** | |
| 10. Email Automation | **NOT STARTED** | |

### 20.2 `@aioemp/seatmap-core` — Detailed Architecture

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

- **Layout** (`LayoutSchema`): schemaVersion (literal 1), title, canvas (w/h/unit), seatRadius, style fields (seatFill, seatStroke, seatFont (`-apple-system, sans-serif`), seatFontWeight, seatFontColor, seatFontSize, rowFontColor, rowFontSize, rowFontWeight, bgColor, bgImage), primitives[], compiled

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
- Row labels: Left labels at `origin.x - GRID_PAD - GRID_LBL_W * 0.5`, right labels at `origin.x + seatW + GRID_PAD + GRID_LBL_W * 0.5` (centered in label columns)
- Returns `{ seats: CompiledSeat[], rowLabels: CompiledRowLabel[] }`

**`compileArc(primitive, keyMap, globalSeatRadius)`** — in `compile-arc.ts` (200 lines):
- Elliptical arc via `radiusRatio` (radiusX = baseRadius * ratio, radiusY = baseRadius)
- Seat positions: polar → cartesian, distributed evenly across `[startAngleDeg, endAngleDeg]` minus gap angles
- Aisle gaps: px→angle conversion via `(gapPx / avgRadius) * (180/π)`
- Row labels: offset angularly beyond the seat arc by `(ARC_PAD + ARC_LBL_ANG * 0.5) / avgRadius * (180/π)` degrees
- Returns `{ seats: CompiledSeat[], rowLabels: CompiledRowLabel[] }`

#### Pivot & Visual Constants (`pivot.ts`)

Shared between compiler and editor renderer. **Current values (24 Feb 2026):**

| Constant | Value | Purpose |
|---|---|---|
| `GRID_PAD` | `21` | Pixel padding around seat area in grid dotted rect |
| `GRID_LBL_W` | `24` | Row-label column width (applied to BOTH left and right sides) |
| `ARC_PAD` | `21` | Radial pixel padding around arc sector |
| `ARC_LBL_ANG` | `33` | Extra angular pixels for row labels in arc |

**`gridPivotOffset(cols, rows, seatSpacingX, seatSpacingY)`**: Returns center of the dotted rectangle. Rectangle dimensions: `lx = -GRID_PAD - GRID_LBL_W`, `ly = -GRID_PAD`, `rectW = seatW + 2*GRID_PAD + 2*GRID_LBL_W`, `rectH = seatH + 2*GRID_PAD`. Pivot = `(lx + rectW/2, ly + rectH/2)`.

**`arcPivotOffset(...)`**: Samples 33 points along padded sector (inner + outer radii, with angular padding), computes AABB, returns center.

#### seat_key Generation (`seat-key.ts`)

`deterministicSeatKey(primitiveId, logicalRow, logicalSeat)` — generates a stable UUID v4 string using four independent FNV-1a 32-bit hashes (different seeds) of the input string `"primitiveId:row:seat"`. Produces 128 bits of hash output formatted as `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.

No map or existing seat data is needed. The same primitive ID + row + seat index always yields the same key — across recompiles, layout edits, and server round-trips. This is critical for database seat assignments surviving layout edits.

#### Utilities (`utils.ts`)

`degToRad`, `rotatePoint(px,py,cx,cy,angleDeg)`, `labelToIndex/indexToLabel` (A→0, Z→25, AA→26), `generateRowLabel(start, rowIdx, direction, mode)`, `getSeatsPerRow(spec, rowIdx)`, `generateUUID()`, `round2(n)`.

### 20.3 `@aioemp/seatmap-editor` — Detailed Architecture

**Package:** React 18 SPA, built with Vite as IIFE → `admin/js/seatmap-editor/`

**Build:** `cd seatmap-editor && npm run build` → outputs `seatmap-editor.js` (~573 KB) + `seatmap-editor.css` (~4.5 KB)

**Entry point:** `window.aioemp_seatmap_editor.mount(container, { seatmapId, onClose })` — creates React 18 root, renders `<App>`.

#### Store (`store.ts`, 494 lines)

Zustand 5 + Immer middleware. Key design decisions:

- **`initLayout(layout)`**: Always recompiles on load via `compileLayout(layout, layout)`. This ensures compiled seat/label positions match the current algorithm, not stale positions saved in the database. This was a critical bug fix — without recompilation, the dotted area (computed fresh by PrimitiveRenderer) would mismatch the compiled seat positions (from DB), causing visual bleeding on fresh load.

- **`recompile()`**: Called after every primitive edit. Spread-copies layout as `previousLayout` for seat_key preservation, then calls `compileLayout()`.

- **Undo/Redo**: Snapshot-based (max 50 depth). `pushSnapshot()` called before every mutation. Full layout snapshots (not diffs).

- **State shape**:
  ```
  seatmapId, layout, compiledSeats[], compiledRowLabels[],
  selectedIds[], selectedSeatKeys[], activeTool,
  undoStack[], redoStack[],
  stageX, stageY, stageScale, snapToGrid,
  saveStatus, isDirty,
  lockToken, lockOwnerId, lockOwnerName, isLocked
  ```

#### Components

**`EditorCanvas.tsx`** (1035 lines) — The main Konva Stage. Handles:
- Wheel zoom (centered on pointer)
- Pan: middle mouse button drag OR Space + left drag
- Block selection: rubber-band rectangle in `blockSelect` tool
- Seat selection: rubber-band in `seatSelect` tool, tests point-in-rect for each compiled seat
- Drag-to-create: `addGrid` / `addArc` tools — drag rectangle on canvas, creates primitive on mouse up with computed rows/cols from rect size
- Move: drag selected primitives with Ctrl/Cmd to duplicate
- Rotation: drag corner circle handles
- Resize: drag edge hit-areas (obstacle only)
- Arrow keys: pan viewport or move selected primitives (Shift = 10x)
- Delete/Backspace: remove selected primitives
- Escape: deselect all
- Renders: background color/image, grid guides (when snap enabled), `<PrimitiveRenderer>` per primitive, `<SeatDots>` for all compiled seats + row labels

**`InspectorPanel.tsx`** (728 lines) — Right sidebar:
- Nothing selected → Layout overview (canvas size, seat radius, colours, font settings, bg image upload)
- Stage selected → StageInspector (x, y, width, height, label)
- Label selected → LabelInspector (text, fontSize, fontColor)
- Obstacle selected → ObstacleInspector (x, y, width, height, fill, stroke, label)
- Grid selected → GridInspector (rows, cols, spacingX/Y, aisleGaps, section, rowLabel mode/start/direction, numbering, startSeatNumber, rowLabelDisplay, seatRadius)
- Arc selected → ArcInspector (rowCount, startRadius, radiusStep, radiusRatio, startAngleDeg, endAngleDeg, seatsPerRow, section, rowLabel, numbering, rowLabelDisplay, seatRadius)
- All numeric inputs debounced 200ms to prevent lag during typing

**`PrimitiveRenderer.tsx`** (409 lines) — Pure visual renderer:
- Grid blocks: `<Group>` with pivot rotation, dotted `<Rect>` (stroke `#4B49AC44`, dash `[4,4]`), section label, corner `<Circle>` rotation handles when selected
- Arc blocks: `<Group>` with pivot rotation, custom `<Shape>` sector path (`drawSectorPath`), section label, corner handles
- Obstacles: filled `<Rect>` with resize edge hit-areas when selected
- Stages: grey `<Rect>`
- Labels: `<Text>` with rotation
- Uses shared constants/functions from `@aioemp/seatmap-core` (`GRID_PAD`, `GRID_LBL_W`, `ARC_PAD`, `ARC_LBL_ANG`, `gridPivotOffset`, `arcPivotOffset`)

**`SeatDots.tsx`** — Performance-optimized rendering:
- Single Konva `<Shape>` with custom `sceneFunc` draws ALL seats as circles + numbers
- Three render passes: normal seats (layout colours), excluded seats (greyed + X), selected seats (orange)
- Row labels: separate `<Shape>` with `textAlign = 'center'`, `textBaseline = 'middle'`
- Reads style settings reactively from store (seatFill, seatStroke, seatFontColor, seatFontSize, rowFontColor, rowFontSize, rowFontWeight)
- `React.memo` for performance

**`Toolbar.tsx`** (469 lines) — Horizontal toolbar:
- Tool groups: Block Select (V), Seat Select (S), Draw Grid (G), Draw Arc (A), +Stage, +Obstacle, +Label, Delete, Duplicate, Undo (Ctrl+Z), Redo (Ctrl+Shift+Z), Snap toggle, Zoom slider
- Seat count display, lock/user warning, save status indicator
- Help modal with keyboard shortcuts
- Seat select icon: pretix SVG (`tool-seatselect` — cursor with arc indicator)

#### Hooks

- **`useDraftPersistence`**: Auto-saves to `localStorage` key `aioemp_seatmap_draft_<id>` every 2s when dirty. Restores if < 1 hour old. Clears on successful save.
- **`useLockHeartbeat`**: Acquires lock on mount. Heartbeat every 60s (server TTL = 90s). Releases on unmount + `sendBeacon` in `beforeunload`.
- **`useSave`**: `save()` validates via `validateAndCompile`, PUTs to `/aioemp/v1/seatmaps/<id>`. Ctrl+S shortcut. Auto-save every 30s when dirty.

#### Layout Style Defaults (`layoutDefaults.ts`)

```typescript
{
  seatRadius: 10,
  seatFill: '#4B49AC',
  seatStroke: '#3a389a',
  seatFontWeight: 'bold',
  seatFontColor: '#ffffff',
  seatFontSize: 0,        // 0 = auto-scale to fit circle
  rowFontColor: '#666666',
  rowFontSize: 11,
  rowFontWeight: 'bold',
  bgColor: '#ffffff',
  bgImage: '',
}
```

### 20.4 PHP Backend — Implemented Components

#### Plugin Bootstrap (`all-in-one-event-managing-platform.php`)

Constants: `AIOEMP_VERSION = '0.1.0'`, `AIOEMP_DB_VERSION = '1.1.0'`. Auto-creates tables on every `plugins_loaded` (version check in `AIOEMP_Activator::create_tables()`).

#### Database (10 tables)

All created via `dbDelta()` in `class-aioemp-activator.php`:

1. `aioemp_events` — Full schema per Section 4.2
2. `aioemp_event_meta` — Key/value meta
3. `aioemp_event_log` — Audit trail
4. `aioemp_attender` — Registrants with QR hash
5. `aioemp_attendance` — Append-only scan log
6. `aioemp_seatmap` — Seatmap templates (layout JSON + lock columns + timestamps)
7. `aioemp_seatmap_meta` — Key/value meta
8. `aioemp_seat_assignment` — Seat ↔ candidate per event
9. `aioemp_blocked_seat` — Blocked seats per event
10. `aioemp_seat_assignment_log` — Seat operation audit

#### REST API (namespace: `aioemp/v1`)

| Controller | Endpoints | Status |
|---|---|---|
| `class-aioemp-rest-controller.php` | Abstract base | DONE |
| `class-aioemp-events-controller.php` | GET/POST/PUT/DELETE `/events` | DONE (536 lines) |
| `class-aioemp-attenders-controller.php` | GET/POST/PUT/DELETE `/events/{id}/attenders`, `/attenders/counts`, `/attenders/bulk-status` | DONE (412 lines) |
| `class-aioemp-seating-controller.php` | GET `/events/{id}/seating`, POST `assign/unassign/swap/block/unblock` + batch variants + finalize | DONE (685 lines) |
| `class-aioemp-seatmaps-controller.php` | GET/POST/PUT/DELETE `/seatmaps` | DONE |
| `class-aioemp-seatmap-upload-controller.php` | POST/DELETE `/seatmaps/upload-bg` | DONE |
| `class-aioemp-locking-controller.php` | POST `/lock/*` | DONE |
| `class-aioemp-settings-controller.php` | GET/PUT `/settings`, POST `/settings/logo` | DONE |

#### Services

- **Locking service**: Atomic SQL (`UPDATE ... WHERE lock_user_id IS NULL OR lock_expires_at_gmt < NOW()`) for race-free lock acquisition. TTL 90s.
- **Settings service**: Single `wp_options` key, field-level sanitisation, typed defaults.

#### Admin

- **Menu**: Top-level "Event Manager" menu item (`dashicons-calendar-alt`, capability `aioemp_manage_events`)
- **Script enqueue chain** (193 lines in `class-aioemp-admin.php`):
  1. `aioemp-admin` — SPA shell, hash router, REST helper (`window.aioemp_api`)
  2. `aioemp-settings` (depends on admin)
  3. `seatmap-compiler` — Browser IIFE build of seatmap-core compile functions (`window.aioemp_compileSnapshot`)
  4. `aioemp-events` (depends on admin + seatmap-compiler) — creates shared context `window.AIOEMP_Events`
  5. Sub-modules loaded sequentially: `events/_helpers` → `events/_list` → `events/_form` → `events/_detail` → `events/_candidates` → `events/_seating`
  6. `aioemp-seatmaps` (depends on admin)
  7. `aioemp-seatmap-editor` React bundle (depends on seatmaps)
- **Localization**: `wp_localize_script` passes `rest_url`, `nonce`, `user_id`, `version`, `logo_url` to `window.aioemp`

### 20.5 Events Module — Detailed Architecture (Phase 7)

**Frontend:** jQuery-based SPA sub-modules sharing context via `window.AIOEMP_Events`.

#### Module Structure

The events module uses a shared context object (`ctx = window.AIOEMP_Events`) that all sub-modules extend. The context holds:
- `api` — reference to `window.aioemp_api` REST helper
- `detailEventId`, `detailEvent` — current event being viewed
- `activeTab` — current tab (overview/candidates/attendance/seating)
- `listState` — events list pagination/filter state
- `candidateState` — candidates tab pagination/filter state
- `seatingState` — seating tab state (assignments, blocked, selections, zoom, etc.)

#### Events List (`_list.js`)
- Table: title, status (badge), venue mode (badge), start date, capacity, delete button
- Search input (300ms debounce) + status filter dropdown
- Pagination: prev/next buttons, 20 per page
- Row click → navigates to `#event/{id}`

#### Event Form (`_form.js`)
- Full-page form for create/edit with back button
- Fields: title (required), description, status (draft/published/closed), venue mode, start/end datetime-local, capacity, seatmap template dropdown, location name/address, online URL, cover image URL
- Seatmap dropdown loads published templates with `integrity_pass` check
- Datetime conversion: `localToGmt()` / `gmtToLocal()` for UTC storage
- Save: POST (create) or PUT (update) to `/events` endpoint

#### Event Detail (`_detail.js`)
- Header: back link, event title, status/venue badges, date, capacity
- **Four tabs**: Overview, Candidates, Attendance, Seating (Seating tab only shown if event has a seatmap)
- **Overview tab**: event info grid (title, description, status, venue, dates, capacity, location, online URL, seatmap, created), candidate statistics card (total, registered, accepted onsite, accepted online, rejected — loaded from `/attenders/counts` endpoint)
- **Attendance tab**: placeholder for Phase 8

#### Candidates Tab (`_candidates.js`)
- Table: checkbox, name, email, company, status badge, registered date, edit/delete actions
- Search (300ms debounce) + status filter (registered, accepted_onsite, accepted_online, rejected)
- **Bulk actions**: select-all checkbox, bulk status change (Accept On-site, Accept Online, Reject) via `POST /attenders/bulk-status`
- **Add/Edit modal**: overlay modal form with title (Mr/Ms/Mrs/Dr), first name (required), last name, email, company, status dropdown
- **Delete**: confirmation dialog, `DELETE /attenders/{id}`
- Pagination: prev/next, 20 per page

#### Backend: Attenders Controller (`class-aioemp-attenders-controller.php`, 412 lines)

| Method | Route | Description |
|---|---|---|
| GET | `/events/{id}/attenders` | Paginated list; filters: `status`, `search` (name/email/company LIKE), `ids` (comma-separated, bypasses pagination) |
| POST | `/events/{id}/attenders` | Create candidate; requires `first_name` or `last_name`; auto-generates SHA-256 QR hash |
| GET | `/events/{id}/attenders/{aid}` | Single candidate read |
| PUT | `/events/{id}/attenders/{aid}` | Update candidate fields |
| DELETE | `/events/{id}/attenders/{aid}` | Delete candidate |
| GET | `/events/{id}/attenders/counts` | Status breakdown: `{registered, accepted_onsite, accepted_online, rejected, total}` |
| POST | `/events/{id}/attenders/bulk-status` | Bulk update status for array of IDs; body: `{ids: [...], status: "..."}` |

#### Backend: Attender Model (`class-aioemp-attender-model.php`, 218 lines)

- `STATUSES`: `registered`, `accepted_onsite`, `accepted_online`, `rejected`
- `create()`: auto-generates `qrcode_hash` via SHA-256 of UUID4 + random password
- `list_for_event()`: paginated; supports `ids` filter for fetching specific candidates, multi-field LIKE search
- `count_by_status()`: returns status breakdown counts
- `bulk_update_status()`: scoped to event_id for safety
- `find_by_qr_hash()`: for future QR scan lookup

### 20.6 Event Seatmap Snapshot + Seating — Detailed Architecture (Phase 6)

#### Snapshot Lifecycle

1. **Creation**: When an event is created/updated with a `seatmap_id`, the events controller copies the seatmap template's `layout` JSON into `seatmap_layout_snapshot`. The seatmap must have `status=publish` and `integrity_pass=true`.
2. **Client-side compilation**: The seating tab uses `window.aioemp_compileSnapshot()` (from `seatmap-compiler.js`, a browser IIFE build of seatmap-core) to compile primitives → flat seat list on the client. This ensures seats positions are always computed from current algorithms.
3. **Freeze enforcement**: `check_snapshot_freeze()` in the events controller prevents seatmap changes if: (a) `seatmap_finalized_at_gmt` is set, (b) seat assignments exist, or (c) attendance records exist.
4. **Auto-finalization**: `maybe_finalize()` in the seating controller sets `seatmap_finalized_at_gmt` on the **first** seat assignment, permanently freezing the snapshot.

#### Seating Dashboard UI (`_seating.js`, 1606 lines)

A full-screen overlay (`position:fixed; inset:0; z-index above SPA shell`) that provides:

**Layout:**
- Left panel: candidate search + paginated list (50 per page, status filter `accepted_onsite` only)
- Main area: SVG seatmap canvas + toolbar + info bar
- Header: back button, event title, stats bar (total/assigned/blocked/available)

**Three Modes:**
1. **Assign mode**: Select candidate(s) from panel → click empty seats to mark pending → Confirm Assignment button fires batch assign
2. **Block mode**: Click or drag-select empty seats → Block/Unblock Selected buttons
3. **Swap mode**: Click first assigned seat → click second assigned seat → atomic swap

**SVG Rendering:**
- Seats rendered as `<circle>` elements with `data-key` attributes
- Seat number labels as `<text>` elements
- Row labels from `compiled.rowLabels`
- Decorations: labels (`<text>`), obstacles (`<rect>`) from primitives
- Canvas area with shadow, workspace background (`#e8e8e8`)
- Color coding: empty (layout seatFill), assigned (#28a745 green), blocked (#dc3545 red with ✕), pending (#f59e0b amber), pending-block (#ff6b6b), selected-assigned (#0ea5e9 blue)

**Interactions:**
- **Zoom**: mouse wheel (centered on pointer), +/- buttons, Fit button, zoom level display
- **Pan**: Space + drag (changes SVG viewBox)
- **Drag selection** (marquee): mousedown on empty area, drag rectangle overlay, on release selects seats within bounds (assign mode: selects assigned candidates; block mode: stages seats for batch block)
- **Candidate multi-select**: Shift+click candidates, deselect-all button, selected count display
- **Candidate info popup**: modal with name, email, company, status, seat, registration date
- **Keyboard shortcuts**: Escape (close overlay / close help modal), Cmd/Ctrl+D (deselect all)
- **Help modal**: keyboard shortcuts table + workflow tutorial

**Candidate List:**
- Filters: all, unassigned, assigned
- Shows seat badge for assigned candidates
- Info button per candidate (opens detail popup)
- Shift+click for multi-select
- When candidates are selected from the seatmap (by clicking assigned seats), switches to "selected view" showing only those candidates
- Pagination: prev/next, 50 per page

**Batch Operations:**
- **Batch assign**: `POST /seating/assign-batch` with `{pairs: [{attender_id, seat_key}]}` — matches N candidates to N pending seats in selection order; auto-unassigns old seats
- **Batch unassign**: `POST /seating/unassign-batch` with `{seat_keys: [...]}` — for all selected candidates that have seats
- **Batch block**: `POST /seating/block-batch` with `{seat_keys: [...]}` — skips assigned seats
- **Batch unblock**: `POST /seating/unblock-batch` with `{seat_keys: [...]}` — unblocks blocked seats
- Toast notifications: success (auto-dismiss 2.5s), error (auto-dismiss 4s), info messages

**State Management (`seatingState`):**
- `assignMap`: seat_key → assignment object (for O(1) lookup)
- `attenderMap`: attender_id → seat_key (for reverse lookup)
- `blockedSet`: seat_key → true (for O(1) blocked check)
- `selectedCandidates[]`: array of `{id, name, email}` for multi-select
- `pendingSeats[]`: seat_keys staged for batch assignment
- `pendingBlocks[]`: seat_keys staged for batch block
- `svgScale`, `svgOffsetX/Y`: zoom/pan state
- After each API call, `loadSeatingData()` re-fetches all assignments + blocked seats and re-renders SVG

#### Backend: Seating Controller (`class-aioemp-seating-controller.php`, 685 lines)

| Method | Route | Description |
|---|---|---|
| GET | `/events/{id}/seating` | Returns `{assignments, blocked, counts, is_finalized}` with JOIN to attender table |
| POST | `/events/{id}/seating/assign` | Assign single seat; validates seat_key exists in snapshot |
| POST | `/events/{id}/seating/unassign` | Unassign single seat |
| POST | `/events/{id}/seating/assign-batch` | Batch assign pairs; transactional; auto-unassigns old seats; returns `{assigned, failed}` |
| POST | `/events/{id}/seating/unassign-batch` | Batch unassign by seat_keys; transactional |
| POST | `/events/{id}/seating/swap` | Swap two occupied seats atomically (transactional delete + re-insert) |
| POST | `/events/{id}/seating/block` | Block single seat (rejects if assigned) |
| POST | `/events/{id}/seating/unblock` | Unblock single seat |
| POST | `/events/{id}/seating/block-batch` | Block multiple seats; transactional; skips assigned seats |
| POST | `/events/{id}/seating/unblock-batch` | Unblock multiple seats; transactional |
| POST | `/events/{id}/seating/finalize` | Explicitly set `seatmap_finalized_at_gmt` |

**Seat key validation:** For modern architecture, validates seat_key against UUID v4 regex (`^[0-9a-f]{8}-...-[0-9a-f]{12}$`). For legacy snapshots with `compiled.seats[]`, validates against actual `seat_key` values in the snapshot.

#### Backend: Models

**`AIOEMP_Seat_Assignment_Model`** (312 lines):
- `assign()`, `unassign()`, `unassign_by_attender()`, `find_by_seat()`, `find_by_attender()`
- `list_for_event()`: JOINs with attender table for `first_name`, `last_name`, `email`, `attender_status`
- `swap()`: transactional delete + re-insert
- `assign_batch()`: transactional; returns `{assigned, unassigned, skipped, failed}`; handles re-assignment
- `unassign_batch()`: transactional; returns `{unassigned, skipped, failed}`
- DB constraints: UNIQUE(event_id, seat_key), UNIQUE(event_id, attender_id)

**`AIOEMP_Blocked_Seat_Model`** (180 lines):
- `block()`, `unblock()`, `is_blocked()`, `list_for_event()`, `count_for_event()`
- `block_batch()`, `unblock_batch()`: transactional; return `{blocked/unblocked, skipped, failed}`
- DB constraint: UNIQUE(event_id, seat_key)

**`AIOEMP_Seat_Assignment_Log_Model`** (77 lines):
- `log()`: records event_id, attender_id, original_seat, new_seat, reason (assign/unassign/swap/block/unblock), modified_by
- Every seat operation (single and batch) writes to this audit log

### 20.7 Deployment Pipeline

Deployment is handled by `deploy.sh` which runs locally and pushes to the Hostinger server via SSH/rsync. **For credentials and SSH connection details, see `.ai-agent-notes.md`.** The pipeline:

1. **Pre-flight checks**: Scans for 0-byte files (FTP Simple corruption guard), validates critical file sizes
2. **Build core**: `cd seatmap-core && npm run build` (tsup: ESM + CJS + DTS)
3. **Test**: `npm run test` (88 vitest tests must pass)
4. **Build editor**: `cd seatmap-editor && npm run build` (Vite IIFE → admin/js/seatmap-editor/)
5. **Deploy**: `rsync --delete` to remote server (excludes node_modules, .git, deploy.sh, .ai-agent-notes.md)
6. **Verify**: Checks JS file size matches, no empty files on server

To deploy manually: `cd <plugin-root> && bash deploy.sh`

### 20.8 Known Issues & Patterns for Future Agents

#### File Persistence Issues (RESOLVED)

Previous sessions experienced `replace_string_in_file` tool silently failing — reporting success but not actually writing changes. This was caused by the **FTP Simple VS Code extension** overwriting local files with stale server copies. The workspace has since been disconnected from FTP Simple. If this recurs:
- Workaround: write files via Python scripts (`python3 /tmp/write_file.py`) or use `cat > file << 'EOF' ... EOF`
- Always verify edits with `grep` or `read_file` after writing
- The `deploy.sh` Step 0 corruption guard will catch 0-byte files

#### initLayout Recompile (CRITICAL)

The store's `initLayout()` **must** call `compileLayout()` on every load, not just copy `layout.compiled` from the database. This is because:
- The database stores compiled positions from when the seatmap was last saved
- If compile algorithms or constants (GRID_PAD, ARC_PAD, etc.) change between sessions, the saved positions will be stale
- PrimitiveRenderer always computes the dotted area fresh from current constants
- Without recompilation, seats appear misaligned with their dotted areas on fresh load but "fix themselves" after the first interaction triggers `recompile()`

#### node_modules Management

`seatmap-core` and `seatmap-editor` each have their own `node_modules/`. The editor depends on core via `"@aioemp/seatmap-core": "file:../seatmap-core"`. After cloning:
```bash
cd seatmap-core && npm install && npm run build
cd ../seatmap-editor && npm install && npm run build
```

#### konva Type Definitions

The `konva` package's `lib/Node.d.ts` can become corrupted (0 bytes), causing ~54 TypeScript errors across all react-konva components. Fix: `cd seatmap-editor && rm -rf node_modules/konva && npm install konva@9.3.22 --no-save`.

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
