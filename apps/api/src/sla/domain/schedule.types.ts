export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface TimeWindow {
  /** Local wall-clock HH:mm (24h). */
  start: string;
  /** Local wall-clock HH:mm (24h). End may be earlier than start for overnight windows. */
  end: string;
}

export type WeeklyHours = Record<WeekdayKey, TimeWindow[]>;

export interface BusinessScheduleDefinition {
  timeZone: string;
  weeklyHours: WeeklyHours;
  /** Full-day closures as YYYY-MM-DD in the schedule time zone. */
  holidays: string[];
}

export const WEEKDAY_KEYS: readonly WeekdayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
] as const;

export function emptyWeeklyHours(): WeeklyHours {
  return {
    fri: [],
    mon: [],
    sat: [],
    sun: [],
    thu: [],
    tue: [],
    wed: [],
  };
}

export function standardWeekdayNineToFive(): WeeklyHours {
  const window: TimeWindow[] = [{ end: "17:00", start: "09:00" }];
  return {
    fri: window,
    mon: window,
    sat: [],
    sun: [],
    thu: window,
    tue: window,
    wed: window,
  };
}
