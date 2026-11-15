import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSyncScheduler } from './scheduler';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createSyncScheduler', () => {
  it('runs once for a burst of events', async () => {
    const run = vi.fn(async () => {});
    const scheduler = createSyncScheduler(run, 100);
    for (let i = 0; i < 50; i++) scheduler.schedule();
    await vi.advanceTimersByTimeAsync(99);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('restarts the wait on every event', async () => {
    const run = vi.fn(async () => {});
    const scheduler = createSyncScheduler(run, 100);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(80);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(80);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(20);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('never overlaps runs, and queues exactly one more when asked mid-run', async () => {
    let active = 0;
    let peak = 0;
    let release: () => void = () => {};
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          active++;
          peak = Math.max(peak, active);
          release = () => (active--, resolve());
        }),
    );
    const scheduler = createSyncScheduler(run);

    const first = scheduler.runNow();
    void scheduler.runNow();
    void scheduler.runNow();
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await first;

    expect(run).toHaveBeenCalledTimes(2);
    expect(peak).toBe(1);
  });

  it('keeps going after a failed run', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    const scheduler = createSyncScheduler(run);
    await expect(scheduler.runNow()).rejects.toThrow('boom');
    await scheduler.runNow();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('ignores events during an import and runs once when it ends', async () => {
    const run = vi.fn(async () => {});
    const scheduler = createSyncScheduler(run, 100);
    scheduler.setImporting(true);
    for (let i = 0; i < 20; i++) scheduler.schedule();
    await vi.advanceTimersByTimeAsync(500);
    expect(run).not.toHaveBeenCalled();
    scheduler.setImporting(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('cancels a run that was already queued when an import starts', async () => {
    const run = vi.fn(async () => {});
    const scheduler = createSyncScheduler(run, 100);
    scheduler.schedule();
    await vi.advanceTimersByTimeAsync(50);
    scheduler.setImporting(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(run).not.toHaveBeenCalled();
    await scheduler.runNow(); // an explicit run during an import is deferred too
    expect(run).not.toHaveBeenCalled();
    scheduler.setImporting(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
