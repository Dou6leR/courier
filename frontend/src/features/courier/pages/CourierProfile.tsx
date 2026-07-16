import { useState } from "react";
import {
  Power,
  LogOut,
  Truck,
  Pencil,
  Plus,
  X,
  User,
  Phone,
  ChevronRight,
  Star,
  MessageCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthContext";
import {
  useCourierMe,
  useRemoveTransport,
  useSetAvailability,
} from "@/features/courier/hooks";
import { useUpdateProfile, useSupportContact } from "@/features/client/hooks";
import { userUpdateSchema } from "@/features/client/schemas";
import { PhoneInput } from "@/components/common/PhoneInput";
import { TRANSPORT_TYPE_LABELS } from "@/features/courier/types";
import { TransportEditDialog } from "@/features/courier/components/TransportEditDialog";
import { PhoneButton } from "@/components/common/PhoneButton";
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

export default function CourierProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const setAvailability = useSetAvailability();
  const removeTransport = useRemoveTransport();
  const updateProfile = useUpdateProfile();
  const me = useCourierMe();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmOffOpen, setConfirmOffOpen] = useState(false);

  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [supportOpen, setSupportOpen] = useState(false);
  const { data: supportContact, isLoading: supportLoading } =
    useSupportContact(supportOpen);

  const isAvailable = me.data?.is_available ?? true;
  const transport = me.data?.transport ?? null;
  const rating = me.data?.rating_avg ?? 0;

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  function startEditProfile() {
    setFullName(user?.full_name ?? "");
    setPhone(user?.phone ?? "");
    setEmail(user?.email ?? "");
    setEditingProfile(true);
  }

  async function handleSaveProfile() {
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
      setEditingProfile(false);
    } catch {
      toast.error("Не вдалося зберегти");
    }
  }

  async function applyAvailability(next: boolean) {
    try {
      await setAvailability.mutateAsync(next);
      toast.success(
        next ? "Виходжу на роботу" : "Майбутні замовлення перерозподілено",
      );
    } catch {
      toast.error("Помилка");
    }
  }

  function handleToggleAvailability() {
    if (isAvailable) {
      setConfirmOffOpen(true);
    } else {
      void applyAvailability(true);
    }
  }

  async function handleRemoveTransport() {
    if (!window.confirm("Прибрати транспорт? Ви станете пішим курʼєром.")) {
      return;
    }
    try {
      await removeTransport.mutateAsync();
      toast.success("Транспорт прибрано");
    } catch {
      toast.error("Не вдалося прибрати транспорт");
    }
  }

  return (
    <div className="p-6">
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

        <div className="flex gap-6 pt-4 border-t border-white/20">
          <div>
            <div className="flex items-center gap-1 text-2xl font-bold">
              <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
              {rating > 0 ? rating.toFixed(1) : "-"}
            </div>
            <div className="text-blue-100 text-xs">Рейтинг</div>
          </div>
        </div>
      </div>

      {/* Edit profile inline */}
      {editingProfile && (
        <div className="bg-white border-2 border-blue-200 rounded-lg p-4 mb-6 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Редагування профілю
          </h3>
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
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-300"
            >
              {updateProfile.isPending ? "…" : "Зберегти"}
            </button>
            <button
              onClick={() => setEditingProfile(false)}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {/* Settings */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          Налаштування акаунту
        </h3>

        <button
          onClick={startEditProfile}
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
              Питання по виплатах або роботі
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Availability toggle */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          Робота
        </h3>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
                isAvailable ? "bg-green-50" : "bg-gray-100"
              }`}
            >
              <Power
                className={`w-5 h-5 ${
                  isAvailable ? "text-green-600" : "text-gray-500"
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-gray-900 font-medium">
                  Графік роботи
                </p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAvailable}
                  onClick={handleToggleAvailability}
                  disabled={setAvailability.isPending}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    isAvailable ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                      isAvailable ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {isAvailable
                  ? "Виходжу на роботу - отримую нові замовлення"
                  : "На перерві з завтра - майбутні замовлення віддано іншим"}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Сьогоднішні замовлення лишаються за тобою.
              </p>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmOffOpen} onOpenChange={setConfirmOffOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Вимкнути режим роботи?</AlertDialogTitle>
            <AlertDialogDescription>
              Усі замовлення на наступні дні будуть перерозподілені між іншими
              кур'єрами. Сьогоднішні замовлення лишаться за тобою.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyAvailability(false)}>
              Вимкнути
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transport */}
      <div className="space-y-3 mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase">
          Транспорт
        </h3>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-sm font-medium text-gray-900">
                {transport ? transport.model : "Піший курʼєр"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
            >
              {transport ? (
                <>
                  <Pencil className="w-4 h-4" /> Редагувати
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Додати
                </>
              )}
            </button>
          </div>
          {transport ? (
            <>
              <div className="space-y-1 text-sm pl-[52px]">
                <p className="text-gray-500">
                  Тип: {TRANSPORT_TYPE_LABELS[transport.type]}
                </p>
                <p className="text-gray-500">
                  Макс. вага: {transport.max_weight} кг · обʼєм:{" "}
                  {transport.max_volume} м³
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveTransport}
                disabled={removeTransport.isPending}
                className="mt-3 ml-[52px] inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" /> Без транспорту
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 pl-[52px]">
              Одне замовлення за раз
            </p>
          )}
        </div>
      </div>

      <TransportEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={transport}
      />

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full bg-white border-2 border-red-200 text-red-600 rounded-lg p-4 flex items-center justify-center gap-2 hover:bg-red-50 transition-colors font-medium"
      >
        <LogOut className="w-5 h-5" />
        Вийти
      </button>

      {supportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[1100]">
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
              Для питань по виплатах або роботі звʼяжіться з адміністратором.
            </p>

            {supportLoading || !supportContact ? (
              <p className="text-sm text-gray-500 text-center py-6">
                Завантаження…
              </p>
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
