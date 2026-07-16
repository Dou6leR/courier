import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  MapPin,
  Package,
} from "lucide-react";
import { useCourierOrder } from "@/features/courier/hooks";
import type { OrderStatus } from "@/features/client/types";
import { computeDeliveryWindow } from "@/features/client/utils/deliveryWindow";
import { PhoneButton } from "@/components/common/PhoneButton";

const FLOW: { key: OrderStatus; label: string }[] = [
  { key: "assigned", label: "Призначено" },
  { key: "picked_up", label: "Забрано, в дорозі" },
  { key: "delivered", label: "Доставлено" },
];

function addressLine(a?: { city: string; street: string; building: string }) {
  if (!a) return "";
  return `${a.street}, ${a.building}, ${a.city}`;
}

export default function OrderExecution() {
  const navigate = useNavigate();
  const { id } = useParams();
  const orderId = Number(id);
  const { data: order, isLoading } = useCourierOrder(orderId);

  if (isLoading || !order) {
    return <div className="p-6 text-sm text-gray-500">Завантаження…</div>;
  }

  const currentIndex = FLOW.findIndex((s) => s.key === order.status);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/courier")} className="p-1">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div>
            <h1 className="text-gray-900">Виконання</h1>
            <p className="text-sm text-gray-500">#{order.id}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6 space-y-4">
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

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <h2 className="text-gray-900 font-semibold mb-5">Статус</h2>
          <div className="space-y-1">
            {FLOW.map((status, index) => {
              const completed = index < currentIndex;
              const current = index === currentIndex;
              return (
                <div key={status.key} className="relative">
                  {index < FLOW.length - 1 && (
                    <div
                      className={`absolute left-[19px] top-10 w-0.5 h-12 ${
                        completed ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                  <div className="flex items-start gap-4 pb-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        completed
                          ? "bg-blue-600"
                          : current
                            ? "bg-blue-100 border-2 border-blue-600"
                            : "bg-gray-100 border-2 border-gray-200"
                      }`}
                    >
                      <CheckCircle
                        className={`w-5 h-5 ${
                          completed
                            ? "text-white"
                            : current
                              ? "text-blue-600"
                              : "text-gray-400"
                        }`}
                      />
                    </div>
                    <div className="flex-1 pt-2">
                      <p
                        className={`text-sm font-medium ${
                          current ? "text-gray-900" : "text-gray-500"
                        }`}
                      >
                        {status.label}
                      </p>
                      {current && (
                        <span className="inline-block mt-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          Поточний
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Package */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
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
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-900">
              {order.special_instructions}
            </div>
          )}
        </div>

        {/* Contacts */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-gray-900 font-semibold mb-4">Контакти</h2>

          <div className="mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-green-600" />
              <p className="text-xs text-gray-500 uppercase">Забір</p>
            </div>
            <p className="text-sm text-gray-900 font-medium">
              {order.sender_full_name ?? "—"}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              {addressLine(order.pickup_address)}
            </p>
            {order.actual_pickup_time ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Clock className="w-3.5 h-3.5" />
                Забрано{" "}
                {new Date(order.actual_pickup_time).toLocaleTimeString(
                  "uk-UA",
                  { hour: "2-digit", minute: "2-digit" },
                )}
              </div>
            ) : order.estimated_pickup_time ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Clock className="w-3.5 h-3.5" />
                Орієнтовно{" "}
                {new Date(order.estimated_pickup_time).toLocaleTimeString(
                  "uk-UA",
                  { hour: "2-digit", minute: "2-digit" },
                )}
              </div>
            ) : null}
            {order.sender_phone && (
              <PhoneButton phone={order.sender_phone} />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-500 uppercase">Доставка</p>
            </div>
            <p className="text-sm text-gray-900 font-medium">
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
        </div>
      </div>

    </div>
  );
}
