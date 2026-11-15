/**
 * Coalesces bursts of bookmark events into single sync runs.
 *
 * - `schedule()` waits `delayMs` after the last call, so an import of 500 bookmarks causes one run.
 * - Runs never overlap; a request that arrives mid-run triggers exactly one more run afterwards.
 * - While an import is in progress (`setImporting(true)`) scheduling is suspended, and a final run
 *   is scheduled when it ends.
 */
export function createSyncScheduler(run: () => Promise<void>, delayMs = 120) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let rerun = false;
  let importing = false;

  /** Runs now, or queues one more run if one is in progress. While importing, the run is deferred until the import ends. */
  async function runNow(): Promise<void> {
    if (importing) return;
    if (running) {
      rerun = true;
      return;
    }
    running = true;
    try {
      do {
        rerun = false;
        await run();
      } while (rerun);
    } finally {
      running = false;
    }
  }

  return {
    runNow,

    schedule(): void {
      if (importing) return;
      clearTimeout(timer);
      timer = setTimeout(() => void runNow(), delayMs);
    },

    setImporting(value: boolean): void {
      importing = value;
      clearTimeout(timer); // a run already queued must not fire mid-import
      if (!value) this.schedule();
    },
  };
}
