"use client";

import { ReactNode, useId, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ConfigProvider } from "antd";
import esEs from "antd/locale/es_ES";
import dayjs from "dayjs";
import { ZonedDatePicker } from "@/src/components/ZonedDatePicker";
import { getAntThemeConfig } from "@/src/config/antTheme";
import { useTheme } from "@/src/providers/ThemeContext";
import { useFetchBookingSettings } from "@/src/api/booking/useFetchBookingSettings";
import { useUpdateBookingSettings } from "@/src/api/booking/useUpdateBookingSettings";
import { useFetchSlugSuggestion } from "@/src/api/booking/useFetchSlugSuggestion";
import { useFetchAvailability } from "@/src/api/booking/useFetchAvailability";
import { useSaveAvailability } from "@/src/api/booking/useSaveAvailability";
import { AvailabilityRule, BookingSettings, BookingSettingsUpdate, SLOT_INTERVAL_OPTIONS } from "@/src/types/Booking";
import {
    MINUTES_PER_DAY,
    WEEKDAYS_ES,
    availabilityError,
    minutesToTime,
    slugError,
    sortRules,
    timeToMinutes,
} from "@/src/utils/bookingAvailability";
import { fmtTimezoneLabel } from "@/src/utils/TimeUtils";
import { CustomSelect } from "@/src/components/CustomSelect";
import { Switch } from "@/src/components/Form/Switch";
import { SuccessBanner } from "@/src/components/Info/SuccessBanner";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { ERR_LOAD, ERR_SAVE, LBL_LOADING, LBL_SAVE, LBL_SAVING } from "@/src/constants/ui";

const DEFAULT_WINDOW = { startMinute: 9 * 60, endMinute: 12 * 60 };
const WORKWEEK = [ 1, 2, 3, 4, 5 ];
const LINK_SECTION_ID = "online-booking-link";
const AVAILABILITY_SECTION_ID = "online-booking-availability";

const READINESS_ITEMS: Array<{ key: keyof BookingSettings[ "readiness" ]; label: string; fixLabel: string; href: string }> = [
    { key: "hasSlug", label: "Enlace de reserva definido", fixLabel: "Definir enlace", href: `#${LINK_SECTION_ID}` },
    { key: "hasAvailability", label: "Al menos una franja de disponibilidad semanal", fixLabel: "Agregar disponibilidad", href: `#${AVAILABILITY_SECTION_ID}` },
    { key: "hasBookableType", label: "Un tipo de cita disponible en línea", fixLabel: "Ir a Tipos de Cita", href: "/settings?tab=Tipos+de+Cita" },
    { key: "hasBookableLocation", label: "Una ubicación presencial disponible en línea", fixLabel: "Ir a Ubicaciones", href: "/settings?tab=Ubicaciones" },
];

function ErrorLine({ message }: { message: string }) {
    return (
        <div className="error-inline" role="alert" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} /> {message}
        </div>
    );
}

function FieldError({ id, message }: { id?: string; message: string }) {
    return (
        <span id={id} role="alert" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--c-error)" }}>
            <STATUS_ICONS.warning size={12} aria-hidden="true" /> {message}
        </span>
    );
}

function WarningHint({ testId, children }: { testId: string; children: ReactNode }) {
    return (
        <div className="form-input-hint" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--c-warning-dark)" }} data-testid={testId}>
            <STATUS_ICONS.warning size={14} />
            {children}
        </div>
    );
}

