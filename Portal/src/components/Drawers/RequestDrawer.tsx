"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { DrawerShell, DrawerState, Row, Section } from "@/src/components/Drawers/DrawerUtils";
import { ConfirmDialog } from "@/src/components/Modals/ConfirmDialog";
import { RequestStatusPill } from "@/src/components/Info/RequestStatusPill";
import { useFetchBookingRequest } from "@/src/api/booking-requests/useFetchBookingRequest";
import { useResolveBookingRequest } from "@/src/api/booking-requests/useResolveBookingRequest";
import { useDisplayTimezone } from "@/src/hooks/useDisplayTimezone";
import { fmtDate, fmtDateTime, fmtTime } from "@/src/utils/TimeUtils";
import { DETAIL_ICONS, STATUS_ICONS } from "@/src/config/icons";
import type { BookingRequestDetail, RequestCandidate } from "@/src/types/BookingRequest";

/** `null` = no explicit choice: reuse the contact's single match or create a new patient. */
type PatientChoice = string | null;

function candidateName(c: RequestCandidate) {
  return `${c.name} ${c.lastName}`;
}

const isPhoneRequest = (request: BookingRequestDetail) => !!request.verifiedPhone;

function defaultMatch(request: BookingRequestDetail): RequestCandidate | undefined {
  const active = request.candidates.filter((c) => !c.isDeleted);
  if (!isPhoneRequest(request)) return active[ 0 ];
  const trusted = active.filter((c) => !c.unverifiedMatch);
  return trusted.length === 1 ? trusted[ 0 ] : undefined;
}

function reusedOutcome(c: RequestCandidate): string {
  if (c.status === "INACTIVE") return `La cita se creará para ${candidateName(c)}, que se reactivará.`;
  if (c.unverifiedMatch) return `La cita se creará para ${candidateName(c)} y su número quedará verificado.`;
  return `La cita se creará para ${candidateName(c)}, sin cambiar sus datos.`;
}

/** What approving will do with the patient record, in the provider's words. */
function approvalOutcome(request: BookingRequestDetail, choice: PatientChoice): string {
  const chosen = request.candidates.find((c) => c.id === choice);
  if (chosen?.isDeleted) return `Se restaurará a ${candidateName(chosen)} y la cita se creará para ese paciente.`;
  const reused = chosen ?? defaultMatch(request);
  return reused ? reusedOutcome(reused) : "Se creará un paciente nuevo con los datos de la solicitud.";
}

function approveBody(request: BookingRequestDetail, choice: PatientChoice) {
  const chosen = request.candidates.find((c) => c.id === choice);
  if (!chosen) return {};
  return chosen.isDeleted ? { restorePatientId: chosen.id } : { existingPatientId: chosen.id };
}

function CandidateCard({ c, timezone }: { c: RequestCandidate; timezone: string }) {
  const state = c.isDeleted
    ? `Eliminado${c.deletedAt ? ` el ${fmtDate(c.deletedAt, timezone)}` : ""}`
    : c.status === "INACTIVE" ? "Inactivo" : "Activo";
  const facts = [
    state,
    c.lastVisitAt ? `Última cita el ${fmtDate(c.lastVisitAt, timezone)}` : "Sin citas anteriores",
    c.whatsappNumber,
    c.smsNumber,
    c.whatsappUnverified ? "Número sin verificar" : null,
    c.portalAccessEnabled ? null : "Acceso al portal desactivado",
  ].filter(Boolean);
  return (
    <span style={{ display: "block" }} data-testid={`request-candidate-${c.id}`}>
      <span style={{ fontWeight: 600, color: "var(--c-gray-900)" }}>{candidateName(c)}</span>
      {facts.map((fact) => (
        <span key={fact} className="form-input-hint" style={{ display: "block" }}>{fact}</span>
      ))}
    </span>
  );
}

