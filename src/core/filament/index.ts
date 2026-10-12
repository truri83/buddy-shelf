/** Fachwissen über Filament, das mehrere Module brauchen (Materialfamilie, Trocknung). */
export {
  DEFAULT_DRYING,
  daysSince,
  dryingAdvice,
  dryingDue,
  mergeDrying,
  todayIso,
  type DryingAdvice,
  type DryingConfig,
  type DryingDue,
  type DryingRow,
  type StorageKind,
} from './drying';
export { FAMILIES, materialFamily, materialVariant, type MaterialFamily } from './material';
export { useDryingConfig, useSaveDryingConfig } from './useDryingConfig';
