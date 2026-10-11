import { IonButton, IonContent, IonHeader, IonModal, IonNote, IonSegment, IonSegmentButton, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { useEffect, useState } from 'react';
import { t } from '@/core/i18n';
import { can, storage } from '@/core/platform';
import { headPixels, templateUsesRed, type LabelTemplate, type LabelVariables } from './template';
import { loadEngine, useLabelPrinter } from './useLabelPrinter';

interface Props {
  /** Wählbare Vorlagen (mindestens eine) */
  templates: LabelTemplate[];
  /** Ein Datensatz je Etikett (Stapeldruck) */
  records: LabelVariables[];
  fileName: (r: LabelVariables, i: number) => string;
  /** Speicherschlüssel für die gemerkte Vorlage */
  storageKey: string;
  isOpen: boolean;
  onDismiss: () => void;
}

const row = { display: 'grid', gap: 'var(--bs-s2)', padding: '0 var(--bs-s4)' } as const;

/** SP-06: Vorschau → Drucken (Niimbot direkt) oder PNG. Baustein „Etikett-Vorschau“ als Detail-Sheet. */
export function LabelPrintSheet({ templates, records, fileName, storageKey, isOpen, onDismiss }: Props) {
  const lp = useLabelPrinter();
  const [templateId, setTemplateId] = useState(() => storage.get(storageKey, templates[0]!.id));
  const template = templates.find((x) => x.id === templateId) ?? templates[0]!;
  const [quantity, setQuantity] = useState(1);
  // Vorschau gehört zu genau einer Kombination aus Vorlage, Spule und Rot-Fähigkeit
  const previewKey = `${template.id}|${JSON.stringify(records[0] ?? {})}|${lp.printer?.supportsRed ?? '-'}`;
  const [shot, setShot] = useState<{ key: string; url: string } | null>(null);
  const img = shot?.key === previewKey ? shot.url : null; // '' = Vorschau fehlgeschlagen
  const [done, setDone] = useState(false);

  // Druckteil vorladen, damit die Geräteauswahl direkt im Klick passiert (Browser-Vorgabe)
  useEffect(() => {
    if (isOpen) void loadEngine();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !records[0]) return;
    let alive = true;
    lp.preview(template, records[0])
      .then((url) => alive && setShot({ key: previewKey, url }))
      .catch(() => alive && setShot({ key: previewKey, url: '' }));
    return () => {
      alive = false;
    };
    // lp.preview ist stabil; previewKey fasst die übrigen Abhängigkeiten zusammen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, previewKey]);

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    storage.set(storageKey, id);
  };

  const print = async () => {
    setDone(false);
    await lp.print(template, records, quantity);
    setDone(true);
  };

  const max = lp.printer?.printheadPixels;
  const tooWide = max != null && headPixels(template) > max;
  const busy = lp.status === 'connecting' || lp.status === 'printing';
  const direct = can('printer.bluetooth') || can('printer.usb');
  const { width, height } = template.label.size;

  return (
    <IonModal isOpen={isOpen} onWillPresent={() => (setDone(false), setQuantity(1))} onDidDismiss={onDismiss} initialBreakpoint={0.92} breakpoints={[0, 0.92]}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{records.length > 1 ? t('label.titleMany', { n: records.length }) : t('label.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div style={{ ...row, paddingTop: 'var(--bs-s4)', gap: 'var(--bs-s4)' }}>
          {/* Vorschau = exakt das Druckbild */}
          <div
            style={{
              aspectRatio: `${width} / ${height}`,
              background: '#ffffff',
              border: '1px solid var(--bs-border)',
              borderRadius: 'var(--bs-r-md)',
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
            }}
          >
            {img ? (
              <img src={img} alt={t('label.title')} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : img === '' ? (
              <IonNote color="danger">{t('label.previewFailed')}</IonNote>
            ) : (
              <IonSpinner />
            )}
          </div>

          {templates.length > 1 && (
            <IonSegment value={template.id} onIonChange={(e) => chooseTemplate(String(e.detail.value))}>
              {templates.map((x) => (
                <IonSegmentButton key={x.id} value={x.id}>
                  {x.title}
                </IonSegmentButton>
              ))}
            </IonSegment>
          )}
          {templateUsesRed(template) && <IonNote>{t('label.redHint')}</IonNote>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{t('label.quantity')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--bs-s2)' }}>
              <IonButton fill="outline" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)} aria-label={t('common.less')}>
                −
              </IonButton>
              <span className="bs-num" style={{ minWidth: 24, textAlign: 'center' }}>
                {quantity}
              </span>
              <IonButton fill="outline" disabled={quantity >= 20} onClick={() => setQuantity((q) => q + 1)} aria-label={t('common.more')}>
                +
              </IonButton>
            </div>
          </div>
        </div>

        {/* Aktionen in der Daumenzone */}
        <div style={{ ...row, padding: 'var(--bs-s4)', gap: 'var(--bs-s2)' }}>
          {lp.printer ? (
            <>
              <IonButton expand="block" disabled={busy || tooWide} onClick={() => void print()}>
                {lp.status === 'printing' ? t('label.printing', { p: lp.progress }) : done && lp.status === 'idle' ? t('label.printed') : t('label.print')}
              </IonButton>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <IonNote>{t('label.connected', { name: lp.printer.name })}</IonNote>
                <IonButton fill="clear" size="small" disabled={busy} onClick={() => void lp.disconnect().catch(() => undefined)}>
                  {t('label.disconnect')}
                </IonButton>
              </div>
            </>
          ) : direct ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--bs-s2)' }}>
              {can('printer.bluetooth') && (
                <IonButton expand="block" disabled={busy} onClick={() => void lp.connect('bluetooth')}>
                  {lp.status === 'connecting' ? t('label.connecting') : t('label.connectBluetooth')}
                </IonButton>
              )}
              {can('printer.usb') && (
                <IonButton expand="block" fill="outline" disabled={busy} onClick={() => void lp.connect('usb')}>
                  {t('label.connectUsb')}
                </IonButton>
              )}
            </div>
          ) : (
            <IonNote>{t('label.noDirect')}</IonNote>
          )}
          {tooWide && <IonNote color="danger">{t('label.tooWide', { w: headPixels(template), max: max ?? 0 })}</IonNote>}
          {lp.error && <IonNote color="danger">{lp.error}</IonNote>}
          <IonButton expand="block" fill="clear" disabled={busy} onClick={() => void lp.savePng(template, records, fileName)}>
            {t('label.png')}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
}
