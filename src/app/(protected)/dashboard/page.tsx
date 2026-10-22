'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import useProject from '~/hooks/use-project';

export default function DashboardPage() {
  const router = useRouter();
  const { project, isLoading } = useProject();

  React.useEffect(() => {
    if (isLoading) return;
    router.replace(project ? `/wiki/${project.id}` : '/create');
  }, [isLoading, project, router]);

  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="size-2 animate-pulse rounded-full bg-primary" />
        <span>Opening workspace...</span>
      </div>
    </div>
  );
}
