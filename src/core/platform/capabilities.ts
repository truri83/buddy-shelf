/**
 * Fähigkeiten statt Plattformweichen (Regel 4). Module fragen `can('…')`,
 * welcher Adapter dahinter steckt (Web, Capacitor, Tauri), entscheidet allein der Kern.
 */
export type Capability =
  | 'scanner'
  | 'printer.bluetooth'
  | 'printer.usb'
  | 'printer.service'
  | 'nfc'
  | 'push'
  | 'share'
  | 'haptics';

type Detector = () => boolean;

const hasWindow = typeof window !== 'undefined';
const nav = (hasWindow ? navigator : undefined) as (Navigator & Record<string, unknown>) | undefined;

const detectors: Record<Capability, Detector> = {
  scanner: () => !!nav?.mediaDevices?.getUserMedia,
  'printer.bluetooth': () => !!nav && 'bluetooth' in nav,
  'printer.usb': () => !!nav && 'serial' in nav,
  // Wird true, sobald ein Druckdienst (niimblue-node) konfiguriert ist – siehe server/.
  'printer.service': () => false,
  nfc: () => hasWindow && 'NDEFReader' in window,
  push: () => hasWindow && 'PushManager' in window && 'serviceWorker' in (nav ?? {}),
  share: () => !!nav && 'share' in nav,
  haptics: () => !!nav && 'vibrate' in nav,
};

const overrides = new Map<Capability, boolean>();

export function can(cap: Capability): boolean {
  return overrides.get(cap) ?? detectors[cap]();
}

/** Für native Adapter und Tests: Fähigkeit fest setzen. */
export function setCapability(cap: Capability, value: boolean): void {
  overrides.set(cap, value);
}

export function canAll(caps: Capability[] = []): boolean {
  return caps.every(can);
}
