import { useState } from 'react';
import { parseTags, setMeta, updateBookmark } from '@/lib/actions';
import { isSafeUrl } from '@/lib/util/url';
import type { Bm } from '@/lib/core/types';
import { useRankedTags } from '@/lib/react';
import { Button, Dialog, Input, Kbd, TagInput } from '@/components/ui';

/**
 * Edits a bookmark's title and URL (written to the browser) and its tags and note (stored by Folio).
 * The tags field completes existing tags inline (`Tab` accepts).
 */
export function EditDialog({ b, tags, note, onClose }: { b: Bm; tags: string[]; note: string; onClose: () => void }) {
  const [title, setTitle] = useState(b.title);
  const [url, setUrl] = useState(b.url);
  const [tagText, setTagText] = useState(tags.map((t) => `#${t}`).join(' '));
  const [noteText, setNoteText] = useState(note);
  const [error, setError] = useState('');
  const rankedTags = useRankedTags(b.url);
  const save = async () => {
    const cleanUrl = url.trim();
    // Only send what changed, so a bookmarklet's title can be edited without touching its (kept) URL.
    const patch = { ...(title !== b.title && { title }), ...(cleanUrl !== b.url && { url: cleanUrl }) };
    if (patch.url !== undefined && !isSafeUrl(patch.url))
      return setError('Only http, https and ftp links can be saved.');
    if (Object.keys(patch).length) await updateBookmark(b.id, patch);
    await setMeta(b.id, { tags: parseTags(tagText).tags, note: noteText });
    onClose();
  };
  return (
    <Dialog title="Edit bookmark" onClose={onClose}>
      <form onSubmit={(e) => (e.preventDefault(), void save())} className="flex flex-col gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
        <Input
          value={url}
          onChange={(e) => (setUrl(e.target.value), setError(''))}
          aria-label="URL"
          aria-invalid={!!error}
        />
        {error && (
          <p role="alert" className="m-0 text-[12px] text-danger">
            {error}
          </p>
        )}
        <TagInput value={tagText} onValueChange={setTagText} tags={rankedTags} placeholder="#tags" aria-label="Tags" />
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Note"
          rows={3}
          aria-label="Note"
          className="rounded-[10px] border border-control bg-transparent p-3 text-[14px] text-ink placeholder:text-muted"
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel <Kbd>Esc</Kbd>
          </Button>
          <Button type="submit" variant="primary">
            Save <Kbd>↵</Kbd>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
