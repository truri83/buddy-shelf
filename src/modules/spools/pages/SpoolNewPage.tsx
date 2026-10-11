import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { Spool, SpoolCreate } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic } from '@/core/platform';
import { rgbaToCss } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import { useCatalog, useColors, useCreateSpools, useLocations, useSpool } from '../hooks/useSpools';
import { COMMON_MATERIALS, draftFromSpool, draftToCreate, emptyDraft, type SpoolDraft } from '../newSpool';

/** SP-07: Spule anlegen oder duplizieren (`?from=<id>`), Anzahl 1–20, danach Etiketten drucken. */
export function SpoolNewPage() {
  const fromId = Number(new URLSearchParams(useLocation().search).get('from') ?? 0);
  const source = useSpool(fromId);
  return source.isPending && fromId > 0 ? null : <SpoolForm key={fromId} source={source.data} />;
}

function SpoolForm({ source }: { source?: Spool }) {
  const [draft, setDraft] = useState<SpoolDraft>(() => (source ? draftFromSpool(source) : emptyDraft()));
  const [created, setCreated] = useState<Spool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locations = useLocations();
  const catalog = useCatalog();
  const colors = useColors(draft.brand.trim(), draft.material.trim());
  const create = useCreateSpools();
  const navigate = useNavigate();
  const [toast] = useIonToast();

  const set = <K extends keyof SpoolDraft>(k: K, v: SpoolDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = draft.material.trim().length > 0 && draft.labelWeight > 0 && draft.quantity >= 1;

  const save = async () => {
    if (!valid) return;
    setError(null);
    try {
      const spool: SpoolCreate = draftToCreate(draft);
      const list = await create.mutateAsync({ spool, quantity: draft.quantity });
      haptic();
      void toast({ message: t('new.created', { n: list.length }), duration: 2000, position: 'top' });
      setCreated(list);
    } catch (e) {
      setError(t('common.failed', { msg: e instanceof Error ? e.message : String(e) }));
    }
  };

  const done = () => {
    const list = created ?? [];
    setCreated(null);
    navigate(list.length === 1 ? `/spools/${list[0]!.id}` : '/spools', { replace: true });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/spools" text="" />
          </IonButtons>
          <IonTitle>{source ? t('new.duplicateOf', { id: source.id }) : t('new.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          <IonListHeader>{t('new.material')}</IonListHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', padding: 'var(--bs-s2) var(--bs-s3)' }}>
            {COMMON_MATERIALS.map((m) => (
              <IonChip key={m} outline={draft.material !== m} color={draft.material === m ? 'primary' : undefined} onClick={() => set('material', m)}>
                {m}
              </IonChip>
            ))}
          </div>
          <IonItem>
            <IonInput label={t('new.material')} labelPlacement="stacked" value={draft.material} onIonInput={(e) => set('material', String(e.detail.value ?? '').toUpperCase())} />
          </IonItem>
          <IonItem>
            <IonInput label={t('new.subtype')} labelPlacement="stacked" value={draft.subtype} onIonInput={(e) => set('subtype', String(e.detail.value ?? ''))} />
          </IonItem>
          <IonItem>
            <IonInput label={t('new.brand')} labelPlacement="stacked" value={draft.brand} onIonInput={(e) => set('brand', String(e.detail.value ?? ''))} />
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader>{t('new.colorHex')}</IonListHeader>
          {(colors.data ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', padding: 'var(--bs-s2) var(--bs-s3)' }} aria-label={t('new.colorSuggest')}>
              {(colors.data ?? []).slice(0, 24).map((c) => (
                <IonChip
                  key={c.id}
                  outline={draft.colorName !== c.color_name}
                  onClick={() => setDraft((d) => ({ ...d, colorName: c.color_name, rgba: `${c.hex_color.replace('#', '').toUpperCase()}FF` }))}
                >
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: c.hex_color, border: '1px solid var(--bs-border)', marginRight: 6 }} />
                  {c.color_name}
                </IonChip>
              ))}
            </div>
          )}
          <IonItem>
            <span aria-hidden slot="start" style={{ width: 22, height: 22, borderRadius: '50%', background: rgbaToCss(draft.rgba), border: '2px solid var(--bs-border)' }} />
            <IonInput label={t('new.color')} labelPlacement="stacked" value={draft.colorName} onIonInput={(e) => set('colorName', String(e.detail.value ?? ''))} />
            <input
              type="color"
              aria-label={t('new.colorHex')}
              value={`#${(draft.rgba ?? '888888FF').slice(0, 6)}`}
              onChange={(e) => set('rgba', `${e.target.value.replace('#', '').toUpperCase()}FF`)}
              style={{ width: 40, height: 32, border: 'none', background: 'none' }}
            />
          </IonItem>
        </IonList>

        <IonList inset>
          <IonItem>
            <IonInput
              label={t('new.labelWeight')}
              labelPlacement="stacked"
              inputmode="numeric"
              value={String(draft.labelWeight)}
              onIonInput={(e) => set('labelWeight', Number(e.detail.value) || 0)}
              className="bs-num"
            />
          </IonItem>
          <IonItem>
            <IonSelect
              label={t('new.coreWeight')}
              labelPlacement="stacked"
              interface="action-sheet"
              value={draft.coreCatalogId ?? 'custom'}
              onIonChange={(e) => {
                const id = e.detail.value as number | 'custom';
                const entry = catalog.data?.find((c) => c.id === id);
                setDraft((d) => ({ ...d, coreCatalogId: entry?.id ?? null, coreWeight: entry?.weight ?? d.coreWeight }));
              }}
            >
              {(catalog.data ?? []).map((c) => (
                <IonSelectOption key={c.id} value={c.id}>
                  {c.name} · {c.weight} g
                </IonSelectOption>
              ))}
              <IonSelectOption value="custom">{t('new.coreWeightCustom')}</IonSelectOption>
            </IonSelect>
          </IonItem>
          {draft.coreCatalogId == null && (
            <IonItem>
              <IonInput
                label={t('new.coreWeightCustom')}
                labelPlacement="stacked"
                inputmode="numeric"
                value={String(draft.coreWeight)}
                onIonInput={(e) => set('coreWeight', Number(e.detail.value) || 0)}
                className="bs-num"
              />
            </IonItem>
          )}
          <IonItem>
            <IonSelect
              label={t('new.location')}
              labelPlacement="stacked"
              interface="action-sheet"
              value={draft.locationId ?? 0}
              onIonChange={(e) => set('locationId', Number(e.detail.value) || null)}
            >
              <IonSelectOption value={0}>{t('move.none')}</IonSelectOption>
              {(locations.data ?? []).map((l) => (
                <IonSelectOption key={l.id} value={l.id}>
                  {l.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>
        </IonList>
        {error && (
          <IonNote color="danger" role="alert" style={{ display: 'block', padding: '0 var(--bs-s4)' }}>
            {error}
          </IonNote>
        )}
      </IonContent>

      {/* Daumenzone: Anzahl + Anlegen */}
      <IonFooter>
        <IonToolbar>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)', padding: '0 var(--bs-s3)' }}>
            <IonLabel>{t('new.quantity')}</IonLabel>
            <IonButton fill="outline" size="small" disabled={draft.quantity <= 1} onClick={() => set('quantity', draft.quantity - 1)} aria-label="−">
              −
            </IonButton>
            <span className="bs-num" style={{ minWidth: 24, textAlign: 'center' }}>
              {draft.quantity}
            </span>
            <IonButton fill="outline" size="small" disabled={draft.quantity >= 20} onClick={() => set('quantity', draft.quantity + 1)} aria-label="+">
              +
            </IonButton>
            <IonButton style={{ marginLeft: 'auto' }} disabled={!valid || create.isPending} onClick={() => void save()}>
              {t('new.save', { n: draft.quantity })}
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>
      <LabelSheet spools={created ?? []} isOpen={!!created} onDismiss={done} />
    </IonPage>
  );
}
