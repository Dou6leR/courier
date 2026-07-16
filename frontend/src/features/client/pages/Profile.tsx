import { useState } from "react";
import { User, Phone, LogOut, ChevronRight, MessageCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useUpdateProfile,
  useMyOrders,
  useSupportContact,
} from "@/features/client/hooks";
import { toast } from "sonner";
import { PhoneButton } from "@/components/common/PhoneButton";
import { PhoneInput } from "@/components/common/PhoneInput";
import { userUpdateSchema } from "@/features/client/schemas";

export default function Profile() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const updateProfile = useUpdateProfile();
  const { data: orders = [] } = useMyOrders({ role: "any", period: "all" });

  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [supportOpen, setSupportOpen] = useState(false);
  const { data: supportContact, isLoading: supportLoading } = useSupportContact(
    supportOpen,
  );

  const totalDeliveries = orders.length;

  async function handleSave() {
    const result = userUpdateSchema.safeParse({ full_name: fullName, phone, email });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    try {
      await updateProfile.mutateAsync(result.data);
      toast.success("Профіль оновлено");
      setEditing(false);
    } catch {
      toast.error("Не вдалося зберегти");
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="p-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Профіль</h1>

      {/* User Info Card */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{user?.full_name ?? "—"}</h2>
            <p className="text-blue-100 text-sm">{user?.phone ?? "—"}</p>
          </div>
        </div>

        <div className="pt-4 border-t border-white/20">
          <div className="text-2xl font-bold">{totalDeliveries}</div>
          <div className="text-blue-100 text-xs">Усього доставок</div>
        </div>
      </div>

      {/* Edit profile inline */}
      {editing && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-4 mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Редагування профілю</h3>
          <div>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Повне ім'я"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${errors.full_name ? "border-red-400" : "border-gray-300"}`}
            />
            {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
          </div>
          <div>
            <PhoneInput value={phone} onChange={setPhone} error={!!errors.phone} />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>
          <div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 ${errors.email ? "border-red-400" : "border-gray-300"}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={updateProfile.isPending}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-300"
            >
              {updateProfile.isPending ? "…" : "Зберегти"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {/* Settings Sections */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          Налаштування акаунту
        </h3>

        <button
          onClick={() => {
            setFullName(user?.full_name ?? "");
            setPhone(user?.phone ?? "");
            setEmail(user?.email ?? "");
            setEditing(true);
          }}
          className="w-full bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
            <Phone className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900">
              Особисті дані
            </div>
            <div className="text-xs text-gray-500">{user?.phone ?? "—"}</div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        <button
          onClick={() => setSupportOpen(true)}
          className="w-full bg-white border border-gray-200 rounded-lg p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-sm font-medium text-gray-900">
              Зв'язатися з підтримкою
            </div>
            <div className="text-xs text-gray-500">
              Скасування або повернення коштів
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full bg-white border-2 border-red-200 text-red-600 rounded-lg p-4 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors font-medium"
      >
        <LogOut className="w-5 h-5" />
        Вийти
      </button>

      {supportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Підтримка</h2>
              <button
                onClick={() => setSupportOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="Закрити"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Для скасування замовлення або повернення коштів звʼяжіться з адміністратором сервісу.
            </p>

            {supportLoading || !supportContact ? (
              <p className="text-sm text-gray-500 text-center py-6">Завантаження…</p>
            ) : (
              <div className="mb-6">
                <div className="w-full bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-xs text-gray-500">Телефон</div>
                    <div className="text-sm font-medium text-gray-900">
                      {supportContact.phone}
                    </div>
                  </div>
                  <PhoneButton
                    phone={supportContact.phone}
                    label="Скопіювати"
                  />
                </div>
              </div>
            )}

            <button
              onClick={() => setSupportOpen(false)}
              className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              Закрити
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
