AIOEMP Logic Flow Notes
(All-in-One Event Management Platform)
Version 0.1 | 18 Feb 2026

# 1. Scope and Goals

This document describes the page-level logic flow and key rules for building the AIOEMP WordPress plugin. It is intended to guide implementation (backend endpoints + frontend admin SPA pages).

## Goals

- Provide an admin dashboard (SPA-style) to manage events, candidates, attendance, seatmaps, and seating.
- Support public registration without login (allow duplicate registrations using the same email).
- Support QR-based check-in/out with confirm step and an attendance log.
- Support seatmap templates and per-event seatmap snapshots with stable seat_key mapping.
- Prevent conflicting edits via WP-style locking (one editor at a time).

## Out of scope for MVP (optional later)

- Complex payment flows, membership systems, or external ticketing integrations.
- Advanced analytics beyond basic counts and exports.
- Multi-site network administration (unless explicitly required).

# 2. Core Objects and Definitions

## Objects

- Seatmap Template: reusable seatmap layout created in the seatmap builder (parametric primitives + compiled seats).
- Event: time/capacity/venue mode/status, optional seatmap snapshot, and a finalized flag to prevent changes.
- Candidate (Attender): registrant record for a specific event, including a unique QR token/hash.
- Attendance Log: append-only records of IN/OUT scans with timestamps and scanner metadata.
- Seat Assignment: mapping between candidate and seat_key within an event snapshot.
- Blocked Seat: seat_key that cannot be assigned for a given event snapshot.
- Lock: exclusive edit ownership for a resource (seatmap editor, event editor), with TTL + heartbeat.
- Settings: company logo, email template settings, and configurable behaviors (e.g., when to send QR).

## Key fields / concepts

- seat_key: stable unique key for each seat in a compiled seatmap. Assignments and blocked seats reference seat_key.
- seatmap snapshot: the seatmap layout copied into an event so seat allocation is not affected by later template edits.
- seatmap_finalized_at: once set, the event snapshot must not change.
- candidate status: registered, accepted_onsite, accepted_online, rejected.
- event status: draft, published, closed (exact labels can be adjusted, but behavior should remain consistent).

# 3. Admin Dashboard (SPA Shell)

## Entry

- WordPress admin menu: Event Manager
- Opens a full-screen dashboard page (app shell) that visually overlays standard wp-admin content.

## Layout and routing

- Left navigation: Events, Seatmaps, Settings.
- Top-left logo: use company logo from Settings; show placeholder if not set.
- Client-side routing: clicking menu items does not reload the page; it swaps the main panel via AJAX/REST calls and DOM updates.

## Security baseline

- All admin calls require capability checks (e.g., manage_options or custom capability).
- All write actions require nonce validation.
- Server must validate access regardless of client UI state.

# 4. Events Module (Admin)

## 4.1 Events List Page

### UI

- Table of events with columns: title, start/end, status, capacity, venue mode, seatmap mode.
- Actions: view event, edit event, create new event.

### Functions

- List events with filters (status, keyword) and pagination.
- Navigate to Event Detail page when selecting an event.

## 4.2 Create Event Page

### UI fields

- Basic fields: title, start/end, capacity, venue address, venue mode (onsite/online/mixed), status.
- Seating mode: Free seating (no seatmap) OR Seatmap-based (select seatmap template).

### Rules

- If seatmap-based: on save, create an event seatmap snapshot from the selected seatmap template.
- If free seating: seating tab is hidden for this event.

## 4.3 Edit Event Page

### Rules (critical)

- If seatmap_finalized_at is set: do not allow changing seatmap selection or snapshot.
- If any attendance logs exist OR any seat assignments exist: do not allow changing seatmap snapshot/selection (recommended safety rule).
- Other basic fields (time/capacity/venue) may remain editable based on business decision (suggest allow, but log changes).

## 4.4 Event Detail Page (Tabs)

- Overview tab: event summary and key metrics.
- Candidates tab: list and manage candidate status and communications.
- Attendance tab: scan and log check-in/out.
- Seating tab: seat allocation (only if seatmap-based).

### Overview tab functions

- Show base event info (time, capacity, venue, status, seating mode).
- Pie chart or summary stats: registered count vs checked-in count.
- Buttons: Edit Event, go to Seating (if applicable).

# 5. Candidates (Per Event)

## 5.1 Candidates List Tab

### UI

- Candidate table columns: name, email, company (optional), status, seat label (if assigned), check-in indicator.
- Search and filters (keyword, status).
- Bulk actions: Accept (On-site), Accept (Online), Reject.
- Row actions: View candidate, Change status, Resend emails.

### Rules

- Allow duplicate registrations with the same email for the same event.
- Status change triggers an automated email (accepted/rejected).
- QR email should be sent to successful applicants; recommended behavior: send QR when accepted (configurable).

## 5.2 Candidate Detail Page

- Show candidate profile info.
- Show seat assignment (if any) and seat label.
- Show attendance history for this event (IN/OUT rows with timestamps).

# 6. Attendance (Per Event)

## 6.1 Attendance Tab / Scan Page

### Scan workflow