function CandidatesSection({ request, choice, onChoose, timezone }: {
  request: BookingRequestDetail;
  choice: PatientChoice;
  onChoose: (c: PatientChoice) => void;
  timezone: string;
}) {
  const { candidates } = request;
  if (candidates.length === 0) return null;
  const onPhone = isPhoneRequest(request);
  const active = candidates.filter((c) => !c.isDeleted);
  const deleted = candidates.filter((c) => c.isDeleted);
  const match = defaultMatch(request);
  // A number can be shared, so its other records can be picked. An email has one active record, and restoring is only
  // possible while none holds it.
  const pickable = onPhone ? active.filter((c) => c !== match) : [];
  const canChoose = request.status === "PENDING" && (onPhone ? pickable.length + deleted.length > 0 : active.length === 0 && deleted.length > 0);

  return (
    <Section title={onPhone ? "Pacientes con este número" : "Pacientes con este correo"} testId="request-candidates">
      {(!onPhone || !canChoose) && active.map((c) => <CandidateCard key={c.id} c={c} timezone={timezone} />)}
      {canChoose ? (
        <fieldset className="form-stack form-fieldset-plain" style={{ marginTop: 8 }}>
          <legend className="form-label form-fieldset-legend">¿Con qué paciente quieres crear la cita?</legend>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
            <input
              type="radio"
              name="request-patient"
              checked={choice === null}
              onChange={() => onChoose(null)}
              data-testid="request-choice-new"
            />
            {match ? (
              <span>
                Usar a <CandidateCard c={match} timezone={timezone} />
              </span>
            ) : (
              <span>Crear un paciente nuevo con los datos de la solicitud</span>
            )}
          </label>
          {pickable.map((c) => (
            <label key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                name="request-patient"
                checked={choice === c.id}
                onChange={() => onChoose(c.id)}
                data-testid={`request-choice-existing-${c.id}`}
              />
              <span>
                Usar a <CandidateCard c={c} timezone={timezone} />
              </span>
            </label>
          ))}
          {deleted.map((c) => (
            <label key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                name="request-patient"
                checked={choice === c.id}
                onChange={() => onChoose(c.id)}
                data-testid={`request-choice-restore-${c.id}`}
              />
              <span>
                Restaurar a <CandidateCard c={c} timezone={timezone} />
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        deleted.map((c) => <CandidateCard key={c.id} c={c} timezone={timezone} />)
      )}
    </Section>
  );
}

export function RequestDrawer({ requestId, onClose, onResolved }: {
  requestId: string;
  onClose: () => void;
  /** After approve/reject (or a stale request), so the list and badge refresh. */
  onResolved: () => void;
}) {
  const timezone = useDisplayTimezone();
  const { request, loading, error, fetchRequest } = useFetchBookingRequest(requestId);
  const { approve, reject, loading: resolving, error: resolveError } = useResolveBookingRequest();
  const [ choice, setChoice ] = useState<PatientChoice>(null);
  const [ confirmReject, setConfirmReject ] = useState(false);
  const [ done, setDone ] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, doneMessage: string) {
    setDone(null);
    try {
      await action();
      setConfirmReject(false);
      setDone(doneMessage);
    } catch {
      // The error is shown from `resolveError`; a request that is no longer pending still refreshes below.
    } finally {
      onResolved();
      void fetchRequest();
    }
  }

  const pending = request?.status === "PENDING";
  const footer = pending ? (
    <>
      <button
        type="button"
        className="btn-secondary"
        disabled={resolving}
        onClick={() => setConfirmReject(true)}
        data-testid="request-reject"
      >
        Rechazar
      </button>
      <button
        type="button"
        className="btn-primary"
        disabled={resolving}
        onClick={() => run(
          () => approve(requestId, request ? approveBody(request, choice) : {}),
          "Solicitud aprobada. La cita quedó en tu agenda y le avisamos al paciente.",
        )}
        data-testid="request-approve"
      >
        {resolving ? "Guardando…" : "Aprobar y crear la cita"}
      </button>
    </>
  ) : undefined;

  return (
    <>
      <DrawerShell
        title={request ? `${request.name} ${request.lastName}` : "Solicitud"}
        eyebrow={request?.kind === "REVIEW" ? "Solicitud para revisar" : "Solicitud de cita"}
        icon={Inbox}
        status={request ? <RequestStatusPill status={request.status} /> : undefined}
        footer={footer}
        onClose={onClose}
        panelTestId="request-drawer"
        closeTestId="request-drawer-close"
      >
        {!request && (loading || !error) && <DrawerState message="Cargando solicitud…" />}
        {!request && error && <DrawerState message={error} error />}
        {request && (
          <>
            {resolveError && (
              <div className="error-inline" role="alert" data-testid="request-error">{resolveError}</div>
            )}
            {done && !resolveError && (
              <p className="form-input-hint" role="status" data-testid="request-done">{done}</p>
            )}
            {request.kind === "REVIEW" && pending && (
              <p className="form-input-hint" data-testid="request-review-reason">
                {isPhoneRequest(request)
                  ? "Este número coincide con varios pacientes, con un número sin verificar o con un paciente inactivo o eliminado, así que la reserva quedó pendiente de tu revisión."
                  : "Este correo pertenece a un paciente inactivo o eliminado, así que la reserva quedó pendiente de tu revisión."}
              </p>
            )}
            <Section title="Cita solicitada">
              <Row icon={STATUS_ICONS.calendar} label="Fecha" value={fmtDate(request.startAt, timezone)} />
              <Row icon={STATUS_ICONS.pending} label="Hora" value={`${fmtTime(request.startAt, timezone)} – ${fmtTime(request.endAt, timezone)}`} />
              <Row icon={null} label="Tipo" value={request.type.name} />
              <Row icon={null} label="Lugar" value={`${request.location.name}${request.location.isVirtual ? " (virtual)" : ""}`} />
              {pending && (
                <Row icon={STATUS_ICONS.warning} label="Vence" value={fmtDateTime(request.holdExpiresAt, timezone)} testId="request-hold-expires" />
              )}
              {request.resolvedAt && <Row icon={null} label="Resuelta" value={fmtDateTime(request.resolvedAt, timezone)} />}
            </Section>
            <Section title="Datos del paciente">
              {request.verifiedPhone
                ? <Row icon={null} label={`${request.contactChannel === "SMS" ? "SMS" : "WhatsApp"} (verificado)`} value={request.verifiedPhone} testId="request-verified-phone" />
                : <Row icon={null} label="Correo (verificado)" value={request.email} />}
              <Row icon={null} label="Nombre (sin verificar)" value={`${request.name} ${request.lastName}`} />
              {!request.verifiedPhone && <Row icon={null} label="Teléfono (sin verificar)" value={request.phone ?? "—"} />}
              <Row icon={null} label="Zona horaria" value={request.patientTimezone} />
              <Row
                icon={null}
                label="Consentimiento"
                value={`Política ${request.consent.policyVersion}, aceptada el ${fmtDateTime(request.consent.acceptedAt, timezone)}`}
              />
            </Section>
            <CandidatesSection request={request} choice={choice} onChoose={setChoice} timezone={timezone} />
            {pending && (
              <p className="form-input-hint" data-testid="request-outcome">{approvalOutcome(request, choice)}</p>
            )}
            <Section title="Información del sistema" quiet>
              <Link
                href={`/settings?tab=Registro+de+actividad&entityId=${request.id}`}
                className="drawer-link"
                data-testid="request-drawer-audit-link"
              >
                <DETAIL_ICONS.history size={15} aria-hidden="true" /> Ver registros de actividad
              </Link>
            </Section>
          </>
        )}
      </DrawerShell>
      {confirmReject && (
        <ConfirmDialog
          icon={STATUS_ICONS.cancelled}
          title="¿Rechazar esta solicitud?"
          confirmLabel="Rechazar"
          loadingLabel="Rechazando…"
          loading={resolving}
          error={resolveError}
          nested
          testId="request-reject-confirm"
          onClose={() => setConfirmReject(false)}
          onConfirm={() => run(() => reject(requestId), "Solicitud rechazada. El horario quedó libre.")}
        >
          El horario quedará libre y le avisaremos al paciente, sin indicar un motivo.
        </ConfirmDialog>
      )}
    </>
  );
}
