"use client";

import { FormEvent, ReactNode, useEffect, useId, useRef, useState } from "react";
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
import { useFetchAppointmentTypes } from "@/src/api/appointment-types/useFetchAppointmentTypes";
import {
    AvailabilityRule,
    BookingApprovalMode,
    BookingSettings,
    BookingSettingsUpdate,
    MAX_BIO_LENGTH,
    MAX_PATIENT_RESCHEDULES,
    MAX_RESCHEDULE_NOTICE_HOURS,
    MAX_CONTACT_HOURS_LENGTH,
    MAX_LEGAL_TEXT_LENGTH,
    MAX_SPECIALTY_LENGTH,
    PORTAL_REMINDER_TIMINGS,
    PortalReminderTiming,
    SLOT_INTERVAL_OPTIONS,
} from "@/src/types/Booking";
import { REMINDER_TYPE_CONFIG } from "@/src/types/Reminder";
import {
    MINUTES_PER_DAY,
    WEEKDAYS_ES,
    availabilityError,
    intervalGapWarning,
    minutesToTime,
    slugError,
    sortRules,
    timeToMinutes,
} from "@/src/utils/bookingAvailability";
import { isE164, normalizePhone } from "@/src/utils/publicBooking";
import { fmtTimezoneLabel } from "@/src/utils/TimeUtils";
import { CountryCodeInput } from "@/src/components/CountryCodeInput";
import { CustomSelect } from "@/src/components/CustomSelect";
import { Switch } from "@/src/components/Form/Switch";
import { SaveStatusIndicator, type SaveStatus } from "@/src/components/Info/SaveStatusIndicator";
import { ACTION_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { ERR_LOAD, ERR_SAVE, LBL_LOADING, LBL_SAVING } from "@/src/constants/ui";
import { useDebouncedSave } from "@/src/hooks/useDebouncedSave";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";

const DEFAULT_WINDOW = { startMinute: 9 * 60, endMinute: 12 * 60 };
const WORKWEEK = [ 1, 2, 3, 4, 5 ];
const LINK_SECTION_ID = "online-booking-link";
const PROFILE_SECTION_ID = "online-booking-profile";
const AVAILABILITY_SECTION_ID = "online-booking-availability";

const READINESS_ITEMS: Array<{ key: keyof BookingSettings[ "readiness" ]; label: string; fixLabel: string; href: string }> = [
    { key: "hasSlug", label: "Enlace de reserva definido", fixLabel: "Definir enlace", href: `#${LINK_SECTION_ID}` },
    { key: "hasLegalIdentity", label: "Responsable de los datos y contacto directo", fixLabel: "Completar perfil", href: `#${PROFILE_SECTION_ID}` },
    { key: "hasAvailability", label: "Al menos una franja de disponibilidad semanal", fixLabel: "Agregar disponibilidad", href: `#${AVAILABILITY_SECTION_ID}` },
    { key: "hasBookableType", label: "Un tipo de cita disponible en línea", fixLabel: "Ir a Tipos de Cita", href: "/settings?tab=Tipos+de+Cita" },
    { key: "hasBookableLocation", label: "Una ubicación disponible en línea", fixLabel: "Ir a Ubicaciones", href: "/settings?tab=Ubicaciones" },
];

type SaveFn = (body: BookingSettingsUpdate) => Promise<BookingSettings>;

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

function CardHeader({ title, children }: { title: string; children?: ReactNode }) {
    return (
        <div className="dash-card__header" style={{ gap: 12 }}>
            <span className="dash-card__title">{title}</span>
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
            <span className="form-input-hint" style={{ marginTop: -8 }} data-testid="online-booking-autosave-hint">
                Los cambios de esta página se guardan automáticamente.
            </span>
            <ApprovalSection settings={current} save={updateSettings} onSaved={setCurrent} />
            <LinkSection settings={current} save={updateSettings} onSaved={setCurrent} />
            <PublicProfileSection settings={current} save={updateSettings} onSaved={setCurrent} />
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
            <CardHeader title="Reserva en línea" />
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

const APPROVAL_OPTIONS: { value: BookingApprovalMode; label: string; hint: string }[] = [
    {
        value: "AUTO_CONFIRM",
        label: "Confirmar automáticamente",
        hint: "La cita queda confirmada en cuanto el paciente reserva.",
    },
    {
        value: "REQUIRE_APPROVAL",
        label: "Revisar cada solicitud",
        hint: "El paciente envía una solicitud que reserva el horario hasta 48 horas. Tú la apruebas o la rechazas en Solicitudes.",
    },
];

function ApprovalSection({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
    const [ mode, setMode ] = useState<BookingApprovalMode>(settings.bookingApprovalMode);
    const autosave = useDebouncedSave<BookingApprovalMode>(
        async (bookingApprovalMode) => onSaved(await save({ bookingApprovalMode })),
        { initial: settings.bookingApprovalMode },
    );
    const name = useId();

    function handleChange(next: BookingApprovalMode) {
        setMode(next);
        autosave.schedule(next);
    }

    return (
        <div className="dash-card" data-testid="online-booking-approval">
            <CardHeader title="Confirmación de reservas">
                <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="online-booking-approval-save-state" />
            </CardHeader>
            <div className="dash-card__body form-stack">
                <fieldset className="form-stack form-fieldset-plain">
                    <legend className="sr-only">Cómo se confirman las reservas en línea</legend>
                    {APPROVAL_OPTIONS.map((opt) => (
                        <label key={opt.value} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
                            <input
                                type="radio"
                                name={name}
                                value={opt.value}
                                checked={mode === opt.value}
                                onChange={() => handleChange(opt.value)}
                                style={{ marginTop: 3 }}
                                data-testid={`online-booking-approval-${opt.value.toLowerCase().replace("_", "-")}`}
                            />
                            <span>
                                <span style={{ fontWeight: 600, color: "var(--c-gray-900)" }}>{opt.label}</span>
                                <span className="form-input-hint" style={{ display: "block" }}>{opt.hint}</span>
                            </span>
                        </label>
                    ))}
                </fieldset>
                {settings.bookingApprovalMode === "REQUIRE_APPROVAL" && (
                    <span className="form-input-hint">
                        Si vuelves a la confirmación automática, las solicitudes pendientes siguen esperando tu respuesta.
                    </span>
                )}
                {autosave.error && <ErrorLine message={autosave.error} />}
            </div>
        </div>
    );
}

function LinkSection({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
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
        <div className="dash-card" id={LINK_SECTION_ID}>
            <CardHeader title="Enlace de reserva">
                <SaveStatusIndicator saving={false} status={status} testId="online-booking-slug-save-state" />
            </CardHeader>
            <div className="dash-card__body form-stack">
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
                {error && <ErrorLine message={error} />}
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
        </div>
    );
}

function SlugModal({ settings, suggestion, save, onSaved, onClose }: {
    settings: BookingSettings;
    suggestion: string | null;
    save: SaveFn;
    onSaved: (s: BookingSettings) => void;
    onClose: () => void;
}) {
    const [ typed, setSlug ] = useState<string | null>(null);
    const touched = typed !== null;
    const slug = typed ?? settings.bookingSlug ?? suggestion ?? "";
    const [ error, setError ] = useState<string | null>(null);
    const [ saving, setSaving ] = useState(false);
    const close = () => { if (!saving) onClose(); };
    const { ref, handleKeyDown } = useFocusTrap<HTMLDivElement>(close);
    const inputRef = useRef<HTMLInputElement>(null);
    const titleId = useId();
    const hintId = useId();

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const creating = !settings.bookingSlug;
    const normalized = slug.trim().toLowerCase();
    const validation = normalized ? slugError(normalized) : creating ? "Escribe un enlace." : null;
    const changed = normalized !== (settings.bookingSlug ?? "");
    const isRename = !creating && changed && !!normalized;
    const isClear = !creating && !normalized;
    // shortcut: the domain is only known once the server returns a bookingUrl; before that the prefix is the bare path.
    const prefix = settings.bookingUrl && settings.bookingSlug
        ? settings.bookingUrl.slice(0, -settings.bookingSlug.length)
        : "/book/";

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (saving || !changed || validation) return;
        setError(null);
        setSaving(true);
        try {
            onSaved(await save({ bookingSlug: normalized || null }));
        } catch (err) {
            setError(err instanceof Error ? err.message : ERR_SAVE);
            setSaving(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={close} onKeyDown={handleKeyDown}>
            <div
                ref={ref}
                className="modal-panel modal-panel--sm"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                onClick={(e) => e.stopPropagation()}
                data-testid="online-booking-slug-modal"
            >
                <div className="modal-header">
                    <h2 id={titleId} className="modal-title modal-title--sm">
                        {creating ? "Crear enlace de reserva" : "Cambiar enlace de reserva"}
                    </h2>
                    <button type="button" onClick={close} className="btn-close" aria-label="Cerrar" disabled={saving}>
                        <ACTION_ICONS.close size={16} />
                    </button>
                </div>
                <form className="form-stack" onSubmit={handleSubmit} noValidate>
                    <label className="form-label">
                        Enlace
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, color: "var(--c-gray-500)", wordBreak: "break-all" }}>{prefix}</span>
                            <input
                                ref={inputRef}
                                className="form-input"
                                style={{ flex: 1, minWidth: 160 }}
                                value={slug}
                                onChange={(e) => { setError(null); setSlug(e.target.value); }}
                                placeholder="dra-maria-perez"
                                maxLength={40}
                                autoComplete="off"
                                spellCheck={false}
                                aria-invalid={touched && !!validation}
                                aria-describedby={hintId}
                                data-testid="online-booking-slug-input"
                            />
                        </div>
                        {touched && validation
                            ? <FieldError id={hintId} message={validation} />
                            : <span id={hintId} className="form-input-hint">Letras minúsculas, números y guiones. Entre 3 y 40 caracteres.</span>}
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
                    <div className="modal-footer modal-footer--stretch">
                        <button type="button" className="btn-secondary btn-block" onClick={close} disabled={saving} data-testid="online-booking-slug-cancel">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className={`${isClear ? "btn-danger" : "btn-primary"} btn-block`}
                            disabled={saving || !changed || !!validation}
                            data-testid="online-booking-slug-save"
                        >
                            {saving ? LBL_SAVING : creating ? "Crear enlace" : isClear ? "Quitar enlace" : "Guardar enlace"}
                        </button>
                    </div>
                </form>
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

function AvailabilitySection({ timezone, onSaved }: { timezone: string; onSaved: () => Promise<void> }) {
    const { availability, loading, error: loadError } = useFetchAvailability();
    const { saveAvailability } = useSaveAvailability();
    const [ draft, setDraft ] = useState<AvailabilityRule[] | null>(null);
    const dirty = draft !== null;
    const rules = draft ?? availability?.rules ?? null;
    const autosave = useDebouncedSave<AvailabilityRule[]>(async (next) => {
        await saveAvailability(next);
        await onSaved();
    });

    const validation = rules ? availabilityError(rules) : null;
    const dayErrors = new Map(WEEKDAYS_ES.map(({ weekday }) => [ weekday, rules ? availabilityError(rules.filter((r) => r.weekday === weekday)) : null ]));
    const anyDayError = [ ...dayErrors.values() ].some(Boolean);

    function update(next: AvailabilityRule[]) {
        setDraft(next);
        if (availabilityError(next)) autosave.cancel();
        else autosave.schedule(sortRules(next));
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

    return (
        <div className="dash-card" id={AVAILABILITY_SECTION_ID}>
            <CardHeader title="Disponibilidad semanal">
                <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="availability-save-state" />
            </CardHeader>
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
                {validation && dirty && (
                    <WarningHint testId="availability-unsaved">Corrige los horarios marcados para guardar los cambios.</WarningHint>
                )}
                {autosave.error && <ErrorLine message={autosave.error} />}
            </div>
        </div>
    );
}

type ProfileForm = {
    specialty: string;
    bio: string;
    publicPhone: string;
    publicWhatsapp: string;
    legalName: string;
    privacyContact: string;
    contactHours: string;
};

function profileFormOf(s: BookingSettings): ProfileForm {
    return {
        specialty: s.specialty ?? "",
        bio: s.bio ?? "",
        publicPhone: s.publicPhone ?? "",
        publicWhatsapp: s.publicWhatsapp ?? "",
        legalName: s.legalName ?? "",
        privacyContact: s.privacyContact ?? "",
        contactHours: s.contactHours ?? "",
    };
}

const PHONE_FORMAT_ERROR = "Revisa el número: parece incompleto o demasiado largo.";

function parseProfile(form: ProfileForm) {
    const publicPhone = normalizePhone(form.publicPhone);
    const publicWhatsapp = normalizePhone(form.publicWhatsapp);
    const errors = {
        publicPhone: publicPhone && !isE164(publicPhone) ? PHONE_FORMAT_ERROR : null,
        publicWhatsapp: publicWhatsapp && !isE164(publicWhatsapp) ? PHONE_FORMAT_ERROR : null,
    };
    const body = {
        specialty: form.specialty.trim() || null,
        bio: form.bio.trim() || null,
        publicPhone: publicPhone || null,
        publicWhatsapp: publicWhatsapp || null,
        legalName: form.legalName.trim() || null,
        privacyContact: form.privacyContact.trim() || null,
        contactHours: form.contactHours.trim() || null,
    } satisfies BookingSettingsUpdate;
    return { body, errors, invalid: Object.values(errors).some(Boolean) };
}

function PublicProfileSection({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
    const [ form, setForm ] = useState<ProfileForm>(() => profileFormOf(settings));
    const [ initial ] = useState(() => parseProfile(profileFormOf(settings)).body);
    const autosave = useDebouncedSave<BookingSettingsUpdate>(async (body) => onSaved(await save(body)), { initial });
    const { errors } = parseProfile(form);
    const ids = useId();

    function change(patch: Partial<ProfileForm>) {
        const next = { ...form, ...patch };
        setForm(next);
        const parsed = parseProfile(next);
        if (parsed.invalid) autosave.cancel();
        else autosave.schedule(parsed.body);
    }

    function phoneField(field: keyof typeof errors, label: string, hint: string, testId: string) {
        const err = errors[ field ];
        const errId = `${ids}-${field}-error`;
        return (
            <label className="form-label">
                {label}
                <CountryCodeInput
                    value={form[ field ] || undefined}
                    onChange={(v) => change({ [ field ]: v })}
                    aria-invalid={!!err}
                    aria-describedby={err ? errId : undefined}
                    data-testid={testId}
                />
                {err ? <FieldError id={errId} message={err} /> : <span className="form-input-hint">{hint}</span>}
            </label>
        );
    }

    return (
        <div className="dash-card" id={PROFILE_SECTION_ID}>
            <CardHeader title="Perfil público">
                <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="online-booking-profile-save-state" />
            </CardHeader>
            <div className="dash-card__body form-stack" data-testid="online-booking-profile">
                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>
                    Todo lo que escribas aquí es visible para cualquier persona con tu enlace de reserva.
                </span>
                <label className="form-label">
                    Especialidad
                    <input className="form-input" maxLength={MAX_SPECIALTY_LENGTH} placeholder="Psicología clínica"
                        value={form.specialty} onChange={(e) => change({ specialty: e.target.value })} data-testid="online-booking-specialty" />
                </label>
                <label className="form-label">
                    Presentación
                    <textarea className="form-input form-input--textarea" rows={4} maxLength={MAX_BIO_LENGTH}
                        placeholder="Cuéntales a tus pacientes a quién atiendes y cómo trabajas."
                        value={form.bio} onChange={(e) => change({ bio: e.target.value })} data-testid="online-booking-bio" />
                    <span className="form-input-hint">{form.bio.length} de {MAX_BIO_LENGTH} caracteres</span>
                </label>
                <div className="form-grid-2">
                    {phoneField("publicPhone", "Teléfono público", "Es independiente del teléfono de tu perfil.", "online-booking-public-phone")}
                    {phoneField("publicWhatsapp", "WhatsApp público", "Abre un chat contigo desde tu página de reservas.", "online-booking-public-whatsapp")}
                </div>
                <span className="form-input-hint" style={{ alignSelf: "flex-start" }}>
                    Obligatorio para abrir las reservas: el paciente ve quién responde por sus datos y cómo contactarte sin usar el portal. Agrega también un teléfono o WhatsApp público.
                </span>
                <label className="form-label">
                    Nombre legal del responsable
                    <input className="form-input" maxLength={MAX_LEGAL_TEXT_LENGTH} placeholder="Tu nombre completo o el de tu consultorio"
                        value={form.legalName} onChange={(e) => change({ legalName: e.target.value })} data-testid="online-booking-legal-name" />
                </label>
                <label className="form-label">
                    Contacto de privacidad
                    <input className="form-input" maxLength={MAX_LEGAL_TEXT_LENGTH} placeholder="Correo o teléfono para solicitudes sobre datos"
                        value={form.privacyContact} onChange={(e) => change({ privacyContact: e.target.value })} data-testid="online-booking-privacy-contact" />
                </label>
                <label className="form-label">
                    Horario de atención directa
                    <input className="form-input" maxLength={MAX_CONTACT_HOURS_LENGTH} placeholder="Lunes a viernes, 8:00 a 17:00"
                        value={form.contactHours} onChange={(e) => change({ contactHours: e.target.value })} data-testid="online-booking-contact-hours" />
                </label>
                {autosave.error && <ErrorLine message={autosave.error} />}
            </div>
        </div>
    );
}

const toNumber = (s: string) => (s.trim() === "" ? NaN : Number(s));

function reminderTimingHint(timing: PortalReminderTiming): string {
    if (timing === "NONE") return "Las citas reservadas en línea no reciben recordatorio automático.";
    const { type } = PORTAL_REMINDER_TIMINGS.find((t) => t.value === timing)!;
    const { label, clock } = REMINDER_TYPE_CONFIG[ type ];
    const when = clock
        ? `la ${label.toLowerCase()} (${clock.hour}:${String(clock.minute).padStart(2, "0")}, hora del paciente)`
        : `${label} de la cita`;
    return `Se envía ${when}, por el canal de cada paciente. Si la cita se reserva o se mueve después de ese momento, no se envía.`;
}

type RulesForm = {
    interval: number; buffer: string; lead: string; horizon: string; reschedules: string; notice: string;
    reminderTiming: PortalReminderTiming;
};

function rulesFormOf(s: BookingSettings): RulesForm {
    return {
        interval: s.slotIntervalMinutes,
        buffer: String(s.bufferMinutes),
        lead: String(s.minLeadMinutes / 60),
        horizon: String(s.maxHorizonDays),
        reschedules: String(s.maxPatientReschedules),
        notice: String(s.minRescheduleNoticeHours),
        reminderTiming: s.portalReminderTiming,
    };
}

function parseRules(form: RulesForm) {
    const buffer = toNumber(form.buffer);
    const leadMinutes = Math.round(toNumber(form.lead) * 60);
    const horizon = toNumber(form.horizon);
    const reschedules = toNumber(form.reschedules);
    const notice = toNumber(form.notice);
    const leadError = Number.isFinite(leadMinutes) && leadMinutes >= 0 && leadMinutes <= 14 * 24 * 60 ? null : "Escribe un número entre 0 y 336 horas (14 días).";
    const errors = {
        buffer: Number.isInteger(buffer) && buffer >= 0 && buffer <= 240 ? null : "Escribe un número entero entre 0 y 240.",
        lead: leadError,
        horizon: !(Number.isInteger(horizon) && horizon >= 1 && horizon <= 365) ? "Escribe un número entero entre 1 y 365."
            : !leadError && leadMinutes >= horizon * 24 * 60 ? "Debe ser mayor que la anticipación mínima, o no habrá horarios disponibles."
            : null,
        reschedules: Number.isInteger(reschedules) && reschedules >= 0 && reschedules <= MAX_PATIENT_RESCHEDULES
            ? null : `Escribe un número entero entre 0 y ${MAX_PATIENT_RESCHEDULES}.`,
        notice: Number.isInteger(notice) && notice >= 0 && notice <= MAX_RESCHEDULE_NOTICE_HOURS
            ? null : `Escribe un número entero entre 0 y ${MAX_RESCHEDULE_NOTICE_HOURS} horas (7 días).`,
    };
    const body = {
        slotIntervalMinutes: form.interval,
        bufferMinutes: buffer,
        minLeadMinutes: leadMinutes,
        maxHorizonDays: horizon,
        maxPatientReschedules: reschedules,
        minRescheduleNoticeHours: notice,
        portalReminderTiming: form.reminderTiming,
    } satisfies BookingSettingsUpdate;
    return { body, errors, invalid: Object.values(errors).some(Boolean) };
}

function RulesSection({ settings, save, onSaved }: { settings: BookingSettings; save: SaveFn; onSaved: (s: BookingSettings) => void }) {
    const [ form, setForm ] = useState<RulesForm>(() => rulesFormOf(settings));
    const [ initial ] = useState(() => parseRules(rulesFormOf(settings)).body);
    const autosave = useDebouncedSave<BookingSettingsUpdate>(async (body) => onSaved(await save(body)), { initial });
    const { errors, invalid } = parseRules(form);
    const ids = useId();
    const { appointmentTypes } = useFetchAppointmentTypes();
    const gapWarning = intervalGapWarning(
        form.interval,
        toNumber(form.buffer),
        appointmentTypes.filter((t) => t.bookableOnline).map((t) => t.defaultDuration),
    );

    function change(patch: Partial<RulesForm>) {
        const next = { ...form, ...patch };
        setForm(next);
        const parsed = parseRules(next);
        if (parsed.invalid) autosave.cancel();
        else autosave.schedule(parsed.body);
    }

    function numberField(props: {
        field: keyof typeof errors; label: string; hint: string;
        min: number; max: number; step?: number; testId: string;
    }) {
        const err = errors[ props.field ];
        const errId = `${ids}-${props.field}-error`;
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
                    value={form[ props.field ]}
                    onChange={(e) => change({ [ props.field ]: e.target.value } as Partial<RulesForm>)}
                    aria-invalid={!!err}
                    aria-describedby={err ? errId : undefined}
                    data-testid={props.testId}
                />
                {err ? <FieldError id={errId} message={err} /> : <span className="form-input-hint">{props.hint}</span>}
            </label>
        );
    }

    return (
        <div className="dash-card">
            <CardHeader title="Reglas de reserva">
                <SaveStatusIndicator saving={autosave.saving} status={autosave.status} error={autosave.error} testId="online-booking-rules-save-state" />
            </CardHeader>
            <div className="dash-card__body form-stack">
                <div className="form-grid-2">
                    <label className="form-label" data-testid="online-booking-interval">
                        Intervalo entre horarios (min)
                        <CustomSelect
                            value={String(form.interval)}
                            onChange={(v) => change({ interval: Number(v) })}
                            options={SLOT_INTERVAL_OPTIONS.map((n) => ({ value: String(n), label: `${n} min` }))}
                        />
                        <span className="form-input-hint">Cada cuánto se ofrece un horario de inicio. La duración la define el tipo de cita.</span>
                        {gapWarning && <WarningHint testId="online-booking-interval-warning">{gapWarning}</WarningHint>}
                    </label>
                    {numberField({
                        field: "buffer", label: "Tiempo entre citas (min)", hint: "Margen libre antes y después de cada cita reservada en línea.",
                        min: 0, max: 240, testId: "online-booking-buffer",
                    })}
                    {numberField({
                        field: "lead", label: "Anticipación mínima (horas)", hint: "Con cuánto tiempo de antelación se puede reservar.",
                        min: 0, max: 336, step: 0.5, testId: "online-booking-lead",
                    })}
                    {numberField({
                        field: "horizon", label: "Reservar hasta (días)", hint: "Cuántos días hacia adelante se puede reservar, contando hoy.",
                        min: 1, max: 365, testId: "online-booking-horizon",
                    })}
                </div>
                <fieldset className="form-stack form-fieldset-plain">
                    <legend className="form-label form-fieldset-legend">Reprogramación por pacientes</legend>
                    <div className="form-grid-2">
                        {numberField({
                            field: "reschedules", label: "Reprogramaciones por cita",
                            hint: "Cuántas veces un paciente puede mover en línea una cita que reservó. Con 0 no puede reprogramar; siempre puede cancelar.",
                            min: 0, max: MAX_PATIENT_RESCHEDULES, step: 1, testId: "online-booking-max-reschedules",
                        })}
                        {numberField({
                            field: "notice", label: "Aviso mínimo para reprogramar (horas)",
                            hint: "Después de este momento antes de la cita, el paciente ya no puede reprogramarla en línea.",
                            min: 0, max: MAX_RESCHEDULE_NOTICE_HOURS, step: 1, testId: "online-booking-reschedule-notice",
                        })}
                    </div>
                </fieldset>
                <fieldset className="form-stack form-fieldset-plain">
                    <legend className="form-label form-fieldset-legend">Recordatorio al paciente</legend>
                    <div className="form-grid-2">
                        <label className="form-label" data-testid="online-booking-reminder-timing">
                            Enviar recordatorio
                            <CustomSelect
                                value={form.reminderTiming}
                                onChange={(v) => change({ reminderTiming: v as PortalReminderTiming })}
                                options={PORTAL_REMINDER_TIMINGS.map(({ value, type }) => ({ value, label: REMINDER_TYPE_CONFIG[ type ].label }))}
                            />
                            <span className="form-input-hint">{reminderTimingHint(form.reminderTiming)}</span>
                        </label>
                    </div>
                </fieldset>
                {invalid && (
                    <WarningHint testId="online-booking-rules-unsaved">Corrige los campos marcados para guardar los cambios.</WarningHint>
                )}
                {autosave.error && <ErrorLine message={autosave.error} />}
            </div>
        </div>
    );
}
