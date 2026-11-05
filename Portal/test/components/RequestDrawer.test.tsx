import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RequestDrawer } from "@/src/components/Drawers/RequestDrawer";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import type { BookingRequestDetail, RequestCandidate } from "@/src/types/BookingRequest";

let request: BookingRequestDetail | undefined;
const fetchRequest = vi.fn();
const approve = vi.fn();
const reject = vi.fn();
let resolveError: string | null = null;

vi.mock("@/src/api/booking-requests/useFetchBookingRequest", () => ({
  useFetchBookingRequest: () => ({ request, loading: false, error: null, fetchRequest }),
}));
vi.mock("@/src/api/booking-requests/useResolveBookingRequest", () => ({
  useResolveBookingRequest: () => ({ approve, reject, loading: false, error: resolveError }),
}));
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));

function candidate(overrides: Partial<RequestCandidate> = {}): RequestCandidate {
  return {
    id: "p1",
    name: "Lucia",
    lastName: "Rojas",
    email: "lucia@test.local",
    whatsappNumber: null,
    smsNumber: null,
    whatsappUnverified: false,
    unverifiedMatch: false,
    status: "ACTIVE",
    portalAccessEnabled: true,
    isDeleted: false,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    lastVisitAt: null,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<BookingRequestDetail> = {}): BookingRequestDetail {
  return {
    id: "r1",
    kind: "NEW",
    status: "PENDING",
    createdAt: "2099-01-18T15:00:00.000Z",
    startAt: "2099-01-20T15:00:00.000Z",
    endAt: "2099-01-20T16:00:00.000Z",
    holdExpiresAt: "2099-01-20T15:00:00.000Z",
    resolvedAt: null,
    name: "Lucia",
    lastName: "Rojas",
    contactChannel: "EMAIL",
    email: "lucia@test.local",
    verifiedPhone: null,
    phone: "+573001112233",
    patientTimezone: "America/New_York",
    appointmentId: null,
    patientId: null,
    type: { id: "t1", name: "Consulta" },
    location: { id: "l1", name: "Consultorio", isVirtual: false },
    consent: { policyVersion: "2026-10", acceptedAt: "2099-01-18T15:00:00.000Z" },
    candidates: [],
    ...overrides,
  };
}

const onResolved = vi.fn();
const renderDrawer = () => render(
  <FocusTrapProvider>
    <RequestDrawer requestId="r1" onClose={vi.fn()} onResolved={onResolved} />
  </FocusTrapProvider>,
);

beforeEach(() => {
  vi.clearAllMocks();
  request = makeRequest();
  resolveError = null;
  approve.mockResolvedValue(undefined);
  reject.mockResolvedValue(undefined);
  fetchRequest.mockResolvedValue(undefined);
});

describe("RequestDrawer", () => {
  it("shows the requested slot and typed data, and approves into a new patient", async () => {
    renderDrawer();
    expect(screen.getByTestId("request-drawer")).toHaveTextContent("Consulta");
    expect(screen.getByText("Correo (verificado)")).toBeInTheDocument();
    expect(screen.getByTestId("request-outcome")).toHaveTextContent("Se creará un paciente nuevo");
    await userEvent.click(screen.getByTestId("request-approve"));
    expect(approve).toHaveBeenCalledWith("r1", {});
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
  });

  it("says an inactive match will be reactivated, with no restore choice", () => {
    request = makeRequest({ kind: "REVIEW", candidates: [ candidate({ status: "INACTIVE" }), candidate({ id: "p2", isDeleted: true }) ] });
    renderDrawer();
    expect(screen.getByTestId("request-review-reason")).toBeInTheDocument();
    expect(screen.getByTestId("request-outcome")).toHaveTextContent("Lucia Rojas, que se reactivará");
    expect(screen.queryByTestId("request-choice-new")).not.toBeInTheDocument();
  });

  describe("a request from a phone session", () => {
    const phoneRequest = (overrides: Partial<BookingRequestDetail> = {}) => makeRequest({
      contactChannel: "WHATSAPP", email: null, verifiedPhone: "+573001112233", phone: null, ...overrides,
    });

    it("shows the proven number and no email or typed phone rows", () => {
      request = phoneRequest();
      renderDrawer();
      expect(screen.getByTestId("request-verified-phone")).toHaveTextContent("WhatsApp (verificado)");
      expect(screen.getByTestId("request-verified-phone")).toHaveTextContent("+573001112233");
      expect(screen.queryByText("Correo (verificado)")).not.toBeInTheDocument();
      expect(screen.queryByText("Teléfono (sin verificar)")).not.toBeInTheDocument();
    });

    it("says a new patient will be created when nothing matches", () => {
      request = phoneRequest();
      renderDrawer();
      expect(screen.getByTestId("request-outcome")).toHaveTextContent("Se creará un paciente nuevo");
    });

    it("reuses a single trusted record with no choice to make", async () => {
      request = phoneRequest({ candidates: [ candidate() ] });
      renderDrawer();
      expect(screen.getByTestId("request-outcome")).toHaveTextContent("La cita se creará para Lucia Rojas");
      expect(screen.queryByTestId("request-choice-new")).not.toBeInTheDocument();
      await userEvent.click(screen.getByTestId("request-approve"));
      expect(approve).toHaveBeenCalledWith("r1", {});
    });

    it("offers every active record of a shared number and never preselects one", async () => {
      request = phoneRequest({ candidates: [ candidate(), candidate({ id: "p2", name: "Ana" }) ] });
      renderDrawer();
      expect(screen.getByTestId("request-choice-new")).toBeChecked();
      expect(screen.getByTestId("request-outcome")).toHaveTextContent("Se creará un paciente nuevo");

      await userEvent.click(screen.getByTestId("request-choice-existing-p2"));
      expect(screen.getByTestId("request-outcome")).toHaveTextContent("La cita se creará para Ana Rojas");
      await userEvent.click(screen.getByTestId("request-approve"));
      expect(approve).toHaveBeenCalledWith("r1", { existingPatientId: "p2" });
    });

    it("marks a record matched only by a typed number, and says picking it verifies the number", async () => {
      request = phoneRequest({ candidates: [ candidate({ whatsappUnverified: true, unverifiedMatch: true }) ] });
      renderDrawer();
      expect(screen.getByText("Número sin verificar")).toBeInTheDocument();
      expect(screen.getByTestId("request-outcome")).toHaveTextContent("Se creará un paciente nuevo");

      await userEvent.click(screen.getByTestId("request-choice-existing-p1"));
      expect(screen.getByTestId("request-outcome")).toHaveTextContent("su número quedará verificado");
    });

    it("can restore a deleted record while another active one shares the number", async () => {
      request = phoneRequest({ candidates: [ candidate(), candidate({ id: "p2", isDeleted: true }) ] });
      renderDrawer();
      await userEvent.click(screen.getByTestId("request-choice-restore-p2"));
      await userEvent.click(screen.getByTestId("request-approve"));
      expect(approve).toHaveBeenCalledWith("r1", { restorePatientId: "p2" });
    });
  });

  it("lets the provider restore a deleted patient instead of creating one", async () => {
    request = makeRequest({ kind: "REVIEW", candidates: [ candidate({ id: "p2", isDeleted: true, deletedAt: "2026-05-01T00:00:00.000Z" }) ] });
    renderDrawer();
    expect(screen.getByTestId("request-choice-new")).toBeChecked();
    await userEvent.click(screen.getByTestId("request-choice-restore-p2"));
    expect(screen.getByTestId("request-outcome")).toHaveTextContent("Se restaurará a Lucia Rojas");
    await userEvent.click(screen.getByTestId("request-approve"));
    expect(approve).toHaveBeenCalledWith("r1", { restorePatientId: "p2" });
  });

  it("rejects only after an in-app confirmation", async () => {
    renderDrawer();
    await userEvent.click(screen.getByTestId("request-reject"));
    expect(reject).not.toHaveBeenCalled();
    expect(screen.getByText(/sin indicar un motivo/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("request-reject-confirm-confirm-button"));
    expect(reject).toHaveBeenCalledWith("r1");
  });

  it("refreshes the list even when the request is no longer pending", async () => {
    approve.mockRejectedValue(new Error("Esta solicitud ya no está pendiente"));
    renderDrawer();
    await userEvent.click(screen.getByTestId("request-approve"));
    await waitFor(() => expect(onResolved).toHaveBeenCalled());
    expect(fetchRequest).toHaveBeenCalled();
  });

  it("links to the request's activity log", () => {
    renderDrawer();
    expect(screen.getByTestId("request-drawer-audit-link"))
      .toHaveAttribute("href", "/settings?tab=Registro+de+actividad&entityId=r1");
  });

  it("offers no actions on a resolved request", () => {
    request = makeRequest({ status: "APPROVED", resolvedAt: "2099-01-19T15:00:00.000Z" });
    renderDrawer();
    expect(screen.queryByTestId("request-approve")).not.toBeInTheDocument();
    expect(screen.queryByTestId("request-reject")).not.toBeInTheDocument();
    expect(screen.getByTestId("request-status-approved")).toBeInTheDocument();
  });
});
