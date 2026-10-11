import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToast, IonToolbar } from '@ionic/react';
import { cubeOutline, locationOutline, pricetagOutline, scaleOutline } from 'ionicons/icons';
import { useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { fillRatio, remainingGrams } from '@/core/api';
import { t } from '@/core/i18n';
import { encodeSpoolCode } from '@/core/qr/codes';
import { ColorRing, FillBar, MaterialBadge, StateView } from '@/core/ui';
import { LabelSheet } from '../components/LabelSheet';
import { useLocations, useSpool } from '../hooks/useSpools';
import { isLow, locationName } from '../logic';

/** Vorlage „Detail“: Kopf-Karte mit Kennzahl, Aktionsleiste, Abschnitte. */
export function SpoolDetailPage() {
  const { id } = useParams();
  const spoolId = Number(id);
  const spool = useSpool(spoolId);
  const locations = useLocations();
  const [toast, setToast] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);

  const s = spool.data;
  const name = s ? (s.color_name ?? s.subtype ?? s.material) : '';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/spools" text="" />
          </IonButtons>
          <IonTitle>{s ? `#${s.id} ${name}` : ''}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {spool.isPending ? (
          <StateView state="loading" />
        ) : spool.isError || !s ? (
          <StateView state="error" onRetry={() => void spool.refetch()} />
        ) : (
          <>
            <section style={{ display: 'flex', gap: 'var(--bs-s4)', alignItems: 'center', padding: 'var(--bs-s4)' }}>
              <ColorRing rgba={s.rgba} fill={fillRatio(s)} size={72} label={name} />
              <div style={{ flex: 1, display: 'grid', gap: 'var(--bs-s2)' }}>
                <div className="bs-num" style={{ fontSize: 'var(--bs-fs-largetitle)', fontWeight: 700 }}>
                  {remainingGrams(s)} g
                  <span style={{ fontSize: 'var(--bs-fs-caption)', color: 'var(--bs-text-2)', fontWeight: 400 }}> / {s.label_weight} g</span>
                </div>
                <FillBar fill={fillRatio(s)} low={isLow(s)} />
                <div>
                  <MaterialBadge material={[s.material, s.subtype].filter(Boolean).join(' ')} />
                </div>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--bs-s2)', padding: '0 var(--bs-s4)' }}>
              {(
                [
                  [cubeOutline, 'spools.action.toAms'],
                  [locationOutline, 'spools.action.move'],
                  [scaleOutline, 'spools.action.weigh'],
                  [pricetagOutline, 'spools.action.label'],
                ] as const
              ).map(([icon, key]) => (
                <IonButton
                  key={key}
                  fill="outline"
                  expand="block"
                  onClick={() => (key === 'spools.action.label' ? setLabelOpen(true) : setToast(true))}
                  style={{ minHeight: 'var(--bs-touch)', '--padding-start': '4px', '--padding-end': '4px' } as CSSProperties}
                >
                  <div style={{ display: 'grid', justifyItems: 'center', gap: 2 }}>
                    <IonIcon icon={icon} />
                    <span style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{t(key)}</span>
                  </div>
                </IonButton>
              ))}
            </div>

            <IonList inset>
              <IonItem>
                <IonLabel color="medium">{t('spools.detail.brand')}</IonLabel>
                <IonLabel slot="end">{s.brand ?? '–'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel color="medium">{t('spools.detail.location')}</IonLabel>
                <IonLabel slot="end">{locationName(s, locations.data ?? []) ?? '–'}</IonLabel>
              </IonItem>
              <IonItem>
                <IonLabel color="medium">{t('spools.detail.emptyWeight')}</IonLabel>
                <IonLabel slot="end" className="bs-num">
                  {s.core_weight} g
                </IonLabel>
              </IonItem>
              <IonItem lines="none">
                <IonLabel color="medium">{t('spools.detail.code')}</IonLabel>
                <IonLabel slot="end" className="bs-num">
                  {encodeSpoolCode(s.id)}
                </IonLabel>
              </IonItem>
            </IonList>
            <LabelSheet spools={[s]} isOpen={labelOpen} onDismiss={() => setLabelOpen(false)} />
            <IonToast isOpen={toast} message={t('spools.action.soon')} duration={2200} onDidDismiss={() => setToast(false)} />
          </>
        )}
      </IonContent>
    </IonPage>
  );
}
