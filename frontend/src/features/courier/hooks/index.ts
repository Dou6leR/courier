import { useEffect, useRef } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { courierOrdersApi } from "../api/orders";
import { courierApi } from "../api/courier";
import type { CourierOrdersFilter, LocationIn, TransportUpsertIn } from "../types";
import type { OrderStatus } from "@/features/client/types";

const MINE_KEY = ["courier", "orders", "mine"] as const;
const ROUTE_KEY = ["courier", "route"] as const;
const ROUTE_DAYS_KEY = ["courier", "route", "days"] as const;
const ME_KEY = ["courier", "me"] as const;

export function useCourierMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: () => courierApi.getMe(),
  });
}

const COURIER_PAGE_SIZE = 20;

export function useMyCourierOrders(filter: CourierOrdersFilter = {}) {
  return useQuery({
    queryKey: [...MINE_KEY, filter],
    queryFn: () => courierOrdersApi.listMine(filter),
  });
}

export function useMyCourierOrdersInfinite(
  filter: Omit<CourierOrdersFilter, "limit" | "offset"> = {},
) {
  return useInfiniteQuery({
    queryKey: [...MINE_KEY, "infinite", filter],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      courierOrdersApi.listMine({
        ...filter,
        limit: COURIER_PAGE_SIZE,
        offset: pageParam as number,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < COURIER_PAGE_SIZE
        ? undefined
        : allPages.length * COURIER_PAGE_SIZE,
  });
}

export function useCourierOrder(id: number | null | undefined) {
  return useQuery({
    queryKey: ["courier", "order", id],
    queryFn: () => courierOrdersApi.get(id as number),
    enabled: id != null && !Number.isNaN(id),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: OrderStatus }) =>
      courierOrdersApi.updateStatus(id, status),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: MINE_KEY });
      qc.invalidateQueries({ queryKey: ROUTE_KEY });
      qc.invalidateQueries({ queryKey: ROUTE_DAYS_KEY });
      qc.invalidateQueries({ queryKey: ["courier", "order", order.id] });
    },
  });
}

export function useCourierRoute(planDate?: string) {
  const isToday = planDate === undefined;
  return useQuery({
    queryKey: [...ROUTE_KEY, planDate ?? "today"],
    queryFn: () => courierApi.getRoute(planDate),
    refetchInterval: isToday ? 5000 : false,
  });
}

export function useRouteDays() {
  return useQuery({
    queryKey: ROUTE_DAYS_KEY,
    queryFn: () => courierApi.getRouteDays(),
    staleTime: 60_000,
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: LocationIn) => courierApi.updateLocation(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
      qc.invalidateQueries({ queryKey: ROUTE_KEY });
    },
  });
}

export function useSetAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (is_available: boolean) => courierApi.setAvailability(is_available),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
    },
  });
}

export function useUpsertTransport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransportUpsertIn) => courierApi.upsertTransport(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
      qc.invalidateQueries({ queryKey: ROUTE_KEY });
    },
  });
}

export function useRemoveTransport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => courierApi.removeTransport(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ME_KEY });
      qc.invalidateQueries({ queryKey: ROUTE_KEY });
    },
  });
}

/**
 * Tracks browser geolocation and sends updates to backend at most once per 5s.
 * Handles PermissionDenied gracefully (stops tracking silently).
 * Disabled while debugMode=true so manual overrides don't fight the GPS.
 */
export function useLocationTracker(debugMode: boolean = false) {
  const update = useUpdateLocation();
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (debugMode) return;
    if (!("geolocation" in navigator)) return;
    let watchId: number | null = null;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          if (now - lastSentRef.current < 5_000) return;
          lastSentRef.current = now;
          update.mutate({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED && watchId != null) {
            navigator.geolocation.clearWatch(watchId);
          }
        },
        { enableHighAccuracy: false, maximumAge: 5_000, timeout: 15_000 },
      );
    } catch {
      // ignore
    }
    return () => {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugMode]);
}
