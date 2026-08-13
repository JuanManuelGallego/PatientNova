import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppointmentModal } from "@/src/components/Modals/AppointmentModal";
import { useFetchPatient } from "@/src/api/patients/useFetchPatient";
import { AppointmentStatus, type Appointment } from "@/src/types/Appointment";
import { PatientStatus, type Patient } from "@/src/types/Patient";
import { Channel, ReminderMode, ReminderStatus, type Reminder } from "@/src/types/Reminder";

/* ── Shared mock factories ────────────────────────────────────────── */

function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: "patient-1",
    name: "John",
    lastName: "Doe",
    email: "john@example.com",
    whatsappNumber: "+15551234567",
    smsNumber: "+15551234567",
    status: PatientStatus.ACTIVE,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeAppt(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appt-1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    startAt: "2026-08-15T10:00:00.000Z",
    endAt: "2026-08-15T11:00:00.000Z",
    timezone: "UTC",
    price: 150,
    currency: "USD",
    paid: true,
    status: AppointmentStatus.CONFIRMED,
    patientId: "patient-1",
    patient: makePatient(),
    reminder: null,
    appointmentLocation: {
      id: "loc-1",
      name: "Clinic",
      isVirtual: false,
      address: "123 Main St",
    },
    appointmentType: {
      id: "type-1",
      name: "Consultation",
      defaultDuration: 60,
      defaultPrice: 150,
    },
    ...overrides,
  };
}

/* ── Mocks ────────────────────────────────────────────────────────── */

const mockCreateAppointment = vi.fn();
const mockUpdateAppointment = vi.fn();
const mockOnClose = vi.fn();
const mockOnSaved = vi.fn();

vi.mock("@/src/api/appointments/useCreateAppointment", () => ({
  useCreateAppointment: () => ({ createAppointment: mockCreateAppointment }),
}));

vi.mock("@/src/api/appointments/useUpdateAppointment", () => ({
  useUpdateAppointment: () => ({ updateAppointment: mockUpdateAppointment }),
}));

vi.mock("@/src/api/appointments/useFetchAppointments", () => ({
  useFetchAppointments: () => ({ appointments: [] }),
}));

vi.mock("@/src/api/appointment-types/useFetchAppointmentTypes", () => ({
  useFetchAppointmentTypes: () => ({
    appointmentTypes: [
      { id: "type-1", name: "Consultation", defaultDuration: 60, defaultPrice: 150 },
      { id: "type-2", name: "Follow-up", defaultDuration: 30, defaultPrice: 75 },
    ],
  }),
}));

vi.mock("@/src/api/locations/useFetchLocations", () => ({
  useFetchLocations: () => ({
    locations: [
      { id: "loc-1", name: "Clinic", isVirtual: false, address: "123 Main St" },
      { id: "loc-2", name: "Virtual", isVirtual: true},
    ],
  }),
}));

vi.mock("@/src/api/blocked-time/useFetchBlockedTimes", () => ({
  useFetchBlockedTimes: () => ({ blockedTimes: [] }),
}));

vi.mock("@/src/providers/AuthContext", () => ({
  useAuthContext: () => ({
    user: { id: "user-1", name: "Dr. Smith", reminderChannel: undefined },
  }),
}));

vi.mock("@/src/hooks/useFocusTrap", () => ({
  useFocusTrap: () => ({ ref: { current: null }, handleKeyDown: vi.fn() }),
}));

vi.mock("@/src/api/patients/useFetchPatient", () => ({
  useFetchPatient: vi.fn(),
}));

/* ── Step component mocks that expose props for assertions ────────── */

vi.mock("@/src/components/Modals/AppointmentModal/PatientAndTypeStep", () => ({
  PatientAndTypeStep: ({
    selectedPatient,
    isEdit,
    form,
    onPatientSelect,
  }: {
    selectedPatient?: Patient;
    isEdit: boolean;
    form: { patientId: string; typeId: string; startAt: string };
    onPatientSelect: (p: Patient | undefined) => void;
  }) => (
    <div data-testid="step-patient">
      <span data-testid="selected-patient">
        {selectedPatient
          ? `${selectedPatient.name} ${selectedPatient.lastName}`
          : "none"}
      </span>
      <span data-testid="is-edit">{String(isEdit)}</span>
      <span data-testid="form-patient-id">{form.patientId}</span>
      <span data-testid="form-type-id">{form.typeId}</span>
      <button
        data-testid="select-patient-btn"
        onClick={() =>
          onPatientSelect({
            id: "patient-2",
            name: "Jane",
            lastName: "Roe",
            email: "jane@example.com",
            whatsappNumber: "+15559999999",
            smsNumber: "+15559999999",
            status: "ACTIVE",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          } as Patient)
        }
      >
        Select Jane
      </button>
    </div>
  ),
}));

