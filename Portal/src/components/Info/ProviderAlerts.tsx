"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useAuthContext } from "@/src/providers/AuthContext";
import { AdminRole } from "@/src/types/User";
import { useFetchGoogleConnection } from "@/src/api/google/useFetchGoogleConnection";
import { useStartGoogleOAuth } from "@/src/api/google/useStartGoogleOAuth";
import { useGoogleOAuthPopup } from "@/src/hooks/useGoogleOAuthPopup";
import { STATUS_ICONS } from "@/src/config/icons";

export function ProviderAlerts() {
  const { user } = useAuthContext();
  const isAdmin = user?.role === AdminRole.ADMIN || user?.role === AdminRole.SUPER_ADMIN;

  return isAdmin ? <GoogleExpiredAlert /> : null;
}

const INTEGRATIONS_HREF = { pathname: "/settings", query: { tab: "Integraciones" } };

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
    <section className="warning-banner" aria-labelledby="google-expired-banner-text" data-testid="google-expired-banner">
      <STATUS_ICONS.warning size={18} aria-hidden="true" className="warning-banner__icon" />
      <div className="warning-banner__body">
        <p id="google-expired-banner-text" className="warning-banner__text">
          Tu conexión con Google expiró. Reconéctala para generar enlaces de Meet.
        </p>
        {error && <p className="warning-banner__error" role="alert">{error}</p>}
      </div>
      <div className="warning-banner__actions">
        <Link href={INTEGRATIONS_HREF} className="warning-banner__link" data-testid="google-expired-settings-link">
          No uso Google Meet
        </Link>
        <button
          type="button"
          className="warning-banner__action"
          disabled={busy}
          onClick={() => {
            setResultError(null);
            void openOAuth(() => startOAuth("/settings", true));
          }}
          data-testid="google-expired-reconnect"
        >
          {busy ? "Reconectando…" : "Reconectar Google"}
        </button>
      </div>
    </section>
  );
}
