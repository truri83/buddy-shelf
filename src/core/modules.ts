import type { ComponentType } from 'react';
import type { ScanResult } from './qr/codes';
import type { Capability } from './platform/capabilities';

/**
 * Modulvertrag. Jedes Modul exportiert über seine index.ts genau ein Manifest.
 * Die Shell baut daraus Navigation, Plus-Menü, Deep Links und Scan-Zuordnung.
 * Ein neues Modul braucht keine Änderung an der Shell – nur einen Eintrag in src/app/registry.ts.
 */
export interface ModuleRoute {
  path: string;
  component: ComponentType;
}

export interface QuickAction {
  id: string;
  /** i18n-Schlüssel */
  label: string;
  icon: string;
  /** Ziel-Route */
  href: string;
}

export interface ModuleManifest {
  id: string;
  /** i18n-Schlüssel */
  title: string;
  icon: string;
  /** Ausbaustufe laut Konzept; Module über der aktiven Stufe werden nicht geladen. */
  stage: number;
  routes: ModuleRoute[];
  /** Platz in der Tab-Leiste (1–4). Ohne Angabe kein Tab. */
  tab?: { order: number; href: string };
  quickActions?: QuickAction[];
  /** Beansprucht einen Scan-Treffer und liefert die Ziel-Route, sonst null. */
  scan?: (result: ScanResult) => string | null;
  requires?: {
    /** Bambuddy-Berechtigungen, z. B. inventory:read (backend/app/core/permissions.py) */
    api?: string[];
    platform?: Capability[];
    optional?: Capability[];
  };
  events?: { listens?: string[]; emits?: string[] };
}
