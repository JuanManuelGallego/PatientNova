"use client";

import { memo } from "react";
import { ReminderMode } from "@/src/types/Reminder";
import { StepMessageProps } from "./types";

const QUICK_TEMPLATES = [
    "Le recordamos su próxima cita médica. Por favor confirme su asistencia respondiendo este mensaje.",
    "Su cita está confirmada para mañana. Recuerde traer su tarjeta de seguro y llegar 10 minutos antes.",
    "Importante: No olvide su cita de mañana. Si necesita cancelar, contáctenos con 24 horas de anticipación.",
];

export const StepMessage = memo(function StepMessage({ message, setMessage, recipientCount, sendMode, sending, onBack, onSend }: StepMessageProps) {
    return (
        <div className="table-card" style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="wizard-section-title">Redactar mensaje</div>
            <label className="form-label">
                Mensaje
                <textarea
                    className="form-input form-input--textarea"
                    style={{ minHeight: 120 }}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="Estimado/a paciente, le recordamos su cita médica próxima. Por favor confirme su asistencia respondiendo a este mensaje."
                />
                <div style={{ display: "flex", justifyContent: "space-between" }} className="form-input-hint">
                    <span>{message.length} / 1600 caracteres</span>
                    <span>{recipientCount} destinatarios</span>
                </div>
            </label>
            <div>
                <div className="channel-section-label">Plantillas rápidas</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {QUICK_TEMPLATES.map((tmpl) => (
                        <button key={tmpl} onClick={() => setMessage(tmpl)} className="template-btn">
                            {tmpl}
                        </button>
                    ))}
                </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={onBack} className="btn-secondary">Atrás</button>
                <button onClick={onSend} disabled={!message.trim() || sending} className="btn-primary btn-hero">
                    {sending ? (
                        <>
                            <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "var(--c-white)", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                            Enviando…
                        </>
                    ) : `${sendMode === ReminderMode.IMMEDIATE ? "⚡ Enviar" : "🗓️ Programar"} a ${recipientCount} pacientes`}
                </button>
            </div>
        </div>
    );
});
