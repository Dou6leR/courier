export type OrderStatus =
  | "pending"
  | "assigned"
  | "picked_up"
  | "delivered"
  | "cancelled";

export type PaymentMethod = "cash" | "card" | "online";

export interface Address {
  id: number;
  city: string;
  street: string;
  building: string;
  apartment?: string | null;
  lat: number;
  lon: number;
}

export interface AddressInput {
  city: string;
  street: string;
  building: string;
  apartment?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  method: PaymentMethod;
  paid_at: string | null;
  refunded_at?: string | null;
}

export interface SupportContact {
  phone: string;
}

export interface Review {
  id: number;
  order_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
}

import type { Transport } from "@/features/courier/types";

export interface CourierBrief {
  id: number;
  user_id: number;
  full_name: string;
  phone: string | null;
  rating_avg: number | null;
  transport?: Transport | null;
  last_known_lat?: number | null;
  last_known_lon?: number | null;
  last_location_at?: string | null;
}

export interface Order {
  id: number;
  status: OrderStatus;
  is_confirmed: boolean;
  created_by_user_id: number;
  sender_user_id: number;
  recipient_user_id: number;
  sender_full_name?: string | null;
  recipient_full_name?: string | null;
  sender_phone?: string | null;
  recipient_phone?: string | null;
  weight: number;
  volume: number;
  special_instructions?: string | null;
  requested_pickup_from: string;
  requested_pickup_to: string;
  estimated_pickup_time?: string | null;
  estimated_delivery_time?: string | null;
  actual_pickup_time?: string | null;
  actual_delivery_time?: string | null;
  created_at: string;
  pickup_address: Address;
  delivery_address: Address;
  courier?: CourierBrief | null;
  payment?: Payment | null;
  review?: Review | null;
}

export interface OrderCreatePayload {
  my_role: "sender" | "recipient";
  counterparty_phone: string;
  weight: number;
  volume: number;
  special_instructions?: string;
  requested_pickup_from: string;
  pickup_address: AddressInput;
  delivery_address: AddressInput;
  payment_method: PaymentMethod;
}

export interface ReceiptItem {
  label: string;
  amount: number;
}

export interface Receipt {
  order_id: number;
  items: ReceiptItem[];
  total: number;
  method: PaymentMethod;
  paid_at: string | null;
  issued_at: string;
}

export interface UserUpdatePayload {
  full_name?: string;
  phone?: string;
  email?: string;
}

export interface ReviewCreatePayload {
  rating: number;
  comment?: string;
}

export type OrderRoleFilter = "sender" | "recipient" | "any";
export type OrderPeriodFilter = "last_month" | "all";

export interface OrdersListFilters {
  role?: OrderRoleFilter;
  period?: OrderPeriodFilter;
  status?: OrderStatus;
  archived?: boolean;
  exclude_awaiting_my_confirmation?: boolean;
  limit?: number;
  offset?: number;
}

export interface OrderConfirmPayload {
  pickup_address?: AddressInput;
  delivery_address?: AddressInput;
}
