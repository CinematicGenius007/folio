import { Button } from './Button';
import { Kbd } from './Kbd';

/** A transient message at the bottom of the page, optionally with an undo action. */
export function Toast({ message, action, onAction }: { message: string; action?: string; onAction?: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-ground py-2 pl-4 pr-2 text-[13px]"
      style={{ boxShadow: 'var(--shadow)' }}
    >
      <span>{message}</span>
      {action && (
        <Button variant="secondary" onClick={onAction}>
          {action} <Kbd>Z</Kbd>
        </Button>
      )}
    </div>
  );
}
