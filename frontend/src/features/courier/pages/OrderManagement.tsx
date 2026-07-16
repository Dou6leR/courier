import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  MapPin,
  Clock,
  Package,
} from "lucide-react";
import { useCourierOrder } from "@/features/courier/hooks";
import { computeDeliveryWindow } from "@/features/client/utils/deliveryWindow";
import { PhoneButton } from "@/components/common/PhoneButton";

const STATUS_LABEL: Record<string, string> = {
  pending: "Очікує курʼєра",
  assigned: "Призначено",
  picked_up: "Забрано, в дорозі",
  delivered: "Доставлено",
  cancelled: "Скасовано",
};

function addressLine(a?: { city: string; street: string; building: string }) {
  if (!a) return "";
  return `${a.street}, ${a.building}, ${a.city}`;
}

export default function OrderManagement() {
  const navigate = useNavigate();
  const { id } = useParams();
  const orderId = Number(id);
  const { data: order, isLoading } = useCourierOrder(orderId);

  if (isLoading || !order) {
    return (
      <div className="p-6 text-sm text-gray-500">Завантаження…</div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => navigate("/courier")} className="p-1">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-gray-900">Замовлення</h1>
            <p className="text-sm text-gray-500">#{order.id}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Slot banner */}
        {(() => {
          const dw = computeDeliveryWindow(order);
          const fmtDate = dw.from.toLocaleDateString("uk-UA", {
            day: "2-digit",
            month: "2-digit",
          });
          const fmtTime = (d: Date) =>
            d.toLocaleTimeString("uk-UA", {
              hour: "2-digit",
              minute: "2-digit",
            });
          return (
            <div className="bg-blue-600 text-white rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase opacity-75">
                  Вікно доставки
                </div>
                <div className="text-lg font-semibold">
                  {fmtDate} · {fmtTime(dw.from)} - {fmtTime(dw.to)}
                </div>
              </div>
              <div className="text-xs opacity-75 text-right">
                забір + доставка
                <br />в межах цього часу
              </div>
            </div>
          );
        })()}

        {/* Status */}
        <div className="rounded-xl p-4 flex items-center gap-3 bg-blue-50 border border-blue-200">
          <CheckCircle className="w-6 h-6 text-blue-600" />
          <div>
            <p className="text-sm font-semibold text-blue-700">
              {STATUS_LABEL[order.status] ?? order.status}
            </p>
          </div>
        </div>

        {/* Pickup */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-green-600" />
            <p className="text-xs text-gray-500 uppercase font-medium">
              Точка забору
            </p>
          </div>
          <p className="text-sm text-gray-900 font-medium mb-1">
            {order.sender_full_name ?? "—"}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {addressLine(order.pickup_address)}
          </p>
          {order.actual_pickup_time ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Clock className="w-3.5 h-3.5" />
              Забрано{" "}
              {new Date(order.actual_pickup_time).toLocaleTimeString("uk-UA", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          ) : order.estimated_pickup_time ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Clock className="w-3.5 h-3.5" />
              Орієнтовно{" "}
              {new Date(order.estimated_pickup_time).toLocaleTimeString("uk-UA", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          ) : null}
          {order.sender_phone && (
            <PhoneButton phone={order.sender_phone} />
          )}
        </div>

        {/* Delivery */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <p className="text-xs text-gray-500 uppercase font-medium">
              Точка доставки
            </p>
          </div>
          <p className="text-sm text-gray-900 font-medium mb-1">
            {order.recipient_full_name ?? "—"}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            {addressLine(order.delivery_address)}
          </p>
          {order.actual_delivery_time ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Clock className="w-3.5 h-3.5" />
              Доставлено{" "}
              {new Date(order.actual_delivery_time).toLocaleTimeString(
                "uk-UA",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </div>
          ) : order.estimated_delivery_time ? (
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
              <Clock className="w-3.5 h-3.5" />
              Орієнтовно{" "}
              {new Date(order.estimated_delivery_time).toLocaleTimeString(
                "uk-UA",
                { hour: "2-digit", minute: "2-digit" },
              )}
            </div>
          ) : null}
          {order.recipient_phone && (
            <PhoneButton phone={order.recipient_phone} />
          )}
        </div>

        {/* Package */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-gray-600" />
            <h2 className="text-gray-900 font-semibold">Посилка</h2>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Вага</span>
              <span className="text-gray-900 font-medium">{order.weight} кг</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Обʼєм</span>
              <span className="text-gray-900 font-medium">{order.volume} м³</span>
            </div>
          </div>
          {order.special_instructions && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Інструкції</p>
              <p className="text-sm text-gray-900">{order.special_instructions}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
