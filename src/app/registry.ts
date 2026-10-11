import type { ModuleManifest } from '@/core/modules';
import { overviewModule } from '@/modules/overview';
import { spoolsModule } from '@/modules/spools';

/** Aktive Ausbaustufe. Module mit höherer Stufe werden nicht geladen. */
export const ACTIVE_STAGE = 1;

/** Einzige Stelle, an der Module registriert werden (Regel 1). */
const ALL: ModuleManifest[] = [overviewModule, spoolsModule];

export const modules = ALL.filter((m) => m.stage <= ACTIVE_STAGE);

export const tabModules = modules.filter((m) => m.tab).sort((a, b) => a.tab!.order - b.tab!.order);
