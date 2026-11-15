import { useEffect } from 'react';
import { Button, Kbd } from '@/components/ui';
import { openFolio } from './openFolio';

/** Shown for pages Folio cannot save (new tab, browser pages, files). The library is still one key away. */
export function UnsavablePanel() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close();
      else if (e.key === '0') void openFolio();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 px-4 pb-4">
      <span className="text-[13px] text-muted">Folio can save http and https pages.</span>
      <Button onClick={() => void openFolio()}>
        Open in Folio <Kbd>0</Kbd>
      </Button>
    </div>
  );
}
