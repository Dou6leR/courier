import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { adminAnalyticsApi } from "../api/analytics";
import { adminOrdersApi } from "../api/orders";
import { adminUsersApi } from "../api/users";
import type {
  AdminOrdersFilter,
  AdminUsersFilter,
  DateRange,
} from "../types";

const PAGE_SIZE = 20;
const ADMIN_USERS_KEY = ["admin", "users"] as const;
const ADMIN_ORDERS_KEY = ["admin", "orders"] as const;
const ADMIN_ANALYTICS_KEY = ["admin", "analytics"] as const;

export function useAdminUsers(filters: AdminUsersFilter = {}) {
  return useQuery({
    queryKey: [...ADMIN_USERS_KEY, filters],
    queryFn: () => adminUsersApi.list(filters),
  });
}

export function useInfiniteAdminUsers(filters: Omit<AdminUsersFilter, "limit" | "offset"> = {}) {
  return useInfiniteQuery({
    queryKey: [...ADMIN_USERS_KEY, "infinite", filters],
    queryFn: ({ pageParam = 0 }) =>
      adminUsersApi.list({ ...filters, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPageParam + PAGE_SIZE,
  });
}

export function useToggleUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      adminUsersApi.setStatus(id, is_active),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ADMIN_USERS_KEY });
    },
  });
}

export function useAdminOrders(filters: AdminOrdersFilter = {}) {
  return useQuery({
    queryKey: [...ADMIN_ORDERS_KEY, filters],
    queryFn: () => adminOrdersApi.list(filters),
  });
}

export function useInfiniteAdminOrders(filters: Omit<AdminOrdersFilter, "limit" | "offset"> = {}) {
  return useInfiniteQuery({
    queryKey: [...ADMIN_ORDERS_KEY, "infinite", filters],
    queryFn: ({ pageParam = 0 }) =>
      adminOrdersApi.list({ ...filters, limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < PAGE_SIZE ? undefined : lastPageParam + PAGE_SIZE,
  });
}

export function useAdminOrder(id: number | null | undefined) {
  return useQuery({
    queryKey: ["admin", "orders", "detail", id],
    queryFn: () => adminOrdersApi.get(id as number),
    enabled: id != null && !Number.isNaN(id),
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminOrdersApi.cancel(id),
    onSuccess: (detail, id) => {
      qc.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ["admin", "orders", "detail", id] });
      if (detail?.id) {
        qc.invalidateQueries({ queryKey: ["admin", "orders", "detail", detail.id] });
      }
    },
  });
}

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => adminOrdersApi.refund(id),
    onSuccess: (detail, id) => {
      qc.invalidateQueries({ queryKey: ADMIN_ORDERS_KEY });
      qc.invalidateQueries({ queryKey: ["admin", "orders", "detail", id] });
      if (detail?.id) {
        qc.invalidateQueries({ queryKey: ["admin", "orders", "detail", detail.id] });
      }
    },
  });
}

export function useAdminSummary(range: DateRange = {}) {
  return useQuery({
    queryKey: [...ADMIN_ANALYTICS_KEY, "summary", range],
    queryFn: () => adminAnalyticsApi.summary(range),
  });
}

export function useAdminDaily(range: DateRange = {}) {
  return useQuery({
    queryKey: [...ADMIN_ANALYTICS_KEY, "daily", range],
    queryFn: () => adminAnalyticsApi.daily(range),
  });
}
