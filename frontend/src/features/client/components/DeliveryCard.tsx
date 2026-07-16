import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle,
  Clock,
  Package,
  Star,
} from "lucide-react";
import type { Order } from "../types";

export type DeliveryCardStatus = "in-transit" | "waiting" | "completed";

export type DeliveryCardData = {
  id: string;
  status: DeliveryCardStatus;
  type: string;
  from: string;
  to: string;
  eta: string;
  recipient: string;
  canReview: boolean;
  myReview: { rating: number; comment: string | null } | null;
};

function mapStatus(s: Order["status"]): DeliveryCardStatus {
  if (s === "delivered") return "completed";
  if (s === "pending") return "waiting";
  return "in-transit";
}

function statusEta(o: Order, isConfirmed: boolean): string {
  if (o.status === "delivered") return "Доставлено";
  if (o.status === "cancelled") return "Скасовано";
  if (o.status === "pending" && !isConfirmed) return "Очікує підтвердження";
  if (o.estimated_delivery_time)
    return new Date(o.estimated_delivery_time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (o.status === "pending") return "Шукаємо кур'єра";
  return o.status;
}

export function orderToCardData(
  o: Order,
  currentUserId: number | null | undefined,
): DeliveryCardData {
  const counterpartyName =
    o.sender_user_id === currentUserId
      ? o.recipient_full_name
      : o.sender_full_name;
  return {
    id: String(o.id),
    status: mapStatus(o.status),
    type: "Посилка",
    from: `${o.pickup_address.street}, ${o.pickup_address.building}`,
    to: `${o.delivery_address.street}, ${o.delivery_address.building}`,
    eta: statusEta(o, o.is_confirmed),
    recipient: counterpartyName ?? "—",
    canReview:
      o.status === "delivered" &&
      (o.sender_user_id === currentUserId ||
        o.recipient_user_id === currentUserId) &&
      !o.review,
    myReview: o.review
      ? { rating: o.review.rating, comment: o.review.comment }
      : null,
  };
}

export function DeliveryCard({
  delivery,
  onReview,
}: {
  delivery: DeliveryCardData;
  onReview: (id: number) => void;
}) {
  return (
    <Link
      to={`/client/orders/${delivery.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            delivery.status === "completed"
              ? "bg-green-100"
              : delivery.status === "waiting"
                ? "bg-yellow-100"
                : "bg-blue-100"
          }`}
        >
          {delivery.status === "completed" ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : delivery.status === "waiting" ? (
            <Clock className="w-5 h-5 text-yellow-600" />
          ) : (
            <Package className="w-5 h-5 text-blue-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="text-sm font-semibold text-gray-900">
                {delivery.type} • #{delivery.id}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                Кому: {delivery.recipient}
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </div>

          <div className="space-y-1 mb-2">
            <div className="text-xs text-gray-600 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              {delivery.from}
            </div>
            <div className="text-xs text-gray-600 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              {delivery.to}
            </div>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${
              delivery.status === "completed"
                ? "bg-green-50 text-green-700"
                : delivery.status === "waiting"
                  ? "bg-yellow-50 text-yellow-700"
                  : "bg-blue-50 text-blue-700"
            }`}
          >
            {delivery.status === "completed" && "✓ "}
            {delivery.status === "waiting" && "⏱ "}
            {delivery.status === "in-transit" && "🚗 "}
            {delivery.eta}
          </div>

          {delivery.canReview && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReview(Number(delivery.id));
              }}
              className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-blue-600 text-blue-600 text-xs font-medium hover:bg-blue-50"
            >
              <Star className="w-4 h-4" />
              Залишити відгук
            </button>
          )}

          {delivery.myReview && (
            <div className="mt-3 p-2.5 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-1 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3.5 h-3.5 ${
                      i < delivery.myReview!.rating
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300"
                    }`}
                  />
                ))}
                <span className="ml-1 text-xs text-gray-600">Ваш відгук</span>
              </div>
              {delivery.myReview.comment && (
                <div className="text-xs text-gray-700">
                  «{delivery.myReview.comment}»
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
