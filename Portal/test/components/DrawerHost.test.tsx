import { act, createRef } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DrawerHost, EntityActions } from "@/src/components/Drawers/DrawerHost";
import { DrawerType } from "@/src/hooks/useDrawerNavigation";

const mocks = vi.hoisted(() => ({
  props: null as Record<string, any> | null,
  updateAppointment: vi.fn(),
  retryReminder: vi.fn(),
}));

vi.mock("@/src/components/Drawers/RelatedDrawers", () => ({
  RelatedDrawers: (props: Record<string, any>) => {
    mocks.props = props;
    return null;
  },
}));
vi.mock("@/src/api/appointments/useUpdateAppointment", () => ({ useUpdateAppointment: () => ({ updateAppointment: mocks.updateAppointment }) }));
vi.mock("@/src/api/reminders/useRetryReminder", () => ({ useRetryReminder: () => ({ retryReminder: mocks.retryReminder, loading: false }) }));
vi.mock("@/src/components/Modals/AppointmentModal", () => ({ AppointmentModal: () => <div data-testid="edit-appt-modal" /> }));
vi.mock("@/src/components/Modals/CancelAppointmentModal", () => ({ CancelAppointmentModal: () => <div data-testid="cancel-appt-modal" /> }));
vi.mock("@/src/components/Modals/PatientModal", () => ({ PatientModal: () => <div data-testid="edit-patient-modal" /> }));
vi.mock("@/src/components/Modals/TogglePatientModal", () => ({ TogglePatientModal: () => <div data-testid="toggle-patient-modal" /> }));
vi.mock("@/src/components/Modals/EditScheduledReminderModal", () => ({ EditScheduledReminderModal: () => <div data-testid="edit-reminder-modal" /> }));
vi.mock("@/src/components/Modals/CancelReminderModal", () => ({ CancelReminderModal: () => <div data-testid="cancel-reminder-modal" /> }));

const appt = { id: "a1" } as never;
const reminder = { id: "r1" } as never;

function renderHost() {
  const onClose = vi.fn();
  const onChanged = vi.fn();
  const actionsRef = createRef<EntityActions>();
  render(
    <DrawerHost
      target={{ type: DrawerType.PATIENT, value: { id: "p1" } } as never}
      onClose={onClose}
      onViewAppointment={vi.fn()}
      onViewPatient={vi.fn()}
      onViewReminder={vi.fn()}
      onChanged={onChanged}
      actionsRef={actionsRef}
    />,
  );
  return { onClose, onChanged, actionsRef };
}

beforeEach(() => {
  mocks.updateAppointment.mockReset().mockResolvedValue(undefined);
  mocks.retryReminder.mockReset().mockResolvedValue(undefined);
});

describe("DrawerHost", () => {
  it("wires every entity's actions, whichever page opened the drawer", () => {
    renderHost();
    const p = mocks.props!;
    expect(Object.keys(p.appointmentActions)).toEqual(expect.arrayContaining(["onEdit", "onConfirm", "onPay", "onDelete"]));
    expect(Object.keys(p.patientActions)).toEqual(expect.arrayContaining(["onEdit", "onDelete"]));
    expect(Object.keys(p.reminderActions)).toEqual(expect.arrayContaining(["onEdit", "onCancel", "onRetry"]));
  });

  it("opens the patient modal and closes the drawer", () => {
    const { onClose } = renderHost();
    act(() => mocks.props!.patientActions.onEdit({ id: "p1" }));
    expect(screen.getByTestId("edit-patient-modal")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("opens the toggle modal for a patient and the cancel modal for a reminder", () => {
    renderHost();
    act(() => mocks.props!.patientActions.onDelete({ id: "p1" }));
    act(() => mocks.props!.reminderActions.onCancel(reminder));
    expect(screen.getByTestId("toggle-patient-modal")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-reminder-modal")).toBeInTheDocument();
  });

  it("confirms an appointment, closes the drawer and refreshes the page", async () => {
    const { onClose, onChanged } = renderHost();
    await act(async () => mocks.props!.appointmentActions.onConfirm(appt));
    expect(mocks.updateAppointment).toHaveBeenCalledWith("a1", { status: "CONFIRMED" });
    expect(onClose).toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("marks an appointment paid", async () => {
    const { onChanged } = renderHost();
    await act(async () => mocks.props!.appointmentActions.onPay(appt));
    expect(mocks.updateAppointment).toHaveBeenCalledWith("a1", { paid: true });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("shows the server message in an alert when a confirm fails, and still refreshes", async () => {
    mocks.updateAppointment.mockRejectedValue(new Error("Conflicto de horario"));
    const { onChanged } = renderHost();
    await act(async () => mocks.props!.appointmentActions.onConfirm(appt));
    expect(screen.getByRole("alert")).toHaveTextContent("Conflicto de horario");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("clears the previous error when a new action starts", async () => {
    mocks.updateAppointment.mockRejectedValueOnce(new Error("Falló"));
    renderHost();
    await act(async () => mocks.props!.appointmentActions.onPay(appt));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await act(async () => mocks.props!.appointmentActions.onPay(appt));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a message and refreshes when a reminder retry fails", async () => {
    mocks.retryReminder.mockRejectedValue(new Error("Canal no disponible"));
    const { onChanged } = renderHost();
    await act(async () => mocks.props!.reminderActions.onRetry(reminder));
    expect(screen.getByRole("alert")).toHaveTextContent("Canal no disponible");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("sends one request when the same action is clicked twice before it settles", async () => {
    let finish!: () => void;
    mocks.updateAppointment.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const { onChanged } = renderHost();
    let first!: Promise<unknown>;
    act(() => {
      first = mocks.props!.appointmentActions.onPay(appt);
      mocks.props!.appointmentActions.onPay(appt);
    });
    await act(async () => { finish(); await first; });
    expect(mocks.updateAppointment).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("gives a page's row buttons the same handlers through its ref", async () => {
    const { actionsRef, onClose, onChanged } = renderHost();
    act(() => actionsRef.current!.editAppointment(appt));
    expect(screen.getByTestId("edit-appt-modal")).toBeInTheDocument();
    await act(async () => actionsRef.current!.payAppointment(appt));
    expect(mocks.updateAppointment).toHaveBeenCalledWith("a1", { paid: true });
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
