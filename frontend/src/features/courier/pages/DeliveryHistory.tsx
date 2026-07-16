import { Link } from "react-router-dom";
import { Calendar, DollarSign, FileText } from "lucide-react";
import { useMyCourierOrdersInfinite } from "@/features/courier/hooks";

const SERVICE_FEE = 50;

export default function DeliveryHistory() {
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMyCourierOrdersInfinite({
    scope: "all",
    status: "delivered",
    period: "last_month",
  });

  const deliveries = data?.pages.flat() ?? [];
  const totalEarnings = deliveries.reduce(
    (sum, d) => sum + Math.max((d.payment?.amount ?? 0) - SERVICE_FEE, 0),
    0,
  );
  const totalDeliveries = deliveries.length;

  const formatDate = (s: string) => {
    const date = new Date(s);
    return date.toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-gray-900">Історія</h1>
        <p className="text-sm text-gray-500">Останні 30 днів</p>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-white" />
              <p className="text-sm text-blue-100">Зароблено</p>
            </div>
            <p className="text-2xl font-bold text-white">
              ₴{totalEarnings.toFixed(2)}
            </p>
            <p className="text-xs text-blue-100 mt-1">За місяць</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              <p className="text-sm text-gray-500">Завершено</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalDeliveries}</p>
            <p className="text-xs text-gray-500 mt-1">Доставок</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-gray-900 font-semibold">Завершені доставки</h2>
          </div>

          {isLoading && (
            <div className="p-4 text-sm text-gray-500">Завантаження…</div>
          )}
          {!isLoading && deliveries.length === 0 && (
            <div className="p-4 text-sm text-gray-500">Поки немає доставок</div>
          )}

          <div className="divide-y divide-gray-100">
            {deliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      #{delivery.id}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(delivery.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {delivery.payment?.paid_at && (
                      <Link
                        to={`/courier/orders/${delivery.id}/receipt`}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Деталі виплати"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                    )}
                    <div className="text-right">
                      <p className="text-base font-semibold text-gray-900">
                        ₴{Math.max((delivery.payment?.amount ?? 0) - SERVICE_FEE, 0).toFixed(2)}
                      </p>
                      {delivery.payment?.paid_at && (
                        <p className="text-xs text-green-600 mt-0.5">✓ Оплачено</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {hasNextPage && (
            <div className="p-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-3 rounded-lg border-2 border-blue-600 text-blue-600 font-medium hover:bg-blue-50 disabled:opacity-50"
              >
                {isFetchingNextPage ? "Завантаження…" : "Підгрузити ще"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
