"use client";

import {
    FormEvent,
    useEffect,
    useId,
    useRef,
    useState,
} from "react";
import { BookingSettings } from "@/src/types/Booking";
import { slugError } from "@/src/utils/bookingAvailability";
import { FieldError, InlineError } from "@/src/components/Info/InlineError";
import { ACTION_ICONS } from "@/src/config/icons";
import { ERR_SAVE, LBL_SAVING } from "@/src/constants/ui";
import { useFocusTrap } from "@/src/hooks/useFocusTrap";
import { WarningHint, type SaveFn } from "./shared";

export function SlugModal({ settings, suggestion, save, onSaved, onClose }: {
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
                    {error && <InlineError message={error} />}
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
