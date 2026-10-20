'use client';

import * as React from 'react';

const STORAGE_PREFIX = 'reposense_thread_folders_';

export function useThreadFolders(projectId?: string | null) {
  const [folders, setFolders] = React.useState<Record<string, string>>({});
  const storageKey = projectId ? `${STORAGE_PREFIX}${projectId}` : null;

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setFolders(JSON.parse(stored) as Record<string, string>);
      } else {
        setFolders({});
      }
    } catch {
      setFolders({});
    }
  }, [storageKey]);

  const saveFolders = React.useCallback(
    (newMap: Record<string, string>) => {
      setFolders(newMap);
      if (storageKey) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(newMap));
        } catch (e) {
          console.error('Failed to save thread folders:', e);
        }
      }
    },
    [storageKey]
  );

  const assignFolder = React.useCallback(
    (threadId: string, folderName: string) => {
      const trimmed = folderName.trim();
      const updated = { ...folders };
      if (!trimmed || trimmed.toLowerCase() === 'ungrouped') {
        delete updated[threadId];
      } else {
        updated[threadId] = trimmed;
      }
      saveFolders(updated);
    },
    [folders, saveFolders]
  );

  const removeFolder = React.useCallback(
    (threadId: string) => {
      const updated = { ...folders };
      delete updated[threadId];
      saveFolders(updated);
    },
    [folders, saveFolders]
  );

  const renameFolder = React.useCallback(
    (oldName: string, newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return;
      const updated = { ...folders };
      Object.entries(updated).forEach(([tId, fName]) => {
        if (fName === oldName) {
          updated[tId] = trimmed;
        }
      });
      saveFolders(updated);
    },
    [folders, saveFolders]
  );

  const existingFolders = React.useMemo(() => {
    const set = new Set<string>();
    Object.values(folders).forEach((f) => {
      if (f && f.trim()) set.add(f.trim());
    });
    return Array.from(set).sort();
  }, [folders]);

  return {
    folders,
    assignFolder,
    removeFolder,
    renameFolder,
    existingFolders,
  };
}
