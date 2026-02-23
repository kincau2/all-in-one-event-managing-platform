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
  seatFontWeight: 'bold' as const,
  seatFontColor: '#ffffff',
  seatFontSize: 0,     // 0 = auto (scales to fit circle)
  rowFontColor: '#666666',
  rowFontSize: 11,
  rowFontWeight: 'bold' as const,
  bgColor: '#ffffff',
  bgImage: '',
} as const;
