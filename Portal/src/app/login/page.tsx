"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { STATUS_ICONS } from "@/src/config/icons";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading, error, isAuthenticated, initializing } =
    useAuthContext();

  const [ email, setEmail ] = useState("");
  const [ password, setPassword ] = useState("");
  const [ showPassword, setShowPassword ] = useState(false);

  const fromParam = searchParams.get("from");
  const redirectTo =
    fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//")
      ? fromParam
      : "/dashboard";

  // Redirect already-authenticated users away from login
  useEffect(() => {
    if (!initializing && isAuthenticated) {
      router.replace(redirectTo);
    }
  }, [ initializing, isAuthenticated, router, redirectTo ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      router.push(redirectTo);
    } catch { }
  }

  if (initializing) return null;

  return (
    <div className="login-shell">
      <div className="login-card fade-in">
        <div className="login-card__header">
          <Image
            src="/favicon.ico"
            alt="Patient Nova"
            width={76}
            height={76}
            style={{ borderRadius: "var(--r-lg)" }}
          />
          <h1 className="login-card__title">PatientNova</h1>
          <p className="login-card__subtitle">Inicia sesión en tu cuenta</p>
        </div>

        <form className="login-card__form" onSubmit={handleSubmit} noValidate>
          <label className="form-label">
            Correo electrónico
            <input
              className="form-input"
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="form-label">
            Contraseña
            <div className="password-wrapper">
              <input
                className="form-input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          {error && (
            <div className="login-card__error" role="alert" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <STATUS_ICONS.warning size={14} />{" "}
              Credenciales incorrectas
            </div>
          )}

          <button
            type="submit"
            className="btn-primary login-card__submit"
            disabled={loading || !email || !password}
          >
            {loading ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>

          <button
            type="button"
            className="btn-secondary login-card__submit"
            onClick={() => router.push("/")}
          >
            {"Volver al inicio"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
