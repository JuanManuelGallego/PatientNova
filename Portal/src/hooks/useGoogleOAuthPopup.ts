"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OAuthCompletionResult } from "@/src/types/Google";

const POPUP_FEATURES = "width=600,height=700";

export function useGoogleOAuthPopup(
  onComplete: (result: OAuthCompletionResult) => void | Promise<void>,
) {
  const popupRef = useRef<Window | null>(null);
  const processedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [ waiting, setWaiting ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [ onComplete ]);

  const closePopup = useCallback(() => {
    const popup = popupRef.current;
    popupRef.current = null;
    setWaiting(false);
    if (popup && !popup.closed) popup.close();
  }, []);

  const openOAuth = useCallback(async (getAuthUrl: () => Promise<{ authUrl: string }>) => {
    setError(null);
    processedRef.current = false;

    // Open synchronously from the click so browser popup blockers do not reject it.
    const popup = window.open("", "google_oauth", POPUP_FEATURES);
    if (!popup) {
      setError("No se pudo abrir la ventana de Google. Permite ventanas emergentes o conecta tu cuenta desde Configuración.");
      return false;
    }

    popupRef.current = popup;
    setWaiting(true);
    try {
      const { authUrl } = await getAuthUrl();
      if (popup.closed) {
        popupRef.current = null;
        setWaiting(false);
        setError("La ventana de Google se cerró. Conecta tu cuenta desde Configuración e inténtalo de nuevo.");
        return false;
      }
      popup.location.href = authUrl;
      return true;
    } catch (cause) {
      closePopup();
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar la conexión con Google.");
      return false;
    }
  }, [ closePopup ]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const popup = popupRef.current;
      if (!popup || processedRef.current) return;
      if (event.origin !== window.location.origin || event.source !== popup) return;
      if (event.data?.type !== "GOOGLE_OAUTH_COMPLETE") return;

      processedRef.current = true;
      closePopup();
      void onCompleteRef.current({
        success: event.data.success === true,
        returnPath: event.data.returnPath,
        error: event.data.error,
      });
    };

    window.addEventListener("message", handleMessage);
    const closedCheck = window.setInterval(() => {
      if (popupRef.current?.closed && !processedRef.current) {
        popupRef.current = null;
        setWaiting(false);
        setError("La ventana de Google se cerró. Conecta tu cuenta desde Configuración e inténtalo de nuevo.");
      }
    }, 500);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearInterval(closedCheck);
      const popup = popupRef.current;
      popupRef.current = null;
      if (popup && !popup.closed) popup.close();
    };
  }, [ closePopup ]);

  return { openOAuth, waiting, error, clearError: () => setError(null) };
}
