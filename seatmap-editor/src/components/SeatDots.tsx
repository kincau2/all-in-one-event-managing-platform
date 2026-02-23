/**
 * @aioemp/seatmap-editor — Seat dots layer
 *
 * Renders compiled seats as Konva circles with seat numbers inside.
 * Also renders row labels to the left of each row's first seat.
 * Uses sceneFunc for maximum performance with 2000+ seats.
 */

import React, { useMemo } from 'react';
import { Shape } from 'react-konva';
import type { CompiledSeat } from '@aioemp/seatmap-core';
import type Konva from 'konva';
import { useEditorStore } from '../store';
import { LAYOUT_STYLE_DEFAULTS } from '../layoutDefaults';

interface Props {
  seats: CompiledSeat[];
  selectedSeatKeys?: Set<string>;
}

const SELECTED_FILL = '#ff6d00';
const SELECTED_STROKE = '#e65100';
const EXCLUDED_FILL = '#e0e0e0';
const EXCLUDED_STROKE = '#999';
const TEXT_COLOR = '#ffffff';
const ROW_LABEL_COLOR = '#666666';

/**
 * Render all seats with seat numbers + row labels using a single
 * Konva Shape with custom sceneFunc for performance.
 */
export const SeatDots: React.FC<Props> = React.memo(({ seats, selectedSeatKeys }) => {
  // Read layout-level seat styling
  const lay = useEditorStore.getState().layout as any;
  const seatFill = lay.seatFill ?? LAYOUT_STYLE_DEFAULTS.seatFill;
  const seatStroke = lay.seatStroke ?? LAYOUT_STYLE_DEFAULTS.seatStroke;
  const seatFont = lay.seatFont ?? LAYOUT_STYLE_DEFAULTS.seatFont;
  const seatFontWeight = lay.seatFontWeight ?? LAYOUT_STYLE_DEFAULTS.seatFontWeight;

  // Group seats by row label for row label rendering
  const { normalSeats, excluded, selected, rowLabels } = useMemo(() => {
    const normal: CompiledSeat[] = [];
    const excl: CompiledSeat[] = [];
    const sel: CompiledSeat[] = [];
    const rowMap = new Map<string, { label: string; x: number; y: number; r: number }>();

    for (const s of seats) {
      const isSelected = selectedSeatKeys?.has(s.seat_key);
      if (isSelected) {
        sel.push(s);
      } else {
        normal.push(s);
      }

      // Track leftmost seat per row for row label placement
      const primId = (s.meta as any)?.primitiveId ?? '';
      const rowKey = `${primId}_${s.row ?? ''}`;
      const existing = rowMap.get(rowKey);
      if (!existing || s.x < existing.x) {
        rowMap.set(rowKey, {
          label: s.row ?? '',
          x: s.x,
          y: s.y,
          r: s.radius ?? 8,
        });
      }
    }

    return {
      normalSeats: normal,
      excluded: excl,
      selected: sel,
      rowLabels: Array.from(rowMap.values()),
    };
  }, [seats, selectedSeatKeys]);

  if (seats.length === 0) return null;

  return (
    <>
      {/* Normal seats with numbers */}
      <Shape
        sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
          const c = ctx as any;

          // Draw filled circles
          ctx.beginPath();
          for (const s of normalSeats) {
            const r = s.radius ?? 8;
            c.moveTo(s.x + r, s.y);
            c.arc(s.x, s.y, r, 0, Math.PI * 2, false);
          }
          ctx.closePath();
          ctx.fillStrokeShape(shape);

          // Draw seat numbers as white text inside circles
          c.fillStyle = TEXT_COLOR;
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          for (const s of normalSeats) {
            const r = s.radius ?? 8;
            // Scale font to fit inside circle
            const fontSize = Math.max(6, Math.min(r * 1.1, 14));
            c.font = `${seatFontWeight} ${fontSize}px ${seatFont}`;
            c.fillText(String(s.number ?? ''), s.x, s.y);
          }
        }}
        fill={seatFill}
        stroke={seatStroke}
        strokeWidth={1}
      />

      {/* Excluded seats (greyed out) */}
      {excluded.length > 0 && (
        <Shape
          sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
            const c = ctx as any;
            ctx.beginPath();
            for (const s of excluded) {
              const r = s.radius ?? 8;
              c.moveTo(s.x + r, s.y);
              c.arc(s.x, s.y, r, 0, Math.PI * 2, false);
            }
            ctx.closePath();
            ctx.fillStrokeShape(shape);

            // Draw X through excluded seats
            c.strokeStyle = EXCLUDED_STROKE;
            c.lineWidth = 1.5;
            for (const s of excluded) {
              const r = (s.radius ?? 8) * 0.5;
              c.beginPath();
              c.moveTo(s.x - r, s.y - r);
              c.lineTo(s.x + r, s.y + r);
              c.moveTo(s.x + r, s.y - r);
              c.lineTo(s.x - r, s.y + r);
              c.stroke();
            }
          }}
          fill={EXCLUDED_FILL}
          stroke={EXCLUDED_STROKE}
          strokeWidth={1}
        />
      )}

      {/* Selected seats (highlighted) */}
      {selected.length > 0 && (
        <Shape
          sceneFunc={(ctx: Konva.Context, shape: Konva.Shape) => {
            const c = ctx as any;
            ctx.beginPath();
            for (const s of selected) {
              const r = s.radius ?? 8;
              c.moveTo(s.x + r, s.y);
              c.arc(s.x, s.y, r, 0, Math.PI * 2, false);
            }
            ctx.closePath();
            ctx.fillStrokeShape(shape);

            // Draw seat numbers
            c.fillStyle = TEXT_COLOR;
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            for (const s of selected) {
              const r = s.radius ?? 8;
              const fontSize = Math.max(6, Math.min(r * 1.1, 14));
              c.font = `${seatFontWeight} ${fontSize}px ${seatFont}`;
              c.fillText(String(s.number ?? ''), s.x, s.y);
            }
          }}
          fill={SELECTED_FILL}
          stroke={SELECTED_STROKE}
          strokeWidth={2}
        />
      )}

      {/* Row labels — positioned to the left of each row's leftmost seat */}
      <Shape
        sceneFunc={(ctx: Konva.Context) => {
          const c = ctx as any;
          c.fillStyle = ROW_LABEL_COLOR;
          c.textAlign = 'right';
          c.textBaseline = 'middle';
          c.font = 'bold 11px -apple-system, sans-serif';
          for (const rl of rowLabels) {
            c.fillText(rl.label, rl.x - rl.r - 6, rl.y);
          }
        }}
      />
    </>
  );
});

SeatDots.displayName = 'SeatDots';
