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
const updatePatient = vi.fn();
const sendWelcome = vi.fn();
const onSaved = vi.fn();
const onClose = vi.fn();

vi.mock("@/src/api/patients/useCreatePatient", () => ({ useCreatePatient: () => ({ createPatient, loading: false, error: null }) }));
vi.mock("@/src/api/patients/useUpdatePatient", () => ({ useUpdatePatient: () => ({ updatePatient, loading: false, error: null }) }));
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
  updatePatient.mockResolvedValue({ id: "p1" });
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

describe("PatientModal type change", () => {
  const patient = {
    id: "p1", name: "Lucia", lastName: "Rojas", email: "lucia@example.com", reminderChannel: "EMAIL", status: "ACTIVE",
    patientTypeId: "type-general", patientType: { id: "type-general", name: "General" },
  } as never;
  const renderEdit = () => render(
    <FocusTrapProvider><PatientModal onClose={onClose} onSaved={onSaved} patient={patient} /></FocusTrapProvider>,
  );
  const pickFamilia = async () => {
    await userEvent.click(within(screen.getByTestId("patient-type-select")).getByRole("combobox"));
    await userEvent.click(screen.getByRole("option", { name: "Familia" }));
  };

  it("asks for confirmation before changing the type, and sends it only once confirmed", async () => {
    renderEdit();
    await pickFamilia();
    await userEvent.click(screen.getByTestId("patient-modal-submit-button"));

    const dialog = screen.getByTestId("patient-type-change-dialog");
    expect(dialog).toHaveTextContent("se archivará como solo lectura");
    expect(dialog).toHaveTextContent("«Familia»");
    expect(updatePatient).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Cambiar tipo" }));
    expect(updatePatient).toHaveBeenCalledTimes(1);
    expect(updatePatient).toHaveBeenCalledWith("p1", expect.objectContaining({ patientTypeId: "type-family" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("sends nothing when the change is cancelled", async () => {
    renderEdit();
    await pickFamilia();
    await userEvent.click(screen.getByTestId("patient-modal-submit-button"));
    await userEvent.click(within(screen.getByTestId("patient-type-change-dialog")).getByRole("button", { name: "Regresar" }));

    expect(screen.queryByTestId("patient-type-change-dialog")).toBeNull();
    expect(updatePatient).not.toHaveBeenCalled();
  });

  it("an unchanged type saves at once and never sends patientTypeId", async () => {
    renderEdit();
    await userEvent.click(screen.getByTestId("patient-modal-submit-button"));

    expect(screen.queryByTestId("patient-type-change-dialog")).toBeNull();
    expect(updatePatient).toHaveBeenCalledTimes(1);
    expect(updatePatient.mock.calls[ 0 ]![ 1 ]).not.toHaveProperty("patientTypeId");
  });
});
