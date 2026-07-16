import { Link } from "react-router-dom";
import { Bell, ArrowRight, Package } from "lucide-react";
import { useMyOrders } from "@/features/client/hooks";
import { useAuth } from "@/features/auth/AuthContext";

export default function PendingConfirmations() {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useMyOrders({
    role: "any",
    period: "all",
  });

  const pending = orders.filter(
    (o) => !o.is_confirmed && user && o.created_by_user_id !== user.id,
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Очікують підтвердження
      </h1>

      {isLoading && (
        <div className="text-center text-sm text-gray-500 py-6">
          Завантаження…
        </div>
      )}

      {!isLoading && pending.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Bell className="w-8 h-8 text-gray-400" />
          </div>
          <div className="text-sm text-gray-500">
            Немає замовлень, що очікують вашого підтвердження
          </div>
        </div>
      )}

      <div className="space-y-3">
        {pending.map((o) => {
          const counterparty =
            o.sender_user_id === user?.id
              ? o.recipient_full_name
              : o.sender_full_name;
          const role = o.sender_user_id === user?.id ? "Отримувач" : "Відправник";
          return (
            <Link
              key={o.id}
              to={`/client/confirm/${o.id}`}
              className="block bg-white border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        Замовлення #{o.id}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {role}: {counterparty ?? "—"}
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  </div>
                  <div className="space-y-1 mb-2">
                    <div className="text-xs text-gray-600 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      {o.pickup_address.street}, {o.pickup_address.building}
                    </div>
                    <div className="text-xs text-gray-600 flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      {o.delivery_address.street}, {o.delivery_address.building}
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-yellow-50 text-yellow-700">
                    ⏱ Очікує підтвердження
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
