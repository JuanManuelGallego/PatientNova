/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { STATUS_ICONS } from "@/src/config/icons";

function GoogleOAuthCompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ status, setStatus ] = useState<"loading" | "success" | "error">("loading");
  const [ errorMessage, setErrorMessage ] = useState<string | null>(null);

  const success = searchParams.get("success");
  const error = searchParams.get("error");
  const rp = searchParams.get("returnPath");

  useEffect(() => {
    if (success === "true") {
      setStatus("success");
      const message = {
        type: "GOOGLE_OAUTH_COMPLETE",
        success: true,
        returnPath: rp,
      };
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
        window.close();
      }
    } else if (success === "false" || error) {
      setStatus("error");
      const errorMessages: Record<string, string> = {
        invalid_state: "Invalid or expired authorization state. Please try again.",
        state_consumed: "This authorization has already been used. Please try again.",
        token_revoked: "Your Google authorization was revoked. Please reconnect.",
        scope_missing: "Required Google Meet permission was not granted. Please try again.",
        config_missing: "Google integration is not configured. Contact your administrator.",
        callback_failed: "Authorization failed. Please try again.",
        missing_parameters: "Missing authorization parameters. Please try again.",
      };
      const msg = errorMessages[error ?? ""] ?? "Authorization failed. Please try again.";
      setErrorMessage(msg);
      const message = {
        type: "GOOGLE_OAUTH_COMPLETE",
        success: false,
        error: msg,
      };
      if (window.opener) {
        window.opener.postMessage(message, window.location.origin);
        window.close();
      }
    }
  }, [ success, error, rp ]);

  if (status === "loading") {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <p style={{ color: "var(--c-gray-500)" }}>Completing Google authorization...</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
        <div className="card" style={{ textAlign: "center", padding: 40, maxWidth: 400 }}>
          <STATUS_ICONS.success size={48} style={{ color: "var(--c-green)", marginBottom: 16 }} />
          <h2 style={{ marginBottom: 8 }}>Google account connected!</h2>
          <p style={{ color: "var(--c-gray-500)", marginBottom: 24 }}>
            You can now close this window and continue.
          </p>
          <button
            onClick={() => window.close()}
            className="btn-primary"
            style={{ width: "100%" }}
          >
            Close Window
          </button>
          {rp && (
            <p style={{ marginTop: 16, fontSize: 14, color: "var(--c-gray-400)" }}>
              Redirecting to <strong>{rp}</strong>...
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "50vh" }}>
      <div className="card" style={{ textAlign: "center", padding: 40, maxWidth: 400 }}>
        <STATUS_ICONS.danger size={48} style={{ color: "var(--c-red)", marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Authorization failed</h2>
        <p style={{ color: "var(--c-gray-500)", marginBottom: 24 }}>
          {errorMessage}
        </p>
        <button
          onClick={() => {
            if (rp) {
              router.push(rp);
            } else {
              window.close();
            }
          }}
          className="btn-primary"
          style={{ width: "100%", marginBottom: 12 }}
        >
          {rp ? "Continue to App" : "Close Window"}
        </button>
        <button
          onClick={() => window.close()}
          className="btn-secondary"
          style={{ width: "100%" }}
        >
          Close Window
        </button>
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
          <p style={{ color: "var(--c-gray-500)" }}>Completing Google authorization...</p>
        </div>
      </div>
    )}>
      <GoogleOAuthCompleteContent />
    </Suspense>
  );
}
