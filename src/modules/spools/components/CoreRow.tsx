import { IonItem, IonLabel, IonNote, IonSegment, IonSegmentButton, useIonToast } from '@ionic/react';
import { useMemo, useState } from 'react';
import type { Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { storage } from '@/core/platform';
import { PickerSheet, type PickerItem } from '@/core/ui';
import { useCatalog, useUpdateSpool } from '../hooks/useSpools';

/** SP-10: Leerspule der Spule anzeigen und mit einem Tipp wechseln (speichert core_weight an der Spule). */
export function CoreRow({ spool, onChanged }: { spool: Spool; onChanged?: (s: Spool) => void }) {
  const catalog = useCatalog();
  const update = useUpdateSpool();
  const [open, setOpen] = useState(false);
  const [toast] = useIonToast();
  const entry = catalog.data?.find((c) => c.id === spool.core_weight_catalog_id);
  const items: PickerItem[] = useMemo(
    () => (catalog.data ?? []).map((c) => ({ value: String(c.id), label: c.name, sublabel: `${c.weight} g` })),
    [catalog.data],
  );

  const choose = async (value: string, item?: PickerItem) => {
    // Katalog nur über das gewählte Element – Freitext (ohne Element) ist ein eigenes Gewicht in g
    const c = item ? catalog.data?.find((x) => String(x.id) === item.value) : undefined;
    const weight = c?.weight ?? Number(value.replace(',', '.').replace(/\s*g$/i, ''));
    if (!Number.isFinite(weight) || weight < 0 || weight > 2000) {
      void toast({ message: t('weigh.coreInvalid'), duration: 2500, position: 'top', color: 'warning' });
      return;
    }
    try {
      const updated = await update.mutateAsync({ spoolId: spool.id, patch: { core_weight: Math.round(weight), core_weight_catalog_id: c?.id ?? null } });
      onChanged?.(updated);
    } catch (e) {
      void toast({ message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }), duration: 3000, position: 'top', color: 'danger' });
    }
  };

  return (
    <>
      <IonItem button detail lines="none" disabled={update.isPending} onClick={() => setOpen(true)} style={{ '--padding-start': '0' } as React.CSSProperties}>
        <IonLabel>
          <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{t('weigh.coreRow')}</div>
          {entry ? `${entry.name} · ${spool.core_weight} g` : t('weigh.coreUnknown', { g: spool.core_weight })}
        </IonLabel>
      </IonItem>
      <PickerSheet
        isOpen={open}
        title={t('weigh.coreRow')}
        items={items}
        value={spool.core_weight_catalog_id != null ? String(spool.core_weight_catalog_id) : null}
        loading={catalog.isPending}
        allowCustom
        onSelect={(v, item) => void choose(v, item)}
        onDismiss={() => setOpen(false)}
      />
    </>
  );
}

export type WeighMode = 'gross' | 'net';
const MODE_KEY = 'spools.weighMode';

/** Brutto (Waage mit Spule) oder Netto (nur Filament) – wird gemerkt. */
export function useWeighMode() {
  const [mode, setMode] = useState<WeighMode>(() => storage.get<WeighMode>(MODE_KEY, 'gross'));
  return [
    mode,
    (m: WeighMode) => {
      setMode(m);
      storage.set(MODE_KEY, m);
    },
  ] as const;
}

export function WeighModeSwitch({ mode, onChange }: { mode: WeighMode; onChange: (m: WeighMode) => void }) {
  return (
    <IonSegment value={mode} onIonChange={(e) => onChange(e.detail.value as WeighMode)}>
      <IonSegmentButton value="gross">{t('weigh.mode.gross')}</IonSegmentButton>
      <IonSegmentButton value="net">{t('weigh.mode.net')}</IonSegmentButton>
    </IonSegment>
  );
}

export function NetHint({ mode, core }: { mode: WeighMode; core: number }) {
  return <IonNote>{mode === 'gross' ? t('weigh.core', { g: core }) : ''}</IonNote>;
}
