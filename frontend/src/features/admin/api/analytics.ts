import { api } from "@/lib/api";
import type {
  AnalyticsDailyItem,
  AnalyticsSummary,
  DateRange,
} from "../types";

export const adminAnalyticsApi = {
  summary: (range: DateRange = {}) =>
    api
      .get<AnalyticsSummary>("/admins/analytics/summary", {
        params: { from: range.from, to: range.to },
      })
      .then((r) => r.data),

  daily: (range: DateRange = {}) =>
    api
      .get<AnalyticsDailyItem[]>("/admins/analytics/daily", {
        params: { from: range.from, to: range.to },
      })
      .then((r) => r.data),
};
