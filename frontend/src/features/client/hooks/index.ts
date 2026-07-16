import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ordersApi } from "../api/orders";
import { reviewsApi } from "../api/reviews";
import { profileApi } from "../api/profile";
import { supportApi } from "../api/support";
import type {
  OrderConfirmPayload,
  OrderCreatePayload,
  OrdersListFilters,
  ReviewCreatePayload,
  UserUpdatePayload,
} from "../types";

export const ORDERS_PAGE_SIZE = 4;

const ORDERS_MINE_KEY = ["orders", "mine"] as const;

export function useMyOrders(filters: OrdersListFilters = {}) {
  return useQuery({
    queryKey: [...ORDERS_MINE_KEY, filters],
    queryFn: () => ordersApi.listMine(filters),
  });
}

export function useMyOrdersInfinite(
  filters: Omit<OrdersListFilters, "limit" | "offset"> = {},
) {
  return useInfiniteQuery({
    queryKey: [...ORDERS_MINE_KEY, "infinite", filters],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      ordersApi.listMine({
        ...filters,
        limit: ORDERS_PAGE_SIZE,
        offset: pageParam as number,
      }),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < ORDERS_PAGE_SIZE
        ? undefined
        : allPages.length * ORDERS_PAGE_SIZE,
  });
}

export function useOrder(id: number | null | undefined) {
  return useQuery({
    queryKey: ["orders", "detail", id],
    queryFn: () => ordersApi.get(id as number),
    enabled: id != null && !Number.isNaN(id),
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status === "assigned" || status === "picked_up" ? 5000 : false;
    },
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrderCreatePayload) => ordersApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_MINE_KEY });
    },
  });
}

export function useConfirmOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & OrderConfirmPayload) =>
      ordersApi.confirm(id, body),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ORDERS_MINE_KEY });
      qc.invalidateQueries({ queryKey: ["orders", "detail", order.id] });
    },
  });
}

export function usePayOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => ordersApi.pay(id),
    onSuccess: (_payment, id) => {
      qc.invalidateQueries({ queryKey: ORDERS_MINE_KEY });
      qc.invalidateQueries({ queryKey: ["orders", "detail", id] });
    },
  });
}

export function useReceipt(id: number | null | undefined) {
  return useQuery({
    queryKey: ["orders", "receipt", id],
    queryFn: () => ordersApi.receipt(id as number),
    enabled: id != null && !Number.isNaN(id),
  });
}

export function useCreateReview(orderId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: ReviewCreatePayload) => reviewsApi.create(orderId, dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ORDERS_MINE_KEY });
      qc.invalidateQueries({ queryKey: ["orders", "detail", orderId] });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: UserUpdatePayload) => profileApi.updateMe(dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useSupportContact(enabled = true) {
  return useQuery({
    queryKey: ["support", "contact"],
    queryFn: () => supportApi.getContact(),
    enabled,
    staleTime: Infinity,
  });
}
