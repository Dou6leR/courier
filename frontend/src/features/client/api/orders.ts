import { api } from "@/lib/api";
import type {
  Order,
  OrderConfirmPayload,
  OrderCreatePayload,
  OrdersListFilters,
  Payment,
  Receipt,
} from "../types";

export const ordersApi = {
  create: (payload: OrderCreatePayload) =>
    api.post<Order>("/orders", payload).then((r) => r.data),

  listMine: (filters: OrdersListFilters = {}) =>
    api
      .get<Order[]>("/orders/mine", {
        params: {
          role: filters.role ?? "any",
          period: filters.period ?? "last_month",
          status: filters.status,
          archived: filters.archived,
          exclude_awaiting_my_confirmation:
            filters.exclude_awaiting_my_confirmation,
          limit: filters.limit,
          offset: filters.offset,
        },
      })
      .then((r) => r.data),

  get: (id: number) => api.get<Order>(`/orders/${id}`).then((r) => r.data),

  confirm: (id: number, body?: OrderConfirmPayload) =>
    api
      .post<Order>(`/orders/${id}/confirm`, body ?? {})
      .then((r) => r.data),

  pay: (id: number) =>
    api.post<Payment>(`/orders/${id}/pay`).then((r) => r.data),

  receipt: (id: number) =>
    api.get<Receipt>(`/orders/${id}/receipt`).then((r) => r.data),
};
