## Editor Locking (WP-style “one editor at a time”)  
  
## Goal  
Implement an **exclusive edit lock** for aioemp_seatmap and aioemp_events editors:  
* Only **one user** can edit a given resource at a time.  
* Other users who open the editor must see a **modal** offering:  
    * **Take over** (steal lock)  
    * **Exit / View only**  
* Locks must **expire automatically** if the editor tab closes or loses connection.  
* Locks must be renewed via a **heartbeat** while the editor is open.  
This must be done using DB-backed locks (not in-memory only).  
  
## Data Model (already in schema)  
Both aioemp_seatmap and aioemp_events have:  
* lock_user_id (BIGINT UNSIGNED, nullable)  
* lock_token (CHAR(36) or VARCHAR(64), nullable)  
* lock_expires_at_gmt (DATETIME, nullable)  
* lock_updated_at_gmt (DATETIME, nullable)  
  
## Constants  
* Lock TTL: **90 seconds**  
* Heartbeat interval: **30 seconds**  
* Use GMT/UTC for all lock timestamps.  
  
## API Endpoints / Actions  
Implement 4 actions for each resource type (seatmap, event). The payload and response format should be consistent.  
## 1) Try Acquire Lock  
**Action:** lock_acquire **Input:** { resource_type, resource_id } **Output (success):**  
```

{ "status": "locked_by_you", "lock_token": "<uuid>", "expires_in": 90 }

```
**Output (busy):**  
```

{ "status": "locked_by_other", "owner": { "user_id": 123, "display_name": "Jane" }, "expires_at_gmt": "..." }

```
**Server logic:**  
* If no lock exists OR lock_expires_at_gmt < now_gmt, grant lock.  
* Grant lock by setting:  
    * lock_user_id = current_user_id  
    * lock_token = uuid_v4()  
    * lock_expires_at_gmt = now + TTL  
    * lock_updated_at_gmt = now  
* If currently locked by someone else and not expired, return locked_by_other.  
**Must be atomic:** Use a single UPDATE ... WHERE ... condition to avoid race conditions.  
  
## 2) Heartbeat (Renew Lock)  
**Action:** lock_heartbeat **Input:** { resource_type, resource_id, lock_token } **Output (success):**  
```

{ "status": "renewed", "expires_in": 90 }

```
**Output (lost):**  
```

{ "status": "lock_lost" }

```
**Server logic:**  
* Renew only if:  
    * lock_user_id == current_user_id AND lock_token matches  
* Set:  
    * lock_expires_at_gmt = now + TTL  
    * lock_updated_at_gmt = now  
* If not matched, return lock_lost.  
  
## 3) Release Lock  
**Action:** lock_release **Input:** { resource_type, resource_id, lock_token } **Output:** { "status": "released" } (or { "status": "noop" })  
**Server logic:**  
* Only release if lock_user_id == current_user_id AND lock_token matches  
* Set lock fields to NULL.  
  
## 4) Take Over Lock  
**Action:** lock_takeover **Input:** { resource_type, resource_id } **Output (success):**  
```

{ "status": "locked_by_you", "lock_token": "<uuid>", "expires_in": 90 }

```
**Server logic:**  
* Force-set lock owner to current user:  
    * lock_user_id = current_user_id  
    * lock_token = uuid_v4()  
    * lock_expires_at_gmt = now + TTL  
    * lock_updated_at_gmt = now  
**Audit:**  
* Write a log entry:  
    * action: lock_takeover  
    * previous_value: previous lock owner info (json)  
    * new_value: new lock owner info (json)  
  
## Frontend Behavior  
## On Editor Page Load  
1. Call lock_acquire.  
2. If locked_by_you:  
    * Store lock_token in **sessionStorage** under key: aioemp_lock_<type>_<id>  
    * Start heartbeat timer every 30s  
    * Enable editing  
3. If locked_by_other:  
    * Disable editing (or show view-only)  
    * Show modal:  
        * Message: “Currently being edited by {name}. Take over or exit.”  
        * Buttons: Take over / Exit (optional View-only)  
## Heartbeat  
* Every 30 seconds call lock_heartbeat using lock_token.  
* If response is lock_lost:  
    * Stop heartbeat  
    * Disable editing immediately  
    * Show modal: “You no longer have the lock. Reload or take over.”  
## Take Over (Modal Button)  
* Call lock_takeover.  
* On success:  
    * Update lock_token in sessionStorage  
    * Enable editing  
    * Start heartbeat  
## Exit / Close  
* On clicking “Exit editor” or leaving page:  
    * Attempt lock_release  
* Also attempt release in beforeunload using navigator.sendBeacon() (best-effort).  
* **Do not rely on unload:** expiry/TTL is the primary safety mechanism.  
  
## Permission / Security Rules  
* Only authenticated users with editor/admin capability can lock.  
* All lock endpoints must require a WP nonce and capability check.  
* Never accept lock operations without verifying current_user_id.  
* Heartbeat and release must verify token matches to prevent hijacking.  
  
## SQL Atomic Update Patterns (must use)  
## Acquire (only if expired/unlocked)  
* Update succeeds only when lock is free:  
* Condition: lock_expires_at_gmt IS NULL OR lock_expires_at_gmt < now  
## Heartbeat (only if you own it)  
* Condition: lock_user_id = current_user_id AND lock_token = provided_token  
## Release (only if you own it)  
* Same condition as heartbeat.  
## Takeover  
* No condition; overwrite.  
  
## Logging Requirements  
Log the following actions in aioemp_event_log (and/or a seatmap log if you add one):  
* lock_acquired  
* lock_released  
* lock_takeover  
* lock_expired (optional; can be inferred, but log if you have a cleanup job)  
Log payloads:  
* previous_value = { "lock_user_id": ..., "lock_expires_at_gmt": ... }  
* new_value = { "lock_user_id": ..., "lock_expires_at_gmt": ... }  
  
## Edge Cases the Agent Must Handle  
* Same user opens two tabs:  
    * Most recent lock token wins; older tab will lose lock on heartbeat.  
* Browser crash / lost connection:  
    * Lock expires after TTL, allowing another user to acquire.  
* Clock handling:  
    * All time comparisons must use server-side UTC.  
* Resource not found:  
    * Return error status and do not create lock.  
  
## Acceptance Criteria  
* Two users cannot edit the same seatmap/event simultaneously.  
* A second user sees a takeover modal while locked.  
* Locks expire and become acquirable after TTL without manual cleanup.  
* Takeover immediately transfers editing rights.  
* Heartbeat loss forces editor into read-only with a clear message.  
