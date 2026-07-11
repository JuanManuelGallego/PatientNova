"use client";

import {
  AppointmentForm,
  AppointmentDuration,
  AppointmentLocation,
} from "@/src/types/Appointment";
import { ReminderType, Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { Patient } from "@/src/types/Patient";
import { CHANNEL_ICONS, STATUS_ICONS } from "@/src/config/icons";
import { isReminderTypeFeasible } from "@/src/utils/TimeUtils";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { LBL_NO_REMINDER } from "@/src/constants/ui";
import React from "react";
import { SetField } from "./types";

interface Props {
  form: AppointmentForm;
  set: SetField;
  setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>;
  selectedPatient: Patient | undefined;
  reminderChannel: Channel | undefined;
  locations: AppointmentLocation[];
}

export function LocationAndTimeStep({
  form,
  set,
  setForm,
  selectedPatient,
  reminderChannel,
  locations,
}: Props) {
  const setField = (field: keyof AppointmentForm) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const patientContact = selectedPatient
    ? reminderChannel === Channel.WHATSAPP
      ? selectedPatient.whatsappNumber
      : reminderChannel === Channel.SMS
        ? selectedPatient.smsNumber
        : selectedPatient.email
    : undefined;

  const hasAnyContact =
    !!selectedPatient?.whatsappNumber ||
    !!selectedPatient?.email ||
    !!selectedPatient?.smsNumber;

  return (
    <div className="form-stack">
      <label className="form-label">
        <RequiredField label="Duración" />
        <CustomSelect
          value={form.duration}
          options={Object.values(AppointmentDuration).map((d) => ({
            value: d,
            label: d,
          }))}
          onChange={setField("duration")}
        />
      </label>

      <label className="form-label">
        <RequiredField label="Ubicación" />
        {locations.length > 0 ? (
          <CustomSelect
            value={form.locationId}
            placeholder="Seleccionar ubicación…"
            options={locations.map((d) => ({ value: d.id, label: d.name }))}
            onChange={setField("locationId")}
          />
        ) : (
          <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} /> No hay ubicaciones disponibles.
          </div>
        )}
      </label>

      {locations.find((l) => l.id === form.locationId)?.isVirtual && (
        <label className="form-label">
          URL de videollamada
          <input
            type="url"
            className="form-input"
            value={form.meetingUrl}
            onChange={set("meetingUrl")}
            placeholder="Al dejar este campo vacío, se creará un enlace automáticamente."
          />
        </label>
      )}

      {hasAnyContact ? (
        <div>
          <label className="form-label">
            Recordatorio
            <CustomSelect
              value={form.reminderType}
              options={[
                { value: ReminderType.NONE, label: LBL_NO_REMINDER },
                {
                  value: ReminderType.ONE_HOUR_BEFORE,
                  label: "1 hora antes",
                  disabled: !isReminderTypeFeasible(
                    form.startAt,
                    ReminderType.ONE_HOUR_BEFORE,
                  ),
                },
                {
                  value: ReminderType.ONE_DAY_BEFORE,
                  label: "1 día antes",
                  disabled: !isReminderTypeFeasible(
                    form.startAt,
                    ReminderType.ONE_DAY_BEFORE,
                  ),
                },
                {
                  value: ReminderType.ONE_WEEK_BEFORE,
                  label: "1 semana antes",
                  disabled: !isReminderTypeFeasible(
                    form.startAt,
                    ReminderType.ONE_WEEK_BEFORE,
                  ),
                },
              ]}
              onChange={setField("reminderType")}
            />
          </label>

          {form.reminderType !== ReminderType.NONE && (
            <div style={{ marginTop: 10 }}>
              <div className="channel-section-label">Canal de notificación</div>
              {reminderChannel ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "var(--c-brand-50, #f0f7ff)",
                    border: "1px solid var(--c-brand-200, #bfdbfe)",
                    fontSize: 14,
                    color: "var(--c-brand)",
                  }}
                >
                  {(() => {
                    const Icon = CHANNEL_ICONS[reminderChannel];
                    return Icon ? <Icon size={18} /> : null;
                  })()}
                  <span>
                    Enviando por{" "}
                    <strong>{CHANNEL_CFG[reminderChannel].label}</strong>
                    {patientContact && (
                      <span
                        style={{
                          marginLeft: 6,
                          color: "var(--c-gray-400)",
                          fontWeight: 400,
                        }}
                      >
                        → {patientContact}
                      </span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <STATUS_ICONS.warning size={14} /> No tienes un canal de
                  recordatorio configurado. Ve a{" "}
                  <strong>Configuración → Recordatorios</strong> para definirlo.
                </div>
              )}
              {reminderChannel && !patientContact && (
                <div className="error-inline" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                  <STATUS_ICONS.warning size={14} /> El paciente no tiene{" "}
                  {reminderChannel === Channel.WHATSAPP
                    ? "número de WhatsApp"
                    : reminderChannel === Channel.SMS
                      ? "número de SMS"
                      : "correo electrónico"}{" "}
                  registrado. El recordatorio no podrá enviarse.
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div>
          <label className="form-label">Recordatorio</label>
          <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} /> El paciente no tiene forma de
            contacto registrada, por lo que no se podrán enviar recordatorios
            automáticos.
          </div>
        </div>
      )}
    </div>
  );
}
