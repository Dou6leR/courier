import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, MapPin, Package, Play, Square } from "lucide-react";
import { toast } from "sonner";
import {
  useCourierMe,
  useCourierRoute,
  useLocationTracker,
  useMyCourierOrders,
  useRouteDays,
  useUpdateLocation,
  useUpdateOrderStatus,
} from "@/features/courier/hooks";
import {
  useAutoDrive,
  type DriveSegment,
} from "@/features/courier/hooks/useAutoDrive";
import { CourierRouteMap } from "@/features/courier/components/CourierRouteMap";
import { DebugClockControls } from "@/features/debug/DebugClockControls";

const statusLabel: Record<string, string> = {
  assigned: "Призначено",
  picked_up: "Забрано, в дорозі",
};

const statusStyle: Record<string, string> = {
  assigned: "bg-yellow-50 text-yellow-700 border-yellow-200",
  picked_up: "bg-blue-50 text-blue-700 border-blue-200",
};

function addressLine(a: { city: string; street: string; building: string }) {
  return `${a.street}, ${a.building}, ${a.city}`;
}

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDayLabel(dateIso: string, todayIso: string): string {
  if (dateIso === todayIso) return "Сьогодні";
  const today = new Date(todayIso);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  if (dateIso === tomorrowIso) return "Завтра";
  const [, m, d] = dateIso.split("-");
  return `${d}.${m}`;
}

const SELECTED_DATE_KEY = "courier.selectedDate";

