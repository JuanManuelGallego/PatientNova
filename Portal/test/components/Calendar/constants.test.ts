import {
  computeHourRange,
  layoutBlockedTimes,
  eventDays,
  toUtcRangeFromLocalDay,
  HOUR_HEIGHT,
} from "@/src/components/Calendar/constants";
import { BlockedTime } from "@/src/types/BlockedTime";
import { zonedDateTimeParts } from "@/src/utils/TimeUtils";
import { describe, expect, it } from "vitest";

describe("computeHourRange", () => {
  it("includes blocked times outside the default hours", () => {
    const blockedTime = {
      startTimeUtc: new Date(2026, 8, 30, 4).toISOString(),
      endTimeUtc: new Date(2026, 8, 30, 5).toISOString(),
    } as BlockedTime;

    expect(computeHourRange([], [blockedTime]).firstHour).toBe(3);
  });

  it("uses the provider's timezone, not the browser's", () => {
    // 11:00Z is 06:00 in Bogotá: the grid must open at 05:00 regardless of the browser zone.
    const blockedTime = {
      startTimeUtc: "2026-10-19T11:00:00.000Z",
      endTimeUtc: "2026-10-19T12:00:00.000Z",
    } as BlockedTime;

    expect(computeHourRange([], [blockedTime], "America/Bogota").firstHour).toBe(5);
  });
});

describe("layoutBlockedTimes", () => {
  it("positions blocks by wall-clock time in the provider's timezone", () => {
    const blockedTime = {
      startTimeUtc: "2026-10-19T14:00:00.000Z",
      endTimeUtc: "2026-10-19T15:30:00.000Z",
    } as BlockedTime;

    // 09:00–10:30 in Bogotá, on a grid starting at 07:00.
    const [ placed ] = layoutBlockedTimes([ blockedTime ], 7, "America/Bogota");
    expect(placed.top).toBe(2 * HOUR_HEIGHT);
    expect(placed.height).toBe(1.5 * HOUR_HEIGHT);
  });
});

describe("zonedDateTimeParts", () => {
  it("puts an instant on the provider's calendar day", () => {
    // Sunday 19:00 in Bogotá is already Monday in UTC (the CI regression from 2026-10-18).
    expect(zonedDateTimeParts("2026-10-19T00:00:00.000Z", "America/Bogota")).toEqual({
      dateStr: "2026-10-18",
      hour: 19,
      minute: 0,
      second: 0,
    });
    expect(zonedDateTimeParts("2026-10-19T00:00:00.000Z", "UTC").dateStr).toBe("2026-10-19");
  });
});

describe("toUtcRangeFromLocalDay", () => {
  it("converts a user's local day using daylight-saving time", () => {
    expect(toUtcRangeFromLocalDay("2026-07-01", "America/New_York")).toEqual({
      dateFrom: "2026-07-01T04:00:00.000Z",
      dateTo: "2026-07-02T03:59:59.999Z",
    });
  });
});

describe("events crossing midnight", () => {
  // 22:00–02:00 in Bogotá (UTC-5), 2026-10-19 → 2026-10-20.
  const blockedTime = {
    startTimeUtc: "2026-10-20T03:00:00.000Z",
    endTimeUtc: "2026-10-20T07:00:00.000Z",
  } as BlockedTime;

  it("covers every day the event touches; an end at midnight is exclusive", () => {
    expect(eventDays(blockedTime.startTimeUtc, blockedTime.endTimeUtc, "America/Bogota")).toEqual([ "2026-10-19", "2026-10-20" ]);
    expect(eventDays("2026-10-20T03:00:00.000Z", "2026-10-20T05:00:00.000Z", "America/Bogota")).toEqual([ "2026-10-19" ]);
  });

  it("is drawn on both days with positive heights", () => {
    const [ first ] = layoutBlockedTimes([ blockedTime ], 0, "America/Bogota", "2026-10-19");
    expect(first.top).toBe(22 * HOUR_HEIGHT);
    expect(first.height).toBe(2 * HOUR_HEIGHT);
    const [ second ] = layoutBlockedTimes([ blockedTime ], 0, "America/Bogota", "2026-10-20");
    expect(second.top).toBe(0);
    expect(second.height).toBe(2 * HOUR_HEIGHT);
  });

  it("opens the hour range to the whole span", () => {
    expect(computeHourRange([], [ blockedTime ], "America/Bogota")).toMatchObject({ firstHour: 0, lastHour: 23 });
  });
});
