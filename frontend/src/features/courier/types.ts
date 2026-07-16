import type { Order, OrderStatus, Address } from "@/features/client/types";

export type CourierOrderStatus = Exclude<OrderStatus, "pending" | "cancelled">;

export type CourierOrder = Order;

export type OrderScope = "today" | "upcoming" | "all";

export type RoutePointType = "pickup" | "delivery";

export interface RoutePoint {
  type: RoutePointType;
  order_id: number;
  lat: number | null;
  lon: number | null;
  address: Address;
  eta?: string | null;
  travel_min?: number | null;
  payment_method?: string | null;
}

export type TransportType = "bike" | "scooter" | "car" | "van" | "truck";

export const TRANSPORT_TYPE_LABELS: Record<TransportType, string> = {
  bike: "Велосипед",
  scooter: "Скутер",
  car: "Авто",
  van: "Фургон",
  truck: "Вантажівка",
};

export const TRANSPORT_TYPES: TransportType[] = [
  "bike",
  "scooter",
  "car",
  "van",
  "truck",
];

export interface Transport {
  id: number;
  model: string;
  type: TransportType;
  max_weight: number;
  max_volume: number;
}

export interface TransportUpsertIn {
  model: string;
  type: TransportType;
  max_weight: number;
  max_volume: number;
}

export interface CourierMe {
  user_id: number;
  is_available: boolean;
  rating_avg: number;
  transport_id: number | null;
  transport: Transport | null;
  last_known_lat: number | null;
  last_known_lon: number | null;
  last_location_at: string | null;
}

export interface CourierRoute {
  plan_date: string;
  points: RoutePoint[];
  total_distance_m: number;
  total_duration_sec: number;
  base_time?: string | null;
}

export interface RouteDay {
  plan_date: string;
  stops_count: number;
  orders_count: number;
}

export interface CourierOrdersFilter {
  scope?: OrderScope;
  status?: OrderStatus;
  period?: "last_month" | "all";
}

export interface LocationIn {
  lat: number;
  lon: number;
}
