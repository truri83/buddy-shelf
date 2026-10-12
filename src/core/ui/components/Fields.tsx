import { IonIcon, IonInput, IonItem, IonLabel } from '@ionic/react';
import { useState, type ReactNode } from 'react';

type Tone = 'accent' | 'good' | 'warn' | 'critical' | 'muted';
const toneColor: Record<Tone, string> = {
  accent: 'var(--bs-accent)',
  good: 'var(--bs-good)',
  warn: 'var(--bs-warn)',
  critical: 'var(--bs-critical)',
  muted: 'var(--bs-text-2)',
};

/**
 * Eine Zeile im Formular: Symbol (eingefärbt nach Status) · Beschriftung + Hinweis · Eingabe rechts.
 * Einheitlich für alle Einstellungs- und Bearbeiten-Blätter.
 */
export function FieldRow({
  icon,
  tone = 'accent',
  label,
  hint,
  children,
  lines,
}: {
  icon?: string;
  tone?: Tone;
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
  lines?: 'none' | 'full' | 'inset';
}) {
  return (
    <IonItem lines={lines}>
      {icon && <IonIcon icon={icon} slot="start" aria-hidden style={{ color: toneColor[tone] }} />}
      <IonLabel style={{ whiteSpace: 'normal' }}>
        {label}
        {hint && <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{hint}</div>}
      </IonLabel>
      {children && (
        <div slot="end" style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s1)' }}>
          {children}
        </div>
      )}
    </IonItem>
  );
}

/** Zahl als Text halten, damit „4,“ beim Tippen nicht verschwindet; nach außen: Zahl oder null. */
function toNumber(text: string): number | null {
  const v = text.replace(',', '.').trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Kompakte Zahleneingabe mit Einheit (°C, h, g, ×, Tage) – gleiche Optik überall. */
export function NumberInput({
  value,
  onChange,
  unit,
  placeholder = '–',
  label,
  width = '4.5ch',
  invalid,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit?: string;
  placeholder?: string;
  /** Name für Screenreader */
  label: string;
  width?: string;
  invalid?: boolean;
}) {
  const [state, setState] = useState({ text: value == null ? '' : String(value).replace('.', ','), for: value });
  const text = state.for === value ? state.text : value == null ? '' : String(value).replace('.', ',');
  return (
    <label className={`bs-num-input${invalid ? ' bs-invalid' : ''}`}>
      <input
        aria-label={label}
        inputMode="decimal"
        className="bs-num"
        style={{ width }}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const n = toNumber(e.target.value);
          setState({ text: e.target.value, for: n });
          onChange(n);
        }}
      />
      {unit && <span aria-hidden>{unit}</span>}
    </label>
  );
}

/** Spanne „von – bis“ mit Einheit. */
export function RangeInput({
  value,
  onChange,
  unit,
  label,
}: {
  value: [number | null, number | null];
  onChange: (v: [number | null, number | null]) => void;
  unit: string;
  label: string;
}) {
  const [a, b] = value;
  const invalid = a != null && b != null && b < a;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--bs-s1)' }}>
      <NumberInput label={`${label} ≥`} value={a} onChange={(v) => onChange([v, b])} invalid={invalid} />
      <span aria-hidden style={{ color: 'var(--bs-text-2)' }}>
        –
      </span>
      <NumberInput label={`${label} ≤`} value={b} onChange={(v) => onChange([a, v])} invalid={invalid} />
      <span aria-hidden style={{ color: 'var(--bs-text-2)', minWidth: '2ch' }}>
        {unit}
      </span>
    </span>
  );
}

/** Kleiner Wert mit Symbol für Listenzeilen („🌡 45–55 °C“). */
export function MetaChip({ icon, children, tone = 'muted' }: { icon: string; children: ReactNode; tone?: Tone }) {
  return (
    <span className="bs-meta" style={{ color: tone === 'muted' ? 'var(--bs-text-2)' : toneColor[tone] }}>
      <IonIcon icon={icon} aria-hidden />
      {children}
    </span>
  );
}

/** Texteingabe-Zeile mit Symbol und Beschriftung (gleiches Bild wie FieldRow). */
export function TextRow({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  max,
  lines,
  autofocus,
}: {
  icon?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'date';
  max?: string;
  lines?: 'none' | 'full' | 'inset';
  autofocus?: boolean;
}) {
  return (
    <IonItem lines={lines}>
      {icon && <IonIcon icon={icon} slot="start" aria-hidden style={{ color: 'var(--bs-accent)' }} />}
      <IonInput
        label={label}
        labelPlacement="stacked"
        type={type}
        max={max}
        placeholder={placeholder}
        value={value}
        autofocus={autofocus}
        onIonInput={(e) => onChange(String(e.detail.value ?? ''))}
      />
    </IonItem>
  );
}
