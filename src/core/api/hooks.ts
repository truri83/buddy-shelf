import { useQuery } from '@tanstack/react-query';
import { bambuddy, inventorySource } from './client';
import type { Permission } from './types';

/** Rechte des Schlüssels bzw. Nutzers (GET /auth/me). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: bambuddy.auth.me, staleTime: 5 * 60_000, retry: false });
}

/** Ist die Anmeldung in Bambuddy eingeschaltet? (ohne Anmeldung liefert /auth/me immer 401) */
/** Wo Bambuddy den Bestand führt: selbst oder in Spoolman. */
export function useInventorySource() {
  return useQuery({ queryKey: ['inventory-source'], queryFn: () => inventorySource(true), staleTime: 60_000 });
}

export function useAuthStatus() {
  return useQuery({ queryKey: ['auth-status'], queryFn: bambuddy.auth.status, staleTime: 5 * 60_000, retry: false });
}

/**
 * Darf der Nutzer das? Solange unbekannt (lädt, oder Bambuddy ohne Anmeldung) gilt ja –
 * Bambuddy prüft jede Änderung ohnehin selbst. Module blenden Aktionen nur bei klarem Nein aus.
 */
export function useAllowed(p: Permission): boolean {
  const me = useMe();
  return me.data ? me.data.permissions.includes(p) : true;
}

/** Mit diesen Bambuddy-Versionen ist die App geprüft (Regel 14). */
export const TESTED_BAMBUDDY = /^1\.2\./;

export function isTestedVersion(v: string): boolean {
  return TESTED_BAMBUDDY.test(v);
}

export function useBambuddyVersion() {
  return useQuery({ queryKey: ['bambuddy-version'], queryFn: bambuddy.version, staleTime: 60 * 60_000, retry: false });
}
