"use client";

import { memo } from "react";
import { ReminderMode, Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { DateTimePicker } from "@/src/components/DateTimePicker";
import { StepChannelProps } from "./types";
import { CHANNEL_ICONS, STATUS_ICONS } from "@/src/config/icons";

export const StepChannel = memo(function StepChannel({
  channel,
  sendMode,
  setMode,
  sentAt,
  setSentAt,
  onNext,
}: StepChannelProps) {
  return (
    <div
      className="table-card"
      style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div>
        <div className="wizard-section-title">Canal de notificación</div>
        {channel ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderRadius: 8,
              background: "var(--c-brand-50, #f0f7ff)",
              border: "1px solid var(--c-brand-200, #bfdbfe)",
              fontSize: 14,
              color: "var(--c-brand)",
            }}
          >
            {(() => {
              const Icon = CHANNEL_ICONS[channel];
              return Icon ? <Icon size={20} /> : null;
            })()}
            <span>
              Los mensajes se enviarán por{" "}
              <strong>{CHANNEL_CFG[channel].label}</strong>. Para cambiarlo, ve
              a <strong>Configuración → Recordatorios</strong>.
            </span>
          </div>
        ) : (
          <div className="error-inline">
            <STATUS_ICONS.warning size={14} /> No tienes un canal de
            recordatorio configurado. Ve a{" "}
            <strong>Configuración → Recordatorios</strong> para definirlo antes
            de enviar recordatorios masivos.
          </div>
        )}
      </div>
      <div>
        <div className="wizard-section-title">Tipo de envío</div>
        <div className="form-grid-2">
          {(
            [
              {
                k: ReminderMode.IMMEDIATE,
                title: "Enviar ahora",
                sub: "Envío inmediato a todos",
              },
              {
                k: ReminderMode.SCHEDULED,
                title: "Programar envío",
                sub: "Elegir fecha y hora",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.k}
              onClick={() => setMode(opt.k)}
              className={`selection-card selection-card--column${sendMode === opt.k ? " selection-card--active" : ""}`}
              style={{ padding: "14px 18px" }}
            >
              <span className="patient-preview__name">{opt.title}</span>
              <span className="patient-preview__detail">{opt.sub}</span>
            </button>
          ))}
        </div>
      </div>
      {sendMode === ReminderMode.SCHEDULED && (
        <label className="form-label">
          Fecha y hora de envío
          <DateTimePicker
            date={sentAt}
            onChanged={setSentAt}
            showTime
            isFuture
          />
        </label>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onNext}
          disabled={
            !channel || (sendMode === ReminderMode.SCHEDULED && !sentAt)
          }
          className="btn-primary"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
});
