"use client";

import { useCallback, useState } from "react";
import { useAuthContext } from "@/src/providers/AuthContext";
import { AdminRole } from "@/src/types/User";
import { useFetchGoogleConnection } from "@/src/api/google/useFetchGoogleConnection";
import { useStartGoogleOAuth } from "@/src/api/google/useStartGoogleOAuth";
import { useGoogleOAuthPopup } from "@/src/hooks/useGoogleOAuthPopup";
import { STATUS_ICONS } from "@/src/config/icons";

/**
 * Persistent alerts at the top of every provider page. Today: an expired Google connection
 * (found by the daily check or a failed Meet creation). Only admins can read or fix it.
 */
export function ProviderAlerts() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === AdminRole.ADMIN || user?.role === AdminRole.SUPER_ADMIN;

  return isAdmin ? <GoogleExpiredAlert /> : null;
}

function GoogleExpiredAlert() {
  const { data: connection, fetchConnection } = useFetchGoogleConnection();
  const { startOAuth, loading: startingOAuth, error: startError } = useStartGoogleOAuth();
  const [ resultError, setResultError ] = useState<string | null>(null);

  const { openOAuth, waiting, error: popupError } = useGoogleOAuthPopup(
    useCallback(async (result) => {
      if (!result.success) {
        setResultError(result.error ?? "No se pudo reconectar con Google.");
        return;
      }
      setResultError(null);
      await fetchConnection();
    }, [ fetchConnection ]),
  );

  if (connection?.status !== "expired") return null;

  const error = resultError || popupError || startError;
  const busy = startingOAuth || waiting;

  return (
    <div className="warning-banner" role="status" data-testid="google-expired-banner">
      <STATUS_ICONS.warning size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div className="warning-banner__body">
        <p className="warning-banner__text">
          Tu conexión con Google expiró. Reconéctala para generar enlaces de Meet.
        </p>
        {error && <p className="warning-banner__error" role="alert">{error}</p>}
      </div>
      <button
        type="button"
        className="btn-secondary"
        disabled={busy}
        onClick={() => {
          setResultError(null);
          void openOAuth(() => startOAuth("/settings", true));
        }}
        data-testid="google-expired-reconnect"
      >
        {busy ? "Reconectando…" : "Reconectar"}
      </button>
    </div>
  );
}
