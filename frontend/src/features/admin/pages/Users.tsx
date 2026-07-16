import { Search, User, Package, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import { useAdminUsers, useInfiniteAdminUsers, useToggleUserActive } from "../hooks";
import type { AdminRoleFilter, AdminUser } from "../types";

type UiRoleFilter = "all" | "client" | "courier";

const ROLE_LABELS: Record<UiRoleFilter, string> = {
  all: "Усі",
  client: "Клієнти",
  courier: "Кур'єри",
};

function primaryRole(u: AdminUser): "client" | "courier" | "admin" {
  if (u.roles.includes("courier")) return "courier";
  if (u.roles.includes("client")) return "client";
  return "admin";
}

function roleBadge(role: "client" | "courier" | "admin") {
  if (role === "courier") {
    return { label: "КУР'ЄР", className: "bg-green-100 text-green-700", bgIcon: "bg-green-100", iconColor: "text-green-600" };
  }
  if (role === "admin") {
    return { label: "АДМІН", className: "bg-purple-100 text-purple-700", bgIcon: "bg-purple-100", iconColor: "text-purple-600" };
  }
  return { label: "КЛІЄНТ", className: "bg-blue-100 text-blue-700", bgIcon: "bg-blue-100", iconColor: "text-blue-600" };
}

export default function Users() {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UiRoleFilter>("all");

  const apiRoleFilter: AdminRoleFilter = roleFilter === "all" ? "all" : roleFilter;

  const { data: allUsers = [] } = useAdminUsers({ limit: 0 });
  const {
    data: infiniteData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteAdminUsers({
    role: apiRoleFilter,
    search: searchQuery || undefined,
  });
  const users = infiniteData?.pages.flat() ?? [];
  const toggleMutation = useToggleUserActive();

  const handleToggleStatus = (user: AdminUser) => {
    toggleMutation.mutate(
      { id: user.id, is_active: !user.is_active },
      {
        onSuccess: () => {
          toast.success(user.is_active ? "Користувача деактивовано" : "Користувача активовано");
        },
        onError: (err) => {
          const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
          toast.error(typeof detail === "string" ? detail : "Не вдалося змінити статус");
        },
      },
    );
  };

  const stats = {
    total: allUsers.length,
    clients: allUsers.filter((u) => u.roles.includes("client")).length,
    couriers: allUsers.filter((u) => u.roles.includes("courier")).length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-gray-900">Користувачі</h1>
        <p className="text-sm text-gray-500">Клієнти та кур'єри</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Усього</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Клієнти</p>
            <p className="text-2xl font-bold text-blue-600">{stats.clients}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
            <p className="text-xs text-gray-500 mb-1">Кур'єри</p>
            <p className="text-2xl font-bold text-green-600">{stats.couriers}</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Пошук за іменем, email або телефоном..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            {(["all", "client", "courier"] as const).map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  roleFilter === role
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {ROLE_LABELS[role]}
              </button>
            ))}
          </div>
        </div>

        {/* Users List */}
        <div className="space-y-3">
          {users.map((user) => {
            const role = primaryRole(user);
            const badge = roleBadge(role);
            return (
              <div
                key={user.id}
                className={`bg-white rounded-2xl shadow-sm border border-gray-200 p-4 ${
                  !user.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${badge.bgIcon}`}>
                      <User className={`w-6 h-6 ${badge.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="text-gray-900 font-semibold">{user.full_name}</h3>
                      <p className="text-xs text-gray-500">ID: {user.id}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Email:</span>
                    <span className="text-gray-900">{user.email}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Телефон:</span>
                    <span className="text-gray-900">{user.phone}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      <Package className="inline w-4 h-4 mr-1 -mt-0.5" />
                      Замовлень:
                    </span>
                    <span className="text-gray-900 font-medium">{user.orders_count}</span>
                  </div>
                  {user.rating != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Рейтинг:</span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-gray-900 font-medium">{user.rating.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deactivation Button */}
                {role !== "admin" && (
                  <button
                    onClick={() => handleToggleStatus(user)}
                    disabled={toggleMutation.isPending}
                    className={`w-full py-2.5 rounded-xl font-medium transition-colors disabled:opacity-60 ${
                      user.is_active
                        ? "border-2 border-red-600 text-red-600 hover:bg-red-50"
                        : "border-2 border-green-600 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {user.is_active ? "Деактивувати користувача" : "Активувати користувача"}
                  </button>
                )}
              </div>
            );
          })}

          {!isLoading && users.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <p className="text-gray-500">Користувачів не знайдено</p>
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
    </div>
  );
}
