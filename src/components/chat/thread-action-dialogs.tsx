'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '~/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { FolderPlus, Pencil, Trash2 } from 'lucide-react';
import { api } from '~/trpc/react';
import { toast } from 'sonner';

interface RenameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  initialTitle: string;
  onSuccess?: () => void;
  onRenamed?: () => void;
}

export function RenameThreadDialog({
  open,
  onOpenChange,
  threadId,
  initialTitle,
  onSuccess,
  onRenamed,
}: RenameModalProps) {
  const [title, setTitle] = React.useState(initialTitle);

  React.useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle, open]);

  const renameMutation = api.project.renameQuestion.useMutation({
    onSuccess: () => {
      toast.success('Thread renamed');
      onOpenChange(false);
      onSuccess?.();
      onRenamed?.();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to rename thread');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Thread title cannot be empty');
      return;
    }
    renameMutation.mutate({
      questionId: threadId,
      question: title.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Pencil className="size-4 text-primary" />
            Rename Thread
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Enter a new name for this conversation thread.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="thread-title" className="text-xs font-medium">
              Title
            </Label>
            <Input
              id="thread-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Codebase architecture inquiry"
              className="h-9 text-xs"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={renameMutation.isPending || !title.trim()}
            >
              {renameMutation.isPending ? 'Saving...' : 'Save Changes'}\
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface FolderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  currentFolder?: string;
  existingFolders: string[];
  onAssign?: (threadId: string, folder: string) => void;
  onFolderAssigned?: (folder: string) => void;
}

export function FolderThreadDialog({
  open,
  onOpenChange,
  threadId,
  currentFolder = '',
  existingFolders,
  onAssign,
  onFolderAssigned,
}: FolderModalProps) {
  const [folderName, setFolderName] = React.useState(currentFolder);

  React.useEffect(() => {
    setFolderName(currentFolder);
  }, [currentFolder, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();
    if (onAssign) {
      onAssign(threadId, trimmed);
    }
    if (onFolderAssigned) {
      onFolderAssigned(trimmed);
    }
    toast.success(
      trimmed
        ? `Thread moved to "${trimmed}"`
        : 'Thread removed from folder'
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="size-4 text-primary" />
            Organize into Folder
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Group this conversation into a custom folder for faster access.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="folder-name" className="text-xs font-medium">
              Folder Name
            </Label>
            <Input
              id="folder-name"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Features, Bugfix, Architecture"
              className="h-9 text-xs"
              autoFocus
            />
          </div>

          {existingFolders.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Existing Folders:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {existingFolders.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFolderName(f)}
                    className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                      folderName === f
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/50 hover:bg-muted text-foreground'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save Folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  threadTitle?: string;
}

export function DeleteThreadDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  threadTitle,
}: DeleteModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base text-destructive">
            <Trash2 className="size-4" />
            Delete Thread {threadTitle ? `"${threadTitle}"` : ''}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Are you sure you want to delete this thread? This will permanently remove its conversation history and cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs"
          >
            {isPending ? 'Deleting...' : 'Delete Thread'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
