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
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import {
  cloudUploadOutline,
  downloadOutline,
  gridOutline,
  locationOutline,
  openOutline,
  pricetagOutline,
  trashOutline,
} from 'ionicons/icons';
import { useRef } from 'react';
import { t } from '@/core/i18n';
import { saveFile } from '@/core/platform';
import {
  newTemplateId,
  parseTemplate,
  templateData,
  templateSizeMm,
  templateUsesRed,
  useDeleteTemplate,
  useLabelTemplates,
  useSaveTemplate,
  type LabelTemplate,
  type TemplateKind,
} from '@/core/printing';
import { Badge } from '@/core/ui';

const KINDS: TemplateKind[] = ['spool', 'slot', 'location'];
const KIND_ICONS: Record<TemplateKind, string> = { spool: pricetagOutline, slot: gridOutline, location: locationOutline };
const sub = { color: 'var(--bs-text-2)', fontSize: 'var(--bs-fs-caption)', whiteSpace: 'normal' } as const;

/** Etikett-Vorlagen: eingebaute + eigene (Server-Ordner). Gestaltet wird auf niim.blue, hier nur Import/Export. */
export function TemplatesPage() {
  const { templates, query } = useLabelTemplates();
  const save = useSaveTemplate();
  const remove = useDeleteTemplate();
  const file = useRef<HTMLInputElement>(null);
  const [alert] = useIonAlert();
  const [toast] = useIonToast();
  const fail = (e: unknown) =>
    void toast({
      message: t('common.failed', { msg: e instanceof Error ? e.message : String(e) }),
      duration: 3500,
      position: 'top',
      color: 'danger',
    });

  const exportTemplate = (tpl: LabelTemplate) => {
    saveFile(new Blob([JSON.stringify(templateData(tpl), null, 2)], { type: 'application/json' }), `${tpl.id}.json`);
  };

  const importFile = async (f: File) => {
    try {
      const json: unknown = JSON.parse(await f.text());
      const parsed = parseTemplate(json, '');
      const title = parsed.title === 'Importiert' ? f.name.replace(/\.json$/i, '') : parsed.title;
      // Eigene Vorlage mit gleicher ID = aktualisieren; eingebaute nie überschreiben
      const own = templates.find((x) => x.id === parsed.id && !x.builtin);
      const tpl = { ...parsed, title, id: own ? own.id : newTemplateId(title) };
      await save.mutateAsync(tpl);
      void toast({ message: t(own ? 'templates.updated' : 'templates.imported', { title }), duration: 2500, position: 'top' });
    } catch (e) {
      fail(e instanceof SyntaxError ? new Error(t('templates.noJson')) : e);
    }
  };

  const confirmDelete = (tpl: LabelTemplate) =>
    void alert({
      header: t('templates.delete'),
      message: t('templates.deleteQ', { title: tpl.title }),
      buttons: [
        { text: t('common.cancel'), role: 'cancel' },
        { text: t('templates.delete'), role: 'destructive', handler: () => void remove.mutateAsync(tpl.id).catch(fail) },
      ],
    });

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/more" text="" />
          </IonButtons>
          <IonTitle>{t('templates.title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => file.current?.click()} disabled={save.isPending} aria-label={t('templates.import')}>
              <IonIcon slot="icon-only" icon={cloudUploadOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = ''; // gleiche Datei erneut wählbar
            if (f) void importFile(f);
          }}
        />
        {KINDS.map((kind) => (
          <IonList inset key={kind}>
            <IonListHeader>
              <IonLabel>{t(`templates.kind.${kind}`)}</IonLabel>
            </IonListHeader>
            {templates
              .filter((x) => x.kind === kind)
              .map((tpl) => (
                <IonItem key={tpl.id}>
                  <IonIcon icon={KIND_ICONS[tpl.kind]} slot="start" color={tpl.builtin ? 'medium' : 'primary'} aria-hidden />
                  <IonLabel>
                    {tpl.title}
                    <div style={sub}>
                      {[templateSizeMm(tpl), templateUsesRed(tpl) ? t('templates.red') : null].filter(Boolean).join(' · ')}
                    </div>
                  </IonLabel>
                  {tpl.builtin ? <Badge>{t('templates.builtin')}</Badge> : null}
                  <IonButtons slot="end">
                    <IonButton onClick={() => exportTemplate(tpl)} aria-label={t('templates.export', { title: tpl.title })}>
                      <IonIcon slot="icon-only" icon={downloadOutline} />
                    </IonButton>
                    {!tpl.builtin && (
                      <IonButton
                        color="danger"
                        onClick={() => confirmDelete(tpl)}
                        aria-label={t('templates.deleteOne', { title: tpl.title })}
                      >
                        <IonIcon slot="icon-only" icon={trashOutline} />
                      </IonButton>
                    )}
                  </IonButtons>
                </IonItem>
              ))}
          </IonList>
        ))}
        {query.isError && (
          <IonNote color="warning" style={{ display: 'block', padding: '0 var(--bs-s5)' }}>
            {t('templates.offline')}
          </IonNote>
        )}

        <IonList inset>
          <IonListHeader>
            <IonLabel>{t('templates.howTo')}</IonLabel>
          </IonListHeader>
          <IonItem lines="none">
            <IonLabel style={{ whiteSpace: 'normal' }}>
              <ol style={{ margin: 0, paddingLeft: 'var(--bs-s4)', display: 'grid', gap: 'var(--bs-s2)' }}>
                <li>{t('templates.step1')}</li>
                <li>{t('templates.step2')}</li>
                <li>{t('templates.step3')}</li>
              </ol>
            </IonLabel>
          </IonItem>
          <IonItem href="https://niim.blue" target="_blank" rel="noopener" detail>
            <IonIcon icon={openOutline} slot="start" color="primary" aria-hidden />
            <IonLabel>{t('templates.openEditor')}</IonLabel>
          </IonItem>
          <IonItem button onClick={() => file.current?.click()} detail={false} lines="none">
            <IonIcon icon={cloudUploadOutline} slot="start" color="primary" aria-hidden />
            <IonLabel>{t('templates.import')}</IonLabel>
          </IonItem>
        </IonList>
        <IonNote style={{ display: 'block', padding: '0 var(--bs-s5) var(--bs-s5)', ...sub }}>{t('templates.vars')}</IonNote>
      </IonContent>
    </IonPage>
  );
}
