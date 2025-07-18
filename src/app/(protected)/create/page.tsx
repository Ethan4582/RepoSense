'use client';

import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import useRefetch from "~/hooks/use-refetch";
import { api } from "~/trpc/react";

type FormInput = {
  repoUrl: string;
  projectName: string;
githubToken?: string;
};

export default function CreatePage() {
  const { register, handleSubmit, reset } = useForm<FormInput>();

  const createProject = api.project.createProject.useMutation();
  const refetch = useRefetch()

  function onSubmit(data: FormInput) {
  
    createProject.mutate({
      name: data.projectName,
      repoUrl: data.repoUrl,
      githubToken: data.githubToken,
    }, {  
      onSuccess:() => {
        toast.success('Project created successfully!');
        refetch();
        reset();
      },
      onError: (error:any) => {
        toast.error(`Error creating project: ${error.message}`);
      },
    }); 
  }

  return (
    <div className="flex items-center justify-center h-full gap-4">
      <img src="/undraw_github.svg" className="h-52 w-auto" />
      <div>
        <div>
          <h1 className="text-2xl font-semibold mb-4">Link your GitHub Repository</h1>
          <p className="">Enter the URL of your GitHub repository to link to <span className="font-semibold">Reposense</span>.</p>
        </div>
        <div className="h-4"></div>
        <div>
          <form
            onSubmit={handleSubmit(onSubmit)}
          >
             <Input
              {...register('projectName', { required: true })}
              required
              className="mb-2"
              placeholder="Enter your Project Name"
            />
            <Input
              {...register('repoUrl', { required: true })}
              required
              className="mb-2"
              type="url"
              placeholder="Enter your GitHub Repository URL"
            />
            <Input
              {...register('githubToken')}
              className="mb-2"
              placeholder=" GitHub Token (optional)"
            />
            <div className="h-2"></div> 
            <Button
              type="submit"
              disabled={createProject.isPending}
              
            >
              Create Project 
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}