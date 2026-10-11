import {
  IonBackButton,
  IonButton,
  IonButtons,
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
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { FilamentEntry, Spool } from '@/core/api';
import { t } from '@/core/i18n';
import { haptic, storage } from '@/core/platform';
import { ChoiceChip, GramInput, PickerSheet, rgbaToCss, StateView, type PickerItem } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import {
  useCatalog,
  useColors,
  useCreateSpools,
  useDbFilaments,
  useDbManufacturers,
  useDbMaterials,
  useLocations,
  useSpool,
  useUpdateSpool,
} from '../hooks/useSpools';
import {
  applyFilament,
  COMMON_MATERIALS,
  draftFromSpool,
  draftToCreate,
  draftToUpdate,
  emptyDraft,
  NET_WEIGHTS,
  parseHex,
  rgbaToHex,
  type SpoolDraft,
  type SpoolKind,
} from '../newSpool';

const REFILL_KEY = 'spools.refillCoreWeight';

/** SP-07/07b: Anlegen (`/spools/new`, Duplizieren `?from=<id>`) und Bearbeiten (`/spools/:id/edit`). */
export function SpoolFormPage() {
  const params = useParams();
  const editId = Number(params.id ?? 0);
  const fromId = Number(new URLSearchParams(useLocation().search).get('from') ?? 0);
  const sourceId = editId || fromId;
  const source = useSpool(sourceId);
  if (sourceId > 0 && !source.data) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/spools" text="" />
            </IonButtons>
            <IonTitle>{editId ? t('edit.title', { id: editId }) : t('new.duplicateOf', { id: fromId })}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {source.isError ? <StateView state="error" onRetry={() => void source.refetch()} /> : <StateView state="loading" />}
        </IonContent>
      </IonPage>
    );
  }
  return <SpoolForm key={`${editId}-${fromId}`} source={source.data} editing={editId > 0} />;
}

