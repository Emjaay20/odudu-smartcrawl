const MINUTE_MS = 60_000;

// A date-time field picks a minute, and the API takes an instant in UTC.
// A lower bound is the minute's first millisecond and an upper one its last,
// since both ends of a range are inclusive.
export function edgeOfMinute(iso: string, edge: 'start' | 'end'): string {
  const start = Math.floor(Date.parse(iso) / MINUTE_MS) * MINUTE_MS;
  return new Date(edge === 'start' ? start : start + MINUTE_MS - 1).toISOString();
}
