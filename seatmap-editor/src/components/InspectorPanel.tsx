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
import { uploadBgImage } from '../api';
import { LAYOUT_STYLE_DEFAULTS } from '../layoutDefaults';
import type { Primitive } from '@aioemp/seatmap-core';

/* ── Collapsible section ── */

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sme-collapsible">
      <button
        type="button"
        className={`sme-collapsible__toggle${open ? ' sme-collapsible__toggle--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <svg className="sme-collapsible__chevron" width="12" height="12" viewBox="0 0 12 12">
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{title}</span>
      </button>
      {open && <div className="sme-collapsible__body">{children}</div>}
    </div>
  );
};

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

/**
 * Local-state wrapper: keep a local copy of `value` so the input responds
 * instantly, while the debounced `onChange` pushes to the store.
 * When the *external* value changes (e.g. undo/ another field triggers
 * recompile) we sync back.
 */

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
}) => {
  const [local, setLocal] = useState<string>(String(value));
  const externalRef = useRef(value);

  // Sync local state when external value changes (undo, recompile, etc.)
  useEffect(() => {
    if (value !== externalRef.current) {
      externalRef.current = value;
      setLocal(String(value));
    }
  }, [value]);

  return (
    <label className="sme-field">
      <span className="sme-field__label">{label}</span>
      <input
        className="sme-field__input"
        type="number"
        value={local}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          setLocal(raw);
          const parsed = parseFloat(raw);
          if (!isNaN(parsed)) {
            externalRef.current = parsed;
            onChange(parsed);
          }
        }}
      />
    </label>
  );
};

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
}) => {
  const [local, setLocal] = useState(value);
  const externalRef = useRef(value);

  useEffect(() => {
    if (value !== externalRef.current) {
      externalRef.current = value;
      setLocal(value);
    }
  }, [value]);

  return (
    <label className="sme-field">
      <span className="sme-field__label">{label}</span>
      <input
        className="sme-field__input"
        type="text"
        value={local}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          externalRef.current = v;
          onChange(v);
        }}
      />
    </label>
  );
};

/**
 * Row Start field: forces alpha-only or numeric-only input based on the current row label mode.
 */
interface RowStartFieldProps {
  mode: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const RowStartField: React.FC<RowStartFieldProps> = ({ mode, value, onChange, disabled }) => {
  const [local, setLocal] = useState(value);
  const externalRef = useRef(value);

  useEffect(() => {
    if (value !== externalRef.current) {
      externalRef.current = value;
      setLocal(value);
    }
  }, [value]);

  // When mode changes, reset to a sensible default if the current value is invalid
  useEffect(() => {
    if (mode === 'alpha' && /^\d+$/.test(local)) {
      const next = 'A';
      setLocal(next);
      externalRef.current = next;
      onChange(next);
    } else if (mode === 'numeric' && /[^\d]/.test(local)) {
      const next = '1';
      setLocal(next);
      externalRef.current = next;
      onChange(next);
    }
  }, [mode]);

  const handleChange = (raw: string) => {
    let filtered = raw;
    if (mode === 'alpha') {
      filtered = raw.replace(/[^A-Za-z]/g, '').toUpperCase();
    } else if (mode === 'numeric') {
      filtered = raw.replace(/[^0-9]/g, '');
    }
    setLocal(filtered);
    if (filtered) {
      externalRef.current = filtered;
      onChange(filtered);
    }
  };

  return (
    <label className="sme-field">
      <span className="sme-field__label">Starting Row</span>
      <input
        className="sme-field__input"
        type="text"
        value={local}
        disabled={disabled}
        placeholder={mode === 'alpha' ? 'A' : '1'}
        onChange={(e) => handleChange(e.target.value)}
      />
    </label>
  );
};

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

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

const ColorField: React.FC<ColorFieldProps> = ({ label, value, onChange, disabled }) => {
  const [local, setLocal] = useState(value);
  const externalRef = useRef(value);
  useEffect(() => {
    if (value !== externalRef.current) {
      externalRef.current = value;
      setLocal(value);
    }
  }, [value]);
  return (
    <label className="sme-field">
      <span className="sme-field__label">{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        <input type="color" value={local} disabled={disabled}
          style={{ width: 32, height: 28, padding: 0, border: 'none', cursor: 'pointer' }}
          onChange={(e) => { setLocal(e.target.value); externalRef.current = e.target.value; onChange(e.target.value); }} />
        <input className="sme-field__input" type="text" value={local} disabled={disabled}
          style={{ flex: 1 }}
          onChange={(e) => { setLocal(e.target.value); externalRef.current = e.target.value; onChange(e.target.value); }} />
      </div>
    </label>
  );
};

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

const ImageUploadField: React.FC<ImageUploadFieldProps> = ({ label, value, onChange, disabled }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    try {
      const url = await uploadBgImage(file);
      onChange(url);
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sme-field">
      <span className="sme-field__label">{label}</span>
      {value && (
        <div style={{ position: 'relative', marginBottom: 4 }}>
          <img src={value} alt="bg" style={{ width: '100%', maxHeight: 80, objectFit: 'cover', borderRadius: 4, border: '1px solid #ddd' }} />
          {!disabled && (
            <button type="button" style={{
              position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)',
              color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20,
              cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0,
            }} onClick={() => onChange('')} title="Remove">&times;</button>
          )}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
      <button type="button" className="sme-field__input" disabled={disabled || uploading}
        style={{ cursor: disabled ? 'default' : 'pointer', textAlign: 'center', padding: '4px 8px' }}
        onClick={() => fileRef.current?.click()}>
        {uploading ? 'Uploading…' : value ? 'Change Image' : 'Upload Image'}
      </button>
      {error && <span style={{ color: '#c00', fontSize: 11 }}>{error}</span>}
    </div>
  );
};

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
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={1} disabled={disabled}
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
      <ColorField label="Font Color" value={(prim as any).fontColor ?? '#333333'} disabled={disabled}
        onChange={(v) => onUpdate({ fontColor: v } as any)} />
      <SelectField label="Font Weight" value={(prim as any).fontWeight ?? 'normal'} disabled={disabled}
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'bold', label: 'Bold' },
        ]}
        onChange={(v) => onUpdate({ fontWeight: v } as any)} />
      <NumField label="X" value={prim.transform?.x ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, x: v } } as any)} />
      <NumField label="Y" value={prim.transform?.y ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, y: v } } as any)} />
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={1} disabled={disabled}
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
      <ColorField label="Fill Color" value={(prim as any).color ?? '#ffcccc'} disabled={disabled}
        onChange={(v) => onUpdate({ color: v } as any)} />
      <ColorField label="Border Color" value={(prim as any).borderColor ?? '#cc5555'} disabled={disabled}
        onChange={(v) => onUpdate({ borderColor: v } as any)} />
      <NumField label="Border Radius" value={(prim as any).borderRadius ?? 0} min={0} disabled={disabled}
        onChange={(v) => onUpdate({ borderRadius: v } as any)} />
      <NumField label="X" value={prim.transform?.x ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, x: v } } as any)} />
      <NumField label="Y" value={prim.transform?.y ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, y: v } } as any)} />
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={1} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, rotation: v } } as any)} />
    </>
  );
};

const ImageInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'image' }>;
  return (
    <>
      <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ name: v } as any)} />
      <ImageUploadField label="Source" value={(prim as any).src ?? ''} disabled={disabled}
        onChange={(v) => onUpdate({ src: v } as any)} />
      <NumField label="Width" value={prim.width} min={1} disabled={disabled}
        onChange={(v) => onUpdate({ width: v } as any)} />
      <NumField label="Height" value={prim.height} min={1} disabled={disabled}
        onChange={(v) => onUpdate({ height: v } as any)} />
      <NumField label="X" value={prim.transform?.x ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, x: v } } as any)} />
      <NumField label="Y" value={prim.transform?.y ?? 0} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, y: v } } as any)} />
      <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={1} disabled={disabled}
        onChange={(v) => onUpdate({ transform: { ...prim.transform, rotation: v } } as any)} />
    </>
  );
};

const GridInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'seatBlockGrid' }>;
  return (
    <>
      <CollapsibleSection title="Section Property">
        <TextField label="Section" value={prim.section ?? ''} disabled={disabled}
          onChange={(v) => onUpdate({ section: v } as any)} />
        <NumField label="Origin X" value={prim.origin.x} disabled={disabled}
          onChange={(v) => onUpdate({ origin: { ...prim.origin, x: v } } as any)} />
        <NumField label="Origin Y" value={prim.origin.y} disabled={disabled}
          onChange={(v) => onUpdate({ origin: { ...prim.origin, y: v } } as any)} />
        <NumField label="Rotation" value={prim.transform?.rotation ?? 0} step={1} disabled={disabled}
          onChange={(v) => onUpdate({ transform: { ...prim.transform, rotation: v } } as any)} />
      </CollapsibleSection>

      <CollapsibleSection title="Seat Setting">
        <NumField label="Rows" value={prim.rows} min={1} max={100} disabled={disabled}
          onChange={(v) => onUpdate({ rows: v } as any)} />
        <NumField label="Columns" value={prim.cols} min={1} max={200} disabled={disabled}
          onChange={(v) => onUpdate({ cols: v } as any)} />
        <NumField label="Seat Spacing X" value={prim.seatSpacingX} min={10} disabled={disabled}
          onChange={(v) => onUpdate({ seatSpacingX: v } as any)} />
        <NumField label="Seat Spacing Y" value={prim.seatSpacingY} min={10} disabled={disabled}
          onChange={(v) => onUpdate({ seatSpacingY: v } as any)} />
      </CollapsibleSection>

      <CollapsibleSection title="Seat Labeling">
        <NumField label="Start Seat #" value={(prim as any).startSeatNumber ?? 1} min={1} disabled={disabled}
          onChange={(v) => onUpdate({ startSeatNumber: v } as any)} />
        <SelectField label="Numbering Direction" value={prim.numbering} disabled={disabled}
          options={[
            { value: 'L2R', label: 'Left → Right' },
            { value: 'R2L', label: 'Right ← Left' },
          ]}
          onChange={(v) => onUpdate({ numbering: v } as any)} />
        <SelectField label="Row Label Mode" value={prim.rowLabel?.mode ?? 'alpha'} disabled={disabled}
          options={[
            { value: 'alpha', label: 'Alphabetic (A, B, C…)' },
            { value: 'numeric', label: 'Numeric (1, 2, 3…)' },
          ]}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...prim.rowLabel, mode: v } } as any)
          } />
        <RowStartField mode={prim.rowLabel?.mode ?? 'alpha'} value={prim.rowLabel?.start ?? 'A'} disabled={disabled}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...prim.rowLabel, start: v || 'A' } } as any)
          } />
        <SelectField label="Row Direction" value={prim.rowLabel?.direction ?? 'asc'} disabled={disabled}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...prim.rowLabel, direction: v } } as any)
          } />
        <SelectField label="Row Label Display" value={(prim as any).rowLabelDisplay ?? 'left'} disabled={disabled}
          options={[
            { value: 'none', label: 'Not Display' },
            { value: 'left', label: 'Left Side' },
            { value: 'right', label: 'Right Side' },
            { value: 'both', label: 'Both Sides' },
          ]}
          onChange={(v) => onUpdate({ rowLabelDisplay: v } as any)} />
      </CollapsibleSection>
    </>
  );
};

const ArcInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'seatBlockArc' }>;
  const spr = prim.seatsPerRow as { start: number; delta: number } | number[];
  const isArray = Array.isArray(spr);
  return (
    <>
      <CollapsibleSection title="Section Property">
        <TextField label="Section" value={prim.section ?? ''} disabled={disabled}
          onChange={(v) => onUpdate({ section: v } as any)} />
        <NumField label="Center X" value={prim.center.x} disabled={disabled}
          onChange={(v) => onUpdate({ center: { ...prim.center, x: v } } as any)} />
        <NumField label="Center Y" value={prim.center.y} disabled={disabled}
          onChange={(v) => onUpdate({ center: { ...prim.center, y: v } } as any)} />
      </CollapsibleSection>

      <CollapsibleSection title="Seat Setting">
        <NumField label="Rows" value={prim.rowCount} min={1} max={50} disabled={disabled}
          onChange={(v) => onUpdate({ rowCount: v } as any)} />
        <NumField label="Start Radius" value={prim.startRadius} min={20} disabled={disabled}
          onChange={(v) => onUpdate({ startRadius: v } as any)} />
        <NumField label="Radius Step" value={prim.radiusStep} min={10} disabled={disabled}
          onChange={(v) => onUpdate({ radiusStep: v } as any)} />
        <NumField label="Radius Ratio" value={prim.radiusRatio ?? 1} min={0.1} max={5} step={0.1} disabled={disabled}
          onChange={(v) => onUpdate({ radiusRatio: v } as any)} />
        <NumField label="Start Angle" value={prim.startAngleDeg} min={-360} max={360} step={1} disabled={disabled}
          onChange={(v) => onUpdate({ startAngleDeg: v } as any)} />
        <NumField label="End Angle" value={prim.endAngleDeg} min={-360} max={360} step={1} disabled={disabled}
          onChange={(v) => onUpdate({ endAngleDeg: v } as any)} />
        {!isArray && (
          <>
            <NumField label="Seats (first row)" value={(spr as any).start ?? 10} min={1} disabled={disabled}
              onChange={(v) => onUpdate({ seatsPerRow: { ...(spr as any), start: v } } as any)} />
            <NumField label="Seats delta" value={(spr as any).delta ?? 0} disabled={disabled}
              onChange={(v) => onUpdate({ seatsPerRow: { ...(spr as any), delta: v } } as any)} />
          </>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Seat Labeling">
        <NumField label="Start Seat #" value={(prim as any).startSeatNumber ?? 1} min={1} disabled={disabled}
          onChange={(v) => onUpdate({ startSeatNumber: v } as any)} />
        <SelectField label="Numbering Direction" value={(prim as any).numbering ?? 'L2R'} disabled={disabled}
          options={[
            { value: 'L2R', label: 'Left → Right' },
            { value: 'R2L', label: 'Right ← Left' },
          ]}
          onChange={(v) => onUpdate({ numbering: v } as any)} />
        <SelectField label="Row Label Mode" value={(prim as any).rowLabel?.mode ?? 'alpha'} disabled={disabled}
          options={[
            { value: 'alpha', label: 'Alphabetic (A, B, C…)' },
            { value: 'numeric', label: 'Numeric (1, 2, 3…)' },
          ]}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...(prim as any).rowLabel, mode: v } } as any)
          } />
        <RowStartField mode={(prim as any).rowLabel?.mode ?? 'alpha'} value={(prim as any).rowLabel?.start ?? 'A'} disabled={disabled}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...(prim as any).rowLabel, start: v || 'A' } } as any)
          } />
        <SelectField label="Row Direction" value={(prim as any).rowLabel?.direction ?? 'asc'} disabled={disabled}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...(prim as any).rowLabel, direction: v } } as any)
          } />
        <SelectField label="Row Label Display" value={(prim as any).rowLabelDisplay ?? 'left'} disabled={disabled}
          options={[
            { value: 'none', label: 'Not Display' },
            { value: 'left', label: 'Left Side' },
            { value: 'right', label: 'Right Side' },
            { value: 'both', label: 'Both Sides' },
          ]}
          onChange={(v) => onUpdate({ rowLabelDisplay: v } as any)} />
      </CollapsibleSection>
    </>
  );
};

const WedgeInspector: React.FC<InspectorProps> = ({ primitive: p, onUpdate, disabled }) => {
  const prim = p as Extract<Primitive, { type: 'seatBlockWedge' }>;
  const spr = prim.seatsPerRow as { start: number; delta: number } | number[];
  const isArray = Array.isArray(spr);
  return (
    <>
      <CollapsibleSection title="Section Property">
        <TextField label="Name" value={prim.name ?? ''} disabled={disabled}
          onChange={(v) => onUpdate({ name: v } as any)} />
        <TextField label="Section" value={prim.section ?? ''} disabled={disabled}
          onChange={(v) => onUpdate({ section: v } as any)} />
        <NumField label="Center X" value={prim.center.x} disabled={disabled}
          onChange={(v) => onUpdate({ center: { ...prim.center, x: v } } as any)} />
        <NumField label="Center Y" value={prim.center.y} disabled={disabled}
          onChange={(v) => onUpdate({ center: { ...prim.center, y: v } } as any)} />
      </CollapsibleSection>

      <CollapsibleSection title="Seat Setting">
        <NumField label="Inner Radius" value={prim.innerRadius} min={10} disabled={disabled}
          onChange={(v) => onUpdate({ innerRadius: v } as any)} />
        <NumField label="Outer Radius" value={prim.outerRadius} min={20} disabled={disabled}
          onChange={(v) => onUpdate({ outerRadius: v } as any)} />
        <NumField label="Start Angle" value={prim.startAngleDeg} min={-360} max={360} step={1} disabled={disabled}
          onChange={(v) => onUpdate({ startAngleDeg: v } as any)} />
        <NumField label="End Angle" value={prim.endAngleDeg} min={-360} max={360} step={1} disabled={disabled}
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
      </CollapsibleSection>

      <CollapsibleSection title="Seat Labeling">
        <SelectField label="Numbering Direction" value={(prim as any).numbering ?? 'L2R'} disabled={disabled}
          options={[
            { value: 'L2R', label: 'Left → Right' },
            { value: 'R2L', label: 'Right ← Left' },
          ]}
          onChange={(v) => onUpdate({ numbering: v } as any)} />
        <SelectField label="Row Label Mode" value={(prim as any).rowLabel?.mode ?? 'alpha'} disabled={disabled}
          options={[
            { value: 'alpha', label: 'Alphabetic (A, B, C…)' },
            { value: 'numeric', label: 'Numeric (1, 2, 3…)' },
          ]}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...(prim as any).rowLabel, mode: v } } as any)
          } />
        <RowStartField mode={(prim as any).rowLabel?.mode ?? 'alpha'} value={(prim as any).rowLabel?.start ?? 'A'} disabled={disabled}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...(prim as any).rowLabel, start: v || 'A' } } as any)
          } />
        <SelectField label="Row Direction" value={(prim as any).rowLabel?.direction ?? 'asc'} disabled={disabled}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          onChange={(v) =>
            onUpdate({ rowLabel: { ...(prim as any).rowLabel, direction: v } } as any)
          } />
      </CollapsibleSection>
    </>
  );
};

/* ── Inspector component map ── */

const inspectorMap: Record<string, React.FC<InspectorProps>> = {
  stage: StageInspector,
  label: LabelInspector,
  obstacle: ObstacleInspector,
  image: ImageInspector,
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
    const lay = useEditorStore.getState().layout;
    const canvas = lay.canvas;
    const globalSeatRadius = (lay as any).seatRadius ?? LAYOUT_STYLE_DEFAULTS.seatRadius;
    const seatFill = (lay as any).seatFill ?? LAYOUT_STYLE_DEFAULTS.seatFill;
    const seatStroke = (lay as any).seatStroke ?? LAYOUT_STYLE_DEFAULTS.seatStroke;
    const seatFontWeight = (lay as any).seatFontWeight ?? LAYOUT_STYLE_DEFAULTS.seatFontWeight;
    const seatFontColor = (lay as any).seatFontColor ?? LAYOUT_STYLE_DEFAULTS.seatFontColor;
    const seatFontSize = (lay as any).seatFontSize ?? LAYOUT_STYLE_DEFAULTS.seatFontSize;
    const rowFontColor = (lay as any).rowFontColor ?? LAYOUT_STYLE_DEFAULTS.rowFontColor;
    const rowFontSize = (lay as any).rowFontSize ?? LAYOUT_STYLE_DEFAULTS.rowFontSize;
    const rowFontWeight = (lay as any).rowFontWeight ?? LAYOUT_STYLE_DEFAULTS.rowFontWeight;
    const bgColor = (lay as any).bgColor ?? LAYOUT_STYLE_DEFAULTS.bgColor;
    const bgImage = (lay as any).bgImage ?? LAYOUT_STYLE_DEFAULTS.bgImage;
    const updateCanvas = useEditorStore.getState().updateCanvas;
    const updateLayoutSeatRadius = useEditorStore.getState().updateLayoutSeatRadius;
    const updateLayoutStyle = useEditorStore.getState().updateLayoutStyle;
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

          {/* ── Seat Section ── */}
          <CollapsibleSection title="Seat">
            <NumField label="Radius" value={globalSeatRadius} min={2} max={30} disabled={isLocked}
              onChange={(v) => updateLayoutSeatRadius(v)} />
            <ColorField label="Fill Color" value={seatFill} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ seatFill: v })} />
            <ColorField label="Border Color" value={seatStroke} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ seatStroke: v })} />
            <ColorField label="Number Color" value={seatFontColor} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ seatFontColor: v })} />
            <NumField label="Number Size" value={seatFontSize} min={0} max={30} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ seatFontSize: v })} />
            <SelectField label="Number Weight" value={seatFontWeight} disabled={isLocked}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'bold', label: 'Bold' },
              ]}
              onChange={(v) => updateLayoutStyle({ seatFontWeight: v })} />
          </CollapsibleSection>

          {/* ── Row Section ── */}
          <CollapsibleSection title="Row Label">
            <ColorField label="Font Color" value={rowFontColor} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ rowFontColor: v })} />
            <NumField label="Font Size" value={rowFontSize} min={6} max={30} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ rowFontSize: v })} />
            <SelectField label="Font Weight" value={rowFontWeight} disabled={isLocked}
              options={[
                { value: 'normal', label: 'Normal' },
                { value: 'bold', label: 'Bold' },
              ]}
              onChange={(v) => updateLayoutStyle({ rowFontWeight: v })} />
          </CollapsibleSection>

          {/* ── Stage Section ── */}
          <CollapsibleSection title="Stage">
            <NumField label="Canvas Width" value={canvas.w} min={200} max={10000} disabled={isLocked}
              onChange={(v) => updateCanvas({ w: v })} />
            <NumField label="Canvas Height" value={canvas.h} min={200} max={10000} disabled={isLocked}
              onChange={(v) => updateCanvas({ h: v })} />
            <ColorField label="Background Color" value={bgColor} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ bgColor: v })} />
            <ImageUploadField label="Background Image" value={bgImage} disabled={isLocked}
              onChange={(v) => updateLayoutStyle({ bgImage: v })} />
          </CollapsibleSection>
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
