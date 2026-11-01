"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { TURNSTILE_ORIGIN } from "@/src/config/securityHeaders";

const SCRIPT_SRC = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
const DEFAULT_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface TurnstileApi {
    render: (container: HTMLElement, options: Record<string, unknown>) => string;
    reset: (widgetId: string) => void;
    remove: (widgetId: string) => void;
}

declare global {
    interface Window {
        turnstile?: TurnstileApi;
    }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    scriptPromise ??= new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = SCRIPT_SRC;
        script.async = true;
        script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
        script.onerror = () => {
            scriptPromise = null;
            reject(new Error("Turnstile script failed to load"));
        };
        document.head.appendChild(script);
    });
    return scriptPromise;
}

export interface TurnstileHandle {
    reset: () => void;
}

interface TurnstileWidgetProps {
    action: string;
    onToken: (token: string | null) => void;
    /** The widget cannot produce a token (misconfigured build, script blocked, challenge error). */
    onError?: () => void;
    siteKey?: string;
    ref?: Ref<TurnstileHandle>;
}

export function TurnstileWidget({ action, onToken, onError, siteKey = DEFAULT_SITE_KEY, ref }: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    const onErrorRef = useRef(onError);
    const [ failed, setFailed ] = useState(false);

    useEffect(() => {
        onTokenRef.current = onToken;
        onErrorRef.current = onError;
    }, [ onToken, onError ]);

    useImperativeHandle(ref, () => ({
        reset: () => {
            onTokenRef.current(null);
            if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
        },
    }), []);

    useEffect(() => {
        if (!siteKey) {
            // Misconfigured build: there is no bypass, so the form cannot be submitted.
            onTokenRef.current(null);
            onErrorRef.current?.();
            return;
        }
        let cancelled = false;
        loadTurnstile()
            .then((turnstile) => {
                if (cancelled || !containerRef.current) return;
                widgetIdRef.current = turnstile.render(containerRef.current, {
                    sitekey: siteKey,
                    action,
                    language: "es",
                    appearance: "interaction-only",
                    callback: (token: string) => {
                        setFailed(false);
                        onTokenRef.current(token);
                    },
                    "expired-callback": () => onTokenRef.current(null),
                    "error-callback": () => {
                        setFailed(true);
                        onTokenRef.current(null);
                        onErrorRef.current?.();
                    },
                });
            })
            .catch(() => {
                if (cancelled) return;
                setFailed(true);
                onErrorRef.current?.();
            });
        return () => {
            cancelled = true;
            if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
            widgetIdRef.current = null;
        };
    }, [ siteKey, action ]);

    return (
        <div>
            <div ref={containerRef} data-testid="turnstile-container" />
            {(failed || !siteKey) && (
                <p role="alert" className="form-input-hint">
                    No pudimos verificar que eres una persona. Recarga la página e inténtalo de nuevo.
                </p>
            )}
        </div>
    );
}
