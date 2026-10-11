import { IonContent, IonHeader, IonItem, IonLabel, IonList, IonModal, IonNote, IonSearchbar, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useMemo, useState } from 'react';
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
  onSelect: (value: string, item?: PickerItem) => void;
  onDismiss: () => void;
}

/** Baustein „Auswahl-Sheet mit Suche“ (UI-Regel: Auswahl in Bottom-Sheets). */
export function PickerSheet({ isOpen, title, items, value, loading, allowCustom, onSelect, onDismiss }: Props) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const words = foldGerman(query).split(/\s+/).filter(Boolean);
    const list = words.length ? items.filter((i) => words.every((w) => foldGerman(`${i.label} ${i.sublabel ?? ''} ${i.keywords ?? ''}`).includes(w))) : items;
    return list.slice(0, 300);
  }, [items, query]);
  const custom = allowCustom && query.trim() && !items.some((i) => i.label.toLowerCase() === query.trim().toLowerCase()) ? query.trim() : null;

  const pick = (v: string, item?: PickerItem) => {
    onSelect(v, item);
    setQuery('');
    onDismiss();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={() => (setQuery(''), onDismiss())} initialBreakpoint={0.9} breakpoints={[0, 0.9, 1]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
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
            {filtered.map((i) => (
              <IonItem key={i.value} button detail={false} onClick={() => pick(i.value, i)}>
                {i.color !== undefined && (
                  <span
                    aria-hidden
                    slot="start"
                    style={{ width: 22, height: 22, borderRadius: '50%', background: i.color ?? 'transparent', border: '2px solid var(--bs-border)' }}
                  />
                )}
                <IonLabel>
                  {i.label}
                  {i.sublabel && <div style={{ color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)' }}>{i.sublabel}</div>}
                </IonLabel>
                {value === i.value && <IonNote slot="end">✓</IonNote>}
              </IonItem>
            ))}
            {!custom && filtered.length === 0 && (
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
