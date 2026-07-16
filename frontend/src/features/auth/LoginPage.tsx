import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Package } from "lucide-react";
import { authApi } from "./api";
import { useAuth } from "./AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { loginSchema } from "@/features/client/schemas";

type Role = "client" | "courier";

export function LoginPage() {
  const { setToken } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      if (!res.user.roles.includes(role)) {
        await authApi.logout().catch(() => {});
        setError(
          role === "client"
            ? "У вас немає ролі клієнта"
            : "У вас немає ролі кур'єра",
        );
        return;
      }
      setToken(res.access_token);
      navigate(role === "client" ? "/client" : "/courier", { replace: true });
    } catch {
      setError("Невірний email або пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <div className="w-full max-w-[390px] bg-white min-h-screen flex flex-col shadow-lg">
        <div className="flex flex-col items-center pt-16 pb-8">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-gray-900 font-semibold text-xl">Вхід</h1>
          <p className="text-sm text-gray-500 mt-1">Увійди в свій акаунт</p>
        </div>

        <div className="px-6 mb-4">
          <Tabs value={role} onValueChange={(v) => setRole(v as Role)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="client">Клієнт</TabsTrigger>
              <TabsTrigger value="courier">Кур'єр</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <form onSubmit={onSubmit} className="px-6 space-y-4 flex-1">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              autoComplete="email"
              className={`mt-1.5 ${fieldErrors.email ? "border-red-400" : ""}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
          </div>
          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              className={`mt-1.5 ${fieldErrors.password ? "border-red-400" : ""}`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-xl"
            disabled={loading}
          >
            {loading ? "Вхід…" : "Увійти"}
          </Button>
        </form>

        <div className="px-6 py-6 text-center space-y-2">
          <p className="text-sm text-gray-500">
            Немає акаунту?{" "}
            <Link to="/register" className="text-blue-600 font-medium">
              Зареєструватись
            </Link>
          </p>
          <p className="text-xs text-gray-400">
            <Link to="/admin/login" className="hover:text-gray-600">
              Адмін вхід
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
