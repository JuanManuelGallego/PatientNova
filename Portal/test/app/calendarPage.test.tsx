import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PHONE_MEDIA_QUERY } from "@/src/hooks/usePhoneLayout";

const nav: Record<string, unknown> & { viewMode: string; dayDate: string; selectedDay: string | null } = {
  viewMode: "month", setViewMode: vi.fn(), calYear: 2026, calMonth: 10, weekStart: new Date(2026, 10, 23), dayDate: "2026-11-25",
  selectedDay: null, setSelectedDay: vi.fn(), selectDay: vi.fn(), calendarFilters: { dateFrom: "2026-11-01", dateTo: "2026-11-30" },
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

const props: Record<string, Record<string, unknown>> = {};
const marker = (name: string) => {
  function Mock(p: Record<string, unknown>) {
    props[ name ] = p;
    return <div data-testid={`mock-${name}`} />;
  }
  Mock.displayName = name;
  return Mock;
};
for (const m of [ "Drawers/RelatedDrawers:RelatedDrawers", "Modals/AppointmentModal:AppointmentModal", "Modals/CancelAppointmentModal:CancelAppointmentModal",
  "Modals/BlockedTimeModal:BlockedTimeModal", "Drawers/RequestDrawer:RequestDrawer", "Calendar/CalendarToolbar:CalendarToolbar",
  "Calendar/CalendarLegend:CalendarLegend", "Calendar/MonthView:MonthView", "Calendar/WeekView:WeekView", "Calendar/DayPanel:DayPanel" ]) {
  const [ path, name ] = m.split(":");
  vi.doMock(`@/src/components/${path}`, () => ({ [ name! ]: marker(name!) }));
}
vi.doMock("@/src/components/Calendar/Agenda", async () => ({
  ...await vi.importActual<typeof import("@/src/components/Calendar/Agenda")>("@/src/components/Calendar/Agenda"),
  Agenda: marker("Agenda"), CompactMonth: marker("CompactMonth"), AgendaToolbar: marker("AgendaToolbar"),
}));

const originalMatchMedia = window.matchMedia;
function stubPhone() {
  window.matchMedia = ((query: string) => ({
    matches: query === PHONE_MEDIA_QUERY,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
}

async function renderPage() {
  const { default: Page } = await import("@/src/app/(provider)/(protected)/calendar/page");
  return render(<Page />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-25T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  window.matchMedia = originalMatchMedia;
  nav.viewMode = "month";
  nav.dayDate = "2026-11-25";
  nav.selectedDay = null;
  for (const k of Object.keys(props)) delete props[ k ];
});

describe("calendar page", () => {
  it("is titled Calendario, as the navigation calls it", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { name: "Calendario" })).toBeInTheDocument();
  });

  it("keeps the desktop Month and Week views, toolbar and header buttons, with no floating button", async () => {
    await renderPage();
    expect(screen.getByTestId("mock-MonthView")).toBeInTheDocument();
    expect(screen.getByTestId("mock-CalendarToolbar")).toBeInTheDocument();
    expect(screen.getByTestId("mock-CalendarLegend")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-Agenda")).toBeNull();
    expect(screen.queryByTestId("mock-AgendaToolbar")).toBeNull();
    expect(screen.getByTestId("calendar-new-appointment-button")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-block-time-button")).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-fab-new-appointment")).toBeNull();
  });

  it("shows the week view on desktop", async () => {
    nav.viewMode = "week";
    await renderPage();
    expect(screen.getByTestId("mock-WeekView")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-MonthView")).toBeNull();
  });

  it("on a phone shows the agenda for the selected day and a floating Nueva cita", async () => {
    stubPhone();
    nav.viewMode = "day";
    await renderPage();

    expect(screen.getByTestId("mock-Agenda")).toBeInTheDocument();
    expect(screen.getByTestId("mock-AgendaToolbar")).toBeInTheDocument();
    expect(props.Agenda!.day).toBe("2026-11-25");
    for (const desktop of [ "MonthView", "WeekView", "CalendarToolbar", "CalendarLegend" ]) {
      expect(screen.queryByTestId(`mock-${desktop}`)).toBeNull();
    }
    expect(screen.getByTestId("calendar-block-time-button")).toBeInTheDocument();

    expect(screen.queryByTestId("mock-AppointmentModal")).toBeNull();
    const fab = screen.getByTestId("calendar-fab-new-appointment");
    expect(fab).toHaveAccessibleName("Nueva cita");
    fireEvent.click(fab);
    expect(screen.getByTestId("mock-AppointmentModal")).toBeInTheDocument();
  });

  it("the agenda's empty-day actions open the modals prefilled for that day", async () => {
    stubPhone();
    nav.viewMode = "day";
    await renderPage();

    const { act } = await import("@testing-library/react");
    act(() => (props.Agenda!.onCreateAppointment as (iso: string) => void)("2026-11-27T14:00:00.000Z"));
    expect(props.AppointmentModal!.prefillDate).toBe("2026-11-27T14:00:00.000Z");
    act(() => (props.Agenda!.onCreateBlockedTime as (day: string) => void)("2026-11-27"));
    expect(props.BlockedTimeModal!.prefillDate).toBe("2026-11-27");
  });

  it("on a phone the month is a day picker that opens the tapped day in the agenda", async () => {
    stubPhone();
    nav.viewMode = "month";
    await renderPage();

    expect(screen.getByTestId("mock-CompactMonth")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-MonthView")).toBeNull();
    (props.CompactMonth!.onSelectDay as (d: string) => void)("2026-11-10");
    expect(nav.selectDay).toHaveBeenCalledWith("2026-11-10");
  });

  it("labels a week across two months with both", async () => {
    stubPhone();
    nav.viewMode = "day";
    nav.dayDate = "2026-12-01";
    await renderPage();
    expect(props.AgendaToolbar!.label).toBe("nov – dic 2026");
  });

  it("the floating button opens Nueva cita on the agenda's day when it is not today", async () => {
    stubPhone();
    nav.viewMode = "day";
    nav.dayDate = "2026-11-27";
    await renderPage();
    fireEvent.click(screen.getByTestId("calendar-fab-new-appointment"));
    expect(props.AppointmentModal!.prefillDate).toBe("2026-11-27T14:00:00.000Z");
  });

  it("a past day (or an hour already gone today) is not prefilled: the modal keeps its usual default", async () => {
    stubPhone();
    nav.viewMode = "day";
    nav.dayDate = "2026-11-04";
    await renderPage();
    fireEvent.click(screen.getByTestId("calendar-fab-new-appointment"));
    expect(props.AppointmentModal!.prefillDate).toBeNull();

    const { act } = await import("@testing-library/react");
    act(() => (props.Agenda!.onCreateAppointment as (iso: string) => void)("2026-11-25T14:00:00.000Z"));
    expect(props.AppointmentModal!.prefillDate).toBeNull();
  });

  it("the floating button keeps the usual default on today", async () => {
    stubPhone();
    nav.viewMode = "day";
    await renderPage();
    fireEvent.click(screen.getByTestId("calendar-fab-new-appointment"));
    expect(props.AppointmentModal!.prefillDate).toBeNull();
  });

  it("the day panel's Nueva cita opens at 9:00 that day in the provider's zone, never a bare date", async () => {
    nav.selectedDay = "2026-11-27";
    await renderPage();
    const { act } = await import("@testing-library/react");
    act(() => (props.DayPanel!.onCreateOnDay as (day: string) => void)("2026-11-27"));
    expect(props.AppointmentModal!.prefillDate).toBe("2026-11-27T14:00:00.000Z");
  });
});
