import { api } from "@/lib/api";
import type {
  LoginPayload,
  RegisterClientPayload,
  RegisterCourierPayload,
  TokenOut,
  UserMe,
} from "./types";

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<TokenOut>("/auth/login", payload).then((r) => r.data),

  registerClient: (payload: RegisterClientPayload) =>
    api.post<TokenOut>("/auth/register/client", payload).then((r) => r.data),

  registerCourier: (payload: RegisterCourierPayload) =>
    api.post<TokenOut>("/auth/register/courier", payload).then((r) => r.data),

  refresh: () => api.post<TokenOut>("/auth/refresh").then((r) => r.data),

  logout: () => api.post<void>("/auth/logout").then((r) => r.data),

  me: () => api.get<UserMe>("/auth/me").then((r) => r.data),
};
