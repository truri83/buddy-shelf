import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
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
import {
  add,
  alertCircleOutline,
  cashOutline,
  colorPaletteOutline,
  discOutline,
  sunnyOutline,
  trashOutline,
  warningOutline,
} from 'ionicons/icons';
import { useState } from 'react';
import { useAllowed } from '@/core/api';
import { FAMILIES, thresholdsValid, useDisplayConfig, useSaveDisplayConfig, type DisplayConfig, type StockLevel } from '@/core/filament';
import { fmtNum, t } from '@/core/i18n';
import { ChoiceChip, EditSheet, FieldRow, FillBar, MaterialBadge, MetaChip, NumberInput, PermissionNote, useNotify } from '@/core/ui';

/** Entwurf: Zahlen dürfen beim Tippen kurz leer sein. */
type Draft = Omit<DisplayConfig, 'lowPct' | 'emptyPct' | 'defaultWeight'> & {
  lowPct: number | null;
  emptyPct: number | null;
  defaultWeight: number | null;
};

interface FamilyDraft {
  fam: string;
  isNew: boolean;
  lowPct: number | null;
  emptyPct: number | null;
}

const SIZES = [250, 500, 750, 1000, 2000, 3000];

const draftValid = (d: Draft) => thresholdsValid(d) && d.defaultWeight != null && d.defaultWeight > 0 && d.defaultWeight <= 10000;

/** Vorschau-Füllstände, die zu den Schwellen passen: einer je Stufe. */
function samples(low: number, empty: number): { level: StockLevel; pct: number }[] {
  return [
    { level: 'ok', pct: Math.min(100, Math.max(low + 20, 60)) },
    { level: 'low', pct: Math.round((low + empty) / 2) },
    { level: 'empty', pct: Math.max(1, Math.round(empty / 2)) },
  ];
}

