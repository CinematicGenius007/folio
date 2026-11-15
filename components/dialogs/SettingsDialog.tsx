import { useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { MAX_BACKUP_BYTES, exportBackup, importBackup } from '@/lib/actions';
import { db, setSetting } from '@/lib/core/db';
import type { Background, ThemePref } from '@/lib/react';
import { Button, Dialog, Kbd } from '@/components/ui';

/** Theme, background and backup of tags and notes. */
export function SettingsDialog({
  themePref,
  setThemePref,
  background,
  onClose,
  say,
}: {
  themePref: ThemePref;
  setThemePref: (t: ThemePref) => void;
  background: Background;
  onClose: () => void;
  say: (m: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const bookmarkCount = useLiveQuery(() => db.bookmarks.count(), [], 0);
  const doExport = async () => {
    const text = await exportBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = `folio-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    say('Backup downloaded');
  };
  return (
    <Dialog title="Settings" onClose={onClose}>
      <div className="flex flex-col gap-4 text-[13px]">
        <div>
          <div className="mb-1 font-medium">Theme</div>
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as const).map((t) => (
              <Button key={t} variant={themePref === t ? 'primary' : 'secondary'} onClick={() => setThemePref(t)}>
                {t === 'dark' ? 'Dusk' : t === 'light' ? 'Overcast' : 'System'}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 font-medium">Background</div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['none', 'None'],
                ['marble', 'Marble'],
                ['meadow', 'Meadow'],
                ['edges', 'Edges'],
                ['glow', 'Glow'],
                ['horizon', 'Horizon'],
                ['waves', 'Waves'],
                ['image', 'Image'],
              ] as const
            ).map(([id, label]) => (
              <Button
                key={id}
                variant={background.style === id ? 'primary' : 'secondary'}
                onClick={() =>
                  id === 'image' && !background.imageUrl ? imgRef.current?.click() : void setSetting('bgStyle', id)
                }
              >
                {label}
              </Button>
            ))}
          </div>
          {background.style !== 'none' && background.style !== 'image' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-muted">Grain</span>
              {(['soft', 'medium', 'strong'] as const).map((i) => (
                <Button
                  key={i}
                  variant={background.intensity === i ? 'primary' : 'secondary'}
                  onClick={() => void setSetting('bgIntensity', i)}
                >
                  {i[0]!.toUpperCase() + i.slice(1)}
                </Button>
              ))}
            </div>
          )}
          {background.style === 'image' && (
            <div className="mt-2 flex items-center gap-2">
              <Button onClick={() => imgRef.current?.click()}>Choose another image</Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  await setSetting('bgImage', null);
                  await setSetting('bgStyle', 'marble');
                }}
              >
                Remove
              </Button>
            </div>
          )}
          <input
            ref={imgRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 8 * 1024 * 1024) return say('Pick an image under 8 MB');
              await setSetting('bgImage', f);
              await setSetting('bgStyle', 'image');
            }}
          />
          <p className="m-0 mt-2 text-muted">
            Stays on this device. Your image is dimmed so text stays readable in both themes.
          </p>
        </div>
        <div>
          <div className="mb-1 font-medium">Tags and notes backup</div>
          <p className="m-0 mb-2 text-muted">
            Bookmarks live in your browser. Tags and notes live only in Folio, so keep a backup. {bookmarkCount}{' '}
            bookmarks indexed.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => void doExport()}>Export JSON</Button>
            <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = ''; // lets the same file be chosen again
                if (!f) return;
                if (f.size > MAX_BACKUP_BYTES) return say('That file is too large to be a Folio backup');
                try {
                  say(`Restored tags and notes on ${await importBackup(await f.text())} bookmarks`);
                } catch {
                  say('That file is not a Folio backup');
                }
              }}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>
            Done <Kbd>Esc</Kbd>
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
