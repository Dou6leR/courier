import { TrendingUp, Package, DollarSign, Users } from "lucide-react";
import { useAdminDaily, useAdminSummary } from "../hooks";

function formatMoney(value: number | undefined | null): string {
  if (value == null) return "—";
  return `₴${Math.round(value).toLocaleString("uk-UA")}`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const name = d.toLocaleDateString("uk-UA", { weekday: "long" });
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function Reports() {
  const { data: summary, isLoading: sumLoading } = useAdminSummary();
  const { data: daily = [], isLoading: dailyLoading } = useAdminDaily();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-gray-900">Звіти та аналітика</h1>
        <p className="text-sm text-gray-500">Показники бізнесу</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-white" />
              <p className="text-sm text-blue-100">Виручка</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatMoney(summary?.revenue)}</p>
            <p className="text-xs text-blue-100 mt-1">Сервісний збір · 30 днів</p>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-white" />
              <p className="text-sm text-green-100">Дохід</p>
            </div>
            <p className="text-2xl font-bold text-white">{formatMoney(summary?.total_income)}</p>
            <p className="text-xs text-green-100 mt-1">Усі оплати · 30 днів</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-gray-600" />
              <p className="text-sm text-gray-500">Доставки</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summary?.deliveries ?? 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Завершено</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-gray-600" />
              <p className="text-sm text-gray-500">Активні кур'єри</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {summary?.active_couriers_count ?? 0}
            </p>
            <p className="text-xs text-gray-500 mt-1">Зараз у системі</p>
          </div>
        </div>

        {/* Performance overview */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-gray-900 font-semibold mb-4">Показники</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Успішність</p>
                  <p className="text-xs text-gray-500">Завершені доставки</p>
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {summary ? `${summary.completion_rate.toFixed(1)}%` : "—"}
              </p>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                  <Package className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-900 font-medium">Середній час</p>
                  <p className="text-xs text-gray-500">Від забору до доставки</p>
                </div>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {summary?.avg_delivery_time_minutes != null
                  ? `${Math.round(summary.avg_delivery_time_minutes)} хв`
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Daily statistics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-gray-900 font-semibold mb-4">Останній тиждень</h2>

          <div className="space-y-3">
            {daily.map((item) => (
              <div key={item.date} className="flex items-center justify-between py-2">
                <div className="flex-1">
                  <p className="text-sm text-gray-900 font-medium">
                    {formatWeekday(item.date)}
                  </p>
                  <p className="text-xs text-gray-500">{item.deliveries} доставок</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900 font-semibold">
                    {formatMoney(item.total_income)}
                  </p>
                  <p className="text-xs text-blue-600">
                    виручка {formatMoney(item.revenue)}
                  </p>
                </div>
              </div>
            ))}
            {!dailyLoading && daily.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                Даних за цей період немає
              </p>
            )}
            {(dailyLoading || sumLoading) && daily.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Завантаження…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
