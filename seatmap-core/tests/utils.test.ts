/**
 * Tests — utility functions
 */
import { describe, it, expect } from 'vitest';
import {
  degToRad,
  rotatePoint,
  labelToIndex,
  indexToLabel,
  generateRowLabel,
  getSeatsPerRow,
  generateUUID,
  round2,
} from '../src/utils.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ── degToRad ── */

describe('degToRad', () => {
  it('converts 0°', () => expect(degToRad(0)).toBe(0));
  it('converts 90°', () => expect(degToRad(90)).toBeCloseTo(Math.PI / 2));
  it('converts 180°', () => expect(degToRad(180)).toBeCloseTo(Math.PI));
  it('converts 360°', () => expect(degToRad(360)).toBeCloseTo(2 * Math.PI));
  it('handles negative', () => expect(degToRad(-90)).toBeCloseTo(-Math.PI / 2));
});

/* ── rotatePoint ── */

describe('rotatePoint', () => {
  it('rotates (1,0) 90° around origin → (0,1)', () => {
    const { x, y } = rotatePoint(1, 0, 0, 0, 90);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(1, 10);
  });

  it('rotates (1,0) 180° around origin → (-1,0)', () => {
    const { x, y } = rotatePoint(1, 0, 0, 0, 180);
    expect(x).toBeCloseTo(-1, 10);
    expect(y).toBeCloseTo(0, 10);
  });

  it('rotates around non-origin center', () => {
    // Rotate (10, 0) around (5, 0) by 90° → (5, 5)
    const { x, y } = rotatePoint(10, 0, 5, 0, 90);
    expect(x).toBeCloseTo(5, 10);
    expect(y).toBeCloseTo(5, 10);
  });

  it('0° rotation returns same point', () => {
    const { x, y } = rotatePoint(3, 7, 0, 0, 0);
    expect(x).toBeCloseTo(3);
    expect(y).toBeCloseTo(7);
  });
});

/* ── labelToIndex / indexToLabel ── */

describe('labelToIndex', () => {
  it('A → 0', () => expect(labelToIndex('A')).toBe(0));
  it('Z → 25', () => expect(labelToIndex('Z')).toBe(25));
  it('AA → 26', () => expect(labelToIndex('AA')).toBe(26));
  it('AB → 27', () => expect(labelToIndex('AB')).toBe(27));
  it('AZ → 51', () => expect(labelToIndex('AZ')).toBe(51));
  it('BA → 52', () => expect(labelToIndex('BA')).toBe(52));
  it('is case-insensitive', () => expect(labelToIndex('aa')).toBe(26));
});

describe('indexToLabel', () => {
  it('0 → A', () => expect(indexToLabel(0)).toBe('A'));
  it('25 → Z', () => expect(indexToLabel(25)).toBe('Z'));
  it('26 → AA', () => expect(indexToLabel(26)).toBe('AA'));
  it('27 → AB', () => expect(indexToLabel(27)).toBe('AB'));
  it('51 → AZ', () => expect(indexToLabel(51)).toBe('AZ'));
  it('52 → BA', () => expect(indexToLabel(52)).toBe('BA'));
});

describe('labelToIndex ↔ indexToLabel round-trip', () => {
  it('round-trips for all single letters', () => {
    for (let i = 0; i < 26; i++) {
      expect(labelToIndex(indexToLabel(i))).toBe(i);
    }
  });

  it('round-trips for double letters', () => {
    for (let i = 26; i < 702; i++) { // AA to ZZ
      expect(labelToIndex(indexToLabel(i))).toBe(i);
    }
  });
});

/* ── generateRowLabel ── */

describe('generateRowLabel', () => {
  it('ascending from A', () => {
    expect(generateRowLabel('A', 0, 'asc')).toBe('A');
    expect(generateRowLabel('A', 1, 'asc')).toBe('B');
    expect(generateRowLabel('A', 25, 'asc')).toBe('Z');
    expect(generateRowLabel('A', 26, 'asc')).toBe('AA');
  });

  it('descending from Z', () => {
    expect(generateRowLabel('Z', 0, 'desc')).toBe('Z');
    expect(generateRowLabel('Z', 1, 'desc')).toBe('Y');
    expect(generateRowLabel('Z', 25, 'desc')).toBe('A');
  });

  it('ascending from E', () => {
    expect(generateRowLabel('E', 0, 'asc')).toBe('E');
    expect(generateRowLabel('E', 1, 'asc')).toBe('F');
  });
});

/* ── getSeatsPerRow ── */

describe('getSeatsPerRow', () => {
  it('start/delta spec: 10 + 2*row', () => {
    expect(getSeatsPerRow({ start: 10, delta: 2 }, 0)).toBe(10);
    expect(getSeatsPerRow({ start: 10, delta: 2 }, 1)).toBe(12);
    expect(getSeatsPerRow({ start: 10, delta: 2 }, 5)).toBe(20);
  });

  it('array spec: returns element at index', () => {
    expect(getSeatsPerRow([5, 8, 10], 0)).toBe(5);
    expect(getSeatsPerRow([5, 8, 10], 1)).toBe(8);
    expect(getSeatsPerRow([5, 8, 10], 2)).toBe(10);
  });

  it('array spec: clamps to last element if index exceeds length', () => {
    expect(getSeatsPerRow([5, 8], 5)).toBe(8);
  });
});

/* ── generateUUID ── */

describe('generateUUID', () => {
  it('returns a valid UUID', () => {
    expect(generateUUID()).toMatch(UUID_RE);
  });

  it('returns unique values', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateUUID());
    }
    expect(ids.size).toBe(1000);
  });
});

/* ── round2 ── */

describe('round2', () => {
  it('rounds to 2 decimals', () => {
    expect(round2(1.006)).toBe(1.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(123.456789)).toBe(123.46);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('leaves integers untouched', () => {
    expect(round2(42)).toBe(42);
  });
});
