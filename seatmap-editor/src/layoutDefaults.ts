/**
 * @aioemp/seatmap-editor — Shared layout style defaults
 *
 * Single source of truth for fallback values used when reading
 * layout-level style props. Keeps InspectorPanel + SeatDots in sync.
 */

export const LAYOUT_STYLE_DEFAULTS = {
  seatRadius: 10,
  seatFill: '#4B49AC',
  seatStroke: '#3a389a',
  seatFont: '-apple-system, sans-serif',
  seatFontWeight: 'bold' as const,
  bgColor: '#ffffff',
  bgImage: '',
} as const;
