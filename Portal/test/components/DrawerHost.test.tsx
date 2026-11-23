import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrawerHost } from "@/src/components/Drawers/DrawerHost";
import { DrawerType } from "@/src/hooks/useDrawerNavigation";

const captured = vi.hoisted(() => ({ props: null as Record<string, any> | null }));

vi.mock("@/src/components/Drawers/RelatedDrawers", () => ({
  RelatedDrawers: (props: Record<string, any>) => {
    captured.props = props;
    return null;
  },
}));
vi.mock("@/src/api/appointments/useUpdateAppointment", () => ({ useUpdateAppointment: () => ({ updateAppointment: vi.fn() }) }));
vi.mock("@/src/api/reminders/useRetryReminder", () => ({ useRetryReminder: () => ({ retryReminder: vi.fn(), loading: false }) }));
vi.mock("@/src/components/Modals/AppointmentModal", () => ({ AppointmentModal: () => <div data-testid="edit-appt-modal" /> }));
vi.mock("@/src/components/Modals/CancelAppointmentModal", () => ({ CancelAppointmentModal: () => <div data-testid="cancel-appt-modal" /> }));
vi.mock("@/src/components/Modals/PatientModal", () => ({ PatientModal: () => <div data-testid="edit-patient-modal" /> }));
vi.mock("@/src/components/Modals/TogglePatientModal", () => ({ TogglePatientModal: () => <div data-testid="toggle-patient-modal" /> }));
vi.mock("@/src/components/Modals/EditScheduledReminderModal", () => ({ EditScheduledReminderModal: () => <div data-testid="edit-reminder-modal" /> }));
vi.mock("@/src/components/Modals/CancelReminderModal", () => ({ CancelReminderModal: () => <div data-testid="cancel-reminder-modal" /> }));

function renderHost(onClose = vi.fn()) {
  const target = { type: DrawerType.PATIENT, value: { id: "p1" } } as never;
  render(
    <DrawerHost
      target={target}
      onClose={onClose}
      onViewAppointment={vi.fn()}
      onViewPatient={vi.fn()}
      onViewReminder={vi.fn()}
    />,
  );
  return onClose;
}

describe("DrawerHost", () => {
  it("wires every entity's actions, whichever page opened the drawer", () => {
    renderHost();
    const p = captured.props!;
    expect(Object.keys(p.appointmentActions)).toEqual(expect.arrayContaining(["onEdit", "onConfirm", "onPay", "onDelete"]));
    expect(Object.keys(p.patientActions)).toEqual(expect.arrayContaining(["onEdit", "onDelete"]));
    expect(Object.keys(p.reminderActions)).toEqual(expect.arrayContaining(["onEdit", "onCancel", "onRetry"]));
  });

  it("opens the patient modal and closes the drawer", () => {
    const onClose = renderHost();
    act(() => captured.props!.patientActions.onEdit({ id: "p1" }));
    expect(screen.getByTestId("edit-patient-modal")).toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("opens the toggle modal for a patient and the cancel modal for a reminder", () => {
    renderHost();
    act(() => captured.props!.patientActions.onDelete({ id: "p1" }));
    act(() => captured.props!.reminderActions.onCancel({ id: "r1" }));
    expect(screen.getByTestId("toggle-patient-modal")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-reminder-modal")).toBeInTheDocument();
  });
});
