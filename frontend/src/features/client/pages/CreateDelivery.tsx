import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Package,
  Phone,
  Send,
  Weight,
} from "lucide-react";
import { toast } from "sonner";
import { useCreateOrder } from "@/features/client/hooks";
import { profileApi, type PhoneCheckResult } from "@/features/client/api/profile";
import type { PaymentMethod } from "@/features/client/types";
import AddressPicker, {
  type AddressPickerValue,
} from "@/features/client/components/AddressPicker";

const PICKUP_SLOTS = [
  { hour: 10, label: "10:00 - 12:00" },
  { hour: 12, label: "12:00 - 14:00" },
  { hour: 14, label: "14:00 - 16:00" },
  { hour: 16, label: "16:00 - 18:00" },
  { hour: 18, label: "18:00 - 20:00" },
];

type DayOption = { value: string; label: string };

function buildDayOptions(): DayOption[] {
  const labels = ["Сьогодні", "Завтра"];
  const out: DayOption[] = [];
  const now = new Date();
  for (let i = 0; i < 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    out.push({ value: `${y}-${m}-${dd}`, label: labels[i] });
  }
  return out;
}

function buildRequestedIso(date: string, hour: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d, hour, 0, 0);
  return dt.toISOString();
}

function isSlotDisabled(dateValue: string, hour: number): boolean {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (dateValue !== todayKey) return false;
  return hour <= today.getHours();
}

