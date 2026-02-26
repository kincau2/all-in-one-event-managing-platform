/**
 * @aioemp/seatmap-core — Deterministic seat_key generation
 *
 * Produces a stable UUID-formatted key from (primitiveId, logicalRow, logicalSeat).
 * The same logical seat always produces the same key — no need to store compiled
 * data for key preservation.  Keys survive recompilation, layout edits, and
 * server round-trips as long as the primitive ID and seat coordinates are unchanged.
 */

/* ── FNV-1a 32-bit hash ── */

function fnv1a(str: string, seed: number): number {
  let h = seed;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/* ── Public API ── */

/**
 * Generate a deterministic UUID-formatted seat key from logical coordinates.
 *
 * Uses four independent FNV-1a passes (different seeds) to produce 128 bits,
 * then formats them as a valid UUID v4 string.
 *
 * @param primitiveId - The parent primitive's ID (a UUID string).
 * @param logicalRow  - 0-based row index within the primitive.
 * @param logicalSeat - 0-based seat/column index within the row.
 * @returns A valid UUID v4 string, deterministic for the same inputs.
 */
export function deterministicSeatKey(
  primitiveId: string,
  logicalRow: number,
  logicalSeat: number,
): string {
  const input = `${primitiveId}:${logicalRow}:${logicalSeat}`;

  const h1 = fnv1a(input, 0x811c9dc5);
  const h2 = fnv1a(input, 0x050c5d1f);
  const h3 = fnv1a(input, 0x1a2b3c4d);
  const h4 = fnv1a(input, 0x7f6e5d4c);

  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const a = hex(h1);
  const b = hex(h2);
  const c = hex(h3);
  const d = hex(h4);

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // version nibble (pos 13) = 4, variant (pos 17) = 8/9/a/b
  const variant = '89ab'[parseInt(c[0], 16) & 3];
  return (
    a +
    '-' +
    b.slice(0, 4) +
    '-4' +
    b.slice(5, 8) +
    '-' +
    variant +
    c.slice(1, 4) +
    '-' +
    c.slice(4, 8) +
    d
  );
}