vi.mock("@/src/components/Modals/AppointmentModal/LocationAndTimeStep", () => ({
  LocationAndTimeStep: ({
    selectedPatient,
    reminderChannel,
    locations,
  }: {
    selectedPatient?: Patient;
    reminderChannel?: string;
    locations: { id: string; name: string }[];
  }) => (
    <div data-testid="step-location">
      <span data-testid="selected-patient-loc">
        {selectedPatient?.name ?? "none"}
      </span>
      <span data-testid="reminder-channel">{reminderChannel ?? "none"}</span>
      <span data-testid="location-count">{locations.length}</span>
    </div>
  ),
}));

vi.mock("@/src/components/Modals/AppointmentModal/PaymentAndStatusStep", () => ({
  PaymentAndStatusStep: ({
    selectedPatient,
    form,
    locations,
    appointmentTypes,
  }: {
    selectedPatient?: Patient;
    form: { price: number; status: string };
    locations: { id: string; name: string }[];
    appointmentTypes: { id: string; name: string }[];
  }) => (
    <div data-testid="step-payment">
      <span data-testid="selected-patient-pay">
        {selectedPatient?.name ?? "none"}
      </span>
      <span data-testid="form-price">{form.price}</span>
      <span data-testid="form-status">{form.status}</span>
      <span data-testid="pay-location-count">{locations.length}</span>
      <span data-testid="pay-type-count">{appointmentTypes.length}</span>
    </div>
  ),
}));

const mockedUseFetchPatient = vi.mocked(useFetchPatient);

/* ── Tests ────────────────────────────────────────────────────────── */

