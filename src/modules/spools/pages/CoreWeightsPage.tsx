import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { add } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useAllowed, type CatalogEntry } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { StateView } from '@/core/ui';
import { coreSuggestions, groupCores } from '../cores';
import { useCatalog, useCatalogMutations, useDbSpoolWeights, useSpools } from '../hooks/useSpools';

/** SP-10: Leerspulen-Gewichte pflegen (Bambuddy-Katalog) + Vorschläge aus der Filament-Datenbank. */
export function CoreWeightsPage() {
  const catalog = useCatalog();
  const spools = useSpools();
  const db = useDbSpoolWeights(true);
  const m = useCatalogMutations();
  const canEdit = useAllowed('inventory:update');
  const [query, setQuery] = useState('');
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const fail = (e: unknown) =>
    void toast({ message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }), duration: 3000, position: 'top', color: 'danger' });

  const groups = useMemo(() => {
    const q = query.toLowerCase();
    const list = (catalog.data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
    return groupCores(list, spools.data ?? []);
  }, [catalog.data, spools.data, query]);
  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    return coreSuggestions(db.data ?? [], catalog.data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [db.data, catalog.data, query]);

  const valid = (name: string, weight: string) => name.trim().length > 0 && Number(weight) > 0 && Number(weight) < 2000;

  const editor = (entry?: CatalogEntry) =>
    void alert({
      header: entry ? t('cores.edit') : t('cores.new'),
      inputs: [
        { name: 'name', type: 'text', placeholder: t('cores.name'), value: entry?.name ?? '' },
        { name: 'weight', type: 'number', placeholder: t('cores.weight'), value: entry?.weight ?? '', min: 1, max: 2000 },
      ],
      buttons: [
        ...(entry
          ? [
              {
                text: t('cores.delete'),
                role: 'destructive',
                handler: () => {
                  void alert({
                    header: t('cores.delete'),
                    message: t('cores.deleteQ', { name: entry.name }),
                    buttons: [
                      { text: t('common.cancel'), role: 'cancel' },
                      { text: t('cores.delete'), role: 'destructive', handler: () => void m.remove.mutateAsync(entry.id).catch(fail) },
                    ],
                  });
                },
              },
            ]
          : []),
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('common.save'),
          handler: (v: { name: string; weight: string }) => {
            if (!valid(v.name, v.weight)) return false;
            const e = { name: v.name.trim(), weight: Math.round(Number(v.weight)) };
            void (entry ? m.update.mutateAsync({ id: entry.id, ...e }) : m.add.mutateAsync(e)).then(() => haptic()).catch(fail);
            return true;
          },
        },
      ],
    });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('cores.title')}</IonTitle>
          {canEdit && (
            <IonButtons slot="end">
              <IonButton onClick={() => editor()} aria-label={t('cores.new')}>
                <IonIcon slot="icon-only" icon={add} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar value={query} onIonInput={(e) => setQuery(e.detail.value ?? '')} placeholder={t('picker.search')} />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {catalog.isPending ? (
          <StateView state="loading" />
        ) : catalog.isError ? (
          <StateView state="offline" onRetry={() => void catalog.refetch()} />
        ) : (
          <>
            <IonList>
              {groups.map((g) => (
                <div key={g.maker}>
                  <IonItemDivider sticky>
                    <IonLabel>{g.maker}</IonLabel>
                  </IonItemDivider>
                  {g.entries.map((c) => (
                    <IonItem key={c.id} button={canEdit} detail={false} onClick={() => canEdit && editor(c)}>
                      <IonLabel>
                        {c.name}
                        {c.used > 0 && <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{t('cores.used', { n: c.used })}</div>}
                      </IonLabel>
                      <IonNote slot="end" className="bs-num">
                        {c.weight} g
                      </IonNote>
                    </IonItem>
                  ))}
                </div>
              ))}
            </IonList>
            {canEdit && suggestions.length > 0 && (
              <IonList inset>
                <IonItemDivider>
                  <IonLabel>
                    {t('cores.suggest')}
                    <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' }}>{t('cores.suggestHint')}</div>
                  </IonLabel>
                </IonItemDivider>
                {suggestions.map((s) => (
                  <IonItem key={s.name}>
                    <IonLabel>{s.name}</IonLabel>
                    <IonNote slot="end" className="bs-num">
                      {s.weight} g
                    </IonNote>
                    <IonButton
                      slot="end"
                      size="small"
                      fill="clear"
                      disabled={m.add.isPending}
                      onClick={() => void m.add.mutateAsync({ name: s.name, weight: s.weight }).then(() => haptic()).catch(fail)}
                    >
                      {t('cores.add')}
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            )}
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
