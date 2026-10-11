import { IonButton, IonSpinner } from '@ionic/react';
import { t } from '@/core/i18n';

type Props =
  | { state: 'loading' }
  | { state: 'empty'; message?: string }
  | { state: 'error'; message?: string; onRetry?: () => void }
  | { state: 'offline'; onRetry?: () => void };

/** Regel 7: jede Seite zeigt lädt / leer / Fehler / offline einheitlich. */
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
    props.state === 'empty'
      ? (props.message ?? t('state.empty'))
      : props.state === 'offline'
        ? t('state.offline')
        : (props.message ?? t('state.error'));
  const retry = props.state === 'error' || props.state === 'offline' ? props.onRetry : undefined;
  return (
    <div style={box} role={props.state === 'empty' ? undefined : 'alert'}>
      <p>{text}</p>
      {retry && (
        <IonButton fill="outline" onClick={retry}>
          {t('state.retry')}
        </IonButton>
      )}
    </div>
  );
}
