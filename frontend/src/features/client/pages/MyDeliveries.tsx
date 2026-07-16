import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useMyOrdersInfinite } from "@/features/client/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import {
  DeliveryCard,
  orderToCardData,
} from "@/features/client/components/DeliveryCard";
import { LeaveReviewDialog } from "@/features/client/components/LeaveReviewDialog";

export default function MyDeliveries() {
  const { user } = useAuth();
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMyOrdersInfinite({
    role: "any",
    period: "last_month",
    archived: false,
    exclude_awaiting_my_confirmation: true,
  });

  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);

  const orders = data?.pages.flat() ?? [];
  const deliveries = orders.map((o) => orderToCardData(o, user?.id));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Мої доставки</h1>
        <Link
          to="/client/create"
          className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-6 h-6 text-white" />
        </Link>
      </div>

      {/* Deliveries List */}
      <div className="space-y-3">
        {isLoading && (
          <div className="text-center text-sm text-gray-500 py-6">
            Завантаження…
          </div>
        )}
        {!isLoading && deliveries.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-6">
            Поки що немає активних замовлень
          </div>
        )}

        {deliveries.map((delivery) => (
          <DeliveryCard
            key={delivery.id}
            delivery={delivery}
            onReview={setReviewOrderId}
          />
        ))}

        {hasNextPage && (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full py-3 mt-2 rounded-lg border-2 border-blue-600 text-blue-600 font-medium hover:bg-blue-50 disabled:opacity-50"
          >
            {isFetchingNextPage ? "Завантаження…" : "Завантажити ще"}
          </button>
        )}
      </div>

      {reviewOrderId !== null && (
        <LeaveReviewDialog
          orderId={reviewOrderId}
          open={reviewOrderId !== null}
          onOpenChange={(open) => {
            if (!open) setReviewOrderId(null);
          }}
        />
      )}
    </div>
  );
}
