/**
 * @aioemp/seatmap-core — seat_key preservation strategy
 *
 * Deterministic map: (primitiveId, logicalRow, logicalSeat) → seat_key.
 * On re-compile the same logical seat keeps its key; new seats get new keys;
 * removed seats simply drop out.
 */

import type { CompiledSeat } from './types.js';

/** Map key format: "primitiveId:logicalRow:logicalSeat" → UUID seat_key */
export type SeatKeyMap = Map<string, string>;

/**
 * Build a lookup map from previously compiled seats.
 * Seats MUST carry `meta.primitiveId`, `meta.logicalRow`, `meta.logicalSeat`
 * (all compile functions in this library set those fields).
 */
export function buildSeatKeyMap(existingSeats: CompiledSeat[]): SeatKeyMap {
  const map: SeatKeyMap = new Map();

  for (const seat of existingSeats) {
    const m = seat.meta;
    if (
      m &&
      typeof m.primitiveId === 'string' &&
      typeof m.logicalRow === 'number' &&
      typeof m.logicalSeat === 'number'
    ) {
      const key = `${m.primitiveId}:${m.logicalRow}:${m.logicalSeat}`;
      map.set(key, seat.seat_key);
    }
  }

  return map;
}
