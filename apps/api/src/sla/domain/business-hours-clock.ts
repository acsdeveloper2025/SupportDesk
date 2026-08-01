import { DateTime } from "luxon";

import {
  type BusinessScheduleDefinition,
  type TimeWindow,
  WEEKDAY_KEYS,
  type WeekdayKey,
} from "./schedule.types";

const MS_PER_MINUTE = 60_000;

/**
 * Deterministic business-hours clock using IANA time zones via luxon.
 * All public methods accept/return UTC Date instants.
 */
export class BusinessHoursClock {
  constructor(private readonly schedule: BusinessScheduleDefinition) {
    if (!DateTime.now().setZone(schedule.timeZone).isValid) {
      throw new Error(`Invalid IANA time zone: ${schedule.timeZone}`);
    }
  }

  isOpenAt(instant: Date): boolean {
    return this.openIntervalsTouching(DateTime.fromJSDate(instant, { zone: "utc" })).some(
      (interval) => {
        const ms = DateTime.fromJSDate(instant, { zone: "utc" }).toMillis();
        return ms >= interval.start.toMillis() && ms < interval.end.toMillis();
      },
    );
  }

  /**
   * Advance `start` by `businessMs` of open schedule time.
   * Returns a UTC Date.
   */
  addBusinessMs(start: Date, businessMs: number): Date {
    if (businessMs < 0) {
      throw new Error("businessMs must be non-negative");
    }
    if (businessMs === 0) {
      return new Date(start.getTime());
    }

    let remaining = businessMs;
    let cursor: DateTime = DateTime.fromJSDate(start, { zone: "utc" });
    // Bound iterations to avoid infinite loops on fully closed schedules.
    for (let i = 0; i < 50_000 && remaining > 0; i += 1) {
      const intervals = this.openIntervalsOnAndAfter(cursor);
      if (intervals.length === 0) {
        throw new Error("No open business windows available to consume SLA time");
      }

      for (const interval of intervals) {
        if (remaining <= 0) {
          break;
        }
        const openStart = interval.start > cursor ? interval.start : cursor;
        if (openStart >= interval.end) {
          continue;
        }
        const available = interval.end.toMillis() - openStart.toMillis();
        if (available <= 0) {
          continue;
        }
        if (remaining <= available) {
          return openStart.plus({ milliseconds: remaining }).toUTC().toJSDate();
        }
        remaining -= available;
        cursor = DateTime.fromMillis(interval.end.toMillis(), { zone: "utc" });
      }

      // Move to next local day start if intervals exhausted.
      if (remaining > 0) {
        const local = cursor.setZone(this.schedule.timeZone);
        cursor = DateTime.fromMillis(local.startOf("day").plus({ days: 1 }).toUTC().toMillis(), {
          zone: "utc",
        });
      }
    }

    throw new Error("Unable to allocate business time within iteration bound");
  }

  /**
   * Remaining open business milliseconds from `from` until `until` (exclusive end semantics
   * for open intervals). Returns 0 when until <= from.
   */
  remainingBusinessMs(from: Date, until: Date): number {
    const start = DateTime.fromJSDate(from, { zone: "utc" });
    const end = DateTime.fromJSDate(until, { zone: "utc" });
    if (end.toMillis() <= start.toMillis()) {
      return 0;
    }

    let total = 0;
    let cursor: DateTime = start;
    for (let i = 0; i < 50_000 && cursor < end; i += 1) {
      const intervals = this.openIntervalsOnAndAfter(cursor).filter(
        (interval) => interval.start < end,
      );
      if (intervals.length === 0) {
        break;
      }

      let progressed = false;
      for (const interval of intervals) {
        if (cursor >= end) {
          break;
        }
        const openStart = interval.start > cursor ? interval.start : cursor;
        const openEnd = interval.end < end ? interval.end : end;
        if (openStart < openEnd) {
          total += openEnd.toMillis() - openStart.toMillis();
          cursor = DateTime.fromMillis(openEnd.toMillis(), { zone: "utc" });
          progressed = true;
        }
      }

      if (!progressed) {
        const local = cursor.setZone(this.schedule.timeZone);
        cursor = DateTime.fromMillis(local.startOf("day").plus({ days: 1 }).toUTC().toMillis(), {
          zone: "utc",
        });
      }
    }

    return total;
  }

