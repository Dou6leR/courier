import { api } from "@/lib/api";

export interface ClockState {
  now: string;
  overridden: boolean;
}

export const clockApi = {
  get: () => api.get<ClockState>("/debug/now").then((r) => r.data),
  set: (iso: string) =>
    api.put<ClockState>("/debug/now", { now: iso }).then((r) => r.data),
  clear: () => api.delete<ClockState>("/debug/now").then((r) => r.data),
};
