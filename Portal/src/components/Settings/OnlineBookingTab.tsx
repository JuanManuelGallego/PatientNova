"use client";

import { useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useFetchBookingSettings } from "@/src/api/booking/useFetchBookingSettings";
import { useUpdateBookingSettings } from "@/src/api/booking/useUpdateBookingSettings";
import { useFetchSlugSuggestion } from "@/src/api/booking/useFetchSlugSuggestion";
import { useFetchAvailability } from "@/src/api/booking/useFetchAvailability";
import { useSaveAvailability } from "@/src/api/booking/useSaveAvailability";
import { AvailabilityRule, BookingSettings, BookingSettingsUpdate, SLOT_INTERVAL_OPTIONS } from "@/src/types/Booking";
import {
    WEEKDAYS_ES,
    availabilityError,
    minutesToTime,
    slugError,
    sortRules,
    timeToMinutes,
} from "@/src/utils/bookingAvailability";
import { fmtTimezoneLabel } from "@/src/utils/TimeUtils";
import { CustomSelect } from "@/src/components/CustomSelect";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { ERR_LOAD, ERR_SAVE, LBL_LOADING, LBL_SAVE, LBL_SAVING } from "@/src/constants/ui";

const DEFAULT_WINDOW = { startMinute: 9 * 60, endMinute: 12 * 60 };
const MINUTES_PER_DAY = 1440;

const READINESS_ITEMS: Array<{ key: keyof BookingSettings[ "readiness" ]; label: string }> = [
    { key: "hasSlug", label: "Enlace de reserva definido" },
    { key: "hasAvailability", label: "Al menos una franja de disponibilidad semanal" },
    { key: "hasBookableType", label: "Un tipo de cita disponible en línea (Tipos de Cita)" },
    { key: "hasBookableLocation", label: "Una ubicación presencial disponible en línea (Ubicaciones)" },
];

function ErrorLine({ message }: { message: string }) {
    return (
        <div className="error-inline" role="alert" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} /> {message}
        </div>
    );
}

export function OnlineBookingTab() {
    const { settings, loading, error, fetchSettings } = useFetchBookingSettings();
    const { updateSettings } = useUpdateBookingSettings();

    // Sections hand back the server's answer so readiness and the link refresh without a refetch.
    const [ latest, setCurrent ] = useState<BookingSettings | undefined>(undefined);
    const current = latest ?? settings;

    const [ statusError, setStatusError ] = useState<string | null>(null);

    if (!current) {
        if (error) return <ErrorLine message={error || ERR_LOAD} />;
        return <p className="form-input-hint">{loading ? LBL_LOADING : ""}</p>;
    }

    return (
        <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 20 }} data-testid="online-booking-tab">
            <StatusSection
                settings={current}
                onToggle={async (enabled) => {
                    setStatusError(null);
                    try {
                        setCurrent(await updateSettings({ bookingEnabled: enabled }));
                    } catch (err) {
                        setStatusError(err instanceof Error ? err.message : ERR_SAVE);
                    }
                }}
                error={statusError}
            />
            <LinkSection settings={current} save={updateSettings} onSaved={setCurrent} />
            <AvailabilitySection
                timezone={current.timezone}
                // Readiness depends on availability; take the fresh settings or `latest` would shadow them.
                onSaved={async () => {
                    const fresh = await fetchSettings();
                    if (fresh) setCurrent(fresh);
                }}
            />
            <RulesSection settings={current} save={updateSettings} onSaved={setCurrent} />
        </div>
    );
}

