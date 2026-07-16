import type { Order } from "@/features/client/types";

export interface DeliveryWindow {
  from: Date;
  to: Date;
}

export function computeDeliveryWindow(order: Order): DeliveryWindow {
  return {
    from: new Date(order.requested_pickup_from),
    to: new Date(order.requested_pickup_to),
  };
}
