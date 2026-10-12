import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import { useRef, type ReactNode } from 'react';
import { t } from '@/core/i18n';
import { useMediaQuery } from '../useMediaQuery';

interface Props {
  isOpen: boolean;
  title: string;
  /** Speichern; bei Erfolg schließt das Blatt (Fehler zeigt der Aufrufer) */
  onSave: () => void | boolean | Promise<void | boolean>;
  onDismiss: () => void;
  /** Speichern gesperrt (z. B. Eingabe ungültig) */
  saveDisabled?: boolean;
  busy?: boolean;
  children: ReactNode;
}

/**
 * Einheitliches Bearbeiten-Blatt statt Systemdialog mit Eingabefeldern (iOS blendet dort die Beschriftungen aus).
 * Handy: Blatt von unten; ab Tablet: mittiger Dialog. Kopf: Abbrechen · Titel · Speichern.
 */
export function EditSheet({ isOpen, title, onSave, onDismiss, saveDisabled, busy, children }: Props) {
  const modal = useRef<HTMLIonModalElement>(null);
  const wide = useMediaQuery('(min-width: 768px)');
  const save = async () => {
    const ok = await onSave();
    if (ok !== false) await modal.current?.dismiss();
  };
  return (
    <IonModal
      ref={modal}
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      className="bs-edit-sheet"
      {...(wide ? {} : { initialBreakpoint: 0.6, breakpoints: [0, 0.6, 1] })}
    >
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => void modal.current?.dismiss()}>{t('common.cancel')}</IonButton>
          </IonButtons>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton strong disabled={saveDisabled || busy} onClick={() => void save()}>
              {t('common.save')}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>{children}</IonContent>
    </IonModal>
  );
}
