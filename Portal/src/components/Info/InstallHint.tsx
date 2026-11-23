"use client";

import { useEffect, useState } from "react";
import { isIosSafariBrowser } from "@/src/utils/standalone";

const DISMISSED_KEY = "patientnova-install-hint-dismissed";

/** iOS has no install prompt: explains the Share menu route to the home screen. Shown once, in Safari only. */
export function InstallHint(): React.JSX.Element | null {
  const [ visible, setVisible ] = useState(false);

  // Decided after mount so the server and the first client render both show nothing.
  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISSED_KEY) === "1"; } catch { /* storage blocked */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(isIosSafariBrowser() && !dismissed);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch { /* storage blocked: hidden for this visit only */ }
    setVisible(false);
  }

  return (
    <div className="info-banner" data-testid="install-hint" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span>
        Instala Patient Nova en tu iPhone: toca <strong>Compartir</strong> y luego <strong>Agregar a inicio</strong>.
      </span>
      <button type="button" className="btn-secondary" onClick={dismiss}>Entendido</button>
    </div>
  );
}
