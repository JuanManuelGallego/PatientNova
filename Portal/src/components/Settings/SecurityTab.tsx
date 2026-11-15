import { useChangePassword } from "@/src/api/auth/useChangePassword";
import { mutationErrorMessage } from "@/src/api/base/useApiMutation";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { FieldError, InlineError } from "@/src/components/Info/InlineError";
import { ACTION_ICONS } from "@/src/config/icons";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { useAuthContext } from "@/src/providers/AuthContext";
import { fmtDateTime } from "@/src/utils/TimeUtils";
import { useState } from "react";
import { SettingsSection } from "./SettingsSection";

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
  const { user, refreshUser } = useAuthContext();
  const timezone = useDisplayTimezone();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const { changePassword, loading: saving } = useChangePassword();
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
      void refreshUser();
    } catch (err) {
      // The hook's `error` is still the previous value here; the thrown one is current.
      setError(mutationErrorMessage(err, "Error al cambiar contraseña"));
    }
  }

  return (
    <div className="settings-stack">
      <SettingsSection
        title="Contraseña"
        description={
          user?.lastPasswordChange ? (
            <span data-testid="security-last-password-change">
              {`Último cambio de contraseña: ${fmtDateTime(user.lastPasswordChange, timezone)}`}
            </span>
          ) : undefined
        }
      >
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
              data-testid="security-current-password-input"
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
              data-testid="security-new-password-input"
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
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? "security-confirm-error" : undefined}
              data-testid="security-confirm-password-input"
              required
            />
            {mismatch && <FieldError id="security-confirm-error" message="Las contraseñas no coinciden" />}
          </label>
          {next.length > 0 && (
            <div
              data-testid="password-rules"
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
          {error && <InlineError message={error} />}
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
      </SettingsSection>
    </div>
  );
}
