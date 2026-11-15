import type { SVGProps } from 'react';

const base = {
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;
type P = SVGProps<SVGSVGElement>;

export const Check = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 8.5l3.2 3L13 4.5" />
  </svg>
);
export const Plus = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 3v10M3 8h10" />
  </svg>
);
export const Trash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" />
  </svg>
);
export const Unfold = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5.5 6.5L8 4l2.5 2.5M5.5 9.5L8 12l2.5-2.5" />
  </svg>
);
export const ChevronRight = (p: P) => (
  <svg {...base} {...p}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </svg>
);
export const Gear = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2.5 5h6.5M12 5h1.5M2.5 11H4M7 11h6.5" />
    <circle cx="10.5" cy="5" r="1.5" />
    <circle cx="5.5" cy="11" r="1.5" />
  </svg>
);
export const Palette = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 2a6 6 0 100 12c1 0 1.4-.7 1.1-1.5-.3-.8.1-1.5 1-1.5H12a2 2 0 002-2A6 6 0 008 2z" />
    <circle cx="5.2" cy="7" r=".6" fill="currentColor" />
    <circle cx="8" cy="5" r=".6" fill="currentColor" />
    <circle cx="10.8" cy="7" r=".6" fill="currentColor" />
  </svg>
);
export const Keyboard = (p: P) => (
  <svg {...base} {...p}>
    <rect x="1.8" y="4" width="12.4" height="8" rx="1.8" />
    <path d="M4.5 6.8h.01M7 6.8h.01M9.5 6.8h.01M11.8 6.8h.01M5 9.4h6" />
  </svg>
);
export const Download = (p: P) => (
  <svg {...base} {...p}>
    <path d="M8 2.5v7M5 7l3 3 3-3M3 12.5h10" />
  </svg>
);
export const Copy = (p: P) => (
  <svg {...base} {...p}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.8" />
    <path d="M10.5 5.5V4A1.5 1.5 0 009 2.5H4A1.5 1.5 0 002.5 4v5A1.5 1.5 0 004 10.5h1.5" />
  </svg>
);
export const Pencil = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9.5 3.5l3 3M2.8 13.2l.7-3L10.8 3a1.4 1.4 0 012 2L5.5 12.3l-2.7.9z" />
  </svg>
);
export const Refresh = (p: P) => (
  <svg {...base} {...p}>
    <path d="M13 7a5 5 0 00-9-2.2M3 2.5v2.6h2.6M3 9a5 5 0 009 2.2M13 13.5v-2.6h-2.6" />
  </svg>
);
export const MoveTo = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.5 4l4 4-4 4M8.5 4l4 4-4 4" />
  </svg>
);
export const SelectMany = (p: P) => (
  <svg {...base} {...p}>
    <rect x="2.5" y="2.5" width="8" height="8" rx="1.8" />
    <path d="M5.5 13.5h6a2 2 0 002-2v-6M5 6.5l1.5 1.5L9 5.5" />
  </svg>
);
export const FolderIcon = (p: P) => (
  <svg {...base} {...p}>
    <path d="M2 4.8A1.3 1.3 0 013.3 3.5h2.6l1.4 1.6h5.4A1.3 1.3 0 0114 6.4v5.3a1.3 1.3 0 01-1.3 1.3H3.3A1.3 1.3 0 012 11.7V4.8z" />
  </svg>
);

// Keyboard glyphs, drawn so they stay crisp and aligned instead of depending on a font's ⌫ ↵ ⌘ characters.
const key = { ...base, width: 12, height: 12, strokeWidth: 1.6 } as const;
export const KeyBackspace = (p: P) => (
  <svg {...key} {...p}>
    <path d="M6 3.5h6.5a1 1 0 011 1v7a1 1 0 01-1 1H6L2.5 8 6 3.5z" />
    <path d="M8.3 6.3l3 3.4M11.3 6.3l-3 3.4" />
  </svg>
);
export const KeyReturn = (p: P) => (
  <svg {...key} {...p}>
    <path d="M12.5 3.5v4a1 1 0 01-1 1H3.8M6.3 5.6L3.8 8.5l2.5 2.9" />
  </svg>
);
export const KeyCommand = (p: P) => (
  <svg {...key} {...p}>
    <path d="M6 6V4.6A1.6 1.6 0 104.4 6H6zm0 0h4m-4 0v4m4-4V4.6A1.6 1.6 0 1111.6 6H10zm0 0v4m0 0v1.4a1.6 1.6 0 101.6-1.4H10zm0 0H6m0 0v1.4A1.6 1.6 0 114.4 10H6z" />
  </svg>
);
export const KeyShift = (p: P) => (
  <svg {...key} {...p}>
    <path d="M8 3L3.2 8.2h2.6V12.5h4.4V8.2h2.6L8 3z" />
  </svg>
);
export const KeyUp = (p: P) => (
  <svg {...key} {...p}>
    <path d="M8 12.5v-9M4.5 7L8 3.5 11.5 7" />
  </svg>
);
export const KeyDown = (p: P) => (
  <svg {...key} {...p}>
    <path d="M8 3.5v9M4.5 9L8 12.5 11.5 9" />
  </svg>
);
export const KeyRight = (p: P) => (
  <svg {...key} {...p}>
    <path d="M3.5 8h9M9 4.5L12.5 8 9 11.5" />
  </svg>
);
export const KeyLeft = (p: P) => (
  <svg {...key} {...p}>
    <path d="M12.5 8h-9M7 4.5L3.5 8 7 11.5" />
  </svg>
);
