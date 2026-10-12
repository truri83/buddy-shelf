import {
  addCircleOutline,
  albumsOutline,
  discOutline,
  gridOutline,
  locationOutline,
  optionsOutline,
  scaleOutline,
  sunnyOutline,
} from 'ionicons/icons';
import type { ModuleManifest } from '@/core/modules';
import { SpoolDetailPage } from './pages/SpoolDetailPage';
import { WeighSessionPage } from './pages/WeighSessionPage';
import { CoreWeightsPage } from './pages/CoreWeightsPage';
import { DisplaySettingsPage } from './pages/DisplaySettingsPage';
import { DryingSettingsPage } from './pages/DryingSettingsPage';
import { LocationsPage } from './pages/LocationsPage';
import { StowPage } from './pages/StowPage';
import { SlotPage } from './pages/SlotPage';
import { SlotsPage } from './pages/SlotsPage';
import { SpoolListPage } from './pages/SpoolListPage';
import { SpoolFormPage } from './pages/SpoolFormPage';

export const spoolsModule: ModuleManifest = {
  id: 'spools',
  title: 'nav.spools',
  icon: albumsOutline,
  stage: 1,
  routes: [
    { path: '/spools', component: SpoolListPage },
    { path: '/spools/new', component: SpoolFormPage },
    { path: '/spools/:id/edit', component: SpoolFormPage },
    { path: '/more/slots', component: SlotsPage },
    { path: '/spools/weigh', component: WeighSessionPage },
    { path: '/more/cores', component: CoreWeightsPage },
    { path: '/more/locations', component: LocationsPage },
    { path: '/more/drying', component: DryingSettingsPage },
    { path: '/more/display', component: DisplaySettingsPage },
    { path: '/spools/stow/:id', component: StowPage },
    { path: '/more/slots/:printer/:ams/:tray', component: SlotPage },
    { path: '/spools/:id', component: SpoolDetailPage },
  ],
  tab: { order: 2, href: '/spools' },
  quickActions: [
    { id: 'spools.add', label: 'spools.action.add', icon: addCircleOutline, href: '/spools/new' },
    { id: 'spools.weigh', label: 'weighs.action', icon: scaleOutline, href: '/spools/weigh' },
    { id: 'spools.locations', label: 'locations.title', icon: locationOutline, href: '/more/locations', group: 'setup' },
    { id: 'spools.slots', label: 'spools.action.slots', icon: gridOutline, href: '/more/slots', group: 'setup' },
    { id: 'spools.cores', label: 'cores.action', icon: discOutline, href: '/more/cores', group: 'setup' },
    { id: 'spools.drying', label: 'drySet.title', icon: sunnyOutline, href: '/more/drying', group: 'setup' },
    { id: 'spools.display', label: 'display.title', icon: optionsOutline, href: '/more/display', group: 'setup' },
  ],
  // SP-17: Spule → Schnellmenü, Lagerort → Einräumen; SP-08: Slot-Etikett öffnet den Doppelscan
  scan: (r) =>
    r.kind === 'spool'
      ? `/spools/${r.spoolId}?action=quick`
      : r.kind === 'location'
        ? `/spools/stow/${r.locationId}`
        : r.kind === 'slot'
          ? `/more/slots/${r.printerId}/${r.amsId}/${r.trayId}`
          : r.kind === 'gtin'
            ? `/spools/new?gtin=${r.code}`
            : null,
  requires: { api: ['inventory:read'], platform: [], optional: ['scanner', 'printer.bluetooth', 'printer.usb', 'nfc'] },
  events: { emits: ['spool.assigned', 'spool.moved', 'spool.weighed', 'spool.created'] },
};
