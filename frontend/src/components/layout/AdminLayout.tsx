import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Package, Users, BarChart3, LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const navItems = [
    { path: "/admin", label: "Замовлення", icon: Package },
    { path: "/admin/users", label: "Користувачі", icon: Users },
    { path: "/admin/reports", label: "Звіти", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      {/* Mobile container */}
      <div className="w-full max-w-[390px] bg-white min-h-screen flex flex-col shadow-lg">
        {/* Top header */}
        <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">Адмін-панель</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-700"
          >
            <LogOut className="w-4 h-4" />
            Вийти
          </button>
        </header>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto pb-20">
          <Outlet />
        </main>

        {/* Bottom navigation */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-gray-200 px-6 py-3 z-[1000]">
          <div className="flex justify-around items-center">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path;
              return (
                <Link
                  key={path}
                  to={path}
                  className="flex flex-col items-center gap-1 min-w-[70px]"
                >
                  <Icon
                    className={`w-6 h-6 ${
                      isActive ? "text-blue-600" : "text-gray-400"
                    }`}
                  />
                  <span
                    className={`text-xs ${
                      isActive ? "text-blue-600 font-medium" : "text-gray-500"
                    }`}
                  >
                    {label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
