import { IonToast } from '@ionic/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '@/core/i18n';

/**
 * Neue App-Version nach einem Deploy: stündlich und beim Zurückkehren in die App prüfen,
 * dann Hinweis „Neue Version – Aktualisieren“. So lädt die Homescreen-App nie mitten in einer Eingabe neu.
 */
export function UpdateToast() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      setInterval(() => void reg.update(), 60 * 60_000);
      document.addEventListener('visibilitychange', () => !document.hidden && void reg.update());
    },
  });
  return (
    <IonToast
      isOpen={needRefresh}
      message={t('app.updateAvailable')}
      position="top"
      buttons={[
        { text: t('app.update'), handler: () => void updateServiceWorker(true) },
        { text: t('common.later'), role: 'cancel', handler: () => setNeedRefresh(false) },
      ]}
    />
  );
}
