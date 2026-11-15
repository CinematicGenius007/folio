import { useState } from 'react';
import { Button, Dialog, Input, Kbd } from '@/components/ui';

/** Asks for a folder name; used for both creating and renaming. */
export function FolderNameDialog({
  title,
  initial = '',
  submit,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: string;
  submit: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [t, setT] = useState(initial);
  return (
    <Dialog title={title} onClose={onClose} width={360}>
      <form onSubmit={(e) => (e.preventDefault(), t.trim() && onSubmit(t.trim()))} className="flex flex-col gap-3">
        <Input value={t} onChange={(e) => setT(e.target.value)} placeholder="Name" aria-label="Folder name" />
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            {submit} <Kbd>↵</Kbd>
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