function StatusSection({ settings, onToggle, error }: {
    settings: BookingSettings;
    onToggle: (enabled: boolean) => Promise<void>;
    error: string | null;
}) {
    const [ toggling, setToggling ] = useState(false);
    const ready = READINESS_ITEMS.every((i) => settings.readiness[ i.key ]);
    // Disabling is always allowed; enabling needs every readiness item.
    const canToggle = settings.bookingEnabled || ready;

    async function handleToggle(enabled: boolean) {
        setToggling(true);
        try {
            await onToggle(enabled);
        } finally {
            setToggling(false);
        }
    }

    return (
        <div className="dash-card">
            <div className="dash-card__header">
                <span className="dash-card__title">Reserva en línea</span>
            </div>
            <div className="dash-card__body form-stack">
                <span className="form-input-hint">
                    Permite que tus pacientes reserven citas desde tu enlace público, según tu disponibilidad semanal.
                </span>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }} data-testid="online-booking-readiness">
                    {READINESS_ITEMS.map((item) => {
                        const ok = settings.readiness[ item.key ];
                        const Icon = ok ? STATUS_ICONS.success : STATUS_ICONS.pending;
                        return (
                            <li key={item.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ok ? "var(--c-success)" : "var(--c-gray-400)" }}>
                                <Icon size={14} aria-hidden="true" />
                                <span>{item.label}</span>
                                <span className="sr-only">{ok ? "(listo)" : "(pendiente)"}</span>
                            </li>
                        );
                    })}
                </ul>
                <label
                    className="form-label"
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, opacity: canToggle ? 1 : 0.6 }}
                >
                    <input
                        type="checkbox"
                        checked={settings.bookingEnabled}
                        disabled={!canToggle || toggling}
                        onChange={(e) => handleToggle(e.target.checked)}
                        data-testid="online-booking-enabled-toggle"
                    />
                    Activar reserva en línea
                </label>
                {!canToggle && (
                    <span className="form-input-hint">Completa los puntos pendientes para poder activarla.</span>
                )}
                {settings.bookingEnabled && !settings.live && (
                    <div className="form-input-hint" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-warning-dark)" }} data-testid="online-booking-not-live">
                        <STATUS_ICONS.warning size={14} />
                        Está activada, pero tu enlace no recibe reservas: completa los puntos pendientes.
                    </div>
                )}
                {error && <ErrorLine message={error} />}
            </div>
        </div>
    );
}

