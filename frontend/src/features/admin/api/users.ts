import { api } from "@/lib/api";
import type { AdminUser, AdminUsersFilter } from "../types";

export const adminUsersApi = {
  list: (filters: AdminUsersFilter = {}) =>
    api
      .get<AdminUser[]>("/admins/users", {
        params: {
          role: filters.role ?? "all",
          search: filters.search || undefined,
          limit: filters.limit,
          offset: filters.offset,
        },
      })
      .then((r) => r.data),

  setStatus: (id: number, is_active: boolean) =>
    api
      .patch<AdminUser>(`/admins/users/${id}/status`, { is_active })
      .then((r) => r.data),
};