1. Admin opens Attendance tab for an event.
2. Scanner reads QR token/hash (camera or manual input).
3. System resolves token to candidate; UI shows a candidate popup (name/email/etc.).
4. Admin clicks Confirm IN or Confirm OUT.
5. System writes an attendance log record and returns updated candidate state.

### Validation

- Prevent invalid sequences by default (IN twice in a row; OUT without prior IN).
- Optionally allow an admin override for edge cases, but log it.

### Exports

- Export attendance logs (CSV).
- Optional export: candidate list with latest IN/OUT status.

# 7. Seating (Per Event, Seatmap-Based Only)

## 7.1 Seating Tab / Seat Allocation Dashboard

### UI

- Render the event seatmap snapshot (not the seatmap template).
- Empty seat shows seat icon; assigned seat shows user icon.
- User icon color reflects check-in status (derived from attendance logs).
- Search box to find candidate; select candidate then click seat to assign.
- Seat actions: unassign, swap, block/unblock.

### Rules

- Assignments and blocks refer to seat_key from the event snapshot compiled seats.
- On first seat assignment (or via explicit button), set seatmap_finalized_at to freeze snapshot changes.
- Blocking a seat prevents assignment until unblocked.

## 7.2 Seatmap snapshot freeze conditions (recommended)

- If seatmap_finalized_at is set: snapshot cannot change.
- If any seat assignments exist: snapshot cannot change.
- If any attendance logs exist: snapshot cannot change.

# 8. Seatmaps (Templates)

## 8.1 Seatmaps List Page

- List seatmap templates with actions: create, edit, duplicate (optional), delete (optional).

## 8.2 Seatmap Editor (Parametric Builder)

### Minimum editing features

- Add primitives: seat blocks (grid/arc/wedge), labels, stage/screen markers, obstacles.
- Edit tools: move/rotate, multi-select, inspector panel, zoom/pan, undo/redo.
- Bulk operations for seat labels (auto numbering and ranges).

### Compile + seat_key

- On save, builder data is compiled into a flat seat list (compiled.seats).
- Each compiled seat has a stable seat_key used by events and assignments.

### Editor locking (mandatory)

1. On editor open: acquire lock for this seatmap.
2. Every 30 seconds: heartbeat to renew lock (TTL 90 seconds).
3. On editor close/navigate away: release lock.
4. If locked by another user: show read-only state and offer Take Over.

# 9. Settings

- Company logo upload (used in admin shell).
- Email templates: acknowledgement, status change, QR email.
- Behavior toggles: send QR on acceptance vs on registration; default venue mode; default capacity; device naming.

# 10. Public Registration (Frontend)

## Registration Form Page (via shortcode/block)

### Flow

1. User opens public registration form for an event.
2. User submits personal info and required selections.
3. System creates candidate record with status=registered and generates QR token/hash.
4. System shows thank-you confirmation and sends acknowledgement email.
5. If approval workflow is enabled: send QR when accepted; otherwise send immediately on registration.

### Rules

- No login required.
- Allow duplicate registrations using the same email.
- Validate required fields and provide friendly error messages.

## External Registration REST API (for other sites)

In addition to the shortcode/block registration form on the same site, provide a public REST API endpoint to accept event registrations from external websites (e.g., a static site calling fetch() in JavaScript).
- Apply server-side security controls (industrial practice):
- Do not rely on API keys stored in client-side JavaScript (they are not secret). Treat the endpoint as public.
- Accept JSON request bodies only; return JSON responses with clear success/error codes.
- Provide a REST endpoint (example): POST /wp-json/aioemp/v1/public/events/{event_id}/register
  - Recommended server-side controls:
  - Optional: email confirmation (double opt-in) if spam registrations become a problem.
  - Safe error handling: avoid leaking sensitive details; return generic errors for invalid tokens/unknown records.
  - Abuse monitoring: log suspicious patterns, throttle repeated failures, and keep an audit trail.
  - CORS allowlist for known frontend origins (still validate server-side; do not trust Origin alone).
  - Bot mitigation: require a CAPTCHA/Turnstile token and verify it server-side (recommended for public endpoints).
  - Strict allowlist validation: required fields, type checks, max field lengths, and sanitization for every input.
  - Rate limiting (per IP / per event) and burst control to reduce abuse.

# 11. Locking API Contract (Implementation Notes)

- Resources: seatmap editor, event editor (optional but recommended for consistency).
- Lock fields: owner user_id, lock_token, updated_at, expires_at (derived from TTL).
- TTL: 90 seconds. Heartbeat: 30 seconds.
- Server checks: only the owner (by token) can save; takeover invalidates previous token.

# 12. Recommended Build Milestones (Order)

1. Foundation: admin app shell + menu + security (capabilities + nonce).
2. DB installer + core CRUD: events and candidates.
3. Public registration + acknowledgement email.
4. Attendance scan flow (resolve QR + confirm IN/OUT) + exports.
5. Seatmap templates (minimal editor + compile) + locking.
6. Event seatmap snapshot + seating allocation (assign/unassign/swap/block) + finalize snapshot.
7. Email automation for status changes and QR delivery + admin settings UI.
