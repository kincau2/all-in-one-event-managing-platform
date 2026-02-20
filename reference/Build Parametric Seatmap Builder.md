# Build Parametric Seatmap Builder  
  
Below is a practical, implementation-ready **instruction spec** you can hand to an AI agent to build a **parametric seatmap builder** + suggested JS libraries. It’s written so the agent can execute without guessing architecture.  
  
## AI Agent Instructions: Build Parametric Seatmap Builder (Reusable Library)  
## Objective  
Build a reusable JS seatmap builder that supports **event halls**, **cinemas (curved rows)**, and occasional **arena/wedge** sections. The builder must be **parametric** (edit primitives, not individual seats) and must output:  
1. **Primitives JSON** (editable model)  
2. **Compiled Seats JSON** (flattened list with seat_key + coordinates)  
3. Layout snapshot suitable for saving in DB (aioemp_seatmap.layout and aioemp_events.seatmap_layout_snapshot)  
Seat assignment and blocked seats are stored in DB separately and applied on render by matching seat_key.  
  
## Recommended Libraries (choose 1 main rendering stack)  
## Preferred (best balance): Konva.js + React (react-konva)  
Use when layouts can have **1k–20k seats**, need zoom/pan, selection, handles.  
* Rendering: canvas (fast)  
* Interaction: selection boxes, drag primitives, transform handles  
**Dependencies**  
* react, react-dom  
* konva, react-konva  
* zustand (state store) OR redux-toolkit  
* immer (immutable updates)  
* zod (layout schema validation)  
* nanoid or uuid (stable ids)  
* optional: localforage (IndexedDB drafts), hotkeys-js (shortcuts)  
## Alternative: Fabric.js  
Also good, but Konva tends to be simpler and faster for “lots of nodes”.  
## Avoid as primary for large maps  
Pure SVG (D3) is great for vector crispness but can get sluggish with thousands of seats.  
  
## Deliverables  
1. @aioemp/seatmap-core (headless)  
    * layout schema + validation  
    * seat generation (compile)  
    * label generation  
    * seat_key strategies  
2. @aioemp/seatmap-editor (UI)  
    * canvas editor component  
    * palette/tools/inspector  
    * import/export/save  
3. Example integration page for WordPress admin:  
    * lock acquire/heartbeat/takeover  
    * AJAX save to DB  
  
## Layout Data Model (JSON)  
## Canonical Layout (primitives)  
Store in aioemp_seatmap.layout (LONGTEXT JSON). Must include:  
```

{
  "schemaVersion": 1,
  "title": "Cinema Hall A",
  "canvas": { "w": 1600, "h": 900, "unit": "px" },
  "primitives": [],
  "compiled": { "seats": [], "bounds": { "minX":0, "minY":0, "maxX":0, "maxY":0 } }
}

```
## Primitive Base Fields  
Every primitive MUST include:  
* id (string, stable, nanoid/uuid)  
* type (string)  
* name/label optional  
* transform optional: { x, y, rotation } (rotation degrees)  
## Required Primitive Types (minimum set)  
1. stage (rect or polygon)  
2. label (text)  
3. obstacle (rect/polygon)  
4. seatBlockGrid (straight rows)  
5. seatBlockArc (cinema curves)  
6. seatBlockWedge (arena pie slice)  
7. optional but recommended: seatBlockTables (banquet)  
  
## Seat Generation (Compile) Rules  
Implement compileLayout(layout) -> layoutWithCompiledSeats.  
Compiled seat object shape:  
```

type CompiledSeat = {
  seat_key: string;     // stable key used by DB assignment/blocked
  label: string;        // display label, may change
  section?: string;
  row?: string;
  number?: number;
  x: number;
  y: number;
  rotation?: number;
  meta?: Record<string, any>;
}

```
## seat_key strategy (critical)  
* Use **immutable seat_key** once an event snapshot is created.  
* For *seatmap templates*, seat_key may be regenerated on save, but once a layout is **snapshotted into an event**, it must not change unless event seatmap is not finalized.  
**Implementation requirement**  
* In editor, generate seat_key as UUID for each compiled seat.  
* When re-compiling while editing, preserve existing keys when possible using a deterministic mapping:  
    * Map by (primitiveId, logicalRowId, logicalSeatIndex) → keep prior seat_key if present  
    * New seats get new keys  
    * Removed seats drop keys (fine, since snapshots will lock)  
  
