import { useQuery } from '@tanstack/react-query';
import { bambuddy } from '@/core/api';

export const spoolKeys = {
  all: ['spools'] as const,
  one: (id: number) => ['spools', id] as const,
  locations: ['locations'] as const,
  assignments: ['assignments'] as const,
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
