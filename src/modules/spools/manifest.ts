import { addCircleOutline, albumsOutline, gridOutline } from 'ionicons/icons';
import type { ModuleManifest } from '@/core/modules';
import { SpoolDetailPage } from './pages/SpoolDetailPage';
import { SlotPage } from './pages/SlotPage';
import { SlotsPage } from './pages/SlotsPage';
import { SpoolListPage } from './pages/SpoolListPage';
import { SpoolNewPage } from './pages/SpoolNewPage';

export const spoolsModule: ModuleManifest = {
  id: 'spools',
  title: 'nav.spools',
  icon: albumsOutline,
  stage: 1,
  routes: [
    { path: '/spools', component: SpoolListPage },
    { path: '/spools/new', component: SpoolNewPage },
    { path: '/spools/slots', component: SlotsPage },
    { path: '/spools/slot/:printer/:ams/:tray', component: SlotPage },
    { path: '/spools/:id', component: SpoolDetailPage },
  ],
  tab: { order: 2, href: '/spools' },
  quickActions: [
    { id: 'spools.add', label: 'spools.action.add', icon: addCircleOutline, href: '/spools/new' },
    { id: 'spools.slots', label: 'spools.action.slots', icon: gridOutline, href: '/spools/slots' },
  ],
  // SP-08: Slot-Etikett öffnet den Doppelscan
  scan: (r) => (r.kind === 'spool' ? `/spools/${r.spoolId}` : r.kind === 'slot' ? `/spools/slot/${r.printerId}/${r.amsId}/${r.trayId}` : null),
  requires: { api: ['inventory:read'], platform: [], optional: ['scanner', 'printer.bluetooth', 'printer.usb', 'nfc'] },
  events: { emits: ['spool.assigned', 'spool.moved', 'spool.weighed', 'spool.created'] },
};
