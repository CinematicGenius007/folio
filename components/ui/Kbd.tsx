import { Fragment, type ReactNode } from 'react';
import {
  KeyBackspace,
  KeyCommand,
  KeyDown,
  KeyLeft,
  KeyReturn,
  KeyRight,
  KeyShift,
  KeyUp,
} from '@/components/ui/icons';

/** Keyboard symbols that are drawn as icons, because font glyphs for them render small and uneven. */
const GLYPHS: Record<string, () => ReactNode> = {
  '⌫': () => <KeyBackspace />,
  '↵': () => <KeyReturn />,
  '⌘': () => <KeyCommand />,
  '⇧': () => <KeyShift />,
  '↑': () => <KeyUp />,
  '↓': () => <KeyDown />,
  '→': () => <KeyRight />,
  '←': () => <KeyLeft />,
};

/** Text where keyboard symbols (⌫ ↵ ⌘ ⇧ and arrows) are replaced by drawn icons. */
export function Glyphs({ text }: { text: string }) {
  return <>{[...text].map((char, i) => (GLYPHS[char] ? <Fragment key={i}>{GLYPHS[char]!()}</Fragment> : char))}</>;
}

/** A keycap, e.g. `<Kbd>⌘</Kbd><Kbd>K</Kbd>`. */
export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{typeof children === 'string' ? <Glyphs text={children} /> : children}</span>;
}
