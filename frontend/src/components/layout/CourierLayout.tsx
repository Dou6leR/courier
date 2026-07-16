import { Outlet, Link, useLocation } from "react-router-dom";
import { MapPin, BarChart3, User } from "lucide-react";

export default function CourierLayout() {
  const location = useLocation();

  const navItems = [
    { path: "/courier", label: "Карта", icon: MapPin },
    { path: "/courier/history", label: "Історія", icon: BarChart3 },
    { path: "/courier/profile", label: "Профіль", icon: User },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      {/* Mobile container */}
      <div className="w-full max-w-[390px] bg-white min-h-screen flex flex-col shadow-lg">
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
                  className="flex flex-col items-center gap-1 min-w-[60px]"
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
