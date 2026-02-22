'use client';

import { Info } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import useRefetch from "~/hooks/use-refetch";
import { api } from "~/trpc/react";
import { useState, useEffect } from "react";

type FormInput = {
  repoUrl: string;
  projectName: string;
  githubToken?: string;
};

const loadingSteps = [
  "Your repository is getting analyzed",
  "AI is summarizing each of your files", 
  "Each file is getting converted to vector embeddings",
  "Your project is getting converted"
];

export default function CreatePage() {
  const { register, handleSubmit, reset } = useForm<FormInput>();
  const checkCredits = api.project.checkCredits.useMutation();
  const createProject = api.project.createProject.useMutation();
  const refetch = useRefetch();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCreating) {
      interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % loadingSteps.length);
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCreating]);

  function onSubmit(data: FormInput) {
    if(!!checkCredits.data){
      setIsCreating(true);
      createProject.mutate({
      name: data.projectName,
      repoUrl: data.repoUrl,
      githubToken: data.githubToken,
    }, {  
      onSuccess:() => {
        setIsCreating(false);
        toast.success('Project created successfully!');
        refetch();
        reset();
      },
      onError: (error:any) => {
        setIsCreating(false);
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

  const hasEnoughCredits = checkCredits.data?.userCredits ? checkCredits.data?.fileCount <= checkCredits.data?.userCredits : true;

  return (
    <div className="flex items-center justify-center h-full gap-4">
      <AnimatePresence mode="wait">
        {isCreating ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center space-y-6"
          >
            <div className="relative">
              <motion.div
                className="w-20 h-20 border-4 border-blue-200 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <motion.div
                className="absolute top-0 left-0 w-20 h-20 border-4 border-blue-500 rounded-full border-t-transparent"
                animate={{ rotate: 360 }}
                transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
              />
            </div>
            
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Creating Your Project</h2>
              <p className="text-gray-600">{loadingSteps[currentStep]}</p>
            </motion.div>

            <div className="flex space-x-2">
              {loadingSteps.map((_, index) => (
                <motion.div
                  key={index}
                  className={`w-2 h-2 rounded-full ${
                    index === currentStep ? 'bg-blue-500' : 'bg-gray-300'
                  }`}
                  animate={{
                    scale: index === currentStep ? 1.2 : 1,
                  }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex items-center justify-center gap-4"
          >
            <img src="/undraw_github.svg" className="h-52 w-auto" />
            <div>
              <div>
                <h1 className="text-2xl font-semibold mb-4">Link your GitHub Repository</h1>
                <p className="">Enter the URL of your GitHub repository to link to <span className="font-semibold">Reposense</span>.</p>
              </div>
              <div className="h-4"></div>
              <div>
                <form onSubmit={handleSubmit(onSubmit)}>
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
                    placeholder=" GitHub Token "
                  />
                  <p className="text-sm text-gray-500 mb-2">
                    Need a token? <a
                      href="https://github.com/settings/personal-access-tokens/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Create a GitHub personal access token
                    </a>
                  </p>
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
                  > 
                    {!!checkCredits.data ? 'Create Project': 'Check Credits'}
                  </Button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}