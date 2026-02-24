# Data base schema:  
  
## aioemp_events  

| Column | Suggested type | Notes |
| ------------------------- | --------------------------------- | -------------------------------------- |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK |  |
| title | VARCHAR(255) NOT NULL |  |
| status | VARCHAR(32) NOT NULL | e.g. draft/published/closed |
| start_date_gmt | DATETIME NULL | store GMT or clearly document timezone |
| end_date_gmt | DATETIME NULL |  |
| capacity | INT UNSIGNED NULL |  |
| venue_mode | VARCHAR(32) NULL | onsite/online/mixed |
| seatmap_layout_snapshot | LONGTEXT NULL | JSON string (snapshot) |
| seatmap_finialized_at_gmt | DATETIME NULL |  |
| lock_user_id | BIGINT UNSIGNED NULL | wp user id |
| lock_token | CHAR(36) NULL | UUID v4 (or VARCHAR(64)) |
| lock_expires_at_gmt | DATETIME NULL | lease expiry |
| lock_updated_at_gmt | DATETIME NULL | last heartbeat |
| created_at_gmt | DATETIME NOT NULL | default current UTC |
  
**Indexes**  
* INDEX(status)  
* INDEX(start_date)  
* INDEX(lock_expires_at_gmt) (optional)  
  
## aioemp_event_meta  

| Column     | Suggested type                    | Notes                 |
| ---------- | --------------------------------- | --------------------- |
| id         | BIGINT UNSIGNED AUTO_INCREMENT PK |                       |
| event_id   | BIGINT UNSIGNED NOT NULL          | FK-ish                |
| meta_key   | VARCHAR(191) NOT NULL             | 191 for utf8mb4 index |
| meta_value | LONGTEXT NULL                     | any                   |
  
**Indexes**  
* INDEX(event_id, meta_key) (as you wrote)  
* optionally INDEX(meta_key) if you query by key across events  
  
## aioemp_event_log  

| Column | Suggested type | Notes |
| -------------- | --------------------------------- | ------------------------------- |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK |  |
| event_id | BIGINT UNSIGNED NOT NULL |  |
| modified_by | BIGINT UNSIGNED NULL | wp user id |
| action | VARCHAR(64) NOT NULL | e.g. seat_assign, lock_takeover |
| previous_value | LONGTEXT NULL | often JSON |
| new_value | LONGTEXT NULL | often JSON |
| created_at_gmt | DATETIME NOT NULL |  |
  
**Indexes**  
* INDEX(event_id, created_at_gmt)  
* INDEX(action)  
  
## aioemp_attender  

| Column | Suggested type | Notes |
| ----------- | --------------------------------- | ------------------------------------------------------------ |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK |  |
| event_id | BIGINT UNSIGNED NOT NULL |  |
| title | VARCHAR(32) NULL | Mr/Ms/Dr etc |
| first_name | VARCHAR(100) NULL |  |
| last_name | VARCHAR(100) NULL |  |
| company | VARCHAR(190) NULL |  |
| email | VARCHAR(190) NULL |  |
| qrcode_hash | CHAR(64) NOT NULL | store hex sha256 (or VARCHAR(128) if you use something else) |
| created_at_gmt | DATETIME NOT NULL | registration timestamp (UTC) |
| status | VARCHAR(32) NOT NULL | default 'registered' |
  
**Indexes**  
* INDEX(event_id)  
* INDEX(event_id, last_name)  
* INDEX(event_id, email)  
* UNIQUE(qrcode_hash) (recommended if hash is truly unique per ticket)  
* Optional: UNIQUE(event_id, email) if your business rule is 1 registration per email per event  
  
## aioemp_attendance  

| Column         | Suggested type                    | Notes             |
| -------------- | --------------------------------- | ----------------- |
| id             | BIGINT UNSIGNED AUTO_INCREMENT PK |                   |
| event_id       | BIGINT UNSIGNED NOT NULL          |                   |
| attender_id    | BIGINT UNSIGNED NOT NULL          |                   |
| type           | VARCHAR(8) NOT NULL               | “IN” / “OUT”      |
| scanned_by     | BIGINT UNSIGNED NULL              | wp user id        |
| device_id      | VARCHAR(64) NULL                  | device identifier |
| scanned_at_gmt | DATETIME NOT NULL                 |                   |
  
