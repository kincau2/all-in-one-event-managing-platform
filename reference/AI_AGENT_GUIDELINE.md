# AIOEMP — AI Agent Development Guideline

**All-in-One Event Managing Platform (AIOEMP)**
Version 1.0 | 18 Feb 2026

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
| State Management | Zustand or Redux Toolkit + Immer |
| Schema Validation | Zod (layout schema) |
| IDs | nanoid or uuid (stable primitive/seat IDs) |
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
| `aioemp_seatmap` | Reusable seatmap templates (layout JSON + lock fields) |
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
| layout | LONGTEXT NOT NULL | JSON (primitives + compiled seats) |
| lock_user_id | BIGINT UNSIGNED NULL | |
| lock_token | CHAR(36) NULL | |
| lock_expires_at_gmt | DATETIME NULL | |
| lock_updated_at_gmt | DATETIME NULL | |

**Indexes:** INDEX(lock_expires_at_gmt)

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
├── all-in-one-event-managing-platform.php   # Main plugin bootstrap
├── reference/                               # Design docs (do not modify)
├── includes/
│   ├── class-aioemp-activator.php           # Activation hooks (DB install)
│   ├── class-aioemp-deactivator.php         # Deactivation hooks
│   ├── class-aioemp-loader.php              # Hook/filter registration
│   ├── class-aioemp-security.php            # Shared security helpers
│   ├── rest-api/                            # REST endpoint controllers
│   │   ├── class-aioemp-events-controller.php
│   │   ├── class-aioemp-candidates-controller.php
│   │   ├── class-aioemp-attendance-controller.php
│   │   ├── class-aioemp-seatmaps-controller.php
│   │   ├── class-aioemp-seating-controller.php
│   │   ├── class-aioemp-locking-controller.php
│   │   ├── class-aioemp-settings-controller.php
│   │   └── class-aioemp-public-registration-controller.php
│   ├── models/                              # Data access layer
│   └── services/                            # Business logic layer
├── admin/
│   ├── class-aioemp-admin.php               # Admin hooks, menu, enqueue
│   ├── js/                                  # Admin SPA JavaScript
│   ├── css/                                 # Admin styles
│   └── views/                               # PHP view templates (shell)
├── public/
│   ├── class-aioemp-public.php              # Public hooks, shortcodes
│   ├── js/
│   ├── css/
│   └── views/
├── seatmap-builder/                         # React + Konva seatmap editor
│   ├── packages/
│   │   ├── seatmap-core/                    # @aioemp/seatmap-core
│   │   └── seatmap-editor/                  # @aioemp/seatmap-editor
│   ├── package.json
│   └── webpack.config.js (or vite.config.js)
├── languages/                               # i18n .pot/.po/.mo files
└── tests/                                   # PHPUnit + JS tests
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
| `--sa-font` | Ubuntu, system stack | Typography |

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

The seatmap builder is a **parametric** editor — admins edit primitives (blocks, arcs, wedges), not individual seats. On save, primitives are compiled into a flat seat list.

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
| `seatBlockWedge` | Arena pie-slice sections |

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

- In the editor, generate `seat_key` as UUID for each compiled seat.
- On re-compile, **preserve existing keys** using deterministic mapping: `(primitiveId, logicalRowId, logicalSeatIndex)` → keep prior `seat_key` if present. New seats get new keys; removed seats drop keys.
- **Once a layout is snapshotted into an event**, seat_keys must NOT change unless the event seatmap is not finalized.

### 10.6 Primitive Compile Algorithms

- **seatBlockGrid:** Row/col grid with origin, spacing, aisle gaps, row labels (A-01 pattern), L2R/R2L numbering.
- **seatBlockArc:** Curved rows with center, radius, angle range, seats distributed along arc, aisle gap angle adjustments.
- **seatBlockWedge:** Arena pie-slice, similar to arc but bounded by wedge shape.

### 10.7 UI Editor Requirements

- **Canvas:** Zoom/pan, multi-select primitives, move/rotate with handles, snap-to-grid toggle.
- **Tools palette:** Add Grid/Arc/Wedge blocks, add Stage/Label/Obstacle, Delete, Duplicate, Undo/Redo.
- **Inspector panel:** Editable params for selected primitive, live recompile preview (debounced 150–300ms).
- **Performance:** Render seats as lightweight circles in Konva. Seats are NOT individually draggable — selection is per primitive. Target: 2,000+ seats without lag.

### 10.8 Drafts & Save Pipeline

- Keep state in memory (Zustand/Redux store).
- Auto-persist draft to `localStorage` key `aioemp_draft_seatmap_<seatmapId>` (debounced 1–2s). Clear on successful save. For large layouts, use IndexedDB via `localforage`.
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
- **Heartbeat interval:** 30 seconds.
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
- If `locked_by_you` → store `lock_token` in **sessionStorage** (`aioemp_lock_<type>_<id>`), start heartbeat, enable editing.
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
| 3 | **`@aioemp/seatmap-core` (headless):** Layout JSON schema (Zod), `compileLayout()` for Grid/Arc/Wedge primitives, seat_key stability strategy, unit tests for all compile algorithms |
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
12. **Do not modify files in the `reference/` folder** — they are the source of truth.
