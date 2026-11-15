"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useFetchSlugSuggestion } from "@/src/api/booking/useFetchSlugSuggestion";
import { BookingSettings } from "@/src/types/Booking";
import { Switch } from "@/src/components/Form/Switch";
import { SaveStatusIndicator, type SaveStatus } from "@/src/components/Info/SaveStatusIndicator";
import { InlineError } from "@/src/components/Info/InlineError";
import { settingsHref } from "@/src/config/navigation";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { LINK_SECTION_ID, PROFILE_SECTION_ID, AVAILABILITY_SECTION_ID, type SaveFn } from "./shared";
import { SlugModal } from "./SlugModal";
import { SettingsSection } from "../SettingsSection";

const READINESS_ITEMS: Array<{ key: keyof BookingSettings[ "readiness" ]; label: string; fixLabel: string; href: string }> = [
    { key: "hasSlug", label: "Enlace de reserva definido", fixLabel: "Definir enlace", href: `#${LINK_SECTION_ID}` },
    { key: "hasLegalIdentity", label: "Responsable de los datos y contacto directo", fixLabel: "Completar tu página pública", href: `#${PROFILE_SECTION_ID}` },
    { key: "hasAvailability", label: "Al menos una franja de disponibilidad semanal", fixLabel: "Agregar disponibilidad", href: `#${AVAILABILITY_SECTION_ID}` },
    { key: "hasBookableType", label: "Un tipo de cita disponible en línea", fixLabel: "Ir a Tipos de cita", href: settingsHref("services", "appointment-types") },
    { key: "hasBookableLocation", label: "Una ubicación disponible en línea", fixLabel: "Ir a Ubicaciones", href: settingsHref("services", "locations") },
];

