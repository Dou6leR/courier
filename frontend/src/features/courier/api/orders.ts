import { api } from "@/lib/api";
import type { OrderStatus } from "@/features/client/types";
import type { CourierOrder, CourierOrdersFilter } from "../types";

export const courierOrdersApi = {
  listMine: (filter: CourierOrdersFilter & { limit?: number; offset?: number } = {}) =>
    api
      .get<CourierOrder[]>("/couriers/orders/mine", {
        params: {
          scope: filter.scope ?? "today",
          status: filter.status,
          period: filter.period ?? "all",
          limit: filter.limit,
          offset: filter.offset,
        },
      })
      .then((r) => r.data),

  get: (id: number) =>
    api.get<CourierOrder>(`/couriers/orders/${id}`).then((r) => r.data),

  updateStatus: (id: number, status: OrderStatus) =>
    api
      .post<CourierOrder>(`/couriers/orders/${id}/status`, { status })
      .then((r) => r.data),
};