## Primitive Specifications  
## 1) seatBlockGrid  
Params:  
* origin: {x,y}  
* rows, cols (int)  
* seatSpacingX, seatSpacingY  
* seatRadius or seatSize  
* rowLabel: { start: "A", direction: "asc" }  
* numbering: "L2R" | "R2L"  
* aisleGaps: [{ afterCol: number, gapPx: number }]  
* section: string  
Compile algorithm:  
* For each row r and col c:  
    * x = origin.x + c*spacingX + sum(gaps before c)  
    * y = origin.y + r*spacingY  
    * apply rotation about origin if needed  
    * generate label like A-01  
## 2) seatBlockArc (cinema)  
Params:  
* center: {x,y}  
* rowCount (int)  
* startRadius, radiusStep  
* startAngleDeg, endAngleDeg  
* seatsPerRow: either:  
    * { start: number, delta: number } OR array [18,20,22...]  
* seatSize  
* aisleGaps: [{ afterSeatIndex: number, gapAngleDeg?: number, gapPx?: number }]  
* section  
Compile algorithm:  
* For row i:  
    * radius = startRadius + i*radiusStep  
    * n = seatsPerRow(row i)  
    * distribute angles from startAngle to endAngle into n positions  
    * apply optional aisle gap adjustment (split into segments)  
    * position:  
        * x = center.x + radius*cos(theta)  
        * y = center.y + radius*sin(theta)  
    * seat rotation optional: tangent angle or fixed  
## 3) seatBlockWedge (arena)  
Params:  
* center  
* innerRadius, outerRadius  
* startAngleDeg, endAngleDeg  
* rowCount  
* seatsPerRow rule  
* section  
Compile:  
* Similar to arc but bounded by wedge. Each row increases radius.  
## 4) stage/obstacle/label  
Simple render primitives, not compiled into seats.  
  
## UI Editor Requirements  
## Canvas behaviors  
* Zoom/pan (mouse wheel + drag)  
* Multi-select primitives  
* Move/rotate primitives with handles  
* Snap-to-grid toggle  
## Tools / Palette  
* Add Grid Block  
* Add Arc Block  
* Add Wedge Block  
* Add Stage  
* Add Label  
* Add Obstacle  
* Delete / Duplicate  
* Undo / Redo (required)  
## Inspector Panel  
When a primitive is selected:  
* Show all param fields editable with validation  
* Live recompile preview (debounced, e.g. 150–300ms)  
## Performance  
* Render seats as “lightweight circles” in Konva.  
* Avoid making every seat individually draggable.  
* Seats are usually not edited individually in parametric mode; selection is per primitive.  
* Optionally add “seat hover” tool for showing seat_key/label.  
  
## Saving / Drafts  
## Draft handling  
* Keep state in memory (store).  
* Persist draft for crash recovery:  
    * localStorage key: aioemp_draft_seatmap_<seatmapId>  
    * debounce writes (1–2 seconds)  
* On successful save, clear draft key.  
For very large layouts or undo stacks, prefer IndexedDB via localforage.  
## Save pipeline  
On Save:  
1. Validate primitives (zod)  
2. Run compileLayout  
3. POST to server:  
    * { seatmap_id, layout_json }  
4. On success, show “Saved”  
  
## Locking Integration (WP-style)  
Before enabling edit, must acquire lock using your lock endpoints:  
* acquire → start heartbeat  
* if locked by other → modal (takeover/exit)  
* takeover → acquire lock + enable edit  
* heartbeat → if lost, disable edit and show modal  
Editor must store lock_token in sessionStorage.  
  
## WordPress Integration Requirements  
* Use WP nonces and capability checks.  
* Save endpoint must:  
    * verify lock ownership (lock_user_id + lock_token)  
    * validate JSON schema server-side  
    * store JSON in aioemp_seatmap.layout  
* When creating an event:  
    * copy aioemp_seatmap.layout into aioemp_events.seatmap_layout_snapshot  
    * once seatmap_finalized_at is set, prevent snapshot edits  
  
## Testing Checklist (agent must implement)  
1. Generate 2,000+ seats without UI lag (zoom/pan ok)  
2. Arc rows match expected geometry  
3. Aisle gaps don’t create overlapping seats  
4. seat_key preservation works when:  
    * changing spacing  
    * changing angle range  
    * changing seatsPerRow slightly  
5. Save/load roundtrip keeps layout identical  
6. Lock: second user sees takeover, first user loses lock on heartbeat after takeover  
  
## Output Contract (for DB + runtime)  
The editor must provide:  
* layout_json (string)  
* compiled.seats[] must include seat_key  
* seat_key must be stable for event snapshots  
