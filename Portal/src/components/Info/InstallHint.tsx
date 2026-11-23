"use client";

import { useEffect, useState } from "react";
import { isIosSafariBrowser } from "@/src/utils/standalone";

const DISMISSED_KEY = "patientnova-install-hint-dismissed";

export function InstallHint(): React.JSX.Element | null {
  const [ visible, setVisible ] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISSED_KEY) === "1"; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(isIosSafariBrowser() && !dismissed);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
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
