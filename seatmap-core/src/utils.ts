/**
 * @aioemp/seatmap-core — Utility helpers
 */

import type { SeatsPerRow } from './types.js';

/* ── Angle / rotation ── */

/** Convert degrees to radians. */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Rotate point (px, py) around center (cx, cy) by `angleDeg` degrees.
 */
export function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

/* ── Row-label generation (spreadsheet-style: A, B, …, Z, AA, AB …) ── */

/**
 * Convert a letter label to a 0-based index.
 * A → 0, B → 1, …, Z → 25, AA → 26, AB → 27 …
 */
export function labelToIndex(label: string): number {
  let idx = 0;
  for (let i = 0; i < label.length; i++) {
    idx = idx * 26 + (label.toUpperCase().charCodeAt(i) - 64); // A = 65
  }
  return idx - 1; // make 0-based
}

/**
 * Convert a 0-based index to a letter label.
 * 0 → A, 1 → B, …, 25 → Z, 26 → AA …
 */
export function indexToLabel(index: number): string {
  let n = index + 1; // 1-based
  let label = '';
  while (n > 0) {
    n--;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

/**
 * Generate row label for a given row index.
 *
 * @param start  - Starting label (e.g. 'A' for alpha, '1' for numeric)
 * @param rowIdx - 0-based row index
 * @param dir    - 'asc' (A→B→C) or 'desc' (Z→Y→X)
 * @param mode   - 'alpha' (A,B,C…) or 'numeric' (1,2,3…)
 */
export function generateRowLabel(
  start: string,
  rowIdx: number,
  dir: 'asc' | 'desc',
  mode: 'alpha' | 'numeric' = 'alpha',
): string {
  if (mode === 'numeric') {
    const startNum = parseInt(start, 10) || 1;
    const num = dir === 'asc' ? startNum + rowIdx : startNum - rowIdx;
    return String(num);
  }
  const base = labelToIndex(start);
  const idx = dir === 'asc' ? base + rowIdx : base - rowIdx;
  if (idx < 0) return String(idx); // safety fallback
  return indexToLabel(idx);
}

/* ── Seats-per-row resolver ── */

/**
 * Resolve the number of seats for a given row index.
 *
 * Accepts either:
 * - `{ start, delta }` — arithmetic progression
 * - `number[]` — explicit per-row counts (clamps to last element)
 */
export function getSeatsPerRow(
  spec: SeatsPerRow,
  rowIndex: number,
): number {
  if (Array.isArray(spec)) {
    return spec[Math.min(rowIndex, spec.length - 1)];
  }
  return spec.start + rowIndex * spec.delta;
}

/* ── UUID generation ── */

/**
 * Generate a RFC 4122 v4 UUID.
 * Uses Web Crypto API when available, falls back to Math.random.
 */
export function generateUUID(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  // Fallback (non-cryptographic but structurally valid)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ── Coordinate rounding ── */

/** Round to 2 decimal places to avoid floating-point noise. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
