/**
 * @aioemp/seatmap-core — Browser bundle entry
 *
 * Builds as an IIFE, exposing `window.aioemp_compileSnapshot()` for
 * the Events admin page (seating tab) to compile raw layout JSON
 * into seats + bounds on the client side.
 *
 * Only primitives (≈ small JSON) are stored in the DB; this
 * function regenerates the compiled data on demand.
 */

import { LayoutSchema } from './schema.js';
import { compileLayout } from './compile-layout.js';

interface CompileSnapshotResult {
  seats: import('./types.js').CompiledSeat[];
  bounds: import('./types.js').Bounds;
  rowLabels?: import('./types.js').CompiledRowLabel[];
}

/**
 * Compile a raw layout snapshot → { seats, bounds, rowLabels }.
 * Returns null if the snapshot is invalid.
 */
function compileSnapshot(rawLayout: unknown): CompileSnapshotResult | null {
  const result = LayoutSchema.safeParse(rawLayout);
  if (!result.success) return null;

  const compiled = compileLayout(result.data);
  return compiled.compiled;
}

// Expose on the global scope for the admin events script.
(window as any).aioemp_compileSnapshot = compileSnapshot;
