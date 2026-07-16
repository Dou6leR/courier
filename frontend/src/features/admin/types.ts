import type { UserRole } from "@/features/auth/types";
import type { Order, OrderStatus } from "@/features/client/types";

export type AdminOrderStatus = "active" | "completed" | "cancelled";
export type AdminPaymentStatus = "paid" | "refunded" | "processing" | "cancelled";
export type AdminRoleFilter = "client" | "courier" | "admin" | "all";
export type AdminOrderStatusFilter = AdminOrderStatus | "all";

export interface AdminOrder {
  id: number;
  customer: string;
  courier: string | null;
  status: AdminOrderStatus;
  payment_status: AdminPaymentStatus;
  amount: number;
  date: string;
  from: string;
  to: string;
  raw_status: OrderStatus;
  created_at: string;
}

export interface AdminOrderDetail extends AdminOrder {
  order: Order;
}

export interface AdminUser {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  roles: UserRole[];
  is_active: boolean;
  orders_count: number;
  rating: number | null;
}

export interface AdminOrdersFilter {
  status?: AdminOrderStatusFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminUsersFilter {
  role?: AdminRoleFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface AnalyticsSummary {
  revenue: number;
  total_income: number;
  deliveries: number;
  completion_rate: number;
  active_couriers_count: number;
  avg_delivery_time_minutes: number | null;
}

export interface AnalyticsDailyItem {
  date: string;
  deliveries: number;
  revenue: number;
  total_income: number;
}
