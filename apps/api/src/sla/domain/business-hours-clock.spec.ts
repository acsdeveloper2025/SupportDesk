import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { BusinessHoursClock } from "./business-hours-clock";
import { emptyWeeklyHours, standardWeekdayNineToFive } from "./schedule.types";

describe("BusinessHoursClock", () => {
  const nycWeekdays = new BusinessHoursClock({
    holidays: ["2026-12-25"],
    timeZone: "America/New_York",
    weeklyHours: standardWeekdayNineToFive(),
  });

  it("skips weekends when adding business time", () => {
    // Friday 16:00 EDT = 20:00 UTC on 2026-07-10
    const start = DateTime.fromISO("2026-07-10T20:00:00.000Z").toJSDate();
    const due = nycWeekdays.addBusinessMs(start, 2 * 60 * 60 * 1000);
    // 1h Fri + weekend skip + 1h Mon 09:00 EDT => Mon 10:00 EDT = 14:00 UTC
    expect(due.toISOString()).toBe("2026-07-13T14:00:00.000Z");
  });

  it("skips configured holidays", () => {
    // Thursday 16:00 EST on 2026-12-24
    const start = DateTime.fromISO("2026-12-24T21:00:00.000Z").toJSDate();
    const due = nycWeekdays.addBusinessMs(start, 2 * 60 * 60 * 1000);
    // 1h Thu + holiday Fri skipped + weekend + 1h Mon 09:00 EST 2026-12-28 => 15:00 UTC
    expect(due.toISOString()).toBe("2026-12-28T15:00:00.000Z");
  });

  it("supports overnight windows", () => {
    const overnight = new BusinessHoursClock({
      holidays: [],
      timeZone: "UTC",
      weeklyHours: {
        ...emptyWeeklyHours(),
        mon: [{ end: "02:00", start: "22:00" }],
      },
    });

    const start = DateTime.fromISO("2026-07-06T21:00:00.000Z").toJSDate(); // Mon 21:00 UTC
    const due = overnight.addBusinessMs(start, 3 * 60 * 60 * 1000);
    // Open 22:00-02:00; from 22:00 consume 3h => 01:00 Tue
    expect(due.toISOString()).toBe("2026-07-07T01:00:00.000Z");
  });

  it("treats zero-length days as closed", () => {
    const clock = new BusinessHoursClock({
      holidays: [],
      timeZone: "UTC",
      weeklyHours: {
        ...emptyWeeklyHours(),
        mon: [],
        tue: [{ end: "12:00", start: "09:00" }],
      },
    });

    const start = DateTime.fromISO("2026-07-06T08:00:00.000Z").toJSDate(); // Monday
    const due = clock.addBusinessMs(start, 60 * 60 * 1000);
    expect(due.toISOString()).toBe("2026-07-07T10:00:00.000Z");
  });

  it("handles DST spring forward in America/New_York", () => {
    // 2026-03-08 DST starts; Sunday. From Friday before.
    const start = DateTime.fromISO("2026-03-06T21:00:00.000Z").toJSDate(); // Fri 16:00 ET
    const due = nycWeekdays.addBusinessMs(start, 2 * 60 * 60 * 1000);
    // 1h Fri + Mon 09:00-10:00 ET after spring forward (EDT = UTC-4) => 14:00 UTC
    expect(due.toISOString()).toBe("2026-03-09T14:00:00.000Z");
  });

  it("handles DST fall back in America/New_York", () => {
    // 2026-11-01 DST ends. Friday before.
    const start = DateTime.fromISO("2026-10-30T20:00:00.000Z").toJSDate(); // Fri 16:00 EDT
    const due = nycWeekdays.addBusinessMs(start, 2 * 60 * 60 * 1000);
    // 1h Fri + Mon 09:00-10:00 EST (UTC-5) => 15:00 UTC
    expect(due.toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });

  it("computes remaining business ms across a pause-friendly weekend gap", () => {
    const from = DateTime.fromISO("2026-07-10T20:00:00.000Z").toJSDate(); // Fri 16:00 ET
    const until = DateTime.fromISO("2026-07-13T15:00:00.000Z").toJSDate(); // Mon 11:00 ET
    const remaining = nycWeekdays.remainingBusinessMs(from, until);
    // Fri 16:00-17:00 (1h) + Mon 09:00-11:00 (2h) = 3h
    expect(remaining).toBe(3 * 60 * 60 * 1000);
  });

  it("reports isOpenAt correctly around holiday closures", () => {
    const open = DateTime.fromISO("2026-12-24T15:00:00.000Z").toJSDate(); // Thu 10:00 ET
    const holiday = DateTime.fromISO("2026-12-25T15:00:00.000Z").toJSDate(); // Fri holiday
    expect(nycWeekdays.isOpenAt(open)).toBe(true);
    expect(nycWeekdays.isOpenAt(holiday)).toBe(false);
  });
});
