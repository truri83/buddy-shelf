import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { bambuddy, type PrinterStatus, type SpoolCreate, type SpoolUpdate } from '@/core/api';
import { buildSlots, staleAssignments, type Slot } from '../slots';

export const spoolKeys = {
  all: ['spools'] as const,
  one: (id: number) => ['spools', id] as const,
  locations: ['locations'] as const,
  assignments: ['assignments'] as const,
  printers: ['printers'] as const,
  printerStatus: (id: number) => ['printers', id, 'status'] as const,
  catalog: ['catalog'] as const,
  colors: (manufacturer: string, material: string) => ['colors', manufacturer, material] as const,
};

export function useSpools() {
  return useQuery({ queryKey: spoolKeys.all, queryFn: bambuddy.spools.list });
}

export function useSpool(id: number) {
  return useQuery({ queryKey: spoolKeys.one(id), queryFn: () => bambuddy.spools.get(id), enabled: id > 0 });
}

export function useLocations() {
  return useQuery({ queryKey: spoolKeys.locations, queryFn: bambuddy.locations.list });
}

export function useAssignments() {
  return useQuery({ queryKey: spoolKeys.assignments, queryFn: bambuddy.assignments.list });
}

/** Alle Slots aller Drucker (Drucker → Status je Drucker → Zuweisungen). */
export function useSlots() {
  const printers = useQuery({ queryKey: spoolKeys.printers, queryFn: bambuddy.printers.list });
  const assignments = useAssignments();
  // combine liefert strukturell geteilte (stabile) Ergebnisse
  const statuses = useQueries({
    queries: (printers.data ?? []).map((p) => ({ queryKey: spoolKeys.printerStatus(p.id), queryFn: () => bambuddy.printers.status(p.id), staleTime: 10_000 })),
    combine: (results) => ({ data: results.map((r) => r.data), pending: results.some((r) => r.isPending), failed: results.some((r) => r.isError) }),
  });
  const qc = useQueryClient();
  const slots = useMemo(() => {
    const byId: Record<number, PrinterStatus | undefined> = {};
    (printers.data ?? []).forEach((p, i) => (byId[p.id] = statuses.data[i]));
    return buildSlots(printers.data ?? [], byId, assignments.data ?? []);
  }, [printers.data, assignments.data, statuses.data]);
  return {
    slots,
    printers: printers.data ?? [],
    isPending: printers.isPending || assignments.isPending || statuses.pending,
    isError: printers.isError || assignments.isError,
    /** Ein Drucker liefert gerade keinen Status (nicht erreichbar) */
    statusError: statuses.failed,
    refetch: () => Promise.all([printers.refetch(), assignments.refetch(), qc.invalidateQueries({ queryKey: spoolKeys.printers })]),
  };
}

/** Nach Schreibvorgängen alles Betroffene neu laden. */
function useRefresh() {
  const qc = useQueryClient();
  return (spoolId?: number) => {
    void qc.invalidateQueries({ queryKey: spoolKeys.all });
    void qc.invalidateQueries({ queryKey: spoolKeys.locations });
    void qc.invalidateQueries({ queryKey: spoolKeys.assignments });
    if (spoolId) void qc.invalidateQueries({ queryKey: spoolKeys.one(spoolId) });
  };
}

/** SP-12: Lagerort für mehrere Spulen auf einmal. */
export function useBulkMove() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ ids, locationId }: { ids: number[]; locationId: number | null }) => bambuddy.spools.bulkUpdate(ids, { location_id: locationId }),
    onSuccess: () => refresh(),
  });
}

/** SP-12: mehrere Spulen archivieren. */
export function useBulkArchive() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (ids: number[]) => bambuddy.spools.bulkArchive(ids), onSuccess: () => refresh() });
}

/** SP-04: Lagerort setzen (null = ohne Lagerort). */
export function useMoveSpool() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ spoolId, locationId }: { spoolId: number; locationId: number | null }) => bambuddy.spools.update(spoolId, { location_id: locationId }),
    onSuccess: (_d, v) => refresh(v.spoolId),
  });
}

export function useCreateLocation() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (name: string) => bambuddy.locations.create({ name }), onSuccess: () => refresh() });
}

/** SP-05: Bruttogewicht von der Waage über Bambuddys Waagen-Endpunkt. */
export function useWeighSpool() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ spoolId, gross }: { spoolId: number; gross: number }) => bambuddy.spools.weigh(spoolId, gross),
    onSuccess: (_d, v) => refresh(v.spoolId),
  });
}

/**
 * SP-03/SP-08: Spule in einen Slot legen. Alte Zuweisungen derselben Spule werden vorher entfernt
 * (Bambuddy erlaubt sonst dieselbe Spule in zwei Slots); einen belegten Ziel-Slot ersetzt Bambuddy selbst.
 */
