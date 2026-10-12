import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { barcodeOutline, cartOutline, checkmark, colorPaletteOutline, documentTextOutline, sunnyOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAllowed, type FilamentEntry, type GtinHit, type Spool } from '@/core/api';
import { colorSearchText, fmtDate, fmtNum, otherLanguageName, t, tn } from '@/core/i18n';
import { BARCODES_ONLY, haptic, storage } from '@/core/platform';
import { parseScan } from '@/core/qr/codes';
import { ChoiceChip, ColorRing, FillBar, GramInput, PickerSheet, rgbaToCss, ScannerView, StateView, type PickerItem } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import { coreDisplayName } from '../cores';
import { todayIso, useDisplayConfig } from '@/core/filament';
import { STORAGE_ICONS } from '../storage';
import { useLocationPrefs } from '../hooks/useLocationPrefs';
import { defaultLocationId, locationText } from '../locationPrefs';
import {
  useCatalog,
  useColors,
  useCreateSpools,
  useDbFilaments,
  useDbManufacturers,
  useDbMaterials,
  useGtin,
  useLocations,
  useSetExtras,
  useSpool,
  useUpdateSpool,
} from '../hooks/useSpools';
import {
  applyFilament,
  applyGtin,
  BASE_COLORS,
  COMMON_MATERIALS,
  draftFromSpool,
  draftToCreate,
  draftExtras,
  draftToUpdate,
  emptyDraft,
  NET_WEIGHTS,
  parseHex,
  rgbaToHex,
  STORAGE_TYPES,
  type SpoolDraft,
  type SpoolKind,
} from '../newSpool';

const REFILL_KEY = 'spools.refillCoreWeight';

/** SP-07/07b: Anlegen (`/spools/new`, Duplizieren `?from=<id>`) und Bearbeiten (`/spools/:id/edit`). */
export function SpoolFormPage() {
  const params = useParams();
  const editId = Number(params.id ?? 0);
  const search = new URLSearchParams(useLocation().search);
  const fromId = Number(search.get('from') ?? 0);
  const gtin = search.get('gtin') ?? '';
  const sourceId = editId || fromId;
  const source = useSpool(sourceId);
  const barcode = useGtin(gtin);
  // kurz auf den Treffer warten (meist < 1 s); hängt die Datenbank, nicht länger als 4 s blockieren
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    if (!gtin || !barcode.isPending) return;
    const id = setTimeout(() => setGaveUp(true), 4000);
    return () => clearTimeout(id);
  }, [gtin, barcode.isPending]);
  if (gtin && barcode.isPending && !gaveUp) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/spools" text="" />
            </IonButtons>
            <IonTitle>{t('new.title')}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <StateView state="loading" />
        </IonContent>
      </IonPage>
    );
  }
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
  return (
    <SpoolForm
      key={`${editId}-${fromId}-${gtin}`}
      source={source.data}
      editing={editId > 0}
      gtin={gtin ? { code: gtin, hits: barcode.data ?? [], failed: barcode.isError || barcode.isPending } : undefined}
    />
  );
}