export default function CreateDelivery() {
  const navigate = useNavigate();
  const createOrder = useCreateOrder();

  const [step, setStep] = useState<"form" | "waiting">("form");
  const [myRole, setMyRole] = useState<"sender" | "recipient">("sender");
  const [phoneDigits, setPhoneDigits] = useState("");
  const counterpartyPhone = phoneDigits ? `+380${phoneDigits}` : "";

  const [weight, setWeight] = useState("");
  const [volume, setVolume] = useState("");

  const dayOptions = useMemo(buildDayOptions, []);
  const [pickupDate, setPickupDate] = useState(dayOptions[0].value);
  const [pickupSlotHour, setPickupSlotHour] = useState<number>(() => {
    const firstOpen = PICKUP_SLOTS.find(
      (s) => !isSlotDisabled(dayOptions[0].value, s.hour),
    );
    return firstOpen ? firstOpen.hour : PICKUP_SLOTS[0].hour;
  });

  const [pickup, setPickup] = useState<AddressPickerValue>({
    city: "",
    street: "",
    building: "",
    apartment: "",
    lat: 0,
    lon: 0,
  });
  const [delivery, setDelivery] = useState<AddressPickerValue>({
    city: "",
    street: "",
    building: "",
    apartment: "",
    lat: 0,
    lon: 0,
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  // --- field errors ---
  const [errors, setErrors] = useState<Record<string, string>>({});
  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // --- phone check with debounce ---
  const [phoneCheck, setPhoneCheck] = useState<PhoneCheckResult | null>(null);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doPhoneCheck = useCallback(async (phone: string) => {
    if (!phone || phone.length < 10) {
      setPhoneCheck(null);
      return;
    }
    setPhoneChecking(true);
    try {
      const res = await profileApi.checkPhone(phone);
      setPhoneCheck(res);
      if (!res.exists) {
        const msgs: Record<string, string> = {
          not_found: "Користувача з таким номером не знайдено",
          self: "Не можна вказувати свій номер",
          not_client: "Користувача з таким номером не знайдено",
        };
        setErrors((prev) => ({
          ...prev,
          phone: msgs[res.reason ?? "not_found"],
        }));
      } else {
        clearError("phone");
      }
    } catch {
      setPhoneCheck(null);
    } finally {
      setPhoneChecking(false);
    }
  }, []);

  useEffect(() => {
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    setPhoneCheck(null);
    clearError("phone");
    phoneTimerRef.current = setTimeout(() => doPhoneCheck(counterpartyPhone), 600);
    return () => {
      if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    };
  }, [counterpartyPhone, doPhoneCheck]);

  // --- validation ---
  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!counterpartyPhone.trim()) errs.phone = "Вкажіть номер телефону";
    else if (phoneCheck && !phoneCheck.exists) {
      const msgs: Record<string, string> = {
        not_found: "Користувача з таким номером не знайдено",
        self: "Не можна вказувати свій номер",
        not_client: "Користувача з таким номером не знайдено",
      };
      errs.phone = msgs[phoneCheck.reason ?? "not_found"];
    }

    const w = parseFloat(weight);
    if (!weight.trim() || isNaN(w) || w <= 0) errs.weight = "Вкажіть вагу більше 0";

    const v = parseFloat(volume);
    if (!volume.trim() || isNaN(v) || v <= 0) errs.volume = "Вкажіть об'єм більше 0";

    if (!pickup.city || !pickup.street || !pickup.building)
      errs.pickup = "Заповніть адресу забору";
    else if (pickup.lat === 0 && pickup.lon === 0)
      errs.pickup = "Оберіть точку забору на карті";

    if (!delivery.city || !delivery.street || !delivery.building)
      errs.delivery = "Заповніть адресу доставки";
    else if (delivery.lat === 0 && delivery.lon === 0)
      errs.delivery = "Оберіть точку доставки на карті";

    if (isSlotDisabled(pickupDate, pickupSlotHour))
      errs.slot = "Обраний слот уже минув";

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  const handleSendRequest = async () => {
    if (!validate()) return;
    const w = parseFloat(weight);
    const v = parseFloat(volume);
    try {
      const order = await createOrder.mutateAsync({
        my_role: myRole,
        counterparty_phone: counterpartyPhone,
        weight: w,
        volume: v,
        requested_pickup_from: buildRequestedIso(pickupDate, pickupSlotHour),
        pickup_address: {
          city: pickup.city,
          street: pickup.street,
          building: pickup.building,
          apartment: pickup.apartment || undefined,
          lat: pickup.lat,
          lon: pickup.lon,
        },
        delivery_address: {
          city: delivery.city,
          street: delivery.street,
          building: delivery.building,
          apartment: delivery.apartment || undefined,
          lat: delivery.lat,
          lon: delivery.lon,
        },
        payment_method: paymentMethod,
      });
      toast.success("Замовлення створено");
      setStep("waiting");
      setTimeout(() => navigate(`/client/orders/${order.id}`), 800);
    } catch (e: unknown) {
      let msg = "Помилка створення";
      if (typeof e === "object" && e && "response" in e) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detail = (e as any).response?.data?.detail;
        if (typeof detail === "string") msg = detail;
        else if (Array.isArray(detail))
          msg = detail.map((d: { msg?: string }) => d.msg ?? "").join("; ");
      }
      toast.error(msg);
    }
  };

  if (step === "waiting") {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setStep("form")}>
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            Заявка на доставку
          </h1>
        </div>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600 animate-pulse" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">
                {myRole === "sender" ? "Очікуємо отримувача" : "Очікуємо відправника"}
              </h3>
              <p className="text-sm text-gray-600">
                Ми надіслали пропозицію на номер {counterpartyPhone}
              </p>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Ви отримаєте сповіщення, щойно інша сторона підтвердить заявку
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">
            Деталі посилки
          </h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Вага:</span>
              <span className="text-gray-900 font-medium">{weight} кг</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Об'єм:</span>
              <span className="text-gray-900 font-medium">{volume} м³</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate("/")}>
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">Створити доставку</h1>
      </div>

      <div className="mb-6"> 
        <label className="text-sm font-medium text-gray-700 mb-3 block">
          Я в цьому замовленні: 
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMyRole("sender")}
            className={`py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
              myRole === "sender"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            Відправник
          </button>
          <button
            type="button"
            onClick={() => setMyRole("recipient")}
            className={`py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
              myRole === "recipient"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-gray-200 bg-white text-gray-700"
            }`}
          >
            Отримувач
          </button>
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Weight className="w-4 h-4 text-gray-500" />
            Вага (кг)
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={weight}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
              setWeight(v);
              clearError("weight");
            }}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent ${errors.weight ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          {errors.weight && <p className="text-xs text-red-600 mt-1">{errors.weight}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-500" />
            Об'єм (м³)
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={volume}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
              setVolume(v);
              clearError("volume");
            }}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent ${errors.volume ? "border-red-400 bg-red-50" : "border-gray-300"}`}
          />
          {errors.volume && <p className="text-xs text-red-600 mt-1">{errors.volume}</p>}
        </div>
      </div>

      {/* Pickup window */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          Коли забрати посилку
        </label>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {dayOptions.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => setPickupDate(d.value)}
              className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                pickupDate === d.value
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PICKUP_SLOTS.map((s) => {
            const disabled = isSlotDisabled(pickupDate, s.hour);
            const selected = pickupSlotHour === s.hour;
            return (
              <button
                key={s.hour}
                type="button"
                disabled={disabled}
                onClick={() => setPickupSlotHour(s.hour)}
                className={`py-2 rounded-lg border-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  selected && !disabled
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-white text-gray-700"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        {errors.slot && <p className="text-xs text-red-600 mt-1">{errors.slot}</p>}
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          {myRole === "sender" ? "Дані отримувача" : "Дані відправника"}
        </h3>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4 text-blue-600" />
            Номер телефону
          </label>
          <div className={`flex items-center border-2 rounded-lg bg-white overflow-hidden ${errors.phone ? "border-red-400" : phoneCheck?.exists ? "border-green-400" : "border-blue-300"}`}>
            <span className="pl-4 pr-1 py-3 text-gray-500 text-sm select-none">+380</span>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="XX XXX XX XX"
              value={phoneDigits}
              maxLength={9}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 9);
                setPhoneDigits(digits);
              }}
              className="flex-1 px-1 py-3 focus:outline-none bg-transparent"
            />
          </div>
          {phoneChecking && (
            <p className="text-xs text-gray-500 mt-1">Перевірка номера…</p>
          )}
          {errors.phone && (
            <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
          )}
          {phoneCheck?.exists && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {phoneCheck.full_name}
            </p>
          )}
          {!errors.phone && !phoneCheck?.exists && (
            <p className="text-xs text-gray-600 mt-2">
              Ми надішлемо їм запит на підтвердження доставки
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-green-600" />
            Адреса забору
          </label>
          <AddressPicker value={pickup} onChange={(v) => { setPickup(v); clearError("pickup"); }} />
          {errors.pickup && <p className="text-xs text-red-600 mt-1">{errors.pickup}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            Адреса доставки
          </label>
          <AddressPicker value={delivery} onChange={(v) => { setDelivery(v); clearError("delivery"); }} />
          {errors.delivery && <p className="text-xs text-red-600 mt-1">{errors.delivery}</p>}
        </div>
      </div>

      <div className="mb-8">
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Спосіб оплати
        </label>
        <div className="grid grid-cols-2 gap-2">
          {([
            { id: "cash" as PaymentMethod, label: "Готівка" },
            { id: "card" as PaymentMethod, label: "Картка" },
          ]).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPaymentMethod(m.id)}
              className={`py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                paymentMethod === m.id
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSendRequest}
        disabled={!counterpartyPhone || createOrder.isPending || phoneChecking}
        className="w-full bg-blue-600 text-white py-4 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        <Send className="w-5 h-5" />
        {createOrder.isPending
          ? "Створення…"
          : myRole === "sender"
            ? "Надіслати запит отримувачу"
            : "Надіслати запит відправнику"}
      </button>
    </div>
  );
}
