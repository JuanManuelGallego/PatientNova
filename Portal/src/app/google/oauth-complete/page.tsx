"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { STATUS_ICONS } from "@/src/config/icons";
import { settingsHref } from "@/src/config/navigation";
import { OAUTH_POPUP_CHANNEL_KEY, OAUTH_REDIRECT_KEY } from "@/src/hooks/useGoogleOAuthPopup";
import type { OAuthCompletionResult } from "@/src/types/Google";

function notifyCompletion(message: OAuthCompletionResult & { type: string }) {
  let notified = false;
  try {
    const name = sessionStorage.getItem(OAUTH_POPUP_CHANNEL_KEY);
    sessionStorage.removeItem(OAUTH_POPUP_CHANNEL_KEY);
    if (name && typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(name);
      channel.postMessage(message);
      channel.close();
      notified = true;
    }
  } catch { /* The opener remains the fallback when storage or channels are unavailable. */ }
  if (window.opener) {
    window.opener.postMessage(message, window.location.origin);
    notified = true;
  }
  // Defer close so the parent can process the message first.
  if (notified) setTimeout(() => window.close(), 150);
}

function GoogleOAuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ status, setStatus ] = useState<"loading" | "success" | "error">("loading");
  const [ errorMessage, setErrorMessage ] = useState<string | null>(null);
  const notifiedRef = useRef(false);
  const [ redirectFlow, setRedirectFlow ] = useState(false);

  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const rp = searchParams.get("returnPath");

  useEffect(() => {
    if (notifiedRef.current) return;

    const isResult = success === "true" || success === "false" || !!error;
    let wasRedirect = false;
    if (isResult) {
      try {
        wasRedirect = sessionStorage.getItem(OAUTH_REDIRECT_KEY) === "1";
        sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
      } catch {}
    }
    const redirected = wasRedirect && !window.opener;
    if (redirected) setRedirectFlow(true);

    if (success === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus("success");
      notifiedRef.current = true;
      const message = {
        type: "GOOGLE_OAUTH_COMPLETE",
        success: true,
        returnPath: rp ?? undefined,
      };
      if (redirected) {
        router.replace(rp ?? settingsHref("integrations"));
      } else {
        notifyCompletion(message);
      }
    } else if (success === "false" || error) {
      setStatus("error");
      notifiedRef.current = true;
      const errorMessages: Record<string, string> = {
        invalid_state: "La autorización expiró o no es válida. Inténtalo de nuevo.",
        state_consumed: "Esta autorización ya se usó. Inténtalo de nuevo.",
        token_revoked: "Google revocó la autorización. Vuelve a conectar tu cuenta.",
        scope_missing: "No se concedió el permiso de Google Meet. Inténtalo de nuevo y acepta ese permiso.",
        config_missing: "La integración con Google no está configurada. Contacta al administrador.",
        callback_failed: "No se pudo conectar tu cuenta de Google. Inténtalo de nuevo.",
        missing_parameters: "Faltan datos de la autorización. Inténtalo de nuevo.",
      };
      const msg = errorMessages[error ?? ""] ?? "No se pudo conectar tu cuenta de Google. Inténtalo de nuevo.";
      setErrorMessage(msg);
      const message = {
        type: "GOOGLE_OAUTH_COMPLETE",
        success: false,
        error: msg,
      };
      notifyCompletion(message);
    }
  }, [ success, error, rp, router ]);

  if (status === "loading") {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "var(--c-gray-500)" }}>Conectando tu cuenta de Google…</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div className="card" style={{ textAlign: "center", padding: 40, maxWidth: 400 }}>
          <STATUS_ICONS.success size={48} style={{ color: "var(--c-success)", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Cuenta de Google conectada</h2>
          {redirectFlow ? (
            <p style={{ color: "var(--c-gray-500)" }}>Volviendo a Patient Nova…</p>
          ) : (
            <>
              <p style={{ color: "var(--c-gray-500)", marginBottom: 24 }}>
                Ya puedes cerrar esta ventana y continuar.
              </p>
              <button
                onClick={() => window.close()}
                className="btn-primary"
                style={{ width: "100%" }}
              >
                Cerrar ventana
              </button>
            </>
          )}
          {rp && !redirectFlow && (
            <p style={{ marginTop: 16, fontSize: 14, color: "var(--c-gray-400)" }}>
              Volviendo a <strong>{rp}</strong>…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
      <div className="card" style={{ textAlign: "center", padding: 40, maxWidth: 400 }}>
        <STATUS_ICONS.danger size={48} style={{ color: "var(--c-error)", marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>No se pudo conectar Google</h2>
        <p style={{ color: "var(--c-gray-500)", marginBottom: 24 }}>
          {errorMessage}
        </p>
        <button
          onClick={() => {
            if (redirectFlow) {
              router.replace(rp ?? settingsHref("integrations"));
            } else if (rp) {
              router.push(rp);
            } else {
              window.close();
            }
          }}
          className="btn-primary"
          style={{ width: "100%", marginBottom: 12 }}
        >
          {rp || redirectFlow ? "Volver a Patient Nova" : "Cerrar ventana"}
        </button>
        {!redirectFlow && (
          <button
            onClick={() => window.close()}
            className="btn-secondary"
            style={{ width: "100%" }}
          >
            Cerrar ventana
          </button>
        )}
      </div>
    </div>
  );
}

export default function GoogleOAuthCompletePage() {
  return (
    <Suspense fallback={(
      <div className="page-container" role="status" aria-live="polite" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "var(--c-gray-500)" }}>Conectando tu cuenta de Google…</p>
        </div>
      </div>
    )}>
      <GoogleOAuthCompleteContent />
    </Suspense>
  );
}