function LinkSection({ settings, save, onSaved }: {
    settings: BookingSettings;
    save: (body: BookingSettingsUpdate) => Promise<BookingSettings>;
    onSaved: (s: BookingSettings) => void;
}) {
    const { suggestion } = useFetchSlugSuggestion(!settings.bookingSlug);
    // null until the provider types: shows the saved slug, else the server's suggestion.
    const [ typed, setSlug ] = useState<string | null>(null);
    const touched = typed !== null;
    const slug = typed ?? settings.bookingSlug ?? suggestion ?? "";
    const [ error, setError ] = useState<string | null>(null);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);
    const [ copied, setCopied ] = useState(false);
    const qrRef = useRef<HTMLDivElement>(null);

    const normalized = slug.trim().toLowerCase();
    const validation = normalized ? slugError(normalized) : null;
    const changed = normalized !== (settings.bookingSlug ?? "");
    const isRename = !!settings.bookingSlug && changed && !!normalized;
    const isClear = !!settings.bookingSlug && !normalized;

    async function handleSave() {
        setError(null);
        setSaved(false);
        setSaving(true);
        try {
            onSaved(await save({ bookingSlug: normalized || null }));
            setSaved(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : ERR_SAVE);
        } finally {
            setSaving(false);
        }
    }

    async function handleCopy() {
        if (!settings.bookingUrl) return;
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
        // Revoking synchronously can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return (
        <div className="dash-card">
            <div className="dash-card__header">
                <span className="dash-card__title">Enlace de reserva</span>
            </div>
            <div className="dash-card__body form-stack">
                <label className="form-label">
                    Enlace
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span className="form-input-hint" style={{ whiteSpace: "nowrap" }}>/book/</span>
                        <input
                            className="form-input"
                            value={slug}
                            onChange={(e) => { setSaved(false); setSlug(e.target.value); }}
                            placeholder="dra-maria-perez"
                            maxLength={40}
                            data-testid="online-booking-slug-input"
                        />
                    </div>
                    <span className="form-input-hint">Letras minúsculas, números y guiones. Entre 3 y 40 caracteres.</span>
                </label>
                {touched && validation && <ErrorLine message={validation} />}
                {isRename && (
                    <div className="form-input-hint" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-warning-dark)" }} data-testid="online-booking-slug-warning">
                        <STATUS_ICONS.warning size={14} />
                        Si cambias el enlace, los enlaces y códigos QR que ya compartiste dejarán de funcionar.
                    </div>
                )}
                {isClear && (
                    <div className="form-input-hint" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-warning-dark)" }} data-testid="online-booking-slug-clear-warning">
                        <STATUS_ICONS.warning size={14} />
                        Si quitas el enlace, la reserva en línea se desactivará y los enlaces y códigos QR que ya compartiste dejarán de funcionar.
                    </div>
                )}
                {error && <ErrorLine message={error} />}
                {saved && <SuccessBanner message="Enlace actualizado." />}
                <div>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving || !changed || !!validation}
                        data-testid="online-booking-slug-save"
                    >
                        {saving ? LBL_SAVING : "Guardar enlace"}
                    </button>
                </div>

                {settings.bookingUrl && (
                    <div style={{ borderTop: "1px solid var(--c-gray-100)", paddingTop: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
                        <div ref={qrRef} data-testid="online-booking-qr">
                            <QRCodeSVG value={settings.bookingUrl} size={128} marginSize={2} title="Código QR del enlace de reserva" />
                        </div>
                        <div className="form-stack" style={{ flex: 1, minWidth: 220 }}>
                            <code style={{ fontSize: 13, wordBreak: "break-all" }} data-testid="online-booking-url">{settings.bookingUrl}</code>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                <button type="button" className="btn-secondary" onClick={handleCopy} data-testid="online-booking-copy">
                                    <ACTION_ICONS.copy size={14} /> {copied ? "¡Copiado!" : "Copiar enlace"}
                                </button>
                                <button type="button" className="btn-secondary" onClick={handleDownloadQr} data-testid="online-booking-qr-download">
                                    <ACTION_ICONS.download size={14} /> Descargar QR
                                </button>
                            </div>
                            {!settings.bookingEnabled && (
                                <span className="form-input-hint">El enlace no recibirá reservas hasta que actives la reserva en línea.</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AvailabilitySection({ timezone, onSaved }: { timezone: string; onSaved: () => void }) {
    const { availability, loading, error: loadError } = useFetchAvailability();
    const { saveAvailability } = useSaveAvailability();
    // Unsaved edits; null means "show what the server has".
    const [ draft, setDraft ] = useState<AvailabilityRule[] | null>(null);
    const [ savedRules, setSavedRules ] = useState<AvailabilityRule[] | null>(null);
    const dirty = draft !== null;
    const rules = draft ?? savedRules ?? availability?.rules ?? null;
    const [ error, setError ] = useState<string | null>(null);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);

    const validation = rules ? availabilityError(rules) : null;

    function update(next: AvailabilityRule[]) {
        setDraft(next);
        setSaved(false);
        setError(null);
    }

    function addWindow(weekday: number) {
        const current = rules ?? [];
        const sameDay = sortRules(current.filter((r) => r.weekday === weekday));
        const last = sameDay[ sameDay.length - 1 ];
        if (last && last.endMinute >= MINUTES_PER_DAY) return;
        // Start one hour after the last window when that fits in the day, else right where it ends (never overlapping).
        const startMinute = !last ? DEFAULT_WINDOW.startMinute
            : last.endMinute + 60 < MINUTES_PER_DAY ? last.endMinute + 60
            : last.endMinute;
        const endMinute = last ? Math.min(startMinute + 180, MINUTES_PER_DAY) : DEFAULT_WINDOW.endMinute;
        update([ ...current, { weekday, startMinute, endMinute } ]);
    }

    function setTime(target: AvailabilityRule, field: "startMinute" | "endMinute", value: string) {
        const minutes = timeToMinutes(value, field === "endMinute");
        if (minutes === null || !rules) return;
        update(rules.map((r) => (r === target ? { ...r, [ field ]: minutes } : r)));
    }

    async function handleSave() {
        if (!rules || validation) return;
        setSaving(true);
        setError(null);
        try {
            const result = await saveAvailability(sortRules(rules));
            setSavedRules(result.rules);
            setDraft(null);
            setSaved(true);
            onSaved();
        } catch (err) {
            setError(err instanceof Error ? err.message : ERR_SAVE);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="dash-card">
            <div className="dash-card__header">
                <span className="dash-card__title">Disponibilidad semanal</span>
            </div>
            <div className="dash-card__body form-stack" data-testid="online-booking-availability">
                <span className="form-input-hint">
                    Horarios en los que los pacientes pueden reservar, en tu zona horaria ({fmtTimezoneLabel(timezone)}).
                    Las citas y bloqueos de tu agenda se descuentan automáticamente.
                </span>
                {loadError && <ErrorLine message={loadError} />}
                {!rules && loading && <p className="form-input-hint">{LBL_LOADING}</p>}
                {rules && WEEKDAYS_ES.map(({ weekday, label }) => {
                    const dayRules = rules.filter((r) => r.weekday === weekday);
                    const dayFull = dayRules.some((r) => r.endMinute >= MINUTES_PER_DAY);
                    return (
                        <div
                            key={weekday}
                            style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12, alignItems: "start", borderTop: "1px solid var(--c-gray-100)", paddingTop: 10 }}
                            data-testid={`availability-day-${weekday}`}
                        >
                            <span style={{ fontWeight: 600, fontSize: 13, paddingTop: 8 }}>{label}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {dayRules.length === 0 && (
                                    <span className="form-input-hint" style={{ paddingTop: 8 }}>No disponible</span>
                                )}
                                {dayRules.map((r, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <input
                                            type="time"
                                            step={300}
                                            className="form-input"
                                            style={{ width: 120 }}
                                            value={minutesToTime(r.startMinute)}
                                            onChange={(e) => setTime(r, "startMinute", e.target.value)}
                                            aria-label={`${label}: hora de inicio`}
                                            data-testid={`availability-start-${weekday}-${i}`}
                                        />
                                        <span aria-hidden="true">–</span>
                                        <input
                                            type="time"
                                            step={300}
                                            className="form-input"
                                            style={{ width: 120 }}
                                            // 24:00 isn't a valid <input type="time"> value; midnight end shows as 00:00.
                                            value={r.endMinute === 1440 ? "00:00" : minutesToTime(r.endMinute)}
                                            onChange={(e) => setTime(r, "endMinute", e.target.value)}
                                            aria-label={`${label}: hora de fin`}
                                            data-testid={`availability-end-${weekday}-${i}`}
                                        />
                                        <button
                                            type="button"
                                            className="btn-action-delete"
                                            onClick={() => update(rules.filter((x) => x !== r))}
                                            title="Quitar franja"
                                            aria-label={`${label}: quitar franja`}
                                            data-testid={`availability-remove-${weekday}-${i}`}
                                        >
                                            <ACTION_ICONS.close size={14} />
                                        </button>
                                    </div>
                                ))}
                                <div>
                                    <button
                                        type="button"
                                        className="btn-action-edit"
                                        onClick={() => addWindow(weekday)}
                                        disabled={dayFull}
                                        data-testid={`availability-add-${weekday}`}
                                    >
                                        <ACTION_ICONS.plus size={14} /> Agregar franja
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {validation && dirty && <ErrorLine message={validation} />}
                {error && <ErrorLine message={error} />}
                {saved && <SuccessBanner message="Disponibilidad actualizada." />}
                <div>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving || !dirty || !!validation}
                        data-testid="availability-save"
                    >
                        {saving ? LBL_SAVING : "Guardar disponibilidad"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function RulesSection({ settings, save, onSaved }: {
    settings: BookingSettings;
    save: (body: BookingSettingsUpdate) => Promise<BookingSettings>;
    onSaved: (s: BookingSettings) => void;
}) {
    const [ interval, setSlotInterval ] = useState(settings.slotIntervalMinutes);
    const [ buffer, setBuffer ] = useState(settings.bufferMinutes);
    const [ leadHours, setLeadHours ] = useState(settings.minLeadMinutes / 60);
    const [ horizon, setHorizon ] = useState(settings.maxHorizonDays);
    const [ error, setError ] = useState<string | null>(null);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);

    const leadMinutes = Math.round(leadHours * 60);
    const invalid = buffer < 0 || buffer > 240 || leadMinutes < 0 || leadMinutes > 14 * 24 * 60 || horizon < 1 || horizon > 365
        || !Number.isInteger(buffer) || !Number.isInteger(horizon);
    const changed = interval !== settings.slotIntervalMinutes || buffer !== settings.bufferMinutes
        || leadMinutes !== settings.minLeadMinutes || horizon !== settings.maxHorizonDays;

    async function handleSave() {
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            onSaved(await save({ slotIntervalMinutes: interval, bufferMinutes: buffer, minLeadMinutes: leadMinutes, maxHorizonDays: horizon }));
            setSaved(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : ERR_SAVE);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="dash-card">
            <div className="dash-card__header">
                <span className="dash-card__title">Reglas de reserva</span>
            </div>
            <div className="dash-card__body form-stack">
                <div className="form-grid-2">
                    <label className="form-label" data-testid="online-booking-interval">
                        Intervalo entre horarios (min)
                        <CustomSelect
                            value={String(interval)}
                            onChange={(v) => setSlotInterval(Number(v))}
                            options={SLOT_INTERVAL_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
                        />
                        <span className="form-input-hint">Cada cuánto se ofrece un horario de inicio. La duración la define el tipo de cita.</span>
                    </label>
                    <label className="form-label">
                        Tiempo entre citas (min)
                        <input
                            className="form-input"
                            type="number"
                            min={0}
                            max={240}
                            value={buffer}
                            onChange={(e) => setBuffer(Number(e.target.value))}
                            data-testid="online-booking-buffer"
                        />
                        <span className="form-input-hint">Margen libre antes y después de cada cita reservada en línea.</span>
                    </label>
                    <label className="form-label">
                        Anticipación mínima (horas)
                        <input
                            className="form-input"
                            type="number"
                            min={0}
                            max={336}
                            step={0.5}
                            value={leadHours}
                            onChange={(e) => setLeadHours(Number(e.target.value))}
                            data-testid="online-booking-lead"
                        />
                        <span className="form-input-hint">Con cuánto tiempo de antelación se puede reservar.</span>
                    </label>
                    <label className="form-label">
                        Reservar hasta (días)
                        <input
                            className="form-input"
                            type="number"
                            min={1}
                            max={365}
                            value={horizon}
                            onChange={(e) => setHorizon(Number(e.target.value))}
                            data-testid="online-booking-horizon"
                        />
                        <span className="form-input-hint">Qué tan lejos en el futuro se puede reservar.</span>
                    </label>
                </div>
                {invalid && <ErrorLine message="Revisa los valores: tiempo entre citas 0–240 min, anticipación hasta 14 días, reservar hasta 1–365 días." />}
                {error && <ErrorLine message={error} />}
                {saved && <SuccessBanner message="Reglas de reserva actualizadas." />}
                <div>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={handleSave}
                        disabled={saving || !changed || invalid}
                        data-testid="online-booking-rules-save"
                    >
                        {saving ? LBL_SAVING : LBL_SAVE}
                    </button>
                </div>
            </div>
        </div>
    );
}
