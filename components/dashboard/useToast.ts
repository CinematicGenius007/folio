import { useCallback, useEffect, useRef, useState } from 'react';
import type { Tombstone } from '@/lib/core/types';

export interface ToastState {
  message: string;
  /** Deleted bookmarks that the toast's Undo button restores. */
  undo?: Tombstone[];
}

const TOAST_MS = 7000;

/** One toast at a time; showing a new one replaces the old, and it disappears after a few seconds. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const say = useCallback((message: string, undo?: Tombstone[]) => {
    clearTimeout(timer.current);
    setToast({ message, undo });
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, say, dismiss };
}
