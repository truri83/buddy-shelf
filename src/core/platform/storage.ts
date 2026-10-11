/**
 * Kleiner Schlüssel-Wert-Speicher. Web: localStorage (abgesichert).
 * Native Phase: Capacitor Preferences / Secure Storage für Schlüssel (siehe docs/ARCHITEKTUR.md).
 */
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(`bs:${key}`);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`bs:${key}`, JSON.stringify(value));
    } catch {
      /* privater Modus o. Ä. – App läuft ohne Speicher weiter */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(`bs:${key}`);
    } catch {
      /* ignorieren */
    }
  },
};
