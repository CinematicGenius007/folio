const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * Compact date for list rows: `Nov 14` this year, `Oct 2, 25` for earlier years.
 * Formatted by hand so every browser and test runtime prints the same thing.
 */
export function shortDate(timestamp: number, now = Date.now()): string {
  const date = new Date(timestamp);
  const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return date.getFullYear() === new Date(now).getFullYear()
    ? label
    : `${label}, ${String(date.getFullYear()).slice(-2)}`;
}
