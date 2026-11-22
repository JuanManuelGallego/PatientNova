import { fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Agenda, CompactMonth, agendaPeriodLabel } from "@/src/components/Calendar/Agenda";
import { useCalendarData } from "@/src/components/Calendar/useCalendarData";
import { ViewMode } from "@/src/components/Calendar/types";
import { dateFromStr, getWeekStart, type HeldSlot } from "@/src/components/Calendar/constants";
import type { Appointment } from "@/src/types/Appointment";
import type { BlockedTime } from "@/src/types/BlockedTime";
import { fmtTime, localDateTimeToUtc } from "@/src/utils/TimeUtils";

const TZ = "America/New_York";
const DEVICE_TZ = "Asia/Tokyo";

vi.mock("@/src/hooks/useDisplayTimezone", () => ({ useDisplayTimezone: () => TZ }));

const appt = (over: Partial<Appointment> & { id: string; startAt: string; endAt: string }): Appointment => ({
  createdAt: "", updatedAt: "", price: 0, paid: false, status: "SCHEDULED", patientId: "p",
  patient: { id: "p", name: "Ana", lastName: "Beltrán" },
  appointmentType: { id: "t", name: "Consulta inicial", defaultDuration: 60 },
  appointmentLocation: { id: "l", name: "Consultorio", color: "#2563eb" },
  ...over,
} as unknown as Appointment);

const blocked = (id: string, start: string, end: string, description: string | null = "Almuerzo"): BlockedTime => ({
  id, description, startTimeUtc: start, endTimeUtc: end, createdAt: "", updatedAt: "",
});

const hold = (id: string, startAt: string, endAt: string): HeldSlot => ({ id, startAt, endAt, name: "Luis", lastName: "Pardo" });

const originalTz = process.env.TZ;

beforeEach(() => {
  process.env.TZ = DEVICE_TZ;
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-25T15:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  process.env.TZ = originalTz;
});

const handlers = () => ({
  onSelectDay: vi.fn(),
  onPrevWeek: vi.fn(),
  onNextWeek: vi.fn(),
  onViewAppt: vi.fn(),
  onSelectBlockedTime: vi.fn(),
  onSelectHold: vi.fn(),
  onCreateAppointment: vi.fn(),
  onCreateBlockedTime: vi.fn(),
});

function renderAgenda(
  day: string,
  { appointments = [], blockedTimes = [], holds = [] }: { appointments?: Appointment[]; blockedTimes?: BlockedTime[]; holds?: HeldSlot[] },
  h = handlers(),
  opts: { withHolds?: boolean; loading?: boolean } = {},
) {
  const [ y, m ] = day.split("-").map(Number);
  const { result } = renderHook(() => useCalendarData({
    calYear: y!, calMonth: m! - 1, weekStart: getWeekStart(dateFromStr(day)), viewMode: ViewMode.Day,
    appointments, blockedTimes, holds, timezone: TZ,
  }));
  const data = result.current;
  render(
    <Agenda
      timezone={TZ}
      day={day}
      apptByDate={data.apptByDate}
      blockedByDate={data.blockedByDate}
      holdByDate={data.holdByDate}
      holidayMap={data.holidayMap}
      loading={opts.loading ?? false}
      {...h}
      onSelectHold={opts.withHolds === false ? undefined : h.onSelectHold}
    />,
  );
  return h;
}

const list = () => screen.getByTestId("calendar-agenda-list");
const items = () => within(list()).getAllByRole("button").filter((b) => b.dataset.testid?.startsWith("calendar-agenda-"));

