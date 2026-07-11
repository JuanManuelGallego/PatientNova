import { useChangePassword } from "@/src/api/useChangePassword";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { STATUS_ICONS, ACTION_ICONS } from "@/src/config/icons";
import { useState } from "react";

export const PW_RULES = [
  { label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { label: "Al menos una mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Al menos una minúscula", test: (p: string) => /[a-z]/.test(p) },
  { label: "Al menos un número", test: (p: string) => /[0-9]/.test(p) },
  {
    label: "Al menos un símbolo especial",
    test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
  },
];

export function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const {
    changePassword,
    loading: saving,
    error: apiError,
  } = useChangePassword();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rulesOk = PW_RULES.every((r) => r.test(next));
  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    current && next && confirm && rulesOk && !mismatch && !saving;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError(null);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setConfirm("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch {
      const msg = apiError ?? "Error al cambiar contraseña";
      setError(msg);
    }
  }

  return (
    <div style={{ maxWidth: 460 }}>
      <div className="dash-card">
        <div className="dash-card__header">
          <span className="dash-card__title">Cambiar contraseña</span>
        </div>
        <div className="dash-card__body">
          <form className="form-stack" onSubmit={handleSubmit}>
            <label className="form-label">
              Contraseña actual
              <input
                className="form-input"
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </label>
            <label className="form-label">
              Nueva contraseña
              <input
                className="form-input"
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                required
              />
            </label>
            <label className="form-label">
              Confirmar nueva contraseña
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                style={mismatch ? { borderColor: "var(--c-error)" } : undefined}
                required
              />
              {mismatch && (
                <span style={{ fontSize: 12, color: "var(--c-error)" }}>
                  Las contraseñas no coinciden
                </span>
              )}
            </label>
            {next.length > 0 && (
              <div
                style={{
                  background: "var(--c-gray-50)",
                  borderRadius: "var(--r-lg)",
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--c-gray-400)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginBottom: 8,
                  }}
                >
                  Requisitos
                </div>
                {PW_RULES.map((r) => {
                  const ok = r.test(next);
                  return (
                    <div
                      key={r.label}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        fontSize: 12,
                        color: ok ? "var(--c-success)" : "var(--c-gray-400)",
                        marginBottom: 5,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>
                        {ok ? <ACTION_ICONS.confirm size={12} /> : "○"}
                      </span>
                      {r.label}
                    </div>
                  );
                })}
              </div>
            )}
            {error && (
              <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <STATUS_ICONS.warning size={14} /> {error}
              </div>
            )}
            {success && (
              <SuccessBanner message="Contraseña actualizada. Las otras sesiones activas serán cerradas." />
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                marginTop: 4,
              }}
            >
              <button
                type="submit"
                className="btn-primary"
                disabled={!canSubmit}
              >
                {saving ? "Actualizando…" : "Cambiar contraseña"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
