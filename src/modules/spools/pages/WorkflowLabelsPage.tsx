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
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { pricetagOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import { t } from '@/core/i18n';
import { LabelPrintSheet, useLabelTemplates, type LabelVariables } from '@/core/printing';
import { encodeWorkflowCode, labelCode } from '@/core/qr/codes';
import { WORKFLOWS, type Workflow } from '../workflows';

const vars = (w: Workflow): LabelVariables => ({ code: labelCode(encodeWorkflowCode(w.id)), location: t(w.title) });

/** Etiketten für Abläufe (Waage → Wiegen, Dörrautomat → Trocknen …): Scannen startet den Ablauf direkt. */
export function WorkflowLabelsPage() {
  const { templates } = useLabelTemplates('location');
  const [printing, setPrinting] = useState<Workflow[] | null>(null);
  const records = useMemo(() => (printing ?? []).map(vars), [printing]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('workflows.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonNote className="bs-section-note" style={{ paddingTop: 'var(--bs-s4)' }}>
          {t('workflows.hint')}
        </IonNote>
        <IonList inset>
          {WORKFLOWS.map((w) => (
            <IonItem key={w.id} routerLink={w.route} detail={false}>
              <IonIcon icon={w.icon} slot="start" color="primary" aria-hidden />
              <IonLabel style={{ whiteSpace: 'normal' }}>
                {t(w.title)}
                <p>{t(w.hint)}</p>
              </IonLabel>
              <IonButton
                slot="end"
                fill="clear"
                aria-label={t('workflows.label', { name: t(w.title) })}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPrinting([w]);
                }}
              >
                <IonIcon slot="icon-only" icon={pricetagOutline} />
              </IonButton>
            </IonItem>
          ))}
        </IonList>
        <div style={{ padding: '0 var(--bs-s4) var(--bs-s4)' }}>
          <IonButton expand="block" fill="outline" onClick={() => setPrinting([...WORKFLOWS])}>
            <IonIcon slot="start" icon={pricetagOutline} />
            {t('workflows.printAll')}
          </IonButton>
        </div>
        <LabelPrintSheet
          templates={templates}
          records={records}
          fileName={(r) => `ablauf-${(r.code ?? '').split('/').pop()}.png`}
          storageKey="label.workflowTemplate"
          isOpen={!!printing?.length}
          onDismiss={() => setPrinting(null)}
        />
      </IonContent>
    </IonPage>
  );
}