describe("AppointmentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseFetchPatient.mockReturnValue({
      patient: undefined,
      loading: false,
      error: null,
      fetchPatient: vi.fn(),
    });
    mockCreateAppointment.mockResolvedValue(undefined);
    mockUpdateAppointment.mockResolvedValue(undefined);
  });

  /* ── Rendering modes ────────────────────────────────────────────── */

  describe("rendering modes", () => {
    it("shows 'Nueva Cita' title in create mode", () => {
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      expect(screen.getByRole("dialog")).toHaveAttribute(
        "aria-label",
        "Nueva Cita",
      );
      expect(screen.getByText("Nueva Cita")).toBeInTheDocument();
    });

    it("shows 'Editar Cita' title in edit mode", () => {
      render(
        <AppointmentModal
          appt={makeAppt()}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByRole("dialog")).toHaveAttribute(
        "aria-label",
        "Editar Cita",
      );
      expect(screen.getByText("Editar Cita")).toBeInTheDocument();
    });

    it("renders step indicator with 3 segments", () => {
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      const dialog = screen.getByRole("dialog");
      const segments = dialog.querySelectorAll(".step-bar__segment");
      expect(segments).toHaveLength(3);
    });
  });

  /* ── Patient selection logic (no useEffect) ─────────────────────── */

  describe("patient selection", () => {
    it("create mode: selectedPatient is undefined initially", () => {
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      expect(screen.getByTestId("selected-patient")).toHaveTextContent(
        "none",
      );
    });

    it("edit mode: uses appt.patient as immediate fallback when fetch hasn't loaded", () => {
      mockedUseFetchPatient.mockReturnValue({
        patient: undefined,
        loading: true,
        error: null,
        fetchPatient: vi.fn(),
      });
      render(
        <AppointmentModal
          appt={makeAppt({
            patient: makePatient({ name: "Immediate", lastName: "Fallback" }),
          })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByTestId("selected-patient")).toHaveTextContent(
        "Immediate Fallback",
      );
    });

    it("edit mode: fetched patient overrides appt.patient", () => {
      mockedUseFetchPatient.mockReturnValue({
        patient: makePatient({
          id: "patient-1",
          name: "Fetched",
          lastName: "Patient",
        }),
        loading: false,
        error: null,
        fetchPatient: vi.fn(),
      });
      render(
        <AppointmentModal
          appt={makeAppt({
            patient: makePatient({ name: "Original", lastName: "Patient" }),
          })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByTestId("selected-patient")).toHaveTextContent(
        "Fetched Patient",
      );
    });

    it("edit mode: form patientId initializes from appt.patient.id", () => {
      render(
        <AppointmentModal
          appt={makeAppt({
            patientId: "patient-99",
            patient: makePatient({ id: "patient-42" }),
          })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByTestId("form-patient-id")).toHaveTextContent(
        "patient-42",
      );
    });
  });

  /* ── Step navigation ────────────────────────────────────────────── */

  describe("step navigation", () => {
    it("renders PatientAndTypeStep on step 1", () => {
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      expect(screen.getByTestId("step-patient")).toBeInTheDocument();
      expect(screen.queryByTestId("step-location")).not.toBeInTheDocument();
      expect(screen.queryByTestId("step-payment")).not.toBeInTheDocument();
    });

    it("renders LocationAndTimeStep on step 2", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt()}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByTestId("step-location")).toBeInTheDocument();
      expect(screen.queryByTestId("step-patient")).not.toBeInTheDocument();
      expect(screen.queryByTestId("step-payment")).not.toBeInTheDocument();
    });

    it("renders PaymentAndStatusStep on step 3", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt()}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      await user.click(screen.getByText("Continuar →"));
      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByTestId("step-payment")).toBeInTheDocument();
      expect(screen.queryByTestId("step-patient")).not.toBeInTheDocument();
      expect(screen.queryByTestId("step-location")).not.toBeInTheDocument();
    });

    it("back button navigates to previous step", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt()}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByText(/Lugar & Hora/)).toBeInTheDocument();

      await user.click(screen.getByText(/Atrás/));
      expect(screen.getByText(/Paciente & Tipo/)).toBeInTheDocument();
    });

    it("back button is not visible on step 1", () => {
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      expect(screen.queryByText(/Atrás/)).not.toBeInTheDocument();
    });

    it("step indicator updates segments as steps progress", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt()}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      const dialog = screen.getByRole("dialog");
      let segments = dialog.querySelectorAll(".step-bar__segment");
      expect(segments[0].className).toContain("step-bar__segment--done");
      expect(segments[1].className).not.toContain("step-bar__segment--done");

      await user.click(screen.getByText("Continuar →"));
      segments = dialog.querySelectorAll(".step-bar__segment");
      expect(segments[0].className).toContain("step-bar__segment--done");
      expect(segments[1].className).toContain("step-bar__segment--done");
      expect(segments[2].className).not.toContain("step-bar__segment--done");
    });

    it("shows step subtitle updating with current step", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt()}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByText(/Paso 1 de 3/)).toBeInTheDocument();

      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByText(/Paso 2 de 3/)).toBeInTheDocument();

      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByText(/Paso 3 de 3/)).toBeInTheDocument();
    });
  });

  /* ── Form initialization from appointment ───────────────────────── */

  describe("form initialization", () => {
    it("initializes typeId from appt.appointmentType.id", () => {
      render(
        <AppointmentModal
          appt={makeAppt({
            appointmentType: {
              id: "type-2",
              name: "Follow-up",
              defaultDuration: 30,
            },
          })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByTestId("form-type-id")).toHaveTextContent("type-2");
    });

    it("initializes price from appt.price", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt({ price: 250 })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      await user.click(screen.getByText("Continuar →"));
      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByTestId("form-price")).toHaveTextContent("250");
    });

    it("initializes status from appt.status", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt({ status: AppointmentStatus.CONFIRMED })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      await user.click(screen.getByText("Continuar →"));
      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByTestId("form-status")).toHaveTextContent("CONFIRMED");
    });
  });

  /* ── Close behavior ─────────────────────────────────────────────── */

  describe("close behavior", () => {
    it("calls onClose when close button is clicked", async () => {
      const user = userEvent.setup();
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      await user.click(screen.getByRole("dialog"));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("does not close when clicking inside the modal panel", async () => {
      const user = userEvent.setup();
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      const panel = screen.getByRole("dialog").querySelector(".modal-panel");
      expect(panel).toBeTruthy();
      await user.click(panel!);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  /* ── Edge cases ─────────────────────────────────────────────────── */

  describe("edge cases", () => {
    it("appt with zero price renders without crashing", async () => {
      const user = userEvent.setup();
      render(
        <AppointmentModal
          appt={makeAppt({ price: 0 })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      await user.click(screen.getByText("Continuar →"));
      await user.click(screen.getByText("Continuar →"));
      expect(screen.getByTestId("form-price")).toHaveTextContent("0");
    });

    it("different appt.patient values are rendered correctly", () => {
      const { unmount } = render(
        <AppointmentModal
          appt={makeAppt({
            patient: makePatient({ name: "Alice", lastName: "Smith" }),
          })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByTestId("selected-patient")).toHaveTextContent(
        "Alice Smith",
      );
      unmount();

      render(
        <AppointmentModal
          appt={makeAppt({
            patient: makePatient({ name: "Bob", lastName: "Jones" }),
          })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(screen.getByTestId("selected-patient")).toHaveTextContent(
        "Bob Jones",
      );
    });
  });

  /* ── Fetch patient called correctly ──────────────────────────────── */

  describe("useFetchPatient calls", () => {
    it("passes null in create mode", () => {
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      expect(mockedUseFetchPatient).toHaveBeenCalledWith(null);
    });

    it("passes appt.patientId in edit mode", () => {
      render(
        <AppointmentModal
          appt={makeAppt({ patientId: "patient-42" })}
          onClose={mockOnClose}
          onSaved={mockOnSaved}
        />,
      );
      expect(mockedUseFetchPatient).toHaveBeenCalledWith("patient-42");
    });
  });

  /* ── User selection in create mode resets properly ───────────────── */

  describe("user selection in create mode", () => {
    it("selecting a patient shows the selected patient name", async () => {
      const user = userEvent.setup();
      render(<AppointmentModal onClose={mockOnClose} onSaved={mockOnSaved} />);
      expect(screen.getByTestId("selected-patient")).toHaveTextContent(
        "none",
      );
      await user.click(screen.getByTestId("select-patient-btn"));
      expect(screen.getByTestId("selected-patient")).toHaveTextContent(
        "Jane Roe",
      );
    });
  });
});
