/**
 * iOS öffnet die Tastatur nur, wenn ein Feld direkt aus einem Fingertipp den Fokus bekommt. Blätter fokussieren
 * ihr Feld aber erst nach der Animation → beim Tipp hier ein unsichtbares Feld fokussieren (Tastatur geht mit dem
 * passenden Ziffernblock auf), das echte Feld übernimmt danach den Fokus (`takeKeyboard`).
 */
let proxy: HTMLInputElement | null = null;

export function primeKeyboard(inputMode: 'decimal' | 'numeric' | 'text' = 'decimal'): void {
  if (typeof document === 'undefined') return;
  proxy?.remove();
  const el = document.createElement('input');
  el.setAttribute('inputmode', inputMode);
  el.setAttribute('aria-hidden', 'true');
  el.tabIndex = -1;
  // 16px: sonst zoomt iOS beim Fokus; unsichtbar, aber fokussierbar
  el.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;';
  document.body.appendChild(el);
  el.focus();
  proxy = el;
  setTimeout(() => {
    if (proxy === el) releaseKeyboard();
  }, 4000);
}

/** Das echte Feld hat übernommen (oder kommt nicht) → Platzhalter entfernen. */
export function releaseKeyboard(): void {
  proxy?.remove();
  proxy = null;
}
