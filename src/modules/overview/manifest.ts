import { homeOutline } from 'ionicons/icons';
import type { ModuleManifest } from '@/core/modules';
import { OverviewPage } from './pages/OverviewPage';

export const overviewModule: ModuleManifest = {
  id: 'overview',
  title: 'nav.overview',
  icon: homeOutline,
  stage: 1,
  routes: [{ path: '/overview', component: OverviewPage }],
  tab: { order: 1, href: '/overview' },
  requires: { api: ['inventory:read'] },
};
