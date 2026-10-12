import { archiveOutline, bagHandleOutline, cubeOutline, waterOutline } from 'ionicons/icons';
import type { StorageType } from './newSpool';

/** Symbol je Lagerungsart: OVP, Vakuumbeutel, Trockenbox, offen. */
export const STORAGE_ICONS: Record<StorageType, string> = {
  sealed: cubeOutline,
  bag: bagHandleOutline,
  drybox: archiveOutline,
  open: waterOutline,
};