export function OnlineBookingTab() {
    const { settings, loading, error, fetchSettings } = useFetchBookingSettings();
    const { updateSettings } = useUpdateBookingSettings();

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
                onSaved={async () => {
                    const fresh = await fetchSettings();
                    if (fresh) setCurrent(fresh);
                    else setStatusError(ERR_LOAD);
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
    const canToggle = settings.bookingEnabled || ready;

    async function handleToggle(enabled: boolean) {
        setToggling(true);
        try {
            await onToggle(enabled);
        } finally {
            setToggling(false);
        }
    }

    const status = settings.bookingEnabled && settings.live
        ? { text: "Tu enlace está recibiendo reservas.", bg: "var(--c-success-bg)", border: "var(--c-success-light)", Icon: STATUS_ICONS.success, iconColor: "var(--c-success)" }
        : settings.bookingEnabled
            ? { text: "Está activada, pero tu enlace no recibe reservas: completa los puntos pendientes.", bg: "var(--c-warning-light)", border: "var(--c-warning-light)", Icon: STATUS_ICONS.warning, iconColor: "var(--c-warning-dark)" }
            : { text: "La reserva en línea está desactivada.", bg: "var(--c-page-bg)", border: "var(--c-gray-100)", Icon: STATUS_ICONS.pending, iconColor: "var(--c-gray-500)" };

    return (
        <div className="dash-card">
            <div className="dash-card__header">
                <span className="dash-card__title">Reserva en línea</span>
            </div>
            <div className="dash-card__body form-stack">
                <div
                    style={{
                        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
                        background: status.bg, border: `1px solid ${status.border}`, borderRadius: "var(--r-lg)", padding: "14px 16px",
                    }}
                    data-testid={settings.bookingEnabled && !settings.live ? "online-booking-not-live" : "online-booking-status"}
                    aria-live="polite"
                >
                    <status.Icon size={18} aria-hidden="true" style={{ color: status.iconColor, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 200, fontSize: 15, fontWeight: 600, color: "var(--c-gray-900)" }}>{status.text}</span>
                    <Switch
                        checked={settings.bookingEnabled}
                        disabled={!canToggle || toggling}
                        onChange={handleToggle}
                        label="Reserva en línea"
                        testId="online-booking-enabled-toggle"
                    />
                </div>
                {!settings.bookingEnabled && (
                    <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>
                        Permite que tus pacientes reserven citas desde tu enlace público, según tu disponibilidad semanal.
                    </span>
                )}
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
                                        {!ok && (
                                            <Link href={item.href} style={{ color: "var(--c-brand)", textDecoration: "underline" }}>{item.fixLabel}</Link>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
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
    // shortcut: the domain is only known once the server returns a bookingUrl; before that the prefix is the bare path.
    const prefix = settings.bookingUrl && settings.bookingSlug
        ? settings.bookingUrl.slice(0, -settings.bookingSlug.length)
        : "/book/";

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
        setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    return (
        <div className="dash-card" id={LINK_SECTION_ID}>
            <div className="dash-card__header">
                <span className="dash-card__title">Enlace de reserva</span>
            </div>
            <div className="dash-card__body form-stack">
                {settings.bookingUrl && (
                    <div style={{ borderBottom: "1px solid var(--c-gray-100)", paddingBottom: 16, display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
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
                            </div>
                            {!settings.bookingEnabled && (
                                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>El enlace no recibirá reservas hasta que actives la reserva en línea.</span>
                            )}
                        </div>
                    </div>
                )}

                <label className="form-label">
                    {settings.bookingSlug ? "Cambiar enlace" : "Elige tu enlace"}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ whiteSpace: "nowrap", fontSize: 13, color: "var(--c-gray-500)" }}>{prefix}</span>
                        <input
                            className="form-input"
                            style={{ flex: 1, minWidth: 160 }}
                            value={slug}
                            onChange={(e) => { setSaved(false); setSlug(e.target.value); }}
                            placeholder="dra-maria-perez"
                            maxLength={40}
                            aria-invalid={touched && !!validation}
                            data-testid="online-booking-slug-input"
                        />
                    </div>
                    {touched && validation
                        ? <FieldError message={validation} />
                        : <span className="form-input-hint">Letras minúsculas, números y guiones. Entre 3 y 40 caracteres.</span>}
                </label>
                {isRename && (
                    <WarningHint testId="online-booking-slug-warning">
                        Si cambias el enlace, los enlaces y códigos QR que ya compartiste dejarán de funcionar.
                    </WarningHint>
                )}
                {isClear && (
                    <WarningHint testId="online-booking-slug-clear-warning">
                        Si quitas el enlace, la reserva en línea se desactivará y los enlaces y códigos QR que ya compartiste dejarán de funcionar.
                    </WarningHint>
                )}
                {error && <ErrorLine message={error} />}
                {saved && <SuccessBanner message="Enlace actualizado." />}
                <div>
                    <button
                        type="button"
                        className={settings.bookingUrl ? "btn-secondary" : "btn-primary"}
                        onClick={handleSave}
                        disabled={saving || !changed || !!validation}
                        data-testid="online-booking-slug-save"
                    >
                        {saving ? LBL_SAVING : "Guardar enlace"}
                    </button>
                </div>
            </div>
        </div>
    );
}

// A wall-clock time of day ("HH:mm") with no date or zone; the fixed UTC day keeps device DST out of it.
const timeOfDay = (value: string) => dayjs.utc(`2000-01-01T${value}:00`);

function TimeField({ value, onChange, label, invalid, testId }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    invalid: boolean;
    testId: string;
}) {
    const { isDark } = useTheme();
    return (
        <ConfigProvider locale={esEs} theme={getAntThemeConfig(isDark)}>
            <ZonedDatePicker.TimePicker
                value={timeOfDay(value)}
                onChange={(d) => d && onChange(d.format("HH:mm"))}
                format="HH:mm"
                minuteStep={5}
                allowClear={false}
                needConfirm={false}
                showNow={false}
                status={invalid ? "error" : undefined}
                aria-label={label}
                aria-invalid={invalid}
                style={{ width: 110 }}
                data-testid={testId}
            />
        </ConfigProvider>
    );
}

function AvailabilitySection({ timezone, onSaved }: { timezone: string; onSaved: () => void }) {
    const { availability, loading, error: loadError } = useFetchAvailability();
    const { saveAvailability } = useSaveAvailability();
    const [ draft, setDraft ] = useState<AvailabilityRule[] | null>(null);
    const [ savedRules, setSavedRules ] = useState<AvailabilityRule[] | null>(null);
    const dirty = draft !== null;
    const rules = draft ?? savedRules ?? availability?.rules ?? null;
    const [ error, setError ] = useState<string | null>(null);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);

    const validation = rules ? availabilityError(rules) : null;
    const dayErrors = new Map(WEEKDAYS_ES.map(({ weekday }) => [ weekday, rules ? availabilityError(rules.filter((r) => r.weekday === weekday)) : null ]));
    const anyDayError = [ ...dayErrors.values() ].some(Boolean);

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
        const startMinute = !last ? DEFAULT_WINDOW.startMinute
            : last.endMinute + 60 < MINUTES_PER_DAY ? last.endMinute + 60
            : last.endMinute;
        const endMinute = last ? Math.min(startMinute + 180, MINUTES_PER_DAY) : DEFAULT_WINDOW.endMinute;
        update([ ...current, { weekday, startMinute, endMinute } ]);
    }

    function copyToWorkweek(weekday: number) {
        if (!rules) return;
        const source = rules.filter((r) => r.weekday === weekday);
        const targets = WORKWEEK.filter((d) => d !== weekday);
        update([
            ...rules.filter((r) => !targets.includes(r.weekday)),
            ...targets.flatMap((d) => source.map((r) => ({ ...r, weekday: d }))),
        ]);
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
        <div className="dash-card" id={AVAILABILITY_SECTION_ID}>
            <div className="dash-card__header">
                <span className="dash-card__title">Disponibilidad semanal</span>
            </div>
            <div className="dash-card__body form-stack" data-testid="online-booking-availability">
                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>
                    Horarios en los que los pacientes pueden reservar, en tu zona horaria ({fmtTimezoneLabel(timezone)}).
                    Las citas y bloqueos de tu agenda se descuentan automáticamente.
                </span>
                {loadError && <ErrorLine message={loadError} />}
                {!rules && loading && <p className="form-input-hint">{LBL_LOADING}</p>}
                {rules && WEEKDAYS_ES.map(({ weekday, label }) => {
                    const dayRules = rules.filter((r) => r.weekday === weekday);
                    const dayFull = dayRules.some((r) => r.endMinute >= MINUTES_PER_DAY);
                    const dayError = dirty ? dayErrors.get(weekday) : null;
                    return (
                        <div
                            key={weekday}
                            style={{ display: "grid", gridTemplateColumns: "minmax(80px, 110px) 1fr", gap: 12, alignItems: "start", borderTop: "1px solid var(--c-gray-100)", paddingTop: 10 }}
                            data-testid={`availability-day-${weekday}`}
                        >
                            <span style={{ fontWeight: 600, fontSize: 13, paddingTop: 8 }}>{label}</span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {dayRules.map((r, i) => (
                                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                        <TimeField
                                            value={minutesToTime(r.startMinute)}
                                            onChange={(v) => setTime(r, "startMinute", v)}
                                            label={`${label}: hora de inicio`}
                                            invalid={!!dayError}
                                            testId={`availability-start-${weekday}-${i}`}
                                        />
                                        <span aria-hidden="true">–</span>
                                        <TimeField
                                            value={r.endMinute === MINUTES_PER_DAY ? "00:00" : minutesToTime(r.endMinute)}
                                            onChange={(v) => setTime(r, "endMinute", v)}
                                            label={`${label}: hora de fin`}
                                            invalid={!!dayError}
                                            testId={`availability-end-${weekday}-${i}`}
                                        />
                                        {r.endMinute === MINUTES_PER_DAY && (
                                            <span style={{ fontSize: 12, color: "var(--c-gray-500)" }}>fin del día</span>
                                        )}
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
                                {dayError && <FieldError message={dayError} />}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    {dayRules.length === 0 && (
                                        <span style={{ fontSize: 13, color: "var(--c-gray-500)", marginRight: 4 }}>No disponible</span>
                                    )}
                                    <button
                                        type="button"
                                        className="btn-action-edit"
                                        onClick={() => addWindow(weekday)}
                                        disabled={dayFull}
                                        aria-label={`${label}: agregar franja`}
                                        data-testid={`availability-add-${weekday}`}
                                    >
                                        <ACTION_ICONS.plus size={14} /> Agregar franja
                                    </button>
                                    {dayRules.length > 0 && (
                                        <button
                                            type="button"
                                            className="btn-action-edit"
                                            onClick={() => copyToWorkweek(weekday)}
                                            aria-label={`Copiar el horario del ${label.toLowerCase()} a lunes–viernes`}
                                            data-testid={`availability-copy-${weekday}`}
                                        >
                                            <ACTION_ICONS.copy size={14} /> Copiar a lunes–viernes
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {validation && dirty && !anyDayError && <ErrorLine message={validation} />}
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

const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s));

function RulesSection({ settings, save, onSaved }: {
    settings: BookingSettings;
    save: (body: BookingSettingsUpdate) => Promise<BookingSettings>;
    onSaved: (s: BookingSettings) => void;
}) {
    const [ interval, setSlotInterval ] = useState(settings.slotIntervalMinutes);
    const [ bufferText, setBuffer ] = useState(String(settings.bufferMinutes));
    const [ leadText, setLeadHours ] = useState(String(settings.minLeadMinutes / 60));
    const [ horizonText, setHorizon ] = useState(String(settings.maxHorizonDays));
    const [ error, setError ] = useState<string | null>(null);
    const [ saving, setSaving ] = useState(false);
    const [ saved, setSaved ] = useState(false);
    const ids = useId();

    const buffer = toNumber(bufferText);
    const leadMinutes = Math.round(toNumber(leadText) * 60);
    const horizon = toNumber(horizonText);
    const bufferError = Number.isInteger(buffer) && buffer >= 0 && buffer <= 240 ? null : "Escribe un número entero entre 0 y 240.";
    const leadError = Number.isFinite(leadMinutes) && leadMinutes >= 0 && leadMinutes <= 14 * 24 * 60 ? null : "Escribe un número entre 0 y 336 horas (14 días).";
    const horizonError = !(Number.isInteger(horizon) && horizon >= 1 && horizon <= 365) ? "Escribe un número entero entre 1 y 365."
        : !leadError && leadMinutes >= horizon * 24 * 60 ? "Debe ser mayor que la anticipación mínima, o no habrá horarios disponibles."
        : null;
    const invalid = !!(bufferError || leadError || horizonError);
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

    function numberField(props: {
        label: string; hint: string; value: string; onChange: (v: string) => void; err: string | null;
        min: number; max: number; step?: number; testId: string; key: string;
    }) {
        const errId = `${ids}-${props.key}-error`;
        return (
            <label className="form-label">
                {props.label}
                <input
                    className="form-input"
                    type="number"
                    inputMode="decimal"
                    min={props.min}
                    max={props.max}
                    step={props.step}
                    value={props.value}
                    onChange={(e) => { setSaved(false); props.onChange(e.target.value); }}
                    aria-invalid={!!props.err}
                    aria-describedby={props.err ? errId : undefined}
                    data-testid={props.testId}
                />
                {props.err ? <FieldError id={errId} message={props.err} /> : <span className="form-input-hint">{props.hint}</span>}
            </label>
        );
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
                            onChange={(v) => { setSaved(false); setSlotInterval(Number(v)); }}
                            options={SLOT_INTERVAL_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
                        />
                        <span className="form-input-hint">Cada cuánto se ofrece un horario de inicio. La duración la define el tipo de cita.</span>
                    </label>
                    {numberField({
                        key: "buffer", label: "Tiempo entre citas (min)", hint: "Margen libre antes y después de cada cita reservada en línea.",
                        value: bufferText, onChange: setBuffer, err: bufferError, min: 0, max: 240, testId: "online-booking-buffer",
                    })}
                    {numberField({
                        key: "lead", label: "Anticipación mínima (horas)", hint: "Con cuánto tiempo de antelación se puede reservar.",
                        value: leadText, onChange: setLeadHours, err: leadError, min: 0, max: 336, step: 0.5, testId: "online-booking-lead",
                    })}
                    {numberField({
                        key: "horizon", label: "Reservar hasta (días)", hint: "Cuántos días hacia adelante se puede reservar, contando hoy.",
                        value: horizonText, onChange: setHorizon, err: horizonError, min: 1, max: 365, testId: "online-booking-horizon",
                    })}
                </div>
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
