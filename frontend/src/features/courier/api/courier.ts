import { api } from "@/lib/api";
import type {
  CourierMe,
  CourierRoute,
  LocationIn,
  RouteDay,
  TransportUpsertIn,
} from "../types";

export const courierApi = {
  getMe: () => api.get<CourierMe>("/couriers/me").then((r) => r.data),

  updateLocation: (payload: LocationIn) =>
    api.post<CourierMe>("/couriers/me/location", payload).then((r) => r.data),

  setAvailability: (is_available: boolean) =>
    api
      .patch<CourierMe>("/couriers/me", { is_available })
      .then((r) => r.data),

  upsertTransport: (payload: TransportUpsertIn) =>
    api.put<CourierMe>("/couriers/me/transport", payload).then((r) => r.data),

  removeTransport: () =>
    api.delete<CourierMe>("/couriers/me/transport").then((r) => r.data),

  getRoute: (planDate?: string) =>
    api
      .get<CourierRoute>("/couriers/me/route", {
        params: planDate ? { date: planDate } : undefined,
      })
      .then((r) => r.data),

  getRouteDays: () =>
    api.get<RouteDay[]>("/couriers/me/route/days").then((r) => r.data),
};
