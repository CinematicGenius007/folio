import { describe, expect, it } from 'vitest';
import { shortDate } from './format';

describe('shortDate', () => {
  const now = new Date(2026, 10, 15, 12).getTime();

  it('omits the year for dates in the current year', () => {
    expect(shortDate(new Date(2026, 3, 8, 12).getTime(), now)).toBe('Apr 8');
  });

  it('adds a two-digit year for earlier years', () => {
    expect(shortDate(new Date(2025, 9, 2, 12).getTime(), now)).toBe('Oct 2, 25');
  });
});
