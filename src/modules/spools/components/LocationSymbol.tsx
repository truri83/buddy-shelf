import { IonIcon } from '@ionic/react';
import { locationOutline } from 'ionicons/icons';

/** Symbol eines Lagerorts: eigenes Emoji oder das Standard-Ortssymbol. `slot` wie bei IonIcon in Listen. */
export function LocationSymbol({ icon, size = 22, slot }: { icon?: string | null; size?: number; slot?: string }) {
  if (!icon) return <IonIcon icon={locationOutline} slot={slot} color="primary" aria-hidden style={{ fontSize: size }} />;
  return (
    <span
      slot={slot}
      className="bs-slot-symbol"
      aria-hidden
      style={{ fontSize: size * 0.95, lineHeight: 1, width: size, textAlign: 'center', flex: 'none', display: 'inline-block' }}
    >
      {icon}
    </span>
  );
}
