"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { OAuthCompletionResult } from "@/src/types/Google";
import { assignLocation } from "@/src/utils/browserNavigation";
import { isStandaloneDisplay } from "@/src/utils/standalone";

export const OAUTH_REDIRECT_KEY = "patientnova-google-oauth-redirect";
export const OAUTH_POPUP_CHANNEL_KEY = "patientnova-google-oauth-channel";

const POPUP_FEATURES = "width=600,height=700";

export function useGoogleOAuthPopup(
  onComplete: (result: OAuthCompletionResult) => void | Promise<void>,
) {
  const popupRef = useRef<Window | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const processedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [ waiting, setWaiting ] = useState(false);
  const [ error, setError ] = useState<string | null>(null);
  const [ mode, setMode ] = useState<"popup" | "redirect">("popup");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(isStandaloneDisplay() ? "redirect" : "popup");
  }, []);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [ onComplete ]);

  const closePopup = useCallback(() => {
    channelRef.current?.close();
    channelRef.current = null;
    const popup = popupRef.current;
    popupRef.current = null;
    setWaiting(false);
    if (popup && !popup.closed) popup.close();
  }, []);

  const completeOAuth = useCallback((data: OAuthCompletionResult & { type?: string }) => {
    if (processedRef.current || data?.type !== "GOOGLE_OAUTH_COMPLETE") return;
    processedRef.current = true;
    setError(null);
    closePopup();
    void onCompleteRef.current({
      success: data.success === true,
      returnPath: data.returnPath,
      error: data.error,
    });
  }, [ closePopup ]);

  const openOAuth = useCallback(async (getAuthUrl: () => Promise<{ authUrl: string }>) => {
    closePopup();
    setError(null);
    processedRef.current = false;

    if (isStandaloneDisplay()) {
      setWaiting(true);
      try {
        const { authUrl } = await getAuthUrl();
        try { sessionStorage.setItem(OAUTH_REDIRECT_KEY, "1"); } catch {}
        assignLocation(authUrl);
        return true;
      } catch (cause) {
        try { sessionStorage.removeItem(OAUTH_REDIRECT_KEY); } catch {}
        setWaiting(false);
        setError(cause instanceof Error ? cause.message : "No se pudo iniciar la conexión con Google.");
        return false;
      }
    }

    // Open synchronously from the click so browser popup blockers do not reject it.
    const popup = window.open("", "google_oauth", POPUP_FEATURES);
    if (!popup) {
      setError("No se pudo abrir la ventana de Google. Permite ventanas emergentes o conecta tu cuenta desde Configuración.");
      return false;
    }

    popupRef.current = popup;
    setWaiting(true);
    // Chrome may sever window.opener during OAuth; a private channel survives that navigation.
    try {
      if (typeof BroadcastChannel !== "undefined") {
        const name = `patientnova-google-oauth-${crypto.randomUUID()}`;
        popup.sessionStorage.setItem(OAUTH_POPUP_CHANNEL_KEY, name);
        const channel = new BroadcastChannel(name);
        channel.onmessage = (event) => completeOAuth(event.data);
        channelRef.current = channel;
      }
    } catch { /* Keep postMessage when browser storage or channels are unavailable. */ }
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
  }, [ closePopup, completeOAuth ]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const popup = popupRef.current;
      if (!popup || processedRef.current) return;
      if (event.origin !== window.location.origin || event.source !== popup) return;
      completeOAuth(event.data);
    };

    window.addEventListener("message", handleMessage);
    const closedCheck = window.setInterval(() => {
      const popup = popupRef.current;
      if (popup?.closed && !processedRef.current && (!channelRef.current || document.hasFocus())) {
        popupRef.current = null;
        setWaiting(false);
        setError("La ventana de Google se cerró. Conecta tu cuenta desde Configuración e inténtalo de nuevo.");
      }
    }, 500);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.clearInterval(closedCheck);
      channelRef.current?.close();
      channelRef.current = null;
      const popup = popupRef.current;
      popupRef.current = null;
      if (popup && !popup.closed) popup.close();
    };
  }, [ completeOAuth ]);

  return { openOAuth, mode, waiting, error, clearError: () => setError(null) };
}