export function useAssignSpool() {
  const refresh = useRefresh();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ spoolId, slot }: { spoolId: number; slot: Pick<Slot, 'printerId' | 'amsId' | 'trayId'> }) => {
      const current = await bambuddy.assignments.list();
      // erst den neuen Slot belegen – scheitert das, bleibt die Spule in ihrem alten Slot
      const created = await bambuddy.assignments.create({ spool_id: spoolId, printer_id: slot.printerId, ams_id: slot.amsId, tray_id: slot.trayId });
      for (const a of staleAssignments(spoolId, slot, current)) {
        await bambuddy.assignments.remove(a.printer_id, a.ams_id, a.tray_id);
      }
      return created;
    },
    onSuccess: (_d, v) => {
      refresh(v.spoolId);
      void qc.invalidateQueries({ queryKey: spoolKeys.printers });
    },
  });
}

/** SP-13: Bambu-Spule aus dem RFID im Slot anlegen (Bambuddy weist sie gleich zu). */
export function useAdoptFromSlot() {
  const refresh = useRefresh();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (slot: Pick<Slot, 'printerId' | 'amsId' | 'trayId'>) =>
      bambuddy.spools.fromSlot({ printer_id: slot.printerId, ams_id: slot.amsId, tray_id: slot.trayId }),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: spoolKeys.printers });
    },
  });
}

/** Spule aus dem Slot nehmen (Zuweisung löschen). */
export function useUnassign() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (slot: Pick<Slot, 'printerId' | 'amsId' | 'trayId'>) => bambuddy.assignments.remove(slot.printerId, slot.amsId, slot.trayId),
    onSuccess: () => refresh(),
  });
}

/** SP-07: mehrere gleiche Spulen anlegen. */
export function useCreateSpools() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ spool, quantity }: { spool: SpoolCreate; quantity: number }) => bambuddy.spools.createMany(spool, quantity),
    onSuccess: () => refresh(),
  });
}

/** Spule bearbeiten (SP-07b). */
export function useUpdateSpool() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ spoolId, patch }: { spoolId: number; patch: SpoolUpdate }) => bambuddy.spools.update(spoolId, patch),
    onSuccess: (_d, v) => refresh(v.spoolId),
  });
}

/** Spule archivieren (Inventur: nicht gefunden). */
export function useArchiveSpool() {
  const refresh = useRefresh();
  return useMutation({ mutationFn: (spoolId: number) => bambuddy.spools.archive(spoolId), onSuccess: (_d, id) => refresh(id) });
}

/** Filament-Datenbank (SpoolmanDB über /catalog). Fehler sind nicht schlimm – dann eben Freitext. */
const DB_STALE = 6 * 60 * 60_000;
export function useDbManufacturers(enabled: boolean) {
  return useQuery({ queryKey: ['filamentDb', 'manufacturers'], queryFn: bambuddy.filamentDb.manufacturers, staleTime: DB_STALE, enabled, retry: false });
}
export function useDbMaterials(manufacturer: string, enabled: boolean) {
  return useQuery({
    queryKey: ['filamentDb', 'materials', manufacturer],
    queryFn: () => bambuddy.filamentDb.materials(manufacturer || undefined),
    staleTime: DB_STALE,
    enabled,
    retry: false,
  });
}
/** Packungs-Barcode → Filament (Open Filament Database) */
export function useGtin(code: string) {
  return useQuery({ queryKey: ['filamentDb', 'gtin', code], queryFn: () => bambuddy.filamentDb.gtin(code), enabled: !!code, staleTime: DB_STALE, retry: false });
}

export function useDbFilaments(manufacturer: string, material: string) {
  return useQuery({
    queryKey: ['filamentDb', 'filaments', manufacturer, material],
    queryFn: () => bambuddy.filamentDb.filaments({ manufacturer, material }),
    staleTime: DB_STALE,
    enabled: !!manufacturer && !!material,
    retry: false,
  });
}

/** SP-10: Leerspulen-Katalog pflegen */
export function useCatalogMutations() {
  const qc = useQueryClient();
  const done = () => void qc.invalidateQueries({ queryKey: spoolKeys.catalog });
  return {
    add: useMutation({ mutationFn: bambuddy.catalog.addSpool, onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, ...e }: { id: number; name: string; weight: number }) => bambuddy.catalog.updateSpool(id, e), onSuccess: done }),
    remove: useMutation({ mutationFn: bambuddy.catalog.removeSpool, onSuccess: done }),
  };
}

export function useDbSpoolWeights(enabled: boolean) {
  return useQuery({ queryKey: ['filamentDb', 'spools'], queryFn: bambuddy.filamentDb.spoolWeights, staleTime: DB_STALE, enabled, retry: false });
}

export function useCatalog() {
  return useQuery({ queryKey: spoolKeys.catalog, queryFn: bambuddy.catalog.spools, staleTime: 60 * 60_000 });
}

export function useColors(manufacturer: string, material: string) {
  return useQuery({
    queryKey: spoolKeys.colors(manufacturer, material),
    queryFn: () => bambuddy.catalog.colors({ manufacturer, material }),
    enabled: !!(manufacturer || material),
    staleTime: 60 * 60_000,
  });
}
