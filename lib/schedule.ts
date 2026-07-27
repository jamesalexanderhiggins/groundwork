/**
 * Task scheduling helpers.
 *
 * `tasks.recurrence_days` is an integer[] using the whitepaper's convention:
 * 1 = Sunday ... 7 = Saturday. JavaScript's Date.getDay() is 0 = Sunday,
 * so every comparison needs the +1. Getting this wrong shows Monday's
 * tasks on a Sunday, which is exactly what was happening — the column was
 * stored on every task and never read.
 */

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

/** Convert a JS Date to the 1–7 convention used in recurrence_days. */
export function toScheduleDay(date: Date = new Date()): number {
  return date.getDay() + 1;
}

/** Does this task run today? Tasks with no schedule run every day. */
export function runsToday(
  recurrenceDays: number[] | null | undefined,
  date: Date = new Date(),
): boolean {
  if (!recurrenceDays || recurrenceDays.length === 0) return true;
  return recurrenceDays.includes(toScheduleDay(date));
}

/** Human-readable summary, e.g. "Weekdays" or "Mon, Wed, Fri". */
export function describeSchedule(days: number[] | null | undefined): string {
  if (!days || days.length === 0 || days.length === 7) return 'Every day';

  const sorted = [...days].sort((a, b) => a - b);
  const isWeekdays = sorted.join() === '2,3,4,5,6';
  const isWeekends = sorted.join() === '1,7';
  if (isWeekdays) return 'Weekdays';
  if (isWeekends) return 'Weekends';

  return sorted.map(d => DAY_NAMES[d - 1].slice(0, 3)).join(', ');
}

/**
 * Start of the current week, Monday 00:00 local time.
 * Used for the weekly routine cap, which the whitepaper sets at 6 Higgs.
 */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // getDay(): 0 = Sun. Shift so Monday is day 0.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}
