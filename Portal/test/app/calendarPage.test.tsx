import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const nav = {
  viewMode: "month", setViewMode: vi.fn(), calYear: 2026, calMonth: 10, weekStart: "2026-11-09", selectedDay: null,
  setSelectedDay: vi.fn(), calendarFilters: { dateFrom: "2026-11-01", dateTo: "2026-11-30" },
  navPrev: vi.fn(), navNext: vi.fn(), goToday: vi.fn(), drillToDay: vi.fn(),
};
vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => "America/Bogota" }));
vi.mock("@/src/api/appointments/useFetchAppointments", () => ({ useFetchAppointments: () => ({ appointments: [], loading: false, fetchAppointments: vi.fn() }) }));
vi.mock("@/src/api/appointments/useUpdateAppointment", () => ({ useUpdateAppointment: () => ({ updateAppointment: vi.fn() }) }));
vi.mock("@/src/api/blocked-time/useFetchBlockedTimes", () => ({ useFetchBlockedTimes: () => ({ blockedTimes: [], loading: false, fetchBlockedTimes: vi.fn() }) }));
vi.mock("@/src/api/booking-requests/useFetchBookingRequests", () => ({ useFetchBookingRequests: () => ({ requests: [], fetchRequests: vi.fn() }) }));
vi.mock("@/src/providers/PendingRequestsContext", () => ({ usePendingRequests: () => ({ enabled: false }) }));
vi.mock("@/src/components/Calendar/useCalendarNavigation", () => ({ useCalendarNavigation: () => nav }));
vi.mock("@/src/components/Calendar/useCalendarData", () => ({
  useCalendarData: () => ({ rows: [], weekDays: [], apptByDate: {}, blockedByDate: {}, holdByDate: {}, holidayMap: {}, cellDate: vi.fn(), navLabel: "", hourRange: [ 8, 18 ] }),
}));
vi.mock("@/src/hooks/useDrawerNavigation", () => ({
  useDrawerNavigation: () => ({ target: null, close: vi.fn(), openAppointment: vi.fn(), openPatient: vi.fn(), openReminder: vi.fn() }),
}));
vi.mock("@/src/components/PageLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
for (const m of [ "Drawers/RelatedDrawers:RelatedDrawers", "Modals/AppointmentModal:AppointmentModal", "Modals/CancelAppointmentModal:CancelAppointmentModal",
  "Modals/BlockedTimeModal:BlockedTimeModal", "Drawers/RequestDrawer:RequestDrawer", "Calendar/CalendarToolbar:CalendarToolbar",
  "Calendar/CalendarLegend:CalendarLegend", "Calendar/MonthView:MonthView", "Calendar/WeekView:WeekView", "Calendar/DayPanel:DayPanel" ]) {
  const [ path, name ] = m.split(":");
  vi.doMock(`@/src/components/${path}`, () => ({ [ name! ]: () => null }));
}

describe("calendar page", () => {
  it("is titled Calendario, as the navigation calls it", async () => {
    const { default: Page } = await import("@/src/app/(provider)/(protected)/calendar/page");
    render(<Page />);
    expect(screen.getByRole("heading", { name: "Calendario" })).toBeInTheDocument();
  });
});
