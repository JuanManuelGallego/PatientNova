import { act, renderHook } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCalendarNavigation } from "@/src/components/Calendar/useCalendarNavigation";
import { ViewMode } from "@/src/components/Calendar/types";
import { toDateStr } from "@/src/components/Calendar/constants";

const TZ = "America/New_York";

function setup(searchParams: string, phone: boolean) {
  const env = { url: searchParams, phone };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter searchParams={env.url} hasMemory>{children}</NuqsTestingAdapter>
  );
  const hook = renderHook(() => useCalendarNavigation(TZ, { phone: env.phone }), { wrapper });
  return {
    ...hook,
    setUrl: (url: string) => { env.url = url; hook.rerender(); },
    setPhone: (phone: boolean) => { env.phone = phone; hook.rerender(); },
  };
}

const fetchedWeek = (filters: { dateFrom: string; dateTo: string }) => [ filters.dateFrom.slice(0, 10), filters.dateTo.slice(0, 10) ];

beforeEach(() => {
  vi.useFakeTimers({ toFake: [ "Date" ] });
  vi.setSystemTime(new Date("2026-11-25T15:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("useCalendarNavigation", () => {
  it("keeps Month and Week on a wider screen, reading a phone's day link as the week", () => {
    expect(setup("", false).result.current.viewMode).toBe(ViewMode.Week);
    expect(setup("?view=month", false).result.current.viewMode).toBe(ViewMode.Month);
    expect(setup("?view=day", false).result.current.viewMode).toBe(ViewMode.Week);
  });

  it("opens the agenda on a phone unless the month is asked for", () => {
    expect(setup("", true).result.current.viewMode).toBe(ViewMode.Day);
    expect(setup("?view=week", true).result.current.viewMode).toBe(ViewMode.Day);
    expect(setup("?view=month", true).result.current.viewMode).toBe(ViewMode.Month);
  });

  it("starts on today and fetches its Monday-to-Sunday week in the agenda", () => {
    const { result } = setup("", true);
    expect(result.current.dayDate).toBe("2026-11-25");
    expect(toDateStr(result.current.weekStart)).toBe("2026-11-23");
    expect(result.current.calendarFilters).toEqual({
      dateFrom: "2026-11-23T05:00:00.000Z",
      dateTo: "2026-11-30T04:59:59.999Z",
    });
  });

  it("moves the agenda a week at a time, keeping the weekday", () => {
    const { result } = setup("", true);
    act(() => result.current.navNext());
    expect(result.current.dayDate).toBe("2026-12-02");
    expect(toDateStr(result.current.weekStart)).toBe("2026-11-30");
    act(() => result.current.navPrev());
    act(() => result.current.navPrev());
    expect(result.current.dayDate).toBe("2026-11-18");
  });

  it("selecting a day from the month opens its week in the agenda and its month in Mes", () => {
    const { result } = setup("?view=month", true);
    act(() => result.current.selectDay("2027-01-06"));
    expect(result.current.viewMode).toBe(ViewMode.Day);
    expect(result.current.dayDate).toBe("2027-01-06");
    expect(toDateStr(result.current.weekStart)).toBe("2027-01-04");
    expect([ result.current.calYear, result.current.calMonth ]).toEqual([ 2027, 0 ]);
  });

  it("reads the agenda day from the link", () => {
    const { result } = setup("?view=day&day=2026-12-10", true);
    expect(result.current.dayDate).toBe("2026-12-10");
    expect(toDateStr(result.current.weekStart)).toBe("2026-12-07");
  });

  it("ignores a malformed day in the link", () => {
    expect(setup("?day=hoy", true).result.current.dayDate).toBe("2026-11-25");
  });

  it("follows the link when ?day changes while mounted (a tab link that clears it, Back, a pasted link)", () => {
    const { result, setUrl } = setup("?view=day&day=2026-12-10", true);
    expect(fetchedWeek(result.current.calendarFilters)).toEqual([ "2026-12-07", "2026-12-14" ]);

    setUrl("");
    expect(result.current.dayDate).toBe("2026-11-25");
    expect(toDateStr(result.current.weekStart)).toBe("2026-11-23");
    expect(fetchedWeek(result.current.calendarFilters)).toEqual([ "2026-11-23", "2026-11-30" ]);

    setUrl("?view=day&day=2027-01-01");
    expect(toDateStr(result.current.weekStart)).toBe("2026-12-28");
    expect([ result.current.calYear, result.current.calMonth ]).toEqual([ 2027, 0 ]);
  });

  it("fetches the agenda day's week after the week was paged on a wider screen", () => {
    const { result, setPhone } = setup("?view=day&day=2026-12-10", false);
    expect(result.current.viewMode).toBe(ViewMode.Week);
    act(() => result.current.navNext());
    act(() => result.current.navNext());
    expect(toDateStr(result.current.weekStart)).toBe("2026-12-21");

    setPhone(true);
    expect(result.current.viewMode).toBe(ViewMode.Day);
    expect(result.current.dayDate).toBe("2026-12-10");
    expect(toDateStr(result.current.weekStart)).toBe("2026-12-07");
    expect(fetchedWeek(result.current.calendarFilters)).toEqual([ "2026-12-07", "2026-12-14" ]);
  });

  it("on a phone, a week moved on the agenda is the week a wider screen shows next", () => {
    const { result, setPhone } = setup("", true);
    act(() => result.current.navNext());
    setPhone(false);
    expect(result.current.viewMode).toBe(ViewMode.Week);
    expect(toDateStr(result.current.weekStart)).toBe("2026-11-30");
  });

  it("on a wider screen, Ver día opens the week of that day", () => {
    const { result } = setup("?view=month", false);
    act(() => result.current.drillToDay("2027-01-06"));
    expect(result.current.viewMode).toBe(ViewMode.Week);
    expect(toDateStr(result.current.weekStart)).toBe("2027-01-04");
    expect(fetchedWeek(result.current.calendarFilters)).toEqual([ "2027-01-04", "2027-01-11" ]);
  });
});
