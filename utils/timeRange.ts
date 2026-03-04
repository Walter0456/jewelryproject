export type TimeRange = 'Today' | 'Week' | 'Month' | 'Year' | 'All';

export const TIME_RANGE_OPTIONS: TimeRange[] = ['Today', 'Week', 'Month', 'Year', 'All'];

export const getRangeStart = (range: TimeRange, now: Date = new Date()): Date => {
  const start = new Date(now);
  if (range === 'Today') {
    start.setHours(0, 0, 0, 0);
  } else if (range === 'Week') {
    start.setDate(now.getDate() - 7);
  } else if (range === 'Month') {
    start.setMonth(now.getMonth() - 1);
  } else if (range === 'Year') {
    start.setFullYear(now.getFullYear() - 1);
  }
  return start;
};

export const isWithinRange = (value: Date | string, range: TimeRange, now: Date = new Date()): boolean => {
  if (range === 'All') return true;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  const start = getRangeStart(range, now);
  return date >= start && date <= now;
};
