/** Materialfamilie → Token. Die Filamentfarbe selbst erscheint nur in Farbring und Füllbalken. */
export function materialToken(material: string): string {
  const m = material.toUpperCase();
  if (m.startsWith('PLA')) return 'var(--bs-mat-pla)';
  if (m.startsWith('PETG') || m.startsWith('PET')) return 'var(--bs-mat-petg)';
  if (m.startsWith('ASA')) return 'var(--bs-mat-asa)';
  if (m.startsWith('ABS')) return 'var(--bs-mat-abs)';
  if (m.startsWith('TPU') || m.startsWith('TPE')) return 'var(--bs-mat-tpu)';
  if (m.startsWith('PA') || m.includes('NYLON')) return 'var(--bs-mat-pa)';
  return 'var(--bs-mat-other)';
}

/** RRGGBBAA aus Bambuddy → CSS-Farbe; ohne Angabe neutral. */
export function rgbaToCss(rgba: string | null | undefined): string {
  if (!rgba || !/^[0-9a-fA-F]{6,8}$/.test(rgba)) return 'var(--bs-surface-2)';
  return `#${rgba.slice(0, 6)}`;
}
