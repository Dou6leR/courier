import { api } from "@/lib/api";
import type { Review, ReviewCreatePayload } from "../types";

export const reviewsApi = {
  create: (orderId: number, dto: ReviewCreatePayload) =>
    api
      .post<Review>(`/orders/${orderId}/reviews`, dto)
      .then((r) => r.data),
};
