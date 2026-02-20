/**
 * @aioemp/seatmap-editor — Inspector Panel
 *
 * Right-side panel showing editable properties for the selected primitive.
 * When nothing is selected → shows layout-level metadata (canvas size, name).
 * When one primitive is selected → shows type-specific fields.
 * Changes are debounced (200ms) and trigger recompile.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../store';
import type { Primitive } from '@aioemp/seatmap-core';

/* ── Debounce hook ── */

function useDebouncedCallback<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): T {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  return useCallback(
    ((...args: any[]) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fn(...args), delay);
    }) as T,
    [fn, delay],
  );
}

/* ── Shared field components ── */

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

const NumField: React.FC<NumFieldProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}) => (
  <label className="sme-field">
    <span className="sme-field__label">{label}</span>
    <input
      className="sme-field__input"
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    />
  </label>
);

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const TextField: React.FC<TextFieldProps> = ({
  label,
  value,
  onChange,
  disabled,
}) => (
  <label className="sme-field">
    <span className="sme-field__label">{label}</span>
    <input
      className="sme-field__input"
      type="text"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  </label>
);

interface SelectFieldProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}

const SelectField: React.FC<SelectFieldProps> = ({
  label,
  value,
  options,
  onChange,
  disabled,
}) => (
  <label className="sme-field">
    <span className="sme-field__label">{label}</span>
    <select
      className="sme-field__input"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

/* ── Type-specific inspectors ── */

interface InspectorProps {
  primitive: Primitive;
  onUpdate: (patch: Partial<Primitive>) => void;
  disabled: boolean;
}

const StageInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'stage' }>;
  return (
    <>
      <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ name: v } as any)} />
      <NumField label="Width" value={prim.width} min={10} disabled={disabled}
        onChange={(v) => onUpdate({ width: v } as any)} />
      <NumField label="Height" value={prim.height} min={10} disabled={disabled}
        onChange={(v) => onUpdate({ height: v } as any)} />
      <NumField label="X" value={prim.transform?.x ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, x: v } } as any)} />
      <NumField label="Y" value={prim.transform?.y ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, y: v } } as any)} />
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, rotation: v } } as any)} />
    </>
  );
};

const LabelInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'label' }>;
  return (
    <>
      <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ name: v } as any)} />
      <TextField label="Text" value={prim.text} disabled={disabled}
        onChange={(v) => onUpdate({ text: v } as any)} />
      <NumField label="Font Size" value={prim.fontSize} min={8} max={120} disabled={disabled}
        onChange={(v) => onUpdate({ fontSize: v } as any)} />
      <NumField label="X" value={prim.transform?.x ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, x: v } } as any)} />
      <NumField label="Y" value={prim.transform?.y ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, y: v } } as any)} />
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, rotation: v } } as any)} />
    </>
  );
};

const ObstacleInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'obstacle' }>;
  return (
    <>
      <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ name: v } as any)} />
      <NumField label="Width" value={prim.width} min={1} disabled={disabled}
        onChange={(v) => onUpdate({ width: v } as any)} />
      <NumField label="Height" value={prim.height} min={1} disabled={disabled}
        onChange={(v) => onUpdate({ height: v } as any)} />
      <NumField label="X" value={prim.transform?.x ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, x: v } } as any)} />
      <NumField label="Y" value={prim.transform?.y ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, y: v } } as any)} />
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, rotation: v } } as any)} />
    </>
  );
};

const GridInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'seatBlockGrid' }>;
  return (
    <>
      <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ name: v } as any)} />
      <TextField label="Section" value={prim.section ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ section: v } as any)} />
      <NumField label="Origin X" value={prim.origin.x} disabled={disabled}
        onChange={(v) => onUpdate({ origin: { ...prim.origin, x: v } } as any)} />
      <NumField label="Origin Y" value={prim.origin.y} disabled={disabled}
        onChange={(v) => onUpdate({ origin: { ...prim.origin, y: v } } as any)} />
      <NumField label="Rows" value={prim.rows} min={1} max={100} disabled={disabled}
        onChange={(v) => onUpdate({ rows: v } as any)} />
      <NumField label="Columns" value={prim.cols} min={1} max={200} disabled={disabled}
        onChange={(v) => onUpdate({ cols: v } as any)} />
      <NumField label="Seat Spacing X" value={prim.seatSpacingX} min={10} disabled={disabled}
        onChange={(v) => onUpdate({ seatSpacingX: v } as any)} />
      <NumField label="Seat Spacing Y" value={prim.seatSpacingY} min={10} disabled={disabled}
        onChange={(v) => onUpdate({ seatSpacingY: v } as any)} />
      <NumField label="Seat Radius" value={prim.seatRadius} min={2} max={30} disabled={disabled}
        onChange={(v) => onUpdate({ seatRadius: v } as any)} />
      <SelectField label="Numbering" value={prim.numbering} disabled={disabled}
        options={[
          { value: 'L2R', label: 'Left → Right' },
          { value: 'R2L', label: 'Right ← Left' },
        ]}
        onChange={(v) => onUpdate({ numbering: v } as any)} />
      <TextField label="Row Start" value={prim.rowLabel?.start ?? 'A'} disabled={disabled}
        onChange={(v) =>
          onUpdate({ rowLabel: { ...prim.rowLabel, start: v || 'A' } } as any)
        } />
      <SelectField label="Row Direction" value={prim.rowLabel?.direction ?? 'asc'} disabled={disabled}
        options={[
          { value: 'asc', label: 'A → B → C' },
          { value: 'desc', label: 'C → B → A' },
        ]}
        onChange={(v) =>
          onUpdate({ rowLabel: { ...prim.rowLabel, direction: v } } as any)
        } />
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, rotation: v } } as any)} />
    </>
  );
};

const ArcInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'seatBlockArc' }>;
  const spr = prim.seatsPerRow as { start: number; delta: number } | number[];
  const isArray = Array.isArray(spr);
  return (
    <>
      <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ name: v } as any)} />
      <TextField label="Section" value={prim.section ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ section: v } as any)} />
      <NumField label="Center X" value={prim.center.x} disabled={disabled}
        onChange={(v) => onUpdate({ center: { ...prim.center, x: v } } as any)} />
      <NumField label="Center Y" value={prim.center.y} disabled={disabled}
        onChange={(v) => onUpdate({ center: { ...prim.center, y: v } } as any)} />
      <NumField label="Rows" value={prim.rowCount} min={1} max={50} disabled={disabled}
        onChange={(v) => onUpdate({ rowCount: v } as any)} />
      <NumField label="Start Radius" value={prim.startRadius} min={20} disabled={disabled}
        onChange={(v) => onUpdate({ startRadius: v } as any)} />
      <NumField label="Radius Step" value={prim.radiusStep} min={10} disabled={disabled}
        onChange={(v) => onUpdate({ radiusStep: v } as any)} />
      <NumField label="Start Angle" value={prim.startAngleDeg} min={-360} max={360} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ startAngleDeg: v } as any)} />
      <NumField label="End Angle" value={prim.endAngleDeg} min={-360} max={360} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ endAngleDeg: v } as any)} />
      {!isArray && (
        <>
          <NumField label="Seats (first row)" value={(spr as any).start ?? 10} min={1} disabled={disabled}
            onChange={(v) => onUpdate({ seatsPerRow: { ...(spr as any), start: v } } as any)} />
          <NumField label="Seats delta" value={(spr as any).delta ?? 0} disabled={disabled}
            onChange={(v) => onUpdate({ seatsPerRow: { ...(spr as any), delta: v } } as any)} />
        </>
      )}
      <NumField label="Seat Radius" value={prim.seatRadius} min={2} max={30} disabled={disabled}
        onChange={(v) => onUpdate({ seatRadius: v } as any)} />
    </>
  );
};

const WedgeInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'seatBlockWedge' }>;
  const spr = prim.seatsPerRow as { start: number; delta: number } | number[];
  const isArray = Array.isArray(spr);
  return (
    <>
      <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ name: v } as any)} />
      <TextField label="Section" value={prim.section ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ section: v } as any)} />
      <NumField label="Center X" value={prim.center.x} disabled={disabled}
        onChange={(v) => onUpdate({ center: { ...prim.center, x: v } } as any)} />
      <NumField label="Center Y" value={prim.center.y} disabled={disabled}
        onChange={(v) => onUpdate({ center: { ...prim.center, y: v } } as any)} />
      <NumField label="Inner Radius" value={prim.innerRadius} min={10} disabled={disabled}
        onChange={(v) => onUpdate({ innerRadius: v } as any)} />
      <NumField label="Outer Radius" value={prim.outerRadius} min={20} disabled={disabled}
        onChange={(v) => onUpdate({ outerRadius: v } as any)} />
      <NumField label="Start Angle" value={prim.startAngleDeg} min={-360} max={360} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ startAngleDeg: v } as any)} />
      <NumField label="End Angle" value={prim.endAngleDeg} min={-360} max={360} step={5} disabled={disabled}
        onChange={(v) => onUpdate({ endAngleDeg: v } as any)} />
      <NumField label="Rows" value={prim.rowCount} min={1} max={50} disabled={disabled}
        onChange={(v) => onUpdate({ rowCount: v } as any)} />
      {!isArray && (
        <>
          <NumField label="Seats (first row)" value={(spr as any).start ?? 6} min={1} disabled={disabled}
            onChange={(v) => onUpdate({ seatsPerRow: { ...(spr as any), start: v } } as any)} />
          <NumField label="Seats delta" value={(spr as any).delta ?? 0} disabled={disabled}
            onChange={(v) => onUpdate({ seatsPerRow: { ...(spr as any), delta: v } } as any)} />
        </>
      )}
      <NumField label="Seat Radius" value={prim.seatRadius} min={2} max={30} disabled={disabled}
        onChange={(v) => onUpdate({ seatRadius: v } as any)} />
    </>
  );
};

/* ── Inspector component map ── */

const inspectorMap: Record<string, React.FC<InspectorProps>> = {
  stage: StageInspector,
  label: LabelInspector,
  obstacle: ObstacleInspector,
  seatBlockGrid: GridInspector,
  seatBlockArc: ArcInspector,
  seatBlockWedge: WedgeInspector,
};

/* ── Main Inspector Panel ── */

export const InspectorPanel: React.FC = () => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const primitives = useEditorStore((s) => s.layout.primitives);
  const compiledSeats = useEditorStore((s) => s.compiledSeats);
  const isLocked = useEditorStore((s) => s.isLocked);
  const updatePrimitive = useEditorStore((s) => s.updatePrimitive);

  const selected = useMemo(
    () => primitives.filter((pr) => selectedIds.includes(pr.id)),
    [primitives, selectedIds],
  );

  const debouncedUpdate = useDebouncedCallback(
    (id: string, patch: Partial<Primitive>) => {
      updatePrimitive(id, patch);
    },
    200,
  );

  /* Nothing selected → layout overview */
  if (selected.length === 0) {
    const totalSeats = compiledSeats.length;
    const primCount = primitives.length;
    return (
      <div className="sme-inspector">
        <div className="sme-inspector__header">Layout Overview</div>
        <div className="sme-inspector__body">
          <div className="sme-inspector__stat">
            <span>Primitives</span>
            <strong>{primCount}</strong>
          </div>
          <div className="sme-inspector__stat">
            <span>Total Seats</span>
            <strong>{totalSeats}</strong>
          </div>
        </div>
      </div>
    );
  }

  /* Multiple selection → summary */
  if (selected.length > 1) {
    return (
      <div className="sme-inspector">
        <div className="sme-inspector__header">{selected.length} Selected</div>
        <div className="sme-inspector__body">
          <p className="sme-inspector__hint">Select a single primitive to edit its properties.</p>
        </div>
      </div>
    );
  }

  /* Single selection → type-specific inspector */
  const prim = selected[0];
  const SubInspector = inspectorMap[prim.type];

  return (
    <div className="sme-inspector">
      <div className="sme-inspector__header">
        <span className="sme-inspector__type">{prim.type}</span>
        <span className="sme-inspector__id" title={prim.id}>
          #{prim.id.slice(0, 8)}
        </span>
      </div>
      <div className="sme-inspector__body">
        {SubInspector ? (
          <SubInspector
            primitive={prim}
            onUpdate={(patch) => debouncedUpdate(prim.id, patch)}
            disabled={isLocked}
          />
        ) : (
          <p className="sme-inspector__hint">No editable properties for this type.</p>
        )}
      </div>
    </div>
  );
};