/** Status, what is still missing, and the link with its QR: everything needed to start taking bookings. */
export function OverviewSection({ settings, save, onSaved, onToggle, error: toggleError }: {
    settings: BookingSettings;
    save: SaveFn;
    onSaved: (s: BookingSettings) => void;
    onToggle: (enabled: boolean) => Promise<void>;
    error: string | null;
}) {
    const [ toggling, setToggling ] = useState(false);
    const ready = READINESS_ITEMS.every((i) => settings.readiness[ i.key ]);
    const canToggle = settings.bookingEnabled || ready;

    async function handleToggle(enabled: boolean) {
        setToggling(true);
        try {
            await onToggle(enabled);
        } finally {
            setToggling(false);
        }
    }

    const summary = settings.bookingEnabled && settings.live
        ? { text: "Tu enlace está recibiendo reservas.", bg: "var(--c-success-bg)", border: "var(--c-success-light)", Icon: STATUS_ICONS.success, iconColor: "var(--c-success)" }
        : settings.bookingEnabled
            ? { text: "Está activada, pero tu enlace no recibe reservas: completa los puntos pendientes.", bg: "var(--c-warning-light)", border: "var(--c-warning-light)", Icon: STATUS_ICONS.warning, iconColor: "var(--c-warning-dark)" }
            : { text: "La reserva en línea está desactivada.", bg: "var(--c-page-bg)", border: "var(--c-gray-100)", Icon: STATUS_ICONS.pending, iconColor: "var(--c-gray-500)" };

    const { suggestion } = useFetchSlugSuggestion(!settings.bookingSlug);
    const [ editing, setEditing ] = useState(false);
    const [ status, setStatus ] = useState<SaveStatus>("idle");
    const [ error, setError ] = useState<string | null>(null);
    const [ copied, setCopied ] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);
    const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(statusTimer.current), []);

    function handleSaved(next: BookingSettings) {
        onSaved(next);
        setEditing(false);
        setStatus("saved");
        clearTimeout(statusTimer.current);
        statusTimer.current = setTimeout(() => setStatus("idle"), 3000);
    }

    async function handleCopy() {
        if (!settings.bookingUrl) return;
        setError(null);
        try {
            await navigator.clipboard.writeText(settings.bookingUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("No pudimos copiar el enlace. Cópialo manualmente.");
        }
    }

    function handleDownloadQr() {
        const svg = qrRef.current?.querySelector("svg");
        if (!svg || !settings.bookingSlug) return;
        const blob = new Blob([ new XMLSerializer().serializeToString(svg) ], { type: "image/svg+xml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reserva-${settings.bookingSlug}.svg`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return (
        <SettingsSection
            title="Reserva en línea"
            status={<SaveStatusIndicator saving={false} status={status} testId="online-booking-slug-save-state" />}
            id={LINK_SECTION_ID}
        >
            <div className="form-stack">
                <div
                    style={{
                        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                        background: summary.bg, border: `1px solid ${summary.border}`, borderRadius: "var(--r-lg)", padding: "14px 16px",
                    }}
                    data-testid={settings.bookingEnabled && !settings.live ? "online-booking-not-live" : "online-booking-status"}
                    aria-live="polite"
                >
                    <summary.Icon size={18} aria-hidden="true" style={{ color: summary.iconColor, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 200, fontSize: 15, fontWeight: 600, color: "var(--c-gray-900)" }}>{summary.text}</span>
                    <Switch
                        checked={settings.bookingEnabled}
                        disabled={!canToggle || toggling}
                        onChange={handleToggle}
                        label="Reserva en línea"
                        testId="online-booking-enabled-toggle"
                    />
                </div>
                <span className="form-input-hint" style={{ alignSelf: "flex-start" }} data-testid="online-booking-status-hint">
                    {settings.bookingEnabled
                        ? "Si la desactivas, tus pacientes aún pueden ver y cancelar sus citas."
                        : "Permite que tus pacientes reserven desde tu enlace público, según tu disponibilidad semanal."}
                </span>
                {!ready && (
                    <>
                        {!canToggle && (
                            <span style={{ fontSize: 13, color: "var(--c-gray-700)" }}>Completa los puntos pendientes para poder activarla:</span>
                        )}
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }} data-testid="online-booking-readiness">
                            {READINESS_ITEMS.map((item) => {
                                const ok = settings.readiness[ item.key ];
                                const Icon = ok ? STATUS_ICONS.success : STATUS_ICONS.pending;
                                return (
                                    <li key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13, color: ok ? "var(--c-gray-500)" : "var(--c-gray-900)" }}>
                                        <Icon size={14} aria-hidden="true" style={{ color: ok ? "var(--c-success)" : "var(--c-warning-dark)" }} />
                                        <span style={{ fontWeight: ok ? 400 : 600 }}>{item.label}</span>
                                        <span className="sr-only">{ok ? "(listo)" : "(pendiente)"}</span>
                                        {!ok && item.key === "hasSlug" && (
                                            <button type="button" className="btn-text" onClick={() => setEditing(true)} data-testid="online-booking-readiness-slug">
                                                {item.fixLabel}
                                            </button>
                                        )}
                                        {!ok && item.key !== "hasSlug" && (
                                            <Link href={item.href} style={{ color: "var(--c-brand)", textDecoration: "underline" }}>{item.fixLabel}</Link>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
                {settings.bookingSlug && settings.bookingUrl ? (
                    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                        <div ref={qrRef} data-testid="online-booking-qr">
                            <QRCodeSVG value={settings.bookingUrl} size={128} marginSize={2} title="Código QR del enlace de reserva" />
                        </div>
                        <div className="form-stack" style={{ flex: 1, minWidth: 220 }}>
                            <a
                                href={settings.bookingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontSize: 15, fontWeight: 600, color: "var(--c-brand)", textDecoration: "underline", wordBreak: "break-all", alignSelf: "flex-start" }}
                                data-testid="online-booking-url"
                            >
                                {settings.bookingUrl}
                            </a>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button type="button" style={{ display: "flex", gap: 6, alignItems: "center" }} className="btn-primary" onClick={handleCopy} data-testid="online-booking-copy">
                                    <ACTION_ICONS.copy size={14} /> <span aria-live="polite">{copied ? "¡Copiado!" : "Copiar enlace"}</span>
                                </button>
                                <button type="button" style={{ display: "flex", gap: 6, alignItems: "center" }} className="btn-secondary" onClick={handleDownloadQr} data-testid="online-booking-qr-download">
                                    <ACTION_ICONS.download size={14} /> Descargar QR
                                </button>
                                <button type="button" style={{ display: "flex", gap: 6, alignItems: "center" }} className="btn-secondary" onClick={() => setEditing(true)} data-testid="online-booking-slug-edit">
                                    <ACTION_ICONS.edit size={14} /> Cambiar enlace
                                </button>
                            </div>
                            {!settings.bookingEnabled && (
                                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>El enlace no recibirá reservas hasta que actives la reserva en línea.</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="form-stack" style={{ alignItems: "flex-start" }}>
                        <span className="form-input-hint">
                            Elige la dirección pública donde tus pacientes verán tu perfil y reservarán. Podrás compartirla como enlace o código QR.
                        </span>
                        <button type="button" style={{ display: "flex", gap: 6, alignItems: "center" }} className="btn-primary" onClick={() => setEditing(true)} data-testid="online-booking-slug-create">
                            <ACTION_ICONS.plus size={14} /> Crear enlace
                        </button>
                    </div>
                )}
                {toggleError && <InlineError message={toggleError} />}
                {error && <InlineError message={error} />}
            </div>
            {editing && (
                <SlugModal
                    settings={settings}
                    suggestion={suggestion}
                    save={save}
                    onSaved={handleSaved}
                    onClose={() => setEditing(false)}
                />
            )}
        </SettingsSection>
    );
}
