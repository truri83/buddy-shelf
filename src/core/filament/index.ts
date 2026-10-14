/** Fachwissen über Filament, das mehrere Module brauchen (Materialfamilie, Trocknung, Füllstand-Schwellen). */
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
export {
  DEFAULT_DISPLAY,
  mergeDisplay,
  stockLevel,
  thresholdsFor,
  thresholdsValid,
  type DisplayConfig,
  type StockLevel,
  type StockThresholds,
} from './display';
export { useDisplayConfig, useDisplayConfigQuery, useSaveDisplayConfig } from './useDisplayConfig';
export { moistureState, type MoistureLevel, type MoistureState } from './moisture';
export { cleanSubtype, FAMILIES, materialFamily, materialLabel, materialVariant, type MaterialFamily } from './material';
export { useDryingConfig, useDryingConfigQuery, useSaveDryingConfig } from './useDryingConfig';
