import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonList,
  IonNote,
  IonPage,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/react';
import { useMemo, useState } from 'react';
import { useAllowed } from '@/core/api';
import { foldGerman, t, tn } from '@/core/i18n';
import { Badge, PermissionNote, StateView, useNotify } from '@/core/ui';
import { useListPrefsQuery, useSaveListPrefs } from '../hooks/useListPrefs';
import { useDbManufacturers, useDbMaterials, useSpools } from '../hooks/useSpools';
import { EMPTY_LIST_PREFS, isHidden, setHidden, type ListPrefs } from '../listPrefs';

type Kind = 'brands' | 'materials';
const FIELD: Record<Kind, keyof ListPrefs> = { brands: 'hiddenBrands', materials: 'hiddenMaterials' };

/** Hersteller und Materialien, die man nie kauft, aus den Auswahllisten nehmen (gilt für alle Geräte). */
export function ListsSettingsPage() {
  const [kind, setKind] = useState<Kind>('brands');
  const [query, setQuery] = useState('');
  const prefs = useListPrefsQuery();
  const save = useSaveListPrefs();
  const canEdit = useAllowed('inventory:update');
  const notify = useNotify();
  const stock = useSpools();
  const brands = useDbManufacturers(true);
  const materials = useDbMaterials('', true);
  const current = prefs.data ?? EMPTY_LIST_PREFS;
  const field = FIELD[kind];

  // Alle Einträge (Katalog + eigener Bestand) mit Anzahl eigener Spulen
  const items = useMemo(() => {
    const used = new Map<string, number>();
    for (const s of stock.data ?? []) {
      const v = (kind === 'brands' ? s.brand : s.material)?.trim();
      if (v) used.set(v.toLowerCase(), (used.get(v.toLowerCase()) ?? 0) + 1);
    }
    const names = [...((kind === 'brands' ? brands.data : materials.data) ?? [])];
    for (const s of stock.data ?? []) {
      const v = (kind === 'brands' ? s.brand : s.material)?.trim();
      if (v && !names.some((n) => n.toLowerCase() === v.toLowerCase())) names.push(v);
    }
    return names
      .map((name) => ({ name, used: used.get(name.toLowerCase()) ?? 0 }))
      .sort((a, b) => b.used - a.used || a.name.localeCompare(b.name, 'de'));
  }, [kind, stock.data, brands.data, materials.data]);

  const shown = useMemo(() => {
    const q = foldGerman(query.trim());
    return q ? items.filter((i) => foldGerman(i.name).includes(q)) : items;
  }, [items, query]);
  const hiddenCount = items.filter((i) => isHidden(current[field], i.name)).length;

  const change = (fn: (p: ListPrefs) => ListPrefs) => void save.mutateAsync(fn).catch(notify.fail);
  const toggle = (name: string, visible: boolean) => change((p) => ({ ...p, [field]: setHidden(p[field], name, !visible) }));
  const onlyUsed = () => change((p) => ({ ...p, [field]: items.filter((i) => i.used === 0).map((i) => i.name) }));
  const showAll = () => change((p) => ({ ...p, [field]: [] }));

  const loading = prefs.isPending || stock.isPending || (kind === 'brands' ? brands.isPending : materials.isPending);
  const editable = canEdit && prefs.isSuccess && !save.isPending;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('lists.title')}</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={kind} onIonChange={(e) => (setKind(e.detail.value as Kind), setQuery(''))}>
            <IonSegmentButton value="brands">{t('lists.brands')}</IonSegmentButton>
            <IonSegmentButton value="materials">{t('lists.materials')}</IonSegmentButton>
          </IonSegment>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar value={query} onIonInput={(e) => setQuery(e.detail.value ?? '')} placeholder={t('picker.search')} />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {!canEdit && <PermissionNote />}
        {prefs.isError ? (
          <StateView state="offline" onRetry={() => void prefs.refetch()} />
        ) : loading ? (
          <StateView state="loading" />
        ) : (
          <>
            <IonNote className="bs-section-note" style={{ paddingTop: 'var(--bs-s3)' }}>
              {t('lists.hint')} {hiddenCount > 0 && tn('lists.hiddenCount', hiddenCount)}
            </IonNote>
            <div style={{ display: 'flex', gap: 'var(--bs-s2)', padding: '0 var(--bs-s4)' }}>
              <IonButton size="small" fill="outline" disabled={!editable} onClick={onlyUsed} style={{ margin: 0 }}>
                {t('lists.onlyUsed')}
              </IonButton>
              <IonButton size="small" fill="clear" disabled={!editable || hiddenCount === 0} onClick={showAll} style={{ margin: 0 }}>
                {t('lists.showAll')}
              </IonButton>
            </div>
            <IonList inset>
              {shown.map((i) => (
                <IonItem key={i.name}>
                  <IonToggle
                    checked={!isHidden(current[field], i.name)}
                    disabled={!editable}
                    onIonChange={(e) => toggle(i.name, e.detail.checked)}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--bs-s2)' }}>
                      {i.name}
                      {i.used > 0 && <Badge tone="good">{tn('spools.count', i.used)}</Badge>}
                    </span>
                  </IonToggle>
                </IonItem>
              ))}
              {shown.length === 0 && (
                <IonItem lines="none">
                  <IonNote>{t('state.empty')}</IonNote>
                </IonItem>
              )}
            </IonList>
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
