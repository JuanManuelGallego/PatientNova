"use client";

import { useCallback, useState } from "react";
import { useFetchGoogleConnection } from "@/src/api/google/useFetchGoogleConnection";
import { useStartGoogleOAuth } from "@/src/api/google/useStartGoogleOAuth";
import { useDisconnectGoogle } from "@/src/api/google/useDisconnectGoogle";
import { STATUS_ICONS } from "@/src/config/icons";
import { fmtDate, fmtTime } from "@/src/utils/TimeUtils";
import { useGoogleOAuthPopup } from "@/src/hooks/useGoogleOAuthPopup";

export function GoogleIntegrationTab() {
  const { fetchConnection, loading: loadingConnection, error: connectionError, data } = useFetchGoogleConnection();
  const { startOAuth, loading: startingOAuth, error: oauthStartError } = useStartGoogleOAuth();
  const { disconnect, loading: disconnecting, error: disconnectError } = useDisconnectGoogle();

  const [ actionError, setActionError ] = useState<string | null>(null);
  const connection = data;

  const { openOAuth, waiting: waitingForOAuth, error: popupError } = useGoogleOAuthPopup(
    useCallback(async (result) => {
      if (result.success) {
        setActionError(null);
        await fetchConnection();
      } else {
        setActionError(result.error ?? "Error al conectar con Google.");
      }
    }, [ fetchConnection ]),
  );

  const handleConnect = useCallback(async (isReconnect = false) => {
    setActionError(null);
    await openOAuth(() => startOAuth("/settings", isReconnect));
  }, [ openOAuth, startOAuth ]);

  const handleDisconnect = useCallback(async () => {
    if (!confirm("¿Estás seguro de desconectar tu cuenta de Google? Los enlaces de Google Meet existentes seguirán funcionando.")) {
      return;
    }
    try {
      await disconnect();
      await fetchConnection();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "No se pudo desconectar la cuenta de Google.");
    }
  }, [ disconnect, fetchConnection ]);

  const isConnected = connection?.connected === true;
  const connectedAt = connection?.connectedAt;
  const lastUsedAt = connection?.lastUsedAt;
  const isUnknown = !connection && !connectionError;
  const isLoading = loadingConnection || startingOAuth || waitingForOAuth || disconnecting;
  const displayedError = actionError || popupError || oauthStartError || connectionError || disconnectError;

  return (
    <div className="form-stack" style={{ maxWidth: 600 }}>
      <div>
        <h3 style={{ marginBottom: 4 }}>Integración con Google Meet</h3>
        <p style={{ color: "var(--c-gray-500)", fontSize: 14 }}>
          Conecta tu cuenta de Google para generar enlaces de Google Meet automaticamente.
        </p>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <div aria-live="polite" style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: isConnected ? "var(--c-green-100)" : "var(--c-gray-100)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isConnected ? (
              <STATUS_ICONS.success size={28} style={{ color: "var(--c-green)" }} />
            ) : (
              <STATUS_ICONS.warning size={28} style={{ color: "var(--c-gray-400)" }} />
            )}
          </div>
          <div>
            <h4 style={{ marginBottom: 4 }}>
              {isUnknown ? "Comprobando conexión con Google…" : connectionError ? "No se pudo comprobar la conexión" : isConnected ? "Cuenta de Google conectada" : "Cuenta de Google no conectada"}
            </h4>
            <p style={{ color: "var(--c-gray-500)", fontSize: 14 }}>
              {isUnknown
                ? "Espera mientras consultamos el estado de la integración."
                : isConnected && connectedAt
                  ? `Conectado el ${fmtDate(connectedAt)} a las ${fmtTime(connectedAt)}`
                  : isConnected
                    ? "La cuenta está conectada."
                    : "En espera de activación."}
            </p>
          </div>
        </div>

        {isConnected && (
          <div style={{ marginBottom: 16, padding: 12, background: "var(--c-gray-50)", borderRadius: 8, fontSize: 13 }}>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <span style={{ color: "var(--c-gray-500)" }}>Último uso: </span>
                <strong>{lastUsedAt ? `${fmtDate(lastUsedAt)} a las ${fmtTime(lastUsedAt)}` : "Nunca"}</strong>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {!isUnknown && !isConnected && (
            <button
              className="btn-primary"
              onClick={() => handleConnect(false)}
              disabled={isLoading}
              data-testid="google-connect-button"
            >
              {startingOAuth ? "Conectando…" : "Conectar cuenta de Google"}
            </button>
          )}

          {isConnected && (
            <>
              <button
                className="btn-secondary"
                onClick={() => handleConnect(true)}
                disabled={isLoading}
                data-testid="google-reconnect-button"
              >
                {startingOAuth ? "Reconectando…" : "Reconectar cuenta"}
              </button>
              <button
                className="btn-danger"
                onClick={handleDisconnect}
                disabled={isLoading}
                data-testid="google-disconnect-button"
              >
                {disconnecting ? "Desconectando…" : "Desconectar cuenta"}
              </button>
            </>
          )}
        </div>

        {displayedError && (
          <div role="alert" className="error-inline" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} />
            {displayedError}
          </div>
        )}
      </div>
    </div>
  );
}
