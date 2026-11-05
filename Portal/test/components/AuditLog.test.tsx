import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuditDrawer } from "@/src/components/Drawers/AuditDrawer";
import { EntityTypePill } from "@/src/components/Info/EntityTypePill";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import { ActionSource, ActionType, EntityType, actionTypeLabel, entityTypeLabel, type AuditLog } from "@/src/types/AuditLog";
import { buildAuditLogQueryString } from "@/src/utils/ApiUtils";
import { fmtCalendarDay, fmtDateTime } from "@/src/utils/TimeUtils";

vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/New_York" }));

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: "log1",
    userId: "u1",
    actorId: "portal:0123456789abcdef01234567",
    actorDisplayName: "Paciente (portal) l***@test.local",
    eventTimeUtc: "2026-11-03T15:00:00.000Z",
    entityType: EntityType.APPOINTMENT,
    entityId: "a1",
    actionType: ActionType.UPDATE,
    source: ActionSource.PUBLIC_PORTAL,
    description: "Cita cancelada por el paciente desde el portal",
    affectedFields: [ "status", "cancelledBy" ],
    fieldsBefore: { status: "SCHEDULED", cancelledBy: null },
    fieldsAfter: { status: "CANCELLED", cancelledBy: "PATIENT" },
    ipAddress: "203.0.113.7",
    ...overrides,
  };
}

const renderDrawer = (log: AuditLog) => render(
  <FocusTrapProvider>
    <AuditDrawer log={log} onClose={vi.fn()} />
  </FocusTrapProvider>,
);

describe("audit pills", () => {
  it("label the portal entity types", () => {
    render(<><EntityTypePill entityType={EntityType.BOOKING_REQUEST} /><EntityTypePill entityType={EntityType.PATIENT_CONSENT} /></>);
    expect(screen.getByText("Solicitud de reserva")).toBeInTheDocument();
    expect(screen.getByText("Consentimiento")).toBeInTheDocument();
  });

  it("show an unknown value instead of crashing", () => {
    render(<EntityTypePill entityType={"SOMETHING_NEW" as EntityType} />);
    expect(screen.getByText("SOMETHING_NEW")).toBeInTheDocument();
    expect(entityTypeLabel("SOMETHING_NEW" as EntityType)).toBe("SOMETHING_NEW");
    expect(actionTypeLabel("ARCHIVE" as ActionType)).toBe("ARCHIVE");
    expect(actionTypeLabel(ActionType.CREATE)).toBe("Creación");
  });
});

describe("AuditDrawer", () => {
  it("shows portal changes with Spanish labels and the source", () => {
    renderDrawer(makeLog());
    expect(screen.getByText("Cancelada por")).toBeInTheDocument();
    expect(screen.getByText("Paciente")).toBeInTheDocument();
    expect(screen.getByText("Agendada")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("Portal de pacientes")).toBeInTheDocument();
  });

  it("formats dates in the display timezone", () => {
    const acceptedAt = "2026-11-03T15:00:00.000Z";
    renderDrawer(makeLog({
      entityType: EntityType.PATIENT_CONSENT,
      actionType: ActionType.CREATE,
      affectedFields: [ "kind", "policyVersion", "acceptedAt" ],
      fieldsBefore: null,
      fieldsAfter: { kind: "DATA_PROCESSING", policyVersion: "2026-10-19", acceptedAt },
    }));
    expect(screen.getByText("Versión de la política")).toBeInTheDocument();
    expect(screen.getByText("Tratamiento de datos")).toBeInTheDocument();
    expect(screen.getAllByText(fmtDateTime(acceptedAt, "America/New_York")).length).toBeGreaterThan(0);
  });

  it("shows a date-named policy version verbatim", () => {
    renderDrawer(makeLog({
      entityType: EntityType.PATIENT_CONSENT,
      actionType: ActionType.CREATE,
      affectedFields: [ "policyVersion" ],
      fieldsBefore: null,
      fieldsAfter: { policyVersion: "2026-10-19" },
    }));
    expect(screen.getByText("2026-10-19")).toBeInTheDocument();
  });

  it("shows calendar days without shifting them through the timezone", () => {
    renderDrawer(makeLog({
      entityType: EntityType.PATIENT,
      affectedFields: [ "dateOfBirth" ],
      fieldsBefore: { dateOfBirth: "1990-05-10T00:00:00.000Z" },
      fieldsAfter: { dateOfBirth: "1990-05-11" },
    }));
    expect(screen.getByText(fmtCalendarDay("1990-05-10"))).toBeInTheDocument();
    expect(screen.getByText(fmtCalendarDay("1990-05-11"))).toBeInTheDocument();
    expect(screen.getByText(fmtCalendarDay("1990-05-10"))).toHaveTextContent("10 de mayo de 1990");
  });
});

describe("buildAuditLogQueryString", () => {
  it("sends several sources and the portal patient filter", () => {
    const qs = buildAuditLogQueryString({ source: [ ActionSource.JOB, ActionSource.PUBLIC_PORTAL ], portalPatientId: "p1" });
    expect(qs).toContain("source=JOB&source=PUBLIC_PORTAL");
    expect(qs).toContain("portalPatientId=p1");
  });
});
