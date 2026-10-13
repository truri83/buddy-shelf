import { IonToast } from '@ionic/react';
import { useState } from 'react';
import { t } from '@/core/i18n';
import { isEmbedded, openStandalone } from '@/core/platform';

/** Eingebettet (Bambuddy-Seitenleiste): einmal sagen, dass Kamera und Direktdruck nur im eigenen Tab gehen. */
export function EmbeddedToast() {
  const [open, setOpen] = useState(isEmbedded);
  return (
    <IonToast
      isOpen={open}
      message={t('app.embedded')}
      position="top"
      duration={10_000}
      onDidDismiss={() => setOpen(false)}
      buttons={[
        { text: t('app.openStandalone'), handler: openStandalone },
        { text: t('common.later'), role: 'cancel' },
      ]}
    />
  );
}
