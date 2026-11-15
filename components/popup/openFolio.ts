import { openDashboard } from '@/lib/actions';

/** Opens the full-page dashboard in a new tab and closes the popup. Bound to `0` in every popup panel. */
export async function openFolio(): Promise<void> {
  await openDashboard();
  window.close();
}
