import { useCallback, useState } from 'react';

/** The set of ids picked for a bulk action (move, delete). */
export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);
  const add = useCallback((id: string) => setSelected((current) => new Set(current).add(id)), []);
  const only = useCallback((id: string) => setSelected(new Set([id])), []);
  const clear = useCallback(() => setSelected(new Set()), []);

  return { selected, toggle, add, only, clear };
}
