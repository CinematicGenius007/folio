import type { ReactNode } from 'react';
import { Kbd } from '@/components/ui';

const Hint = ({ children, label }: { children: ReactNode; label: string }) => (
  <span className="inline-flex items-center gap-1">
    {children} {label}
  </span>
);

/** The quiet line of shortcuts under the list. It switches to selection actions while rows are selected. */
export function KeyHints({ selectedCount, compact }: { selectedCount: number; compact: boolean }) {
  return (
    <footer className="relative z-10 flex h-10 shrink-0 items-center justify-center gap-4 overflow-hidden whitespace-nowrap text-[12px] text-muted">
      {selectedCount > 0 ? (
        <>
          <span className="font-medium text-ink">{selectedCount} selected</span>
          <Hint label="move">
            <Kbd>M</Kbd>
          </Hint>
          <Hint label="delete">
            <Kbd>⌫</Kbd>
          </Hint>
          <Hint label="clear">
            <Kbd>Esc</Kbd>
          </Hint>
        </>
      ) : (
        <>
          <Hint label="move">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd>
          </Hint>
          <Hint label="open">
            <Kbd>↵</Kbd>
          </Hint>
          {!compact && (
            <>
              <Hint label="edit">
                <Kbd>E</Kbd>
              </Hint>
              <Hint label="move to">
                <Kbd>M</Kbd>
              </Hint>
              <Hint label="folders">
                <Kbd>C</Kbd>
              </Hint>
              <Hint label="menu">
                <Kbd>O</Kbd>
              </Hint>
            </>
          )}
          <Hint label={compact ? 'keys' : 'all keys'}>
            <Kbd>?</Kbd>
          </Hint>
        </>
      )}
    </footer>
  );
}
