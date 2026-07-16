import { useState } from "react";
import { Search, Filter, Package, Clock, CheckCircle, XCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useAdminOrders,
  useInfiniteAdminOrders,
  useCancelOrder,
  useRefundOrder,
} from "../hooks";
import type {
  AdminOrder,
  AdminOrderStatus,
  AdminOrderStatusFilter,
  AdminPaymentStatus,
} from "../types";

const STATUS_LABELS: Record<AdminOrderStatusFilter, string> = {
  all: "Усі",
  active: "Активні",
  completed: "Завершені",
  cancelled: "Скасовані",
};

const STATUS_BADGE_LABEL: Record<AdminOrderStatus, string> = {
  active: "АКТИВНЕ",
  completed: "ВИКОНАНЕ",
  cancelled: "СКАСОВАНЕ",
};

const PAYMENT_BADGE_LABEL: Record<AdminPaymentStatus, string> = {
  paid: "ОПЛАЧЕНО",
  refunded: "ПОВЕРНЕНО",
  processing: "В ОБРОБЦІ",
  cancelled: "ОПЛАТА СКАСОВАНА",
};

export default function AdminDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AdminOrderStatusFilter>("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const {
    data: infiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteAdminOrders({
    status: statusFilter,
    search: searchQuery || undefined,
  });
  const orders = infiniteData?.pages.flat() ?? [];

  const { data: allOrders = [] } = useAdminOrders({ limit: 0 });

  const cancelMutation = useCancelOrder();
  const refundMutation = useRefundOrder();
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<AdminOrder | null>(null);
  const [refundConfirmOrder, setRefundConfirmOrder] = useState<AdminOrder | null>(null);

  const getStatusColor = (status: AdminOrderStatus) => {
    switch (status) {
      case "active":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "completed":
        return "bg-green-100 text-green-700 border-green-200";
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200";
    }
  };

  const getPaymentColor = (status: AdminPaymentStatus) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "refunded":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      case "processing":
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const extractError = (err: unknown, fallback: string): string => {
    if (axios.isAxiosError(err)) {
      const detail = err.response?.data?.detail;
      if (typeof detail === "string") return detail;
    }
    return fallback;
  };

  const handleCancelOrder = (order: AdminOrder) => {
    setCancelConfirmOrder(null);
    cancelMutation.mutate(order.id, {
      onSuccess: (updated) => {
        toast.success("Замовлення скасовано");
        setSelectedOrder(updated);
      },
      onError: (err) => {
        toast.error(extractError(err, "Не вдалося скасувати замовлення"));
      },
    });
  };

  const handleRefundPayment = (order: AdminOrder) => {
    setRefundConfirmOrder(null);
    refundMutation.mutate(order.id, {
      onSuccess: (updated) => {
        toast.success("Кошти повернуто");
        setSelectedOrder(updated);
      },
      onError: (err) => {
        toast.error(extractError(err, "Не вдалося повернути кошти"));
      },
    });
  };

  const stats = {
    active: allOrders.filter((o) => o.status === "active").length,
    completed: allOrders.filter((o) => o.status === "completed").length,
    cancelled: allOrders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-gray-900">Замовлення</h1>
        <p className="text-sm text-gray-500">Системний адміністратор</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-gray-500">Активні</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <p className="text-xs text-gray-500">Завершені</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-600" />
              <p className="text-xs text-gray-500">Скасовані</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.cancelled}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за ID, клієнтом або кур'єром..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <div className="flex gap-2 flex-1">
              {(["all", "active", "completed", "cancelled"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-3">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4"
            >
              {/* Order header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-gray-900 font-semibold mb-1">№{order.id}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full border ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {STATUS_BADGE_LABEL[order.status]}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${getPaymentColor(
                        order.payment_status
                      )}`}
                    >
                      {PAYMENT_BADGE_LABEL[order.payment_status]}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">₴{order.amount}</p>
                  <p className="text-xs text-gray-500">{order.date}</p>
                </div>
              </div>

              {/* Order details */}
              <div className="space-y-2 mb-3 pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Клієнт:</span>
                  <span className="text-gray-900 font-medium">{order.customer}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Кур'єр:</span>
                  <span className="text-gray-900 font-medium">
                    {order.courier ?? "—"}
                  </span>
                </div>
              </div>

              {/* Route */}
              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Звідки</p>
                    <p className="text-sm text-gray-900">{order.from}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-500">Куди</p>
                    <p className="text-sm text-gray-900">{order.to}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Керувати
                </button>
              </div>
            </div>
          ))}

          {!isLoading && orders.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Замовлень не знайдено</p>
            </div>
          )}
          {isLoading && (
            <div className="text-center text-gray-500 py-6">Завантаження…</div>
          )}
          {hasNextPage && (
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-60"
            >
              {isFetchingNextPage ? "Завантаження…" : "Завантажити ще"}
            </button>
          )}
        </div>
      </div>

      {/* Order Management Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1100]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Керування замовленням</h2>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">ID замовлення</span>
                <span className="text-sm font-semibold text-gray-900">№{selectedOrder.id}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Клієнт</span>
                <span className="text-sm font-medium text-gray-900">{selectedOrder.customer}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">Сума</span>
                <span className="text-base font-bold text-gray-900">₴{selectedOrder.amount}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">Статус оплати</span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${getPaymentColor(
                    selectedOrder.payment_status
                  )}`}
                >
                  {PAYMENT_BADGE_LABEL[selectedOrder.payment_status]}
                </span>
              </div>
            </div>

            {/* Control buttons */}
            <div className="space-y-3">
              {selectedOrder.payment_status === "paid" && (
                <button
                  onClick={() => setRefundConfirmOrder(selectedOrder)}
                  disabled={refundMutation.isPending}
                  className="w-full py-3 bg-orange-600 text-white rounded-xl font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <DollarSign className="w-5 h-5" />
                  Повернути кошти
                </button>
              )}
              {selectedOrder.status === "active" && (
                <button
                  onClick={() => setCancelConfirmOrder(selectedOrder)}
                  disabled={cancelMutation.isPending}
                  className="w-full py-3 bg-white border-2 border-red-600 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <XCircle className="w-5 h-5" />
                  Скасувати замовлення
                </button>
              )}

              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
              >
                Закрити
              </button>
            </div>
          </div>
        </div>
      )}
      <AlertDialog open={!!cancelConfirmOrder} onOpenChange={(open) => { if (!open) setCancelConfirmOrder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Скасувати замовлення №{cancelConfirmOrder?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Цю дію неможливо відмінити. Замовлення буде переведено в статус "Скасоване"
              {cancelConfirmOrder?.courier ? ` і знято з кур'єра ${cancelConfirmOrder.courier}` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ні, залишити</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelConfirmOrder && handleCancelOrder(cancelConfirmOrder)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Так, скасувати
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!refundConfirmOrder} onOpenChange={(open) => { if (!open) setRefundConfirmOrder(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Повернути кошти за замовлення №{refundConfirmOrder?.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              Буде повернуто ₴{refundConfirmOrder?.amount} клієнту {refundConfirmOrder?.customer}. Цю дію неможливо відмінити.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ні, залишити</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => refundConfirmOrder && handleRefundPayment(refundConfirmOrder)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              Так, повернути
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
