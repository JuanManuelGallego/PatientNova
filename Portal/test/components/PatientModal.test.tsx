import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PatientModal } from "@/src/components/Modals/PatientModal";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";

const version = { id: "cv1", version: 1, name: "c.pdf", mimeType: "application/pdf", sizeBytes: 10, createdAt: "2026-11-01T00:00:00.000Z" };
const patientTypes = [
  { id: "type-general", name: "General", isDefault: true, currentVersion: version },
  { id: "type-family", name: "Familia", isDefault: false, currentVersion: null },
];
const createPatient = vi.fn();
const sendWelcome = vi.fn();
const onSaved = vi.fn();
const onClose = vi.fn();

vi.mock("@/src/api/patients/useCreatePatient", () => ({ useCreatePatient: () => ({ createPatient, loading: false, error: null }) }));
vi.mock("@/src/api/patients/useUpdatePatient", () => ({ useUpdatePatient: () => ({ updatePatient: vi.fn(), loading: false, error: null }) }));
vi.mock("@/src/api/appointment-types/useFetchAppointmentTypes", () => ({ useFetchAppointmentTypes: () => ({ appointmentTypes: [] }) }));
vi.mock("@/src/api/patient-types/useFetchPatientTypes", () => ({
  useFetchPatientTypes: () => ({ patientTypes, defaultType: patientTypes[ 0 ], loading: false, error: null, refetch: vi.fn() }),
}));
vi.mock("@/src/api/patients/useSendWelcome", () => ({ useSendWelcome: () => ({ sendWelcome, loading: false, error: null }) }));
vi.mock("@/src/providers/AuthContext", () => ({
  useAuthContext: () => ({
    user: { id: "u1", displayName: "Dra. Ana", firstName: "Ana", lastName: "Ruiz", bankName: "Banco", accountNumber: "1", nationalId: "2", bankingKey: "@k" },
    refreshUser: vi.fn(),
  }),
}));

const renderModal = () => render(
  <FocusTrapProvider><PatientModal onClose={onClose} onSaved={onSaved} /></FocusTrapProvider>,
);

async function fillRequired() {
  await userEvent.type(screen.getByTestId("patient-name-input"), "Lucia");
  await userEvent.type(screen.getByTestId("patient-lastname-input"), "Rojas");
}

beforeEach(() => {
  vi.clearAllMocks();
  createPatient.mockResolvedValue({ id: "p1", reminderChannel: "WHATSAPP" });
  sendWelcome.mockResolvedValue({ reminderId: "r1" });
});

describe("PatientModal patient type", () => {
  it("starts on the default type and creates the patient with the type chosen", async () => {
    renderModal();
    const select = screen.getByTestId("patient-type-select");
    expect(within(select).getByRole("combobox")).toHaveTextContent("General");
    await fillRequired();
    await userEvent.click(within(select).getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Familia" }));
    await userEvent.click(screen.getByTestId("patient-modal-submit-button"));
    expect(createPatient).toHaveBeenCalledWith(expect.objectContaining({ patientTypeId: "type-family" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("explains that the welcome needs the type's consent PDF when the type has none", async () => {
    renderModal();
    const select = screen.getByTestId("patient-type-select");
    expect(screen.queryByTestId("patient-welcome-info-banner")).toBeNull();
    await userEvent.click(within(select).getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Familia" }));
    expect(screen.getByTestId("patient-welcome-info-banner")).toHaveTextContent("no tiene formulario de consentimiento");
  });

  it("sends the welcome through the server after creating the patient", async () => {
    renderModal();
    await fillRequired();
    await userEvent.type(screen.getByTestId("patient-email-input"), "lucia@example.com");
    await userEvent.click(screen.getByTestId("patient-reminder-channel-select").querySelector("button")!);
    await userEvent.click(screen.getByRole("option", { name: "Email" }));
    await userEvent.click(screen.getByTestId("patient-welcome-checkbox"));
    await userEvent.click(screen.getByTestId("patient-modal-submit-button"));
    expect(sendWelcome).toHaveBeenCalledWith("p1");
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the created patient and only offers to close when the welcome fails", async () => {
    sendWelcome.mockRejectedValueOnce(new Error("No pudimos enviar."));
    renderModal();
    await fillRequired();
    await userEvent.type(screen.getByTestId("patient-email-input"), "lucia@example.com");
    await userEvent.click(screen.getByTestId("patient-reminder-channel-select").querySelector("button")!);
    await userEvent.click(screen.getByRole("option", { name: "Email" }));
    await userEvent.click(screen.getByTestId("patient-welcome-checkbox"));
    await userEvent.click(screen.getByTestId("patient-modal-submit-button"));

    expect(onSaved).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("patient-modal-error")).toHaveTextContent("Paciente creado");
    expect(screen.queryByTestId("patient-modal-submit-button")).toBeNull();
    await userEvent.click(screen.getByTestId("patient-modal-close-after-welcome"));
    expect(onClose).toHaveBeenCalled();
  });
});
