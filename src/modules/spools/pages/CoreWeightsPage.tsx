import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import { add, cubeOutline, discOutline, scaleOutline, sparklesOutline, trashOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { useAllowed, type CatalogEntry } from '@/core/api';
import { fmtNum, t, tn } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { EditSheet, FieldRow, NumberInput, StateView, TextRow, useNotify } from '@/core/ui';
import { coreDisplayName, coreSuggestions, groupCores } from '../cores';
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
  const notify = useNotify();

  const groups = useMemo(() => {
    const q = query.toLowerCase();
    const list = (catalog.data ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
    return groupCores(list, spools.data ?? []);
  }, [catalog.data, spools.data, query]);
  const suggestions = useMemo(() => {
    const q = query.toLowerCase();
    return coreSuggestions(db.data ?? [], catalog.data ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  }, [db.data, catalog.data, query]);

  // Bearbeiten-Blatt: neu (id undefined) oder bestehender Eintrag
  const [edit, setEdit] = useState<{ id?: number; name: string; weight: number | null } | null>(null);
  const editValid = !!edit && edit.name.trim().length > 0 && edit.weight != null && edit.weight > 0 && edit.weight < 2000;
  const editor = (entry?: CatalogEntry) =>
    setEdit(entry ? { id: entry.id, name: entry.name, weight: entry.weight } : { name: '', weight: null });
  const saveEdit = async () => {
    if (!edit || !editValid) return false;
    const e = { name: edit.name.trim(), weight: Math.round(edit.weight!) };
    try {
      await (edit.id ? m.update.mutateAsync({ id: edit.id, ...e }) : m.add.mutateAsync(e));
      haptic();
      notify.ok(t('common.saved'));
      return true;
    } catch (err) {
      notify.fail(err);
      return false;
    }
  };
  const confirmDelete = () => {
    if (!edit?.id) return;
    const id = edit.id;
    void alert({
      header: t('cores.delete'),
      message: t('cores.deleteQ', { name: edit.name }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('cores.delete'),
          role: 'destructive',
          handler: () =>
            void m.remove
              .mutateAsync(id)
              .then(() => setEdit(null))
              .catch(notify.fail),
        },
      ],
    });
  };

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
            {groups.map((g) => (
              <IonList inset key={g.maker}>
                <IonListHeader>
                  <IonLabel>{g.maker}</IonLabel>
                </IonListHeader>
                {g.entries.map((c) => (
                  <IonItem key={c.id} button={canEdit} detail={canEdit} onClick={() => canEdit && editor(c)}>
                    <IonIcon icon={/cardboard|pappe/i.test(c.name) ? cubeOutline : discOutline} slot="start" color="primary" aria-hidden />
                    <IonLabel>
                      {coreDisplayName(c.name)}
                      {c.used > 0 && (
                        <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{tn('cores.used', c.used)}</div>
                      )}
                    </IonLabel>
                    <IonNote slot="end" className="bs-num">
                      {fmtNum(c.weight)} g
                    </IonNote>
                  </IonItem>
                ))}
              </IonList>
            ))}
            {canEdit && suggestions.length > 0 && (
              <IonList inset>
                <IonListHeader>
                  <IonLabel>
                    {t('cores.suggest')}
                    <div
                      style={{
                        fontSize: 'var(--bs-fs-caption)',
                        fontWeight: 400,
                        textTransform: 'none',
                        letterSpacing: 0,
                        whiteSpace: 'normal',
                      }}
                    >
                      {t('cores.suggestHint')}
                    </div>
                  </IonLabel>
                </IonListHeader>
                {suggestions.map((s) => (
                  <IonItem key={s.name}>
                    <IonIcon icon={sparklesOutline} slot="start" color="medium" aria-hidden />
                    <IonLabel>{coreDisplayName(s.name)}</IonLabel>
                    <IonNote slot="end" className="bs-num">
                      {fmtNum(s.weight)} g
                    </IonNote>
                    <IonButton
                      slot="end"
                      size="small"
                      fill="clear"
                      disabled={m.add.isPending}
                      onClick={() =>
                        void m.add
                          .mutateAsync({ name: s.name, weight: s.weight })
                          .then(() => (haptic(), notify.ok(t('common.saved'))))
                          .catch(notify.fail)
                      }
                    >
                      {t('cores.add')}
                    </IonButton>
                  </IonItem>
                ))}
              </IonList>
            )}
          </>
        )}
        <EditSheet
          isOpen={!!edit}
          title={edit?.id ? t('cores.edit') : t('cores.new')}
          saveDisabled={!editValid}
          busy={m.add.isPending || m.update.isPending}
          onSave={saveEdit}
          onDismiss={() => setEdit(null)}
        >
          {edit && (
            <>
              <IonList inset>
                <TextRow
                  icon={discOutline}
                  label={t('cores.name')}
                  placeholder={t('cores.namePlaceholder')}
                  value={edit.name}
                  onChange={(name) => setEdit({ ...edit, name })}
                />
                <FieldRow icon={scaleOutline} label={t('cores.weight')} lines="none">
                  <NumberInput label={t('cores.weight')} unit="g" value={edit.weight} onChange={(weight) => setEdit({ ...edit, weight })} />
                </FieldRow>
              </IonList>
              {edit.id && (
                <div style={{ padding: '0 var(--bs-s4)' }}>
                  <IonButton expand="block" fill="outline" color="danger" onClick={confirmDelete}>
                    <IonIcon slot="start" icon={trashOutline} />
                    {t('cores.delete')}
                  </IonButton>
                </div>
              )}
            </>
          )}
        </EditSheet>
      </IonContent>
    </IonPage>
  );
}
