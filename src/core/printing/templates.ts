import { parseTemplate, type LabelTemplate } from './template';

/**
 * Eingebaute Vorlagen liegen als NiimBlue-Export in `templates/*.json` (50×30-mm-Rolle am B1 Pro,
 * 567 × 354 px bei 300 dpi). Reihenfolge = Dateiname. Eigene Vorlagen kommen vom Server dazu.
 */
const files = import.meta.glob<unknown>('../../../templates/*.json', { eager: true, import: 'default' });

export const BUILTIN_TEMPLATES: LabelTemplate[] = Object.keys(files)
  .sort()
  .map((path) => ({ ...parseTemplate(files[path], path), builtin: true }));