  private openIntervalsOnAndAfter(cursorUtc: DateTime): Array<{ start: DateTime; end: DateTime }> {
    const results: Array<{ start: DateTime; end: DateTime }> = [];
    let day = cursorUtc.setZone(this.schedule.timeZone).startOf("day");

    for (let d = 0; d < 400; d += 1) {
      const dayIntervals = this.openIntervalsForLocalDay(day);
      for (const interval of dayIntervals) {
        if (interval.end > cursorUtc) {
          results.push(interval);
        }
      }
      if (results.length > 0) {
        return results;
      }
      day = day.plus({ days: 1 });
    }

    return results;
  }

  private openIntervalsTouching(instantUtc: DateTime): Array<{ start: DateTime; end: DateTime }> {
    const local = instantUtc.setZone(this.schedule.timeZone);
    const dayStart = local.startOf("day");
    // Overnight windows from previous day may cover this instant.
    const previous = this.openIntervalsForLocalDay(dayStart.minus({ days: 1 }));
    const current = this.openIntervalsForLocalDay(dayStart);
    return [...previous, ...current];
  }

  private openIntervalsForLocalDay(
    localDayStart: DateTime,
  ): Array<{ start: DateTime; end: DateTime }> {
    const dateKey = localDayStart.toFormat("yyyy-MM-dd");
    if (this.schedule.holidays.includes(dateKey)) {
      return [];
    }

    const weekday = WEEKDAY_KEYS[localDayStart.weekday - 1] as WeekdayKey;
    const windows = this.schedule.weeklyHours[weekday] ?? [];
    const intervals: Array<{ start: DateTime; end: DateTime }> = [];

    for (const window of windows) {
      const start = this.localTimeOnDay(localDayStart, window.start);
      let end = this.localTimeOnDay(localDayStart, window.end);
      if (end <= start) {
        // Overnight: ends next local day.
        end = end.plus({ days: 1 });
      }
      if (end > start) {
        intervals.push({ end: end.toUTC(), start: start.toUTC() });
      }
    }

    return intervals.sort((a, b) => a.start.toMillis() - b.start.toMillis());
  }

  private localTimeOnDay(localDayStart: DateTime, hhmm: string): DateTime {
    const [hourText, minuteText] = hhmm.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (
      !Number.isInteger(hour) ||
      !Number.isInteger(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new Error(`Invalid HH:mm time: ${hhmm}`);
    }
    return localDayStart.set({ hour, millisecond: 0, minute, second: 0 });
  }
}

export function parseWeeklyHours(value: unknown): BusinessScheduleDefinition["weeklyHours"] {
  if (!value || typeof value !== "object") {
    throw new Error("weeklyHours must be an object");
  }
  const input = value as Record<string, unknown>;
  const result = {
    fri: [] as TimeWindow[],
    mon: [] as TimeWindow[],
    sat: [] as TimeWindow[],
    sun: [] as TimeWindow[],
    thu: [] as TimeWindow[],
    tue: [] as TimeWindow[],
    wed: [] as TimeWindow[],
  };

  for (const key of WEEKDAY_KEYS) {
    const day = input[key];
    if (day === undefined) {
      continue;
    }
    if (!Array.isArray(day)) {
      throw new Error(`weeklyHours.${key} must be an array`);
    }
    result[key] = day.map((entry) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(`Invalid window in weeklyHours.${key}`);
      }
      const window = entry as Record<string, unknown>;
      if (typeof window.start !== "string" || typeof window.end !== "string") {
        throw new Error(`Window in weeklyHours.${key} requires start/end strings`);
      }
      return { end: window.end, start: window.start };
    });
  }

  return result;
}

export function parseHolidays(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("holidays must be an array of YYYY-MM-DD strings");
  }
  return value.map((entry) => {
    if (typeof entry !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry)) {
      throw new Error(`Invalid holiday date: ${String(entry)}`);
    }
    return entry;
  });
}

/** Convert business minutes to milliseconds. */
export function businessMinutesToMs(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new Error("minutes must be a non-negative finite number");
  }
  return Math.round(minutes * MS_PER_MINUTE);
}
