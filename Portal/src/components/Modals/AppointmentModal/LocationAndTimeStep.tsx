"use client";

import {
  AppointmentForm,
  AppointmentDuration,
  AppointmentLocation,
} from "@/src/types/Appointment";
import {
  ReminderType,
  Channel,
  REMINDER_TYPE_CONFIG,
  RELATIVE_REMINDER_TYPES,
  CLOCK_REMINDER_TYPES,
} from "@/src/types/Reminder";
import { DateTimeField } from "@/src/components/Pickers/DateTimeField";
import { Patient, getPatientContact } from "@/src/types/Patient";
import { STATUS_ICONS, ACTION_ICONS, DETAIL_ICONS } from "@/src/config/icons";
import { fmtSendTime, isReminderTypeFeasible } from "@/src/utils/TimeUtils";
import { CustomSelect } from "@/src/components/CustomSelect";
import { RequiredField } from "@/src/components/Info/Required";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import Link from "next/link";
import { settingsHref } from "@/src/config/navigation";
import { ChannelBanner } from "@/src/components/Info/ChannelBanner";
import { LBL_NO_REMINDER } from "@/src/constants/ui";
import React, { useState, useCallback } from "react";
import { SetField } from "./types";
import { useCreateGoogleMeet } from "@/src/api/google/useCreateGoogleMeet";
import { useStartGoogleOAuth } from "@/src/api/google/useStartGoogleOAuth";
import { useFetchGoogleConnection } from "@/src/api/google/useFetchGoogleConnection";
import { useGoogleOAuthPopup } from "@/src/hooks/useGoogleOAuthPopup";
import { ApiMutationError } from "@/src/api/base/useApiMutation";
import { validateHttpUrl } from "@/src/utils/DataValidator";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";

interface Props {
  form: AppointmentForm;
  set: SetField;
  setForm: React.Dispatch<React.SetStateAction<AppointmentForm>>;
  selectedPatient: Patient | undefined;
  reminderChannel: Channel | undefined;
  locations: AppointmentLocation[];
  linkMayWait?: boolean;
}

