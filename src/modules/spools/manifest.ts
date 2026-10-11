import { albumsOutline, addCircleOutline } from 'ionicons/icons';
import type { ModuleManifest } from '@/core/modules';
import { SpoolDetailPage } from './pages/SpoolDetailPage';
import { SpoolListPage } from './pages/SpoolListPage';

export const spoolsModule: ModuleManifest = {
  id: 'spools',
  title: 'nav.spools',
  icon: albumsOutline,
  stage: 1,
  routes: [
    { path: '/spools', component: SpoolListPage },
    { path: '/spools/:id', component: SpoolDetailPage },
  ],
  tab: { order: 2, href: '/spools' },
  quickActions: [{ id: 'spools.add', label: 'Spule hinzufügen', icon: addCircleOutline, href: '/spools' }],
  scan: (r) => (r.kind === 'spool' ? `/spools/${r.spoolId}` : null),
  requires: { api: ['inventory_read'], platform: [], optional: ['scanner', 'printer.bluetooth', 'printer.usb', 'nfc'] },
  events: { emits: ['spool.assigned', 'spool.moved'] },
};
