import { useEffect, useState } from 'react';

/**
 * An object URL for a Blob, revoked when the Blob changes or the component unmounts.
 * Returns undefined while there is no Blob.
 */
export function useObjectUrl(blob: Blob | null | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  /* The URL is a browser resource whose lifetime follows the Blob, so syncing it from an effect is intended. */
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  /* eslint-enable react-hooks/set-state-in-effect */
  return url;
}
