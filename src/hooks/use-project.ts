


import React from "react";

import { api } from "~/trpc/react";
import {useLocalStorage} from "usehooks-ts";

const useProject = () => {
   const {data:projects}= api.project.getProjects.useQuery();

   const [projectId, setProjectId] = useLocalStorage<string | null>('projectId', null);   

   const project=projects?.find((project) => project.id === projectId);
   return {
      projects ,
      project,
      projectId,
      setProjectId,
   }
};

export default useProject;