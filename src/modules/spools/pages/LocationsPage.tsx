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
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import { add, albumsOutline, createOutline, locationOutline, pricetagOutline, scanOutline, star, trashOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { ApiError, useAllowed, type Location } from '@/core/api';
import { t, tn } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { LabelPrintSheet, useLabelTemplates, type LabelVariables } from '@/core/printing';
import { encodeLocationCode } from '@/core/qr/codes';
import { ChoiceChip, EditSheet, MetaChip, StateView, TextRow, useNotify } from '@/core/ui';
import { LocationSymbol } from '../components/LocationSymbol';
import { useLocationPrefs, useSaveLocationPrefs } from '../hooks/useLocationPrefs';
import { useCreateLocation, useDeleteLocation, useLocations, useRenameLocation } from '../hooks/useSpools';
import { LOCATION_EMOJIS, symbolOf, withLocation, withoutLocation } from '../locationPrefs';

const vars = (l: Location): LabelVariables => ({ code: encodeLocationCode(l.id), location: l.name });

interface Edit {
  /** fehlt = neuer Lagerort */
  location?: Location;
  name: string;
  icon: string;
  isDefault: boolean;
}

/** SP-17: Lagerorte mit Symbol, Standard-Ort für neue Spulen und Etikett (QR bm:l:<id>) – Scan startet „Einräumen“. */
export function LocationsPage() {
  const locations = useLocations();
  const prefs = useLocationPrefs();
  const savePrefs = useSaveLocationPrefs();
  const create = useCreateLocation();
  const rename = useRenameLocation();
  const remove = useDeleteLocation();
  const canEdit = useAllowed('inventory:update');
  const { templates } = useLabelTemplates('location');
  const [printing, setPrinting] = useState<Location[] | null>(null);
  const [edit, setEdit] = useState<Edit | null>(null);
  const notify = useNotify();
  const [alert] = useIonAlert();
  const list = useMemo(() => [...(locations.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'de')), [locations.data]);
  const records = useMemo(() => (printing ?? []).map(vars), [printing]);

  const fail = (e: unknown) => notify.fail(e, e instanceof ApiError && e.status === 409 ? t('locations.exists') : undefined);

  const editor = (l?: Location) =>
    setEdit(
      l
        ? { location: l, name: l.name, icon: prefs.icons[l.id] ?? '', isDefault: prefs.defaultId === l.id }
        : { name: '', icon: '', isDefault: list.length === 0 },
    );

  const save = async () => {
    const name = edit?.name.trim();
    if (!edit || !name) return false;
    try {
      const l = edit.location ?? (await create.mutateAsync(name));
      if (edit.location && name !== edit.location.name) await rename.mutateAsync({ id: l.id, name });
      const next = withLocation(prefs, l.id, edit.icon, edit.isDefault);
      if (JSON.stringify(next) !== JSON.stringify(prefs)) await savePrefs.mutateAsync(next);
      haptic();
      if (edit.location) notify.ok(t('common.saved'));
      else setPrinting([l]); // neuer Ort: gleich das Etikett anbieten
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  };

  const confirmDelete = () => {
    const l = edit?.location;
    if (!l) return;
    void alert({
      header: t('locations.delete'),
      message: t('locations.deleteQ', { name: l.name }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        {
          text: t('locations.delete'),
          role: 'destructive',
          handler: () =>
            void remove
              .mutateAsync(l.id)
              .then(async () => {
                setEdit(null);
                if (prefs.icons[l.id] || prefs.defaultId === l.id) await savePrefs.mutateAsync(withoutLocation(prefs, l.id));
              })
              .catch(fail),
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
          <IonTitle>{t('locations.title')}</IonTitle>
          {canEdit && (
            <IonButtons slot="end">
              <IonButton onClick={() => editor()} aria-label={t('locations.new')}>
                <IonIcon slot="icon-only" icon={add} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {locations.isPending ? (
          <StateView state="loading" />
        ) : locations.isError ? (
          <StateView state="offline" onRetry={() => void locations.refetch()} />
        ) : list.length === 0 ? (
          <StateView state="empty" message={t('locations.empty')} />
        ) : (
          <>
            <IonNote className="bs-section-note" style={{ paddingTop: 'var(--bs-s4)' }}>
              {t('locations.hint')}
            </IonNote>
            <IonList inset>
              {list.map((l) => (
                <IonItem key={l.id} routerLink={`/spools/stow/${l.id}`} detail={false}>
                  <LocationSymbol icon={prefs.icons[l.id]} slot="start" size={26} />
                  <IonLabel>
                    {l.name}
                    <div className="bs-meta-row">
                      <MetaChip icon={albumsOutline}>{tn('spools.count', l.spool_count)}</MetaChip>
                      {prefs.defaultId === l.id && (
                        <MetaChip icon={star} tone="good">
                          {t('locations.default')}
                        </MetaChip>
                      )}
                      <MetaChip icon={scanOutline} tone="accent">
                        {t('stow.action')}
                      </MetaChip>
                    </div>
                  </IonLabel>
                  <IonButton
                    slot="end"
                    fill="clear"
                    aria-label={t('locations.label', { name: l.name })}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setPrinting([l]);
                    }}
                  >
                    <IonIcon slot="icon-only" icon={pricetagOutline} />
                  </IonButton>
                  {canEdit && (
                    <IonButton
                      slot="end"
                      fill="clear"
                      aria-label={t('locations.edit', { name: l.name })}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        editor(l);
                      }}
                    >
                      <IonIcon slot="icon-only" icon={createOutline} />
                    </IonButton>
                  )}
                </IonItem>
              ))}
            </IonList>
            <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
              <IonButton expand="block" fill="outline" onClick={() => setPrinting(list)}>
                <IonIcon slot="start" icon={pricetagOutline} />
                {t('locations.printAll')}
              </IonButton>
            </div>
          </>
        )}
        <LabelPrintSheet
          templates={templates}
          records={records}
          fileName={(r) => `lagerort-${r.code?.replace(/[^0-9]+/g, '')}.png`}
          storageKey="label.locationTemplate"
          isOpen={!!printing?.length}
          onDismiss={() => setPrinting(null)}
        />
        <EditSheet
          isOpen={!!edit}
          title={edit?.location ? t('locations.editTitle') : t('locations.new')}
          saveDisabled={!edit?.name.trim()}
          busy={create.isPending || rename.isPending || savePrefs.isPending}
          onSave={save}
          onDismiss={() => setEdit(null)}
        >
          {edit && (
            <>
              <IonList inset>
                <TextRow
                  icon={locationOutline}
                  label={t('locations.name')}
                  value={edit.name}
                  onChange={(name) => setEdit({ ...edit, name })}
                  autofocus={!edit.location}
                />
              </IonList>

              <IonList inset>
                <IonListHeader>
                  <IonLabel>{t('locations.symbol')}</IonLabel>
                </IonListHeader>
                <div className="bs-chip-row" style={{ padding: '0 var(--bs-s3) var(--bs-s2)', flexWrap: 'wrap' }}>
                  <ChoiceChip selected={!edit.icon} onSelect={() => setEdit({ ...edit, icon: '' })} aria-label={t('locations.symbolNone')}>
                    <IonIcon icon={locationOutline} aria-hidden />
                  </ChoiceChip>
                  {LOCATION_EMOJIS.map((e) => (
                    <ChoiceChip key={e} selected={edit.icon === e} onSelect={() => setEdit({ ...edit, icon: e })} aria-label={e}>
                      <span style={{ fontSize: 18, lineHeight: 1 }}>{e}</span>
                    </ChoiceChip>
                  ))}
                </div>
                <TextRow
                  label={t('locations.symbolOwn')}
                  placeholder={t('locations.symbolOwnHint')}
                  value={(LOCATION_EMOJIS as readonly string[]).includes(edit.icon) ? '' : edit.icon}
                  onChange={(v) => setEdit({ ...edit, icon: symbolOf(v) })}
                  lines="none"
                />
              </IonList>

              <IonList inset>
                <IonItem lines="none">
                  <IonIcon icon={star} slot="start" color={edit.isDefault ? 'success' : 'medium'} aria-hidden />
                  <IonToggle checked={edit.isDefault} onIonChange={(e) => setEdit({ ...edit, isDefault: e.detail.checked })}>
                    {t('locations.asDefault')}
                    <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' }}>
                      {t('locations.asDefaultHint')}
                    </div>
                  </IonToggle>
                </IonItem>
              </IonList>

              {!edit.location && <IonNote className="bs-section-note">{t('locations.newHint')}</IonNote>}
              {edit.location && (
                <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
                  <IonButton
                    expand="block"
                    fill="outline"
                    color="danger"
                    disabled={edit.location.spool_count > 0 || remove.isPending}
                    onClick={confirmDelete}
                  >
                    <IonIcon slot="start" icon={trashOutline} />
                    {t('locations.delete')}
                  </IonButton>
                  {edit.location.spool_count > 0 && (
                    <IonNote className="bs-section-note" style={{ padding: 'var(--bs-s2) 0 0' }}>
                      {tn('locations.deleteBlocked', edit.location.spool_count)}
                    </IonNote>
                  )}
                </div>
              )}
            </>
          )}
        </EditSheet>
      </IonContent>
    </IonPage>
  );
}