function SpoolForm({
  source,
  editing,
  gtin,
}: {
  source?: Spool;
  editing: boolean;
  gtin?: { code: string; hits: GtinHit[]; failed: boolean };
}) {
  const display = useDisplayConfig();
  const [draft, setDraft] = useState<SpoolDraft>(() => {
    const base = source ? draftFromSpool(source) : { ...emptyDraft(), labelWeight: display.defaultWeight };
    return gtin ? applyGtin(base, gtin.hits) : base;
  });
  const [scanOpen, setScanOpen] = useState(false);
  const [hexText, setHexText] = useState(() => rgbaToHex(draft.rgba).replace('#', ''));
  const [picker, setPicker] = useState<'brand' | 'material' | 'filament' | null>(null);
  const [created, setCreated] = useState<Spool[] | null>(null);
  const locations = useLocations();
  const locationPrefs = useLocationPrefs();
  // Neue Spule: Standard-Lagerort, solange nichts anderes gewählt ist („Ohne Lagerort“ zählt als Wahl)
  const [locationPicked, setLocationPicked] = useState(false);
  const locationId =
    editing || locationPicked ? draft.locationId : (draft.locationId ?? defaultLocationId(locationPrefs, locations.data ?? []));
  const catalog = useCatalog();
  const manufacturers = useDbManufacturers(true);
  const materials = useDbMaterials(draft.brand.trim(), picker === 'material');
  const filaments = useDbFilaments(draft.brand.trim(), draft.material.trim());
  const colors = useColors(draft.brand.trim(), draft.material.trim());
  const create = useCreateSpools();
  const update = useUpdateSpool();
  const setExtras = useSetExtras();
  const canEdit = useAllowed('inventory:update');
  const navigate = useNavigate();
  const [toast] = useIonToast();

  const set = <K extends keyof SpoolDraft>(k: K, v: SpoolDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setRgba = (rgba: string | null) => {
    setDraft((d) => ({ ...d, rgba }));
    setHexText(rgbaToHex(rgba).replace('#', ''));
  };
  const hexValid = hexText.trim() === '' || parseHex(hexText) !== null;
  // Grund, warum Speichern nicht geht – steht neben dem Knopf statt still gesperrt
  const missing = !draft.material.trim()
    ? t('new.missingMaterial')
    : !(draft.labelWeight > 0)
      ? t('new.missingWeight')
      : !hexValid
        ? t('new.hexInvalid')
        : draft.remaining != null && !(draft.remaining >= 0 && draft.remaining <= draft.labelWeight)
          ? t('new.remainingInvalid')
          : null;
  const valid = !missing && draft.quantity >= 1 && canEdit;

  // Live-Vorschau oben (Vorbild Spooly)
  const title = draft.colorName.trim() || [draft.material, draft.subtype].filter((x) => x.trim()).join(' ') || t('new.preview');
  const rest = draft.remaining ?? draft.labelWeight;
  const fill = draft.labelWeight > 0 ? Math.max(0, Math.min(1, rest / draft.labelWeight)) : 0;

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
    setHexText(rgbaToHex(next.rgba).replace('#', ''));
  };

  const pickBase = (name: string, hex: string) => {
    setRgba(parseHex(hex));
    // Farbname nur überschreiben, wenn er leer ist oder selbst eine Grundfarbe war
    if (!draft.colorName.trim() || BASE_COLORS.some(([n]) => n === draft.colorName)) set('colorName', name);
  };

  const fail = (e: unknown) =>
    void toast({
      message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }),
      duration: 3500,
      position: 'top',
      color: 'danger',
    });

  const save = async () => {
    if (!valid) return;
    if (draft.kind === 'refill') storage.set(REFILL_KEY, draft.coreWeight);
    try {
      if (editing) {
        if (!source) return;
        await update.mutateAsync({ spoolId: source.id, patch: draftToUpdate(draft, source) });
        const extras = draftExtras(draft, source);
        if (Object.keys(extras).length) await setExtras.mutateAsync({ ids: [source.id], patch: extras });
        haptic();
        void toast({ message: t('edit.saved', { id: source.id }), duration: 2000, position: 'top' });
        navigate(`/spools/${source.id}`, { replace: true });
        return;
      }
      const list = await create.mutateAsync({ spool: draftToCreate({ ...draft, locationId }), quantity: draft.quantity });
      const extras = draftExtras(draft);
      if (Object.keys(extras).length) await setExtras.mutateAsync({ ids: list.map((s) => s.id), patch: extras }).catch(fail);
      haptic();
      void toast({ message: tn('new.created', list.length), duration: 2000, position: 'top' });
      setCreated(list);
    } catch (e) {
      fail(e);
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
        sublabel: [f.weight ? `${f.weight} g` : null, f.spool_weight ? `${t('weigh.coreRow')} ${f.spool_weight} g` : null, f.finish]
          .filter(Boolean)
          .join(' · '),
        color: f.color_hex ? `#${f.color_hex}` : null,
        keywords: colorSearchText(f.name, f.color_hex ? `${f.color_hex}FF` : null),
      })),
    [filaments.data],
  );
  const busy = create.isPending || update.isPending || setExtras.isPending;
  const makerColors = colors.data ?? [];
  const sub = { color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' } as const;
  const today = todayIso();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref={source ? `/spools/${source.id}` : '/spools'} text="" />
          </IonButtons>
          <IonTitle>
            {editing && source ? t('edit.title', { id: source.id }) : source ? t('new.duplicateOf', { id: source.id }) : t('new.title')}
          </IonTitle>
        </IonToolbar>
        {/* Live-Vorschau: so sieht die Spule gleich in der Liste aus */}
        <IonToolbar>
          <div style={{ display: 'flex', gap: 'var(--bs-s3)', alignItems: 'center', padding: 'var(--bs-s1) var(--bs-s4) var(--bs-s2)' }}>
            <ColorRing rgba={draft.rgba} size={52} label={title} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 'var(--bs-s1)' }}>
              <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
                {draft.brand && <span style={{ ...sub, fontWeight: 400 }}> · {draft.brand}</span>}
              </strong>
              <FillBar fill={fill} height={6} />
              <span className="bs-num" style={sub}>
                {fmtNum(rest)} / {fmtNum(draft.labelWeight)} g · {Math.round(fill * 100)} %
                {!editing && draft.quantity > 1 && ` · ${draft.quantity}×`}
              </span>
            </div>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {!canEdit && (
          <IonNote color="warning" style={{ display: 'block', padding: 'var(--bs-s4) var(--bs-s5) 0' }}>
            {t('common.noPermission')}
          </IonNote>
        )}
        {!editing && (
          <IonList inset>
            <IonItem button detail onClick={() => setScanOpen(true)}>
              <IonIcon icon={barcodeOutline} slot="start" color="primary" aria-hidden />
              <IonLabel>
                {t('barcode.scan')}
                <div style={sub}>
                  {gtin
                    ? gtin.hits.length
                      ? t('barcode.found', {
                          code: gtin.code,
                          what: [gtin.hits[0]!.brand, gtin.hits[0]!.filament, gtin.hits[0]!.color].filter(Boolean).join(' · '),
                        })
                      : gtin.failed
                        ? t('barcode.unreachable', { code: gtin.code })
                        : t('barcode.unknown', { code: gtin.code })
                    : t('barcode.hint')}
                </div>
              </IonLabel>
            </IonItem>
          </IonList>
        )}

        {/* Filament: Hersteller, Material, Sorte */}
        <IonList inset>
          <IonItem button detail onClick={() => setPicker('brand')}>
            <IonLabel>
              <div style={sub}>{t('new.brand')}</div>
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
            <IonInput
              label={t('new.subtype')}
              labelPlacement="stacked"
              value={draft.subtype}
              onIonInput={(e) => set('subtype', String(e.detail.value ?? ''))}
            />
          </IonItem>
        </IonList>

        {/* Farbe: Herstellerfarben, Grundfarben, Farbwähler, Hex */}
        <IonList inset>
          <IonListHeader>{t('new.colorHex')}</IonListHeader>
          {draft.brand && draft.material && (
            <IonItem button detail disabled={!filaments.data?.length} onClick={() => setPicker('filament')}>
              <IonLabel>
                {t('new.pickFilament')}
                <div style={sub}>
                  {filaments.isError
                    ? t('new.noDb')
                    : t('new.pickFilamentHint', { n: filaments.data?.length ?? 0, brand: draft.brand, material: draft.material })}
                </div>
              </IonLabel>
            </IonItem>
          )}
          {makerColors.length > 0 && (
            <div
              style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', padding: 'var(--bs-s2) var(--bs-s3)' }}
              aria-label={t('new.colorSuggest')}
            >
              {makerColors.slice(0, 24).map((c) => (
                <ChoiceChip
                  key={c.id}
                  selected={draft.colorName === c.color_name}
                  onSelect={() => {
                    set('colorName', c.color_name);
                    setRgba(parseHex(c.hex_color));
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: c.hex_color,
                      border: '1px solid var(--bs-border)',
                      marginRight: 'var(--bs-s1)',
                    }}
                  />
                  {c.color_name}
                </ChoiceChip>
              ))}
            </div>
          )}
          <div
            role="group"
            aria-label={t('new.colorPalette')}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))',
              gap: 'var(--bs-s2)',
              padding: 'var(--bs-s2) var(--bs-s4)',
            }}
          >
            {BASE_COLORS.map(([name, hex]) => {
              const selected = draft.rgba?.slice(0, 6).toUpperCase() === hex;
              return (
                <button
                  key={hex}
                  type="button"
                  aria-label={name}
                  aria-pressed={selected}
                  title={name}
                  onClick={() => pickBase(name, hex)}
                  className="bs-swatch"
                  style={{
                    background: `#${hex}`,
                    outline: selected ? '2px solid var(--bs-accent)' : undefined,
                    color: ['FFFFFF', 'F2C94C', 'D8C8A8', 'C0C0C0'].includes(hex) ? '#000000' : '#ffffff',
                  }}
                >
                  {selected && <IonIcon icon={checkmark} aria-hidden />}
                </button>
              );
            })}
            {/* eigene Farbe: Systemauswahl des Browsers */}
            <label className="bs-swatch bs-swatch-pick" title={t('new.colorPick')}>
              <IonIcon icon={colorPaletteOutline} aria-hidden />
              <input
                type="color"
                aria-label={t('new.colorPick')}
                value={`#${(draft.rgba ?? '888888FF').slice(0, 6)}`}
                onChange={(e) => setRgba(parseHex(e.target.value))}
              />
            </label>
          </div>
          {makerColors.length === 0 && (
            <IonNote style={{ display: 'block', padding: '0 var(--bs-s4) var(--bs-s2)', ...sub }}>{t('new.colorHintBrand')}</IonNote>
          )}
          <IonItem>
            <IonInput
              label={t('new.color')}
              labelPlacement="stacked"
              value={draft.colorName}
              helperText={
                otherLanguageName(draft.colorName) ? t('new.colorOther', { name: otherLanguageName(draft.colorName)! }) : undefined
              }
              onIonInput={(e) => set('colorName', String(e.detail.value ?? ''))}
            />
          </IonItem>
          <IonItem>
            <span
              aria-hidden
              slot="start"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: rgbaToCss(draft.rgba),
                border: '2px solid var(--bs-border)',
              }}
            />
            <IonInput
              label={t('new.hexShort')}
              labelPlacement="stacked"
              placeholder="00AE42"
              value={hexText}
              className="bs-num"
              maxlength={9}
              onIonInput={(e) => {
                const v = String(e.detail.value ?? '').replace('#', '');
                setHexText(v);
                const rgba = parseHex(v);
                if (rgba) set('rgba', rgba);
                else if (!v.trim()) set('rgba', null);
              }}
            >
              <span slot="start" className="bs-num" style={{ color: 'var(--bs-text-2)' }}>
                #
              </span>
            </IonInput>
          </IonItem>
          {!hexValid && (
            <IonNote color="danger" style={{ display: 'block', padding: 'var(--bs-s2) var(--bs-s4)' }}>
              {t('new.hexInvalid')}
            </IonNote>
          )}
        </IonList>

        {/* Gewicht, Füllstand, Spulenart */}
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
            <GramInput label={t('new.labelWeightExact')} value={draft.labelWeight} onChange={(n) => set('labelWeight', n)} />
          </IonItem>
          {!editing && (
            <>
              <IonListHeader>{t('new.fill')}</IonListHeader>
              <div style={{ padding: 'var(--bs-s2) var(--bs-s3)' }}>
                <IonSegment
                  value={draft.remaining == null ? 'full' : 'started'}
                  onIonChange={(e) => set('remaining', e.detail.value === 'full' ? null : Math.round(draft.labelWeight / 2))}
                >
                  <IonSegmentButton value="full">{t('new.full')}</IonSegmentButton>
                  <IonSegmentButton value="started">{t('new.started')}</IonSegmentButton>
                </IonSegment>
              </div>
              {draft.remaining != null && (
                <IonItem>
                  <GramInput
                    label={t('new.remaining')}
                    value={draft.remaining}
                    max={draft.labelWeight}
                    onChange={(n) => set('remaining', Math.round(n))}
                  />
                </IonItem>
              )}
            </>
          )}
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
                <GramInput
                  label={t('new.refillCore')}
                  value={draft.coreWeight}
                  max={2000}
                  onChange={(n) => set('coreWeight', Math.round(n))}
                />
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
                      {coreDisplayName(c.name)} · {c.weight} g
                    </IonSelectOption>
                  ))}
                  <IonSelectOption value="custom">{t('new.coreWeightOwn')}</IonSelectOption>
                </IonSelect>
              </IonItem>
              {draft.coreCatalogId == null && (
                <IonItem>
                  <GramInput
                    label={t('new.coreWeightCustom')}
                    value={draft.coreWeight}
                    max={2000}
                    onChange={(n) => set('coreWeight', Math.round(n))}
                  />
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
                value={locationId ?? 0}
                onIonChange={(e) => {
                  setLocationPicked(true);
                  set('locationId', Number(e.detail.value) || null);
                }}
              >
                <IonSelectOption value={0}>{t('move.none')}</IonSelectOption>
                {(locations.data ?? []).map((l) => (
                  <IonSelectOption key={l.id} value={l.id}>
                    {locationText(l.name, locationPrefs.icons[l.id])}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          )}
          {!editing && (
            <IonItem lines="none">
              <IonLabel>{t('new.quantity')}</IonLabel>
              <IonButtons slot="end" style={{ gap: 'var(--bs-s2)', alignItems: 'center' }}>
                <IonButton
                  fill="outline"
                  disabled={draft.quantity <= 1}
                  onClick={() => set('quantity', draft.quantity - 1)}
                  aria-label={t('common.less')}
                >
                  −
                </IonButton>
                <span className="bs-num" style={{ minWidth: 24, textAlign: 'center' }}>
                  {draft.quantity}
                </span>
                <IonButton
                  fill="outline"
                  disabled={draft.quantity >= 20}
                  onClick={() => set('quantity', draft.quantity + 1)}
                  aria-label={t('common.more')}
                >
                  +
                </IonButton>
              </IonButtons>
            </IonItem>
          )}
        </IonList>

        {/* Optionales, eingeklappt (Vorbild Spooly) */}
        <IonAccordionGroup expand="inset" multiple style={{ marginBottom: 'var(--bs-s4)' }}>
          <IonAccordion value="buy">
            <IonItem slot="header">
              <IonIcon icon={cartOutline} slot="start" color="primary" aria-hidden />
              <IonLabel>
                {t('new.buy')}
                <div style={sub}>
                  {[draft.price ? `${draft.price} €` : null, draft.materialNumber || null].filter(Boolean).join(' · ') || t('new.buyHint')}
                </div>
              </IonLabel>
            </IonItem>
            <div slot="content">
              <IonItem>
                <IonInput
                  label={t('new.price')}
                  labelPlacement="stacked"
                  inputmode="decimal"
                  placeholder={t('new.pricePlaceholder')}
                  value={draft.price}
                  onIonInput={(e) => set('price', String(e.detail.value ?? ''))}
                />
              </IonItem>
              <IonItem lines="none">
                <IonInput
                  label={t('spools.detail.articleNo')}
                  labelPlacement="stacked"
                  placeholder={t('new.articlePlaceholder')}
                  value={draft.materialNumber}
                  onIonInput={(e) => set('materialNumber', String(e.detail.value ?? ''))}
                />
              </IonItem>
            </div>
          </IonAccordion>
          <IonAccordion value="moisture">
            <IonItem slot="header">
              <IonIcon icon={sunnyOutline} slot="start" color="primary" aria-hidden />
              <IonLabel>
                {t('new.moisture')}
                <div style={sub}>
                  {[
                    draft.storageType ? t(`storage.${draft.storageType}`) : null,
                    draft.driedAt ? t('new.driedOn', { date: fmtDate(draft.driedAt) }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || t('new.moistureHint')}
                </div>
              </IonLabel>
            </IonItem>
            <div slot="content">
              <IonListHeader>{t('new.storageType')}</IonListHeader>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--bs-s1)', padding: 'var(--bs-s2) var(--bs-s3)' }}>
                {STORAGE_TYPES.map((k) => (
                  <ChoiceChip
                    key={k}
                    selected={draft.storageType === k}
                    onSelect={() => set('storageType', draft.storageType === k ? '' : k)}
                  >
                    <IonIcon icon={STORAGE_ICONS[k]} aria-hidden style={{ marginRight: 'var(--bs-s1)' }} />
                    {t(`storage.${k}`)}
                  </ChoiceChip>
                ))}
              </div>
              <IonItem>
                <IonToggle checked={draft.driedAt === today} onIonChange={(e) => set('driedAt', e.detail.checked ? today : null)}>
                  {t('new.justDried')}
                </IonToggle>
              </IonItem>
              <IonItem>
                <IonInput
                  type="date"
                  label={t('dry.last')}
                  labelPlacement="stacked"
                  max={today}
                  value={draft.driedAt ?? ''}
                  onIonInput={(e) => set('driedAt', String(e.detail.value ?? '') || null)}
                />
              </IonItem>
              <IonNote style={{ display: 'block', padding: 'var(--bs-s2) var(--bs-s4) var(--bs-s3)', ...sub }}>
                {t('new.reminderHint')}
              </IonNote>
            </div>
          </IonAccordion>
          <IonAccordion value="notes">
            <IonItem slot="header">
              <IonIcon icon={documentTextOutline} slot="start" color="primary" aria-hidden />
              <IonLabel>
                {t('new.notes')}
                <div style={{ ...sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {draft.note || t('new.notesHint')}
                </div>
              </IonLabel>
            </IonItem>
            <div slot="content">
              <IonItem lines="none">
                <IonTextarea
                  aria-label={t('new.notes')}
                  autoGrow
                  rows={3}
                  placeholder={t('new.notesPlaceholder')}
                  value={draft.note}
                  onIonInput={(e) => set('note', String(e.detail.value ?? ''))}
                />
              </IonItem>
            </div>
          </IonAccordion>
        </IonAccordionGroup>
      </IonContent>

      {/* Daumenzone: Anzahl + Hinzufügen; Grund, falls gesperrt */}
      <IonFooter>
        <IonToolbar>
          <div style={{ display: 'grid', gap: 'var(--bs-s2)', padding: 'var(--bs-s2) var(--bs-s3)' }}>
            {missing && (
              <IonNote color="warning" style={{ fontSize: 'var(--bs-fs-caption)' }}>
                {missing}
              </IonNote>
            )}
            <IonButton expand="block" disabled={!valid || busy} onClick={() => void save()} style={{ margin: 0 }}>
              {editing ? t('common.save') : tn('new.save', draft.quantity)}
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
      <IonModal isOpen={scanOpen} onDidDismiss={() => setScanOpen(false)} initialBreakpoint={0.85} breakpoints={[0, 0.85]}>
        <IonHeader>
          <IonToolbar>
            <IonTitle>{t('barcode.scan')}</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={() => setScanOpen(false)}>{t('common.close')}</IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <ScannerView
            active={scanOpen}
            formats={BARCODES_ONLY}
            accept={(raw) => parseScan(raw).kind === 'gtin'}
            hint={t('barcode.aim')}
            onCode={(raw) => {
              const r = parseScan(raw);
              if (r.kind !== 'gtin') return;
              haptic();
              setScanOpen(false);
              navigate(`/spools/new?gtin=${r.code}`, { replace: true });
            }}
          />
        </IonContent>
      </IonModal>
      <LabelSheet spools={created ?? []} isOpen={!!created} onDismiss={done} />
    </IonPage>
  );
}
