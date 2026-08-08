import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { BRAND } from "../lib/brand";
import { Button, Field, Input } from "../components/ui";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/v2/auth/login", { username, password });
      login(data.user, data.token);
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || "Gagal login. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Wallpaper brand — background alias sesuai #93 */}
      <img
        src={BRAND.wallpaper}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="border-b border-slate-100 px-6 py-4 text-center">
            <img src={BRAND.logo} alt={`Logo ${BRAND.name}`} className="mx-auto mb-2 h-10 w-auto" />
            <h1 className="text-xl font-bold text-slate-900">{BRAND.name}</h1>
            <p className="text-xs text-slate-500">{BRAND.tagline}</p>
          </div>

          <div className="px-6 py-5">
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Username">
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  aria-required="true"
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                />
              </Field>

              <Button type="submit" className="w-full justify-center" loading={loading}>
                Masuk
              </Button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-white/70">
          {BRAND.name} · v2.0.0 · {BRAND.address}
        </p>
      </div>
    </div>
  );
}