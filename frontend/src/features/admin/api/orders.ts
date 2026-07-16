import { api } from "@/lib/api";
import type {
  AdminOrder,
  AdminOrderDetail,
  AdminOrdersFilter,
} from "../types";

export const adminOrdersApi = {
  list: (filters: AdminOrdersFilter = {}) =>
    api
      .get<AdminOrder[]>("/admins/orders", {
        params: {
          status: filters.status ?? "all",
          search: filters.search || undefined,
          limit: filters.limit,
          offset: filters.offset,
        },
      })
      .then((r) => r.data),

  get: (id: number) =>
    api.get<AdminOrderDetail>(`/admins/orders/${id}`).then((r) => r.data),

  cancel: (id: number) =>
    api.post<AdminOrderDetail>(`/admins/orders/${id}/cancel`).then((r) => r.data),

  refund: (id: number) =>
    api.post<AdminOrderDetail>(`/admins/orders/${id}/refund`).then((r) => r.data),
};