describe("Agenda: the selected day's list", () => {
  it("lists appointments, holds and blocked time in time order, with the provider zone's times", () => {
    renderAgenda("2026-11-25", {
      appointments: [
        appt({ id: "late", startAt: "2026-11-25T20:00:00Z", endAt: "2026-11-25T21:00:00Z",
          patient: { id: "p2", name: "Marta", lastName: "Ríos" } as Appointment["patient"], status: "CONFIRMED" as Appointment["status"] }),
        appt({ id: "early", startAt: "2026-11-25T14:00:00Z", endAt: "2026-11-25T14:30:00Z" }),
        appt({ id: "other", startAt: "2026-11-26T14:00:00Z", endAt: "2026-11-26T15:00:00Z" }),
      ],
      blockedTimes: [ blocked("lunch", "2026-11-25T17:00:00Z", "2026-11-25T18:00:00Z") ],
      holds: [ hold("h1", "2026-11-25T15:00:00Z", "2026-11-25T16:00:00Z") ],
    });

    expect(items().map((b) => b.dataset.testid)).toEqual([
      "calendar-agenda-event-early",
      "calendar-agenda-hold-h1",
      "calendar-agenda-blocked-lunch",
      "calendar-agenda-event-late",
    ]);

    const early = screen.getByTestId("calendar-agenda-event-early");
    expect(early).toHaveTextContent(fmtTime("2026-11-25T14:00:00Z", TZ));
    expect(early).toHaveTextContent(fmtTime("2026-11-25T14:30:00Z", TZ));
    expect(early).toHaveTextContent(/09:00/);
    expect(early).toHaveTextContent("Ana Beltrán");
    expect(early).toHaveTextContent("Consulta inicial");
    expect(early).toHaveTextContent("Programada");
    expect(screen.getByTestId("calendar-agenda-event-late")).toHaveTextContent("Confirmada");
    expect(screen.getByTestId("calendar-agenda-blocked-lunch")).toHaveTextContent("Almuerzo");
    expect(screen.getByTestId("calendar-agenda-hold-h1")).toHaveTextContent("Pendiente de revisión");
    expect(screen.getByTestId("calendar-agenda-hold-h1")).toHaveTextContent("Luis Pardo");
  });

  it("puts a late-evening appointment on its provider-zone day across the fall-back night", () => {
    const appointments = [
      appt({ id: "late-night", startAt: "2026-11-02T04:30:00Z", endAt: "2026-11-02T04:55:00Z" }),
      appt({ id: "second-130", startAt: "2026-11-01T06:30:00Z", endAt: "2026-11-01T07:00:00Z" }),
      appt({ id: "first-130", startAt: "2026-11-01T05:30:00Z", endAt: "2026-11-01T06:00:00Z" }),
    ];
    renderAgenda("2026-11-01", { appointments });

    expect(items().map((b) => b.dataset.testid)).toEqual([
      "calendar-agenda-event-first-130",
      "calendar-agenda-event-second-130",
      "calendar-agenda-event-late-night",
    ]);
    expect(screen.getByTestId("calendar-agenda-event-late-night")).toHaveTextContent(/11:30/);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/domingo, 1 de noviembre/i);
  });

  it("does not list the next morning's appointment on the late-evening day", () => {
    renderAgenda("2026-11-02", {
      appointments: [ appt({ id: "late-night", startAt: "2026-11-02T04:30:00Z", endAt: "2026-11-02T04:55:00Z" }) ],
    });
    expect(screen.queryByTestId("calendar-agenda-event-late-night")).toBeNull();
    expect(screen.getByTestId("calendar-agenda-empty")).toBeInTheDocument();
  });

  it("opens the drawers like the chips do", () => {
    const a = appt({ id: "a1", startAt: "2026-11-25T14:00:00Z", endAt: "2026-11-25T15:00:00Z" });
    const bt = blocked("b1", "2026-11-25T17:00:00Z", "2026-11-25T18:00:00Z");
    const h = renderAgenda("2026-11-25", { appointments: [ a ], blockedTimes: [ bt ], holds: [ hold("h1", "2026-11-25T19:00:00Z", "2026-11-25T20:00:00Z") ] });

    fireEvent.click(screen.getByTestId("calendar-agenda-event-a1"));
    expect(h.onViewAppt).toHaveBeenCalledWith(a);
    fireEvent.click(screen.getByTestId("calendar-agenda-blocked-b1"));
    expect(h.onSelectBlockedTime).toHaveBeenCalledWith(bt);
    fireEvent.click(screen.getByTestId("calendar-agenda-hold-h1"));
    expect(h.onSelectHold).toHaveBeenCalledWith("h1");
  });

  it("shows no holds when the inbox is off", () => {
    renderAgenda("2026-11-25", { holds: [ hold("h1", "2026-11-25T19:00:00Z", "2026-11-25T20:00:00Z") ] }, handlers(), { withHolds: false });
    expect(screen.queryByTestId("calendar-agenda-hold-h1")).toBeNull();
    expect(screen.getByTestId("calendar-agenda-empty")).toBeInTheDocument();
  });

  it("offers Nueva cita and Bloquear horario prefilled for an empty day", () => {
    const h = renderAgenda("2026-11-27", {});
    const empty = screen.getByTestId("calendar-agenda-empty");

    fireEvent.click(within(empty).getByRole("button", { name: "Nueva cita" }));
    expect(h.onCreateAppointment).toHaveBeenCalledWith(localDateTimeToUtc("2026-11-27", "09:00:00", TZ));
    expect(h.onCreateAppointment).toHaveBeenCalledWith("2026-11-27T14:00:00.000Z");

    fireEvent.click(within(empty).getByRole("button", { name: "Bloquear horario" }));
    expect(h.onCreateBlockedTime).toHaveBeenCalledWith("2026-11-27");
  });

  it("shows no empty state while the day is loading", () => {
    renderAgenda("2026-11-27", {}, handlers(), { loading: true });
    expect(screen.queryByTestId("calendar-agenda-empty")).toBeNull();
    expect(list()).toHaveAttribute("aria-busy", "true");
  });

  it("shows a block over two days as starting on the first and ending on the second", () => {
    const overnight = blocked("night", "2026-11-25T23:00:00Z", "2026-11-26T15:00:00Z", "Viaje");
    renderAgenda("2026-11-25", { blockedTimes: [ overnight ] });
    const first = screen.getByTestId("calendar-agenda-blocked-night");
    expect(first).toHaveTextContent("06:00 p. m.");
    expect(first).toHaveTextContent("…");
    expect(first).not.toHaveTextContent("10:00 a. m.");
  });

  it("shows the second day of a two-day block as ending at its time", () => {
    const overnight = blocked("night", "2026-11-25T23:00:00Z", "2026-11-26T15:00:00Z", "Viaje");
    renderAgenda("2026-11-26", { blockedTimes: [ overnight ] });
    const second = screen.getByTestId("calendar-agenda-blocked-night");
    expect(second).toHaveTextContent(/hasta 10:00 a\. m\./i);
    expect(second).not.toHaveTextContent("06:00 p. m.");
  });

  it("shows a day a block covers entirely as Todo el día", () => {
    const trip = blocked("trip", "2026-11-24T17:00:00Z", "2026-11-27T17:00:00Z", "Congreso");
    renderAgenda("2026-11-25", { blockedTimes: [ trip ] });
    expect(screen.getByTestId("calendar-agenda-blocked-trip")).toHaveTextContent("Todo el día");
  });

  it("names the holiday of the day", () => {
    renderAgenda("2026-12-08", {});
    expect(screen.getByTestId("calendar-agenda-holiday")).toHaveTextContent(/Inmaculada/i);
  });
});