/** Spulen-Anzeige: Warnschwellen (auch je Material), Signalfarben, Standard-Spulengröße, was Karten zeigen. */
export function DisplaySettingsPage() {
  const saved = useDisplayConfig();
  const save = useSaveDisplayConfig();
  const canEdit = useAllowed('inventory:update');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<FamilyDraft | null>(null);
  const cfg: Draft = draft ?? saved;
  const [alert] = useIonAlert();
  const notify = useNotify();
  const families = Object.keys(cfg.materials).sort((a, b) => FAMILIES.indexOf(a as never) - FAMILIES.indexOf(b as never));
  const missing = FAMILIES.filter((f) => !cfg.materials[f]);
  const thresholdsOk = thresholdsValid(cfg);

  const change = (patch: Partial<Draft>) => canEdit && setDraft({ ...structuredClone(cfg), ...patch });

  const openFamily = (fam: string | null) => {
    const row = fam ? cfg.materials[fam] : undefined;
    setEditing({
      fam: fam ?? missing[0] ?? '',
      isNew: !fam,
      lowPct: row?.lowPct ?? cfg.lowPct,
      emptyPct: row?.emptyPct ?? cfg.emptyPct,
    });
  };
  const applyFamily = () => {
    if (!editing || !thresholdsValid(editing)) return false;
    change({ materials: { ...cfg.materials, [editing.fam]: { lowPct: editing.lowPct!, emptyPct: editing.emptyPct! } } });
    return true;
  };
  const removeFamily = () => {
    if (!editing) return;
    const materials = { ...cfg.materials };
    delete materials[editing.fam];
    change({ materials });
    setEditing(null);
  };

  const persist = (value: DisplayConfig | null) =>
    save
      .mutateAsync(value)
      .then(() => {
        setDraft(null);
        notify.ok(t('common.saved'));
      })
      .catch(notify.fail);

  const reset = () =>
    void alert({
      header: t('drySet.reset'),
      message: t('display.resetQ'),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('drySet.reset'), role: 'destructive', handler: () => void persist(null) },
      ],
    });

  const preview = samples(cfg.lowPct ?? saved.lowPct, cfg.emptyPct ?? saved.emptyPct);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('display.title')}</IonTitle>
          {canEdit && (
            <IonButtons slot="end">
              <IonButton onClick={reset}>{t('drySet.reset')}</IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {!canEdit && <PermissionNote />}

        {/* Vorschau: so sehen Balken mit den aktuellen Schwellen aus */}
        <IonList inset>
          <IonListHeader>{t('display.preview')}</IonListHeader>
          <div style={{ display: 'grid', gap: 'var(--bs-s3)', padding: 'var(--bs-s2) var(--bs-s4) var(--bs-s4)' }}>
            {preview.map((p) => (
              <div
                key={p.level}
                style={{ display: 'grid', gridTemplateColumns: '6.5em 1fr 3.5em', alignItems: 'center', gap: 'var(--bs-s3)' }}
              >
                <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)' }}>{t(`display.level.${p.level}`)}</span>
                <FillBar fill={p.pct / 100} level={p.level} signal={cfg.signalColors} height={8} />
                <span className="bs-num" style={{ fontSize: 'var(--bs-fs-caption)', textAlign: 'right' }}>
                  {p.pct} %
                </span>
              </div>
            ))}
          </div>
        </IonList>

        <IonList inset>
          <IonListHeader>{t('display.thresholds')}</IonListHeader>
          <FieldRow icon={warningOutline} tone="warn" label={t('display.low')} hint={t('display.lowHint')}>
            <NumberInput
              label={t('display.low')}
              unit="%"
              value={cfg.lowPct}
              invalid={!thresholdsOk}
              onChange={(lowPct) => change({ lowPct })}
            />
          </FieldRow>
          <FieldRow icon={alertCircleOutline} tone="critical" label={t('display.empty')} hint={t('display.emptyHint')} lines="none">
            <NumberInput
              label={t('display.empty')}
              unit="%"
              value={cfg.emptyPct}
              invalid={!thresholdsOk}
              onChange={(emptyPct) => change({ emptyPct })}
            />
          </FieldRow>
        </IonList>
        <IonNote className="bs-section-note" color={thresholdsOk ? undefined : 'danger'}>
          {thresholdsOk ? t('display.thresholdsHint') : t('display.invalid')}
        </IonNote>

        <IonList inset>
          <IonListHeader>{t('display.families')}</IonListHeader>
          {families.map((fam) => {
            const r = cfg.materials[fam]!;
            return (
              <IonItem key={fam} button={canEdit} detail={canEdit} onClick={() => canEdit && openFamily(fam)}>
                <IonLabel>
                  <MaterialBadge material={fam} />
                  <div className="bs-meta-row">
                    <MetaChip icon={warningOutline} tone="warn">
                      {t('display.lowShort', { n: r.lowPct })}
                    </MetaChip>
                    <MetaChip icon={alertCircleOutline} tone="critical">
                      {t('display.emptyShort', { n: r.emptyPct })}
                    </MetaChip>
                  </div>
                </IonLabel>
              </IonItem>
            );
          })}
          {canEdit && missing.length > 0 && (
            <IonItem button detail={false} lines="none" onClick={() => openFamily(null)}>
              <IonIcon icon={add} slot="start" color="primary" aria-hidden />
              <IonLabel color="primary">{t('display.addFamily')}</IonLabel>
            </IonItem>
          )}
        </IonList>
        <IonNote className="bs-section-note">{t('display.familiesHint')}</IonNote>

        <IonList inset>
          <IonListHeader>{t('display.cards')}</IonListHeader>
          <IonItem>
            <IonIcon icon={colorPaletteOutline} slot="start" color="primary" aria-hidden />
            <IonToggle checked={cfg.signalColors} disabled={!canEdit} onIonChange={(e) => change({ signalColors: e.detail.checked })}>
              {t('display.signal')}
              <div style={sub}>{t('display.signalHint')}</div>
            </IonToggle>
          </IonItem>
          <IonItem>
            <IonIcon icon={cashOutline} slot="start" color="primary" aria-hidden />
            <IonToggle checked={cfg.showPrice} disabled={!canEdit} onIonChange={(e) => change({ showPrice: e.detail.checked })}>
              {t('display.price')}
              <div style={sub}>{t('display.priceHint')}</div>
            </IonToggle>
          </IonItem>
          <IonItem lines="none">
            <IonIcon icon={sunnyOutline} slot="start" color="primary" aria-hidden />
            <IonToggle checked={cfg.showDrying} disabled={!canEdit} onIonChange={(e) => change({ showDrying: e.detail.checked })}>
              {t('display.drying')}
              <div style={sub}>{t('display.dryingHint')}</div>
            </IonToggle>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader>{t('display.newSpools')}</IonListHeader>
          <FieldRow icon={discOutline} label={t('display.defaultWeight')} hint={t('display.defaultWeightHint')}>
            <NumberInput
              label={t('display.defaultWeight')}
              unit="g"
              width="5.5ch"
              value={cfg.defaultWeight}
              invalid={!(cfg.defaultWeight != null && cfg.defaultWeight > 0 && cfg.defaultWeight <= 10000)}
              onChange={(defaultWeight) => change({ defaultWeight })}
            />
          </FieldRow>
          <div className="bs-chip-row" style={{ padding: 'var(--bs-s1) var(--bs-s3) var(--bs-s3)', flexWrap: 'wrap' }}>
            {SIZES.map((g) => (
              <ChoiceChip key={g} selected={cfg.defaultWeight === g} onSelect={() => change({ defaultWeight: g })} disabled={!canEdit}>
                {g >= 1000 ? `${fmtNum(g / 1000)} kg` : `${g} g`}
              </ChoiceChip>
            ))}
          </div>
        </IonList>

        <EditSheet
          isOpen={!!editing}
          title={editing?.isNew ? t('display.addFamily') : (editing?.fam ?? '')}
          saveDisabled={!editing || !thresholdsValid(editing)}
          onSave={applyFamily}
          onDismiss={() => setEditing(null)}
        >
          {editing && (
            <>
              {editing.isNew && (
                <div className="bs-chip-row" style={{ padding: 'var(--bs-s3) var(--bs-s4) 0' }}>
                  {missing.map((f) => (
                    <ChoiceChip key={f} selected={editing.fam === f} onSelect={() => setEditing({ ...editing, fam: f })}>
                      {f}
                    </ChoiceChip>
                  ))}
                </div>
              )}
              <IonList inset>
                <FieldRow icon={warningOutline} tone="warn" label={t('display.low')}>
                  <NumberInput
                    label={t('display.low')}
                    unit="%"
                    value={editing.lowPct}
                    invalid={!thresholdsValid(editing)}
                    onChange={(lowPct) => setEditing({ ...editing, lowPct })}
                  />
                </FieldRow>
                <FieldRow icon={alertCircleOutline} tone="critical" label={t('display.empty')} lines="none">
                  <NumberInput
                    label={t('display.empty')}
                    unit="%"
                    value={editing.emptyPct}
                    invalid={!thresholdsValid(editing)}
                    onChange={(emptyPct) => setEditing({ ...editing, emptyPct })}
                  />
                </FieldRow>
              </IonList>
              <IonNote className="bs-section-note" color={thresholdsValid(editing) ? undefined : 'danger'}>
                {thresholdsValid(editing) ? t('display.familiesHint') : t('display.invalid')}
              </IonNote>
              {!editing.isNew && (
                <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
                  <IonButton expand="block" fill="outline" color="danger" onClick={removeFamily}>
                    <IonIcon slot="start" icon={trashOutline} />
                    {t('display.removeFamily')}
                  </IonButton>
                </div>
              )}
            </>
          )}
        </EditSheet>
      </IonContent>
      {draft && (
        <IonFooter>
          <IonToolbar>
            <div style={{ display: 'flex', gap: 'var(--bs-s2)', padding: 'var(--bs-s2) var(--bs-s3)' }}>
              <IonButton fill="outline" onClick={() => setDraft(null)} style={{ margin: 0 }}>
                {t('common.cancel')}
              </IonButton>
              <IonButton
                expand="block"
                disabled={save.isPending || !draftValid(draft)}
                onClick={() => void persist(draft as DisplayConfig)}
                style={{ flex: 1, margin: 0 }}
              >
                {t('common.save')}
              </IonButton>
            </div>
          </IonToolbar>
        </IonFooter>
      )}
    </IonPage>
  );
}

const sub = { color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' } as const;
