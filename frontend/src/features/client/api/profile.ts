import { api } from "@/lib/api";
import type { UserMe } from "@/features/auth/types";
import type { UserUpdatePayload } from "../types";

export interface PhoneCheckResult {
  exists: boolean;
  reason?: "not_found" | "self" | "not_client";
  full_name?: string;
}

export const profileApi = {
  updateMe: (dto: UserUpdatePayload) =>
    api.patch<UserMe>("/users/me", dto).then((r) => r.data),
  checkPhone: (phone: string) =>
    api
      .get<PhoneCheckResult>("/users/check-phone", { params: { phone } })
      .then((r) => r.data),
};
