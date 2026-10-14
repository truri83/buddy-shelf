import { scaleOutline, sunnyOutline } from 'ionicons/icons';

/** Abläufe mit eigenem Etikett: Scannen startet sie direkt. Neue Abläufe einfach hier ergänzen. */
export interface Workflow {
  /** steht im QR-Code (bm:w:<id> bzw. <app>/w/<id>) – nie ändern */
  id: string;
  icon: string;
  title: string;
  hint: string;
  route: string;
}

export const WORKFLOWS: Workflow[] = [
  { id: 'weigh', icon: scaleOutline, title: 'workflows.weigh', hint: 'workflows.weighHint', route: '/spools/weigh' },
  { id: 'dry', icon: sunnyOutline, title: 'workflows.dry', hint: 'workflows.dryHint', route: '/spools/dry' },
];

export const workflowRoute = (id: string) => WORKFLOWS.find((w) => w.id === id)?.route ?? null;
