import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { alertCircleOutline, cloudOfflineOutline, fileTrayOutline, lockClosedOutline } from 'ionicons/icons';
import { t } from '@/core/i18n';

type Props =
  | { state: 'loading' }
  | { state: 'empty'; message?: string; icon?: string }
  | { state: 'error'; message?: string; onRetry?: () => void }
  | { state: 'offline'; onRetry?: () => void }
  | { state: 'denied'; message?: string };

const ICON = { empty: fileTrayOutline, error: alertCircleOutline, offline: cloudOfflineOutline, denied: lockClosedOutline };
const TONE = { empty: 'var(--bs-text-2)', error: 'var(--bs-critical)', offline: 'var(--bs-warn)', denied: 'var(--bs-warn)' };

/** Regel 7: jede Seite zeigt lädt / leer / Fehler / offline / keine Rechte einheitlich – mit Symbol in Statusfarbe. */
export function StateView(props: Props) {
  const box = { padding: 'var(--bs-s6) var(--bs-s4)', textAlign: 'center' as const, color: 'var(--bs-text-2)' };
  if (props.state === 'loading')
    return (
      <div style={box} aria-live="polite">
        <IonSpinner />
        <p>{t('state.loading')}</p>
      </div>
    );
  const text =
    props.state === 'offline'
      ? t('state.offline')
      : (props.message ?? (props.state === 'empty' ? t('state.empty') : props.state === 'denied' ? t('common.noPermission') : t('state.error')));
  const retry = props.state === 'error' || props.state === 'offline' ? props.onRetry : undefined;
  const icon = (props.state === 'empty' && props.icon) || ICON[props.state];
  return (
    <div style={box} role={props.state === 'empty' ? undefined : 'alert'}>
      <IonIcon icon={icon} aria-hidden style={{ fontSize: 40, color: TONE[props.state] }} />
      <p style={{ margin: 'var(--bs-s2) 0 var(--bs-s4)' }}>{text}</p>
      {retry && (
        <IonButton fill="outline" onClick={retry}>
          {t('state.retry')}
        </IonButton>
      )}
    </div>
  );
}

/** Hinweis oben auf Seiten, die man ohne Schreibrecht nur ansehen kann. `flush`: Seite hat schon Innenabstand. */
export function PermissionNote({ flush }: { flush?: boolean }) {
  return (
    <div
      role="note"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--bs-s2)',
        margin: flush ? '0 0 var(--bs-s3)' : 'var(--bs-s4) var(--bs-s4) 0',
        padding: 'var(--bs-s2) var(--bs-s3)',
        borderRadius: 'var(--bs-r-md)',
        border: '1px solid color-mix(in srgb, var(--bs-warn) 45%, transparent)',
        background: 'color-mix(in srgb, var(--bs-warn) 12%, transparent)',
        color: 'var(--bs-warn)',
        fontSize: 'var(--bs-fs-caption)',
      }}
    >
      <IonIcon icon={lockClosedOutline} aria-hidden style={{ flex: 'none', fontSize: 18 }} />
      {t('common.noPermission')}
    </div>
  );
}