function SpoolForm({ source, editing }: { source?: Spool; editing: boolean }) {
  const [draft, setDraft] = useState<SpoolDraft>(() => (source ? draftFromSpool(source) : emptyDraft()));
  const [hexText, setHexText] = useState(() => rgbaToHex(draft.rgba));
  const [picker, setPicker] = useState<'brand' | 'material' | 'filament' | null>(null);
  const [created, setCreated] = useState<Spool[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locations = useLocations();
  const catalog = useCatalog();
  const manufacturers = useDbManufacturers(true);
  const materials = useDbMaterials(draft.brand.trim(), picker === 'material');
  const filaments = useDbFilaments(draft.brand.trim(), draft.material.trim());
  const colors = useColors(draft.brand.trim(), draft.material.trim());
  const create = useCreateSpools();
  const update = useUpdateSpool();
  const navigate = useNavigate();
  const [toast] = useIonToast();

  const set = <K extends keyof SpoolDraft>(k: K, v: SpoolDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setRgba = (rgba: string | null) => {
    setDraft((d) => ({ ...d, rgba }));
    setHexText(rgbaToHex(rgba));
  };
  const hexValid = hexText.trim() === '' || parseHex(hexText) !== null;
  const valid = draft.material.trim().length > 0 && draft.labelWeight > 0 && draft.quantity >= 1 && hexValid;

  const setKind = (kind: SpoolKind) =>
    setDraft((d) => ({
      ...d,
      kind,
      // Refill: gemerkte Mehrwegspule; sonst bleibt der bisherige Wert
      ...(kind === 'refill' ? { coreWeight: storage.get<number>(REFILL_KEY, d.coreWeight), coreCatalogId: null } : {}),
    }));

  const pickFilament = (f: FilamentEntry) => {
    const next = applyFilament(draft, f);
    setDraft(next);
    setHexText(rgbaToHex(next.rgba));
  };

  const save = async () => {
    if (!valid) return;
    setError(null);
    if (draft.kind === 'refill') storage.set(REFILL_KEY, draft.coreWeight);
    try {
      if (editing) {
        if (!source) return;
        await update.mutateAsync({ spoolId: source.id, patch: draftToUpdate(draft, source) });
        haptic();
        void toast({ message: t('edit.saved', { id: source.id }), duration: 2000, position: 'top' });
        navigate(`/spools/${source.id}`, { replace: true });
        return;
      }
      const list = await create.mutateAsync({ spool: draftToCreate(draft), quantity: draft.quantity });
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

  const brandItems: PickerItem[] = useMemo(() => (manufacturers.data ?? []).map((m) => ({ value: m, label: m })), [manufacturers.data]);
  const materialItems: PickerItem[] = useMemo(() => (materials.data ?? []).map((m) => ({ value: m, label: m })), [materials.data]);
  const filamentItems: PickerItem[] = useMemo(
    () =>
      (filaments.data ?? []).map((f) => ({
        value: f.id,
        label: f.name,
        sublabel: [f.weight ? `${f.weight} g` : null, f.spool_weight ? `${t('weigh.coreRow')} ${f.spool_weight} g` : null, f.finish].filter(Boolean).join(' · '),
        color: f.color_hex ? `#${f.color_hex}` : null,
      })),
    [filaments.data],
  );
  const busy = create.isPending || update.isPending;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={source ? `/spools/${source.id}` : '/spools'} text="" />
          </IonButtons>
          <IonTitle>{editing && source ? t('edit.title', { id: source.id }) : source ? t('new.duplicateOf', { id: source.id }) : t('new.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Hersteller + Material als Listen */}
        <IonList inset>
          <IonItem button detail onClick={() => setPicker('brand')}>
            <IonLabel>
              <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{t('new.brand')}</div>
              {draft.brand || <span style={{ color: 'var(--bs-text-2)' }}>{t('new.pickBrand')}</span>}
            </IonLabel>
          </IonItem>
          <IonListHeader>{t('new.material')}</IonListHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', padding: 'var(--bs-s2) var(--bs-s3)' }}>
            {COMMON_MATERIALS.map((m) => (
              <ChoiceChip key={m} selected={draft.material === m} onSelect={() => set('material', m)}>
                {m}
              </ChoiceChip>
            ))}
            {!COMMON_MATERIALS.includes(draft.material as (typeof COMMON_MATERIALS)[number]) && draft.material && (
              <ChoiceChip selected onSelect={() => setPicker('material')}>
                {draft.material}
              </ChoiceChip>
            )}
            <ChoiceChip onSelect={() => setPicker('material')}>{t('new.pickMaterial')} …</ChoiceChip>
          </div>
          <IonItem>
            <IonInput label={t('new.subtype')} labelPlacement="stacked" value={draft.subtype} onIonInput={(e) => set('subtype', String(e.detail.value ?? ''))} />
          </IonItem>
        </IonList>

        {/* Farbe: Datenbank, Bambuddy-Katalog, Hex, Farbwähler */}
        <IonList inset>
          <IonListHeader>{t('new.colorHex')}</IonListHeader>
          {draft.brand && draft.material && (
            <IonItem button detail disabled={!filaments.data?.length} onClick={() => setPicker('filament')}>
              <IonLabel>
                {t('new.pickFilament')}
                <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' }}>
                  {filaments.isError
                    ? t('new.noDb')
                    : t('new.pickFilamentHint', { n: filaments.data?.length ?? 0, brand: draft.brand, material: draft.material })}
                </div>
              </IonLabel>
            </IonItem>
          )}
          {(colors.data ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', padding: 'var(--bs-s2) var(--bs-s3)' }} aria-label={t('new.colorSuggest')}>
              {(colors.data ?? []).slice(0, 24).map((c) => (
                <ChoiceChip
                  key={c.id}
                  selected={draft.colorName === c.color_name}
                  onSelect={() => {
                    set('colorName', c.color_name);
                    setRgba(parseHex(c.hex_color));
                  }}
                >
                  <span aria-hidden style={{ width: 14, height: 14, borderRadius: '50%', background: c.hex_color, border: '1px solid var(--bs-border)', marginRight: 6 }} />
                  {c.color_name}
                </ChoiceChip>
              ))}
            </div>
          )}
          <IonItem>
            <IonInput label={t('new.color')} labelPlacement="stacked" value={draft.colorName} onIonInput={(e) => set('colorName', String(e.detail.value ?? ''))} />
          </IonItem>
          <IonItem>
            <span aria-hidden slot="start" style={{ width: 28, height: 28, borderRadius: '50%', background: rgbaToCss(draft.rgba), border: '2px solid var(--bs-border)' }} />
            <IonInput
              label={t('new.hex')}
              labelPlacement="stacked"
              placeholder="#00AE42"
              value={hexText}
              className="bs-num"
              onIonInput={(e) => {
                const v = String(e.detail.value ?? '');
                setHexText(v);
                const rgba = parseHex(v);
                if (rgba) set('rgba', rgba);
                else if (!v.trim()) set('rgba', null);
              }}
            />
            <input
              type="color"
              aria-label={t('new.colorHex')}
              value={`#${(draft.rgba ?? '888888FF').slice(0, 6)}`}
              onChange={(e) => setRgba(parseHex(e.target.value))}
              style={{ width: 44, height: 36, border: 'none', background: 'none' }}
            />
          </IonItem>
          {!hexValid && (
            <IonNote color="danger" style={{ display: 'block', padding: 'var(--bs-s2) var(--bs-s4)' }}>
              {t('new.hexInvalid')}
            </IonNote>
          )}
        </IonList>

        {/* Netto-Filament + Spule */}
        <IonList inset>
          <IonListHeader>{t('new.labelWeight')}</IonListHeader>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', padding: 'var(--bs-s2) var(--bs-s3)' }}>
            {NET_WEIGHTS.map((w) => (
              <ChoiceChip key={w} selected={draft.labelWeight === w} onSelect={() => set('labelWeight', w)}>
                {w >= 1000 ? `${w / 1000} kg` : `${w} g`}
              </ChoiceChip>
            ))}
          </div>
          <IonItem>
            <GramInput label={t('new.labelWeight')} value={draft.labelWeight} onChange={(n) => set('labelWeight', n)} />
          </IonItem>
          <IonListHeader>{t('new.kind')}</IonListHeader>
          <div style={{ padding: 'var(--bs-s2) var(--bs-s3)' }}>
            <IonSegment value={draft.kind} onIonChange={(e) => setKind(e.detail.value as SpoolKind)}>
              {(['plastic', 'cardboard', 'refill'] as const).map((k) => (
                <IonSegmentButton key={k} value={k}>
                  {t(`new.kind.${k}`)}
                </IonSegmentButton>
              ))}
            </IonSegment>
          </div>
          {draft.kind === 'refill' ? (
            <>
              <IonItem>
                <GramInput label={t('new.refillCore')} value={draft.coreWeight} max={2000} onChange={(n) => set('coreWeight', Math.round(n))} />
              </IonItem>
              <IonNote style={{ display: 'block', padding: 'var(--bs-s2) var(--bs-s4)' }}>{t('new.refillHint')}</IonNote>
            </>
          ) : (
            <>
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
                  <GramInput label={t('new.coreWeightCustom')} value={draft.coreWeight} max={2000} onChange={(n) => set('coreWeight', Math.round(n))} />
                </IonItem>
              )}
            </>
          )}
          {!editing && (
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
          )}
        </IonList>
        {error && (
          <IonNote color="danger" role="alert" style={{ display: 'block', padding: '0 var(--bs-s4) var(--bs-s4)' }}>
            {error}
          </IonNote>
        )}
      </IonContent>

      {/* Daumenzone */}
      <IonFooter>
        <IonToolbar>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)', padding: '0 var(--bs-s3)' }}>
            {!editing && (
              <>
                <IonLabel>{t('new.quantity')}</IonLabel>
                <IonButton fill="outline" size="small" disabled={draft.quantity <= 1} onClick={() => set('quantity', draft.quantity - 1)} aria-label={t('common.less')}>
                  −
                </IonButton>
                <span className="bs-num" style={{ minWidth: 24, textAlign: 'center' }}>
                  {draft.quantity}
                </span>
                <IonButton fill="outline" size="small" disabled={draft.quantity >= 20} onClick={() => set('quantity', draft.quantity + 1)} aria-label={t('common.more')}>
                  +
                </IonButton>
              </>
            )}
            <IonButton style={{ marginLeft: 'auto' }} disabled={!valid || busy} onClick={() => void save()}>
              {editing ? t('common.save') : t('new.save', { n: draft.quantity })}
            </IonButton>
          </div>
        </IonToolbar>
      </IonFooter>

      <PickerSheet
        isOpen={picker === 'brand'}
        title={t('new.brand')}
        items={brandItems}
        value={draft.brand}
        loading={manufacturers.isPending}
        allowCustom
        onSelect={(v) => set('brand', v)}
        onDismiss={() => setPicker(null)}
      />
      <PickerSheet
        isOpen={picker === 'material'}
        title={t('new.material')}
        items={materialItems}
        value={draft.material}
        loading={materials.isPending}
        allowCustom
        onSelect={(v) => set('material', v.toUpperCase())}
        onDismiss={() => setPicker(null)}
      />
      <PickerSheet
        isOpen={picker === 'filament'}
        title={`${draft.brand} · ${draft.material}`}
        items={filamentItems}
        onSelect={(id) => {
          const f = filaments.data?.find((x) => x.id === id);
          if (f) pickFilament(f);
        }}
        onDismiss={() => setPicker(null)}
      />
      <LabelSheet spools={created ?? []} isOpen={!!created} onDismiss={done} />
    </IonPage>
  );
}
