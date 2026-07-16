import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Package, CreditCard, Receipt as ReceiptIcon, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { useOrder, usePayOrder, useConfirmOrder } from "../hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { OrderStatus } from "../types";
import { LeaveReviewDialog } from "../components/LeaveReviewDialog";
import OrderTrackingMap from "../components/OrderTrackingMap";
import { computeDeliveryWindow } from "../utils/deliveryWindow";
import { TRANSPORT_TYPE_LABELS } from "@/features/courier/types";
import { PhoneButton } from "@/components/common/PhoneButton";

function formatDT(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Очікує",
  assigned: "Призначено кур'єра",
  picked_up: "Забрано, в дорозі",
  delivered: "Доставлено",
  cancelled: "Скасовано",
};

const TRACKING_FLOW: OrderStatus[] = [
  "pending",
  "assigned",
  "picked_up",
  "delivered",
];

export default function OrderDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const orderId = id ? Number(id) : null;
  const { user } = useAuth();
  const { data: order, isLoading, isError } = useOrder(orderId);
  const pay = usePayOrder();
  const confirm = useConfirmOrder();
  const [reviewOpen, setReviewOpen] = useState(false);

  const handlePay = async () => {
    if (!order) return;
    try {
      await pay.mutateAsync(order.id);
      toast.success("Оплачено");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не вдалося оплатити";
      toast.error(msg);
    }
  };

  const handleConfirm = async () => {
    if (!order) return;
    try {
      await confirm.mutateAsync({ id: order.id });
      toast.success("Підтверджено");
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Не вдалося підтвердити";
      toast.error(msg);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          Замовлення {orderId ? `#${orderId}` : ""}
        </h1>
      </div>

      {isLoading && <Skeleton className="h-96 w-full rounded-lg" />}
      {isError && (
        <div className="text-sm text-red-600">Замовлення не знайдено</div>
      )}

      {order && user && (() => {
        const idx = TRACKING_FLOW.indexOf(order.status);
        const stageTime: Record<OrderStatus, string | null> = {
          pending: formatDT(order.created_at),
          assigned: formatDT(order.estimated_pickup_time),
          picked_up:
            formatDT(order.actual_pickup_time) ??
            formatDT(order.estimated_delivery_time),
          delivered: formatDT(order.actual_delivery_time),
          cancelled: null,
        };
        const stages = TRACKING_FLOW.map((s, i) => ({
          key: s,
          label: STATUS_LABEL[s],
          reached: idx >= 0 && i <= idx,
          current: i === idx,
          time: stageTime[s],
        }));
        const showMap =
          (order.status === "assigned" || order.status === "picked_up") &&
          order.pickup_address.lat &&
          order.delivery_address.lat;
        const dw = computeDeliveryWindow(order);
        const windowFmtDate = dw.from.toLocaleDateString("uk-UA", {
          day: "2-digit",
          month: "2-digit",
        });
        const windowFmtTime = (d: Date) =>
          d.toLocaleTimeString("uk-UA", {
            hour: "2-digit",
            minute: "2-digit",
          });
        return (
        <div className="space-y-4">
          {/* Slot banner */}
          <div className="bg-blue-600 text-white rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase opacity-75">
                Вікно доставки
              </div>
              <div className="text-lg font-semibold">
                {windowFmtDate} · {windowFmtTime(dw.from)} - {windowFmtTime(dw.to)}
              </div>
            </div>
            <div className="text-xs opacity-75 text-right">
              весь цикл
              <br />
              (забір + доставка)
            </div>
          </div>

          {/* Live Tracking */}
          <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Замовлення #{order.id}</h3>
                <p className="text-sm text-gray-600">{STATUS_LABEL[order.status]}</p>
              </div>
            </div>

            {showMap ? (
              <div className="mb-4">
                <OrderTrackingMap order={order} />
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg h-20 mb-4 flex items-center justify-center border border-gray-200 text-sm text-gray-500">
                {order.status === "pending"
                  ? "Шукаємо кур'єра…"
                  : "Маршрут недоступний"}
              </div>
            )}

            {/* Progress timeline */}
            <div className="space-y-3">
              {stages.map((s, i) => (
                <div key={s.key}>
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        s.current
                          ? "bg-blue-600 animate-pulse"
                          : s.reached
                            ? "bg-green-500"
                            : "bg-gray-200"
                      }`}
                    >
                      <div
                        className={`w-3 h-3 rounded-full ${
                          s.reached ? "bg-white" : "bg-gray-400"
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <div
                        className={`text-sm font-medium ${
                          s.reached ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {s.label}
                      </div>
                      {s.time && (
                        <div className="text-xs text-gray-500">{s.time}</div>
                      )}
                    </div>
                  </div>
                  {i < stages.length - 1 && (
                    <div
                      className={`ml-4 h-6 w-0.5 ${
                        stages[i + 1].reached ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    ></div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Courier card */}
          {order.courier && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Кур'єр</h4>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-lg font-semibold text-gray-600">
                    {order.courier.full_name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">
                    {order.courier.full_name}
                  </div>
                  <div className="text-xs text-gray-500">
                    ⭐ {order.courier.rating_avg?.toFixed(1) ?? "—"}
                  </div>
                </div>
                {order.courier.phone && (
                  <PhoneButton
                    phone={order.courier.phone}
                    label="Подзвонити"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                <Truck className="w-4 h-4 text-blue-600 shrink-0" />
                {order.courier.transport ? (
                  <span>
                    {TRANSPORT_TYPE_LABELS[order.courier.transport.type]} ·{" "}
                    {order.courier.transport.model} · до{" "}
                    {order.courier.transport.max_weight} кг
                  </span>
                ) : (
                  <span>Піший курʼєр</span>
                )}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Package className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold">Деталі</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-gray-500">Статус</div>
                <div className="font-medium">
                  {STATUS_LABEL[order.status]}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Підтверджено</div>
                <div className="font-medium">
                  {order.is_confirmed ? "Так" : "Ні"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Вага</div>
                <div className="font-medium">{order.weight} кг</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Об'єм</div>
                <div className="font-medium">{order.volume} м³</div>
              </div>
            </div>
            {order.special_instructions && (
              <div className="mt-3 text-sm text-gray-600">
                {order.special_instructions}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-green-600 mt-0.5" />
              <div className="text-sm flex-1">
                <div className="text-xs text-gray-500">Забір</div>
                <div>
                  {order.pickup_address.city}, {order.pickup_address.street}{" "}
                  {order.pickup_address.building}
                  {order.pickup_address.apartment
                    ? `, кв. ${order.pickup_address.apartment}`
                    : ""}
                </div>
                {order.actual_pickup_time ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Забрано{" "}
                    {new Date(order.actual_pickup_time).toLocaleTimeString(
                      "uk-UA",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </div>
                ) : order.estimated_pickup_time ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Орієнтовний час забору{" "}
                    {new Date(order.estimated_pickup_time).toLocaleTimeString(
                      "uk-UA",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm flex-1">
                <div className="text-xs text-gray-500">Доставка</div>
                <div>
                  {order.delivery_address.city}, {order.delivery_address.street}{" "}
                  {order.delivery_address.building}
                  {order.delivery_address.apartment
                    ? `, кв. ${order.delivery_address.apartment}`
                    : ""}
                </div>
                {order.actual_delivery_time ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Доставлено{" "}
                    {new Date(order.actual_delivery_time).toLocaleTimeString(
                      "uk-UA",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </div>
                ) : order.estimated_delivery_time ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Орієнтовний час доставки{" "}
                    {new Date(order.estimated_delivery_time).toLocaleTimeString(
                      "uk-UA",
                      { hour: "2-digit", minute: "2-digit" },
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {order.payment && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <CreditCard className="w-5 h-5 text-purple-600" />
                <h4 className="text-sm font-semibold">Оплата</h4>
              </div>
              <div className="text-sm flex justify-between">
                <span className="text-gray-600">Сума</span>
                <span className="font-medium">{order.payment.amount} грн</span>
              </div>
              <div className="text-sm flex justify-between">
                <span className="text-gray-600">Метод</span>
                <span className="font-medium">
                  {order.payment.method === "cash" ? "Готівка" : "Картка"}
                </span>
              </div>
              <div className="text-sm flex justify-between">
                <span className="text-gray-600">Статус</span>
                <span
                  className={`font-medium ${
                    order.payment.refunded_at
                      ? "text-blue-600"
                      : order.payment.paid_at
                        ? "text-green-600"
                        : order.status === "cancelled"
                          ? "text-red-600"
                          : "text-orange-600"
                  }`}
                >
                  {order.payment.refunded_at
                    ? "Повернено"
                    : order.payment.paid_at
                      ? "Оплачено"
                      : order.status === "cancelled"
                        ? "Оплата скасована"
                        : "Не оплачено"}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {user.id !== order.created_by_user_id && !order.is_confirmed && (
              <button
                onClick={handleConfirm}
                disabled={confirm.isPending}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300"
              >
                Підтвердити
              </button>
            )}
            {order.sender_user_id === user.id &&
              order.payment &&
              !order.payment.paid_at && (
                <button
                  onClick={handlePay}
                  disabled={pay.isPending}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300"
                >
                  Оплатити
                </button>
              )}
            {order.payment?.paid_at && (
              <Link
                to={`/client/orders/${order.id}/receipt`}
                className="w-full block text-center bg-white border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50"
              >
                <ReceiptIcon className="w-4 h-4 inline mr-2" />
                Чек
              </Link>
            )}
            {order.status === "delivered" &&
              (order.sender_user_id === user.id ||
                order.recipient_user_id === user.id) &&
              !order.review && (
                <button
                  onClick={() => setReviewOpen(true)}
                  className="w-full bg-white border-2 border-blue-600 text-blue-600 py-3 rounded-lg font-medium hover:bg-blue-50 flex items-center justify-center gap-2"
                >
                  <Star className="w-4 h-4" />
                  Залишити відгук
                </button>
              )}
          </div>

          {order.review && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < order.review!.rating
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-gray-300"
                    }`}
                  />
                ))}
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Ваш відгук
                </span>
              </div>
              {order.review.comment && (
                <div className="text-sm text-gray-700">
                  «{order.review.comment}»
                </div>
              )}
            </div>
          )}

          <LeaveReviewDialog
            orderId={order.id}
            open={reviewOpen}
            onOpenChange={setReviewOpen}
          />
        </div>
        );
      })()}
    </div>
  );
}
