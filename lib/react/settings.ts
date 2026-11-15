import { useLiveQuery } from 'dexie-react-hooks';
import { getSetting, setSetting } from '@/lib/core/db';
import { useObjectUrl } from './objectUrl';

/** A persisted setting that re-renders every open Folio page when it changes. */
export function useSetting<T>(key: string, fallback: T) {
  const value = useLiveQuery(() => getSetting<T>(key, fallback), [key], fallback);
  return [value, (next: T) => setSetting(key, next)] as const;
}

export interface Background {
  style: 'none' | 'marble' | 'meadow' | 'edges' | 'glow' | 'horizon' | 'waves' | 'image';
  intensity: 'soft' | 'medium' | 'strong';
  /** Object URL for the chosen image, when `style` is `image`. */
  imageUrl?: string;
}

/** The dashboard background. A custom image is stored as a Blob in IndexedDB and exposed as an object URL. */
export function useBackground(): Background {
  const [style] = useSetting<Background['style']>('bgStyle', 'marble');
  const [intensity] = useSetting<Background['intensity']>('bgIntensity', 'soft');
  const blob = useLiveQuery(() => getSetting<Blob | null>('bgImage', null), [], null);
  const imageUrl = useObjectUrl(blob);
  return { style, intensity, imageUrl };
}
