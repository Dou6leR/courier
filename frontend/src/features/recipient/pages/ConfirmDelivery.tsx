import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Package,
  MapPin,
  Clock,
  Check,
  Phone,
  User,
  Pencil,
} from "lucide-react";
import { useOrder, useConfirmOrder } from "@/features/client/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import { toast } from "sonner";
import { PhoneButton } from "@/components/common/PhoneButton";
import type { AddressInput } from "@/features/client/types";
import AddressPicker, {
  type AddressPickerValue,
} from "@/features/client/components/AddressPicker";

function formatHm(iso: string): string {
  return new Date(iso).toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConfirmDelivery() {
  const navigate = useNavigate();
  const { id } = useParams();
  const orderId = id ? Number(id) : null;
  const { data: order, isLoading } = useOrder(orderId);
  const { user } = useAuth();
  const confirmMut = useConfirmOrder();

  const mySide: "sender" | "recipient" | null = useMemo(() => {
    if (!order || !user) return null;
    if (user.id === order.sender_user_id) return "sender";
    if (user.id === order.recipient_user_id) return "recipient";
    return null;
  }, [order, user]);

  const myAddress = mySide === "sender"
    ? order?.pickup_address
    : order?.delivery_address;

  const [editing, setEditing] = useState(false);
  const [addrPicker, setAddrPicker] = useState<AddressPickerValue>({
    city: "",
    street: "",
    building: "",
    apartment: "",
    lat: 0,
    lon: 0,
  });

  function startEdit() {
    if (!myAddress) return;
    setAddrPicker({
      city: myAddress.city,
      street: myAddress.street,
      building: myAddress.building,
      apartment: myAddress.apartment ?? "",
      lat: myAddress.lat ?? 0,
      lon: myAddress.lon ?? 0,
    });
    setEditing(true);
  }

  function override(): AddressInput | null {
    if (!editing) return null;
    if (
      !addrPicker.city.trim() ||
      !addrPicker.street.trim() ||
      !addrPicker.building.trim()
    )
      return null;
    return {
      city: addrPicker.city.trim(),
      street: addrPicker.street.trim(),
      building: addrPicker.building.trim(),
      apartment: addrPicker.apartment?.trim() || null,
      lat: addrPicker.lat || null,
      lon: addrPicker.lon || null,
    };
  }

  const handleAccept = async () => {
    if (!order) return;
    const addr = override();
    try {
      await confirmMut.mutateAsync({
        id: order.id,
        pickup_address: mySide === "sender" && addr ? addr : undefined,
        delivery_address: mySide === "recipient" && addr ? addr : undefined,
      });
      toast.success("Замовлення підтверджено");
      navigate(`/client/orders/${order.id}`);
    } catch {
      toast.error("Не вдалося підтвердити");
    }
  };

  if (isLoading || !order) {
    return <div className="p-6 text-center text-sm text-gray-500">Завантаження…</div>;
  }

  const creatorIsSender = order.created_by_user_id === order.sender_user_id;
  const counterpartyName = creatorIsSender
    ? order.sender_full_name ?? "—"
    : order.recipient_full_name ?? "—";
  const counterpartyPhone = creatorIsSender
    ? order.sender_phone ?? "—"
    : order.recipient_phone ?? "—";

  const pickupAddr = editing && mySide === "sender"
    ? `${addrPicker.street}, ${addrPicker.building}, ${addrPicker.city}`
    : `${order.pickup_address.street}, ${order.pickup_address.building}, ${order.pickup_address.city}`;
  const deliveryAddr = editing && mySide === "recipient"
    ? `${addrPicker.street}, ${addrPicker.building}, ${addrPicker.city}`
    : `${order.delivery_address.street}, ${order.delivery_address.building}, ${order.delivery_address.city}`;
  const pickupWindow = `${formatHm(order.requested_pickup_from)} - ${formatHm(order.requested_pickup_to)}`;
  const deliveryEta = order.estimated_delivery_time
    ? formatHm(order.estimated_delivery_time)
    : "Після підтвердження";

  const pickupIsMine = mySide === "sender";
  const deliveryIsMine = mySide === "recipient";

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate("/")}>
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">
          Пропозиція доставки
        </h1>
      </div>

      {/* Notification-style card */}
      <div className="bg-blue-600 text-white rounded-lg p-5 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-semibold text-lg mb-1">{counterpartyName}</h2>
            <p className="text-blue-100 text-sm">
              створив доставку для вас
            </p>
          </div>
        </div>
      </div>

      {/* Package Summary */}
      <div className="bg-gray-50 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Деталі посилки</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <div className="text-sm font-medium text-gray-900">Тип</div>
              <div className="text-xs text-gray-600">Стандартна посилка</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200">
            <div>
              <div className="text-xs text-gray-500 mb-1">Вага</div>
              <div className="text-sm font-medium text-gray-900">{order.weight} кг</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Об'єм</div>
              <div className="text-sm font-medium text-gray-900">
                {order.volume} м³
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Time Slots */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-600" />
          Розрахунковий час
        </h3>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <MapPin className="w-4 h-4 text-green-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-medium text-gray-900">
                  {pickupIsMine ? "Точка забору (ваша)" : "Точка забору"}
                </div>
                {pickupIsMine && !editing && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="text-blue-600 hover:text-blue-700"
                    aria-label="Редагувати адресу"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600 mb-1">{pickupAddr}</div>
              <div className="text-xs font-medium text-green-600">
                {pickupWindow}
              </div>
            </div>
          </div>

          {/* Connection line */}
          <div className="ml-4 h-8 w-0.5 bg-gray-200"></div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
              <MapPin className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm font-medium text-gray-900">
                  {deliveryIsMine ? "Ваша адреса" : "Точка доставки"}
                </div>
                {deliveryIsMine && !editing && (
                  <button
                    type="button"
                    onClick={startEdit}
                    className="text-blue-600 hover:text-blue-700"
                    aria-label="Редагувати адресу"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-sm text-gray-600 mb-1">{deliveryAddr}</div>
              <div className="text-xs font-medium text-blue-600">
                {deliveryEta}
              </div>
            </div>
          </div>
        </div>

        {editing && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
            <AddressPicker
              value={addrPicker}
              onChange={setAddrPicker}
              label={pickupIsMine ? "Адреса забору" : "Адреса доставки"}
            />
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="w-full text-xs text-gray-500 hover:text-gray-700"
            >
              Скасувати редагування
            </button>
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-8">
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-gray-600" />
          <div className="flex-1">
            <div className="text-xs text-gray-500">
              Контакт {creatorIsSender ? "відправника" : "отримувача"}
            </div>
            <div className="text-sm font-medium text-gray-900">
              {counterpartyPhone}
            </div>
          </div>
          <PhoneButton phone={counterpartyPhone} label="Подзвонити" />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={handleAccept}
          disabled={confirmMut.isPending || order.is_confirmed}
          className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:bg-gray-300"
        >
          <Check className="w-5 h-5" />
          {order.is_confirmed
            ? "Вже підтверджено"
            : confirmMut.isPending
              ? "…"
              : "Підтвердити доставку"}
        </button>
      </div>
    </div>
  );
}
