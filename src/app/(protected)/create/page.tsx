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





// 'use client';

// import { useForm } from "react-hook-form";
// import { toast } from "sonner";
// import { Button } from "~/components/ui/button";
// import { Input } from "~/components/ui/input";
// import { StatusBar } from "~/components/ui/statusbar";
// import useRefetch from "~/hooks/use-refetch";
// import { api } from "~/trpc/react";
// import { useState, useEffect, useRef } from "react";
// import { X } from "lucide-react";

// type FormInput = {
//   repoUrl: string;
//   projectName: string;
//   githubToken?: string;
// };

// export default function CreatePage() {
//   const { register, handleSubmit, reset } = useForm<FormInput>();
//   const createProject = api.project.createProject.useMutation();
//   const refetch = useRefetch();
  
//   const [isProcessing, setIsProcessing] = useState(false);
//   const [mainStatusMessage, setMainStatusMessage] = useState<string>("");
//   const [progressBarStatus, setProgressBarStatus] = useState<string>("");
//   const [progressValue, setProgressValue] = useState<number>(0);
//   const progressInterval = useRef<NodeJS.Timeout | null>(null);

//   // Cleanup interval on unmount
//   useEffect(() => {
//     return () => {
//       if (progressInterval.current) clearInterval(progressInterval.current);
//     };
//   }, []);

//   function startProgressSimulation() {
//     if (progressInterval.current) clearInterval(progressInterval.current);
    
//     progressInterval.current = setInterval(() => {
//       setProgressValue(prev => {
//         // Gradually increase progress until 85%
//         const newValue = prev < 85 ? prev + Math.floor(Math.random() * 5) + 1 : prev;
//         return Math.min(newValue, 85);
//       });
//     }, 1000);
//   }

//   function updateProgressStep(message: string, value: number) {
//     setProgressBarStatus(message);
//     setMainStatusMessage(message);
//     setProgressValue(value);
//   }

//   function onSubmit(data: FormInput) {
//     setIsProcessing(true);
//     setProgressValue(5);
//     setProgressBarStatus("Initializing project creation...");
//     setMainStatusMessage("Initializing project creation...");
//     startProgressSimulation();

//     createProject.mutate(
//       {
//         name: data.projectName,
//         repoUrl: data.repoUrl,
//         githubToken: data.githubToken,
//       },
//       {
//         onMutate: () => {
//           updateProgressStep("Cloning repository...", 15);
//         },
//         onSuccess: () => {
//           // Clear simulation interval
//           if (progressInterval.current) clearInterval(progressInterval.current);
          
//           // Update progress steps in sequence
//           setTimeout(() => updateProgressStep("Analyzing code structure...", 30), 500);
//           setTimeout(() => updateProgressStep("Generating documentation summaries...", 50), 2000);
//           setTimeout(() => updateProgressStep("Creating embeddings for search...", 70), 4000);
//           setTimeout(() => updateProgressStep("Writing to database...", 85), 6000);
          
//           // Final success state
//           setTimeout(() => {
//             updateProgressStep("Project analysis complete!", 100);
//             toast.success("Project created successfully!", {
//               description: `"${data.projectName}" is ready to use`,
//               duration: 5000,
//             });
            
//             setTimeout(() => {
//               setIsProcessing(false);
//               setProgressValue(0);
//               refetch();
//               reset();
//             }, 2000);
//           }, 8000);
//         },
//         onError: (error: any) => {
//           if (progressInterval.current) clearInterval(progressInterval.current);
//           setMainStatusMessage(`Error: ${error.message}`);
//           setProgressBarStatus("Processing failed");
//           setProgressValue(0);
//           toast.error(`Failed to create project: ${error.message}`);
//           setIsProcessing(false);
//         },
//       }
//     );
//   }

//   return (
//     <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
//       {/* Main content container */}
//       <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full max-w-4xl">
//         {/* SVG on the left */}
//         <div className="flex-1 flex justify-center md:justify-end">
//           <div className="max-w-md">
//             <img 
//               src="/undraw_github.svg" 
//               className="h-auto w-full max-h-80" 
//               alt="GitHub illustration" 
//             />
//             <div className="mt-6 text-center md:text-left">
//               <h1 className="text-2xl font-bold text-gray-800">Link Your GitHub Repository</h1>
//               <p className="mt-2 text-gray-600">
//                 Connect your repositories to unlock powerful insights and code analysis
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Form on the right */}
//         <div className="flex-1 flex justify-center md:justify-start">
//           <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-md">
//             <form onSubmit={handleSubmit(onSubmit)}>
//               <div className="space-y-4">
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Project Name
//                   </label>
//                   <Input
//                     {...register("projectName", { required: true })}
//                     required
//                     placeholder="Enter project name"
//                   />
//                 </div>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     Repository URL
//                   </label>
//                   <Input
//                     {...register("repoUrl", { required: true })}
//                     required
//                     type="url"
//                     placeholder="https://github.com/user/repo"
//                   />
//                 </div>
                
//                 <div>
//                   <label className="block text-sm font-medium text-gray-700 mb-1">
//                     GitHub Token (optional)
//                   </label>
//                   <Input
//                     {...register("githubToken")}
//                     placeholder="ghp_xxxxxxxxxxxxxxxx"
//                   />
//                   <p className="mt-1 text-xs text-gray-500">
//                     Required for private repositories
//                   </p>
//                 </div>
                
//                 <Button
//                   type="submit"
//                   disabled={createProject.isPending}
//                   className="w-full py-2 text-lg mt-2"
//                 >
//                   {createProject.isPending ? "Processing..." : "Create Project"}
//                 </Button>
//               </div>
//             </form>
//           </div>
//         </div>
//       </div>

//       {/* Processing Indicator */}
//       {isProcessing && (
//         <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center p-4">
//           <div 
//             className="bg-white rounded-xl border shadow-lg w-full max-w-md p-6 animate-fade-in"
//           >
//             <div className="flex justify-between items-start mb-4">
//               <h3 className="text-lg font-semibold text-gray-900">
//                 {progressValue < 100 ? "Processing Repository" : "Success!"}
//               </h3>
//               <button 
//                 className="text-gray-500 hover:text-gray-700 transition-colors pointer-events-auto"
//                 onClick={() => setIsProcessing(false)}
//               >
//                 <X size={20} />
//               </button>
//             </div>
            
//             <div className="py-2">
//               <p className="text-gray-600">
//                 {mainStatusMessage}
//               </p>
//               <div className="mt-2 text-sm text-gray-500">
//                 {progressValue < 100 ? "This may take a few minutes..." : "Project is ready!"}
//               </div>
//             </div>
            
//             <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
//               <div 
//                 className="h-full bg-blue-600 transition-all duration-300 ease-out"
//                 style={{ width: `${progressValue}%` }}
//               />
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Progress Bar in the bottom right corner */}
//       {(isProcessing || progressValue > 0) && (
//         <div className="fixed bottom-6 right-6 w-72 z-50">
//           <StatusBar status={progressBarStatus} progress={progressValue} />
//         </div>
//       )}
//     </div>
//   );
// }