export default function CourierDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const todayIso = todayIsoDate();

  const urlDate = searchParams.get("date");
  const storedDate =
    typeof window !== "undefined"
      ? window.localStorage.getItem(SELECTED_DATE_KEY)
      : null;
  const resolvedDate =
    urlDate ??
    (storedDate && storedDate >= todayIso ? storedDate : todayIso);


  useEffect(() => {
    if (urlDate == null && resolvedDate !== todayIso) {
      searchParams.set("date", resolvedDate);
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDate = resolvedDate;
  const isToday = selectedDate === todayIso;

  const [debugMode, setDebugMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("courier.debugMode");
    if (stored === null) return true;
    return stored === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("courier.debugMode", debugMode ? "1" : "0");
  }, [debugMode]);

  const [driveSpeed, setDriveSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const stored = Number(window.localStorage.getItem("courier.driveSpeed"));
    return Number.isFinite(stored) && stored > 0 ? stored : 1;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("courier.driveSpeed", String(driveSpeed));
  }, [driveSpeed]);

  useLocationTracker(debugMode);
  const me = useCourierMe();
  const route = useCourierRoute(isToday ? undefined : selectedDate);
  const days = useRouteDays();
  const mine = useMyCourierOrders({ scope: "today", period: "all" });
  const updateLocation = useUpdateLocation();
  const updateStatus = useUpdateOrderStatus();

  const onSegmentsChange = useCallback(() => {}, []);

  const routePoints = route.data?.points ?? [];
  const totalDistanceM = route.data?.total_distance_m ?? 0;
  const totalDurationSec = route.data?.total_duration_sec ?? 0;

  const courierLocation =
    me.data?.last_known_lat != null && me.data?.last_known_lon != null
      ? { lat: me.data.last_known_lat, lon: me.data.last_known_lon }
      : null;

  const driveSegments = useMemo<DriveSegment[]>(
    () =>
      routePoints
        .filter((p) => p.lat != null && p.lon != null)
        .map((p) => ({
          target: [p.lat as number, p.lon as number],
          orderId: p.order_id,
          type: p.type,
        })),
    [routePoints],
  );

  const onReach = useCallback(
    async (seg: DriveSegment) => {
      const next = seg.type === "pickup" ? "picked_up" : "delivered";
      try {
        await updateStatus.mutateAsync({ id: seg.orderId, status: next });
        toast.success(
          seg.type === "pickup"
            ? `Забрано #${seg.orderId}`
            : `Доставлено #${seg.orderId}`,
        );
      } catch (e: unknown) {
        const msg =
          typeof e === "object" && e && "response" in e
            ? // @ts-expect-error axios
              e.response?.data?.detail ?? "Помилка оновлення статусу"
            : "Помилка оновлення статусу";
        toast.error(String(msg));
      }
    },
    [updateStatus],
  );

  const autoDrive = useAutoDrive({
    segments: driveSegments,
    start: courierLocation ? [courierLocation.lat, courierLocation.lon] : null,
    enabled: isToday && debugMode,
    speed: driveSpeed,
    onReach,
  });

  const active = mine.data ?? [];

  const handleMapClick = (lat: number, lon: number) => {
    updateLocation.mutate({ lat, lon });
    toast.success(`Локація встановлена (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
  };

  const dayButtons = (days.data ?? []).map((d) => ({
    value: d.plan_date,
    label: formatDayLabel(d.plan_date, todayIso),
    count: d.orders_count,
  }));
  const hasTodayInList = dayButtons.some((b) => b.value === todayIso);
  if (!hasTodayInList) {
    dayButtons.unshift({ value: todayIso, label: "Сьогодні", count: 0 });
  }
  dayButtons.sort((a, b) => a.value.localeCompare(b.value));

  const setDay = (d: string) => {
    if (d === todayIso) {
      searchParams.delete("date");
    } else {
      searchParams.set("date", d);
    }
    setSearchParams(searchParams, { replace: true });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SELECTED_DATE_KEY, d);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-gray-900">Дашборд кур'єра</h1>
        <p className="text-sm text-gray-500">
          {routePoints.length} точок · {active.length} сьогодні
        </p>
      </div>

      <div className="p-4 space-y-5">
        {/* Day chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {dayButtons.map((b) => {
            const active = b.value === selectedDate;
            return (
              <button
                key={b.value}
                onClick={() => setDay(b.value)}
                className={`shrink-0 px-3 py-2 rounded-full border text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-300"
                }`}
              >
                {b.label}
                {b.count > 0 && (
                  <span className="ml-1.5 text-xs opacity-75">({b.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Debug controls (today only) */}
        {isToday && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Демо-режим
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Клік по карті — миттєве переміщення. Auto-drive — симуляція
                  руху по маршруту.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-checked:bg-blue-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></div>
              </label>
            </div>
            {debugMode && (
              <>
                <div className="flex gap-2 mt-3">
                  <button
                    disabled={driveSegments.length === 0}
                    onClick={
                      autoDrive.running ? autoDrive.stop : autoDrive.start
                    }
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                      autoDrive.running
                        ? "bg-white border border-gray-300 text-gray-700"
                        : "bg-blue-600 text-white disabled:bg-gray-300"
                    }`}
                  >
                    {autoDrive.running ? (
                      <>
                        <Square className="w-4 h-4" /> Зупинити
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" /> Запустити
                      </>
                    )}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-600 font-medium">
                    Швидкість:
                  </span>
                  {[1, 2, 5, 10].map((s) => (
                    <button
                      key={s}
                      onClick={() => setDriveSpeed(s)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                        driveSpeed === s
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-gray-300 text-gray-700 hover:border-blue-300"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
                <DebugClockControls />
              </>
            )}
          </div>
        )}

        <section>
          <h2 className="text-gray-900 font-semibold mb-3">
            {isToday ? "Мій маршрут" : `Маршрут на ${selectedDate}`}
          </h2>
          {route.isLoading && <p className="text-sm text-gray-500">Завантаження…</p>}
          {!route.isLoading && routePoints.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500">
              {isToday ? "На сьогодні завдань немає" : "Маршрут порожній"}
            </div>
          )}
          {routePoints.length > 0 && (
            <div className="space-y-3">
              <CourierRouteMap
                points={routePoints}
                courierLocation={isToday ? courierLocation : null}
                onMapClick={isToday && debugMode ? handleMapClick : undefined}
                onSegmentsChange={isToday ? onSegmentsChange : undefined}
              />
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 px-1">
                <span>{routePoints.length} точок</span>
                <span>{(totalDistanceM / 1000).toFixed(1)} км</span>
                <span>~{Math.round(totalDurationSec / 60)} хв</span>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                {(() => {
                  const baseIso = route.data?.base_time;
                  const firstEta = routePoints[0]?.eta;
                  if (!baseIso || !firstEta) return null;
                  const leadMin =
                    (new Date(firstEta).getTime() -
                      new Date(baseIso).getTime()) /
                    60000;
                  const firstTravel = routePoints[0]?.travel_min ?? 0;
                  const leadIdle = leadMin - firstTravel;
                  if (leadIdle <= 10) return null;
                  const h = Math.floor(leadIdle / 60);
                  const m = Math.round(leadIdle - h * 60);
                  const dur =
                    h > 0
                      ? `${h} год${m > 0 ? ` ${m} хв` : ""}`
                      : `${m} хв`;
                  const until = new Date(firstEta).toLocaleTimeString("uk-UA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div className="ml-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-block">
                      Вільний час ~{dur} до першої точки (до {until})
                    </div>
                  );
                })()}
                {routePoints.map((p, i) => {
                  const prev = routePoints[i - 1];
                  let idleMin = 0;
                  if (prev?.eta && p.eta) {
                    const dt =
                      (new Date(p.eta).getTime() -
                        new Date(prev.eta).getTime()) /
                      60000;
                    const travel = p.travel_min ?? 0;
                    const idle = dt - travel - 5;
                    if (idle > 10) idleMin = Math.round(idle);
                  }
                  const isFirst = i === 0 && isToday;
                  const actionLabel =
                    p.type === "pickup" ? "Забрав" : "Доставив";
                  const nextStatus =
                    p.type === "pickup" ? "picked_up" : "delivered";
                  return (
                    <div
                      key={`${p.order_id}-${p.type}-${i}`}
                      className="space-y-2"
                    >
                      {idleMin > 0 && (() => {
                        const bH = Math.floor(idleMin / 60);
                        const bM = Math.round(idleMin - bH * 60);
                        const bDur = bH > 0
                          ? `${bH} год${bM > 0 ? ` ${bM} хв` : ""}`
                          : `${bM} хв`;
                        const bUntil = p.eta
                          ? new Date(p.eta).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
                          : null;
                        return (
                          <div className="ml-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-block">
                            Перерва ~{bDur} до наступної точки{bUntil ? ` (до ${bUntil})` : ""}
                          </div>
                        );
                      })()}
                      <div className="flex items-start gap-3">
                        <Link
                          to={`/courier/orders/${p.order_id}`}
                          className="flex items-start gap-3 flex-1 min-w-0"
                        >
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                              p.type === "pickup" ? "bg-green-500" : "bg-blue-500"
                            }`}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-500 uppercase">
                              {p.type === "pickup" ? "Забір" : "Доставка"} · #
                              {p.order_id}
                            </p>
                            <p className="text-sm text-gray-900">
                              {addressLine(p.address)}
                            </p>
                            {p.eta && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(p.eta).toLocaleTimeString("uk-UA", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            )}
                            {p.type === "delivery" && p.payment_method === "cash" && (
                              <span className="inline-block text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 mt-0.5">
                                Оплата готівкою
                              </span>
                            )}
                          </div>
                        </Link>
                        {isFirst && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              updateStatus.mutate(
                                { id: p.order_id, status: nextStatus },
                                {
                                  onSuccess: () => toast.success(`${actionLabel} · #${p.order_id}`),
                                  onError: () => toast.error("Помилка оновлення статусу"),
                                },
                              );
                            }}
                            disabled={updateStatus.isPending}
                            className={`shrink-0 self-center px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                              p.type === "pickup"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-blue-600 hover:bg-blue-700"
                            }`}
                          >
                            {updateStatus.isPending ? "…" : actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {isToday && (
          <section>
            <h2 className="text-gray-900 font-semibold mb-3">
              Сьогоднішні замовлення
            </h2>
            {mine.isLoading && (
              <p className="text-sm text-gray-500">Завантаження…</p>
            )}
            {!mine.isLoading && active.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 text-sm text-gray-500">
                Немає активних замовлень
              </div>
            )}
            <div className="space-y-3">
              {active.map((order) => (
                <Link
                  key={order.id}
                  to={`/courier/orders/${order.id}`}
                  className="block bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">#{order.id}</h3>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full border ${
                        statusStyle[order.status] ?? ""
                      }`}
                    >
                      {statusLabel[order.status] ?? order.status}
                    </span>
                  </div>
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Забір</p>
                        <p className="text-sm text-gray-900">
                          {addressLine(order.pickup_address)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Доставка</p>
                        <p className="text-sm text-gray-900">
                          {addressLine(order.delivery_address)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Package className="w-3.5 h-3.5" />
                    {order.weight} кг · {order.volume} м³
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
