import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppointmentDrawer } from "@/src/components/Drawers/AppointmentDrawer";
import { FocusTrapProvider } from "@/src/hooks/useFocusTrap";
import type { Appointment } from "@/src/types/Appointment";

vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/api/appointments/useFetchAppointment", () => ({ useFetchAppointment: () => ({ appointment: null, error: null }) }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

const appt = (status: string) => ({
  id: "a1", startAt: "2026-11-27T14:00:00.000Z", endAt: "2026-11-27T15:00:00.000Z", status, paid: false, price: "100",
  createdAt: "2026-11-01T00:00:00.000Z", notes: null, source: "PROVIDER", meetingUrl: null,
  patient: { id: "p1", name: "Ana", lastName: "Beltrán", email: "ana@example.com" },
  appointmentType: { id: "t1", name: "Consulta", color: "#000" },
  appointmentLocation: { id: "l1", name: "Consultorio", color: null },
  reminder: null,
}) as unknown as Appointment;

const renderDrawer = (status: string, props: Record<string, unknown>) =>
  render(<FocusTrapProvider><AppointmentDrawer appt={appt(status)} onClose={vi.fn()} {...props} /></FocusTrapProvider>);

describe("AppointmentDrawer Confirmar", () => {
  it("is offered for a SCHEDULED appointment and calls onConfirm", () => {
    const onConfirm = vi.fn();
    renderDrawer("SCHEDULED", { onConfirm, onEdit: vi.fn() });
    fireEvent.click(screen.getByTestId("appointment-drawer-confirm-button"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it.each(["CONFIRMED", "CANCELLED", "COMPLETED"])("is hidden for %s", (status) => {
    renderDrawer(status, { onConfirm: vi.fn(), onEdit: vi.fn() });
    expect(screen.queryByTestId("appointment-drawer-confirm-button")).toBeNull();
  });

  it("is hidden when no confirm handler is given", () => {
    renderDrawer("SCHEDULED", { onEdit: vi.fn() });
    expect(screen.queryByTestId("appointment-drawer-confirm-button")).toBeNull();
  });
});
