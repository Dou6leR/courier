import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { Receipt as ReceiptType } from "../types";

export default function Receipt() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const orderId = id ? Number(id) : null;

  const isCourier = location.pathname.startsWith("/courier");
  const endpoint = isCourier
    ? `/couriers/orders/${orderId}/receipt`
    : `/orders/${orderId}/receipt`;

  const { data: receipt, isLoading, isError } = useQuery({
    queryKey: ["receipt", orderId, isCourier],
    queryFn: () => api.get<ReceiptType>(endpoint).then((r) => r.data),
    enabled: orderId != null && !Number.isNaN(orderId),
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900">{isCourier ? "Виплата" : "Чек"}</h1>
        <button
          onClick={() => window.print()}
          className="ml-auto p-2 text-blue-600"
        >
          <Printer className="w-5 h-5" />
        </button>
      </div>

      {isLoading && <Skeleton className="h-64 w-full rounded-lg" />}
      {isError && <div className="text-sm text-red-600">Чек недоступний</div>}

      {receipt && (
        <div id="receipt-print" className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 font-mono text-sm">
          <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
            <div className="font-bold text-base">{isCourier ? "ВИПЛАТА" : "ЧЕК"} #{receipt.order_id}</div>
            <div className="text-xs text-gray-500">
              {new Date(receipt.issued_at).toLocaleString()}
            </div>
          </div>
          <div className="space-y-2 border-b border-dashed border-gray-300 pb-3 mb-3">
            {receipt.items.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span>{item.label}</span>
                <span>{item.amount.toFixed(2)} грн</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between font-bold text-base">
            <span>РАЗОМ</span>
            <span>{receipt.total.toFixed(2)} грн</span>
          </div>
          <div className="mt-3 pt-3 border-t border-dashed border-gray-300 text-xs text-gray-600">
            <div>Метод: {receipt.method === "cash" ? "Готівка" : "Картка"}</div>
            <div>
              Оплачено:{" "}
              {receipt.paid_at
                ? new Date(receipt.paid_at).toLocaleString()
                : "—"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