describe("Agenda: the week strip", () => {
  const strip = () => screen.getByRole("group", { name: /semana/i });
  const pill = (date: string) => screen.getByTestId(`calendar-strip-day-${date}`);

  it("shows Monday to Sunday of the selected day's week, today and the selected day marked", () => {
    renderAgenda("2026-11-27", {});
    const days = within(strip()).getAllByRole("button").map((b) => b.dataset.testid);
    expect(days).toEqual([ 23, 24, 25, 26, 27, 28, 29 ].map((d) => `calendar-strip-day-2026-11-${d}`));
    expect(pill("2026-11-23")).toHaveTextContent("Lun");
    expect(pill("2026-11-29")).toHaveTextContent("Dom");
    expect(pill("2026-11-25")).toHaveAttribute("aria-current", "date");
    expect(pill("2026-11-27")).toHaveAttribute("aria-pressed", "true");
    expect(pill("2026-11-25")).toHaveAttribute("aria-pressed", "false");
  });

  it("puts a dot on days with appointments, blocked time or holds", () => {
    renderAgenda("2026-11-25", {
      appointments: [ appt({ id: "a1", startAt: "2026-11-24T14:00:00Z", endAt: "2026-11-24T15:00:00Z" }) ],
      blockedTimes: [ blocked("b1", "2026-11-26T14:00:00Z", "2026-11-26T15:00:00Z") ],
      holds: [ hold("h1", "2026-11-28T14:00:00Z", "2026-11-28T15:00:00Z") ],
    });
    const busy = [ "2026-11-24", "2026-11-26", "2026-11-28" ];
    for (const d of [ 23, 24, 25, 26, 27, 28, 29 ].map((n) => `2026-11-${n}`)) {
      expect(within(pill(d)).queryByTestId("calendar-strip-dot") !== null, d).toBe(busy.includes(d));
    }
    expect(pill("2026-11-24")).toHaveAccessibleName(/1 evento/);
  });

  it("marks New Year's Day on a strip that starts in December", () => {
    renderAgenda("2026-12-30", {});
    expect(pill("2027-01-01")).toHaveAccessibleName(/festivo/);
    expect(pill("2026-12-31")).not.toHaveAccessibleName(/festivo/);
  });

  it("selects a day on tap", () => {
    const h = renderAgenda("2026-11-25", {});
    fireEvent.click(pill("2026-11-28"));
    expect(h.onSelectDay).toHaveBeenCalledWith("2026-11-28");
  });

  it("changes week on a sideways swipe and ignores a vertical one", () => {
    const h = renderAgenda("2026-11-25", {});
    const swipe = (fromX: number, toX: number, fromY = 100, toY = 100) => {
      fireEvent.touchStart(strip(), { touches: [ { clientX: fromX, clientY: fromY } ] });
      fireEvent.touchEnd(strip(), { changedTouches: [ { clientX: toX, clientY: toY } ] });
    };
    swipe(300, 100);
    expect(h.onNextWeek).toHaveBeenCalledTimes(1);
    swipe(100, 300);
    expect(h.onPrevWeek).toHaveBeenCalledTimes(1);
    swipe(200, 180, 100, 400);
    expect(h.onNextWeek).toHaveBeenCalledTimes(1);
    expect(h.onPrevWeek).toHaveBeenCalledTimes(1);
  });
});

