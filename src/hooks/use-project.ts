'use client';

import * as React from 'react';
import { api } from '~/trpc/react';
import { useLocalStorage } from 'usehooks-ts';

const useProject = () => {
  const { data: projects, refetch: refetchProjects, isLoading } = api.project.getProjects.useQuery(
    undefined,
    {
      refetchInterval: 3000,
      refetchOnWindowFocus: true,
    }
  );
  const [projectId, setProjectId] = useLocalStorage<string | null>('projectId', null);

  // Match selected project, or default to the first available project
  const project = React.useMemo(() => {
    if (!projects || projects.length === 0) return undefined;
    const found = projects.find((p) => p.id === projectId);
    return found ?? projects[0];
  }, [projects, projectId]);

  // Keep stored projectId in sync with resolved project
  React.useEffect(() => {
    if (projects && projects.length === 0 && projectId !== null) {
      setProjectId(null);
    } else if (project && project.id !== projectId) {
      setProjectId(project.id);
    }
  }, [projects, project, projectId, setProjectId]);

  return {
    projects,
    project,
    projectId: project?.id ?? projectId,
    setProjectId,
    refetchProjects,
    isLoading,
  };
};

export default useProject;
