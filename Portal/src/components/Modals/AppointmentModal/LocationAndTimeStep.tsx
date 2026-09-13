"use client";

import {
  AppointmentForm,
  AppointmentDuration,
  AppointmentLocation,
} from "@/src/types/Appointment";
import { ReminderType, Channel, CHANNEL_CFG } from "@/src/types/Reminder";
import { Patient } from "@/src/types/Patient";
import { CHANNEL_ICONS, STATUS_ICONS, ACTION_ICONS } from "@/src/config/icons";
import { isReminderTypeFeasible } from "@/src/utils/TimeUtils";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { LBL_NO_REMINDER } from "@/src/constants/ui";
import React, { useState, useCallback } from "react";
import { SetField } from "./types";
import { useCreateGoogleMeet } from "@/src/api/google/useCreateGoogleMeet";
import { useStartGoogleOAuth } from "@/src/api/google/useStartGoogleOAuth";
import { useFetchGoogleConnection } from "@/src/api/google/useFetchGoogleConnection";
import { useGoogleOAuthPopup } from "@/src/hooks/useGoogleOAuthPopup";
import { ApiMutationError } from "@/src/api/base/useApiMutation";
import { useAuthContext } from "@/src/providers/AuthContext";
import { AdminRole } from "@/src/types/User";
import { validateHttpUrl } from "@/src/utils/DataValidator";

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

  const selectedLocation = locations.find((l) => l.id === form.locationId);
  const isVirtual = selectedLocation?.isVirtual ?? false;

  const { user } = useAuthContext();
  const canManageGoogle = user?.role === AdminRole.ADMIN || user?.role === AdminRole.SUPER_ADMIN;
  const { data: connection, loading: loadingConnection, error: connectionError } = useFetchGoogleConnection(canManageGoogle && isVirtual);
  const { createMeet, loading: creatingMeet, error: createMeetError } = useCreateGoogleMeet();
  const { startOAuth, loading: startingOAuth, error: oauthStartError } = useStartGoogleOAuth();
  const [ needsReconnect, setNeedsReconnect ] = useState(false);
  const [ actionError, setActionError ] = useState<string | null>(null);
  const isConnected = connection?.connected === true && !needsReconnect;

  const generateMeet = useCallback(async () => {
    setActionError(null);
    try {
      const { meetingUrl } = await createMeet();
      setForm((current) => ({ ...current, meetingUrl }));
      setNeedsReconnect(false);
    } catch (cause) {
      if (cause instanceof ApiMutationError && cause.status === 409) {
        setNeedsReconnect(true);
        setActionError("La conexión con Google debe renovarse antes de generar el enlace.");
      } else {
        setActionError(cause instanceof Error ? cause.message : "No se pudo generar el enlace de Google Meet.");
      }
    }
  }, [ createMeet, setForm ]);

  const { openOAuth, waiting: waitingForOAuth, error: popupError } = useGoogleOAuthPopup(
    useCallback(async (result) => {
      if (!result.success) {
        setActionError(result.error ?? "Error al conectar con Google.");
        return;
      }
      setNeedsReconnect(false);
      await generateMeet();
    }, [ generateMeet ]),
  );

  const handleGenerateMeet = useCallback(async () => {
    if (!isVirtual) return;
    if (form.meetingUrl && !window.confirm("Ya existe una URL de videollamada. ¿Quieres reemplazarla por un nuevo enlace de Google Meet?")) return;

    if (isConnected) {
      await generateMeet();
      return;
    }

    await openOAuth(() => startOAuth("/appointments", needsReconnect));
  }, [ form.meetingUrl, generateMeet, isConnected, isVirtual, needsReconnect, openOAuth, startOAuth ]);

  const meetingUrlInvalid = Boolean(form.meetingUrl && !validateHttpUrl(form.meetingUrl));
  const googleError = actionError || popupError || oauthStartError || createMeetError || connectionError;
  const isGoogleBusy = creatingMeet || startingOAuth || waitingForOAuth;

  return (
    <div className="form-stack">
      <label className="form-label">
        <RequiredField label="Duración" />
        <CustomSelect
          value={form.duration}
          data-testid="appointment-duration-select"
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
            data-testid="appointment-location-select"
            options={locations.map((d) => ({ value: d.id, label: d.name }))}
            onChange={setField("locationId")}
          />
        ) : (
          <div className="error-inline" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <STATUS_ICONS.warning size={14} /> No hay ubicaciones disponibles.
          </div>
        )}
      </label>

      {isVirtual && (
        <div className="form-field-group">
          <div className="form-label">
            <label htmlFor="appointment-meeting-url">
              <RequiredField label="URL de videollamada" />
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <input
                id="appointment-meeting-url"
                type="url"
                className="form-input"
                style={{ flex: 1 }}
                value={form.meetingUrl ?? ""}
                onChange={set("meetingUrl")}
                placeholder="Ingrese la URL de la videollamada (Google Meet, Zoom, Teams, etc.)"
                data-testid="appointment-meeting-url-input"
                aria-invalid={meetingUrlInvalid}
                aria-describedby={meetingUrlInvalid ? "appointment-meeting-url-error" : undefined}
                required
              />
              {canManageGoogle && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleGenerateMeet}
                  disabled={isGoogleBusy || loadingConnection || !isVirtual}
                  data-testid="generate-meet-link-button"
                  style={{ height: 40, whiteSpace: "nowrap" }}
                >
                  {isGoogleBusy ? (
                    <><span className="spinner" style={{ width: 16, height: 16, marginRight: 8 }} />Generando…</>
                  ) : (
                    <><ACTION_ICONS.link size={16} style={{ marginRight: 6 }} />{form.meetingUrl ? "Regenerar Google Meet" : isConnected ? "Generar Google Meet" : needsReconnect ? "Reconectar y generar" : "Conectar y generar"}</>
                  )}
                </button>
              )}
            </div>
            {meetingUrlInvalid && (
              <div id="appointment-meeting-url-error" role="alert" className="error-inline" style={{ marginTop: 4 }}>
                Ingresa una URL completa que comience con http:// o https://.
              </div>
            )}
            {googleError && (
              <div role="alert" className="error-inline" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <STATUS_ICONS.warning size={14} /> {googleError}{" "}
                <a href="/settings?tab=Integraciones">Ir a Configuración</a>
              </div>
            )}
            {!loadingConnection && !connectionError && !isConnected && canManageGoogle && isVirtual && !form.meetingUrl && (
              <p style={{ marginTop: 8, fontSize: 13, color: "var(--c-gray-500)" }}>
                Para usar Google Meet,{" "}
                <button
                  type="button"
                  onClick={handleGenerateMeet}
                  style={{ background: "none", border: "none", color: "var(--c-brand)", textDecoration: "underline", cursor: "pointer", fontSize: 13, padding: 0 }}
                >
                  conecta tu cuenta de Google
                </button>
                o ingresa una URL manual.
              </p>
            )}
            {loadingConnection && canManageGoogle && <p role="status" aria-live="polite" style={{ marginTop: 8, fontSize: 13 }}>Comprobando conexión con Google…</p>}
          </div>
        </div>
      )}

      {hasAnyContact ? (
        <div>
          <label className="form-label">
            Recordatorio
            <CustomSelect
              value={form.reminderType}
              data-testid="appointment-reminder-select"
              options={[
                { value: ReminderType.NONE, label: LBL_NO_REMINDER },
                { value: ReminderType.IMMEDIATE, label: "Enviar ahora" },
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
