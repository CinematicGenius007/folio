import { type ReactNode, useEffect, useRef } from 'react';

/**
 * A modal dialog. Focus moves into it on open and returns to the previous element on close;
 * `Esc` or a click on the backdrop closes it.
 */
export function Dialog({
  title,
  onClose,
  children,
  width = 440,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('input,textarea,button')?.focus();
    return () => previous?.focus?.();
  }, []);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/30 pt-[12vh]"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
        className="max-w-[94vw] rounded-2xl bg-ground p-5"
        style={{ width, boxShadow: 'var(--shadow)' }}
      >
        <h2 className="m-0 mb-3 text-[15px] font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}
