import { useState } from "react";
import { useMyOrdersInfinite } from "@/features/client/hooks";
import { useAuth } from "@/features/auth/AuthContext";
import {
  DeliveryCard,
  orderToCardData,
} from "@/features/client/components/DeliveryCard";
import { LeaveReviewDialog } from "@/features/client/components/LeaveReviewDialog";

export default function Archive() {
  const { user } = useAuth();
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMyOrdersInfinite({
    role: "any",
    period: "all",
    archived: true,
  });

  const [reviewOrderId, setReviewOrderId] = useState<number | null>(null);

  const orders = data?.pages.flat() ?? [];
  const deliveries = orders.map((o) => orderToCardData(o, user?.id));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Архів</h1>

      <div className="space-y-3">
        {isLoading && (
          <div className="text-center text-sm text-gray-500 py-6">
            Завантаження…
          </div>
        )}
        {!isLoading && deliveries.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-6">
            В архіві поки що порожньо
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