export function LocationAndTimeStep({
  form,
  set,
  setForm,
  selectedPatient,
  reminderChannel,
  locations,
  linkMayWait = false,
}: Props) {
  const timezone = useDisplayTimezone();
  const setField = (field: keyof AppointmentForm) => (value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const patientContact = selectedPatient
    ? getPatientContact(selectedPatient, reminderChannel)
    : undefined;

  const hasAnyContact =
    !!selectedPatient?.whatsappNumber ||
    !!selectedPatient?.email ||
    !!selectedPatient?.smsNumber;

  const selectedLocation = locations.find((l) => l.id === form.locationId);
  const isVirtual = selectedLocation?.isVirtual ?? false;

  const { data: connection, loading: loadingConnection, error: connectionError } = useFetchGoogleConnection(isVirtual);
  const { createMeet, loading: creatingMeet, error: createMeetError } = useCreateGoogleMeet();
  const { startOAuth, loading: startingOAuth, error: oauthStartError } = useStartGoogleOAuth();
  const [ needsReconnect, setNeedsReconnect ] = useState(false);
  const [ actionError, setActionError ] = useState<string | null>(null);
  const [ confirmingReplace, setConfirmingReplace ] = useState(false);
  const isConnected = connection?.connected === true && !needsReconnect;
  const mustReconnect = needsReconnect || connection?.status === "expired";

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

  const { openOAuth, mode: oauthMode, waiting: waitingForOAuth, error: popupError } = useGoogleOAuthPopup(
    useCallback(async (result) => {
      if (!result.success) {
        setActionError(result.error ?? "Error al conectar con Google.");
        return;
      }
      setNeedsReconnect(false);
      await generateMeet();
    }, [ generateMeet ]),
  );

  const runGenerateMeet = useCallback(async () => {
    if (!isVirtual) return;

    if (isConnected) {
      await generateMeet();
      return;
    }

    // A redirect would discard the half-filled form: the note below sends them to Integraciones instead.
    if (oauthMode === "redirect") return;

    await openOAuth(() => startOAuth("/appointments", mustReconnect));
  }, [ generateMeet, isConnected, isVirtual, mustReconnect, oauthMode, openOAuth, startOAuth ]);

  const handleGenerateMeet = useCallback(async () => {
    if (!isVirtual) return;
    if (form.meetingUrl) {
      setConfirmingReplace(true);
      return;
    }
    await runGenerateMeet();
  }, [ form.meetingUrl, isVirtual, runGenerateMeet ]);

  const confirmReplace = useCallback(() => {
    setConfirmingReplace(false);
    void runGenerateMeet();
  }, [ runGenerateMeet ]);

  const meetingUrlInvalid = Boolean(form.meetingUrl && !validateHttpUrl(form.meetingUrl));
  const googleError = actionError || popupError || oauthStartError || createMeetError || connectionError;
  const isGoogleBusy = creatingMeet || startingOAuth || waitingForOAuth;
  const googleMeetActionLabel = isGoogleBusy
    ? "Generando enlace de Google Meet"
    : mustReconnect
      ? "Reconectar y generar Google Meet"
      : form.meetingUrl
        ? "Regenerar Google Meet"
        : isConnected
          ? "Generar Google Meet"
          : "Conectar y generar Google Meet";

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
              {linkMayWait ? "URL de videollamada" : <RequiredField label="URL de videollamada" />}
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <input
                id="appointment-meeting-url"
                type="url"
                className="form-input"
                style={{ flex: 1 }}
                value={form.meetingUrl ?? ""}
                onChange={set("meetingUrl")}
                placeholder="Ingrese la URL de la videollamada (Google Meet, Zoom, etc.)"
                data-testid="appointment-meeting-url-input"
                aria-invalid={meetingUrlInvalid}
                aria-describedby={meetingUrlInvalid ? "appointment-meeting-url-error" : undefined}
              />
              <button
                type="button"
                className="btn-secondary"
                onClick={handleGenerateMeet}
                disabled={isGoogleBusy || loadingConnection || !isVirtual}
                data-testid="generate-meet-link-button"
                aria-label={googleMeetActionLabel}
                aria-describedby={mustReconnect && !googleError ? "google-expired-hint" : undefined}
                title={googleMeetActionLabel}
                style={{ alignSelf: "stretch", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {isGoogleBusy ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <ACTION_ICONS.link size={16} />}
              </button>
            </div>
            {oauthMode === "redirect" && !isConnected && (
              <p className="form-input-hint" style={{ marginTop: 4 }} data-testid="google-installed-hint">
                Para generar enlaces de Meet desde la app instalada,{" "}
                <Link href={settingsHref("integrations")}>Conecta Google en Configuración</Link>.
              </p>
            )}
            {linkMayWait && !form.meetingUrl && (
              <p className="form-input-hint" style={{ marginTop: 4 }} data-testid="meeting-link-may-wait-hint">
                Esta cita en línea aún no tiene enlace. Agrégalo cuando lo tengas: le enviaremos un correo al paciente.
              </p>
            )}
            {meetingUrlInvalid && (
              <div id="appointment-meeting-url-error" role="alert" className="error-inline" style={{ marginTop: 4 }}>
                Ingresa una URL completa que comience con http:// o https://.
              </div>
            )}
            {mustReconnect && !googleError && (
              <p id="google-expired-hint" className="form-input-hint" style={{ marginTop: 4 }} data-testid="google-expired-hint">
                Tu conexión con Google expiró. Reconéctala con el botón junto al campo o pega el enlace de tu propia sala.
              </p>
            )}
            {googleError && (
              <div role="alert" className="error-inline" style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <STATUS_ICONS.warning size={14} /> {googleError}
              </div>
            )}
          </div>
          {confirmingReplace && (
            <ConfirmDialog
              icon={DETAIL_ICONS.link}
              title="¿Reemplazar el enlace de videollamada?"
              confirmLabel="Reemplazar"
              nested
              testId="replace-meet-link-dialog"
              onClose={() => setConfirmingReplace(false)}
              onConfirm={confirmReplace}
            >
              Generaremos un nuevo enlace de Google Meet en lugar del que ya tiene esta cita.
            </ConfirmDialog>
          )}
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
                {
                  value: ReminderType.MANUAL,
                  label: REMINDER_TYPE_CONFIG[ReminderType.MANUAL].label,
                },
                { value: ReminderType.IMMEDIATE, label: "Enviar ahora" },
                ...[...RELATIVE_REMINDER_TYPES, ...CLOCK_REMINDER_TYPES]
                  .filter((type) => isReminderTypeFeasible(form.startAt, type, timezone))
                  .map((type) => ({
                    value: type,
                    label: `${REMINDER_TYPE_CONFIG[type].label} · ${fmtSendTime(form.startAt, type, timezone)}`,
                  })),
              ]}
              onChange={setField("reminderType")}
            />
          </label>

          {form.reminderType === ReminderType.MANUAL && (
            <div style={{ marginTop: 10 }}>
              <DateTimeField
                label={<RequiredField label="Fecha y hora del recordatorio" />}
                when="future"
                value={form.reminderSendAt}
                testId="appointment-reminder-sendat-input"
                onChange={(v) => setForm((f) => ({ ...f, reminderSendAt: v }))}
              />
            </div>
          )}

          {form.reminderType !== ReminderType.NONE && (
            <ChannelBanner channel={reminderChannel} contact={patientContact} />
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