**Indexes**  
* INDEX(event_id, attender_id, scanned_at_gmt)  
* INDEX(event_id, scanned_at_gmt)  
  
## aioemp_seatmap  

| Column | Suggested type | Notes |
| ------------------- | --------------------------------- | ---------------------------------- |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK |  |
| title | VARCHAR(255) NOT NULL |  |
| status | VARCHAR(32) NOT NULL | default 'draft' |
| layout | LONGTEXT NOT NULL | JSON (primitives + compiled seats) |
| lock_user_id | BIGINT UNSIGNED NULL |  |
| lock_token | CHAR(36) NULL |  |
| lock_expires_at_gmt | DATETIME NULL |  |
| lock_updated_at_gmt | DATETIME NULL |  |
| updated_at_gmt | DATETIME NULL | auto-set on every update |
| created_at_gmt | DATETIME NOT NULL | creation timestamp (UTC) |
  
**Indexes**  
* INDEX(status)
* INDEX(lock_expires_at_gmt) (optional)  
  
## aioemp_seatmap_meta  

| Column     | Suggested type                    | Notes |
| ---------- | --------------------------------- | ----- |
| id         | BIGINT UNSIGNED AUTO_INCREMENT PK |       |
| seatmap_id | BIGINT UNSIGNED NOT NULL          |       |
| meta_key   | VARCHAR(191) NOT NULL             |       |
| meta_value | LONGTEXT NULL                     |       |
  
**Indexes**  
* INDEX(seatmap_id, meta_key)  
* optionally INDEX(meta_key)  
  
## aioemp_seat_assignment (current state)  

| Column | Suggested type | Notes |
| --------------- | --------------------------------- | -------------------------- |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK |  |
| event_id | BIGINT UNSIGNED NOT NULL |  |
| attender_id | BIGINT UNSIGNED NOT NULL |  |
| seat_key | VARCHAR(64) NOT NULL | stable seat id (UUID-like) |
| assigned_by | BIGINT UNSIGNED NULL | wp user id |
| assigned_at_gmt | DATETIME NOT NULL |  |
  
**Constraints / Indexes**  
* UNIQUE(event_id, seat_key)  
* UNIQUE(event_id, attender_id)  
* INDEX(event_id) (nice for rendering)  
  
## aioemp_blocked_seat  

| Column         | Suggested type                    | Notes      |
| -------------- | --------------------------------- | ---------- |
| id             | BIGINT UNSIGNED AUTO_INCREMENT PK |            |
| event_id       | BIGINT UNSIGNED NOT NULL          |            |
| seat_key       | VARCHAR(64) NOT NULL              |            |
| blocked_by     | BIGINT UNSIGNED NULL              | wp user id |
| blocked_at_gmt | DATETIME NOT NULL                 |            |
  
**Constraints / Indexes**  
* UNIQUE(event_id, seat_key)  
* INDEX(event_id)  
  
## aioemp_seat_assignment_log  

| Column | Suggested type | Notes |
| -------------- | --------------------------------- | ----------------------------------- |
| id | BIGINT UNSIGNED AUTO_INCREMENT PK |  |
| event_id | BIGINT UNSIGNED NOT NULL |  |
| attender_id | BIGINT UNSIGNED NULL | NULL if action not tied to a person |
| modified_by | BIGINT UNSIGNED NULL | wp user id |
| original_seat | VARCHAR(64) NULL | seat_key |
| new_seat | VARCHAR(64) NULL | seat_key |
| reason | VARCHAR(64) NULL | assign/unassign/swap/auto etc |
| created_at_gmt | DATETIME NOT NULL |  |
  
**Indexes**  
* INDEX(event_id, created_at_gmt)  
* INDEX(attender_id, created_at_gmt)  
