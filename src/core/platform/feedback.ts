import { haptic } from './haptics';
import { storage } from './storage';

/*
 * Rückmeldung bei einem erkannten Code: kurzer Piepton (abschaltbar) + Vibration, wo der Browser sie kann.
 * iPhone: Safari erlaubt Vibration im Web nur bei einem echten Fingertipp, nicht beim automatischen
 * Erkennen – dort bleibt der Ton. Ton geht erst nach der ersten Berührung (iOS-Vorgabe), daher unlockAudio().
 */

const SOUND_KEY = 'feedback.sound';
let ctx: AudioContext | null = null;

export const scanSoundEnabled = () => storage.get<boolean>(SOUND_KEY, true);
export const setScanSound = (on: boolean) => storage.set(SOUND_KEY, on);

function audio(): AudioContext | null {
  const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

/**
 * Ton freischalten. iOS erlaubt das nur in einem echten Aktivierungs-Ereignis (Loslassen/Klick, nicht
 * pointerdown). Die Zuhörer bleiben, bis der Ton läuft; nach Anruf/Siri/Hintergrund wird neu freigeschaltet.
 */
export function unlockAudio(): void {
  const events = ['pointerup', 'touchend', 'click', 'keydown'] as const;
  const tryResume = () => {
    const a = audio();
    if (!a) return;
    if (a.state === 'running') return detach();
    void a.resume().then(() => a.state === 'running' && detach());
  };
  const attach = () => events.forEach((e) => window.addEventListener(e, tryResume, { capture: true, passive: true }));
  const detach = () => events.forEach((e) => window.removeEventListener(e, tryResume, { capture: true }));
  attach();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state !== 'running') attach();
  });
}

function beep(freq: number, ms: number, when = 0) {
  const a = audio();
  if (!a) return;
  // nach einer Unterbrechung (iOS: „interrupted“) still neu versuchen – beim nächsten Mal klappt es
  if (a.state !== 'running') return void a.resume().catch(() => undefined);
  const t = a.currentTime + when;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // weiches Ein-/Ausblenden, leise – kein Klicken
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

/** Code erkannt: heller Piep. (Vibration lösen die Seiten selbst aus, sobald sie den Code verarbeitet haben.) */
export function scanFeedback(): void {
  if (scanSoundEnabled()) beep(1568, 80);
}

/** Etwas stimmt nicht (unbekannter Code): zwei tiefe Töne. */
export function warnFeedback(): void {
  haptic('warning');
  if (scanSoundEnabled()) {
    beep(440, 90);
    beep(440, 90, 0.14);
  }
}
