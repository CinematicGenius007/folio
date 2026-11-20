import { useCallback, useEffect, useRef, useState } from 'react';

/** Reverses the change a toast reports (restore deleted bookmarks, move bookmarks back). */
export type Undo = () => Promise<void>;

export interface ToastState {
  message: string;
  /** What the toast's Undo button (and `Z`, `⌘Z`) does. No undo, no button. */
  undo?: Undo;
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

  const say = useCallback((message: string, undo?: Undo) => {
    clearTimeout(timer.current);
    setToast({ message, undo });
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, say, dismiss };
}
