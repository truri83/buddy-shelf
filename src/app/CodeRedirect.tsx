import { Navigate } from 'react-router-dom';
import { dispatchScan } from './scan';

/**
 * Etikett mit der normalen Handy-Kamera gescannt (<app>/s/3, /l/2, /t/1/0/2): wie der App-Scanner direkt zur
 * passenden Seite – Spule → Schnellmenü, Lagerort → Einräumen, Slot → Spulenwechsel.
 */
export function CodeRedirect() {
  const out = dispatchScan(window.location.href);
  return <Navigate to={'route' in out ? out.route : '/scan'} replace />;
}
