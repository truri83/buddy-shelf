import { IonChip, IonInput } from '@ionic/react';
import { useState, type ComponentProps, type KeyboardEvent } from 'react';

/** Auswahl-Chip, der sich wie ein Knopf verhält (Tastatur, VoiceOver). */
export function ChoiceChip({ selected, onSelect, children, ...rest }: { selected?: boolean; onSelect: () => void } & Omit<ComponentProps<typeof IonChip>, 'onClick'>) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <IonChip
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      outline={!selected}
      color={selected ? 'primary' : undefined}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {children}
    </IonChip>
  );
}

/** „212,5“ / „212.5“ / „212 g“ → Zahl, sonst null. */
export function parseAmount(text: string): number | null {
  const v = text.trim().replace(/\s*g$/i, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(v)) return null;
  return Number(v);
}

/**
 * Zahlenfeld in Gramm: darf leer sein und Komma enthalten, ohne dass der Wert auf 0 springt.
 * Meldet nur gültige Zahlen nach außen; ändert sich der Wert von außen (Chip, Datenbank), wird er übernommen.
 */
export function GramInput({ label, value, onChange, max = 100_000 }: { label: string; value: number; onChange: (n: number) => void; max?: number }) {
  const [state, setState] = useState({ text: String(value), for: value });
  const text = state.for === value ? state.text : String(value);
  const parsed = parseAmount(text);
  const invalid = parsed == null || parsed > max;
  return (
    <IonInput
      label={label}
      labelPlacement="stacked"
      inputmode="decimal"
      className={`bs-num${invalid ? ' ion-invalid ion-touched' : ''}`}
      aria-invalid={invalid}
      value={text}
      onIonInput={(e) => {
        const t = String(e.detail.value ?? '');
        const n = parseAmount(t);
        if (n != null && n <= max) {
          setState({ text: t, for: n });
          onChange(n);
        } else setState({ text: t, for: value });
      }}
    />
  );
}
