import type { ReactNode } from 'react';
import type { Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { ChoiceChip } from '@/core/ui';
import { familyOf, variantOf } from '../logic';

interface Props {
  spools: Spool[];
  family: string | null;
  variant: string | null;
  onChange: (family: string | null, variant: string | null) => void;
  /** weitere Filter-Chips am Ende der Reihe (z. B. „Ohne Etikett“) */
  children?: ReactNode;
}

/** Anzahl je Schlüssel, häufigste zuerst. */
function counts(list: Spool[], key: (s: Spool) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const s of list) m.set(key(s), (m.get(key(s)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'));
}

const row = {
  display: 'flex',
  flexWrap: 'nowrap',
  gap: 'var(--bs-s1)',
  overflowX: 'auto',
  padding: 'var(--bs-s1) var(--bs-s3)',
  scrollbarWidth: 'none',
} as const;

/** Materialfamilie (PLA, PETG …) und darunter die Unterarten (+, 2.0+, Matte …) als Filter. */
export function FamilyFilter({ spools, family, variant, onChange, children }: Props) {
  const active = spools.filter((s) => !s.archived_at);
  const families = counts(active, familyOf);
  const showFamilies = families.length > 1 || !!family;
  if (!showFamilies && !children) return null;
  const variants = family
    ? counts(
        active.filter((s) => familyOf(s) === family),
        variantOf,
      )
    : [];
  return (
    <div role="group" aria-label={t('filter.family')}>
      <div className="bs-chip-row" style={row}>
        {showFamilies && (
          <>
            <ChoiceChip selected={!family} onSelect={() => onChange(null, null)}>
              {t('filter.all')}
            </ChoiceChip>
            {families.map(([f, n]) => (
              <ChoiceChip key={f} selected={family === f} onSelect={() => onChange(family === f ? null : f, null)}>
                {f} · {n}
              </ChoiceChip>
            ))}
          </>
        )}
        {children}
      </div>
      {family && variants.length > 1 && (
        <div className="bs-chip-row" style={row} role="group" aria-label={t('filter.variant')}>
          {variants.map(([v, n]) => (
            <ChoiceChip key={v || '-'} selected={variant === v} onSelect={() => onChange(family, variant === v ? null : v)}>
              {v || t('filter.noVariant')} · {n}
            </ChoiceChip>
          ))}
        </div>
      )}
    </div>
  );
}
