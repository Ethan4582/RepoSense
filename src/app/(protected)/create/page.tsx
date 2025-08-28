'use client';

import { Info } from "lucide-react";
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
  const checkCredits = api.project.checkCredits.useMutation();
  const createProject = api.project.createProject.useMutation();
  const refetch = useRefetch()

  function onSubmit(data: FormInput) {

    if(!!checkCredits.data){
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
    })

    }else{
       checkCredits.mutate({
         githubUrl: data.repoUrl,
         githubToken: data.githubToken
       })
    }
  
    
  }


  //check if they have enough credit 

  const hasEnoughCredits = checkCredits.data?.userCredits ? checkCredits.data?.fileCount <= checkCredits.data?.userCredits : true;

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
            <div className="h-1"></div> 

             {checkCredits.data && (
               <>
                <div className=" mt-1 bg-orange-50 px-4 py-2 rounded-md border border-orange-200 text-orange-700">
                  <div className="flex item-center gap-2">
                    <Info className="size-4" />
                    <p className="text-sm">You will be charged <strong>
                      {checkCredits.data.fileCount} credits for this repository</strong></p>
                  </div>
                  <p className="text-sm text-blue-600 ml-6">
                    You have {checkCredits.data.userCredits} credits remaining.
                  </p>
                </div>
               </>
             ) }
             <div className="h-2"></div>
            <Button
              type="submit"
              disabled={createProject.isPending || checkCredits.isPending}
             
            > {!!checkCredits.data ? 'Create Project': 'Check Credits'}
              Create Project 
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}



