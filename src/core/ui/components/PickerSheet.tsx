import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useMemo, useRef, useState } from 'react';
import { foldGerman, t } from '@/core/i18n';

export interface PickerItem {
  value: string;
  label: string;
  sublabel?: string;
  /** #RRGGBB für ein Farbfeld */
  color?: string | null;
  /** zusätzliche Suchbegriffe (z. B. Farbname in der anderen Sprache) */
  keywords?: string;
}

interface Props {
  isOpen: boolean;
  title: string;
  items: PickerItem[];
  value?: string | null;
  loading?: boolean;
  /** Freitext erlauben („… übernehmen“) */
  allowCustom?: boolean;
  /** oben abgesetzt (z. B. zuletzt genutzt) – Werte aus `items` */
  pinned?: string[];
  pinnedTitle?: string;
  /** ausgeblendet (Einstellungen): nur über die Suche oder „… anzeigen“ */
  hidden?: (value: string) => boolean;
  onSelect: (value: string, item?: PickerItem) => void;
  onDismiss: () => void;
}

/** Baustein „Auswahl-Sheet mit Suche“ (UI-Regel: Auswahl in Bottom-Sheets). */
export function PickerSheet({
  isOpen,
  title,
  items,
  value,
  loading,
  allowCustom,
  pinned,
  pinnedTitle,
  hidden,
  onSelect,
  onDismiss,
}: Props) {
  const modal = useRef<HTMLIonModalElement>(null);
  const [query, setQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const { top, filtered, hiddenCount } = useMemo(() => {
    const words = foldGerman(query).split(/\s+/).filter(Boolean);
    // Suche findet alles (auch Ausgeblendete); ohne Suche: zuletzt genutzt oben, Ausgeblendete nur auf Wunsch
    if (words.length) {
      const hits = items.filter((i) => words.every((w) => foldGerman(`${i.label} ${i.sublabel ?? ''} ${i.keywords ?? ''}`).includes(w)));
      return { top: [] as PickerItem[], filtered: hits.slice(0, 300), hiddenCount: 0 };
    }
    const pin = new Set((pinned ?? []).map((v) => v.toLowerCase()));
    const top = (pinned ?? []).flatMap((v) => items.find((i) => i.value.toLowerCase() === v.toLowerCase()) ?? { value: v, label: v });
    const rest = items.filter((i) => !pin.has(i.value.toLowerCase()));
    const visible = rest.filter((i) => showHidden || !hidden?.(i.value) || i.value === value);
    return { top, filtered: visible.slice(0, 300), hiddenCount: rest.length - visible.length };
  }, [items, query, pinned, hidden, showHidden, value]);
  const custom =
    allowCustom && query.trim() && !items.some((i) => i.label.toLowerCase() === query.trim().toLowerCase()) ? query.trim() : null;

  const pick = (v: string, item?: PickerItem) => {
    onSelect(v, item);
    setQuery('');
    setShowHidden(false);
    onDismiss();
  };
  const row = (i: PickerItem) => (
    <IonItem key={i.value} button detail={false} onClick={() => pick(i.value, i)}>
      {i.color !== undefined && (
        <span
          aria-hidden
          slot="start"
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: i.color ?? 'transparent',
            border: '2px solid var(--bs-border)',
          }}
        />
      )}
      <IonLabel>
        {i.label}
        {i.sublabel && <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{i.sublabel}</div>}
      </IonLabel>
      {value === i.value && <IonNote slot="end">✓</IonNote>}
    </IonItem>
  );

  return (
    <IonModal
      ref={modal}
      isOpen={isOpen}
      onDidDismiss={() => (setQuery(''), setShowHidden(false), onDismiss())}
      initialBreakpoint={0.9}
      breakpoints={[0, 0.9, 1]}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => void modal.current?.dismiss()}>{t('common.close')}</IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar value={query} onIonInput={(e) => setQuery(e.detail.value ?? '')} placeholder={t('picker.search')} />
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading ? (
          <div style={{ display: 'grid', placeItems: 'center', padding: 'var(--bs-s6)' }}>
            <IonSpinner />
          </div>
        ) : (
          <IonList>
            {custom && (
              <IonItem button detail={false} onClick={() => pick(custom)}>
                <IonLabel>{t('picker.custom', { v: custom })}</IonLabel>
              </IonItem>
            )}
            {top.length > 0 && (
              <>
                <IonListHeader>{pinnedTitle ?? t('picker.recent')}</IonListHeader>
                {top.map(row)}
                <IonListHeader>{t('picker.all')}</IonListHeader>
              </>
            )}
            {filtered.map(row)}
            {hiddenCount > 0 && (
              <IonItem button detail={false} lines="none" onClick={() => setShowHidden(true)}>
                <IonLabel color="medium">{t('picker.showHidden', { n: hiddenCount })}</IonLabel>
              </IonItem>
            )}
            {!custom && filtered.length === 0 && top.length === 0 && hiddenCount === 0 && (
              <IonItem lines="none">
                <IonNote>{t('state.empty')}</IonNote>
              </IonItem>
            )}
          </IonList>
        )}
      </IonContent>
    </IonModal>
  );
}