describe("CompactMonth", () => {
  it("is a dot calendar: no chips, a dot on busy days, and a tap selects the day", () => {
    const onSelectDay = vi.fn();
    render(
      <CompactMonth
        timezone={TZ}
        year={2026}
        month={10}
        selectedDay="2026-11-27"
        apptByDate={{ "2026-11-10": [ appt({ id: "a1", startAt: "2026-11-10T14:00:00Z", endAt: "2026-11-10T15:00:00Z" }) ] }}
        blockedByDate={{}}
        holdByDate={{}}
        holidayMap={{}}
        loading={false}
        onSelectDay={onSelectDay}
      />,
    );
    const grid = screen.getByRole("group", { name: /noviembre de 2026/i });
    const days = within(grid).getAllByRole("button");
    expect(days).toHaveLength(30);
    expect(screen.queryByTestId("calendar-event-a1")).toBeNull();
    expect(screen.queryByText("Ana Beltrán")).toBeNull();

    const busy = screen.getByTestId("calendar-month-day-2026-11-10");
    expect(within(busy).getByTestId("calendar-month-dot")).toBeInTheDocument();
    expect(within(screen.getByTestId("calendar-month-day-2026-11-11")).queryByTestId("calendar-month-dot")).toBeNull();
    expect(screen.getByTestId("calendar-month-day-2026-11-25")).toHaveAttribute("aria-current", "date");
    expect(screen.getByTestId("calendar-month-day-2026-11-27")).toHaveAttribute("aria-pressed", "true");
    expect(grid.querySelectorAll("[data-blank]")).toHaveLength(6);

    fireEvent.click(busy);
    expect(onSelectDay).toHaveBeenCalledWith("2026-11-10");
  });
});

describe("agendaPeriodLabel", () => {
  it("names the month of a week inside one month", () => {
    expect(agendaPeriodLabel("2026-11-25")).toBe("Noviembre de 2026");
  });

  it("names both months of a week across two", () => {
    expect(agendaPeriodLabel("2026-12-01")).toBe("nov – dic 2026");
  });

  it("names both years of a week across New Year", () => {
    expect(agendaPeriodLabel("2026-12-30")).toBe("dic 2026 – ene 2027");
  });
});
